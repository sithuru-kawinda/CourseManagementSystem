import { createHttpError }    from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { UserRole }           from '../../domain/entities/User';


export interface DemoteMemberInput {
  targetUid:   string;
  role:        'student' | 'leader' | 'g12';
  callerUid:   string;
  callerRoles: UserRole[];
  requestId:   string;
}

export class DemoteMemberUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: DemoteMemberInput): Promise<void> {
    const { targetUid, role, callerUid, callerRoles, requestId } = input;

    // ── Guard: cannot demote yourself ────────────────────────────────────────
    if (callerUid === targetUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You cannot demote your own account.');
    }

    // ── Guard: caller-role permission check ───────────────────────────────────
    // Mirror of PromoteMemberUseCase:
    //   super_admin  → can demote student / leader / g12
    //   admin        → can demote student / leader / g12
    //   g12          → can demote leader / g12
    //   leader       → can only demote g12
    const isSuperAdmin = callerRoles.includes('super_admin');
    const isAdmin      = callerRoles.includes('admin');
    const isG12        = callerRoles.includes('g12');
    const isLeader     = callerRoles.includes('leader');

    let allowedRoles: UserRole[] = [];
    if (isSuperAdmin || isAdmin) {
      allowedRoles = ['student', 'leader', 'g12'];
    } else if (isG12) {
      allowedRoles = ['leader'];      // g12 can demote leader only — cannot demote another g12
    } else if (isLeader) {
      allowedRoles = ['g12'];
    }

    if (!allowedRoles.includes(role)) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        `Your role does not permit you to remove the '${role}' role.`,
      );
    }

    // ── Load target user ──────────────────────────────────────────────────────
    const target = await this.userRepo.findById(targetUid);
    if (!target) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // ── Guard: cannot demote an admin or super_admin ──────────────────────────
    if (target.roles.includes('admin') || target.roles.includes('super_admin')) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Admin and super_admin accounts cannot be demoted through this endpoint.',
      );
    }

    // ── Idempotent — user does not have the role ──────────────────────────────
    if (!target.roles.includes(role)) return;

    // ── Dual-write: Firestore + Firebase Auth claims ──────────────────────────
    target.removeRole(role);
    await this.userRepo.update(target);
    await this.authClient.removeRoleFromUser(targetUid, role);

    // ── Audit trail ───────────────────────────────────────────────────────────
    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     `DEMOTE_FROM_${role.toUpperCase()}`,
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
      },
      requestId,
    });
  }
}
