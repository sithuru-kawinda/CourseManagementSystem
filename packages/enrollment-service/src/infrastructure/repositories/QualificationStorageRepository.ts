import { getStorage } from 'firebase-admin/storage';
import { config }      from '../../config';

/**
 * Handles qualification PDF files in Firebase Storage under qualifications/{uid}/{id}.pdf.
 * Files are private — access is always via short-lived signed URLs.
 */
export class QualificationStorageRepository {
  private get bucket() {
    return getStorage().bucket(config.storageBucket || undefined);
  }

  async upload(buffer: Buffer, storagePath: string): Promise<void> {
    const file = this.bucket.file(storagePath);
    await file.save(buffer, { contentType: 'application/pdf', resumable: false });
  }

  async getSignedUrl(storagePath: string, expiresInMs: number): Promise<string> {
    const file  = this.bucket.file(storagePath);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + expiresInMs });
    return url;
  }

  async delete(storagePath: string): Promise<void> {
    await this.bucket.file(storagePath).delete({ ignoreNotFound: true });
  }
}
