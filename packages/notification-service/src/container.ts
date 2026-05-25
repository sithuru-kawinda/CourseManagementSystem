import { FirestoreNotificationRepository } from './infrastructure/repositories/FirestoreNotificationRepository';
import { EmailClient }                     from './infrastructure/clients/EmailClient';
import { FcmClient }                       from './infrastructure/clients/FcmClient';
import { UserServiceClient }               from './infrastructure/clients/UserServiceClient';
import { NotificationDispatcher }          from './application/services/NotificationDispatcher';
import { RegistrationApprovedHandler }     from './application/handlers/RegistrationApprovedHandler';
import { RegistrationRejectedHandler }     from './application/handlers/RegistrationRejectedHandler';
import { EnrollmentPendingHandler }        from './application/handlers/EnrollmentPendingHandler';
import { EnrollmentApprovedHandler }       from './application/handlers/EnrollmentApprovedHandler';
import { EnrollmentRejectedHandler }       from './application/handlers/EnrollmentRejectedHandler';
import { UserRegisteredHandler }           from './application/handlers/UserRegisteredHandler';
import { AdminSuspendedHandler }           from './application/handlers/AdminSuspendedHandler';
import { AdminCreatedHandler }             from './application/handlers/AdminCreatedHandler';
import { RoleGrantedHandler }              from './application/handlers/RoleGrantedHandler';
import { CellJoinRequestedHandler }        from './application/handlers/CellJoinRequestedHandler';
import { CellJoinApprovedHandler }         from './application/handlers/CellJoinApprovedHandler';
import { CellJoinRejectedHandler }         from './application/handlers/CellJoinRejectedHandler';
import { CellReportFiledHandler }          from './application/handlers/CellReportFiledHandler';
import { CellOwnershipTransferredHandler } from './application/handlers/CellOwnershipTransferredHandler';
import { NotificationController }          from './http/controllers/NotificationController';
import { EventController }                 from './http/controllers/EventController';

const notifRepo   = new FirestoreNotificationRepository();
const emailClient = new EmailClient();
const fcmClient   = new FcmClient();
const userClient  = new UserServiceClient();
const dispatcher  = new NotificationDispatcher(emailClient, fcmClient);

const regApprovedHandler    = new RegistrationApprovedHandler(notifRepo, dispatcher);
const regRejectedHandler    = new RegistrationRejectedHandler(notifRepo, dispatcher);
const enrollPendingHandler  = new EnrollmentPendingHandler(notifRepo, userClient);
const enrollApprovedHandler = new EnrollmentApprovedHandler(notifRepo, dispatcher);
const enrollRejectedHandler = new EnrollmentRejectedHandler(notifRepo, dispatcher);
const userRegHandler        = new UserRegisteredHandler(notifRepo, userClient, dispatcher);
const adminSuspendedHandler = new AdminSuspendedHandler(notifRepo, dispatcher);
const adminCreatedHandler   = new AdminCreatedHandler(dispatcher);
const roleGrantedHandler    = new RoleGrantedHandler(notifRepo, dispatcher);
const cellJoinReqHandler    = new CellJoinRequestedHandler(notifRepo);
const cellJoinAppHandler    = new CellJoinApprovedHandler(notifRepo);
const cellJoinRejHandler    = new CellJoinRejectedHandler(notifRepo);
const cellReportFiledHandler          = new CellReportFiledHandler(notifRepo);
const cellOwnershipTransferredHandler = new CellOwnershipTransferredHandler(notifRepo, userClient, dispatcher);

export const container = {
  notificationController: new NotificationController(notifRepo),
  eventController:        new EventController(
    regApprovedHandler, regRejectedHandler,
    enrollPendingHandler, enrollApprovedHandler, enrollRejectedHandler,
    userRegHandler, adminSuspendedHandler, adminCreatedHandler,
    roleGrantedHandler,
    cellJoinReqHandler, cellJoinAppHandler, cellJoinRejHandler, cellReportFiledHandler,
    cellOwnershipTransferredHandler,
  ),
};
