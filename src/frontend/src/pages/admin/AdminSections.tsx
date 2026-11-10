import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Card, Empty, Field, KV, Loading, Note, PageHead } from '../../components/ui';
import { Actions, FormModal, Grid2, Full, IconBtn, SearchBox, Select, Table, Tiles, Toolbar, norm, useAct, useAdmin, useConfirm } from './kit';
import { semName, type Course } from './AdminAcademic';

interface Section {
  id: string;
  code: string;
  course: { id: string; code: string; name: string; credits: number };
  lecturer: { id: string; code: string; fullName: string };
  students: number;
  assignments: number;
}
interface Sem {
  id: string;
  code: string;
  academicYear: string;
  term: string;
  isCurrent: boolean;
  startDate: string;
}
interface Lec {
  id: string;
  code: string;
  fullName: string;
  status: string;
  faculty: { code: string } | null;
}
interface Detail {
  id: string;
  code: string;
  course: string;
  lecturer: string;
  students: { id: string; studentCode: string; fullName: string; adminClass: string | null; cohort: string | null; major: string | null }[];
}

/** Lớp học phần – mẫu admin/lop-hoc-phan (UC02.9, UC02.10). Chỉ để gom bài tập theo lớp, không quản lý lịch học / sĩ số. */
export function SectionsPage() {
  useCrumbs([{ label: 'Lớp học phần' }]);
  const [params, setParams] = useSearchParams();
  const sems = useAdmin<Sem[]>('/semesters');
  const semId = params.get('semester') ?? sems.data?.find((s) => s.isCurrent)?.id ?? sems.data?.[0]?.id ?? '';
  const list = useAdmin<{ semesterId: string | null; sections: Section[] }>(`/sections?semester=${semId}`, !!semId || !!sems.data);
  const courses = useAdmin<Course[]>('/courses');
  const lecs = useAdmin<Lec[]>('/lecturers');
  const act = useAct();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [course, setCourse] = useState(params.get('course') ?? '');
  const [lec, setLec] = useState('');
  const [form, setForm] = useState<{ s: Section | null; copy?: Section } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  if (!sems.data || !list.data || !courses.data || !lecs.data) return <Loading />;
  const all = list.data.sections;
  const rows = all.filter((s) => (!course || s.course.id === course) && (!lec || s.lecturer.id === lec) && (!q || norm(`${s.code} ${s.course.name} ${s.lecturer.fullName}`).includes(norm(q))));
  const del = async (s: Section) => {
    if (s.students) return confirm({ title: 'Không thể xóa', msg: <>Lớp <b className="mono">{s.code}</b> đang có {s.students} sinh viên. Hãy gỡ sinh viên khỏi lớp trước khi xóa lớp.</>, ok: 'Đã hiểu' });
    if (!(await confirm({ title: 'Xóa lớp học phần', msg: <>Xóa lớp <b className="mono">{s.code}</b> – {s.course.name}?</>, ok: 'Xóa', danger: true }))) return;
    await act.mutateAsync({ method: 'delete', path: `sections/${s.id}`, ok: 'Đã xóa lớp học phần.' }).catch(() => undefined);
  };
  return (
    <div className="page">
      <PageHead
        title="Lớp học phần"
        actions={
          <>
            <Link className="btn" to="/admin/import/enrollments">
              <Icon name="users" size={18} /> Xếp sinh viên từ Excel
            </Link>
            <Link className="btn" to="/admin/import/sections">
              <Icon name="sheet" size={18} /> Import lớp học phần
            </Link>
            <button className="btn btn-p" onClick={() => setForm({ s: null })}>
              <Icon name="plus" size={18} /> Tạo lớp học phần
            </button>
          </>
        }
      />
      <Tiles
        items={[
          ['Lớp học phần trong kỳ', all.length, 'calendar'],
          ['Môn được mở', new Set(all.map((s) => s.course.id)).size, 'logo'],
          ['Sinh viên đã xếp lớp', all.reduce((a, s) => a + s.students, 0), 'users'],
          ['Bài tập đã giao', all.reduce((a, s) => a + s.assignments, 0), 'list'],
        ]}
      />
      <Card body={false}>
        <Toolbar>
          <Select label="Học kỳ" value={semId} onChange={(v) => setParams({ semester: v })}>
            {sems.data.map((s) => (
              <option key={s.id} value={s.id}>
                {semName(s)}
              </option>
            ))}
          </Select>
          <SearchBox value={q} onChange={setQ} placeholder="Mã lớp, tên môn, giảng viên…" />
          <Select label="Môn học" value={course} onChange={setCourse}>
            <option value="">Tất cả môn</option>
            {courses.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} – {c.name}
              </option>
            ))}
          </Select>
          <Select label="Giảng viên" value={lec} onChange={setLec}>
            <option value="">Tất cả giảng viên</option>
            {lecs.data.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </Select>
        </Toolbar>
        <Table
          rows={rows}
          rowKey={(s) => s.id}
          empty="Chưa có lớp học phần nào phù hợp. Bấm “Tạo lớp học phần” để mở lớp."
          cols={[
            { h: 'Mã lớp', r: (s) => <b className="mono">{s.code}</b> },
            {
              h: 'Môn học',
              r: (s) => {
                const n = all.filter((o) => o.course.id === s.course.id).length;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{s.course.name}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      <span className="mono">{s.course.code}</span> · {s.course.credits} TC{n > 1 ? ` · môn mở ${n} lớp` : ''}
                    </span>
                  </div>
                );
              },
            },
            { h: 'Giảng viên', r: (s) => s.lecturer.fullName },
            { h: 'Sinh viên', align: 'right', r: (s) => <b>{s.students}</b> },
            { h: 'Bài tập', align: 'right', r: (s) => (s.assignments ? s.assignments : <span className="muted">0</span>) },
            {
              h: '',
              align: 'right',
              r: (s) => (
                <Actions>
                  <IconBtn icon="users" title="Chi tiết & danh sách SV" onClick={() => setDetail(s.id)} />
                  <IconBtn icon="edit" title="Sửa" onClick={() => setForm({ s })} />
                  <IconBtn icon="copy" title="Mở thêm lớp cho môn này" onClick={() => setForm({ s: null, copy: s })} />
                  <IconBtn icon="trash" title="Xóa" onClick={() => del(s)} />
                </Actions>
              ),
            },
          ]}
        />
      </Card>
      {form && <SectionForm s={form.s} copy={form.copy} semId={semId} sems={sems.data} courses={courses.data} lecs={lecs.data} all={all} onClose={() => setForm(null)} />}
      {detail && (
        <SectionDetail
          id={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const s = all.find((x) => x.id === detail);
            setDetail(null);
            if (s) setForm({ s });
          }}
        />
      )}
    </div>
  );
}

const TERM_SHORT: Record<string, string> = { TERM_1: 'HK1', TERM_2: 'HK2', SUMMER: 'HE' };
/** Tiền tố mã lớp: MÃMÔN_HKx_YYYY – VD MH01 · HK1 · 2025-2026 → MH01_HK1_2526 (trùng quy tắc ở backend). */
const prefixOf = (courseCode: string, sem?: Sem) => (sem ? `${courseCode.trim().toUpperCase()}_${TERM_SHORT[sem.term]}_${sem.academicYear.slice(2, 4)}${sem.academicYear.slice(7, 9)}` : courseCode.toUpperCase());
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mã lớp tiếp theo của môn trong học kỳ: <tiền tố>_01, _02… (bỏ qua số đã dùng). */
function nextCode(prefix: string, all: Section[]) {
  const re = new RegExp(`^${escapeRe(prefix)}_(\\d{2,3})$`);
  const used = all.map((s) => re.exec(s.code)?.[1]).filter(Boolean).map(Number);
  return `${prefix}_${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}

function SectionForm({ s, copy, semId, sems, courses, lecs, all, onClose }: { s: Section | null; copy?: Section; semId: string; sems: Sem[]; courses: Course[]; lecs: Lec[]; all: Section[]; onClose: () => void }) {
  const act = useAct();
  const base = s ?? copy;
  const firstCourse = base?.course.id ?? courses[0]?.id ?? '';
  const prefixFor = (courseId: string, semesterId: string) => prefixOf(courses.find((c) => c.id === courseId)?.code ?? '', sems.find((x) => x.id === semesterId));
  const [v, setV] = useState(() => {
    const p = prefixFor(firstCourse, semId);
    // lớp cũ chưa theo định dạng mới → gợi ý mã mới
    const keep = s && new RegExp(`^${escapeRe(p)}_\\d{2,3}$`).test(s.code);
    return { semesterId: semId, courseId: firstCourse, code: keep ? s.code : nextCode(p, all), lecturerId: s?.lecturer.id ?? '' };
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const prefix = prefixFor(v.courseId, v.semesterId);
  const others = all.filter((x) => x.course.id === v.courseId && x.id !== s?.id);
  // đổi môn / học kỳ → sinh lại mã theo tiền tố mới
  const change = (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch };
    const p = prefixFor(next.courseId, next.semesterId);
    setV({ ...next, code: next.code.startsWith(`${p}_`) ? next.code : nextCode(p, all.filter((x) => x.id !== s?.id)) });
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!new RegExp(`^${escapeRe(prefix)}_\\d{2,3}$`, 'i').test(v.code.trim())) e.code = `Định dạng: ${prefix}_01 (mã môn _ học kỳ _ năm học _ số thứ tự).`;
    if (!v.lecturerId) e.lecturerId = 'Chọn giảng viên.';
    setErr(e);
    if (Object.keys(e).length) return;
    const ok = await act
      .mutateAsync(s ? { method: 'put', path: `sections/${s.id}`, body: v, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: 'sections', body: v, ok: `Đã mở lớp ${v.code.toUpperCase()}. Thêm sinh viên trong mục chi tiết lớp.` })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title={s ? `Sửa lớp học phần ${s.code}` : copy ? `Mở thêm lớp cho môn ${copy.course.code}` : 'Tạo lớp học phần'}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {s ? 'Lưu thay đổi' : 'Tạo lớp'}
          </button>
        </>
      }
    >
      {copy && (
        <Note tone="blue" icon="info">
          Đã sao chép môn học từ lớp <b className="mono">{copy.code}</b>. Hãy chọn giảng viên cho lớp mới.
        </Note>
      )}
      <Grid2>
        <Field label="Học kỳ *">
          <select className="inp" value={v.semesterId} disabled={!!s} onChange={(e) => change({ semesterId: e.target.value })}>
            {sems.map((x) => (
              <option key={x.id} value={x.id}>
                {semName(x)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Môn học *">
          <select
            className="inp"
            value={v.courseId}
            disabled={!!s && s.assignments > 0}
            onChange={(e) => change({ courseId: e.target.value })}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} – {c.name} ({c.credits} TC)
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Mã lớp học phần *"
          error={err.code}
          help={`Dạng ${prefix}_STT (tự sinh theo môn và học kỳ). ${v.semesterId === semId && others.length ? `Môn đã có ${others.length} lớp trong kỳ: ${others.map((x) => x.code).join(', ')}.` : ''}`}
        >
          <input className="inp mono" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Giảng viên phụ trách *" error={err.lecturerId}>
          <select className="inp" value={v.lecturerId} disabled={!!s && s.assignments > 0} onChange={(e) => setV({ ...v, lecturerId: e.target.value })}>
            <option value="">— Chọn giảng viên —</option>
            {lecs
              .filter((g) => g.status === 'ACTIVE' || g.id === v.lecturerId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.fullName}
                  {g.faculty ? ` — ${g.faculty.code}` : ''}
                </option>
              ))}
          </select>
        </Field>
        {!!s && s.assignments > 0 && (
          <Full>
            <div className="help">Lớp đã có bài tập nên không đổi được môn học và giảng viên.</div>
          </Full>
        )}
      </Grid2>
    </FormModal>
  );
}

function SectionDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: () => void }) {
  const q = useAdmin<Detail>(`/sections/${id}/students`);
  const act = useAct();
  const confirm = useConfirm();
  const [code, setCode] = useState('');
  const [bulk, setBulk] = useState<string | null>(null);
  const [res, setRes] = useState<{ added: string[]; skipped: { code: string; reason: string }[] } | null>(null);
  const add = async (codes: string[]) => {
    const r = (await act.mutateAsync({ method: 'post', path: `sections/${id}/students`, body: { codes } }).catch(() => null)) as typeof res;
    if (!r) return;
    setRes(r);
    setCode('');
    if (bulk !== null) setBulk('');
  };
  const remove = async (s: Detail['students'][number]) => {
    if (!(await confirm({ title: 'Xóa khỏi lớp', msg: <>Xóa <b>{s.fullName}</b> ({s.studentCode}) khỏi lớp {q.data?.code}?</>, ok: 'Xóa', danger: true }))) return;
    await act.mutateAsync({ method: 'delete', path: `sections/${id}/students/${s.id}`, ok: 'Đã xóa sinh viên khỏi lớp.' }).catch(() => undefined);
  };
  const d = q.data;
  return (
    <FormModal
      title={d ? `Lớp học phần ${d.code}` : 'Lớp học phần'}
      width={720}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn" onClick={onEdit}>
            <Icon name="edit" size={16} /> Sửa lớp
          </button>
        </>
      }
    >
      {!d ? (
        <span className="spinner" />
      ) : (
        <>
          <KV
            rows={[
              ['Môn học', <b key="c">{d.course}</b>],
              ['Giảng viên', d.lecturer],
              ['Số sinh viên', `${d.students.length} sinh viên`],
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15 }}>Danh sách sinh viên</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => setBulk(bulk === null ? '' : null)}>
                <Icon name="list" size={15} /> Nhập danh sách MSV
              </button>
              <Link className="btn btn-sm" to={`/admin/import/enrollments?section=${id}`}>
                <Icon name="sheet" size={15} /> Tải từ Excel
              </Link>
            </div>
          </div>
          {bulk === null ? (
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) add([code.trim()]);
              }}
            >
              <input className="inp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập MSV để thêm…" aria-label="Thêm sinh viên" style={{ flex: 1 }} />
              <button className="btn btn-p" disabled={act.isPending}>
                <Icon name="plus" size={16} /> Thêm
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Nhập danh sách MSV (mỗi dòng một MSV, hoặc phân cách bằng dấu phẩy) — có thể copy trực tiếp từ một cột trong Excel.
              </span>
              <textarea className="inp mono" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} style={{ height: 'auto', padding: 10 }} />
              <button className="btn btn-p" style={{ alignSelf: 'flex-end' }} disabled={act.isPending || !bulk.trim()} onClick={() => add(bulk.split(/[\s,;]+/).filter(Boolean))}>
                Thêm vào lớp
              </button>
            </div>
          )}
          {res && (
            <Note tone={res.skipped.length ? 'amber' : 'green'} icon={res.skipped.length ? 'warn' : 'check'}>
              Đã thêm <b>{res.added.length}</b> sinh viên.
              {res.skipped.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {res.skipped.map((s) => (
                    <li key={s.code}>
                      <span className="mono">{s.code}</span>: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </Note>
          )}
          <div style={{ border: '1px solid #E3E1D9', borderRadius: 10, overflow: 'hidden' }}>
            {d.students.length ? (
              <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Sinh viên</th>
                      <th>Lớp HC</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.students.map((s, i) => (
                      <tr key={s.id}>
                        <td className="muted">{i + 1}</td>
                        <td>
                          <b>{s.fullName}</b>{' '}
                          <span className="mono muted" style={{ fontSize: 12 }}>
                            {s.studentCode}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 13 }}>
                          {s.adminClass ?? '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <IconBtn icon="close" title={`Xóa ${s.fullName} khỏi lớp`} onClick={() => remove(s)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="users">Lớp chưa có sinh viên.</Empty>
            )}
          </div>
        </>
      )}
    </FormModal>
  );
}
