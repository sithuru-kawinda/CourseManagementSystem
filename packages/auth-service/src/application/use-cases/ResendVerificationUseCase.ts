import { getAuth }          from 'firebase-admin/auth';
import { createHttpError }  from '@shared/errors';
import { logger }           from '@shared/logger';
import { EmailClient }      from '../../infrastructure/clients/EmailClient';
import { IEmailVerificationOtpRepository } from '../../infrastructure/repositories/FirestoreEmailVerificationOtpRepository';

const OTP_TTL_MINUTES = 15;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class ResendVerificationUseCase {
  constructor(
    private readonly otpRepo:     IEmailVerificationOtpRepository,
    private readonly emailClient: EmailClient,
  ) {}

  async execute(email: string): Promise<void> {
    // Look up the user — return silently if not found to prevent email enumeration
    let emailVerified: boolean;
    let uid: string;
    let displayName: string;

    try {
      const user    = await getAuth().getUserByEmail(email);
      emailVerified = user.emailVerified;
      uid           = user.uid;
      displayName   = user.displayName ?? '';
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') {
        logger.info({ email }, 'ResendVerification: user not found — silent return');
        return; // No enumeration — always return 204 to the caller
      }
      throw err;
    }

    if (emailVerified) {
      throw createHttpError(400, 'EMAIL_ALREADY_VERIFIED', 'This email address is already verified.');
    }

    // Generate a fresh 6-digit OTP — overwrite any existing one
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    await this.otpRepo.save({ email, uid, otp, expiresAt, attempts: 0 });

    const firstName = displayName.split(' ')[0] || 'there';
    await this.emailClient.sendVerificationEmail(email, otp, firstName, expiresAt);
  }
}
