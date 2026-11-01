import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import { useCrumbs } from '../layouts/AppLayout';
import { Icon } from '../components/Icon';
import { Avatar, Badge, Card, Field, KV, Loading, PageHead, useToast } from '../components/ui';
import { fullDT } from '../utils/format';

interface Account {
  username: string;
  role: string;
  fullName: string;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  history: { action: string; at: string; summary: string | null }[];
}
const ROLE: Record<string, string> = { LECTURER: 'Giảng viên', STUDENT: 'Sinh viên', ADMIN: 'Quản trị viên', PARENT: 'Phụ huynh', ENTERPRISE: 'Doanh nghiệp' };
const ACTION: Record<string, [string, 'green' | 'blue' | 'amber']> = { LOGIN: ['Đăng nhập thành công', 'green'], PASSWORD_CHANGE: ['Đổi mật khẩu', 'blue'], PASSWORD_RESET: ['Đặt lại mật khẩu qua email', 'amber'] };
const maskEmail = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_m, a: string, b: string, c: string) => `${a}${'*'.repeat(Math.min(b.length, 6))}${c}`);

/** Tài khoản & bảo mật – mẫu chung/Shared_Account. */
export function AccountPage() {
  useCrumbs([{ label: 'Tài khoản & bảo mật' }]);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account/me').then((r) => r.data) });
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const change = useMutation({
    mutationFn: () => api.post('/account/password', { current: cur, next }),
    onSuccess: () => {
      toast.ok('Đã đổi mật khẩu');
      setCur('');
      setNext('');
      setAgain('');
      qc.invalidateQueries({ queryKey: ['account'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  if (q.isLoading || !q.data) return <Loading />;
  const a = q.data;
  const submit = () => {
    if (!cur) return setErr('Nhập mật khẩu hiện tại');
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) return setErr('Mật khẩu mới tối thiểu 8 ký tự, có chữ và số');
    if (next === cur) return setErr('Mật khẩu mới phải khác mật khẩu cũ');
    if (next !== again) return setErr('Nhập lại mật khẩu mới không khớp');
    setErr('');
    change.mutate();
  };

  return (
    <div className="page">
      <PageHead title="Tài khoản & bảo mật" sub="Thông tin đăng nhập, mật khẩu và lịch sử đăng nhập" />
      <div className="cols-2-1">
        <div className="col">
          <Card title="Thông tin tài khoản">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar name={a.fullName} size={52} strong />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{a.fullName}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Vai trò: {ROLE[a.role] ?? a.role}
                </div>
              </div>
            </div>
            <KV
              rows={[
                ['Tên đăng nhập', <span key="u" className="mono">{a.username}</span>],
                ['Email nhận thông báo', a.email ? maskEmail(a.email) : '—'],
                ['Đăng nhập gần nhất', a.lastLoginAt ? fullDT(a.lastLoginAt) : '—'],
                ['Trạng thái', <Badge key="s" tone={a.status === 'ACTIVE' ? 'green' : 'red'}>{a.status === 'ACTIVE' ? 'Hoạt động' : a.status}</Badge>],
                ['Mật khẩu đổi lần cuối', a.passwordChangedAt ? fullDT(a.passwordChangedAt) : 'Chưa đổi'],
              ]}
            />
          </Card>
          <Card title="Lịch sử đăng nhập & bảo mật" body={false}>
            {a.history.length ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hoạt động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.history.map((h, i) => {
                      const [t, tone] = ACTION[h.action] ?? [h.summary ?? h.action, 'blue' as const];
                      return (
                        <tr key={i}>
                          <td className="mono" style={{ fontSize: 13 }}>
                            {fullDT(h.at)}
                          </td>
                          <td>
                            <Badge tone={tone}>{t}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="muted" style={{ padding: 20, fontSize: 13 }}>
                Chưa có dữ liệu.
              </div>
            )}
          </Card>
        </div>
        <div className="col">
          <Card title="Đổi mật khẩu">
            <Field label="Mật khẩu hiện tại">
              <input className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </Field>
            <Field label="Mật khẩu mới" help="Tối thiểu 8 ký tự, có chữ và số, khác mật khẩu cũ">
              <input className="inp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Nhập lại mật khẩu mới" error={err}>
              <input className="inp" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </Field>
            <button className="btn btn-p" type="button" disabled={change.isPending} onClick={submit}>
              <Icon name="key" size={16} />
              Đổi mật khẩu
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
