import { RejectEnrollmentUseCase }  from '../../../src/application/use-cases/RejectEnrollmentUseCase';
import { IEnrollmentRepository }   from '../../../src/domain/repositories/IEnrollmentRepository';
import { OutboxEventPublisher }    from '@shared/events';
import { Enrollment }              from '../../../src/domain/entities/Enrollment';
import { UserServiceClient }       from '../../../src/infrastructure/clients/UserServiceClient';
import { CourseServiceClient }     from '../../../src/infrastructure/clients/CourseServiceClient';

const makeEnrollment = (state: 'pending' | 'approved' | 'rejected' | 'withdrawn' = 'pending'): Enrollment =>
  new Enrollment({
    id: 'uid1_c1', studentUid: 'uid1', courseId: 'c1',
    state, reason: null, rejectedAt: null, approvedAt: null,
    withdrawnAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeRepo = (): jest.Mocked<IEnrollmentRepository> => ({
  findById: jest.fn(), findByStudentAndCourse: jest.fn(), findByStudent: jest.fn(),
  findAll: jest.fn(), create: jest.fn(), update: jest.fn(),
});
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);
const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getUser: jest.fn(), approveUser: jest.fn(), addRole: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);
const makeCourseClient = (): jest.Mocked<CourseServiceClient> =>
  ({ isCoursePublished: jest.fn(), getCourseTitle: jest.fn() } as unknown as jest.Mocked<CourseServiceClient>);

describe('RejectEnrollmentUseCase', () => {
  let repo:         jest.Mocked<IEnrollmentRepository>;
  let outbox:       jest.Mocked<OutboxEventPublisher>;
  let userClient:   jest.Mocked<UserServiceClient>;
  let courseClient: jest.Mocked<CourseServiceClient>;
  let useCase:      RejectEnrollmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo         = makeRepo();
    outbox       = makeOutbox();
    userClient   = makeUserClient();
    courseClient = makeCourseClient();
    useCase      = new RejectEnrollmentUseCase(repo, outbox, userClient, courseClient);

    userClient.getUser.mockResolvedValue({
      email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones',
      phoneNumber: null, dateOfBirth: null, gender: null, address: null,
      qualificationTitle: null, qualificationUrl: null,
    });
    courseClient.getCourseTitle.mockResolvedValue('Bible Foundations');
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('rejects a pending enrollment and sets rejectedAt', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid1_c1', 'Batch is full.', 'req-1');

    expect(result.state).toBe('rejected');
    expect(result.rejectedAt).not.toBeNull();
    expect(result.reason).toBe('Batch is full.');
  });

  it('publishes enrollment.rejected event', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid1_c1', 'Batch is full.', 'req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'enrollment.rejected' }),
    );
  });

  it('outbox payload includes studentUid, courseId, reason, email, names, courseTitle, appUrl', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid1_c1', 'Batch capacity reached.', 'req-rich');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'enrollment.rejected',
        payload: expect.objectContaining({
          studentUid:       'uid1',
          courseId:         'c1',
          reason:           'Batch capacity reached.',
          email:            'bob@example.com',
          studentFirstName: 'Bob',
          studentLastName:  'Jones',
          courseTitle:      'Bible Foundations',
          appUrl:           expect.any(String),
        }),
        requestId: 'req-rich',
      }),
    );
  });

  it('reason is null in payload when not provided', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid1_c1', undefined, 'req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ reason: null }) }),
    );
  });

  it('still rejects when user-service returns null (enrichment is non-blocking)', async () => {
    userClient.getUser.mockResolvedValue(null);
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid1_c1', 'No space.', 'req-1');
    expect(result.state).toBe('rejected');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ email: null }) }),
    );
  });

  it('still rejects when course-service throws (enrichment is non-blocking)', async () => {
    courseClient.getCourseTitle.mockRejectedValue(new Error('course-service down'));
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid1_c1', 'No space.', 'req-1');
    expect(result.state).toBe('rejected');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ courseTitle: null }) }),
    );
  });

  // ── Error cases ────────────────────────────────────────────────────────────

  it('throws 404 when enrollment not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid1_c1', undefined, 'req-1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 INVALID_STATE when enrollment is not PENDING', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('approved'));
    await expect(useCase.execute('uid1_c1', undefined, 'req-1'))
      .rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
