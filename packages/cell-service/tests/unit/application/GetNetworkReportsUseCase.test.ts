import { GetNetworkReportsUseCase }  from '../../../src/application/use-cases/GetNetworkReportsUseCase';
import { ICellGroupRepository }      from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }     from '../../../src/domain/repositories/ICellReportRepository';
import { CellGroup }                 from '../../../src/domain/entities/CellGroup';
import { CellReport }                from '../../../src/domain/entities/CellReport';
import { Role }                      from '@shared/auth-middleware';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeCell = (id: string, name: string, g12Uid = 'g12-1', leaderUid = 'leader-1'): CellGroup =>
  new CellGroup({
    id, name, type: 'g12', area: 'Area',
    leaderUid, g12LeaderUid: g12Uid,
    members: [leaderUid], memberCount: 1, reportCount: 1,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const makeReport = (id: string, cellId: string, date = '2026-05-20'): CellReport =>
  new CellReport({
    id, cellId, filledByUid: 'leader-1', clientReqId: `crq-${id}`,
    date, didMeet: true, noMeetReason: null, leaderPresent: true,
    conductedByIfAbsent: null, location: 'Home', timeStarted: '18:00', timeEnded: '20:00',
    language: 'en', subjectDiscussed: 'sunday_sermon', otherSubjectReason: null,
    cellType: 'g12', g12LeaderUid: 'g12-1', immediateG12LeaderText: null,
    attendance: [], contactedAbsentees: 'no', absenteeNotes: null,
    additionalVisitors: 0, childrenCount: 0, satisfactionRate: 4,
    additionalInfo: null, photoUrls: [], voided: false,
    createdAt: '2026-05-20T09:00:00Z',
  });

const EMPTY = { items: [], nextCursor: null, total: 0 };
const OPTS = { limit: 20 };

describe('GetNetworkReportsUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let useCase:    GetNetworkReportsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    reportRepo = makeReportRepo();
    useCase    = new GetNetworkReportsUseCase(cellRepo, reportRepo);
  });

  // ── G12 — sees only their network ────────────────────────────────────────

  it('G12 queries cells filtered by their g12LeaderUid', async () => {
    cellRepo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    await useCase.execute(OPTS, 'g12-1', ['g12'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ g12LeaderUid: 'g12-1', state: 'active' }),
    );
  });

  it('G12 receives reports from all cells in their network', async () => {
    const cells = [makeCell('cell-a', 'Cell A'), makeCell('cell-b', 'Cell B')];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    reportRepo.findAll
      .mockResolvedValueOnce({ items: [makeReport('r1', 'cell-a', '2026-05-22')], nextCursor: null, total: 1 })
      .mockResolvedValueOnce({ items: [makeReport('r2', 'cell-b', '2026-05-20')], nextCursor: null, total: 1 });

    const result = await useCase.execute(OPTS, 'g12-1', ['g12'] as Role[]);

    expect(result.items).toHaveLength(2);
    expect(result.totalCells).toBe(2);
  });

  it('reports include cellName from their parent cell', async () => {
    cellRepo.findAll.mockResolvedValue({ items: [makeCell('cell-a', 'Rathmalana West')], nextCursor: null, total: 1 });
    reportRepo.findAll.mockResolvedValue({ items: [makeReport('r1', 'cell-a')], nextCursor: null, total: 1 });

    const result = await useCase.execute(OPTS, 'g12-1', ['g12'] as Role[]);

    expect((result.items[0] as any).cellName).toBe('Rathmalana West');
  });

  it('reports are sorted by date descending (newest first)', async () => {
    cellRepo.findAll.mockResolvedValue({ items: [makeCell('c1', 'C1'), makeCell('c2', 'C2')], nextCursor: null, total: 2 });
    reportRepo.findAll
      .mockResolvedValueOnce({ items: [makeReport('r1', 'c1', '2026-05-20')], nextCursor: null, total: 1 })
      .mockResolvedValueOnce({ items: [makeReport('r2', 'c2', '2026-05-24')], nextCursor: null, total: 1 });

    const result = await useCase.execute(OPTS, 'g12-1', ['g12'] as Role[]);

    expect(result.items[0].id).toBe('r2'); // newer first
    expect(result.items[1].id).toBe('r1');
  });

  it('returns empty when G12 has no cells', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY);

    const result = await useCase.execute(OPTS, 'g12-1', ['g12'] as Role[]);

    expect(result.items).toHaveLength(0);
    expect(result.totalCells).toBe(0);
    expect(reportRepo.findAll).not.toHaveBeenCalled();
  });

  // ── Leader — sees only their own cell ────────────────────────────────────

  it('leader queries cells filtered by their leaderUid', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY);

    await useCase.execute(OPTS, 'leader-1', ['leader'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUid: 'leader-1' }),
    );
    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ g12LeaderUid: 'leader-1' }),
    );
  });

  // ── Admin — no UID filter ─────────────────────────────────────────────────

  it('admin queries all cells with no UID filter', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY);

    await useCase.execute(OPTS, 'admin-uid', ['admin'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ g12LeaderUid: expect.anything() }),
    );
    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: expect.anything() }),
    );
  });

  // ── 403 ───────────────────────────────────────────────────────────────────

  it('throws 403 when called by a regular member', async () => {
    await expect(
      useCase.execute(OPTS, 'member-uid', ['member'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });
});
