import { GetRoleRequestsUseCase }    from '../../../src/application/use-cases/GetRoleRequestsUseCase';
import { IRoleRequestRepository,
         RoleRequestListOptions }    from '../../../src/domain/repositories/IRoleRequestRepository';
import { RoleRequest }              from '../../../src/domain/entities/RoleRequest';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:              jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:       jest.fn(),
  findAll:               jest.fn(),
  create:                jest.fn(),
  update:                jest.fn(),
});

const makeRequest = (id: string, status: 'pending' | 'approved' | 'rejected' = 'pending'): RoleRequest =>
  new RoleRequest({
    id, requesterUid: `uid-${id}`, requestedRole: 'student',
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

describe('GetRoleRequestsUseCase', () => {
  let repo:    jest.Mocked<IRoleRequestRepository>;
  let useCase: GetRoleRequestsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetRoleRequestsUseCase(repo);
  });

  it('returns paginated list from repository', async () => {
    const items = [makeRequest('req-1'), makeRequest('req-2')];
    repo.findAll.mockResolvedValue({ items, nextCursor: null, total: 2 });

    const opts: RoleRequestListOptions = { limit: 20 };
    const result = await useCase.execute(opts);

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.nextCursor).toBeNull();
    expect(repo.findAll).toHaveBeenCalledWith(opts);
  });

  it('passes status filter to repository', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    const opts: RoleRequestListOptions = { limit: 10, status: 'pending' };
    await useCase.execute(opts);

    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });

  it('passes cursor for pagination', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    const opts: RoleRequestListOptions = { limit: 10, cursor: 'cursor-abc' };
    await useCase.execute(opts);

    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor-abc' }));
  });

  it('returns empty items and null cursor when no requests exist', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    const result = await useCase.execute({ limit: 20 });

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
    expect(result.total).toBe(0);
  });

  it('returns nextCursor when more pages exist', async () => {
    const items = [makeRequest('req-1')];
    repo.findAll.mockResolvedValue({ items, nextCursor: 'next-page-cursor', total: 10 });

    const result = await useCase.execute({ limit: 1 });

    expect(result.nextCursor).toBe('next-page-cursor');
  });
});
