import { createHttpError }      from '@shared/errors';
import { Role }                 from '@shared/auth-middleware';
import { OutboxEventPublisher } from '@shared/events';
import { ICellGroupRepository } from '../../domain/repositories/ICellGroupRepository';
import { CellGroup }            from '../../domain/entities/CellGroup';

export interface TransferOwnershipInput {
  /** New leader UID — replaces current leaderUid. Omit to keep current leader. */
  leaderUid?:    string;
  /** New G12 leader UID — replaces current g12LeaderUid. Omit to keep current G12. */
  g12LeaderUid?: string;
}

/**
 * Transfer cell group ownership to a new leader and/or G12 leader.
 *
 * Who can transfer:
 *   - admin / super_admin only — full override on any combination of fields
 *
 * Publishes `cell.ownership_transferred` to the outbox so the new owner(s)
 * receive an in-app notification and an email.
 */
export class TransferCellOwnershipUseCase {
  constructor(
    private readonly cellRepo: ICellGroupRepository,
    private readonly outbox:   OutboxEventPublisher,
  ) {}

  async execute(
    cellId:       string,
    input:        TransferOwnershipInput,
    callerUid:    string,
    _callerRoles: Role[],   // kept for interface compatibility — only admin/super_admin can reach this
    requestId:    string,
  ): Promise<CellGroup> {
    // ── Load cell ─────────────────────────────────────────────────────────────
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    // ── Guard: cannot transfer ownership of an archived cell ─────────────────
    if (cell.state === 'archived') {
      throw createHttpError(
        409,
        'INVALID_STATE',
        'Cannot transfer ownership of an archived cell group.',
      );
    }

    // ── Guard: at least one field must change ─────────────────────────────────
    const newLeader = input.leaderUid    ?? cell.leaderUid;
    const newG12    = input.g12LeaderUid ?? cell.g12LeaderUid;

    if (newLeader === cell.leaderUid && newG12 === cell.g12LeaderUid) {
      throw createHttpError(
        422,
        'NO_CHANGE',
        'The provided UIDs are the same as the current owners. No change was made.',
      );
    }

    // ── Apply ownership transfer ──────────────────────────────────────────────
    const previousLeaderUid    = cell.leaderUid;
    const previousG12LeaderUid = cell.g12LeaderUid;

    cell.leaderUid    = newLeader;
    cell.g12LeaderUid = newG12;
    cell.updatedAt    = new Date().toISOString();

    await this.cellRepo.update(cell);

    // ── Publish outbox event (non-fatal — ownership is already saved) ─────────
    try {
      await this.outbox.publishWithBatch({
        type:    'cell.ownership_transferred',
        payload: {
          cellId,
          cellName:              cell.name,
          newLeaderUid:          cell.leaderUid,
          newG12LeaderUid:       cell.g12LeaderUid,
          previousLeaderUid,
          previousG12LeaderUid,
          transferredByUid:      callerUid,
          leaderChanged:         cell.leaderUid    !== previousLeaderUid,
          g12Changed:            cell.g12LeaderUid !== previousG12LeaderUid,
          initiatedByOwner:      false,  // only admin initiates — no auto-demotion
        },
        requestId,
      });
    } catch {
      // Outbox failure must not roll back the already-committed ownership change
    }

    return cell;
  }
}
