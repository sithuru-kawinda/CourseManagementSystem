import { TransferCellOwnershipUseCase } from '../../../src/application/use-cases/TransferCellOwnershipUseCase';
import { ICellGroupRepository }         from '../../../src/domain/repositories/ICellGroupRepository';
import { OutboxEventPublisher }          from '@shared/events';
import { CellGroup }                     from '../../../src/domain/entities/CellGroup';
import { Role }                          from '@shared/auth-middleware';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeCell = (state: 'active' | 'archived' = 'active'): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Rathmalana West G12', type: 'g12', area: 'Rathmalana',
    leaderUid: 'old-leader', g12LeaderUid: 'old-g12',
    members: [], memberCount: 0, reportCount: 0,
    state, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const ADMIN_UID   = 'admin-uid';
const ADMIN_ROLES = ['admin'] as Role[];
const ADMIN_REQ   = 'req-1';

describe('TransferCellOwnershipUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: TransferCellOwnershipUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new TransferCellOwnershipUseCase(repo, outbox);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────

  it('admin can transfer leader ownership', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(result.leaderUid).toBe('new-leader');
    expect(result.g12LeaderUid).toBe('old-g12'); // unchanged
    expect(repo.update).toHaveBeenCalled();
  });

  it('admin can transfer G12 leadership', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { g12LeaderUid: 'new-g12' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(result.g12LeaderUid).toBe('new-g12');
    expect(result.leaderUid).toBe('old-leader'); // unchanged
  });

  it('admin can transfer both leader and G12 at once', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1',
      { leaderUid: 'new-leader', g12LeaderUid: 'new-g12' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(result.leaderUid).toBe('new-leader');
    expect(result.g12LeaderUid).toBe('new-g12');
  });

  it('super_admin can transfer ownership', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { leaderUid: 'new-leader' },
      'sadmin', ['super_admin'] as Role[], 'req-1');

    expect(result.leaderUid).toBe('new-leader');
  });

  it('publishes cell.ownership_transferred event to outbox', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cell.ownership_transferred',
        payload: expect.objectContaining({
          cellId:       'cell-1',
          cellName:     'Rathmalana West G12',
          newLeaderUid: 'new-leader',
          leaderChanged: true,
          g12Changed:    false,
        }),
      }),
    );
  });

  it('returns the updated cell with new updatedAt timestamp', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(result.updatedAt).not.toBe('2026-01-01T00:00:00Z');
  });

  it('sets initiatedByOwner=false in payload when admin initiates (no auto-demotion)', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ initiatedByOwner: false }),
      }),
    );
  });

  it('always sets initiatedByOwner=false — no auto-demotion (admin-only endpoint)', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ);

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ initiatedByOwner: false }),
      }),
    );
  });

  // ── 404 ────────────────────────────────────────────────────────────────────

  it('throws 404 CELL_NOT_FOUND when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad-id', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  // ── 409 — archived cell ─────────────────────────────────────────────────────

  it('throws 409 INVALID_STATE when cell is archived', async () => {
    repo.findById.mockResolvedValue(makeCell('archived'));

    await expect(
      useCase.execute('cell-1', { leaderUid: 'new-leader' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ),
    ).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
  });

  // ── 422 — no change ────────────────────────────────────────────────────────

  it('throws 422 NO_CHANGE when UIDs are same as current owners', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', { leaderUid: 'old-leader', g12LeaderUid: 'old-g12' }, ADMIN_UID, ADMIN_ROLES, ADMIN_REQ),
    ).rejects.toMatchObject({ status: 422, errorCode: 'NO_CHANGE' });
  });
});
