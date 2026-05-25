import { Request, Response, NextFunction }   from 'express';
import { fromZodError }                       from '@shared/errors';
import { logger }                             from '@shared/logger';
import { RegistrationApprovedHandler }        from '../../application/handlers/RegistrationApprovedHandler';
import { RegistrationRejectedHandler }        from '../../application/handlers/RegistrationRejectedHandler';
import { EnrollmentPendingHandler }           from '../../application/handlers/EnrollmentPendingHandler';
import { EnrollmentApprovedHandler }          from '../../application/handlers/EnrollmentApprovedHandler';
import { EnrollmentRejectedHandler }          from '../../application/handlers/EnrollmentRejectedHandler';
import { UserRegisteredHandler }              from '../../application/handlers/UserRegisteredHandler';
import { AdminSuspendedHandler }              from '../../application/handlers/AdminSuspendedHandler';
import { AdminCreatedHandler }                from '../../application/handlers/AdminCreatedHandler';
import { RoleGrantedHandler }                 from '../../application/handlers/RoleGrantedHandler';
import { CellJoinRequestedHandler }           from '../../application/handlers/CellJoinRequestedHandler';
import { CellJoinApprovedHandler }            from '../../application/handlers/CellJoinApprovedHandler';
import { CellJoinRejectedHandler }            from '../../application/handlers/CellJoinRejectedHandler';
import { CellReportFiledHandler }             from '../../application/handlers/CellReportFiledHandler';
import { CellOwnershipTransferredHandler }    from '../../application/handlers/CellOwnershipTransferredHandler';
import { internalEventSchema }                from '../validators/notificationValidator';

export class EventController {
  constructor(
    private readonly registrationApproved: RegistrationApprovedHandler,
    private readonly registrationRejected: RegistrationRejectedHandler,
    private readonly enrollmentPending:    EnrollmentPendingHandler,
    private readonly enrollmentApproved:   EnrollmentApprovedHandler,
    private readonly enrollmentRejected:   EnrollmentRejectedHandler,
    private readonly userRegistered:       UserRegisteredHandler,
    private readonly adminSuspended:       AdminSuspendedHandler,
    private readonly adminCreated:         AdminCreatedHandler,
    private readonly roleGranted:          RoleGrantedHandler,
    private readonly cellJoinRequested:    CellJoinRequestedHandler,
    private readonly cellJoinApproved:     CellJoinApprovedHandler,
    private readonly cellJoinRejected:     CellJoinRejectedHandler,
    private readonly cellReportFiled:          CellReportFiledHandler,
    private readonly cellOwnershipTransferred: CellOwnershipTransferredHandler,
  ) {}

  receiveEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = internalEventSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const { eventType, payload, requestId } = parsed.data;

      switch (eventType) {
        case 'registration.approved':
          await this.registrationApproved.handle(payload as unknown as Parameters<typeof this.registrationApproved.handle>[0], requestId);
          break;
        case 'registration.rejected':
          await this.registrationRejected.handle(payload as unknown as Parameters<typeof this.registrationRejected.handle>[0], requestId);
          break;
        case 'enrollment.pending':
          await this.enrollmentPending.handle(payload as unknown as Parameters<typeof this.enrollmentPending.handle>[0], requestId);
          break;
        case 'enrollment.approved':
          await this.enrollmentApproved.handle(payload as unknown as Parameters<typeof this.enrollmentApproved.handle>[0], requestId);
          break;
        case 'enrollment.rejected':
          await this.enrollmentRejected.handle(payload as unknown as Parameters<typeof this.enrollmentRejected.handle>[0], requestId);
          break;
        case 'user.registered':
          await this.userRegistered.handle(payload as unknown as Parameters<typeof this.userRegistered.handle>[0], requestId);
          break;
        case 'admin.suspended':
          await this.adminSuspended.handle(payload as unknown as Parameters<typeof this.adminSuspended.handle>[0], requestId);
          break;
        case 'admin.created':
          await this.adminCreated.handle(payload as unknown as Parameters<typeof this.adminCreated.handle>[0], requestId);
          break;
        case 'role.granted':
          await this.roleGranted.handle(payload as unknown as Parameters<typeof this.roleGranted.handle>[0], requestId);
          break;
        case 'cell.join_requested':
          await this.cellJoinRequested.handle(payload as unknown as Parameters<typeof this.cellJoinRequested.handle>[0], requestId);
          break;
        case 'cell.join_approved':
          await this.cellJoinApproved.handle(payload as unknown as Parameters<typeof this.cellJoinApproved.handle>[0], requestId);
          break;
        case 'cell.join_rejected':
          await this.cellJoinRejected.handle(payload as unknown as Parameters<typeof this.cellJoinRejected.handle>[0], requestId);
          break;
        case 'cell_report.filed':
          await this.cellReportFiled.handle(payload as unknown as Parameters<typeof this.cellReportFiled.handle>[0], requestId);
          break;
        case 'cell.ownership_transferred':
          await this.cellOwnershipTransferred.handle(payload as unknown as Parameters<typeof this.cellOwnershipTransferred.handle>[0], requestId);
          break;
        default:
          logger.warn({ eventType }, 'Unhandled event type');
      }

      res.status(204).send();
    } catch (err) { next(err); }
  };
}
