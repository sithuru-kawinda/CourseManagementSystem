import { GetMyRoleRequestsUseCase } from '../../../src/application/use-cases/GetMyRoleRequestsUseCase';
import { IRoleRequestRepository }   from '../../../src/domain/repositories/IRoleRequestRepository';
import { RoleRequest }             from '../../../src/domain/entities/RoleRequest';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:              jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:       jest.fn(),
  findAll:               jest.fn(),
  create:                jest.fn(),
  update:                jest.fn(),
});

const makeRequest = (status: 'pending' | 'approved' | 'rejected' = 'pending'): RoleRequest =>
  new RoleRequest({
    id: 'req-1', requesterUid: 'uid-1', requestedRole: 'student',
    status, decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z', decidedAt: null,
    applicantProfile: {
      firstName: 'John', lastName: 'Doe', phoneNumber: '+94771234567',
      email: 'john@example.com', dateOfBirth: '2000-06-15',
      gender: 'male', address: '123 Main St',
      qualificationTitle: null, qualificationUrl: null,
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: null,
  });

describe('GetMyRoleRequestsUseCase', () => {
  let repo:    jest.Mocked<IRoleRequestRepository>;
  let useCase: GetMyRoleRequestsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMyRoleRequestsUseCase(repo);
  });

  it('returns all role requests for the given user', async () => {
    repo.findByRequester.mockResolvedValue([makeRequest('pending'), makeRequest('approved')]);

    const result = await useCase.execute('uid-1');

    expect(result).toHaveLength(2);
    expect(result[0].requesterUid).toBe('uid-1');
    expect(repo.findByRequester).toHaveBeenCalledWith('uid-1');
  });

  it('returns empty array when user has no requests', async () => {
    repo.findByRequester.mockResolvedValue([]);

    const result = await useCase.execute('uid-no-requests');

    expect(result).toHaveLength(0);
    expect(repo.findByRequester).toHaveBeenCalledWith('uid-no-requests');
  });

  it('queries by the correct requesterUid', async () => {
    repo.findByRequester.mockResolvedValue([]);

    await useCase.execute('uid-specific-99');

    expect(repo.findByRequester).toHaveBeenCalledWith('uid-specific-99');
  });

  it('returns requests across all statuses', async () => {
    const requests = [
      makeRequest('pending'),
      makeRequest('approved'),
      makeRequest('rejected'),
    ];
    repo.findByRequester.mockResolvedValue(requests);

    const result = await useCase.execute('uid-1');

    expect(result.map(r => r.status)).toEqual(['pending', 'approved', 'rejected']);
  });
});
