import { ResendVerificationUseCase }        from '../../../src/application/use-cases/ResendVerificationUseCase';
import { EmailClient }                       from '../../../src/infrastructure/clients/EmailClient';
import { IEmailVerificationOtpRepository }   from '../../../src/infrastructure/repositories/FirestoreEmailVerificationOtpRepository';

// ─── Firebase Auth mock ──────────────────────────────────────────────────────

const authMock = { getUserByEmail: jest.fn() };
jest.mock('firebase-admin/auth', () => ({ getAuth: () => authMock }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeEmailClient = (): jest.Mocked<EmailClient> =>
  ({ sendVerificationEmail: jest.fn() } as unknown as jest.Mocked<EmailClient>);

const makeOtpRepo = (): jest.Mocked<IEmailVerificationOtpRepository> =>
  ({ save: jest.fn(), findByEmail: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<IEmailVerificationOtpRepository>);

const verifiedUser   = { emailVerified: true,  displayName: 'Viruli Wijesinghe', uid: 'uid-v' };
const unverifiedUser = { emailVerified: false, displayName: 'Kasun Perera',      uid: 'uid-k' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ResendVerificationUseCase', () => {
  let emailClient: jest.Mocked<EmailClient>;
  let otpRepo:     jest.Mocked<IEmailVerificationOtpRepository>;
  let useCase:     ResendVerificationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    emailClient = makeEmailClient();
    otpRepo     = makeOtpRepo();
    otpRepo.save.mockResolvedValue(undefined);
    emailClient.sendVerificationEmail.mockResolvedValue(undefined);
    useCase = new ResendVerificationUseCase(otpRepo, emailClient);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('generates a new OTP, saves it, and sends a verification email to an unverified user', async () => {
      authMock.getUserByEmail.mockResolvedValue(unverifiedUser);

      await useCase.execute('kasun@example.com');

      expect(otpRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'kasun@example.com',
          uid:   'uid-k',
          otp:   expect.stringMatching(/^\d{6}$/),
        }),
      );
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'kasun@example.com',
        expect.stringMatching(/^\d{6}$/),  // 6-digit OTP
        'Kasun',                            // first name from displayName
        expect.any(String),                 // expiresAt ISO string
      );
    });

    it('extracts first name correctly from multi-word displayName', async () => {
      authMock.getUserByEmail.mockResolvedValue(
        { emailVerified: false, displayName: 'Chamara Silva Fernando', uid: 'uid-c' },
      );

      await useCase.execute('chamara@example.com');

      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'Chamara',
        expect.any(String),
      );
    });

    it('uses "there" as first name fallback when displayName is empty', async () => {
      authMock.getUserByEmail.mockResolvedValue({ emailVerified: false, displayName: '', uid: 'uid-n' });

      await useCase.execute('noname@example.com');

      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'there',
        expect.any(String),
      );
    });

    it('overwrites any existing OTP for the same email (fresh OTP each resend)', async () => {
      authMock.getUserByEmail.mockResolvedValue(unverifiedUser);

      await useCase.execute('kasun@example.com');

      // save() called once — overwrites whatever was in the collection
      expect(otpRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── 400 — already verified ──────────────────────────────────────────────────

  describe('execute — already verified', () => {
    it('throws 400 EMAIL_ALREADY_VERIFIED when user email is already verified', async () => {
      authMock.getUserByEmail.mockResolvedValue(verifiedUser);

      await expect(useCase.execute('viruli@example.com')).rejects.toMatchObject({
        status:    400,
        errorCode: 'EMAIL_ALREADY_VERIFIED',
      });
    });

    it('does not send email when user is already verified', async () => {
      authMock.getUserByEmail.mockResolvedValue(verifiedUser);

      await expect(useCase.execute('viruli@example.com')).rejects.toThrow();

      expect(emailClient.sendVerificationEmail).not.toHaveBeenCalled();
      expect(otpRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── User not found — silent return (no enumeration) ────────────────────────

  describe('execute — user not found', () => {
    it('returns silently without error when user does not exist (prevents enumeration)', async () => {
      const notFoundError = Object.assign(new Error('user not found'), { code: 'auth/user-not-found' });
      authMock.getUserByEmail.mockRejectedValue(notFoundError);

      await expect(useCase.execute('ghost@example.com')).resolves.toBeUndefined();
    });

    it('does not send email or save OTP when user is not found', async () => {
      const notFoundError = Object.assign(new Error('user not found'), { code: 'auth/user-not-found' });
      authMock.getUserByEmail.mockRejectedValue(notFoundError);

      await useCase.execute('ghost@example.com');

      expect(emailClient.sendVerificationEmail).not.toHaveBeenCalled();
      expect(otpRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Firebase errors re-thrown ───────────────────────────────────────────────

  describe('execute — Firebase errors', () => {
    it('re-throws unexpected Firebase errors from getUserByEmail', async () => {
      authMock.getUserByEmail.mockRejectedValue(new Error('Firebase quota exceeded'));

      await expect(useCase.execute('user@example.com')).rejects.toThrow('Firebase quota exceeded');
    });

    it('re-throws errors from otpRepo.save', async () => {
      authMock.getUserByEmail.mockResolvedValue(unverifiedUser);
      otpRepo.save.mockRejectedValue(new Error('Firestore write error'));

      await expect(useCase.execute('kasun@example.com')).rejects.toThrow('Firestore write error');
    });
  });
});
