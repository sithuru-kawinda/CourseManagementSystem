import { createHttpError }        from '@shared/errors';
import { Role }                   from '@shared/auth-middleware';
import { ICellGroupRepository }   from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository,
         CellReportListOptions }  from '../../domain/repositories/ICellReportRepository';
import { CellReport }             from '../../domain/entities/CellReport';

export interface NetworkReportsResult {
  items:      (CellReport & { cellName: string })[];
  totalCells: number;
}

/**
 * Returns all cell reports across every cell in the caller's G12 network.
 *
 * Scope by role:
 *   G12         → reports from all cells where g12LeaderUid === callerUid
 *   Leader      → reports from their own cell (leaderUid === callerUid)
 *   Admin/SA    → reports from ALL active cells (no UID filter)
 *
 * Reports are fetched per-cell and merged, ordered by date desc.
 * Use `limit` to control how many reports per cell (default 20).
 */
export class GetNetworkReportsUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
  ) {}

  async execute(
    opts:        CellReportListOptions,
    callerUid:   string,
    callerRoles: Role[],
  ): Promise<NetworkReportsResult> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    if (!isAdmin && !isG12 && !isLeader) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Only G12 leaders, cell leaders, admin, and super_admin can access network reports.',
      );
    }

    // ── Determine which cells to fetch reports from ───────────────────────────
    let cellFilter: { g12LeaderUid?: string; leaderUid?: string } = {};

    if (isAdmin) {
      cellFilter = {}; // all cells — no restriction
    } else if (isG12) {
      cellFilter = { g12LeaderUid: callerUid }; // only cells under this G12
    } else {
      cellFilter = { leaderUid: callerUid }; // only the leader's own cell
    }

    // Fetch up to 100 cells (enough for a full G12 network)
    const cellResult = await this.cellRepo.findAll({
      limit: 100,
      state: 'active',
      ...cellFilter,
    });

    if (cellResult.items.length === 0) {
      return { items: [], totalCells: 0 };
    }

    // ── Fetch reports for each cell in parallel ───────────────────────────────
    const reportPages = await Promise.all(
      cellResult.items.map(cell =>
        this.reportRepo.findAll(cell.id, opts)
          .then(r => r.items.map(report => ({ ...report, cellName: cell.name })))
          .catch(() => [] as (CellReport & { cellName: string })[]), // skip failed cells
      ),
    );

    // ── Merge and sort by date descending ─────────────────────────────────────
    const allReports = (reportPages.flat() as (CellReport & { cellName: string })[])
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      items:      allReports,
      totalCells: cellResult.items.length,
    };
  }
}
