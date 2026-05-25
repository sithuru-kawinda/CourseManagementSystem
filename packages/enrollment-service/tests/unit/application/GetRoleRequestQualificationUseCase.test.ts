import { GetRoleRequestQualificationUseCase } from '../../../src/application/use-cases/GetRoleRequestQualificationUseCase';
import { IRoleRequestRepository }             from '../../../src/domain/repositories/IRoleRequestRepository';
import { QualificationStorageRepository }     from '../../../src/infrastructure/repositories/QualificationStorageRepository';
import { RoleRequest }                        from '../../../src/domain/entities/RoleRequest';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:               jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:        jest.fn(),
  findAll:                jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
});

const makeStorage = (): jest.Mocked<QualificationStorageRepository> => ({
  upload:       jest.fn(),
  getSignedUrl: jest.fn(),
  delete:       jest.fn(),
} as unknown as jest.Mocked<QualificationStorageRepository>);

const makeRoleRequest = (): RoleRequest =>
  new RoleRequest({
    id: 'req-1', requesterUid: 'uid-1', requestedRole: 'student',
    status: 'pending', decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z', decidedAt: null,
    applicantProfile: {
      firstName: 'John', lastName: 'Doe', phoneNumber: '+94771234567',
      email: 'john@example.com', dateOfBirth: '2000-06-15',
      gender: 'male', address: '123 Main St',
      qualificationTitle: null, qualificationUrl: null,
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: 'qualifications/uid-1/req-1.pdf',
  });

describe('GetRoleRequestQualificationUseCase', () => {
  let repo:    jest.Mocked<IRoleRequestRepository>;
  let storage: jest.Mocked<QualificationStorageRepository>;
  let useCase: GetRoleRequestQualificationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    storage = makeStorage();
    useCase = new GetRoleRequestQualificationUseCase(repo, storage);
  });

  it('returns a signed URL, expiry, and qualification title for a valid request', async () => {
    repo.findById.mockResolvedValue(makeRoleRequest());
    storage.getSignedUrl.mockResolvedValue('https://storage.googleapis.com/signed-url');

    const result = await useCase.execute('req-1');

    expect(result.signedUrl).toBe('https://storage.googleapis.com/signed-url');
    expect(result.qualificationTitle).toBe('BSc Computer Science');
    expect(result.expiresAt).toBeDefined();
  });

  it('requests a 15-minute signed URL from storage', async () => {
    repo.findById.mockResolvedValue(makeRoleRequest());
    storage.getSignedUrl.mockResolvedValue('https://storage.googleapis.com/signed');

    await useCase.execute('req-1');

    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'qualifications/uid-1/req-1.pdf',
      15 * 60 * 1000,
    );
  });

  it('sets expiresAt ~15 minutes in the future', async () => {
    repo.findById.mockResolvedValue(makeRoleRequest());
    storage.getSignedUrl.mockResolvedValue('https://storage.googleapis.com/signed');

    const before = Date.now();
    const result = await useCase.execute('req-1');
    const after  = Date.now();

    const expiresMs = new Date(result.expiresAt).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after  + 16 * 60 * 1000);
  });

  it('throws 404 ROLE_REQUEST_NOT_FOUND when request does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ROLE_REQUEST_NOT_FOUND',
    });

    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });

  it('looks up the request by the provided id', async () => {
    repo.findById.mockResolvedValue(makeRoleRequest());
    storage.getSignedUrl.mockResolvedValue('https://url');

    await useCase.execute('req-abc');

    expect(repo.findById).toHaveBeenCalledWith('req-abc');
  });
});
