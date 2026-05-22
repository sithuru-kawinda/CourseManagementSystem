import { CreateAdminUseCase, CreateAdminInput } from '../../../src/application/use-cases/CreateAdminUseCase';
import { IUserRepository }                      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }                   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher }                 from '@shared/events';
import { User }                                 from '../../../src/domain/entities/User';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'admin@example.com', firstName: 'Kavinda',
    lastName: 'Perera', role: 'admin', roles: ['admin'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> => ({
  createUser:      jest.fn(),
  setCustomClaims: jest.fn(),
  disableUser:     jest.fn(),
  enableUser:      jest.fn(),
  updatePassword:  jest.fn(),
  deleteUser:      jest.fn(),
  verifyPassword:  jest.fn(),
} as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const INPUT: CreateAdminInput = {
  firstName: 'Kavinda', lastName: 'Perera',
  email: 'kavinda@futurecx.com', initialPassword: 'Admin@Secure2026',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreateAdminUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    CreateAdminUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new CreateAdminUseCase(repo, authClient, outbox);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('creates a new admin user and returns it', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      const user = await useCase.execute(INPUT, 'req-1');

      expect(user.uid).toBe('new-uid');
      expect(user.email).toBe(INPUT.email);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ email: INPUT.email }));
    });

    it('returns user with role=admin, roles=[admin], status=approved', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      const user = await useCase.execute(INPUT, 'req-1');

      expect(user.role).toBe('admin');
      expect(user.roles).toEqual(['admin']);
      expect(user.status).toBe('approved');
    });

    it('calls authClient.createUser with correct email, password and displayName', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(INPUT, 'req-1');

      expect(authClient.createUser).toHaveBeenCalledWith({
        email:       INPUT.email,
        password:    INPUT.initialPassword,
        displayName: 'Kavinda Perera',
      });
    });

    it('sets custom claims with role=admin and roles=[admin]', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(INPUT, 'req-1');

      expect(authClient.setCustomClaims).toHaveBeenCalledWith('new-uid', {
        role: 'admin', roles: ['admin'],
      });
    });

    it('publishes admin.created outbox event with correct payload', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockResolvedValue(undefined);

      await useCase.execute(INPUT, 'req-event');

      expect(outbox.publishWithBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type:      'admin.created',
          requestId: 'req-event',
          payload:   expect.objectContaining({
            uid:             'new-uid',
            email:           INPUT.email,
            firstName:       INPUT.firstName,
            lastName:        INPUT.lastName,
            initialPassword: INPUT.initialPassword,
          }),
        }),
      );
    });
  });

  // ── 409 — email already registered ────────────────────────────────────────

  describe('execute — email conflict', () => {
    it('throws 409 EMAIL_EXISTS when email is already in use', async () => {
      repo.findByEmail.mockResolvedValue(makeUser());

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toMatchObject({
        status:    409,
        errorCode: 'EMAIL_EXISTS',
      });
    });

    it('does not call authClient.createUser when email already exists', async () => {
      repo.findByEmail.mockResolvedValue(makeUser());

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow();

      expect(authClient.createUser).not.toHaveBeenCalled();
    });

    it('does not call deleteUser when email check fails (auth was never created)', async () => {
      repo.findByEmail.mockResolvedValue(makeUser());

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow();

      expect(authClient.deleteUser).not.toHaveBeenCalled();
    });
  });

  // ── Rollback — Firebase Auth cleanup ──────────────────────────────────────

  describe('execute — rollback on failure', () => {
    it('deletes the Firebase Auth user if Firestore create fails', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockRejectedValue(new Error('Firestore unavailable'));
      authClient.deleteUser.mockResolvedValue(undefined);

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Firestore unavailable');

      expect(authClient.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('deletes the Firebase Auth user if setCustomClaims fails', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockRejectedValue(new Error('Claims error'));
      authClient.deleteUser.mockResolvedValue(undefined);

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Claims error');

      expect(authClient.deleteUser).toHaveBeenCalledWith('new-uid');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('deletes the Firebase Auth user if outbox.publishWithBatch fails', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockResolvedValue(undefined);
      outbox.publishWithBatch.mockRejectedValue(new Error('Outbox error'));
      authClient.deleteUser.mockResolvedValue(undefined);

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Outbox error');

      expect(authClient.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('swallows deleteUser failure during rollback and still propagates original error', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockResolvedValue('new-uid');
      authClient.setCustomClaims.mockResolvedValue(undefined);
      repo.create.mockRejectedValue(new Error('Firestore unavailable'));
      authClient.deleteUser.mockRejectedValue(new Error('Auth delete also failed'));

      // original error is re-thrown, deleteUser failure is silently swallowed
      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Firestore unavailable');
    });

    it('does not attempt rollback if authClient.createUser fails (nothing to delete)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      authClient.createUser.mockRejectedValue(new Error('Firebase Auth error'));

      await expect(useCase.execute(INPUT, 'req-1')).rejects.toThrow('Firebase Auth error');

      expect(authClient.deleteUser).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });
  });
});
