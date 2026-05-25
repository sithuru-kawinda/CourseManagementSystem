import { createHttpError }      from '@shared/errors';
import { Role }                 from '@shared/auth-middleware';
import { ICellGroupRepository } from '../../domain/repositories/ICellGroupRepository';

/**
 * Permanently deletes a cell group.
 *
 * Who can delete:
 *   - The cell's leaderUid (the leader who owns/created the cell)
 *   - The cell's g12LeaderUid (the G12 leader of the network)
 *   - admin / super_admin
 *
 * Regular members cannot delete a cell — they can only leave it.
 */
export class DeleteCellGroupUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(id: string, callerUid: string, callerRoles: Role[]): Promise<void> {
    const cell = await this.cellRepo.findById(id);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner = cell.isOwnedBy(callerUid); // true if callerUid === leaderUid OR g12LeaderUid

    if (!isAdmin && !isOwner) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Only the cell leader, G12 leader, or an admin can delete this cell group.',
      );
    }

    await this.cellRepo.delete(id);
  }
}
