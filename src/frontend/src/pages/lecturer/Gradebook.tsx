import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { GradebookItem, GradeComp, SectionGradePreview, SectionGrades } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, Loading, Modal, Note, PageHead, Stat, useToast, type Tone } from '../../components/ui';
import { downloadFile, ImportHistoryCard, PreviewActions, RowErrors } from '../../components/excel';
import { fullDate, score10, semesterLabel } from '../../utils/format';

const STATUS: Record<GradebookItem['status'], [string, Tone]> = {
  EMPTY: ['Chưa có điểm', 'gray'],
  DRAFT: ['Đang nhập điểm', 'amber'],
  PUBLISHED: ['Đã công bố', 'green'],
};
const COMP_LABEL: Record<GradeComp, string> = { attendance: 'Chuyên cần', assignment: 'Bài tập', midterm: 'Giữa kỳ', final: 'Cuối kỳ' };
const COMPS: GradeComp[] = ['attendance', 'assignment', 'midterm', 'final'];
const LETTERS = ['F', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A'];
const LETTER_TONE = (l: string | null): Tone => (!l ? 'gray' : l === 'A' ? 'green' : l.startsWith('B') ? 'blue' : l === 'F' ? 'red' : 'amber');

/** Trang đầu Bảng điểm – mẫu giang-vien/GV_GradebookHome. */
export function GradebookHome() {
  useCrumbs([{ label: 'Bảng điểm' }]);
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['lecturer', 'gradebooks'], queryFn: () => api.get<GradebookItem[]>('/lecturer/gradebooks').then((r) => r.data) });
  if (isLoading || !data) return <Loading />;
  const years = [...new Set(data.map((s) => s.semester.academicYear))];
  const rows = data.filter((s) => (!year || s.semester.academicYear === year) && (!q || `${s.code} ${s.course.name}`.toLowerCase().includes(q.toLowerCase())));
  const groups = [...new Set(rows.map((s) => s.semester.code))].map((code) => rows.filter((s) => s.semester.code === code));

  return (
    <div className="page">
      <PageHead title="Bảng điểm" sub="Lớp học phần phụ trách theo năm học" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 200 }}>
          <label className="lbl">Năm học</label>
          <select className="inp" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Tất cả năm học</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y.replace('-', '–')}
              </option>
            ))}
          </select>
        </div>
        <label style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, height: 42, border: '1px solid #D6D3C8', borderRadius: 8, padding: '0 12px', color: '#62666F', background: '#fff' }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã lớp, tên môn…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
        </label>
      </div>
      {groups.length ? (
        groups.map((list) => {
          const sem = list[0].semester;
          return (
            <div key={sem.code} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 className="sec">{semesterLabel(sem)}</h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  {sem.isCurrent ? 'Học kỳ hiện tại' : 'Đã kết thúc'} · {list.length} lớp
                </span>
              </div>
              <div className="grid3" style={{ gap: 16 }}>
                {list.map((s) => {
                  const [label, tone] = STATUS[s.status];
                  return (
                    <Link key={s.id} to={`/lecturer/gradebook/${s.id}`} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, color: '#1A1C21' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="mono muted" style={{ fontSize: 12 }}>
                          {s.code}
                        </span>
                        <Badge tone={tone}>{label}</Badge>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{s.course.name}</span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {s.students} sinh viên · {s.course.credits} tín chỉ
                      </span>
                      {s.status === 'PUBLISHED' ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Công bố {fullDate(s.publishedAt)}
                        </div>
                      ) : s.graded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }} className="muted">
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#EFEDE6' }}>
                            <div style={{ width: `${s.students ? (s.graded / s.students) * 100 : 0}%`, height: '100%', borderRadius: 3, background: '#15803D' }} />
                          </div>
                          <span>
                            {s.graded} / {s.students} SV có điểm
                          </span>
                        </div>
                      ) : (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {s.status === 'DRAFT' ? 'Đã có điểm bài tập, chưa có điểm học phần' : 'Chưa nhập điểm thành phần nào'}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <Card>
          <Empty icon="grid">Không có lớp học phần phù hợp.</Empty>
        </Card>
      )}
    </div>
  );
}

/** Bảng điểm một lớp học phần – mẫu GV_Gradebook / GV_GradebookEmpty. Điểm nhập bằng file Excel. */
export function Gradebook() {
  const { sectionId } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<SectionGradePreview | null>(null);
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState<SectionGrades['rows'][number] | null>(null);
  const key = ['lecturer', 'gradebook', sectionId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<SectionGrades>(`/lecturer/sections/${sectionId}/grades`).then((r) => r.data) });
  const d = q.data;
  useCrumbs([{ label: 'Bảng điểm', to: '/lecturer/gradebook' }, { label: d ? `${d.section.code} · ${d.section.course.name}` : 'Lớp học phần' }]);

  const after = (data: SectionGrades, msg: string) => {
    qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ['lecturer', 'gradebooks'] });
    toast.ok(msg);
  };
  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      return api.post<SectionGradePreview>(`/lecturer/sections/${sectionId}/grades/import/preview`, fd).then((r) => r.data);
    },
    onSuccess: setPreview,
    onError: (e) => toast.err(errorMessage(e)),
  });
  const commit = useMutation({
    mutationFn: (onlyValid: boolean) => api.post<SectionGrades>(`/lecturer/sections/${sectionId}/grades/import/${preview!.jobId}/commit`, { onlyValid }).then((r) => r.data),
    onSuccess: (data) => {
      setPreview(null);
      after(data, 'Đã lưu điểm học phần (chưa công bố)');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  const publish = useMutation({
    mutationFn: (allowIncomplete: boolean) => api.post<SectionGrades>(`/lecturer/sections/${sectionId}/grades/publish`, { allowIncomplete }).then((r) => r.data),
    onSuccess: (data) => {
      setPublishOpen(false);
      after(data, 'Đã công bố và khóa bảng điểm');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  const letters = useMemo(() => LETTERS.map((l) => ({ l, n: d?.rows.filter((r) => r.letter === l).length ?? 0 })), [d]);
  if (q.isLoading) return <Loading />;
  if (!d)
    return (
      <div className="page">
        <PageHead title="Không mở được bảng điểm" sub={errorMessage(q.error)} />
      </div>
    );

  const s = d.section;
  const published = !!s.publishedAt;
  const hasAny = d.rows.some((r) => COMPS.some((c) => r[c] != null));
  const missing = d.rows.filter((r) => r.total == null);
  const [label, tone] = published ? STATUS.PUBLISHED : hasAny ? STATUS.DRAFT : STATUS.EMPTY;
  const rows = d.rows.filter((r) => (!missingOnly || r.total == null) && (!search || `${r.studentCode} ${r.fullName}`.toLowerCase().includes(search.toLowerCase())));
  const maxW = Math.max(...COMPS.map((c) => d.weights[c]), 1);
  const maxL = Math.max(1, ...letters.map((x) => x.n));
  const peak = letters.reduce((p, x) => (x.n > p.n ? x : p), letters[0]);
  const pick = (f?: File) => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return toast.err('Chỉ nhận tệp Excel .xlsx');
    upload.mutate(f);
  };

  return (
    <div className="page">
      <PageHead
        title={`Bảng điểm · ${s.course.name}`}
        badge={<Badge tone={tone}>{label}</Badge>}
        sub={`${s.code} · ${semesterLabel(s.semester)} · ${d.rows.length} sinh viên · ${s.course.credits} tín chỉ · ${published ? `Công bố ${fullDate(s.publishedAt)}` : 'Chưa công bố'}`}
        actions={
          <>
            <button
              className="btn"
              type="button"
              onClick={() => downloadFile(`/lecturer/sections/${sectionId}/grades/template`, `DiemHocPhan_${s.code}.xlsx`).catch((e) => toast.err(errorMessage(e)))}
            >
              <Icon name="download" size={16} />
              Tải file mẫu
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => downloadFile(`/lecturer/sections/${sectionId}/grades/export`, `BangDiem_${s.code}.xlsx`).catch((e) => toast.err(errorMessage(e)))}
            >
              <Icon name="listAlt" size={16} />
              Xuất Excel
            </button>
            {!published && (
              <button className="btn" type="button" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                {upload.isPending ? <span className="spinner" /> : <Icon name="upload" size={16} />}
                Nhập từ Excel
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {!published && (
              <button className="btn btn-p" type="button" disabled={!d.stats.complete} title={missing.length ? `Còn ${missing.length} sinh viên thiếu điểm` : undefined} onClick={() => setPublishOpen(true)}>
                <Icon name="lock" size={16} />
                Công bố &amp; khóa
              </button>
            )}
          </>
        }
      />

      {published && (
        <Note tone="green" icon="lock">
          Bảng điểm đã công bố lúc {fullDate(s.publishedAt)} và bị khóa. Sinh viên đã thấy điểm học phần. Muốn sửa điểm, bấm <b>Sửa điểm</b> ở dòng sinh viên để gửi yêu cầu cho Quản trị viên duyệt.
        </Note>
      )}
      {published && <GradeRequests sectionId={sectionId!} />}

      {preview && (
        <Card title={`Xem trước · ${preview.fileName}`} extra={<Badge tone={preview.errorRows ? 'amber' : 'green'}>{preview.errorRows ? `${preview.errorRows} dòng lỗi` : 'Hợp lệ'}</Badge>}>
          <div className="grid4">
            <Stat tone="green" icon="check" label="Đủ 4 thành phần" value={preview.complete} sub="tính được tổng kết" />
            <Stat tone="amber" icon="warn" label="Thiếu thành phần" value={preview.incomplete} sub="tổng kết để trống" />
            <Stat tone="blue" icon="refresh" label="Thay đổi" value={preview.changed} sub="so với điểm hiện tại" />
            <Stat tone="gray" icon="user" label="Không có trong file" value={preview.missing.length} sub="giữ điểm cũ" />
          </div>
          <RowErrors errors={preview.errors} />
          <div className="tbl-wrap" style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #E3E1D9', borderRadius: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>MSSV</th>
                  <th>Họ tên</th>
                  {COMPS.map((c) => (
                    <th key={c}>{COMP_LABEL[c]}</th>
                  ))}
                  <th>Tổng kết</th>
                  <th>Chữ</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.studentId} style={r.changed ? { background: '#FFFDF5' } : undefined}>
                    <td className="mono">{r.studentCode}</td>
                    <td>{r.fullName}</td>
                    {COMPS.map((c) => (
                      <td key={c} className="mono" style={{ whiteSpace: 'nowrap' }}>
                        {r.old[c] !== r.values[c] && r.old[c] != null && <span className="muted" style={{ textDecoration: 'line-through', marginRight: 4 }}>{score10(r.old[c])}</span>}
                        {score10(r.values[c])}
                      </td>
                    ))}
                    <td>
                      <b className="mono">{score10(r.total)}</b>
                    </td>
                    <td>{r.letter ? <Badge tone={LETTER_TONE(r.letter)}>{r.letter}</Badge> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PreviewActions errorRows={preview.errorRows} busy={commit.isPending} onCancel={() => setPreview(null)} onApply={(v) => commit.mutate(v)} applyLabel="Lưu điểm" />
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 24, alignItems: 'start' }} className="gb-top">
        <div className="col">
          <Card title="Trọng số điểm">
            {COMPS.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
                <span style={{ width: 110 }}>{COMP_LABEL[c]}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 3, background: '#EFEDE6' }}>
                  <div style={{ width: `${(d.weights[c] / maxW) * 100}%`, height: '100%', borderRadius: 3, background: '#DB0000' }} />
                </div>
                <span className="mono" style={{ width: 44, textAlign: 'right' }}>
                  {d.weights[c]}%
                </span>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 12 }}>
              Tổng = 100% · cột Bài tập trong file mẫu điền sẵn từ {d.assignments.length} bài tập của lớp
            </div>
          </Card>
          <ImportHistoryCard items={d.imports} />
        </div>
        <div className="col">
          <Card title="Phổ điểm tổng kết">
            {d.stats.complete ? (
              <>
                <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E3E1D9' }}>
                  {letters.map((x) => (
                    <div key={x.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: 170 }}>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {x.n || ''}
                      </span>
                      <div style={{ width: '70%', height: Math.max(2, (x.n / maxL) * 130), borderRadius: '4px 4px 0 0', background: x === peak && x.n ? '#DB0000' : '#F0A9A9' }} />
                      <span className="muted" style={{ fontSize: 12 }}>
                        {x.l}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Số sinh viên theo điểm chữ · {d.stats.complete} / {d.stats.students} đã có điểm · TB {score10(d.stats.avg)}
                </div>
              </>
            ) : (
              <div style={{ height: 150, border: '2px dashed #E3E1D9', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8A8E97' }}>
                <Icon name="chart" size={22} />
                <span style={{ fontSize: 13 }}>Biểu đồ hiển thị khi có điểm</span>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Danh sách điểm sinh viên" body={false}>
        <div style={{ padding: '12px 20px', display: 'flex', gap: 10, borderBottom: '1px solid #EFEDE6', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 280, maxWidth: '100%', height: 38, border: '1px solid #E3E1D9', borderRadius: 8, padding: '0 12px', color: '#62666F' }}>
            <Icon name="search" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm MSSV, họ tên…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
          </label>
          <button type="button" className="chip" style={{ cursor: 'pointer', ...(missingOnly ? { background: '#FDEDED', borderColor: '#F5C2C2' } : {}) }} onClick={() => setMissingOnly((v) => !v)}>
            Còn thiếu điểm ({missing.length})
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>MSSV</th>
                <th>Họ tên</th>
                {d.assignments.map((a, i) => (
                  <th key={a.id} title={`${a.title} · trọng số ${a.weight}%`}>
                    BT{i + 1}
                  </th>
                ))}
                <th>CC</th>
                <th>BT</th>
                <th>GK</th>
                <th>CK</th>
                <th>Tổng kết</th>
                <th>Chữ</th>
                <th>Hệ 4</th>
                {published && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td className="mono">{r.studentCode}</td>
                  <td>{r.fullName}</td>
                  {r.assignments.map((v, i) => (
                    <td key={i} className="mono muted" style={{ fontSize: 13 }}>
                      {score10(v)}
                    </td>
                  ))}
                  {COMPS.map((c) => (
                    <td key={c} className={`mono${r[c] == null ? ' muted' : ''}`}>
                      {score10(r[c])}
                    </td>
                  ))}
                  <td>
                    <b className="mono" style={{ color: r.total != null && r.total < 4 ? '#B42318' : undefined }}>
                      {score10(r.total)}
                    </b>
                  </td>
                  <td>{r.letter ? <Badge tone={LETTER_TONE(r.letter)}>{r.letter}</Badge> : <span className="muted">—</span>}</td>
                  <td className="mono">{r.gpa4 == null ? '—' : r.gpa4.toFixed(1).replace('.', ',')}</td>
                  {published && (
                    <td>
                      <button className="btn btn-sm" type="button" onClick={() => setEditing(r)}>
                        <Icon name="edit" size={14} />
                        Sửa điểm
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ padding: '12px 20px', fontSize: 13, borderTop: '1px solid #EFEDE6' }}>
          Hiển thị {rows.length} / {d.rows.length}
          {missing.length ? ` · ${missing.length} sinh viên còn thiếu điểm` : ''}
          {d.stats.failing ? ` · ${d.stats.failing} sinh viên dưới 4,0` : ''}
        </div>
      </Card>

      {editing && <RequestModal sectionId={sectionId!} row={editing} onClose={() => setEditing(null)} />}
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)}>
        <h2 className="sec">Công bố &amp; khóa bảng điểm</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Sinh viên sẽ thấy điểm học phần và nhận thông báo. Sau khi công bố, bảng điểm bị khóa — không tải lên lại được.
        </p>
        {missing.length > 0 && (
          <Note tone="amber" icon="warn">
            Còn <b>{missing.length} sinh viên</b> chưa đủ 4 thành phần: {missing.slice(0, 5).map((r) => r.fullName).join(', ')}
            {missing.length > 5 ? '…' : ''}. Tổng kết của các bạn này để trống và không tính GPA.
          </Note>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => setPublishOpen(false)}>
            Hủy
          </button>
          <button className="btn btn-p" type="button" disabled={publish.isPending} onClick={() => publish.mutate(missing.length > 0)}>
            <Icon name="lock" size={16} />
            {missing.length ? 'Công bố cả SV thiếu điểm' : 'Công bố'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

type GradeRequest = {
  id: string;
  student: { id: string; studentCode: string; fullName: string };
  oldValues: Partial<Record<GradeComp, number | null>>;
  newValues: Partial<Record<GradeComp, number | null>>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
const REQ: Record<GradeRequest['status'], [string, Tone]> = { PENDING: ['Chờ duyệt', 'amber'], APPROVED: ['Đã duyệt', 'green'], REJECTED: ['Từ chối', 'red'], CANCELLED: ['Đã hủy', 'gray'] };

/** UC07.7 – danh sách yêu cầu sửa điểm sau khóa của lớp. */
function GradeRequests({ sectionId }: { sectionId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['lecturer', 'grade-requests', sectionId], queryFn: () => api.get<GradeRequest[]>(`/lecturer/sections/${sectionId}/grade-requests`).then((r) => r.data) });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/lecturer/grade-requests/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturer', 'grade-requests', sectionId] });
      toast.ok('Đã hủy yêu cầu');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  if (!q.data?.length) return null;
  const change = (r: GradeRequest) =>
    (Object.keys(r.newValues) as GradeComp[]).map((c) => `${COMP_LABEL[c]}: ${score10(r.oldValues[c] ?? null)} → ${score10(r.newValues[c] ?? null)}`).join(' · ');
  return (
    <Card title={`Yêu cầu sửa điểm (${q.data.length})`} body={false}>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>Thay đổi</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="mono">{r.student.studentCode}</span> {r.student.fullName}
                  <div className="muted" style={{ fontSize: 12 }}>
                    Gửi {fullDate(r.createdAt)}
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 13 }}>
                  {change(r)}
                </td>
                <td style={{ fontSize: 13, maxWidth: 280 }}>
                  {r.reason}
                  {r.adminNote && <div className="muted">Quản trị viên: {r.adminNote}</div>}
                </td>
                <td>
                  <Badge tone={REQ[r.status][1]}>{REQ[r.status][0]}</Badge>
                </td>
                <td>
                  {r.status === 'PENDING' && (
                    <button className="btn btn-sm" type="button" disabled={cancel.isPending} onClick={() => confirm('Hủy yêu cầu sửa điểm này?') && cancel.mutate(r.id)}>
                      Hủy
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Form gửi yêu cầu sửa điểm cho một sinh viên (bảng điểm đã khóa). */
function RequestModal({ sectionId, row, onClose }: { sectionId: string; row: SectionGrades['rows'][number]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState<Record<GradeComp, string>>(() => Object.fromEntries(COMPS.map((c) => [c, row[c] == null ? '' : String(row[c]).replace('.', ',')])) as Record<GradeComp, string>);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: (body: unknown) => api.post(`/lecturer/sections/${sectionId}/grade-requests`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturer', 'grade-requests', sectionId] });
      toast.ok('Đã gửi yêu cầu cho Quản trị viên duyệt');
      onClose();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const submit = () => {
    const out: Partial<Record<GradeComp, number | null>> = {};
    for (const c of COMPS) {
      const t = values[c].trim().replace(',', '.');
      const v = t === '' ? null : Number(t);
      if (v != null && (!Number.isFinite(v) || v < 0 || v > 10)) return setErr(`${COMP_LABEL[c]}: điểm phải từ 0 đến 10`);
      if (v !== row[c]) out[c] = v == null ? null : Math.round(v * 10) / 10;
    }
    if (!Object.keys(out).length) return setErr('Chưa thay đổi điểm nào');
    if (reason.trim().length < 10) return setErr('Lý do tối thiểu 10 ký tự');
    setErr('');
    m.mutate({ studentId: row.studentId, values: out, reason: reason.trim() });
  };
  return (
    <Modal open onClose={onClose}>
      <h2 className="sec">
        Yêu cầu sửa điểm · {row.fullName} <span className="mono muted">{row.studentCode}</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        {COMPS.map((c) => (
          <div key={c}>
            <label className="lbl">{COMP_LABEL[c]}</label>
            <input className="inp mono" style={{ textAlign: 'center' }} value={values[c]} onChange={(e) => setValues({ ...values, [c]: e.target.value })} />
            <div className="help">Hiện tại: {score10(row[c])}</div>
          </div>
        ))}
      </div>
      <div>
        <label className="lbl">Lý do *</label>
        <textarea className="inp" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Nhập nhầm điểm cuối kỳ, bảng gốc là 8,0" />
      </div>
      {err && <div className="err">{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn-p" type="button" disabled={m.isPending} onClick={submit}>
          Gửi yêu cầu
        </button>
      </div>
    </Modal>
  );
}
