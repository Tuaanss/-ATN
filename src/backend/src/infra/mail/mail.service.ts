import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { SystemConfigService } from '../../common/config/system-config.service';

export interface MailInput {
  to: string;
  subject: string;
  /** Nội dung chính (đoạn văn, có thể có xuống dòng) */
  text: string;
  /** Nút hành động trong email */
  action?: { label: string; url: string };
}

/**
 * Gửi email (UC11.2, UC01.5). Có SMTP_HOST thì gửi thật qua SMTP;
 * không có thì lưu thư vào <DATA_DIR>/outbox/*.html để xem thử khi demo.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter?: Transporter;
  readonly outbox = path.join(env.DATA_DIR, 'outbox');
  constructor(private readonly config: SystemConfigService) {}

  get configured() {
    return !!env.SMTP_HOST;
  }

  private transport() {
    if (!this.transporter)
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
    return this.transporter;
  }

  private html(m: MailInput) {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    return `<!doctype html><html><body style="margin:0;background:#F5F5F5;font-family:Arial,sans-serif;color:#1A1C21">
<div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #E3E1D9;border-radius:12px;overflow:hidden">
<div style="background:#DB0000;color:#fff;padding:16px 24px;font-weight:700;font-size:16px">EduPortfolio</div>
<div style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${esc(m.subject)}</h2>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;white-space:pre-line">${esc(m.text)}</p>
${m.action ? `<a href="${esc(m.action.url)}" style="display:inline-block;background:#DB0000;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">${esc(m.action.label)}</a>` : ''}
</div><div style="padding:12px 24px;border-top:1px solid #EFEDE6;font-size:12px;color:#62666F">Thư gửi tự động, vui lòng không trả lời. Đổi cài đặt nhận email tại trang Thông báo.</div></div></body></html>`;
  }

  /** Không ném lỗi: email hỏng không được làm hỏng thao tác chính. */
  async send(m: MailInput): Promise<boolean> {
    if (!m.to) return false;
    const html = this.html(m);
    try {
      if (this.configured) {
        await this.transport().sendMail({ from: (await this.config.get()).email.sender || env.SMTP_FROM, to: m.to, subject: m.subject, text: `${m.text}${m.action ? `\n\n${m.action.label}: ${m.action.url}` : ''}`, html });
      } else {
        await fs.mkdir(this.outbox, { recursive: true });
        const file = path.join(this.outbox, `${new Date().toISOString().replace(/[:.]/g, '-')}_${m.to.replace(/[^a-z0-9@._-]/gi, '_')}.html`);
        await fs.writeFile(file, `<!-- To: ${m.to} | Subject: ${m.subject} -->\n${html}`);
        this.logger.log(`(chưa cấu hình SMTP) Thư tới ${m.to}: “${m.subject}” → ${file}${m.action ? ` · ${m.action.url}` : ''}`);
      }
      return true;
    } catch (e) {
      this.logger.warn(`Không gửi được email tới ${m.to}: ${(e as Error).message}`);
      return false;
    }
  }
}
