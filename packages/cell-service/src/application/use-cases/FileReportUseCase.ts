import { v4 as uuidv4 }            from 'uuid';
import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository }    from '../../domain/repositories/ICellReportRepository';
import { CellReport, CellReportProps } from '../../domain/entities/CellReport';
import { Role }                     from '@shared/auth-middleware';

export type FileReportInput = Omit<CellReportProps, 'id' | 'cellId' | 'filledByUid' | 'voided' | 'createdAt'>;

export class FileReportUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(
    cellId:      string,
    input:       FileReportInput,
    filledByUid: string,
    callerRoles: Role[],
    requestId:   string,
  ): Promise<{ report: CellReport; isNew: boolean }> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin    = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isSuperAdmin = callerRoles.includes('super_admin');
    const isOwner    = cell.isOwnedBy(filledByUid);

    // Only owning leader, G12 leader, or super_admin may file — regular admin cannot
    if (!isSuperAdmin && !isOwner) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell leader or super admin can file a cell report.');
    }
    void isAdmin; // used above implicitly

    // Idempotency check
    const existing = await this.reportRepo.findByClientReqId(cellId, input.clientReqId);
    if (existing) return { report: existing, isNew: false };

    const now    = new Date().toISOString();
    const report = new CellReport({
      ...input,
      id:          uuidv4(),
      cellId,
      filledByUid,
      voided:      false,
      createdAt:   now,
    });

    await this.reportRepo.create(report);
    cell.incrementReportCount();
    await this.cellRepo.update(cell);

    await this.outbox.publishWithBatch({
      type:    'cell_report.filed',
      payload: {
        cellId,
        cellName:     cell.name,
        g12LeaderUid: cell.g12LeaderUid,
        reportId:     report.id,
        filledByUid,
        date:         report.date,
      },
      requestId,
    });

    return { report, isNew: true };
  }
}
