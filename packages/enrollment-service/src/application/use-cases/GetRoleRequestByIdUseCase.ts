import { createHttpError }         from '@shared/errors';
import { IRoleRequestRepository }  from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }             from '../../domain/entities/RoleRequest';
import { UserServiceClient }       from '../../infrastructure/clients/UserServiceClient';

export interface GetRoleRequestByIdInput {
  /** ID of the role request to retrieve */
  id: string;
  /** UID of the authenticated caller */
  requesterUid: string;
  /**
   * True when the caller holds admin or super_admin — they may view any request
   * and receive the enriched `memberProfile` block with live user data.
   * False for all other roles — they may only view their own request (no memberProfile).
   */
  isAdmin: boolean;
}

/** Live member profile fetched from user-service — included in admin responses only. */
export interface MemberProfile {
  uid:               string;
  email:             string;
  firstName:         string;
  lastName:          string;
  phoneNumber:       string | null;
  profilePhotoUrl:   string | null;
  dateOfBirth:       string | null;
  gender:            string | null;
  address:           string | null;
  preferredLanguage: string;
  roles:             string[];
  status:            string;
  accountCreatedAt:  string;
  qualifications:    { id: string; title: string; fileUrl: string | null }[];
}

export interface RoleRequestDetail {
  id:                       string;
  requesterUid:             string;
  requestedRole:            'student';
  status:                   string;
  decidedByUid:             string | null;
  decisionNote:             string | null;
  createdAt:                string;
  decidedAt:                string | null;
  applicantProfile:         RoleRequest['applicantProfile'];
  qualificationTitle:       string | null;
  qualificationStoragePath: string | null;
  /** Live member profile from user-service. Present for admin/super_admin only.
   *  null when the user-service call fails (non-fatal — request data still returned). */
  memberProfile:            MemberProfile | null;
}

/**
 * Retrieve a single role request by ID.
 *
 * Access rules:
 *  - admin / super_admin → can view any request; response includes `memberProfile`
 *                          with live data fetched from user-service
 *  - all other roles      → can only view requests where requesterUid === their own UID;
 *                          `memberProfile` is null
 *
 * Throws 404 when the request does not exist.
 * Throws 403 when a non-admin caller tries to view another user's request.
 */
export class GetRoleRequestByIdUseCase {
  constructor(
    private readonly repo:        IRoleRequestRepository,
    private readonly userClient:  UserServiceClient,
  ) {}

  async execute(input: GetRoleRequestByIdInput): Promise<RoleRequestDetail> {
    const { id, requesterUid, isAdmin } = input;

    const roleRequest = await this.repo.findById(id);
    if (!roleRequest) {
      throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');
    }

    if (!isAdmin && roleRequest.requesterUid !== requesterUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You can only view your own role requests.');
    }

    // Fetch live member profile from user-service — admin only.
    // Fire-and-forget approach: a failure returns null rather than blocking the response.
    let memberProfile: MemberProfile | null = null;
    if (isAdmin) {
      const profile = await this.userClient.getMemberProfile(roleRequest.requesterUid);
      if (profile) {
        memberProfile = {
          uid:               profile.uid,
          email:             profile.email,
          firstName:         profile.firstName,
          lastName:          profile.lastName,
          phoneNumber:       profile.phoneNumber,
          profilePhotoUrl:   profile.profilePhotoUrl,
          dateOfBirth:       profile.dateOfBirth,
          gender:            profile.gender,
          address:           profile.address,
          preferredLanguage: profile.preferredLanguage,
          roles:             profile.roles,
          status:            profile.status,
          accountCreatedAt:  profile.accountCreatedAt,
          qualifications:    profile.qualifications,
        };
      }
    }

    return {
      id:                       roleRequest.id,
      requesterUid:             roleRequest.requesterUid,
      requestedRole:            roleRequest.requestedRole,
      status:                   roleRequest.status,
      decidedByUid:             roleRequest.decidedByUid,
      decisionNote:             roleRequest.decisionNote,
      createdAt:                roleRequest.createdAt,
      decidedAt:                roleRequest.decidedAt,
      applicantProfile:         roleRequest.applicantProfile,
      qualificationTitle:       roleRequest.qualificationTitle,
      qualificationStoragePath: roleRequest.qualificationStoragePath,
      memberProfile,
    };
  }
}
