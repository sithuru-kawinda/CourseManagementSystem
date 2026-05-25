import { DemoteMemberUseCase }  from '../../../src/application/use-cases/DemoteMemberUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User, UserRole }       from '../../../src/domain/entities/User';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeUser = (roles: UserRole[] = ['member', 'leader']) =>
  new User({
    uid: 'target-uid', email: 'leader@test.com',
    firstName: 'Test', lastName: 'Leader',
    role: roles[roles.length - 1], roles,
    status: 'approved', profilePhotoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(), findByEmail: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeAuth = (): jest.Mocked<FirebaseAuthClient> =>
  ({ addRoleToUser: jest.fn(), removeRoleFromUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const BASE = { targetUid: 'target-uid', role: 'leader' as const, callerUid: 'caller-uid', requestId: 'req-1' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DemoteMemberUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let auth:    jest.Mocked<FirebaseAuthClient>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: DemoteMemberUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    auth    = makeAuth();
    outbox  = makeOutbox();
    useCase = new DemoteMemberUseCase(repo, auth, outbox);
  });

  // ── Happy paths — all 4 caller roles ─────────────────────────────────────

  it('admin can demote leader → member', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'leader', callerRoles: ['admin'] as UserRole[] });

    expect(repo.update).toHaveBeenCalled();
    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('target-uid', 'leader');
  });

  it('super_admin can demote g12 → member', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'g12']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'g12', callerRoles: ['super_admin'] as UserRole[] });

    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('target-uid', 'g12');
  });

  it('admin can demote student → member', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'student']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'student', callerRoles: ['admin'] as UserRole[] });

    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('target-uid', 'student');
  });

  it('g12 can demote leader → member', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'leader', callerRoles: ['g12'] as UserRole[] });

    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('target-uid', 'leader');
  });

  it('throws 403 when g12 tries to demote another g12 (not permitted)', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'g12']));

    await expect(
      useCase.execute({ ...BASE, role: 'g12', callerRoles: ['g12'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('leader can demote g12 only', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'g12']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'g12', callerRoles: ['leader'] as UserRole[] });

    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('target-uid', 'g12');
  });

  it('publishes audit.action event with DEMOTE_FROM action', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...BASE, role: 'leader', callerRoles: ['admin'] as UserRole[] });

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audit.action',
        payload: expect.objectContaining({ action: 'DEMOTE_FROM_LEADER' }),
      }),
    );
  });

  // ── Idempotent ────────────────────────────────────────────────────────────

  it('returns silently when user does not have the role (idempotent)', async () => {
    // User is only member — has no leader role
    repo.findById.mockResolvedValue(makeUser(['member']));

    await useCase.execute({ ...BASE, role: 'leader', callerRoles: ['admin'] as UserRole[] });

    expect(repo.update).not.toHaveBeenCalled();
    expect(auth.removeRoleFromUser).not.toHaveBeenCalled();
  });

  // ── 403 — self-demote ─────────────────────────────────────────────────────

  it('throws 403 FORBIDDEN when caller tries to demote themselves', async () => {
    await expect(
      useCase.execute({ ...BASE, callerUid: 'target-uid', callerRoles: ['admin'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── 403 — caller role restrictions ───────────────────────────────────────

  it('throws 403 when leader tries to demote a leader (only g12 allowed for leader)', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));

    await expect(
      useCase.execute({ ...BASE, role: 'leader', callerRoles: ['leader'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when g12 tries to demote a student (g12 can only demote leader)', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'student']));

    await expect(
      useCase.execute({ ...BASE, role: 'student', callerRoles: ['g12'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when member tries to demote anyone', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));

    await expect(
      useCase.execute({ ...BASE, role: 'leader', callerRoles: ['member'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── 403 — cannot demote admin/super_admin ─────────────────────────────────

  it('throws 403 when target is an admin — cannot demote via this endpoint', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'admin'] as UserRole[]));

    await expect(
      useCase.execute({ ...BASE, role: 'leader', callerRoles: ['super_admin'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when target is a super_admin — cannot demote via this endpoint', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'super_admin'] as UserRole[]));

    await expect(
      useCase.execute({ ...BASE, role: 'leader', callerRoles: ['super_admin'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── 404 ───────────────────────────────────────────────────────────────────

  it('throws 404 USER_NOT_FOUND when target does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ ...BASE, callerRoles: ['admin'] as UserRole[] }),
    ).rejects.toMatchObject({ status: 404, errorCode: 'USER_NOT_FOUND' });
  });
});
