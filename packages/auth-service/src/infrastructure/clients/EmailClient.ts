import nodemailer from 'nodemailer';
import { config }  from '../../config';

export class EmailClient {
  private readonly transport = nodemailer.createTransport({
    host:   config.smtpHost,
    port:   config.smtpPort,
    secure: config.smtpPort === 465,
    // auth is optional — MailHog requires no credentials
    ...(config.smtpUser && config.smtpPass
      ? { auth: { user: config.smtpUser, pass: config.smtpPass } }
      : {}),
  });

  private get fromAddress(): string {
    return config.smtpUser
      ? `"TCCR" <${config.smtpUser}>`
      : `"TCCR" <noreply@tccr.lk>`;
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.transport.sendMail({
      from:    this.fromAddress,
      to,
      subject: 'Your Password Reset Code — TCCR',
      html:    `<p>Your password reset verification code is:</p>
                <h2 style="letter-spacing:4px">${otp}</h2>
                <p>This code expires in <strong>15 minutes</strong>.</p>
                <p>If you did not request this, ignore this email.</p>`,
    });
  }

  async sendVerificationEmail(
    to: string,
    otp: string,
    firstName: string,
    expiresAt?: string,
  ): Promise<void> {
    const expiryNote = expiresAt
      ? `<p style="font-size:12px;color:#666;">This code expires at <strong>${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> (15 minutes).</p>`
      : `<p style="font-size:12px;color:#666;">This code expires in <strong>15 minutes</strong>.</p>`;

    const html = `
      <p>Hi <strong>${firstName}</strong>,</p>
      <p>Thank you for registering with <strong>The Christian Center Rathmalana (TCCR)</strong>.</p>
      <p>Please verify your email address using the code below:</p>

      <div style="margin:32px 0;text-align:center;">
        <div style="display:inline-block;background:#f0f4ff;border:2px solid #1a73e8;
                    border-radius:12px;padding:24px 48px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#555;letter-spacing:1px;text-transform:uppercase;">
            Your verification code
          </p>
          <h1 style="margin:0;font-size:48px;font-weight:bold;color:#1a73e8;
                     letter-spacing:12px;font-family:monospace;">
            ${otp}
          </h1>
        </div>
      </div>

      <p>Enter this code in the TCCR app when prompted.</p>
      ${expiryNote}
      <p style="font-size:12px;color:#666;">
        If you did not create this account, you can safely ignore this email.
      </p>
    `.trim();

    await this.transport.sendMail({
      from:    this.fromAddress,
      to,
      subject: 'Your TCCR email verification code',
      html,
    });
  }
}
