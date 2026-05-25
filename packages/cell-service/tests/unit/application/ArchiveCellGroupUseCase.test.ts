import { ArchiveCellGroupUseCase } from '../../../src/application/use-cases/ArchiveCellGroupUseCase';
import { ICellGroupRepository }    from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }               from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (state: 'active' | 'archived' = 'active'): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'g12', area: 'Area',
    leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    members: ['leader-1'], memberCount: 1, reportCount: 0,
    state, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('ArchiveCellGroupUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: ArchiveCellGroupUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new ArchiveCellGroupUseCase(repo);
  });

  it('archives an active cell (owner)', async () => {
    repo.findById.mockResolvedValue(makeCell('active'));
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('cell-1', 'leader-1', ['leader']);

    expect(result.state).toBe('archived');
    expect(repo.update).toHaveBeenCalled();
  });

  it('archives cell as admin', async () => {
    repo.findById.mockResolvedValue(makeCell('active'));
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('cell-1', 'admin-uid', ['admin']);

    expect(result.state).toBe('archived');
  });

  it('throws 404 when cell not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'leader-1', ['leader'])).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
  });

  it('throws 403 when non-owner non-admin tries to archive', async () => {
    repo.findById.mockResolvedValue(makeCell('active'));

    await expect(useCase.execute('cell-1', 'other-uid', ['member'])).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
  });

  it('throws 409 when already archived', async () => {
    repo.findById.mockResolvedValue(makeCell('archived'));

    await expect(useCase.execute('cell-1', 'leader-1', ['leader'])).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
  });
});
