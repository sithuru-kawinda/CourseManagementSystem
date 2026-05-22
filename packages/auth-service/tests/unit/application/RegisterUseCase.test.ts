import { RegisterUseCase }      from '../../../src/application/use-cases/RegisterUseCase';
import { UserServiceClient }   from '../../../src/infrastructure/clients/UserServiceClient';
import { OutboxEventPublisher } from '@shared/events';

// ─── Firebase Mocks ──────────────────────────────────────────────────────────

const authMock = {
  createUser:          jest.fn().mockResolvedValue({ uid: 'new-uid' }),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  deleteUser:          jest.fn().mockResolvedValue(undefined),
};
jest.mock('firebase-admin/auth', () => ({ getAuth: () => authMock }));

const batchMock = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    batch:      () => batchMock,
    collection: () => ({ doc: () => ({}) }),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<UserServiceClient> =>
  ({ emailExists: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const BASE_INPUT = {
  firstName: 'Viruli', lastName: 'Wijesinghe',
  email: 'viruli@example.com', password: 'SecurePass@2026',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RegisterUseCase', () => {
  let client:  jest.Mocked<UserServiceClient>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    client  = makeClient();
    outbox  = makeOutbox();
    useCase = new RegisterUseCase(client, outbox);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('creates active member and publishes user.registered event', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      const result = await useCase.execute(BASE_INPUT, 'req-1');

      expect(result.uid).toBe('new-uid');
      expect(client.emailExists).toHaveBeenCalledWith(BASE_INPUT.email);
      expect(authMock.createUser).toHaveBeenCalledWith({
        email:       BASE_INPUT.email,
        password:    BASE_INPUT.password,
        displayName: 'Viruli Wijesinghe',
      });
      expect(authMock.setCustomUserClaims).toHaveBeenCalledWith(
        'new-uid',
        { role: 'member', roles: ['member'] },
      );
      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user.registered' }),
        expect.anything(),
      );
    });

    it('outbox event payload includes uid, email, firstName, lastName', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(BASE_INPUT, 'req-payload');

      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type:      'user.registered',
          payload:   expect.objectContaining({
            uid:       'new-uid',
            email:     BASE_INPUT.email,
            firstName: BASE_INPUT.firstName,
            lastName:  BASE_INPUT.lastName,
          }),
          requestId: 'req-payload',
        }),
        expect.anything(),
      );
    });

    it('uses preferredLanguage when provided', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute({ ...BASE_INPUT, preferredLanguage: 'si' }, 'req-lang');

      // batch.set is called with the full user doc — confirm preferredLanguage is passed
      expect(batchMock.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ preferredLanguage: 'si' }),
      );
    });

    it('defaults preferredLanguage to "en" when not provided', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(BASE_INPUT, 'req-default-lang');

      expect(batchMock.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ preferredLanguage: 'en' }),
      );
    });

    it('stores status: approved in the Firestore doc (V2 — no approval queue)', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(BASE_INPUT, 'req-status');

      expect(batchMock.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: 'member', roles: ['member'], status: 'approved' }),
      );
    });
  });

  // ── 409 — email already registered ────────────────────────────────────────

  describe('execute — email conflicts', () => {
    it('throws 409 EMAIL_EXISTS when user-service reports email taken', async () => {
      client.emailExists.mockResolvedValue(true);

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toMatchObject({
        status:    409,
        errorCode: 'EMAIL_EXISTS',
      });
    });

    it('does not create Firebase Auth user when email check fails', async () => {
      client.emailExists.mockResolvedValue(true);

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toThrow();

      expect(authMock.createUser).not.toHaveBeenCalled();
    });

    it('throws 409 EMAIL_EXISTS when Firebase returns auth/email-already-exists', async () => {
      client.emailExists.mockResolvedValue(false);
      const firebaseError = Object.assign(new Error('email exists in firebase'), {
        code: 'auth/email-already-exists',
      });
      authMock.createUser.mockRejectedValue(firebaseError);

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toMatchObject({
        status:    409,
        errorCode: 'EMAIL_EXISTS',
      });
    });
  });

  // ── Rollback — Firebase Auth cleanup ──────────────────────────────────────

  describe('execute — rollback on failure', () => {
    it('deletes Firebase Auth user if Firestore batch commit fails', async () => {
      client.emailExists.mockResolvedValue(false);
      outbox.publishWithBatch.mockRejectedValue(new Error('Firestore down'));

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toThrow('Firestore down');

      expect(authMock.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('deletes Firebase Auth user if setCustomUserClaims fails', async () => {
      client.emailExists.mockResolvedValue(false);
      authMock.setCustomUserClaims.mockRejectedValue(new Error('Claims error'));

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toThrow('Claims error');

      expect(authMock.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('does NOT delete Firebase Auth user if email check rejects (auth was never created)', async () => {
      client.emailExists.mockResolvedValue(true);

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toThrow();

      expect(authMock.deleteUser).not.toHaveBeenCalled();
    });

    it('does not publish event when rollback is triggered', async () => {
      client.emailExists.mockResolvedValue(false);
      authMock.setCustomUserClaims.mockRejectedValue(new Error('Claims error'));

      await expect(useCase.execute(BASE_INPUT, 'req-1')).rejects.toThrow();

      expect(outbox.publishWithBatch).not.toHaveBeenCalled();
    });
  });
});
