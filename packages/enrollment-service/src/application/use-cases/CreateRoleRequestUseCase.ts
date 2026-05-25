import { v4 as uuidv4 }                                   from 'uuid';
import { createHttpError }                                 from '@shared/errors';
import { OutboxEventPublisher }                            from '@shared/events';
import { IRoleRequestRepository }                         from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }                                    from '../../domain/entities/RoleRequest';
import { UserServiceClient }                              from '../../infrastructure/clients/UserServiceClient';

export interface CreateRoleRequestInput {
  requesterUid:  string;
  requestedRole: 'student';
}

export class CreateRoleRequestUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly outbox:          OutboxEventPublisher,
    private readonly userClient:      UserServiceClient,
  ) {}

  async execute(input: CreateRoleRequestInput, requestId: string): Promise<RoleRequest> {
    // Guard: only one pending request at a time
    const existing = await this.roleRequestRepo.findPendingByRequester(input.requesterUid);
    if (existing) {
      throw createHttpError(409, 'ROLE_REQUEST_PENDING', 'You already have a pending role request.');
    }

    // Read profile from user-service and snapshot into the role request
    const profile = await this.userClient.getUser(input.requesterUid);
    if (!profile) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Could not load your profile. Please try again.');
    }

    const id = uuidv4();

    const roleRequest = new RoleRequest({
      id,
      requesterUid:             input.requesterUid,
      requestedRole:            'student',
      status:                   'pending',
      decidedByUid:             null,
      decisionNote:             null,
      createdAt:                new Date().toISOString(),
      decidedAt:                null,
      qualificationTitle:       profile.qualificationTitle,
      qualificationStoragePath: null, // qualification is on the user profile, not stored here
      applicantProfile: {
        firstName:          profile.firstName,
        lastName:           profile.lastName,
        phoneNumber:        profile.phoneNumber,
        email:              profile.email,
        dateOfBirth:        profile.dateOfBirth,
        gender:             profile.gender as 'male' | 'female' | 'other' | null,
        address:            profile.address,
        qualificationTitle: profile.qualificationTitle,
        qualificationUrl:   profile.qualificationUrl,
      },
    });

    await this.roleRequestRepo.create(roleRequest);

    await this.outbox.publishWithBatch({
      type:    'role.requested',
      payload: { requesterUid: input.requesterUid, requestedRole: 'student' },
      requestId,
    });

    return roleRequest;
  }
}
