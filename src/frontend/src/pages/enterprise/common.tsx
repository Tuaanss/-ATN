import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { Badge, Field, Note, useToast } from '../../components/ui';
import { FormModal } from '../admin/kit';

export type Access = { state: 'NONE' } | { state: 'PENDING'; since: string } | { state: 'ACTIVE'; daysLeft: number; expiresAt: string } | { state: 'EXPIRED'; expiresAt: string };

export function AccessBadge({ a }: { a: Access }) {
  if (a.state === 'ACTIVE') return <Badge tone={a.daysLeft <= 2 ? 'amber' : 'green'}>{`Còn ${a.daysLeft} ngày`}</Badge>;
  if (a.state === 'PENDING') return <Badge tone="amber">Chờ duyệt</Badge>;
  if (a.state === 'EXPIRED') return <Badge tone="gray">Hết hạn</Badge>;
  return (
    <span className="muted" style={{ fontSize: 13 }}>
      Chưa có
    </span>
  );
}

export const gpa = (v: number | null) => (v == null ? '—' : v.toFixed(2));

/** Gửi yêu cầu xem bài cho một hoặc nhiều SV – Admin duyệt thời hạn cuối cùng. */
export function RequestModal({ students, viewDays, onClose, onDone }: { students: { id: string; fullName: string }[]; viewDays: { min: number; max: number }; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const options = [14, 21, 28].filter((d) => d >= viewDays.min && d <= viewDays.max);
  const [purpose, setPurpose] = useState('');
  const [days, setDays] = useState(options[0] ?? viewDays.min);
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<{ created: string[]; skipped: { studentCode: string; reason: string }[] }>('/enterprise/requests', { studentIds: students.map((s) => s.id), purpose: purpose.trim(), days }).then((r) => r.data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['enterprise'] });
      if (r.created.length) toast.ok(`Đã gửi ${r.created.length} yêu cầu, chờ Quản trị viên duyệt`);
      if (r.skipped.length) toast.err(r.skipped.map((s) => `${s.studentCode}: ${s.reason}`).join(' · '));
      onDone?.();
      onClose();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <FormModal
      title="Gửi yêu cầu xem bài"
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn btn-p"
            disabled={m.isPending}
            onClick={() => {
              if (purpose.trim().length < 10) return setErr('Mục đích tối thiểu 10 ký tự');
              setErr('');
              m.mutate();
            }}
          >
            Gửi yêu cầu
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {students.map((s) => (
          <span key={s.id} className="chip">
            {s.fullName}
          </span>
        ))}
      </div>
      <Field label="Mục đích *" error={err}>
        <textarea className="inp" rows={3} maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="VD: Tuyển thực tập sinh thiết kế UI/UX" style={{ height: 'auto', padding: 10 }} />
      </Field>
      <Field label="Thời hạn mong muốn" help={`Quản trị viên quyết định thời hạn cuối cùng (${viewDays.min}–${viewDays.max} ngày).`}>
        <div className="seg" role="radiogroup">
          {options.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={d === days} className={d === days ? 'on' : ''} onClick={() => setDays(d)}>
              {d / 7} tuần
            </button>
          ))}
        </div>
      </Field>
      <Note tone="blue" icon="info">
        Quy trình: Quản trị viên duyệt → bạn xem bài ngay (chỉ xem, không tải xuống, mọi lượt xem được ghi lại). Hết hạn, quyền tự thu hồi.
      </Note>
    </FormModal>
  );
}
