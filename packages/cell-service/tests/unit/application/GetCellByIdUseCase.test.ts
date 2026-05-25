import { GetCellByIdUseCase }    from '../../../src/application/use-cases/GetCellByIdUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeCell = (overrides: Partial<{ leaderUid: string; members: string[] }> = {}): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'g12', area: 'Area',
    leaderUid:    overrides.leaderUid ?? 'leader-uid',
    g12LeaderUid: 'g12-uid',
    members:      overrides.members  ?? ['leader-uid', 'member-uid'],
    memberCount:  (overrides.members ?? ['leader-uid', 'member-uid']).length,
    reportCount: 0, state: 'active',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

describe('GetCellByIdUseCase', () => {
  let repo:    jest.Mocked<ICellGroupRepository>;
  let useCase: GetCellByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetCellByIdUseCase(repo);
  });

  it('returns cell when caller is the leader (owner)', async () => {
    repo.findById.mockResolvedValue(makeCell());

    const result = await useCase.execute('cell-1', 'leader-uid', ['leader']);

    expect(result.id).toBe('cell-1');
  });

  it('returns cell when caller is a member', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid', 'member-uid'] }));

    const result = await useCase.execute('cell-1', 'member-uid', ['member']);

    expect(result.id).toBe('cell-1');
  });

  it('returns cell when caller is admin (even if not a member)', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));

    const result = await useCase.execute('cell-1', 'admin-uid', ['admin']);

    expect(result.id).toBe('cell-1');
  });

  it('returns cell when caller is super_admin', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: [] }));

    const result = await useCase.execute('cell-1', 'sa-uid', ['super_admin']);

    expect(result.id).toBe('cell-1');
  });

  it('throws 404 when cell does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad-id', 'uid', ['admin'])).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
  });

  it('throws 403 when caller is not a member, owner, or admin', async () => {
    repo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));

    await expect(useCase.execute('cell-1', 'stranger-uid', ['member'])).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
  });
});
