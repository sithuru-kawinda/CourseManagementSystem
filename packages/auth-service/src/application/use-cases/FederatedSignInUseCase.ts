import { getAuth }              from 'firebase-admin/auth';
import { getFirestore }         from 'firebase-admin/firestore';
import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { GoogleAuthClient }     from '../../infrastructure/clients/GoogleAuthClient';
import { AppleAuthClient }      from '../../infrastructure/clients/AppleAuthClient';

export type FederatedProvider = 'google' | 'apple';

export interface FederatedSignInResult {
  firebaseToken: string;
  uid:           string;
  isNewUser:     boolean;
}

export interface VerifiedFederatedPayload {
  email:       string;
  displayName: string;
  providerUid: string;
  providerId:  'google.com' | 'apple.com';
}

export class FederatedSignInUseCase {
  constructor(
    private readonly googleClient: GoogleAuthClient,
    private readonly appleClient:  AppleAuthClient,
    private readonly outbox:       OutboxEventPublisher,
  ) {}

  async execute(
    provider:          FederatedProvider,
    idToken:           string,
    preferredLanguage: string,
    requestId:         string,
  ): Promise<FederatedSignInResult> {
    // 1. Verify token with appropriate provider client
    const payload = await this.verifyToken(provider, idToken);

    // 2. Find or create Firebase user
    let uid:       string;
    let isNewUser: boolean;
    // Tracked here so we can embed them as developerClaims in the custom token,
    // guaranteeing the first ID token (from signInWithCustomToken) always has the
    // role claim — even before setCustomUserClaims propagates to Firebase's edge servers.
    let userRole:  string   = 'member';
    let userRoles: string[] = ['member'];

    try {
      const existingUser = await getAuth().getUserByEmail(payload.email);
      uid       = existingUser.uid;
      isNewUser = false;
    } catch {
      // User not found — create new Member
      const newRecord = await getAuth().createUser({
        email:         payload.email,
        displayName:   payload.displayName,
        emailVerified: true,
      });
      uid       = newRecord.uid;
      isNewUser = true;

      await getAuth().setCustomUserClaims(uid, { role: 'member', roles: ['member'] });
      // userRole / userRoles keep their default 'member' values

      const now = new Date().toISOString();
      await getFirestore().collection('users').doc(uid).set({
        email:                   payload.email,
        firstName:               payload.displayName.split(' ')[0] ?? payload.displayName,
        lastName:                payload.displayName.split(' ').slice(1).join(' ') || '',
        role:                    'member',
        roles:                   ['member'],
        status:                  'approved',
        profilePhotoUrl:         null,
        preferredLanguage:       preferredLanguage,
        fcmTokens:               [],
        notificationPreferences: { email: true, push: true },
        providers:               [payload.providerId],
        createdAt:               now,
        updatedAt:               now,
        deletedAt:               null,
      });

      await this.outbox.publishWithBatch({
        type:      'user.registered',
        payload:   { uid, email: payload.email, firstName: payload.displayName },
        requestId,
      });
    }

    // 3. For existing users, read their actual roles and refresh Firebase Auth claims.
    //    This handles accounts whose claims were never set or became stale (e.g. after
    //    account deletion + re-creation via a different path).
    if (!isNewUser) {
      const userDoc = await getFirestore().collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data      = userDoc.data()!;
        const providers: string[] = (data.providers as string[] | undefined) ?? ['password'];
        if (!providers.includes(payload.providerId)) {
          await getFirestore().collection('users').doc(uid).update({
            providers: [...providers, payload.providerId],
            updatedAt: new Date().toISOString(),
          });
        }
        // Refresh Firebase Auth custom claims from Firestore source of truth
        userRoles = (data.roles as string[] | undefined) ?? ['member'];
        userRole  = (data.role  as string  | undefined) ?? userRoles[0] ?? 'member';
        await getAuth().setCustomUserClaims(uid, { role: userRole, roles: userRoles });
      }
    }

    // 4. Issue Firebase custom token — embed role claims as developerClaims so the
    //    very first ID token (from signInWithCustomToken) always contains the role,
    //    regardless of setCustomUserClaims propagation timing.
    //    Client exchanges via signInWithCustomToken().
    const firebaseToken = await getAuth().createCustomToken(uid, { role: userRole, roles: userRoles });

    return { firebaseToken, uid, isNewUser };
  }

  // Internal verification — also used by the internal verify endpoint
  async verifyToken(provider: FederatedProvider, idToken: string): Promise<VerifiedFederatedPayload> {
    if (provider === 'google') {
      const p = await this.googleClient.verifyIdToken(idToken);
      return {
        email:       p.email,
        displayName: p.name,
        providerUid: p.googleUid,
        providerId:  'google.com',
      };
    } else if (provider === 'apple') {
      const p = await this.appleClient.verifyIdToken(idToken);
      return {
        email:       p.email,
        displayName: p.email.split('@')[0],
        providerUid: p.appleUid,
        providerId:  'apple.com',
      };
    }
    throw createHttpError(400, 'VALIDATION_ERROR', 'Unknown provider. Must be "google" or "apple".');
  }
}
