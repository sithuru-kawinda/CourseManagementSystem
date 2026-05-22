import { createHttpError }        from '@shared/errors';
import { OutboxEventPublisher }  from '@shared/events';
import { IEnrollmentRepository } from '../../domain/repositories/IEnrollmentRepository';
import { Enrollment }            from '../../domain/entities/Enrollment';
import { UserServiceClient }     from '../../infrastructure/clients/UserServiceClient';
import { CourseServiceClient }   from '../../infrastructure/clients/CourseServiceClient';
import { config }                from '../../config';

export class RejectEnrollmentUseCase {
  constructor(
    private readonly enrollRepo:   IEnrollmentRepository,
    private readonly outbox:       OutboxEventPublisher,
    private readonly userClient:   UserServiceClient,
    private readonly courseClient: CourseServiceClient,
  ) {}

  async execute(id: string, reason: string | undefined, requestId: string): Promise<Enrollment> {
    const enrollment = await this.enrollRepo.findById(id);
    if (!enrollment) throw createHttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');

    enrollment.reject(reason);
    await this.enrollRepo.update(enrollment);

    // Enrich outbox payload with student + course details for the rejection email.
    // Both calls are fire-and-forget — failure never blocks the rejection.
    const [student, courseTitle] = await Promise.all([
      this.userClient.getUser(enrollment.studentUid).catch(() => null),
      this.courseClient.getCourseTitle(enrollment.courseId).catch(() => null),
    ]);

    await this.outbox.publishWithBatch({
      type:    'enrollment.rejected',
      payload: {
        studentUid:       enrollment.studentUid,
        courseId:         enrollment.courseId,
        reason:           reason ?? null,
        email:            student?.email     ?? null,
        studentFirstName: student?.firstName ?? null,
        studentLastName:  student?.lastName  ?? null,
        courseTitle:      courseTitle         ?? null,
        appUrl:           config.appUrl,
      },
      requestId,
    });

    return enrollment;
  }
}
