import sgMail           from '@sendgrid/mail';
import nodemailer        from 'nodemailer';
import { logger }        from '@shared/logger';
import { config }        from '../../config';

export interface SendMailInput {
  to:      string;
  subject: string;
  html:    string;
}

type Provider = 'console' | 'sendgrid' | 'smtp';

export class EmailClient {
  private readonly provider: Provider;
  private readonly smtpTransport: nodemailer.Transporter | null = null;

  constructor() {
    const raw = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase();
    this.provider = (raw === 'sendgrid' || raw === 'smtp') ? raw : 'console';

    if (this.provider === 'sendgrid') {
      sgMail.setApiKey(config.sendgridApiKey);
    }

    if (this.provider === 'smtp') {
      this.smtpTransport = nodemailer.createTransport({
        host:   config.smtpHost,
        port:   config.smtpPort,
        secure: config.smtpPort === 465,
        // auth is optional — MailHog requires no credentials
        ...(config.smtpUser && config.smtpPass
          ? { auth: { user: config.smtpUser, pass: config.smtpPass } }
          : {}),
      });
    }
  }

  async sendMail(input: SendMailInput): Promise<void> {
    if (this.provider === 'console') {
      logger.info({ to: input.to, subject: input.subject }, '[EMAIL:console] email would be sent');
      return;
    }

    if (this.provider === 'sendgrid') {
      await sgMail.send({ from: config.emailFrom, to: input.to, subject: input.subject, html: input.html });
      return;
    }

    // smtp (works with MailHog no-auth and Gmail with credentials)
    await this.smtpTransport!.sendMail({
      from:    `"TCCR" <${config.emailFrom}>`,
      to:      input.to,
      subject: input.subject,
      html:    input.html,
    });
  }
}
