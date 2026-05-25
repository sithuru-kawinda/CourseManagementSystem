import { FileReportUseCase }      from '../../../src/application/use-cases/FileReportUseCase';
import { ICellGroupRepository }   from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }  from '../../../src/domain/repositories/ICellReportRepository';
import { OutboxEventPublisher }   from '@shared/events';
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
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeCell = (): CellGroup => new CellGroup({
  id: 'cell-1', name: 'Test', type: 'g12', area: 'Area',
  leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
  members: ['leader-1'], memberCount: 1, reportCount: 0,
  state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

const reportInput = {
  clientReqId: 'key-abc-123',
  date: '2026-05-17', didMeet: true, leaderPresent: true,
  location: 'Hall A', timeStarted: '2026-05-17T18:00:00+05:30', timeEnded: '2026-05-17T19:30:00+05:30',
  language: 'en' as const, subjectDiscussed: 'sunday_sermon' as const,
  cellType: 'g12' as const, g12LeaderUid: 'g12-1',
  attendance: [], contactedAbsentees: 'no' as const,
  additionalVisitors: 0, childrenCount: 0, satisfactionRate: 4,
  photoUrls: [],
};

describe('FileReportUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    FileReportUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    reportRepo = makeReportRepo();
    outbox     = makeOutbox();
    useCase    = new FileReportUseCase(cellRepo, reportRepo, outbox);
  });

  it('files a new report, increments reportCount, publishes cell_report.filed', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findByClientReqId.mockResolvedValue(null);
    reportRepo.create.mockResolvedValue(undefined);
    cellRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const { report, isNew } = await useCase.execute('cell-1', reportInput, 'leader-1', ['leader'], 'req-1');

    expect(isNew).toBe(true);
    expect(report.cellId).toBe('cell-1');
    expect(report.filledByUid).toBe('leader-1');
    expect(report.voided).toBe(false);
    expect(reportRepo.create).toHaveBeenCalled();
    expect(cellRepo.update).toHaveBeenCalledWith(expect.objectContaining({ reportCount: 1 }));
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cell_report.filed' }),
    );
  });

  it('returns existing report (isNew=false) when same idempotency key used', async () => {
    const existing = new CellReport({ ...reportInput, id: 'existing-id', cellId: 'cell-1', filledByUid: 'leader-1', voided: false, createdAt: '2026-01-01T00:00:00Z', photoUrls: [] });
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findByClientReqId.mockResolvedValue(existing);

    const { report, isNew } = await useCase.execute('cell-1', reportInput, 'leader-1', ['leader'], 'req-1');

    expect(isNew).toBe(false);
    expect(report.id).toBe('existing-id');
    expect(reportRepo.create).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  it('throws 403 when admin (not super_admin) tries to file a report', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findByClientReqId.mockResolvedValue(null);

    await expect(useCase.execute('cell-1', reportInput, 'admin-uid', ['admin'], 'req-1')).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
  });

  it('throws 404 when cell not found', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('bad', reportInput, 'leader-1', ['leader'], 'req-1')).rejects.toMatchObject({
      status: 404, errorCode: 'CELL_NOT_FOUND',
    });
  });

  it('super_admin can file a report even if not the cell leader', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findByClientReqId.mockResolvedValue(null);
    reportRepo.create.mockResolvedValue(undefined);
    cellRepo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const { isNew } = await useCase.execute('cell-1', reportInput, 'super-uid', ['super_admin'], 'req-1');

    expect(isNew).toBe(true);
  });
});
