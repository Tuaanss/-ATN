import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { GradebookItem, SectionGrades } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Bar, Card, Empty, Loading, Note, PageHead, Stat, useToast } from '../../components/ui';
import { downloadFile } from '../../components/excel';
import { fullDate, score10, semesterLabel, workModeText } from '../../utils/format';

/** Trang đầu "Điểm bài tập": các lớp học phần phụ trách, nhóm theo học kỳ. */
export function GradebookHome() {
  useCrumbs([{ label: 'Điểm bài tập' }]);
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['lecturer', 'gradebooks'], queryFn: () => api.get<GradebookItem[]>('/lecturer/gradebooks').then((r) => r.data) });
  if (isLoading || !data) return <Loading />;
  const years = [...new Set(data.map((s) => s.semester.academicYear))];
  const rows = data.filter((s) => (!year || s.semester.academicYear === year) && (!q || `${s.code} ${s.course.name}`.toLowerCase().includes(q.toLowerCase())));
  const groups = [...new Set(rows.map((s) => s.semester.code))].map((code) => rows.filter((s) => s.semester.code === code));

  return (
    <div className="page">
      <PageHead title="Điểm bài tập" sub="So sánh điểm các bài tập theo từng lớp học phần" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 200 }}>
          <label className="lbl">Năm học</label>
          <select className="inp" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Tất cả năm học</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y.replace('-', '–')}
              </option>
            ))}
          </select>
        </div>
        <label style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, height: 42, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 12px', color: '#62666F', background: '#fff' }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã lớp, tên môn…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
        </label>
      </div>
      {groups.length ? (
        groups.map((list) => {
          const sem = list[0].semester;
          return (
            <div key={sem.code} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 className="sec">{semesterLabel(sem)}</h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  {sem.isCurrent ? 'Học kỳ hiện tại · ' : ''}
                  {list.length} lớp
                </span>
              </div>
              <div className="grid3" style={{ gap: 16 }}>
                {list.map((s) => (
                  <Link key={s.id} to={`/lecturer/gradebook/${s.id}`} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, color: '#1A1C21' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {s.code}
                      </span>
                      {s.gradedAssignments ? <Badge tone="green">{s.gradedAssignments} bài có điểm</Badge> : <Badge tone="gray">Chưa có điểm</Badge>}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{s.course.name}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {s.students} sinh viên · {s.assignments} bài tập
                    </span>
                    {s.assignments > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }} className="muted">
                        <Bar value={(s.gradedAssignments / s.assignments) * 100} color="#15803D" />
                        <span>
                          {s.gradedAssignments} / {s.assignments} bài đã chấm
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <Card>
          <Empty icon="grid">Không có lớp học phần phù hợp.</Empty>
        </Card>
      )}
    </div>
  );
}

/**
 * Điểm bài tập của một lớp: so sánh các bài (TB, cao nhất, thấp nhất, số SV có điểm) và bảng SV × bài.
 * Không có điểm tổng kết học phần — điểm nhập ở trang từng bài tập.
 */
export function Gradebook() {
  const { sectionId } = useParams();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['lecturer', 'gradebook', sectionId], queryFn: () => api.get<SectionGrades>(`/lecturer/sections/${sectionId}/grades`).then((r) => r.data) });
  const d = q.data;
  useCrumbs([{ label: 'Điểm bài tập', to: '/lecturer/gradebook' }, { label: d ? `${d.section.code} · ${d.section.course.name}` : 'Lớp học phần' }]);

  if (q.isLoading) return <Loading />;
  if (!d)
    return (
      <div className="page">
        <PageHead title="Không mở được bảng điểm" sub={errorMessage(q.error)} />
      </div>
    );

  const s = d.section;
  const graded = d.assignments.filter((a) => a.graded > 0);
  const best = graded.reduce<(typeof graded)[number] | null>((p, a) => (p == null || (a.avg ?? 0) > (p.avg ?? 0) ? a : p), null);
  const worst = graded.reduce<(typeof graded)[number] | null>((p, a) => (p == null || (a.avg ?? 10) < (p.avg ?? 10) ? a : p), null);
  const allScores = d.rows.flatMap((r) => r.assignments).filter((x): x is number => x != null);
  const overall = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const rows = d.rows.filter((r) => !search || `${r.studentCode} ${r.fullName}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <PageHead
        title={`Điểm bài tập · ${s.course.name}`}
        sub={`${s.code} · ${semesterLabel(s.semester)} · ${d.stats.students} sinh viên · ${d.stats.assignments} bài tập`}
        actions={
          <button className="btn" type="button" disabled={!d.assignments.length} onClick={() => downloadFile(`/lecturer/sections/${sectionId}/grades/export`, `DiemBaiTap_${s.code}.xlsx`).catch((e) => toast.err(errorMessage(e)))}>
            <Icon name="download" size={16} />
            Xuất Excel
          </button>
        }
      />
      <Note tone="blue" icon="info">
        Điểm được nhập và công bố trong trang từng bài tập. Bảng này chỉ dùng để xem lại và so sánh chất lượng giữa các bài, hệ thống không tính điểm tổng kết học phần.
      </Note>

      {d.assignments.length ? (
        <>
          <div className="grid4">
            <Stat tone="blue" icon="list" label="Bài tập đã giao" value={d.assignments.length} sub={`${graded.length} bài đã có điểm`} />
            <Stat tone="green" icon="chart" label="Điểm TB chung" value={score10(overall == null ? null : Math.round(overall * 10) / 10)} sub="trung bình mọi điểm đã nhập" />
            <Stat tone="amber" icon="star" label="Bài điểm TB cao nhất" value={best ? score10(best.avg) : '—'} sub={best ? best.title : 'Chưa có điểm'} />
            <Stat tone="red" icon="warn" label="Bài điểm TB thấp nhất" value={worst ? score10(worst.avg) : '—'} sub={worst ? worst.title : 'Chưa có điểm'} />
          </div>

          <Card title="So sánh các bài tập" body={false}>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bài tập</th>
                    <th>Hình thức</th>
                    <th>Hạn nộp</th>
                    <th style={{ textAlign: 'right' }}>SV có điểm</th>
                    <th style={{ minWidth: 160 }}>Điểm TB</th>
                    <th style={{ textAlign: 'right' }}>Cao nhất</th>
                    <th style={{ textAlign: 'right' }}>Thấp nhất</th>
                    <th>Công bố</th>
                  </tr>
                </thead>
                <tbody>
                  {d.assignments.map((a, i) => (
                    <tr key={a.id}>
                      <td className="muted">BT{i + 1}</td>
                      <td>
                        <Link to={`/lecturer/assignments/${a.id}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                          {a.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 13 }}>{workModeText(a.workMode)}</td>
                      <td style={{ fontSize: 13 }}>{fullDate(a.dueAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {a.graded}/{d.stats.students}
                      </td>
                      <td>
                        {a.avg == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bar value={a.avg * 10} color={a.id === best?.id ? '#15803D' : a.id === worst?.id && graded.length > 1 ? '#B42318' : undefined} />
                            <b style={{ width: 32, textAlign: 'right' }}>{score10(a.avg)}</b>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{score10(a.max)}</td>
                      <td style={{ textAlign: 'right' }}>{score10(a.min)}</td>
                      <td>{a.publishedAt ? <Badge tone="green">{fullDate(a.publishedAt)}</Badge> : <Badge tone="gray">Chưa</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Điểm từng sinh viên"
            body={false}
            extra={
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 10px', color: '#62666F', background: '#fff', width: 260 }}>
                <Icon name="search" size={15} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm MSV, họ tên…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 13px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
              </label>
            }
          >
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MSV</th>
                    <th>Họ tên</th>
                    {d.assignments.map((a, i) => (
                      <th key={a.id} title={a.title} style={{ textAlign: 'right' }}>
                        BT{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId}>
                      <td className="mono" style={{ fontSize: 13 }}>
                        {r.studentCode}
                      </td>
                      <td>{r.fullName}</td>
                      {r.assignments.map((x, i) => (
                        <td key={i} style={{ textAlign: 'right', color: x != null && x < 4 ? '#B42318' : undefined, fontWeight: x != null ? 600 : 400 }}>
                          {x == null ? <span className="muted">—</span> : score10(x)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={2 + d.assignments.length} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                        Không có sinh viên phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#FAFAF7' }}>
                    <td colSpan={2}>
                      <b>Trung bình</b>
                    </td>
                    {d.assignments.map((a) => (
                      <td key={a.id} style={{ textAlign: 'right', fontWeight: 700 }}>
                        {score10(a.avg)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <Empty icon="list">Lớp chưa có bài tập nào được giao.</Empty>
        </Card>
      )}
    </div>
  );
}
