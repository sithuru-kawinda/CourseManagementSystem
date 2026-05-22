import { CreateRoleRequestUseCase, CreateRoleRequestInput } from '../../../src/application/use-cases/CreateRoleRequestUseCase';
import { IRoleRequestRepository }                          from '../../../src/domain/repositories/IRoleRequestRepository';
import { RoleRequest }                                     from '../../../src/domain/entities/RoleRequest';
import { QualificationStorageRepository }                  from '../../../src/infrastructure/repositories/QualificationStorageRepository';
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

const makeStorage = (): jest.Mocked<QualificationStorageRepository> => ({
  upload:       jest.fn(),
  getSignedUrl: jest.fn(),
  delete:       jest.fn(),
} as unknown as jest.Mocked<QualificationStorageRepository>);

const validInput: CreateRoleRequestInput = {
  requesterUid:       'uid-1',
  requestedRole:      'student',
  firstName:          'John',
  lastName:           'Doe',
  phoneNumber:        '+94771234567',
  email:              'john@example.com',
  dateOfBirth:        '2000-06-15',
  gender:             'male',
  address:            '123 Main St, Colombo',
  qualificationTitle: 'BSc Computer Science',
  qualificationFile:  { buffer: Buffer.from('pdf-content'), mimeType: 'application/pdf' },
};

const makePendingRequest = (): RoleRequest =>
  new RoleRequest({
    id: 'req-existing', requesterUid: 'uid-1', requestedRole: 'student',
    status: 'pending', decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z', decidedAt: null,
    applicantProfile: {
      firstName: 'John', lastName: 'Doe', phoneNumber: '+94771234567',
      email: 'john@example.com', dateOfBirth: '2000-06-15',
      gender: 'male', address: '123 Main St',
    },
    qualificationTitle:       'BSc',
    qualificationStoragePath: 'qualifications/uid-1/req-existing.pdf',
  });

// ─── tests ───────────────────────────────────────────────────────────────────

describe('CreateRoleRequestUseCase', () => {
  let repo:    jest.Mocked<IRoleRequestRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let storage: jest.Mocked<QualificationStorageRepository>;
  let useCase: CreateRoleRequestUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    storage = makeStorage();
    useCase = new CreateRoleRequestUseCase(repo, outbox, storage);
  });

  // ── happy path ──────────────────────────────────────────────────────────────

  it('creates a pending role request with all applicant profile fields', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);

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
    expect(result.qualificationTitle).toBe('BSc Computer Science');
  });

  it('sets a generated UUID as the id', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);

    const r1 = await useCase.execute(validInput, 'x');
    const r2 = await useCase.execute({ ...validInput, requesterUid: 'uid-2' }, 'y');

    expect(r1.id).toBeDefined();
    expect(r1.id).not.toBe(r2.id);
  });

  it('uploads qualification file to qualifications/{uid}/{id}.pdf', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput, 'req-id-1');

    expect(storage.upload).toHaveBeenCalledWith(
      validInput.qualificationFile.buffer,
      `qualifications/${validInput.requesterUid}/${result.id}.pdf`,
    );
    expect(result.qualificationStoragePath).toBe(
      `qualifications/${validInput.requesterUid}/${result.id}.pdf`,
    );
  });

  it('uploads file before writing to Firestore', async () => {
    const callOrder: string[] = [];
    repo.findPendingByRequester.mockResolvedValue(null);
    storage.upload.mockImplementation(async () => { callOrder.push('storage'); });
    repo.create.mockImplementation(async () => { callOrder.push('firestore'); });
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute(validInput, 'req-id-1');

    expect(callOrder).toEqual(['storage', 'firestore']);
  });

  it('persists to repo and publishes role.requested event', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);

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

  it('throws 409 ROLE_REQUEST_PENDING when a pending request already exists', async () => {
    repo.findPendingByRequester.mockResolvedValue(makePendingRequest());

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ROLE_REQUEST_PENDING',
    });

    expect(storage.upload).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  it('checks for existing pending request using the requester UID', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);

    await useCase.execute({ ...validInput, requesterUid: 'uid-42' }, 'req-x');

    expect(repo.findPendingByRequester).toHaveBeenCalledWith('uid-42');
  });

  // ── rollback on Firestore failure ────────────────────────────────────────────

  it('deletes the uploaded file if Firestore write fails', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    storage.upload.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    repo.create.mockRejectedValue(new Error('Firestore unavailable'));
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toThrow('Firestore unavailable');

    expect(storage.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^qualifications\/uid-1\//),
    );
  });

  it('still re-throws Firestore error even if storage delete also fails', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    storage.upload.mockResolvedValue(undefined);
    storage.delete.mockRejectedValue(new Error('Storage delete failed'));
    repo.create.mockRejectedValue(new Error('Firestore unavailable'));
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toThrow('Firestore unavailable');
  });

  it('does not call outbox if Firestore write fails', async () => {
    repo.findPendingByRequester.mockResolvedValue(null);
    storage.upload.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    repo.create.mockRejectedValue(new Error('Firestore unavailable'));

    await expect(useCase.execute(validInput, 'req-id-1')).rejects.toThrow();

    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });
});
