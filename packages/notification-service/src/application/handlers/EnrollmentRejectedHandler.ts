import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface EnrollmentRejectedPayload {
  studentUid:        string;
  courseId:          string;
  /** Rejection reason from the admin. */
  reason?:           string | null;
  /** Student email — used to send the rejection email. */
  email?:            string;
  /** Student first name — used in the greeting. */
  studentFirstName?: string;
  /** Student last name — used in the greeting. */
  studentLastName?:  string;
  /** Course title shown in the email subject and body. */
  courseTitle?:      string;
  /** Login page URL for the "Log in" button. */
  appUrl?:           string;
}

export class EnrollmentRejectedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: EnrollmentRejectedPayload, requestId: string): Promise<void> {
    const coursePart = payload.courseTitle ? ` for ${payload.courseTitle}` : '';
    const fullName   = [payload.studentFirstName, payload.studentLastName].filter(Boolean).join(' ') || 'Student';
    const reasonText = payload.reason ?? null;

    const notifTitle = 'Enrollment Not Approved';
    const notifBody  = reasonText
      ? `Your enrollment${coursePart} was not approved: ${reasonText}`
      : `Your enrollment${coursePart} was not approved at this time.`;

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'enrollment.rejected',
      title:     notifTitle,
      body:      notifBody,
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Rejection email ────────────────────────────────────────────────────────
    if (payload.email) {
      const subject = payload.courseTitle
        ? `Enrollment Update — ${payload.courseTitle} — TCCR`
        : 'Your Course Enrollment Was Not Approved — TCCR';

      const reasonSection = reasonText
        ? `<div style="background:#fff3f3;border-left:4px solid #e74c3c;padding:12px 16px;
                       margin:20px 0;border-radius:0 4px 4px 0;">
             <p style="margin:0;font-size:14px;color:#1a1a1a;">
               <strong>Reason:</strong><br>${reasonText}
             </p>
           </div>`
        : `<p style="color:#555;font-size:14px;">
             No specific reason was provided by the administrator.
           </p>`;

      const loginButton = payload.appUrl
        ? `<p style="margin:28px 0 12px;">
             <a href="${payload.appUrl}"
                style="background:#555;color:#fff;padding:12px 28px;border-radius:4px;
                       text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
               Log in to TCCR →
             </a>
           </p>
           <p style="font-size:12px;color:#666;">
             Or visit: <a href="${payload.appUrl}" style="color:#1a73e8;">${payload.appUrl}</a>
           </p>`
        : '';

      const courseRow = payload.courseTitle
        ? `<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;margin:16px 0;">
             <tr style="background:#f5f5f5;">
               <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Course</strong></td>
               <td style="border:1px solid #ddd;padding:8px 20px;">${payload.courseTitle}</td>
             </tr>
             <tr>
               <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Status</strong></td>
               <td style="border:1px solid #ddd;padding:8px 20px;color:#e74c3c;font-weight:bold;">Not Approved</td>
             </tr>
           </table>`
        : '';

      const html = `
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>Thank you for your interest in enrolling at <strong>The Christian Center Rathmalana (TCCR)</strong>.
           Unfortunately, your enrollment application has <strong style="color:#e74c3c;">not been approved</strong>
           at this time.</p>
        ${courseRow}
        ${reasonSection}
        <p style="color:#555;font-size:14px;">
          If you believe this decision was made in error, or if you have any questions,
          please contact the administration team.
          You may be eligible to reapply in a future intake.
        </p>
        ${loginButton}
        <p style="color:#999;font-size:12px;margin-top:32px;">
          This email was sent because your enrollment request was reviewed by an administrator.
          If you have any questions, contact
          <a href="mailto:support@tccr.lk">support@tccr.lk</a>.
        </p>
      `.trim();

      await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
    }
  }
}
