import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MyGrades } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Card, Empty, Loading, PageHead, Stat, Tabs } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ddmm, score10, semesterLabel } from '../../utils/format';

/** Bảng điểm bài tập đã công bố, mỗi học kỳ một bảng. Dùng chung cho SV và phụ huynh. */
export function TermGradeTables({ terms, link = true }: { terms: MyGrades['terms']; link?: boolean }) {
  return (
    <div className="col">
      {terms.map((t) => (
        <Card
          key={t.code}
          title={
            <>
              {semesterLabel(t)}{' '}
              <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
                · {t.assignments.length} bài · điểm TB {score10(t.avg)}
              </span>
            </>
          }
          body={false}
        >
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bài tập</th>
                  <th>Môn học</th>
                  <th>Hạn nộp</th>
                  <th>Điểm</th>
                  <th>Nhận xét</th>
                  <th>Công bố</th>
                </tr>
              </thead>
              <tbody>
                {t.assignments.map((a) => (
                  <tr key={a.assignmentId}>
                    <td>
                      {link ? (
                        <Link to={`/student/assignments/${a.assignmentId}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                          {a.title}
                        </Link>
                      ) : (
                        <b>{a.title}</b>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {a.course.name}
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        {a.sectionCode}
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {ddmm(a.dueAt)}
                    </td>
                    <td>
                      <b className="mono" style={{ color: a.score != null && a.score < 4 ? '#B42318' : undefined }}>
                        {score10(a.score)}
                      </b>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 360 }}>{a.note ?? <span className="muted">—</span>}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {ddmm(a.publishedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Điểm bài tập của sinh viên – chỉ hiện điểm đã công bố, không có điểm tổng kết học phần. */
export function StudentGrades() {
  useCrumbs([{ label: 'Điểm bài tập' }]);
  const [tab, setTab] = useState<'terms' | 'stats'>('terms');
  const [term, setTerm] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['student', 'grades'], queryFn: () => api.get<MyGrades>('/me/grades').then((r) => r.data) });
  if (isLoading || !data) return <Loading />;

  const shown = term ? data.terms.filter((t) => t.code === term) : data.terms;
  const latest = data.terms[0];

  return (
    <div className="page">
      <PageHead
        title="Điểm bài tập"
        sub="Điểm từng bài tập đã được giảng viên công bố (thang 10)"
        actions={
          <span className="no-print" style={{ display: 'flex', gap: 10 }}>
            {tab === 'terms' && data.terms.length > 0 && (
              <select className="inp" style={{ width: 220 }} value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="">Tất cả học kỳ</option>
                {data.terms.map((t) => (
                  <option key={t.code} value={t.code}>
                    {semesterLabel(t)}
                  </option>
                ))}
              </select>
            )}
            <button className="btn" type="button" onClick={() => window.print()}>
              <Icon name="download" size={16} />
              Xuất PDF
            </button>
          </span>
        }
      />

      <div className="grid3">
        <Stat tone="green" icon="check" label="Bài tập có điểm" value={data.graded} sub="điểm đã công bố" />
        <Stat tone="red" icon="chart" label="Điểm TB các bài" value={score10(data.avg)} sub="tất cả học kỳ" />
        <Stat tone="blue" icon="trend" label={latest ? `Điểm TB ${semesterLabel(latest)}` : 'Điểm TB học kỳ gần nhất'} value={score10(latest?.avg)} sub={latest ? `${latest.assignments.length} bài` : 'Chưa có điểm'} />
      </div>

      <Tabs<'terms' | 'stats'>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'terms', label: 'Theo học kỳ' },
          { key: 'stats', label: 'Thống kê cá nhân' },
        ]}
      />

      {tab === 'stats' ? (
        <MyStatsView />
      ) : shown.length ? (
        <TermGradeTables terms={shown} />
      ) : (
        <Card>
          <Empty icon="chart">Chưa có bài tập nào được công bố điểm.</Empty>
        </Card>
      )}
    </div>
  );
}

interface MyStats {
  assignments: number;
  onTime: number;
  late: number;
  missed: number;
  pending: number;
  onTimeRate: number | null;
  avgScore: number | null;
  histogram: { label: string; count: number }[];
  byCourse: { course: string; count: number; avg: number }[];
  keywords: { keyword: string; count: number }[];
}

/** UC10.4 – thống kê cá nhân của sinh viên. */
function MyStatsView() {
  const q = useQuery({ queryKey: ['student', 'stats'], queryFn: () => api.get<MyStats>('/me/stats').then((r) => r.data) });
  if (!q.data) return <div className="skeleton" style={{ height: 240 }} />;
  const s = q.data;
  const done = s.onTime + s.late;
  const maxH = Math.max(1, ...s.histogram.map((b) => b.count));
  const maxK = Math.max(1, ...s.keywords.map((k) => k.count));
  return (
    <>
      <div className="grid4">
        <Stat tone="green" icon="clock" label="Nộp đúng hạn" value={s.onTimeRate == null ? '—' : `${s.onTimeRate}%`} sub={`${s.onTime} đúng hạn · ${s.late} muộn · ${s.missed} bỏ lỡ`} />
        <Stat tone="blue" icon="upload" label="Bài đã nộp" value={`${done} / ${s.assignments}`} sub={s.pending ? `${s.pending} bài đang mở chưa nộp` : 'Không còn bài đang chờ'} />
        <Stat tone="red" icon="chart" label="Điểm TB bài tập" value={score10(s.avgScore)} sub="các bài đã công bố điểm" />
        <Stat tone="amber" icon="tag" label="Chủ đề quen thuộc" value={s.keywords[0]?.keyword ?? '—'} sub={s.keywords[0] ? `${s.keywords[0].count} đề tài` : 'Chưa có đề tài'} />
      </div>
      <div className="cols-1-1">
        <Card title="Phân bố điểm bài tập">
          {s.avgScore == null ? (
            <Empty icon="chart">Chưa có bài tập nào được công bố điểm.</Empty>
          ) : (
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #D6D3C8' }}>
              {s.histogram.map((b) => (
                <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: 170 }}>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {b.count || ''}
                  </span>
                  <div style={{ width: '60%', height: Math.max(2, (b.count / maxH) * 130), borderRadius: '4px 4px 0 0', background: '#DB0000' }} />
                  <span className="muted" style={{ fontSize: 12 }}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Từ khóa đề tài của bạn">
          {s.keywords.length ? (
            s.keywords.map((k) => (
              <div key={k.keyword} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 140, flexShrink: 0 }}>{k.keyword}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 3, background: '#F1F0EA' }}>
                  <div style={{ width: `${(k.count / maxK) * 100}%`, height: '100%', borderRadius: 3, background: '#DB0000' }} />
                </div>
                <span className="mono">{k.count}</span>
              </div>
            ))
          ) : (
            <Empty icon="tag">Chưa có đề tài nào.</Empty>
          )}
        </Card>
      </div>
      {s.byCourse.length > 0 && (
        <Card title="Điểm bài tập theo môn" body={false}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th>Số bài có điểm</th>
                  <th>Điểm TB</th>
                </tr>
              </thead>
              <tbody>
                {s.byCourse.map((c) => (
                  <tr key={c.course}>
                    <td>{c.course}</td>
                    <td className="mono">{c.count}</td>
                    <td className="mono">{score10(c.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
