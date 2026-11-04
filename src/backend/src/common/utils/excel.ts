import ExcelJS from 'exceljs';
import { AppException } from '../errors/app-exception';
import { stripVietnamese } from './files';

/** Giới hạn tệp Excel tải lên (BR-23). */
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
/** Bản xem trước còn hiệu lực trong 30 phút. */
export const IMPORT_JOB_TTL_MS = 30 * 60_000;

export interface SheetColumn {
  key: string;
  header: string;
  width?: number;
  /** Tên cột khác vẫn được chấp nhận khi đọc */
  aliases?: string[];
  required?: boolean;
}

export interface RowError {
  row: number;
  studentCode?: string;
  message: string;
}

const norm = (s: string) => stripVietnamese(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    return '';
  }
  return String(v);
}

/** File mẫu: dòng tiêu đề in đậm, cố định dòng đầu, các dòng dữ liệu điền sẵn. */
export async function buildSheet(sheetName: string, columns: SheetColumn[], rows: (string | number | null)[][], guide?: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FrameUp';
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDB0000' } };
  head.alignment = { vertical: 'middle' };
  for (const r of rows) ws.addRow(r);
  ws.getColumn(1).numFmt = '@';
  if (guide?.length) {
    const g = wb.addWorksheet('Huong_dan');
    g.getColumn(1).width = 100;
    for (const line of guide) g.addRow([line]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Đọc trang tính đầu tiên: tìm dòng tiêu đề (trong 10 dòng đầu) theo tên cột,
 * trả về giá trị chuỗi đã cắt khoảng trắng của từng dòng có dữ liệu.
 */
export async function readSheet(file: { buffer?: Buffer; size: number; originalname: string }, columns: SheetColumn[]) {
  if (!file.buffer) throw new AppException('IMPORT_INVALID_FILE', 'Không đọc được tệp');
  if (file.size > IMPORT_MAX_BYTES) throw new AppException('IMPORT_TOO_LARGE', 'Tệp vượt quá 5 MB');
  if (!/\.xlsx$/i.test(file.originalname)) throw new AppException('IMPORT_INVALID_FILE', 'Chỉ nhận tệp Excel .xlsx (tải file mẫu để dùng)');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppException('IMPORT_INVALID_FILE', 'Tệp không phải Excel hợp lệ');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new AppException('IMPORT_INVALID_FILE', 'Tệp không có trang tính nào');

  const wanted = columns.map((c) => ({ ...c, names: [c.header, ...(c.aliases ?? [])].map(norm) }));
  let headerRow = 0;
  let index: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    // mỗi cột lấy ô khớp tên ưu tiên nhất (tên chính trước, rồi các tên khác theo thứ tự)
    const found: Record<string, number> = {};
    const rank: Record<string, number> = {};
    ws.getRow(r).eachCell((cell, col) => {
      const n = norm(cellText(cell.value));
      for (const w of wanted) {
        const i = w.names.indexOf(n);
        if (i >= 0 && (!(w.key in rank) || i < rank[w.key]) && !Object.entries(found).some(([k, c]) => c === col && k !== w.key)) {
          found[w.key] = col;
          rank[w.key] = i;
        }
      }
    });
    if (Object.keys(found).length >= 2) {
      headerRow = r;
      index = found;
    }
  }
  const missing = wanted.filter((c) => c.required && !(c.key in index)).map((c) => c.header);
  if (!headerRow || missing.length)
    throw new AppException('IMPORT_INVALID_FILE', `Tệp không đúng mẫu${missing.length ? `, thiếu cột: ${missing.join(', ')}` : ''}. Hãy tải file mẫu.`);

  const rows: { row: number; values: Record<string, string> }[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: Record<string, string> = {};
    for (const [key, col] of Object.entries(index)) {
      // ô gộp (VD: cột STT gộp cho cả nhóm): các ô con lấy giá trị của ô chính
      const cell = row.getCell(col);
      values[key] = cellText(cell.isMerged ? cell.master.value : cell.value).trim();
    }
    if (Object.values(values).every((v) => !v)) continue;
    rows.push({ row: r, values });
    if (rows.length > IMPORT_MAX_ROWS) throw new AppException('IMPORT_TOO_LARGE', `Tệp vượt quá ${IMPORT_MAX_ROWS} dòng`);
  }
  return rows;
}

/** Điểm thang 10: nhận dấu phẩy hoặc chấm, làm tròn 1 chữ số (BR-14). '' → null. */
export function parseScore(raw: string): { value: number | null; error?: string } {
  const t = raw.replace(/\s/g, '').replace(',', '.');
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: `“${raw}” không phải số` };
  if (n < 0 || n > 10) return { value: null, error: `Điểm ${raw} ngoài khoảng 0–10` };
  return { value: Math.round(n * 10) / 10 };
}

/** Quy đổi điểm chữ và hệ 4 (BR-15). */
export function letterOf(total: number): { letter: string; gpa4: number } {
  if (total >= 8.5) return { letter: 'A', gpa4: 4 };
  if (total >= 8.0) return { letter: 'B+', gpa4: 3.5 };
  if (total >= 7.0) return { letter: 'B', gpa4: 3 };
  if (total >= 6.5) return { letter: 'C+', gpa4: 2.5 };
  if (total >= 5.5) return { letter: 'C', gpa4: 2 };
  if (total >= 5.0) return { letter: 'D+', gpa4: 1.5 };
  if (total >= 4.0) return { letter: 'D', gpa4: 1 };
  return { letter: 'F', gpa4: 0 };
}

export const normCode = (s: string) => s.trim().toUpperCase();
