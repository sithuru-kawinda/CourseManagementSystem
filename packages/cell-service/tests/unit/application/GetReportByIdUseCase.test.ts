import { GetReportByIdUseCase }   from '../../../src/application/use-cases/GetReportByIdUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }  from '../../../src/domain/repositories/ICellReportRepository';
import { CellGroup }              from '../../../src/domain/entities/CellGroup';
import { CellReport }             from '../../../src/domain/entities/CellReport';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});
const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeCell = (members: string[] = ['leader-uid', 'member-uid']): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test', type: 'care', area: 'Area',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members, memberCount: members.length, reportCount: 1,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const makeReport = (): CellReport =>
  new CellReport({
    id: 'report-1', cellId: 'cell-1', filledByUid: 'leader-uid',
    clientReqId: 'uuid-1',
    date: '2026-05-18', didMeet: true,
    leaderPresent: true,
    location: 'Colombo', timeStarted: '18:00', timeEnded: '20:00',
    language: 'en', subjectDiscussed: 'sunday_sermon',
    cellType: 'care', g12LeaderUid: 'g12-uid',
    attendance: [], contactedAbsentees: 'no' as const,
    additionalVisitors: 0, childrenCount: 0, satisfactionRate: 4,
    photoUrls: [], voided: false,
    createdAt: '2026-05-18T18:00:00Z',
  });

describe('GetReportByIdUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let useCase:    GetReportByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    reportRepo = makeReportRepo();
    useCase    = new GetReportByIdUseCase(cellRepo, reportRepo);
  });

  it('returns report to the cell owner', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport());

    const result = await useCase.execute('cell-1', 'report-1', 'leader-uid', ['leader']);

    expect(result.id).toBe('report-1');
    expect(reportRepo.findById).toHaveBeenCalledWith('cell-1', 'report-1');
  });

  it('returns report to a cell member', async () => {
    cellRepo.findById.mockResolvedValue(makeCell(['leader-uid', 'member-uid']));
    reportRepo.findById.mockResolvedValue(makeReport());

    const result = await useCase.execute('cell-1', 'report-1', 'member-uid', ['member']);

    expect(result.id).toBe('report-1');
  });

  it('returns report to admin (not a member)', async () => {
    cellRepo.findById.mockResolvedValue(makeCell(['leader-uid']));
    reportRepo.findById.mockResolvedValue(makeReport());

    const result = await useCase.execute('cell-1', 'report-1', 'admin-uid', ['admin']);

    expect(result.id).toBe('report-1');
  });

  it('throws 404 when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad', 'report-1', 'admin-uid', ['admin']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 403 when caller is not a member, owner, or admin', async () => {
    cellRepo.findById.mockResolvedValue(makeCell(['leader-uid']));

    await expect(
      useCase.execute('cell-1', 'report-1', 'stranger', ['member']),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
    expect(reportRepo.findById).not.toHaveBeenCalled();
  });

  it('throws 404 when report does not exist', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('cell-1', 'bad-report', 'leader-uid', ['leader']),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_REPORT_NOT_FOUND' });
  });
});
