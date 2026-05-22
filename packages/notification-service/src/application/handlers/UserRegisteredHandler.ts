import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';
import { UserServiceClient }         from '../../infrastructure/clients/UserServiceClient';

export interface UserRegisteredPayload {
  uid:       string;
  email:     string;
  firstName: string;
  lastName:  string;
  /** Plain-text password included so the welcome email can show login credentials. */
  password?: string;
  /** System URL used as the login button link in the welcome email. */
  appUrl?:   string;
}

export class UserRegisteredHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly userClient: UserServiceClient,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: UserRegisteredPayload, requestId: string): Promise<void> {
    const adminUids = await this.userClient.getAdminUids();
    const now       = new Date().toISOString();
    const fullName  = `${payload.firstName} ${payload.lastName}`;

    // ── In-app notification to all admins ──────────────────────────────────────
    // V2: members are active immediately — no "pending approval" step
    await Promise.all(adminUids.map(adminUid =>
      this.notifRepo.create(new Notification({
        id:        uuidv4(),
        userUid:   adminUid,
        type:      'user.registered',
        title:     'New Member Joined',
        body:      `${fullName} has registered and joined TCCR as a Member.`,
        read:      false,
        createdAt: now,
      })),
    ));

    // ── Welcome email to the new member ────────────────────────────────────────
    const subject = 'Welcome to TCCR — Your Account is Active';

    const credentialsTable = payload.password
      ? `<table cellpadding="8"
               style="border-collapse:collapse;font-family:sans-serif;margin:16px 0;">
           <tr style="background:#f5f5f5;">
             <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Email</strong></td>
             <td style="border:1px solid #ddd;padding:8px 20px;">${payload.email}</td>
           </tr>
           <tr>
             <td style="border:1px solid #ddd;padding:8px 20px;"><strong>Password</strong></td>
             <td style="border:1px solid #ddd;padding:8px 20px;font-family:monospace;">
               ${payload.password}
             </td>
           </tr>
         </table>
         <p style="color:#c0392b;font-weight:bold;">
           ⚠ Please update your password after your first login.
         </p>`
      : `<p>Use the email address and password you chose during registration to sign in.</p>`;

    const loginButton = payload.appUrl
      ? `<p style="margin:24px 0;">
           <a href="${payload.appUrl}"
              style="background:#1a73e8;color:#fff;padding:12px 28px;border-radius:4px;
                     text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
             Log in to TCCR →
           </a>
         </p>
         <p style="font-size:12px;color:#666;">
           Or copy this link into your browser: ${payload.appUrl}
         </p>`
      : '';

    const html = `
      <p>Hi <strong>${fullName}</strong>,</p>
      <p>Welcome to <strong>The Christian Center Rathmalana (TCCR)</strong>!
         Your account has been created and is <strong>active immediately</strong> —
         no approval step is required.</p>
      <p>Your login credentials are:</p>
      ${credentialsTable}
      ${loginButton}
      <p style="color:#555;font-size:13px;">
        If you did not create this account, please contact us immediately at
        <a href="mailto:support@tccr.lk">support@tccr.lk</a>.
      </p>
    `.trim();

    await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
  }
}
