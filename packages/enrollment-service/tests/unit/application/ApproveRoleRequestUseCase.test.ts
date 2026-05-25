import { ApproveRoleRequestUseCase } from '../../../src/application/use-cases/ApproveRoleRequestUseCase';
import { IRoleRequestRepository }    from '../../../src/domain/repositories/IRoleRequestRepository';
import { UserServiceClient }         from '../../../src/infrastructure/clients/UserServiceClient';
import { RoleRequest }               from '../../../src/domain/entities/RoleRequest';
import { OutboxEventPublisher }      from '@shared/events';

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:               jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:        jest.fn(),
  findAll:                jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ approveUser: jest.fn(), addRole: jest.fn(), getUser: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

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
      qualificationTitle: null, qualificationUrl: null,
    },
    qualificationTitle:       'BSc Computer Science',
    qualificationStoragePath: null,
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

    // Default: user-service returns student profile
    userClient.getUser.mockResolvedValue({
      email: 'john@example.com', firstName: 'John', lastName: 'Doe',
      phoneNumber: null, dateOfBirth: null, gender: null, address: null,
      qualificationTitle: null, qualificationUrl: null,
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

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
  });

  it('outbox payload includes enriched student data, note, and appUrl', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('req-1', 'admin-uid', 'Congratulations!', 'http-req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'role.granted',
        payload: expect.objectContaining({
          requesterUid:     'uid-1',
          role:             'student',
          decidedByUid:     'admin-uid',
          email:            'john@example.com',
          studentFirstName: 'John',
          studentLastName:  'Doe',
          note:             'Congratulations!',
          appUrl:           expect.any(String),
        }),
      }),
    );
  });

  it('note is undefined in payload when not provided', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('req-1', 'admin-uid', undefined, 'http-req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ note: undefined }) }),
    );
  });

  it('still approves when getUser returns null (enrichment is non-blocking)', async () => {
    userClient.getUser.mockResolvedValue(null);
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('req-1', 'admin-uid', undefined, 'req-1');
    expect(result.status).toBe('approved');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ email: undefined }) }),
    );
  });

  it('still approves when getUser throws (enrichment is non-blocking)', async () => {
    userClient.getUser.mockRejectedValue(new Error('user-service down'));
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('req-1', 'admin-uid', undefined, 'req-1');
    expect(result.status).toBe('approved');
  });

  it('approves without a note — decisionNote is null', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('req-1', 'admin-uid', undefined, 'http-req-1');
    expect(result.decisionNote).toBeNull();
  });

  // ── Error cases ────────────────────────────────────────────────────────────

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
  });

  it('throws 409 INVALID_STATE when request is already rejected', async () => {
    repo.findById.mockResolvedValue(makeRequest('rejected'));

    await expect(useCase.execute('req-1', 'admin-uid', undefined, 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
  });

  it('does not persist or publish if addRole fails (role grant is blocking)', async () => {
    repo.findById.mockResolvedValue(makeRequest('pending'));
    userClient.addRole.mockRejectedValue(new Error('user-service down'));

    await expect(useCase.execute('req-1', 'admin-uid', undefined, 'req-1')).rejects.toThrow('user-service down');
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });
});
