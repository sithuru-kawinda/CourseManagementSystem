import { GetReportsUseCase }      from '../../../src/application/use-cases/GetReportsUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }  from '../../../src/domain/repositories/ICellReportRepository';
import { CellGroup }              from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});
const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeCell = (overrides: Partial<{ leaderUid: string; members: string[] }> = {}): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test', type: 'care', area: 'Area',
    leaderUid:   overrides.leaderUid ?? 'leader-uid',
    g12LeaderUid: 'g12-uid',
    members:     overrides.members  ?? ['leader-uid', 'member-uid'],
    memberCount: (overrides.members ?? ['leader-uid', 'member-uid']).length,
    reportCount: 0, state: 'active',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const EMPTY_LIST = { items: [], nextCursor: null, total: 0 };

describe('GetReportsUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let useCase:    GetReportsUseCase;
  const opts = { limit: 20 };

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    reportRepo = makeReportRepo();
    useCase    = new GetReportsUseCase(cellRepo, reportRepo);
    reportRepo.findAll.mockResolvedValue(EMPTY_LIST);
  });

  it('owner (leader) can list reports', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());

    await useCase.execute('cell-1', opts, 'leader-uid', ['leader']);

    expect(reportRepo.findAll).toHaveBeenCalledWith('cell-1', opts);
  });

  it('member can list reports', async () => {
    cellRepo.findById.mockResolvedValue(makeCell({ members: ['leader-uid', 'member-uid'] }));

    await useCase.execute('cell-1', opts, 'member-uid', ['member']);

    expect(reportRepo.findAll).toHaveBeenCalled();
  });

  it('admin can list reports for any cell', async () => {
    cellRepo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));

    await useCase.execute('cell-1', opts, 'admin-uid', ['admin']);

    expect(reportRepo.findAll).toHaveBeenCalled();
  });

  it('super_admin can list reports', async () => {
    cellRepo.findById.mockResolvedValue(makeCell({ members: [] }));

    await useCase.execute('cell-1', opts, 'sa-uid', ['super_admin']);

    expect(reportRepo.findAll).toHaveBeenCalled();
  });

  it('throws 404 when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', opts, 'uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when caller is not a member, owner, or admin', async () => {
    cellRepo.findById.mockResolvedValue(makeCell({ members: ['leader-uid'] }));

    await expect(
      useCase.execute('cell-1', opts, 'stranger', ['member']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(reportRepo.findAll).not.toHaveBeenCalled();
  });
});
