import { v4 as uuidv4 }                    from 'uuid';
import jwt                                  from 'jsonwebtoken';
import { getFirestore }                     from 'firebase-admin/firestore';
import { Request, Response, NextFunction }  from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError, createHttpError }    from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { logger }                           from '@shared/logger';
import { RegisterUseCase }                  from '../../application/use-cases/RegisterUseCase';
import { LogoutUseCase }                    from '../../application/use-cases/LogoutUseCase';
import { TrackLoginAttemptsUseCase }        from '../../application/use-cases/TrackLoginAttemptsUseCase';
import { RequestPasswordResetUseCase }      from '../../application/use-cases/RequestPasswordResetUseCase';
import { VerifyOtpAndResetUseCase }         from '../../application/use-cases/VerifyOtpAndResetUseCase';
import { FederatedSignInUseCase, FederatedProvider } from '../../application/use-cases/FederatedSignInUseCase';
import { AppleWebCallbackUseCase }          from '../../application/use-cases/AppleWebCallbackUseCase';
import { AppleRevokeUseCase }               from '../../application/use-cases/AppleRevokeUseCase';
import { ResendVerificationUseCase }        from '../../application/use-cases/ResendVerificationUseCase';
import { VerifyEmailOtpUseCase }            from '../../application/use-cases/VerifyEmailOtpUseCase';
import { AppleAuthClient }                  from '../../infrastructure/clients/AppleAuthClient';
import { config }                           from '../../config';
import {
  registerSchema, passwordResetSchema, verifyOtpSchema, trackFailureSchema,
  federatedSignInSchema, verifyTokenInternalSchema, appleCallbackSchema,
  resendVerificationSchema, verifyEmailOtpSchema,
} from '../validators/authValidator';

export class AuthController {
  constructor(
    private readonly registerUseCase:           RegisterUseCase,
    private readonly logoutUseCase:             LogoutUseCase,
    private readonly trackAttemptsUseCase:      TrackLoginAttemptsUseCase,
    private readonly requestResetUseCase:       RequestPasswordResetUseCase,
    private readonly verifyOtpUseCase:          VerifyOtpAndResetUseCase,
    private readonly federatedSignInUseCase:    FederatedSignInUseCase,
    private readonly appleCallbackUseCase:      AppleWebCallbackUseCase,
    private readonly appleRevokeUseCase:        AppleRevokeUseCase,
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    private readonly verifyEmailOtpUseCase:     VerifyEmailOtpUseCase,
    private readonly appleClient:               AppleAuthClient,
  ) {}

  // ── Standard auth endpoints ────────────────────────────────────────────────

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result = await this.registerUseCase.execute(parsed.data, requestId);
      sendSuccess(res, result, 201);
    } catch (err) { next(err); }
  };

  federatedSignIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = req.params.provider as FederatedProvider;
      if (provider !== 'google' && provider !== 'apple') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provider must be "google" or "apple".' } });
        return;
      }
      const parsed = federatedSignInSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result    = await this.federatedSignInUseCase.execute(
        provider, parsed.data.idToken, parsed.data.preferredLanguage, requestId,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.logoutUseCase.execute(uid);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  passwordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = passwordResetSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      await this.requestResetUseCase.execute(parsed.data.email);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  verifyOtpAndReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      await this.verifyOtpUseCase.execute(parsed.data.email, parsed.data.otp);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  trackFailure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = trackFailureSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.trackAttemptsUseCase.execute(parsed.data.email);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = resendVerificationSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      await this.resendVerificationUseCase.execute(parsed.data.email);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  verifyEmailOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = verifyEmailOtpSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      await this.verifyEmailOtpUseCase.execute(parsed.data.email, parsed.data.otp);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  // Internal — used by user-service to verify federated tokens for provider linking
  verifyFederatedToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = verifyTokenInternalSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const payload = await this.federatedSignInUseCase.verifyToken(
        parsed.data.provider, parsed.data.idToken,
      );
      sendSuccess(res, payload);
    } catch (err) { next(err); }
  };

  // ── Apple web OAuth endpoints ──────────────────────────────────────────────

  /**
   * GET /auth/apple/init
   *
   * Issues a signed state JWT (CSRF guard) and returns the full Apple
   * authorization URL for the frontend to redirect the user to.
   *
   * Frontend flow:
   *   1. Call GET /auth/apple/init → { state, authorizeUrl }
   *   2. Save `state` to sessionStorage
   *   3. window.location.href = authorizeUrl
   */
  appleInit = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!config.appleClientId || !config.appleRedirectUri) {
        return next(createHttpError(404, 'APPLE_NOT_CONFIGURED', 'Apple Sign In is not configured on this server.'));
      }

      // State JWT — short-lived, binds callback to this initiation (CSRF protection)
      const state = config.jwtSecret
        ? jwt.sign({ nonce: uuidv4() }, config.jwtSecret, { expiresIn: '10m' })
        : uuidv4(); // dev fallback when JWT_SECRET is not set

      const params = new URLSearchParams({
        client_id:     config.appleClientId,
        redirect_uri:  config.appleRedirectUri,
        response_type: 'code',
        scope:         'name email',
        response_mode: 'form_post',
        state,
      });

      const authorizeUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
      sendSuccess(res, { state, authorizeUrl });
    } catch (err) { next(err); }
  };

  /**
   * POST /auth/apple/callback
   *
   * Apple POSTs here with application/x-www-form-urlencoded:
   *   { code, state, user? }   (user JSON only on first sign-in)
   *
   * This endpoint also accepts application/json for when the frontend
   * forwards the code rather than letting Apple POST directly.
   *
   * Response: { firebaseToken, uid, isNewUser }
   * The frontend calls signInWithCustomToken(firebaseToken) to complete sign-in.
   */
  appleCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.appleClientId) {
        return next(createHttpError(404, 'APPLE_NOT_CONFIGURED', 'Apple Sign In is not configured on this server.'));
      }
      const parsed = appleCallbackSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const requestId = (req.headers['x-request-id'] as string) ?? '';

      const result = await this.appleCallbackUseCase.execute(
        parsed.data.code,
        parsed.data.state,
        parsed.data.user,
        requestId,
      );

      sendSuccess(res, result);
    } catch (err) {
      logger.warn({ err }, 'Apple OAuth callback error');
      next(err);
    }
  };

  /**
   * POST /auth/apple/refresh
   *
   * Validates that the user's stored Apple refresh token is still active.
   * Returns { valid: true } on success, 401 if Apple has revoked the token.
   */
  appleRefresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;

      const userDoc = await getFirestore().collection('users').doc(uid).get();
      const refreshToken = userDoc.data()?.['appleRefreshToken'] as string | undefined;

      if (!refreshToken) {
        return next(createHttpError(404, 'APPLE_TOKEN_NOT_FOUND', 'No Apple session found for this account.'));
      }

      // refreshToken throws 401 if the token is invalid or revoked
      await this.appleClient.refreshToken(refreshToken);

      sendSuccess(res, { valid: true });
    } catch (err) { next(err); }
  };

  /**
   * POST /auth/apple/revoke
   *
   * Revokes the user's Apple tokens. Required by Apple when deleting an account.
   * Safe to call even if no Apple token is stored.
   */
  appleRevoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.appleRevokeUseCase.execute(uid);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
