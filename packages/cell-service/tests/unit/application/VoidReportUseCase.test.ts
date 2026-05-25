import { VoidReportUseCase }       from '../../../src/application/use-cases/VoidReportUseCase';
import { ICellGroupRepository }    from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }   from '../../../src/domain/repositories/ICellReportRepository';
import { OutboxEventPublisher }    from '@shared/events';
import { CellGroup }               from '../../../src/domain/entities/CellGroup';
import { CellReport }              from '../../../src/domain/entities/CellReport';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});
const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeCell = (): CellGroup => new CellGroup({
  id: 'cell-1', name: 'Test', type: 'g12', area: 'Area',
  leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
  members: ['leader-1'], memberCount: 1, reportCount: 1,
  state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

const makeReport = (voided = false): CellReport =>
  new CellReport({
    id: 'rep-1', cellId: 'cell-1', filledByUid: 'leader-1', clientReqId: 'key-1',
    date: '2026-05-17', didMeet: true, leaderPresent: true,
    location: 'Hall', timeStarted: '2026-05-17T18:00:00Z', timeEnded: '2026-05-17T19:00:00Z',
    language: 'en', subjectDiscussed: 'sunday_sermon', cellType: 'g12', g12LeaderUid: 'g12-1',
    attendance: [], contactedAbsentees: 'no' as const, additionalVisitors: 0, childrenCount: 0,
    satisfactionRate: 4, photoUrls: [], voided, createdAt: '2026-05-17T19:00:00Z',
  });

describe('VoidReportUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    VoidReportUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    reportRepo = makeReportRepo();
    outbox     = makeOutbox();
    useCase    = new VoidReportUseCase(cellRepo, reportRepo, outbox);
  });

  it('voids a report and publishes cell_report.voided', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(false));
    reportRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('cell-1', 'rep-1', 'Wrong date.', 'leader-1', ['leader'], 'req-1');

    expect(result.voided).toBe(true);
    expect(reportRepo.update).toHaveBeenCalled();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell_report.voided' }),
    );
  });

  it('throws 409 REPORT_ALREADY_VOIDED when already voided', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(true));

    await expect(useCase.execute('cell-1', 'rep-1', 'reason', 'leader-1', ['leader'], 'req-1')).rejects.toMatchObject({
      status: 409, errorCode: 'REPORT_ALREADY_VOIDED',
    });
  });

  it('throws 404 when report not found', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('cell-1', 'bad', 'reason', 'leader-1', ['leader'], 'req-1')).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_REPORT_NOT_FOUND',
    });
  });

  it('throws 403 when member tries to void a report', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());

    await expect(useCase.execute('cell-1', 'rep-1', 'reason', 'member-uid', ['member'], 'req-1')).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
  });
});
