import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createReadStream, existsSync, promises as fs, readFileSync, writeFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';
import { env } from '../../config/env';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FolderInfo {
  id: string;
  name: string;
  sharedDriveId?: string | null;
}

export interface UploadResult {
  id: string;
  md5?: string | null;
}

/** Lỗi Drive đã phân loại: tạm thời (thử lại) hay vĩnh viễn (báo GV) – Architecture §5.3. */
export class DriveError extends Error {
  constructor(
    message: string,
    public readonly permanent: boolean,
  ) {
    super(message);
  }
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const LOCAL_PREFIX = 'local:';

/**
 * Lớp tích hợp Google Drive (UC04.3, UC04.4, UC06.3).
 * - DRIVE_MODE=google : Drive API v3. Mỗi GV liên kết tài khoản Google của mình (OAuth, quyền drive.file –
 *   chỉ thấy tệp do ứng dụng tạo); GV chưa liên kết mà có Service Account thì dùng Service Account.
 *   Mọi thao tác nhận `owner` = lecturerId của bài tập để chọn đúng tài khoản.
 * - DRIVE_MODE=local  : mô phỏng Drive bằng thư mục DATA_DIR/drive để chạy thử không cần Google.
 * Phần nghiệp vụ chỉ làm việc với folderId/fileId, không phụ thuộc chế độ.
 */
@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly localRoot = path.join(env.DATA_DIR, 'drive');
  private saClient?: drive_v3.Drive;
  /** client OAuth theo GV (lecturerId) */
  private clients = new Map<string, drive_v3.Drive>();

  constructor(private readonly prisma: PrismaService) {}
  /** Chế độ local: mã ngắn giống Drive (local:xxxx) → đường dẫn tương đối, lưu ở drive/.ids.json */
  private localIds?: Record<string, string>;

  get mode() {
    return env.DRIVE_MODE;
  }

  get serviceAccountEmail(): string | null {
    if (env.DRIVE_MODE !== 'google' || !env.GOOGLE_SA_KEY_BASE64) return null;
    return this.credentials().client_email;
  }

  /** Có cấu hình OAuth client (Google Cloud Console) để GV tự liên kết tài khoản. */
  get oauthConfigured() {
    return env.DRIVE_MODE === 'google' && !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
  }

  // ---------------------------------------------------------------- OAuth của GV
  private oauthClient() {
    return new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
  }

  /** drive.file: chỉ tạo & quản lý tệp do ứng dụng tạo; email để hiển thị tài khoản đã liên kết. */
  authUrl(state: string) {
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
<<<<<<< HEAD
      // select_account: luôn cho GV chọn tài khoản Google, không tự dùng tài khoản mặc định của trình duyệt
      prompt: 'select_account consent',
=======
      prompt: 'consent',
>>>>>>> b1fd9e4c892fe38462ae662b50912f41f481d8b8
      state,
      scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'],
    });
  }

  /** Đổi mã ủy quyền lấy refresh token (đã mã hóa) + email tài khoản. */
  async exchangeCode(code: string): Promise<{ email: string; refreshTokenEnc: string }> {
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error('Google không trả refresh token, hãy liên kết lại');
    client.setCredentials(tokens);
    const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
    return { email: data.email ?? '', refreshTokenEnc: this.encrypt(tokens.refresh_token) };
  }

  async revoke(refreshTokenEnc: string) {
    await this.oauthClient()
      .revokeToken(this.decrypt(refreshTokenEnc))
      .catch(() => undefined);
  }

  /** Bỏ client đã lưu đệm (sau khi GV liên kết lại / hủy liên kết). */
  forget(owner: string) {
    this.clients.delete(owner);
  }

  /** Dung lượng Drive của tài khoản GV (byte). */
  async quota(owner: string): Promise<{ used: number; limit: number | null } | null> {
    try {
      const { data } = await (await this.api(owner)).about.get({ fields: 'storageQuota' });
      return { used: Number(data.storageQuota?.usage ?? 0), limit: data.storageQuota?.limit ? Number(data.storageQuota.limit) : null };
    } catch {
      return null;
    }
  }

  private key() {
    return createHash('sha256').update(`drive-token:${env.JWT_SECRET}`).digest();
  }
  private encrypt(text: string) {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
  }
  private decrypt(blob: string) {
    const [iv, tag, enc] = blob.split('.').map((x) => Buffer.from(x, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', this.key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  }

  /** Tách folderId từ link Drive (…/folders/<id> hoặc ?id=<id>); chế độ local nhận tên thư mục. */
  parseFolderId(urlOrId: string): string {
    const value = urlOrId.trim();
    if (env.DRIVE_MODE === 'local') {
      if (value.startsWith(LOCAL_PREFIX)) return value;
      const m = value.match(/folders\/([\w-]+)/) ?? value.match(/[?&]id=([\w-]+)/);
      return LOCAL_PREFIX + (m ? m[1] : value.replace(/[^\w-]/g, '_'));
    }
    const m = value.match(/folders\/([\w-]{10,})/) ?? value.match(/[?&]id=([\w-]{10,})/);
    if (m) return m[1];
    if (/^[\w-]{10,}$/.test(value)) return value;
    throw new AppException('DRIVE_FOLDER_NOT_FOUND', 'Link thư mục Google Drive không hợp lệ', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  folderUrl(folderId: string): string | null {
    return folderId.startsWith(LOCAL_PREFIX) ? null : `https://drive.google.com/drive/folders/${folderId}`;
  }

  // ---------------------------------------------------------------- UC04.4
  /** Kiểm tra thư mục tồn tại, là thư mục, ghi được (ghi thử rồi xóa). */
  async verifyWritable(folderId: string, owner?: string): Promise<FolderInfo> {
    if (folderId.startsWith(LOCAL_PREFIX)) {
      const dir = this.localPath(folderId);
      await fs.mkdir(dir, { recursive: true });
      const probe = path.join(dir, '.eduportfolio_check.txt');
      await fs.writeFile(probe, 'x');
      await fs.unlink(probe);
      return { id: folderId, name: path.basename(dir) };
    }

    const drive = await this.apiOrThrow(owner);
    let meta: drive_v3.Schema$File;
    try {
      ({ data: meta } = await drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType,trashed,driveId,capabilities(canAddChildren)',
        supportsAllDrives: true,
      }));
    } catch (e) {
      throw this.toAppError(e);
    }
    if (meta.trashed) throw new AppException('DRIVE_FOLDER_NOT_FOUND', 'Thư mục đang ở thùng rác', HttpStatus.UNPROCESSABLE_ENTITY);
    if (meta.mimeType !== FOLDER_MIME)
      throw new AppException('DRIVE_NOT_A_FOLDER', 'Hãy dán link thư mục, không phải tệp', HttpStatus.UNPROCESSABLE_ENTITY);
    if (!meta.capabilities?.canAddChildren)
      throw new AppException(
        'DRIVE_NO_WRITE_PERMISSION',
        this.serviceAccountEmail ? `Hãy thêm ${this.serviceAccountEmail} vào thư mục với quyền Người chỉnh sửa` : 'Tài khoản Google đã liên kết không có quyền ghi vào thư mục này',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

    try {
      const { data } = await drive.files.create({
        requestBody: { name: '.eduportfolio_check.txt', parents: [folderId] },
        media: { mimeType: 'text/plain', body: Readable.from(['x']) },
        fields: 'id',
        supportsAllDrives: true,
      });
      await drive.files.delete({ fileId: data.id!, supportsAllDrives: true });
    } catch (e) {
      throw this.toAppError(e);
    }
    return { id: meta.id!, name: meta.name ?? '', sharedDriveId: meta.driveId };
  }

  // ---------------------------------------------------------------- UC04.3
  async createFolder(name: string, parentId: string, owner?: string): Promise<string> {
    if (parentId.startsWith(LOCAL_PREFIX)) {
      const rel = path.join(this.localRel(parentId), name);
      await fs.mkdir(path.join(this.localRoot, rel), { recursive: true });
      return this.registerLocal(rel);
    }
    try {
      const { data } = await (await this.api(owner)).files.create({
        requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
        fields: 'id',
        supportsAllDrives: true,
      });
      return data.id!;
    } catch (e) {
      throw this.classify(e);
    }
  }

  /** Di chuyển tệp/thư mục sang thư mục cha khác (đổi thư mục nhận bài – UC04.6). */
  async move(id: string, newParentId: string, owner?: string): Promise<void> {
    if (id.startsWith(LOCAL_PREFIX)) {
      const from = this.localPath(id);
      const rel = path.join(this.localRel(newParentId), path.basename(from));
      await fs.mkdir(path.join(this.localRoot, this.localRel(newParentId)), { recursive: true });
      await fs.rename(from, path.join(this.localRoot, rel));
      this.localIndex()[id] = rel;
      writeFileSync(path.join(this.localRoot, '.ids.json'), JSON.stringify(this.localIds, null, 1));
      return;
    }
    try {
      const drive = await this.api(owner);
      const { data } = await drive.files.get({ fileId: id, fields: 'parents', supportsAllDrives: true });
      await drive.files.update({
        fileId: id,
        addParents: newParentId,
        removeParents: (data.parents ?? []).join(','),
        supportsAllDrives: true,
      });
    } catch (e) {
      throw this.classify(e);
    }
  }

  async trash(fileOrFolderId: string, owner?: string): Promise<void> {
    if (fileOrFolderId.startsWith(LOCAL_PREFIX)) {
      const p = this.localPath(fileOrFolderId);
      const trashDir = path.join(this.localRoot, '.trash');
      await fs.mkdir(trashDir, { recursive: true });
      await fs.rename(p, path.join(trashDir, `${Date.now()}_${path.basename(p)}`)).catch(() => undefined);
      return;
    }
    try {
      await (await this.api(owner)).files.update({ fileId: fileOrFolderId, requestBody: { trashed: true }, supportsAllDrives: true });
    } catch (e) {
      throw this.classify(e);
    }
  }

  // ---------------------------------------------------------------- UC06.3
  /** Ghi tệp lên Drive (resumable upload với tệp lớn). */
  async uploadFile(localFile: string, name: string, mimeType: string, parentId: string, owner?: string): Promise<UploadResult> {
    if (parentId.startsWith(LOCAL_PREFIX)) {
      const rel = path.join(this.localRel(parentId), name);
      await fs.copyFile(localFile, path.join(this.localRoot, rel));
      return { id: this.registerLocal(rel) };
    }
    try {
      // googleapis gửi media dạng stream, không nạp cả tệp vào RAM
      const { data } = await (await this.api(owner)).files.create({
        requestBody: { name, parents: [parentId] },
        media: { mimeType, body: createReadStream(localFile) },
        fields: 'id,md5Checksum',
        supportsAllDrives: true,
      });
      return { id: data.id!, md5: data.md5Checksum };
    } catch (e) {
      throw this.classify(e);
    }
  }

  /** Đọc tệp từ Drive (khi không còn bản cục bộ) – hỗ trợ Range cho video. */
  async openStream(fileId: string, range?: { start: number; end: number }, owner?: string): Promise<Readable> {
    if (fileId.startsWith(LOCAL_PREFIX)) return createReadStream(this.localPath(fileId), range);
    const res = await (await this.api(owner)).files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', headers: range ? { Range: `bytes=${range.start}-${range.end}` } : undefined },
    );
    return res.data as unknown as Readable;
  }

  // ---------------------------------------------------------------- nội bộ
  private localIndex(): Record<string, string> {
    if (!this.localIds) {
      const file = path.join(this.localRoot, '.ids.json');
      this.localIds = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    }
    return this.localIds!;
  }

  private registerLocal(rel: string): string {
    const id = LOCAL_PREFIX + randomBytes(12).toString('base64url');
    this.localIndex()[id] = rel;
    writeFileSync(path.join(this.localRoot, '.ids.json'), JSON.stringify(this.localIds, null, 1));
    return id;
  }

  /** Mã local → đường dẫn tương đối. Mã chưa đăng ký (thư mục gốc GV, dữ liệu seed) là chính đường dẫn. */
  private localRel(id: string): string {
    return this.localIndex()[id] ?? id.slice(LOCAL_PREFIX.length);
  }

  private localPath(id: string): string {
    const rel = this.localRel(id);
    const full = path.resolve(this.localRoot, rel);
    if (!full.startsWith(path.resolve(this.localRoot))) throw new Error('Đường dẫn không hợp lệ');
    return full;
  }

  private credentials(): { client_email: string; private_key: string } {
    return JSON.parse(Buffer.from(env.GOOGLE_SA_KEY_BASE64!, 'base64').toString('utf8'));
  }

  /** Client Drive cho GV `owner`: OAuth của GV nếu đã liên kết, nếu không thì Service Account. */
  private async api(owner?: string): Promise<drive_v3.Drive> {
    if (owner) {
      const cached = this.clients.get(owner);
      if (cached) return cached;
      const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId: owner }, select: { refreshTokenEnc: true } });
      if (link?.refreshTokenEnc && this.oauthConfigured) {
        const auth = this.oauthClient();
        auth.setCredentials({ refresh_token: this.decrypt(link.refreshTokenEnc) });
        const client = google.drive({ version: 'v3', auth });
        this.clients.set(owner, client);
        return client;
      }
    }
    if (!env.GOOGLE_SA_KEY_BASE64) throw new DriveError('Giảng viên chưa liên kết tài khoản Google Drive', true);
    if (!this.saClient) {
      const { client_email, private_key } = this.credentials();
      const auth = new google.auth.JWT({ email: client_email, key: private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
      this.saClient = google.drive({ version: 'v3', auth });
    }
    return this.saClient;
  }

  /** Như api() nhưng báo lỗi nghiệp vụ (dùng khi GV đang thao tác). */
  private async apiOrThrow(owner?: string) {
    try {
      return await this.api(owner);
    } catch {
      throw new AppException('DRIVE_NOT_LINKED', 'Bạn chưa liên kết tài khoản Google Drive (mục Kết nối Google Drive)', HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private status(e: unknown): number | undefined {
    return (e as { code?: number; response?: { status?: number } })?.response?.status ?? (e as { code?: number })?.code;
  }

  /** Lỗi khi GV liên kết/tạo bài: trả mã lỗi + hướng dẫn (bảng UC04.4). */
  private toAppError(e: unknown): AppException {
    const status = this.status(e);
    const msg = String((e as Error)?.message ?? '');
    this.logger.warn(`Drive: ${status} ${msg}`);
    if (isGrantError(e))
      return new AppException('DRIVE_NOT_LINKED', 'Liên kết Google Drive đã hết hạn hoặc bị thu hồi. Hãy liên kết lại tài khoản Google.', HttpStatus.UNPROCESSABLE_ENTITY);
    if (msg.includes('storageQuotaExceeded'))
      return new AppException('DRIVE_NOT_SHARED_DRIVE', 'Thư mục đang ở My Drive; hãy chuyển sang Shared Drive', HttpStatus.UNPROCESSABLE_ENTITY);
    if (status === 404)
      return new AppException('DRIVE_FOLDER_NOT_FOUND', 'Không thấy thư mục: link sai, chưa chia sẻ cho tài khoản hệ thống, hoặc không phải thư mục do EduPortfolio tạo', HttpStatus.UNPROCESSABLE_ENTITY);
    if (status === 403)
      return new AppException('DRIVE_NO_WRITE_PERMISSION', 'Tài khoản hệ thống chưa có quyền ghi vào thư mục', HttpStatus.UNPROCESSABLE_ENTITY);
    return new AppException('DRIVE_FOLDER_NOT_FOUND', 'Không kiểm tra được thư mục Drive, vui lòng thử lại', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  /** Lỗi khi đồng bộ nền: 429/5xx/mạng là tạm thời, còn lại vĩnh viễn. */
  private classify(e: unknown): DriveError {
    const status = this.status(e);
    const msg = String((e as Error)?.message ?? e);
    if (isGrantError(e)) return new DriveError('invalid_grant: liên kết Google Drive của giảng viên đã hết hạn, cần liên kết lại', true);
    const temporary = status === undefined || status === 429 || (status >= 500 && status < 600) || /ECONNRESET|ETIMEDOUT/.test(msg);
    return new DriveError(`${status ?? ''} ${msg}`.trim(), !temporary);
  }
}

/** Refresh token bị Google thu hồi / hết hạn (ứng dụng ở chế độ Testing chỉ giữ token 7 ngày). */
export function isGrantError(e: unknown) {
  const err = e as { message?: string; response?: { data?: { error?: string } } };
  return err?.response?.data?.error === 'invalid_grant' || /invalid_grant/.test(String(err?.message ?? e));
}
