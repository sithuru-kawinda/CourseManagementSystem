import { ApproveEnrollmentUseCase } from '../../../src/application/use-cases/ApproveEnrollmentUseCase';
import { IEnrollmentRepository }   from '../../../src/domain/repositories/IEnrollmentRepository';
import { OutboxEventPublisher }    from '@shared/events';
import { Enrollment }              from '../../../src/domain/entities/Enrollment';
import { UserServiceClient }       from '../../../src/infrastructure/clients/UserServiceClient';
import { CourseServiceClient }     from '../../../src/infrastructure/clients/CourseServiceClient';

const makeEnrollment = (state: 'pending' | 'approved' | 'rejected' | 'withdrawn' = 'pending'): Enrollment =>
  new Enrollment({
    id: 'uid-1_course-1', studentUid: 'uid-1', courseId: 'course-1',
    state, reason: null, rejectedAt: null, approvedAt: null,
    withdrawnAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeRepo = (): jest.Mocked<IEnrollmentRepository> => ({
  findById:               jest.fn(),
  findByStudentAndCourse: jest.fn(),
  findByStudent:          jest.fn(),
  findAll:                jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getUser: jest.fn(), approveUser: jest.fn(), addRole: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const makeCourseClient = (): jest.Mocked<CourseServiceClient> =>
  ({ isCoursePublished: jest.fn(), getCourseTitle: jest.fn() } as unknown as jest.Mocked<CourseServiceClient>);

describe('ApproveEnrollmentUseCase', () => {
  let repo:         jest.Mocked<IEnrollmentRepository>;
  let outbox:       jest.Mocked<OutboxEventPublisher>;
  let userClient:   jest.Mocked<UserServiceClient>;
  let courseClient: jest.Mocked<CourseServiceClient>;
  let useCase:      ApproveEnrollmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo         = makeRepo();
    outbox       = makeOutbox();
    userClient   = makeUserClient();
    courseClient = makeCourseClient();
    useCase      = new ApproveEnrollmentUseCase(repo, outbox, userClient, courseClient);

    // Default: clients return enrichment data
    userClient.getUser.mockResolvedValue({
      email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith',
      phoneNumber: null, dateOfBirth: null, gender: null, address: null,
      qualificationTitle: null, qualificationUrl: null,
    });
    courseClient.getCourseTitle.mockResolvedValue('Bible Foundations');
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('approves enrollment and publishes enrollment.approved event', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1_course-1', 'req-1');

    expect(result.state).toBe('approved');
    expect(result.approvedAt).not.toBeNull();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'enrollment.approved' }),
    );
  });

  it('outbox payload includes studentUid, courseId, email, names, courseTitle, and appUrl', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1_course-1', 'req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'enrollment.approved',
        payload: expect.objectContaining({
          studentUid:       'uid-1',
          courseId:         'course-1',
          email:            'alice@example.com',
          studentFirstName: 'Alice',
          studentLastName:  'Smith',
          courseTitle:      'Bible Foundations',
          appUrl:           expect.any(String),
        }),
        requestId: 'req-1',
      }),
    );
  });

  it('outbox payload includes note when provided', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1_course-1', 'req-note', 'Approved for the 2026 intake.');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ note: 'Approved for the 2026 intake.' }),
      }),
    );
  });

  it('omits note from payload when not provided', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1_course-1', 'req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ note: null }),
      }),
    );
  });

  it('still approves when user-service returns null (enrichment is non-blocking)', async () => {
    userClient.getUser.mockResolvedValue(null);
    courseClient.getCourseTitle.mockResolvedValue('Bible Foundations');
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1_course-1', 'req-1');
    expect(result.state).toBe('approved');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ email: null, studentFirstName: null }),
      }),
    );
  });

  it('still approves when course-service throws (enrichment is non-blocking)', async () => {
    courseClient.getCourseTitle.mockRejectedValue(new Error('course-service down'));
    repo.findById.mockResolvedValue(makeEnrollment('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1_course-1', 'req-1');
    expect(result.state).toBe('approved');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ courseTitle: null }),
      }),
    );
  });

  // ── Error cases ────────────────────────────────────────────────────────────

  it('throws 404 ENROLLMENT_NOT_FOUND when enrollment does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1_course-1', 'req-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ENROLLMENT_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when enrollment is already approved', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('approved'));
    await expect(useCase.execute('uid-1_course-1', 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 409 INVALID_STATE when enrollment is rejected', async () => {
    repo.findById.mockResolvedValue(makeEnrollment('rejected'));
    await expect(useCase.execute('uid-1_course-1', 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
  });
});
