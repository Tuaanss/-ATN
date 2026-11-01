import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/auth';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Card, ChipInput, Field, initials, Loading, Modal, Note, PageHead, Switch, useToast } from '../../components/ui';
import { ago, fullDate } from '../../utils/format';

interface Profile {
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  cohort: string | null;
  major: string | null;
  phone: string | null;
  email: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  guardianPhone: string | null;
  noParentReason: string | null;
  discoverable: boolean;
  hasAvatar: boolean;
  avatarVersion: number;
  bio: string | null;
  skills: string[];
  githubUrl: string | null;
  behanceUrl: string | null;
  linkedinUrl: string | null;
  profileCompletedAt: string | null;
  account: { username: string; lastLoginAt: string | null; mustChangePassword: boolean };
  parents: { relation: string; label: string; phone: string; mustChangePassword: boolean; active: boolean }[];
  checklist: { phone: boolean; email: boolean; parent: boolean; password: boolean };
  createdParents?: string[];
}
type Form = {
  phone: string;
  email: string;
  fatherPhone: string;
  motherPhone: string;
  guardianPhone: string;
  noParent: boolean;
  noParentReason: string;
  discoverable: boolean;
  bio: string;
  skills: string[];
  githubUrl: string;
  behanceUrl: string;
  linkedinUrl: string;
};

const PHONE = /^(03|05|07|08|09)\d{8}$/;
const clean = (v: string) => v.replace(/[\s.-]/g, '');
const REASONS = ['Mồ côi / không còn người thân', 'Đã đủ 18 tuổi, tự lập', 'Người thân ở nước ngoài, không dùng SĐT Việt Nam', 'Lý do khác'];
const PARENT_FIELDS = [
  ['fatherPhone', 'SĐT bố'],
  ['motherPhone', 'SĐT mẹ'],
  ['guardianPhone', 'SĐT người giám hộ'],
] as const;

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!PHONE.test(clean(f.phone))) e.phone = 'SĐT gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Email không hợp lệ';
  for (const [k] of PARENT_FIELDS) {
    const v = clean(f[k]);
    if (!v || f.noParent) continue;
    if (!PHONE.test(v)) e[k] = 'SĐT gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09';
    else if (v === clean(f.phone)) e[k] = 'Trùng với SĐT của bạn. Vui lòng nhập số khác.';
  }
  const anyParent = PARENT_FIELDS.some(([k]) => clean(f[k]));
  if (f.noParent && !f.noParentReason) e.noParentReason = 'Chọn lý do';
  if (!f.noParent && !anyParent) e.fatherPhone = 'Nhập ít nhất một số';
  const link = (k: 'githubUrl' | 'behanceUrl' | 'linkedinUrl', host: RegExp) => {
    const v = f[k].trim();
    if (v && !host.test(v)) e[k] = 'Link không hợp lệ';
  };
  link('githubUrl', /github\.com|gitlab\.com/i);
  link('behanceUrl', /behance\.net/i);
  link('linkedinUrl', /linkedin\.com/i);
  return e;
}
const withScheme = (v: string) => (v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v.trim());

/** Hồ sơ cá nhân – mẫu sinh-vien/SV_ProfileSetup (UC03.1–3.4). Lần đầu chưa khai báo thì bị chặn ở trang này. */
export function ProfilePage() {
  useCrumbs([{ label: 'Hồ sơ cá nhân' }]);
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const q = useQuery({ queryKey: ['student', 'profile'], queryFn: () => api.get<Profile>('/student/profile').then((r) => r.data) });
  const p = q.data;

  useEffect(() => {
    if (!p) return;
    setForm({
      phone: p.phone ?? '',
      email: p.email ?? '',
      fatherPhone: p.fatherPhone ?? '',
      motherPhone: p.motherPhone ?? '',
      guardianPhone: p.guardianPhone ?? '',
      noParent: !!p.noParentReason,
      noParentReason: p.noParentReason ?? '',
      discoverable: p.discoverable,
      bio: p.bio ?? '',
      skills: p.skills,
      githubUrl: p.githubUrl ?? '',
      behanceUrl: p.behanceUrl ?? '',
      linkedinUrl: p.linkedinUrl ?? '',
    });
  }, [p]);

  const save = useMutation({
    mutationFn: (f: Form) =>
      api
        .put<Profile>('/student/profile', {
          phone: f.phone,
          email: f.email,
          fatherPhone: f.noParent ? '' : f.fatherPhone,
          motherPhone: f.noParent ? '' : f.motherPhone,
          guardianPhone: f.noParent ? '' : f.guardianPhone,
          noParentReason: f.noParent ? f.noParentReason : '',
          discoverable: f.discoverable,
          bio: f.bio,
          skills: f.skills,
          githubUrl: withScheme(f.githubUrl),
          behanceUrl: withScheme(f.behanceUrl),
          linkedinUrl: withScheme(f.linkedinUrl),
        })
        .then((r) => r.data),
    onSuccess: async (data) => {
      const first = !p?.profileCompletedAt;
      qc.setQueryData(['student', 'profile'], data);
      setConfirm(false);
      await refresh();
      toast.ok(data.createdParents?.length ? `Đã lưu hồ sơ · tạo ${data.createdParents.length} tài khoản phụ huynh` : 'Đã lưu hồ sơ');
      if (first) nav('/student');
    },
    onError: (e) => {
      setConfirm(false);
      const d = (e as AxiosError<{ details?: { field: string; message: string }[] }>).response?.data?.details;
      if (Array.isArray(d)) setErrors(Object.fromEntries(d.map((x) => [x.field, x.message])) as Partial<Record<keyof Form, string>>);
      toast.err(errorMessage(e));
    },
  });
  const avatar = useMutation({
    mutationFn: (f: File | null) => {
      if (!f) return api.post<Profile>('/student/profile/avatar/remove').then((r) => r.data);
      const fd = new FormData();
      fd.append('file', f);
      return api.post<Profile>('/student/profile/avatar', fd).then((r) => r.data);
    },
    onSuccess: async (data) => {
      qc.setQueryData(['student', 'profile'], data);
      await refresh();
      toast.ok(data.hasAvatar ? 'Đã cập nhật ảnh đại diện' : 'Đã xóa ảnh đại diện');
    },
    onError: (e) => toast.err(errorMessage(e)),
  });

  if (q.isLoading || !p || !form) return <Loading />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };
  const live = validate(form);
  const anyParent = !form.noParent && PARENT_FIELDS.some(([k]) => clean(form[k]) && !live[k]);
  const checks: [string, boolean][] = [
    ['SĐT bản thân', !live.phone],
    ['Email nhận thông báo', !live.email],
    ['Ít nhất 1 SĐT phụ huynh hợp lệ', anyParent || (form.noParent && !!form.noParentReason)],
    ['Đổi mật khẩu lần đầu', p.checklist.password],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const first = !p.profileCompletedAt;
  // đổi / gỡ SĐT phụ huynh đã liên kết → hỏi xác nhận (UC03.2)
  const unlinked = p.parents.filter((x) => {
    const k = x.relation === 'FATHER' ? 'fatherPhone' : x.relation === 'MOTHER' ? 'motherPhone' : 'guardianPhone';
    return form.noParent || clean(form[k]) !== x.phone;
  });
  const submit = () => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return toast.err('Kiểm tra lại các mục được đánh dấu');
    if (unlinked.length && !first) return setConfirm(true);
    save.mutate(form);
  };
  const inp = (k: keyof Form) => `inp${errors[k] ? ' inp-err' : ''}`;

  return (
    <div className="page">
      <PageHead title="Hồ sơ cá nhân" sub={`${p.fullName} · ${p.studentCode}${p.cohort ? ` · Khóa ${p.cohort}` : ''}${p.major ? ` · ${p.major}` : ''} · Ngày sinh ${fullDate(p.dateOfBirth)}`} />
      {first && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 10, background: '#FDECEC', color: '#A30000', fontSize: 14, lineHeight: 1.5 }}>
          <Icon name="warn" size={18} />
          <div>
            <b>Hoàn thiện hồ sơ để bắt đầu.</b> Bạn chưa thể xem bài tập hay nộp bài cho đến khi khai báo đủ thông tin bắt buộc (*).
          </div>
        </div>
      )}

      <div className="cols-side">
        <div className="col">
          <Card title="Liên hệ của bạn">
            <div className="cols-1-1" style={{ gap: 16 }}>
              <Field label="Số điện thoại *" error={errors.phone}>
                <input className={inp('phone')} inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="VD: 0356781204" />
              </Field>
              <Field label="Email nhận thông báo *" error={errors.email}>
                <input className={inp('email')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ten@email.com" />
              </Field>
            </div>
          </Card>

          <Card title="Số điện thoại phụ huynh / người giám hộ">
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Nhập ít nhất một số. Mỗi số sẽ tạo (hoặc liên kết) một tài khoản phụ huynh, đăng nhập bằng chính SĐT đó để xem điểm và bài của bạn.
            </p>
            <div className="grid3" style={{ gap: 16 }}>
              {PARENT_FIELDS.map(([k, label]) => {
                const linked = p.parents.find((x) => x.phone === clean(form[k]));
                return (
                  <Field key={k} label={label} error={errors[k]} help={linked && !form.noParent ? (linked.mustChangePassword ? 'Đã tạo tài khoản PH · chưa đăng nhập' : 'Tài khoản PH đang hoạt động') : undefined}>
                    <input className={inp(k)} inputMode="tel" value={form[k]} disabled={form.noParent} onChange={(e) => set(k, e.target.value)} placeholder="Không bắt buộc" style={form.noParent ? { background: '#F7F6F2' } : undefined} />
                  </Field>
                );
              })}
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.noParent} onChange={(e) => set('noParent', e.target.checked)} />
              Tôi không có SĐT phụ huynh / người giám hộ để khai báo
            </label>
            <Field error={errors.noParentReason}>
              <select className={inp('noParentReason')} disabled={!form.noParent} value={form.noParentReason} onChange={(e) => set('noParentReason', e.target.value)} style={!form.noParent ? { background: '#F7F6F2', color: '#8A8E97' } : undefined}>
                <option value="">Chọn lý do…</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: '#F7F6F2', fontSize: 12, lineHeight: 1.6, color: '#4A4E57' }}>
              <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                <Icon name="shield" size={16} />
              </span>
              <span>Theo Nghị định 13/2023/NĐ-CP: SĐT phụ huynh chỉ dùng để tạo tài khoản theo dõi kết quả học tập và gửi cảnh báo học tập. Doanh nghiệp không bao giờ thấy các số này.</span>
            </div>
          </Card>

          <Card
            title={
              <>
                Hồ sơ năng lực{' '}
                <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
                  — không bắt buộc, hiển thị cho doanh nghiệp
                </span>
              </>
            }
          >
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {p.hasAvatar ? (
                <img src={`/api/v1/account/avatar/${user?.studentId}?v=${p.avatarVersion}`} alt="Ảnh đại diện" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E3E1D9' }} />
              ) : (
                <span className="av" style={{ width: 72, height: 72, fontSize: 26 }}>
                  {initials(p.fullName)}
                </span>
              )}
              <button className="btn btn-sm" type="button" disabled={avatar.isPending} onClick={() => fileRef.current?.click()}>
                {avatar.isPending ? <span className="spinner" /> : <Icon name="upload" size={14} />}
                {p.hasAvatar ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện'}
              </button>
              {p.hasAvatar && (
                <button className="btn btn-sm btn-g" type="button" style={{ color: '#9B1C12' }} onClick={() => avatar.mutate(null)}>
                  Xóa ảnh
                </button>
              )}
              <span className="muted" style={{ fontSize: 12 }}>
                JPG, PNG, WEBP · tối đa 2 MB
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f && f.size > 2 * 1024 * 1024) return toast.err('Ảnh tối đa 2 MB');
                  if (f) avatar.mutate(f);
                }}
              />
            </div>
            <Field label="Giới thiệu bản thân" help={`${form.bio.length}/1000`}>
              <textarea className="inp" rows={3} maxLength={1000} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="VD: Sinh viên năm 3 ngành Thiết kế đồ họa, yêu thích thiết kế UI/UX cho ứng dụng di động." />
            </Field>
            <Field label="Kỹ năng" help="Gõ rồi nhấn Enter · tối đa 15">
              <ChipInput value={form.skills} onChange={(v) => set('skills', v)} max={15} placeholder="Thêm kỹ năng…" />
            </Field>
            <div className="grid3" style={{ gap: 16 }}>
              <Field label="GitHub" error={errors.githubUrl}>
                <input className={inp('githubUrl')} value={form.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} placeholder="github.com/…" />
              </Field>
              <Field label="Behance" error={errors.behanceUrl}>
                <input className={inp('behanceUrl')} value={form.behanceUrl} onChange={(e) => set('behanceUrl', e.target.value)} placeholder="behance.net/…" />
              </Field>
              <Field label="LinkedIn" error={errors.linkedinUrl}>
                <input className={inp('linkedinUrl')} value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="linkedin.com/in/…" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="col" style={{ position: 'sticky', top: 16 }}>
          <Card title="Mức hoàn thiện">
            <div style={{ height: 8, borderRadius: 4, background: '#EFEDE6' }}>
              <div style={{ width: `${(done / checks.length) * 100}%`, height: '100%', borderRadius: 4, background: done === checks.length ? '#15803D' : '#DB0000' }} />
            </div>
            {checks.map(([label, ok]) => (
              <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: ok ? '#15803D' : '#B42318', display: 'inline-flex' }}>
                  <Icon name={ok ? 'check' : 'close'} size={16} />
                </span>
                {label}
              </div>
            ))}
          </Card>
          <Card title="Cho phép doanh nghiệp tìm thấy tôi" extra={<Switch checked={form.discoverable} onChange={(v) => set('discoverable', v)} label="Cho phép doanh nghiệp tìm thấy tôi" />}>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Tắt nếu bạn không muốn xuất hiện trong kết quả tìm kiếm của doanh nghiệp. Có thể đổi bất cứ lúc nào; quyền xem bài đã cấp vẫn còn đến hết hạn.
            </p>
          </Card>
          <button className="btn btn-p" type="button" style={{ height: 46 }} disabled={save.isPending} onClick={submit}>
            {save.isPending ? <span className="spinner" /> : <Icon name="check" size={16} />}
            {first ? 'Lưu hồ sơ' : 'Lưu thay đổi'}
          </button>
          {first && (
            <p className="help" style={{ marginTop: -6, textAlign: 'center' }}>
              Chỉ lưu được khi tất cả mục bắt buộc hợp lệ.
            </p>
          )}
          {p.parents.length > 0 && (
            <Card title="Tài khoản phụ huynh">
              {p.parents.map((x) => (
                <div key={x.relation} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 8 }}>
                  <span>
                    {x.label} · <span className="mono">{x.phone}</span>
                  </span>
                  {x.mustChangePassword ? <Badge tone="amber">Chưa đăng nhập</Badge> : <Badge tone="green">Đang dùng</Badge>}
                </div>
              ))}
              <p className="help" style={{ marginTop: 0 }}>
                Phụ huynh đăng nhập bằng SĐT, mật khẩu lần đầu là chính SĐT đó và phải đổi ngay.
              </p>
            </Card>
          )}
          <Card title="Tài khoản">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar name={p.fullName} size={36} />
              <div style={{ fontSize: 13 }}>
                <b>{p.account.username}</b>
                <div className="muted">Đăng nhập gần nhất: {p.account.lastLoginAt ? ago(p.account.lastLoginAt) : '—'}</div>
              </div>
            </div>
            {p.account.mustChangePassword && (
              <Note tone="amber" icon="key">
                Bạn đang dùng mật khẩu do hệ thống cấp. Hãy đổi mật khẩu.
              </Note>
            )}
            <button className="btn" type="button" onClick={() => setPwOpen(true)}>
              <Icon name="key" size={16} />
              Đổi mật khẩu
            </button>
          </Card>
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)}>
        <h2 className="sec">Thay đổi SĐT phụ huynh</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Tài khoản phụ huynh cũ sẽ bị gỡ liên kết: <b>{unlinked.map((x) => `${x.label} ${x.phone}`).join(', ')}</b>. Phụ huynh này sẽ không còn xem được điểm và bài của bạn.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => setConfirm(false)}>
            Hủy
          </button>
          <button className="btn btn-p" type="button" disabled={save.isPending} onClick={() => save.mutate(form)}>
            Đồng ý, lưu
          </button>
        </div>
      </Modal>
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const strong = next.length >= 10 && /[a-z]/.test(next) && /[A-Z]/.test(next) && /\d/.test(next);
  const m = useMutation({
    mutationFn: () => api.post('/account/password', { current: cur, next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'profile'] });
      toast.ok('Đã đổi mật khẩu');
      setCur('');
      setNext('');
      setAgain('');
      onClose();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const submit = () => {
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) return setErr('Mật khẩu mới tối thiểu 8 ký tự, có chữ và số');
    if (next === cur) return setErr('Mật khẩu mới phải khác mật khẩu cũ');
    if (next !== again) return setErr('Nhập lại mật khẩu mới không khớp');
    setErr('');
    m.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} width={440}>
      <h2 className="sec">Đổi mật khẩu</h2>
      <Field label="Mật khẩu hiện tại">
        <input className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới" help={next ? (strong ? 'Mạnh' : 'Tối thiểu 8 ký tự, có chữ và số, khác mật khẩu cũ') : 'Tối thiểu 8 ký tự, có chữ và số, khác mật khẩu cũ'}>
        <input className="inp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Nhập lại mật khẩu mới" error={err}>
        <input className="inp" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn" type="button" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn-p" type="button" disabled={m.isPending || !cur || !next} onClick={submit}>
          Đổi mật khẩu
        </button>
      </div>
    </Modal>
  );
}
