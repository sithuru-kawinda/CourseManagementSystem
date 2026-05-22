import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { internalAuth }            from '../middleware/internalAuth';
import { container }               from '../../container';

export const authRouter = Router();

// ── Standard auth (public) ────────────────────────────────────────────────────
authRouter.post('/auth/register',              container.authController.register);
authRouter.post('/auth/password-reset',        container.authController.passwordReset);
authRouter.post('/auth/password-reset/verify', container.authController.verifyOtpAndReset);
authRouter.post('/auth/track-failure',         container.authController.trackFailure);

// ── Authenticated ─────────────────────────────────────────────────────────────
authRouter.post('/auth/logout', authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.authController.logout);

// ── Federated OAuth — mobile SDK flow (V2) ────────────────────────────────────
// Client sends an id_token obtained from the Apple/Google SDK directly.
authRouter.post('/auth/federated/:provider', container.authController.federatedSignIn);

// ── Apple web OAuth flow (V2) ─────────────────────────────────────────────────
// Step 1: frontend calls this to get a CSRF state token + the full Apple auth URL.
authRouter.get('/auth/apple/init', container.authController.appleInit);

// Step 2: Apple redirects (form POST) here after the user consents.
//         Also accepts JSON body when the frontend forwards the code itself.
authRouter.post('/auth/apple/callback', container.authController.appleCallback);

// Step 3 (optional): verify the Apple session is still active.
authRouter.post('/auth/apple/refresh', authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.authController.appleRefresh);

// Account deletion: revoke Apple tokens (required by Apple guidelines).
authRouter.post('/auth/apple/revoke', authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.authController.appleRevoke);

// ── Internal ──────────────────────────────────────────────────────────────────
// Used by user-service to verify federated tokens for POST /me/providers/link.
authRouter.post('/internal/auth/verify-token', internalAuth, container.authController.verifyFederatedToken);
