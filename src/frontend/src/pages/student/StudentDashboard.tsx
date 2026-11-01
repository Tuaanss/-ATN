import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MyGrades, Notification, StudentAssignmentRow } from '../../api/types';
import { useAuth } from '../../auth/auth';
import { useCrumbs } from '../../layouts/AppLayout';
import { Badge, Bar, Card, Empty, Loading, PageHead, Stat } from '../../components/ui';
import { ago, COURSE_TYPE, ddmmHHmm, remain, semesterLabel, studentProgress } from '../../utils/format';

interface Data {
  semester: { term: string; academicYear: string; week: number } | null;
  dueSoon: number;
  stats: { openAssignments: number; due3Days: number; noGroup: number; published: number; enterpriseViews: number };
  upcoming: StudentAssignmentRow[];
  sections: { id: string; code: string; course: string; type: string; lecturer: string; total: number; done: number }[];
  notifications: Notification[];
}

export const modeCell = (r: Pick<StudentAssignmentRow, 'workMode' | 'groupCode' | 'groupName'>) =>
  r.workMode === 'GROUP' ? `Nhóm · ${r.groupCode ? (r.groupName && r.groupName !== r.groupCode ? `${r.groupCode} ${r.groupName}` : r.groupCode) : 'chờ xếp nhóm'}` : 'Cá nhân';

export function SectionTile({ s, extra }: { s: { id: string; code: string; course: string; type: string; lecturer: string; total: number; done: number; schedule?: string | null; dueSoon?: number }; extra?: boolean }) {
  const t = COURSE_TYPE[s.type] ?? COURSE_TYPE.OTHER;
  return (
    <Link to={`/student/courses/${s.id}`} style={{ display: 'flex', flexDirection: 'column', gap: extra ? 8 : 10, padding: 16, border: '1px solid #E3E1D9', borderRadius: 10, color: '#1A1C21', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {s.code}
        </span>
        <Badge tone={t.tone}>{t.label}</Badge>
      </div>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{s.course}</span>
      <span className="muted" style={{ fontSize: 13 }}>
        {s.lecturer}
        {extra && s.schedule ? ` · ${s.schedule}` : ''}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }} className="muted">
        <Bar value={s.total ? (s.done / s.total) * 100 : 0} />
        {s.done}/{s.total} bài đã nộp
      </div>
      {extra && !!s.dueSoon && (
        <span style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>{s.dueSoon} bài sắp đến hạn</span>
      )}
    </Link>
  );
}

/** Tổng quan sinh viên – mẫu sinh-vien/SV_Dashboard. */
export function StudentDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useCrumbs([{ label: 'Tổng quan' }]);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'student'], queryFn: () => api.get<Data>('/dashboard/student').then((r) => r.data) });
  const gradesQ = useQuery({ queryKey: ['student', 'grades'], queryFn: () => api.get<MyGrades>('/me/grades').then((r) => r.data) });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })),
  });
  if (isLoading || !data) return <Loading />;
  const s = data.stats;

  return (
    <div className="page">
      <PageHead title={`Chào bạn ${user?.name}${data.dueSoon ? `, còn ${data.dueSoon} bài sắp đến hạn` : ''}`} sub={data.semester ? `${semesterLabel(data.semester)} · Tuần ${data.semester.week}` : 'Chưa có học kỳ hiện tại'} />

      <div className="grid4">
        <Stat tone="red" icon="chart" label="GPA tích lũy" value={gradesQ.data?.cpa != null ? gradesQ.data.cpa.toFixed(2).replace('.', ',') : '—'} sub={gradesQ.data?.cpa != null ? `${gradesQ.data.credits} tín chỉ tích lũy` : 'Chưa có điểm học phần'} />
        <Stat tone="green" icon="list" label="Bài tập đang mở" value={s.openAssignments} sub={`${s.due3Days} bài hạn trong 3 ngày tới`} />
        <Stat tone="amber" icon="listAlt" label="Bài tập đã có điểm" value={s.published} sub={s.noGroup ? `${s.noGroup} bài đang chờ GV xếp nhóm` : 'điểm đã được công bố'} />
        <Stat tone="blue" icon="building" label="Doanh nghiệp đã xem bài" value={s.enterpriseViews} sub="Chưa có doanh nghiệp được cấp quyền" />
      </div>

      <div className="cols-2-1">
        <div className="col">
          <Card
            title="Sắp đến hạn"
            body={false}
            extra={
              <Link to="/student/assignments" style={{ fontSize: 13, fontWeight: 600 }}>
                Tất cả bài tập
              </Link>
            }
          >
            {data.upcoming.length ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bài tập</th>
                      <th>Hình thức</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming.map((r) => {
                      const p = studentProgress(r);
                      const rm = remain(r.finalDeadline);
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/student/assignments/${r.id}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                              {r.title}
                            </Link>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {r.section?.code} · {r.section?.course}
                            </div>
                          </td>
                          <td style={{ fontSize: 13 }}>{modeCell(r)}</td>
                          <td>
                            <div style={{ fontSize: 13 }}>{ddmmHHmm(r.dueAt)}</div>
                            <Badge tone={rm.tone}>{rm.text}</Badge>
                          </td>
                          <td>
                            <Badge tone={p.badge.tone}>{p.badge.label}</Badge>
                          </td>
                          <td>
                            <Link className="btn btn-sm" to={`/student/assignments/${r.id}`}>
                              Mở
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="check">Không có bài tập nào sắp đến hạn.</Empty>
            )}
          </Card>
          <Card title="Lớp học phần kỳ này">
            {data.sections.length ? (
              <div className="cols-1-1" style={{ gap: 14 }}>
                {data.sections.map((c) => (
                  <SectionTile key={c.id} s={c} />
                ))}
              </div>
            ) : (
              <Empty icon="grid">Bạn chưa có lớp học phần nào trong học kỳ này.</Empty>
            )}
          </Card>
        </div>
        <div className="col">
          <Card
            title="Thông báo"
            extra={
              data.notifications.some((n) => !n.readAt) && (
                <button className="btn btn-g btn-sm" type="button" style={{ color: '#DB0000' }} onClick={() => readAll.mutate()}>
                  Đánh dấu đã đọc
                </button>
              )
            }
          >
            {data.notifications.length ? (
              data.notifications.map((n) => (
                <Link key={n.id} to={n.link ?? '/student/notifications'} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#1A1C21' }}>
                  <span className="dot" style={{ marginTop: 7, background: n.readAt ? 'transparent' : '#DB0000' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: n.readAt ? 400 : 600 }}>{n.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ago(n.createdAt)}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <Empty icon="bell">Chưa có thông báo.</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
