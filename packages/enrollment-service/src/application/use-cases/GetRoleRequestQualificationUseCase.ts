import { createHttpError }                    from '@shared/errors';
import { IRoleRequestRepository }            from '../../domain/repositories/IRoleRequestRepository';
import { QualificationStorageRepository }    from '../../infrastructure/repositories/QualificationStorageRepository';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface QualificationUrlResult {
  signedUrl:          string;
  expiresAt:          string;
  qualificationTitle: string;
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

    const signedUrl = await this.storageRepo.getSignedUrl(req.qualificationStoragePath, SIGNED_URL_TTL_MS);
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();

    return { signedUrl, expiresAt, qualificationTitle: req.qualificationTitle };
  }
}
