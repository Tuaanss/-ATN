import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Field, KV, Loading, Note, PageHead } from '../../components/ui';
import { fullDate, fullDT } from '../../utils/format';
import { Actions, CellUser, FormModal, Full, Grid2, IconBtn, SearchBox, Select, StatusBadge, Table, Tiles, Toolbar, norm, useAct, useAdmin, useConfirm } from './kit';

export interface Catalog {
  faculties: { id: string; code: string; name: string; majors: number; lecturers: number; courses: number }[];
  majors: { id: string; code: string; name: string; faculty: { id: string; code: string; name: string }; classes: number; students: number }[];
  cohorts: { id: string; name: string; startYear: number; classes: number; students: number }[];
  classes: { id: string; code: string; major: { id: string; name: string }; cohort: { id: string; name: string }; students: number }[];
  courseTypes: { code: string; courses: number }[];
}
interface Lecturer {
  id: string;
  userId: string;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  faculty: { id: string; code: string; name: string } | null;
  drive: { email: string | null; status: string } | null;
  sections: number;
  status: string;
  lastLoginAt: string | null;
}
interface Student {
  id: string;
  userId: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  email: string | null;
  phone: string | null;
  cohort: string | null;
  major: string | null;
  adminClass: { id: string; code: string } | null;
  profileCompleted: boolean;
  parents: { relation: Rel; phone: string }[];
  status: string;
  lastLoginAt: string | null;
}
interface Parent {
  id: string;
  userId: string;
  phone: string;
  fullName: string | null;
  links: { relation: Rel; studentId: string; studentCode: string; fullName: string; adminClass: string | null }[];
  status: string;
  createdAt: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}
type Rel = 'FATHER' | 'MOTHER' | 'GUARDIAN';
const REL: Record<Rel, string> = { FATHER: 'Bố', MOTHER: 'Mẹ', GUARDIAN: 'Giám hộ' };

/** Đặt lại mật khẩu / khóa – dùng chung cho GV, SV, PH. */
function useAccountActions() {
  const act = useAct();
  const confirm = useConfirm();
  const reset = async (userId: string, who: string, msg: string) => {
    if (!(await confirm({ title: 'Đặt lại mật khẩu', msg: <>Đặt lại mật khẩu cho <b>{who}</b>? {msg}</>, ok: 'Đặt lại' }))) return;
    const r = (await act.mutateAsync({ method: 'post', path: `users/${userId}/reset-password` }).catch(() => null)) as { hint: string; tempPassword: string | null } | null;
    if (!r) return;
    await confirm({ title: 'Đã đặt lại mật khẩu', msg: <>{r.hint}.{r.tempPassword && <> Mật khẩu tạm: <b className="mono">{r.tempPassword}</b></>}</>, ok: 'Đóng' });
  };
  const lock = async (userId: string, who: string, locked: boolean, extra: string) => {
    const r = await confirm({
      title: locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
      msg: locked ? <>Mở khóa tài khoản <b>{who}</b>?</> : <>Khóa tài khoản <b>{who}</b>? {extra}</>,
      ok: locked ? 'Mở khóa' : 'Khóa',
      danger: !locked,
      reason: locked ? undefined : 'Lý do khóa',
    });
    if (!r) return;
    await act.mutateAsync({ method: 'post', path: `users/${userId}/status`, body: { lock: !locked, reason: r === 'ok' ? undefined : r }, ok: locked ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.' }).catch(() => undefined);
  };
  return { reset, lock };
}

// ================================================================ giảng viên

export function LecturersPage() {
  useCrumbs([{ label: 'Tài khoản giảng viên' }]);
  const list = useAdmin<Lecturer[]>('/lecturers');
  const cat = useAdmin<Catalog>('/catalog');
  const [q, setQ] = useState('');
  const [fac, setFac] = useState('');
  const [st, setSt] = useState('');
  // ?drive=issue: mở từ Tổng quan – GV chưa liên kết hoặc lỗi kết nối Drive
  const [params] = useSearchParams();
  const [dr, setDr] = useState(params.get('drive') ?? '');
  const [edit, setEdit] = useState<Lecturer | null | 'new'>(null);
  const acc = useAccountActions();
  if (!list.data || !cat.data) return <Loading />;
  const all = list.data;
  const driveOf = (g: Lecturer) => (!g.drive ? 'NONE' : g.drive.status === 'OK' ? 'OK' : 'ERR');
  const rows = all.filter(
    (g) => (!q || norm(`${g.code} ${g.fullName} ${g.email}`).includes(norm(q))) && (!fac || g.faculty?.id === fac) && (!st || g.status === st) && (!dr || (dr === 'issue' ? driveOf(g) !== 'OK' : driveOf(g) === dr)),
  );
  return (
    <div className="page">
      <PageHead
        title="Tài khoản giảng viên"
        actions={
          <>
            <Link className="btn" to="/admin/import/lecturers">
              <Icon name="sheet" size={18} /> Import từ Excel
            </Link>
            <button className="btn btn-p" onClick={() => setEdit('new')}>
              <Icon name="plus" size={18} /> Thêm giảng viên
            </button>
          </>
        }
      />
      <Tiles
        items={[
          ['Tổng giảng viên', all.length, 'users'],
          ['Đang hoạt động', all.filter((g) => g.status === 'ACTIVE').length, 'check'],
          ['Đã khóa', all.filter((g) => g.status === 'LOCKED').length, 'lock'],
          ['Đã liên kết Google Drive', all.filter((g) => g.drive?.status === 'OK').length, 'folder'],
        ]}
      />
      <Card body={false}>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Tìm theo mã GV, họ tên, email…" />
          <Select label="Lọc theo khoa" value={fac} onChange={setFac}>
            <option value="">Tất cả khoa</option>
            {cat.data.faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select label="Lọc theo trạng thái" value={st} onChange={setSt}>
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </Select>
          <Select label="Lọc theo Google Drive" value={dr} onChange={setDr}>
            <option value="">Mọi trạng thái Drive</option>
            <option value="OK">Đã liên kết</option>
            <option value="NONE">Chưa liên kết</option>
            <option value="ERR">Lỗi kết nối</option>
            <option value="issue">Cần chú ý (chưa liên kết / lỗi)</option>
          </Select>
        </Toolbar>
        <Table
          rows={rows}
          rowKey={(g) => g.id}
          cols={[
            { h: 'Giảng viên', r: (g) => <CellUser name={g.fullName} code={g.code} /> },
            { h: 'Khoa', r: (g) => g.faculty?.name ?? <span className="muted">—</span> },
            {
              h: 'Liên hệ',
              r: (g) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{g.email}</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>
                    {g.phone ?? ''}
                  </span>
                </div>
              ),
            },
            {
              h: 'Google Drive',
              r: (g) =>
                !g.drive ? (
                  <span className="muted" style={{ fontSize: 13 }}>
                    Chưa liên kết
                  </span>
                ) : g.drive.status === 'OK' ? (
                  <Badge tone="green">Đã liên kết</Badge>
                ) : (
                  <Badge tone="amber">{g.drive.status === 'EXPIRED' ? 'Hết hạn kết nối' : 'Lỗi quyền'}</Badge>
                ),
            },
            { h: 'Trạng thái', r: (g) => <StatusBadge s={g.status} /> },
            {
              h: '',
              align: 'right',
              r: (g) => (
                <Actions>
                  <IconBtn icon="edit" title="Sửa" onClick={() => setEdit(g)} />
                  <IconBtn icon="key" title="Đặt lại mật khẩu" onClick={() => acc.reset(g.userId, `${g.fullName} (${g.code})`, `Mật khẩu tạm thời sẽ được gửi tới ${g.email} và giảng viên phải đổi ở lần đăng nhập tiếp theo.`)} />
                  <IconBtn icon={g.status === 'LOCKED' ? 'unlock' : 'lock'} title={g.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'} onClick={() => acc.lock(g.userId, g.fullName, g.status === 'LOCKED', 'Giảng viên sẽ không đăng nhập được; bài tập, điểm đã nhập vẫn được giữ.')} />
                </Actions>
              ),
            },
          ]}
        />
      </Card>
      {edit && <LecturerForm g={edit === 'new' ? null : edit} cat={cat.data} onClose={() => setEdit(null)} />}
    </div>
  );
}

function LecturerForm({ g, cat, onClose }: { g: Lecturer | null; cat: Catalog; onClose: () => void }) {
  const act = useAct();
  const confirm = useConfirm();
  const [v, setV] = useState({ code: g?.code ?? '', fullName: g?.fullName ?? '', email: g?.email ?? '', phone: g?.phone ?? '', facultyId: g?.faculty?.id ?? cat.faculties[0]?.id ?? '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!v.code.trim()) e.code = 'Bắt buộc nhập mã GV.';
    if (!v.fullName.trim()) e.fullName = 'Bắt buộc nhập họ tên.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Email không hợp lệ.';
    if (v.phone && !/^(03|05|07|08|09)\d{8}$/.test(v.phone)) e.phone = 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09.';
    setErr(e);
    if (Object.keys(e).length) return;
    const body = { ...v, phone: v.phone || undefined, facultyId: v.facultyId || null };
    const r = (await act.mutateAsync(g ? { method: 'put', path: `lecturers/${g.id}`, body, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: 'lecturers', body }).catch(() => null)) as { tempPassword?: string } | null;
    if (!r) return;
    onClose();
    if (!g) await confirm({ title: `Đã tạo tài khoản ${v.code.toUpperCase()}`, msg: <>Mật khẩu tạm đã gửi tới {v.email}: <b className="mono">{r.tempPassword}</b></>, ok: 'Đóng' });
  };
  return (
    <FormModal
      title={g ? 'Sửa thông tin giảng viên' : 'Thêm giảng viên'}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {g ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <Grid2>
        <Field label="Mã giảng viên *" help="Dùng làm tên đăng nhập." error={err.code}>
          <input className="inp mono" value={v.code} onChange={set('code')} readOnly={!!g} placeholder="VD: GV0100" />
        </Field>
        <Field label="Khoa *">
          <select className="inp" value={v.facultyId} onChange={set('facultyId')}>
            {cat.faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Full>
          <Field label="Họ tên (kèm học hàm, học vị) *" error={err.fullName}>
            <input className="inp" value={v.fullName} onChange={set('fullName')} placeholder="VD: TS. Nguyễn Văn A" />
          </Field>
        </Full>
        <Field label="Email *" error={err.email}>
          <input className="inp" type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Số điện thoại" error={err.phone}>
          <input className="inp mono" value={v.phone} onChange={set('phone')} />
        </Field>
        {!g && (
          <Full>
            <Note tone="blue" icon="info">
              Hệ thống sinh mật khẩu tạm thời và gửi tới email giảng viên. Giảng viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.
            </Note>
          </Full>
        )}
      </Grid2>
    </FormModal>
  );
}

// ================================================================ sinh viên

export function StudentsPage() {
  useCrumbs([{ label: 'Tài khoản sinh viên' }]);
  const [params] = useSearchParams();
  const list = useAdmin<Student[]>('/students');
  const cat = useAdmin<Catalog>('/catalog');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [f, setF] = useState({ cohort: '', major: '', cls: '', profile: '', status: '' });
  const [edit, setEdit] = useState<Student | null | 'new'>(null);
  const [view, setView] = useState<Student | null>(null);
  const acc = useAccountActions();
  if (!list.data || !cat.data) return <Loading />;
  const all = list.data;
  const c = cat.data;
  const clsOf = (s: Student) => c.classes.find((x) => x.id === s.adminClass?.id);
  const rows = all.filter((s) => {
    const k = clsOf(s);
    return (
      (!q || norm(`${s.studentCode} ${s.fullName} ${s.email ?? ''}`).includes(norm(q))) &&
      (!f.cohort || k?.cohort.id === f.cohort) &&
      (!f.major || k?.major.id === f.major) &&
      (!f.cls || s.adminClass?.id === f.cls) &&
      (!f.profile || String(+s.profileCompleted) === f.profile) &&
      (!f.status || s.status === f.status)
    );
  });
  const setFilter = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <div className="page">
      <PageHead
        title="Tài khoản sinh viên"
        actions={
          <>
            <Link className="btn" to="/admin/students/import">
              <Icon name="sheet" size={18} /> Import từ Excel
            </Link>
            <button className="btn btn-p" onClick={() => setEdit('new')}>
              <Icon name="plus" size={18} /> Thêm sinh viên
            </button>
          </>
        }
      />
      <Tiles
        items={[
          ['Tổng sinh viên', all.length, 'cap'],
          ['Đã hoàn thiện hồ sơ', all.filter((s) => s.profileCompleted).length, 'check'],
          ['Chưa khai báo hồ sơ', all.filter((s) => !s.profileCompleted).length, 'warn'],
          ['Đã khóa', all.filter((s) => s.status === 'LOCKED').length, 'lock'],
        ]}
      />
      <Card body={false}>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Tìm theo MSSV, họ tên, email…" />
          <Select label="Lọc theo khóa" value={f.cohort} onChange={setFilter('cohort')} style={{ minWidth: 120 }}>
            <option value="">Tất cả khóa</option>
            {c.cohorts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <Select label="Lọc theo ngành" value={f.major} onChange={setFilter('major')}>
            <option value="">Tất cả ngành</option>
            {c.majors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <Select label="Lọc theo lớp" value={f.cls} onChange={setFilter('cls')} style={{ minWidth: 130 }}>
            <option value="">Tất cả lớp</option>
            {c.classes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code}
              </option>
            ))}
          </Select>
          <Select label="Lọc theo hồ sơ" value={f.profile} onChange={setFilter('profile')}>
            <option value="">Hồ sơ: tất cả</option>
            <option value="1">Đã hoàn thiện</option>
            <option value="0">Chưa hoàn thiện</option>
          </Select>
          <Select label="Lọc theo trạng thái" value={f.status} onChange={setFilter('status')}>
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </Select>
        </Toolbar>
        <Table
          rows={rows}
          rowKey={(s) => s.id}
          cols={[
            { h: 'Sinh viên', r: (s) => <CellUser name={s.fullName} code={s.studentCode} /> },
            {
              h: 'Lớp · Ngành',
              r: (s) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="mono" style={{ fontSize: 13 }}>
                    {s.adminClass?.code ?? '—'}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {s.major ?? ''}
                    {s.cohort ? ` · ${s.cohort}` : ''}
                  </span>
                </div>
              ),
            },
            { h: 'Hồ sơ', r: (s) => (s.profileCompleted ? <Badge tone="green">Đã hoàn thiện</Badge> : <Badge tone="amber">Chưa khai báo</Badge>) },
            { h: 'Phụ huynh', r: (s) => (s.parents.length ? `${s.parents.length} tài khoản` : <span className="muted">—</span>) },
            { h: 'Trạng thái', r: (s) => <StatusBadge s={s.status} /> },
            {
              h: '',
              align: 'right',
              r: (s) => (
                <Actions>
                  <IconBtn icon="eye" title="Xem hồ sơ" onClick={() => setView(s)} />
                  <IconBtn icon="edit" title="Sửa" onClick={() => setEdit(s)} />
                  <IconBtn icon="key" title="Đặt lại mật khẩu" onClick={() => acc.reset(s.userId, `${s.fullName} (${s.studentCode})`, 'Mật khẩu sẽ về ngày sinh dạng ddmmyyyy, sinh viên phải đổi ở lần đăng nhập tiếp theo.')} />
                  <IconBtn icon={s.status === 'LOCKED' ? 'unlock' : 'lock'} title={s.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'} onClick={() => acc.lock(s.userId, s.fullName, s.status === 'LOCKED', 'Sinh viên sẽ không đăng nhập được; bài nộp và điểm vẫn được giữ.')} />
                </Actions>
              ),
            },
          ]}
        />
      </Card>
      {edit && <StudentForm s={edit === 'new' ? null : edit} cat={c} onClose={() => setEdit(null)} />}
      {view && (
        <FormModal
          title="Hồ sơ sinh viên"
          onClose={() => setView(null)}
          foot={
            <>
              <button className="btn" onClick={() => setView(null)}>
                Đóng
              </button>
              <button
                className="btn btn-p"
                onClick={() => {
                  setEdit(view);
                  setView(null);
                }}
              >
                <Icon name="edit" size={16} /> Sửa
              </button>
            </>
          }
        >
          <CellUser name={view.fullName} code={view.studentCode} />
          <KV
            rows={[
              ['Ngày sinh', fullDate(view.dateOfBirth)],
              ['Lớp sinh hoạt', <span className="mono">{view.adminClass?.code ?? '—'}</span>],
              ['Ngành', view.major ?? '—'],
              ['Khóa', view.cohort ?? '—'],
              ['SĐT', view.phone ? <span className="mono">{view.phone}</span> : <span className="muted">Chưa khai báo</span>],
              ['Email', view.email ?? <span className="muted">Chưa khai báo</span>],
              ['Hồ sơ', view.profileCompleted ? <Badge tone="green">Đã hoàn thiện</Badge> : <Badge tone="amber">Chưa khai báo</Badge>],
              ['Trạng thái', <StatusBadge s={view.status} />],
              ['Đăng nhập gần nhất', view.lastLoginAt ? fullDT(view.lastLoginAt) : '—'],
            ]}
          />
          <h3 style={{ fontSize: 15 }}>Tài khoản phụ huynh liên kết</h3>
          {view.parents.length ? (
            view.parents.map((p) => (
              <div key={p.relation} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid #E3E1D9', borderRadius: 10 }}>
                <CellUser name={<span className="mono">{p.phone}</span>} code={REL[p.relation]} icon="phone" />
              </div>
            ))
          ) : (
            <Note tone="amber" icon="warn">
              Sinh viên chưa khai báo SĐT phụ huynh nên chưa có tài khoản phụ huynh.
            </Note>
          )}
          <Link className="btn btn-sm" to={`/admin/parents?q=${view.studentCode}`} style={{ alignSelf: 'flex-start' }}>
            <Icon name="user" size={15} /> Quản lý tài khoản phụ huynh
          </Link>
        </FormModal>
      )}
    </div>
  );
}

function StudentForm({ s, cat, onClose }: { s: Student | null; cat: Catalog; onClose: () => void }) {
  const act = useAct();
  const [v, setV] = useState({ studentCode: s?.studentCode ?? '', fullName: s?.fullName ?? '', dateOfBirth: s ? fullDate(s.dateOfBirth) : '', adminClassId: s?.adminClass?.id ?? cat.classes[0]?.id ?? '', email: s?.email ?? '', phone: s?.phone ?? '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!v.studentCode.trim()) e.studentCode = 'Bắt buộc nhập MSSV.';
    if (!v.fullName.trim()) e.fullName = 'Bắt buộc nhập họ tên.';
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v.dateOfBirth.trim())) e.dateOfBirth = 'Định dạng dd/mm/yyyy.';
    if (!v.adminClassId) e.adminClassId = 'Chọn lớp sinh hoạt.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Email không hợp lệ.';
    if (v.phone && !/^(03|05|07|08|09)\d{8}$/.test(v.phone)) e.phone = 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09.';
    setErr(e);
    if (Object.keys(e).length) return;
    const body = { ...v, email: v.email || undefined, phone: v.phone || undefined };
    const ok = await act
      .mutateAsync(s ? { method: 'put', path: `students/${s.id}`, body, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: 'students', body, ok: `Đã tạo tài khoản ${v.studentCode.toUpperCase()}, mật khẩu ban đầu là ngày sinh (ddmmyyyy).` })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title={s ? 'Sửa thông tin sinh viên' : 'Thêm sinh viên'}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {s ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <Grid2>
        <Field label="MSSV *" help="Dùng làm tên đăng nhập." error={err.studentCode}>
          <input className="inp mono" value={v.studentCode} onChange={set('studentCode')} readOnly={!!s} />
        </Field>
        <Field label="Ngày sinh *" error={err.dateOfBirth}>
          <input className="inp" value={v.dateOfBirth} onChange={set('dateOfBirth')} placeholder="dd/mm/yyyy" />
        </Field>
        <Full>
          <Field label="Họ tên *" error={err.fullName}>
            <input className="inp" value={v.fullName} onChange={set('fullName')} />
          </Field>
        </Full>
        <Full>
          <Field label="Lớp sinh hoạt *" help="Ngành và khóa được lấy theo lớp sinh hoạt." error={err.adminClassId}>
            <select className="inp" value={v.adminClassId} onChange={set('adminClassId')}>
              {cat.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.major.name} · {c.cohort.name}
                </option>
              ))}
            </select>
          </Field>
        </Full>
        {s ? (
          <>
            <Field label="SĐT" error={err.phone}>
              <input className="inp mono" value={v.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email" error={err.email}>
              <input className="inp" value={v.email} onChange={set('email')} />
            </Field>
          </>
        ) : (
          <Full>
            <Note tone="blue" icon="info">
              Mật khẩu ban đầu là ngày sinh (ddmmyyyy). Ở lần đăng nhập đầu, sinh viên phải đổi mật khẩu và khai báo hồ sơ (SĐT, email, SĐT phụ huynh).
            </Note>
          </Full>
        )}
      </Grid2>
    </FormModal>
  );
}

// ================================================================ phụ huynh

export function ParentsPage() {
  useCrumbs([{ label: 'Tài khoản phụ huynh' }]);
  const [params] = useSearchParams();
  const list = useAdmin<Parent[]>('/parents');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [st, setSt] = useState('');
  const [nc, setNc] = useState('');
  const [view, setView] = useState<Parent | null>(null);
  const [phone, setPhone] = useState(false);
  const acc = useAccountActions();
  if (!list.data) return <Loading />;
  const all = list.data;
  const rows = all.filter(
    (p) =>
      (!q || norm(`${p.phone} ${p.fullName ?? ''} ${p.links.map((l) => `${l.fullName} ${l.studentCode}`).join(' ')}`).includes(norm(q))) &&
      (!st || p.status === st) &&
      (!nc || (nc === '1' ? p.links.length === 1 : p.links.length >= 2)),
  );
  return (
    <div className="page">
      <PageHead
        title="Tài khoản phụ huynh"
        actions={
          <button className="btn" onClick={() => setPhone(true)}>
            <Icon name="swap" size={18} /> Xử lý đổi SĐT phụ huynh
          </button>
        }
      />
      <Tiles
        items={[
          ['Tổng tài khoản', all.length, 'user'],
          ['Đã kích hoạt', all.filter((p) => p.status === 'ACTIVE').length, 'check'],
          ['Chưa đăng nhập lần đầu', all.filter((p) => p.status === 'FIRST_LOGIN').length, 'clock'],
          ['Liên kết từ 2 con', all.filter((p) => p.links.length > 1).length, 'users'],
        ]}
      />
      <Card body={false}>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Tìm theo SĐT, tên/MSSV của con…" />
          <Select label="Lọc theo trạng thái" value={st} onChange={setSt}>
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="FIRST_LOGIN">Chưa đăng nhập lần đầu</option>
            <option value="LOCKED">Đã khóa</option>
            <option value="DISABLED">Vô hiệu (không còn con)</option>
          </Select>
          <Select label="Lọc theo số con" value={nc} onChange={setNc}>
            <option value="">Số con: tất cả</option>
            <option value="1">1 con</option>
            <option value="2">Từ 2 con</option>
          </Select>
        </Toolbar>
        <Table
          rows={rows}
          rowKey={(p) => p.id}
          empty="Chưa có tài khoản phụ huynh. Tài khoản được tạo khi sinh viên khai báo SĐT bố / mẹ / người giám hộ."
          cols={[
            { h: 'Tài khoản (SĐT)', r: (p) => <CellUser name={<span className="mono">{p.phone}</span>} code={p.fullName ?? 'Chưa cập nhật tên'} icon="phone" /> },
            {
              h: 'Con liên kết',
              r: (p) =>
                p.links.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.links.map((l) => (
                      <span key={l.studentId + l.relation} className="chip" title={l.fullName}>
                        {l.fullName}{' '}
                        <span className="muted mono" style={{ fontSize: 11 }}>
                          {l.studentCode}
                        </span>
                        <Badge tone="gray">{REL[l.relation]}</Badge>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    Không còn liên kết
                  </span>
                ),
            },
            { h: 'Đăng nhập gần nhất', r: (p) => (p.lastLoginAt ? <span style={{ fontSize: 13 }}>{fullDT(p.lastLoginAt)}</span> : <span className="muted" style={{ fontSize: 13 }}>Chưa đăng nhập</span>) },
            { h: 'Trạng thái', r: (p) => <StatusBadge s={p.status} /> },
            {
              h: '',
              align: 'right',
              r: (p) => (
                <Actions>
                  <IconBtn icon="eye" title="Chi tiết" onClick={() => setView(p)} />
                  <IconBtn icon="key" title="Đặt lại mật khẩu" disabled={p.status === 'DISABLED'} onClick={() => acc.reset(p.userId, p.phone, 'Mật khẩu sẽ về chính số điện thoại, phụ huynh phải đổi ở lần đăng nhập tiếp theo.')} />
                  <IconBtn icon={p.status === 'LOCKED' ? 'unlock' : 'lock'} title={p.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'} disabled={p.status === 'DISABLED'} onClick={() => acc.lock(p.userId, p.phone, p.status === 'LOCKED', 'Phụ huynh sẽ không đăng nhập được.')} />
                </Actions>
              ),
            },
          ]}
        />
      </Card>
      {view && (
        <FormModal title="Chi tiết tài khoản phụ huynh" onClose={() => setView(null)} foot={<button className="btn" onClick={() => setView(null)}>Đóng</button>}>
          <KV
            rows={[
              ['Tên đăng nhập', <span className="mono">{view.phone}</span>],
              ['Họ tên', view.fullName ?? <span className="muted">Chưa cập nhật</span>],
              ['Ngày tạo', <>{fullDate(view.createdAt)} <span className="muted" style={{ fontSize: 12 }}>(tự động từ hồ sơ SV)</span></>],
              ['Đổi MK lần đầu', view.mustChangePassword ? <Badge tone="amber">Chưa đổi</Badge> : <Badge tone="green">Đã đổi</Badge>],
              ['Đăng nhập gần nhất', view.lastLoginAt ? fullDT(view.lastLoginAt) : '—'],
              ['Trạng thái', <StatusBadge s={view.status} />],
            ]}
          />
          <h3 style={{ fontSize: 15 }}>Sinh viên liên kết ({view.links.length})</h3>
          {view.links.length ? (
            view.links.map((l) => (
              <div key={l.studentId + l.relation} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid #E3E1D9', borderRadius: 10 }}>
                <CellUser name={l.fullName} code={`${l.studentCode}${l.adminClass ? ` · ${l.adminClass}` : ''}`} />
                <Badge tone="blue">{REL[l.relation]}</Badge>
              </div>
            ))
          ) : (
            <p className="muted">Không còn sinh viên nào liên kết — tài khoản đã bị vô hiệu hóa.</p>
          )}
          <Note tone="blue" icon="shield">
            Phụ huynh chỉ được <b>xem</b> điểm và bài nộp của các con đã liên kết; không sửa, tải hay bình luận.
          </Note>
        </FormModal>
      )}
      {phone && <PhoneChange parents={all} onClose={() => setPhone(false)} />}
    </div>
  );
}

function PhoneChange({ parents, onClose }: { parents: Parent[]; onClose: () => void }) {
  const act = useAct();
  const students = useAdmin<Student[]>('/students');
  const [sv, setSv] = useState('');
  const [rel, setRel] = useState<Rel | ''>('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const s = students.data?.find((x) => x.studentCode.toUpperCase() === sv.trim().toUpperCase());
  const links = s ? s.parents : [];
  const r = (rel || links[0]?.relation || '') as Rel | '';
  const old = links.find((l) => l.relation === r);
  const target = parents.find((p) => p.phone === phone);
  const oldAcc = old && parents.find((p) => p.phone === old.phone);
  const err = phone && !/^(03|05|07|08|09)\d{8}$/.test(phone) ? 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09.' : phone && s && phone === s.phone ? 'SĐT phụ huynh không được trùng SĐT của sinh viên.' : phone && old?.phone === phone ? 'SĐT mới giống SĐT hiện tại.' : '';
  const ready = !!s && !!r && !!phone && !err;
  const run = async () => {
    const ok = await act
      .mutateAsync({ method: 'post', path: 'parents/change-phone', body: { studentId: s!.id, relation: r, phone, note: note || undefined }, ok: 'Đã đổi SĐT phụ huynh.' })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  return (
    <FormModal
      title="Xử lý đổi SĐT phụ huynh"
      width={640}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={!ready || act.isPending} onClick={run}>
            Thực hiện
          </button>
        </>
      }
    >
      <Note tone="blue" icon="info">
        Dùng khi phụ huynh đổi số điện thoại hoặc sinh viên khai báo nhầm. Hệ thống gỡ liên kết khỏi tài khoản cũ (vô hiệu hóa nếu không còn con nào), rồi tạo mới hoặc liên kết vào tài khoản của SĐT mới. Thao tác được ghi nhật ký.
      </Note>
      <Grid2>
        <Full>
          <Field label="Sinh viên *" help={sv && !s ? 'Không tìm thấy MSSV này.' : s ? s.fullName : undefined}>
            <input className="inp" list="dl-sv" value={sv} onChange={(e) => setSv(e.target.value)} placeholder="Nhập MSSV…" />
            <datalist id="dl-sv">
              {students.data?.map((x) => (
                <option key={x.id} value={x.studentCode}>
                  {x.fullName}
                </option>
              ))}
            </datalist>
          </Field>
        </Full>
        {s && (
          <Full>
            <label className="lbl">SĐT cần thay của {s.fullName}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['FATHER', 'MOTHER', 'GUARDIAN'] as Rel[]).map((k) => {
                const l = links.find((x) => x.relation === k);
                const acc = l && parents.find((p) => p.phone === l.phone);
                return (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E3E1D9', borderRadius: 10, cursor: 'pointer' }}>
                    <input type="radio" name="rel" checked={r === k} onChange={() => setRel(k)} />
                    <b>{REL[k]}</b>
                    {l ? <span className="mono">{l.phone}</span> : <span className="muted">chưa khai báo</span>}
                    {acc && (
                      <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                        {acc.links.length} con liên kết
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </Full>
        )}
        <Field label="SĐT mới *" error={err}>
          <input className="inp mono" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[\s.-]/g, ''))} placeholder="0xxxxxxxxx" />
        </Field>
        <Field label="Ghi chú / căn cứ">
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Yêu cầu của SV ngày 03/10" />
        </Field>
        {ready && (
          <Full>
            <Note tone="gray" icon="list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {old && (
                  <span>
                    Gỡ liên kết {REL[r as Rel].toLowerCase()} khỏi <b className="mono">{old.phone}</b>
                    {oldAcc && oldAcc.links.length <= 1 ? ' — tài khoản này sẽ bị vô hiệu hóa vì không còn con nào.' : '.'}
                  </span>
                )}
                <span>{target ? <>Liên kết vào tài khoản đã có <b className="mono">{phone}</b> ({target.links.length} con).</> : <>Tạo tài khoản mới <b className="mono">{phone}</b> (mật khẩu ban đầu = SĐT, bắt buộc đổi).</>}</span>
              </div>
            </Note>
          </Full>
        )}
      </Grid2>
    </FormModal>
  );
}
