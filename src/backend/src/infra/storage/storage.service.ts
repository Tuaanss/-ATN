import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env';

/**
 * Đĩa cục bộ /data (Architecture §5.2):
 *   uploads/          tệp multer vừa nhận
 *   pending/<subId>/  tệp đã gắn vào bài nộp, chờ ghi lên Drive (giữ cả sau khi SYNCED để xem nhanh)
 */
@Injectable()
export class StorageService implements OnModuleInit {
  readonly uploadsDir = path.join(env.DATA_DIR, 'uploads');
  readonly pendingDir = path.join(env.DATA_DIR, 'pending');

  async onModuleInit() {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.pendingDir, { recursive: true });
  }

  async readHead(file: string, bytes = 32): Promise<Buffer> {
    const fh = await fs.open(file, 'r');
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  /** Đọc `bytes` byte cuối tệp (mục lục ZIP để nhận diện DOCX). */
  async readTail(file: string, bytes = 65536): Promise<Buffer> {
    const fh = await fs.open(file, 'r');
    try {
      const { size } = await fh.stat();
      const len = Math.min(bytes, size);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      return buf;
    } finally {
      await fh.close();
    }
  }

  sha256(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const h = createHash('sha256');
      createReadStream(file)
        .on('data', (c) => h.update(c))
        .on('end', () => resolve(h.digest('hex')))
        .on('error', reject);
    });
  }

  async moveToPending(file: string, submissionId: string, name: string): Promise<string> {
    const dir = path.join(this.pendingDir, submissionId);
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, name);
    await fs.rename(file, dest);
    return dest;
  }

  async exists(file?: string | null): Promise<boolean> {
    if (!file) return false;
    return fs
      .access(file)
      .then(() => true)
      .catch(() => false);
  }

  async remove(file?: string | null) {
    if (file) await fs.unlink(file).catch(() => undefined);
  }

  /**
   * Xóa bản cục bộ của tệp đã lên Drive; dọn luôn thư mục pending/<submissionId> nếu đã rỗng.
   * Trả false khi chưa xóa được (vd. Windows đang mở tệp để phát) – lần quét sau thử lại.
   */
  async removePending(file: string): Promise<boolean> {
    try {
      await fs.unlink(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return false;
    }
    const dir = path.dirname(file);
    if (path.dirname(dir) === this.pendingDir) await fs.rmdir(dir).catch(() => undefined); // chỉ xóa được khi rỗng
    return true;
  }
}
