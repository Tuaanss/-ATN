import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Card, Empty, Loading, PageHead } from '../../components/ui';
import { HBars } from '../admin/kit';

interface Map_ {
  semester: string | null;
  studentsWithWork: number;
  distinctTopics: number;
  majors: string[];
  rows: { label: string; cells: (number | string)[]; total: number | string }[];
  trending: { label: string; growth: number }[];
  fresh: { label: string; count: number }[];
  tools: { label: string; count: number | string }[];
}

/** Bản đồ năng lực – mẫu doanh-nghiep/DN_TalentMap: số liệu tổng hợp, không hiển thị danh tính. */
export function EnterpriseTalentMap() {
  useCrumbs([{ label: 'Bản đồ năng lực' }]);
  const [cohort, setCohort] = useState('');
  const f = useQuery({ queryKey: ['enterprise', 'filters'], queryFn: () => api.get<{ cohorts: string[] }>('/enterprise/filters').then((r) => r.data) });
  const q = useQuery({ queryKey: ['enterprise', 'talent', cohort], queryFn: () => api.get<Map_>(`/enterprise/talent-map${cohort ? `?cohort=${cohort}` : ''}`).then((r) => r.data) });
  if (!q.data) return <Loading />;
  const d = q.data;
  const tiles: [string, string | number, string][] = [
    ['SV có đề tài đã nộp', d.studentsWithWork, 'trong phạm vi lọc'],
    ['Chủ đề khác nhau', d.distinctTopics, 'theo từ khóa đề tài'],
    ['Chủ đề mới nổi', d.trending.length, 'tăng so với kỳ trước'],
    ['Công nghệ phổ biến nhất', d.tools[0]?.label ?? '—', d.tools[0] ? `${d.tools[0].count} sinh viên` : 'chưa có dữ liệu'],
  ];
  return (
    <div className="page">
      <PageHead
        title="Bản đồ năng lực sinh viên"
        sub="Số liệu tổng hợp, không hiển thị danh tính · nhóm dưới 5 sinh viên hiển thị “< 5”"
        actions={
          <select className="inp" aria-label="Khóa" value={cohort} onChange={(e) => setCohort(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="">Tất cả khóa</option>
            {f.data?.cohorts.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        }
      />
      <div className="grid4">
        {tiles.map(([k, v, s]) => (
          <div key={k} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#62666F' }}>{k}</span>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{v}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <Card title="Số sinh viên theo chủ đề × ngành" body={false}>
        {d.rows.length ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chủ đề</th>
                  {d.majors.map((m) => (
                    <th key={m} style={{ textAlign: 'right' }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.label}>
                    <td>
                      <b>{r.label}</b>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="mono" style={{ textAlign: 'right', color: typeof c === 'string' ? '#8A8E97' : undefined }}>
                        {c}
                      </td>
                    ))}
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="chart">Chưa có đề tài đã nộp trong phạm vi lọc.</Empty>
        )}
      </Card>
      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
        <Card title={`Chủ đề mới nổi${d.semester ? ` · ${d.semester}` : ''}`}>
          {d.trending.length ? (
            <HBars data={d.trending.map((t) => ({ label: t.label, value: t.growth, text: `+${t.growth}%` }))} />
          ) : d.fresh.length ? (
            <HBars data={d.fresh.map((t) => ({ label: t.label, value: t.count }))} unit=" bài" />
          ) : (
            <Empty icon="trend">Cần dữ liệu của ít nhất hai học kỳ để so sánh.</Empty>
          )}
        </Card>
        <Card title="Công nghệ / công cụ phổ biến">
          {d.tools.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {d.tools.map((t) => (
                <span key={t.label} className="chip">
                  {t.label} · <b>{t.count}</b>
                </span>
              ))}
            </div>
          ) : (
            <Empty icon="code">Sinh viên chưa khai báo kỹ năng trong hồ sơ.</Empty>
          )}
        </Card>
      </div>
      <p className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="info" size={14} /> Muốn xem bài cụ thể: tìm sinh viên ở <Link to="/enterprise/search">Tìm kiếm sinh viên</Link> rồi gửi yêu cầu xem bài.
      </p>
    </div>
  );
}
