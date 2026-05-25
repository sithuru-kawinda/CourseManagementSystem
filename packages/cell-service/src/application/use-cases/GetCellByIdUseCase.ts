import { createHttpError }       from '@shared/errors';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { CellType, CellState } from '../../domain/entities/CellGroup';
import { Role }                  from '@shared/auth-middleware';
import { UserServiceClient, MemberProfile } from '../../infrastructure/clients/UserServiceClient';

/** Response shape for GET /cells/:id — members enriched with names from user-service */
export interface CellGroupDetail {
  id:           string;
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      MemberProfile[];
  memberCount:  number;
  reportCount:  number;
  state:        CellState;
  createdAt:    string;
  updatedAt:    string;
}

export class GetCellByIdUseCase {
  constructor(
    private readonly cellRepo:    ICellGroupRepository,
    private readonly userClient:  UserServiceClient,
  ) {}

  async execute(id: string, callerUid: string, callerRoles: Role[]): Promise<CellGroupDetail> {
    const cell = await this.cellRepo.findById(id);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner  = cell.isOwnedBy(callerUid);
    const isMember = cell.hasMember(callerUid);

    if (!isAdmin && !isOwner && !isMember) {
      throw createHttpError(403, 'FORBIDDEN', 'You do not have access to this cell group.');
    }

    // Enrich member UIDs with firstName + lastName from user-service.
    // Failures are non-fatal — placeholder names are returned instead.
    const members = await this.userClient.getMemberProfiles(cell.members);

    // Spread the cell entity fields and replace the raw members string[]
    // with the enriched MemberProfile[].
    return {
      id:           cell.id,
      name:         cell.name,
      type:         cell.type,
      area:         cell.area,
      leaderUid:    cell.leaderUid,
      g12LeaderUid: cell.g12LeaderUid,
      members,
      memberCount:  cell.memberCount,
      reportCount:  cell.reportCount,
      state:        cell.state,
      createdAt:    cell.createdAt,
      updatedAt:    cell.updatedAt,
    };
  }
}
