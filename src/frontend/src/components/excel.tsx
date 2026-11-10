import { useState, type ReactNode } from 'react';
import { api, errorMessage } from '../api/client';
import type { ImportHistory, RowError } from '../api/types';
import { Icon } from './Icon';
import { Badge, Card, useToast } from './ui';
import { DropZone } from './work';
import { ddmmHHmm } from '../utils/format';

/** Tải tệp từ API (file mẫu Excel) – lấy tên tệp từ Content-Disposition. */
export async function downloadFile(url: string, fallback: string) {
  const r = await api.get<Blob>(url, { responseType: 'blob' });
  const cd = String(r.headers['content-disposition'] ?? '');
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : fallback;
  const href = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

/**
 * Khối tải lên Excel: nút "Tải file mẫu" + vùng kéo thả tệp .xlsx.
 * Gọi onFile khi người dùng chọn tệp (trang gọi API xem trước).
 */
export function ExcelUpload({
  title,
  templateUrl,
  templateName,
  onFile,
  busy,
  disabled,
  hint,
  extra,
}: {
  title: ReactNode;
  templateUrl: string;
  templateName: string;
  onFile: (f: File) => void;
  busy?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  extra?: ReactNode;
}) {
  const toast = useToast();
  const [dl, setDl] = useState(false);
  const pick = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return toast.err('Chỉ nhận tệp Excel .xlsx');
    if (f.size > 5 * 1024 * 1024) return toast.err('Tệp vượt quá 5 MB');
    onFile(f);
  };
  return (
    <Card
      title={title}
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          {extra}
          <button
            className="btn btn-sm"
            type="button"
            disabled={dl}
            onClick={async () => {
              setDl(true);
              try {
                await downloadFile(templateUrl, templateName);
              } catch (e) {
                toast.err(errorMessage(e));
              } finally {
                setDl(false);
              }
            }}
          >
            {dl ? <span className="spinner" /> : <Icon name="download" size={14} />}
            Tải file mẫu
          </button>
        </div>
      }
    >
      {busy ? (
        <div className="drop" style={{ minHeight: 132, justifyContent: 'center' }}>
          <span className="spinner" />
          <span style={{ fontSize: 14 }}>Đang đọc và kiểm tra tệp…</span>
        </div>
      ) : (
        <DropZone accept=".xlsx" onFiles={pick} title="Kéo thả tệp Excel vào đây hoặc" hint={hint ?? 'Tệp .xlsx theo file mẫu · tối đa 2.000 dòng, 5 MB'} disabled={disabled} />
      )}
    </Card>
  );
}

/** Bảng lỗi theo dòng của bản xem trước. */
export function RowErrors({ errors }: { errors: RowError[] }) {
  if (!errors.length) return null;
  return (
    <div className="tbl-wrap" style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #F2D4D0', borderRadius: 8 }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Dòng</th>
            <th style={{ width: 130 }}>MSV</th>
            <th>Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={i}>
              <td className="mono">{e.row || '—'}</td>
              <td className="mono">{e.studentCode ?? '—'}</td>
              <td style={{ color: '#9B1C12', fontSize: 13 }}>{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Thanh hành động của bản xem trước: Hủy / Áp dụng (kèm "chỉ dòng hợp lệ" khi có lỗi). */
export function PreviewActions({ errorRows, blocked, busy, onCancel, onApply, applyLabel = 'Áp dụng' }: { errorRows: number; blocked?: boolean; busy?: boolean; onCancel: () => void; onApply: (onlyValid: boolean) => void; applyLabel?: string }) {
  const [onlyValid, setOnlyValid] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
      {errorRows > 0 && !blocked && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} />
          Chỉ áp dụng dòng hợp lệ (bỏ qua {errorRows} dòng lỗi)
        </label>
      )}
      <span style={{ flex: 1 }} />
      <button className="btn" type="button" onClick={onCancel} disabled={busy}>
        Hủy
      </button>
      <button className="btn btn-p" type="button" disabled={busy || blocked || (errorRows > 0 && !onlyValid)} onClick={() => onApply(onlyValid)}>
        {busy ? <span className="spinner" /> : <Icon name="check" size={16} />}
        {applyLabel}
      </button>
    </div>
  );
}

/** Lịch sử các lần tải lên đã áp dụng. */
export function ImportHistoryCard({ items }: { items: ImportHistory[] }) {
  return (
    <Card title="Lịch sử tải lên">
      {items.length ? (
        items.map((h) => (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, paddingBottom: 10, borderBottom: '1px solid #EFEDE6' }}>
            <span style={{ color: '#15803D', display: 'inline-flex', marginTop: 2 }}>
              <Icon name="file" size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.fileName}</div>
              <span className="muted">
                {h.by} · {ddmmHHmm(h.completedAt)} · {h.totalRows} dòng
              </span>
            </div>
            {h.errorRows > 0 && <Badge tone="amber">Bỏ {h.errorRows} dòng</Badge>}
          </div>
        ))
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>
          Chưa có lần tải lên nào.
        </span>
      )}
    </Card>
  );
}
