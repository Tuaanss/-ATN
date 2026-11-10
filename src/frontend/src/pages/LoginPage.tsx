import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { AuthUser } from '../api/types';
import { homeOf, useAuth } from '../auth/auth';
import { Icon, type IconName } from '../components/Icon';

const ROLES = [
  { id: 'sv', label: 'Sinh viên', f: 'Mã số sinh viên', p: 'VD: SV0001', h: 'Lần đầu đăng nhập, bạn sẽ được yêu cầu đổi mật khẩu và khai báo hồ sơ.' },
  { id: 'gv', label: 'Giảng viên', f: 'Mã giảng viên', p: 'VD: GV001', h: 'Tài khoản do Quản trị viên cấp.' },
  { id: 'ad', label: 'Quản trị', f: 'Tên đăng nhập', p: 'admin', h: 'Chỉ dành cho quản trị hệ thống.' },
  { id: 'ph', label: 'Phụ huynh', f: 'Số điện thoại', p: 'VD: 09xx xxx xxx', h: 'Dùng SĐT mà con bạn đã khai báo. Mật khẩu ban đầu là SĐT, bắt buộc đổi ở lần đầu.' },
  { id: 'dn', label: 'Doanh nghiệp', f: 'Email doanh nghiệp', p: 'hr@congty.vn', h: 'Tài khoản do khoa cấp. Lần đầu đăng nhập, bạn sẽ được yêu cầu đổi mật khẩu.' },
];

interface Pitch {
  tag: string;
  title: string;
  desc: string;
  features: [IconName, string, string][];
  steps: string[];
}

/** Nội dung khung bên trái theo vai trò đang chọn. */
const PITCH: Record<string, Pitch> = {
  sv: {
    tag: 'Dành cho sinh viên',
    title: 'Mọi sản phẩm học tập, một nơi.',
    desc: 'Nhận bài, nộp sản phẩm, xem điểm.',
    features: [
      ['image', 'Nộp đa phương tiện', 'Ảnh, Figma, video, báo cáo'],
      ['code', 'Mã nguồn', 'ZIP hoặc link GitHub'],
      ['users', 'Nhóm của mình', 'Do giảng viên xếp'],
      ['tag', 'Đề tài', 'Tự nhập, không chờ duyệt'],
      ['chart', 'Điểm bài tập', 'Từng bài, từng kỳ'],
      ['building', 'Hồ sơ năng lực', 'Cho doanh nghiệp tìm'],
    ],
    steps: ['Nhận bài', 'Nhập đề tài', 'Nộp bài', 'Xem điểm'],
  },
  gv: {
    tag: 'Dành cho giảng viên',
    title: 'Giao bài, chấm bài, gọn một trang.',
    desc: 'Bài nộp tự lưu vào Google Drive của bạn.',
    features: [
      ['plus', 'Giao nhiều lớp', 'Một lần, hạn riêng từng lớp'],
      ['users', 'Nhóm bằng Excel', 'Tải mẫu, điền, áp dụng'],
      ['drive', 'Google Drive', 'Thư mục tự tạo'],
      ['eye', 'Xem bài', 'Ảnh, video, Figma'],
      ['listAlt', 'Điểm bằng Excel', 'Kiểm tra lỗi, công bố'],
      ['search', 'Tìm bài nộp', 'Theo đề tài, tên, MSV'],
    ],
    steps: ['Giao bài', 'Xếp nhóm', 'Xem bài', 'Công bố điểm'],
  },
  ad: {
    tag: 'Dành cho quản trị viên',
    title: 'Vận hành toàn hệ thống.',
    desc: 'Tài khoản, đào tạo, duyệt và giám sát.',
    features: [
      ['users', 'Người dùng', 'GV, SV, phụ huynh'],
      ['grid', 'Đào tạo', 'Học kỳ, môn, lớp học phần'],
      ['building', 'Doanh nghiệp', 'Duyệt tài khoản'],
      ['edit', 'Sửa điểm', 'Duyệt yêu cầu của GV'],
      ['settings', 'Cấu hình', 'Tệp, thang điểm, bảo mật'],
      ['shield', 'Nhật ký', 'Mọi thao tác quan trọng'],
    ],
    steps: ['Tạo tài khoản', 'Xếp lớp', 'Duyệt yêu cầu', 'Theo dõi'],
  },
  ph: {
    tag: 'Dành cho phụ huynh',
    title: 'Đồng hành cùng con học tập.',
    desc: 'Đăng nhập bằng SĐT con đã khai báo.',
    features: [
      ['chart', 'Điểm bài tập', 'Từng bài, từng kỳ'],
      ['image', 'Bài con nộp', 'Chỉ xem'],
      ['warn', 'Cảnh báo', 'Điểm thấp, quá hạn'],
      ['bell', 'Thông báo', 'Khi có điểm mới'],
      ['users', 'Nhiều con', 'Một tài khoản'],
      ['lock', 'An toàn', 'Chỉ đọc dữ liệu'],
    ],
    steps: ['Con khai SĐT', 'Đăng nhập', 'Đổi mật khẩu', 'Theo dõi'],
  },
  dn: {
    tag: 'Dành cho doanh nghiệp',
    title: 'Tìm tài năng qua sản phẩm thật.',
    desc: 'Tài khoản do khoa cấp sau khi liên hệ.',
    features: [
      ['search', 'Tìm kỹ năng', 'Ngành, khóa, công nghệ'],
      ['user', 'Hồ sơ năng lực', 'GitHub, Behance'],
      ['eye', 'Bài nộp thật', 'Ảnh, video, prototype'],
      ['trend', 'Xu hướng', 'Kỹ năng theo khóa'],
      ['clock', 'Quyền có hạn', '14–28 ngày'],
      ['shield', 'Bảo vệ SV', 'Ẩn liên hệ, không tải'],
    ],
    steps: ['Liên hệ khoa', 'Nhận tài khoản', 'Tìm sinh viên', 'Xem bài'],
  },
};

/** Đăng nhập – mẫu chung/Auth_Login. */
export function LoginPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [role, setRole] = useState('sv');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const d = ROLES.find((r) => r.id === role)!;
  const pitch = PITCH[role];

  if (user) return <Navigate to={homeOf(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Nhập tên đăng nhập và mật khẩu');
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{ user: AuthUser }>('/auth/login', { username, password });
      // lấy trạng thái mới nhất (đổi mật khẩu lần đầu, hồ sơ) trước khi chuyển trang
      const me = await qc.fetchQuery({ queryKey: ['me'], queryFn: () => api.get<{ user: AuthUser | null }>('/auth/me').then((r) => r.data.user), staleTime: 0 });
      if (me?.mcp) return nav('/change-password', { replace: true });
      // phụ huynh có nhiều con: chọn con trước khi xem
      if (data.user.role === 'PARENT') {
        const kids = await api.get<{ children: unknown[] }>('/parent/children').then((r) => r.data.children.length).catch(() => 0);
        return nav(kids > 1 ? '/parent/choose' : '/parent', { replace: true });
      }
      const next = params.get('next');
      nav(next && next.startsWith(homeOf(data.user.role)) ? next : homeOf(data.user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'var(--vh)', display: 'flex', background: '#F5F5F5' }} className="login">
      <div className="login-brand" style={{ width: 640, flexShrink: 0, background: '#DB0000', color: '#fff', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#DB0000' }}>
            <Icon name="logo" size={18} strokeWidth={2} />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>FrameUp</span>
        </Link>
        <div key={role} className="login-pitch" style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, justifyContent: 'center' }}>
          <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.18)' }}>{pitch.tag}</span>
          <h1 style={{ fontSize: 40, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-.02em', textWrap: 'balance' }}>{pitch.title}</h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: 'rgba(255,255,255,.9)', marginTop: -8 }}>{pitch.desc}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gridAutoRows: '1fr', gap: 14 }}>
            {pitch.features.map(([icon, title, sub]) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 18px', minHeight: 88, borderRadius: 14, background: 'rgba(255,255,255,.13)' }}>
                <span style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(255,255,255,.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={icon} size={22} />
                </span>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,.82)' }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', paddingTop: 6 }}>
            {pitch.steps.map((st, i) => (
              <div key={st} style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                {i < pitch.steps.length - 1 && <span style={{ position: 'absolute', top: 12, left: 32, right: 8, height: 1, background: 'rgba(255,255,255,.4)' }} />}
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', color: '#DB0000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, paddingRight: 10 }}>{st}</span>
              </div>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>FrameUp · Phiên bản 1.1</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <form onSubmit={submit} style={{ width: 460, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 22 }} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700 }}>Đăng nhập</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              Chọn vai trò của bạn để đăng nhập đúng cách.
            </p>
          </div>
          <div role="tablist" aria-label="Vai trò" style={{ display: 'flex', padding: 4, background: '#ECEBE4', borderRadius: 10, gap: 2 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === role}
                onClick={() => setRole(r.id)}
                style={{
                  flex: '1 1 auto',
                  height: 36,
                  padding: '0 8px',
                  whiteSpace: 'nowrap',
                  border: 0,
                  borderRadius: 8,
                  background: r.id === role ? '#fff' : 'transparent',
                  font: "600 12px 'Be Vietnam Pro',sans-serif",
                  color: r.id === role ? '#1A1C21' : '#4A4E57',
                  boxShadow: r.id === role ? '0 1px 2px rgba(0,0,0,.1)' : undefined,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div>
            <label className="lbl" htmlFor="u">
              {d.f}
            </label>
            <input id="u" className="inp" placeholder={d.p} style={{ height: 46 }} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            <div className="help">{d.h}</div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="lbl" htmlFor="p">
                Mật khẩu
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600 }}>
                Quên mật khẩu?
              </Link>
            </div>
            <input id="p" className="inp" type="password" style={{ height: 46 }} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 8, background: '#FDF0DE', color: '#8A3B06', fontSize: 13, lineHeight: 1.5 }} role="alert">
              <Icon name="warn" size={18} />
              <span>{error}. Sau 5 lần sai liên tiếp, tài khoản sẽ bị khóa tạm thời 15 phút.</span>
            </div>
          ) : null}
          <button className="btn btn-p" type="submit" style={{ height: 48, fontSize: 15 }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Đăng nhập'}
          </button>
          {role === 'dn' && (
            <p style={{ fontSize: 14, textAlign: 'center' }} className="muted">
              Chưa có tài khoản? Liên hệ khoa để được cấp tài khoản doanh nghiệp.
            </p>
          )}
        </form>
      </div>
      <style>{`@media (max-width:960px){.login .login-brand{display:none!important}}.login-pitch{animation:pitchIn .35s ease}@keyframes pitchIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
