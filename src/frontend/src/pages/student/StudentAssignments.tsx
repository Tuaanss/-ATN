import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MyStatus, StudentAssignmentRow, StudentSection } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Badge, Card, Empty, Loading, MiniSteps, PageHead, Seg, Stat } from '../../components/ui';
import { COURSE_TYPE, ddmmHHmm, remain, semesterLabel, studentProgress } from '../../utils/format';
import { modeCell, SectionTile } from './StudentDashboard';

type Filter = 'ALL' | 'OPEN' | 'SOON' | 'DONE' | 'OVERDUE' | 'NEW' | 'DOING' | 'GRADED';
const DONE: MyStatus[] = ['SUBMITTED', 'LATE', 'GRADED'];

function match(r: StudentAssignmentRow, f: Filter) {
  const open = new Date(r.finalDeadline) > new Date();
  switch (f) {
    case 'OPEN':
      return open && !['GRADED', 'MISSED'].includes(r.status);
    case 'SOON':
      return open && !DONE.includes(r.status) && new Date(r.finalDeadline).getTime() - Date.now() <= 3 * 86400_000;
    case 'DONE':
      return DONE.includes(r.status);
    case 'OVERDUE':
    case 'NEW':
      return f === 'OVERDUE' ? r.status === 'MISSED' : r.status === 'NO_GROUP' || r.status === 'NO_TOPIC';
    case 'DOING':
      return ['NOT_SUBMITTED', 'SUBMITTED', 'LATE'].includes(r.status);
    case 'GRADED':
      return r.status === 'GRADED';
    default:
      return true;
  }
}

/** Bài tập của tôi – mẫu sinh-vien/SV_Assignments. */
export function StudentAssignments() {
  useCrumbs([{ label: 'Bài tập' }]);
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [section, setSection] = useState('');
  const [type, setType] = useState('');
  const rowsQ = useQuery({ queryKey: ['student', 'assignments'], queryFn: () => api.get<StudentAssignmentRow[]>('/student/assignments').then((r) => r.data) });
  const sectionsQ = useQuery({ queryKey: ['student', 'sections'], queryFn: () => api.get<StudentSection[]>('/student/sections').then((r) => r.data) });
  if (rowsQ.isLoading || sectionsQ.isLoading) return <Loading />;

  const all = rowsQ.data ?? [];
  const sections = (sectionsQ.data ?? []).filter((s) => s.semester.isCurrent);
  const typeOf = (r: StudentAssignmentRow) => sections.find((s) => s.id === r.section?.id)?.course.type;
  const rows = all
    .filter((r) => match(r, filter))
    .filter((r) => !section || r.section?.id === section)
    .filter((r) => !type || typeOf(r) === type)
    .filter((r) => !q || `${r.title} ${r.section?.code} ${r.section?.course}`.toLowerCase().includes(q));
  const count = (f: Filter) => all.filter((r) => match(r, f)).length;
  const segValue = (['ALL', 'OPEN', 'SOON', 'DONE', 'OVERDUE'] as Filter[]).includes(filter) ? filter : ('' as Filter);
  const tile = (f: Filter) => ({ onClick: () => setFilter(f), style: { cursor: 'pointer' } });

  return (
    <div className="page">
      <PageHead
        title="Bài tập của tôi"
        sub={`${semesterLabel(sections[0]?.semester)} · ${sections.length} lớp học phần · ${all.length} bài tập`}
        actions={
          <Seg<Filter>
            value={segValue}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'OPEN', label: 'Đang mở' },
              { value: 'SOON', label: 'Sắp hạn' },
              { value: 'DONE', label: 'Đã nộp' },
              { value: 'OVERDUE', label: 'Quá hạn' },
            ]}
          />
        }
      />

      <div className="grid4">
        <div {...tile('NEW')}>
          <Stat tone="red" icon="bell" label="Vừa mới giao" value={count('NEW')} sub="Chưa có nhóm / đề tài →" />
        </div>
        <div {...tile('DOING')}>
          <Stat tone="blue" icon="list" label="Đang thực hiện" value={count('DOING')} sub="Nộp bài · chờ điểm →" />
        </div>
        <div {...tile('GRADED')}>
          <Stat tone="green" icon="check" label="Đã có điểm" value={count('GRADED')} sub="Điểm đã công bố →" />
        </div>
        <div {...tile('OVERDUE')}>
          <Stat tone="amber" icon="clock" label="Quá hạn" value={count('OVERDUE')} sub={`${count('OVERDUE')} bài quá hạn chưa nộp →`} />
        </div>
      </div>

      <Card title="Lớp học phần kỳ này" extra={<span className="muted" style={{ fontSize: 13 }}>Bấm vào một lớp để xem thông tin môn và bài tập của môn</span>}>
        {sections.length ? (
          <div className="grid4" style={{ gap: 16 }}>
            {sections.map((s) => (
              <SectionTile
                key={s.id}
                extra
                s={{ id: s.id, code: s.code, course: s.course.name, type: s.course.type, lecturer: s.lecturer.fullName, total: s.assignmentCount, done: s.submittedCount, schedule: s.schedule, dueSoon: s.dueSoonCount }}
              />
            ))}
          </div>
        ) : (
          <Empty icon="grid">Bạn chưa có lớp học phần nào trong học kỳ này.</Empty>
        )}
      </Card>

      <div className="cols-3-1">
        <div className="col">
          <Card
            title="Danh sách bài tập"
            body={false}
            extra={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {q && (
                  <button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setParams({})}>
                    Tìm: “{params.get('q')}” ×
                  </button>
                )}
                <select className="chip" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Lớp" style={{ cursor: 'pointer' }}>
                  <option value="">Lớp: tất cả</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Lớp: {s.code}
                    </option>
                  ))}
                </select>
                <select className="chip" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại môn" style={{ cursor: 'pointer' }}>
                  <option value="">Loại môn: tất cả</option>
                  {Object.entries(COURSE_TYPE).map(([k, v]) => (
                    <option key={k} value={k}>
                      Loại môn: {v.label}
                    </option>
                  ))}
                </select>
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
                            <div style={{ fontSize: 12 }}>
                              <Link to={`/student/courses/${r.section?.id}`} className="muted">
                                {r.section?.code} · {r.section?.course}
                              </Link>
                            </div>
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
              <Empty icon="list">{all.length ? 'Không có bài tập phù hợp.' : 'Chưa có bài tập nào.'}</Empty>
            )}
          </Card>
        </div>
        <div className="col">
          <Card title="Ghi chú">
            <div style={{ fontSize: 13, lineHeight: 1.6, color: '#4A4E57' }}>
              Bài nhóm: giảng viên xếp nhóm và tải danh sách lên hệ thống. Cần <b>nhập tên đề tài và từ khóa</b> trước khi nộp bài. Điểm do giảng viên công bố sau khi chấm.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
