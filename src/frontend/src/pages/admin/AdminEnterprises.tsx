import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Empty, Field, KV, Loading, Note, PageHead, Stat, Tabs } from '../../components/ui';
import { fullDate } from '../../utils/format';
import { Actions, CellUser, Columns, Count, FormModal, Full, Grid2, HBars, IconBtn, SearchBox, Select, StatusBadge, Table, Toolbar, norm, useAct, useAdmin, useConfirm } from './kit';

interface Ent {
  id: string;
  name: string;
  taxCode: string;
  email: string;
  contactName: string;
  phone: string;
  field: string;
  website: string | null;
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'LOCKED';
  userId: string;
  lastLoginAt: string | null;
}
const TABS = [
  ['ACTIVE', 'Đang hoạt động'],
  ['LOCKED', 'Đã khóa'],
] as const;
const FIELDS = ['Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Truyền thông', 'Giáo dục', 'Khác'];
const ENT_TONE: [string, string] = ['#EFE9FD', '#5B21B6'];

/**
 * Tài khoản doanh nghiệp (UC02.7): doanh nghiệp liên hệ khoa bên ngoài hệ thống,
 * Admin tạo tài khoản và gửi thông tin đăng nhập; khóa / mở khóa, đặt lại mật khẩu.
 */
export function EnterprisesPage() {
  useCrumbs([{ label: 'Tài khoản doanh nghiệp' }]);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'ACTIVE') as Ent['status'];
  const list = useAdmin<Ent[]>('/enterprises');
  const act = useAct();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [field, setField] = useState('');
  const [view, setView] = useState<Ent | null>(null);
  const [edit, setEdit] = useState<Ent | 'new' | null>(null);
  const [created, setCreated] = useState<{ name: string; username: string; password: string } | null>(null);
  if (!list.data) return <Loading />;
  const all = list.data;
  // tài khoản cũ do tự đăng ký (trước khi đổi quy trình) vẫn xem được nếu còn
  const tabs: (readonly [Ent['status'], string])[] = [...TABS, ...(all.some((e) => e.status === 'PENDING') ? [['PENDING', 'Chờ duyệt (cũ)'] as const] : [])];
  const fields = [...new Set(all.map((e) => e.field))].sort();
  const rows = all.filter((e) => e.status === tab && (!q || norm(`${e.name} ${e.taxCode} ${e.email} ${e.contactName}`).includes(norm(q))) && (!field || e.field === field));

  const decide = async (e: Ent, action: 'approve' | 'lock' | 'unlock') => {
    const C = {
      approve: { title: 'Kích hoạt tài khoản', msg: <>Kích hoạt tài khoản <b>{e.name}</b>?</>, ok: 'Kích hoạt' },
      lock: { title: 'Khóa doanh nghiệp', msg: <>Khóa <b>{e.name}</b>? Doanh nghiệp sẽ không đăng nhập được.</>, ok: 'Khóa', danger: true, reason: 'Lý do khóa' },
      unlock: { title: 'Mở khóa doanh nghiệp', msg: <>Mở khóa <b>{e.name}</b>?</>, ok: 'Mở khóa' },
    }[action];
    const r = await confirm(C);
    if (!r) return;
    const label = { approve: 'Đã kích hoạt', lock: 'Đã khóa', unlock: 'Đã mở khóa' }[action];
    await act.mutateAsync({ method: 'post', path: `enterprises/${e.id}/decide`, body: { action, reason: r === 'ok' ? undefined : r }, ok: `${label} ${e.name}` }).catch(() => undefined);
    setView(null);
  };
  const reset = async (e: Ent) => {
    if (!(await confirm({ title: 'Đặt lại mật khẩu', msg: <>Đặt lại mật khẩu cho <b>{e.name}</b>? Mật khẩu tạm được gửi tới <b>{e.email}</b>; doanh nghiệp phải đổi ở lần đăng nhập tiếp theo.</>, ok: 'Đặt lại' }))) return;
    const r = (await act.mutateAsync({ method: 'post', path: `users/${e.userId}/reset-password` }).catch(() => null)) as { tempPassword: string | null } | null;
    if (r?.tempPassword) setCreated({ name: e.name, username: e.email, password: r.tempPassword });
  };

  return (
    <div className="page">
      <PageHead
        title="Tài khoản doanh nghiệp"
        actions={
          <button className="btn btn-p" onClick={() => setEdit('new')}>
            <Icon name="plus" size={18} /> Thêm doanh nghiệp
          </button>
        }
      />
      <Card body={false}>
        <div style={{ padding: '0 12px' }}>
          <Tabs
            value={tab}
            onChange={(k) => setParams({ tab: k })}
            items={tabs.map(([k, l]) => ({
              key: k,
              label: (
                <>
                  {l}
                  <Count n={all.filter((e) => e.status === k).length} />
                </>
              ),
            }))}
          />
        </div>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Tìm theo tên, mã số thuế, email, người liên hệ…" />
          <Select label="Lọc theo lĩnh vực" value={field} onChange={setField}>
            <option value="">Mọi lĩnh vực</option>
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Toolbar>
        <Table
          rows={rows}
          rowKey={(e) => e.id}
          onRow={setView}
          empty={tab === 'ACTIVE' ? 'Chưa có doanh nghiệp nào. Bấm “Thêm doanh nghiệp” khi doanh nghiệp liên hệ với khoa.' : 'Không có doanh nghiệp nào trong mục này.'}
          cols={[
            { h: 'Doanh nghiệp', r: (e) => <CellUser name={e.name} code={`MST ${e.taxCode}`} icon="building" tone={ENT_TONE} /> },
            { h: 'Lĩnh vực', r: (e) => <span className="chip">{e.field}</span> },
            {
              h: 'Người liên hệ',
              r: (e) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>
                    {e.contactName} · <span className="mono">{e.phone}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {e.email}
                  </span>
                </div>
              ),
            },
            { h: 'Ngày tạo', r: (e) => fullDate(e.createdAt) },
            {
              h: 'Đăng nhập gần nhất',
              r: (e) => (e.lastLoginAt ? <span style={{ fontSize: 13 }}>{fullDate(e.lastLoginAt)}</span> : <Badge tone="amber">Chưa đăng nhập</Badge>),
            },
            {
              h: '',
              align: 'right',
              r: (e) => (
                <Actions>
                  <IconBtn icon="edit" title="Sửa thông tin" onClick={() => setEdit(e)} />
                  <IconBtn icon="key" title="Đặt lại mật khẩu" onClick={() => reset(e)} />
                  {e.status === 'PENDING' ? (
                    <IconBtn icon="check" title="Kích hoạt" onClick={() => decide(e, 'approve')} />
                  ) : (
                    <IconBtn icon={e.status === 'LOCKED' ? 'unlock' : 'lock'} title={e.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'} onClick={() => decide(e, e.status === 'LOCKED' ? 'unlock' : 'lock')} />
                  )}
                </Actions>
              ),
            },
          ]}
        />
      </Card>
      <Note tone="blue" icon="info">
        Doanh nghiệp liên hệ với khoa để được cấp tài khoản. Khi tạo, hệ thống gửi email đăng nhập kèm mật khẩu tạm tới email doanh nghiệp; doanh nghiệp đổi mật khẩu ở lần đăng nhập đầu.
      </Note>
      {view && (
        <FormModal
          title="Thông tin doanh nghiệp"
          onClose={() => setView(null)}
          foot={
            <>
              <button className="btn" onClick={() => setView(null)}>
                Đóng
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEdit(view);
                  setView(null);
                }}
              >
                <Icon name="edit" size={16} /> Sửa
              </button>
              {view.status === 'ACTIVE' && (
                <button className="btn btn-d" onClick={() => decide(view, 'lock')}>
                  <Icon name="lock" size={16} /> Khóa
                </button>
              )}
              {view.status === 'LOCKED' && (
                <button className="btn" onClick={() => decide(view, 'unlock')}>
                  <Icon name="unlock" size={16} /> Mở khóa
                </button>
              )}
            </>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <CellUser name={view.name} code={`Tạo ngày ${fullDate(view.createdAt)}`} icon="building" tone={ENT_TONE} />
            <StatusBadge s={view.status} />
          </div>
          <KV
            rows={[
              ['Tên đăng nhập', <span className="mono">{view.email}</span>],
              ['Mã số thuế', <span className="mono">{view.taxCode}</span>],
              ['Lĩnh vực', view.field],
              ['Website', view.website ? <a href={view.website.startsWith('http') ? view.website : `https://${view.website}`} target="_blank" rel="noopener noreferrer">{view.website}</a> : '—'],
              ['Người liên hệ', view.contactName],
              ['Điện thoại', <span className="mono">{view.phone}</span>],
              ['Đăng nhập gần nhất', view.lastLoginAt ? fullDate(view.lastLoginAt) : 'Chưa đăng nhập'],
            ]}
          />
        </FormModal>
      )}
      {edit && <EnterpriseForm e={edit === 'new' ? null : edit} fields={FIELDS} onClose={() => setEdit(null)} onCreated={setCreated} />}
      {created && (
        <FormModal title="Thông tin đăng nhập" onClose={() => setCreated(null)} foot={<button className="btn btn-p" onClick={() => setCreated(null)}>Xong</button>}>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Đã gửi email cho <b>{created.name}</b>. Nếu doanh nghiệp không nhận được, gửi lại thông tin dưới đây:
          </p>
          <KV
            rows={[
              ['Địa chỉ', <span className="mono">{location.origin}/login</span>],
              ['Tên đăng nhập', <b className="mono">{created.username}</b>],
              ['Mật khẩu tạm', <b className="mono">{created.password}</b>],
            ]}
          />
          <button
            className="btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => navigator.clipboard?.writeText(`FrameUp – tài khoản doanh nghiệp\nĐịa chỉ: ${location.origin}/login (chọn tab Doanh nghiệp)\nTên đăng nhập: ${created.username}\nMật khẩu tạm: ${created.password}\nVui lòng đổi mật khẩu ở lần đăng nhập đầu tiên.`)}
          >
            <Icon name="copy" size={16} /> Sao chép để gửi
          </button>
          <Note tone="amber" icon="warn">
            Mật khẩu tạm chỉ hiện một lần. Doanh nghiệp phải đổi mật khẩu ở lần đăng nhập đầu.
          </Note>
        </FormModal>
      )}
    </div>
  );
}

function EnterpriseForm({ e, fields, onClose, onCreated }: { e: Ent | null; fields: string[]; onClose: () => void; onCreated: (c: { name: string; username: string; password: string }) => void }) {
  const act = useAct();
  const [v, setV] = useState({ name: e?.name ?? '', taxCode: e?.taxCode ?? '', field: e?.field ?? fields[0], website: e?.website ?? '', contactName: e?.contactName ?? '', phone: e?.phone ?? '', email: e?.email ?? '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (x: { target: { value: string } }) => setV({ ...v, [k]: x.target.value });
  const save = async () => {
    const x: Record<string, string> = {};
    if (!v.name.trim()) x.name = 'Nhập tên doanh nghiệp';
    if (!/^\d{10}(-\d{3})?$/.test(v.taxCode.replace(/\s/g, ''))) x.taxCode = 'Mã số thuế gồm 10 số (hoặc 10 số-3 số)';
    if (!v.contactName.trim()) x.contactName = 'Nhập người liên hệ';
    if (!/^(03|05|07|08|09)\d{8}$/.test(v.phone.replace(/[\s.-]/g, ''))) x.phone = 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) x.email = 'Email không hợp lệ';
    setErr(x);
    if (Object.keys(x).length) return;
    const body = { ...v, website: v.website.trim() || undefined };
    const r = (await act
      .mutateAsync(e ? { method: 'put', path: `enterprises/${e.id}`, body, ok: 'Đã lưu thay đổi.' } : { method: 'post', path: 'enterprises', body })
      .catch(() => null)) as { username?: string; tempPassword?: string } | null;
    if (!r) return;
    onClose();
    if (!e && r.tempPassword) onCreated({ name: v.name.trim(), username: r.username!, password: r.tempPassword });
  };
  return (
    <FormModal
      title={e ? 'Sửa thông tin doanh nghiệp' : 'Thêm doanh nghiệp'}
      width={640}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={act.isPending} onClick={save}>
            {e ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <Grid2>
        <Full>
          <Field label="Tên doanh nghiệp *" error={err.name}>
            <input className="inp" value={v.name} onChange={set('name')} placeholder="VD: Công ty Cổ phần Công nghệ A" />
          </Field>
        </Full>
        <Field label="Mã số thuế *" error={err.taxCode}>
          <input className="inp mono" value={v.taxCode} onChange={set('taxCode')} placeholder="0101234567" />
        </Field>
        <Field label="Lĩnh vực *">
          <select className="inp" value={v.field} onChange={set('field')}>
            {[...new Set([...fields, v.field])].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Người liên hệ *" error={err.contactName}>
          <input className="inp" value={v.contactName} onChange={set('contactName')} />
        </Field>
        <Field label="SĐT liên hệ *" error={err.phone}>
          <input className="inp mono" value={v.phone} onChange={set('phone')} />
        </Field>
        <Full>
          <Field label="Email (dùng làm tên đăng nhập) *" error={err.email} help={e ? 'Đổi email thì doanh nghiệp đăng nhập bằng email mới.' : 'Thông tin đăng nhập và mật khẩu tạm được gửi tới email này.'}>
            <input className="inp" type="email" value={v.email} onChange={set('email')} placeholder="hr@congty.vn" />
          </Field>
        </Full>
        <Full>
          <Field label="Website">
            <input className="inp" value={v.website} onChange={set('website')} placeholder="https://congty.vn" />
          </Field>
        </Full>
      </Grid2>
    </FormModal>
  );
}

interface EntStats {
  total: number;
  byStatus: { key: string; count: number }[];
  byField: { key: string; count: number }[];
  months: { month: string; count: number }[];
}

/** Thống kê doanh nghiệp – mẫu admin/Admin_DNStats. */
export function EnterpriseStatsPage() {
  useCrumbs([{ label: 'Thống kê doanh nghiệp' }]);
  const q = useAdmin<EntStats>('/enterprises/stats');
  if (!q.data) return <Loading />;
  const d = q.data;
  const st = (k: string) => d.byStatus.find((x) => x.key === k)?.count ?? 0;
  const none = <Empty icon="chart">Chưa có dữ liệu hoạt động của doanh nghiệp.</Empty>;
  return (
    <div className="page">
      <PageHead title="Thống kê doanh nghiệp" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        <Stat label="Tổng doanh nghiệp" value={d.total} icon="building" tone="blue" />
        <Stat label="Chờ duyệt" value={st('PENDING')} icon="clock" tone="amber" />
        <Stat label="Đã duyệt" value={st('ACTIVE')} icon="check" tone="green" />
        <Stat label="Bị khóa" value={st('LOCKED')} icon="lock" tone="red" />
        <Stat label="Từ chối" value={st('REJECTED')} icon="close" tone="gray" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
        <Card title="Doanh nghiệp theo lĩnh vực">{d.byField.length ? <HBars data={d.byField.map((f) => ({ label: f.key, value: f.count }))} /> : <Empty icon="building">Chưa có doanh nghiệp đăng ký.</Empty>}</Card>
        <Card title="DN đăng ký mới theo tháng">
          <Columns data={d.months.map((m) => ({ label: m.month.slice(0, 2) + '/' + m.month.slice(5), value: m.count }))} height={160} />
        </Card>
        <Card title="Yêu cầu xem bài theo trạng thái">{none}</Card>
        <Card title="Lượt tìm kiếm theo tuần">{none}</Card>
        <Card title="Chủ đề DN quan tâm nhất">{none}</Card>
        <Card title="Sinh viên được quan tâm nhiều nhất">{none}</Card>
      </div>
    </div>
  );
}
