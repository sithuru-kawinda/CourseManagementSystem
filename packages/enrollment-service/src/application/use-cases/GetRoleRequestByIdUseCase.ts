import { createHttpError }           from '@shared/errors';
import { IRoleRequestRepository }   from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }              from '../../domain/entities/RoleRequest';

export interface GetRoleRequestByIdInput {
  /** ID of the role request to retrieve */
  id: string;
  /** UID of the authenticated caller */
  requesterUid: string;
  /**
   * True when the caller holds admin or super_admin — they may view any request.
   * False for all other roles — they may only view their own request.
   */
  isAdmin: boolean;
}

/**
 * Retrieve a single role request by ID.
 *
 * Access rules:
 *  - admin / super_admin → can view any request
 *  - all other roles      → can only view requests where requesterUid === their own UID
 *
 * Throws 404 when the request does not exist.
 * Throws 403 when a non-admin caller tries to view another user's request.
 */
export class GetRoleRequestByIdUseCase {
  constructor(private readonly repo: IRoleRequestRepository) {}

  async execute(input: GetRoleRequestByIdInput): Promise<RoleRequest> {
    const { id, requesterUid, isAdmin } = input;

    const roleRequest = await this.repo.findById(id);
    if (!roleRequest) {
      throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');
    }

    if (!isAdmin && roleRequest.requesterUid !== requesterUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You can only view your own role requests.');
    }

    return roleRequest;
  }
}
