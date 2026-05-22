import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';

export interface DeleteUserInput {
  /** UID of the user to delete */
  targetUid: string;
  /** UID of the authenticated caller (admin / super_admin) */
  callerUid: string;
}

/**
 * Soft-delete a regular (non-admin) user account.
 *
 * Business rules:
 *  - Target must exist and must NOT hold `admin` or `super_admin` — use
 *    `DELETE /super-admin/admins/:uid` for privileged accounts.
 *  - Caller cannot delete their own account.
 *  - Idempotent guard: already-deleted users return 404 (findById returns null).
 *
 * Side-effects (both must succeed; no partial rollback):
 *  1. `userRepo.softDelete(uid)` — sets `deletedAt` + `updatedAt` in Firestore
 *  2. `authClient.disableUser(uid)` — prevents future sign-ins via Firebase Auth
 */
export class DeleteUserUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(input: DeleteUserInput): Promise<void> {
    const { targetUid, callerUid } = input;

    // Guard: cannot delete yourself
    if (targetUid === callerUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You cannot delete your own account.');
    }

    const user = await this.userRepo.findById(targetUid);
    if (!user) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    // Guard: admin/super_admin users must be deleted via DELETE /super-admin/admins/:uid
    if (user.roles.includes('admin') || user.roles.includes('super_admin')) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Admin accounts cannot be deleted through this endpoint. Use DELETE /super-admin/admins/:uid.',
      );
    }

    await this.userRepo.softDelete(targetUid);
    await this.authClient.disableUser(targetUid);
  }
}
