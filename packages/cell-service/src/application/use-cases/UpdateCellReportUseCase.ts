import { createHttpError }         from '@shared/errors';
import { Role }                    from '@shared/auth-middleware';
import { ICellGroupRepository }    from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository }   from '../../domain/repositories/ICellReportRepository';
import { CellReport }              from '../../domain/entities/CellReport';
import { FileReportInput }         from './FileReportUseCase';

/** Maximum hours after filing during which a report can be edited. */
const EDIT_WINDOW_HOURS = 24;

/** Subset of FileReportInput allowed in an update — all fields optional (PATCH semantics).
 *  `clientReqId` is intentionally excluded: it is immutable after filing. */
export type UpdateCellReportInput = Partial<Omit<FileReportInput, 'clientReqId'>>;

export class UpdateCellReportUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
  ) {}

  async execute(
    cellId:      string,
    reportId:    string,
    input:       UpdateCellReportInput,
    callerUid:   string,
    callerRoles: Role[],
  ): Promise<CellReport> {
    // ── Validate the cell exists ─────────────────────────────────────────────
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    // ── Load the report ──────────────────────────────────────────────────────
    const report = await this.reportRepo.findById(cellId, reportId);
    if (!report) throw createHttpError(404, 'REPORT_NOT_FOUND', 'Cell report not found.');

    // ── Guard: only the original filer or super_admin can edit ───────────────
    const isSuperAdmin = callerRoles.includes('super_admin');
    if (!isSuperAdmin && report.filledByUid !== callerUid) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Only the person who filed this report or a super admin can edit it.',
      );
    }

    // ── Guard: cannot edit a voided report ───────────────────────────────────
    if (report.voided) {
      throw createHttpError(
        409,
        'REPORT_ALREADY_VOIDED',
        'A voided report cannot be edited.',
      );
    }

    // ── Guard: 24-hour edit window ────────────────────────────────────────────
    const filedAt        = new Date(report.createdAt);
    const hoursSinceFiled = (Date.now() - filedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceFiled > EDIT_WINDOW_HOURS) {
      throw createHttpError(
        422,
        'EDIT_WINDOW_EXPIRED',
        `Cell reports can only be edited within ${EDIT_WINDOW_HOURS} hours of filing. This report was filed ${Math.floor(hoursSinceFiled)} hours ago.`,
      );
    }

    // ── Apply updates (only provided fields, immutable fields stay unchanged) ─
    if (input.date                   !== undefined) report.date                   = input.date;
    if (input.didMeet                !== undefined) report.didMeet                = input.didMeet;
    if (input.noMeetReason           !== undefined) report.noMeetReason           = input.noMeetReason ?? null;
    if (input.leaderPresent          !== undefined) report.leaderPresent          = input.leaderPresent;
    if (input.conductedByIfAbsent    !== undefined) report.conductedByIfAbsent    = input.conductedByIfAbsent ?? null;
    if (input.location               !== undefined) report.location               = input.location;
    if (input.timeStarted            !== undefined) report.timeStarted            = input.timeStarted;
    if (input.timeEnded              !== undefined) report.timeEnded              = input.timeEnded;
    if (input.language               !== undefined) report.language               = input.language;
    if (input.subjectDiscussed       !== undefined) report.subjectDiscussed       = input.subjectDiscussed;
    if (input.otherSubjectReason     !== undefined) report.otherSubjectReason     = input.otherSubjectReason ?? null;
    if (input.cellType               !== undefined) report.cellType               = input.cellType;
    if (input.g12LeaderUid           !== undefined) report.g12LeaderUid           = input.g12LeaderUid;
    if (input.immediateG12LeaderText !== undefined) report.immediateG12LeaderText = input.immediateG12LeaderText ?? null;
    if (input.attendance             !== undefined) report.attendance             = input.attendance;
    if (input.contactedAbsentees     !== undefined) report.contactedAbsentees     = input.contactedAbsentees;
    if (input.absenteeNotes          !== undefined) report.absenteeNotes          = input.absenteeNotes ?? null;
    if (input.additionalVisitors     !== undefined) report.additionalVisitors     = input.additionalVisitors;
    if (input.childrenCount          !== undefined) report.childrenCount          = input.childrenCount;
    if (input.satisfactionRate       !== undefined) report.satisfactionRate       = input.satisfactionRate;
    if (input.additionalInfo         !== undefined) report.additionalInfo         = input.additionalInfo ?? null;
    if (input.photoUrls              !== undefined) report.photoUrls              = input.photoUrls;

    await this.reportRepo.update(report);
    return report;
  }
}
