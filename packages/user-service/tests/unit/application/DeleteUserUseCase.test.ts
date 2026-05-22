import { DeleteUserUseCase }   from '../../../src/application/use-cases/DeleteUserUseCase';
import { IUserRepository }    from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }               from '../../../src/domain/entities/User';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User =>
  new User({
    uid: 'uid-target', email: 'member@example.com',
    firstName: 'John', lastName: 'Doe',
    role: 'member', roles: ['member'],
    status: 'approved',
    profilePhotoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> =>
  ({
    createUser:      jest.fn(),
    setCustomClaims: jest.fn(),
    disableUser:     jest.fn(),
    enableUser:      jest.fn(),
    updatePassword:  jest.fn(),
    deleteUser:      jest.fn(),
    verifyPassword:  jest.fn(),
  } as unknown as jest.Mocked<FirebaseAuthClient>);

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DeleteUserUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    DeleteUserUseCase;

  const CALLER = 'uid-admin';
  const TARGET = 'uid-target';

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new DeleteUserUseCase(repo, authClient);
  });

  // ── happy paths ─────────────────────────────────────────────────────────────

  it('soft-deletes a member and disables their Firebase account', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, roles: ['member'] }));
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.softDelete).toHaveBeenCalledWith(TARGET);
    expect(authClient.disableUser).toHaveBeenCalledWith(TARGET);
  });

  it('soft-deletes a student', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'student', roles: ['member', 'student'] }));
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.softDelete).toHaveBeenCalledWith(TARGET);
    expect(authClient.disableUser).toHaveBeenCalledWith(TARGET);
  });

  it('soft-deletes a leader', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'leader', roles: ['member', 'leader'] }));
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.softDelete).toHaveBeenCalledWith(TARGET);
    expect(authClient.disableUser).toHaveBeenCalledWith(TARGET);
  });

  it('soft-deletes a g12 user', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'g12', roles: ['member', 'g12'] }));
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.softDelete).toHaveBeenCalledWith(TARGET);
  });

  it('calls softDelete before disableUser', async () => {
    const callOrder: string[] = [];
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockImplementation(async () => { callOrder.push('softDelete'); });
    authClient.disableUser.mockImplementation(async () => { callOrder.push('disableUser'); });

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(callOrder).toEqual(['softDelete', 'disableUser']);
  });

  // ── error: self-delete ───────────────────────────────────────────────────────

  it('throws 403 FORBIDDEN when caller tries to delete their own account', async () => {
    await expect(
      useCase.execute({ targetUid: 'self-uid', callerUid: 'self-uid' }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });

    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  // ── error: user not found ────────────────────────────────────────────────────

  it('throws 404 USER_NOT_FOUND when target does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ targetUid: 'ghost-uid', callerUid: CALLER }),
    ).rejects.toMatchObject({ status: 404, errorCode: 'USER_NOT_FOUND' });

    expect(repo.softDelete).not.toHaveBeenCalled();
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });

  // ── error: admin/super_admin target ─────────────────────────────────────────

  it('throws 403 FORBIDDEN when trying to delete an admin user', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'admin', roles: ['admin'] }));

    await expect(
      useCase.execute({ targetUid: TARGET, callerUid: CALLER }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });

    expect(repo.softDelete).not.toHaveBeenCalled();
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });

  it('throws 403 FORBIDDEN when trying to delete a super_admin user', async () => {
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'super_admin', roles: ['super_admin'] }));

    await expect(
      useCase.execute({ targetUid: TARGET, callerUid: CALLER }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });

    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('throws 403 FORBIDDEN for a user with member+admin roles (admin flag check uses roles[])', async () => {
    // Edge case: user somehow has both member and admin in roles[]
    repo.findById.mockResolvedValue(makeUser({ uid: TARGET, role: 'admin', roles: ['member', 'admin'] }));

    await expect(
      useCase.execute({ targetUid: TARGET, callerUid: CALLER }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });

    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  // ── error: Firebase failure ──────────────────────────────────────────────────

  it('propagates errors thrown by disableUser', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockRejectedValue(new Error('Firebase Auth error'));

    await expect(
      useCase.execute({ targetUid: TARGET, callerUid: CALLER }),
    ).rejects.toThrow('Firebase Auth error');
  });

  it('propagates errors thrown by softDelete', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockRejectedValue(new Error('Firestore write failed'));

    await expect(
      useCase.execute({ targetUid: TARGET, callerUid: CALLER }),
    ).rejects.toThrow('Firestore write failed');

    // disableUser must not be called if softDelete failed
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });

  // ── repository interaction ───────────────────────────────────────────────────

  it('calls findById exactly once', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.findById).toHaveBeenCalledTimes(1);
    expect(repo.findById).toHaveBeenCalledWith(TARGET);
  });

  it('never calls create or update', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute({ targetUid: TARGET, callerUid: CALLER });

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
