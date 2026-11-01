import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth/auth';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Bar, Card, Empty, Loading, PageHead, Stat } from '../../components/ui';
import { semesterLabel } from '../../utils/format';

interface Data {
  semester: { term: string; academicYear: string } | null;
  totals: { sections: number; students: number };
  driveAlert: { assignmentId: string; assignment: string; section: string; submissions: number } | null;
  stats: { newSubmissions: number; openAssignments: number; openReports: number; noGroups: number; ungraded: number };
  sections: { id: string; code: string; course: string; students: number; assignments: number; open: number; latest: { title: string; submitted: number; expected: number } | null }[];
  todo: { kind: 'report' | 'group' | 'grade' | 'sync'; title: string; sub: string; link: string }[];
  histogram: { title: string; bins: { label: string; count: number }[] } | null;
  interest: { code: string; count: number }[];
}

const TODO_ICON: Record<Data['todo'][number]['kind'], [IconName, string]> = {
  report: ['warn', '#B42318'],
  group: ['users', '#B45309'],
  grade: ['listAlt', '#1D4ED8'],
  sync: ['drive', '#B42318'],
};

/** Tổng quan giảng viên – mẫu giang-vien/GV_Dashboard. */
export function LecturerDashboard() {
  const { user } = useAuth();
  useCrumbs([{ label: 'Tổng quan' }]);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'lecturer'], queryFn: () => api.get<Data>('/dashboard/lecturer').then((r) => r.data) });
  if (isLoading || !data) return <Loading />;
  const s = data.stats;
  const maxBin = Math.max(1, ...(data.histogram?.bins.map((b) => b.count) ?? [1]));
  const peak = data.histogram?.bins.reduce((p, b) => (b.count > p.count ? b : p), data.histogram.bins[0]);

  return (
    <div className="page">
      <PageHead
        title={`Chào ${user?.name}`}
        sub={`${semesterLabel(data.semester)} · ${data.totals.sections} lớp học phần · ${data.totals.students} sinh viên`}
        actions={
          <Link className="btn btn-p" to="/lecturer/assignments/new">
            <Icon name="plus" size={16} />
            Tạo bài tập
          </Link>
        }
      />

      {data.driveAlert && (
        <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center', background: '#FCE8E6', borderColor: '#F0C4BF', color: '#7F1D16', flexWrap: 'wrap' }}>
          <Icon name="warn" size={22} />
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5, minWidth: 240 }}>
            <b>Chưa ghi được tệp lên Drive</b> của “{data.driveAlert.assignment}” ({data.driveAlert.section}). {data.driveAlert.submissions} bài nộp đang được giữ tạm trên máy chủ và sẽ tự đồng bộ khi quyền được cấp lại.
          </div>
          <Link className="btn btn-sm" to={`/lecturer/assignments/${data.driveAlert.assignmentId}`}>
            Xem bài nộp
          </Link>
        </div>
      )}

      <div className="grid4">
        <Stat tone="blue" icon="upload" label="Bài nộp mới" value={s.newSubmissions} sub={`7 ngày qua · ${s.openAssignments} bài tập đang mở`} />
        <Stat tone="amber" icon="users" label="Chưa tải danh sách nhóm" value={s.noGroups} sub="bài tập làm nhóm" />
        <Stat tone="red" icon="warn" label="Phản hồi nhóm" value={s.openReports} sub="sinh viên báo nhóm chưa đúng" />
        <Stat tone="green" icon="listAlt" label="Chưa công bố điểm" value={s.ungraded} sub="bài tập đã hết hạn nộp" />
      </div>

      <div className="cols-2-1" style={{ alignItems: 'stretch' }}>
        <Card title="Lớp học phần phụ trách" body={false}>
          {data.sections.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lớp học phần</th>
                    <th>Sĩ số</th>
                    <th>Bài tập</th>
                    <th>Bài gần nhất · đã nộp</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.sections.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/lecturer/sections/${c.id}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                          {c.course}
                        </Link>
                        <div className="mono muted" style={{ fontSize: 12 }}>
                          {c.code}
                        </div>
                      </td>
                      <td>{c.students}</td>
                      <td style={{ fontSize: 13 }}>
                        {c.assignments} ({c.open} đang mở)
                      </td>
                      <td>
                        {!c.latest ? (
                          <span className="muted" style={{ fontSize: 13 }}>
                            —
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <Bar value={c.latest.expected ? (c.latest.submitted / c.latest.expected) * 100 : 0} width={100} />
                            <span className="mono" style={{ fontSize: 13 }}>
                              {c.latest.submitted}/{c.latest.expected}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <Link className="btn btn-sm" to={`/lecturer/sections/${c.id}`}>
                          Mở
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="grid">Bạn chưa được phân công lớp học phần nào trong học kỳ này.</Empty>
          )}
        </Card>

        <Card title="Cần xử lý">
          {data.todo.length ? (
            data.todo.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: TODO_ICON[t.kind][1], display: 'inline-flex' }}>
                  <Icon name={TODO_ICON[t.kind][0]} size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{t.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.sub}
                  </div>
                </div>
                <Link to={t.link} aria-label="Mở" style={{ color: '#8A8E97' }}>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </div>
            ))
          ) : (
            <Empty icon="check">Không có việc cần xử lý.</Empty>
          )}
        </Card>
      </div>

      <div className="cols-1-1">
        <Card title={data.histogram ? `Phổ điểm ${data.histogram.title}` : 'Phổ điểm'}>
          {data.histogram ? (
            <>
              <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #D6D3C8' }}>
                {data.histogram.bins.map((b) => {
                  const top = b === peak && b.count > 0;
                  return (
                    <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ height: 160, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                        {top && <span style={{ fontSize: 13, fontWeight: 700 }}>{b.count}</span>}
                        <div title={`${b.label}: ${b.count}`} style={{ width: '60%', maxWidth: 44, height: Math.max(b.count ? 8 : 2, (b.count / maxBin) * 126), background: top ? '#DB0000' : '#F2AAAA', borderRadius: '4px 4px 0 0' }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#62666F', whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                  );
                })}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Số sinh viên theo khoảng điểm{peak && peak.count ? ` · cao nhất: ${peak.count} SV ở khoảng ${peak.label}` : ''}
              </span>
            </>
          ) : (
            <Empty icon="chart">Chưa có bài tập nào có điểm.</Empty>
          )}
        </Card>
        <Card title="SV lớp được doanh nghiệp quan tâm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.interest.map((r) => (
              <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 110, flexShrink: 0, fontSize: 13, color: '#30343B' }}>{r.code}</span>
                <div style={{ flex: 1, height: 10, background: '#F1F0EA', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${r.count ? 100 : 0}%`, height: '100%', background: '#DB0000' }} />
                </div>
                <span style={{ width: 48, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{r.count}</span>
              </div>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Số SV có ít nhất 1 yêu cầu xem bài từ doanh nghiệp
          </span>
        </Card>
      </div>
    </div>
  );
}
