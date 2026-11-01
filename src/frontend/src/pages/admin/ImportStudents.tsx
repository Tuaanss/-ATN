import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Note, PageHead, Seg, Stepper, useToast } from '../../components/ui';
import { ExcelUpload, downloadFile } from '../../components/excel';
import { Table, Tiles, useAdmin } from './kit';
import type { Catalog } from './AdminUsers';

interface Preview {
  jobId: string;
  fileName: string;
  total: number;
  valid: number;
  errorRows: number;
  rows: { row: number; studentCode: string; fullName: string; dateOfBirth: string; classCode: string; cohort: string | null; major: string | null; ok: boolean; problems: string[] }[];
}
interface Done {
  created: number;
  failed: { row: number; studentCode: string; message: string }[];
}

/** Import sinh viên từ Excel – mẫu admin/import-sinh-vien (UC02.3). */
export function ImportStudents() {
  useCrumbs([{ label: 'Tài khoản sinh viên', to: '/admin/students' }, { label: 'Import từ Excel' }]);
  const toast = useToast();
  const qc = useQueryClient();
  const cat = useAdmin<Catalog>('/catalog');
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [done, setDone] = useState<(Done & { skipped: Preview['rows'] }) | null>(null);
  const [filter, setFilter] = useState<'' | 'ok' | 'bad'>('');
  const step = done ? 3 : prev ? 2 : 1;

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      setPrev((await api.post<Preview>('/admin/students/import/preview', fd)).data);
      setFilter('');
    } catch (e) {
      toast.err(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!prev) return;
    setBusy(true);
    try {
      const r = (await api.post<Done>(`/admin/students/import/${prev.jobId}/commit`)).data;
      setDone({ ...r, skipped: prev.rows.filter((x) => !x.ok) });
      qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast.err(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const errorReport = () => {
    const rows = [...(done?.skipped.map((r) => [r.row, r.studentCode, r.fullName, r.problems.join('; ')]) ?? []), ...(done?.failed.map((f) => [f.row, f.studentCode, '', f.message]) ?? [])];
    const csv = '﻿' + [['Dòng', 'MSSV', 'Họ tên', 'Lỗi'], ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'Bao_cao_loi_import_sinh_vien.csv';
    a.click();
  };
  const rows = prev?.rows.filter((r) => !filter || (filter === 'ok' ? r.ok : !r.ok)) ?? [];

  return (
    <div className="page">
      <PageHead
        title="Import sinh viên từ Excel"
        actions={
          <>
            <Link className="btn btn-g" to="/admin/students">
              <Icon name="chevronLeft" size={18} /> Danh sách sinh viên
            </Link>
            <button className="btn" onClick={() => downloadFile('/admin/students/import/template', 'Mau_import_sinh_vien.xlsx').catch((e) => toast.err(errorMessage(e)))}>
              <Icon name="download" size={18} /> Tải tệp mẫu
            </button>
          </>
        }
      />
      <Card>
        <Stepper
          steps={[
            { title: 'Chọn tệp', sub: prev ? prev.fileName : 'Tệp .xlsx theo mẫu', state: step > 1 ? 'done' : 'current' },
            { title: 'Kiểm tra dữ liệu', sub: prev ? `${prev.valid}/${prev.total} dòng hợp lệ` : 'Xem trước, lọc lỗi', state: step > 2 ? 'done' : step === 2 ? 'current' : 'todo' },
            { title: 'Hoàn tất', sub: done ? `Đã tạo ${done.created} tài khoản` : 'Tạo tài khoản', state: step === 3 ? 'current' : 'todo' },
          ]}
        />
      </Card>

      {step === 1 && (
        <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 20 }}>
          <ExcelUpload title="1. Chọn tệp danh sách" templateUrl="/admin/students/import/template" templateName="Mau_import_sinh_vien.xlsx" onFile={upload} busy={busy} />
          <Card title="Quy tắc dữ liệu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5 }}>
              {[
                ['MSSV', 'Bắt buộc, không trùng trong tệp và trong hệ thống.'],
                ['Họ tên', 'Bắt buộc, tối đa 100 ký tự.'],
                ['Ngày sinh', 'Bắt buộc, dd/mm/yyyy — dùng làm mật khẩu ban đầu.'],
                ['Lớp', `Mã lớp sinh hoạt phải có trong danh mục${cat.data?.classes.length ? `, VD: ${cat.data.classes.slice(0, 2).map((c) => c.code).join(', ')}` : ''}. Khóa, ngành lấy theo lớp.`],
                ['Email, SĐT', 'Không bắt buộc — sinh viên tự khai báo khi đăng nhập lần đầu.'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#15803D', marginTop: 2 }}>
                    <Icon name="check" size={16} strokeWidth={2.2} />
                  </span>
                  <div>
                    <b>{k}</b> — <span className="muted">{v}</span>
                  </div>
                </div>
              ))}
              <Note tone="blue" icon="info">
                Mật khẩu ban đầu = ngày sinh (ddmmyyyy); sinh viên đổi mật khẩu và khai báo hồ sơ ở lần đăng nhập đầu.
              </Note>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && prev && (
        <>
          <Tiles
            items={[
              ['Tổng số dòng', prev.total, 'list'],
              ['Hợp lệ', prev.valid, 'check'],
              ['Có lỗi', prev.errorRows, 'warn'],
              ['Sẽ tạo tài khoản', prev.valid, 'users'],
            ]}
          />
          <Card
            body={false}
            title="2. Xem trước & kiểm tra lỗi"
            extra={
              <Seg
                value={filter}
                onChange={setFilter}
                options={[
                  { value: '', label: 'Tất cả' },
                  { value: 'ok', label: 'Hợp lệ' },
                  { value: 'bad', label: 'Có lỗi' },
                ]}
              />
            }
          >
            <Table
              rows={rows}
              rowKey={(r) => String(r.row)}
              pageSize={15}
              cols={[
                { h: 'Dòng', r: (r) => <span className="muted">{r.row}</span> },
                { h: 'MSSV', r: (r) => <span className="mono">{r.studentCode || '—'}</span> },
                { h: 'Họ tên', r: (r) => r.fullName || '—' },
                { h: 'Ngày sinh', r: (r) => r.dateOfBirth || '—' },
                { h: 'Lớp', r: (r) => <span className="mono">{r.classCode || '—'}</span> },
                { h: 'Khóa · Ngành', r: (r) => (r.cohort ? `${r.cohort} · ${r.major}` : <span className="muted">—</span>) },
                {
                  h: 'Kết quả kiểm tra',
                  r: (r) =>
                    r.ok ? (
                      <Badge tone="green">Hợp lệ</Badge>
                    ) : (
                      <span style={{ color: '#B42318', fontSize: 13 }}>{r.problems.join('; ')}</span>
                    ),
                },
              ]}
            />
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 14 }}>{prev.errorRows ? `Các dòng lỗi sẽ được bỏ qua, chỉ tạo tài khoản cho ${prev.valid} dòng hợp lệ.` : 'Tất cả các dòng đều hợp lệ.'}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setPrev(null)}>
                  Chọn tệp khác
                </button>
                <button className="btn btn-p" disabled={!prev.valid || busy} onClick={run}>
                  {busy ? <span className="spinner" /> : <Icon name="check" size={18} />} Tạo {prev.valid} tài khoản
                </button>
              </div>
            </div>
          </Card>
        </>
      )}

      {step === 3 && done && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '36px 20px' }}>
            <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#E3F2E8', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={32} strokeWidth={2.4} />
            </span>
            <h2 style={{ fontSize: 20 }}>Import hoàn tất</h2>
            <p className="muted">
              Đã tạo {done.created} tài khoản sinh viên{done.skipped.length + done.failed.length ? `, bỏ qua ${done.skipped.length + done.failed.length} dòng lỗi` : ''}.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {done.skipped.length + done.failed.length > 0 && (
                <button className="btn" onClick={errorReport}>
                  <Icon name="download" size={16} /> Tải báo cáo lỗi
                </button>
              )}
              <button
                className="btn"
                onClick={() => {
                  setDone(null);
                  setPrev(null);
                }}
              >
                Import tệp khác
              </button>
              <Link className="btn btn-p" to="/admin/students">
                Xem danh sách sinh viên
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
