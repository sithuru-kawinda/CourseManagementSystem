import { getFirestore }       from 'firebase-admin/firestore';
import { createHttpError }     from '@shared/errors';
import { logger }              from '@shared/logger';
import { AppleAuthClient }     from '../../infrastructure/clients/AppleAuthClient';

/**
 * Revokes a user's Apple OAuth tokens.
 *
 * Required by Apple's guidelines (FR-AUTH-010) when a user deletes their account:
 *   https://developer.apple.com/news/releases/2022-06-07.html
 *
 * Flow:
 *  1. Read the stored Apple refresh_token from the user's Firestore doc
 *  2. Revoke it at Apple's revoke endpoint (best-effort; errors are swallowed)
 *  3. Clear the stored token from Firestore
 */
export class AppleRevokeUseCase {
  constructor(private readonly appleClient: AppleAuthClient) {}

  async execute(uid: string): Promise<void> {
    const userDoc = await getFirestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const refreshToken = userDoc.data()?.['appleRefreshToken'] as string | undefined;
    if (!refreshToken) {
      // No Apple token stored — nothing to revoke (user may have signed in with another provider)
      logger.info({ uid }, 'AppleRevokeUseCase: no Apple refresh token stored for user');
      return;
    }

    // Revocation is best-effort — errors are logged but not surfaced to the caller
    await this.appleClient
      .revokeToken(refreshToken, 'refresh_token')
      .catch((err: unknown) => logger.warn({ uid, err }, 'Apple token revocation failed — continuing account deletion'));

    // Clear the stored token regardless of revocation outcome
    await getFirestore().collection('users').doc(uid).update({
      appleRefreshToken: null,
      updatedAt:         new Date().toISOString(),
    });
  }
}
