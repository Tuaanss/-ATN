import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, fileUrl } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, PageHead, Seg } from '../../components/ui';
import { ddmm, score10 } from '../../utils/format';

type By = 'topic' | 'name' | 'code' | 'note';
type Sort = 'relevance' | 'newest' | 'score';

interface Filters {
  cohorts: string[];
  majors: string[];
  semesters: { code: string; term: string; academicYear: string }[];
  courses: { code: string; name: string }[];
  sections: { id: string; code: string; course: string }[];
  suggestions: string[];
}
interface Item {
  submissionId: string;
  title: string;
  keywords: string[];
  assignment: { id: string; title: string };
  owner: string;
  individual: boolean;
  personalPart: boolean;
  note: { content: string; isSample: boolean } | null;
  members: { fullName: string; studentCode: string }[];
  cohorts: string[];
  section: { code: string; course: string };
  semester: { code: string; term: string; academicYear: string };
  score: number | null;
  gradesPublished: boolean;
  submittedAt: string;
  isLate: boolean;
  thumb: { id: string; fileType: 'IMAGE' | 'VIDEO' | 'SOURCE' | 'DOCUMENT'; name: string } | null;
  fileCount: number;
  hasFigma: boolean;
  hasGit: boolean;
}
interface Result {
  total: number;
  page: number;
  pageSize: number;
  items: Item[];
}

const BY_LABEL: Record<By, string> = { topic: 'Chủ đề / từ khóa', name: 'Tên sinh viên', code: 'MSV', note: 'Ghi chú của tôi' };
const PLACEHOLDER: Record<By, string> = { topic: 'Nhập tên đề tài hoặc từ khóa, VD: thương mại điện tử', name: 'Nhập họ tên sinh viên', code: 'Nhập MSV, VD: SV0001', note: 'Tìm trong ghi chú bạn đã viết, VD: thiết kế đẹp' };
const shortTerm = (s: { term: string; academicYear: string }) => `${s.term === 'TERM_1' ? 'HK1' : s.term === 'TERM_2' ? 'HK2' : 'Hè'} ${s.academicYear.replace(/20(\d\d)-20(\d\d)/, '$1–$2')}`;
const FILTER_KEYS = ['cohort', 'major', 'course', 'section', 'min', 'max', 'sample'] as const;

function Thumb({ it }: { it: Item }) {
  const box = { width: 168, height: 112, borderRadius: 10, flexShrink: 0, overflow: 'hidden', position: 'relative' } as const;
  if (it.thumb?.fileType === 'IMAGE')
    return (
      <Link to={`/view/${it.submissionId}`} style={{ ...box, border: '1px solid #E3E1D9', background: '#F1F0EA' }}>
        <img src={fileUrl(it.thumb.id)} alt={it.thumb.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Link>
    );
  if (it.thumb?.fileType === 'VIDEO')
    return (
      <Link to={`/view/${it.submissionId}`} style={{ ...box, background: '#1A1C21', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, padding: '0 10px' }}>
        <Icon name="play" size={18} />
        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {it.thumb.name}
        </span>
      </Link>
    );
  return (
    <Link to={`/view/${it.submissionId}`} style={{ ...box, border: '1px solid #E3E1D9', background: '#F7F6F2', color: '#62666F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
      <Icon name={it.thumb?.fileType === 'SOURCE' || it.hasGit ? 'code' : it.hasFigma ? 'link' : 'file'} size={24} />
      <span className="mono" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {it.thumb?.name ?? (it.hasFigma ? 'Link Figma' : it.hasGit ? 'Link GitHub' : '—')}
      </span>
    </Link>
  );
}

/** Tìm kiếm bài nộp – mẫu giang-vien/GV_Search. Phạm vi: LHP giảng viên phụ trách. */
export function SearchPage() {
  useCrumbs([{ label: 'Tìm kiếm bài nộp' }]);
  const [params, setParams] = useSearchParams();
  const by = (params.get('by') as By) || 'topic';
  const sort = (params.get('sort') as Sort) || (params.get('q') ? 'relevance' : 'newest');
  const [text, setText] = useState(params.get('q') ?? '');
  useEffect(() => setText(params.get('q') ?? ''), [params]);

  // bộ lọc nháp – chỉ áp dụng khi bấm "Áp dụng"
  const read = () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>;
  const [draft, setDraft] = useState(read);
  useEffect(() => setDraft(read()), [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtersQ = useQuery({ queryKey: ['lecturer', 'search', 'filters'], queryFn: () => api.get<Filters>('/lecturer/search/filters').then((r) => r.data) });
  const qs = params.toString();
  const resQ = useQuery({ queryKey: ['lecturer', 'search', qs], queryFn: () => api.get<Result>(`/lecturer/search?${qs}`).then((r) => r.data), placeholderData: keepPreviousData });
  const f = filtersQ.data;
  const r = resQ.data;

  const update = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (resetPage) next.delete('page');
    setParams(next);
  };
  const submit = (q = text) => update({ q: q.trim() || undefined });
  const toggle = (key: 'cohort', v: string) => {
    const cur = draft[key] ? draft[key].split(',') : [];
    setDraft({ ...draft, [key]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') });
  };
  const applied = FILTER_KEYS.filter((k) => params.get(k));
  const pages = r ? Math.max(1, Math.ceil(r.total / r.pageSize)) : 1;
  const summary = [
    params.get('cohort') && `Khóa ${params.get('cohort')!.split(',').join(', ')}`,
    params.get('major'),
    params.get('sample') && 'Bài mẫu',
    params.get('course') && f?.courses.find((c) => c.code === params.get('course'))?.name,
    params.get('section') && f?.sections.find((s) => s.id === params.get('section'))?.code,
    (params.get('min') || params.get('max')) && `Điểm ${params.get('min') || 0}–${params.get('max') || 10}`,
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHead title="Tìm kiếm bài nộp" sub="Tìm theo chủ đề, tên sinh viên, MSV hoặc ghi chú của bạn; lọc theo khóa, ngành, môn học và bài mẫu. Không phân biệt dấu và hoa thường" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span className="muted">Tìm theo</span>
        <Seg<By> value={by} onChange={(v) => update({ by: v === 'topic' ? undefined : v })} options={(['topic', 'name', 'code', 'note'] as By[]).map((v) => ({ value: v, label: BY_LABEL[v] }))} />
      </div>
      <form
        style={{ display: 'flex', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 48, border: '2px solid #DB0000', borderRadius: 10, padding: '0 16px', background: '#fff', color: '#62666F' }}>
          <Icon name="search" size={18} />
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Từ khóa" placeholder={PLACEHOLDER[by]} style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "500 15px 'Be Vietnam Pro',sans-serif", color: '#1A1C21', background: 'transparent' }} />
          {text && (
            <button type="button" aria-label="Xóa" className="btn btn-g btn-sm" style={{ padding: '0 6px' }} onClick={() => (setText(''), submit(''))}>
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
        <button className="btn btn-p" type="submit" style={{ height: 48, padding: '0 24px' }}>
          Tìm kiếm
        </button>
      </form>
      {by === 'topic' && !!f?.suggestions.length && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
          <span className="muted">Gợi ý:</span>
          {f.suggestions.map((s) => (
            <button key={s} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => (setText(s), submit(s))}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="search-grid" style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="sec">Bộ lọc</h2>
            {applied.length > 0 && (
              <a
                href="#"
                style={{ fontSize: 13, fontWeight: 600 }}
                onClick={(e) => {
                  e.preventDefault();
                  update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])));
                }}
              >
                Xóa lọc
              </a>
            )}
          </div>
          {!!f?.cohorts.length && (
            <div>
              <span className="lbl">Khóa</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {f.cohorts.map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <input type="checkbox" checked={draft.cohort.split(',').includes(c)} onChange={() => toggle('cohort', c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="lbl">Ngành</label>
            <select className="inp" value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value })}>
              <option value="">Tất cả ngành</option>
              {f?.majors.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={draft.sample === '1'} onChange={(e) => setDraft({ ...draft, sample: e.target.checked ? '1' : '' })} />
            <span style={{ color: '#D97706', display: 'inline-flex' }}>
              <Icon name="star" size={16} />
            </span>
            Chỉ bài mẫu của tôi
          </label>
          <div>
            <label className="lbl">Môn học</label>
            <select className="inp" value={draft.course} onChange={(e) => setDraft({ ...draft, course: e.target.value })}>
              <option value="">Tất cả môn</option>
              {f?.courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Lớp học phần</label>
            <select className="inp" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}>
              <option value="">Tất cả lớp</option>
              {f?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.course}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="lbl">Khoảng điểm</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="inp" type="number" min={0} max={10} step={0.5} placeholder="0" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} style={{ textAlign: 'center' }} />
              <span className="muted">–</span>
              <input className="inp" type="number" min={0} max={10} step={0.5} placeholder="10" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value })} style={{ textAlign: 'center' }} />
            </div>
          </div>
          <button className="btn btn-p" type="button" onClick={() => update(draft)}>
            Áp dụng
          </button>
        </section>

        <div className="col" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14 }}>
              <b>{r?.total ?? 0} bài nộp</b>
              {params.get('q') ? ` khớp “${params.get('q')}”` : ''}
              {summary.length ? ` · ${summary.join(' · ')}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="muted">Sắp xếp</span>
              <select className="inp" style={{ width: 180 }} value={sort} onChange={(e) => update({ sort: e.target.value })}>
                <option value="relevance">Liên quan nhất</option>
                <option value="newest">Mới nộp nhất</option>
                <option value="score">Điểm cao nhất</option>
              </select>
            </div>
          </div>

          {resQ.isLoading ? (
            [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 144 }} />)
          ) : r?.items.length ? (
            r.items.map((it) => {
              return (
                <div key={it.submissionId} className="card" style={{ padding: 16, display: 'flex', gap: 18, alignItems: 'center', opacity: resQ.isFetching ? 0.6 : 1 }}>
                  <Thumb it={it} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link to={`/view/${it.submissionId}`} style={{ fontSize: 16, fontWeight: 700, color: '#1A1C21' }}>
                      {it.title}
                    </Link>
                    {it.keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {it.keywords.map((k, i) => (
                          <span key={k} className={`badge b-${i === 0 ? 'amber' : 'gray'}`}>
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 13 }}>
                      {[it.owner, it.cohorts.join(', '), it.section.code, it.section.course, shortTerm(it.semester)].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: '#62666F', display: 'inline-flex' }}>
                        <Icon name={it.individual ? 'user' : 'users'} size={14} />
                      </span>
                      {it.individual ? `${it.members[0]?.fullName} (${it.members[0]?.studentCode})` : it.members.map((m) => m.fullName).join(', ')}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {it.assignment.title} · nộp {ddmm(it.submittedAt)}
                      {it.isLate ? ' (muộn)' : ''} · {it.fileCount} tệp
                    </div>
                    {it.note?.content && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: '#FFFBF2', border: '1px solid #F5E1B8', fontSize: 13, lineHeight: 1.5 }}>
                        <span style={{ color: '#B45309', display: 'inline-flex', marginTop: 2 }}>
                          <Icon name="note" size={14} />
                        </span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{it.note.content.length > 220 ? `${it.note.content.slice(0, 220)}…` : it.note.content}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0, minWidth: 110 }}>
                    {it.note?.isSample && (
                      <Badge tone="amber">
                        <Icon name="star" size={12} />
                        Bài mẫu
                      </Badge>
                    )}
                    {it.personalPart && <Badge tone="gray">Phần cá nhân</Badge>}
                    {it.score != null ? (
                      <span className="mono" style={{ fontSize: 20, fontWeight: 600 }} title={it.gradesPublished ? 'Đã công bố' : 'Chưa công bố'}>
                        {score10(it.score)}
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>
                        Chưa có điểm
                      </span>
                    )}
                    <Link className="btn btn-sm" to={`/view/${it.submissionId}`}>
                      <Icon name="eye" size={14} />
                      Xem bài
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <Card>
              <Empty icon="search">{params.get('q') || applied.length ? 'Không tìm thấy bài nộp phù hợp.' : 'Chưa có bài nộp nào trong các lớp bạn phụ trách.'}</Empty>
            </Card>
          )}

          {r && r.total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, flexWrap: 'wrap', gap: 10 }}>
              <span className="muted">
                Hiển thị {(r.page - 1) * r.pageSize + 1}–{Math.min(r.page * r.pageSize, r.total)} trong {r.total} kết quả
              </span>
              {pages > 1 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" type="button" aria-label="Trang trước" disabled={r.page <= 1} onClick={() => update({ page: String(r.page - 1) }, false)}>
                    <Icon name="chevronLeft" size={14} />
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pages || Math.abs(p - r.page) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} style={{ display: 'contents' }}>
                        {i > 0 && p - arr[i - 1] > 1 && <span className="muted" style={{ alignSelf: 'center' }}>…</span>}
                        <button className={`btn btn-sm${p === r.page ? ' btn-p' : ''}`} type="button" onClick={() => update({ page: String(p) }, false)}>
                          {p}
                        </button>
                      </span>
                    ))}
                  <button className="btn btn-sm" type="button" aria-label="Trang sau" disabled={r.page >= pages} onClick={() => update({ page: String(r.page + 1) }, false)}>
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
