import { ICellGroupRepository, CellGroupListOptions, CellGroupListResult } from '../../domain/repositories/ICellGroupRepository';
import { Role } from '@shared/auth-middleware';

export class GetCellsUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(opts: CellGroupListOptions, callerUid: string, callerRoles: Role[]): Promise<CellGroupListResult> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    // admin / super_admin — see ALL cell groups across ALL states by default.
    // State filter is applied only when explicitly provided via ?state=...
    if (isAdmin) {
      return this.cellRepo.findAll({ ...opts });
    }

    // G12 — see all cells (active by default, can pass ?state=archived)
    if (isG12) {
      return this.cellRepo.findAll({ ...opts, state: opts.state ?? 'active' });
    }

    // Leader — see only their own cells
    if (isLeader) {
      return this.cellRepo.findAll({ ...opts, leaderUid: callerUid, state: opts.state ?? 'active' });
    }

    // Members / students — see all active cells (to find one to join)
    return this.cellRepo.findAll({ ...opts, state: 'active' });
  }
}
