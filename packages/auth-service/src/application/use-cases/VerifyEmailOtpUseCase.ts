import { getAuth }             from 'firebase-admin/auth';
import { createHttpError }     from '@shared/errors';
import { IEmailVerificationOtpRepository } from '../../infrastructure/repositories/FirestoreEmailVerificationOtpRepository';

const MAX_ATTEMPTS = 5;

export class VerifyEmailOtpUseCase {
  constructor(
    private readonly otpRepo: IEmailVerificationOtpRepository,
  ) {}

  async execute(email: string, otp: string): Promise<void> {
    const record = await this.otpRepo.findByEmail(email);

    if (!record) {
      throw createHttpError(400, 'INVALID_OTP', 'Invalid or expired verification code.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      await this.otpRepo.delete(email);
      throw createHttpError(400, 'OTP_EXPIRED', 'Verification code has expired. Please request a new one via POST /auth/resend-verification.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.otpRepo.delete(email);
      throw createHttpError(400, 'OTP_MAX_ATTEMPTS', 'Too many incorrect attempts. Please request a new code via POST /auth/resend-verification.');
    }

    if (record.otp !== otp) {
      await this.otpRepo.save({ ...record, attempts: record.attempts + 1 });
      const remaining = MAX_ATTEMPTS - record.attempts - 1;
      throw createHttpError(
        400,
        'INVALID_OTP',
        `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // OTP is valid — mark email as verified in Firebase Auth and delete the OTP
    await getAuth().updateUser(record.uid, { emailVerified: true });
    await this.otpRepo.delete(email);
  }
}
