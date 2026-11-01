import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { Icon, type IconName } from '../../components/Icon';
import { Badge, Empty, Modal, useToast, type Tone } from '../../components/ui';

// Bộ khung dùng chung cho các trang Quản trị (mẫu project/admin).

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export function useAdmin<T>(path: string, enabled = true) {
  return useQuery({ queryKey: ['admin', path], queryFn: () => api.get<T>(`/admin${path}`).then((r) => r.data), enabled });
}

/** Gọi API ghi + toast + làm mới các truy vấn admin. */
export function useAct() {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: async ({ method, path, body }: { method: 'post' | 'put' | 'delete'; path: string; body?: unknown; ok?: string }) => (await api.request({ method, url: path.startsWith('/') ? path : `/admin/${path}`, data: body })).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      if (v.ok) toast.ok(v.ok);
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  return m;
}

export const STATUS: Record<string, [string, Tone]> = {
  ACTIVE: ['Hoạt động', 'green'],
  LOCKED: ['Đã khóa', 'red'],
  PENDING: ['Chờ duyệt', 'amber'],
  REJECTED: ['Đã từ chối', 'gray'],
  DISABLED: ['Vô hiệu', 'amber'],
  FIRST_LOGIN: ['Chưa đăng nhập lần đầu', 'gray'],
};
export const StatusBadge = ({ s }: { s: string }) => <Badge tone={STATUS[s]?.[1] ?? 'gray'} dot>{STATUS[s]?.[0] ?? s}</Badge>;

// ---------------------------------------------------------------- ô số liệu (tile)

export function Tiles({ items }: { items: [string, ReactNode, IconName][] }) {
  return (
    <div className="grid4">
      {items.map(([k, v, i]) => (
        <div key={k} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#62666F' }}>
            <Icon name={i} size={16} /> {k}
          </span>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- thanh công cụ

export function Toolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #EFEDE6', ...style }}>{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px', maxWidth: 360, height: 40, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 12px', color: '#62666F', background: '#fff' }}>
      <Icon name="search" size={16} />
      <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent', font: "400 14px 'Be Vietnam Pro',sans-serif", flex: 1, minWidth: 0 }} />
    </label>
  );
}

export function Select({ value, onChange, children, label, style }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string; style?: CSSProperties }) {
  return (
    <select className="inp" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', minWidth: 150, height: 40, ...style }}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------- bảng có phân trang

export interface Col<T> {
  h: ReactNode;
  r: (x: T, i: number) => ReactNode;
  w?: number | string;
  align?: 'right' | 'center';
}

export function Table<T>({ rows, cols, empty = 'Không có dữ liệu phù hợp.', pageSize = 12, rowKey, onRow }: { rows: T[]; cols: Col<T>[]; empty?: ReactNode; pageSize?: number; rowKey: (x: T) => string; onRow?: (x: T) => void }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(page, pages);
  const view = rows.slice((p - 1) * pageSize, p * pageSize);
  if (!rows.length) return <Empty icon="search">{empty}</Empty>;
  return (
    <>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={i} style={{ width: c.w, textAlign: c.align }}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((x, i) => (
              <tr key={rowKey(x)} className={onRow ? 'click' : undefined} onClick={onRow ? () => onRow(x) : undefined}>
                {cols.map((c, j) => (
                  <td key={j} style={{ textAlign: c.align, whiteSpace: c.align === 'right' && j === cols.length - 1 ? 'nowrap' : undefined }}>
                    {c.r(x, (p - 1) * pageSize + i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderTop: '1px solid #EFEDE6', fontSize: 13 }}>
          <span className="muted">
            {(p - 1) * pageSize + 1}–{Math.min(p * pageSize, rows.length)} / {rows.length}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" type="button" disabled={p <= 1} onClick={() => setPage(p - 1)} aria-label="Trang trước">
              <Icon name="chevronLeft" size={14} />
            </button>
            <span style={{ alignSelf: 'center', padding: '0 6px' }}>
              {p}/{pages}
            </span>
            <button className="btn btn-sm" type="button" disabled={p >= pages} onClick={() => setPage(p + 1)} aria-label="Trang sau">
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function IconBtn({ icon, title, onClick, disabled, danger }: { icon: IconName; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-g"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ width: 34, padding: 0, color: danger ? '#B42318' : undefined }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

export const Actions = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>{children}</div>;

export function CellUser({ name, code, icon, tone }: { name: ReactNode; code?: ReactNode; icon?: IconName; tone?: [string, string] }) {
  const text = typeof name === 'string' ? name : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span className="av" style={tone ? { background: tone[0], color: tone[1] } : undefined}>
        {icon ? <Icon name={icon} size={16} /> : text.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase()}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{name}</b>
        {code && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            {code}
          </span>
        )}
      </div>
    </div>
  );
}

export const Count = ({ n }: { n: number }) => (
  <span style={{ marginLeft: 6, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#F1F0EA', color: '#4A4E57', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
);

// ---------------------------------------------------------------- hộp thoại xác nhận (có thể kèm lý do)

interface ConfirmOpts {
  title: string;
  msg: ReactNode;
  ok: string;
  danger?: boolean;
  reason?: string;
  reasonRequired?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<string | false>>(null!);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<(ConfirmOpts & { resolve: (v: string | false) => void }) | null>(null);
  const [reason, setReason] = useState('');
  const ask = useMemo(
    () => (o: ConfirmOpts) =>
      new Promise<string | false>((resolve) => {
        setReason('');
        setSt({ ...o, resolve });
      }),
    [],
  );
  const close = (v: string | false) => {
    st?.resolve(v);
    setSt(null);
  };
  const need = !!st?.reason && st.reasonRequired !== false;
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st && (
        <Modal open onClose={() => close(false)} width={480}>
          <h2 className="sec">{st.title}</h2>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{st.msg}</div>
          {st.reason && (
            <div>
              <label className="lbl">
                {st.reason}
                {need && ' *'}
              </label>
              <textarea className="inp" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: 'auto', padding: 10 }} autoFocus />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => close(false)}>
              Hủy
            </button>
            <button className={`btn ${st.danger ? 'btn-d' : 'btn-p'}`} type="button" disabled={need && !reason.trim()} onClick={() => close(reason.trim() || 'ok')}>
              {st.ok}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

// ---------------------------------------------------------------- khung hộp thoại biểu mẫu

export function FormModal({ title, onClose, children, foot, width = 600 }: { title: ReactNode; onClose: () => void; children: ReactNode; foot: ReactNode; width?: number }) {
  return (
    <Modal open onClose={onClose} width={width}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 className="sec">{title}</h2>
        <button type="button" className="btn btn-g btn-sm" aria-label="Đóng" onClick={onClose} style={{ width: 34, padding: 0 }}>
          <Icon name="close" size={16} />
        </button>
      </div>
      {children}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{foot}</div>
    </Modal>
  );
}

export const Grid2 = ({ children }: { children: ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>{children}</div>;
export const Full = ({ children }: { children: ReactNode }) => <div style={{ gridColumn: '1 / -1' }}>{children}</div>;

/** Biểu đồ cột đơn giản (mẫu Admin_Dashboard). */
export function Columns({ data, height = 200, highlightMax = true }: { data: { label: string; value: number; title?: string }[]; height?: number; highlightMax?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  return (
    <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #D6D3C8' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ height, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
            {highlightMax && i === top && d.value > 0 && <span style={{ fontSize: 13, fontWeight: 700 }}>{d.value.toLocaleString('vi-VN')}</span>}
            <div title={d.title ?? `${d.label}: ${d.value}`} style={{ width: '60%', maxWidth: 44, height: Math.max(d.value ? 4 : 0, (d.value / max) * (height - 26)), background: highlightMax && i === top ? '#DB0000' : '#F2AAAA', borderRadius: '4px 4px 0 0' }} />
          </div>
          <span style={{ fontSize: 12, color: '#62666F', whiteSpace: 'nowrap', paddingBottom: 6 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Thanh ngang có nhãn (mẫu "Top chủ đề", "Lưu trữ"). */
export function HBars({ data, labelWidth = 140, unit = '' }: { data: { label: string; value: number; text?: string }[]; labelWidth?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: labelWidth, flexShrink: 0, fontSize: 13, color: '#30343B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.label}>
            {d.label}
          </span>
          <div style={{ flex: 1, height: 10, background: '#F1F0EA', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: '#DB0000', borderRadius: '0 5px 5px 0' }} />
          </div>
          <span style={{ minWidth: 48, textAlign: 'right', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {d.text ?? `${d.value.toLocaleString('vi-VN')}${unit}`}
          </span>
        </div>
      ))}
    </div>
  );
}
