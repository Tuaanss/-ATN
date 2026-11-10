import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Bar, Card, Loading, PageHead, Stat } from '../../components/ui';
import { fmtSize, fullDT } from '../../utils/format';
import { useAdmin } from './kit';

interface Dash {
  semester: string | null;
  todo: { enterprisesPending: number; viewRequests: number; failedFiles: number };
  drive: { lecturers: number; linked: number; notLinked: string[]; errors: { code: string; status: string }[]; nearFull: { code: string; usedPct: number }[] };
  users: { role: 'STUDENT' | 'LECTURER' | 'PARENT' | 'ENTERPRISE'; total: number; active30: number; locked: number }[];
  storage: { fileType: string; bytes: number; files: number }[];
  sync: { synced: number; pending: number; failed: number };
  enterprise: { students: number; withWork: number; discoverable: number; active: number; grants: number; views30d: { views: number; students: number; enterprises: number } };
}

const FT: Record<string, string> = { IMAGE: 'Ảnh', VIDEO: 'Video', SOURCE: 'Mã nguồn', DOCUMENT: 'Báo cáo' };
const n = (v: number) => v.toLocaleString('vi-VN');
/** Thân khối gọn hơn mặc định (20px) để cả trang vừa một màn hình. */
const BODY = { padding: '6px 20px', flex: 1 };
const STATE_COLOR = { red: '#C40000', amber: '#B45309', green: '#15803D' };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const LINK_ERR: Record<string, string> = {
  EXPIRED: 'hết hạn',
  NO_PERMISSION: 'mất quyền ghi',
  NOT_FOUND: 'mất thư mục',
  NOT_SHARED_DRIVE: 'sai loại Drive',
  QUOTA_EXCEEDED: 'hết dung lượng',
};
const ROLE: Record<Dash['users'][number]['role'], [string, IconName, string]> = {
  STUDENT: ['Sinh viên', 'cap', '/admin/students'],
  LECTURER: ['Giảng viên', 'users', '/admin/lecturers'],
  PARENT: ['Phụ huynh', 'user', '/admin/parents'],
  ENTERPRISE: ['Doanh nghiệp', 'building', '/admin/enterprises'],
};
/** Liệt kê tối đa 3 mã, phần còn lại gộp "+N". */
const codes = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} +${xs.length - 3}` : xs.join(', '));

interface Todo {
  icon: IconName;
  label: string;
  count: number;
  detail?: string;
  to: string;
  tone: 'red' | 'amber';
}

/** Một dòng "Cần xử lý": luôn hiện để khối giữ cố định chiều cao, dòng = 0 làm mờ. */
function TodoRow({ t, first }: { t: Todo; first: boolean }) {
  const on = t.count > 0;
  const [bg, fg] = t.tone === 'red' ? ['#FDEDED', '#C40000'] : ['#FEF5E3', '#B45309'];
  return (
    <Link to={t.to} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30, padding: '0 4px', borderTop: first ? undefined : '1px solid #EFEDE6', color: on ? '#1A1C21' : '#A3A6AD', fontSize: 14 }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? bg : '#F4F3EF', color: on ? fg : '#A3A6AD' }}>
        <Icon name={t.icon} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontWeight: on ? 600 : 400, whiteSpace: 'nowrap' }}>{t.label}</span>
        {on && t.detail && (
          <span className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.detail}
          </span>
        )}
      </span>
      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, color: on ? fg : '#A3A6AD' }}>{n(t.count)}</span>
      <Icon name="chevronRight" size={16} />
    </Link>
  );
}

/** Một dòng số liệu cao cố định – hai khối hàng dưới dùng chung để các dòng thẳng hàng nhau. */
function Line({ label, children, ratio, first }: { label: ReactNode; children: ReactNode; ratio?: { value: number; total: number; color: string }; first?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 30, fontSize: 14, borderTop: first ? undefined : '1px solid #EFEDE6' }}>
      <span className="muted" style={{ flex: 1, minWidth: 0 }}>
        {label}
      </span>
      {ratio && <Bar value={pct(ratio.value, ratio.total)} color={ratio.color} width={120} height={8} />}
      <span style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}

/**
 * Tổng quan hệ thống – mẫu admin/Admin_Dashboard.
 * FrameUp là kho lưu bài nộp, không quản lý đào tạo: Admin chỉ theo dõi việc cần duyệt,
 * bài nộp có được lưu an toàn lên Drive không và kết nối với doanh nghiệp (không có tỷ lệ nộp bài).
 */
export function AdminDashboard() {
  useCrumbs([{ label: 'Tổng quan' }]);
  const q = useAdmin<Dash>('/dashboard');
  if (!q.data) return <Loading />;
  const d = q.data;
  const e = d.enterprise;
  const total = d.storage.reduce((a, s) => a + s.bytes, 0);
  const unlinked = d.drive.lecturers - d.drive.linked;
  const todo: Todo[] = [
    { icon: 'warn', label: 'GV lỗi kết nối Drive', count: d.drive.errors.length, detail: codes(d.drive.errors.map((x) => `${x.code} (${LINK_ERR[x.status] ?? x.status})`)), to: '/admin/lecturers?drive=ERR', tone: 'red' },
    { icon: 'drive', label: 'Drive của GV sắp đầy', count: d.drive.nearFull.length, detail: codes(d.drive.nearFull.map((x) => `${x.code} ${x.usedPct}%`)), to: '/admin/lecturers?drive=OK', tone: 'red' },
    { icon: 'refresh', label: 'Tệp đồng bộ Drive bị lỗi', count: d.todo.failedFiles, to: '/admin/logs', tone: 'red' },
    { icon: 'link', label: 'GV chưa liên kết Drive', count: d.drive.notLinked.length, detail: codes(d.drive.notLinked), to: '/admin/lecturers?drive=NONE', tone: 'amber' },
    { icon: 'building', label: 'Doanh nghiệp chờ duyệt tài khoản', count: d.todo.enterprisesPending, to: '/admin/enterprises', tone: 'amber' },
    { icon: 'eye', label: 'Yêu cầu xem bài chờ duyệt', count: d.todo.viewRequests, to: '/admin/view-requests', tone: 'amber' },
  ];
  const pending = todo.reduce((a, t) => a + t.count, 0);
  const storageState = d.sync.failed > 0 ? { value: 'Có lỗi', tone: 'red' as const, sub: `${n(d.sync.failed)} tệp đồng bộ thất bại` } : d.sync.pending > 0 ? { value: 'Đang đồng bộ', tone: 'amber' as const, sub: `${n(d.sync.pending)} tệp đang chờ` } : { value: 'Ổn định', tone: 'green' as const, sub: `${n(d.sync.synced)} tệp đã đồng bộ` };

  return (
    <div className="page">
      <PageHead title="Tổng quan" sub={`${d.semester ? `Học kỳ ${d.semester} · ` : ''}Cập nhật ${fullDT(new Date())}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <Stat label="Trạng thái lưu trữ" value={storageState.value} icon="drive" tone={storageState.tone} sub={storageState.sub} />
        <Stat label="Giảng viên kết nối Drive" value={`${n(d.drive.linked)} / ${n(d.drive.lecturers)}`} icon="link" tone={unlinked > 0 ? 'amber' : 'green'} sub={unlinked > 0 ? `${n(unlinked)} GV chưa liên kết hoặc mất kết nối` : 'Tất cả GV trong học kỳ đã liên kết'} />
        <Stat label="Hồ sơ công khai" value={`${pct(e.discoverable, e.students)}%`} icon="building" tone="blue" sub={`${n(e.discoverable)} / ${n(e.students)} sinh viên`} />
        <Stat label="Yêu cầu xem bài chờ duyệt" value={n(d.todo.viewRequests)} icon="eye" tone={d.todo.viewRequests ? 'red' : 'gray'} sub={d.todo.viewRequests ? 'Cần Admin duyệt' : 'Không có yêu cầu'} />
      </div>

      {/* .cols-2-1 mặc định align-items:start → ép stretch để hai khối cao bằng nhau */}
      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 24, alignItems: 'stretch' }}>
        <Card title="Người dùng" bodyStyle={BODY}>
          {/* các dòng chia đều chiều cao để khối luôn cao bằng "Cần xử lý" */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {d.users.map((u, i) => {
              const [label, icon, to] = ROLE[u.role];
              return (
                <Link key={u.role} to={to} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minHeight: 40, padding: '0 4px', borderTop: i ? '1px solid #EFEDE6' : undefined, color: '#1A1C21' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F4F3EF', color: '#30343B' }}>
                    <Icon name={icon} size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {n(u.active30)} đăng nhập 30 ngày qua
                      {u.locked > 0 && <span style={{ color: '#C40000' }}> · {n(u.locked)} bị khóa</span>}
                    </span>
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{n(u.total)}</span>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card title="Cần xử lý" bodyStyle={BODY} extra={<span style={{ fontSize: 13, fontWeight: 600, color: pending ? '#C40000' : '#15803D' }}>{pending ? `${n(pending)} việc đang chờ` : 'Không có việc tồn đọng'}</span>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {todo.map((t, i) => (
              <TodoRow key={t.label} t={t} first={i === 0} />
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 24 }}>
        <Card title="Tình trạng lưu trữ" bodyStyle={BODY} extra={<span style={{ fontSize: 13, fontWeight: 600, color: STATE_COLOR[storageState.tone] }}>{storageState.value}</span>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Line label="Tổng dung lượng" first>
              {d.storage.length > 0 && (
                <span className="muted" style={{ fontWeight: 400, fontSize: 13, marginRight: 10 }}>
                  {[...d.storage]
                    .sort((a, b) => b.bytes - a.bytes)
                    .map((x) => `${FT[x.fileType] ?? x.fileType} ${fmtSize(x.bytes)}`)
                    .join(' · ')}
                </span>
              )}
              {fmtSize(total)}
            </Line>
            <Line label="Tệp đã đồng bộ">{n(d.sync.synced)}</Line>
            <Line label="Tệp đang chờ đồng bộ">{n(d.sync.pending)}</Line>
            <Line label="Tệp đồng bộ thất bại">{d.sync.failed > 0 ? <Link to="/admin/logs" style={{ color: '#C40000' }}>{n(d.sync.failed)}</Link> : '0'}</Line>
            <Line label="Giảng viên phụ trách trong học kỳ">{n(d.drive.lecturers)}</Line>
          </div>
        </Card>
        <Card
          title="Kết nối doanh nghiệp"
          bodyStyle={BODY}
          extra={
            <Link to="/admin/enterprises/stats" style={{ fontSize: 13 }}>
              Thống kê
            </Link>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Line label="Sinh viên đã có bài nộp" first ratio={{ value: e.withWork, total: e.students, color: '#DB0000' }}>
              {n(e.withWork)} / {n(e.students)}
            </Line>
            <Line label="Sinh viên công khai hồ sơ" ratio={{ value: e.discoverable, total: e.students, color: '#1D4ED8' }}>
              {n(e.discoverable)} / {n(e.students)}
            </Line>
            <Line label="Doanh nghiệp đang hoạt động">{n(e.active)}</Line>
            <Line label="Lượt xem hồ sơ (30 ngày)">
              {n(e.views30d.views)} lượt · {n(e.views30d.students)} SV · {n(e.views30d.enterprises)} DN
            </Line>
            <Line label="Quyền xem bài đang hiệu lực">{n(e.grants)}</Line>
          </div>
        </Card>
      </div>
    </div>
  );
}
