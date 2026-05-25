import { v4 as uuidv4 }            from 'uuid';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Notification }            from '../../domain/entities/Notification';

export interface CellJoinRejectedPayload {
  cellId:        string;
  cellName:      string;
  requesterUid:  string;
  joinRequestId: string;
  decidedByUid:  string;
}

/**
 * Notifies the member whose join request was rejected.
 * They can apply to a different cell group.
 */
export class CellJoinRejectedHandler {
  constructor(private readonly notifRepo: INotificationRepository) {}

  async handle(payload: CellJoinRejectedPayload, _requestId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.requesterUid,
      type:      'cell.join_rejected',
      title:     'Cell Join Request Not Approved',
      body:      `Your request to join ${payload.cellName} was not approved. You may apply to another cell group.`,
      read:      false,
      createdAt: now,
    }));
  }
}
