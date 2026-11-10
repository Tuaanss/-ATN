import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { MyStatus, StudentAssignmentRow, StudentSectionInfo } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Card, Empty, KV, Loading, MiniSteps, PageHead, Stat, Tabs } from '../../components/ui';
import { ddmm, ddmmHHmm, fullDate, remain, score10, semesterLabel, studentProgress } from '../../utils/format';
import { modeCell } from './StudentDashboard';

interface Data {
  section: StudentSectionInfo & { studentCount: number };
  assignments: StudentAssignmentRow[];
  myGroups: {
    assignmentId: string;
    assignmentTitle: string;
    status: MyStatus;
    group: { seq: number; code: string; name: string; role: string; members: { fullName: string; studentCode: string; role: string }[] } | null;
  }[];
  classmates: { studentCode: string; fullName: string; cohort: string | null; major: string | null }[];
  notices: { id: string; title: string; body: string | null; createdAt: string; readAt: string | null }[];
}
type Tab = 'work' | 'grades' | 'docs' | 'members';
const DONE: MyStatus[] = ['SUBMITTED', 'LATE', 'GRADED'];
const short = (t: string) => t.split('–')[0].trim();

/** Trang môn học của sinh viên – mẫu sinh-vien/SV_Course. */
export function StudentCourse() {
  const { sectionId } = useParams();
  const [tab, setTab] = useState<Tab>('work');
  const q = useQuery({ queryKey: ['student', 'section', sectionId], queryFn: () => api.get<Data>(`/student/sections/${sectionId}`).then((r) => r.data) });
  const d = q.data;
  useCrumbs([{ label: 'Bài tập', to: '/student/assignments' }, { label: d ? `${d.section.code} · ${d.section.course.name}` : 'Môn học' }]);
  if (q.isLoading) return <Loading />;
  if (!d)
    return (
      <div className="page">
        <PageHead title="Không mở được môn học" sub={errorMessage(q.error)} />
      </div>
    );

  const s = d.section;
  const rows = d.assignments;
  const fresh = rows.filter((r) => r.status === 'NO_GROUP' || r.status === 'NO_TOPIC').length;
  const graded = rows.filter((r) => r.status === 'GRADED');
  const doing = rows.length - fresh - graded.length - rows.filter((r) => r.status === 'MISSED' || r.status === 'NOT_OPEN').length;
  const submitted = rows.filter((r) => DONE.includes(r.status));
  const grading = rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'LATE').length;
  const avg = graded.length ? graded.reduce((n, r) => n + (r.score ?? 0), 0) / graded.length : null;
  const next = rows.filter((r) => new Date(r.finalDeadline) > new Date() && !DONE.includes(r.status)).sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime())[0];
  const briefs = rows.filter((r) => r.hasBrief);

  const workTable = (
    <Card
      title="Bài tập của môn · tiến trình 4 bước"
      body={false}
      extra={
        <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }} className="muted">
          <span>
            <span className="dot" style={{ background: '#15803D' }} /> Đã xong
          </span>
          <span>
            <span className="dot" style={{ background: '#DB0000' }} /> Bước hiện tại
          </span>
          <span>
            <span className="dot" style={{ background: '#E3E1D9' }} /> Chưa tới
          </span>
        </div>
      }
    >
      {rows.length ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Bài tập</th>
                <th>Hình thức</th>
                <th>Tiến độ</th>
                <th>Hạn nộp</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = studentProgress(r);
                const rm = remain(r.finalDeadline);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/student/assignments/${r.id}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                        {r.title}
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontSize: 13 }}>{modeCell(r)}</span>
                    </td>
                    <td>
                      <MiniSteps step={p.step} done={p.done} missed={p.missed} label={p.label} detail={p.detail} />
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{ddmmHHmm(r.dueAt)}</div>
                      {r.status === 'MISSED' ? <Badge tone="red">Quá hạn</Badge> : <Badge tone={rm.tone}>{rm.text}</Badge>}
                    </td>
                    <td>
                      <Badge tone={p.badge.tone}>{p.badge.label}</Badge>
                    </td>
                    <td>
                      <Link className={`btn btn-sm${p.primary ? ' btn-p' : ''}`} to={`/student/assignments/${r.id}`}>
                        {p.action}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="list">Giảng viên chưa giao bài tập nào.</Empty>
      )}
    </Card>
  );

  const gradesCard = (
    <Card title="Điểm các bài tập">
      {graded.length ? (
        graded.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short(r.title)}</span>
            <div style={{ width: 90, height: 6, borderRadius: 3, background: '#EFEDE6' }}>
              <div style={{ width: `${((r.score ?? 0) / 10) * 100}%`, height: '100%', borderRadius: 3, background: '#DB0000' }} />
            </div>
            <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{score10(r.score)}</span>
          </div>
        ))
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>
          Chưa có bài nào được công bố điểm.
        </span>
      )}
      <p className="help">Điểm từng bài hiển thị khi giảng viên công bố.</p>
      <Link to="/student/grades" style={{ fontSize: 13, fontWeight: 600 }}>
        Xem điểm tất cả bài tập
      </Link>
    </Card>
  );

  const docsCard = (
    <Card title="Tài liệu môn học">
      {briefs.length ? (
        briefs.map((r) => (
          <a key={r.id} href={`/api/v1/files/brief/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#1A1C21' }}>
            <span style={{ color: '#62666F', display: 'inline-flex' }}>
              <Icon name="file" size={16} />
            </span>
            <span style={{ flex: 1 }}>Đề bài · {short(r.title)}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              tải
            </span>
          </a>
        ))
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>
          Giảng viên chưa đăng tài liệu.
        </span>
      )}
    </Card>
  );

  const membersCard = (
    <Card title={`Thành viên lớp (${d.classmates.length})`} body={false}>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>Khóa</th>
              <th>Ngành</th>
            </tr>
          </thead>
          <tbody>
            {d.classmates.map((c) => (
              <tr key={c.studentCode}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={c.fullName} size={30} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        {c.studentCode}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{c.cohort ?? '—'}</td>
                <td>{c.major ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="page">
      <PageHead
        title={
          <>
            {s.course.name}{' '}
            <span className="mono muted" style={{ fontSize: 16, fontWeight: 500 }}>
              {s.code}
            </span>
          </>
        }
        sub={[semesterLabel(s.semester), `${s.course.credits} tín chỉ`, s.lecturer.fullName].join(' · ')}
        actions={
          <>
            <Link className="btn" to="/student/notifications">
              <Icon name="bell" size={16} />
              Thông báo của môn
            </Link>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'work', label: `Bài tập (${rows.length})` },
          { key: 'grades', label: 'Điểm bài tập' },
          { key: 'docs', label: 'Tài liệu' },
          { key: 'members', label: `Thành viên lớp (${s.studentCount})` },
        ]}
      />

      {tab === 'work' && (
        <>
          <div className="grid4">
            <Stat tone="green" icon="list" label="Bài tập" value={rows.length} sub={`${fresh} vừa giao · ${doing} đang làm · ${graded.length} xong`} />
            <Stat tone="blue" icon="upload" label="Đã nộp" value={`${submitted.length} / ${rows.length}`} sub={`${graded.length} có điểm · ${grading} chờ điểm`} />
            <Stat tone="red" icon="chart" label="Điểm bài tập TB" value={avg == null ? '—' : avg.toFixed(1)} sub="tính theo các bài đã công bố điểm" />
            <Stat tone="amber" icon="clock" label="Hạn gần nhất" value={next ? ddmm(next.dueAt) : '—'} sub={next ? `${short(next.title)} · ${remain(next.finalDeadline).text.toLowerCase()}` : 'Không có bài sắp hạn'} />
          </div>
          {workTable}
          <div className="cols-2-1">
            <div className="col">
              <Card title="Nhóm của tôi trong môn" body={false}>
                {d.myGroups.length ? (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bài tập</th>
                          <th>Nhóm</th>
                          <th>Vai trò</th>
                          <th>Thành viên</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.myGroups.map((g) => (
                          <tr key={g.assignmentId}>
                            <td>{short(g.assignmentTitle)}</td>
                            <td>{g.group ? (g.group.name !== g.group.code ? `${g.group.code} · ${g.group.name}` : g.group.code) : <span className="muted">Chờ GV xếp nhóm</span>}</td>
                            <td>{g.group ? g.group.role === 'LEADER' ? <Badge tone="dark">Trưởng nhóm</Badge> : <Badge tone="gray">Thành viên</Badge> : '—'}</td>
                            <td>
                              {g.group ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {g.group.members.map((m) => (
                                    <span key={m.studentCode} title={m.fullName}>
                                      <Avatar name={m.fullName} size={28} />
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <Link className="btn btn-sm" to={`/student/assignments/${g.assignmentId}`}>
                                  Xem bài tập
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty icon="users">Môn này chưa có bài tập nhóm.</Empty>
                )}
              </Card>
              <Card title="Thông báo từ giảng viên">
                {d.notices.length ? (
                  d.notices.map((n) => (
                    <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span className="dot" style={{ marginTop: 7, background: n.readAt ? 'transparent' : '#DB0000' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: n.readAt ? 400 : 600 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {s.lecturer.fullName} · {ddmm(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty icon="bell">Chưa có thông báo.</Empty>
                )}
              </Card>
            </div>
            <div className="col">
              <Card title="Thông tin môn học">
                <KV
                  rows={[
                    ['Mã lớp học phần', <span key="c" className="mono">{s.code}</span>],
                    ['Tên môn', s.course.name],
                    ['Số tín chỉ', String(s.course.credits)],
                    ['Giảng viên', s.lecturer.fullName],
                    ['Email GV', s.lecturer.email],
                    ['Thời gian', `${fullDate(s.semester.startDate)} – ${fullDate(s.semester.endDate)}`],
                    ['Số sinh viên', `${s.studentCount} sinh viên`],
                  ]}
                />
              </Card>
              {gradesCard}
              {docsCard}
            </div>
          </div>
        </>
      )}
      {tab === 'grades' && <div className="cols-2-1"><div className="col">{gradesCard}</div></div>}
      {tab === 'docs' && <div className="cols-2-1"><div className="col">{docsCard}</div></div>}
      {tab === 'members' && membersCard}
    </div>
  );
}
