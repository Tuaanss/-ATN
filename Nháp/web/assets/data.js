/* Dữ liệu mẫu + kho lưu (localStorage) cho bản demo giao diện.
   Khi nối backend thật, thay Store.get/Store.save bằng lời gọi API. */
(function () {
  const KEY = 'edup_demo_db_v1';

  // ---------- tiện ích sinh dữ liệu ổn định ----------
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  // BR-DI-03: quy đổi điểm chữ / hệ 4
  function quyDoi(tk) {
    const t = [[8.5, 'A', 4], [8.0, 'B+', 3.5], [7.0, 'B', 3], [6.5, 'C+', 2.5], [5.5, 'C', 2], [5.0, 'D+', 1.5], [4.0, 'D', 1], [0, 'F', 0]];
    for (const [m, c, h] of t) if (tk >= m) return { chu: c, he4: h };
    return { chu: 'F', he4: 0 };
  }
  const r1 = (x) => Math.round(x * 10) / 10;

  function build() {
    seed = 7;
    const khoa = [
      { id: 'K1', ma: 'CNTT', ten: 'Công nghệ thông tin' },
      { id: 'K2', ma: 'TKDH', ten: 'Thiết kế đồ họa' },
      { id: 'K3', ma: 'KT', ten: 'Kinh tế' },
    ];
    const nganh = [
      { id: 'N1', ma: '7480201', ten: 'Công nghệ thông tin', khoaId: 'K1' },
      { id: 'N2', ma: '7480103', ten: 'Kỹ thuật phần mềm', khoaId: 'K1' },
      { id: 'N3', ma: '7210403', ten: 'Thiết kế đồ họa', khoaId: 'K2' },
      { id: 'N4', ma: '7340122', ten: 'Thương mại điện tử', khoaId: 'K3' },
    ];
    const khoaHoc = [
      { id: 'KH1', ten: 'K65', namBatDau: 2022 },
      { id: 'KH2', ten: 'K66', namBatDau: 2023 },
      { id: 'KH3', ten: 'K67', namBatDau: 2024 },
      { id: 'KH4', ten: 'K68', namBatDau: 2025 },
    ];
    const lopSH = [
      { id: 'L1', ma: 'K65-CNTT1', nganhId: 'N1', khoaHocId: 'KH1' },
      { id: 'L2', ma: 'K65-KTPM1', nganhId: 'N2', khoaHocId: 'KH1' },
      { id: 'L3', ma: 'K66-TKDH1', nganhId: 'N3', khoaHocId: 'KH2' },
      { id: 'L4', ma: 'K66-CNTT2', nganhId: 'N1', khoaHocId: 'KH2' },
      { id: 'L5', ma: 'K67-TMDT1', nganhId: 'N4', khoaHocId: 'KH3' },
      { id: 'L6', ma: 'K68-CNTT1', nganhId: 'N1', khoaHocId: 'KH4' },
    ];
    const loaiMon = [
      { id: 'THIET_KE', ten: 'Thiết kế', moTa: 'Nộp ảnh + link Figma' },
      { id: 'LAP_TRINH', ten: 'Lập trình', moTa: 'Nộp video demo + mã nguồn' },
      { id: 'KHAC', ten: 'Khác', moTa: 'GV tự cấu hình loại sản phẩm' },
    ];
    const hocKy = [
      { id: 'HK1', namHoc: '2024–2025', ky: 1, batDau: '2024-09-02', ketThuc: '2025-01-12' },
      { id: 'HK2', namHoc: '2024–2025', ky: 2, batDau: '2025-02-10', ketThuc: '2025-06-22' },
      { id: 'HK3', namHoc: '2025–2026', ky: 1, batDau: '2025-09-01', ketThuc: '2026-01-11' },
      { id: 'HK4', namHoc: '2025–2026', ky: 2, batDau: '2026-02-09', ketThuc: '2026-06-21' },
      { id: 'HK5', namHoc: '2026–2027', ky: 1, batDau: '2026-09-07', ketThuc: '2027-01-17' },
    ];
    const monHoc = [
      { id: 'M1', ma: 'INT2204', ten: 'Lập trình hướng đối tượng', tinChi: 3, loai: 'LAP_TRINH', khoaId: 'K1', ts: [10, 20, 20, 50] },
      { id: 'M2', ma: 'INT2211', ten: 'Cơ sở dữ liệu', tinChi: 3, loai: 'LAP_TRINH', khoaId: 'K1', ts: [10, 20, 20, 50] },
      { id: 'M3', ma: 'INT3120', ten: 'Lập trình Web', tinChi: 3, loai: 'LAP_TRINH', khoaId: 'K1', ts: [10, 30, 20, 40] },
      { id: 'M4', ma: 'INT3306', ten: 'Thiết kế giao diện người dùng', tinChi: 3, loai: 'THIET_KE', khoaId: 'K1', ts: [10, 30, 20, 40] },
      { id: 'M5', ma: 'DES2105', ten: 'Nghệ thuật chữ', tinChi: 2, loai: 'THIET_KE', khoaId: 'K2', ts: [10, 40, 0, 50] },
      { id: 'M6', ma: 'MAT1101', ten: 'Xác suất thống kê', tinChi: 3, loai: 'KHAC', khoaId: 'K1', ts: [10, 0, 30, 60] },
      { id: 'M7', ma: 'INT2208', ten: 'Công nghệ phần mềm', tinChi: 3, loai: 'LAP_TRINH', khoaId: 'K1', ts: [10, 20, 20, 50] },
      { id: 'M8', ma: 'DES3201', ten: 'Thiết kế tương tác', tinChi: 3, loai: 'THIET_KE', khoaId: 'K2', ts: [10, 30, 20, 40] },
      { id: 'M9', ma: 'PHI1006', ten: 'Triết học Mác – Lênin', tinChi: 3, loai: 'KHAC', khoaId: 'K3', ts: [10, 0, 30, 60] },
    ];

    const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
    const dem = ['Thu', 'Minh', 'Hoàng', 'Thị', 'Văn', 'Đức', 'Ngọc', 'Quang', 'Thanh', 'Bảo'];
    const ten = ['Hà', 'Khoa', 'Nam', 'Linh', 'Anh', 'Trang', 'Huy', 'Phương', 'Tuấn', 'Mai', 'Long', 'Yến', 'Dũng', 'Vy'];

    const gv = [
      ['GV0012', 'TS. Đỗ Văn Quang', 'K1', 'quang.dv'], ['GV0027', 'ThS. Phạm Thị Lan', 'K1', 'lan.pt'],
      ['GV0031', 'PGS.TS. Trần Đức Minh', 'K1', 'minh.td'], ['GV0045', 'ThS. Lê Thu Trang', 'K2', 'trang.lt'],
      ['GV0052', 'TS. Nguyễn Hoài Nam', 'K1', 'nam.nh'], ['GV0068', 'ThS. Vũ Ngọc Ánh', 'K2', 'anh.vn'],
      ['GV0074', 'TS. Hoàng Minh Châu', 'K3', 'chau.hm'], ['GV0081', 'ThS. Bùi Thanh Tùng', 'K1', 'tung.bt'],
      ['GV0093', 'ThS. Ngô Phương Thảo', 'K2', 'thao.np'],
    ].map(([ma, hoTen, khoaId, mail], i) => ({
      id: 'G' + (i + 1), ma, hoTen, khoaId, email: mail + '@eduportfolio.edu.vn',
      sdt: '09' + pad(Math.floor(rnd() * 1e8), 8), trangThai: i === 7 ? 'KHOA' : 'HOAT_DONG',
      google: i % 3 === 0 ? mail + '@gmail.com' : '', ngayTao: '2026-08-' + pad(10 + i),
    }));

    const sv = [];
    const lops = lopSH;
    for (let i = 0; i < 64; i++) {
      const lop = lops[i % lops.length];
      const kh = khoaHoc.find((k) => k.id === lop.khoaHocId);
      const name = i === 0 ? 'Nguyễn Thu Hà' : i === 1 ? 'Nguyễn Minh Đức' : `${pick(ho)} ${pick(dem)} ${pick(ten)}`;
      const mssv = i === 0 ? '22511203' : i === 1 ? '24510045' : String(kh.namBatDau % 100) + pad(510000 + Math.floor(rnd() * 9999), 6);
      const hoSo = i < 2 ? true : rnd() > 0.18;
      sv.push({
        id: 'S' + (i + 1), mssv, hoTen: name, lopId: i === 0 ? 'L3' : i === 1 ? 'L6' : lop.id,
        ngaySinh: `${pad(1 + Math.floor(rnd() * 28))}/${pad(1 + Math.floor(rnd() * 12))}/${kh.namBatDau - 18}`,
        email: hoSo ? `${mssv}@sv.eduportfolio.edu.vn` : '', sdt: hoSo ? '03' + pad(Math.floor(rnd() * 1e8), 8) : '',
        hoSo, trangThai: i === 9 || i === 23 ? 'KHOA' : 'HOAT_DONG',
      });
    }

    // Tài khoản phụ huynh (tự sinh từ SĐT do SV khai báo – BR-PH)
    const ph = [
      { id: 'P1', sdt: '0912345678', ten: 'Nguyễn Văn Hùng', links: [{ svId: 'S1', qh: 'BO' }, { svId: 'S2', qh: 'BO' }], trangThai: 'HOAT_DONG', doiMk: true, lastLogin: '2026-10-02 20:14', ngayTao: '2026-09-12' },
      { id: 'P2', sdt: '0987654321', ten: 'Trần Thị Mai', links: [{ svId: 'S1', qh: 'ME' }, { svId: 'S2', qh: 'ME' }], trangThai: 'HOAT_DONG', doiMk: false, lastLogin: '', ngayTao: '2026-09-12' },
    ];
    let pi = 3;
    for (const s of sv.slice(2)) {
      if (!s.hoSo) continue;
      const n = rnd() > 0.55 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const qh = k === 0 ? (rnd() > 0.5 ? 'BO' : 'ME') : (rnd() > 0.85 ? 'GIAM_HO' : 'ME');
        const doiMk = rnd() > 0.35;
        ph.push({
          id: 'P' + pi++, sdt: pick(['09', '08', '07', '03']) + pad(Math.floor(rnd() * 1e8), 8), ten: '',
          links: [{ svId: s.id, qh }], trangThai: rnd() > 0.95 ? 'KHOA' : (doiMk ? 'HOAT_DONG' : 'CHUA_KICH_HOAT'),
          doiMk, lastLogin: doiMk ? `2026-${pad(9 + Math.floor(rnd() * 2))}-${pad(1 + Math.floor(rnd() * 28))} ${pad(7 + Math.floor(rnd() * 14))}:${pad(Math.floor(rnd() * 60))}` : '',
          ngayTao: '2026-09-' + pad(5 + Math.floor(rnd() * 20)),
        });
      }
    }

    const dn = [
      ['Công ty CP Sao Việt Software', '0108234567', 'tuyendung@saoviet.vn', 'Nguyễn Hải Yến', 'CNTT', 'CHO', '2026-10-02'],
      ['Studio Mây Xanh', '0316789012', 'hello@mayxanh.studio', 'Phạm Quốc Bảo', 'Thiết kế', 'CHO', '2026-10-01'],
      ['Công ty TNHH Bắc Đẩu Digital', '0109876543', 'hr@bacdau.com.vn', 'Lê Minh Thư', 'Marketing', 'CHO', '2026-09-30'],
      ['FPT Software (demo)', '0101248141', 'campus@fsoft.demo', 'Đỗ Thanh Hương', 'CNTT', 'DUYET', '2026-09-12'],
      ['VNG Corporation (demo)', '0303490096', 'talent@vng.demo', 'Trần Gia Huy', 'CNTT', 'DUYET', '2026-09-14'],
      ['Agency Lửa Hồng', '0315552233', 'contact@luahong.vn', 'Vũ Thị Ngọc', 'Marketing', 'DUYET', '2026-09-18'],
      ['Công ty ABC Việc Làm Nhanh', '0000000001', 'abc.vieclam@gmail.com', 'Không rõ', 'Khác', 'TU_CHOI', '2026-09-20'],
      ['Pixel Forge Studio', '0317778899', 'jobs@pixelforge.vn', 'Hoàng Đức Anh', 'Thiết kế', 'KHOA', '2026-09-08'],
    ].map(([ten, mst, email, lh, lv, tt, ngay], i) => ({
      id: 'D' + (i + 1), ten, mst, email, nguoiLienHe: lh, sdt: '024' + pad(Math.floor(rnd() * 1e7), 7), linhVuc: lv,
      diaChi: pick(['Cầu Giấy, Hà Nội', 'Quận 7, TP.HCM', 'Hải Châu, Đà Nẵng', 'Đống Đa, Hà Nội']),
      website: tt === 'TU_CHOI' ? '' : 'https://' + email.split('@')[1], quyMo: pick(['10–50', '50–200', '200–1000', '1000+']),
      ngayDK: ngay, trangThai: tt,
      lyDo: tt === 'TU_CHOI' ? 'Mã số thuế không hợp lệ, email không thuộc tên miền doanh nghiệp.' : tt === 'KHOA' ? 'Gửi yêu cầu xem bài hàng loạt bất thường (42 yêu cầu/1 giờ).' : '',
      giayPhep: tt === 'TU_CHOI' ? '' : 'GPKD_' + mst + '.pdf',
    }));

    const actions = [
      ['DANG_NHAP', 'Đăng nhập', 'Hệ thống'], ['SUA_DIEM', 'Sửa điểm', 'DiemHocPhan'], ['NOP_BAI', 'Nộp bài', 'BaiNop'],
      ['XOA_BAI', 'Xóa tệp bài nộp', 'TepDinhKem'], ['DUYET_DN', 'Duyệt tài khoản DN', 'DoanhNghiep'], ['KHOA_TK', 'Khóa tài khoản', 'NguoiDung'],
      ['IMPORT_SV', 'Import sinh viên', 'SinhVien'], ['DOI_SDT_PH', 'Đổi SĐT phụ huynh', 'LienKet_PH_SV'], ['DAT_LAI_MK', 'Đặt lại mật khẩu', 'NguoiDung'],
      ['SUA_CAU_HINH', 'Sửa cấu hình', 'CauHinh'], ['DANG_NHAP_LOI', 'Đăng nhập thất bại', 'Hệ thống'],
    ];
    const actors = [['admin', 'ADMIN'], ['GV0012', 'GV'], ['GV0027', 'GV'], ['22511203', 'SV'], ['22511198', 'SV'], ['0912345678', 'PH'], ['tuyendung@saoviet.vn', 'DN']];
    const log = [];
    let t = new Date('2026-10-03T10:40:00').getTime();
    for (let i = 0; i < 90; i++) {
      const a = pick(actions);
      let who = pick(actors);
      if (['DUYET_DN', 'KHOA_TK', 'IMPORT_SV', 'DAT_LAI_MK', 'SUA_CAU_HINH'].includes(a[0])) who = ['admin', 'ADMIN'];
      if (a[0] === 'SUA_DIEM') who = pick([['GV0012', 'GV'], ['GV0027', 'GV']]);
      if (['NOP_BAI', 'XOA_BAI'].includes(a[0])) who = pick([['22511203', 'SV'], ['22511198', 'SV']]);
      if (a[0] === 'DOI_SDT_PH') who = ['22511203', 'SV'];
      const d = new Date(t);
      const detail = {
        SUA_DIEM: [{ diem_ck: 7.5 }, { diem_ck: 8.0 }, 'INT3306_02 · SV 22511203'],
        NOP_BAI: [null, { so_anh: 12, figma: 'figma.com/file/…' }, 'BT2 · Nhóm 04'],
        XOA_BAI: [{ tep: ['anh_03.png', 'anh_07.png'] }, null, 'BT2 · Nhóm 04'],
        DUYET_DN: [{ trang_thai: 'CHO' }, { trang_thai: 'DUYET' }, 'FPT Software (demo)'],
        KHOA_TK: [{ trang_thai: 'HOAT_DONG' }, { trang_thai: 'KHOA' }, 'GV0081'],
        IMPORT_SV: [null, { so_dong: 48, thanh_cong: 46, loi: 2 }, 'DS_K68_CNTT.xlsx'],
        DOI_SDT_PH: [{ sdt_me: '0987000111' }, { sdt_me: '0987654321' }, 'SV 22511203'],
        DAT_LAI_MK: [null, { bat_buoc_doi: true }, 'PH 0987654321'],
        SUA_CAU_HINH: [{ anh_toi_da_mb: 8 }, { anh_toi_da_mb: 10 }, 'Giới hạn tệp'],
        DANG_NHAP: [null, null, '—'], DANG_NHAP_LOI: [null, { lan_sai: 3 }, '—'],
      }[a[0]];
      log.push({
        id: 'LG' + (1000 + 90 - i), time: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        user: who[0], role: who[1], action: a[0], actionName: a[1], obj: a[2], target: detail[2], old: detail[0], new: detail[1],
        ip: `113.190.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`,
      });
      t -= Math.floor(rnd() * 3 * 3600 * 1000) + 60000;
    }

    const config = {
      anhMaxMB: 10, anhMax: 30, anhMin: 1, anhDinhDang: ['JPG', 'JPEG', 'PNG', 'WEBP'],
      videoMaxMB: 500, videoDinhDang: ['MP4', 'WEBM', 'MOV'], srcMaxMB: 100, srcDinhDang: ['ZIP', 'RAR', '7Z'],
      linkCho: ['figma.com', 'github.com', 'gitlab.com'],
      thangDiem: [[8.5, 'A', 4], [8.0, 'B+', 3.5], [7.0, 'B', 3], [6.5, 'C+', 2.5], [5.5, 'C', 2], [5.0, 'D+', 1.5], [4.0, 'D', 1], [0, 'F', 0]],
      lamTron: 1, hocLai: 'CAO_NHAT',
      saiMk: 5, khoaPhut: 15, doiMkLanDau: true, phDangNhap: 'MK_TAM', otpPhut: 5,
      canhBaoDiem: 5.0, canhBaoGpaGiam: 0.3, emailNguoiGui: 'no-reply@eduportfolio.edu.vn',
      dnHanMin: 14, dnHanMax: 28,
    };

    // ---------- dữ liệu cổng phụ huynh ----------
    const mk = (mId, cc, bt, gk, ck) => {
      const m = monHoc.find((x) => x.id === mId);
      const [a, b, c, d] = m.ts;
      const tk = r1((cc * a + bt * b + gk * c + ck * d) / 100);
      return { monId: mId, ma: m.ma, ten: m.ten, tc: m.tinChi, cc, bt: b ? bt : null, gk: c ? gk : null, ck, tk, ...quyDoi(tk) };
    };
    const diem = {
      S1: [
        { hk: 'HK1', mon: [mk('M9', 10, 0, 7.5, 7.0), mk('M6', 9, 0, 6.5, 7.0), mk('M5', 10, 9.5, 0, 9.0)] },
        { hk: 'HK2', mon: [mk('M1', 10, 8.5, 7.5, 8.0), mk('M2', 9, 9.0, 8.5, 8.8), mk('M8', 10, 8.0, 7.0, 7.5)] },
        { hk: 'HK3', mon: [mk('M7', 10, 8.0, 8.0, 7.6), mk('M3', 10, 9.0, 8.5, 9.0), mk('M6', 10, 0, 8.0, 8.5)] },
        { hk: 'HK4', mon: [mk('M4', 10, 9.5, 9.0, 9.2), mk('M8', 10, 9.0, 8.5, 8.9)] },
        { hk: 'HK5', dangHoc: true, mon: [{ ...mk('M4', 10, 8.5, 0, 0), gk: null, ck: null, tk: null, chu: null, he4: null }, { ...mk('M3', 9, 8.0, 0, 0), gk: null, ck: null, tk: null, chu: null, he4: null }] },
      ],
      S2: [
        { hk: 'HK5', dangHoc: true, mon: [{ ...mk('M1', 8, 5.5, 4.0, 0), ck: null, tk: null, chu: null, he4: null }, { ...mk('M6', 7, 0, 3.5, 0), ck: null, tk: null, chu: null, he4: null }, { ...mk('M9', 10, 0, 6.0, 0), ck: null, tk: null, chu: null, he4: null }] },
      ],
    };

    const baiNop = [
      { id: 'B1', svId: 'S1', hk: 'HK5', lhp: 'INT3306_02', mon: 'Thiết kế giao diện người dùng', baiTap: 'BT2 – Thiết kế ứng dụng di động', loaiSP: 'THIET_KE', hinhThuc: 'NHOM', nhom: 'Nhóm 04 – Pixel Team', deTai: 'Ứng dụng đặt lịch cắt tóc BarberGo', tuKhoa: ['UI Mobile App', 'Đặt lịch', 'Dịch vụ làm đẹp'], nguoiNop: 'Trần Minh Khoa', thoiGian: '2026-09-29 14:32', han: '2026-10-12 23:59', trangThai: 'DA_NOP', diem: null, nhanXet: '', anh: 12, figma: 'https://www.figma.com/file/barbergo-demo' },
      { id: 'B2', svId: 'S1', hk: 'HK5', lhp: 'INT3306_02', mon: 'Thiết kế giao diện người dùng', baiTap: 'BT2 – Phần việc cá nhân', loaiSP: 'THIET_KE', hinhThuc: 'CA_NHAN', nhom: '', deTai: 'Ứng dụng đặt lịch cắt tóc BarberGo', tuKhoa: ['UI Mobile App'], nguoiNop: 'Nguyễn Thu Hà', thoiGian: '2026-09-30 21:05', han: '2026-10-12 23:59', trangThai: 'DA_NOP', diem: null, nhanXet: '', anh: 5, figma: 'https://www.figma.com/file/barbergo-ha' },
      { id: 'B3', svId: 'S1', hk: 'HK5', lhp: 'INT3306_02', mon: 'Thiết kế giao diện người dùng', baiTap: 'BT1 – Wireframe ví điện tử', loaiSP: 'THIET_KE', hinhThuc: 'CA_NHAN', nhom: '', deTai: 'Wireframe ví điện tử MoMo Lite', tuKhoa: ['Fintech', 'Wireframe'], nguoiNop: 'Nguyễn Thu Hà', thoiGian: '2026-09-18 22:41', han: '2026-09-20 23:59', trangThai: 'DA_CHAM', diem: 8.5, nhanXet: 'Luồng thanh toán rõ ràng, cần chú ý khoảng cách lưới ở màn hình lịch sử giao dịch.', anh: 8, figma: 'https://www.figma.com/file/momo-lite' },
      { id: 'B4', svId: 'S1', hk: 'HK5', lhp: 'INT3120_01', mon: 'Lập trình Web', baiTap: 'Lab 3 – Trang sản phẩm React', loaiSP: 'LAP_TRINH', hinhThuc: 'CA_NHAN', nhom: '', deTai: 'Website bán giày thể thao', tuKhoa: ['Thương mại điện tử', 'React'], nguoiNop: 'Nguyễn Thu Hà', thoiGian: '2026-09-26 23:58', han: '2026-09-26 23:59', trangThai: 'DA_CHAM', diem: 9.0, nhanXet: 'Code sạch, có tách component hợp lý.', video: 'demo_lab3.mp4', git: 'https://github.com/thuha/shoe-store' },
      { id: 'B5', svId: 'S1', hk: 'HK5', lhp: 'INT3120_01', mon: 'Lập trình Web', baiTap: 'Đồ án giữa kỳ – Web bán hàng', loaiSP: 'LAP_TRINH', hinhThuc: 'NHOM', nhom: '', deTai: '', tuKhoa: [], nguoiNop: '', thoiGian: '', han: '2026-10-20 23:59', trangThai: 'CHUA_NOP', diem: null, nhanXet: '' },
      { id: 'B6', svId: 'S1', hk: 'HK4', lhp: 'DES3201_01', mon: 'Thiết kế tương tác', baiTap: 'Đồ án cuối kỳ – Prototype tương tác', loaiSP: 'THIET_KE', hinhThuc: 'NHOM', nhom: 'Nhóm 02 – Mint', deTai: 'App học ngoại ngữ cho trẻ em', tuKhoa: ['Giáo dục', 'UI Mobile App'], nguoiNop: 'Nguyễn Thu Hà', thoiGian: '2026-05-30 18:20', han: '2026-06-01 23:59', trangThai: 'DA_CHAM', diem: 9.0, nhanXet: 'Prototype mượt, nghiên cứu người dùng tốt.', anh: 18, figma: 'https://www.figma.com/file/kids-english' },
      { id: 'B7', svId: 'S2', hk: 'HK5', lhp: 'INT2204_05', mon: 'Lập trình hướng đối tượng', baiTap: 'BT1 – Quản lý thư viện', loaiSP: 'LAP_TRINH', hinhThuc: 'CA_NHAN', nhom: '', deTai: 'Quản lý thư viện mini', tuKhoa: ['Java', 'Quản lý'], nguoiNop: 'Nguyễn Minh Đức', thoiGian: '2026-09-25 01:12', han: '2026-09-24 23:59', trangThai: 'NOP_MUON', diem: 5.5, nhanXet: 'Nộp muộn, trừ 10%. Thiếu chức năng trả sách.', video: 'thu_vien.mp4', git: 'https://github.com/minhduc/library' },
      { id: 'B8', svId: 'S2', hk: 'HK5', lhp: 'INT2204_05', mon: 'Lập trình hướng đối tượng', baiTap: 'BT2 – Game rắn săn mồi', loaiSP: 'LAP_TRINH', hinhThuc: 'CA_NHAN', nhom: '', deTai: '', tuKhoa: [], nguoiNop: '', thoiGian: '', han: '2026-10-01 23:59', trangThai: 'QUA_HAN', diem: null, nhanXet: '' },
    ];

    const thongBao = [
      { id: 'T1', svId: 'S2', loai: 'CANH_BAO', muc: 'cao', title: 'Quá hạn nộp bài: BT2 – Game rắn săn mồi', body: 'Minh Đức chưa nộp bài BT2 môn Lập trình hướng đối tượng (hạn 01/10/2026 23:59).', time: '2026-10-02 00:05', read: false, link: 'bai-nop.html' },
      { id: 'T2', svId: 'S2', loai: 'CANH_BAO', muc: 'cao', title: 'Điểm giữa kỳ dưới ngưỡng 5.0', body: 'Môn Xác suất thống kê: điểm giữa kỳ 3.5. Môn Lập trình hướng đối tượng: 4.0.', time: '2026-09-30 16:20', read: false, link: 'ket-qua.html' },
      { id: 'T3', svId: 'S2', loai: 'DIEM', muc: 'tb', title: 'Có điểm mới: BT1 – Quản lý thư viện · 5.5', body: 'Bài nộp muộn, bị trừ 10% theo quy định của giảng viên.', time: '2026-09-28 09:40', read: true, link: 'bai-nop.html' },
      { id: 'T4', svId: 'S1', loai: 'DIEM', muc: 'tb', title: 'Có điểm mới: BT1 – Wireframe ví điện tử · 8.5', body: 'Môn Thiết kế giao diện người dùng (INT3306_02).', time: '2026-09-24 15:02', read: false, link: 'bai-nop.html' },
      { id: 'T5', svId: 'S1', loai: 'BAI_TAP', muc: 'tb', title: 'Đã nộp: BT2 – Thiết kế ứng dụng di động', body: 'Trần Minh Khoa (trưởng nhóm) đã nộp bài chung của nhóm, 12 ảnh + link Figma.', time: '2026-09-29 14:32', read: false, link: 'bai-nop.html' },
      { id: 'T6', svId: 'S1', loai: 'HAN_NOP', muc: 'vua', title: 'Sắp đến hạn: Đồ án giữa kỳ – Web bán hàng', body: 'Còn 17 ngày, nhóm chưa đăng ký đề tài.', time: '2026-10-03 08:00', read: false, link: 'bai-nop.html' },
      { id: 'T7', svId: 'S1', loai: 'DIEM', muc: 'tb', title: 'Điểm học kỳ 2 (2025–2026) đã công bố', body: 'GPA học kỳ: 3.83 · CPA: 3.47.', time: '2026-06-28 10:00', read: true, link: 'ket-qua.html' },
      { id: 'T8', svId: 'S2', loai: 'HE_THONG', muc: 'tb', title: 'Chào mừng đến cổng phụ huynh', body: 'Tài khoản được tạo tự động từ SĐT Minh Đức khai báo. Hãy đổi mật khẩu để bảo mật.', time: '2026-09-12 07:30', read: true, link: '' },
    ];

    // Lớp học phần: một môn trong một học kỳ có thể mở nhiều lớp, mỗi lớp một lịch (FR-04.3)
    const L = (ma, monId, hkId, gvId, siSoMax, lich, extra = []) => ({ ma, monId, hkId, gvId, siSoMax, tuanBd: 1, tuanKt: 15, lich, extra });
    const lhpRaw = [
      L('INT3306_01', 'M4', 'HK5', 'G1', 60, [[3, 1, 3, 'P.301-G2']]),
      L('INT3306_02', 'M4', 'HK5', 'G1', 60, [[5, 7, 9, 'P.301-G2']], ['S1']),
      L('INT3306_03', 'M4', 'HK5', 'G6', 50, [[6, 1, 3, 'P.205-A1']]),
      L('INT3120_01', 'M3', 'HK5', 'G2', 45, [[2, 1, 3, 'P.402-G2'], [4, 1, 2, 'Lab 3-G2']], ['S1']),
      L('INT3120_02', 'M3', 'HK5', 'G5', 45, [[4, 7, 9, 'P.402-G2'], [6, 7, 8, 'Lab 3-G2']]),
      L('INT2204_05', 'M1', 'HK5', 'G5', 60, [[2, 7, 9, 'P.105-E3']], ['S2']),
      L('INT2204_06', 'M1', 'HK5', 'G2', 60, [[3, 7, 9, 'P.105-E3']]),
      L('MAT1101_02', 'M6', 'HK5', 'G3', 120, [[3, 7, 9, 'Giảng đường 2']], ['S2']),
      L('PHI1006_01', 'M9', 'HK5', 'G7', 150, [[7, 1, 3, 'Giảng đường 1']], ['S2']),
      L('DES3201_01', 'M8', 'HK4', 'G9', 40, [[4, 1, 3, 'P.205-A1']], ['S1']),
      L('INT2208_01', 'M7', 'HK3', 'G3', 60, [[5, 1, 3, 'P.301-G2']], ['S1']),
    ];
    const pool = sv.filter((s) => s.trangThai === 'HOAT_DONG').map((s) => s.id);
    const lopHocPhan = lhpRaw.map((x, i) => {
      const n = Math.min(x.siSoMax - 2, 12 + Math.floor(rnd() * 30));
      const ids = new Set(x.extra);
      // không xếp một SV vào 2 lớp của cùng môn trong cùng học kỳ
      const taken = new Set(lhpRaw.slice(0, i).filter((o) => o.monId === x.monId && o.hkId === x.hkId).flatMap((o) => o.svIds || []));
      for (let k = 0; ids.size < n && k < 400; k++) { const s = pick(pool); if (!taken.has(s) && !(s === 'S1' || s === 'S2')) ids.add(s); }
      x.svIds = [...ids];
      return { id: 'LHP' + (i + 1), ma: x.ma, monId: x.monId, hkId: x.hkId, gvId: x.gvId, siSoMax: x.siSoMax, tuanBd: x.tuanBd, tuanKt: x.tuanKt,
        lich: x.lich.map(([thu, tietBd, tietKt, phong]) => ({ thu, tietBd, tietKt, phong })), svIds: x.svIds, ngayTao: '2026-08-20' };
    });

    return { khoa, nganh, khoaHoc, lopSH, loaiMon, hocKy, monHoc, gv, sv, ph, dn, log, config, diem, baiNop, thongBao, lopHocPhan, session: {} };
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !db.sv) db = build();
  else if (!db.lopHocPhan) { db.lopHocPhan = build().lopHocPhan; } // dữ liệu demo cũ chưa có lớp học phần

  window.Store = {
    db,
    save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* chế độ riêng tư: chỉ giữ trong bộ nhớ */ } },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} window.Store.db = db = build(); },
    nextId(prefix, list) { return prefix + (list.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1); },
    log(action, actionName, obj, target, oldV, newV) {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      db.log.unshift({ id: 'LG' + (1100 + db.log.length), time: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`, user: 'admin', role: 'ADMIN', action, actionName, obj, target, old: oldV || null, new: newV || null, ip: '127.0.0.1' });
    },
  };
  window.quyDoi = quyDoi;
})();
