import { Link } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Card, Empty, Loading, PageHead, Stat } from '../../components/ui';
import { fmtSize, fullDT } from '../../utils/format';
import { Columns, HBars, useAdmin } from './kit';

interface Dash {
  semester: string | null;
  counts: { students: number; lecturers: number; parents: number; enterprises: number; enterprisesPending: number; viewRequestsPending: number };
  weeks: { from: string; count: number }[];
  todo: { enterprisesPending: number; viewRequests: number; gradeRequests: number; driveErrors: { code: string; fullName: string; status: string }[]; failedFiles: number };
  topKeywords: { label: string; count: number }[];
  topics: number;
  storage: { fileType: string; bytes: number; files: number }[];
  sync: { synced: number; pending: number; failed: number };
  activeUsers: { date: string; users: number }[];
  activeUsers7d: number;
}

const FT: Record<string, string> = { IMAGE: 'Ảnh', VIDEO: 'Video', SOURCE: 'Mã nguồn', DOCUMENT: 'Báo cáo' };
const DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const n = (v: number) => v.toLocaleString('vi-VN');

/** Tổng quan hệ thống – mẫu admin/Admin_Dashboard. */
export function AdminDashboard() {
  useCrumbs([{ label: 'Tổng quan' }]);
  const q = useAdmin<Dash>('/dashboard');
  if (!q.data) return <Loading />;
  const d = q.data;
  const total = d.storage.reduce((a, s) => a + s.bytes, 0);
  const todo = [
    d.todo.enterprisesPending > 0 && { to: '/admin/enterprises', text: `${d.todo.enterprisesPending} doanh nghiệp chờ duyệt tài khoản` },
    d.todo.viewRequests > 0 && { to: '/admin/view-requests', text: `${d.todo.viewRequests} yêu cầu xem bài chờ duyệt` },
    d.todo.gradeRequests > 0 && { to: '/admin/grade-requests', text: `${d.todo.gradeRequests} yêu cầu sửa điểm chờ duyệt` },
    d.todo.driveErrors.length > 0 && { to: '/admin/lecturers', text: `${d.todo.driveErrors.length} giảng viên mất kết nối Google Drive (${d.todo.driveErrors.map((x) => x.code).join(', ')})` },
    d.todo.failedFiles > 0 && { to: '/admin/logs', text: `${d.todo.failedFiles} tệp đồng bộ Drive bị lỗi` },
  ].filter(Boolean) as { to: string; text: string }[];

  return (
    <div className="page">
      <PageHead title="Tổng quan hệ thống" sub={`Cập nhật ${fullDT(new Date())}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        <Stat label="Sinh viên" value={n(d.counts.students)} icon="cap" tone="red" />
        <Stat label="Giảng viên" value={n(d.counts.lecturers)} icon="users" tone="green" />
        <Stat label="Phụ huynh" value={n(d.counts.parents)} icon="user" tone="amber" sub="tự sinh từ hồ sơ SV" />
        <Stat label="Doanh nghiệp" value={n(d.counts.enterprises)} icon="building" tone="blue" sub={`${d.counts.enterprisesPending} chờ duyệt`} />
        <Stat label="Yêu cầu xem bài chờ" value={n(d.counts.viewRequestsPending)} icon="eye" tone="red" />
      </div>

      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 24 }}>
        <Card title={`Bài nộp theo tuần${d.semester ? ` · ${d.semester}` : ''}`}>
          {d.weeks.some((w) => w.count) ? (
            <Columns data={d.weeks.map((w, i) => ({ label: `T${i + 1}`, value: w.count, title: `Tuần từ ${new Date(w.from).toLocaleDateString('vi-VN')}: ${w.count} bài` }))} height={220} />
          ) : (
            <Empty icon="chart">Chưa có bài nộp trong 8 tuần gần đây.</Empty>
          )}
        </Card>
        <Card title="Cần xử lý">
          {todo.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todo.map((t) => (
                <Link key={t.text} to={t.to} style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#1A1C21', fontSize: 14, minHeight: 36 }}>
                  <span style={{ flex: 1 }}>{t.text}</span>
                  <span style={{ color: '#8A8E97', display: 'inline-flex' }}>
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon="check">Không có việc nào cần xử lý.</Empty>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
        <Card title="Top chủ đề đề tài">
          {d.topKeywords.length ? <HBars data={d.topKeywords.map((k) => ({ label: k.label, value: k.count }))} /> : <Empty icon="tag">Chưa có đề tài nào.</Empty>}
        </Card>
        <Card title="Lưu trữ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{fmtSize(total)}</div>
            <span className="muted" style={{ fontSize: 13 }}>
              Tổng dung lượng tệp bài nộp của {n(d.counts.lecturers)} giảng viên
            </span>
            {d.storage.length > 0 && <HBars labelWidth={80} data={[...d.storage].sort((a, b) => b.bytes - a.bytes).map((s) => ({ label: FT[s.fileType] ?? s.fileType, value: s.bytes, text: fmtSize(s.bytes) }))} />}
            <span className="muted" style={{ fontSize: 12 }}>
              {n(d.sync.pending)} tệp đang chờ đồng bộ · {n(d.sync.failed)} lỗi
            </span>
          </div>
        </Card>
        <Card title="Người dùng hoạt động 7 ngày">
          <Columns data={d.activeUsers.map((a) => ({ label: DAY[new Date(a.date).getDay()], value: a.users, title: `${new Date(a.date).toLocaleDateString('vi-VN')}: ${a.users} người` }))} height={140} />
          <span className="muted" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>
            {n(d.activeUsers7d)} người dùng khác nhau đã đăng nhập
          </span>
        </Card>
      </div>
    </div>
  );
}
