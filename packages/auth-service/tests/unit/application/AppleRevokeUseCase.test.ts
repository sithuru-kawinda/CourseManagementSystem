const mockFirestoreGet    = jest.fn();
const mockFirestoreUpdate = jest.fn();
const mockFirestoreDocRef = { get: mockFirestoreGet, update: mockFirestoreUpdate };
const mockFirestoreDoc    = jest.fn().mockReturnValue(mockFirestoreDocRef);

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({ doc: mockFirestoreDoc }),
  }),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { AppleRevokeUseCase } from '../../../src/application/use-cases/AppleRevokeUseCase';
import { AppleAuthClient }    from '../../../src/infrastructure/clients/AppleAuthClient';

const makeAppleClient = (): jest.Mocked<AppleAuthClient> => ({
  verifyIdToken:        jest.fn(),
  generateClientSecret: jest.fn(),
  exchangeCode:         jest.fn(),
  refreshToken:         jest.fn(),
  revokeToken:          jest.fn(),
} as unknown as jest.Mocked<AppleAuthClient>);

describe('AppleRevokeUseCase', () => {
  let appleClient: jest.Mocked<AppleAuthClient>;
  let useCase:     AppleRevokeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    appleClient = makeAppleClient();
    useCase     = new AppleRevokeUseCase(appleClient);
    mockFirestoreUpdate.mockResolvedValue(undefined);
  });

  it('revokes the stored Apple refresh token', async () => {
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ appleRefreshToken: 'stored-refresh-token' }),
    });
    appleClient.revokeToken.mockResolvedValue(undefined);

    await useCase.execute('uid-1');

    expect(appleClient.revokeToken).toHaveBeenCalledWith('stored-refresh-token', 'refresh_token');
  });

  it('clears appleRefreshToken from Firestore after revocation', async () => {
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ appleRefreshToken: 'stored-refresh-token' }),
    });
    appleClient.revokeToken.mockResolvedValue(undefined);

    await useCase.execute('uid-1');

    expect(mockFirestoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ appleRefreshToken: null }),
    );
  });

  it('clears the token even if Apple revocation call fails (best-effort)', async () => {
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ appleRefreshToken: 'stored-refresh-token' }),
    });
    appleClient.revokeToken.mockRejectedValue(new Error('Apple revoke endpoint down'));

    // Should not throw
    await expect(useCase.execute('uid-1')).resolves.toBeUndefined();

    // Token should still be cleared
    expect(mockFirestoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ appleRefreshToken: null }),
    );
  });

  it('is a no-op when no Apple token is stored (does not throw)', async () => {
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ appleRefreshToken: null }),
    });

    await expect(useCase.execute('uid-1')).resolves.toBeUndefined();
    expect(appleClient.revokeToken).not.toHaveBeenCalled();
    expect(mockFirestoreUpdate).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when the user doc does not exist', async () => {
    mockFirestoreGet.mockResolvedValue({ exists: false, data: () => undefined });

    await expect(useCase.execute('uid-ghost')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(appleClient.revokeToken).not.toHaveBeenCalled();
  });

  it('uses the caller uid to look up the correct Firestore document', async () => {
    mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({ appleRefreshToken: null }) });

    await useCase.execute('specific-uid-99');

    expect(mockFirestoreDoc).toHaveBeenCalledWith('specific-uid-99');
  });
});
