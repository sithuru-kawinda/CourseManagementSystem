import { ApproveRoleRequestUseCase } from '../../../src/application/use-cases/ApproveRoleRequestUseCase';
import { IRoleRequestRepository }    from '../../../src/domain/repositories/IRoleRequestRepository';
import { UserServiceClient }         from '../../../src/infrastructure/clients/UserServiceClient';
import { RoleRequest }               from '../../../src/domain/entities/RoleRequest';
import { OutboxEventPublisher }      from '@shared/events';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:              jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:       jest.fn(),
  findAll:               jest.fn(),
  create:                jest.fn(),
  update:                jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ approveUser: jest.fn(), addRole: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeRequest = (status: 'pending' | 'approved' | 'rejected' = 'pending'): RoleRequest =>
  new RoleRequest({
    id: 'req-1', requesterUid: 'uid-1', requestedRole: 'student',
    status, decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z', decidedAt: null,
    applicantProfile: {
      firstName: 'John', lastName: 'Doe', phoneNumber: '+94771234567',
      email: 'john@example.com', dateOfBirth: '2000-06-15',
      gender: 'male', address: '123 Main St',
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: 'qualifications/uid-1/req-1.pdf',
  });

describe('ApproveRoleRequestUseCase', () => {
  let repo:       jest.Mocked<IRoleRequestRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    ApproveRoleRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    outbox     = makeOutbox();
    useCase    = new ApproveRoleRequestUseCase(repo, userClient, outbox);
  });

  it('approves request, grants role on user-service, and publishes role.granted event', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('req-1', 'admin-uid', 'Welcome!', 'http-req-1');

    expect(result.status).toBe('approved');
    expect(result.decidedByUid).toBe('admin-uid');
    expect(result.decisionNote).toBe('Welcome!');
    expect(result.decidedAt).not.toBeNull();
    expect(userClient.addRole).toHaveBeenCalledWith('uid-1', 'student');
    expect(repo.update).toHaveBeenCalledWith(result);
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'role.granted',
        payload: expect.objectContaining({ requesterUid: 'uid-1', role: 'student', decidedByUid: 'admin-uid' }),
      }),
    );
  });

  it('approves without a note — decisionNote is null', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('req-1', 'admin-uid', undefined, 'http-req-1');

    expect(result.status).toBe('approved');
    expect(result.decisionNote).toBeNull();
  });

  it('throws 404 ROLE_REQUEST_NOT_FOUND when request does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('req-missing', 'admin-uid', undefined, 'req-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ROLE_REQUEST_NOT_FOUND',
    });
    expect(userClient.addRole).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 409 INVALID_STATE when request is already approved', async () => {
    repo.findById.mockResolvedValue(makeRequest('approved'));

    await expect(useCase.execute('req-1', 'admin-uid', undefined, 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
    expect(userClient.addRole).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 409 INVALID_STATE when request is already rejected', async () => {
    repo.findById.mockResolvedValue(makeRequest('rejected'));

    await expect(useCase.execute('req-1', 'admin-uid', undefined, 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
    expect(userClient.addRole).not.toHaveBeenCalled();
  });

  it('does not persist or publish if user-service addRole fails', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockRejectedValue(new Error('user-service down'));

    await expect(useCase.execute('req-1', 'admin-uid', undefined, 'req-1')).rejects.toThrow('user-service down');
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });
});
