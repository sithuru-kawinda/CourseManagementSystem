import { Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../../src/index';

// ── Mock firebase-admin/auth ──────────────────────────────────────────────────
const mockVerifyIdToken = jest.fn();
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

// ── Mock @shared/errors ───────────────────────────────────────────────────────
jest.mock('@shared/errors', () => ({
  createHttpError: (status: number, code: string, message: string) => {
    const err: any = new Error(message);
    err.status    = status;
    err.errorCode = code;
    return err;
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

const res  = {} as Response;
const next = jest.fn() as unknown as NextFunction;

describe('authenticate()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches principal and calls next() on a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid:   'user-1',
      email: 'test@example.com',
      role:  'student',
    });

    const req = makeReq('Bearer valid-token');
    await authenticate()(req, res, next);

    expect((req as AuthenticatedRequest).principal).toEqual({
      uid:   'user-1',
      email: 'test@example.com',
      role:  'student',
      roles: ['student'],
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(401 UNAUTHENTICATED) when Authorization header is missing', async () => {
    const req = makeReq();
    await authenticate()(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'UNAUTHENTICATED' }),
    );
  });

  it('calls next(401 UNAUTHENTICATED) when header does not start with Bearer', async () => {
    const req = makeReq('Basic sometoken');
    await authenticate()(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'UNAUTHENTICATED' }),
    );
  });

  it('calls next(401 TOKEN_REVOKED) when Firebase returns auth/id-token-revoked', async () => {
    const err: any = new Error('revoked');
    err.code = 'auth/id-token-revoked';
    mockVerifyIdToken.mockRejectedValue(err);

    await authenticate()(makeReq('Bearer revoked-token'), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'TOKEN_REVOKED' }),
    );
  });

  it('calls next(401 TOKEN_EXPIRED) when Firebase returns auth/id-token-expired', async () => {
    const err: any = new Error('expired');
    err.code = 'auth/id-token-expired';
    mockVerifyIdToken.mockRejectedValue(err);

    await authenticate()(makeReq('Bearer expired-token'), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'TOKEN_EXPIRED' }),
    );
  });

  it('calls next(401 INVALID_TOKEN) for any other Firebase error', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('unknown'));

    await authenticate()(makeReq('Bearer bad-token'), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'INVALID_TOKEN' }),
    );
  });

  it('calls next(401 INVALID_TOKEN) when token has no role claim', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'x@y.com' }); // no role

    await authenticate()(makeReq('Bearer no-role-token'), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'INVALID_TOKEN' }),
    );
  });

  it('verifyIdToken is always called with checkRevoked=true', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u', email: 'e@e.com', role: 'student' });

    await authenticate()(makeReq('Bearer some-token'), res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('some-token', true);
  });

  // ── Email-verification gate ───────────────────────────────────────────────

  describe('email_verified gate', () => {
    it('rejects with 403 EMAIL_NOT_VERIFIED when email_verified is false', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'member', email_verified: false,
      });

      await authenticate()(makeReq('Bearer unverified-token'), res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403, errorCode: 'EMAIL_NOT_VERIFIED' }),
      );
    });

    it('does NOT attach principal when email is unverified', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'member', email_verified: false,
      });
      const req = makeReq('Bearer unverified-token');

      await authenticate()(req, res, next);

      expect((req as any).principal).toBeUndefined();
    });

    it('passes through when email_verified is true', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'student', email_verified: true,
      });

      await authenticate()(makeReq('Bearer verified-token'), res, next);

      expect(next).toHaveBeenCalledWith(); // no error argument
    });

    it('passes through when email_verified is undefined (old tokens without the claim — backward compat)', async () => {
      // Tokens issued before Firebase started including the claim don't have email_verified.
      // We must not block these — only block when explicitly false.
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'admin',
        // email_verified deliberately absent
      });

      await authenticate()(makeReq('Bearer legacy-token'), res, next);

      expect(next).toHaveBeenCalledWith(); // passes through
    });

    it('bypasses the gate when allowUnverified: true', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'member', email_verified: false,
      });
      const req = makeReq('Bearer unverified-token');

      await authenticate({ allowUnverified: true })(req, res, next);

      expect(next).toHaveBeenCalledWith(); // no error
      expect((req as any).principal).toBeDefined();
    });

    it('still enforces the gate when allowUnverified is explicitly false', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'member', email_verified: false,
      });

      await authenticate({ allowUnverified: false })(makeReq('Bearer token'), res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403, errorCode: 'EMAIL_NOT_VERIFIED' }),
      );
    });

    it('error message from EMAIL_NOT_VERIFIED mentions resend endpoint', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1', email: 'test@example.com', role: 'member', email_verified: false,
      });

      await authenticate()(makeReq('Bearer token'), res, next);

      const err = (next as jest.Mock).mock.calls[0][0];
      expect(err.message).toMatch(/resend-verification/i);
    });

    it('allowUnverified: true attaches the correct principal even for unverified user', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid:            'uid-unv',
        email:          'unverified@example.com',
        role:           'member',
        roles:          ['member'],
        email_verified: false,
      });
      const req = makeReq('Bearer unverified-token');

      await authenticate({ allowUnverified: true })(req, res, next);

      expect((req as any).principal).toMatchObject({
        uid:   'uid-unv',
        email: 'unverified@example.com',
        role:  'member',
      });
    });
  });
});
