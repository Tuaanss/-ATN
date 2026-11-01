import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { Notification } from '../api/types';
import { useAuth } from '../auth/auth';
import { useCrumbs } from '../layouts/AppLayout';
import { Icon, type IconName } from '../components/Icon';
import { Card, Empty, Loading, Note, PageHead, Switch, Tabs, useToast } from '../components/ui';
import { ddmm } from '../utils/format';

interface Settings {
  channels: Record<string, { app: boolean; email: boolean }>;
  digest: boolean;
  alwaysOn: string[];
}
type Cat = { key: string; label: string; types: (t: string) => boolean };

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (v: string) => `${pad(new Date(v).getHours())}:${pad(new Date(v).getMinutes())}`;
const dayDiff = (v: string) => {
  const d = new Date(v);
  const now = new Date();
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400_000);
};

/** Biểu tượng + màu theo loại (giống danh sách trong mẫu). */
function look(type: string): [IconName, string, string] {
  if (type === 'GROUP_REPORT_RESOLVED') return ['check', '#EAF6EC', '#15803D'];
  if (type === 'GROUP_REPORTED') return ['warn', '#FCE8E6', '#B42318'];
  if (type.startsWith('TOPIC')) return ['file', '#FEF5E3', '#B45309'];
  if (type.startsWith('GROUP')) return ['users', '#FEF5E3', '#B45309'];
  if (type === 'SUBMISSION_UPDATED') return ['upload', '#EAF2FE', '#1D4ED8'];
  if (type === 'SUBMISSION_SYNC_FAILED' || type.startsWith('DRIVE')) return ['drive', '#FCE8E6', '#B42318'];
  if (type === 'REMINDER' || type === 'DEADLINE_REMINDER') return ['clock', '#FEF5E3', '#B45309'];
  if (type.includes('GRADE')) return ['chart', '#FDEDED', '#C40000'];
  if (type.startsWith('ASSIGNMENT')) return ['file', '#EAF6EC', '#15803D'];
  return ['shield', '#F1F0EA', '#30343B'];
}

const STUDENT_CATS: Cat[] = [
  { key: 'assign', label: 'Bài tập', types: (t) => (t.startsWith('ASSIGNMENT') && !t.includes('GRADE')) || t === 'REMINDER' || t === 'DEADLINE_REMINDER' },
  { key: 'group', label: 'Nhóm', types: (t) => t.startsWith('GROUP') || t === 'SUBMISSION_UPDATED' || t.startsWith('TOPIC') },
  { key: 'grade', label: 'Điểm', types: (t) => t.includes('GRADE') },
  { key: 'ent', label: 'Doanh nghiệp', types: (t) => t.startsWith('ENTERPRISE') },
  { key: 'sys', label: 'Hệ thống', types: (t) => t.startsWith('SECURITY') || t.startsWith('SYSTEM') },
];
const LECTURER_CATS: Cat[] = [
  { key: 'sub', label: 'Bài nộp', types: (t) => t === 'SUBMISSION_UPDATED' || t.startsWith('TOPIC') },
  { key: 'group', label: 'Nhóm', types: (t) => t.startsWith('GROUP') },
  { key: 'grade', label: 'Điểm', types: (t) => t.includes('GRADE') },
  { key: 'drive', label: 'Drive', types: (t) => t === 'SUBMISSION_SYNC_FAILED' || t.startsWith('DRIVE') },
];
const PREF_LABEL: Record<string, string> = {
  ASSIGNMENT_NEW: 'Bài tập mới',
  DUE_SOON: 'Sắp hết hạn (24 giờ)',
  GROUP: 'Danh sách nhóm',
  GROUP_SUBMIT: 'Thành viên nhóm nộp bài / sửa đề tài',
  GRADE: 'Điểm mới',
  ENTERPRISE: 'Doanh nghiệp xem bài',
  SECURITY: 'Bảo mật tài khoản',
  GROUP_REPORT: 'Sinh viên báo nhóm chưa đúng',
  TOPIC_UPDATED: 'Sinh viên nhập / sửa đề tài',
  NEW_SUBMISSION: 'Từng bài nộp mới',
  DRIVE_ERROR: 'Lỗi Google Drive',
};

/** Nút hành động bên phải mỗi thông báo của GV (mẫu GV_Notifications). */
function lecturerAction(n: Notification): [string, boolean] | null {
  if (!n.link) return null;
  if (n.type === 'GROUP_REPORTED') return ['Xem phản hồi nhóm', !n.readAt];
  if (n.type === 'SUBMISSION_SYNC_FAILED') return ['Xem bài nộp', false];
  if (n.type === 'SUBMISSION_UPDATED') return ['Xem bài', false];
  return ['Mở', false];
}

/** Thông báo – mẫu chung/Shared_Notifications (SV) và giang-vien/GV_Notifications. */
export function NotificationsPage() {
  const { user } = useAuth();
  const lecturer = user?.role === 'LECTURER';
  const qc = useQueryClient();
  const toast = useToast();
  useCrumbs([{ label: 'Thông báo' }]);
  const [tab, setTab] = useState('all');
  const list = useQuery({ queryKey: ['notifications', 'page'], queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications', { params: { limit: 100 } }).then((r) => r.data) });
  const settingsQ = useQuery({ queryKey: ['notifications', 'settings'], queryFn: () => api.get<Settings>('/notifications/settings').then((r) => r.data) });
  const [prefs, setPrefs] = useState<Settings | null>(null);
  useEffect(() => {
    if (settingsQ.data) setPrefs(settingsQ.data);
  }, [settingsQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => (invalidate(), toast.ok('Đã đánh dấu tất cả đã đọc')) });
  const readOne = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: invalidate });
  const save = useMutation({
    mutationFn: () => api.put('/notifications/settings', { channels: prefs!.channels, digest: prefs!.digest }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['notifications', 'settings'] }), toast.ok('Đã lưu cài đặt thông báo')),
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (list.isLoading) return <Loading />;
  const items = list.data?.items ?? [];
  const unread = list.data?.unread ?? 0;
  const cats = lecturer ? LECTURER_CATS : STUDENT_CATS;
  const shown = items.filter((n) => (tab === 'all' ? true : tab === 'unread' ? !n.readAt : cats.find((c) => c.key === tab)!.types(n.type)));
  const tabs = (
    <Tabs
      value={tab}
      onChange={setTab}
      items={[{ key: 'all', label: `Tất cả (${items.length})` }, { key: 'unread', label: `Chưa đọc (${unread})` }, ...cats.map((c) => ({ key: c.key, label: c.label }))]}
    />
  );
  const open = (n: Notification) => !n.readAt && readOne.mutate(n.id);

  const settingsCard = (
    <Card title="Cài đặt nhận thông báo">
      {!lecturer && (
        <p className="muted" style={{ fontSize: 13 }}>
          Chọn loại thông báo và kênh nhận.
        </p>
      )}
      {prefs ? (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Ứng dụng</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(prefs.channels).map(([k, v]) => {
                  const locked = prefs.alwaysOn.includes(k);
                  const set = (ch: 'app' | 'email', val: boolean) => setPrefs({ ...prefs, channels: { ...prefs.channels, [k]: { ...v, [ch]: val } } });
                  return (
                    <tr key={k}>
                      <td>{PREF_LABEL[k] ?? k}</td>
                      <td>
                        <Switch checked={v.app} onChange={(x) => set('app', x)} label={`${PREF_LABEL[k]} – ứng dụng`} disabled={locked} />
                      </td>
                      <td>
                        <Switch checked={v.email} onChange={(x) => set('email', x)} label={`${PREF_LABEL[k]} – email`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lecturer ? (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={prefs.digest} onChange={(e) => setPrefs({ ...prefs, digest: e.target.checked })} />
              Gom bài nộp mới thành bản tóm tắt lúc 20:00 mỗi ngày
            </label>
          ) : (
            <Note tone="gray" icon="shield">
              Thông báo bảo mật và quyền xem của doanh nghiệp luôn được gửi, không tắt hoàn toàn được.
            </Note>
          )}
          <button className="btn btn-p" type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu cài đặt
          </button>
        </>
      ) : (
        <div className="skeleton" style={{ height: 200 }} />
      )}
    </Card>
  );

  const head = (
    <PageHead
      title="Thông báo"
      sub={unread ? `${unread} thông báo chưa đọc` : 'Không có thông báo chưa đọc'}
      actions={
        <button className="btn" type="button" disabled={!unread || readAll.isPending} onClick={() => readAll.mutate()}>
          <Icon name="check" size={16} />
          Đánh dấu tất cả đã đọc
        </button>
      }
    />
  );

  if (lecturer) {
    const groups: [string, Notification[]][] = [
      ['Hôm nay', shown.filter((n) => dayDiff(n.createdAt) === 0)],
      ['Hôm qua', shown.filter((n) => dayDiff(n.createdAt) === 1)],
      ['Trước đó', shown.filter((n) => dayDiff(n.createdAt) > 1)],
    ];
    return (
      <div className="page">
        {head}
        {tabs}
        <div className="cols-2-1">
          <div className="col">
            <section className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {shown.length ? (
                groups
                  .filter(([, l]) => l.length)
                  .map(([label, l]) => (
                    <div key={label}>
                      <div style={{ padding: '10px 20px', background: '#FAFAF7', borderBottom: '1px solid #EFEDE6', fontSize: 12, fontWeight: 600, color: '#62666F', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      {l.map((n) => {
                        const [icon, bg, fg] = look(n.type);
                        const act = lecturerAction(n);
                        return (
                          <div key={n.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #EFEDE6', background: n.readAt ? undefined : '#FFFCFC' }}>
                            <span style={{ width: 38, height: 38, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon name={icon} size={18} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: n.readAt ? 400 : 600 }}>{n.title}</div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {n.body ? `${n.body} · ` : ''}
                                {dayDiff(n.createdAt) <= 1 ? hhmm(n.createdAt) : ddmm(n.createdAt)}
                              </div>
                            </div>
                            {act && (
                              <Link className={`btn btn-sm${act[1] ? ' btn-p' : ''}`} to={n.link!} onClick={() => open(n)}>
                                {act[0]}
                              </Link>
                            )}
                            {n.readAt ? <span style={{ width: 8 }} /> : <span className="dot" style={{ background: '#DB0000' }} />}
                          </div>
                        );
                      })}
                    </div>
                  ))
              ) : (
                <Empty icon="bell">Không có thông báo.</Empty>
              )}
            </section>
          </div>
          <div className="col">{settingsCard}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {head}
      <div className="cols-2-1">
        <div className="col">
          <Card title="Tất cả thông báo">
            {tabs}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {shown.length ? (
                shown.map((n) => {
                  const [icon, bg, fg] = look(n.type);
                  const when = dayDiff(n.createdAt) === 0 ? `Hôm nay · ${hhmm(n.createdAt)}` : dayDiff(n.createdAt) === 1 ? `Hôm qua · ${hhmm(n.createdAt)}` : ddmm(n.createdAt);
                  return (
                    <Link key={n.id} to={n.link ?? '#'} onClick={() => open(n)} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 4px', borderBottom: '1px solid #EFEDE6', color: '#1A1C21' }}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={icon} size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: n.readAt ? 400 : 600 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {when}
                        </div>
                      </div>
                      {!n.readAt && <span className="dot" style={{ background: '#DB0000', marginTop: 8 }} />}
                    </Link>
                  );
                })
              ) : (
                <Empty icon="bell">Không có thông báo.</Empty>
              )}
            </div>
          </Card>
        </div>
        <div className="col">{settingsCard}</div>
      </div>
    </div>
  );
}
