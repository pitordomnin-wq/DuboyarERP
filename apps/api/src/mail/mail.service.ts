import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendLoginCode(to: string, code: string) {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get('SMTP_PORT') ?? 1025);
    const from = this.config.get<string>('SMTP_FROM') ?? 'Faverum <noreply@faverum.local>';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get('SMTP_SECURE') === 'true',
    });

    const text = `${code}\n\nКод действителен 10 минут.\nЕсли вы не запрашивали вход, проигнорируйте это письмо.`;

    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Faverum',
        text,
        html: `<p style="font-family:Georgia,serif;font-size:28px;letter-spacing:0.24em;margin:0 0 24px">${code}</p><p style="font-family:system-ui,sans-serif;font-size:13px;color:#64748b;margin:0">Код действителен 10 минут. Если вы не запрашивали вход, проигнорируйте это письмо.</p>`,
      });
    } catch (error) {
      this.log.error(`Failed to send mail to ${to}: ${String(error)}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      this.log.log(`OTP for ${to}: ${code}`);
    }
  }

  async sendMessage(input: {
    from: string;
    fromName: string;
    to: string;
    subject: string;
    text: string;
    attachments?: { filename: string; path: string; contentType: string }[];
  }) {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get('SMTP_PORT') ?? 1025);
    const fallback = this.config.get<string>('SMTP_FROM') ?? 'Faverum <noreply@faverum.local>';
    const from = `${input.fromName} <${input.from}>`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get('SMTP_SECURE') === 'true',
    });

    try {
      await transporter.sendMail({
        from: input.from || fallback,
        to: input.to,
        subject: input.subject,
        text: input.text,
        replyTo: from,
        attachments: input.attachments,
      });
    } catch (error) {
      this.log.error(`Failed to send mail to ${input.to}: ${String(error)}`);
      throw error;
    }
  }
}
