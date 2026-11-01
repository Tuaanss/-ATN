import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Badge, Card, Empty, KV, Loading, Note, PageHead, Switch, Tabs, useToast, type Tone } from '../../components/ui';
import { fullDT, score10 } from '../../utils/format';
import { Count, FormModal, SearchBox, Select, Table, Toolbar, useAct, useAdmin, useConfirm } from './kit';

// ================================================================ nhật ký hệ thống (UC02.12)

interface Log {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  oldData: unknown;
  newData: unknown;
  actor: { username: string; role: string; name: string } | null;
}
const ROLE: Record<string, [string, Tone]> = { ADMIN: ['Admin', 'red'], LECTURER: ['GV', 'blue'], STUDENT: ['SV', 'green'], PARENT: ['PH', 'amber'], ENTERPRISE: ['DN', 'dark'] };
const ACTION: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  PASSWORD_CHANGE: 'Đổi mật khẩu',
  PASSWORD_RESET: 'Quên mật khẩu',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  CREATE_ACCOUNT: 'Tạo tài khoản',
  UPDATE_ACCOUNT: 'Sửa tài khoản',
  LOCK_ACCOUNT: 'Khóa tài khoản',
  UNLOCK_ACCOUNT: 'Mở khóa tài khoản',
  IMPORT_STUDENTS: 'Import sinh viên',
  IMPORT_LECTURERS: 'Import giảng viên',
  IMPORT_COURSES: 'Import môn học',
  IMPORT_SECTIONS: 'Import lớp học phần',
  CHANGE_PARENT_PHONE: 'Đổi SĐT phụ huynh',
  CREATE_CATALOG: 'Thêm danh mục',
  UPDATE_CATALOG: 'Sửa danh mục',
  DELETE_CATALOG: 'Xóa danh mục',
  CREATE_SEMESTER: 'Thêm học kỳ',
  UPDATE_SEMESTER: 'Sửa học kỳ',
  DELETE_SEMESTER: 'Xóa học kỳ',
  SET_CURRENT_SEMESTER: 'Đặt học kỳ hiện tại',
  CREATE_COURSE: 'Thêm môn học',
  UPDATE_COURSE: 'Sửa môn học',
  DELETE_COURSE: 'Xóa môn học',
  CREATE_SECTION: 'Mở lớp học phần',
  UPDATE_SECTION: 'Sửa lớp học phần',
  DELETE_SECTION: 'Xóa lớp học phần',
  ASSIGN_STUDENTS: 'Xếp SV vào lớp',
  REMOVE_STUDENT: 'Gỡ SV khỏi lớp',
  REGISTER_ENTERPRISE: 'DN đăng ký',
  ENTERPRISE_APPROVE: 'Duyệt DN',
  ENTERPRISE_REJECT: 'Từ chối DN',
  ENTERPRISE_LOCK: 'Khóa DN',
  ENTERPRISE_UNLOCK: 'Mở khóa DN',
  UPDATE_CONFIG: 'Sửa cấu hình',
  FEEDBACK_CREATE: 'GV nhận xét bài',
  FEEDBACK_UPDATE: 'GV sửa nhận xét bài',
  VIEW_REQUEST: 'DN gửi yêu cầu xem bài',
  VIEW_REQUEST_APPROVE: 'Duyệt yêu cầu xem bài',
  VIEW_REQUEST_REJECT: 'Từ chối yêu cầu xem bài',
  VIEW_REQUEST_REVOKE: 'Thu hồi quyền xem bài',
  ENTERPRISE_INVITE: 'DN mời phỏng vấn',
  DISCOVERABLE: 'Đổi chế độ tìm thấy',
  GRADE_CHANGED: 'Duyệt sửa điểm',
  GRADE_REQUEST_REJECTED: 'Từ chối sửa điểm',
  PUBLISH: 'Công bố bài tập',
  DRIVE_LINK: 'Kết nối Drive',
  DRIVE_REORGANIZE: 'Sắp xếp thư mục Drive',
  IMPORT_GROUPS: 'Import nhóm',
  PROFILE_COMPLETE: 'Khai báo hồ sơ',
  PROFILE_UPDATE: 'Cập nhật hồ sơ',
};
const actLabel = (a: string) => ACTION[a] ?? a.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const actTone = (a: string): Tone => (/DELETE|LOCK(?!_ACCOUNT_UN)|REJECT|REMOVE/.test(a) && !/UNLOCK/.test(a) ? 'red' : /UPDATE|CHANGE|RESET/.test(a) ? 'amber' : /CREATE|APPROVE|IMPORT|ASSIGN|PUBLISH|REGISTER/.test(a) ? 'green' : 'gray');

export function LogsPage() {
  useCrumbs([{ label: 'Nhật ký hệ thống' }]);
  const toast = useToast();
  const [f, setF] = useState({ q: '', role: '', action: '', from: '', to: '' });
  const [qd, setQd] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<Log | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQd(f.q), 300);
    return () => clearTimeout(t);
  }, [f.q]);
  const qs = new URLSearchParams({ ...(qd && { q: qd }), ...(f.role && { role: f.role }), ...(f.action && { action: f.action }), ...(f.from && { from: f.from }), ...(f.to && { to: f.to }), page: String(page) }).toString();
  const q = useQuery({ queryKey: ['admin', 'logs', qs], queryFn: () => api.get<{ total: number; page: number; pages: number; actions: string[]; rows: Log[] }>(`/admin/logs?${qs}`).then((r) => r.data), placeholderData: keepPreviousData });
  const set = (k: keyof typeof f) => (v: string) => {
    setF({ ...f, [k]: v });
    setPage(1);
  };
  const exportCsv = async () => {
    const out: Log[] = [];
    for (let p = 1; p <= Math.min(q.data?.pages ?? 1, 50); p++) {
      const base = new URLSearchParams(qs);
      base.set('page', String(p));
      out.push(...(await api.get<{ rows: Log[] }>(`/admin/logs?${base}`)).data.rows);
    }
    const c = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [['Thời gian', 'Người dùng', 'Vai trò', 'Thao tác', 'Đối tượng', 'Mô tả', 'Dữ liệu cũ', 'Dữ liệu mới'], ...out.map((l) => [fullDT(l.createdAt), l.actor?.username, l.actor?.role, actLabel(l.action), `${l.entityType}${l.entityId ? ` ${l.entityId}` : ''}`, l.summary, l.oldData ? JSON.stringify(l.oldData) : '', l.newData ? JSON.stringify(l.newData) : ''])].map((r) => r.map(c).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'nhat_ky_he_thong.csv';
    a.click();
    toast.ok(`Đã xuất ${out.length} bản ghi.`);
  };
  const d = q.data;
  return (
    <div className="page">
      <PageHead
        title="Nhật ký hệ thống"
        actions={
          <button className="btn" onClick={exportCsv} disabled={!d?.total}>
            <Icon name="download" size={18} /> Xuất CSV
          </button>
        }
      />
      <Card body={false}>
        <Toolbar>
          <SearchBox value={f.q} onChange={set('q')} placeholder="Người dùng, mô tả…" />
          <Select label="Vai trò" value={f.role} onChange={set('role')} style={{ minWidth: 130 }}>
            <option value="">Mọi vai trò</option>
            <option value="ADMIN">Admin</option>
            <option value="LECTURER">Giảng viên</option>
            <option value="STUDENT">Sinh viên</option>
            <option value="PARENT">Phụ huynh</option>
            <option value="ENTERPRISE">Doanh nghiệp</option>
          </Select>
          <Select label="Loại thao tác" value={f.action} onChange={set('action')}>
            <option value="">Mọi thao tác</option>
            {d?.actions.map((a) => (
              <option key={a} value={a}>
                {actLabel(a)}
              </option>
            ))}
          </Select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="muted">
            Từ <input className="inp" type="date" value={f.from} onChange={(e) => set('from')(e.target.value)} style={{ width: 150, height: 40 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="muted">
            đến <input className="inp" type="date" value={f.to} onChange={(e) => set('to')(e.target.value)} style={{ width: 150, height: 40 }} />
          </label>
          <button
            className="btn btn-g btn-sm"
            onClick={() => {
              setF({ q: '', role: '', action: '', from: '', to: '' });
              setPage(1);
            }}
          >
            Xóa lọc
          </button>
        </Toolbar>
        {!d ? (
          <div style={{ padding: 24 }}>
            <span className="spinner" />
          </div>
        ) : (
          <>
            <Table
              rows={d.rows}
              rowKey={(l) => l.id}
              pageSize={1000}
              onRow={setView}
              empty="Không có bản ghi phù hợp bộ lọc."
              cols={[
                { h: 'Thời gian', r: (l) => <span className="mono" style={{ fontSize: 13 }}>{fullDT(l.createdAt)}</span> },
                {
                  h: 'Người thực hiện',
                  r: (l) =>
                    l.actor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone={ROLE[l.actor.role]?.[1] ?? 'gray'}>{ROLE[l.actor.role]?.[0] ?? l.actor.role}</Badge>
                        <span className="mono" style={{ fontSize: 13 }}>
                          {l.actor.username}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">Hệ thống</span>
                    ),
                },
                { h: 'Thao tác', r: (l) => <Badge tone={actTone(l.action)}>{actLabel(l.action)}</Badge> },
                {
                  h: 'Đối tượng',
                  r: (l) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{l.summary}</span>
                      <span className="muted mono" style={{ fontSize: 12 }}>
                        {l.entityType}
                      </span>
                    </div>
                  ),
                },
                { h: '', align: 'right', r: () => <span className="muted"><Icon name="chevronRight" size={16} /></span> },
              ]}
            />
            {d.pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #EFEDE6', fontSize: 13 }}>
                <span className="muted">{d.total.toLocaleString('vi-VN')} bản ghi</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước">
                    <Icon name="chevronLeft" size={14} />
                  </button>
                  <span style={{ padding: '0 6px' }}>
                    {d.page}/{d.pages}
                  </span>
                  <button className="btn btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)} aria-label="Trang sau">
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      {view && (
        <FormModal title={`Chi tiết nhật ký #${view.id}`} width={720} onClose={() => setView(null)} foot={<button className="btn" onClick={() => setView(null)}>Đóng</button>}>
          <KV
            rows={[
              ['Thời gian', <span className="mono">{fullDT(view.createdAt)}</span>],
              ['Người thực hiện', view.actor ? <>{view.actor.name} <span className="mono muted">({view.actor.username})</span></> : 'Hệ thống'],
              ['Thao tác', <>{actLabel(view.action)} <span className="muted mono" style={{ fontSize: 12 }}>({view.action})</span></>],
              ['Đối tượng', <>{view.entityType} <span className="muted mono" style={{ fontSize: 12 }}>{view.entityId}</span></>],
              ['Mô tả', view.summary ?? '—'],
            ]}
          />
          {(view.oldData != null || view.newData != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
              {[
                ['Dữ liệu cũ', view.oldData, '#FFF8F7'],
                ['Dữ liệu mới', view.newData, '#F4FBF6'],
              ].map(([t, v, bg]) => (
                <div key={String(t)} className="card" style={{ background: String(bg) }}>
                  <div className="card-h" style={{ padding: '10px 14px' }}>
                    <h2 style={{ fontSize: 13 }}>{String(t)}</h2>
                  </div>
                  <pre className="mono" style={{ margin: 0, padding: '12px 14px', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto' }}>
                    {v == null ? '(không có)' : JSON.stringify(v, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </FormModal>
      )}
    </div>
  );
}

// ================================================================ cấu hình (UC02.13)

type Scale = [number, string, number][];
interface Config {
  files: { imageMaxMB: number; imageMax: number; videoMaxMB: number; videoMax: number; sourceMaxMB: number; sourceMax: number; documentMaxMB: number; documentMax: number; linkDomains: string[] };
  grading: { scale: Scale; retake: 'HIGHEST' | 'LATEST' };
  security: { maxFailed: number; lockMinutes: number; forceChangeFirstLogin: boolean };
  warning: { scoreThreshold: number; gpaDrop: number };
  enterprise: { viewDaysMin: number; viewDaysMax: number };
  reminder: { hours: number };
  email: { sender: string };
}

function Set({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '12px 0', borderBottom: '1px solid #F1F0EA', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px' }}>
        <b style={{ fontSize: 14 }}>{title}</b>
        {desc && (
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {desc}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  );
}
function Num({ value, onChange, unit, min, max, step = 1 }: { value: number; onChange: (v: number) => void; unit: string; min: number; max: number; step?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #D6D3C8', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(+e.target.value)} style={{ width: 90, height: 40, border: 0, outline: 0, padding: '0 10px', font: "500 14px 'Be Vietnam Pro',sans-serif" }} />
      <span style={{ padding: '0 10px', fontSize: 13, color: '#62666F', background: '#FAFAF7', height: 40, display: 'flex', alignItems: 'center', borderLeft: '1px solid #E3E1D9' }}>{unit}</span>
    </div>
  );
}
const SEC: [string, string][] = [
  ['c-tep', 'Tệp nộp bài'],
  ['c-diem', 'Thang điểm & GPA'],
  ['c-bm', 'Bảo mật đăng nhập'],
  ['c-cb', 'Cảnh báo học tập'],
  ['c-dn', 'Quyền xem của DN'],
  ['c-mail', 'Email & nhắc hạn'],
];

export function ConfigPage() {
  useCrumbs([{ label: 'Cấu hình hệ thống' }]);
  const q = useAdmin<{ value: Config; defaults: Config; updatedAt: string | null }>('/config');
  const act = useAct();
  const toast = useToast();
  const confirm = useConfirm();
  const [c, setC] = useState<Config | null>(null);
  const [domains, setDomains] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (q.data && !c) {
      setC(q.data.value);
      setDomains(q.data.value.files.linkDomains.join(', '));
    }
  }, [q.data, c]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  if (!q.data || !c) return <Loading />;
  const up = <K extends keyof Config>(k: K, v: Partial<Config[K]>) => {
    setC({ ...c, [k]: { ...c[k], ...v } });
    setDirty(true);
  };
  const scale = c.grading.scale;
  const setScale = (i: number, j: 0 | 1 | 2, v: string) => up('grading', { scale: scale.map((r, k) => (k === i ? (r.map((x, m) => (m === j ? (j === 1 ? v : +v) : x)) as Scale[number]) : r)) });
  const scaleOk = scale.every((r, i) => r[1].trim() && (i === 0 || (r[0] < scale[i - 1][0] && r[2] <= scale[i - 1][2]))) && scale[scale.length - 1][0] === 0;
  const save = async () => {
    const errs: string[] = [];
    if (!scaleOk) errs.push('Thang điểm chưa hợp lệ: ngưỡng phải giảm dần, mức cuối là 0, điểm chữ không để trống.');
    if (c.enterprise.viewDaysMax < c.enterprise.viewDaysMin) errs.push('Thời hạn DN: tối đa phải ≥ tối thiểu.');
    if (!/^.+@.+\..+|<.+@.+>/.test(c.email.sender)) errs.push('Địa chỉ gửi email không hợp lệ.');
    if (errs.length) return toast.err(errs[0]);
    const value = { ...c, files: { ...c.files, linkDomains: domains.split(',').map((s) => s.trim()).filter(Boolean) } };
    const r = (await act.mutateAsync({ method: 'put', path: 'config', body: value, ok: 'Đã lưu cấu hình.' }).catch(() => null)) as { value: Config } | null;
    if (r) {
      setC(r.value);
      setDirty(false);
    }
  };
  const reset = async () => {
    if (!(await confirm({ title: 'Khôi phục mặc định', msg: <>Đặt lại toàn bộ cấu hình về giá trị đề xuất? Bạn vẫn cần bấm <b>Lưu cấu hình</b> để áp dụng.</>, ok: 'Khôi phục' }))) return;
    setC(q.data!.defaults);
    setDomains(q.data!.defaults.files.linkDomains.join(', '));
    setDirty(true);
  };
  const head = (icon: IconName, t: string) => (
    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0 4px' }}>
      <Icon name={icon} size={16} /> {t}
    </h3>
  );
  return (
    <div className="page">
      <PageHead title="Cấu hình hệ thống" />
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', gap: 24, alignItems: 'start' }} className="cols-side">
        <nav aria-label="Mục cấu hình" style={{ position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SEC.map(([id, l]) => (
            <a key={id} href={`#${id}`} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 14, color: '#30343B' }}>
              {l}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span id="c-tep" />
          <Card title="Tệp nộp bài">
            {head('image', 'Ảnh thiết kế')}
            <Set title="Dung lượng tối đa mỗi ảnh">
              <Num value={c.files.imageMaxMB} onChange={(v) => up('files', { imageMaxMB: v })} unit="MB" min={1} max={100} />
            </Set>
            <Set title="Số ảnh tối đa mỗi bài nộp">
              <Num value={c.files.imageMax} onChange={(v) => up('files', { imageMax: v })} unit="ảnh" min={1} max={100} />
            </Set>
            {head('video', 'Video & mã nguồn')}
            <Set title="Dung lượng video tối đa" desc="Video lớn được tải lên Drive theo kiểu resumable upload.">
              <Num value={c.files.videoMaxMB} onChange={(v) => up('files', { videoMaxMB: v })} unit="MB" min={1} max={2000} />
              <Num value={c.files.videoMax} onChange={(v) => up('files', { videoMax: v })} unit="tệp" min={1} max={20} />
            </Set>
            <Set title="Dung lượng mã nguồn tối đa" desc="Tệp nén .zip, .rar, .7z.">
              <Num value={c.files.sourceMaxMB} onChange={(v) => up('files', { sourceMaxMB: v })} unit="MB" min={1} max={500} />
              <Num value={c.files.sourceMax} onChange={(v) => up('files', { sourceMax: v })} unit="tệp" min={1} max={20} />
            </Set>
            <Set title="Báo cáo (PDF, DOC, DOCX)">
              <Num value={c.files.documentMaxMB} onChange={(v) => up('files', { documentMaxMB: v })} unit="MB" min={1} max={100} />
              <Num value={c.files.documentMax} onChange={(v) => up('files', { documentMax: v })} unit="tệp" min={1} max={20} />
            </Set>
            <Set title="Tên miền link được chấp nhận" desc="Phân cách bằng dấu phẩy.">
              <input
                className="inp mono"
                style={{ width: 320 }}
                value={domains}
                onChange={(e) => {
                  setDomains(e.target.value);
                  setDirty(true);
                }}
              />
            </Set>
          </Card>
          <span id="c-diem" />
          <Card title="Thang điểm & quy đổi GPA">
            <div className="tbl-wrap" style={{ border: '1px solid #E3E1D9', borderRadius: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Điểm chữ</th>
                    <th>Từ điểm (thang 10)</th>
                    <th>Đến</th>
                    <th>Thang 4</th>
                  </tr>
                </thead>
                <tbody>
                  {scale.map(([min, chu, h4], i) => (
                    <tr key={i}>
                      <td>
                        <input className="inp mono" style={{ width: 80, height: 36 }} value={chu} onChange={(e) => setScale(i, 1, e.target.value)} aria-label="Điểm chữ" />
                      </td>
                      <td>
                        <input className="inp" style={{ width: 110, height: 36 }} type="number" step={0.1} min={0} max={10} value={min} readOnly={i === scale.length - 1} onChange={(e) => setScale(i, 0, e.target.value)} aria-label="Từ điểm" />
                      </td>
                      <td className="muted mono">{i ? score10(Math.round((scale[i - 1][0] - 0.1) * 10) / 10) : '10,0'}</td>
                      <td>
                        <input className="inp" style={{ width: 90, height: 36 }} type="number" step={0.5} min={0} max={4} value={h4} onChange={(e) => setScale(i, 2, e.target.value)} aria-label="Thang 4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!scaleOk && <div className="err">Ngưỡng điểm phải giảm dần từ trên xuống, điểm chữ không để trống.</div>}
            <Set title="Môn học lại" desc="Cách lấy điểm khi tính GPA tích lũy (CPA).">
              <select className="inp" style={{ width: 260 }} value={c.grading.retake} onChange={(e) => up('grading', { retake: e.target.value as Config['grading']['retake'] })}>
                <option value="HIGHEST">Lấy điểm cao nhất</option>
                <option value="LATEST">Lấy điểm lần học gần nhất</option>
              </select>
            </Set>
            <Note tone="blue" icon="info" style={{ marginTop: 10 }}>
              GPA / CPA = Σ(điểm hệ 4 × số tín chỉ) / Σ số tín chỉ. Thay đổi thang điểm áp dụng cho các lần tính điểm tiếp theo.
            </Note>
          </Card>
          <span id="c-bm" />
          <Card title="Bảo mật đăng nhập">
            <Set title="Số lần nhập sai mật khẩu tối đa" desc="Vượt quá thì tạm khóa tài khoản.">
              <Num value={c.security.maxFailed} onChange={(v) => up('security', { maxFailed: v })} unit="lần" min={3} max={20} />
            </Set>
            <Set title="Thời gian tạm khóa">
              <Num value={c.security.lockMinutes} onChange={(v) => up('security', { lockMinutes: v })} unit="phút" min={1} max={1440} />
            </Set>
            <Set title="Bắt buộc đổi mật khẩu lần đầu" desc="Áp dụng cho tài khoản do hệ thống sinh (SV, PH, GV).">
              <Switch checked={c.security.forceChangeFirstLogin} onChange={(v) => up('security', { forceChangeFirstLogin: v })} label="Bắt buộc đổi mật khẩu lần đầu" />
            </Set>
          </Card>
          <span id="c-cb" />
          <Card title="Cảnh báo học tập gửi phụ huynh">
            <Set title="Ngưỡng điểm cảnh báo" desc="Gửi cảnh báo khi điểm thành phần / học phần thấp hơn ngưỡng.">
              <Num value={c.warning.scoreThreshold} onChange={(v) => up('warning', { scoreThreshold: v })} unit="điểm" min={0} max={10} step={0.1} />
            </Set>
            <Set title="GPA giảm so với kỳ trước" desc="Cảnh báo khi GPA học kỳ giảm từ mức này trở lên.">
              <Num value={c.warning.gpaDrop} onChange={(v) => up('warning', { gpaDrop: v })} unit="điểm" min={0} max={4} step={0.1} />
            </Set>
            <Set title="Quá hạn nộp bài" desc="Luôn gửi khi con quá hạn mà chưa nộp.">
              <Badge tone="green">Luôn bật</Badge>
            </Set>
          </Card>
          <span id="c-dn" />
          <Card title="Quyền xem bài của doanh nghiệp">
            <Set title="Thời hạn xem bài" desc="Admin chọn trong khoảng này khi duyệt yêu cầu.">
              <Num value={c.enterprise.viewDaysMin} onChange={(v) => up('enterprise', { viewDaysMin: v })} unit="ngày" min={1} max={365} />
              <Num value={c.enterprise.viewDaysMax} onChange={(v) => up('enterprise', { viewDaysMax: v })} unit="ngày" min={1} max={365} />
            </Set>
          </Card>
          <span id="c-mail" />
          <Card title="Email hệ thống">
            <Set title="Địa chỉ gửi" desc="Dùng cho thông báo, đặt lại mật khẩu.">
              <input className="inp" style={{ width: 320 }} value={c.email.sender} onChange={(e) => up('email', { sender: e.target.value })} />
            </Set>
            <Set title="Nhắc hạn nộp bài trước" desc="Sinh viên chưa nộp nhận nhắc nhở trước hạn.">
              <Num value={c.reminder.hours} onChange={(v) => up('reminder', { hours: v })} unit="giờ" min={1} max={168} />
            </Set>
          </Card>
          <div className="card" style={{ position: 'sticky', bottom: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {dirty ? (
                <span style={{ color: '#B45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="warn" size={14} /> Có thay đổi chưa lưu
                </span>
              ) : q.data.updatedAt ? (
                `Lưu lần cuối ${fullDT(q.data.updatedAt)}`
              ) : (
                'Đang dùng cấu hình mặc định.'
              )}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" type="button" onClick={reset}>
                Khôi phục mặc định
              </button>
              <button className="btn btn-p" type="button" disabled={act.isPending || !dirty} onClick={save}>
                <Icon name="check" size={18} /> Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================ yêu cầu sửa điểm (GV gửi, Admin duyệt)

type Comp = 'attendance' | 'assignment' | 'midterm' | 'final';
const COMP: Record<Comp, string> = { attendance: 'CC', assignment: 'BT', midterm: 'GK', final: 'CK' };
interface GReq {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  adminNote: string | null;
  oldValues: Partial<Record<Comp, number | null>>;
  newValues: Partial<Record<Comp, number | null>>;
  createdAt: string;
  resolvedAt: string | null;
  student: { studentCode: string; fullName: string };
  lecturer: { code: string; fullName: string };
  section: { code: string; course: string };
}
const REQ: Record<GReq['status'], [string, Tone]> = { PENDING: ['Chờ duyệt', 'amber'], APPROVED: ['Đã duyệt', 'green'], REJECTED: ['Từ chối', 'red'], CANCELLED: ['GV đã hủy', 'gray'] };

export function GradeRequestsPage() {
  useCrumbs([{ label: 'Yêu cầu sửa điểm' }]);
  const [tab, setTab] = useState<GReq['status']>('PENDING');
  const q = useAdmin<GReq[]>('/grade-requests');
  const act = useAct();
  const confirm = useConfirm();
  if (!q.data) return <Loading />;
  const rows = q.data.filter((r) => r.status === tab);
  const decide = async (r: GReq, approve: boolean) => {
    const note = await confirm({
      title: approve ? 'Duyệt yêu cầu sửa điểm' : 'Từ chối yêu cầu',
      msg: (
        <>
          {approve ? 'Áp dụng' : 'Từ chối'} thay đổi điểm của <b>{r.student.fullName}</b> ({r.student.studentCode}) lớp {r.section.code}?{approve && ' Điểm tổng kết được tính lại và sinh viên nhận thông báo.'}
        </>
      ),
      ok: approve ? 'Duyệt' : 'Từ chối',
      danger: !approve,
      reason: approve ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối',
      reasonRequired: !approve,
    });
    if (!note) return;
    await act.mutateAsync({ method: 'post', path: `grade-requests/${r.id}/${approve ? 'approve' : 'reject'}`, body: { note: note === 'ok' ? undefined : note }, ok: approve ? 'Đã duyệt và cập nhật điểm.' : 'Đã từ chối yêu cầu.' }).catch(() => undefined);
  };
  return (
    <div className="page">
      <PageHead title="Yêu cầu sửa điểm" />
      <Card body={false}>
        <div style={{ padding: '0 12px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            items={(Object.keys(REQ) as GReq['status'][]).map((k) => ({
              key: k,
              label: (
                <>
                  {REQ[k][0]}
                  <Count n={q.data!.filter((r) => r.status === k).length} />
                </>
              ),
            }))}
          />
        </div>
        {rows.length ? (
          <Table
            rows={rows}
            rowKey={(r) => r.id}
            cols={[
              { h: 'Gửi lúc', r: (r) => <span style={{ fontSize: 13 }}>{fullDT(r.createdAt)}</span> },
              {
                h: 'Lớp · Sinh viên',
                r: (r) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <b>{r.student.fullName}</b>
                    <span className="muted" style={{ fontSize: 12 }}>
                      <span className="mono">{r.student.studentCode}</span> · {r.section.code} – {r.section.course}
                    </span>
                  </div>
                ),
              },
              { h: 'Giảng viên', r: (r) => r.lecturer.fullName },
              {
                h: 'Thay đổi',
                r: (r) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                    {(Object.keys(r.newValues) as Comp[]).map((k) => (
                      <span key={k}>
                        <b>{COMP[k]}</b> {score10(r.oldValues[k] ?? null)} → <b style={{ color: '#DB0000' }}>{score10(r.newValues[k] ?? null)}</b>
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                h: 'Lý do',
                r: (r) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320, fontSize: 13 }}>
                    <span>{r.reason}</span>
                    {r.adminNote && <span className="muted">Admin: {r.adminNote}</span>}
                  </div>
                ),
              },
              {
                h: '',
                align: 'right',
                r: (r) =>
                  r.status === 'PENDING' ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-d" onClick={() => decide(r, false)}>
                        Từ chối
                      </button>
                      <button className="btn btn-sm btn-p" onClick={() => decide(r, true)}>
                        Duyệt
                      </button>
                    </div>
                  ) : (
                    <Badge tone={REQ[r.status][1]}>{REQ[r.status][0]}</Badge>
                  ),
              },
            ]}
          />
        ) : (
          <Empty icon="edit">Không có yêu cầu nào trong mục này.</Empty>
        )}
      </Card>
    </div>
  );
}
