import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { ProductType, SubmissionFile } from '../api/types';
import { fileUrl } from '../api/client';
import { Icon, type IconName } from './Icon';
import { Badge } from './ui';
import { fmtSize, PRODUCT_LONG } from '../utils/format';
import { sanitizeHtml } from '../utils/html';

// ---------------------------------------------------------------- đề bài

export interface BriefData {
  id: string;
  description: string | null;
  workMode: 'INDIVIDUAL' | 'GROUP';
  hasIndividualPart?: boolean;
  productTypes: ProductType[];
  allowLate: boolean;
  lateDueAt: string | null;
  dueAt: string;
  weight: number;
  suggestedTopics: string[];
  brief: { name: string; size: number } | null;
}

export function modeBadgeText(b: Pick<BriefData, 'workMode' | 'hasIndividualPart'>) {
  return b.workMode === 'INDIVIDUAL' ? 'Cá nhân' : b.hasIndividualPart ? 'Nhóm · có phần cá nhân' : 'Nhóm';
}

export function lateText(b: Pick<BriefData, 'allowLate' | 'lateDueAt' | 'dueAt'>) {
  if (!b.allowLate || !b.lateDueAt) return null;
  const days = Math.round((new Date(b.lateDueAt).getTime() - new Date(b.dueAt).getTime()) / 86400_000);
  return `Nhận nộp muộn tối đa ${days} ngày`;
}

/** Nội dung đề bài (mẫu SV_AssignmentNew "Đề bài" / khối thu gọn ở các bước sau). */
export function BriefBody({ b }: { b: BriefData }) {
  return (
    <>
      {b.description ? (
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#30343B' }} className="brief-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.description) }} />
      ) : (
        <p className="muted" style={{ fontSize: 14 }}>
          Giảng viên chưa nhập mô tả.
        </p>
      )}
      <div>
        <span className="lbl">Sản phẩm cần nộp</span>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
          {b.productTypes.map((p) => (
            <li key={p}>{PRODUCT_LONG[p]}</li>
          ))}
        </ul>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Badge tone="gray">{modeBadgeText(b)}</Badge>
        {lateText(b) ? <Badge tone="amber">{lateText(b)}</Badge> : <Badge tone="red">Không nhận nộp muộn</Badge>}
        <Badge tone="blue">Trọng số {b.weight}%</Badge>
      </div>
      {b.brief && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, border: '1px solid #E3E1D9', borderRadius: 8 }}>
          <span style={{ color: '#62666F', display: 'inline-flex' }}>
            <Icon name="file" size={18} />
          </span>
          <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {b.brief.name} · {fmtSize(b.brief.size)}
          </span>
          <a className="btn btn-sm" href={`/api/v1/files/brief/${b.id}`}>
            <Icon name="download" size={14} />
            Tải
          </a>
        </div>
      )}
      {b.suggestedTopics.length > 0 && (
        <div>
          <span className="lbl">Đề tài gợi ý từ GV</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {b.suggestedTopics.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Khối "Đề bài & yêu cầu của giảng viên" thu gọn được (mẫu SV_Step*). */
export function BriefDetails({ b, open, sub }: { b: BriefData; open?: boolean; sub?: ReactNode }) {
  return (
    <details className="card brief" open={open}>
      <summary style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F0EA', color: '#30343B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="file" size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="sec">Đề bài &amp; yêu cầu của giảng viên</div>
          {sub && (
            <div className="muted" style={{ fontSize: 12 }}>
              {sub}
            </div>
          )}
        </div>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          <span className="when-closed">Xem đề bài</span>
          <span className="when-open">Thu gọn</span>
        </span>
        <span className="chev" style={{ color: '#62666F' }}>
          <Icon name="chevronRightSm" size={18} />
        </span>
      </summary>
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #EFEDE6' }}>
        <BriefBody b={b} />
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- tệp bài nộp

const FILE_ICON: Record<SubmissionFile['fileType'], IconName> = { IMAGE: 'image', VIDEO: 'play', SOURCE: 'code', DOCUMENT: 'file' };

/** Lưới ảnh/tệp đã nộp (mẫu SV_StepSubmit: 6 cột, bấm để mở trình xem). */
export function Thumbs({ submissionId, files, cols = 6, max }: { submissionId: string; files: SubmissionFile[]; cols?: number; max?: number }) {
  const shown = max ? files.slice(0, max) : files;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cols >= 6 ? 96 : 120}px, 1fr))`, gap: 10 }}>
        {shown.map((f, i) => (
          <Link key={f.id} to={`/view/${submissionId}?i=${i}`} className="thumb" title={f.name}>
            {f.fileType === 'IMAGE' ? (
              <img src={fileUrl(f.id)} alt={f.name} loading="lazy" />
            ) : (
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.fileType === 'DOCUMENT' ? '#B42318' : '#62666F' }}>
                <Icon name={FILE_ICON[f.fileType]} size={28} />
              </span>
            )}
            <span className="nm mono">{f.name}</span>
          </Link>
        ))}
      </div>
      {max && files.length > max && (
        <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
          + {files.length - max} tệp khác
        </span>
      )}
    </>
  );
}

export function filesSummary(files: { fileType: string }[], figma?: string | null | boolean, git?: string | null | boolean) {
  const n = (t: string) => files.filter((f) => f.fileType === t).length;
  const parts: string[] = [];
  if (n('IMAGE')) parts.push(`${n('IMAGE')} ảnh`);
  if (n('VIDEO')) parts.push(`${n('VIDEO')} video`);
  if (n('SOURCE')) parts.push(`${n('SOURCE')} tệp mã nguồn`);
  if (n('DOCUMENT')) parts.push(`${n('DOCUMENT')} báo cáo`);
  if (figma) parts.push('1 link Figma');
  if (git) parts.push('1 link GitHub');
  return parts.join(' · ') || 'Chưa có tệp';
}

// ---------------------------------------------------------------- vùng kéo thả tệp

export function DropZone({ accept, onFiles, title, hint, disabled }: { accept: string; onFiles: (f: File[]) => void; title: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles([...e.dataTransfer.files]);
      }}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <span style={{ color: '#DB0000' }}>
        <Icon name="upload" size={28} />
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>
        {title}{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) input.current?.click();
          }}
        >
          chọn tệp
        </a>
      </span>
      {hint && (
        <span className="muted" style={{ fontSize: 13 }}>
          {hint}
        </span>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
