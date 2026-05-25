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
  /** System URL used as the fallback login link if no verification link is available. */
  appUrl?:   string;
  /** 6-digit OTP for email verification — user enters this on the TCCR app. */
  verificationOtp?: string;
  /** ISO expiry timestamp for the OTP — shown in the email for clarity. */
  otpExpiresAt?: string;
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
    const subject = 'Welcome to TCCR — Your Account is Ready';

    const loginUrl = payload.appUrl ?? 'https://cms.bethelnet.au/login';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a73e8;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:0.5px;">
              The Christian Center Rathmalana
            </h1>
            <p style="margin:6px 0 0;color:#d0e8ff;font-size:14px;">TCCR Member Portal</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">
              Hi <strong>${fullName}</strong>,
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              Welcome to <strong>The Christian Center Rathmalana (TCCR)</strong>!
              Your account has been created successfully.
              Use the button below to log in to the portal.
            </p>

            <!-- Login credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8faff;border:1px solid #d0e0ff;
                          border-radius:6px;margin:0 0 28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;color:#555;
                             text-transform:uppercase;letter-spacing:0.8px;">
                    Your Login Details
                  </p>
                  <table cellpadding="6" cellspacing="0" width="100%">
                    <tr>
                      <td style="font-size:14px;color:#666;width:90px;">Email</td>
                      <td style="font-size:14px;color:#1a1a1a;font-weight:bold;">
                        ${payload.email}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:14px;color:#666;">Password</td>
                      <td style="font-size:14px;color:#1a1a1a;font-family:monospace;
                                 background:#eef2ff;padding:4px 8px;border-radius:4px;">
                        ${payload.password ?? '(the password you set during registration)'}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:4px 0 28px;">
                  <a href="${loginUrl}"
                     style="display:inline-block;background:#1a73e8;color:#ffffff;
                            text-decoration:none;font-size:16px;font-weight:bold;
                            padding:16px 48px;border-radius:6px;letter-spacing:0.3px;">
                    Log in to TCCR &rarr;
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin:0;font-size:12px;color:#999;">
                    Or copy this link into your browser:<br>
                    <a href="${loginUrl}" style="color:#1a73e8;">${loginUrl}</a>
                  </p>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="margin-top:28px;">
              <tr>
                <td style="background:#fff8e1;border-left:4px solid #f9a825;
                           padding:12px 16px;border-radius:0 4px 4px 0;">
                  <p style="margin:0;font-size:13px;color:#7a5800;">
                    ⚠ &nbsp;<strong>Security tip:</strong> Please change your password
                    after your first login via <em>My Profile → Change Password</em>.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;
                     border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              If you did not create this account, please contact us at
              <a href="mailto:support@tccr.lk" style="color:#1a73e8;">support@tccr.lk</a>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#ccc;">
              &copy; ${new Date().getFullYear()} The Christian Center Rathmalana
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`.trim();

    await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
  }
}
