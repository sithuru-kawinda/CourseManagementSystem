/**
 * Unit tests for FederatedSignInUseCase
 * Mocks Firebase Admin, GoogleAuthClient, AppleAuthClient, OutboxEventPublisher
 */

const mockGetUserByEmail  = jest.fn();
const mockCreateUser      = jest.fn();
const mockSetCustomClaims = jest.fn();
const mockCreateCustomToken = jest.fn();
const mockFirestoreSet    = jest.fn();
const mockFirestoreGet    = jest.fn();
const mockFirestoreUpdate = jest.fn();
const mockFirestoreDocRef = { set: mockFirestoreSet, get: mockFirestoreGet, update: mockFirestoreUpdate };
const mockFirestoreDoc    = jest.fn().mockReturnValue(mockFirestoreDocRef);

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn().mockReturnValue({
    getUserByEmail:    mockGetUserByEmail,
    createUser:        mockCreateUser,
    setCustomUserClaims: mockSetCustomClaims,
    createCustomToken: mockCreateCustomToken,
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

import { FederatedSignInUseCase } from '../../../src/application/use-cases/FederatedSignInUseCase';
import { GoogleAuthClient }        from '../../../src/infrastructure/clients/GoogleAuthClient';
import { AppleAuthClient }         from '../../../src/infrastructure/clients/AppleAuthClient';
import { OutboxEventPublisher }    from '@shared/events';

const makeGoogleClient = (): jest.Mocked<GoogleAuthClient> =>
  ({ verifyIdToken: jest.fn() } as unknown as jest.Mocked<GoogleAuthClient>);

const makeAppleClient = (): jest.Mocked<AppleAuthClient> =>
  ({ verifyIdToken: jest.fn() } as unknown as jest.Mocked<AppleAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('FederatedSignInUseCase', () => {
  let googleClient: jest.Mocked<GoogleAuthClient>;
  let appleClient:  jest.Mocked<AppleAuthClient>;
  let outbox:       jest.Mocked<OutboxEventPublisher>;
  let useCase:      FederatedSignInUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    googleClient = makeGoogleClient();
    appleClient  = makeAppleClient();
    outbox       = makeOutbox();
    useCase      = new FederatedSignInUseCase(googleClient, appleClient, outbox);
    mockCreateCustomToken.mockResolvedValue('custom-token-abc');
  });

  describe('Google sign-in — existing user', () => {
    it('returns firebaseToken and isNewUser=false for existing user', async () => {
      googleClient.verifyIdToken.mockResolvedValue({ email: 'user@gmail.com', name: 'Test User', googleUid: 'g-uid-1' });
      mockGetUserByEmail.mockResolvedValue({ uid: 'existing-uid' });
      mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({ providers: ['password'] }) });
      mockFirestoreUpdate.mockResolvedValue(undefined);

      const result = await useCase.execute('google', 'valid-google-token', 'en', 'req-1');

      expect(result.isNewUser).toBe(false);
      expect(result.firebaseToken).toBe('custom-token-abc');
      expect(result.uid).toBe('existing-uid');
      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  describe('Google sign-in — new user', () => {
    it('creates Firebase user + Firestore doc and returns isNewUser=true', async () => {
      googleClient.verifyIdToken.mockResolvedValue({ email: 'new@gmail.com', name: 'New User', googleUid: 'g-uid-new' });
      mockGetUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
      mockCreateUser.mockResolvedValue({ uid: 'new-uid' });
      // New flow: userRef.get() is called AFTER createUser to check for existing doc
      mockFirestoreGet.mockResolvedValue({ exists: false });
      mockSetCustomClaims.mockResolvedValue(undefined);
      mockFirestoreSet.mockResolvedValue(undefined);

      const result = await useCase.execute('google', 'new-google-token', 'si', 'req-2');

      expect(result.isNewUser).toBe(true);
      expect(result.uid).toBe('new-uid');
      expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@gmail.com' }));
      expect(mockSetCustomClaims).toHaveBeenCalledWith('new-uid', { role: 'member', roles: ['member'] });
      expect(mockFirestoreSet).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@gmail.com',
        role: 'member',
        roles: ['member'],
        status: 'approved',
        providers: ['google.com'],
      }));
      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user.registered' }),
      );
    });
  });

  describe('Google sign-in — Firebase user exists but Firestore doc missing (Case B)', () => {
    it('creates missing Firestore doc and emits user.registered for existing Firebase user', async () => {
      googleClient.verifyIdToken.mockResolvedValue({ email: 'orphan@gmail.com', name: 'Orphan User', googleUid: 'g-uid-orphan' });
      // Firebase Auth has the user (isNewUser=false)
      mockGetUserByEmail.mockResolvedValue({ uid: 'orphan-uid' });
      // But Firestore doc does NOT exist
      mockFirestoreGet.mockResolvedValue({ exists: false });
      mockSetCustomClaims.mockResolvedValue(undefined);
      mockFirestoreSet.mockResolvedValue(undefined);

      const result = await useCase.execute('google', 'orphan-google-token', 'en', 'req-4');

      // isNewUser=false (Firebase Auth already had this user)
      expect(result.isNewUser).toBe(false);
      expect(result.uid).toBe('orphan-uid');
      // BUT Firestore doc must be created
      expect(mockFirestoreSet).toHaveBeenCalledWith(expect.objectContaining({
        email: 'orphan@gmail.com',
        role: 'member',
        roles: ['member'],
        status: 'approved',
        providers: ['google.com'],
      }));
      // AND user.registered event published
      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user.registered' }),
      );
    });
  });

  describe('Apple sign-in — existing user', () => {
    it('uses Apple client and returns correct result', async () => {
      appleClient.verifyIdToken.mockResolvedValue({ email: 'user@icloud.com', appleUid: 'apple-sub-1' });
      mockGetUserByEmail.mockResolvedValue({ uid: 'apple-existing-uid' });
      mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({ providers: ['password'] }) });
      mockFirestoreUpdate.mockResolvedValue(undefined);

      const result = await useCase.execute('apple', 'valid-apple-token', 'ta', 'req-3');

      expect(result.isNewUser).toBe(false);
      expect(result.uid).toBe('apple-existing-uid');
      expect(appleClient.verifyIdToken).toHaveBeenCalledWith('valid-apple-token');
    });
  });

  describe('verifyToken()', () => {
    it('returns Google payload with correct providerId', async () => {
      googleClient.verifyIdToken.mockResolvedValue({ email: 'u@g.com', name: 'U', googleUid: 'g1' });

      const payload = await useCase.verifyToken('google', 'token');

      expect(payload.providerId).toBe('google.com');
      expect(payload.email).toBe('u@g.com');
    });

    it('returns Apple payload with correct providerId', async () => {
      appleClient.verifyIdToken.mockResolvedValue({ email: 'u@a.com', appleUid: 'a1' });

      const payload = await useCase.verifyToken('apple', 'token');

      expect(payload.providerId).toBe('apple.com');
      expect(payload.email).toBe('u@a.com');
    });

    it('throws 400 for unknown provider', async () => {
      await expect(useCase.verifyToken('facebook' as never, 'token')).rejects.toMatchObject({
        status: 400, errorCode: 'VALIDATION_ERROR',
      });
    });
  });
});
