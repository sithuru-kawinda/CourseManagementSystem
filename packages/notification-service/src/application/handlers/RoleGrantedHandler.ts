import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface RoleGrantedPayload {
  requesterUid:      string;
  /** Role that was granted (e.g. 'student'). */
  role:              string;
  decidedByUid?:     string;
  /** Student email — used to send the approval email. */
  email?:            string;
  /** Student first name — used in the greeting. */
  studentFirstName?: string;
  /** Student last name — used in the greeting. */
  studentLastName?:  string;
  /** Optional note from the admin shown in the email. */
  note?:             string;
  /** Login page URL for the "Log in" button. */
  appUrl?:           string;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  leader:  'Cell Leader',
  g12:     'G12 Leader',
};

export class RoleGrantedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: RoleGrantedPayload, requestId: string): Promise<void> {
    const roleLabel = ROLE_LABELS[payload.role] ?? payload.role;
    const fullName  = [payload.studentFirstName, payload.studentLastName].filter(Boolean).join(' ') || 'Member';

    const notifTitle = `${roleLabel} Role Approved`;
    const notifBody  = `Your application for the ${roleLabel} role has been approved! You can now access ${roleLabel === 'Student' ? 'Bible School courses' : 'your new responsibilities'}.`;

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.requesterUid,
      type:      'role.granted',
      title:     notifTitle,
      body:      notifBody,
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Approval email ─────────────────────────────────────────────────────────
    if (payload.email) {
      const subject = `Your ${roleLabel} Application has been Approved — TCCR`;

      const noteSection = payload.note
        ? `<div style="background:#f0f7ff;border-left:4px solid #1a73e8;padding:12px 16px;
                       margin:20px 0;border-radius:0 4px 4px 0;">
             <p style="margin:0;font-size:14px;color:#1a1a1a;">
               <strong>Message from the admin:</strong><br>${payload.note}
             </p>
           </div>`
        : '';

      const nextStepsSection = payload.role === 'student'
        ? `<p style="color:#555;font-size:14px;">
             You can now:
             <ul style="margin:8px 0;padding-left:24px;color:#555;font-size:14px;">
               <li>Browse available courses in the TCCR portal</li>
               <li>Submit enrollment requests for open course batches</li>
               <li>Track your learning progress once enrolled</li>
             </ul>
           </p>`
        : `<p style="color:#555;font-size:14px;">
             Log in to the TCCR portal to access your new responsibilities and features.
           </p>`;

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

      const html = `
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>Congratulations! 🎉 Your application for the
           <strong style="color:#27ae60;">${roleLabel}</strong> role at
           <strong>The Christian Center Rathmalana (TCCR)</strong> has been
           <strong style="color:#27ae60;">approved</strong>.</p>
        <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;margin:16px 0;">
          <tr style="background:#f5f5f5;">
            <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Role Granted</strong></td>
            <td style="border:1px solid #ddd;padding:8px 20px;color:#27ae60;font-weight:bold;">${roleLabel} ✓</td>
          </tr>
        </table>
        ${noteSection}
        ${nextStepsSection}
        ${loginButton}
        <p style="color:#999;font-size:12px;margin-top:32px;">
          This email was sent because your role application was reviewed by an administrator.
          If you have any questions, contact
          <a href="mailto:support@tccr.lk">support@tccr.lk</a>.
        </p>
      `.trim();

      await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
    }
  }
}
