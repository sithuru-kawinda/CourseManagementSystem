import { v4 as uuidv4 }  from 'uuid';
import { getStorage }    from 'firebase-admin/storage';
import { config }        from '../../config';

export interface UploadQualificationInput {
  uid:      string;
  buffer:   Buffer;
  mimeType: string; // must be application/pdf
}

export interface UploadQualificationResult {
  fileUrl: string;  // Firebase Storage download URL — store this in qualifications[].fileUrl
}

/**
 * Upload a qualification PDF to Firebase Storage and return the download URL.
 *
 * This use case is STATELESS — it does NOT write to the users Firestore document.
 * The caller (frontend) holds the returned URL and includes it in the
 * qualifications[] array when calling PATCH /me to save the full profile.
 *
 * Multiple PDFs per user are supported — each gets its own UUID-namespaced path
 * under qualifications/{uid}/{uuid}.pdf so uploads never overwrite each other.
 */
export class UploadQualificationUseCase {
  async execute(input: UploadQualificationInput): Promise<UploadQualificationResult> {
    const fileId      = uuidv4();
    const storagePath = `qualifications/${input.uid}/${fileId}.pdf`;
    const bucket      = getStorage().bucket(config.storageBucket);
    const file        = bucket.file(storagePath);
    const token       = uuidv4();

    // Uses the download-token pattern — works with Uniform Bucket-Level Access enabled.
    await file.save(input.buffer, {
      contentType: 'application/pdf',
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encodedPath = encodeURIComponent(storagePath);
    const fileUrl     =
      `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodedPath}?alt=media&token=${token}`;

    return { fileUrl };
  }
}
