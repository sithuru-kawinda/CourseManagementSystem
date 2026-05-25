import { v4 as uuidv4 }    from 'uuid';
import { getStorage }      from 'firebase-admin/storage';
import { createHttpError } from '@shared/errors';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User }            from '../../domain/entities/User';
import { config }          from '../../config';

export interface UploadQualificationInput {
  uid:      string;
  buffer:   Buffer;
  mimeType: string; // must be application/pdf
}

/**
 * Upload a qualification PDF to Firebase Storage and store the download URL
 * on the user's profile document. Uses the same download-token pattern as
 * UploadAvatarUseCase — works with Uniform Bucket-Level Access enabled.
 */
export class UploadQualificationUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: UploadQualificationInput): Promise<User> {
    const user = await this.userRepo.findById(input.uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    const storagePath = `qualifications/${input.uid}.pdf`;
    const bucket      = getStorage().bucket(config.storageBucket);
    const file        = bucket.file(storagePath);
    const token       = uuidv4();

    await file.save(input.buffer, {
      contentType: 'application/pdf',
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encodedPath      = encodeURIComponent(storagePath);
    const qualificationUrl =
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodedPath}?alt=media&token=${token}`;

    user.updateProfile({ qualificationUrl, qualificationStoragePath: storagePath });
    await this.userRepo.update(user);
    return user;
  }
}
