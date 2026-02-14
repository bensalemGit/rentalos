import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type Attachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter | null = null;

  private env(name: string) {
    return process.env[name] ?? '';
  }

  private ensureTransporter() {
    if (this.transporter) return;

    const host = this.env('SMTP_HOST');
    const port = Number(this.env('SMTP_PORT') || '587');
    const user = this.env('SMTP_USER');
    const pass = this.env('SMTP_PASS');

    if (!host || !user || !pass) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async sendMail(to: string, subject: string, html: string, attachments?: Attachment[]) {
    this.ensureTransporter();

    const from = this.env('SMTP_FROM') || this.env('SMTP_USER');
    if (!this.transporter || !from) {
      return { ok: false, sent: false, error: 'SMTP not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments: attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType || 'application/octet-stream',
        })),
      });

      return { ok: true, sent: true, messageId: info.messageId };
    } catch (e: any) {
      return { ok: false, sent: false, error: String(e?.message || e) };
    }
  }
}
