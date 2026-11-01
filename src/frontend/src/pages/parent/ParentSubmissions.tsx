import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Badge, Card, Empty, Loading, PageHead, type Tone } from '../../components/ui';
import { fullDT, score10, semesterLabel } from '../../utils/format';
import { useChild } from './child';

interface Sub {
  id: string;
  title: string;
  workMode: 'GROUP' | 'INDIVIDUAL';
  course: string;
  courseType: string;
  sectionCode: string;
  semester: { code: string; academicYear: string; term: string };
  dueAt: string;
  status: 'NOT_OPEN' | 'NO_GROUP' | 'NO_TOPIC' | 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'MISSED' | 'GRADED';
  score: number | null;
  lecturerNote: string | null;
  feedback: { id: string; lecturer: string; content: string; updatedAt: string; personal: boolean }[];
  group: string | null;
  topic: string | null;
  keywords: string[];
  submissionId: string | null;
  personalId: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  isLate: boolean;
  images: number;
  videos: number;
  hasFigma: boolean;
  hasGit: boolean;
}
type F = '' | 'PENDING' | 'MISSED' | 'SUBMITTED' | 'LATE' | 'GRADED';
const ST: Record<Exclude<F, ''>, [string, Tone]> = { PENDING: ['Chưa nộp', 'gray'], MISSED: ['Quá hạn – chưa nộp', 'red'], SUBMITTED: ['Đã nộp', 'blue'], LATE: ['Nộp muộn', 'amber'], GRADED: ['Đã chấm', 'green'] };
const bucket = (s: Sub['status']): Exclude<F, ''> => (s === 'GRADED' ? 'GRADED' : s === 'LATE' ? 'LATE' : s === 'SUBMITTED' ? 'SUBMITTED' : s === 'MISSED' ? 'MISSED' : 'PENDING');
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

/** Bài nộp của con – mẫu phu-huynh/bai-nop (chỉ xem, không tải xuống). */
export function ParentSubmissions() {
  const { child, loading } = useChild();
  useCrumbs([{ label: 'Bài nộp của con' }]);
  const q = useQuery({ queryKey: ['parent', 'subs', child?.id], queryFn: () => api.get<Sub[]>(`/parent/children/${child!.id}/submissions`).then((r) => r.data), enabled: !!child });
  const [text, setText] = useState('');
  const [sem, setSem] = useState('');
  const [st, setSt] = useState<F>('');
  if (loading || (child && !q.data)) return <Loading />;
  if (!child)
    return (
      <div className="page">
        <Empty icon="users">Tài khoản chưa liên kết với sinh viên nào.</Empty>
      </div>
    );
  const all = q.data!;
  const sems = [...new Map(all.map((s) => [s.semester.code, s.semester])).values()];
  const rows = all.filter((s) => (!text || norm(`${s.course} ${s.title} ${s.topic ?? ''} ${s.sectionCode}`).includes(norm(text))) && (!sem || s.semester.code === sem) && (!st || bucket(s.status) === st));
  const c = (k: Exclude<F, ''>) => all.filter((s) => bucket(s.status) === k).length;
  const graded = all.filter((s) => s.score != null);
  const tiles: [string, string | number, IconName][] = [
    ['Tổng bài tập', all.length, 'file'],
    ['Đã nộp', c('SUBMITTED') + c('LATE') + c('GRADED'), 'check'],
    ['Chưa nộp / quá hạn', c('PENDING') + c('MISSED'), 'clock'],
    ['Điểm TB các bài đã chấm', graded.length ? score10(graded.reduce((a, s) => a + s.score!, 0) / graded.length) : '—', 'chart'],
  ];
  return (
    <div className="page">
      <PageHead title={`Bài nộp · ${child.fullName}`} />
      <div className="grid4">
        {tiles.map(([k, v, i]) => (
          <div key={k} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#62666F' }}>
              <Icon name={i} size={16} /> {k}
            </span>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      <Card body={false}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #EFEDE6' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px', maxWidth: 360, height: 40, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 12px', color: '#62666F' }}>
            <Icon name="search" size={16} />
            <input aria-label="Tìm bài nộp" placeholder="Tìm theo môn, bài tập, đề tài…" value={text} onChange={(e) => setText(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent', font: "400 14px 'Be Vietnam Pro',sans-serif", flex: 1, minWidth: 0 }} />
          </label>
          <select className="inp" aria-label="Học kỳ" value={sem} onChange={(e) => setSem(e.target.value)} style={{ width: 'auto', height: 40 }}>
            <option value="">Mọi học kỳ</option>
            {sems.map((s) => (
              <option key={s.code} value={s.code}>
                {semesterLabel(s)}
              </option>
            ))}
          </select>
          <select className="inp" aria-label="Trạng thái" value={st} onChange={(e) => setSt(e.target.value as F)} style={{ width: 'auto', height: 40 }}>
            <option value="">Mọi trạng thái</option>
            {(Object.keys(ST) as Exclude<F, ''>[]).map((k) => (
              <option key={k} value={k}>
                {ST[k][0]}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          rows.map((s) => {
            const [l, t] = ST[bucket(s.status)];
            const has = !!s.submissionId;
            return (
              <div key={s.id} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: '1px solid #EFEDE6', alignItems: 'center', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 120,
                    height: 76,
                    borderRadius: 8,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 4,
                    background: !has ? '#F1F0EA' : !s.images && s.videos ? '#14161A' : '#FDECEC',
                    color: !has ? (s.status === 'MISSED' ? '#B42318' : '#8A8E97') : !s.images && s.videos ? '#fff' : '#DB0000',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Icon name={!has ? (s.status === 'MISSED' ? 'warn' : 'clock') : s.images ? 'image' : s.videos ? 'play' : s.hasGit ? 'code' : 'file'} size={24} />
                  {has && (s.images ? `${s.images} ảnh` : s.videos ? `${s.videos} video` : s.hasFigma ? 'Figma' : s.hasGit ? 'GitHub' : '')}
                </div>
                <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge tone={t} dot>
                      {l}
                    </Badge>
                    <Badge tone={s.workMode === 'GROUP' ? 'blue' : 'gray'}>{s.workMode === 'GROUP' ? 'Bài chung của nhóm' : 'Bài cá nhân'}</Badge>
                    {s.score != null && <Badge tone="green">Điểm {score10(s.score)}</Badge>}
                  </div>
                  <b style={{ fontSize: 15 }}>{s.title}</b>
                  <div className="muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                    <span>
                      {s.course} · <span className="mono">{s.sectionCode}</span>
                    </span>
                    {s.topic ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="tag" size={14} /> {s.topic}
                      </span>
                    ) : (
                      <span style={{ color: '#B42318' }}>Chưa đăng ký đề tài</span>
                    )}
                  </div>
                  <div className="muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                    {has && s.submittedAt && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="upload" size={14} /> {s.submittedBy} nộp lúc {fullDT(s.submittedAt)}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="calendar" size={14} /> Hạn {fullDT(s.dueAt)}
                    </span>
                    {s.group && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="users" size={14} /> {s.group}
                      </span>
                    )}
                  </div>
                  {s.feedback.map((f) => (
                    <span key={f.id} style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: '#FFF4F4', whiteSpace: 'pre-wrap' }}>
                      <b>Nhận xét của GV{f.personal ? ' (phần cá nhân)' : ''}:</b> {f.content}
                    </span>
                  ))}
                  {s.lecturerNote && (
                    <span style={{ fontSize: 13 }}>
                      <b>Nhận xét của GV:</b> {s.lecturerNote}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {has ? (
                    <>
                      <Link className="btn" to={`/view/${s.submissionId}`}>
                        <Icon name="eye" size={16} /> Xem bài
                      </Link>
                      {s.personalId && (
                        <Link className="btn btn-sm btn-g" to={`/view/${s.personalId}`}>
                          Phần cá nhân của con
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Chưa có bài nộp
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <Empty icon="file">Không có bài nộp phù hợp.</Empty>
        )}
      </Card>
      <p className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="shield" size={14} /> Phụ huynh chỉ xem bài nộp, không tải xuống hay chỉnh sửa.
      </p>
    </div>
  );
}
