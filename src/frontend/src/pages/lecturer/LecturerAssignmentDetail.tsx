import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { AssignmentGradePreview, AssignmentGrades, GroupList, GroupPreview, LecturerAssignmentDetail as Detail, WorkUnit } from '../../api/types';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Card, Empty, KV, Loading, Modal, Note, PageHead, RowKV, Stat, Tabs, useToast } from '../../components/ui';
import { BriefBody, lateText, modeBadgeText } from '../../components/work';
import { ExcelUpload, ImportHistoryCard, PreviewActions, RowErrors } from '../../components/excel';
import { ddmm, ddmmHHmm, fullDT, phaseBadge, PRODUCT_SHORT, remain, score10, SYNC_BADGE } from '../../utils/format';

type Tab = 'info' | 'groups' | 'submissions' | 'grades';

const productsLabel = (d: Detail) => {
  const p = d.assignment.productTypes;
  return p
    .filter((t) => !(t === 'GIT_LINK' && p.includes('SOURCE')))
    .map((t) => (t === 'FIGMA' ? 'link Figma' : PRODUCT_SHORT[t]))
    .join(' + ');
};

function filesText(u: WorkUnit) {
  const s = u.submission;
  if (!s) return '—';
  const parts: string[] = [];
  if (s.files.images) parts.push(`${s.files.images} ảnh`);
  if (s.files.videos) parts.push(`${s.files.videos} video`);
  if (s.files.sources) parts.push('Mã nguồn');
  if (s.files.documents) parts.push('Báo cáo');
  if (s.figma) parts.push('Figma');
  if (s.git) parts.push('GitHub');
  return parts.join(' · ') || '—';
}

function PersonCell({ name, code, size = 30 }: { name: string; code?: string; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Avatar name={name} size={size} />
      {code ? (
        <div>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</div>
          <div className="mono muted" style={{ fontSize: 12 }}>
            {code}
          </div>
        </div>
      ) : (
        <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{name}</span>
      )}
    </div>
  );
}

const Keywords = ({ k }: { k: string[] }) => (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {k.length ? (
      k.map((x) => (
        <span key={x} className="chip">
          {x}
        </span>
      ))
    ) : (
      <span className="muted">—</span>
    )}
  </div>
);

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 280, maxWidth: '100%', height: 38, border: '1px solid #E3E1D9', borderRadius: 8, padding: '0 12px', color: '#62666F' }}>
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: "400 14px 'Be Vietnam Pro',sans-serif", background: 'transparent' }} />
    </label>
  );
}

/**
 * Trang bài tập của giảng viên: Thông tin · Nhóm · Bài đã nộp · Điểm.
 * Hệ thống chỉ lưu trữ kết quả: nhóm và điểm tải lên bằng Excel, GV chấm ngoài hệ thống.
 */
export function LecturerAssignmentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (['info', 'groups', 'submissions', 'grades'].includes(params.get('tab') ?? '') ? params.get('tab') : 'info') as Tab;
  const q = useQuery({ queryKey: ['lecturer', 'assignment', id], queryFn: () => api.get<Detail>(`/lecturer/assignments/${id}`).then((r) => r.data) });
  const d = q.data;
  useCrumbs([
    { label: 'Lớp học phần', to: '/lecturer/sections' },
    ...(d ? [{ label: `${d.assignment.section.code} · ${d.assignment.section.course.name}`, to: `/lecturer/sections/${d.assignment.section.id}` }, { label: d.assignment.title.split('–')[0].trim() }] : []),
  ]);

  const run = useMutation({
    mutationFn: async (kind: 'publish' | 'delete' | 'close') => {
      if (kind === 'publish') return (await api.post<{ opened: boolean }>(`/lecturer/assignments/${id}/publish`)).data;
      if (kind === 'close') return (await api.post(`/lecturer/assignments/${id}/close`)).data;
      return (await api.delete(`/lecturer/assignments/${id}`)).data;
    },
    onSuccess: (r, kind) => {
      qc.invalidateQueries({ queryKey: ['lecturer'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (kind === 'delete') {
        toast.ok('Đã xóa bài tập');
        nav(`/lecturer/sections/${d?.assignment.section.id ?? ''}`);
      } else toast.ok(kind === 'close' ? 'Đã đóng bài tập' : (r as { opened?: boolean }).opened ? 'Đã mở bài tập cho sinh viên' : 'Đã hẹn giờ mở bài tập');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (q.isLoading) return <Loading />;
  if (!d)
    return (
      <div className="page">
        <PageHead title="Không mở được bài tập" sub={errorMessage(q.error)} />
      </div>
    );

  const a = d.assignment;
  const group = a.workMode === 'GROUP';
  const badge = d.phase === 'SCHEDULED' ? { label: `Hẹn mở ${ddmmHHmm(a.openAt)}`, tone: 'blue' as const } : phaseBadge(d.phase);
  const setTab = (t: Tab) => setParams(t === 'info' ? {} : { tab: t }, { replace: true });
  const past = new Date(d.finalDeadline) < new Date();
  const sub = [a.section.code, a.section.course.name, modeBadgeText(a), `Hạn nộp ${fullDT(a.dueAt)}${past ? ' (đã qua)' : ''}`, ...(a.gradesPublishedAt ? [`Công bố điểm ${ddmm(a.gradesPublishedAt)}`] : [])].join(' · ');

  return (
    <div className="page">
      <PageHead
        title={a.title}
        badge={<Badge tone={badge.tone}>{badge.label}</Badge>}
        sub={sub}
        actions={
          <>
            {a.driveFolderUrl && a.status !== 'DRAFT' && (
              <a className="btn" href={a.driveFolderUrl} target="_blank" rel="noreferrer">
                <Icon name="drive" size={16} />
                Mở trên Google Drive
              </a>
            )}
            <Link className="btn" to={`/lecturer/assignments/${a.id}/edit`}>
              <Icon name="edit" size={16} />
              Sửa bài tập
            </Link>
            {a.status === 'DRAFT' && (
              <button className="btn btn-p" type="button" onClick={() => run.mutate('publish')} disabled={run.isPending}>
                <Icon name="check" size={16} />
                {a.autoOpen ? 'Mở ngay' : 'Giao bài'}
              </button>
            )}
          </>
        }
      />

      <div className="grid4">
        <Stat tone="blue" icon="eye" label="Đã xem đề bài" value={`${d.views} / ${a.section.studentCount}`} sub="sinh viên đã mở bài tập" />
        {group ? (
          <Stat tone={d.stats.groups ? 'green' : 'amber'} icon="users" label="Nhóm" value={d.stats.groups} sub={a.groupsImportedAt ? `tải lên ${ddmmHHmm(a.groupsImportedAt)}` : 'chưa tải danh sách nhóm'} />
        ) : (
          <Stat tone="green" icon="file" label="Đã nhập đề tài" value={`${d.stats.topics} / ${a.section.studentCount}`} sub="sinh viên" />
        )}
        <Stat tone="amber" icon="upload" label="Bài đã nộp" value={`${d.stats.submitted} / ${d.stats.expected}`} sub={past ? 'đã hết hạn nộp' : remain(d.finalDeadline).text.toLowerCase()} />
        <Stat tone={a.gradesPublishedAt ? 'green' : 'gray'} icon="listAlt" label="Có điểm" value={`${d.stats.graded} / ${a.section.studentCount}`} sub={a.gradesPublishedAt ? `đã công bố ${ddmm(a.gradesPublishedAt)}` : 'chưa công bố'} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'info', label: 'Thông tin', icon: 'file' },
          { key: 'groups', label: <>Nhóm{d.stats.openReports > 0 && <Badge tone="red">{d.stats.openReports}</Badge>}</>, icon: 'users' },
          { key: 'submissions', label: `Bài đã nộp (${d.stats.submitted})`, icon: 'upload' },
          { key: 'grades', label: 'Điểm', icon: 'listAlt' },
        ]}
      />

      {tab === 'info' && <InfoTab d={d} run={run} />}
      {tab === 'groups' && <GroupsTab d={d} />}
      {tab === 'submissions' && <SubmissionsTab d={d} />}
      {tab === 'grades' && <GradesTab d={d} />}
    </div>
  );
}

// ================================================================ Thông tin

function InfoTab({ d, run }: { d: Detail; run: { mutate: (k: 'publish' | 'delete' | 'close') => void; isPending: boolean } }) {
  const a = d.assignment;
  const group = a.workMode === 'GROUP';
  return (
    <div className="cols-2-1">
      <div className="col">
        <Card title="Thông tin đã giao">
          <KV
            rows={[
              ['Lớp', `${a.section.code} · ${a.section.course.name} · ${a.section.studentCount} SV`],
              ['Mở', fullDT(a.openAt)],
              ['Hạn nộp', fullDT(a.dueAt)],
              ['Nộp muộn', lateText(a) ?? 'Không nhận'],
              ['Hình thức', group ? `Nhóm theo danh sách tải lên${a.hasIndividualPart ? ' · có phần cá nhân' : ''}` : 'Cá nhân'],
              ['Sản phẩm', productsLabel(d)],
              ['Drive', a.driveFolderUrl ? <a key="d" href={a.driveFolderUrl} target="_blank" rel="noreferrer"><Badge tone="green">Đã tạo thư mục nhận bài</Badge></a> : <Badge key="d" tone="green">Đã tạo thư mục nhận bài</Badge>],
            ]}
          />
        </Card>
        <Card title="Đề bài">
          <BriefBody b={{ ...a }} />
        </Card>
      </div>
      <div className="col">
        {a.status === 'DRAFT' ? (
          <Card title={a.autoOpen ? 'Hẹn giờ mở' : 'Bản nháp'}>
            <Note tone={a.autoOpen ? 'blue' : 'gray'} icon={a.autoOpen ? 'clock' : 'eye'}>
              {a.autoOpen ? (
                <>
                  Bài tập tự mở lúc <b>{fullDT(a.openAt)}</b> và gửi thông báo cho {a.section.studentCount} sinh viên.
                </>
              ) : (
                'Sinh viên chưa nhìn thấy bài tập này.'
              )}
            </Note>
            <button className="btn btn-p" type="button" style={{ width: '100%' }} onClick={() => run.mutate('publish')} disabled={run.isPending}>
              <Icon name="check" size={16} />
              {a.autoOpen ? 'Mở ngay' : 'Giao bài'}
            </button>
          </Card>
        ) : (
          <Card title="Việc cần làm">
            {group && (
              <RowKV label="Danh sách nhóm">{a.groupsImportedAt ? <Badge tone="green">Đã tải lên</Badge> : <Badge tone="amber">Chưa tải lên</Badge>}</RowKV>
            )}
            <RowKV label="Điểm">{a.gradesPublishedAt ? <Badge tone="green">Đã công bố</Badge> : d.stats.graded ? <Badge tone="blue">Đã tải, chưa công bố</Badge> : <Badge tone="gray">Chưa tải lên</Badge>}</RowKV>
            {group && !a.groupsImportedAt && (
              <Link className="btn btn-p" style={{ width: '100%' }} to="?tab=groups">
                <Icon name="upload" size={16} />
                Tải danh sách nhóm
              </Link>
            )}
            {a.status === 'OPEN' && (
              <button className="btn" type="button" style={{ width: '100%' }} onClick={() => confirm('Đóng bài tập? Sinh viên sẽ không nộp được nữa.') && run.mutate('close')}>
                <Icon name="lock" size={16} />
                Đóng bài tập
              </button>
            )}
          </Card>
        )}
        <Card title="Lịch sử thay đổi">
          {d.history.length ? (
            d.history.map((h, i) => (
              <div key={i} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid #EFEDE6' }}>
                <b>{h.summary}</b>
                <span className="muted">
                  {h.actor} · {ddmmHHmm(h.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              Chưa có thay đổi.
            </span>
          )}
        </Card>
        {!d.stats.submitted && (
          <button className="btn btn-d" type="button" onClick={() => confirm('Xóa bài tập này? Danh sách nhóm đã tải lên cũng bị xóa.') && run.mutate('delete')}>
            <Icon name="trash" size={16} />
            Xóa bài tập
          </button>
        )}
      </div>
    </div>
  );
}

// ================================================================ Nhóm (Excel)

function GroupsTab({ d }: { d: Detail }) {
  const a = d.assignment;
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState<GroupList['reports'][number] | null>(null);
  const q = useQuery({ queryKey: ['lecturer', 'assignment', a.id, 'groups'], queryFn: () => api.get<GroupList>(`/lecturer/assignments/${a.id}/groups`).then((r) => r.data), enabled: a.workMode === 'GROUP' });

  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      return api.post<GroupPreview>(`/lecturer/assignments/${a.id}/groups/import/preview`, fd).then((r) => r.data);
    },
    onSuccess: setPreview,
    onError: (e) => toast.err(errorMessage(e)),
  });
  const commit = useMutation({
    mutationFn: (onlyValid: boolean) => api.post<GroupList>(`/lecturer/assignments/${a.id}/groups/import/${preview!.jobId}/commit`, { onlyValid }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['lecturer', 'assignment', a.id, 'groups'], data);
      qc.invalidateQueries({ queryKey: ['lecturer'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setPreview(null);
      toast.ok(`Đã áp dụng danh sách ${data.groups.length} nhóm, sinh viên đã nhận thông báo`);
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (a.workMode !== 'GROUP')
    return (
      <Card>
        <Empty icon="user">Bài tập làm cá nhân, không có danh sách nhóm.</Empty>
      </Card>
    );
  if (q.isLoading || !q.data) return <div className="skeleton" style={{ height: 280 }} />;
  const g = q.data;
  const k = search.trim().toLowerCase();
  const groups = g.groups.filter((x) => !k || `${x.code} ${x.name} ${x.topic?.title ?? ''} ${x.members.map((m) => `${m.fullName} ${m.studentCode}`).join(' ')}`.toLowerCase().includes(k));
  const openReports = g.reports.filter((r) => r.status === 'OPEN');

  return (
    <div className="cols-2-1">
      <div className="col">
        {preview ? (
          <GroupPreviewCard p={preview} busy={commit.isPending} onCancel={() => setPreview(null)} onApply={(v) => commit.mutate(v)} />
        ) : (
          <ExcelUpload
            title={g.groups.length ? 'Cập nhật danh sách nhóm' : 'Tải lên danh sách nhóm'}
            templateUrl={`/lecturer/assignments/${a.id}/groups/template`}
            templateName={`Nhom_${a.section.code}.xlsx`}
            onFile={(f) => upload.mutate(f)}
            busy={upload.isPending}
            hint="File mẫu có sẵn danh sách SV của lớp · điền cột Nhóm (VD: N01) · tối đa 5 MB"
          />
        )}

        <Card
          title={`Danh sách nhóm (${g.groups.length})`}
          body={false}
          extra={
            g.groups.length > 0 && (
              <button
                className="btn btn-sm"
                type="button"
                onClick={() =>
                  downloadCsv(`nhom-${a.section.code}.csv`, [
                    ['Mã nhóm', 'Tên nhóm', 'MSV', 'Họ tên', 'Vai trò', 'Đề tài'],
                    ...g.groups.flatMap((x) => x.members.map((m) => [x.code, x.name, m.studentCode, m.fullName, m.role === 'LEADER' ? 'Trưởng nhóm' : '', x.topic?.title ?? ''])),
                  ])
                }
              >
                <Icon name="download" size={14} />
                Xuất danh sách
              </button>
            )
          }
        >
          {g.groups.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #EFEDE6' }}>
              <SearchBox value={search} onChange={setSearch} placeholder="Tìm nhóm, sinh viên, đề tài…" />
            </div>
          )}
          {groups.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhóm</th>
                    <th>Thành viên</th>
                    <th>Đề tài · từ khóa</th>
                    <th>Bài nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((x) => (
                    <tr key={x.id}>
                      <td style={{ verticalAlign: 'top' }}>
                        <b className="mono">{x.code}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {x.name !== x.code ? x.name : ''}
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                          {x.members.map((m) => (
                            <span key={m.studentId}>
                              <span className="mono muted">{m.studentCode}</span> {m.fullName}
                              {m.role === 'LEADER' && (
                                <>
                                  {' '}
                                  <Badge tone="blue">Trưởng nhóm</Badge>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', maxWidth: 280 }}>
                        {x.topic ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{x.topic.title}</div>
                            <Keywords k={x.topic.keywords} />
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 13 }}>
                            Chưa nhập
                          </span>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        {x.submission ? (
                          <Link to={`/view/${x.submission.id}`}>
                            <Badge tone={x.submission.isLate ? 'amber' : 'green'}>{x.submission.isLate ? 'Nộp muộn' : 'Đã nộp'}</Badge>
                          </Link>
                        ) : (
                          <Badge tone="gray">Chưa nộp</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="users">{g.groups.length ? 'Không có nhóm phù hợp.' : 'Chưa có danh sách nhóm. Tải file mẫu, điền cột Nhóm rồi tải lên.'}</Empty>
          )}
        </Card>

        {g.ungrouped.length > 0 && g.groups.length > 0 && (
          <Card title={`Sinh viên chưa có nhóm (${g.ungrouped.length})`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {g.ungrouped.map((s) => (
                <span key={s.studentId} className="chip">
                  <span className="mono">{s.studentCode}</span> {s.fullName}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="col">
        <Card title={`Phản hồi nhóm chưa đúng${openReports.length ? ` (${openReports.length})` : ''}`}>
          {g.reports.length ? (
            g.reports.map((r) => (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, paddingBottom: 10, borderBottom: '1px solid #EFEDE6' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b style={{ flex: 1 }}>
                    {r.student.fullName} <span className="mono muted">{r.student.studentCode}</span>
                  </b>
                  {r.status === 'OPEN' ? <Badge tone="red">Chờ xử lý</Badge> : <Badge tone="green">Đã xử lý</Badge>}
                </div>
                <span className="muted">
                  {r.groupCode ? `Đang ở ${r.groupCode}` : 'Chưa có nhóm'} · {ddmmHHmm(r.createdAt)}
                </span>
                <span>{r.content}</span>
                {r.resolutionNote && <span className="muted">Phản hồi: {r.resolutionNote}</span>}
                {r.status === 'OPEN' && (
                  <button className="btn btn-sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setResolving(r)}>
                    <Icon name="check" size={14} />
                    Đánh dấu đã xử lý
                  </button>
                )}
              </div>
            ))
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              Chưa có phản hồi nào.
            </span>
          )}
        </Card>
        <ImportHistoryCard items={g.imports} />
      </div>
      <ResolveModal assignmentId={a.id} report={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}

function GroupPreviewCard({ p, busy, onCancel, onApply }: { p: GroupPreview; busy: boolean; onCancel: () => void; onApply: (onlyValid: boolean) => void }) {
  const fileErrors = p.errors.filter((e) => !e.row);
  const rowErrors = p.errors.filter((e) => e.row);
  const members = p.groups.reduce((n, x) => n + x.size, 0);
  return (
    <Card title={`Xem trước · ${p.fileName}`} extra={<Badge tone={p.errorRows || fileErrors.length ? 'amber' : 'green'}>{p.errorRows || fileErrors.length ? `${p.errorRows} dòng lỗi` : 'Hợp lệ'}</Badge>}>
      <div className="grid4">
        <Stat tone="blue" icon="users" label="Nhóm" value={p.groups.length} sub={`${p.groups.filter((x) => x.isNew).length} nhóm mới`} />
        <Stat tone="green" icon="user" label="SV có nhóm" value={members} sub={`trên ${p.totalRows} dòng`} />
        <Stat tone="amber" icon="refresh" label="Đổi nhóm" value={p.moved.length} sub="so với danh sách hiện tại" />
        <Stat tone="gray" icon="warn" label="Chưa có nhóm" value={p.ungrouped.length} sub="sinh viên" />
      </div>
      {fileErrors.map((e, i) => (
        <Note key={i} tone="red" icon="warn">
          {e.message}
        </Note>
      ))}
      <RowErrors errors={rowErrors} />
      <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #E3E1D9', borderRadius: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Nhóm</th>
              <th>Thành viên</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {p.groups.map((x) => (
              <tr key={x.code}>
                <td style={{ verticalAlign: 'top' }}>
                  <b className="mono">{x.code}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {x.name !== x.code ? x.name : ''}
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>
                  {x.members.map((m) => (
                    <div key={m.studentId}>
                      <span className="mono muted">{m.studentCode}</span> {m.fullName}
                      {m.leader && ' · trưởng nhóm'}
                    </div>
                  ))}
                </td>
                <td style={{ verticalAlign: 'top' }}>{x.isNew ? <Badge tone="blue">Mới</Badge> : <Badge tone="gray">Cập nhật</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.moved.length > 0 && (
        <Note tone="amber" icon="refresh">
          <b>{p.moved.length} sinh viên đổi nhóm:</b> {p.moved.map((m) => `${m.fullName} (${m.from} → ${m.to})`).join(', ')}
          {p.moved.some((m) => m.hadSubmission) && '. Nhóm cũ của một số SV đã nộp bài — bài nộp vẫn thuộc nhóm cũ.'}
        </Note>
      )}
      {p.removedGroups.length > 0 && (
        <Note tone="amber" icon="trash">
          Nhóm không còn trong file sẽ bị xóa: {p.removedGroups.map((x) => x.code).join(', ')}
        </Note>
      )}
      {p.ungrouped.length > 0 && (
        <Note tone="gray" icon="user">
          Chưa có nhóm: {p.ungrouped.map((u) => `${u.fullName}${u.reason === 'NOT_IN_FILE' ? ' (không có trong file)' : ''}`).join(', ')}
        </Note>
      )}
      <PreviewActions errorRows={p.errorRows} blocked={fileErrors.length > 0} busy={busy} onCancel={onCancel} onApply={onApply} applyLabel="Áp dụng danh sách nhóm" />
    </Card>
  );
}

function ResolveModal({ assignmentId, report, onClose }: { assignmentId: string; report: GroupList['reports'][number] | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api.post(`/lecturer/group-reports/${report!.id}/resolve`, { note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturer', 'assignment', assignmentId] });
      toast.ok('Đã báo cho sinh viên');
      setNote('');
      onClose();
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  return (
    <Modal open={!!report} onClose={onClose}>
      {report && (
        <>
          <h2 className="sec">Xử lý phản hồi của {report.student.fullName}</h2>
          <p style={{ fontSize: 14 }}>{report.content}</p>
          <div>
            <label className="lbl">Phản hồi cho sinh viên (không bắt buộc)</label>
            <textarea className="inp" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Đã chuyển bạn sang nhóm N03 trong file mới" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="btn btn-p" type="button" disabled={m.isPending} onClick={() => m.mutate()}>
              <Icon name="check" size={16} />
              Đã xử lý
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ================================================================ Bài đã nộp

function SubmissionsTab({ d }: { d: Detail }) {
  const a = d.assignment;
  const group = a.workMode === 'GROUP';
  const [search, setSearch] = useState('');
  const [newest, setNewest] = useState(true);
  const [syncFilter, setSyncFilter] = useState<'ALL' | 'ERROR' | 'PENDING' | 'SYNCED'>('ALL');
  const [show, setShow] = useState<'SUBMITTED' | 'MISSING'>('SUBMITTED');
  const submitted = d.units.filter((u) => u.submission);
  const missing = d.units.filter((u) => !u.submission);
  const syncGroup = (x: string) => (x === 'SYNCED' ? 'SYNCED' : x === 'PENDING' || x === 'UPLOADING' ? 'PENDING' : 'ERROR');
  const rows = useMemo(() => {
    const k = search.trim().toLowerCase();
    return submitted
      .filter((u) => !k || `${u.label} ${u.topic?.title ?? ''} ${u.members.map((m) => `${m.fullName} ${m.studentCode}`).join(' ')}`.toLowerCase().includes(k))
      .filter((u) => syncFilter === 'ALL' || syncGroup(u.submission!.syncStatus) === syncFilter)
      .sort((x, y) => (new Date(y.submission!.submittedAt).getTime() - new Date(x.submission!.submittedAt).getTime()) * (newest ? 1 : -1));
  }, [submitted, search, syncFilter, newest]);
  const SYNC_NEXT = { ALL: 'ERROR', ERROR: 'PENDING', PENDING: 'SYNCED', SYNCED: 'ALL' } as const;
  const SYNC_TEXT = { ALL: 'tất cả', ERROR: 'lỗi', PENDING: 'đang đồng bộ', SYNCED: 'đã đồng bộ' };
  const personalOf = (u: WorkUnit) => u.personal.length;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));
  const cols = 6 + (a.hasIndividualPart ? 1 : 0);
  const personalBtn = (u: WorkUnit) => (
    <button type="button" className="chip" style={{ cursor: 'pointer', ...(open.has(u.key) ? { background: '#FDEDED', borderColor: '#F5C2C2' } : {}) }} aria-expanded={open.has(u.key)} onClick={() => toggle(u.key)}>
      <span className="mono">
        {personalOf(u)}/{u.members.length}
      </span>
      <Icon name={open.has(u.key) ? 'chevronDown' : 'chevronRightSm'} size={14} />
    </button>
  );

  const exportList = () =>
    downloadCsv(`bai-nop-${a.section.code}.csv`, [
      [group ? 'Nhóm' : 'Sinh viên', 'Đề tài', 'Từ khóa', 'Người nộp', 'MSV người nộp', 'Nộp lúc', 'Đúng hạn', 'Sản phẩm', 'Drive'],
      ...rows.map((u) => [
        u.label,
        u.topic?.title ?? '',
        u.topic?.keywords.join(', ') ?? '',
        u.submission!.submittedBy,
        u.submission!.submittedByCode,
        fullDT(u.submission!.submittedAt),
        u.submission!.isLate ? `Muộn ${u.submission!.lateDays} ngày` : 'Đúng hạn',
        filesText(u),
        SYNC_BADGE[u.submission!.syncStatus]?.label ?? u.submission!.syncStatus,
      ]),
    ]);

  return (
    <Card
      title={
        <Tabs<'SUBMITTED' | 'MISSING'>
          value={show}
          onChange={setShow}
          items={[
            { key: 'SUBMITTED', label: `Đã nộp (${submitted.length})` },
            { key: 'MISSING', label: `Chưa nộp (${missing.length})` },
          ]}
        />
      }
      body={false}
      extra={
        show === 'SUBMITTED' && (
          <button className="btn btn-sm" type="button" onClick={exportList} disabled={!rows.length}>
            <Icon name="download" size={14} />
            Xuất danh sách
          </button>
        )
      }
    >
      {show === 'SUBMITTED' ? (
        <>
          <div style={{ padding: '12px 20px', display: 'flex', gap: 10, borderBottom: '1px solid #EFEDE6', flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchBox value={search} onChange={setSearch} placeholder={group ? 'Tìm nhóm, đề tài, sinh viên…' : 'Tìm sinh viên, đề tài…'} />
            <button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setNewest((v) => !v)}>
              Sắp xếp: {newest ? 'mới nộp' : 'nộp sớm nhất'}
            </button>
            <button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setSyncFilter((v) => SYNC_NEXT[v])}>
              Đồng bộ: {SYNC_TEXT[syncFilter]}
            </button>
          </div>
          {rows.length ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{group ? 'Nhóm · đề tài' : 'Sinh viên · đề tài'}</th>
                    <th>Người nộp</th>
                    <th>Nộp lúc</th>
                    <th>Sản phẩm</th>
                    {a.hasIndividualPart && <th>Phần cá nhân</th>}
                    <th>Drive</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const sb = u.submission!;
                    const sync = SYNC_BADGE[sb.syncStatus] ?? { label: sb.syncStatus, tone: 'gray' as const };
                    return (
                      <Fragment key={u.key}>
                      <tr>
                        <td>
                          <b>{u.label}</b> <NoteMarks isSample={!!sb.note?.isSample} hasNote={!!sb.note?.hasText} />
                          <div className="muted" style={{ fontSize: 12 }}>
                            {u.topic?.title ?? '—'}
                          </div>
                        </td>
                        <td>
                          <PersonCell name={sb.submittedBy} size={26} />
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{ddmmHHmm(sb.submittedAt)}</div>
                          {sb.isLate ? <Badge tone="amber">Muộn {sb.lateDays} ngày</Badge> : <Badge tone="green">Đúng hạn</Badge>}
                        </td>
                        <td>
                          <span style={{ fontSize: 13 }}>{filesText(u)}</span>
                        </td>
                        {a.hasIndividualPart && <td>{u.type === 'GROUP' ? personalBtn(u) : <span className="muted">—</span>}</td>}
                        <td>
                          <Badge tone={sync.tone}>{sync.label}</Badge>
                        </td>
                        <td>
                          <Link className="btn btn-sm" to={`/view/${sb.id}`}>
                            <Icon name="eye" size={14} />
                            Xem
                          </Link>
                        </td>
                      </tr>
                      {open.has(u.key) && (
                        <tr>
                          <td colSpan={cols} style={{ background: '#FAFAF7', padding: '4px 20px 12px 36px' }}>
                            <PersonalParts u={u} dueAt={a.dueAt} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="upload">{submitted.length ? 'Không có bài nộp phù hợp.' : 'Chưa có bài nộp nào.'}</Empty>
          )}
          <div className="muted" style={{ padding: '12px 20px', fontSize: 13, borderTop: '1px solid #EFEDE6' }}>
            Hiển thị {rows.length} / {submitted.length} bài nộp
          </div>
        </>
      ) : missing.length ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>{group ? 'Nhóm' : 'Sinh viên'}</th>
                {group && <th>Thành viên</th>}
                <th>Đề tài</th>
                {group && a.hasIndividualPart && <th>Phần cá nhân</th>}
              </tr>
            </thead>
            <tbody>
              {missing.map((u) => (
                <Fragment key={u.key}>
                  <tr>
                    <td>{group ? <b className="mono">{u.label}</b> : <PersonCell name={u.members[0].fullName} code={u.members[0].studentCode} />}</td>
                    {group && <td style={{ fontSize: 13 }}>{u.members.map((m) => m.fullName).join(', ')}</td>}
                    <td style={{ fontSize: 13 }}>{u.topic?.title ?? <span className="muted">Chưa nhập</span>}</td>
                    {group && a.hasIndividualPart && <td>{personalBtn(u)}</td>}
                  </tr>
                  {open.has(u.key) && (
                    <tr>
                      <td colSpan={4} style={{ background: '#FAFAF7', padding: '4px 20px 12px 36px' }}>
                        <PersonalParts u={u} dueAt={a.dueAt} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="check">{d.units.length ? 'Tất cả đã nộp bài.' : group ? 'Chưa có danh sách nhóm.' : 'Lớp chưa có sinh viên.'}</Empty>
      )}
    </Card>
  );
}

/** Biểu tượng bài có ghi chú riêng / được đánh dấu bài mẫu. */
function NoteMarks({ isSample, hasNote }: { isSample: boolean; hasNote: boolean }) {
  if (!isSample && !hasNote) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, verticalAlign: 'middle' }}>
      {isSample && (
        <span title="Bài mẫu" style={{ color: '#D97706', display: 'inline-flex' }}>
          <Icon name="star" size={14} />
        </span>
      )}
      {hasNote && (
        <span title="Có ghi chú của bạn" style={{ color: '#62666F', display: 'inline-flex' }}>
          <Icon name="note" size={14} />
        </span>
      )}
    </span>
  );
}

/** Phần cá nhân của từng thành viên trong bài nhóm – chỉ GV và người nộp xem được. */
function PersonalParts({ u, dueAt }: { u: WorkUnit; dueAt: string }) {
  return (
    <table style={{ background: 'transparent' }}>
      <thead>
        <tr>
          <th style={{ background: 'transparent' }}>Thành viên</th>
          <th style={{ background: 'transparent' }}>Phần cá nhân</th>
          <th style={{ background: 'transparent' }}>Đóng góp tự đánh giá</th>
          <th style={{ background: 'transparent' }}></th>
        </tr>
      </thead>
      <tbody>
        {u.members.map((m) => {
          const p = u.personal.find((x) => x.studentId === m.studentId);
          const late = p ? Math.max(1, Math.ceil((new Date(p.submittedAt).getTime() - new Date(dueAt).getTime()) / 86400_000)) : 0;
          return (
            <tr key={m.studentId}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PersonCell name={m.fullName} code={m.studentCode} size={26} />
                  {p && <NoteMarks isSample={p.isSample} hasNote={p.hasNote} />}
                </div>
              </td>
              <td style={{ fontSize: 13 }}>
                {p ? (
                  <>
                    Nộp {ddmmHHmm(p.submittedAt)} · {p.fileCount} tệp{' '}
                    {p.isLate ? <Badge tone="amber">Muộn {late} ngày</Badge> : <Badge tone="green">Đúng hạn</Badge>}
                  </>
                ) : (
                  <Badge tone="gray">Chưa nộp</Badge>
                )}
              </td>
              <td className="mono" style={{ fontSize: 13 }}>
                {p?.contributionPercent != null ? `${p.contributionPercent}%` : '—'}
              </td>
              <td>
                {p && (
                  <Link className="btn btn-sm" to={`/view/${p.id}`}>
                    <Icon name="eye" size={14} />
                    Xem
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ================================================================ Điểm (Excel)

function GradesTab({ d }: { d: Detail }) {
  const a = d.assignment;
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState<AssignmentGradePreview | null>(null);
  const [search, setSearch] = useState('');
  const key = ['lecturer', 'assignment', a.id, 'grades'];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<AssignmentGrades>(`/lecturer/assignments/${a.id}/grades`).then((r) => r.data) });
  const after = (data: AssignmentGrades, msg: string) => {
    qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ['lecturer', 'assignment', a.id], exact: true });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    toast.ok(msg);
  };
  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      return api.post<AssignmentGradePreview>(`/lecturer/assignments/${a.id}/grades/import/preview`, fd).then((r) => r.data);
    },
    onSuccess: setPreview,
    onError: (e) => toast.err(errorMessage(e)),
  });
  const commit = useMutation({
    mutationFn: (onlyValid: boolean) => api.post<AssignmentGrades>(`/lecturer/assignments/${a.id}/grades/import/${preview!.jobId}/commit`, { onlyValid }).then((r) => r.data),
    onSuccess: (data) => {
      setPreview(null);
      after(data, a.gradesPublishedAt ? 'Đã cập nhật điểm, SV bị đổi điểm đã nhận thông báo' : 'Đã lưu điểm (chưa công bố)');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  const publish = useMutation({
    mutationFn: () => api.post<AssignmentGrades>(`/lecturer/assignments/${a.id}/grades/publish`).then((r) => r.data),
    onSuccess: (data) => after(data, 'Đã công bố điểm cho sinh viên'),
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (q.isLoading || !q.data) return <div className="skeleton" style={{ height: 280 }} />;
  const g = q.data;
  const k = search.trim().toLowerCase();
  const rows = g.rows.filter((r) => !k || `${r.studentCode} ${r.fullName} ${r.group ?? ''} ${r.topic ?? ''}`.toLowerCase().includes(k));
  const maxBin = Math.max(1, ...g.stats.histogram.map((b) => b.count));

  return (
    <div className="cols-2-1">
      <div className="col">
        {preview ? (
          <Card title={`Xem trước · ${preview.fileName}`} extra={<Badge tone={preview.errorRows ? 'amber' : 'green'}>{preview.errorRows ? `${preview.errorRows} dòng lỗi` : 'Hợp lệ'}</Badge>}>
            <div className="grid4">
              <Stat tone="green" icon="check" label="Có điểm" value={preview.withScore} sub="sinh viên" />
              <Stat tone="gray" icon="file" label="Để trống" value={preview.empty} sub="chưa có điểm" />
              <Stat tone="blue" icon="refresh" label="Thay đổi" value={preview.changed} sub="so với điểm hiện tại" />
              <Stat tone="amber" icon="warn" label="Không có trong file" value={preview.missing.length} sub="giữ điểm cũ" />
            </div>
            <RowErrors errors={preview.errors} />
            <div className="tbl-wrap" style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #E3E1D9', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Sinh viên</th>
                    <th>Điểm</th>
                    <th>Nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.studentId} style={r.changed ? { background: '#FFFDF5' } : undefined}>
                      <td>
                        <span className="mono muted">{r.studentCode}</span> {r.fullName}
                      </td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                        {r.oldScore !== r.score && r.oldScore != null && <span className="muted" style={{ textDecoration: 'line-through', marginRight: 6 }}>{score10(r.oldScore)}</span>}
                        <b>{score10(r.score)}</b>
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 320 }}>{r.note ?? <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PreviewActions errorRows={preview.errorRows} busy={commit.isPending} onCancel={() => setPreview(null)} onApply={(v) => commit.mutate(v)} applyLabel="Lưu điểm" />
          </Card>
        ) : (
          <ExcelUpload
            title={g.stats.graded ? 'Tải lên lại file điểm' : 'Tải lên file điểm'}
            templateUrl={`/lecturer/assignments/${a.id}/grades/template`}
            templateName={`Diem_${a.section.code}.xlsx`}
            onFile={(f) => upload.mutate(f)}
            busy={upload.isPending}
            hint="Điền cột Điểm (thang 10) và Nhận xét trong file mẫu · tải lên lại sẽ ghi đè điểm cũ"
          />
        )}

        <Card title={`Bảng điểm (${g.stats.graded}/${g.stats.students})`} body={false}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #EFEDE6' }}>
            <SearchBox value={search} onChange={setSearch} placeholder="Tìm sinh viên, nhóm, đề tài…" />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  {a.workMode === 'GROUP' && <th>Nhóm</th>}
                  <th>Đề tài</th>
                  <th>Điểm</th>
                  <th>Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      <PersonCell name={r.fullName} code={r.studentCode} size={28} />
                    </td>
                    {a.workMode === 'GROUP' && <td className="mono">{r.group ?? '—'}</td>}
                    <td style={{ fontSize: 13, maxWidth: 220 }}>{r.topic ?? <span className="muted">—</span>}</td>
                    <td>
                      <b className="mono" style={{ color: r.score != null && r.score < 4 ? '#B42318' : undefined }}>
                        {score10(r.score)}
                      </b>
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 280 }}>{r.note ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="col">
        <Card title="Công bố điểm">
          <RowKV label="Có điểm">
            {g.stats.graded} / {g.stats.students}
          </RowKV>
          <RowKV label="Trung bình">{score10(g.stats.avg)}</RowKV>
          <RowKV label="Cao nhất · thấp nhất">
            {score10(g.stats.max)} · {score10(g.stats.min)}
          </RowKV>
          <RowKV label="Trạng thái">{g.publishedAt ? <Badge tone="green">Đã công bố {ddmm(g.publishedAt)}</Badge> : <Badge tone="gray">Chưa công bố</Badge>}</RowKV>
          {!g.publishedAt ? (
            <button
              className="btn btn-p"
              type="button"
              style={{ width: '100%' }}
              disabled={!g.stats.graded || publish.isPending}
              onClick={() => confirm(`Công bố điểm cho ${g.stats.graded} sinh viên? Sinh viên sẽ thấy điểm và nhận xét.`) && publish.mutate()}
            >
              <Icon name="check" size={16} />
              Công bố điểm
            </button>
          ) : (
            <Note tone="green" icon="check">
              Sinh viên đã thấy điểm và nhận xét. Tải lên lại file điểm sẽ cập nhật và báo cho SV bị đổi điểm.
            </Note>
          )}
        </Card>
        {g.stats.graded > 0 && (
          <Card title="Phân bố điểm">
            {g.stats.histogram.map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 44 }} className="muted">
                  {b.label}
                </span>
                <div className="bar" style={{ flex: 1, height: 10 }}>
                  <div style={{ width: `${(b.count / maxBin) * 100}%`, background: b.label === '<4' ? '#B42318' : '#DB0000' }} />
                </div>
                <span className="mono" style={{ width: 24, textAlign: 'right' }}>
                  {b.count}
                </span>
              </div>
            ))}
          </Card>
        )}
        <ImportHistoryCard items={g.imports} />
      </div>
    </div>
  );
}

