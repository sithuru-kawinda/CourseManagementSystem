import { VerifyEmailOtpUseCase }          from '../../../src/application/use-cases/VerifyEmailOtpUseCase';
import { IEmailVerificationOtpRepository } from '../../../src/infrastructure/repositories/FirestoreEmailVerificationOtpRepository';

// ─── Firebase Auth mock ──────────────────────────────────────────────────────

const authMock = { updateUser: jest.fn() };
jest.mock('firebase-admin/auth', () => ({ getAuth: () => authMock }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeOtpRepo = (): jest.Mocked<IEmailVerificationOtpRepository> =>
  ({ save: jest.fn(), findByEmail: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<IEmailVerificationOtpRepository>);

const VALID_RECORD = {
  email:     'user@example.com',
  uid:       'uid-abc',
  otp:       '123456',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min from now
  attempts:  0,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VerifyEmailOtpUseCase', () => {
  let otpRepo: jest.Mocked<IEmailVerificationOtpRepository>;
  let useCase: VerifyEmailOtpUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    otpRepo = makeOtpRepo();
    useCase = new VerifyEmailOtpUseCase(otpRepo);
    authMock.updateUser.mockResolvedValue(undefined);
    otpRepo.delete.mockResolvedValue(undefined);
    otpRepo.save.mockResolvedValue(undefined);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('verifies email and sets emailVerified=true in Firebase Auth on correct OTP', async () => {
    otpRepo.findByEmail.mockResolvedValue(VALID_RECORD);

    await useCase.execute('user@example.com', '123456');

    expect(authMock.updateUser).toHaveBeenCalledWith('uid-abc', { emailVerified: true });
  });

  it('deletes the OTP record after successful verification', async () => {
    otpRepo.findByEmail.mockResolvedValue(VALID_RECORD);

    await useCase.execute('user@example.com', '123456');

    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
  });

  it('returns void (204 pattern) on success', async () => {
    otpRepo.findByEmail.mockResolvedValue(VALID_RECORD);

    const result = await useCase.execute('user@example.com', '123456');

    expect(result).toBeUndefined();
  });

  // ── 400 — OTP not found ────────────────────────────────────────────────────

  it('throws 400 INVALID_OTP when no record exists for the email', async () => {
    otpRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute('user@example.com', '123456'))
      .rejects.toMatchObject({ status: 400, errorCode: 'INVALID_OTP' });
  });

  it('does not call Firebase Auth when OTP record is not found', async () => {
    otpRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute('user@example.com', '123456')).rejects.toThrow();

    expect(authMock.updateUser).not.toHaveBeenCalled();
  });

  // ── 400 — OTP expired ─────────────────────────────────────────────────────

  it('throws 400 OTP_EXPIRED when record is past its expiresAt', async () => {
    const expiredRecord = {
      ...VALID_RECORD,
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    };
    otpRepo.findByEmail.mockResolvedValue(expiredRecord);

    await expect(useCase.execute('user@example.com', '123456'))
      .rejects.toMatchObject({ status: 400, errorCode: 'OTP_EXPIRED' });
  });

  it('deletes the expired OTP record', async () => {
    const expiredRecord = { ...VALID_RECORD, expiresAt: new Date(Date.now() - 1000).toISOString() };
    otpRepo.findByEmail.mockResolvedValue(expiredRecord);

    await expect(useCase.execute('user@example.com', '123456')).rejects.toThrow();

    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
  });

  // ── 400 — too many attempts ────────────────────────────────────────────────

  it('throws 400 OTP_MAX_ATTEMPTS when attempts >= 5', async () => {
    const maxedRecord = { ...VALID_RECORD, attempts: 5 };
    otpRepo.findByEmail.mockResolvedValue(maxedRecord);

    await expect(useCase.execute('user@example.com', '123456'))
      .rejects.toMatchObject({ status: 400, errorCode: 'OTP_MAX_ATTEMPTS' });
  });

  it('deletes the OTP record when max attempts is reached', async () => {
    const maxedRecord = { ...VALID_RECORD, attempts: 5 };
    otpRepo.findByEmail.mockResolvedValue(maxedRecord);

    await expect(useCase.execute('user@example.com', 'wrong')).rejects.toThrow();

    expect(otpRepo.delete).toHaveBeenCalledWith('user@example.com');
  });

  // ── 400 — wrong OTP ───────────────────────────────────────────────────────

  it('throws 400 INVALID_OTP with remaining attempts when OTP is wrong', async () => {
    otpRepo.findByEmail.mockResolvedValue({ ...VALID_RECORD, attempts: 2 });

    const err: any = await useCase.execute('user@example.com', 'wrong').catch(e => e);

    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('INVALID_OTP');
    expect(err.message).toMatch(/2 attempts remaining/);
  });

  it('increments the attempts counter on wrong OTP', async () => {
    otpRepo.findByEmail.mockResolvedValue({ ...VALID_RECORD, attempts: 1 });

    await expect(useCase.execute('user@example.com', 'wrong')).rejects.toThrow();

    expect(otpRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 2 }),
    );
  });

  it('shows "1 attempt remaining" with correct grammar when 1 left', async () => {
    otpRepo.findByEmail.mockResolvedValue({ ...VALID_RECORD, attempts: 3 });

    const err: any = await useCase.execute('user@example.com', 'wrong').catch(e => e);

    expect(err.message).toMatch(/1 attempt remaining/);
  });

  it('does not call Firebase Auth on wrong OTP', async () => {
    otpRepo.findByEmail.mockResolvedValue(VALID_RECORD);

    await expect(useCase.execute('user@example.com', 'wrong')).rejects.toThrow();

    expect(authMock.updateUser).not.toHaveBeenCalled();
  });
});
