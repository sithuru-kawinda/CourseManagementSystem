import { createHttpError }                    from '@shared/errors';
import { IRoleRequestRepository }            from '../../domain/repositories/IRoleRequestRepository';
import { QualificationStorageRepository }    from '../../infrastructure/repositories/QualificationStorageRepository';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface QualificationUrlResult {
  signedUrl:          string;
  expiresAt:          string;
  qualificationTitle: string | null;
}

export class GetRoleRequestQualificationUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly storageRepo:     QualificationStorageRepository,
  ) {}

  async execute(id: string): Promise<QualificationUrlResult> {
    const req = await this.roleRequestRepo.findById(id);
    if (!req) {
      throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');
    }

    // Qualification may now be on the applicant's profile snapshot
    const qualUrl = req.applicantProfile?.qualificationUrl ?? null;
    const storagePath = req.qualificationStoragePath ?? null;

    if (!qualUrl && !storagePath) {
      throw createHttpError(404, 'QUALIFICATION_NOT_FOUND', 'No qualification file is attached to this role request.');
    }

    // Prefer the direct URL from the profile snapshot; fall back to generating a signed URL
    const signedUrl = qualUrl ?? await this.storageRepo.getSignedUrl(storagePath!, SIGNED_URL_TTL_MS);
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();

    return { signedUrl, expiresAt, qualificationTitle: req.qualificationTitle ?? req.applicantProfile?.qualificationTitle ?? null };
  }
}
