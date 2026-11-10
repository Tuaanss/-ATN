import { useState } from 'react';
import { Link } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/DateInput';
import { Badge, Bar, Card, Field, Loading, PageHead, Tabs, type Tone } from '../../components/ui';
import { fullDate } from '../../utils/format';
import { Actions, Count, FormModal, Full, Grid2, IconBtn, SearchBox, Select, StatusBadge, Table, Toolbar, norm, useAct, useAdmin, useConfirm, type Col } from './kit';
import type { Catalog } from './AdminUsers';

// ================================================================ danh mục (UC02.6)

type CatKey = 'faculties' | 'majors' | 'cohorts' | 'classes';
type Row = Record<string, unknown> & { id: string };
interface FieldDef {
  k: string;
  label: string;
  type?: 'number' | 'faculty' | 'major' | 'cohort';
}

export function CatalogPage() {
  useCrumbs([{ label: 'Quản lý danh mục' }]);
  const q0 = useAdmin<Catalog>('/catalog');
  const act = useAct();
  const confirm = useConfirm();
  const [tab, setTab] = useState<CatKey>('faculties');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  const [fCohort, setFCohort] = useState('');
  const [fMajor, setFMajor] = useState('');
  const [view, setView] = useState<string | null>(null);
  if (!q0.data) return <Loading />;
  const c = q0.data;
  const num = (n: unknown) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(n)}</span>;
  const CATS: Record<CatKey, { label: string; api?: string; hint: string; rows: Row[]; cols: Col<Row>[]; fields?: FieldDef[] }> = {
    faculties: {
      label: 'Khoa',
      api: 'faculties',
      hint: 'Khoa quản lý ngành, giảng viên và môn học.',
      rows: c.faculties as unknown as Row[],
      cols: [
        { h: 'Mã khoa', r: (x) => <span className="mono">{String(x.code)}</span> },
        { h: 'Tên khoa', r: (x) => <b>{String(x.name)}</b> },
        { h: 'Số ngành', r: (x) => num(x.majors), align: 'right' },
        { h: 'Số giảng viên', r: (x) => num(x.lecturers), align: 'right' },
      ],
      fields: [
        { k: 'code', label: 'Mã khoa' },
        { k: 'name', label: 'Tên khoa' },
      ],
    },
    majors: {
      label: 'Ngành',
      api: 'majors',
      hint: 'Mã ngành theo danh mục đào tạo của Bộ GD&ĐT.',
      rows: c.majors.map((m) => ({ ...m, facultyId: m.faculty.id })) as unknown as Row[],
      cols: [
        { h: 'Mã ngành', r: (x) => <span className="mono">{String(x.code)}</span> },
        { h: 'Tên ngành', r: (x) => <b>{String(x.name)}</b> },
        { h: 'Khoa', r: (x) => (x.faculty as { name: string }).name },
        { h: 'Số sinh viên', r: (x) => num(x.students), align: 'right' },
      ],
      fields: [
        { k: 'code', label: 'Mã ngành' },
        { k: 'name', label: 'Tên ngành' },
        { k: 'facultyId', label: 'Khoa', type: 'faculty' },
      ],
    },
    cohorts: {
      label: 'Khóa',
      api: 'cohorts',
      hint: 'Khóa tuyển sinh, VD: D22 nhập học năm 2022.',
      rows: c.cohorts as unknown as Row[],
      cols: [
        { h: 'Tên khóa', r: (x) => <b>{String(x.name)}</b> },
        { h: 'Năm nhập học', r: (x) => String(x.startYear) },
        { h: 'Số lớp', r: (x) => num(x.classes), align: 'right' },
        { h: 'Số sinh viên', r: (x) => num(x.students), align: 'right' },
      ],
      fields: [
        { k: 'name', label: 'Tên khóa' },
        { k: 'startYear', label: 'Năm nhập học', type: 'number' },
      ],
    },
    classes: {
      label: 'Lớp hành chính',
      api: 'classes',
      hint: 'Ngành và khóa của sinh viên lấy theo lớp.',
      rows: c.classes.map((x) => ({ ...x, majorId: x.major.id, cohortId: x.cohort.id })) as unknown as Row[],
      cols: [
        { h: 'Mã lớp', r: (x) => <b className="mono">{String(x.code)}</b> },
        { h: 'Ngành', r: (x) => (x.major as { name: string }).name },
        { h: 'Khóa', r: (x) => (x.cohort as { name: string }).name },
        { h: 'Số sinh viên', r: (x) => num(x.students), align: 'right' },
      ],
      fields: [
        { k: 'code', label: 'Mã lớp' },
        { k: 'majorId', label: 'Ngành', type: 'major' },
        { k: 'cohortId', label: 'Khóa', type: 'cohort' },
      ],
    },
  };
  const cur = CATS[tab];
  const rows = cur.rows
    .filter((x) => tab !== 'classes' || ((!fCohort || x.cohortId === fCohort) && (!fMajor || x.majorId === fMajor)))
    .filter((x) => !q || norm(Object.values(x).map((v) => (typeof v === 'object' && v ? Object.values(v).join(' ') : String(v))).join(' ')).includes(norm(q)));
  const del = async (x: Row) => {
    if (!(await confirm({ title: `Xóa ${cur.label.toLowerCase()}`, msg: <>Xóa <b>{String(x.name ?? x.code)}</b> khỏi danh mục?</>, ok: 'Xóa', danger: true }))) return;
    await act.mutateAsync({ method: 'delete', path: `catalog/${cur.api}/${x.id}`, ok: 'Đã xóa.' }).catch(() => undefined);
  };
  const cols: Col<Row>[] = cur.api
    ? [
        ...cur.cols,
        {
          h: '',
          align: 'right',
          r: (x) => (
            <Actions>
              {tab === 'classes' && <IconBtn icon="eye" title="Xem danh sách sinh viên" onClick={() => setView(x.id)} />}
              <IconBtn icon="edit" title="Sửa" onClick={() => setEdit(x)} />
              <IconBtn icon="trash" title="Xóa" onClick={() => del(x)} />
            </Actions>
          ),
        },
      ]
    : cur.cols;
  return (
    <div className="page">
      <PageHead
        title="Quản lý danh mục"
        actions={
          cur.api && (
            <>
              <Link className="btn" to={`/admin/import/${tab}`}>
                <Icon name="sheet" size={18} /> Import {cur.label.toLowerCase()}
              </Link>
              <button className="btn btn-p" onClick={() => setEdit('new')}>
                <Icon name="plus" size={18} /> Thêm {cur.label.toLowerCase()}
              </button>
            </>
          )
        }
      />
      <Card body={false}>
        <div style={{ padding: '0 12px' }}>
          <Tabs
            value={tab}
            onChange={(k) => {
              setTab(k);
              setQ('');
              setFCohort('');
              setFMajor('');
            }}
            items={(Object.keys(CATS) as CatKey[]).map((k) => ({
              key: k,
              label: (
                <>
                  {CATS[k].label}
                  <Count n={CATS[k].rows.length} />
                </>
              ),
            }))}
          />
        </div>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder={tab === 'classes' ? 'Tìm mã lớp, ngành, khóa…' : 'Tìm trong danh mục…'} />
          {tab === 'classes' && (
            <>
              <Select label="Khóa" value={fCohort} onChange={setFCohort}>
                <option value="">Tất cả khóa</option>
                {c.cohorts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
              <Select label="Ngành" value={fMajor} onChange={setFMajor}>
                <option value="">Tất cả ngành</option>
                {c.majors.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} – {x.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <span className="muted" style={{ fontSize: 13 }}>
            {cur.hint}
          </span>
        </Toolbar>
        <Table rows={rows} rowKey={(x) => x.id} cols={cols} pageSize={10} onRow={tab === 'classes' ? (x) => setView(x.id) : undefined} />
      </Card>
      {view && <ClassStudents id={view} onClose={() => setView(null)} />}
      {edit && cur.fields && <CatalogForm cat={c} label={cur.label} api={cur.api!} fields={cur.fields} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

interface ClassDetail {
  id: string;
  code: string;
  major: string;
  cohort: string;
  students: { id: string; studentCode: string; fullName: string; dateOfBirth: string; email: string | null; phone: string | null; status: string }[];
}

/** Danh sách sinh viên của một lớp hành chính, tìm theo MSV / họ tên / email / SĐT. */
function ClassStudents({ id, onClose }: { id: string; onClose: () => void }) {
  const q0 = useAdmin<ClassDetail>(`/catalog/classes/${id}/students`);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const d = q0.data;
  const list = (d?.students ?? []).filter((x) => (!st || x.status === st) && (!q || norm(`${x.studentCode} ${x.fullName} ${x.email ?? ''} ${x.phone ?? ''}`).includes(norm(q))));
  return (
    <FormModal
      title={d ? `Lớp ${d.code} · ${d.major} · Khóa ${d.cohort}` : 'Danh sách sinh viên'}
      width={960}
      onClose={onClose}
      foot={
        <button className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {!d ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchBox value={q} onChange={setQ} placeholder="Tìm MSV, họ tên, email, SĐT…" />
            <Select label="Trạng thái" value={st} onChange={setSt}>
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="FIRST_LOGIN">Chưa đăng nhập lần đầu</option>
              <option value="LOCKED">Đã khóa</option>
            </Select>
            <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
              {list.length === d.students.length ? `${d.students.length} sinh viên` : `${list.length} / ${d.students.length} sinh viên`}
            </span>
          </div>
          <Table
            rows={list}
            rowKey={(x) => x.id}
            pageSize={10}
            empty={d.students.length ? 'Không có sinh viên phù hợp.' : 'Lớp chưa có sinh viên.'}
            cols={[
              { h: 'MSV', r: (x) => <span className="mono">{x.studentCode}</span> },
              { h: 'Họ tên', r: (x) => <b>{x.fullName}</b> },
              { h: 'Ngày sinh', r: (x) => fullDate(x.dateOfBirth) },
              { h: 'Email', r: (x) => x.email ?? '—' },
              { h: 'SĐT', r: (x) => x.phone ?? '—' },
              { h: 'Trạng thái', r: (x) => <StatusBadge s={x.status} /> },
            ]}
          />
        </div>
      )}
    </FormModal>
  );
}

function CatalogForm({ cat, label, api, fields, row, onClose }: { cat: Catalog; label: string; api: string; fields: FieldDef[]; row: Row | null; onClose: () => void }) {
  const act = useAct();
  const opts = { faculty: cat.faculties.map((f) => [f.id, f.name]), major: cat.majors.map((m) => [m.id, `${m.code} – ${m.name}`]), cohort: cat.cohorts.map((x) => [x.id, x.name]) } as Record<string, string[][]>;
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.k, row ? String(row[f.k] ?? '') : f.type && f.type !== 'number' ? (opts[f.type][0]?.[0] ?? '') : f.type === 'number' ? String(new Date().getFullYear()) : ''])));
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      if (!v[f.k]?.trim()) e[f.k] = 'Bắt buộc nhập.';
      else if (f.type === 'number' && !(+v[f.k] >= 2000 && +v[f.k] <= 2100)) e[f.k] = 'Năm không hợp lệ.';
    }
    setErr(e);
    if (Object.keys(e).length) return;
    const body = Object.fromEntries(fields.map((f) => [f.k, f.type === 'number' ? +v[f.k] : v[f.k].trim()]));
    const ok = await act
      .mutateAsync(row ? { method: 'put', path: `catalog/${api}/${row.id}`, body, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: `catalog/${api}`, body, ok: 'Đã thêm.' })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title={`${row ? 'Sửa' : 'Thêm'} ${label.toLowerCase()}`}
      width={480}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {row ? 'Lưu' : 'Thêm'}
          </button>
        </>
      }
    >
      {fields.map((f) => (
        <Field key={f.k} label={`${f.label} *`} error={err[f.k]}>
          {f.type && f.type !== 'number' ? (
            <select className="inp" value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>
              {opts[f.type].map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input className={`inp${f.k === 'code' ? ' mono' : ''}`} type={f.type === 'number' ? 'number' : 'text'} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          )}
        </Field>
      ))}
    </FormModal>
  );
}

// ================================================================ học kỳ & môn học (UC02.8)

interface Semester {
  id: string;
  code: string;
  academicYear: string;
  term: 'TERM_1' | 'TERM_2' | 'SUMMER';
  startDate: string;
  endDate: string;
  weeks: number;
  isCurrent: boolean;
  sections: number;
}
export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  faculty: { id: string; code: string; name: string } | null;
  isActive: boolean;
  sectionsTotal: number;
}
const TERM: Record<string, string> = { TERM_1: 'Học kỳ 1', TERM_2: 'Học kỳ 2', SUMMER: 'Học kỳ hè' };
export const semName = (s: { term: string; academicYear: string }) => `${TERM[s.term]} · ${s.academicYear.replace('-', '–')}`;
const iso = (v: string) => v.slice(0, 10);

function semState(s: Semester): [string, Tone] {
  const now = Date.now();
  if (new Date(s.endDate).getTime() + 86_400_000 < now) return ['Đã kết thúc', 'gray'];
  if (new Date(s.startDate).getTime() > now) return ['Sắp tới', 'blue'];
  return ['Đang diễn ra', 'green'];
}

export function SemestersPage() {
  useCrumbs([{ label: 'Học kỳ & môn học' }]);
  const sems = useAdmin<Semester[]>('/semesters');
  const courses = useAdmin<Course[]>('/courses');
  const cat = useAdmin<Catalog>('/catalog');
  const act = useAct();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'hk' | 'mh'>('hk');
  const [q, setQ] = useState('');
  const [fac, setFac] = useState('');
  const [editS, setEditS] = useState<Semester | 'new' | null>(null);
  const [editC, setEditC] = useState<Course | 'new' | null>(null);
  if (!sems.data || !courses.data || !cat.data) return <Loading />;
  const cur = sems.data.find((s) => s.isCurrent);
  const pct = cur ? Math.max(0, Math.min(100, Math.round(((Date.now() - new Date(cur.startDate).getTime()) / (new Date(cur.endDate).getTime() - new Date(cur.startDate).getTime())) * 100))) : 0;
  const week = cur ? Math.max(1, Math.ceil((Date.now() - new Date(cur.startDate).getTime()) / (7 * 86_400_000))) : 0;

  const delSem = async (s: Semester) => {
    if (!(await confirm({ title: 'Xóa học kỳ', msg: <>Xóa <b>{semName(s)}</b>?</>, ok: 'Xóa', danger: true }))) return;
    await act.mutateAsync({ method: 'delete', path: `semesters/${s.id}`, ok: 'Đã xóa học kỳ.' }).catch(() => undefined);
  };
  const setCurrent = async (s: Semester) => {
    if (!(await confirm({ title: 'Đặt học kỳ hiện tại', msg: <>Đặt <b>{semName(s)}</b> là học kỳ hiện tại? Trang tổng quan của GV và SV sẽ hiển thị các lớp của học kỳ này.</>, ok: 'Đặt hiện tại' }))) return;
    await act.mutateAsync({ method: 'post', path: `semesters/${s.id}/current`, ok: 'Đã đổi học kỳ hiện tại.' }).catch(() => undefined);
  };
  const delCourse = async (c: Course) => {
    if (!(await confirm({ title: 'Xóa môn học', msg: <>Xóa môn <b>{c.code} – {c.name}</b>?</>, ok: 'Xóa', danger: true }))) return;
    await act.mutateAsync({ method: 'delete', path: `courses/${c.id}`, ok: 'Đã xóa môn học.' }).catch(() => undefined);
  };
  const semRows = sems.data.filter((s) => !q || norm(`${s.academicYear} ${semName(s)}`).includes(norm(q)));
  const courseRows = courses.data.filter((c) => (!q || norm(`${c.code} ${c.name}`).includes(norm(q))) && (!fac || c.faculty?.id === fac));

  return (
    <div className="page">
      <PageHead
        title="Học kỳ & môn học"
        actions={
          <>
            {tab === 'mh' && (
              <Link className="btn" to="/admin/import/courses">
                <Icon name="sheet" size={18} /> Import từ Excel
              </Link>
            )}
            <button className="btn btn-p" onClick={() => (tab === 'hk' ? setEditS('new') : setEditC('new'))}>
              <Icon name="plus" size={18} /> {tab === 'hk' ? 'Thêm học kỳ' : 'Thêm môn học'}
            </button>
          </>
        }
      />
      <Card>
        {cur ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span className="av" style={{ background: '#E3F2E8', color: '#15803D' }}>
              <Icon name="calendar" size={18} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Học kỳ hiện tại
              </span>
              <b>{semName(cur)}</b>
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{fullDate(cur.startDate)}</span>
                <span className="muted">
                  Tuần {Math.min(week, cur.weeks)} · {pct}%
                </span>
                <span>{fullDate(cur.endDate)}</span>
              </div>
              <Bar value={pct} />
            </div>
          </div>
        ) : (
          <span className="muted">Chưa đặt học kỳ hiện tại.</span>
        )}
      </Card>
      <Card body={false}>
        <div style={{ padding: '0 12px' }}>
          <Tabs
            value={tab}
            onChange={(k) => {
              setTab(k);
              setQ('');
            }}
            items={[
              { key: 'hk', label: 'Học kỳ' },
              { key: 'mh', label: 'Môn học' },
            ]}
          />
        </div>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder={tab === 'hk' ? 'Tìm theo năm học…' : 'Tìm theo mã môn, tên môn…'} />
          {tab === 'mh' && (
            <Select label="Lọc khoa" value={fac} onChange={setFac}>
              <option value="">Mọi khoa</option>
              {cat.data.faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
        </Toolbar>
        {tab === 'hk' ? (
          <Table
            rows={semRows}
            rowKey={(s) => s.id}
            cols={[
              { h: 'Học kỳ', r: (s) => <b>{TERM[s.term]}</b> },
              { h: 'Năm học', r: (s) => s.academicYear.replace('-', '–') },
              { h: 'Bắt đầu', r: (s) => fullDate(s.startDate) },
              { h: 'Kết thúc', r: (s) => fullDate(s.endDate) },
              { h: 'Lớp học phần', align: 'right', r: (s) => (s.sections ? <Link to={`/admin/sections?semester=${s.id}`}>{s.sections} lớp</Link> : <span className="muted">0</span>) },
              { h: 'Số tuần', align: 'right', r: (s) => s.weeks },
              {
                h: 'Trạng thái',
                r: (s) => {
                  const [l, t] = semState(s);
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge tone={t} dot>
                        {l}
                      </Badge>
                      {/* "Đang diễn ra" đã đủ nghĩa; chỉ gắn "Hiện tại" khi học kỳ được đặt hiện tại nhưng ngoài thời gian diễn ra */}
                      {s.isCurrent && l !== 'Đang diễn ra' && <Badge tone="red">Hiện tại</Badge>}
                    </div>
                  );
                },
              },
              {
                h: '',
                align: 'right',
                r: (s) => (
                  <Actions>
                    {!s.isCurrent && <IconBtn icon="star" title="Đặt làm học kỳ hiện tại" onClick={() => setCurrent(s)} />}
                    <IconBtn icon="edit" title="Sửa" onClick={() => setEditS(s)} />
                    <IconBtn icon="trash" title="Xóa" onClick={() => delSem(s)} />
                  </Actions>
                ),
              },
            ]}
          />
        ) : (
          <Table
            rows={courseRows}
            rowKey={(c) => c.id}
            cols={[
              { h: 'Mã môn', r: (c) => <b className="mono">{c.code}</b> },
              { h: 'Tên môn', r: (c) => c.name },
              { h: 'Tín chỉ', align: 'right', r: (c) => c.credits },
              { h: 'Khoa', r: (c) => c.faculty?.name ?? <span className="muted">—</span> },
              {
                h: '',
                align: 'right',
                r: (c) => (
                  <Actions>
                    <IconBtn icon="edit" title="Sửa" onClick={() => setEditC(c)} />
                    <IconBtn icon="trash" title="Xóa" onClick={() => delCourse(c)} />
                  </Actions>
                ),
              },
            ]}
          />
        )}
      </Card>
      {editS && <SemesterForm s={editS === 'new' ? null : editS} onClose={() => setEditS(null)} />}
      {editC && <CourseForm c={editC === 'new' ? null : editC} cat={cat.data} onClose={() => setEditC(null)} />}
    </div>
  );
}

function SemesterForm({ s, onClose }: { s: Semester | null; onClose: () => void }) {
  const act = useAct();
  const y = new Date().getFullYear();
  const [v, setV] = useState({ academicYear: s?.academicYear ?? `${y}-${y + 1}`, term: s?.term ?? 'TERM_1', startDate: s ? iso(s.startDate) : '', endDate: s ? iso(s.endDate) : '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    const ay = v.academicYear.replace(/\s/g, '').replace('–', '-');
    if (!/^\d{4}-\d{4}$/.test(ay) || +ay.slice(5) !== +ay.slice(0, 4) + 1) e.academicYear = 'Định dạng: 2026-2027.';
    if (!v.startDate) e.startDate = 'Chọn ngày bắt đầu.';
    if (!v.endDate) e.endDate = 'Chọn ngày kết thúc.';
    else if (v.endDate <= v.startDate) e.endDate = 'Phải sau ngày bắt đầu.';
    setErr(e);
    if (Object.keys(e).length) return;
    const body = { ...v, academicYear: ay };
    const ok = await act
      .mutateAsync(s ? { method: 'put', path: `semesters/${s.id}`, body, ok: 'Đã lưu học kỳ.' } : { method: 'post', path: 'semesters', body, ok: 'Đã thêm học kỳ.' })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title={s ? 'Sửa học kỳ' : 'Thêm học kỳ'}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {s ? 'Lưu' : 'Thêm'}
          </button>
        </>
      }
    >
      <Grid2>
        <Field label="Năm học *" error={err.academicYear}>
          <input className="inp" value={v.academicYear} onChange={(e) => setV({ ...v, academicYear: e.target.value })} placeholder="VD: 2026-2027" />
        </Field>
        <Field label="Học kỳ *">
          <select className="inp" value={v.term} onChange={(e) => setV({ ...v, term: e.target.value as Semester['term'] })}>
            <option value="TERM_1">Học kỳ 1</option>
            <option value="TERM_2">Học kỳ 2</option>
            <option value="SUMMER">Học kỳ hè</option>
          </select>
        </Field>
        <Field label="Ngày bắt đầu *" error={err.startDate}>
          <DateInput value={v.startDate} onChange={(x) => setV({ ...v, startDate: x })} />
        </Field>
        <Field label="Ngày kết thúc *" error={err.endDate}>
          <DateInput value={v.endDate} onChange={(x) => setV({ ...v, endDate: x })} />
        </Field>
        <Full>
          <div className="help">Hạn nộp bài tập của giảng viên phải nằm trong thời gian học kỳ.</div>
        </Full>
      </Grid2>
    </FormModal>
  );
}

function CourseForm({ c, cat, onClose }: { c: Course | null; cat: Catalog; onClose: () => void }) {
  const act = useAct();
  const [v, setV] = useState({
    code: c?.code ?? '',
    name: c?.name ?? '',
    credits: String(c?.credits ?? 3),
    facultyId: c?.faculty?.id ?? cat.faculties[0]?.id ?? '',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    if (!v.code.trim()) e.code = 'Bắt buộc.';
    if (!v.name.trim()) e.name = 'Bắt buộc.';
    if (!(+v.credits >= 1 && +v.credits <= 10)) e.credits = '1–10 tín chỉ.';
    setErr(e);
    if (Object.keys(e).length) return;
    const body = { code: v.code.trim(), name: v.name.trim(), credits: +v.credits, facultyId: v.facultyId || null };
    const ok = await act
      .mutateAsync(c ? { method: 'put', path: `courses/${c.id}`, body, ok: 'Đã lưu môn học.' } : { method: 'post', path: 'courses', body, ok: 'Đã thêm môn học.' })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title={c ? 'Sửa môn học' : 'Thêm môn học'}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {c ? 'Lưu' : 'Thêm'}
          </button>
        </>
      }
    >
      <Grid2>
        <Field label="Mã môn *" error={err.code}>
          <input className="inp mono" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="VD: INT3306" />
        </Field>
        <Field label="Số tín chỉ *" error={err.credits}>
          <input className="inp" type="number" min={1} max={10} value={v.credits} onChange={(e) => setV({ ...v, credits: e.target.value })} />
        </Field>
        <Full>
          <Field label="Tên môn *" error={err.name}>
            <input className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
        </Full>
        <Full>
          <Field label="Khoa phụ trách">
            <select className="inp" value={v.facultyId} onChange={(e) => setV({ ...v, facultyId: e.target.value })}>
              {cat.faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
        </Full>
      </Grid2>
    </FormModal>
  );
}
