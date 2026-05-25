import { getAuth }              from 'firebase-admin/auth';
import { getFirestore }         from 'firebase-admin/firestore';
import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { logger }               from '@shared/logger';
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

    // ── Step 2: Find or create Firebase Auth user ─────────────────────────────
    let uid:      string;
    let isNewUser: boolean;

    try {
      const existing = await getAuth().getUserByEmail(payload.email);
      uid       = existing.uid;
      isNewUser = false;
    } catch {
      // User not found in Firebase Auth — create a new account
      const newRecord = await getAuth().createUser({
        email:         payload.email,
        displayName:   payload.displayName,
        emailVerified: true,  // Federated users are always email-verified
      });
      uid       = newRecord.uid;
      isNewUser = true;
    }

    // ── Step 3: Upsert Firestore users document ───────────────────────────────
    //
    // Handles three cases:
    //   A) Brand-new Google/Apple sign-up (isNewUser=true, no Firestore doc)
    //   B) Firebase Auth user exists but Firestore doc is missing (e.g. created
    //      via Firebase Console, or doc was deleted while Auth account survived)
    //   C) Fully existing user — update provider list and refresh claims
    //
    const db      = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    // Role/roles to embed in the custom token developer claims (cases A & B default to member)
    let userRole:  string   = 'member';
    let userRoles: string[] = ['member'];

    if (!userDoc.exists) {
      // Cases A & B — create the Firestore profile
      const firstName = payload.displayName.split(' ')[0] ?? payload.displayName;
      const lastName  = payload.displayName.split(' ').slice(1).join(' ') || '';
      const now       = new Date().toISOString();

      await userRef.set({
        email:                   payload.email,
        firstName,
        lastName,
        role:                    'member',
        roles:                   ['member'],
        status:                  'approved',
        profilePhotoUrl:         null,
        preferredLanguage,
        fcmTokens:               [],
        notificationPreferences: { email: true, push: true },
        providers:               [payload.providerId],
        createdAt:               now,
        updatedAt:               now,
        deletedAt:               null,
      });

      // Set Firebase Auth custom claims (needed even for case B where auth user exists)
      await getAuth().setCustomUserClaims(uid, { role: 'member', roles: ['member'] });

      // Publish user.registered outbox event so notification-service sends welcome email
      // and audit-service records the registration. Only emit once — case B (Firebase user
      // already existed but had no Firestore doc) still counts as a "new member" in our system.
      await this.outbox.publishWithBatch({
        type:    'user.registered',
        payload: { uid, email: payload.email, firstName },
        requestId,
      });

      if (!isNewUser) {
        // Case B: log for visibility — indicates a Firebase user with no backend profile
        logger.warn({ uid, email: payload.email, provider }, 'federated: Firebase user existed but Firestore doc was missing — created now');
      }
    } else {
      // Case C — profile already exists; ensure this provider is in the providers list
      // and refresh Firebase Auth custom claims from Firestore (source of truth).
      const data      = userDoc.data()!;
      const providers: string[] = (data.providers as string[] | undefined) ?? ['password'];

      if (!providers.includes(payload.providerId)) {
        await userRef.update({
          providers: [...providers, payload.providerId],
          updatedAt: new Date().toISOString(),
        });
      }

      // Read actual roles from Firestore and refresh the Firebase Auth custom claims.
      // This handles claims that became stale (e.g. role was granted since last sign-in).
      userRoles = (data.roles as string[] | undefined) ?? ['member'];
      userRole  = (data.role  as string  | undefined) ?? userRoles[0] ?? 'member';
      await getAuth().setCustomUserClaims(uid, { role: userRole, roles: userRoles });
    }

    // ── Step 4: Issue Firebase custom token ───────────────────────────────────
    // Embed role claims as developerClaims so the very first ID token
    // (from signInWithCustomToken on the client) already contains the role —
    // regardless of setCustomUserClaims propagation timing.
    const firebaseToken = await getAuth().createCustomToken(uid, { role: userRole, roles: userRoles });

    return { firebaseToken, uid, isNewUser };
  }

  // ── Token verification — also used by the internal /verify-token endpoint ────
  async verifyToken(provider: FederatedProvider, idToken: string): Promise<VerifiedFederatedPayload> {
    if (provider === 'google') {
      const p = await this.googleClient.verifyIdToken(idToken);
      return {
        email:       p.email,
        displayName: p.name,
        providerUid: p.googleUid,
        providerId:  'google.com',
      };
    }

    if (provider === 'apple') {
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
