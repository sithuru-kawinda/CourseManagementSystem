import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface EnrollmentApprovedPayload {
  studentUid:       string;
  courseId:         string;
  /** Student email — used to send the welcome email. */
  email?:           string;
  /** Student first name — used in the greeting. */
  studentFirstName?: string;
  /** Student last name — used in the greeting. */
  studentLastName?:  string;
  /** FCM token for push notification (optional). */
  fcmToken?:        string;
  /** Course title shown in the email subject and body. */
  courseTitle?:     string;
  /** Admin's optional approval note shown in the email. */
  note?:            string;
  /** Login page URL for the "Log in" button. */
  appUrl?:          string;
}

export class EnrollmentApprovedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: EnrollmentApprovedPayload, requestId: string): Promise<void> {
    const coursePart = payload.courseTitle ? ` in ${payload.courseTitle}` : '';
    const fullName   = [payload.studentFirstName, payload.studentLastName].filter(Boolean).join(' ') || 'Student';

    const notifTitle = 'Enrollment Approved';
    const notifBody  = `Your enrollment${coursePart} has been approved. You can now access the course content.`;

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'enrollment.approved',
      title:     notifTitle,
      body:      notifBody,
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Welcome email ──────────────────────────────────────────────────────────
    if (payload.email) {
      const subject = payload.courseTitle
        ? `Enrollment Approved — ${payload.courseTitle} — TCCR`
        : 'Your Course Enrollment has been Approved — TCCR';

      const noteSection = payload.note
        ? `<div style="background:#f0f7ff;border-left:4px solid #1a73e8;padding:12px 16px;
                       margin:20px 0;border-radius:0 4px 4px 0;">
             <p style="margin:0;font-size:14px;color:#1a1a1a;">
               <strong>Message from the admin:</strong><br>${payload.note}
             </p>
           </div>`
        : '';

      const loginButton = payload.appUrl
        ? `<p style="margin:28px 0 12px;">
             <a href="${payload.appUrl}"
                style="background:#1a73e8;color:#fff;padding:12px 28px;border-radius:4px;
                       text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
               Log in to TCCR →
             </a>
           </p>
           <p style="font-size:12px;color:#666;">
             Or visit: <a href="${payload.appUrl}" style="color:#1a73e8;">${payload.appUrl}</a>
           </p>`
        : '';

      const courseRow = payload.courseTitle
        ? `<tr style="background:#f5f5f5;">
             <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Course</strong></td>
             <td style="border:1px solid #ddd;padding:8px 20px;">${payload.courseTitle}</td>
           </tr>`
        : '';

      const html = `
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>Great news! Your course enrollment has been <strong style="color:#27ae60;">approved</strong>.
           You can now access all course content.</p>
        ${courseRow
          ? `<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;margin:16px 0;">
               ${courseRow}
               <tr>
                 <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Status</strong></td>
                 <td style="border:1px solid #ddd;padding:8px 20px;color:#27ae60;font-weight:bold;">Approved ✓</td>
               </tr>
             </table>`
          : ''}
        ${noteSection}
        <p style="color:#555;font-size:14px;">
          You can now log in and start learning. Access your course from the <strong>My Enrollments</strong>
          section after signing in.
        </p>
        ${loginButton}
        <p style="color:#999;font-size:12px;margin-top:32px;">
          This email was sent because your enrollment was approved by an administrator.
          If you have any questions, contact <a href="mailto:support@tccr.lk">support@tccr.lk</a>.
        </p>
      `.trim();

      await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
    }

    // ── Push notification (best-effort) ────────────────────────────────────────
    if (payload.fcmToken) {
      await this.dispatcher.dispatchPush(payload.fcmToken, notifTitle, notifBody);
    }
  }
}
