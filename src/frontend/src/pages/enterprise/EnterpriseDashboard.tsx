import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, Loading, PageHead, Stat, type Tone } from '../../components/ui';
import { ddmm, fullDT } from '../../utils/format';
import { gpa } from './common';

interface Dash {
  enterprise: { name: string; field: string };
  counts: { pending: number; approved: number; active: number; rejected: number; expired: number; studentsViewed: number; views: number };
  active: { studentId: string; studentCode: string; fullName: string; approvedAt: string; daysLeft: number }[];
  history: { id: string; studentId: string; studentCode: string; fullName: string; state: string; adminNote: string | null; createdAt: string }[];
  searches: { id: string; summary: string; results: number; at: string; criteria: unknown }[];
  interests: { studentId: string; studentCode: string; fullName: string; cohort: string | null; major: string | null; gpa: number | null }[];
}
const ST: Record<string, [string, Tone]> = { PENDING: ['Chờ duyệt', 'amber'], ACTIVE: ['Đang còn hạn', 'green'], EXPIRED: ['Hết hạn', 'gray'], REJECTED: ['Từ chối', 'red'], REVOKED: ['Thu hồi', 'gray'] };

/** Yêu cầu & thống kê – mẫu doanh-nghiep/DN_Dashboard. */
export function EnterpriseDashboard() {
  useCrumbs([{ label: 'Yêu cầu & thống kê' }]);
  const q = useQuery({ queryKey: ['enterprise', 'dashboard'], queryFn: () => api.get<Dash>('/enterprise/dashboard').then((r) => r.data) });
  if (!q.data) return <Loading />;
  const d = q.data;
  return (
    <div className="page">
      <PageHead
        title="Yêu cầu & thống kê"
        sub={d.enterprise.name}
        actions={
          <Link className="btn btn-p" to="/enterprise/search">
            <Icon name="search" size={16} /> Tìm kiếm sinh viên
          </Link>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        <Stat label="Chờ duyệt" value={d.counts.pending} icon="clock" tone="amber" />
        <Stat label="Đã duyệt" value={d.counts.approved} icon="check" tone="green" sub={`${d.counts.active} còn hiệu lực`} />
        <Stat label="Bị từ chối" value={d.counts.rejected} icon="close" tone="red" />
        <Stat label="Hết hạn / thu hồi" value={d.counts.expired} icon="lock" tone="gray" />
        <Stat label="SV đã xem bài" value={d.counts.studentsViewed} icon="eye" tone="blue" sub={`${d.counts.views} lượt xem`} />
      </div>
      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
        <Card title="Quyền xem đang còn hạn" body={false}>
          {d.active.length ? (
            <table>
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Duyệt ngày</th>
                  <th>Còn lại</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.active.map((a) => (
                  <tr key={a.studentId}>
                    <td>
                      <b>{a.fullName}</b> <span className="mono muted" style={{ fontSize: 12 }}>{a.studentCode}</span>
                    </td>
                    <td>{ddmm(a.approvedAt)}</td>
                    <td>{a.daysLeft <= 2 ? <Badge tone="amber">{`${a.daysLeft} ngày · sắp hết`}</Badge> : `${a.daysLeft} ngày`}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn btn-sm" to={`/enterprise/grants?student=${a.studentId}`}>
                        Xem bài
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon="lock">Chưa có quyền xem bài nào còn hạn.</Empty>
          )}
        </Card>
        <Card title="Lịch sử yêu cầu" body={false}>
          {d.history.length ? (
            <table>
              <tbody>
                {d.history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Link to={`/enterprise/students/${h.studentId}`} style={{ fontWeight: 600 }}>
                        {h.fullName}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={ST[h.state]?.[1] ?? 'gray'}>{ST[h.state]?.[0] ?? h.state}</Badge>
                      {h.adminNote && h.state === 'REJECTED' && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {' '}
                          · “{h.adminNote}”
                        </span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 13, textAlign: 'right' }}>
                      {ddmm(h.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon="list">Chưa gửi yêu cầu nào.</Empty>
          )}
        </Card>
      </div>
      <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
        <Card title="Tìm kiếm gần đây">
          {d.searches.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.searches.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.summary}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.results} kết quả · {fullDT(s.at)}
                    </div>
                  </div>
                  <Link className="btn btn-sm" to={`/enterprise/search?c=${encodeURIComponent(JSON.stringify(s.criteria))}`}>
                    Tìm lại
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="search">Chưa có lượt tìm kiếm nào.</Empty>
          )}
        </Card>
        <Card title="Sinh viên quan tâm">
          {d.interests.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.interests.slice(0, 6).map((s) => (
                <Link key={s.studentId} to={`/enterprise/students/${s.studentId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#1A1C21' }}>
                  <div style={{ flex: 1 }}>
                    <b>{s.fullName}</b>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.cohort ?? '—'} · {s.major ?? '—'}
                    </div>
                  </div>
                  <b className="mono">{gpa(s.gpa)}</b>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon="star">Chưa lưu sinh viên quan tâm.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
