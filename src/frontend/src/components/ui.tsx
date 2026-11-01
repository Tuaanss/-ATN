import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

// ---------------------------------------------------------------- tiện ích

/** "Sinh viên 12" → "S12", "Giảng viên 1" → "G1", "Nguyễn Văn An" → "NA" (giống avatar trong mẫu). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (/^\d+$/.test(last)) return (parts[0][0] ?? '').toUpperCase() + last;
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? last[0] : '')).toUpperCase();
}

export type Tone = 'red' | 'green' | 'amber' | 'blue' | 'gray' | 'dark';

// ---------------------------------------------------------------- tiêu đề trang

export function PageHead({ title, badge, sub, actions }: { title: ReactNode; badge?: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <h1 className="h1">
          {title} {badge}
        </h1>
        {sub && <p style={{ fontSize: 14, color: '#62666F' }}>{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- thẻ

export function Card({ title, extra, children, body = true, style, bodyStyle }: { title?: ReactNode; extra?: ReactNode; children?: ReactNode; body?: boolean; style?: CSSProperties; bodyStyle?: CSSProperties }) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {title !== undefined && (
        <div className="card-h">
          <h2 className="sec">{title}</h2>
          {extra}
        </div>
      )}
      {body ? (
        <div className="card-b" style={bodyStyle}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

const STAT: Record<Exclude<Tone, 'dark'>, [string, string]> = {
  red: ['#FDEDED', '#C40000'],
  green: ['#EAF6EC', '#15803D'],
  amber: ['#FEF5E3', '#B45309'],
  blue: ['#EAF2FE', '#1D4ED8'],
  gray: ['#F1F0EA', '#30343B'],
};

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon: IconName; tone: Exclude<Tone, 'dark'> }) {
  const [bg, fg] = STAT[tone];
  return (
    <div className="stat" style={{ background: bg }}>
      <div className="t">
        <span>{label}</span>
        <span style={{ color: fg, display: 'inline-flex' }}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="v" style={{ color: fg }}>
        {value}
      </div>
      {sub !== undefined && <div className="s">{sub}</div>}
    </div>
  );
}

export const Badge = ({ tone, children, dot }: { tone: Tone; children: ReactNode; dot?: boolean }) => (
  <span className={`badge b-${tone}`}>
    {dot && <span className="dot" style={{ background: 'currentColor' }} />}
    {children}
  </span>
);

export function Note({ tone, icon, children, style }: { tone: 'amber' | 'blue' | 'green' | 'red' | 'gray'; icon: IconName; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`note n-${tone}`} style={style}>
      <span>
        <Icon name={icon} size={16} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Bar({ value, width, color, height = 6 }: { value: number; width?: number | string; color?: string; height?: number }) {
  return (
    <div className="bar" style={{ width, flex: width ? 'none' : 1, height }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export const RowKV = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="row-kv">
    <span className="muted">{label}</span>
    <span style={{ textAlign: 'right' }}>{children}</span>
  </div>
);

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="kv">
      {rows.map(([k, v], i) => (
        <span key={i} style={{ display: 'contents' }}>
          <span className="muted">{k}</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 36, strong }: { name: string; size?: number; strong?: boolean }) {
  return (
    <span className="av" style={{ width: size, height: size, fontSize: 13, ...(strong ? { background: '#DB0000', color: '#fff' } : {}) }}>
      {initials(name)}
    </span>
  );
}

export function Empty({ icon = 'file', children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="empty">
      <span style={{ color: '#8A8E97' }}>
        <Icon name={icon} size={24} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="page">
      <div className="skeleton" style={{ height: 34, width: 320 }} />
      <div className="grid4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 112 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 280 }} />
    </div>
  );
}

// ---------------------------------------------------------------- thanh bước

export type StepState = 'done' | 'current' | 'todo';

/** Thanh 5 bước lớn (mẫu GV_Assign*, SV_Step*). */
export function Stepper({ steps }: { steps: { title: string; sub: ReactNode; state: StepState }[] }) {
  return (
    <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span style={{ flex: 1, height: 2, background: steps[i - 1].state === 'done' ? '#15803D' : '#E3E1D9', minWidth: 16 }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span
              className="av"
              style={{
                width: 30,
                height: 30,
                background: s.state === 'done' ? '#15803D' : s.state === 'current' ? '#DB0000' : '#EEEDE7',
                color: s.state === 'todo' ? '#62666F' : '#fff',
              }}
            >
              {s.state === 'done' ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: s.state === 'todo' ? '#62666F' : undefined }}>{s.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {s.sub}
              </div>
            </div>
          </div>
        </span>
      ))}
    </div>
  );
}

/** Thanh 4 bước nhỏ trong bảng (cột "Tiến độ"). */
export function MiniSteps({ step, done, missed, label, detail }: { step: number; done?: boolean; missed?: boolean; label: ReactNode; detail?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 18,
              height: 6,
              borderRadius: 3,
              background: missed ? '#B42318' : done || i < step ? '#15803D' : i === step ? '#DB0000' : '#E3E1D9',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12 }}>
        <b>{label}</b> {detail && <span className="muted">· {detail}</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- điều khiển

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`sw${checked ? '' : ' off'}`}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => onChange(!checked)}
    />
  );
}

export function SwitchRow({ title, sub, checked, onChange, disabled }: { title: string; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub && (
          <div className="muted" style={{ fontSize: 12 }}>
            {sub}
          </div>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: { key: T; label: ReactNode; icon?: IconName }[]; onChange: (k: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.key === value} className={`tab${t.key === value ? ' on' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, error, children }: { label?: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {label && <label className="lbl">{label}</label>}
      {children}
      {error ? <div className="err">{error}</div> : help ? <div className="help">{help}</div> : null}
    </div>
  );
}

/** Ô nhập nhiều từ khóa dạng chip (mẫu "Từ khóa (1–5)"). Enter hoặc dấu phẩy để thêm. */
export function ChipInput({ value, onChange, max = 5, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; max?: number; placeholder?: string; disabled?: boolean }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= max) return setText('');
    onChange([...value, t]);
    setText('');
  };
  return (
    <div className="inp" style={{ height: 'auto', minHeight: 42, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '7px 10px', alignItems: 'center', background: disabled ? '#F7F6F2' : undefined }}>
      {value.map((v) => (
        <span key={v} className="chip">
          {v}
          {!disabled && (
            <button type="button" aria-label={`Bỏ ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, color: '#62666F', fontSize: 14, lineHeight: 1 }}>
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && value.length < max && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? 'Thêm…' : placeholder}
          style={{ border: 0, outline: 0, flex: 1, minWidth: 100, font: "400 13px 'Be Vietnam Pro',sans-serif", background: 'transparent' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- hộp thoại & thông báo nhanh

export function Modal({ open, onClose, children, width }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="card modal" style={width ? { width } : undefined}>
        {children}
      </div>
    </div>
  );
}

interface Toast {
  id: number;
  text: string;
  error?: boolean;
}
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, error }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), error ? 6000 : 3500);
  }, []);
  const ok = useCallback((t: string) => push(t), [push]);
  const err = useCallback((t: string) => push(t, true), [push]);
  return (
    <ToastCtx.Provider value={{ ok, err }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' err' : ''}`}>
            <Icon name={t.error ? 'warn' : 'check'} size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
