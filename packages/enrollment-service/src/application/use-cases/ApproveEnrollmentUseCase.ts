import { createHttpError }        from '@shared/errors';
import { OutboxEventPublisher }  from '@shared/events';
import { IEnrollmentRepository } from '../../domain/repositories/IEnrollmentRepository';
import { Enrollment }            from '../../domain/entities/Enrollment';
import { UserServiceClient }     from '../../infrastructure/clients/UserServiceClient';
import { CourseServiceClient }   from '../../infrastructure/clients/CourseServiceClient';
import { config }                from '../../config';

export class ApproveEnrollmentUseCase {
  constructor(
    private readonly enrollRepo:   IEnrollmentRepository,
    private readonly outbox:       OutboxEventPublisher,
    private readonly userClient:   UserServiceClient,
    private readonly courseClient: CourseServiceClient,
  ) {}

  async execute(id: string, requestId: string, note?: string): Promise<Enrollment> {
    const enrollment = await this.enrollRepo.findById(id);
    if (!enrollment) throw createHttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');

    enrollment.approve();
    await this.enrollRepo.update(enrollment);

    // Enrich outbox payload with student + course details for the welcome email.
    // Both calls are fire-and-forget — failure to fetch never blocks the approval.
    const [student, courseTitle] = await Promise.all([
      this.userClient.getUser(enrollment.studentUid).catch(() => null),
      this.courseClient.getCourseTitle(enrollment.courseId).catch(() => null),
    ]);

    await this.outbox.publishWithBatch({
      type:    'enrollment.approved',
      payload: {
        studentUid:        enrollment.studentUid,
        courseId:          enrollment.courseId,
        email:             student?.email    ?? null,
        studentFirstName:  student?.firstName ?? null,
        studentLastName:   student?.lastName  ?? null,
        courseTitle:       courseTitle        ?? null,
        note:              note               ?? null,
        appUrl:            config.appUrl,
      },
      requestId,
    });

    return enrollment;
  }
}
