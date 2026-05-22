import { logger }                              from '@shared/logger';
import { notifyClient, auditClient, userClient, sendEvent } from '../infrastructure/clients/ServiceClient';

type Handler = (payload: unknown, requestId: string) => Promise<void>;

const ROUTES: Record<string, Handler[]> = {
  'user.registered': [
    (p, r) => sendEvent(notifyClient, 'user.registered', p, r),
    (p, r) => sendEvent(auditClient,  'user.registered', p, r),
  ],
  'registration.approved': [
    (p, _r) => userClient.post('/internal/users/approve', { uid: (p as Record<string, string>).studentUid }).then(() => undefined),
    (p, r) => sendEvent(notifyClient, 'registration.approved', p, r),
    (p, r) => sendEvent(auditClient,  'registration.approved', p, r),
  ],
  'registration.rejected': [
    (p, r) => sendEvent(notifyClient, 'registration.rejected', p, r),
    (p, r) => sendEvent(auditClient,  'registration.rejected', p, r),
  ],
  'enrollment.pending': [
    (p, r) => sendEvent(notifyClient, 'enrollment.pending', p, r),
    (p, r) => sendEvent(auditClient,  'enrollment.pending', p, r),
  ],
  'enrollment.approved': [
    (p, r) => sendEvent(notifyClient, 'enrollment.approved', p, r),
    (p, r) => sendEvent(auditClient,  'enrollment.approved', p, r),
  ],
  'enrollment.rejected': [
    (p, r) => sendEvent(notifyClient, 'enrollment.rejected', p, r),
    (p, r) => sendEvent(auditClient,  'enrollment.rejected', p, r),
  ],
  'enrollment.withdrawn': [
    (p, r) => sendEvent(auditClient,  'enrollment.withdrawn', p, r),
  ],
  'course.published': [
    (p, r) => sendEvent(notifyClient, 'course.published', p, r),
    (p, r) => sendEvent(auditClient,  'course.published', p, r),
  ],
  'progress.subjectCompleted': [
    (p, r) => sendEvent(auditClient,  'progress.subjectCompleted', p, r),
  ],
  'admin.created': [
    (p, r) => sendEvent(notifyClient, 'admin.created', p, r),
    (p, r) => sendEvent(auditClient,  'admin.created', p, r),
  ],
  'admin.suspended': [
    (p, r) => sendEvent(notifyClient, 'admin.suspended', p, r),
    (p, r) => sendEvent(auditClient,  'admin.suspended', p, r),
  ],
  'role.granted': [
    (p, r) => sendEvent(notifyClient, 'role.granted', p, r),
    (p, r) => sendEvent(auditClient,  'role.granted', p, r),
  ],
  'audit.action': [
    (p, r) => sendEvent(auditClient,  'audit.action', p, r),
  ],
  'cell.created': [
    (p, r) => sendEvent(auditClient,  'cell.created', p, r),
  ],
  'cell.join_requested': [
    (p, r) => sendEvent(auditClient,  'cell.join_requested', p, r),
  ],
  'cell.join_approved': [
    (p, r) => sendEvent(auditClient,  'cell.join_approved', p, r),
  ],
  'cell.join_rejected': [
    (p, r) => sendEvent(auditClient,  'cell.join_rejected', p, r),
  ],
  'cell_report.filed': [
    (p, r) => sendEvent(auditClient,  'cell_report.filed', p, r),
  ],
  'cell_report.voided': [
    (p, r) => sendEvent(auditClient,  'cell_report.voided', p, r),
  ],
};

export class EventDispatcher {
  async dispatch(eventType: string, payload: unknown, requestId: string): Promise<void> {
    const handlers = ROUTES[eventType];
    if (!handlers) {
      logger.warn({ eventType }, 'Outbox: unknown event type — skipping');
      return;
    }

    for (const handler of handlers) {
      await handler(payload, requestId);
    }
  }
}
