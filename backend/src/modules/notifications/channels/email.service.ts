import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(email: string, subject: string, body: string) {
    if (!email) {
      return false;
    }

    const from = process.env.MAIL_FROM || 'no-reply@zito.local';

    if (process.env.RESEND_API_KEY) {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from,
          to: [email],
          subject,
          text: body,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );
      return true;
    }

    if (process.env.SENDGRID_API_KEY) {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email }] }],
          from: { email: from },
          subject,
          content: [{ type: 'text/plain', value: body }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );
      return true;
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[EMAIL DEV] -> ${email}: ${subject}`);
      return true;
    }

    return false;
  }
}
