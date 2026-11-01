import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Note, PageHead, Seg, Stepper, useToast } from '../../components/ui';
import { ExcelUpload, downloadFile } from '../../components/excel';
import { Table, Tiles, useAdmin } from './kit';
import { semName } from './AdminAcademic';

type Kind = 'lecturers' | 'courses' | 'sections';
interface PRow {
  row: number;
  ok: boolean;
  problems: string[];
  cells: Record<string, string>;
}
interface Preview {
  jobId: string;
  fileName: string;
  total: number;
  valid: number;
  errorRows: number;
  rows: PRow[];
}
interface Done {
  created: number;
  failed: { row: number; code: string; message: string }[];
  passwords: { code: string; fullName: string; email: string; password: string }[];
}

const CFG: Record<Kind, { title: string; noun: string; back: [string, string]; file: string; cols: [string, string][]; rules: [string, string][]; note: string }> = {
  lecturers: {
    title: 'Import giảng viên từ Excel',
    noun: 'tài khoản giảng viên',
    back: ['/admin/lecturers', 'Tài khoản giảng viên'],
    file: 'Mau_import_giang_vien.xlsx',
    cols: [
      ['code', 'Mã GV'],
      ['name', 'Họ tên'],
      ['email', 'Email'],
      ['phone', 'SĐT'],
      ['faculty', 'Mã khoa'],
    ],
    rules: [
      ['Mã GV', 'Bắt buộc, dùng làm tên đăng nhập, không trùng.'],
      ['Họ tên', 'Bắt buộc, có thể kèm học hàm, học vị.'],
      ['Email', 'Bắt buộc, không trùng – nhận mật khẩu tạm.'],
      ['SĐT', 'Không bắt buộc, 10 số.'],
      ['Mã khoa', 'Theo Danh mục › Khoa, để trống nếu chưa xếp khoa.'],
    ],
    note: 'Mỗi giảng viên nhận email chứa mật khẩu tạm và phải đổi mật khẩu ở lần đăng nhập đầu. Sau khi import có thể tải danh sách mật khẩu tạm.',
  },
  courses: {
    title: 'Import môn học từ Excel',
    noun: 'môn học',
    back: ['/admin/semesters', 'Học kỳ & môn học'],
    file: 'Mau_import_mon_hoc.xlsx',
    cols: [
      ['code', 'Mã môn'],
      ['name', 'Tên môn'],
      ['credits', 'TC'],
      ['type', 'Loại môn'],
      ['faculty', 'Khoa'],
      ['w', 'CC · BT · GK · CK'],
    ],
    rules: [
      ['Mã môn', 'Bắt buộc, không trùng.'],
      ['Tín chỉ', 'Số nguyên 1–10.'],
      ['Loại môn', 'Thiết kế / Lập trình / Khác.'],
      ['Mã khoa', 'Theo Danh mục › Khoa (không bắt buộc).'],
      ['Trọng số', 'CC, BT, GK, CK (%) tổng bằng 100; để trống cả 4 cột = 10 · 30 · 20 · 40.'],
    ],
    note: 'Loại môn quyết định loại sản phẩm gợi ý khi giảng viên giao bài.',
  },
  sections: {
    title: 'Import lớp học phần từ Excel',
    noun: 'lớp học phần',
    back: ['/admin/sections', 'Lớp học phần'],
    file: 'Mau_import_lop_hoc_phan.xlsx',
    cols: [
      ['code', 'Mã lớp HP'],
      ['course', 'Mã môn'],
      ['lecturer', 'Mã GV'],
      ['max', 'Sĩ số'],
      ['weeks', 'Tuần'],
      ['schedule', 'Lịch học'],
    ],
    rules: [
      ['Mã lớp HP', 'Dạng MÃMÔN_số, VD: TK101_05, không trùng.'],
      ['Mã môn, Mã GV', 'Phải có sẵn trong hệ thống.'],
      ['Sĩ số', 'Sĩ số tối đa 1–300. Tuần để trống = 1 đến 15.'],
      ['Lịch học', 'Mỗi buổi "T2 1-3 A2-301" (thứ, tiết, phòng); nhiều buổi cách nhau dấu ;. Chủ nhật ghi CN.'],
      ['Trùng lịch', 'Kiểm tra trùng giờ giảng viên, trùng phòng với lớp đã có và giữa các dòng trong tệp.'],
    ],
    note: 'Lớp được mở trong học kỳ chọn ở trên. Xếp sinh viên vào lớp trong mục chi tiết lớp sau khi import.',
  },
};

const cellOf = (k: Kind, key: string, c: Record<string, string>) => {
  if (k === 'courses' && key === 'w') return [c.wa, c.wb, c.wm, c.wf].every((x) => !x) ? '10 · 30 · 20 · 40' : [c.wa, c.wb, c.wm, c.wf].map((x) => x || 0).join(' · ');
  if (k === 'sections' && key === 'weeks') return `${c.ws || 1}–${c.we || 15}`;
  return c[key] || '—';
};

function csv(name: string, rows: (string | number)[][]) {
  const text = '﻿' + rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

/** Import GV / môn học / lớp học phần từ Excel – cùng luồng 3 bước với import sinh viên. */
export function ImportGeneric() {
  const { kind = '' } = useParams();
  const k = kind as Kind;
  const cfg = CFG[k];
  useCrumbs(cfg ? [{ label: cfg.back[1], to: cfg.back[0] }, { label: 'Import từ Excel' }] : []);
  const toast = useToast();
  const qc = useQueryClient();
  const sems = useAdmin<{ id: string; academicYear: string; term: string; isCurrent: boolean }[]>('/semesters', k === 'sections');
  const [semester, setSemester] = useState('');
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [filter, setFilter] = useState<'' | 'ok' | 'bad'>('');
  if (!cfg) return <Navigate to="/admin" replace />;
  const semId = semester || sems.data?.find((s) => s.isCurrent)?.id || sems.data?.[0]?.id || '';
  const step = done ? 3 : prev ? 2 : 1;
  const tpl = `/admin/import/${k}/template`;

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      setPrev((await api.post<Preview>(`/admin/import/${k}/preview${k === 'sections' && semId ? `?semester=${semId}` : ''}`, fd)).data);
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
      setDone((await api.post<Done>(`/admin/import/${k}/${prev.jobId}/commit`)).data);
      qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast.err(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const rows = prev?.rows.filter((r) => !filter || (filter === 'ok' ? r.ok : !r.ok)) ?? [];
  const errCount = done ? (prev?.errorRows ?? 0) + done.failed.length : 0;

  return (
    <div className="page">
      <PageHead
        title={cfg.title}
        actions={
          <>
            <Link className="btn btn-g" to={cfg.back[0]}>
              <Icon name="chevronLeft" size={18} /> {cfg.back[1]}
            </Link>
            <button className="btn" onClick={() => downloadFile(tpl, cfg.file).catch((e) => toast.err(errorMessage(e)))}>
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
            { title: 'Hoàn tất', sub: done ? `Đã tạo ${done.created} ${cfg.noun}` : `Tạo ${cfg.noun}`, state: step === 3 ? 'current' : 'todo' },
          ]}
        />
      </Card>

      {step === 1 && (
        <div className="cols-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {k === 'sections' && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>Mở lớp trong học kỳ</b>
                  <select className="inp" aria-label="Học kỳ" value={semId} onChange={(e) => setSemester(e.target.value)} style={{ width: 'auto', minWidth: 240 }}>
                    {sems.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {semName(s)}
                        {s.isCurrent ? ' (hiện tại)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            )}
            <ExcelUpload title="1. Chọn tệp danh sách" templateUrl={tpl} templateName={cfg.file} onFile={upload} busy={busy} disabled={k === 'sections' && !semId} />
          </div>
          <Card title="Quy tắc dữ liệu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5 }}>
              {cfg.rules.map(([a, b]) => (
                <div key={a} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#15803D', marginTop: 2 }}>
                    <Icon name="check" size={16} strokeWidth={2.2} />
                  </span>
                  <div>
                    <b>{a}</b> — <span className="muted">{b}</span>
                  </div>
                </div>
              ))}
              <Note tone="blue" icon="info">
                {cfg.note}
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
              [`Sẽ tạo ${cfg.noun}`, prev.valid, 'plus'],
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
                ...cfg.cols.map(([key, h]) => ({ h, r: (r: PRow) => <span className={key === 'code' || key === 'course' || key === 'lecturer' ? 'mono' : undefined}>{cellOf(k, key, r.cells)}</span> })),
                { h: 'Kết quả kiểm tra', r: (r) => (r.ok ? <Badge tone="green">Hợp lệ</Badge> : <span style={{ color: '#B42318', fontSize: 13 }}>{r.problems.join('; ')}</span>) },
              ]}
            />
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 14 }}>{prev.errorRows ? `Các dòng lỗi sẽ được bỏ qua, chỉ tạo ${prev.valid} ${cfg.noun} hợp lệ.` : 'Tất cả các dòng đều hợp lệ.'}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setPrev(null)}>
                  Chọn tệp khác
                </button>
                <button className="btn btn-p" disabled={!prev.valid || busy} onClick={run}>
                  {busy ? <span className="spinner" /> : <Icon name="check" size={18} />} Tạo {prev.valid} {cfg.noun}
                </button>
              </div>
            </div>
          </Card>
        </>
      )}

      {step === 3 && done && prev && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '36px 20px' }}>
            <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#E3F2E8', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={32} strokeWidth={2.4} />
            </span>
            <h2 style={{ fontSize: 20 }}>Import hoàn tất</h2>
            <p className="muted">
              Đã tạo {done.created} {cfg.noun}
              {errCount ? `, bỏ qua ${errCount} dòng lỗi` : ''}.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {done.passwords.length > 0 && (
                <button className="btn" onClick={() => csv('Mat_khau_tam_giang_vien.csv', [['Mã GV', 'Họ tên', 'Email', 'Mật khẩu tạm'], ...done.passwords.map((p) => [p.code, p.fullName, p.email, p.password])])}>
                  <Icon name="key" size={16} /> Tải danh sách mật khẩu tạm
                </button>
              )}
              {errCount > 0 && (
                <button
                  className="btn"
                  onClick={() =>
                    csv(`Bao_cao_loi_import_${k}.csv`, [
                      ['Dòng', 'Mã', 'Lỗi'],
                      ...prev.rows.filter((r) => !r.ok).map((r) => [r.row, r.cells.code ?? '', r.problems.join('; ')]),
                      ...done.failed.map((f) => [f.row, f.code, f.message]),
                    ])
                  }
                >
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
              <Link className="btn btn-p" to={cfg.back[0]}>
                Xem {cfg.back[1].toLowerCase()}
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
