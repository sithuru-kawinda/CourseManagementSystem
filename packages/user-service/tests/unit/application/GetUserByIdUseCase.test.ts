import { GetUserByIdUseCase } from '../../../src/application/use-cases/GetUserByIdUseCase';
import { IUserRepository }   from '../../../src/domain/repositories/IUserRepository';
import { User }              from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: ['member', 'student'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

describe('GetUserByIdUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: GetUserByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetUserByIdUseCase(repo);
  });

  // ── Happy-path ────────────────────────────────────────────────────────────

  it('admin — returns the user when found', async () => {
    repo.findById.mockResolvedValue(makeUser());
    const user = await useCase.execute('uid-1', ['admin']);
    expect(user.uid).toBe('uid-1');
    expect(repo.findById).toHaveBeenCalledWith('uid-1');
  });

  it('super_admin — returns the user when found', async () => {
    repo.findById.mockResolvedValue(makeUser());
    const user = await useCase.execute('uid-1', ['super_admin']);
    expect(user.uid).toBe('uid-1');
  });

  it('leader — returns a non-admin user', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'student'] }));
    const user = await useCase.execute('uid-1', ['leader']);
    expect(user.uid).toBe('uid-1');
  });

  it('g12 — returns a non-admin user', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'leader'] }));
    const user = await useCase.execute('uid-1', ['g12']);
    expect(user.uid).toBe('uid-1');
  });

  it('no callerRoles (default) — returns non-admin user without error', async () => {
    repo.findById.mockResolvedValue(makeUser());
    const user = await useCase.execute('uid-1');
    expect(user.uid).toBe('uid-1');
  });

  // ── Scoped-access guard ───────────────────────────────────────────────────

  it('leader — throws 403 FORBIDDEN when target is admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['admin'] }));
    await expect(useCase.execute('uid-1', ['leader'])).rejects.toMatchObject({
      status:    403,
      errorCode: 'FORBIDDEN',
    });
  });

  it('leader — throws 403 FORBIDDEN when target is super_admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['super_admin'] }));
    await expect(useCase.execute('uid-1', ['leader'])).rejects.toMatchObject({
      status:    403,
      errorCode: 'FORBIDDEN',
    });
  });

  it('g12 — throws 403 FORBIDDEN when target is admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['admin'] }));
    await expect(useCase.execute('uid-1', ['g12'])).rejects.toMatchObject({
      status:    403,
      errorCode: 'FORBIDDEN',
    });
  });

  it('admin — can fetch another admin profile (no scoped restriction)', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['admin'] }));
    const user = await useCase.execute('uid-1', ['admin']);
    expect(user.uid).toBe('uid-1');
  });

  it('super_admin — can fetch any profile including super_admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['super_admin'] }));
    const user = await useCase.execute('uid-1', ['super_admin']);
    expect(user.uid).toBe('uid-1');
  });

  // ── Not found / errors ────────────────────────────────────────────────────

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1', ['admin'])).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('propagates repo errors', async () => {
    repo.findById.mockRejectedValue(new Error('Firestore error'));
    await expect(useCase.execute('uid-1', ['admin'])).rejects.toThrow('Firestore error');
  });
});
