import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import { FullscreenLoading, homeOf, useAuth } from '../auth/auth';
import { Icon } from '../components/Icon';

/** Khung chung cho các trang xác thực (mẫu Auth_ChangePassword / Auth_ForgotPassword). */
function AuthShell({ steps, step, children }: { steps: string[]; step: number; children: ReactNode }) {
  return (
    <div style={{ minHeight: 'var(--vh)', background: '#F5F5F5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 32px', background: '#fff', borderBottom: '1px solid #E3E1D9' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1A1C21' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: '#DB0000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Icon name="logo" size={18} strokeWidth={2} />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>EduPortfolio</span>
        </Link>
      </header>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <span style={{ width: 40, height: 2, background: i <= step ? '#15803D' : '#E3E1D9' }} />}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: i <= step ? '#1A1C21' : '#8A8E97' }}>
                <span className="av" style={{ width: 26, height: 26, fontSize: 12, background: i < step ? '#15803D' : i === step ? '#DB0000' : '#EEEDE7', color: i <= step ? '#fff' : '#62666F' }}>
                  {i < step ? <Icon name="check" size={14} /> : i + 1}
                </span>
                {s}
              </span>
            </span>
          ))}
        </div>
        <div className="card" style={{ width: 460, maxWidth: '100%', padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const RULES: [string, (p: string, cur?: string) => boolean][] = [
  ['Tối thiểu 8 ký tự', (p) => p.length >= 8],
  ['Có cả chữ và số', (p) => /[a-zA-Z]/.test(p) && /\d/.test(p)],
  ['Có chữ hoa và chữ thường', (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
];
const strength = (p: string) => {
  const n = RULES.filter(([, f]) => f(p)).length + (p.length >= 12 ? 1 : 0);
  return n >= 4 ? ['Mạnh', '#15803D'] : n >= 2 ? ['Khá', '#B45309'] : ['Yếu', '#B42318'];
};

function PasswordFields({ next, setNext, again, setAgain, current }: { next: string; setNext: (v: string) => void; again: string; setAgain: (v: string) => void; current?: string }) {
  const [label, color] = strength(next);
  const checks: [string, boolean][] = [
    ...RULES.map(([t, f]) => [t, f(next)] as [string, boolean]),
    ...(current !== undefined ? ([['Khác mật khẩu hiện tại', !!next && next !== current]] as [string, boolean][]) : []),
    ['Khớp mật khẩu nhập lại', !!next && next === again],
  ];
  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label className="lbl" htmlFor="np">
            Mật khẩu mới
          </label>
          {next && <span style={{ fontSize: 12, fontWeight: 600, color }}>Độ mạnh: {label}</span>}
        </div>
        <input id="np" className="inp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} style={{ height: 46 }} />
      </div>
      <div>
        <label className="lbl" htmlFor="np2">
          Nhập lại mật khẩu mới
        </label>
        <input id="np2" className="inp" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} style={{ height: 46 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {checks.map(([t, ok]) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ok ? '#15803D' : '#8A8E97' }}>
            <Icon name={ok ? 'check' : 'close'} size={13} />
            {t}
          </span>
        ))}
      </div>
    </>
  );
}
const valid = (next: string, again: string, current?: string) => next.length >= 8 && /[a-zA-Z]/.test(next) && /\d/.test(next) && next === again && (current === undefined || next !== current);

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: '#FCE8E6', color: '#9B1C12', fontSize: 13 }}>
      <Icon name="warn" size={16} />
      {text}
    </div>
  );
}

/** UC01.4 – Đổi mật khẩu lần đầu (tài khoản do hệ thống cấp). */
export function ChangePasswordPage() {
  const { user, loading, refresh, logout } = useAuth();
  const nav = useNavigate();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <FullscreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mcp) return <Navigate to={homeOf(user.role)} replace />;
  const student = user.role === 'STUDENT';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cur) return setErr('Nhập mật khẩu hiện tại (tạm thời)');
    if (!valid(next, again, cur)) return setErr('Mật khẩu mới chưa đạt yêu cầu');
    setBusy(true);
    setErr(null);
    try {
      await api.post('/account/password', { current: cur, next });
      await refresh();
      nav(student ? '/student/profile' : user.role === 'PARENT' ? '/parent/choose' : homeOf(user.role), { replace: true });
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell steps={student ? ['Đổi mật khẩu', 'Khai báo hồ sơ', 'Bắt đầu sử dụng'] : ['Đổi mật khẩu', 'Bắt đầu sử dụng']} step={0}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Đặt mật khẩu mới</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
            Tài khoản của bạn được hệ thống tạo sẵn. Vì an toàn, bạn cần đổi mật khẩu trước khi tiếp tục.
          </p>
        </div>
        <div>
          <label className="lbl" htmlFor="cp">
            Mật khẩu hiện tại (tạm thời)
          </label>
          <input id="cp" className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} style={{ height: 46 }} autoFocus />
        </div>
        <PasswordFields next={next} setNext={setNext} again={again} setAgain={setAgain} current={cur} />
        <ErrorBox text={err} />
        <button className="btn btn-p" type="submit" style={{ height: 48 }} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Lưu và tiếp tục'}
        </button>
        <button className="btn btn-g" type="button" onClick={() => void logout()} style={{ color: '#62666F' }}>
          Đăng xuất
        </button>
      </form>
    </AuthShell>
  );
}

/** UC01.5 – Quên mật khẩu: bước 1 nhập tài khoản, bước 2 kiểm tra email. */
export function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [sent, setSent] = useState<{ sent: boolean; email: string | null; minutes: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!username.trim()) return setErr('Nhập tên đăng nhập');
    setBusy(true);
    setErr(null);
    try {
      setSent((await api.post('/auth/forgot', { username: username.trim() })).data);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell steps={['Nhập tài khoản', 'Kiểm tra email', 'Đặt mật khẩu mới']} step={sent ? 1 : 0}>
      {!sent ? (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Quên mật khẩu</h1>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
              Nhập tên đăng nhập. Hệ thống gửi liên kết đặt lại mật khẩu tới email bạn đã khai báo.
            </p>
          </div>
          <div>
            <label className="lbl" htmlFor="fu">
              MSSV / mã giảng viên
            </label>
            <input id="fu" className="inp" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="VD: SV0001" style={{ height: 46 }} autoFocus />
          </div>
          <ErrorBox text={err} />
          <button className="btn btn-p" type="submit" style={{ height: 48 }} disabled={busy}>
            {busy ? <span className="spinner" /> : 'Gửi hướng dẫn'}
          </button>
          <Link to="/login" style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            Quay lại đăng nhập
          </Link>
        </form>
      ) : (
        <>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: '#EAF6EC', color: '#15803D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={26} />
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Đã gửi hướng dẫn</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#30343B' }}>
            {sent.sent ? (
              <>
                Liên kết đặt lại mật khẩu đã được gửi tới <b>{sent.email}</b>. Liên kết có hiệu lực trong <b>{sent.minutes} phút</b> và chỉ dùng được một lần.
              </>
            ) : (
              <>Nếu tài khoản tồn tại và đã khai báo email, liên kết đặt lại mật khẩu đã được gửi tới email đó. Chưa khai báo email thì liên hệ Quản trị viên để được đặt lại.</>
            )}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void submit()}>
              Gửi lại
            </button>
            <Link className="btn btn-p" to="/login" style={{ flex: 1 }}>
              Đăng nhập
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}

/** UC01.5 – bước 3: đặt mật khẩu mới từ liên kết trong email. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const token = params.get('token') ?? '';
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(token ? null : 'Liên kết không hợp lệ');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid(next, again)) return setErr('Mật khẩu mới chưa đạt yêu cầu');
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/reset', { token, password: next });
      await api.post('/auth/logout').catch(() => undefined);
      qc.clear();
      setDone(true);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell steps={['Nhập tài khoản', 'Kiểm tra email', 'Đặt mật khẩu mới']} step={done ? 3 : 2}>
      {done ? (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Đã đổi mật khẩu</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>Hãy đăng nhập lại bằng mật khẩu mới.</p>
          <Link className="btn btn-p" to="/login" style={{ height: 46 }}>
            Đăng nhập
          </Link>
        </>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Đặt lại mật khẩu</h1>
          <PasswordFields next={next} setNext={setNext} again={again} setAgain={setAgain} />
          <ErrorBox text={err} />
          <button className="btn btn-p" type="submit" style={{ height: 48 }} disabled={busy || !token}>
            {busy ? <span className="spinner" /> : 'Lưu mật khẩu mới'}
          </button>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
            Sau khi đổi, phiên đăng nhập cũ trên trình duyệt này sẽ được đăng xuất.
          </span>
        </form>
      )}
    </AuthShell>
  );
}
