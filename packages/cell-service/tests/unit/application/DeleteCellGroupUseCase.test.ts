import { DeleteCellGroupUseCase } from '../../../src/application/use-cases/DeleteCellGroupUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }              from '../../../src/domain/entities/CellGroup';
import { Role }                   from '@shared/auth-middleware';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Rathmalana West G12', type: 'g12', area: 'Rathmalana',
    leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    members: ['leader-1'], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('DeleteCellGroupUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: DeleteCellGroupUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new DeleteCellGroupUseCase(repo);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('deletes cell when called by the cell leader (leaderUid)', async () => {
    repo.findById.mockResolvedValue(makeCell());
    repo.delete.mockResolvedValue(undefined);

    await useCase.execute('cell-1', 'leader-1', ['leader'] as Role[]);

    expect(repo.delete).toHaveBeenCalledWith('cell-1');
  });

  it('deletes cell when called by the G12 leader (g12LeaderUid)', async () => {
    repo.findById.mockResolvedValue(makeCell());
    repo.delete.mockResolvedValue(undefined);

    await useCase.execute('cell-1', 'g12-1', ['g12'] as Role[]);

    expect(repo.delete).toHaveBeenCalledWith('cell-1');
  });

  it('deletes cell when called by admin', async () => {
    repo.findById.mockResolvedValue(makeCell());
    repo.delete.mockResolvedValue(undefined);

    await useCase.execute('cell-1', 'admin-uid', ['admin'] as Role[]);

    expect(repo.delete).toHaveBeenCalledWith('cell-1');
  });

  it('deletes cell when called by super_admin', async () => {
    repo.findById.mockResolvedValue(makeCell());
    repo.delete.mockResolvedValue(undefined);

    await useCase.execute('cell-1', 'sadmin-uid', ['super_admin'] as Role[]);

    expect(repo.delete).toHaveBeenCalledWith('cell-1');
  });

  it('returns void on success (204 pattern)', async () => {
    repo.findById.mockResolvedValue(makeCell());
    repo.delete.mockResolvedValue(undefined);

    const result = await useCase.execute('cell-1', 'leader-1', ['leader'] as Role[]);

    expect(result).toBeUndefined();
  });

  // ── 404 ────────────────────────────────────────────────────────────────────

  it('throws 404 CELL_NOT_FOUND when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad-id', 'leader-1', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('does not call delete when cell not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'leader-1', ['leader'] as Role[])).rejects.toThrow();

    expect(repo.delete).not.toHaveBeenCalled();
  });

  // ── 403 ────────────────────────────────────────────────────────────────────

  it('throws 403 FORBIDDEN when a regular member tries to delete', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', 'member-uid', ['member'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 FORBIDDEN when a different leader (not the cell owner) tries to delete', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', 'other-leader-uid', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 FORBIDDEN when a student tries to delete', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', 'student-uid', ['member', 'student'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('does not call delete when caller is forbidden', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(useCase.execute('cell-1', 'other-uid', ['member'] as Role[])).rejects.toThrow();

    expect(repo.delete).not.toHaveBeenCalled();
  });
});
