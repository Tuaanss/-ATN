import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MyGrades } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Badge, Card, Empty, Loading, PageHead, Stat, Tabs, type Tone } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ddmm, score10, semesterLabel } from '../../utils/format';

const LETTER_TONE = (l: string | null): Tone => (!l ? 'gray' : l === 'A' ? 'green' : l.startsWith('B') ? 'blue' : l === 'F' ? 'red' : 'amber');
const gpa = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2).replace('.', ','));
const shortTerm = (t: { term: string; academicYear: string }) => `${t.term === 'TERM_1' ? 'HK1' : t.term === 'TERM_2' ? 'HK2' : 'Hè'} ${t.academicYear.replace(/20(\d\d)-20(\d\d)/, '$1–$2')}`;

/** Kết quả học tập của sinh viên – mẫu sinh-vien/SV_Grades. Chỉ hiện điểm đã công bố. */
export function StudentGrades() {
  useCrumbs([{ label: 'Kết quả học tập' }]);
  const [tab, setTab] = useState<'terms' | 'assignments' | 'stats'>('terms');
  const [term, setTerm] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['student', 'grades'], queryFn: () => api.get<MyGrades>('/me/grades').then((r) => r.data) });
  if (isLoading || !data) return <Loading />;

  const latest = data.terms[0];
  const prev = data.terms[1];
  const shown = term ? data.terms.filter((t) => t.code === term) : data.terms;
  const chart = [...data.terms].reverse();
  const maxG = 4;

  return (
    <div className="page">
      <PageHead
        title="Kết quả học tập"
        sub="Điểm học phần thang 10, quy đổi điểm chữ và thang 4 theo quy chế tín chỉ"
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

      <div className="grid4">
        <Stat tone="red" icon="chart" label="GPA tích lũy (thang 4)" value={gpa(data.cpa)} sub={data.rank ? `Xếp loại: ${data.rank}` : 'Chưa có học phần công bố'} />
        <Stat tone="amber" icon="listAlt" label="Tín chỉ tích lũy" value={data.credits} sub="học phần đạt (không tính F)" />
        <Stat
          tone="blue"
          icon="trend"
          label={latest ? `GPA ${shortTerm(latest)}` : 'GPA học kỳ'}
          value={gpa(latest?.gpa)}
          sub={latest && prev && latest.gpa != null && prev.gpa != null ? `${latest.gpa >= prev.gpa ? '+' : ''}${(latest.gpa - prev.gpa).toFixed(2).replace('.', ',')} so với kỳ trước` : `${latest?.credits ?? 0} tín chỉ`}
        />
        <Stat tone="green" icon="check" label="Bài tập có điểm" value={data.assignments.length} sub="điểm bài tập đã công bố" />
      </div>

      <Tabs<'terms' | 'assignments' | 'stats'>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'terms', label: 'Theo học kỳ' },
          { key: 'assignments', label: `Bài tập (${data.assignments.length})` },
          { key: 'stats', label: 'Thống kê cá nhân' },
        ]}
      />

      {tab === 'terms' ? (
        data.terms.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 24, alignItems: 'start' }} className="gr-top">
            <Card title="GPA theo học kỳ (thang 4)">
              <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #D6D3C8' }}>
                {chart.map((t, i) => {
                  const last = i === chart.length - 1;
                  return (
                    <div key={t.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ height: 220, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                        {last && <span style={{ fontSize: 13, fontWeight: 700 }}>{gpa(t.gpa)}</span>}
                        <div title={`${shortTerm(t)}: ${gpa(t.gpa)}`} style={{ width: '60%', maxWidth: 44, height: Math.max(2, ((t.gpa ?? 0) / maxG) * 190), background: last ? '#DB0000' : '#F2AAAA', borderRadius: '4px 4px 0 0' }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#62666F', whiteSpace: 'nowrap' }}>{shortTerm(t)}</span>
                    </div>
                  );
                })}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Thang 0–4 · chỉ tính học phần đã công bố
              </span>
            </Card>
            <div className="col">
              {shown.map((t) => (
                <Card
                  key={t.code}
                  title={
                    <>
                      {semesterLabel(t)}{' '}
                      <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
                        · {t.courses.length} học phần · {t.credits} tín chỉ · GPA {gpa(t.gpa)}
                      </span>
                    </>
                  }
                  body={false}
                >
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Học phần</th>
                          <th>TC</th>
                          <th>CC</th>
                          <th>BT</th>
                          <th>GK</th>
                          <th>CK</th>
                          <th>Tổng kết</th>
                          <th>Chữ</th>
                          <th>Hệ 4</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.courses.map((c) => (
                          <tr key={c.sectionId}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{c.course.name}</div>
                              <div className="mono muted" style={{ fontSize: 12 }}>
                                {c.sectionCode}
                              </div>
                            </td>
                            <td className="mono" style={{ fontSize: 13 }}>
                              {c.course.credits}
                            </td>
                            {(['attendance', 'assignment', 'midterm', 'final'] as const).map((k) => (
                              <td key={k} className="mono" style={{ fontSize: 13 }}>
                                {score10(c[k])}
                              </td>
                            ))}
                            <td className="mono" style={{ fontWeight: 600, color: c.total != null && c.total < 4 ? '#B42318' : undefined }}>
                              {score10(c.total)}
                            </td>
                            <td>{c.letter ? <Badge tone={LETTER_TONE(c.letter)}>{c.letter}</Badge> : <span className="muted">—</span>}</td>
                            <td className="mono">{c.gpa4 == null ? '—' : c.gpa4.toFixed(1).replace('.', ',')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <Empty icon="chart">Chưa có học phần nào được công bố điểm.</Empty>
          </Card>
        )
      ) : tab === 'stats' ? (
        <MyStatsView />
      ) : (
        <Card title="Điểm bài tập đã công bố" body={false}>
          {data.assignments.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bài tập</th>
                    <th>Học phần</th>
                    <th>Trọng số</th>
                    <th>Điểm</th>
                    <th>Nhận xét</th>
                    <th>Công bố</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignments.map((a) => (
                    <tr key={a.assignmentId}>
                      <td>
                        <Link to={`/student/assignments/${a.assignmentId}`} style={{ fontWeight: 600, color: '#1A1C21' }}>
                          {a.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {a.course}
                        <div className="mono muted" style={{ fontSize: 12 }}>
                          {a.sectionCode}
                        </div>
                      </td>
                      <td className="mono">{a.weight}%</td>
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
          ) : (
            <Empty icon="list">Chưa có bài tập nào được công bố điểm.</Empty>
          )}
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
