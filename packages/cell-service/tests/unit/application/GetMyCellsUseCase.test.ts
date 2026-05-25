import { GetMyCellsUseCase }     from '../../../src/application/use-cases/GetMyCellsUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (id: string, leaderUid: string): CellGroup =>
  new CellGroup({
    id, name: 'Test Cell', type: 'care', area: 'Area',
    leaderUid, g12LeaderUid: 'g12-1',
    members: [leaderUid], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('GetMyCellsUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: GetMyCellsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMyCellsUseCase(repo);
  });

  it('returns cells where the user is a member', async () => {
    const cells = [makeCell('cell-1', 'uid-1'), makeCell('cell-2', 'uid-1')];
    repo.findByMember.mockResolvedValue(cells);

    const result = await useCase.execute('uid-1');

    expect(result).toHaveLength(2);
    expect(repo.findByMember).toHaveBeenCalledWith('uid-1');
  });

  it('returns empty array when user is not a member of any cell', async () => {
    repo.findByMember.mockResolvedValue([]);

    const result = await useCase.execute('uid-no-cells');

    expect(result).toEqual([]);
    expect(repo.findByMember).toHaveBeenCalledWith('uid-no-cells');
  });

  it('passes the uid directly to the repository', async () => {
    repo.findByMember.mockResolvedValue([]);

    await useCase.execute('specific-uid-123');

    expect(repo.findByMember).toHaveBeenCalledWith('specific-uid-123');
  });
});
