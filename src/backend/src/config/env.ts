import { z } from 'zod';
import path from 'node:path';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET quá ngắn'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  DATA_DIR: z.string().default('./data'),
  UPLOAD_MAX_FILE_MB: z.coerce.number().default(500),
  DRIVE_MODE: z.enum(['local', 'google']).default('local'),
  GOOGLE_SA_KEY_BASE64: z.string().optional(),
  /** OAuth (mỗi GV liên kết tài khoản Google của mình) – tạo ở Google Cloud Console, loại "Web application" */
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  /** Mặc định <WEB_ORIGIN>/api/v1/lecturer/drive/oauth/callback – phải khai báo y hệt trong Console */
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  /** Gửi email (thông báo, quên mật khẩu). Bỏ trống SMTP_HOST thì thư được lưu vào <DATA_DIR>/outbox để xem thử */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('EduPortfolio <no-reply@eduportfolio.local>'),
  /** Nhắc hạn nộp trước bao nhiêu giờ (FR-06.15) */
  REMINDER_HOURS: z.coerce.number().default(24),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${msg}`);
  }
  const env = parsed.data;
  const oauth = !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
  if (env.DRIVE_MODE === 'google' && !env.GOOGLE_SA_KEY_BASE64 && !oauth) {
    throw new Error('DRIVE_MODE=google cần GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET (hoặc GOOGLE_SA_KEY_BASE64)');
  }
  return {
    ...env,
    DATA_DIR: path.resolve(env.DATA_DIR),
    GOOGLE_OAUTH_REDIRECT_URI: env.GOOGLE_OAUTH_REDIRECT_URI || `${env.WEB_ORIGIN.replace(/\/$/, '')}/api/v1/lecturer/drive/oauth/callback`,
  };
}

export const env = load();
