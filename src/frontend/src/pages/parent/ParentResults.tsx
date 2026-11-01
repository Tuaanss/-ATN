import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Badge, Card, Empty, Loading, Note, PageHead } from '../../components/ui';
import { score10, semesterLabel } from '../../utils/format';
import { useChild } from './child';

interface Course {
  sectionId: string;
  sectionCode: string;
  course: { code: string; name: string; credits: number };
  attendance: number | null;
  assignment: number | null;
  midterm: number | null;
  final: number | null;
  total: number | null;
  letter: string | null;
  gpa4: number | null;
}
interface Term {
  code: string;
  academicYear: string;
  term: string;
  gpa: number | null;
  credits: number;
  inProgress: boolean;
  courses: Course[];
}
interface Results {
  cpa: number | null;
  credits: number;
  rank: string | null;
  terms: Term[];
  threshold: number;
  scale: [number, string, number][];
}

const SHORT: Record<string, string> = { TERM_1: 'HK1', TERM_2: 'HK2', SUMMER: 'Hè' };

/** GPA từng kỳ + CPA tích lũy đến kỳ đó (môn học lại lấy điểm cao nhất). */
function series(terms: Term[]) {
  const asc = [...terms].reverse();
  const best = new Map<string, { g: number; cr: number }>();
  return asc
    .map((t) => {
      for (const c of t.courses) if (c.gpa4 != null && (!best.has(c.course.code) || c.gpa4 > best.get(c.course.code)!.g)) best.set(c.course.code, { g: c.gpa4, cr: c.course.credits });
      const all = [...best.values()];
      const cr = all.reduce((a, x) => a + x.cr, 0);
      return { t, gpa: t.gpa, cpa: cr ? Math.round((all.reduce((a, x) => a + x.g * x.cr, 0) / cr) * 100) / 100 : null };
    })
    .filter((x) => x.gpa != null) as { t: Term; gpa: number; cpa: number }[];
}

function Chart({ data }: { data: ReturnType<typeof series> }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty icon="chart">Chưa có học kỳ nào có điểm để vẽ biểu đồ.</Empty>;
  const W = 760;
  const H = 260;
  const L = 34;
  const R = 84;
  const T = 18;
  const B = 34;
  const iw = W - L - R;
  const ih = H - T - B;
  const n = data.length;
  const x = (i: number) => L + (iw * (i + 0.5)) / n;
  const y = (v: number) => T + ih * (1 - v / 4);
  const bw = Math.min(56, (iw / n) * 0.45);
  const last = data[n - 1];
  const h = hover != null ? data[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Biểu đồ GPA học kỳ và CPA tích lũy" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E1E0D9" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#8A8E97">
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.t.code}>
            <rect x={x(i) - bw / 2} y={y(d.gpa)} width={bw} height={T + ih - y(d.gpa)} rx={4} fill={hover === i ? '#A30000' : '#DB0000'} />
            <text x={x(i)} y={H - 12} textAnchor="middle" fontSize={12} fill="#62666F">
              {SHORT[d.t.term]} {d.t.academicYear.slice(2, 4)}–{d.t.academicYear.slice(7)}
            </text>
          </g>
        ))}
        <polyline points={data.map((d, i) => `${x(i)},${y(d.cpa)}`).join(' ')} fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.cpa)} r={4.5} fill="#2563EB" stroke="#fff" strokeWidth={2} />
        ))}
        <text x={x(n - 1)} y={y(last.gpa) - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1A1C21">
          {last.gpa.toFixed(2)}
        </text>
        <text x={x(n - 1) + bw / 2 + 8} y={y(last.cpa) + 4} fontSize={12} fontWeight={600} fill="#30343B">
          CPA {last.cpa.toFixed(2)}
        </text>
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="#8A8E97" strokeDasharray="3 3" />}
        {data.map((_, i) => (
          <rect key={`h${i}`} x={L + (iw * i) / n} y={T} width={iw / n} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div className="card" style={{ position: 'absolute', top: 0, left: `${(x(hover!) / W) * 100}%`, transform: 'translateX(-50%)', padding: '10px 12px', fontSize: 13, pointerEvents: 'none', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          <b>{semesterLabel(h.t)}</b>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span>GPA học kỳ</span>
            <b>{h.gpa.toFixed(2)}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CPA tích lũy</span>
            <b>{h.cpa.toFixed(2)}</b>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {h.t.credits} tín chỉ trong kỳ
          </div>
        </div>
      )}
    </div>
  );
}

/** Kết quả học tập của con – mẫu phu-huynh/ket-qua. */
export function ParentResults() {
  const { child, loading } = useChild();
  useCrumbs([{ label: 'Điểm, GPA & CPA' }]);
  const q = useQuery({ queryKey: ['parent', 'results', child?.id], queryFn: () => api.get<Results>(`/parent/children/${child!.id}/results`).then((r) => r.data), enabled: !!child });
  const [termCode, setTermCode] = useState('');
  if (loading || (child && !q.data)) return <Loading />;
  if (!child)
    return (
      <div className="page">
        <Empty icon="users">Tài khoản chưa liên kết với sinh viên nào.</Empty>
      </div>
    );
  const d = q.data!;
  const TH = d.threshold;
  const data = series(d.terms);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = last && prev ? Math.round((last.gpa - prev.gpa) * 100) / 100 : null;
  const term = d.terms.find((t) => t.code === termCode) ?? d.terms[0];
  const cur = d.terms.find((t) => t.inProgress) ?? d.terms[0];
  const lowNow = cur ? cur.courses.filter((c) => [c.attendance, c.assignment, c.midterm, c.final, c.total].some((v) => v != null && v < TH)).length : 0;
  const cell = (v: number | null) => (v == null ? <span className="muted">—</span> : v < TH ? <b style={{ color: '#B42318' }} title={`Dưới ngưỡng ${score10(TH)}`}>{score10(v)}</b> : score10(v));
  const tiles: [string, string | number, ReactNode, IconName][] = [
    ['CPA tích lũy', d.cpa != null ? d.cpa.toFixed(2) : '—', d.cpa != null ? <>Xếp loại: <b>{d.rank}</b></> : 'Chưa có học kỳ có điểm', 'chart'],
    [
      'GPA học kỳ gần nhất',
      last ? last.gpa.toFixed(2) : '—',
      last ? (
        <>
          {semesterLabel(last.t)}
          {delta != null && (
            <span style={{ color: delta >= 0 ? '#15803D' : '#B42318', fontWeight: 600 }}>
              {' '}
              · {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
            </span>
          )}
        </>
      ) : (
        'Chưa có'
      ),
      'trend',
    ],
    ['Tín chỉ tích lũy', d.credits, 'Môn đạt (không tính F)', 'logo'],
    ['Điểm dưới ngưỡng kỳ này', lowNow, lowNow ? <span style={{ color: '#B42318', fontWeight: 600 }}>Cần quan tâm · ngưỡng {score10(TH)}</span> : `Ngưỡng cảnh báo ${score10(TH)}`, 'warn'],
  ];
  const scale = [...d.scale].sort((a, b) => b[0] - a[0]);
  return (
    <div className="page">
      <PageHead title={`Kết quả học tập · ${child.fullName}`} />
      <div className="grid4">
        {tiles.map(([k, v, s, i]) => (
          <div key={k} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#62666F' }}>
              <Icon name={i} size={16} /> {k}
            </span>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{v}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <Card
        title="GPA học kỳ và CPA tích lũy (thang 4)"
        extra={
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#62666F' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 12, height: 12, borderRadius: 3, background: '#DB0000' }} />
              GPA học kỳ
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 16, height: 2, background: '#2563EB' }} />
              CPA tích lũy
            </span>
          </div>
        }
      >
        <Chart data={data} />
      </Card>
      <Card
        body={false}
        title="Bảng điểm"
        extra={
          d.terms.length > 0 && (
            <select className="inp" aria-label="Chọn học kỳ" value={term?.code} onChange={(e) => setTermCode(e.target.value)} style={{ width: 'auto', height: 38 }}>
              {d.terms.map((t) => (
                <option key={t.code} value={t.code}>
                  {semesterLabel(t)}
                  {t.inProgress ? ' (đang học)' : ''}
                </option>
              ))}
            </select>
          )
        }
      >
        {!term ? (
          <Empty icon="list">Chưa có học phần nào.</Empty>
        ) : (
          <>
            {term.inProgress && (
              <div style={{ padding: '16px 20px 0' }}>
                <Note tone="blue" icon="info">
                  Học kỳ đang diễn ra — điểm của môn hiện khi giảng viên công bố bảng điểm học phần.
                </Note>
              </div>
            )}
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã môn</th>
                    <th>Tên môn</th>
                    {['TC', 'Chuyên cần', 'Bài tập', 'Giữa kỳ', 'Cuối kỳ', 'Tổng kết', 'Điểm chữ', 'Hệ 4'].map((h) => (
                      <th key={h} style={{ textAlign: 'right' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {term.courses.map((c) => (
                    <tr key={c.sectionId}>
                      <td className="mono">{c.course.code}</td>
                      <td>{c.course.name}</td>
                      <td style={{ textAlign: 'right' }}>{c.course.credits}</td>
                      <td style={{ textAlign: 'right' }}>{cell(c.attendance)}</td>
                      <td style={{ textAlign: 'right' }}>{cell(c.assignment)}</td>
                      <td style={{ textAlign: 'right' }}>{cell(c.midterm)}</td>
                      <td style={{ textAlign: 'right' }}>{cell(c.final)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <b>{cell(c.total)}</b>
                      </td>
                      <td style={{ textAlign: 'right' }}>{c.letter ? <Badge tone={c.gpa4! >= 3.5 ? 'green' : c.gpa4! >= 2 ? 'blue' : c.gpa4! > 0 ? 'amber' : 'red'}>{c.letter}</Badge> : <span className="muted">—</span>}</td>
                      <td style={{ textAlign: 'right' }}>{c.gpa4 == null ? <span className="muted">—</span> : c.gpa4.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid #EFEDE6', fontSize: 13, color: '#62666F' }}>
              <span>
                {term.courses.length} môn · {term.courses.reduce((a, c) => a + c.course.credits, 0)} tín chỉ
              </span>
              <span>
                {term.gpa != null ? (
                  <>
                    GPA học kỳ: <b style={{ color: '#1A1C21' }}>{term.gpa.toFixed(2)}</b>
                    {(() => {
                      const s = data.find((x) => x.t.code === term.code);
                      return s ? (
                        <>
                          {' '}
                          · CPA đến kỳ này: <b style={{ color: '#1A1C21' }}>{s.cpa.toFixed(2)}</b>
                        </>
                      ) : null;
                    })()}
                  </>
                ) : (
                  'Chưa có GPA học kỳ'
                )}
              </span>
            </div>
          </>
        )}
      </Card>
      <p className="muted" style={{ fontSize: 13 }}>
        Quy đổi:{' '}
        {scale
          .map(([from, l, g4], i) => (i === 0 ? `${l} (${score10(from)}–10) = ${g4.toFixed(1)}` : `${l} (${score10(from)}–${score10(Math.round((scale[i - 1][0] - 0.1) * 10) / 10)}) = ${g4.toFixed(1)}`))
          .join(' · ')}
        . Môn học lại lấy điểm cao nhất.
      </p>
    </div>
  );
}
