import { UpdateCellGroupUseCase } from '../../../src/application/use-cases/UpdateCellGroupUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }              from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Original Name', type: 'care', area: 'Old Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members: ['leader-uid'], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('UpdateCellGroupUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: UpdateCellGroupUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UpdateCellGroupUseCase(repo);
    repo.update.mockResolvedValue(undefined);
  });

  it('owner (leader) can update their cell', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { name: 'New Name' }, 'leader-uid', ['leader']);

    expect(result.name).toBe('New Name');
    expect(repo.update).toHaveBeenCalledWith(result);
  });

  it('admin can update any cell', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { area: 'New Area' }, 'admin-uid', ['admin']);

    expect(result.area).toBe('New Area');
    expect(repo.update).toHaveBeenCalled();
  });

  it('super_admin can update any cell', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', { name: 'SA Update' }, 'sa-uid', ['super_admin']);

    expect(repo.update).toHaveBeenCalled();
  });

  it('updates only the provided fields', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', { name: 'New Name' }, 'leader-uid', ['leader']);

    expect(result.name).toBe('New Name');
    expect(result.type).toBe('care');
    expect(result.area).toBe('Old Area');
  });

  it('throws 404 when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad-id', { name: 'X' }, 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when non-owner non-admin tries to update', async () => {
    repo.findById.mockResolvedValue(makeCell());

    await expect(
      useCase.execute('cell-1', { name: 'X' }, 'other-uid', ['leader']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
