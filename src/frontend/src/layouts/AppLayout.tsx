import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../auth/auth';
import { Icon, type IconName } from '../components/Icon';
import { initials } from '../components/ui';
import { useChild } from '../pages/parent/child';

// ---------------------------------------------------------------- đường dẫn (breadcrumb) trên header

export interface Crumb {
  label: string;
  to?: string;
}
const CrumbCtx = createContext<(c: Crumb[]) => void>(() => undefined);

/** Trang khai báo phần đường dẫn sau "Vai trò /" (mẫu: "Giảng viên / Lớp học phần / MH01_02 · Môn học 1 / Bài tập 2"). */
export function useCrumbs(crumbs: Crumb[]) {
  const set = useContext(CrumbCtx);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set(JSON.parse(key));
  }, [key, set]);
}

// ---------------------------------------------------------------- menu theo vai trò (đúng mẫu)

type Role3 = 'LECTURER' | 'STUDENT' | 'ADMIN' | 'PARENT' | 'ENTERPRISE';
const NAV: Record<Role3, { to: string; label: string; icon: IconName; end?: boolean; match?: RegExp; group?: string }[]> = {
  LECTURER: [
    { to: '/lecturer', label: 'Tổng quan', icon: 'home', end: true },
    { to: '/lecturer/sections', label: 'Lớp học phần', icon: 'grid', match: /^\/lecturer\/(sections|assignments\/(?!new))/ },
    { to: '/lecturer/assignments/new', label: 'Tạo bài tập', icon: 'plus' },
    { to: '/lecturer/gradebook', label: 'Bảng điểm', icon: 'list' },
    { to: '/lecturer/search', label: 'Tìm kiếm bài nộp', icon: 'search' },
    { to: '/lecturer/stats', label: 'Thống kê & xu hướng', icon: 'trend' },
    { to: '/lecturer/drive', label: 'Kết nối Google Drive', icon: 'drive' },
  ],
  STUDENT: [
    { to: '/student', label: 'Tổng quan', icon: 'home', end: true },
    { to: '/student/assignments', label: 'Bài tập của tôi', icon: 'list', match: /^\/student\/(assignments|courses)/ },
    { to: '/student/grades', label: 'Kết quả học tập', icon: 'chart' },
    { to: '/student/privacy', label: 'Doanh nghiệp & riêng tư', icon: 'shield' },
    { to: '/student/profile', label: 'Hồ sơ cá nhân', icon: 'user' },
  ],
  ENTERPRISE: [
    { to: '/enterprise/search', label: 'Tìm kiếm sinh viên', icon: 'search' },
    { to: '/enterprise/students', label: 'Hồ sơ sinh viên', icon: 'user' },
    { to: '/enterprise/grants', label: 'Bài được cấp quyền', icon: 'eye' },
    { to: '/enterprise/talent-map', label: 'Bản đồ năng lực', icon: 'trend' },
    { to: '/enterprise', label: 'Yêu cầu & thống kê', icon: 'chart', end: true },
  ],
  PARENT: [
    { to: '/parent', label: 'Điểm, GPA & CPA', icon: 'chart', end: true },
    { to: '/parent/submissions', label: 'Bài nộp của con', icon: 'image' },
    { to: '/parent/notifications', label: 'Thông báo & cảnh báo', icon: 'bell' },
    { to: '/parent/account', label: 'Đổi mật khẩu', icon: 'key' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Tổng quan', icon: 'home', end: true },
    { to: '/admin/lecturers', label: 'Giảng viên', icon: 'users', group: 'Người dùng' },
    { to: '/admin/students', label: 'Sinh viên', icon: 'cap' },
    { to: '/admin/parents', label: 'Phụ huynh', icon: 'user' },
    { to: '/admin/enterprises', label: 'Doanh nghiệp', icon: 'building', end: true },
    { to: '/admin/enterprises/stats', label: 'Thống kê doanh nghiệp', icon: 'chart' },
    { to: '/admin/view-requests', label: 'Yêu cầu xem bài', icon: 'eye' },
    { to: '/admin/catalog', label: 'Danh mục', icon: 'tag', group: 'Đào tạo' },
    { to: '/admin/semesters', label: 'Học kỳ & môn học', icon: 'calendar' },
    { to: '/admin/sections', label: 'Lớp học phần', icon: 'grid' },
    { to: '/admin/grade-requests', label: 'Yêu cầu sửa điểm', icon: 'edit' },
    { to: '/admin/logs', label: 'Nhật ký hệ thống', icon: 'list', group: 'Hệ thống' },
    { to: '/admin/config', label: 'Cấu hình', icon: 'settings' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [open, setOpen] = useState(false);
  const role = user!.role as Role3;
  const home = role === 'LECTURER' ? '/lecturer' : role === 'ADMIN' ? '/admin' : role === 'PARENT' ? '/parent' : role === 'ENTERPRISE' ? '/enterprise' : '/student';
  const roleLabel = role === 'LECTURER' ? 'Giảng viên' : role === 'ADMIN' ? 'Quản trị' : role === 'PARENT' ? 'Phụ huynh' : role === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Sinh viên';

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const unread = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.get<{ unread: number }>('/notifications?limit=1').then((r) => r.data.unread),
    refetchInterval: 30_000,
    enabled: role !== 'PARENT',
  });

  const sub = role === 'LECTURER' ? user!.code ?? '' : role === 'ADMIN' ? 'Quản trị viên' : role === 'PARENT' ? 'Phụ huynh' : role === 'ENTERPRISE' ? 'Doanh nghiệp' : `MSSV ${user!.code ?? ''}`;

  return (
    <CrumbCtx.Provider value={setCrumbs}>
      <div className={`shell${open ? ' nav-open' : ''}`}>
        <div className="backdrop" onClick={() => setOpen(false)} />
        <aside className="aside">
          <div style={{ padding: '0 6px' }}>
            <Link to={home} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1A1C21' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: '#DB0000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Icon name="logo" size={18} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>EduPortfolio</span>
            </Link>
          </div>
          <div style={{ padding: '0 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A8E97' }}>{roleLabel}</div>
          {role === 'PARENT' && <ChildSwitcher />}
          <nav className="nav" aria-label="Điều hướng chính" style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: -12 }}>
            {NAV[role].map((n) => {
              const on = n.match ? n.match.test(loc.pathname) : n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
              return (
                <span key={n.to} style={{ display: 'contents' }}>
                  {n.group && <div style={{ padding: '14px 12px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#A3A6AD' }}>{n.group}</div>}
                  <NavLink to={n.to} end={n.end} className={on ? 'on' : ''}>
                    <Icon name={n.icon} size={18} />
                    <span>{n.label}</span>
                  </NavLink>
                </span>
              );
            })}
          </nav>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, background: '#F5F5F5' }}>
            <span className="av" style={{ width: 36, height: 36, background: '#DB0000', color: '#fff', fontSize: 13 }}>
              {role === 'ADMIN' ? 'AD' : initials(user!.name)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user!.name}</span>
              <span style={{ fontSize: 12, color: '#62666F' }}>{sub}</span>
            </div>
            <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={logout} style={{ color: '#62666F', background: 'none', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
              <Icon name="logout" size={18} />
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <button type="button" className="btn btn-g menu-btn" aria-label="Mở menu" style={{ width: 40, padding: 0 }} onClick={() => setOpen(true)}>
              <Icon name="listAlt" size={20} />
            </button>
            <div style={{ fontSize: 13, color: '#62666F', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Link to={home} style={{ color: '#62666F' }}>
                {roleLabel}
              </Link>
              {crumbs.map((c, i) => (
                <span key={i}>
                  {' '}
                  <span style={{ color: '#B5B2A8' }}>/</span>{' '}
                  {i === crumbs.length - 1 || !c.to ? (
                    <span style={{ color: i === crumbs.length - 1 ? '#1A1C21' : undefined, fontWeight: i === crumbs.length - 1 ? 600 : undefined }}>{c.label}</span>
                  ) : (
                    <Link to={c.to} style={{ color: '#62666F' }}>
                      {c.label}
                    </Link>
                  )}
                </span>
              ))}
            </div>
            <form
              className="search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get('q')?.toString().trim();
                const qs = q ? `?q=${encodeURIComponent(q)}` : '';
                nav(role === 'LECTURER' ? `/lecturer/search${qs}` : role === 'ADMIN' ? `/admin/students${qs}` : role === 'PARENT' ? `/parent/submissions${qs}` : role === 'ENTERPRISE' ? `/enterprise/search${qs}` : `/student/assignments${qs}`);
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 300, height: 38, border: '1px solid #E3E1D9', borderRadius: 8, padding: '0 12px', color: '#62666F', background: '#FAFAF7' }}>
                <Icon name="search" size={16} />
                <input name="q" aria-label="Tìm kiếm" placeholder="Tìm kiếm…" style={{ border: 0, outline: 0, background: 'transparent', font: "400 14px 'Be Vietnam Pro',sans-serif", flex: 1, minWidth: 0 }} />
              </label>
            </form>
            {role === 'PARENT' ? (
              <ParentBell />
            ) : (
            <Link
              className="btn btn-g"
              to={`${home}/notifications`}
              aria-label={`Thông báo${unread.data ? `, ${unread.data} chưa đọc` : ''}`}
              style={{ position: 'relative', width: 40, padding: 0 }}
            >
              <Icon name="bell" size={20} />
              {!!unread.data && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: '#C2410C', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {unread.data > 99 ? '99+' : unread.data}
                </span>
              )}
            </Link>
            )}
            {role === 'ENTERPRISE' ? (
              <Link to="/enterprise/account" aria-label="Tài khoản" title={user!.name}>
                <span className="av" style={{ width: 36, height: 36, background: '#EFE9FD', color: '#5B21B6', fontSize: 13 }}>
                  <Icon name="building" size={18} />
                </span>
              </Link>
            ) : role === 'PARENT' ? (
              <Link to="/parent/account" aria-label="Đổi mật khẩu" title={user!.name}>
                <span className="av" style={{ width: 36, height: 36, background: '#FBE3E3', color: '#A30000', fontSize: 13 }}>
                  <Icon name="user" size={18} />
                </span>
              </Link>
            ) : role === 'ADMIN' ? (
              <span className="av" title={user!.name} style={{ width: 36, height: 36, background: '#FBE3E3', color: '#A30000', fontSize: 13 }}>
                AD
              </span>
            ) : role === 'STUDENT' ? (
              <Link to="/student/profile" aria-label="Hồ sơ cá nhân" title={user!.name}>
                {user!.hasAvatar ? (
                  <img src={`/api/v1/account/avatar/${user!.studentId}?v=${user!.avatarVersion ?? 0}`} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <span className="av" style={{ width: 36, height: 36, background: '#FBE3E3', color: '#A30000', fontSize: 13 }}>
                    {initials(user!.name)}
                  </span>
                )}
              </Link>
            ) : (
              <Link to="/lecturer/account" aria-label="Tài khoản & bảo mật" title={user!.name}>
                <span className="av" style={{ width: 36, height: 36, background: '#FBE3E3', color: '#A30000', fontSize: 13 }}>
                  {initials(user!.name)}
                </span>
              </Link>
            )}
          </header>
          <Outlet />
        </main>
      </div>
    </CrumbCtx.Provider>
  );
}

/** Thanh bên của phụ huynh: chuyển giữa các con đã liên kết. */
function ChildSwitcher() {
  const { kids, child, select } = useChild();
  if (!kids.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -10 }}>
      <span style={{ padding: '0 12px', fontSize: 12, color: '#62666F' }}>{kids.length > 1 ? `Đang xem (${kids.length} con)` : 'Đang xem'}</span>
      {kids.map((k) => {
        const on = k.id === child?.id;
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => select(k.id)}
            aria-pressed={on}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: `1px solid ${on ? '#F2AAAA' : '#E3E1D9'}`, background: on ? '#FFF4F4' : '#fff', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          >
            <span className="av" style={{ width: 32, height: 32, fontSize: 12, background: on ? '#DB0000' : '#FBE3E3', color: on ? '#fff' : '#A30000' }}>
              {initials(k.fullName)}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.fullName}</b>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {k.studentCode}
              </span>
            </span>
            {k.warnings > 0 && <span title={`${k.warnings} cảnh báo`} style={{ width: 8, height: 8, borderRadius: '50%', background: '#B42318' }} />}
          </button>
        );
      })}
      {kids.length > 1 && (
        <Link to="/parent/choose" style={{ padding: '2px 12px', fontSize: 12 }}>
          Xem tổng quan các con
        </Link>
      )}
    </div>
  );
}

function ParentBell() {
  const { child } = useChild();
  const q = useQuery({
    queryKey: ['parent', 'unread', child?.id],
    queryFn: () => api.get<{ unread: number }>(`/parent/unread?child=${child!.id}`).then((r) => r.data.unread),
    enabled: !!child,
    refetchInterval: 60_000,
  });
  const n = q.data ?? 0;
  return (
    <Link className="btn btn-g" to="/parent/notifications" aria-label={`Thông báo${n ? `, ${n} chưa đọc` : ''}`} style={{ position: 'relative', width: 40, padding: 0 }}>
      <Icon name="bell" size={20} />
      {n > 0 && (
        <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: '#C2410C', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {n > 99 ? '99+' : n}
        </span>
      )}
    </Link>
  );
}

/** Trang cho mục menu chưa có chức năng – giữ nguyên khung giao diện. */
export function ComingSoon({ title }: { title: string }) {
  useCrumbs([{ label: title }]);
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="h1">{title}</h1>
      </div>
      <div className="card" style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: '#F1F0EA', color: '#30343B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="clock" size={24} />
        </span>
        <b>Chức năng đang được phát triển</b>
        <span className="muted" style={{ fontSize: 14 }}>
          Mục này sẽ có trong phiên bản tiếp theo.
        </span>
      </div>
    </div>
  );
}

