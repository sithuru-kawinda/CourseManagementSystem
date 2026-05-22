import { v4 as uuidv4 }                                   from 'uuid';
import { createHttpError }                                 from '@shared/errors';
import { OutboxEventPublisher }                            from '@shared/events';
import { IRoleRequestRepository }                         from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest, ApplicantProfile }                  from '../../domain/entities/RoleRequest';
import { QualificationStorageRepository }                 from '../../infrastructure/repositories/QualificationStorageRepository';

export interface CreateRoleRequestInput {
  requesterUid:       string;
  requestedRole:      'student';
  firstName:          string;
  lastName:           string;
  phoneNumber:        string;
  email:              string;
  dateOfBirth:        string;
  gender:             'male' | 'female' | 'other';
  address:            string;
  qualificationTitle: string;
  qualificationFile:  { buffer: Buffer; mimeType: string };
}

export class CreateRoleRequestUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly outbox:          OutboxEventPublisher,
    private readonly storageRepo:     QualificationStorageRepository,
  ) {}

  async execute(input: CreateRoleRequestInput, requestId: string): Promise<RoleRequest> {
    // Guard: reject if a pending request already exists for this member
    const existing = await this.roleRequestRepo.findPendingByRequester(input.requesterUid);
    if (existing) {
      throw createHttpError(409, 'ROLE_REQUEST_PENDING', 'You already have a pending role request.');
    }

    const id          = uuidv4();
    const storagePath = `qualifications/${input.requesterUid}/${id}.pdf`;

    // Upload first — clean up if the Firestore write fails to prevent orphaned files
    await this.storageRepo.upload(input.qualificationFile.buffer, storagePath);

    const applicantProfile: ApplicantProfile = {
      firstName:   input.firstName,
      lastName:    input.lastName,
      phoneNumber: input.phoneNumber,
      email:       input.email,
      dateOfBirth: input.dateOfBirth,
      gender:      input.gender,
      address:     input.address,
    };

    const roleRequest = new RoleRequest({
      id,
      requesterUid:             input.requesterUid,
      requestedRole:            'student',
      status:                   'pending',
      decidedByUid:             null,
      decisionNote:             null,
      createdAt:                new Date().toISOString(),
      decidedAt:                null,
      applicantProfile,
      qualificationTitle:       input.qualificationTitle,
      qualificationStoragePath: storagePath,
    });

    try {
      await this.roleRequestRepo.create(roleRequest);
    } catch (err) {
      // Rollback: remove the uploaded file so storage stays consistent with Firestore
      await this.storageRepo.delete(storagePath).catch(() => undefined);
      throw err;
    }

    await this.outbox.publishWithBatch({
      type:    'role.requested',
      payload: { requesterUid: input.requesterUid, requestedRole: 'student' },
      requestId,
    });

    return roleRequest;
  }
}
