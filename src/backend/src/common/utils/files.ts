import { FileType, ProductType } from '@prisma/client';

/** Bỏ ký tự không hợp lệ cho tên thư mục/tệp trên Drive (BR-21), rút gọn ≤ 100 ký tự. */
export function sanitizeName(name: string, max = 100): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '');
  return (cleaned || 'khong_ten').slice(0, max);
}

/** Bỏ dấu tiếng Việt (dùng cho tên thư mục cá nhân). */
export function stripVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

interface Detected {
  mime: string;
  fileType: FileType;
}

/**
 * Nhận diện định dạng thật theo magic bytes (FR-06.04) – không tin đuôi tệp.
 * Hỗ trợ: JPG, PNG, WEBP, MP4/MOV, WEBM, ZIP, RAR, 7Z, PDF, DOC, DOCX.
 * `tail` là phần cuối tệp (chứa mục lục ZIP) để phân biệt DOCX với ZIP mã nguồn.
 */
export function detectFileType(buf: Buffer, tail?: Buffer): Detected | null {
  const hex = (start: number, len: number) => buf.subarray(start, start + len).toString('hex');
  const ascii = (start: number, len: number) => buf.subarray(start, start + len).toString('latin1');

  if (hex(0, 3) === 'ffd8ff') return { mime: 'image/jpeg', fileType: 'IMAGE' };
  if (hex(0, 8) === '89504e470d0a1a0a') return { mime: 'image/png', fileType: 'IMAGE' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', fileType: 'IMAGE' };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    return { mime: brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4', fileType: 'VIDEO' };
  }
  if (hex(0, 4) === '1a45dfa3') return { mime: 'video/webm', fileType: 'VIDEO' };
  if (ascii(0, 5) === '%PDF-') return { mime: 'application/pdf', fileType: 'DOCUMENT' };
  if (hex(0, 8) === 'd0cf11e0a1b11ae1') return { mime: 'application/msword', fileType: 'DOCUMENT' }; // Word 97-2003
  if (hex(0, 4) === '504b0304') {
    // DOCX là ZIP chứa word/document.xml – tên mục nằm trong central directory ở cuối tệp
    const index = (tail ?? buf).toString('latin1');
    if (index.includes('word/document.xml') || (index.includes('[Content_Types].xml') && index.includes('word/')))
      return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileType: 'DOCUMENT' };
    return { mime: 'application/zip', fileType: 'SOURCE' };
  }
  if (hex(0, 6) === '526172211a07') return { mime: 'application/vnd.rar', fileType: 'SOURCE' };
  if (hex(0, 6) === '377abcaf271c') return { mime: 'application/x-7z-compressed', fileType: 'SOURCE' };
  return null;
}

/** Loại sản phẩm của bài tập ↔ loại tệp được phép. */
export const PRODUCT_FOR_FILE: Record<FileType, ProductType> = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  SOURCE: 'SOURCE',
  DOCUMENT: 'REPORT',
};

/** Giới hạn mặc định (BR-13, Specification UC02.13). */
export const LIMITS = {
  IMAGE: { maxMB: 10, maxCount: 30 },
  VIDEO: { maxMB: 500, maxCount: 3 },
  SOURCE: { maxMB: 100, maxCount: 3 },
  DOCUMENT: { maxMB: 20, maxCount: 3 },
} as const;
