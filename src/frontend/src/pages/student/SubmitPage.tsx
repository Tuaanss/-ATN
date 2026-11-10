import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fileUrl } from '../../api/client';
import type { MyWork, StudentSubmission, SubmissionFile } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Avatar, Badge, Card, Field, Loading, Modal, Note, PageHead, RowKV, Seg, useToast, type Tone } from '../../components/ui';
import { DropZone, filesSummary, lateText } from '../../components/work';
import { ddmmHHmm, fmtSize, fullDT, remain, SYNC_BADGE } from '../../utils/format';

type Kind = 'IMAGE' | 'VIDEO' | 'SOURCE' | 'DOCUMENT';
const RULES: Record<Kind, { ext: string[]; maxMB: number; max: number; accept: string; label: string; icon: IconName }> = {
  IMAGE: { ext: ['jpg', 'jpeg', 'png', 'webp'], maxMB: 10, max: 30, accept: '.jpg,.jpeg,.png,.webp', label: 'ảnh', icon: 'image' },
  VIDEO: { ext: ['mp4', 'webm', 'mov'], maxMB: 500, max: 3, accept: '.mp4,.webm,.mov', label: 'video', icon: 'play' },
  SOURCE: { ext: ['zip', 'rar', '7z'], maxMB: 100, max: 3, accept: '.zip,.rar,.7z', label: 'tệp nén', icon: 'code' },
  DOCUMENT: { ext: ['pdf', 'doc', 'docx'], maxMB: 20, max: 3, accept: '.pdf,.doc,.docx', label: 'báo cáo', icon: 'file' },
};
interface Queued {
  id: number;
  file: File;
  kind: Kind;
  error?: string;
}
const short = (t: string) => t.split('–')[0].trim();

/** Nộp bài – mẫu SV_Submit (bài chung), SV_SubmitPersonal (bài cá nhân), SV_SubmitCode (môn lập trình). */
export function SubmitPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['student', 'work', id], queryFn: () => api.get<MyWork>(`/student/assignments/${id}`).then((r) => r.data) });
  const w = q.data;
  useCrumbs([
    { label: 'Bài tập', to: '/student/assignments' },
    ...(w ? [{ label: short(w.assignment.title), to: `/student/assignments/${w.assignment.id}` }, { label: 'Nộp bài' }] : []),
  ]);
  if (q.isLoading) return <Loading />;
  if (!w)
    return (
      <div className="page">
        <PageHead title="Không mở được bài tập" sub={errorMessage(q.error)} />
      </div>
    );
  const a = w.assignment;
  const isGroup = !!w.group;
  const personalTab = isGroup && a.hasIndividualPart && params.get('part') === 'personal';
  const kind: 'GROUP_SHARED' | 'PERSONAL' = isGroup && !personalTab ? 'GROUP_SHARED' : 'PERSONAL';
  const current = kind === 'GROUP_SHARED' ? w.shared : w.personal;
  const canSubmit = a.accepting && !['NO_TOPIC', 'NO_GROUP', 'MISSED', 'NOT_OPEN'].includes(w.status);
  const rm = remain(a.finalDeadline);

  return (
    <div className="page">
      <PageHead
        title={`Nộp bài – ${isGroup || a.title.length > 40 ? short(a.title) : a.title}`}
        sub={[
          isGroup ? null : `${a.section.code} · ${a.section.course.name} · Cá nhân`,
          w.topic ? `Đề tài: ${w.topic.title}` : null,
          w.group ? `Nhóm ${String(w.group.seq).padStart(2, '0')} · ${w.group.name}` : null,
          `Hạn ${fullDT(a.dueAt)}${rm.days >= 0 && !isGroup ? ` (${rm.text.toLowerCase()})` : ''}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={!current && <Badge tone="blue">Nộp lần đầu</Badge>}
      />
      <div className="tabs" role="tablist">
        {isGroup ? (
          <>
            <button type="button" role="tab" className={`tab${!personalTab ? ' on' : ''}`} onClick={() => setParams({})}>
              <Icon name="users" size={16} />
              Bài chung của nhóm
            </button>
            {a.hasIndividualPart && (
              <button type="button" role="tab" className={`tab${personalTab ? ' on' : ''}`} onClick={() => setParams({ part: 'personal' })}>
                <Icon name="lock" size={16} />
                Bài cá nhân{' '}
                <span className="muted" style={{ fontWeight: 500 }}>
                  · chỉ bạn và GV thấy
                </span>
              </button>
            )}
          </>
        ) : (
          <span className="tab on">Bài cá nhân</span>
        )}
      </div>
      {personalTab && (
        <Note tone="blue" icon="lock">
          Phần <b>bài cá nhân</b> chỉ bạn và giảng viên nhìn thấy. {w.group!.members.length - 1} thành viên còn lại của {w.group!.name} <b>không thấy</b> nội dung này. Dùng để nộp phần việc riêng hoặc báo cáo đóng góp.
        </Note>
      )}
      {!canSubmit && (
        <Note tone="amber" icon="lock">
          {!a.accepting ? 'Bài tập đã hết hạn nộp.' : w.status === 'GRADED' ? 'Bài đã được chấm, không thể nộp lại.' : 'Chưa nộp được: hãy hoàn thành bước nhóm và đề tài trước.'}{' '}
          <Link to={`/student/assignments/${a.id}`}>Quay lại bài tập</Link>
        </Note>
      )}
      <SubmitForm key={kind} w={w} kind={kind} current={current} disabled={!canSubmit} onDone={() => nav(`/student/assignments/${a.id}`)} />
    </div>
  );
}

function SubmitForm({ w, kind, current, disabled, onDone }: { w: MyWork; kind: 'GROUP_SHARED' | 'PERSONAL'; current: StudentSubmission | null; disabled: boolean; onDone: () => void }) {
  const a = w.assignment;
  const qc = useQueryClient();
  const toast = useToast();
  const p = a.productTypes;
  const personalOfGroup = kind === 'PERSONAL' && !!w.group;
  const programming = p.includes('VIDEO') && !p.includes('IMAGE');
  const [queue, setQueue] = useState<Queued[]>([]);
  const [figma, setFigma] = useState(current?.figmaUrl ?? '');
  const [git, setGit] = useState(current?.gitUrl ?? '');
  const [note, setNote] = useState(current?.note ?? '');
  const [contrib, setContrib] = useState(current?.contributionPercent != null ? String(current.contributionPercent) : '');
  const [srcMode, setSrcMode] = useState<'zip' | 'git'>(p.includes('GIT_LINK') && (current?.gitUrl || !p.includes('SOURCE')) ? 'git' : 'zip');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const existing = (k: Kind) => current?.files.filter((f) => f.fileType === k) ?? [];
  const queued = (k: Kind) => queue.filter((x) => x.kind === k);
  const add = (k: Kind) => (files: File[]) => {
    const r = RULES[k];
    let n = queued(k).filter((x) => !x.error).length;
    setQueue((cur) => [
      ...cur,
      ...files.map((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        let error: string | undefined;
        if (!r.ext.includes(ext)) error = `Không nhận định dạng .${ext}`;
        else if (file.size > r.maxMB * 1024 * 1024) error = `Vượt quá ${r.maxMB} MB`;
        else if (++n > r.max) error = `Tối đa ${r.max} ${r.label}`;
        return { id: Date.now() + Math.random(), file, kind: k, error };
      }),
    ]);
  };
  const valid = queue.filter((x) => !x.error);
  const figmaOk = !figma.trim() || /^https:\/\/(www\.)?figma\.com\//i.test(figma.trim());
  const gitOk = !git.trim() || /^https:\/\/(www\.)?(github\.com|gitlab\.com)\//i.test(git.trim());
  // Nộp lại: chỉ loại tệp có chọn tệp mới mới bị thay, loại khác giữ nguyên (khớp backend)
  const sentTypes = new Set(valid.filter((x) => !(x.kind === 'SOURCE' && srcMode === 'git')).map((x) => x.kind as string));
  const replaced = current?.files.filter((f) => sentTypes.has(f.fileType)) ?? [];
  const kept = current?.files.filter((f) => !sentTypes.has(f.fileType)) ?? [];
  const newSummary = filesSummary(
    valid.map((x) => ({ fileType: x.kind })),
    figma.trim(),
    srcMode === 'git' && git.trim(),
  );

  const removeFiles = useMutation({
    mutationFn: (ids: string[]) => api.delete(`/student/submissions/${current!.id}/files`, { data: { fileIds: ids } }),
    onSuccess: (_, ids) => {
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['student'] });
      toast.ok(`Đã xóa ${ids.length} tệp`);
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  const send = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('kind', kind);
      if (p.includes('FIGMA') && figma.trim()) fd.append('figmaUrl', figma.trim());
      if (p.includes('GIT_LINK') && srcMode === 'git' && git.trim()) fd.append('gitUrl', git.trim());
      if (note.trim()) fd.append('note', note.trim());
      if (personalOfGroup && contrib) fd.append('contributionPercent', contrib);
      for (const x of valid) {
        if (x.kind === 'SOURCE' && srcMode === 'git') continue;
        fd.append('files', x.file);
      }
      setProgress(0);
      return api.post(`/student/assignments/${a.id}/submissions`, fd, { onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.ok(current ? 'Đã nộp lại bài' : 'Đã nộp bài');
      onDone();
    },
    onError: (e) => {
      setProgress(null);
      toast.err(errorMessage(e));
    },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!figmaOk) e.figma = 'Link Figma phải thuộc figma.com';
    if (!gitOk) e.git = 'Link phải thuộc github.com hoặc gitlab.com';
    if (personalOfGroup && contrib && !(Number(contrib) >= 0 && Number(contrib) <= 100)) e.contrib = 'Nhập 0–100';
    const hasContent = sentTypes.size > 0 || kept.length > 0 || (p.includes('FIGMA') && figma.trim()) || (srcMode === 'git' && git.trim());
    if (!hasContent) e.form = 'Hãy chọn tệp hoặc nhập link sản phẩm';
    if (p.includes('REPORT') && !personalOfGroup && !sentTypes.has('DOCUMENT') && !kept.some((f) => f.fileType === 'DOCUMENT')) e.form = 'Bài tập yêu cầu nộp kèm tệp báo cáo (PDF, DOC hoặc DOCX)';
    setErrors(e);
    if (Object.keys(e).length) return;
    // chỉ hỏi xác nhận khi thực sự xóa tệp cũ; sửa link/ghi chú thì nộp luôn
    if (current && replaced.length) {
      setAck(true);
      setConfirmOpen(true);
    } else send.mutate();
  };

  const uploading = send.isPending;
  const QueueList = ({ k }: { k: Kind }) => (
    <>
      {queued(k).map((x) => (
        <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${x.error ? '#F0C4BF' : '#E3E1D9'}`, borderRadius: 8, background: x.error ? '#FFFBFA' : '#fff' }}>
          <span style={{ color: '#62666F', display: 'inline-flex' }}>
            <Icon name={RULES[k].icon} size={18} />
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
              <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {x.file.name} <span className="muted">· {fmtSize(x.file.size)}</span>
              </span>
              {x.error ? (
                <span style={{ color: '#B42318', fontWeight: 600, whiteSpace: 'nowrap' }}>{x.error}</span>
              ) : uploading ? (
                <span style={{ color: progress === 100 ? '#15803D' : '#A30000', fontWeight: 600 }}>{progress === 100 ? 'Xong' : `${progress ?? 0}%`}</span>
              ) : (
                <span className="muted">Sẵn sàng</span>
              )}
            </div>
            {!x.error && uploading && (
              <div style={{ height: 4, borderRadius: 2, background: '#EFEDE6' }}>
                <div style={{ width: `${progress ?? 0}%`, height: '100%', borderRadius: 2, background: progress === 100 ? '#15803D' : '#DB0000' }} />
              </div>
            )}
          </div>
          {!uploading && (
            <button type="button" className="btn btn-sm btn-g" aria-label="Bỏ tệp" onClick={() => setQueue((q) => q.filter((y) => y.id !== x.id))}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      ))}
    </>
  );
  const ExistingList = ({ files }: { files: SubmissionFile[] }) =>
    files.length ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {files.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #E3E1D9', borderRadius: 8 }}>
            <span style={{ color: '#62666F', display: 'inline-flex' }}>
              <Icon name={RULES[f.fileType].icon} size={18} />
            </span>
            <a href={fileUrl(f.id, true)} className="mono" style={{ flex: 1, fontSize: 13, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.name}
            </a>
            <span className="muted" style={{ fontSize: 12 }}>
              {fmtSize(f.size)}
            </span>
            <Badge tone="gray">Bản hiện tại</Badge>
          </div>
        ))}
      </div>
    ) : null;

  const images = existing('IMAGE');
  const sections: ReactNode[] = [];

  if (p.includes('IMAGE'))
    sections.push(
      <Card
        key="img"
        title={
          <>
            {personalOfGroup ? 'Ảnh phần việc của bạn' : 'Ảnh thiết kế'}{' '}
            <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
              {images.length + queued('IMAGE').filter((x) => !x.error).length}/30 · JPG, PNG, WEBP · ≤ 10 MB/ảnh
            </span>
          </>
        }
        extra={personalOfGroup && <Badge tone={current ? 'blue' : 'gray'}>{current ? 'Đã nộp' : 'Chưa nộp'}</Badge>}
      >
        {images.length > 0 && (
          <>
            {selected.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#1A1C21', color: '#fff', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={selected.length === images.length} aria-label="Chọn tất cả" onChange={(e) => setSelected(e.target.checked ? images.map((f) => f.id) : [])} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Đã chọn {selected.length} ảnh</span>
                <button
                  className="btn btn-sm"
                  type="button"
                  style={{ marginLeft: 'auto', background: '#B42318', borderColor: '#B42318', color: '#fff' }}
                  disabled={removeFiles.isPending || disabled}
                  onClick={() => confirm(`Xóa ${selected.length} ảnh khỏi bài đã nộp?`) && removeFiles.mutate(selected)}
                >
                  <Icon name="trash" size={14} />
                  Xóa {selected.length} ảnh
                </button>
                <button className="btn btn-sm btn-g" type="button" style={{ color: '#fff' }} onClick={() => setSelected([])}>
                  Bỏ chọn
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
              {images.map((f) => {
                const on = selected.includes(f.id);
                return (
                  <label key={f.id} style={{ position: 'relative', borderRadius: 10, padding: 4, border: `2px solid ${on ? '#DB0000' : 'transparent'}`, background: on ? '#FFF4F4' : 'transparent', cursor: 'pointer' }}>
                    <div className="thumb" style={{ height: 130, aspectRatio: 'auto' }}>
                      <img src={fileUrl(f.id)} alt={f.name} loading="lazy" />
                      <span className="nm mono">{f.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${f.name}`}
                      checked={on}
                      disabled={disabled}
                      onChange={() => setSelected((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                      style={{ position: 'absolute', top: 12, left: 12, width: 18, height: 18 }}
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}
        <DropZone accept={RULES.IMAGE.accept} onFiles={add('IMAGE')} disabled={disabled || uploading} title="Kéo thả ảnh vào đây hoặc" hint="Hệ thống kiểm tra định dạng thật của tệp, không chỉ phần đuôi." />
        <QueueList k="IMAGE" />
      </Card>,
    );

  if (p.includes('VIDEO'))
    sections.push(
      <Card key="video" title={`Video demo${programming ? ' *' : ''}`}>
        <span className="muted" style={{ fontSize: 13 }}>
          MP4, WEBM, MOV · ≤ 500 MB
        </span>
        <ExistingList files={existing('VIDEO')} />
        <DropZone accept={RULES.VIDEO.accept} onFiles={add('VIDEO')} disabled={disabled || uploading} title="Kéo thả video vào đây hoặc" />
        <QueueList k="VIDEO" />
      </Card>,
    );

  if (p.includes('SOURCE') || p.includes('GIT_LINK'))
    sections.push(
      <Card key="src" title="Mã nguồn *">
        {p.includes('SOURCE') && p.includes('GIT_LINK') && (
          <Seg<'zip' | 'git'>
            value={srcMode}
            onChange={setSrcMode}
            options={[
              { value: 'zip', label: 'Tải tệp nén' },
              { value: 'git', label: 'Link GitHub / GitLab' },
            ]}
          />
        )}
        {srcMode === 'git' ? (
          <>
            <Field label="Link kho mã nguồn" error={errors.git} help="Kho phải để chế độ công khai hoặc mời giảng viên vào kho">
              <input className={`inp${errors.git ? ' inp-err' : ''}`} value={git} onChange={(e) => setGit(e.target.value)} placeholder="https://github.com/…" disabled={disabled} />
            </Field>
            {git.trim() && (
              <span style={{ fontSize: 13, color: gitOk ? '#15803D' : '#B42318', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name={gitOk ? 'check' : 'close'} size={14} />
                {gitOk ? 'Đúng định dạng github.com / gitlab.com' : 'Link phải thuộc github.com hoặc gitlab.com'}
              </span>
            )}
            {p.includes('SOURCE') && (
              <Note tone="blue" icon="file">
                Chọn <b>Tải tệp nén</b> nếu không dùng GitHub: ZIP, RAR, 7Z ≤ 100 MB. Tệp được kiểm tra định dạng thật trước khi nhận.
              </Note>
            )}
          </>
        ) : (
          <>
            <ExistingList files={existing('SOURCE')} />
            <DropZone accept={RULES.SOURCE.accept} onFiles={add('SOURCE')} disabled={disabled || uploading} title="Kéo thả tệp nén vào đây hoặc" hint="ZIP, RAR, 7Z · ≤ 100 MB" />
            <QueueList k="SOURCE" />
          </>
        )}
      </Card>,
    );

  if (p.includes('REPORT'))
    sections.push(
      <Card key="report" title={`Báo cáo${personalOfGroup ? '' : ' *'}`}>
        <span className="muted" style={{ fontSize: 13 }}>
          PDF, DOC, DOCX · ≤ 20 MB · tối đa 3 tệp
        </span>
        <ExistingList files={existing('DOCUMENT')} />
        <DropZone accept={RULES.DOCUMENT.accept} onFiles={add('DOCUMENT')} disabled={disabled || uploading} title="Kéo thả tệp báo cáo vào đây hoặc" />
        <QueueList k="DOCUMENT" />
      </Card>,
    );

  const actions = (
    <>
      {errors.form && <div className="err">{errors.form}</div>}
      {uploading && progress !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#EFEDE6' }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 3, background: '#DB0000' }} />
          </div>
          <span className="mono">{progress}%</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          className="btn"
          type="button"
          disabled={uploading}
          onClick={() => {
            setQueue([]);
            setFigma(current?.figmaUrl ?? '');
            setGit(current?.gitUrl ?? '');
            setNote(current?.note ?? '');
            setErrors({});
          }}
        >
          Hủy thay đổi
        </button>
        <button className="btn btn-p" type="button" disabled={disabled || uploading} onClick={submit}>
          {uploading ? <span className="spinner" /> : <Icon name="upload" size={16} />}
          {personalOfGroup ? 'Nộp bài cá nhân' : current ? 'Nộp lại' : 'Nộp bài'}
        </button>
      </div>
    </>
  );

  const linksCard = personalOfGroup ? (
    <Card key="desc" title="Mô tả phần việc & đóng góp">
      <Field label="Phần việc bạn phụ trách" help="Giảng viên dùng để tham khảo khi điều chỉnh điểm từng thành viên.">
        <textarea className="inp" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} disabled={disabled} />
      </Field>
      <div className="cols-1-1" style={{ gap: 16 }}>
        <Field label="Mức đóng góp tự đánh giá (%)" error={errors.contrib}>
          <input className="inp" type="number" min={0} max={100} value={contrib} onChange={(e) => setContrib(e.target.value)} disabled={disabled} />
        </Field>
        {p.includes('FIGMA') && (
          <Field label="Link Figma riêng (không bắt buộc)" error={errors.figma}>
            <input className="inp" value={figma} onChange={(e) => setFigma(e.target.value)} placeholder="https://www.figma.com/design/…" disabled={disabled} />
          </Field>
        )}
      </div>
      {actions}
    </Card>
  ) : (
    <Card key="links" title={programming && !p.includes('FIGMA') ? 'Hướng dẫn chạy & ghi chú' : 'Link và ghi chú'}>
      {p.includes('FIGMA') && (
        <Field label="Link Figma *" error={errors.figma}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className={`inp${errors.figma ? ' inp-err' : ''}`} value={figma} onChange={(e) => setFigma(e.target.value)} placeholder="https://www.figma.com/design/…" disabled={disabled} />
            {figma.trim() && figmaOk && (
              <a className="btn" href={figma.trim()} target="_blank" rel="noreferrer">
                <Icon name="link" size={16} />
                Mở
              </a>
            )}
          </div>
          {figma.trim() && figmaOk && (
            <div className="help" style={{ color: '#14532D', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="check" size={14} />
              Link hợp lệ thuộc figma.com
            </div>
          )}
        </Field>
      )}
      <Field label={programming && !p.includes('FIGMA') ? undefined : 'Ghi chú bài nộp'}>
        <textarea
          className="inp"
          rows={programming && !p.includes('FIGMA') ? 5 : 3}
          style={programming && !p.includes('FIGMA') ? { fontFamily: 'JetBrains Mono,monospace', fontSize: 13 } : undefined}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          disabled={disabled}
        />
      </Field>
      {actions}
    </Card>
  );

  const sync = current ? (SYNC_BADGE[current.syncStatus] ?? { label: current.syncStatus, tone: 'gray' as Tone }) : null;
  const events = w.events;

  return (
    <>
      <div className="cols-2-1">
        <div className="col">
          {current && !personalOfGroup && (
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Avatar name={current.submittedBy} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14 }}>
                  <b>{current.submittedBy}</b> đã nộp bản hiện tại
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {fullDT(current.submittedAt).replace(' ', ' lúc ')} · {filesSummary(current.files, current.figmaUrl, current.gitUrl)}
                </div>
              </div>
              <Badge tone={current.isLate ? 'amber' : 'blue'}>{current.isLate ? 'Nộp muộn' : 'Đã nộp'}</Badge>
              <Badge tone={sync!.tone} dot>
                {sync!.tone === 'green' ? 'Đã đồng bộ Drive' : sync!.label}
              </Badge>
            </div>
          )}
          {sections}
          {linksCard}
        </div>
        <div className="col">
          <Card title="Tình trạng">
            <RowKV label="Trạng thái">
              <Badge tone={current ? 'blue' : 'gray'}>{current ? (current.isLate ? 'Nộp muộn' : 'Đã nộp') : 'Chưa nộp'}</Badge>
            </RowKV>
            {personalOfGroup ? <RowKV label="Ai thấy">Bạn + giảng viên</RowKV> : <RowKV label="Điểm"><span className="muted">Chưa chấm</span></RowKV>}
            <RowKV label="Hạn nộp">{fullDT(a.dueAt)}</RowKV>
            <RowKV label="Nộp muộn">{lateText(a) ? lateText(a)!.replace('Nộp muộn ', '') : 'Không cho phép'}</RowKV>
            {!personalOfGroup && !programming && (
              <RowKV label="Lưu trên">
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#0F766E', fontWeight: 600 }}>
                  <Icon name="drive" size={16} />
                  Drive của GV
                </span>
              </RowKV>
            )}
          </Card>
          {programming && !personalOfGroup && (
            <Card title="Sản phẩm cần nộp">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                {p.includes('VIDEO') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Video demo</span>
                    <ProductState has={existing('VIDEO').length > 0} queued={queued('VIDEO').some((x) => !x.error)} uploading={uploading} />
                  </div>
                )}
                {(p.includes('SOURCE') || p.includes('GIT_LINK')) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mã nguồn</span>
                    {srcMode === 'git' ? <Badge tone={git.trim() && gitOk ? 'green' : 'gray'}>{git.trim() && gitOk ? 'Đã có link' : 'Chưa có'}</Badge> : <ProductState has={existing('SOURCE').length > 0} queued={queued('SOURCE').some((x) => !x.error)} uploading={uploading} />}
                  </div>
                )}
                {p.includes('REPORT') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Báo cáo</span>
                    <ProductState has={existing('DOCUMENT').length > 0} queued={queued('DOCUMENT').some((x) => !x.error)} uploading={uploading} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hướng dẫn chạy</span>
                  <Badge tone="gray">Không bắt buộc</Badge>
                </div>
              </div>
            </Card>
          )}
          {personalOfGroup && (
            <Card title="Bài chung của nhóm">
              {w.shared ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Avatar name={w.shared.submittedBy} />
                  <div style={{ fontSize: 13 }}>
                    <b>{w.shared.submittedBy}</b> đã nộp bài chung
                    <div className="muted">
                      {ddmmHHmm(w.shared.submittedAt)} · {filesSummary(w.shared.files, w.shared.figmaUrl, w.shared.gitUrl)}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>
                  Nhóm chưa nộp bài chung.
                </span>
              )}
              <Link className="btn btn-sm" to={`/student/assignments/${a.id}/submit`}>
                Xem bài chung
              </Link>
            </Card>
          )}
          {current && !personalOfGroup && (
            <div className="card" style={{ padding: 16, display: 'flex', gap: 10, background: '#FDF0DE', borderColor: '#F3D6B0', color: '#8A3B06', fontSize: 13, lineHeight: 1.55 }}>
              <Icon name="warn" size={18} />
              <span>
                Nộp lại: loại tệp nào chọn tệp mới thì tệp cũ của loại đó bị <b>xóa vĩnh viễn</b> (cả trên Google Drive); loại không chọn tệp mới được giữ nguyên.{w.group ? ' Mọi thành viên sẽ được thông báo.' : ''}
              </span>
            </div>
          )}
          {personalOfGroup ? (
            <Card title="Lưu ý">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: '#4A4E57' }}>
                <li>Nộp lại sẽ xóa bản cá nhân trước đó.</li>
                <li>Bài cá nhân không thay thế bài chung của nhóm.</li>
                <li>Thành viên mới vào nhóm có thư mục cá nhân riêng trên Drive.</li>
              </ul>
            </Card>
          ) : programming && !current ? (
            <Card title="Sau khi nộp">
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#4A4E57' }}>Video được ghi vào Drive của giảng viên và phát trực tuyến trong trình xem; doanh nghiệp, phụ huynh chỉ xem, không tải mã nguồn.</div>
            </Card>
          ) : (
            events.length > 0 && (
              <Card title="Lịch sử thao tác">
                {events.map((e, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, paddingBottom: 10, borderBottom: '1px solid #EFEDE6' }}>
                    <span>
                      <b>{e.actor}</b>{' '}
                      {e.action === 'DELETE_FILES'
                        ? `xóa ${e.detail?.removed?.length ?? ''} tệp`
                        : `${e.action === 'RESUBMIT' ? 'nộp lại' : 'nộp lần đầu'}${e.detail?.added?.length ? ` (${e.detail.added.length} tệp)` : ''}`}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {ddmmHHmm(e.createdAt)}
                    </span>
                  </div>
                ))}
                <span className="muted" style={{ fontSize: 12 }}>
                  Nhật ký được giữ lại kể cả khi tệp cũ đã bị xóa.
                </span>
              </Card>
            )
          )}
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} width={520}>
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ width: 48, height: 48, borderRadius: 12, background: '#FCE8E6', color: '#B42318', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="warn" size={24} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Nộp lại sẽ xóa bản nộp trước</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4A4E57' }}>
              Trong bản nộp của <b>{current?.submittedBy}</b> lúc {ddmmHHmm(current?.submittedAt)}, các tệp <b>{filesSummary(replaced)}</b> sẽ bị <b>xóa vĩnh viễn</b>, kể cả trong thư mục Google Drive của giảng viên. Thời gian nộp sẽ tính theo bản mới.
            </p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F7F6F2', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>
              <b>Bản mới:</b> {newSummary}
              {note.trim() ? ' · ghi chú' : ''}
            </span>
            {kept.length > 0 && (
              <span>
                <b>Giữ nguyên:</b> {filesSummary(kept)}
              </span>
            )}
            {w.group && kind === 'GROUP_SHARED' && <span className="muted">{w.group.members.length - 1} thành viên còn lại sẽ nhận thông báo.</span>}
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            Tôi hiểu bản cũ không thể khôi phục
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" type="button" onClick={() => setConfirmOpen(false)}>
              Hủy
            </button>
            <button
              className="btn"
              type="button"
              disabled={!ack || uploading}
              style={{ background: '#B42318', borderColor: '#B42318', color: '#fff' }}
              onClick={() => {
                setConfirmOpen(false);
                send.mutate();
              }}
            >
              Xóa bản cũ và nộp lại
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ProductState({ has, queued, uploading }: { has: boolean; queued: boolean; uploading: boolean }) {
  if (queued) return <Badge tone="blue">{uploading ? 'Đang tải' : 'Sẵn sàng nộp'}</Badge>;
  if (has) return <Badge tone="green">Đã nộp</Badge>;
  return <Badge tone="gray">Chưa có</Badge>;
}
