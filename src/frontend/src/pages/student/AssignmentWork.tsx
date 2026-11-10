import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { MyWork, StudentSubmission } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Avatar, Badge, Card, ChipInput, Field, KV, Loading, Modal, Note, PageHead, RowKV, Stepper, useToast, type StepState, type Tone } from '../../components/ui';
import { BriefBody, BriefDetails, filesSummary, lateText, modeBadgeText, Thumbs, type BriefData } from '../../components/work';
import { ddmm, ddmmHHmm, fullDate, fullDT, productsText, remain, score10, SYNC_BADGE } from '../../utils/format';

type View = 'NOT_OPEN' | 'GROUP' | 'TOPIC' | 'SUBMIT' | 'RESULT';
const short = (t: string) => t.split('–')[0].trim();
const groupName = (g: { code: string; name: string }) => (g.name && g.name !== g.code ? `${g.code} · ${g.name}` : g.code);

function viewOf(w: MyWork): View {
  switch (w.status) {
    case 'NOT_OPEN':
      return 'NOT_OPEN';
    case 'NO_GROUP':
      return 'GROUP';
    case 'NO_TOPIC':
      return 'TOPIC';
    case 'NOT_SUBMITTED':
      return 'SUBMIT';
    case 'SUBMITTED':
    case 'LATE':
      return w.assignment.accepting ? 'SUBMIT' : 'RESULT';
    default:
      return 'RESULT';
  }
}

/** Thanh 4 bước: Đề bài & nhóm → Đề tài → Nộp bài → Kết quả. */
function stepsOf(w: MyWork) {
  const a = w.assignment;
  const v = viewOf(w);
  const idx = w.status === 'GRADED' ? 4 : { NOT_OPEN: 0, GROUP: 0, TOPIC: 1, SUBMIT: 2, RESULT: 3 }[v];
  const st = (i: number): StepState => (i < idx ? 'done' : i === idx ? 'current' : 'todo');
  const sub = w.shared ?? w.personal;
  return [
    { title: 'Đề bài & nhóm', sub: a.workMode === 'INDIVIDUAL' ? 'Cá nhân' : w.group ? `${groupName(w.group)} · ${w.group.members.length} người` : 'Chờ GV xếp nhóm', state: st(0) },
    { title: 'Đề tài', sub: w.topic ? short(w.topic.title) : 'Tên đề tài + từ khóa', state: st(1) },
    {
      title: 'Nộp bài',
      sub: w.status === 'MISSED' ? 'Không nộp' : sub ? `Nộp ${ddmmHHmm(sub.submittedAt)}${w.lateDays ? ` · muộn ${w.lateDays} ngày` : ''}` : idx < 2 ? productsText(a.productTypes) : `Chưa nộp · ${remain(a.finalDeadline).text.toLowerCase()}`,
      state: w.status === 'MISSED' ? ('done' as StepState) : st(2),
    },
    { title: 'Kết quả', sub: w.status === 'GRADED' ? `${score10(w.grade?.score)} / 10` : 'Khi GV công bố điểm', state: st(3) },
  ];
}

function headBadge(w: MyWork): [string, Tone] {
  switch (w.status) {
    case 'NOT_OPEN':
      return ['Chưa mở', 'gray'];
    case 'NO_GROUP':
      return ['Chờ xếp nhóm', 'amber'];
    case 'NO_TOPIC':
      return ['Bước 2 · Đề tài', 'amber'];
    case 'NOT_SUBMITTED':
      return ['Bước 3 · Nộp bài', 'blue'];
    case 'SUBMITTED':
    case 'LATE':
      return [w.status === 'LATE' ? 'Đã nộp muộn' : 'Đã nộp', 'blue'];
    case 'GRADED':
      return ['Đã có điểm', 'green'];
    default:
      return ['Quá hạn · chưa nộp', 'red'];
  }
}

function headSub(w: MyWork) {
  const a = w.assignment;
  const past = new Date(a.dueAt) < new Date();
  return [a.section.code, a.section.course.name, a.section.lecturer.fullName, modeBadgeText(a), `Hạn nộp ${fullDT(a.dueAt)}${past && w.status !== 'GRADED' ? ' (đã qua)' : ''}`].join(' · ');
}

const briefOf = (w: MyWork): BriefData => ({ ...w.assignment });

function Locked({ icon = 'lock', children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', padding: 8 }}>
      <span style={{ color: '#8A8E97' }}>
        <Icon name={icon} size={24} />
      </span>
      <span className="muted" style={{ fontSize: 13 }}>
        {children}
      </span>
    </div>
  );
}

/** Trang bài tập của sinh viên – 4 bước (mẫu SV_AssignmentNew, SV_StepGroup, SV_StepTopic, SV_StepSubmit, SV_AssignmentDone). */
export function AssignmentWork() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['student', 'work', id], queryFn: () => api.get<MyWork>(`/student/assignments/${id}`).then((r) => r.data) });
  const w = q.data;
  useCrumbs([
    { label: 'Bài tập', to: '/student/assignments' },
    ...(w ? [{ label: `${w.assignment.section.code} · ${w.assignment.section.course.name}`, to: `/student/courses/${w.assignment.section.id}` }, { label: short(w.assignment.title) }] : []),
  ]);

  if (q.isLoading) return <Loading />;
  if (!w)
    return (
      <div className="page">
        <PageHead title="Không mở được bài tập" sub={errorMessage(q.error)} />
      </div>
    );

  const a = w.assignment;
  const v = viewOf(w);
  const [badge, tone] = headBadge(w);
  const sub = w.shared ?? w.personal;

  return (
    <div className="page">
      <PageHead
        title={a.title}
        badge={<Badge tone={tone}>{badge}</Badge>}
        sub={headSub(w)}
        actions={
          v === 'RESULT' && sub ? (
            <Link className="btn" to={`/view/${sub.id}`}>
              <Icon name="eye" size={16} />
              Xem bài đã nộp
            </Link>
          ) : undefined
        }
      />
      <Stepper steps={stepsOf(w)} />
      {v === 'NOT_OPEN' && (
        <Note tone="gray" icon="clock">
          Bài tập mở lúc <b>{fullDT(a.openAt)}</b>.
        </Note>
      )}
      {v === 'GROUP' && <GroupStep w={w} />}
      {v === 'TOPIC' && <TopicStep w={w} />}
      {v === 'SUBMIT' && <SubmitStep w={w} />}
      {v === 'RESULT' && <ResultStep w={w} />}
    </div>
  );
}

// ================================================================ dùng chung

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['student'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/** Nhóm của tôi (chỉ xem) + "Báo nhóm chưa đúng". */
function GroupCard({ w }: { w: MyWork }) {
  const a = w.assignment;
  const [open, setOpen] = useState(false);
  if (a.workMode !== 'GROUP') return null;
  const r = w.report;
  const pending = r?.status === 'OPEN';
  return (
    <Card
      title="Nhóm của tôi"
      extra={w.group ? <Badge tone="green">{groupName(w.group)}</Badge> : <Badge tone="amber">Chưa có nhóm</Badge>}
    >
      {w.group ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {w.group.members.map((m) => (
            <div key={m.studentId} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <Avatar name={m.fullName} size={28} strong={m.studentId === w.me.studentId} />
              <span style={{ flex: 1 }}>
                {m.fullName}
                {m.studentId === w.me.studentId ? ' (bạn)' : ''}
                <span className="mono muted" style={{ fontSize: 12, marginLeft: 8 }}>
                  {m.studentCode}
                </span>
              </span>
              {m.role === 'LEADER' && <Badge tone="dark">Trưởng nhóm</Badge>}
            </div>
          ))}
        </div>
      ) : (
        <Locked icon="users">Giảng viên chưa đưa bạn vào danh sách nhóm của bài tập này.</Locked>
      )}
      {pending ? (
        <Note tone="amber" icon="clock">
          Bạn đã báo nhóm chưa đúng lúc {ddmmHHmm(r.createdAt)}: “{r.content}”. Đang chờ giảng viên xử lý.
        </Note>
      ) : (
        <>
          {r?.status === 'RESOLVED' && (
            <Note tone="green" icon="check">
              Giảng viên đã xử lý phản hồi của bạn{r.resolvedAt ? ` (${ddmm(r.resolvedAt)})` : ''}
              {r.resolutionNote ? `: “${r.resolutionNote}”` : '.'}
            </Note>
          )}
          <button className="btn btn-sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
            <Icon name="warn" size={14} />
            Báo nhóm chưa đúng
          </button>
        </>
      )}
      <ReportModal w={w} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function ReportModal({ w, open, onClose }: { w: MyWork; open: boolean; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();
  const refresh = useRefresh();
  const m = useMutation({
    mutationFn: () => api.post(`/student/assignments/${w.assignment.id}/group-report`, { content: content.trim() }),
    onSuccess: () => {
      refresh();
      toast.ok('Đã gửi phản hồi cho giảng viên');
      setContent('');
      onClose();
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="sec">Báo nhóm chưa đúng</h2>
      <Field label="Mô tả *" error={err} help={`${content.length}/500 · VD: Em đăng ký nhóm N02 cùng bạn A, B nhưng danh sách xếp em vào N05`}>
        <textarea className={`inp${err ? ' inp-err' : ''}`} rows={4} maxLength={500} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>
          Hủy
        </button>
        <button
          className="btn btn-p"
          type="button"
          disabled={m.isPending}
          onClick={() => {
            if (content.trim().length < 5) return setErr('Mô tả ít nhất 5 ký tự');
            setErr('');
            m.mutate();
          }}
        >
          <Icon name="upload" size={16} />
          Gửi giảng viên
        </button>
      </div>
    </Modal>
  );
}

/** Form tên đề tài + 1–5 từ khóa (không cần duyệt). */
function TopicForm({ w, onSaved, onCancel }: { w: MyWork; onSaved?: () => void; onCancel?: () => void }) {
  const a = w.assignment;
  const t = w.topic;
  const toast = useToast();
  const refresh = useRefresh();
  const [title, setTitle] = useState(t?.title ?? '');
  const [keywords, setKeywords] = useState<string[]>(t?.keywords ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setTitle(t?.title ?? '');
    setKeywords(t?.keywords ?? []);
  }, [t?.title, t?.keywords]);
  const m = useMutation({
    mutationFn: () => api.put(`/student/assignments/${a.id}/topic`, { title: title.trim(), keywords }),
    onSuccess: () => {
      refresh();
      toast.ok(t ? 'Đã cập nhật đề tài' : 'Đã lưu đề tài');
      onSaved?.();
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  const save = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 5) e.title = 'Tên đề tài 5–200 ký tự';
    if (!keywords.length) e.keywords = 'Gắn ít nhất 1 từ khóa';
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <>
      <Field label="Tên đề tài *" error={errors.title} help={`5–200 ký tự · ${title.length}/200`}>
        <input className={`inp${errors.title ? ' inp-err' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="VD: Ứng dụng đặt lịch khám bệnh" />
      </Field>
      {a.suggestedTopics.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Gợi ý từ GV:
          </span>
          {a.suggestedTopics.map((s) => (
            <button key={s} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setTitle(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <Field label="Từ khóa * (1–5)" error={errors.keywords} help="Gõ rồi nhấn Enter · dùng để tìm kiếm và thống kê đề tài">
        <ChipInput value={keywords} onChange={setKeywords} placeholder="VD: UI/UX, Mobile, Y tế" />
      </Field>
      {t && t.similar.length > 0 && (
        <Note tone="gray" icon="warn">
          Đề tài tương tự trong lớp:{' '}
          {t.similar.map((s, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <b>{s.owner}</b> “{s.title}”
            </span>
          ))}
        </Note>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            Hủy
          </button>
        )}
        <button className="btn btn-p" type="button" disabled={m.isPending} onClick={save}>
          {m.isPending ? <span className="spinner" /> : <Icon name="check" size={16} />}
          Lưu đề tài
        </button>
      </div>
    </>
  );
}

/** Đề tài đã nhập (chỉ xem, có nút sửa trước hạn). */
function TopicCard({ w }: { w: MyWork }) {
  const [editing, setEditing] = useState(false);
  const t = w.topic;
  if (!t) return null;
  const canEdit = w.assignment.accepting;
  return (
    <Card
      title={w.group ? 'Đề tài của nhóm' : 'Đề tài'}
      extra={
        canEdit &&
        !editing && (
          <button className="btn btn-sm" type="button" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} />
            Sửa
          </button>
        )
      }
    >
      {editing ? (
        <TopicForm w={w} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <KV
          rows={[
            ['Tên đề tài', t.title],
            [
              'Từ khóa',
              <span key="k" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {t.keywords.map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </span>,
            ],
            ['Cập nhật', `${t.history[0]?.actor ?? ''} · ${ddmmHHmm(t.updatedAt)}`],
          ]}
        />
      )}
    </Card>
  );
}

function StatusCard({ w, children }: { w: MyWork; children?: ReactNode }) {
  const a = w.assignment;
  const rm = remain(a.finalDeadline);
  const s = w.shared ?? (w.group ? null : w.personal);
  return (
    <Card title="Tình trạng">
      <RowKV label="Hình thức">{a.workMode === 'GROUP' ? (w.group ? groupName(w.group) : 'Nhóm · chờ xếp') : 'Cá nhân'}</RowKV>
      <RowKV label="Đề tài">{w.topic ? <Badge tone="green">Đã nhập</Badge> : <Badge tone="gray">Chưa nhập</Badge>}</RowKV>
      <RowKV label="Bài nộp">{s ? <Badge tone="blue">{s.isLate ? 'Nộp muộn' : 'Đã nộp'}</Badge> : <Badge tone="gray">Chưa nộp</Badge>}</RowKV>
      <RowKV label="Hạn nộp">{fullDT(a.dueAt)}</RowKV>
      {a.accepting && (
        <RowKV label="Còn lại">
          <Badge tone={rm.tone === 'gray' ? 'green' : rm.tone}>{rm.text.replace('Còn ', '')}</Badge>
        </RowKV>
      )}
      <RowKV label="Nộp muộn">{lateText(a) ? lateText(a)!.replace('Nhận nộp muộn ', '') : 'Không nhận'}</RowKV>
      {children}
    </Card>
  );
}

// ================================================================ Bước 1 – Đề bài & nhóm (chờ GV xếp nhóm)

function GroupStep({ w }: { w: MyWork }) {
  return (
    <>
      <Note tone="amber" icon="users">
        Bài tập làm theo nhóm. Giảng viên sẽ <b>tải danh sách nhóm</b> lên hệ thống; khi có tên trong danh sách bạn sẽ nhận thông báo và nhập được đề tài.
      </Note>
      <div className="cols-2-1">
        <div className="col">
          <Card title="Đề bài">
            <BriefBody b={briefOf(w)} />
          </Card>
        </div>
        <div className="col">
          <GroupCard w={w} />
          <StatusCard w={w} />
        </div>
      </div>
    </>
  );
}

// ================================================================ Bước 2 – Đề tài

function TopicStep({ w }: { w: MyWork }) {
  return (
    <div className="cols-2-1">
      <div className="col">
        <BriefDetails b={briefOf(w)} open={!w.group && w.assignment.workMode === 'INDIVIDUAL'} />
        <Card title={w.group ? 'Đề tài của nhóm' : 'Đề tài của bạn'} extra={<Badge tone="gray">Chưa nhập</Badge>}>
          <TopicForm w={w} />
        </Card>
      </div>
      <div className="col">
        <GroupCard w={w} />
        <StatusCard w={w} />
        <Card title="Nộp bài">
          <Locked>Mở sau khi lưu đề tài.</Locked>
        </Card>
      </div>
    </div>
  );
}

// ================================================================ Bước 3 – Nộp bài (SV_StepSubmit)

function SubmissionBlock({ s, who, me, children }: { s: StudentSubmission; who: string; me: boolean; children?: ReactNode }) {
  const sync = SYNC_BADGE[s.syncStatus] ?? { label: s.syncStatus, tone: 'gray' as Tone };
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar name={s.submittedBy} />
        <div style={{ flex: 1, fontSize: 13, minWidth: 200 }}>
          <b>{s.submittedBy}</b>
          {me ? ' (bạn)' : ''} {who}
          <div className="muted">
            {fullDT(s.submittedAt)} · {filesSummary(s.files, s.figmaUrl, s.gitUrl)}
          </div>
        </div>
        {s.isLate ? <Badge tone="amber">Nộp muộn</Badge> : <Badge tone="blue">Đã nộp</Badge>}
        <Badge tone={sync.tone}>{sync.tone === 'green' ? 'Đã đồng bộ Drive' : sync.label}</Badge>
      </div>
      {s.files.length > 0 && <Thumbs submissionId={s.id} files={s.files} max={12} />}
      {s.feedback?.map((f, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 10, background: '#FFF4F4', border: '1px solid #F2AAAA', fontSize: 14, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="edit" size={15} /> Nhận xét của giảng viên
          </b>
          <span style={{ whiteSpace: 'pre-wrap' }}>{f.content}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {f.lecturer} · {ddmmHHmm(f.updatedAt)}
          </span>
        </div>
      ))}
      {children}
    </>
  );
}

function SubmitStep({ w }: { w: MyWork }) {
  const a = w.assignment;
  const isGroup = !!w.group;
  const s = w.shared ?? (isGroup ? null : w.personal);
  const rm = remain(a.finalDeadline);
  const meCode = w.group?.members.find((m) => m.studentId === w.me.studentId)?.studentCode;
  const personalNeeded = isGroup && a.hasIndividualPart;
  const submitUrl = `/student/assignments/${a.id}/submit`;

  return (
    <>
      {s ? (
        <Note tone="blue" icon="upload">
          {isGroup ? 'Nhóm đã nộp bài chung.' : 'Bạn đã nộp bài.'} Vẫn có thể <b>nộp lại đến {fullDT(a.finalDeadline)}</b> (còn <b>{rm.text.replace('Còn ', '')}</b>); loại tệp nào có tệp mới thì thay loại đó.
          {personalNeeded && (w.personal ? ' Phần cá nhân của bạn đã nộp.' : <> Phần cá nhân của bạn <b>chưa nộp</b>.</>)}
        </Note>
      ) : (
        <Note tone="amber" icon="clock">
          {isGroup ? 'Nhóm chưa nộp bài chung.' : 'Bạn chưa nộp bài.'} Hạn nộp <b>{fullDT(a.dueAt)}</b> ({rm.text.toLowerCase()}).
          {lateText(a) ? ` ${lateText(a)}.` : ' Không nhận nộp muộn.'}
        </Note>
      )}
      <div className="cols-2-1">
        <div className="col">
          <BriefDetails b={briefOf(w)} />
          <Card title={isGroup ? 'Bài chung của nhóm' : 'Bài nộp của bạn'} extra={s && <Badge tone="gray">{filesSummary(s.files, s.figmaUrl, s.gitUrl).replace(/ · /g, ' + ')}</Badge>}>
            {s ? (
              <SubmissionBlock s={s} who="đã nộp bản hiện tại" me={s.submittedByCode === meCode}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Link className="btn" to={`/view/${s.id}`}>
                    <Icon name="eye" size={16} />
                    Xem bài
                  </Link>
                  {a.accepting && (
                    <Link className="btn btn-p" to={submitUrl}>
                      <Icon name="upload" size={16} />
                      {isGroup ? 'Nộp lại / sửa bài chung' : 'Nộp lại / sửa bài'}
                    </Link>
                  )}
                </div>
              </SubmissionBlock>
            ) : (
              <>
                <Locked icon="upload">{isGroup ? 'Nhóm chưa nộp bài. Mọi thành viên đều nộp được bài chung.' : 'Bạn chưa nộp bài.'}</Locked>
                {a.accepting && (
                  <Link className="btn btn-p" to={submitUrl} style={{ alignSelf: 'center' }}>
                    <Icon name="upload" size={16} />
                    Nộp bài
                  </Link>
                )}
              </>
            )}
          </Card>
          {personalNeeded && (
            <Card title="Phần cá nhân của bạn">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#62666F', display: 'inline-flex' }}>
                  <Icon name="lock" size={20} />
                </span>
                <div style={{ flex: 1, fontSize: 14, minWidth: 200 }}>
                  Chỉ bạn và giảng viên thấy · {w.personal ? `${filesSummary(w.personal.files, w.personal.figmaUrl, w.personal.gitUrl)} · nộp ${ddmmHHmm(w.personal.submittedAt)}` : 'ảnh phần việc + mô tả đóng góp'}
                </div>
                <Badge tone={w.personal ? 'blue' : 'gray'}>{w.personal ? 'Đã nộp' : 'Chưa nộp'}</Badge>
                {a.accepting && (
                  <Link className={`btn btn-sm${w.personal ? '' : ' btn-p'}`} to={`${submitUrl}?part=personal`}>
                    {w.personal ? 'Sửa phần cá nhân' : 'Nộp phần cá nhân'}
                  </Link>
                )}
              </div>
              {w.personal?.feedback.map((f, i) => (
                <div key={i} style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#FFF4F4', border: '1px solid #F2AAAA', fontSize: 14, lineHeight: 1.6 }}>
                  <b>Nhận xét của giảng viên về phần cá nhân:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{f.content}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {f.lecturer} · {ddmmHHmm(f.updatedAt)}
                  </div>
                </div>
              ))}
            </Card>
          )}
          <TopicCard w={w} />
        </div>
        <div className="col">
          <StatusCard w={w}>
            <RowKV label="Điểm">
              <span className="muted">Khi GV công bố</span>
            </RowKV>
          </StatusCard>
          <GroupCard w={w} />
          {w.events.length > 0 && <HistoryCard w={w} />}
        </div>
      </div>
    </>
  );
}

function HistoryCard({ w, extra }: { w: MyWork; extra?: [string, string][] }) {
  const evText = (e: MyWork['events'][number]) => {
    const n = e.detail?.added?.length;
    if (e.action === 'SUBMIT' || e.action === 'RESUBMIT') return `${e.action === 'RESUBMIT' ? 'Nộp lại' : 'Nộp lần đầu'}${n ? ` (${n} tệp mới)` : ''} · ${e.actor}`;
    if (e.action === 'DELETE_FILES') return `Xóa ${e.detail?.removed?.length ?? ''} tệp · ${e.actor}`;
    return e.action === 'SYNC_FAILED' ? 'Lỗi đồng bộ Drive' : e.action;
  };
  return (
    <Card title="Lịch sử nộp bài">
      {extra?.map(([t, d], i) => (
        <div key={`x${i}`} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{t}</span>
          <span className="muted">{d}</span>
        </div>
      ))}
      {w.events.map((e, i) => (
        <div key={i} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{evText(e)}</span>
          <span className="muted" style={{ whiteSpace: 'nowrap' }}>
            {ddmmHHmm(e.createdAt)}
          </span>
        </div>
      ))}
    </Card>
  );
}

// ================================================================ Bước 4 – Kết quả (SV_AssignmentDone)

function ResultStep({ w }: { w: MyWork }) {
  const a = w.assignment;
  const s = w.shared ?? w.personal;
  const meCode = w.group?.members.find((m) => m.studentId === w.me.studentId)?.studentCode;
  const missed = w.status === 'MISSED';
  const graded = w.status === 'GRADED';
  const score = w.grade?.score ?? null;
  return (
    <>
      {!graded && (
        <Note tone={missed ? 'red' : 'gray'} icon={missed ? 'warn' : 'clock'}>
          {missed ? (
            <>
              Đã hết hạn nộp và {w.group ? 'nhóm' : 'bạn'} <b>chưa nộp bài</b>.
            </>
          ) : (
            <>
              Đã hết hạn nộp. Điểm sẽ hiển thị tại đây khi giảng viên <b>công bố</b>; bạn sẽ nhận thông báo.
            </>
          )}
        </Note>
      )}
      <div className="cols-2-1">
        <div className="col">
          <BriefDetails b={briefOf(w)} />
          {graded && (
            <Card title="Kết quả">
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '16px 24px', borderRadius: 12, background: score != null && score < 4 ? '#FCE8E6' : '#EAF6EC' }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: score != null && score < 4 ? '#B42318' : '#15803D', letterSpacing: '-.02em' }}>{score10(score)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    / 10{a.gradesPublishedAt ? ` · công bố ${ddmm(a.gradesPublishedAt)}` : ''}
                  </span>
                </div>
              </div>
              {w.grade?.note && (
                <div style={{ padding: 14, borderRadius: 10, background: '#F7F6F2', fontSize: 14, lineHeight: 1.6 }}>
                  <b>Nhận xét của giảng viên:</b> {w.grade.note}
                </div>
              )}
            </Card>
          )}
          {s && (
            <Card title="Bài đã nộp (chỉ xem)" extra={<Badge tone="blue">{s.isLate ? 'Nộp muộn' : 'Đã nộp'}</Badge>}>
              <SubmissionBlock s={s} who="đã nộp bản cuối" me={s.submittedByCode === meCode}>
                {!a.accepting && (
                  <Note tone="gray" icon="lock">
                    Đã hết hạn: không thể nộp lại hay xóa tệp.
                  </Note>
                )}
              </SubmissionBlock>
            </Card>
          )}
          <TopicCard w={w} />
        </div>
        <div className="col">
          <Card title="Tình trạng">
            <RowKV label="Trạng thái">{graded ? <Badge tone="green">Đã có điểm</Badge> : missed ? <Badge tone="red">Chưa nộp</Badge> : <Badge tone="blue">Chờ điểm</Badge>}</RowKV>
            <RowKV label="Nộp lúc">{s ? ddmmHHmm(s.submittedAt) : '—'}</RowKV>
            <RowKV label="Đúng hạn">{!s ? '—' : w.lateDays ? <Badge tone="amber">Muộn {w.lateDays} ngày</Badge> : <Badge tone="green">Đúng hạn</Badge>}</RowKV>
            <RowKV label="Điểm">{graded ? <b>{score10(score)}</b> : <span className="muted">Chưa công bố</span>}</RowKV>
            {a.gradesPublishedAt && <RowKV label="Công bố">{fullDate(a.gradesPublishedAt)}</RowKV>}
          </Card>
          <GroupCard w={w} />
          <HistoryCard w={w} extra={a.gradesPublishedAt ? [['Giảng viên công bố điểm', ddmm(a.gradesPublishedAt)]] : []} />
        </div>
      </div>
    </>
  );
}
