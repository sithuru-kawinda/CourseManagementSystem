import { CreateRoleRequestUseCase, CreateRoleRequestInput } from '../../../src/application/use-cases/CreateRoleRequestUseCase';
import { IRoleRequestRepository }                          from '../../../src/domain/repositories/IRoleRequestRepository';
import { UserServiceClient }                               from '../../../src/infrastructure/clients/UserServiceClient';
import { RoleRequest }                                     from '../../../src/domain/entities/RoleRequest';
import { OutboxEventPublisher }                            from '@shared/events';

// ─── helpers ────────────────────────────────────────────────────────────────

const makeRepo = (): jest.Mocked<IRoleRequestRepository> => ({
  findById:               jest.fn(),
  findPendingByRequester: jest.fn(),
  findByRequester:        jest.fn(),
  findAll:                jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getUser: jest.fn(), approveUser: jest.fn(), addRole: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const mockProfile = {
  email:              'john@example.com',
  firstName:          'John',
  lastName:           'Doe',
  phoneNumber:        '+94771234567',
  dateOfBirth:        '2000-06-15',
  gender:             'male',
  address:            '123 Main St, Colombo',
  qualificationTitle: 'BSc Computer Science',
  qualificationUrl:   'https://storage.example.com/qual.pdf',
};

const validInput: CreateRoleRequestInput = { requesterUid: 'uid-1', requestedRole: 'student' };

const makePendingRequest = (): RoleRequest =>
  new RoleRequest({
    id: 'req-existing', requesterUid: 'uid-1', requestedRole: 'student',
    status: 'pending', decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z', decidedAt: null,
    applicantProfile: {
      firstName:          'John',
      lastName:           'Doe',
      phoneNumber:        '+94771234567',
      email:              'john@example.com',
      dateOfBirth:        '2000-06-15',
      gender:             'male',
      address:            '123 Main St',
      qualificationTitle: 'BSc',
      qualificationUrl:   null,
    },
    qualificationTitle:       'BSc',
    qualificationStoragePath: null,
  });

// ─── tests ───────────────────────────────────────────────────────────────────

describe('CreateRoleRequestUseCase', () => {
  let repo:       jest.Mocked<IRoleRequestRepository>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    CreateRoleRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    outbox     = makeOutbox();
    userClient = makeUserClient();
    useCase    = new CreateRoleRequestUseCase(repo, outbox, userClient);
  });

  // ── happy path ──────────────────────────────────────────────────────────────

  it('creates a pending role request with profile snapshot from user-service', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput, 'req-id-1');

    expect(result.requesterUid).toBe('uid-1');
    expect(result.requestedRole).toBe('student');
    expect(result.status).toBe('pending');
    expect(result.applicantProfile.firstName).toBe('John');
    expect(result.applicantProfile.lastName).toBe('Doe');
    expect(result.applicantProfile.phoneNumber).toBe('+94771234567');
    expect(result.applicantProfile.email).toBe('john@example.com');
    expect(result.applicantProfile.dateOfBirth).toBe('2000-06-15');
    expect(result.applicantProfile.gender).toBe('male');
    expect(result.applicantProfile.address).toBe('123 Main St, Colombo');
    expect(result.applicantProfile.qualificationTitle).toBe('BSc Computer Science');
    expect(result.applicantProfile.qualificationUrl).toBe('https://storage.example.com/qual.pdf');
    expect(result.qualificationTitle).toBe('BSc Computer Science');
    expect(result.qualificationStoragePath).toBeNull();
  });

  it('sets generated UUID as id', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const r1 = await useCase.execute(validInput, 'x');
    const r2 = await useCase.execute({ ...validInput, requesterUid: 'uid-2' }, 'y');

    expect(r1.id).toBeDefined();
    expect(r1.id).not.toBe(r2.id);
  });

  it('persists to repo and publishes role.requested event', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput, 'req-id-1');

    expect(repo.create).toHaveBeenCalledWith(result);
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'role.requested',
        payload: expect.objectContaining({ requesterUid: 'uid-1', requestedRole: 'student' }),
      }),
    );
  });

  // ── guard: pending duplicate ─────────────────────────────────────────────────

  it('throws 409 ROLE_REQUEST_PENDING when pending request exists', async () => {
    repo.findPendingByRequester.mockResolvedValue(makePendingRequest());

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ROLE_REQUEST_PENDING',
    });

    expect(userClient.getUser).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── guard: user not found ────────────────────────────────────────────────────

  it('throws 404 USER_NOT_FOUND when user-service returns null', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    userClient.getUser.mockResolvedValue(null);

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  // ── repository call verification ─────────────────────────────────────────────

  it('checks for existing pending request using the requester UID', async () => {
    userClient.getUser.mockResolvedValue(mockProfile);
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute({ ...validInput, requesterUid: 'uid-42' }, 'req-x');

    expect(repo.findPendingByRequester).toHaveBeenCalledWith('uid-42');
  });
});
