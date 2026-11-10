import type { MyStatus, Phase, ProductType, WorkMode } from '../api/types';
import type { Tone } from '../components/ui';

// ---------------------------------------------------------------- ngày giờ (định dạng như mẫu)

const pad = (n: number) => String(n).padStart(2, '0');
const d = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** 12/10 23:59 */
export const ddmmHHmm = (v?: string | Date | null) => (v ? `${pad(d(v).getDate())}/${pad(d(v).getMonth() + 1)} ${pad(d(v).getHours())}:${pad(d(v).getMinutes())}` : '—');
/** 12/10/2026 23:59 */
export const fullDT = (v?: string | Date | null) => (v ? `${pad(d(v).getDate())}/${pad(d(v).getMonth() + 1)}/${d(v).getFullYear()} ${pad(d(v).getHours())}:${pad(d(v).getMinutes())}` : '—');
/** 12/10 */
export const ddmm = (v?: string | Date | null) => (v ? `${pad(d(v).getDate())}/${pad(d(v).getMonth() + 1)}` : '—');
/** 12/10/2026 */
export const fullDate = (v?: string | Date | null) => (v ? `${pad(d(v).getDate())}/${pad(d(v).getMonth() + 1)}/${d(v).getFullYear()}` : '—');
/** Giá trị cho <input type="datetime-local"> */
export const toLocalInput = (v?: string | Date | null) =>
  v ? `${d(v).getFullYear()}-${pad(d(v).getMonth() + 1)}-${pad(d(v).getDate())}T${pad(d(v).getHours())}:${pad(d(v).getMinutes())}` : '';
export const endOfDayIn = (days: number) => {
  const x = new Date(Date.now() + days * 86400_000);
  x.setHours(23, 59, 0, 0);
  return x;
};

/** "14:32 hôm nay", "Hôm qua", "27/09" – như danh sách thông báo trong mẫu. */
export function ago(v: string | Date) {
  const x = d(v);
  const now = new Date();
  const day = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = (day(now) - day(x)) / 86400_000;
  if (diff === 0) return `${pad(x.getHours())}:${pad(x.getMinutes())} hôm nay`;
  if (diff === 1) return 'Hôm qua';
  return ddmm(x);
}

/** Còn lại tới hạn: { text: 'Còn 2 ngày' | 'Còn 5 giờ' | 'Quá hạn', days } */
export function remain(v: string | Date) {
  const ms = d(v).getTime() - Date.now();
  if (ms <= 0) return { text: 'Đã đóng', days: -1, hours: 0, tone: 'gray' as Tone };
  const hours = Math.floor(ms / 3600_000);
  const days = Math.floor(ms / 86400_000);
  const text = days >= 1 ? `Còn ${days} ngày` : hours >= 1 ? `Còn ${hours} giờ` : `Còn ${Math.max(1, Math.floor(ms / 60000))} phút`;
  return { text, days, hours, tone: (days < 3 ? 'amber' : 'gray') as Tone };
}

/** "1 ngày 6 giờ" */
export function span(v: string | Date) {
  const ms = Math.max(0, d(v).getTime() - Date.now());
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  return days ? `${days} ngày ${hours} giờ` : `${hours} giờ`;
}

export const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

// ---------------------------------------------------------------- nhãn

const TERM: Record<string, string> = { TERM_1: 'Học kỳ 1', TERM_2: 'Học kỳ 2', SUMMER: 'Học kỳ hè' };
export const semesterLabel = (s?: { term: string; academicYear: string } | null) => (s ? `${TERM[s.term] ?? s.term} · ${s.academicYear.replace('-', '–')}` : '');


export function workModeText(m: WorkMode) {
  return m === 'INDIVIDUAL' ? 'Cá nhân' : 'Nhóm';
}

/** Điểm thang 10 hiển thị kiểu Việt Nam: 8,5 */
export const score10 = (v?: number | null) => (v == null ? '—' : v.toFixed(1).replace('.', ','));

export const PRODUCT_LONG: Record<ProductType, string> = {
  IMAGE: 'Ảnh thiết kế (1–30 ảnh, JPG/PNG/WEBP ≤ 10 MB/ảnh)',
  FIGMA: 'Link Figma',
  VIDEO: 'Video (MP4/WEBM/MOV ≤ 500 MB)',
  SOURCE: 'Mã nguồn (ZIP/RAR/7Z ≤ 100 MB)',
  GIT_LINK: 'Link GitHub / GitLab',
  REPORT: 'Báo cáo (PDF/DOC/DOCX ≤ 20 MB)',
};
export const PRODUCT_SHORT: Record<ProductType, string> = { IMAGE: 'Ảnh', FIGMA: 'Figma', VIDEO: 'Video', SOURCE: 'Mã nguồn', GIT_LINK: 'GitHub', REPORT: 'Báo cáo' };
export const productsText = (p: ProductType[]) => p.map((x) => PRODUCT_SHORT[x]).join(' + ');

/** Trạng thái bài tập phía GV (badge cạnh tiêu đề, cột "Trạng thái"). */
export function phaseBadge(phase: Phase): { label: string; tone: Tone } {
  switch (phase) {
    case 'DRAFT':
      return { label: 'Bản nháp', tone: 'gray' };
    case 'SCHEDULED':
      return { label: 'Hẹn mở', tone: 'gray' };
    case 'OPEN':
      return { label: 'Đang nhận bài', tone: 'blue' };
    case 'PUBLISHED':
      return { label: 'Đã công bố điểm', tone: 'green' };
    default:
      return { label: 'Hết hạn nộp', tone: 'amber' };
  }
}

/** Bước trên thanh 4 bước của SV + nhãn trạng thái (Đề bài & nhóm → Đề tài → Nộp bài → Kết quả). */
export function studentProgress(s: { status: MyStatus; score: number | null }) {
  const st = s.status;
  const P = (step: number, label: string, detail: string, badge: { label: string; tone: Tone }, action: string, primary = false) => ({ step, label, detail, badge, action, primary, done: false, missed: false });
  switch (st) {
    case 'NOT_OPEN':
      return P(0, 'Chưa mở', '', { label: 'Chưa mở', tone: 'gray' }, 'Xem');
    case 'NO_GROUP':
      return P(1, 'Bước 1/4', 'Chờ GV xếp nhóm', { label: 'Chưa có nhóm', tone: 'amber' }, 'Xem đề bài');
    case 'NO_TOPIC':
      return P(2, 'Bước 2/4', 'Đề tài · chưa nhập', { label: 'Chưa có đề tài', tone: 'red' }, 'Nhập đề tài', true);
    case 'NOT_SUBMITTED':
      return P(3, 'Bước 3/4', 'Nộp bài · chưa nộp', { label: 'Chưa nộp', tone: 'gray' }, 'Nộp bài', true);
    case 'SUBMITTED':
    case 'LATE':
      return P(4, 'Bước 4/4', 'Đã nộp · chờ điểm', { label: st === 'LATE' ? 'Nộp muộn' : 'Đã nộp', tone: 'blue' }, 'Xem bài nộp');
    case 'GRADED':
      return { ...P(4, 'Hoàn thành', `điểm ${score10(s.score)}`, { label: `Điểm · ${score10(s.score)}`, tone: 'green' }, 'Xem kết quả'), done: true };
    case 'MISSED':
      return { ...P(0, '—', 'Quá hạn · chưa nộp', { label: 'Chưa nộp', tone: 'gray' }, 'Xem'), missed: true };
  }
}

export const SYNC_BADGE: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Đang đồng bộ', tone: 'amber' },
  UPLOADING: { label: 'Đang đồng bộ', tone: 'amber' },
  SYNCED: { label: 'Đã đồng bộ', tone: 'green' },
  ERROR: { label: 'Lỗi đồng bộ', tone: 'red' },
  FAILED: { label: 'Lỗi đồng bộ', tone: 'red' },
  MISSING: { label: 'Không còn trên Drive', tone: 'red' },
};
