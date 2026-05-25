import { v4 as uuidv4 }            from 'uuid';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Notification }            from '../../domain/entities/Notification';

export interface CellJoinRequestedPayload {
  cellId:        string;
  cellName:      string;
  leaderUid:     string;
  g12LeaderUid:  string;
  requesterUid:  string;
  joinRequestId: string;
}

/**
 * Notifies the cell leader AND the G12 leader when a member requests to join their cell.
 * Both receive an in-app notification so they can review and approve/reject from the app.
 */
export class CellJoinRequestedHandler {
  constructor(private readonly notifRepo: INotificationRepository) {}

  async handle(payload: CellJoinRequestedPayload, _requestId: string): Promise<void> {
    const now   = new Date().toISOString();
    const title = 'New Cell Join Request';
    const body  = `A member has requested to join ${payload.cellName}.`;

    // Collect unique UIDs — leader and G12 leader may sometimes be the same person
    const uidsToNotify = [...new Set([payload.leaderUid, payload.g12LeaderUid])];

    await Promise.all(
      uidsToNotify.map(uid =>
        this.notifRepo.create(new Notification({
          id:        uuidv4(),
          userUid:   uid,
          type:      'cell.join_requested',
          title,
          body,
          read:      false,
          createdAt: now,
        })),
      ),
    );
  }
}
