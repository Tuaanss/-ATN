import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';

/**
 * Ô nhập ngày kiểu Việt Nam: hiển thị / gõ dd/mm/yyyy (kèm hh:mm nếu withTime).
 * Giá trị vào/ra giữ chuẩn của <input type="date|datetime-local">: "yyyy-mm-dd" | "yyyy-mm-ddTHH:mm" | "".
 * Nút lịch mở bộ chọn ngày gốc của trình duyệt.
 */
export function DateInput({
  value,
  onChange,
  withTime,
  disabled,
  className,
  style,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  withTime?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}) {
  const [text, setText] = useState(() => toText(value, withTime));
  const picker = useRef<HTMLInputElement>(null);

  // giá trị đổi từ ngoài (nạp dữ liệu, chọn trên lịch) → cập nhật chữ đang hiển thị
  useEffect(() => {
    if (toIso(text, withTime) !== value) setText(toText(value, withTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, withTime]);

  const type = (raw: string) => {
    let digits = raw.replace(/\D/g, '');
    // xóa đúng vào dấu "/", " ", ":" → xóa luôn chữ số đứng trước
    if (raw.length < text.length && digits === text.replace(/\D/g, '')) digits = digits.slice(0, -1);
    const next = mask(digits, withTime);
    setText(next);
    const iso = toIso(next, withTime);
    if (iso !== value) onChange(iso);
  };

  const openPicker = () => {
    const el = picker.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        className={className ?? 'inp'}
        inputMode="numeric"
        placeholder={withTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy'}
        value={text}
        onChange={(e) => type(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{ paddingRight: 40, height: style?.height, fontSize: style?.fontSize }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        title="Chọn trên lịch"
        aria-label="Chọn trên lịch"
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, border: 0, background: 'transparent', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: '#62666F', padding: 0 }}
      >
        <Icon name="calendar" size={16} />
      </button>
      <input
        ref={picker}
        type={withTime ? 'datetime-local' : 'date'}
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', right: 6, bottom: 0, width: 30, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }}
      />
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function mask(digits: string, withTime?: boolean) {
  const n = digits.slice(0, withTime ? 12 : 8);
  let out = '';
  for (let i = 0; i < n.length; i++) {
    if (i === 2 || i === 4) out += '/';
    if (i === 8) out += ' ';
    if (i === 10) out += ':';
    out += n[i];
  }
  return out;
}

/** "31/12/2025 23:59" → "2025-12-31T23:59"; chưa đủ / sai ngày → "". */
function toIso(text: string, withTime?: boolean) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(text.trim());
  if (!m || (withTime && m[4] == null)) return '';
  const [, dd, mm, yyyy, hh = '00', mi = '00'] = m;
  const dt = new Date(+yyyy, +mm - 1, +dd, +hh, +mi);
  if (dt.getFullYear() !== +yyyy || dt.getMonth() !== +mm - 1 || dt.getDate() !== +dd || dt.getHours() !== +hh || dt.getMinutes() !== +mi) return '';
  return withTime ? `${yyyy}-${mm}-${dd}T${hh}:${mi}` : `${yyyy}-${mm}-${dd}`;
}

/** "2025-12-31T23:59" → "31/12/2025 23:59" */
function toText(iso: string, withTime?: boolean) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  return withTime ? `${d}/${mo}/${y} ${h ?? pad(0)}:${mi ?? pad(0)}` : `${d}/${mo}/${y}`;
}
