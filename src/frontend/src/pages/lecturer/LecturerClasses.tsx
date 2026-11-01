import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AssignmentSummary, LecturerSection, SectionGroupRow, SectionStudentRow } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Bar, Card, Empty, Loading, PageHead, Tabs } from '../../components/ui';
import { COURSE_TYPE, ddmmHHmm, phaseBadge, semesterLabel, workModeText } from '../../utils/format';

interface SectionAssignments {
  section: { id: string; code: string; course: { name: string } };
  assignments: AssignmentSummary[];
}
interface SectionStudents {
  groupAssignment: { id: string; title: string } | null;
  totalAssignments: number;
  students: SectionStudentRow[];
}
const groupLabel = (code: string, name: string) => (name && name !== code ? `${code} · ${name}` : code);
const shortTitle = (t: string) => t.split('–')[0].trim();
const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Lớp học phần phụ trách – mẫu giang-vien/GV_Classes. */
export function LecturerClasses() {
  const { sectionId } = useParams();
  const nav = useNavigate();
  const sectionsQ = useQuery({ queryKey: ['lecturer', 'sections'], queryFn: () => api.get<LecturerSection[]>('/lecturer/sections').then((r) => r.data) });

  const current = useMemo(() => {
    const list = sectionsQ.data ?? [];
    const sem = list.find((s) => s.id === sectionId)?.semester.code ?? list.find((s) => s.semester.isCurrent)?.semester.code ?? list[0]?.semester.code;
    return list.filter((s) => s.semester.code === sem);
  }, [sectionsQ.data, sectionId]);
  const selected = current.find((s) => s.id === sectionId) ?? current[0];
  useCrumbs([{ label: 'Lớp học phần' }]);

  if (sectionsQ.isLoading) return <Loading />;
  if (!selected)
    return (
      <div className="page">
        <PageHead title="Lớp học phần phụ trách" />
        <div className="card">
          <Empty icon="grid">Bạn chưa được phân công lớp học phần nào.</Empty>
        </div>
      </div>
    );

  return (
    <div className="page">
      <PageHead
        title="Lớp học phần phụ trách"
        sub={`${semesterLabel(selected.semester)} · ${current.length} lớp · ${current.reduce((n, s) => n + s.studentCount, 0)} sinh viên`}
        actions={
          <>
            <ExportButton section={selected} />
            <Link className="btn btn-p" to={`/lecturer/sections/${selected.id}/assignments/new`}>
              <Icon name="plus" size={16} />
              Tạo bài tập
            </Link>
          </>
        }
      />

      <div className="grid3">
        {current.map((s) => {
          const type = COURSE_TYPE[s.course.type] ?? COURSE_TYPE.OTHER;
          const on = s.id === selected.id;
          return (
            <Link
              key={s.id}
              to={`/lecturer/sections/${s.id}`}
              replace
              className="card"
              aria-current={on}
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, color: '#1A1C21', border: on ? '2px solid #DB0000' : undefined }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {s.code}
                </span>
                <Badge tone={type.tone}>{type.label}</Badge>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{s.course.name}</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {s.studentCount} SV · {s.assignmentCount} bài tập{s.openAssignmentCount ? ` (${s.openAssignmentCount} đang mở)` : ''}
                {s.schedule ? ` · ${s.schedule}` : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }} className="muted">
                <Bar value={s.onTimeRate ?? 0} />
                {s.onTimeRate === null ? 'Chưa có bài nộp' : `${s.onTimeRate}% nộp đúng hạn`}
              </div>
            </Link>
          );
        })}
      </div>

      <SectionTabs key={selected.id} section={selected} onOpen={(id) => nav(`/lecturer/assignments/${id}`)} />
    </div>
  );
}

function SectionTabs({ section, onOpen }: { section: LecturerSection; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<'assignments' | 'students' | 'groups'>('assignments');
  const a = useQuery({ queryKey: ['lecturer', 'section', section.id], queryFn: () => api.get<SectionAssignments>(`/lecturer/sections/${section.id}/assignments`).then((r) => r.data) });
  const s = useQuery({ queryKey: ['lecturer', 'section', section.id, 'students'], queryFn: () => api.get<SectionStudents>(`/lecturer/sections/${section.id}/students`).then((r) => r.data) });
  const g = useQuery({ queryKey: ['lecturer', 'section', section.id, 'groups'], queryFn: () => api.get<SectionGroupRow[]>(`/lecturer/sections/${section.id}/groups`).then((r) => r.data) });
  const title = `${section.code} · ${section.course.name}`;

  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'assignments', label: `Bài tập (${section.assignmentCount})` },
          { key: 'students', label: `Sinh viên (${section.studentCount})` },
          { key: 'groups', label: `Nhóm (${g.data?.length ?? '…'})` },
        ]}
      />
      {tab === 'assignments' && (
        <>
          <AssignmentsTable title={title} section={section} data={a.data} loading={a.isLoading} onOpen={onOpen} />
          <StudentsCard title={title} data={s.data} loading={s.isLoading} />
        </>
      )}
      {tab === 'students' && <StudentsCard title={title} data={s.data} loading={s.isLoading} />}
      {tab === 'groups' && <GroupsCard title={title} data={g.data} loading={g.isLoading} />}
    </>
  );
}

// ------------------------------------------------------------------ bảng bài tập

function AssignmentsTable({ title, section, data, loading, onOpen }: { title: string; section: LecturerSection; data?: SectionAssignments; loading: boolean; onOpen: (id: string) => void }) {
  const now = Date.now();
  return (
    <Card
      title={`Bài tập của lớp ${title}`}
      body={false}
      extra={
        <Link className="btn btn-sm btn-p" to={`/lecturer/sections/${section.id}/assignments/new`}>
          <Icon name="plus" size={14} />
          Thêm bài tập
        </Link>
      }
    >
      {loading ? (
        <div className="card-b">
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      ) : !data?.assignments.length ? (
        <Empty icon="file">Lớp chưa có bài tập nào.</Empty>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Bài tập</th>
                <th>Hạn nộp</th>
                <th>Đã nộp</th>
                <th>Trạng thái</th>
                <th>Nhóm</th>
                <th>Điểm</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((x) => {
                const label = phaseBadge(x.phase);
                const pastDue = new Date(x.finalDeadline).getTime() < now;
                return (
                  <tr key={x.id}>
                    <td>
                      <Link to={`/lecturer/assignments/${x.id}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                        {x.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {workModeText(x.workMode)}
                        {x.status === 'DRAFT' ? ' · bản nháp' : ''}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{ddmmHHmm(x.dueAt)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, width: 120 }}>
                        <Bar value={x.stats.expected ? (x.stats.submitted / x.stats.expected) * 100 : 0} />
                        <span className="mono">
                          {x.stats.submitted}/{x.stats.expected}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={label.tone}>{label.label}</Badge>
                    </td>
                    <td>
                      {x.workMode === 'INDIVIDUAL' ? (
                        <span className="muted" style={{ fontSize: 13 }}>
                          Cá nhân
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12, color: '#4A4E57' }}>{x.groupsImportedAt ? `${x.stats.groups} nhóm` : 'Chưa tải danh sách'}</span>
                          <Link className={`btn btn-sm${x.groupsImportedAt ? '' : ' btn-p'}`} to={`/lecturer/assignments/${x.id}?tab=groups`}>
                            {x.groupsImportedAt ? 'Xem nhóm' : 'Tải lên'}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td>
                      {x.gradesPublishedAt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12, color: '#4A4E57' }}>Đã công bố{x.avgScore != null ? ` · TB ${x.avgScore}` : ''}</span>
                          <Link className="btn btn-sm" to={`/lecturer/assignments/${x.id}`}>
                            Kết quả
                          </Link>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12, color: '#4A4E57' }}>{x.stats.graded ? `${x.stats.graded} SV có điểm · chưa công bố` : pastDue ? 'Chưa tải điểm' : 'Chưa có điểm'}</span>
                          <Link className={`btn btn-sm${pastDue && !x.stats.graded ? ' btn-p' : ''}`} to={`/lecturer/assignments/${x.id}?tab=grades`}>
                            {x.stats.graded ? 'Công bố' : 'Tải điểm'}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" type="button" onClick={() => onOpen(x.id)}>
                          Xem
                        </button>
                        <Link className="btn btn-sm" to={`/lecturer/assignments/${x.id}/edit`}>
                          Sửa
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ sinh viên

function StudentsCard({ title, data, loading }: { title: string; data?: SectionStudents; loading: boolean }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [sub, setSub] = useState('all');
  const total = data?.totalAssignments ?? 0;
  const ga = data?.groupAssignment;
  const rows = (data?.students ?? []).filter(
    (s) =>
      (!q || norm(`${s.studentCode} ${s.fullName}`).includes(norm(q))) &&
      (group === 'all' || (group === 'has' ? !!s.group : !s.group)) &&
      (sub === 'all' || (sub === 'full' ? s.submitted >= total : s.submitted < total)),
  );
  return (
    <Card title={`Sinh viên lớp ${title}`} body={false}>
      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, borderBottom: '1px solid #EFEDE6', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 280, maxWidth: '100%', height: 38, border: '1px solid #E3E1D9', borderRadius: 8, padding: '0 12px', color: '#62666F' }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm MSSV, họ tên…" aria-label="Tìm sinh viên" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
        </label>
        <select className="chip" style={{ cursor: 'pointer', paddingRight: 8 }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Lọc theo nhóm" disabled={!ga}>
          <option value="all">Nhóm: tất cả</option>
          <option value="has">Nhóm: đã có nhóm</option>
          <option value="none">Nhóm: chưa có nhóm</option>
        </select>
        <select className="chip" style={{ cursor: 'pointer', paddingRight: 8 }} value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Lọc theo trạng thái nộp">
          <option value="all">Trạng thái nộp: tất cả</option>
          <option value="full">Trạng thái nộp: nộp đủ</option>
          <option value="missing">Trạng thái nộp: còn thiếu</option>
        </select>
      </div>
      {loading ? (
        <div className="card-b">
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>MSSV</th>
                  <th>Họ tên</th>
                  <th>{ga ? `Nhóm · ${shortTitle(ga.title)}` : 'Nhóm'}</th>
                  <th>Đề tài</th>
                  <th>Đã nộp</th>
                  <th>Điểm TB bài tập</th>
                  <th>Hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="mono">{s.studentCode}</span>
                    </td>
                    <td>{s.fullName}</td>
                    <td>{s.group ? groupLabel(s.group.code, s.group.name) : ga ? <Badge tone="amber">Chưa có nhóm</Badge> : <span className="muted">—</span>}</td>
                    <td>{s.topic ?? <span className="muted">—</span>}</td>
                    <td>
                      {s.submitted}/{total}
                    </td>
                    <td>{s.avgScore ?? <span className="muted">—</span>}</td>
                    <td>{s.neverLoggedIn ? <Badge tone="gray">Chưa đăng nhập</Badge> : s.profileCompleted ? <Badge tone="green">Hoàn thiện</Badge> : <Badge tone="amber">Chưa khai báo</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted card-foot">
            Hiển thị {rows.length} / {data?.students.length ?? 0} sinh viên
          </div>
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ nhóm

function GroupsCard({ title, data, loading }: { title: string; data?: SectionGroupRow[]; loading: boolean }) {
  return (
    <Card title={`Nhóm của lớp ${title}`} body={false}>
      {loading ? (
        <div className="card-b">
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      ) : !data?.length ? (
        <Empty icon="users">Lớp chưa có nhóm nào.</Empty>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Nhóm</th>
                <th>Bài tập</th>
                <th>Thành viên</th>
                <th>Đề tài</th>
                <th>Bài chung</th>
              </tr>
            </thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b>{groupLabel(g.code, g.name)}</b>
                  </td>
                  <td>
                    <Link to={`/lecturer/assignments/${g.assignment.id}`} style={{ color: '#1A1C21' }}>
                      {shortTitle(g.assignment.title)}
                    </Link>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {g.members.map((m) => m.fullName + (m.role === 'LEADER' ? ' (TN)' : '')).join(', ')}{' '}
                    <span className="muted">({g.members.length})</span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {g.topic ? (
                      <>
                        {g.topic.title}
                      </>
                    ) : (
                      <span className="muted">Chưa nhập</span>
                    )}
                  </td>
                  <td>{g.submission ? <Badge tone={g.submission.isLate ? 'amber' : 'green'}>{g.submission.isLate ? 'Nộp muộn' : 'Đã nộp'}</Badge> : <Badge tone="gray">Chưa nộp</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ xuất danh sách

function ExportButton({ section }: { section: LecturerSection }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.get<SectionStudents>(`/lecturer/sections/${section.id}/students`);
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['MSSV', 'Họ tên', 'Khóa', data.groupAssignment ? `Nhóm (${data.groupAssignment.title})` : 'Nhóm', 'Đề tài', `Đã nộp / ${data.totalAssignments}`, 'Điểm TB bài tập', 'Hồ sơ'];
      const lines = data.students.map((s) =>
        [s.studentCode, s.fullName, s.cohort, s.group ? groupLabel(s.group.code, s.group.name) : '', s.topic, s.submitted, s.avgScore, s.profileCompleted ? 'Hoàn thiện' : 'Chưa khai báo'].map(esc).join(','),
      );
      const url = URL.createObjectURL(new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `DanhSach_${section.code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn" type="button" onClick={run} disabled={busy}>
      <Icon name="download" size={16} />
      Xuất danh sách
    </button>
  );
}
