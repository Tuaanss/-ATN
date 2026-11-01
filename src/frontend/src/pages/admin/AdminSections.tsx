import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Bar, Card, Empty, Field, KV, Loading, Note, PageHead, Seg } from '../../components/ui';
import { Actions, FormModal, Grid2, Full, IconBtn, SearchBox, Select, Table, Tiles, Toolbar, norm, useAct, useAdmin, useConfirm } from './kit';
import { semName, type Course } from './AdminAcademic';

interface Session {
  day: number;
  from: number;
  to: number;
  room: string;
}
interface Section {
  id: string;
  code: string;
  course: { id: string; code: string; name: string; credits: number };
  lecturer: { id: string; code: string; fullName: string };
  maxStudents: number;
  students: number;
  assignments: number;
  weekStart: number;
  weekEnd: number;
  sessions: Session[];
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
  maxStudents: number;
  students: { id: string; studentCode: string; fullName: string; adminClass: string | null; cohort: string | null; major: string | null }[];
}

const THU: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'Chủ nhật' };
const THU_S: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };
const GIO = ['07:00', '07:55', '08:50', '09:45', '10:40', '13:00', '13:55', '14:50', '15:45', '16:40', '17:40', '18:35'];
const het = (t: number) => {
  const [h, m] = GIO[t - 1].split(':').map(Number);
  const x = h * 60 + m + 50;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
const TINTS = [
  ['#FDECEC', '#DB0000'],
  ['#E6EFFD', '#2563EB'],
  ['#E3F2E8', '#15803D'],
  ['#FDF0DE', '#B45309'],
  ['#EFE9FD', '#7C3AED'],
  ['#E0F4F4', '#0F766E'],
  ['#FCE7F3', '#BE185D'],
  ['#EEEDE7', '#474B53'],
];

/** Lớp học phần – mẫu admin/lop-hoc-phan (UC02.9, UC02.10). */
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
  const [view, setView] = useState<'list' | 'tkb'>('list');
  const [form, setForm] = useState<{ s: Section | null; copy?: Section } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  if (!sems.data || !list.data || !courses.data || !lecs.data) return <Loading />;
  const all = list.data.sections;
  const rows = all.filter(
    (s) => (!course || s.course.id === course) && (!lec || s.lecturer.id === lec) && (!q || norm(`${s.code} ${s.course.name} ${s.sessions.map((x) => x.room).join(' ')}`).includes(norm(q))),
  );
  const tint = (courseId: string) => TINTS[Math.max(0, courses.data!.findIndex((c) => c.id === courseId)) % TINTS.length];
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
            <Link className="btn" to="/admin/import/sections">
              <Icon name="sheet" size={18} /> Import từ Excel
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
          ['Lớp đã đủ sĩ số', all.filter((s) => s.students >= s.maxStudents).length, 'check'],
        ]}
      />
      <Card body={false}>
        <Toolbar>
          <Select label="Học kỳ" value={semId} onChange={(v) => setParams({ semester: v })}>
            {sems.data.map((s) => (
              <option key={s.id} value={s.id}>
                {semName(s)}
                {s.isCurrent ? ' (hiện tại)' : ''}
              </option>
            ))}
          </Select>
          <SearchBox value={q} onChange={setQ} placeholder="Mã lớp, tên môn, phòng…" />
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
          <div style={{ marginLeft: 'auto' }}>
            <Seg
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'Danh sách' },
                { value: 'tkb', label: 'Thời khóa biểu' },
              ]}
            />
          </div>
        </Toolbar>
        {view === 'list' ? (
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
              {
                h: 'Lịch học',
                r: (s) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {s.sessions.map((x, i) => (
                        <span key={i} className="chip" style={{ height: 24 }}>
                          <b>{THU_S[x.day]}</b> Tiết {x.from}–{x.to}
                          {x.room && <span className="muted">· {x.room}</span>}
                        </span>
                      ))}
                      {!s.sessions.length && <span className="muted">Chưa xếp lịch</span>}
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Tuần {s.weekStart}–{s.weekEnd}
                    </span>
                  </div>
                ),
              },
              {
                h: 'Sĩ số',
                r: (s) => {
                  const p = Math.min(100, Math.round((s.students / s.maxStudents) * 100));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 90 }}>
                      <span style={{ fontSize: 13 }}>
                        <b>{s.students}</b>/{s.maxStudents}
                      </span>
                      <Bar value={p} color={p >= 100 ? '#B45309' : undefined} />
                    </div>
                  );
                },
              },
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
        ) : rows.length ? (
          <Timetable rows={rows} tint={tint} onOpen={setDetail} />
        ) : (
          <Empty icon="calendar">Không có lớp nào để hiển thị.</Empty>
        )}
      </Card>
      {form && <SectionForm s={form.s} copy={form.copy} semId={semId} sems={sems.data} courses={courses.data} lecs={lecs.data} all={all} onClose={() => setForm(null)} />}
      {detail && <SectionDetail id={detail} sec={all.find((x) => x.id === detail)} onClose={() => setDetail(null)} onEdit={() => { const s = all.find((x) => x.id === detail); setDetail(null); if (s) setForm({ s }); }} />}
    </div>
  );
}

function Timetable({ rows, tint, onOpen }: { rows: Section[]; tint: (c: string) => string[]; onOpen: (id: string) => void }) {
  const cell = { borderRight: '1px solid #EFEDE6', borderBottom: '1px solid #EFEDE6' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '76px repeat(7,minmax(120px,1fr))', gridTemplateRows: `40px repeat(12,48px)`, minWidth: 920, position: 'relative' }}>
        <div style={{ ...cell, background: '#FAFAF7' }} />
        {[2, 3, 4, 5, 6, 7, 8].map((d) => (
          <div key={d} style={{ ...cell, background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#62666F', textTransform: 'uppercase' }}>
            {THU[d]}
          </div>
        ))}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((r) => (
          <div key={`t${r}`} style={{ ...cell, gridRow: r + 1, gridColumn: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', fontSize: 11, color: '#62666F', background: r === 6 || r === 11 ? '#FAFAF7' : undefined }}>
            <b style={{ color: '#30343B' }}>Tiết {r}</b>
            {GIO[r - 1]}
          </div>
        ))}
        {Array.from({ length: 12 * 7 }, (_, i) => (
          <div key={`c${i}`} style={{ ...cell, gridRow: Math.floor(i / 7) + 2, gridColumn: (i % 7) + 2 }} />
        ))}
        {rows.flatMap((s) =>
          s.sessions.map((x, i) => {
            const [bg, fg] = tint(s.course.id);
            return (
              <button
                key={`${s.id}${i}`}
                type="button"
                onClick={() => onOpen(s.id)}
                title={`${s.code} · ${s.course.name}`}
                style={{ gridColumn: x.day, gridRow: `${x.from + 1} / ${x.to + 2}`, margin: 3, padding: '6px 8px', borderRadius: 8, background: bg, border: 0, borderLeft: `3px solid ${fg}`, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, cursor: 'pointer', overflow: 'hidden', font: "400 12px 'Be Vietnam Pro',sans-serif", color: '#1A1C21', zIndex: 1 }}
              >
                <b className="mono" style={{ color: fg }}>
                  {s.code}
                </b>
                <span style={{ fontWeight: 600 }}>{s.course.name}</span>
                <span className="muted">
                  {x.room} · {s.lecturer.fullName.replace(/^(PGS\.TS\.|TS\.|ThS\.)\s*/, '')}
                </span>
              </button>
            );
          }),
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, padding: '12px 20px' }}>
        Mỗi màu là một môn; các lớp cùng màu là các lớp khác nhau của cùng một môn. Bấm vào ô để xem chi tiết lớp.
      </p>
    </div>
  );
}

function nextCode(courseCode: string, all: Section[], courseId: string) {
  const used = all.filter((s) => s.course.id === courseId).map((s) => +(s.code.split('_')[1] || 0));
  return `${courseCode}_${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}

function SectionForm({ s, copy, semId, sems, courses, lecs, all, onClose }: { s: Section | null; copy?: Section; semId: string; sems: Sem[]; courses: Course[]; lecs: Lec[]; all: Section[]; onClose: () => void }) {
  const act = useAct();
  const base = s ?? copy;
  const firstCourse = base?.course.id ?? courses[0]?.id ?? '';
  const [v, setV] = useState({
    semesterId: semId,
    courseId: firstCourse,
    code: s?.code ?? nextCode(courses.find((c) => c.id === firstCourse)?.code ?? '', all, firstCourse),
    lecturerId: s?.lecturer.id ?? '',
    maxStudents: String(base?.maxStudents ?? 60),
    weekStart: String(base?.weekStart ?? 1),
    weekEnd: String(base?.weekEnd ?? 15),
  });
  const [sessions, setSessions] = useState<Session[]>(base?.sessions.length ? base.sessions.map((x) => ({ ...x })) : [{ day: 2, from: 1, to: 3, room: '' }]);
  const [err, setErr] = useState<Record<string, string>>({});
  const body = { ...v, maxStudents: +v.maxStudents, weekStart: +v.weekStart, weekEnd: +v.weekEnd, sessions };
  const [debounced, setDebounced] = useState(body);
  const key = JSON.stringify(body);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(JSON.parse(key)), 300);
    return () => clearTimeout(t);
  }, [key]);
  const ready = !!debounced.lecturerId && debounced.sessions.every((x) => x.to >= x.from);
  const check = useQuery({
    queryKey: ['admin', 'section-check', debounced, s?.id],
    queryFn: () => api.post<{ section: string; kind: string; message: string }[]>('/admin/sections/check', { ...debounced, id: s?.id }).then((r) => r.data),
    enabled: ready,
  });
  const selfClash = sessions.flatMap((a, i) => sessions.slice(i + 1).map((b, j) => (a.day === b.day && a.from <= b.to && b.from <= a.to ? `Buổi ${i + 1} và buổi ${i + j + 2} của lớp này trùng giờ (${THU[a.day]}).` : null))).filter(Boolean) as string[];
  const conflicts = [...selfClash, ...(ready ? (check.data ?? []).map((c) => c.message) : [])];
  const others = all.filter((x) => x.course.id === v.courseId && x.id !== s?.id);
  const rooms = [...new Set(all.flatMap((x) => x.sessions.map((y) => y.room)).filter(Boolean))];
  const setSes = (i: number, k: keyof Session, val: string) => setSessions(sessions.map((x, j) => (j === i ? { ...x, [k]: k === 'room' ? val : +val } : x)));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!/^[A-Z0-9]+_\d{2,3}$/i.test(v.code.trim())) e.code = 'Định dạng: MÃMÔN_số, VD: INT3306_02.';
    if (!v.lecturerId) e.lecturerId = 'Chọn giảng viên.';
    if (!(+v.maxStudents >= 1 && +v.maxStudents <= 300)) e.maxStudents = '1–300 sinh viên.';
    else if (s && +v.maxStudents < s.students) e.maxStudents = `Lớp đã có ${s.students} SV.`;
    if (!(+v.weekStart >= 1 && +v.weekEnd >= +v.weekStart && +v.weekEnd <= 25)) e.weekEnd = 'Tuần kết thúc phải ≥ tuần bắt đầu (tối đa 25).';
    if (sessions.some((x) => x.to < x.from)) e.sessions = 'Tiết kết thúc phải sau tiết bắt đầu.';
    else if (sessions.some((x) => !x.room.trim())) e.sessions = 'Nhập phòng học cho mọi buổi.';
    setErr(e);
    if (Object.keys(e).length || conflicts.length) return;
    const ok = await act
      .mutateAsync(s ? { method: 'put', path: `sections/${s.id}`, body, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: 'sections', body, ok: `Đã mở lớp ${v.code.toUpperCase()}. Thêm sinh viên trong mục chi tiết lớp.` })
      .then(() => true)
      .catch(() => false);
    if (ok) onClose();
  };
  const course = courses.find((c) => c.id === v.courseId);
  return (
    <FormModal
      title={s ? `Sửa lớp học phần ${s.code}` : copy ? `Mở thêm lớp cho môn ${copy.course.code}` : 'Tạo lớp học phần'}
      width={760}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending || conflicts.length > 0} onClick={save}>
            {s ? 'Lưu thay đổi' : 'Tạo lớp'}
          </button>
        </>
      }
    >
      {copy && (
        <Note tone="blue" icon="info">
          Đã sao chép thông tin từ lớp <b className="mono">{copy.code}</b>. Hãy chọn lịch học, phòng hoặc giảng viên khác cho lớp mới.
        </Note>
      )}
      <Grid2>
        <Field label="Học kỳ *">
          <select className="inp" value={v.semesterId} disabled={!!s} onChange={(e) => setV({ ...v, semesterId: e.target.value })}>
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
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value);
              setV({ ...v, courseId: e.target.value, code: s ? v.code : nextCode(c?.code ?? '', all, e.target.value) });
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} – {c.name} ({c.credits} TC)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mã lớp học phần *" error={err.code} help={others.length ? `Môn này đã có ${others.length} lớp trong học kỳ: ${others.map((x) => x.code).join(', ')}` : 'Đây là lớp đầu tiên của môn trong học kỳ.'}>
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
        <Field label="Sĩ số tối đa *" error={err.maxStudents}>
          <input className="inp" type="number" min={1} max={300} value={v.maxStudents} onChange={(e) => setV({ ...v, maxStudents: e.target.value })} />
        </Field>
        <Field label="Tuần học *" error={err.weekEnd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="inp" type="number" min={1} max={25} value={v.weekStart} onChange={(e) => setV({ ...v, weekStart: e.target.value })} aria-label="Từ tuần" />
            <span className="muted">đến</span>
            <input className="inp" type="number" min={1} max={25} value={v.weekEnd} onChange={(e) => setV({ ...v, weekEnd: e.target.value })} aria-label="Đến tuần" />
          </div>
        </Field>
        <Full>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="lbl" style={{ margin: 0 }}>
              Lịch học hằng tuần *
            </label>
            <button
              type="button"
              className="btn btn-sm"
              disabled={sessions.length >= 7}
              onClick={() => {
                const last = sessions[sessions.length - 1] ?? { day: 2, from: 1, to: 3, room: '' };
                setSessions([...sessions, { ...last, day: Math.min(8, last.day + 2) }]);
              }}
            >
              <Icon name="plus" size={15} /> Thêm buổi
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map((x, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1.2fr 34px', gap: 8, alignItems: 'center' }}>
                <select className="inp" aria-label="Thứ" value={x.day} onChange={(e) => setSes(i, 'day', e.target.value)}>
                  {Object.entries(THU).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                {(['from', 'to'] as const).map((k) => (
                  <select key={k} className={`inp${k === 'to' && x.to < x.from ? ' inp-err' : ''}`} aria-label={k === 'from' ? 'Tiết bắt đầu' : 'Tiết kết thúc'} value={x[k]} onChange={(e) => setSes(i, k, e.target.value)}>
                    {GIO.map((g, t) => (
                      <option key={t} value={t + 1}>
                        Tiết {t + 1} ({k === 'from' ? g : het(t + 1)})
                      </option>
                    ))}
                  </select>
                ))}
                <input className="inp" list="dl-room" aria-label="Phòng học" placeholder="Phòng, VD: P.301-G2" value={x.room} onChange={(e) => setSes(i, 'room', e.target.value)} />
                <IconBtn icon="close" title="Xóa buổi học" disabled={sessions.length <= 1} onClick={() => setSessions(sessions.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
          <datalist id="dl-room">
            {rooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          {err.sessions ? <div className="err">{err.sessions}</div> : <div className="help">Mỗi lớp có thể học nhiều buổi/tuần. Buổi sáng tiết 1–5, chiều tiết 6–10, tối tiết 11–12.</div>}
        </Full>
        <Full>
          {conflicts.length ? (
            <Note tone="red" icon="warn">
              <b>Trùng lịch — chưa thể lưu</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {conflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Note>
          ) : ready && check.data ? (
            <Note tone="green" icon="check">
              Không trùng lịch giảng viên và phòng học{course ? ` · ${course.name}` : ''}.
            </Note>
          ) : null}
        </Full>
      </Grid2>
    </FormModal>
  );
}

function SectionDetail({ id, sec, onClose, onEdit }: { id: string; sec?: Section; onClose: () => void; onEdit: () => void }) {
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
  const p = d ? Math.min(100, Math.round((d.students.length / d.maxStudents) * 100)) : 0;
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
              ['Môn học', <b>{d.course}</b>],
              ['Giảng viên', d.lecturer],
              ...(sec
                ? ([
                    ['Tuần học', `Tuần ${sec.weekStart} – ${sec.weekEnd}`],
                    [
                      'Lịch học',
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {sec.sessions.map((x, i) => (
                          <span key={i}>
                            {THU[x.day]}, tiết {x.from}–{x.to}{' '}
                            <span className="muted">
                              ({GIO[x.from - 1]}–{het(x.to)})
                            </span>{' '}
                            · <b>{x.room}</b>
                          </span>
                        ))}
                      </div>,
                    ],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <b>
                Sĩ số {d.students.length}/{d.maxStudents}
              </b>
              <span className="muted">{d.maxStudents - d.students.length > 0 ? `còn ${d.maxStudents - d.students.length} chỗ` : 'đã đủ'}</span>
            </div>
            <Bar value={p} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15 }}>Danh sách sinh viên</h3>
            <button className="btn btn-sm" onClick={() => setBulk(bulk === null ? '' : null)}>
              <Icon name="sheet" size={15} /> Thêm hàng loạt
            </button>
          </div>
          {bulk === null ? (
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) add([code.trim()]);
              }}
            >
              <input className="inp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập MSSV để thêm…" aria-label="Thêm sinh viên" style={{ flex: 1 }} />
              <button className="btn btn-p" disabled={act.isPending}>
                <Icon name="plus" size={16} /> Thêm
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Dán danh sách MSSV (mỗi dòng một MSSV, hoặc phân cách bằng dấu phẩy) — có thể copy trực tiếp từ một cột trong Excel.
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
                      <th>Lớp SH</th>
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
