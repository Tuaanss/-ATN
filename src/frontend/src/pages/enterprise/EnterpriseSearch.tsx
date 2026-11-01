import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Card, ChipInput, Empty, Field, Loading, PageHead } from '../../components/ui';
import { AccessBadge, RequestModal, gpa, type Access } from './common';

interface Filters {
  cohorts: string[];
  majors: string[];
  classes: { id: string; code: string }[];
  topics: string[];
  skills: string[];
  viewDays: { min: number; max: number };
}
interface Row {
  id: string;
  studentCode: string;
  fullName: string;
  cohort: string | null;
  major: string | null;
  adminClass: string | null;
  gpa: number | null;
  skills: string[];
  works: { title: string; keywords: string[] }[];
  access: Access;
  interested: boolean;
}
interface Result {
  total: number;
  page: number;
  pages: number;
  rows: Row[];
}
export interface Criteria {
  code?: string;
  q?: string;
  cohorts?: string[];
  major?: string;
  classId?: string;
  gpaMin?: number;
  gpaMax?: number;
  topics?: string[];
  skills?: string[];
}

/** Tìm kiếm sinh viên – mẫu doanh-nghiep/DN_Search. */
export function EnterpriseSearch() {
  useCrumbs([{ label: 'Tìm kiếm sinh viên' }]);
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const f = useQuery({ queryKey: ['enterprise', 'filters'], queryFn: () => api.get<Filters>('/enterprise/filters').then((r) => r.data) });
  const init: Criteria = (() => {
    try {
      return JSON.parse(params.get('c') ?? '{}');
    } catch {
      return {};
    }
  })();
  if (params.get('q')) init.q = params.get('q')!;
  const [form, setForm] = useState({ code: init.code ?? '', q: init.q ?? '', cohort: init.cohorts?.[0] ?? '', major: init.major ?? '', classId: init.classId ?? '', gpaMin: init.gpaMin?.toString() ?? '', gpaMax: init.gpaMax?.toString() ?? '', topics: init.topics ?? [], skills: init.skills ?? [] });
  const [res, setRes] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const criteria = (): Criteria => ({
    code: form.code.trim() || undefined,
    q: form.q.trim() || undefined,
    cohorts: form.cohort ? [form.cohort] : undefined,
    major: form.major || undefined,
    classId: form.classId || undefined,
    gpaMin: form.gpaMin ? Number(form.gpaMin.replace(',', '.')) : undefined,
    gpaMax: form.gpaMax ? Number(form.gpaMax.replace(',', '.')) : undefined,
    topics: form.topics.length ? form.topics : undefined,
    skills: form.skills.length ? form.skills : undefined,
  });
  const search = useMutation({
    mutationFn: (v: { page: number; log: boolean }) => api.post<Result>('/enterprise/search', { ...criteria(), ...v }).then((r) => r.data),
    onSuccess: (r) => {
      setRes(r);
      qc.invalidateQueries({ queryKey: ['enterprise', 'dashboard'] });
    },
  });
  useEffect(() => {
    search.mutate({ page: 1, log: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = useMutation({ mutationFn: (id: string) => api.post(`/enterprise/students/${id}/interest`), onSuccess: () => search.mutate({ page, log: false }) });
  if (!f.data) return <Loading />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const go = (p: number) => {
    setPage(p);
    search.mutate({ page: p, log: false });
  };
  const picked = res?.rows.filter((r) => sel.includes(r.id)) ?? [];
  return (
    <div className="page">
      <PageHead title="Tìm kiếm sinh viên" sub="Sắp xếp theo GPA từ cao đến thấp" />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSel([]);
            search.mutate({ page: 1, log: true });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, alignItems: 'end' }}>
            <Field label="MSSV">
              <input className="inp mono" value={form.code} onChange={set('code')} placeholder="Khớp chính xác" />
            </Field>
            <Field label="Khóa">
              <select className="inp" value={form.cohort} onChange={set('cohort')}>
                <option value="">Tất cả</option>
                {f.data.cohorts.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Ngành">
              <select className="inp" value={form.major} onChange={set('major')}>
                <option value="">Tất cả</option>
                {f.data.majors.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Lớp">
              <select className="inp" value={form.classId} onChange={set('classId')}>
                <option value="">Tất cả</option>
                {f.data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="GPA từ">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="inp mono" value={form.gpaMin} onChange={set('gpaMin')} placeholder="0.0" aria-label="GPA tối thiểu" />
                <span className="muted">–</span>
                <input className="inp mono" value={form.gpaMax} onChange={set('gpaMax')} placeholder="4.0" aria-label="GPA tối đa" />
              </div>
            </Field>
            <button className="btn btn-p" style={{ height: 42 }} disabled={search.isPending}>
              <Icon name="search" size={16} /> Tìm kiếm
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
            <Field label="Chủ đề đề tài" help={f.data.topics.length ? `Gợi ý: ${f.data.topics.slice(0, 6).join(', ')}` : undefined}>
              <ChipInput value={form.topics} onChange={(v) => setForm({ ...form, topics: v })} max={5} placeholder="Nhập chủ đề, Enter để thêm" />
            </Field>
            <Field label="Kỹ năng" help={f.data.skills.length ? `Gợi ý: ${f.data.skills.slice(0, 6).join(', ')}` : undefined}>
              <ChipInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} max={5} placeholder="VD: Figma, React" />
            </Field>
            <Field label="Từ khóa">
              <input className="inp" value={form.q} onChange={set('q')} placeholder="Tên, đề tài, kỹ năng…" />
            </Field>
          </div>
        </form>
      </Card>
      {sel.length > 0 && (
        <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#FFF8F7', borderColor: '#F2AAAA' }}>
          <b>Đã chọn {sel.length} sinh viên</b>
          <span className="muted" style={{ fontSize: 13, flex: 1 }}>
            Gửi một yêu cầu xem bài cho nhiều sinh viên cùng lúc
          </span>
          <button className="btn btn-sm" onClick={() => setSel([])}>
            Bỏ chọn
          </button>
          <button className="btn btn-sm btn-p" onClick={() => setAsk(true)}>
            Gửi yêu cầu xem bài
          </button>
        </div>
      )}
      <Card body={false}>
        {!res ? (
          <div style={{ padding: 24 }}>
            <span className="spinner" />
          </div>
        ) : !res.rows.length ? (
          <Empty icon="search">Không có sinh viên phù hợp. Chỉ sinh viên đã bật “cho doanh nghiệp tìm thấy” mới xuất hiện ở đây.</Empty>
        ) : (
          <>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Sinh viên</th>
                    <th>Khóa · Ngành</th>
                    <th>GPA ↓</th>
                    <th>Đề tài đã thực hiện</th>
                    <th>Quyền xem</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input type="checkbox" aria-label={`Chọn ${r.fullName}`} checked={sel.includes(r.id)} disabled={r.access.state === 'PENDING' || r.access.state === 'ACTIVE'} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} />
                      </td>
                      <td>
                        <Link to={`/enterprise/students/${r.id}`} style={{ fontWeight: 600 }}>
                          {r.fullName}
                        </Link>
                        <div className="mono muted" style={{ fontSize: 12 }}>
                          {r.studentCode}
                        </div>
                      </td>
                      <td>
                        {r.cohort ?? '—'} · {r.major ?? '—'}
                      </td>
                      <td className="mono">{gpa(r.gpa)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.works.slice(0, 2).map((w, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{w.title}</span>
                              {w.keywords[0] && <span className="chip" style={{ height: 22, fontSize: 12 }}>{w.keywords[0]}</span>}
                            </div>
                          ))}
                          {r.works.length > 2 && (
                            <span className="muted" style={{ fontSize: 12 }}>
                              + {r.works.length - 2} đề tài khác
                            </span>
                          )}
                          {!r.works.length && <span className="muted">Chưa có bài đã nộp</span>}
                        </div>
                      </td>
                      <td>
                        <AccessBadge a={r.access} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button className="btn btn-sm btn-g" aria-label={r.interested ? 'Bỏ quan tâm' : 'Lưu vào danh sách quan tâm'} title={r.interested ? 'Bỏ quan tâm' : 'Lưu vào danh sách quan tâm'} onClick={() => toggle.mutate(r.id)} style={{ width: 34, padding: 0, color: r.interested ? '#DB0000' : undefined }}>
                          <Icon name="star" size={16} />
                        </button>
                        <Link className="btn btn-sm" to={`/enterprise/students/${r.id}`}>
                          Hồ sơ
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #EFEDE6', fontSize: 13 }}>
              <span className="muted">
                {(res.page - 1) * 20 + 1}–{Math.min(res.page * 20, res.total)} trong {res.total} sinh viên
              </span>
              {res.pages > 1 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {Array.from({ length: res.pages }, (_, i) => i + 1).map((p) => (
                    <button key={p} className={`btn btn-sm${p === res.page ? ' btn-p' : ''}`} onClick={() => go(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      {ask && <RequestModal students={picked} viewDays={f.data.viewDays} onClose={() => setAsk(false)} onDone={() => { setSel([]); search.mutate({ page, log: false }); }} />}
    </div>
  );
}
