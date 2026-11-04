import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Bar, Card, Empty, Loading, Note, PageHead, RowKV, Stat } from '../../components/ui';
import { fmtSize, fullDT } from '../../utils/format';
import { Columns, HBars, useAdmin } from './kit';

interface Dash {
  semester: string | null;
  todo: { enterprisesPending: number; viewRequests: number; gradeRequests: number; driveErrors: { code: string; fullName: string; status: string }[]; failedFiles: number };
  drive: { lecturers: number; linked: number };
  weeks: { from: string; count: number }[];
  storage: { fileType: string; bytes: number; files: number }[];
  sync: { synced: number; pending: number; failed: number };
  enterprise: { students: number; withWork: number; discoverable: number; active: number; grants: number; views30d: { views: number; students: number; enterprises: number } };
}

const FT: Record<string, string> = { IMAGE: 'Ảnh', VIDEO: 'Video', SOURCE: 'Mã nguồn', DOCUMENT: 'Báo cáo' };
const n = (v: number) => v.toLocaleString('vi-VN');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Thanh tỷ lệ có nhãn (khối "Kết nối doanh nghiệp"). */
function Ratio({ label, value, total, color }: { label: ReactNode; value: number; total: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span className="muted">{label}</span>
        <b>
          {n(value)} / {n(total)}
        </b>
      </div>
      <Bar value={pct(value, total)} color={color} height={8} />
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
  const todo = [
    d.todo.enterprisesPending > 0 && { to: '/admin/enterprises', text: `${d.todo.enterprisesPending} doanh nghiệp chờ duyệt tài khoản` },
    d.todo.viewRequests > 0 && { to: '/admin/view-requests', text: `${d.todo.viewRequests} yêu cầu xem bài chờ duyệt` },
    d.todo.gradeRequests > 0 && { to: '/admin/grade-requests', text: `${d.todo.gradeRequests} yêu cầu sửa điểm chờ duyệt` },
    d.todo.driveErrors.length > 0 && { to: '/admin/lecturers', text: `${d.todo.driveErrors.length} giảng viên mất kết nối Google Drive (${d.todo.driveErrors.map((x) => x.code).join(', ')})` },
    d.todo.failedFiles > 0 && { to: '/admin/logs', text: `${d.todo.failedFiles} tệp đồng bộ Drive bị lỗi` },
  ].filter(Boolean) as { to: string; text: string }[];
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

      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 24 }}>
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
        <Card title="Bài nộp theo tuần">
          {d.weeks.some((w) => w.count) ? (
            <Columns data={d.weeks.map((w, i) => ({ label: `T${i + 1}`, value: w.count, title: `Tuần từ ${new Date(w.from).toLocaleDateString('vi-VN')}: ${w.count} bài` }))} height={200} />
          ) : (
            <Empty icon="chart">Chưa có bài nộp trong 8 tuần gần đây.</Empty>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 24 }}>
        <Card title="Tình trạng lưu trữ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {d.sync.failed > 0 ? (
              <Note tone="red" icon="warn">
                {n(d.sync.failed)} tệp chưa lên được Google Drive. <Link to="/admin/logs">Xem nhật ký</Link>
              </Note>
            ) : d.sync.pending > 0 ? (
              <Note tone="amber" icon="refresh">
                {n(d.sync.pending)} tệp đang chờ đồng bộ lên Google Drive.
              </Note>
            ) : (
              <Note tone="green" icon="check">
                Toàn bộ tệp bài nộp đã được đồng bộ lên Google Drive.
              </Note>
            )}
            <div>
              <RowKV label="Tổng dung lượng">
                <b>{fmtSize(total)}</b>
              </RowKV>
              <RowKV label="Đã đồng bộ">{n(d.sync.synced)}</RowKV>
              <RowKV label="Đang đồng bộ">{n(d.sync.pending)}</RowKV>
              <RowKV label="Đồng bộ thất bại">{n(d.sync.failed)}</RowKV>
              <RowKV label="Giảng viên phụ trách trong học kỳ">{n(d.drive.lecturers)}</RowKV>
            </div>
            {d.storage.length > 0 && <HBars labelWidth={80} data={[...d.storage].sort((a, b) => b.bytes - a.bytes).map((s) => ({ label: FT[s.fileType] ?? s.fileType, value: s.bytes, text: fmtSize(s.bytes) }))} />}
          </div>
        </Card>
        <Card title="Kết nối doanh nghiệp">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Ratio label="Sinh viên đã có bài nộp" value={e.withWork} total={e.students} color="#DB0000" />
            <Ratio label="Sinh viên công khai hồ sơ" value={e.discoverable} total={e.students} color="#1D4ED8" />
            <div>
              <RowKV label="Doanh nghiệp đang hoạt động">{n(e.active)}</RowKV>
              <RowKV label="Lượt xem hồ sơ (30 ngày)">
                {n(e.views30d.views)} lượt · {n(e.views30d.students)} SV · {n(e.views30d.enterprises)} DN
              </RowKV>
              <RowKV label="Quyền xem bài đang hiệu lực">{n(e.grants)}</RowKV>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
