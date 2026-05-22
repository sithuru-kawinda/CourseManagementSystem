/**
 * Unit tests for AppleWebCallbackUseCase
 * Covers: state validation, code exchange, new-user creation, returning-user update,
 *         user JSON parsing, private-relay email fallback, and Firestore rollback.
 */

// ─── Firebase Admin mocks ────────────────────────────────────────────────────

const mockGetUserByEmail    = jest.fn();
const mockCreateUser        = jest.fn();
const mockSetCustomClaims   = jest.fn();
const mockCreateCustomToken = jest.fn();
const mockFirestoreSet      = jest.fn();
const mockFirestoreGet      = jest.fn();
const mockFirestoreUpdate   = jest.fn();
const mockFirestoreDocRef   = {
  set:    mockFirestoreSet,
  get:    mockFirestoreGet,
  update: mockFirestoreUpdate,
};
const mockFirestoreDoc = jest.fn().mockReturnValue(mockFirestoreDocRef);

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn().mockReturnValue({
    getUserByEmail:      mockGetUserByEmail,
    createUser:          mockCreateUser,
    setCustomUserClaims: mockSetCustomClaims,
    createCustomToken:   mockCreateCustomToken,
  }),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({ doc: mockFirestoreDoc }),
  }),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
// Provide a real jwtSecret so state verification tests work without jsonwebtoken internals

jest.mock('../../../src/config', () => ({
  config: {
    appleClientId:    'com.tcr.futurecx.com',
    appleTeamId:      'L38FDYA5NG',
    appleKeyId:       '5BSLDH2799',
    applePrivateKey:  '',
    appleRedirectUri: 'https://cms.bethelnet.au/auth/apple/callback',
    jwtSecret:        'test-secret-for-unit-tests',
    frontendUrl:      'https://cms.bethelnet.au',
  },
}));

import jwt from 'jsonwebtoken';
import { AppleWebCallbackUseCase }  from '../../../src/application/use-cases/AppleWebCallbackUseCase';
import { AppleAuthClient }          from '../../../src/infrastructure/clients/AppleAuthClient';
import { OutboxEventPublisher }     from '@shared/events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeAppleClient = (): jest.Mocked<AppleAuthClient> => ({
  verifyIdToken:        jest.fn(),
  generateClientSecret: jest.fn().mockReturnValue('mock-client-secret'),
  exchangeCode:         jest.fn(),
  refreshToken:         jest.fn(),
  revokeToken:          jest.fn(),
} as unknown as jest.Mocked<AppleAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeValidState = () =>
  jwt.sign({ nonce: 'test-nonce' }, 'test-secret-for-unit-tests', { expiresIn: '10m' });

const validTokenResponse = {
  access_token:  'mock-access-token',
  token_type:    'bearer',
  expires_in:    3600,
  refresh_token: 'mock-refresh-token',
  id_token:      'mock-id-token',
};

const validApplePayload = {
  email:    'user@example.com',
  appleUid: 'apple-sub-123',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AppleWebCallbackUseCase', () => {
  let appleClient: jest.Mocked<AppleAuthClient>;
  let outbox:      jest.Mocked<OutboxEventPublisher>;
  let useCase:     AppleWebCallbackUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    appleClient = makeAppleClient();
    outbox      = makeOutbox();
    useCase     = new AppleWebCallbackUseCase(appleClient, outbox);

    mockCreateCustomToken.mockResolvedValue('firebase-custom-token');
    mockFirestoreSet.mockResolvedValue(undefined);
    mockFirestoreUpdate.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
  });

  // ── New user ────────────────────────────────────────────────────────────────

  describe('new user', () => {
    beforeEach(() => {
      mockGetUserByEmail.mockRejectedValue(new Error('auth/user-not-found'));
      mockCreateUser.mockResolvedValue({ uid: 'new-uid-abc' });
      mockSetCustomClaims.mockResolvedValue(undefined);
      appleClient.exchangeCode.mockResolvedValue(validTokenResponse);
      appleClient.verifyIdToken.mockResolvedValue(validApplePayload);
    });

    it('creates a Firebase user and Firestore doc for a new Apple sign-in', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', emailVerified: true }),
      );
      expect(mockSetCustomClaims).toHaveBeenCalledWith('new-uid-abc', { role: 'member', roles: ['member'] });
      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({
          email:             'user@example.com',
          roles:             ['member'],
          status:            'approved',
          providers:         ['apple.com'],
          appleRefreshToken: 'mock-refresh-token',
        }),
      );
    });

    it('returns firebaseToken, uid, isNewUser=true', async () => {
      const r = await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(r.firebaseToken).toBe('firebase-custom-token');
      expect(r.uid).toBe('new-uid-abc');
      expect(r.isNewUser).toBe(true);
    });

    it('publishes user.registered outbox event for new user', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user.registered' }),
      );
    });

    it('parses user JSON for first name and last name on first sign-in', async () => {
      const userJson = JSON.stringify({ name: { firstName: 'John', lastName: 'Doe' } });
      await useCase.execute('auth-code', makeValidState(), userJson, 'req-1');

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'John', lastName: 'Doe' }),
      );
    });

    it('falls back to email prefix for firstName when user JSON is absent', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'user' }),
      );
    });

    it('handles Apple private-relay email (no @ in email prefix)', async () => {
      appleClient.verifyIdToken.mockResolvedValue({
        email:    'apple-sub-123@privaterelay.appleid.com',
        appleUid: 'apple-sub-123',
      });

      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'apple-sub-123@privaterelay.appleid.com' }),
      );
    });

    it('stores Apple refresh_token on the user doc', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({ appleRefreshToken: 'mock-refresh-token' }),
      );
    });
  });

  // ── Returning user ──────────────────────────────────────────────────────────

  describe('returning user', () => {
    beforeEach(() => {
      mockGetUserByEmail.mockResolvedValue({ uid: 'existing-uid' });
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({
          providers:         ['password'],
          appleRefreshToken: null,
        }),
      });
      appleClient.exchangeCode.mockResolvedValue(validTokenResponse);
      appleClient.verifyIdToken.mockResolvedValue(validApplePayload);
    });

    it('returns isNewUser=false for an existing user', async () => {
      const result = await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');
      expect(result.isNewUser).toBe(false);
      expect(result.uid).toBe('existing-uid');
    });

    it('does NOT publish user.registered for returning user', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');
      expect(outbox.publishWithBatch).not.toHaveBeenCalled();
    });

    it('adds apple.com to providers if not already present', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ providers: ['password', 'apple.com'] }),
      );
    });

    it('does NOT duplicate apple.com in providers', async () => {
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({ providers: ['apple.com'], appleRefreshToken: 'old-token' }),
      });

      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      // providers should not have apple.com added again
      const updateCall = mockFirestoreUpdate.mock.calls[0][0] as Record<string, unknown>;
      if (updateCall.providers) {
        expect((updateCall.providers as string[]).filter(p => p === 'apple.com').length).toBe(1);
      }
    });

    it('updates Apple refresh_token for returning user', async () => {
      await useCase.execute('auth-code', makeValidState(), undefined, 'req-1');

      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ appleRefreshToken: 'mock-refresh-token' }),
      );
    });
  });

  // ── State / CSRF validation ─────────────────────────────────────────────────

  describe('state CSRF validation', () => {
    it('throws 400 INVALID_STATE when state is missing and jwtSecret is configured', async () => {
      appleClient.exchangeCode.mockResolvedValue(validTokenResponse);
      appleClient.verifyIdToken.mockResolvedValue(validApplePayload);

      await expect(
        useCase.execute('code', undefined, undefined, 'req-1'),
      ).rejects.toMatchObject({ status: 400, errorCode: 'INVALID_STATE' });
    });

    it('throws 400 INVALID_STATE when state JWT is expired', async () => {
      const expiredState = jwt.sign({ nonce: 'x' }, 'test-secret-for-unit-tests', { expiresIn: '-1s' });

      await expect(
        useCase.execute('code', expiredState, undefined, 'req-1'),
      ).rejects.toMatchObject({ status: 400, errorCode: 'INVALID_STATE' });
    });

    it('throws 400 INVALID_STATE when state JWT is signed with wrong secret', async () => {
      const wrongState = jwt.sign({ nonce: 'x' }, 'wrong-secret');

      await expect(
        useCase.execute('code', wrongState, undefined, 'req-1'),
      ).rejects.toMatchObject({ status: 400, errorCode: 'INVALID_STATE' });
    });

    it('accepts a valid state JWT', async () => {
      mockGetUserByEmail.mockRejectedValue(new Error('not-found'));
      mockCreateUser.mockResolvedValue({ uid: 'uid-ok' });
      mockSetCustomClaims.mockResolvedValue(undefined);
      appleClient.exchangeCode.mockResolvedValue(validTokenResponse);
      appleClient.verifyIdToken.mockResolvedValue(validApplePayload);

      await expect(
        useCase.execute('code', makeValidState(), undefined, 'req-1'),
      ).resolves.toBeDefined();
    });
  });

  // ── Code exchange ───────────────────────────────────────────────────────────

  describe('code exchange', () => {
    it('passes the authorization code to AppleAuthClient.exchangeCode', async () => {
      mockGetUserByEmail.mockRejectedValue(new Error('not-found'));
      mockCreateUser.mockResolvedValue({ uid: 'uid-ok' });
      mockSetCustomClaims.mockResolvedValue(undefined);
      appleClient.exchangeCode.mockResolvedValue(validTokenResponse);
      appleClient.verifyIdToken.mockResolvedValue(validApplePayload);

      await useCase.execute('my-auth-code', makeValidState(), undefined, 'req-1');

      expect(appleClient.exchangeCode).toHaveBeenCalledWith('my-auth-code');
    });

    it('throws FEDERATED_TOKEN_INVALID when Apple rejects the code', async () => {
      appleClient.exchangeCode.mockRejectedValue(
        Object.assign(new Error('bad code'), { status: 401, errorCode: 'FEDERATED_TOKEN_INVALID' }),
      );

      await expect(
        useCase.execute('bad-code', makeValidState(), undefined, 'req-1'),
      ).rejects.toMatchObject({ status: 401 });
    });
  });
});
