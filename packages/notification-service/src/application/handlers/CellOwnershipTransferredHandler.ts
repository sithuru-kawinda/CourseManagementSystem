import { v4 as uuidv4 }            from 'uuid';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Notification }            from '../../domain/entities/Notification';
import { NotificationDispatcher }  from '../services/NotificationDispatcher';
import { UserServiceClient }       from '../../infrastructure/clients/UserServiceClient';

export interface CellOwnershipTransferredPayload {
  cellId:               string;
  cellName:             string;
  newLeaderUid:         string;
  newG12LeaderUid:      string;
  previousLeaderUid:    string;
  previousG12LeaderUid: string;
  transferredByUid:     string;
  leaderChanged:        boolean;
  g12Changed:           boolean;
}

/**
 * Sends in-app notification + email to the new leader and/or G12 leader
 * when a cell group's ownership is transferred by an admin.
 */
export class CellOwnershipTransferredHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly userClient: UserServiceClient,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: CellOwnershipTransferredPayload, requestId: string): Promise<void> {
    const now = new Date().toISOString();

    // ── In-app notifications ───────────────────────────────────────────────────

    if (payload.leaderChanged) {
      await this.notifRepo.create(new Notification({
        id:        uuidv4(),
        userUid:   payload.newLeaderUid,
        type:      'cell.ownership_transferred',
        title:     'Cell Leadership Assigned',
        body:      `You have been assigned as Cell Leader of "${payload.cellName}".`,
        read:      false,
        createdAt: now,
      }));
    }

    if (payload.g12Changed) {
      // Only notify if the G12 leader is different from the leader (avoid duplicate)
      const notifyG12Separately = payload.newG12LeaderUid !== payload.newLeaderUid ||
                                   !payload.leaderChanged;
      if (notifyG12Separately) {
        await this.notifRepo.create(new Notification({
          id:        uuidv4(),
          userUid:   payload.newG12LeaderUid,
          type:      'cell.ownership_transferred',
          title:     'G12 Leadership Assigned',
          body:      `You have been assigned as G12 Leader of "${payload.cellName}".`,
          read:      false,
          createdAt: now,
        }));
      }
    }

    // ── Email to new leader ────────────────────────────────────────────────────
    if (payload.leaderChanged) {
      const user = await this.userClient.getUserById(payload.newLeaderUid);
      if (user) {
        const html = this.buildEmail(
          `${user.firstName} ${user.lastName}`,
          'Cell Leader',
          payload.cellName,
        );
        await this.dispatcher.dispatchEmail(
          user.email,
          `You've been assigned as Cell Leader — ${payload.cellName}`,
          html,
          requestId,
        );
      }
    }

    // ── Email to new G12 leader (if different person) ──────────────────────────
    if (payload.g12Changed && payload.newG12LeaderUid !== payload.newLeaderUid) {
      const user = await this.userClient.getUserById(payload.newG12LeaderUid);
      if (user) {
        const html = this.buildEmail(
          `${user.firstName} ${user.lastName}`,
          'G12 Leader',
          payload.cellName,
        );
        await this.dispatcher.dispatchEmail(
          user.email,
          `You've been assigned as G12 Leader — ${payload.cellName}`,
          html,
          requestId,
        );
      }
    }
  }

  private buildEmail(fullName: string, role: string, cellName: string): string {
    return `
      <p>Hi <strong>${fullName}</strong>,</p>
      <p>You have been assigned as <strong>${role}</strong> of the cell group
         <strong>"${cellName}"</strong> by a TCCR administrator.</p>
      <p>You can now access and manage this cell group from the TCCR app.</p>
      <p style="color:#555;font-size:13px;">
        If you believe this was done in error, please contact your administrator.
      </p>
    `.trim();
  }
}
