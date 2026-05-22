import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess, sendPaginated }       from '@shared/response';
import { CreateEnrollmentUseCase }          from '../../application/use-cases/CreateEnrollmentUseCase';
import { ApproveEnrollmentUseCase }         from '../../application/use-cases/ApproveEnrollmentUseCase';
import { RejectEnrollmentUseCase }          from '../../application/use-cases/RejectEnrollmentUseCase';
import { WithdrawEnrollmentUseCase }        from '../../application/use-cases/WithdrawEnrollmentUseCase';
import { IEnrollmentRepository }           from '../../domain/repositories/IEnrollmentRepository';
import { rejectSchema, listSchema, enrollV2Schema, approveEnrollmentSchema } from '../validators/enrollmentValidator';

export class EnrollmentController {
  constructor(
    private readonly enrollRepo:  IEnrollmentRepository,
    private readonly createUC:    CreateEnrollmentUseCase,
    private readonly approveUC:   ApproveEnrollmentUseCase,
    private readonly rejectUC:    RejectEnrollmentUseCase,
    private readonly withdrawUC:  WithdrawEnrollmentUseCase,
  ) {}

  // V1: POST /courses/:id/enroll  (courseId from URL param)
  enroll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const enrollment = await this.createUC.execute(uid, req.params.id, requestId);
      sendSuccess(res, enrollment, 201);
    } catch (err) { next(err); }
  };

  // V2: POST /enrollments  {courseId, batchId}  (courseId from body)
  enrollV2 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = enrollV2Schema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const enrollment = await this.createUC.execute(uid, parsed.data.courseId, requestId);
      sendSuccess(res, enrollment, 201);
    } catch (err) { next(err); }
  };

  myEnrollments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.enrollRepo.findByStudent(uid, { limit: parsed.data.limit, cursor: parsed.data.cursor });
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const enrollment = await this.withdrawUC.execute(req.params.id, uid, requestId);
      sendSuccess(res, enrollment);
    } catch (err) { next(err); }
  };

  listAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.enrollRepo.findAll({ limit: parsed.data.limit, cursor: parsed.data.cursor, state: parsed.data.status, courseId: parsed.data.courseId });
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  approveAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed    = approveEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId  = (req.headers['x-request-id'] as string) ?? '';
      const enrollment = await this.approveUC.execute(req.params.id, requestId, parsed.data.note);
      sendSuccess(res, enrollment);
    } catch (err) { next(err); }
  };

  rejectAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId  = (req.headers['x-request-id'] as string) ?? '';
      const enrollment = await this.rejectUC.execute(req.params.id, parsed.data.reason, requestId);
      sendSuccess(res, enrollment);
    } catch (err) { next(err); }
  };
}
