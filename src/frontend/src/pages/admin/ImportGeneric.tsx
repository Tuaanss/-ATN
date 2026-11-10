import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useCrumbs } from '../../layouts/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, Note, PageHead, Seg, Stepper, useToast } from '../../components/ui';
import { ExcelUpload, downloadFile } from '../../components/excel';
import { Table, Tiles, useAdmin } from './kit';
import { semName } from './AdminAcademic';

type Kind = 'lecturers' | 'courses' | 'sections' | 'faculties' | 'majors' | 'cohorts' | 'classes' | 'enrollments';
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
      ['faculty', 'Khoa'],
    ],
    rules: [
      ['Mã môn', 'Bắt buộc, không trùng.'],
      ['Tín chỉ', 'Số nguyên 1–10.'],
      ['Mã khoa', 'Theo Danh mục › Khoa (không bắt buộc).'],
    ],
    note: 'Môn học dùng để gom các lớp học phần và bài tập của sinh viên các khóa.',
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
    ],
    rules: [
      ['Mã lớp HP', 'Dạng MÃMÔN_HKx_NĂMHỌC_STT, VD: TK101_HK1_2526_01 (HK1 / HK2 / HE; năm học 2025–2026 ghi 2526). Để trống thì tự đánh số.'],
      ['Mã môn, Mã GV', 'Phải có sẵn trong hệ thống.'],
    ],
    note: 'Lớp được mở trong học kỳ chọn ở trên. Xếp sinh viên vào lớp bằng import xếp lớp hoặc trong mục chi tiết lớp.',
  },
  faculties: {
    title: 'Import khoa từ Excel',
    noun: 'khoa',
    back: ['/admin/catalog', 'Danh mục'],
    file: 'Mau_import_khoa.xlsx',
    cols: [
      ['code', 'Mã khoa'],
      ['name', 'Tên khoa'],
    ],
    rules: [
      ['Mã khoa', 'Bắt buộc, tối đa 20 ký tự, không trùng.'],
      ['Tên khoa', 'Bắt buộc, không trùng với khoa đã có.'],
    ],
    note: 'Thứ tự đầu năm học: Khoa → Ngành → Khóa → Lớp hành chính → Sinh viên.',
  },
  majors: {
    title: 'Import ngành từ Excel',
    noun: 'ngành',
    back: ['/admin/catalog', 'Danh mục'],
    file: 'Mau_import_nganh.xlsx',
    cols: [
      ['code', 'Mã ngành'],
      ['name', 'Tên ngành'],
      ['faculty', 'Mã khoa'],
    ],
    rules: [
      ['Mã ngành', 'Bắt buộc, tối đa 20 ký tự, không trùng.'],
      ['Tên ngành', 'Bắt buộc.'],
      ['Mã khoa', 'Bắt buộc, theo Danh mục › Khoa.'],
    ],
    note: 'Ngành của sinh viên lấy theo lớp hành chính; tạo ngành trước khi import lớp hành chính.',
  },
  cohorts: {
    title: 'Import khóa từ Excel',
    noun: 'khóa',
    back: ['/admin/catalog', 'Danh mục'],
    file: 'Mau_import_khoa_hoc.xlsx',
    cols: [
      ['name', 'Khóa'],
      ['year', 'Năm nhập học'],
    ],
    rules: [
      ['Khóa', 'Bắt buộc, VD: D26, tối đa 10 ký tự, không trùng.'],
      ['Năm nhập học', 'Để trống thì lấy theo 2 số cuối tên khóa (D26 → 2026).'],
    ],
    note: 'Import lớp hành chính cũng tự tạo khóa còn thiếu; dùng mục này khi muốn tạo khóa trước.',
  },
  classes: {
    title: 'Import lớp hành chính từ Excel',
    noun: 'lớp hành chính',
    back: ['/admin/catalog', 'Danh mục'],
    file: 'Mau_import_lop_hanh_chinh.xlsx',
    cols: [
      ['code', 'Mã lớp'],
      ['major', 'Mã ngành'],
      ['cohort', 'Khóa'],
    ],
    rules: [
      ['Mã lớp', 'Bắt buộc, không trùng, tối đa 30 ký tự.'],
      ['Mã ngành', 'Theo Danh mục › Ngành.'],
      ['Khóa', 'VD: D26. Khóa chưa có sẽ được tạo mới cùng lúc.'],
      ['Năm nhập học', 'Để trống thì lấy theo 2 số cuối tên khóa (D26 → 2026).'],
    ],
    note: 'Đầu năm học: import lớp hành chính trước, sau đó import sinh viên với cột "Lớp" là mã lớp hành chính.',
  },
  enrollments: {
    title: 'Xếp sinh viên vào lớp học phần từ Excel',
    noun: 'lượt xếp lớp',
    back: ['/admin/sections', 'Lớp học phần'],
    file: 'Mau_xep_sinh_vien_vao_lop_hoc_phan.xlsx',
    cols: [
      ['section', 'Mã lớp HP'],
      ['code', 'MSV'],
      ['name', 'Họ tên'],
    ],
    rules: [['Mã lớp HP, MSV', 'Bắt buộc, phải có sẵn trong hệ thống. Một tệp xếp được nhiều lớp.']],
    note: 'Sinh viên được xếp vào lớp sẽ thấy lớp học phần và bài tập của lớp ngay sau khi import.',
  },
};

const cellOf = (k: Kind, key: string, c: Record<string, string>) => {
  if (k === 'cohorts' && key === 'year') return c.year || (c.yearAuto ? `${c.yearAuto} (theo tên khóa)` : '—');
  if (k === 'classes' && key === 'cohort') return c.cohortNew ? `${c.cohort} (khóa mới · ${c.cohortNew})` : c.cohort || '—';
  return c[key] || '—';
};

function csv(name: string, rows: (string | number)[][]) {
  const text = '﻿' + rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

/** Import GV / môn học / lớp học phần / lớp hành chính / xếp lớp từ Excel – cùng luồng 3 bước với import sinh viên. */
export function ImportGeneric() {
  const { kind = '' } = useParams();
  const k = kind as Kind;
  const cfg = CFG[k];
  useCrumbs(cfg ? [{ label: cfg.back[1], to: cfg.back[0] }, { label: 'Import từ Excel' }] : []);
  const toast = useToast();
  const qc = useQueryClient();
  const sems = useAdmin<{ id: string; academicYear: string; term: string; isCurrent: boolean }[]>('/semesters', k === 'sections');
  // ?section=<id>: xếp SV vào một lớp cụ thể (mở từ chi tiết lớp học phần) – tệp chỉ cần cột MSV
  const [sp] = useSearchParams();
  const secId = k === 'enrollments' ? (sp.get('section') ?? '') : '';
  const one = useAdmin<{ code: string; course: string }>(`/sections/${secId}/students`, !!secId);
  const [semester, setSemester] = useState('');
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [filter, setFilter] = useState<'' | 'ok' | 'bad'>('');
  if (!cfg) return <Navigate to="/admin" replace />;
  const semId = semester || sems.data?.find((s) => s.isCurrent)?.id || sems.data?.[0]?.id || '';
  const step = done ? 3 : prev ? 2 : 1;
  const tpl = `/admin/import/${k}/template${secId ? `?section=${secId}` : ''}`;
  const title = secId ? `Xếp sinh viên vào lớp ${one.data?.code ?? ''}` : cfg.title;
  const tplName = secId && one.data ? `Xep_sinh_vien_${one.data.code}.xlsx` : cfg.file;
  const query = k === 'sections' && semId ? `?semester=${semId}` : secId ? `?section=${secId}` : '';

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      setPrev((await api.post<Preview>(`/admin/import/${k}/preview${query}`, fd)).data);
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
  const verb = k === 'enrollments' ? 'Xếp' : 'Tạo';

  return (
    <div className="page">
      <PageHead
        title={title}
        actions={
          <>
            <Link className="btn btn-g" to={cfg.back[0]}>
              <Icon name="chevronLeft" size={18} /> {cfg.back[1]}
            </Link>
            <button className="btn" onClick={() => downloadFile(tpl, tplName).catch((e) => toast.err(errorMessage(e)))}>
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
            { title: 'Hoàn tất', sub: done ? `Đã ${verb.toLowerCase()} ${done.created} ${cfg.noun}` : `${verb} ${cfg.noun}`, state: step === 3 ? 'current' : 'todo' },
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
            <ExcelUpload title="1. Chọn tệp danh sách" templateUrl={tpl} templateName={tplName} onFile={upload} busy={busy} disabled={k === 'sections' && !semId} />
          </div>
          <Card title="Quy tắc dữ liệu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5 }}>
              {(secId ? [['MSV', 'Bắt buộc, phải có sẵn trong hệ thống. Cột Mã lớp HP để trống hoặc ghi đúng mã lớp này.'] as [string, string], ...cfg.rules.slice(1)] : cfg.rules).map(([a, b]) => (
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
                {secId && one.data ? `Tệp chỉ cần cột MSV; tất cả sinh viên sẽ được xếp vào lớp ${one.data.code} – ${one.data.course}.` : cfg.note}
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
              [`Sẽ ${verb.toLowerCase()} ${cfg.noun}`, prev.valid, 'plus'],
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
                ...cfg.cols.map(([key, h]) => ({ h, r: (r: PRow) => <span className={['code', 'course', 'lecturer', 'section', 'major', 'faculty'].includes(key) || (k === 'cohorts' && key === 'name') ? 'mono' : undefined}>{cellOf(k, key, r.cells)}</span> })),
                { h: 'Kết quả kiểm tra', r: (r) => (r.ok ? <Badge tone="green">Hợp lệ</Badge> : <span style={{ color: '#B42318', fontSize: 13 }}>{r.problems.join('; ')}</span>) },
              ]}
            />
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 14 }}>{prev.errorRows ? `Các dòng lỗi sẽ được bỏ qua, chỉ ${verb.toLowerCase()} ${prev.valid} ${cfg.noun} hợp lệ.` : 'Tất cả các dòng đều hợp lệ.'}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setPrev(null)}>
                  Chọn tệp khác
                </button>
                <button className="btn btn-p" disabled={!prev.valid || busy} onClick={run}>
                  {busy ? <span className="spinner" /> : <Icon name="check" size={18} />} {verb} {prev.valid} {cfg.noun}
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
              {k === 'enrollments' ? 'Đã xếp' : 'Đã tạo'} {done.created} {cfg.noun}
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
