import { v4 as uuidv4 }            from 'uuid';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Notification }            from '../../domain/entities/Notification';

export interface CellReportFiledPayload {
  cellId:       string;
  cellName:     string;
  g12LeaderUid: string;
  reportId:     string;
  filledByUid:  string;
  date:         string;
}

/**
 * Notifies the G12 leader when a cell report is filed in their network.
 * The leader who filed the report is not notified (they are the one who filed it).
 */
export class CellReportFiledHandler {
  constructor(private readonly notifRepo: INotificationRepository) {}

  async handle(payload: CellReportFiledPayload, _requestId: string): Promise<void> {
    const now = new Date().toISOString();

    // Only notify G12 leader if they are different from the one who filed the report
    if (payload.g12LeaderUid === payload.filledByUid) return;

    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.g12LeaderUid,
      type:      'cell_report.filed',
      title:     'Cell Report Filed',
      body:      `A cell report has been filed for ${payload.cellName} (${payload.date}).`,
      read:      false,
      createdAt: now,
    }));
  }
}
