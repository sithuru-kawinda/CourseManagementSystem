import jwt                  from 'jsonwebtoken';
import jwksClient            from 'jwks-rsa';
import { createHttpError }   from '@shared/errors';
import { logger }            from '@shared/logger';
import { config }            from '../../config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApplePayload {
  email:    string;
  appleUid: string; // Apple's sub claim
}

export interface AppleTokenResponse {
  access_token:  string;
  token_type:    string;
  expires_in:    number;
  refresh_token: string;
  id_token:      string;
}

// ─── JWKS setup (shared for both flows) ─────────────────────────────────────

const APPLE_BASE_URL  = 'https://appleid.apple.com';
const APPLE_JWKS_URI  = `${APPLE_BASE_URL}/auth/keys`;
const APPLE_TOKEN_URL = `${APPLE_BASE_URL}/auth/token`;
const APPLE_REVOKE_URL = `${APPLE_BASE_URL}/auth/revoke`;

const jwks = jwksClient({
  jwksUri:         APPLE_JWKS_URI,
  cache:           true,
  cacheMaxEntries: 5,
  cacheMaxAge:     600_000, // 10 min
});

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) return reject(new Error('No kid in JWT header'));
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class AppleAuthClient {

  // ── Shared: verify an Apple identity token (used by both SDK & web flows) ──

  async verifyIdToken(idToken: string): Promise<ApplePayload> {
    // Emulator bypass: accept base64-encoded JSON test payload in non-production
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== 'production') {
      try {
        const parsed = JSON.parse(Buffer.from(idToken, 'base64').toString('utf8')) as Record<string, unknown>;
        if (typeof parsed?.email === 'string') {
          return {
            email:    parsed.email,
            appleUid: (parsed.sub as string | undefined) ?? parsed.email,
          };
        }
      } catch { /* not a test payload — fall through to real verification */ }
    }

    try {
      const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
        jwt.verify(
          idToken,
          (header, cb) => {
            getSigningKey(header)
              .then(key => cb(null, key))
              .catch((err: Error) => cb(err));
          },
          {
            issuer:     APPLE_BASE_URL,
            audience:   config.appleClientId || undefined,
            algorithms: ['RS256'],
          },
          (err, payload) => {
            if (err) return reject(err);
            resolve(payload as jwt.JwtPayload);
          },
        );
      });

      // Apple may omit email for "Hide My Email" users — synthesise a private relay address
      const email = (decoded['email'] as string | undefined)
        ?? `${decoded['sub'] as string}@privaterelay.appleid.com`;

      return { email, appleUid: decoded['sub'] as string };
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 401) throw err;
      throw createHttpError(401, 'FEDERATED_TOKEN_INVALID', 'Apple identity token verification failed.');
    }
  }

  // ── Web OAuth: generate client_secret JWT (Apple requires ES256) ──────────
  // Valid for up to 6 months; re-generated on every code exchange (safe to be short-lived).
  // See: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens

  generateClientSecret(): string {
    if (!config.applePrivateKey || !config.appleTeamId || !config.appleKeyId || !config.appleClientId) {
      throw createHttpError(500, 'APPLE_CONFIG_MISSING', 'Apple web OAuth credentials are not configured.');
    }

    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iss: config.appleTeamId,
        iat: now,
        exp: now + 15_777_000,            // 6 months (Apple's maximum)
        aud: APPLE_BASE_URL,
        sub: config.appleClientId,
      },
      config.applePrivateKey,
      {
        algorithm: 'ES256',
        keyid:     config.appleKeyId,
      },
    );
  }

  // ── Web OAuth: exchange authorization code for tokens ─────────────────────
  // Called once in the callback after Apple redirects back with `code`.
  // The `redirect_uri` must exactly match the one registered in the Apple dashboard.

  async exchangeCode(code: string): Promise<AppleTokenResponse> {
    const clientSecret = this.generateClientSecret();

    const body = new URLSearchParams({
      client_id:     config.appleClientId,
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  config.appleRedirectUri,
    });

    const response = await fetch(APPLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore */ }
      logger.warn({ status: response.status, detail }, 'Apple token exchange failed');
      throw createHttpError(401, 'FEDERATED_TOKEN_INVALID', 'Apple authorization code exchange failed.');
    }

    return response.json() as Promise<AppleTokenResponse>;
  }

  // ── Web OAuth: refresh an existing Apple session ──────────────────────────
  // Used to verify the Apple refresh token is still valid.
  // Apple does not return a new id_token on refresh — only a new access_token.

  async refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const clientSecret = this.generateClientSecret();

    const body = new URLSearchParams({
      client_id:     config.appleClientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(APPLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore */ }
      logger.warn({ status: response.status, detail }, 'Apple token refresh failed');
      throw createHttpError(401, 'FEDERATED_TOKEN_INVALID', 'Apple refresh token is invalid or expired.');
    }

    return response.json() as Promise<{ access_token: string; expires_in: number }>;
  }

  // ── Web OAuth: revoke Apple tokens ────────────────────────────────────────
  // Required by Apple's guidelines when a user deletes their account (FR-AUTH-010).
  // Must revoke both access_token and refresh_token.
  // See: https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens

  async revokeToken(token: string, hint: 'access_token' | 'refresh_token'): Promise<void> {
    const clientSecret = this.generateClientSecret();

    const body = new URLSearchParams({
      client_id:        config.appleClientId,
      client_secret:    clientSecret,
      token,
      token_type_hint:  hint,
    });

    const response = await fetch(APPLE_REVOKE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    // Apple returns 200 even if the token was already revoked — that's fine.
    // Only treat non-200 as an error.
    if (!response.ok) {
      logger.warn({ status: response.status, hint }, 'Apple token revocation returned non-200');
      // Do not throw — revocation is best-effort during account deletion
    }
  }
}
