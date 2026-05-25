import { v4 as uuidv4 }            from 'uuid';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Notification }            from '../../domain/entities/Notification';

export interface CellJoinApprovedPayload {
  cellId:        string;
  cellName:      string;
  memberUid:     string;
  joinRequestId: string;
  decidedByUid:  string;
}

/**
 * Notifies the member whose join request was approved.
 * They now have access to the cell group.
 */
export class CellJoinApprovedHandler {
  constructor(private readonly notifRepo: INotificationRepository) {}

  async handle(payload: CellJoinApprovedPayload, _requestId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.memberUid,
      type:      'cell.join_approved',
      title:     'Cell Join Request Approved',
      body:      `Your request to join ${payload.cellName} has been approved. Welcome to the cell!`,
      read:      false,
      createdAt: now,
    }));
  }
}
