import { UpdateCellReportUseCase }  from '../../../src/application/use-cases/UpdateCellReportUseCase';
import { ICellGroupRepository }     from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }    from '../../../src/domain/repositories/ICellReportRepository';
import { CellGroup }                from '../../../src/domain/entities/CellGroup';
import { CellReport }               from '../../../src/domain/entities/CellReport';
import { Role }                     from '@shared/auth-middleware';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCellRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeCell = (): CellGroup =>
  new CellGroup({
    id: 'cell-1', name: 'Test Cell', type: 'g12', area: 'Area',
    leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    members: [], memberCount: 0, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

/** Create a fresh report filed at a specific time offset from now. */
const makeReport = (minsAgo: number = 30, voided = false): CellReport =>
  new CellReport({
    id:                  'report-1',
    cellId:              'cell-1',
    filledByUid:         'leader-1',
    clientReqId:         'req-uuid-123',
    date:                '2026-05-24',
    didMeet:             true,
    noMeetReason:        null,
    leaderPresent:       true,
    conductedByIfAbsent: null,
    location:            'Home',
    timeStarted:         '18:00',
    timeEnded:           '19:30',
    language:            'en',
    subjectDiscussed:    'sunday_sermon',
    otherSubjectReason:  null,
    cellType:            'g12',
    g12LeaderUid:        'g12-1',
    immediateG12LeaderText: null,
    attendance:          [],
    contactedAbsentees:  'no',
    absenteeNotes:       null,
    additionalVisitors:  0,
    childrenCount:       0,
    satisfactionRate:    4,
    additionalInfo:      null,
    photoUrls:           [],
    voided,
    // createdAt = now minus minsAgo
    createdAt: new Date(Date.now() - minsAgo * 60 * 1000).toISOString(),
  });

describe('UpdateCellReportUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let useCase:    UpdateCellReportUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeCellRepo();
    reportRepo = makeReportRepo();
    useCase    = new UpdateCellReportUseCase(cellRepo, reportRepo);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('updates report when called by the original filer within 24 hours', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(30)); // filed 30 min ago
    reportRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute(
      'cell-1', 'report-1',
      { location: 'Church Hall', satisfactionRate: 5 },
      'leader-1', ['leader'] as Role[],
    );

    expect(result.location).toBe('Church Hall');
    expect(result.satisfactionRate).toBe(5);
    expect(reportRepo.update).toHaveBeenCalled();
  });

  it('super_admin can edit any report regardless of who filed it', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(60)); // 1 hour ago
    reportRepo.update.mockResolvedValue(undefined);

    await useCase.execute(
      'cell-1', 'report-1',
      { additionalInfo: 'Admin note' },
      'super-admin-uid', ['super_admin'] as Role[],
    );

    expect(reportRepo.update).toHaveBeenCalled();
  });

  it('preserves immutable fields (clientReqId, filledByUid, createdAt, id)', async () => {
    const original = makeReport(10);
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(original);
    reportRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute(
      'cell-1', 'report-1', { location: 'New Place' },
      'leader-1', ['leader'] as Role[],
    );

    expect(result.clientReqId).toBe('req-uuid-123');
    expect(result.filledByUid).toBe('leader-1');
    expect(result.id).toBe('report-1');
  });

  it('only updates fields that are provided (PATCH semantics)', async () => {
    const original = makeReport(10);
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(original);
    reportRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute(
      'cell-1', 'report-1', { location: 'Updated' },
      'leader-1', ['leader'] as Role[],
    );

    // Only location changed; everything else stays the same
    expect(result.location).toBe('Updated');
    expect(result.timeStarted).toBe('18:00');   // unchanged
    expect(result.satisfactionRate).toBe(4);     // unchanged
  });

  // ── 422 — edit window expired ─────────────────────────────────────────────

  it('throws 422 EDIT_WINDOW_EXPIRED when report is older than 24 hours', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(25 * 60)); // 25 hours ago

    await expect(
      useCase.execute('cell-1', 'report-1', { location: 'Late edit' }, 'leader-1', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 422, errorCode: 'EDIT_WINDOW_EXPIRED' });

    expect(reportRepo.update).not.toHaveBeenCalled();
  });

  it('allows edit exactly at 23h 59m (within window)', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(23 * 60 + 59)); // 23h59m ago
    reportRepo.update.mockResolvedValue(undefined);

    await expect(
      useCase.execute('cell-1', 'report-1', { location: 'Just in time' }, 'leader-1', ['leader'] as Role[]),
    ).resolves.not.toThrow();
  });

  // ── 409 — voided report ───────────────────────────────────────────────────

  it('throws 409 REPORT_ALREADY_VOIDED when trying to edit a voided report', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(10, true)); // voided

    await expect(
      useCase.execute('cell-1', 'report-1', { location: 'edit' }, 'leader-1', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 409, errorCode: 'REPORT_ALREADY_VOIDED' });
  });

  // ── 403 — wrong caller ────────────────────────────────────────────────────

  it('throws 403 FORBIDDEN when a different leader tries to edit', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(10)); // filed by leader-1

    await expect(
      useCase.execute('cell-1', 'report-1', { location: 'edit' }, 'other-leader', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 FORBIDDEN when a regular member tries to edit', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(makeReport(10));

    await expect(
      useCase.execute('cell-1', 'report-1', { location: 'edit' }, 'member-uid', ['member'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  // ── 404 ───────────────────────────────────────────────────────────────────

  it('throws 404 CELL_NOT_FOUND when cell does not exist', async () => {
    cellRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('bad-cell', 'report-1', { location: 'edit' }, 'leader-1', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 404, errorCode: 'CELL_NOT_FOUND' });
  });

  it('throws 404 REPORT_NOT_FOUND when report does not exist', async () => {
    cellRepo.findById.mockResolvedValue(makeCell());
    reportRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('cell-1', 'bad-report', { location: 'edit' }, 'leader-1', ['leader'] as Role[]),
    ).rejects.toMatchObject({ status: 404, errorCode: 'REPORT_NOT_FOUND' });
  });
});
