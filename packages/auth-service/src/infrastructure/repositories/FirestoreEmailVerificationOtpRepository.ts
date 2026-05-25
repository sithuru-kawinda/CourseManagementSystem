import { getFirestore } from 'firebase-admin/firestore';

export interface EmailVerificationOtpRecord {
  email:     string;
  uid:       string;
  otp:       string;
  expiresAt: string;
  attempts:  number;
}

export interface IEmailVerificationOtpRepository {
  save(record: EmailVerificationOtpRecord): Promise<void>;
  findByEmail(email: string): Promise<EmailVerificationOtpRecord | null>;
  delete(email: string): Promise<void>;
}

export class FirestoreEmailVerificationOtpRepository implements IEmailVerificationOtpRepository {
  private readonly col = getFirestore().collection('emailVerificationOtps');

  async save(record: EmailVerificationOtpRecord): Promise<void> {
    await this.col.doc(record.email).set(record);
  }

  async findByEmail(email: string): Promise<EmailVerificationOtpRecord | null> {
    const snap = await this.col.doc(email).get();
    if (!snap.exists) return null;
    return snap.data() as EmailVerificationOtpRecord;
  }

  async delete(email: string): Promise<void> {
    await this.col.doc(email).delete();
  }
}
