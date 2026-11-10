import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { LecturerSection, ProductType, WorkMode } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/DateInput';
import { Badge, Card, ChipInput, Field, KV, Loading, Note, PageHead, Seg, SwitchRow, useToast } from '../../components/ui';
import { ddmmHHmm, endOfDayIn, fmtSize, fullDT, semesterLabel, toLocalInput } from '../../utils/format';
import { htmlToText, textToHtml } from '../../utils/html';

interface EditData {
  id: string;
  title: string;
  description: string | null;
  workMode: WorkMode;
  productTypes: ProductType[];
  openAt: string;
  dueAt: string;
  allowLate: boolean;
  lateDueAt: string | null;
  suggestedTopics: string[];
  hasIndividualPart: boolean;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  driveParentFolderId: string;
  briefFileName: string | null;
  briefFileSize: number | null;
  section: { id: string; code: string; course: { name: string; type: string } };
  counts: { groups: number; submissions: number; graded: number; individuals: number };
  groups: { id: string; seq: number; code: string; name: string; members: number }[];
  history: { summary: string | null; actor: string; createdAt: string }[];
  locked: { workMode: boolean; openAt: boolean; hasSubmissions: boolean };
}
interface CreateResult {
  results: { sectionId: string; sectionCode: string; ok: boolean; assignmentId?: string; message?: string }[];
}
interface DriveLink {
  mode: string;
  serviceAccountEmail: string | null;
  link: { rootFolderName: string; folderUrl: string | null } | null;
}

const PRODUCTS: { key: string; label: string; types: ProductType[] }[] = [
  { key: 'img', label: 'Ảnh thiết kế (1–30 ảnh)', types: ['IMAGE'] },
  { key: 'figma', label: 'Link Figma', types: ['FIGMA'] },
  { key: 'video', label: 'Video demo', types: ['VIDEO'] },
  { key: 'code', label: 'Mã nguồn / link GitHub', types: ['SOURCE', 'GIT_LINK'] },
  { key: 'report', label: 'Báo cáo (PDF/DOCX)', types: ['REPORT'] },
];
const fromInput = (v: string) => (v ? new Date(v) : null);

/**
 * Tạo / sửa bài tập.
 *  - /lecturer/assignments/new                      → mẫu GV_CreateAssignment (chọn nhiều lớp)
 *  - /lecturer/sections/:sectionId/assignments/new  → mẫu GV_CreateAssignmentClass (cố định lớp)
 *  - /lecturer/assignments/:id/edit                 → mẫu GV_EditAssignment
 */
export function AssignmentForm() {
  const { sectionId: classId, id: editId } = useParams();
  const mode: 'multi' | 'class' | 'edit' = editId ? 'edit' : classId ? 'class' : 'multi';
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const sectionsQ = useQuery({ queryKey: ['lecturer', 'sections'], queryFn: () => api.get<LecturerSection[]>('/lecturer/sections').then((r) => r.data) });
  const editQ = useQuery({ queryKey: ['lecturer', 'assignment', editId, 'edit'], queryFn: () => api.get<EditData>(`/lecturer/assignments/${editId}/edit`).then((r) => r.data), enabled: !!editId });
  const driveQ = useQuery({ queryKey: ['lecturer', 'drive-link'], queryFn: () => api.get<DriveLink>('/lecturer/drive-link').then((r) => r.data) });
  const edit = editQ.data;
  // học kỳ có lớp của GV, mới nhất trước – cho phép giao bài cả ở học kỳ đã qua (nhập bài tập cũ)
  const semesters = useMemo(() => {
    const map = new Map<string, LecturerSection['semester']>();
    for (const s of sectionsQ.data ?? []) map.set(s.semester.code, s.semester);
    return [...map.values()].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [sectionsQ.data]);
  const [semPick, setSemPick] = useState('');
  const semCode = semPick || semesters.find((s) => s.isCurrent)?.code || semesters[0]?.code || '';
  const current = useMemo(() => (sectionsQ.data ?? []).filter((s) => s.semester.code === semCode || s.id === classId), [sectionsQ.data, classId, semCode]);
  const fixed = sectionsQ.data?.find((s) => s.id === (classId ?? edit?.section.id));

  // ------------------------------------------------------------ trạng thái form
  const [selected, setSelected] = useState<string[]>([]);
  const [perDue, setPerDue] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [openAt, setOpenAt] = useState(toLocalInput(new Date()));
  const [dueAt, setDueAt] = useState(toLocalInput(endOfDayIn(14)));
  const [brief, setBrief] = useState<File | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>('INDIVIDUAL');
  const [individualPart, setIndividualPart] = useState(false);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [allowLate, setAllowLate] = useState(false);
  const [lateDays, setLateDays] = useState('2');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [folderMode, setFolderMode] = useState<'move' | 'new'>('move');
  const [check, setCheck] = useState<{ ok: boolean; message?: string; name?: string; checks: { isFolder: boolean; exists: boolean; writable: boolean } } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // nạp dữ liệu khi sửa
  useEffect(() => {
    if (!edit) return;
    setTitle(edit.title);
    setDesc(edit.description ? htmlToText(edit.description) : '');
    setOpenAt(toLocalInput(edit.openAt));
    setDueAt(toLocalInput(edit.dueAt));
    setWorkMode(edit.workMode);
    setIndividualPart(edit.hasIndividualPart);
    setProducts(edit.productTypes);
    setAllowLate(edit.allowLate);
    setLateDays(edit.lateDueAt ? String(Math.max(1, Math.round((new Date(edit.lateDueAt).getTime() - new Date(edit.dueAt).getTime()) / 86400_000))) : '2');
    setSuggested(edit.suggestedTopics);
  }, [edit]);


  const hasGroup = workMode === 'GROUP';
  const chosen = mode === 'multi' ? current.filter((s) => selected.includes(s.id)) : fixed ? [fixed] : [];
  // mọi lớp đã chọn thuộc học kỳ đã kết thúc (thời gian thực) → cho nhập bài tập cũ, hạn nộp trong quá khứ
  const pastSemester = chosen.length > 0 && chosen.every((s) => new Date(s.semester.endDate).setHours(23, 59, 59, 999) < Date.now());
  const studentTotal = chosen.reduce((n, s) => n + s.studentCount, 0);
  const crumbSection = fixed ? { label: `${fixed.code} · ${fixed.course.name}`, to: `/lecturer/sections/${fixed.id}` } : null;
  useCrumbs(
    mode === 'multi'
      ? [{ label: 'Tạo bài tập' }]
      : mode === 'class'
        ? [{ label: 'Lớp học phần', to: '/lecturer/sections' }, ...(crumbSection ? [crumbSection] : []), { label: 'Tạo bài tập' }]
        : [{ label: 'Lớp học phần', to: '/lecturer/sections' }, ...(crumbSection ? [crumbSection] : []), { label: edit?.title.split('–')[0].trim() ?? 'Bài tập', to: `/lecturer/assignments/${editId}` }, { label: 'Sửa bài tập' }],
  );

  // ------------------------------------------------------------ kiểm tra dữ liệu
  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === 'multi' && !selected.length) e.sections = 'Chọn ít nhất một lớp học phần';
    if (title.trim().length < 3) e.title = 'Tiêu đề tối thiểu 3 ký tự';
    const due = fromInput(dueAt);
    const open = fromInput(openAt);
    if (!due) e.dueAt = 'Chọn hạn nộp';
    else if (open && due <= open) e.dueAt = 'Hạn nộp phải sau ngày mở';
    else if (!pastSemester && due <= new Date() && !(edit && due.getTime() === new Date(edit.dueAt).getTime())) e.dueAt = 'Hạn nộp phải ở tương lai';
    if (!products.length) e.products = 'Chọn ít nhất một loại sản phẩm';
    if (allowLate && !(Number(lateDays) >= 1 && Number(lateDays) <= 14)) e.late = 'Số ngày nộp muộn 1–14';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const common = (saveDraft: boolean) => ({
    title: title.trim(),
    description: textToHtml(desc),
    workMode,
    hasIndividualPart: hasGroup && individualPart,
    productTypes: products,
    allowLate,
    lateDays: allowLate ? Number(lateDays) : undefined,
    suggestedTopics: suggested,
    folderUrl: folderUrl.trim() || undefined,
    publishNow: false,
    saveDraft,
  });
  const schedule = (due: string) => ({
    openAt: (fromInput(openAt) ?? new Date()).toISOString(),
    dueAt: fromInput(due)!.toISOString(),
  });

  const uploadBrief = async (ids: string[]) => {
    if (!brief) return;
    for (const id of ids) {
      const f = new FormData();
      f.append('file', brief);
      await api.post(`/lecturer/assignments/${id}/brief`, f);
    }
  };

  const save = useMutation({
    mutationFn: async (draft: boolean) => {
      if (mode === 'edit') {
        await api.patch(`/lecturer/assignments/${editId}`, { common: common(false), schedule: schedule(dueAt), folderMode: edit?.locked.hasSubmissions ? folderMode : 'move' });
        await uploadBrief([editId!]);
        return { ids: [editId!], draft };
      }
      const r =
        mode === 'class'
          ? (await api.post<CreateResult>(`/lecturer/sections/${classId}/assignments`, { common: common(draft), schedule: schedule(dueAt) })).data
          : (await api.post<CreateResult>('/lecturer/assignments/batch', { common: common(draft), sections: selected.map((id) => ({ sectionId: id, ...schedule(perDue[id] || dueAt) })) })).data;
      const failed = r.results.filter((x) => !x.ok);
      const ids = r.results.filter((x) => x.ok).map((x) => x.assignmentId!);
      await uploadBrief(ids);
      if (failed.length) toast.err(failed.map((f) => `${f.sectionCode}: ${f.message}`).join(' · '));
      return { ids, draft };
    },
    onSuccess: ({ ids, draft }) => {
      qc.invalidateQueries({ queryKey: ['lecturer'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (mode === 'edit') {
        toast.ok('Đã lưu thay đổi');
        nav(`/lecturer/assignments/${editId}`);
      } else if (ids.length === 1) {
        toast.ok(draft ? 'Đã lưu nháp bài tập' : (fromInput(openAt) ?? new Date()) > new Date() ? 'Đã hẹn giờ mở bài tập' : 'Đã giao bài tập');
        nav(`/lecturer/assignments/${ids[0]}`);
      } else if (ids.length) {
        toast.ok(`${draft ? 'Đã lưu nháp' : 'Đã giao bài'} cho ${ids.length} lớp`);
        nav('/lecturer/sections');
      }
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  const submit = (draft: boolean) => validate() && save.mutate(draft);

  const action = useMutation({
    mutationFn: (kind: 'close' | 'delete' | 'publish') =>
      kind === 'close'
        ? api.post(`/lecturer/assignments/${editId}/close`)
        : kind === 'publish'
          ? api.post(`/lecturer/assignments/${editId}/publish`)
          : api.delete(`/lecturer/assignments/${editId}`),
    onSuccess: (_, kind) => {
      qc.invalidateQueries({ queryKey: ['lecturer'] });
      toast.ok(kind === 'close' ? 'Đã đóng bài tập' : kind === 'publish' ? 'Đã giao bài tập' : 'Đã xóa bài tập');
      nav(kind === 'delete' ? `/lecturer/sections/${edit?.section.id}` : `/lecturer/assignments/${editId}`);
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  const runCheck = async () => {
    if (!folderUrl.trim()) return;
    setCheck(null);
    try {
      setCheck((await api.post('/lecturer/drive/check', { folderUrl })).data);
    } catch (e) {
      toast.err(errorMessage(e));
    }
  };

  if (sectionsQ.isLoading || editQ.isLoading) return <Loading />;
  if ((mode === 'class' && !fixed) || (mode === 'edit' && !edit))
    return (
      <div className="page">
        <PageHead title="Không tìm thấy" sub={errorMessage(editQ.error)} />
      </div>
    );

  const busy = save.isPending;
  const pickedSem = semesters.find((s) => s.code === semCode);
  const pastSemesterPick = !!pickedSem && new Date(pickedSem.endDate).setHours(23, 59, 59, 999) < Date.now();
  const filtered = current.filter((s) => !search || `${s.code} ${s.course.name}`.toLowerCase().includes(search.toLowerCase()));
  const sameCourse = current.find((s) => selected.includes(s.id))?.course.name ?? current[0]?.course.name;
  const dueText = mode === 'multi' && selected.length > 1 ? selected.map((id) => ddmmHHmm(fromInput(perDue[id] || dueAt))).filter((v, i, a) => a.indexOf(v) === i).join(' · ') + (Object.keys(perDue).length ? ' (theo lớp)' : '') : fullDT(fromInput(dueAt));
  const productsLabel = products.length ? PRODUCTS.filter((p) => p.types.every((t) => products.includes(t))).map((p) => p.label.split(' (')[0]).join(' + ') : '—';
  const extendHelp = edit && fromInput(dueAt) && new Date(edit.dueAt).getTime() !== fromInput(dueAt)!.getTime() ? `${fromInput(dueAt)! > new Date(edit.dueAt) ? 'Gia hạn' : 'Đổi hạn'} từ ${ddmmHHmm(edit.dueAt)} → ${ddmmHHmm(fromInput(dueAt))}. Sinh viên sẽ nhận thông báo.` : undefined;

  // ------------------------------------------------------------ khối giao diện
  const headActions =
    mode === 'edit' ? (
      <>
        <Link className="btn" to={`/lecturer/assignments/${editId}`}>
          Hủy
        </Link>
        <button className="btn btn-p" type="button" onClick={() => submit(false)} disabled={busy}>
          Lưu thay đổi
        </button>
      </>
    ) : (
      <>
        {mode === 'class' && (
          <Link className="btn" to={`/lecturer/sections/${classId}`}>
            Hủy
          </Link>
        )}
        <button className="btn" type="button" onClick={() => submit(true)} disabled={busy}>
          Lưu nháp
        </button>
        <button className="btn btn-p" type="button" onClick={() => submit(false)} disabled={busy}>
          Giao bài
        </button>
      </>
    );

  const generalCard = (
    <Card title="Thông tin chung">
      <Field label="Tiêu đề *" error={errors.title}>
        <input className={`inp${errors.title ? ' inp-err' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="VD: Bài tập 2 – Thiết kế ứng dụng di động" />
      </Field>
      <Field label="Mô tả / yêu cầu">
        <textarea className="inp" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={10000} />
      </Field>
      <div className="cols-1-1" style={{ gap: 16 }}>
        <Field label={mode === 'edit' ? 'Ngày mở' : 'Ngày mở *'} help={mode === 'edit' && edit?.locked.openAt ? 'Bài tập đã mở' : undefined}>
          <DateInput withTime value={openAt} onChange={setOpenAt} disabled={mode === 'edit' && edit?.locked.openAt} />
        </Field>
        <Field label={mode === 'multi' ? 'Hạn nộp chung *' : 'Hạn nộp *'} error={errors.dueAt} help={extendHelp}>
          <DateInput withTime className={`inp${errors.dueAt ? ' inp-err' : ''}`} value={dueAt} onChange={setDueAt} />
        </Field>
      </div>
      <div>
        <span className="lbl">Tài liệu đề bài</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, border: '1px solid #E3E1D9', borderRadius: 8 }}>
          <span style={{ color: '#62666F', display: 'inline-flex' }}>
            <Icon name="file" size={18} />
          </span>
          <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {brief ? `${brief.name} · ${fmtSize(brief.size)}` : edit?.briefFileName ? `${edit.briefFileName} · ${fmtSize(edit.briefFileSize ?? 0)}` : <span className="muted">Chưa có tệp (PDF, DOCX…, ≤ 20 MB)</span>}
          </span>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            {brief || edit?.briefFileName ? 'Thay tệp' : 'Chọn tệp'}
            <input type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" onChange={(e) => setBrief(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
    </Card>
  );

  const modeCard = (
    <Card title="Hình thức làm bài">
      {mode !== 'edit' || !edit?.locked.workMode ? (
        <Seg<WorkMode>
          value={workMode}
          onChange={setWorkMode}
          options={[
            { value: 'INDIVIDUAL', label: 'Cá nhân' },
            { value: 'GROUP', label: 'Nhóm' },
          ]}
        />
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>
          Hình thức: <b style={{ color: '#1A1C21' }}>{workMode === 'INDIVIDUAL' ? 'Cá nhân' : 'Nhóm'}</b> · đã có nhóm, đề tài hoặc bài nộp nên không đổi được
        </span>
      )}
      {hasGroup && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', border: '1px solid #E3E1D9', borderRadius: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: '#EAF6EC', color: '#15803D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="file" size={18} />
            </span>
            <div style={{ flex: 1, fontSize: 13 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Danh sách nhóm tải lên bằng Excel</div>
              <span className="muted">
                {mode === 'edit' && edit?.counts.groups ? `Đã có ${edit.counts.groups} nhóm` : 'Sau khi giao bài, vào tab Nhóm của bài tập để tải file mẫu và tải lên danh sách'}
              </span>
            </div>
            {mode === 'edit' && (
              <Link className="btn btn-sm" to={`/lecturer/assignments/${editId}?tab=groups`}>
                Mở tab Nhóm
              </Link>
            )}
          </div>
          <SwitchRow title="Có phần cá nhân trong bài nhóm" sub="Mỗi thành viên nộp thêm phần việc riêng, chỉ người nộp và giảng viên xem được" checked={individualPart} onChange={setIndividualPart} />
        </>
      )}
    </Card>
  );

  const productsCard = (
    <Card title="Sản phẩm nộp">
      <div className="cols-1-1" style={{ gap: 10 }}>
        {PRODUCTS.map((p) => {
          const on = p.types.every((t) => products.includes(t));
          return (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  setProducts((cur) => (on ? cur.filter((t) => !p.types.includes(t)) : [...new Set([...cur, ...p.types])]));
                }}
              />
              {p.label}
            </label>
          );
        })}
      </div>
      {errors.products && <div className="err">{errors.products}</div>}
    </Card>
  );

  const topicCard = (
    <Card title="Đề tài & nộp muộn">
      <SwitchRow title="Cho phép nộp muộn" sub={allowLate ? `Nhận bài tối đa ${lateDays || '…'} ngày sau hạn, bài được đánh dấu nộp muộn` : 'Không nhận bài sau hạn nộp'} checked={allowLate} onChange={setAllowLate} />
      {allowLate && (
        <Field label="Số ngày nộp muộn tối đa" error={errors.late}>
          <input className="inp" type="number" min={1} max={14} value={lateDays} onChange={(e) => setLateDays(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>
      )}
      <Field label="Đề tài gợi ý (không bắt buộc)">
        <ChipInput value={suggested} onChange={setSuggested} max={10} placeholder="Gõ rồi nhấn Enter" />
      </Field>
    </Card>
  );

  const checkList = check && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      {(
        [
          ['isFolder', 'Đường dẫn là một thư mục'],
          ['exists', 'Thư mục tồn tại'],
          ['writable', 'Có quyền ghi (Người chỉnh sửa)'],
        ] as const
      ).map(([k, t]) => (
        <span key={k} style={{ color: check.checks[k] ? '#15803D' : '#B42318', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name={check.checks[k] ? 'check' : 'close'} size={14} />
          {t}
        </span>
      ))}
      {!check.ok && check.message && <span className="err">{check.message}</span>}
    </div>
  );

  const driveCard =
    mode === 'edit' ? (
      <Card title="Đổi thư mục Drive nhận bài">
        <div>
          <label className="lbl">Link thư mục mới</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="inp" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" style={{ flex: 1 }} />
            <button className="btn" type="button" onClick={runCheck}>
              <Icon name="refresh" size={16} />
              Kiểm tra
            </button>
          </div>
        </div>
        {checkList}
        {folderUrl && edit?.locked.hasSubmissions && (
          <>
            <Note tone="blue" icon="drive">
              Bài tập đã có <b>{edit.counts.submissions} bài nộp</b>. Chọn cách xử lý thư mục cũ:
            </Note>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <input type="radio" name="mv" checked={folderMode === 'move'} onChange={() => setFolderMode('move')} />
              Di chuyển toàn bộ thư mục nhóm/cá nhân sang thư mục mới (khuyến nghị)
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <input type="radio" name="mv" checked={folderMode === 'new'} onChange={() => setFolderMode('new')} />
              Chỉ lưu bài nộp mới vào thư mục mới
            </label>
          </>
        )}
      </Card>
    ) : (
      <Card title="Thư mục Google Drive nhận bài *">
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="inp" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder={driveQ.data?.link ? `Mặc định: ${driveQ.data.link.rootFolderName}` : 'https://drive.google.com/drive/folders/…'} style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={runCheck} disabled={!folderUrl.trim()}>
            <Icon name="refresh" size={16} />
            Kiểm tra
          </button>
        </div>
        {checkList}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ color: '#62666F', display: 'inline-flex' }}>
            <Icon name="drive" size={16} />
          </span>
          <span style={{ flex: 1 }}>
            {driveQ.data?.link ? (
              <>
                Thư mục gốc: <b>{driveQ.data.link.rootFolderName}</b>
                {driveQ.data.mode === 'local' ? ' (Drive mô phỏng)' : ''} · hệ thống tự tạo thư mục bài tập, nhóm và cá nhân bên trong
              </>
            ) : (
              'Chưa liên kết thư mục gốc — dán link thư mục nhận bài ở trên'
            )}
          </span>
          <Link to="/lecturer/drive" style={{ fontWeight: 600 }}>
            Quản lý kết nối
          </Link>
        </div>
      </Card>
    );

  const summaryCard =
    mode === 'edit' ? (
      <Card title="Trạng thái bài tập">
        <KV
          rows={[
            ['Hiện tại', <Badge key="s" tone={edit!.status === 'OPEN' ? 'green' : 'gray'}>{edit!.status === 'OPEN' ? 'Đang mở' : edit!.status === 'DRAFT' ? 'Bản nháp' : 'Đã đóng'}</Badge>],
            ['Bài đã nộp', `${edit!.counts.submissions}${edit!.counts.groups ? ` / ${edit!.counts.groups + edit!.counts.individuals} nhóm & cá nhân` : ''}`],
            ['Có điểm', String(edit!.counts.graded)],
          ]}
        />
        {edit!.status === 'DRAFT' && (
          <button className="btn btn-p" type="button" style={{ width: '100%' }} onClick={() => action.mutate('publish')}>
            <Icon name="check" size={16} />
            Giao bài
          </button>
        )}
        {edit!.status === 'OPEN' && (
          <button className="btn" type="button" style={{ width: '100%' }} onClick={() => confirm('Đóng bài tập? Sinh viên sẽ không nộp được nữa.') && action.mutate('close')}>
            <Icon name="eye" size={16} />
            Đóng / ẩn bài tập
          </button>
        )}
        <button className="btn btn-d" type="button" style={{ width: '100%' }} disabled={edit!.locked.hasSubmissions} onClick={() => confirm('Xóa bài tập này? Danh sách nhóm đã tải lên cũng bị xóa.') && action.mutate('delete')}>
          Xóa bài tập
        </button>
        {edit!.locked.hasSubmissions && (
          <Note tone="gray" icon="lock">
            Bài tập đã có bài nộp nên không thể xóa, chỉ có thể đóng.
          </Note>
        )}
      </Card>
    ) : (
      <Card title="Tóm tắt">
        <KV
          rows={[
            ['Lớp', chosen.length ? (mode === 'class' ? `${fixed!.code} · ${fixed!.course.name}` : chosen.map((s) => s.code).join(', ')) : '—'],
            ['Sinh viên', String(studentTotal)],
            ['Hình thức', workMode === 'INDIVIDUAL' ? 'Cá nhân' : 'Nhóm · theo file Excel'],
            ...(hasGroup ? ([['Phần cá nhân', individualPart ? 'Có' : 'Không']] as [string, string][]) : []),
            ['Mở', fullDT(fromInput(openAt))],
            ['Hạn nộp', dueText],
            ['Sản phẩm', productsLabel],
            ['Drive', <Badge key="d" tone={driveQ.data?.link || check?.ok ? 'green' : 'amber'}>{driveQ.data?.link || check?.ok ? 'Đã kết nối' : 'Chưa kết nối'}</Badge>],
          ]}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-p" type="button" onClick={() => submit(false)} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="check" size={16} />}
            {mode === 'class' ? 'Giao bài cho lớp' : `Giao bài cho ${selected.length || '…'} lớp`}
          </button>
          <button className="btn" type="button" onClick={() => submit(true)} disabled={busy}>
            Lưu nháp
          </button>
        </div>
        <p className="help">{mode === 'class' ? `${fixed!.studentCount} sinh viên của lớp nhận thông báo khi bài tập mở.` : 'Sinh viên của các lớp đã chọn nhận thông báo khi bài tập mở.'}</p>
      </Card>
    );

  const rulesCard =
    mode === 'edit' ? (
      <Card title="Lịch sử thay đổi">
        {extendHelp && (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid #EFEDE6' }}>
            <b>{extendHelp.split('.')[0]} (chưa lưu)</b>
            <span className="muted">Bây giờ</span>
          </div>
        )}
        {edit!.history.map((h, i) => (
          <div key={i} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid #EFEDE6' }}>
            <b>{h.summary}</b>
            <span className="muted">
              {h.actor} · {ddmmHHmm(h.createdAt)}
            </span>
          </div>
        ))}
        {!edit!.history.length && <span className="muted" style={{ fontSize: 13 }}>Chưa có thay đổi.</span>}
      </Card>
    ) : (
      <Card title="Quy tắc tệp">
        <KV
          rows={[
            ['Ảnh', 'JPG, PNG, WEBP · ≤ 10 MB'],
            ['Video', 'MP4, WEBM, MOV · ≤ 500 MB'],
            ['Mã nguồn', 'ZIP, RAR, 7Z · ≤ 100 MB'],
            ['Báo cáo', 'PDF, DOC, DOCX · ≤ 20 MB'],
            ['Link', 'figma.com, github.com'],
          ]}
        />
      </Card>
    );

  return (
    <div className="page">
      <PageHead
        title={mode === 'edit' ? `Sửa ${edit!.title}` : 'Tạo bài tập'}
        sub={
          mode === 'edit'
            ? `${edit!.section.code}${edit!.counts.groups ? ` · ${edit!.counts.groups} nhóm` : ''} · ${edit!.counts.submissions} bài đã nộp`
            : mode === 'class'
              ? `Bài tập ${fixed!.assignmentCount + 1} của lớp ${fixed!.code} · ${semesterLabel(fixed!.semester)}`
              : semesterLabel(semesters.find((s) => s.code === semCode))
        }
        actions={headActions}
      />

      {mode === 'class' && fixed && (
        <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: '#FDEDED', color: '#C40000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="grid" size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              <span className="mono">{fixed.code}</span> · {fixed.course.name}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {fixed.studentCount} sinh viên · {fixed.assignmentCount} bài tập hiện có
            </div>
          </div>
        </div>
      )}

      <div className="cols-2-1">
        <div className="col">
          {mode === 'multi' && (
            <Card title="Lớp học phần áp dụng *" extra={<Badge tone="gray">Chọn 1 hoặc nhiều lớp</Badge>}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="inp"
                  aria-label="Học kỳ"
                  style={{ width: 240, height: 40 }}
                  value={semCode}
                  onChange={(e) => {
                    setSemPick(e.target.value);
                    setSelected([]);
                    setPerDue({});
                  }}
                >
                  {semesters.map((s) => (
                    <option key={s.code} value={s.code}>
                      {semesterLabel(s)}
                      {s.isCurrent ? ' (hiện tại)' : new Date(s.endDate).setHours(23, 59, 59, 999) < Date.now() ? ' (đã kết thúc)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {pastSemesterPick && (
                <Note tone="amber" icon="info">
                  Học kỳ đã kết thúc. Hạn nộp có thể chọn tùy ý: đặt <b>trong tương lai</b> để sinh viên đăng lại bài cũ lên hệ thống, hoặc <b>trong quá khứ</b> nếu chỉ lưu thông tin bài tập.
                </Note>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, height: 40, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 12px', color: '#62666F' }}>
                  <Icon name="search" size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm lớp theo mã lớp hoặc tên môn" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
                </label>
                {sameCourse && (
                  <button className="btn" type="button" onClick={() => setSelected(current.filter((s) => s.course.name === sameCourse).map((s) => s.id))}>
                    Chọn tất cả lớp {sameCourse}
                  </button>
                )}
                <button className="btn btn-g" type="button" style={{ color: '#DB0000' }} onClick={() => setSelected([])}>
                  Bỏ chọn
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
                <span>Lớp học phần</span>
                <span style={{ width: 190 }}>Hạn nộp riêng (tùy chọn)</span>
              </div>
              {filtered.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: `1px solid ${on ? '#F5C2C2' : '#E3E1D9'}`, borderRadius: 10, background: on ? '#FFFBFB' : '#fff', cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => setSelected((c) => (on ? c.filter((x) => x !== s.id) : [...c, s.id]))} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        <span className="mono">{s.code}</span> · {s.course.name}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {s.studentCount} sinh viên
                      </div>
                    </div>
                    <div style={{ width: 190 }} onClick={(e) => e.preventDefault()}>
                      {on ? (
                        <DateInput withTime aria-label="Hạn nộp riêng" style={{ height: 36, fontSize: 13 }} value={perDue[s.id] ?? dueAt} onChange={(x) => setPerDue((p) => ({ ...p, [s.id]: x }))} />
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
              {!filtered.length && <span className="muted" style={{ fontSize: 13 }}>Không có lớp phù hợp.</span>}
              {errors.sections && <div className="err">{errors.sections}</div>}
              {chosen.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {chosen.map((s) => (
                    <button key={s.id} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setSelected((c) => c.filter((x) => x !== s.id))}>
                      {s.code} ×
                    </button>
                  ))}
                  <span className="muted" style={{ fontSize: 13 }}>
                    {chosen.length} lớp · {studentTotal} sinh viên
                  </span>
                </div>
              )}
            </Card>
          )}
          {generalCard}
          {modeCard}
          {productsCard}
          {topicCard}
          {driveCard}
        </div>
        <div className="col">
          {summaryCard}
          {rulesCard}
        </div>
      </div>
    </div>
  );
}
