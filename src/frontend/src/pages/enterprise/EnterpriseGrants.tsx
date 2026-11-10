import { useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, Loading, Note, PageHead, initials } from '../../components/ui';
import { fullDate, fullDT } from '../../utils/format';
import { avg } from './common';
import { TYPE } from './EnterpriseProfile';

interface Grant {
  studentId: string;
  studentCode: string;
  fullName: string;
  avgScore: number | null;
  works: number;
  active: boolean;
  revoked: boolean;
  approvedAt: string;
  expiresAt: string | null;
  daysLeft: number;
}
interface Works {
  expiresAt: string;
  daysLeft: number;
  works: { submissionId: string; title: string; keywords: string[]; course: string; semester: string; group: string | null; groupSize: number | null; types: string[] }[];
  views: { label: string | null; at: string }[];
}

/** Bài được cấp quyền xem – mẫu doanh-nghiep/DN_ViewSubmissions. */
export function EnterpriseGrants() {
  useCrumbs([{ label: 'Bài được cấp quyền' }]);
  const [params, setParams] = useSearchParams();
  const g = useQuery({ queryKey: ['enterprise', 'grants'], queryFn: () => api.get<Grant[]>('/enterprise/grants').then((r) => r.data) });
  const sel = params.get('student') ?? g.data?.find((x) => x.active)?.studentId ?? '';
  const cur = g.data?.find((x) => x.studentId === sel);
  const w = useQuery({ queryKey: ['enterprise', 'grant', sel], queryFn: () => api.get<Works>(`/enterprise/grants/${sel}`).then((r) => r.data), enabled: !!cur?.active, retry: false });
  if (!g.data) return <Loading />;
  const active = g.data.filter((x) => x.active).length;
  return (
    <div className="page">
      <PageHead title="Bài được cấp quyền xem" sub="Chỉ xem trong thời hạn được duyệt · không tải xuống · mọi lượt xem được ghi lại" />
      {!g.data.length ? (
        <Card>
          <Empty icon="lock">
            Chưa có quyền xem bài nào. Tìm sinh viên ở <Link to="/enterprise/search">Tìm kiếm sinh viên</Link> rồi gửi yêu cầu xem bài.
          </Empty>
        </Card>
      ) : (
        <div className="cols-side" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,300px) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
          <Card title={`Sinh viên (${active} còn hạn)`} body={false}>
            {g.data.map((x) => (
              <button
                key={x.studentId}
                type="button"
                onClick={() => setParams({ student: x.studentId })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', border: 0, borderBottom: '1px solid #EFEDE6', background: x.studentId === sel ? '#FFF4F4' : '#fff', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', opacity: x.active ? 1 : 0.6 }}
              >
                <span className="av">{initials(x.fullName)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block' }}>{x.fullName}</b>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {x.active ? `Điểm TB ${avg(x.avgScore)} · ${x.works} bài` : x.revoked ? 'Đã thu hồi' : `Hết hạn ${x.expiresAt ? fullDate(x.expiresAt) : ''}`}
                  </span>
                </span>
                {x.active ? <Badge tone={x.daysLeft <= 2 ? 'amber' : 'green'}>{`Còn ${x.daysLeft} ngày`}</Badge> : <Badge tone="gray">{x.revoked ? 'Thu hồi' : 'Hết hạn'}</Badge>}
              </button>
            ))}
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!cur ? (
              <Card>
                <Empty icon="users">Chọn sinh viên ở danh sách bên trái.</Empty>
              </Card>
            ) : !cur.active ? (
              <Card>
                <Empty icon="lock">
                  Quyền xem bài của {cur.fullName} đã {cur.revoked ? 'bị thu hồi' : 'hết hạn'}. <Link to={`/enterprise/students/${cur.studentId}`}>Gửi yêu cầu mới</Link>
                </Empty>
              </Card>
            ) : w.isError ? (
              <Card>
                <Empty icon="lock">{errorMessage(w.error)}</Empty>
              </Card>
            ) : !w.data ? (
              <Loading />
            ) : (
              <>
                <Card title={`Bài nộp của ${cur.fullName}`} extra={<span className="muted" style={{ fontSize: 13 }}>Còn {w.data.daysLeft} ngày · hết hạn {fullDate(w.data.expiresAt)}</span>} body={false}>
                  {w.data.works.length ? (
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Đề tài</th>
                            <th>Môn · học kỳ</th>
                            <th>Loại</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {w.data.works.map((x) => (
                            <tr key={x.submissionId}>
                              <td>
                                <b>{x.title}</b>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {x.group ? (x.groupSize ? `${x.group} · ${x.groupSize} SV` : x.group) : 'Cá nhân'}
                                  {x.keywords.length ? ` · ${x.keywords.join(', ')}` : ''}
                                </div>
                              </td>
                              <td>
                                {x.course} · {x.semester}
                              </td>
                              <td>{x.types.map((t) => TYPE[t] ?? t).join(' + ') || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <Link className="btn btn-sm" to={`/view/${x.submissionId}`}>
                                  <Icon name="eye" size={14} /> Xem
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty icon="file">Sinh viên chưa có bài đã nộp.</Empty>
                  )}
                </Card>
                <Note tone="gray" icon="shield">
                  Lượt xem được ghi vào nhật ký và sinh viên xem được nhật ký này.
                  {w.data.views.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {w.data.views.slice(0, 5).map((v, i) => (
                        <span key={i}>
                          {v.label} · {fullDT(v.at)}
                        </span>
                      ))}
                    </div>
                  )}
                </Note>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
