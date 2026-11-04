import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/auth';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Card, Empty, Loading, Note, PageHead, useToast } from '../../components/ui';
import { fullDate } from '../../utils/format';

interface DriveInfo {
  mode: 'local' | 'google';
  serviceAccountEmail: string | null;
  oauthAvailable: boolean;
  link: {
    rootFolderName: string | null;
    folderUrl: string | null;
    status: 'OK' | 'NO_PERMISSION' | 'NOT_FOUND' | 'NOT_SHARED_DRIVE' | 'QUOTA_EXCEEDED' | 'EXPIRED';
    checkedAt: string;
    oauth: boolean;
    googleEmail: string | null;
    linkedAt: string | null;
  } | null;
  quota: { used: number; limit: number | null } | null;
  folders: { id: string; title: string; section: string; url: string | null; failed: number; pending: number }[];
}

const gb = (b: number) => (b / 1024 ** 3).toFixed(1).replace('.', ',');

/** Kết nối Google Drive – mẫu giang-vien/GV_GoogleLink. */
export function DrivePage() {
  useCrumbs([{ label: 'Kết nối Google Drive' }]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ['lecturer', 'drive-link'], queryFn: () => api.get<DriveInfo>('/lecturer/drive-link').then((r) => r.data) });

  // kết quả quay về từ Google
  useEffect(() => {
    if (params.get('linked')) toast.ok('Đã liên kết Google Drive');
    else if (params.get('error')) toast.err(params.get('error')!);
    if (params.get('linked') || params.get('error')) setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const start = useMutation({
    mutationFn: () => api.get<{ url: string }>('/lecturer/drive/oauth/start').then((r) => r.data),
    onSuccess: (r) => window.location.assign(r.url),
    onError: (e) => toast.err(errorMessage(e)),
  });
  const set = (d: DriveInfo) => qc.setQueryData(['lecturer', 'drive-link'], d);
  const recheck = useMutation({
    mutationFn: () => api.post<DriveInfo>('/lecturer/drive/recheck').then((r) => r.data),
    onSuccess: (d) => (set(d), d.link?.status === 'OK' ? toast.ok('Ghi được vào thư mục Drive') : toast.err(d.link?.status === 'EXPIRED' ? 'Liên kết Google đã hết hạn, hãy liên kết lại' : 'Không ghi được vào thư mục Drive')),
    onError: (e) => toast.err(errorMessage(e)),
  });
  const reorganize = useMutation({
    mutationFn: () => api.post<{ moved: number; kept: number; failed: { title: string; message: string }[] }>('/lecturer/drive/reorganize').then((r) => r.data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['lecturer', 'drive-link'] });
      if (r.failed.length) toast.err(`Không chuyển được ${r.failed.length} thư mục: ${r.failed[0].message}`);
      else toast.ok(r.moved ? `Đã chuyển ${r.moved} thư mục bài tập vào cấu trúc học kỳ / lớp` : 'Các thư mục đã đúng cấu trúc học kỳ / lớp');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });
  const unlink = useMutation({
    mutationFn: () => api.delete<DriveInfo>('/lecturer/drive/oauth').then((r) => r.data),
    onSuccess: (d) => (set(d), toast.ok('Đã hủy liên kết Google Drive')),
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  const l = d.link;
  const pct = d.quota?.limit ? Math.round((d.quota.used / d.quota.limit) * 100) : null;
  const problems = d.folders.filter((f) => f.failed);

  return (
    <div className="page">
      <PageHead title="Kết nối Google Drive" sub="Bài nộp của sinh viên được lưu vào Google Drive của bạn" />
      {d.mode === 'local' && (
        <Note tone="amber" icon="warn">
          Máy chủ đang chạy <b>Drive mô phỏng</b> (DRIVE_MODE=local): tệp được lưu trên máy chủ, chưa ghi lên Google Drive.
        </Note>
      )}
      <div className="cols-1-1">
        <div className="col">
          <Card title="Cách 1 · Liên kết tài khoản Google (OAuth)">
            {l?.oauth ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: '1px solid #CFE6D5', background: '#F4FAF5', borderRadius: 10, flexWrap: 'wrap' }}>
                  <Avatar name={user?.name ?? 'GV'} size={44} strong />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ wordBreak: 'break-all' }}>{l.googleEmail}</b>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Đã liên kết {fullDate(l.linkedAt)} · quyền: tạo &amp; quản lý tệp do ứng dụng tạo
                    </div>
                  </div>
                  <Badge tone={l.status === 'OK' ? 'green' : 'red'}>{l.status === 'OK' ? 'Đang hoạt động' : l.status === 'EXPIRED' ? 'Hết hạn liên kết' : 'Mất quyền ghi'}</Badge>
                </div>
                {l.status === 'EXPIRED' && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: '#FCE8E6', color: '#7F1D16', fontSize: 13, lineHeight: 1.55, flexWrap: 'wrap' }}>
                    <Icon name="warn" size={18} />
                    <span style={{ flex: 1, minWidth: 220 }}>
                      Google đã thu hồi quyền truy cập nên hệ thống không ghi được bài nộp lên Drive. Bài nộp vẫn được giữ trên máy chủ và sẽ tự đồng bộ sau khi bạn liên kết lại cùng tài khoản <b>{l.googleEmail}</b>.
                    </span>
                    <button className="btn btn-p btn-sm" type="button" disabled={start.isPending} onClick={() => start.mutate()}>
                      <Icon name="refresh" size={14} />
                      Liên kết lại
                    </button>
                  </div>
                )}
                {l.folderUrl && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                    <span style={{ color: '#62666F', display: 'inline-flex' }}>
                      <Icon name="folder" size={18} />
                    </span>
                    <span style={{ flex: 1 }}>
                      Thư mục gốc: <b>{l.rootFolderName}</b>
                    </span>
                    <a className="btn btn-sm" href={l.folderUrl} target="_blank" rel="noreferrer">
                      <Icon name="link" size={14} />
                      Mở
                    </a>
                  </div>
                )}
                {d.quota && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <b>Dung lượng Drive</b>
                      <span className="muted">
                        {gb(d.quota.used)} / {d.quota.limit ? `${gb(d.quota.limit)} GB` : 'không giới hạn'}
                      </span>
                    </div>
                    {pct !== null && (
                      <div style={{ height: 10, borderRadius: 3, background: '#EFEDE6' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 90 ? '#B42318' : pct >= 70 ? '#B45309' : '#15803D' }} />
                      </div>
                    )}
                    <span className="help">Bài nộp tính vào dung lượng Drive của bạn. Hệ thống cảnh báo khi còn dưới 10%.</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" type="button" disabled={recheck.isPending} onClick={() => recheck.mutate()}>
                    <Icon name="refresh" size={16} />
                    Kiểm tra lại
                  </button>
                  <button className="btn" type="button" disabled={reorganize.isPending || l.status === 'EXPIRED'} onClick={() => reorganize.mutate()} title="Chuyển thư mục bài tập cũ vào FrameUp/<năm học>_<HK>/<lớp học phần>">
                    {reorganize.isPending ? <span className="spinner" /> : <Icon name="folder" size={16} />}
                    Sắp xếp theo học kỳ
                  </button>
                  <button className="btn btn-d" type="button" disabled={unlink.isPending} onClick={() => confirm('Hủy liên kết Google Drive? Bài nộp mới sẽ không ghi được lên Drive cho tới khi liên kết lại.') && unlink.mutate()}>
                    Hủy liên kết
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4A4E57' }}>
                  Đăng nhập tài khoản Google của bạn và cho phép FrameUp tạo thư mục nhận bài. Ứng dụng chỉ thấy các tệp do chính nó tạo, không đọc tệp khác trong Drive.
                </p>
                <button className="btn btn-p" type="button" disabled={!d.oauthAvailable || start.isPending} onClick={() => start.mutate()} style={{ alignSelf: 'flex-start' }}>
                  <Icon name="drive" size={16} />
                  Liên kết tài khoản Google
                </button>
                {!d.oauthAvailable && (
                  <span className="help">Máy chủ chưa cấu hình Google OAuth (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, DRIVE_MODE=google).</span>
                )}
              </>
            )}
          </Card>
          <Card title="Cách 2 · Chia sẻ thư mục cho tài khoản hệ thống">
            {d.serviceAccountEmail ? (
              <>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
                  <li>
                    Mở thư mục trên Google Drive → <b>Chia sẻ</b>
                  </li>
                  <li>
                    Thêm email bên dưới với quyền <b>Người chỉnh sửa</b>
                  </li>
                  <li>Dán link thư mục khi tạo bài tập</li>
                </ol>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="inp" value={d.serviceAccountEmail} readOnly style={{ flex: 1, fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }} />
                  <button className="btn" type="button" onClick={() => navigator.clipboard?.writeText(d.serviceAccountEmail!).then(() => toast.ok('Đã sao chép email'))}>
                    Sao chép
                  </button>
                </div>
              </>
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>
                Máy chủ chưa cấu hình tài khoản hệ thống (Service Account). Dùng Cách 1.
              </span>
            )}
          </Card>
        </div>
        <div className="col">
          <Card title="Thư mục nhận bài của các bài tập" body={false}>
            {d.folders.length ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bài tập</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.folders.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <Link to={`/lecturer/assignments/${f.id}`} style={{ color: '#1A1C21' }}>
                            {f.title.split('–')[0].trim()} · {f.section}
                          </Link>
                        </td>
                        <td>
                          {f.failed ? <Badge tone="red">Lỗi ghi {f.failed} bài</Badge> : f.pending ? <Badge tone="amber">Đang đồng bộ {f.pending}</Badge> : f.url ? <Badge tone="green">Ghi được</Badge> : <Badge tone="gray">Drive mô phỏng</Badge>}
                        </td>
                        <td>
                          {f.url && (
                            <a className="btn btn-sm" href={f.url} target="_blank" rel="noreferrer">
                              <Icon name="link" size={14} />
                              Mở
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="folder">Chưa có bài tập nào trong học kỳ này.</Empty>
            )}
          </Card>
          {problems.map((f) => (
            <Note key={f.id} tone="red" icon="warn">
              <b>
                {f.title.split('–')[0].trim()} · {f.section}
              </b>
              : {f.failed} bài nộp đang được giữ tạm trên máy chủ và sẽ tự đồng bộ khi quyền được cấp lại (hệ thống tự thử lại định kỳ).
            </Note>
          ))}
          <Note tone="gray" icon="shield">
            Hệ thống chỉ ghi vào bên trong thư mục bạn cấp, không đọc các thư mục khác.
          </Note>
        </div>
      </div>
    </div>
  );
}
