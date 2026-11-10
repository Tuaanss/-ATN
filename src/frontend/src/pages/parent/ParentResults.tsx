import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MyGrades } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Card, Empty, Loading, PageHead } from '../../components/ui';
import { score10, semesterLabel } from '../../utils/format';
import { TermGradeTables } from '../student/StudentGrades';
import { useChild } from './child';

type Results = MyGrades & { threshold: number };

/** Điểm bài tập của con theo học kỳ (chỉ điểm từng bài đã công bố, không có điểm tổng kết học phần). */
export function ParentResults() {
  const { child, loading } = useChild();
  useCrumbs([{ label: 'Điểm bài tập' }]);
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
  const latest = d.terms[0];
  const low = d.terms.flatMap((t) => t.assignments).filter((a) => a.score != null && a.score < TH).length;
  const shown = termCode ? d.terms.filter((t) => t.code === termCode) : d.terms;
  const tiles: [string, string | number, ReactNode, IconName][] = [
    ['Bài tập có điểm', d.graded, 'điểm đã công bố', 'check'],
    ['Điểm TB các bài', score10(d.avg), 'tất cả học kỳ', 'chart'],
    ['Điểm TB học kỳ gần nhất', score10(latest?.avg), latest ? semesterLabel(latest) : 'Chưa có', 'trend'],
    ['Bài dưới ngưỡng', low, low ? <span style={{ color: '#B42318', fontWeight: 600 }}>Cần quan tâm · ngưỡng {score10(TH)}</span> : `Ngưỡng cảnh báo ${score10(TH)}`, 'warn'],
  ];
  return (
    <div className="page">
      <PageHead
        title={`Điểm bài tập · ${child.fullName}`}
        actions={
          d.terms.length > 0 && (
            <select className="inp" aria-label="Chọn học kỳ" value={termCode} onChange={(e) => setTermCode(e.target.value)} style={{ width: 'auto', height: 40 }}>
              <option value="">Tất cả học kỳ</option>
              {d.terms.map((t) => (
                <option key={t.code} value={t.code}>
                  {semesterLabel(t)}
                </option>
              ))}
            </select>
          )
        }
      />
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
      {shown.length ? (
        <TermGradeTables terms={shown} link={false} />
      ) : (
        <Card>
          <Empty icon="list">Chưa có bài tập nào được công bố điểm.</Empty>
        </Card>
      )}
    </div>
  );
}
