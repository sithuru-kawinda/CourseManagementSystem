import { UploadAvatarUseCase, UploadAvatarInput } from '../../../src/application/use-cases/UploadAvatarUseCase';
import { IUserRepository }                        from '../../../src/domain/repositories/IUserRepository';
import { User }                                   from '../../../src/domain/entities/User';

// ── Firebase Storage mock ─────────────────────────────────────────────────────
const mockFile   = { save: jest.fn() };
const mockBucket = { file: jest.fn().mockReturnValue(mockFile) };
const mockGetStorage = jest.fn().mockReturnValue({ bucket: jest.fn().mockReturnValue(mockBucket) });

jest.mock('firebase-admin/storage', () => ({ getStorage: () => mockGetStorage() }));
jest.mock('../../../src/config', () => ({ config: { storageBucket: 'test-bucket.appspot.com' } }));

// ── helpers ───────────────────────────────────────────────────────────────────
const makeUser = (overrides: Partial<InstanceType<typeof User>> = {}): User =>
  new User({
    uid: 'uid-1', email: 'student@example.com', firstName: 'Viruli',
    lastName: 'W', role: 'student', roles: ['student'], status: 'approved',
    profilePhotoUrl: null,
    createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null,
    ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

const PNG_BUF  = Buffer.from('png-bytes');
const JPEG_BUF = Buffer.from('jpg-bytes');

const pngInput  = (uid = 'uid-1'): UploadAvatarInput => ({ uid, buffer: PNG_BUF,  mimeType: 'image/png'  });
const jpegInput = (uid = 'uid-1'): UploadAvatarInput => ({ uid, buffer: JPEG_BUF, mimeType: 'image/jpeg' });

// Firebase Storage download URL prefix for assertions
const FB_URL_PREFIX = 'https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/';

describe('UploadAvatarUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: UploadAvatarUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFile.save.mockResolvedValue(undefined);
    repo    = makeRepo();
    useCase = new UploadAvatarUseCase(repo);
  });

  describe('happy path', () => {
    it('uploads a PNG with download token metadata and returns a browser-loadable URL', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(undefined);

      const user = await useCase.execute(pngInput());

      // save() must include the download token in custom metadata (no makePublic call)
      expect(mockFile.save).toHaveBeenCalledWith(
        PNG_BUF,
        expect.objectContaining({
          contentType: 'image/png',
          metadata: {
            metadata: { firebaseStorageDownloadTokens: expect.stringMatching(/^[0-9a-f-]{36}$/) },
          },
        }),
      );

      // URL must be a Firebase Storage download URL (not a raw GCS URL)
      expect(user.profilePhotoUrl).toMatch(
        new RegExp(`^${FB_URL_PREFIX}avatars%2Fuid-1\\.png\\?alt=media&token=[0-9a-f-]{36}$`),
      );
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ profilePhotoUrl: user.profilePhotoUrl }),
      );
    });

    it('uploads a JPEG and uses .jpg extension in the URL', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(undefined);

      const user = await useCase.execute(jpegInput());

      expect(user.profilePhotoUrl).toMatch(
        new RegExp(`^${FB_URL_PREFIX}avatars%2Fuid-1\\.jpg\\?alt=media&token=[0-9a-f-]{36}$`),
      );
    });

    it('overwrites the previous photo (same file path per user)', async () => {
      repo.findById.mockResolvedValue(makeUser({ profilePhotoUrl: 'https://old-url.com/old.png' }));
      repo.update.mockResolvedValue(undefined);

      const user = await useCase.execute(pngInput());

      expect(mockBucket.file).toHaveBeenCalledWith('avatars/uid-1.png');
      expect(user.profilePhotoUrl).toContain('uid-1.png');
    });

    it('stores file under avatars/{uid}.{ext} path', async () => {
      repo.findById.mockResolvedValue(makeUser({ uid: 'special-uid' }));
      repo.update.mockResolvedValue(undefined);

      await useCase.execute(pngInput('special-uid'));

      expect(mockBucket.file).toHaveBeenCalledWith('avatars/special-uid.png');
    });
  });

  describe('error cases', () => {
    it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(useCase.execute(pngInput())).rejects.toMatchObject({
        status: 404, errorCode: 'USER_NOT_FOUND',
      });
      expect(mockFile.save).not.toHaveBeenCalled();
    });

    it('propagates storage save errors without updating the user', async () => {
      repo.findById.mockResolvedValue(makeUser());
      mockFile.save.mockRejectedValue(new Error('Storage unavailable'));

      await expect(useCase.execute(pngInput())).rejects.toThrow('Storage unavailable');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
