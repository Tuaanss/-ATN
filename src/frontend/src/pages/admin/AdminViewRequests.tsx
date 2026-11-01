import { useState } from 'react';
import { useCrumbs } from '../../layouts/AppLayout';
import { Badge, Card, Field, Loading, Note, PageHead, Tabs, type Tone } from '../../components/ui';
import { fullDate, fullDT } from '../../utils/format';
import { Count, FormModal, Table, useAct, useAdmin, useConfirm } from './kit';

interface Req {
  id: string;
  enterprise: { id: string; name: string; field: string; status: string };
  student: { id: string; studentCode: string; fullName: string; discoverable: boolean };
  purpose: string;
  requestedDays: number;
  grantedDays: number | null;
  state: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REJECTED' | 'REVOKED';
  adminNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
}
const TABS: [Req['state'], string, Tone][] = [
  ['PENDING', 'Chờ duyệt', 'amber'],
  ['ACTIVE', 'Đang còn hạn', 'green'],
  ['EXPIRED', 'Hết hạn', 'gray'],
  ['REJECTED', 'Từ chối', 'red'],
  ['REVOKED', 'Thu hồi', 'gray'],
];

/** Duyệt yêu cầu xem bài của doanh nghiệp (UC02.7, BR-DN-04). */
export function AdminViewRequests() {
  useCrumbs([{ label: 'Yêu cầu xem bài' }]);
  const q = useAdmin<{ viewDays: { min: number; max: number }; items: Req[] }>('/view-requests');
  const act = useAct();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Req['state']>('PENDING');
  const [approve, setApprove] = useState<Req | null>(null);
  if (!q.data) return <Loading />;
  const { items, viewDays } = q.data;
  const rows = items.filter((r) => r.state === tab);
  const reject = async (r: Req, revoke = false) => {
    const note = await confirm({
      title: revoke ? 'Thu hồi quyền xem' : 'Từ chối yêu cầu',
      msg: (
        <>
          {revoke ? 'Thu hồi quyền xem bài' : 'Từ chối yêu cầu xem bài'} của <b>{r.enterprise.name}</b> với <b>{r.student.fullName}</b>? Doanh nghiệp nhận thông báo kèm lý do.
        </>
      ),
      ok: revoke ? 'Thu hồi' : 'Từ chối',
      danger: true,
      reason: 'Lý do',
    });
    if (!note) return;
    await act.mutateAsync({ method: 'post', path: `view-requests/${r.id}/decide`, body: { action: revoke ? 'revoke' : 'reject', note }, ok: revoke ? 'Đã thu hồi quyền xem.' : 'Đã từ chối yêu cầu.' }).catch(() => undefined);
  };
  return (
    <div className="page">
      <PageHead title="Yêu cầu xem bài của doanh nghiệp" />
      <Card body={false}>
        <div style={{ padding: '0 12px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            items={TABS.map(([k, l]) => ({
              key: k,
              label: (
                <>
                  {l}
                  <Count n={items.filter((r) => r.state === k).length} />
                </>
              ),
            }))}
          />
        </div>
        <Table
          rows={rows}
          rowKey={(r) => r.id}
          empty="Không có yêu cầu nào trong mục này."
          cols={[
            {
              h: 'Doanh nghiệp',
              r: (r) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <b>{r.enterprise.name}</b>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {r.enterprise.field}
                  </span>
                </div>
              ),
            },
            {
              h: 'Sinh viên',
              r: (r) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{r.student.fullName}</span>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {r.student.studentCode}
                    {!r.student.discoverable && ' · đã tắt tìm kiếm'}
                  </span>
                </div>
              ),
            },
            { h: 'Mục đích', r: (r) => <span style={{ fontSize: 13, maxWidth: 320, display: 'inline-block' }}>{r.purpose}</span> },
            {
              h: tab === 'PENDING' ? 'Gửi lúc · đề xuất' : 'Thời hạn',
              r: (r) =>
                tab === 'PENDING' ? (
                  <span style={{ fontSize: 13 }}>
                    {fullDT(r.createdAt)} · {r.requestedDays} ngày
                  </span>
                ) : r.approvedAt ? (
                  <span style={{ fontSize: 13 }}>
                    {fullDate(r.approvedAt)} → {r.expiresAt ? fullDate(r.expiresAt) : '—'}
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    {r.adminNote ?? '—'}
                  </span>
                ),
            },
            {
              h: '',
              align: 'right',
              r: (r) =>
                r.state === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-d" onClick={() => reject(r)}>
                      Từ chối
                    </button>
                    <button className="btn btn-sm btn-p" onClick={() => setApprove(r)}>
                      Duyệt
                    </button>
                  </div>
                ) : r.state === 'ACTIVE' ? (
                  <button className="btn btn-sm btn-d" onClick={() => reject(r, true)}>
                    Thu hồi
                  </button>
                ) : (
                  <Badge tone={TABS.find((t) => t[0] === r.state)![2]}>{TABS.find((t) => t[0] === r.state)![1]}</Badge>
                ),
            },
          ]}
        />
      </Card>
      {approve && <ApproveModal r={approve} viewDays={viewDays} onClose={() => setApprove(null)} />}
    </div>
  );
}

function ApproveModal({ r, viewDays, onClose }: { r: Req; viewDays: { min: number; max: number }; onClose: () => void }) {
  const act = useAct();
  const [days, setDays] = useState(String(Math.min(viewDays.max, Math.max(viewDays.min, r.requestedDays))));
  const [note, setNote] = useState('');
  const n = Number(days);
  const bad = !Number.isInteger(n) || n < viewDays.min || n > viewDays.max;
  const ok = async () => {
    const done = await act
      .mutateAsync({ method: 'post', path: `view-requests/${r.id}/decide`, body: { action: 'approve', days: n, note: note.trim() || undefined }, ok: `Đã cấp quyền xem ${n} ngày.` })
      .then(() => true)
      .catch(() => false);
    if (done) onClose();
  };
  return (
    <FormModal
      title="Duyệt yêu cầu xem bài"
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p" disabled={bad || act.isPending} onClick={ok}>
            Duyệt
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        <b>{r.enterprise.name}</b> muốn xem bài nộp của <b>{r.student.fullName}</b> ({r.student.studentCode}).
        <br />
        <span className="muted">Mục đích: {r.purpose}</span>
      </p>
      <Field label={`Thời hạn (ngày) *`} help={`Trong khoảng ${viewDays.min}–${viewDays.max} ngày · doanh nghiệp đề xuất ${r.requestedDays} ngày.`} error={bad ? `Thời hạn ${viewDays.min}–${viewDays.max} ngày` : undefined}>
        <input className="inp" type="number" min={viewDays.min} max={viewDays.max} value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 160 }} />
      </Field>
      <Field label="Ghi chú (không bắt buộc)">
        <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Note tone="blue" icon="shield">
        Doanh nghiệp chỉ xem được bài đã nộp, không tải xuống; mọi lượt xem được ghi lại và sinh viên xem được. Hết hạn, quyền tự thu hồi.
      </Note>
    </FormModal>
  );
}
