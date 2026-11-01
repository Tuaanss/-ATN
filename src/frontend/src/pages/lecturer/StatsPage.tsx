import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Card, Empty, Loading, PageHead, Stat } from '../../components/ui';
import { ddmm, remain, score10, semesterLabel } from '../../utils/format';

interface Stats {
  sections: { id: string; code: string; course: string; semester: string; isCurrent: boolean }[];
  section: { id: string; code: string; course: string; semester: { code: string; term: string; academicYear: string }; students: number } | null;
  summary: { onTimeRate: number | null; closedAssignments: number; open: { title: string; missing: number; dueAt: string } | null; topics: number; distinctTopics: number; similarPairs: number };
  assignments: { id: string; title: string; workMode: string; status: 'DRAFT' | 'NOT_OPEN' | 'OPEN' | 'ENDED'; dueAt: string; units: number; onTime: number; late: number; missing: number; avgScore: number | null }[];
  keywords: { keyword: string; count: number }[];
  pairs: { a: string; b: string; titleA: string; titleB: string; score: number }[];
}

function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Thống kê & xu hướng đề tài – mẫu giang-vien/GV_Stats (UC10.3, UC10.7). */
export function StatsPage() {
  useCrumbs([{ label: 'Thống kê & xu hướng' }]);
  const [params, setParams] = useSearchParams();
  const section = params.get('section') ?? '';
  const q = useQuery({ queryKey: ['lecturer', 'stats', section], queryFn: () => api.get<Stats>(`/lecturer/stats${section ? `?section=${section}` : ''}`).then((r) => r.data), placeholderData: keepPreviousData });
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  if (!d.section)
    return (
      <div className="page">
        <PageHead title="Thống kê & xu hướng đề tài" />
        <Card>
          <Empty icon="chart">Bạn chưa phụ trách lớp học phần nào.</Empty>
        </Card>
      </div>
    );
  const s = d.summary;
  const maxKw = Math.max(1, ...d.keywords.map((k) => k.count));
  const graded = d.assignments.filter((a) => a.avgScore != null);
  const avg = graded.length ? graded.reduce((n, a) => n + a.avgScore!, 0) / graded.length : null;

  const exportCsv = () =>
    downloadCsv(`ThongKe_${d.section!.code}.csv`, [
      ['Lớp', `${d.section!.code} · ${d.section!.course}`],
      ['Học kỳ', semesterLabel(d.section!.semester)],
      [],
      ['Bài tập', 'Hình thức', 'Hạn nộp', 'Số nhóm/SV', 'Đúng hạn', 'Muộn', 'Chưa nộp', 'Điểm TB'],
      ...d.assignments.map((a) => [a.title, a.workMode === 'GROUP' ? 'Nhóm' : 'Cá nhân', ddmm(a.dueAt), a.units, a.onTime, a.late, a.missing, a.avgScore]),
      [],
      ['Từ khóa', 'Số đề tài'],
      ...d.keywords.map((k) => [k.keyword, k.count]),
      [],
      ['Cặp đề tài tương tự', '', 'Độ tương đồng'],
      ...d.pairs.map((p) => [`${p.a}: ${p.titleA}`, `${p.b}: ${p.titleB}`, p.score]),
    ]);

  return (
    <div className="page">
      <PageHead
        title="Thống kê & xu hướng đề tài"
        sub={`Lớp ${d.section.code} · ${d.section.course} · ${semesterLabel(d.section.semester)} · ${d.section.students} sinh viên`}
        actions={
          <>
            <select className="inp" style={{ width: 260 }} value={d.section.id} onChange={(e) => setParams({ section: e.target.value })} aria-label="Lớp học phần">
              {d.sections.map((x) => (
                <option key={x.id} value={x.id}>
                  Lớp: {x.code} · {x.course} ({x.semester})
                </option>
              ))}
            </select>
            <button className="btn" type="button" onClick={exportCsv}>
              <Icon name="download" size={16} />
              Xuất báo cáo
            </button>
          </>
        }
      />

      <div className="grid4">
        <Stat tone="green" icon="clock" label="Nộp đúng hạn" value={s.onTimeRate == null ? '—' : `${s.onTimeRate}%`} sub={s.closedAssignments ? `Trung bình ${s.closedAssignments} bài tập đã hết hạn` : 'Chưa có bài tập hết hạn'} />
        <Stat tone="amber" icon="upload" label="Chưa nộp" value={s.open ? s.open.missing : '—'} sub={s.open ? `${s.open.title} · ${remain(s.open.dueAt).text.toLowerCase()}` : 'Không có bài đang mở'} />
        <Stat tone="blue" icon="file" label="Đề tài khác nhau" value={`${s.distinctTopics} / ${s.topics}`} sub={s.similarPairs ? `${s.similarPairs} cặp đề tài tương tự` : 'Không có đề tài tương tự'} />
        <Stat tone="red" icon="chart" label="Điểm TB bài tập" value={score10(avg == null ? null : Math.round(avg * 10) / 10)} sub={graded.length ? `${graded.length} bài tập đã có điểm` : 'Chưa có điểm'} />
      </div>

      <div className="cols-1-1">
        <Card title="Tình trạng nộp theo bài tập">
          {d.assignments.length ? (
            <>
              {d.assignments.map((a) => {
                const total = Math.max(1, a.units);
                return (
                  <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 10 }}>
                      <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</b>
                      <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {a.status === 'NOT_OPEN' || a.status === 'DRAFT' ? 'chưa mở' : `${a.onTime + a.late}/${a.units} ${a.workMode === 'GROUP' ? 'nhóm' : 'SV'}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', background: '#EFEDE6' }}>
                      <div title={`Đúng hạn: ${a.onTime}`} style={{ width: `${(a.onTime / total) * 100}%`, background: '#15803D' }} />
                      <div title={`Muộn: ${a.late}`} style={{ width: `${(a.late / total) * 100}%`, background: '#F59E0B' }} />
                      {a.status === 'ENDED' && <div title={`Chưa nộp: ${a.missing}`} style={{ width: `${(a.missing / total) * 100}%`, background: '#DB0000' }} />}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }} className="muted">
                {(
                  [
                    ['#15803D', 'Đúng hạn'],
                    ['#F59E0B', 'Muộn'],
                    ['#DB0000', 'Chưa nộp (đã hết hạn)'],
                  ] as const
                ).map(([c, t]) => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty icon="list">Lớp chưa có bài tập.</Empty>
          )}
        </Card>

        <Card title="Top từ khóa đề tài của lớp">
          {d.keywords.length ? (
            <>
              {d.keywords.map((k) => (
                <div key={k.keyword} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <span style={{ width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.keyword}</span>
                  <div style={{ flex: 1, height: 10, borderRadius: 3, background: '#F1F0EA' }}>
                    <div style={{ width: `${(k.count / maxKw) * 100}%`, height: '100%', borderRadius: 3, background: '#DB0000' }} />
                  </div>
                  <span className="mono" style={{ width: 24, textAlign: 'right' }}>
                    {k.count}
                  </span>
                </div>
              ))}
              <span className="muted" style={{ fontSize: 12 }}>
                Số đề tài mang từ khóa · đã gộp từ khóa giống nhau khi bỏ dấu, hoa thường
              </span>
            </>
          ) : (
            <Empty icon="tag">Chưa có đề tài nào.</Empty>
          )}
        </Card>
      </div>

      <div className="cols-1-1">
        <Card title="Độ đa dạng đề tài">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
            {(
              [
                ['Số đề tài', s.topics],
                ['Đề tài khác nhau', s.distinctTopics],
                ['Cặp tương tự', s.similarPairs],
              ] as const
            ).map(([t, v]) => (
              <div key={t} style={{ padding: 14, borderRadius: 10, background: '#F7F6F2', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Cặp đề tài tương tự" body={false}>
          {d.pairs.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Đề tài 1</th>
                    <th>Đề tài 2</th>
                    <th>Giống</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pairs.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13 }}>
                        <b>{p.a}</b>
                        <div className="muted">{p.titleA}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <b>{p.b}</b>
                        <div className="muted">{p.titleB}</div>
                      </td>
                      <td className="mono">{Math.round(p.score * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="check">Không có cặp đề tài tương tự trong cùng bài tập.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
