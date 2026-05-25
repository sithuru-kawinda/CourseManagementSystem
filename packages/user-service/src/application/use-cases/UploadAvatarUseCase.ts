import { v4 as uuidv4 }    from 'uuid';
import { getStorage }      from 'firebase-admin/storage';
import { createHttpError } from '@shared/errors';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User }            from '../../domain/entities/User';
import { config }          from '../../config';

export interface UploadAvatarInput {
  uid:      string;
  buffer:   Buffer;
  mimeType: string;
}

export class UploadAvatarUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: UploadAvatarInput): Promise<User> {
    const user = await this.userRepo.findById(input.uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    const ext      = input.mimeType === 'image/png' ? 'png' : 'jpg';
    const filePath = `avatars/${input.uid}.${ext}`;
    const bucket   = getStorage().bucket(config.storageBucket);
    const file     = bucket.file(filePath);
    const token    = uuidv4();

    // Upload with a download token embedded in custom metadata.
    // This produces a browser-loadable Firebase Storage URL that does not require
    // authentication — no makePublic() needed, and works even when Uniform
    // Bucket-Level Access is enabled (where makePublic() is silently ignored).
    await file.save(input.buffer, {
      contentType: input.mimeType,
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encodedPath     = encodeURIComponent(filePath);
    const profilePhotoUrl =
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodedPath}?alt=media&token=${token}`;

    user.updateProfile({ profilePhotoUrl });
    await this.userRepo.update(user);
    return user;
  }
}
