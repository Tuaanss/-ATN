import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon, type IconName } from '../../components/Icon';
import { Badge, Card, Empty, Loading, Note, PageHead } from '../../components/ui';
import { fullDT, score10 } from '../../utils/format';
import { useChild } from './child';

interface Item {
  id: string;
  type: 'PH_WARNING' | 'PH_GRADE' | 'PH_SUBMISSION' | 'PH_DUE';
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
const TYPES: [string, string][] = [
  ['', 'Tất cả'],
  ['PH_WARNING', 'Cảnh báo học tập'],
  ['PH_GRADE', 'Điểm'],
  ['PH_SUBMISSION', 'Bài nộp'],
  ['PH_DUE', 'Hạn nộp'],
];
const STY: Record<Item['type'], [IconName, string, string]> = {
  PH_WARNING: ['warn', '#FCE8E6', '#B42318'],
  PH_GRADE: ['chart', '#E3F2E8', '#15803D'],
  PH_SUBMISSION: ['upload', '#E6EFFD', '#1847A8'],
  PH_DUE: ['clock', '#FDF0DE', '#B45309'],
};

/** Thông báo & cảnh báo học tập – mẫu phu-huynh/thong-bao. */
export function ParentNotifications() {
  const { child, loading } = useChild();
  useCrumbs([{ label: 'Thông báo & cảnh báo' }]);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['parent', 'noti', child?.id], queryFn: () => api.get<{ threshold: number; gpaDrop: number; items: Item[] }>(`/parent/children/${child!.id}/notifications`).then((r) => r.data), enabled: !!child });
  const [type, setType] = useState('');
  const [unread, setUnread] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['parent'] });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post(`/parent/children/${child!.id}/notifications/read-all`), onSuccess: refresh });
  if (loading || (child && !q.data)) return <Loading />;
  if (!child)
    return (
      <div className="page">
        <Empty icon="users">Tài khoản chưa liên kết với sinh viên nào.</Empty>
      </div>
    );
  const d = q.data!;
  const warn = d.items.filter((t) => t.type === 'PH_WARNING' && !t.readAt);
  const rows = d.items.filter((t) => (!type || t.type === type) && (!unread || !t.readAt));
  return (
    <div className="page">
      <PageHead
        title={`Thông báo · ${child.fullName}`}
        actions={
          <button className="btn" disabled={!d.items.some((t) => !t.readAt) || readAll.isPending} onClick={() => readAll.mutate()}>
            <Icon name="check" size={16} /> Đánh dấu tất cả đã đọc
          </button>
        }
      />
      {warn.length > 0 && (
        <Note tone="red" icon="warn">
          <b>{warn.length} cảnh báo học tập chưa xem</b>
          <div style={{ fontSize: 13, marginTop: 2 }}>{warn.map((w) => w.title).join(' · ')}</div>
        </Note>
      )}
      <Card body={false}>
        <div className="tabs" role="tablist" style={{ padding: '0 12px' }}>
          {TYPES.map(([k, l]) => {
            const n = d.items.filter((t) => (!k || t.type === k) && !t.readAt).length;
            return (
              <button key={k} type="button" role="tab" aria-selected={k === type} className={`tab${k === type ? ' on' : ''}`} onClick={() => setType(k)}>
                {l}
                {n > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#DB0000', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #EFEDE6' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Chỉ hiện chưa đọc
          </label>
        </div>
        {rows.length ? (
          rows.map((t) => {
            const [i, bg, fg] = STY[t.type] ?? STY.PH_GRADE;
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => !t.readAt && read.mutate(t.id)}
                onKeyDown={(e) => e.key === 'Enter' && !t.readAt && read.mutate(t.id)}
                style={{ display: 'flex', gap: 14, padding: '16px 20px', borderBottom: '1px solid #EFEDE6', background: t.readAt ? undefined : '#FFF8F7', cursor: t.readAt ? 'default' : 'pointer' }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={i} size={20} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <b>{t.title}</b>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {fullDT(t.createdAt)}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: '#30343B', lineHeight: 1.5 }}>{t.body}</span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    {t.type === 'PH_WARNING' && <Badge tone="red">Cần chú ý</Badge>}
                    {t.link && (
                      <Link to={t.link} style={{ fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                        {t.link.startsWith('/parent/submissions') ? 'Xem bài nộp' : 'Xem bảng điểm'} →
                      </Link>
                    )}
                  </div>
                </div>
                {!t.readAt && (
                  <button
                    type="button"
                    className="btn btn-g btn-sm"
                    title="Đánh dấu đã đọc"
                    aria-label="Đánh dấu đã đọc"
                    onClick={(e) => {
                      e.stopPropagation();
                      read.mutate(t.id);
                    }}
                    style={{ width: 34, padding: 0, alignSelf: 'flex-start' }}
                  >
                    <Icon name="check" size={16} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <Empty icon="bell">Không có thông báo nào.</Empty>
        )}
      </Card>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }} className="muted">
          <Icon name="bell" size={20} />
          <span>
            Ngưỡng cảnh báo do nhà trường cấu hình: điểm dưới <b>{score10(d.threshold)}</b>, GPA giảm từ <b>{score10(d.gpaDrop)}</b> điểm; bài quá hạn chưa nộp luôn được cảnh báo.
          </span>
        </div>
      </Card>
    </div>
  );
}
