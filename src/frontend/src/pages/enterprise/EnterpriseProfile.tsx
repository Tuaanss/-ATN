import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, Field, Loading, Note, PageHead, initials, useToast } from '../../components/ui';
import { fullDate } from '../../utils/format';
import { FormModal } from '../admin/kit';
import { AccessBadge, RequestModal, avg, type Access } from './common';

interface Work {
  submissionId: string | null;
  title: string;
  keywords: string[];
  course: string;
  semester: string;
  group: string | null;
  groupSize: number | null;
  types: string[];
}
interface Profile {
  id: string;
  studentCode: string;
  fullName: string;
  cohort: string | null;
  major: string | null;
  faculty: string | null;
  hasAvatar: boolean;
  bio: string | null;
  skills: string[];
  links: { github: string | null; behance: string | null; linkedin: string | null };
  avgScore: number | null;
  works: Work[];
  access: Access;
  pending: { createdAt: string; purpose: string; requestedDays: number } | null;
  interested: boolean;
  viewDays: { min: number; max: number };
}
export const TYPE: Record<string, string> = { IMAGE: 'Ảnh', VIDEO: 'Video', SOURCE: 'Mã nguồn', DOCUMENT: 'Báo cáo', FIGMA: 'Figma', GIT: 'GitHub' };

/** Hồ sơ năng lực của sinh viên – mẫu doanh-nghiep/DN_Profile. */
export function EnterpriseProfile() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['enterprise', 'profile', id], queryFn: () => api.get<Profile>(`/enterprise/students/${id}`).then((r) => r.data), retry: false });
  useCrumbs([{ label: 'Tìm kiếm', to: '/enterprise/search' }, { label: q.data?.fullName ?? 'Hồ sơ' }]);
  const [ask, setAsk] = useState(false);
  const [invite, setInvite] = useState(false);
  const toggle = useMutation({ mutationFn: () => api.post(`/enterprise/students/${id}/interest`), onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise'] }) });
  if (q.isError)
    return (
      <div className="page">
        <Card>
          <Empty icon="lock">{errorMessage(q.error)}</Empty>
        </Card>
      </div>
    );
  if (!q.data) return <Loading />;
  const p = q.data;
  const granted = p.access.state === 'ACTIVE';
  return (
    <div className="page">
      <PageHead
        title="Hồ sơ năng lực"
        actions={
          <>
            <button className="btn" onClick={() => toggle.mutate()} style={{ color: p.interested ? '#DB0000' : undefined }}>
              <Icon name="star" size={16} /> {p.interested ? 'Đang quan tâm' : 'Quan tâm'}
            </button>
            <button className="btn" onClick={() => setInvite(true)}>
              <Icon name="bell" size={16} /> Mời phỏng vấn
            </button>
            {granted ? (
              <Link className="btn btn-p" to={`/enterprise/grants?student=${p.id}`}>
                <Icon name="eye" size={16} /> Xem bài ({p.access.state === 'ACTIVE' ? `còn ${p.access.daysLeft} ngày` : ''})
              </Link>
            ) : (
              <button className="btn btn-p" disabled={p.access.state === 'PENDING'} onClick={() => setAsk(true)}>
                Gửi yêu cầu xem bài
              </button>
            )}
          </>
        }
      />
      {p.pending && (
        <Note tone="amber" icon="clock">
          Không thể gửi trùng: {p.fullName} đã có một yêu cầu đang chờ duyệt từ ngày {fullDate(p.pending.createdAt)}.
        </Note>
      )}
      <div className="cols-side" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {p.hasAvatar ? (
                <img src={`/api/v1/account/avatar/${p.id}`} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span className="av" style={{ width: 64, height: 64, fontSize: 22 }}>
                  {initials(p.fullName)}
                </span>
              )}
              <div>
                <b style={{ fontSize: 18 }}>{p.fullName}</b>
                <div className="muted" style={{ fontSize: 13 }}>
                  {p.cohort ?? '—'} · {p.major ?? '—'}
                  {p.faculty ? ` · ${p.faculty}` : ''}
                </div>
              </div>
            </div>
            {p.bio ? <p style={{ fontSize: 14, lineHeight: 1.6 }}>{p.bio}</p> : <p className="muted" style={{ fontSize: 13 }}>Sinh viên chưa viết giới thiệu.</p>}
            {p.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '12px 0', borderTop: '1px solid #EFEDE6', borderBottom: '1px solid #EFEDE6' }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Điểm TB bài tập
              </span>
              <b style={{ fontSize: 26 }}>{avg(p.avgScore)}</b>
              <span className="muted" style={{ fontSize: 13 }}>
                thang 10
              </span>
            </div>
            {[
              ['GitHub', p.links.github],
              ['Behance', p.links.behance],
              ['LinkedIn', p.links.linkedin],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <a key={k} href={v!} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <Icon name="link" size={15} /> {k}
                </a>
              ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="muted">Quyền xem bài:</span> <AccessBadge a={p.access} />
            </div>
          </div>
        </Card>
        <Card title="Đề tài đã thực hiện · chỉ gồm bài đã nộp" body={false}>
          {p.works.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Đề tài</th>
                    <th>Từ khóa</th>
                    <th>Môn · Học kỳ</th>
                    <th>Bài</th>
                  </tr>
                </thead>
                <tbody>
                  {p.works.map((w, i) => (
                    <tr key={i}>
                      <td>
                        <b>{w.title}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {w.group ? (w.groupSize ? `${w.group} · ${w.groupSize} SV` : w.group) : 'Cá nhân'} · {w.types.map((t) => TYPE[t] ?? t).join(' + ')}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {w.keywords.map((k) => (
                            <span key={k} className="chip" style={{ height: 22, fontSize: 12 }}>
                              {k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {w.course} · {w.semester}
                      </td>
                      <td>
                        {w.submissionId ? (
                          <Link className="btn btn-sm" to={`/view/${w.submissionId}`}>
                            <Icon name="eye" size={14} /> Xem
                          </Link>
                        ) : (
                          <Badge tone="gray">Cần quyền</Badge>
                        )}
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
      </div>
      <p className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="shield" size={14} /> Doanh nghiệp không thấy SĐT, email, thông tin phụ huynh và điểm chi tiết từng môn của sinh viên.
      </p>
      {ask && <RequestModal students={[{ id: p.id, fullName: p.fullName }]} viewDays={p.viewDays} onClose={() => setAsk(false)} />}
      {invite && <InviteModal id={p.id} name={p.fullName} onClose={() => setInvite(false)} onDone={() => toast.ok('Đã gửi lời mời tới sinh viên')} />}
    </div>
  );
}

function InviteModal({ id, name, onClose, onDone }: { id: string; name: string; onClose: () => void; onDone: () => void }) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const m = useMutation({ mutationFn: () => api.post(`/enterprise/students/${id}/invite`, { message: msg.trim() }), onSuccess: () => (onDone(), onClose()), onError: (e) => setErr(errorMessage(e)) });
  return (
    <FormModal
      title={`Mời ${name} phỏng vấn`}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={m.isPending} onClick={() => (msg.trim().length < 10 ? setErr('Lời mời tối thiểu 10 ký tự') : m.mutate())}>
            Gửi lời mời
          </button>
        </>
      }
    >
      <Field label="Nội dung lời mời *" error={err}>
        <textarea className="inp" rows={4} maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="VD: Công ty muốn mời bạn phỏng vấn vị trí thực tập UI/UX vào tuần tới…" style={{ height: 'auto', padding: 10 }} />
      </Field>
      <Note tone="blue" icon="info">
        Sinh viên nhận thông báo kèm thông tin liên hệ của doanh nghiệp và tự quyết định liên hệ lại. Doanh nghiệp không thấy liên hệ của sinh viên.
      </Note>
    </FormModal>
  );
}

interface Dash {
  recent: { studentId: string; studentCode: string; fullName: string; cohort: string | null; major: string | null; avgScore: number | null; at: string }[];
  interests: { studentId: string; studentCode: string; fullName: string; cohort: string | null; major: string | null; avgScore: number | null }[];
}

/** Hồ sơ sinh viên: danh sách quan tâm + hồ sơ đã xem gần đây. */
export function EnterpriseStudents() {
  useCrumbs([{ label: 'Hồ sơ sinh viên' }]);
  const q = useQuery({ queryKey: ['enterprise', 'dashboard'], queryFn: () => api.get<Dash>('/enterprise/dashboard').then((r) => r.data) });
  if (!q.data) return <Loading />;
  const list = (rows: (Dash['interests'][number] & { at?: string })[], empty: string) =>
    rows.length ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {rows.map((s) => (
          <Link key={s.studentId} to={`/enterprise/students/${s.studentId}`} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, color: '#1A1C21' }}>
            <span className="av">{initials(s.fullName)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{s.fullName}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {s.cohort ?? '—'} · {s.major ?? '—'}
                {s.at ? ` · xem ${fullDate(s.at)}` : ''}
              </div>
            </div>
            <b className="mono">{avg(s.avgScore)}</b>
          </Link>
        ))}
      </div>
    ) : (
      <Empty icon="users">{empty}</Empty>
    );
  return (
    <div className="page">
      <PageHead
        title="Hồ sơ sinh viên"
        actions={
          <Link className="btn btn-p" to="/enterprise/search">
            <Icon name="search" size={16} /> Tìm kiếm sinh viên
          </Link>
        }
      />
      <Card title="Sinh viên quan tâm">{list(q.data.interests, 'Chưa lưu sinh viên nào. Bấm biểu tượng ngôi sao ở kết quả tìm kiếm để lưu.')}</Card>
      <Card title="Hồ sơ đã xem gần đây">{list(q.data.recent, 'Chưa xem hồ sơ nào.')}</Card>
    </div>
  );
}
