// Generator for the EduPortfolio design canvas (project/*.dc.html + canvas.json)
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'project');
fs.mkdirSync(OUT, { recursive: true });

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
  book: '<path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h11"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  folder: '<path d="M3 6h6l2 2h10v12H3z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  building: '<path d="M4 21V4h10v17"/><path d="M14 9h6v12"/><path d="M8 8h2M8 12h2M8 16h2M2 21h20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="m10 8-4 4 4 4"/><path d="M6 12h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  max: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
  merge: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 7c0 5 6 5 10 5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const ic = (n, s = 18, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

const HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:#1A1C21;background:#F5F5F5;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
a{color:#DB0000;text-decoration:none}a:hover{color:#A30000}
h1,h2,h3,p{margin:0}
.card{background:#fff;border:1px solid #E3E1D9;border-radius:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:8px;font:600 14px 'Be Vietnam Pro',sans-serif;border:1px solid #D6D3C8;background:#fff;color:#1A1C21;cursor:pointer;white-space:nowrap}
.btn:hover{background:#F7F6F2;color:#1A1C21}
.btn-p{background:#DB0000;border-color:#DB0000;color:#fff}.btn-p:hover{background:#A30000;color:#fff}
.btn-d{background:#fff;border-color:#E9B8B3;color:#9B1C12}.btn-d:hover{background:#FCE8E6;color:#9B1C12}
.btn-g{border-color:transparent;background:transparent}
.btn-sm{height:32px;padding:0 12px;font-size:13px}
.badge{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.b-blue{background:#E6EFFD;color:#1847A8}.b-green{background:#E3F2E8;color:#14532D}.b-amber{background:#FDF0DE;color:#8A3B06}.b-red{background:#FCE8E6;color:#9B1C12}.b-gray{background:#EEEDE7;color:#474B53}.b-dark{background:#1A1C21;color:#fff}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;background:#F1F0EA;border:1px solid #E3E1D9;font-size:13px;color:#30343B;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.muted{color:#62666F}
.lbl{font-size:13px;font-weight:600;color:#30343B;display:block;margin-bottom:6px}
.help{font-size:12px;color:#62666F;margin-top:6px}
.err{font-size:12px;color:#B42318;margin-top:6px;font-weight:500}
.inp{width:100%;height:42px;border:1px solid #D6D3C8;border-radius:8px;padding:0 12px;font:400 14px 'Be Vietnam Pro',sans-serif;background:#fff;color:#1A1C21}
.inp:focus{outline:2px solid #DB0000;outline-offset:-1px}
.inp-err{border-color:#D9534A;background:#FFFBFA}
textarea.inp{height:auto;padding:10px 12px;line-height:1.5;resize:vertical}
input[type=checkbox],input[type=radio]{accent-color:#DB0000;width:18px;height:18px;margin:0}
table{border-collapse:collapse;width:100%}
th{text-align:left;font-size:12px;font-weight:600;color:#62666F;text-transform:uppercase;letter-spacing:.04em;padding:10px 16px;border-bottom:1px solid #E3E1D9;background:#FAFAF7;white-space:nowrap}
td{padding:12px 16px;border-bottom:1px solid #EFEDE6;font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:0}
.nav a{display:flex;align-items:center;gap:12px;height:40px;padding:0 12px;border-radius:8px;color:#30343B;font-size:14px;font-weight:500}
.nav a:hover{background:#F2F2F2;color:#1A1C21}.nav a.on{background:#FDECEC;color:#DB0000;font-weight:600}
.h1{font-size:26px;font-weight:700;letter-spacing:-.01em}
.sec{font-size:16px;font-weight:700}
.ph{background-image:repeating-linear-gradient(135deg,rgba(0,0,0,.035) 0 10px,transparent 10px 20px)}
.tabs{display:flex;gap:4px;border-bottom:1px solid #E3E1D9}
.tab{height:44px;padding:0 16px;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#62666F;border-bottom:2px solid transparent;margin-bottom:-1px}
.tab.on{color:#1A1C21;border-bottom-color:#DB0000}
.seg{display:inline-flex;padding:3px;background:#ECEBE4;border-radius:9px;gap:2px}
.seg span{height:32px;padding:0 14px;display:inline-flex;align-items:center;border-radius:7px;font-size:13px;font-weight:600;color:#4A4E57}
.seg span.on{background:#fff;color:#1A1C21;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.sw{width:40px;height:24px;border-radius:12px;background:#DB0000;position:relative;flex-shrink:0}
.sw::after{content:'';position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:50%;background:#fff}
.sw.off{background:#C9C6BB}.sw.off::after{left:3px}
.av{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#A30000;background:#FBE3E3;flex-shrink:0}
</style>`;

const DEFAULT_LOGIC = `class Component extends DCLogic {
  renderVals() {
    return {};
  }
}`;

function page({ title, w, h, inner, logic }) {
  const props = JSON.stringify({ $preview: { width: w, height: h } });
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${HEAD}
</helmet>
${inner}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${props}'>
${logic || DEFAULT_LOGIC}
</script>
</body>
</html>
`;
}

// ---------- shared pieces ----------
const badge = (t, c = 'gray', dot) => `<span class="badge b-${c}">${dot ? `<span class="dot" style="background:currentColor"></span>` : ''}${t}</span>`;
// tinted stat tiles, tones cycle within a row (grid() resets the cycle)
const TONES = [['#FDEDED', '#C40000'], ['#EAF6EC', '#15803D'], ['#FEF5E3', '#B45309'], ['#EAF2FE', '#1D4ED8'], ['#FDEEF1', '#BE123C'], ['#F0F0F0', '#1A1C21']];
let toneIx = 0;
const tile = (label, value, sub, icon) => { const [bg, fg] = TONES[toneIx++ % TONES.length]; return `<div style="padding:18px 20px;border-radius:12px;background:${bg};display:flex;flex-direction:column;gap:8px">
<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px;font-weight:600;color:#30343B">${label}</span><span style="color:${fg}">${ic(icon || 'chart', 18)}</span></div>
<div style="font-size:30px;font-weight:700;letter-spacing:-.02em;color:${fg}">${value}</div>
${sub ? `<div style="font-size:13px;color:#4A4E57">${sub}</div>` : ''}
</div>`; };
const card = (title, inner, extra = '', pad = true) => `<section class="card" style="display:flex;flex-direction:column">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #EFEDE6"><h2 class="sec">${title}</h2>${extra}</div>
<div style="${pad ? 'padding:20px;' : ''}display:flex;flex-direction:column;gap:14px">${inner}</div>
</section>`;
const grid = (cols, inner, gap = 20) => { toneIx = 0; return `<div style="display:grid;grid-template-columns:${cols};gap:${gap}px">${inner}</div>`; };
const field = (label, input, help) => `<div><label class="lbl">${label}</label>${input}${help || ''}</div>`;
const inp = (v, ph = '', extra = '') => `<input class="inp ${extra}" type="text" ${v ? `defaultValue="${v}"` : ''} placeholder="${ph}">`;
const av = (t, bg = '#FBE3E3', fg = '#A30000', s = 36) => `<span class="av" style="width:${s}px;height:${s}px;background:${bg};color:${fg};font-size:${Math.round(s / 2.8)}px">${t}</span>`;
const tone = ['#DCE4F2', '#F2E3D5', '#DDEBDF', '#EADDF0', '#F4E9C9', '#D7E9EC', '#F0DADA', '#E1E4D0', '#DCE4F2', '#F2E3D5', '#DDEBDF', '#EADDF0'];
const thumb = (label, bg, h = 120, extra = '') => `<div class="ph" style="height:${h}px;border-radius:8px;background-color:${bg};display:flex;align-items:flex-end;padding:8px;position:relative;${extra}"><span class="mono" style="font-size:11px;color:#3A3E46;background:rgba(255,255,255,.8);padding:2px 6px;border-radius:4px">${label}</span></div>`;

// vertical bar chart, single series; value shown on highlighted bar only
function vbars(data, { max, h = 180, fmt = v => v, hi = data.length - 1, color = '#DB0000', soft = '#F2AAAA', unit = '' }) {
  const bars = data.map(([l, v], i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0">
<div style="height:${h}px;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px">
${i === hi ? `<span style="font-size:13px;font-weight:700">${fmt(v)}${unit}</span>` : ''}
<div title="${l}: ${fmt(v)}${unit}" style="width:60%;max-width:44px;height:${Math.round(v / max * (h - 26))}px;background:${i === hi ? color : soft};border-radius:4px 4px 0 0"></div></div>
<span style="font-size:12px;color:#62666F;white-space:nowrap">${l}</span></div>`).join('');
  return `<div style="display:flex;gap:10px;border-bottom:1px solid #D6D3C8;padding-bottom:0;position:relative">${bars}</div>`;
}
// horizontal ranked bars
function hbars(data, { max, color = '#DB0000', labelW = 170, fmt = v => v }) {
  return `<div style="display:flex;flex-direction:column;gap:10px">${data.map(([l, v]) => `<div style="display:flex;align-items:center;gap:12px">
<span style="width:${labelW}px;flex-shrink:0;font-size:13px;color:#30343B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</span>
<div style="flex:1;height:10px;background:#F1F0EA;border-radius:5px;overflow:hidden"><div title="${l}: ${fmt(v)}" style="width:${(v / max * 100).toFixed(1)}%;height:100%;background:${color};border-radius:0 5px 5px 0"></div></div>
<span style="width:48px;text-align:right;font-size:13px;font-weight:600">${fmt(v)}</span></div>`).join('')}</div>`;
}

const NAV = {
  SV: { label: 'Sinh viên', user: ['NH', 'Nguyễn Thu Hà', 'MSSV 22511203'], items: [
    ['Tổng quan', 'SV_Dashboard', 'home'], ['Bài tập & nhóm', 'SV_Assignment', 'file'], ['Nộp bài', 'SV_Submit', 'upload'],
    ['Kết quả học tập', 'SV_Grades', 'chart'], ['Doanh nghiệp & riêng tư', 'SV_Privacy', 'shield'], ['Hồ sơ cá nhân', 'SV_ProfileSetup', 'user']] },
  GV: { label: 'Giảng viên', user: ['ĐQ', 'TS. Đỗ Văn Quang', 'GV0417 · Khoa CNTT'], items: [
    ['Tổng quan', 'GV_Dashboard', 'home'], ['Tạo bài tập', 'GV_CreateAssignment', 'plus'], ['Bài tập & nhóm', 'GV_AssignmentDetail', 'users'],
    ['Chấm bài', 'GV_Grading', 'check'], ['Bảng điểm', 'GV_Gradebook', 'book'], ['Tìm bài theo chủ đề', 'GV_Search', 'search']] },
  PH: { label: 'Phụ huynh', user: ['PH', '0912 345 678', 'Phụ huynh · 2 con'], items: [
    ['Chọn con', 'PH_SelectChild', 'users'], ['Tổng quan', 'PH_Dashboard', 'home'], ['Bài nộp của con', 'PH_Submissions', 'file']] },
  DN: { label: 'Doanh nghiệp', user: ['SV', 'Công ty CP Sao Việt', 'Đã duyệt · CNTT'], items: [
    ['Tìm kiếm sinh viên', 'DN_Search', 'search'], ['Hồ sơ sinh viên', 'DN_Profile', 'user'], ['Yêu cầu & thống kê', 'DN_Dashboard', 'chart']] },
  AD: { label: 'Quản trị viên', user: ['AD', 'admin', 'Quản trị hệ thống'], items: [
    ['Tổng quan', 'Admin_Dashboard', 'home'], ['Người dùng', 'Admin_Users', 'users'], ['Đào tạo & danh mục', 'Admin_Academic', 'book'],
    ['Yêu cầu xem bài', 'Admin_AccessRequests', 'key'], ['Thống kê doanh nghiệp', 'Admin_DNStats', 'building'], ['Từ khóa đề tài', 'Admin_Tags', 'tag'],
    ['Nhật ký hệ thống', 'Admin_AuditLog', 'log'], ['Cấu hình', 'Admin_Config', 'settings']] },
};

const logo = (dark = true) => `<a href="Main.dc.html" style="display:flex;align-items:center;gap:10px;color:${dark ? '#fff' : '#1A1C21'}">
<span style="width:32px;height:32px;border-radius:8px;background:${dark ? '#fff' : '#DB0000'};display:inline-flex;align-items:center;justify-content:center;color:${dark ? '#DB0000' : '#fff'}">${ic('book', 18, 2)}</span>
<span style="font-size:17px;font-weight:700;letter-spacing:-.01em">EduPortfolio</span></a>`;

function shell(o) {
  const R = NAV[o.role];
  const nav = R.items.map(([l, f, i]) => `<a href="${f}.dc.html" class="${f === o.active ? 'on' : ''}">${ic(i, 18)}<span>${l}</span></a>`).join('\n');
  return `<div style="width:${o.w}px;height:${o.h}px;display:flex;background:#F5F5F5;overflow:hidden">
<aside style="width:248px;flex-shrink:0;background:#fff;border-right:1px solid #E5E5E5;color:#1A1C21;display:flex;flex-direction:column;padding:20px 14px;gap:22px">
<div style="padding:0 6px">${logo(false)}</div>
<div style="padding:0 12px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#8A8E97">${R.label}</div>
<nav class="nav" aria-label="Điều hướng chính" style="display:flex;flex-direction:column;gap:2px;margin-top:-12px">${nav}</nav>
<div style="margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:#F5F5F5">
${av(R.user[0], '#DB0000', '#fff')}
<div style="display:flex;flex-direction:column;min-width:0;flex:1"><span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${R.user[1]}</span><span style="font-size:12px;color:#62666F">${R.user[2]}</span></div>
<a href="Auth_Login.dc.html" aria-label="Đăng xuất" style="color:#62666F">${ic('logout', 18)}</a></div>
</aside>
<main style="flex:1;display:flex;flex-direction:column;min-width:0">
<header style="height:64px;flex-shrink:0;display:flex;align-items:center;gap:16px;padding:0 32px;background:#fff;border-bottom:1px solid #E3E1D9">
<div style="font-size:13px;color:#62666F;flex:1">${o.crumbs}</div>
<label style="display:flex;align-items:center;gap:8px;width:300px;height:38px;border:1px solid #E3E1D9;border-radius:8px;padding:0 12px;color:#62666F;background:#FAFAF7">${ic('search', 16)}<input aria-label="Tìm kiếm" placeholder="${o.search || 'Tìm kiếm…'}" style="border:0;outline:0;background:transparent;font:400 14px 'Be Vietnam Pro',sans-serif;flex:1;min-width:0"></label>
<button class="btn btn-g" aria-label="Thông báo, ${o.bell ?? 3} chưa đọc" style="position:relative;width:40px;padding:0">${ic('bell', 20)}${(o.bell ?? 3) ? `<span style="position:absolute;top:4px;right:4px;min-width:18px;height:18px;border-radius:9px;background:#C2410C;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px">${o.bell ?? 3}</span>` : ''}</button>
${av(R.user[0])}
</header>
<div style="padding:28px 32px;display:flex;flex-direction:column;gap:24px;flex:1;min-height:0">
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
<div style="display:flex;flex-direction:column;gap:6px"><h1 class="h1">${o.title}</h1>${o.sub ? `<p style="font-size:14px;color:#62666F">${o.sub}</p>` : ''}</div>
<div style="display:flex;gap:10px;align-items:center">${o.actions || ''}</div></div>
${o.body}
</div></main></div>`;
}

const boards = []; // {page, file, title, w, h, inner, logic}
const add = (pageId, file, title, w, h, inner, logic) => boards.push({ pageId, file, title, w, h, inner, logic });
const S = (role, file, title, w, h, o) => add(o.page, file, title, w, h, shell({ ...o, role, active: o.active || file, w, h }));

// ======================================================================
// CHUNG
// ======================================================================
{
  const roles = [
    ['Sinh viên', '#DB0000', [['Khai báo hồ sơ', 'SV_ProfileSetup'], ['Tổng quan', 'SV_Dashboard'], ['Bài tập, nhóm & đề tài', 'SV_Assignment'], ['Nộp bài đa phương tiện', 'SV_Submit'], ['Xác nhận nộp lại', 'SV_ConfirmResubmit'], ['Kết quả học tập', 'SV_Grades'], ['Doanh nghiệp & riêng tư', 'SV_Privacy']]],
    ['Giảng viên', '#0F766E', [['Tổng quan', 'GV_Dashboard'], ['Tạo bài tập + Drive', 'GV_CreateAssignment'], ['Bài tập, nhóm & đề tài', 'GV_AssignmentDetail'], ['Chấm bài', 'GV_Grading'], ['Bảng điểm & GPA', 'GV_Gradebook'], ['Tìm bài theo chủ đề', 'GV_Search']]],
    ['Phụ huynh', '#B45309', [['Chọn con', 'PH_SelectChild'], ['Tổng quan', 'PH_Dashboard'], ['Bài nộp của con', 'PH_Submissions']]],
    ['Doanh nghiệp', '#7C3AED', [['Đăng ký tài khoản', 'Auth_DNRegister'], ['Tìm kiếm sinh viên', 'DN_Search'], ['Hồ sơ & yêu cầu xem bài', 'DN_Profile'], ['Yêu cầu & thống kê', 'DN_Dashboard']]],
    ['Quản trị viên', '#1A1C21', [['Tổng quan', 'Admin_Dashboard'], ['Người dùng & import', 'Admin_Users'], ['Đào tạo & danh mục', 'Admin_Academic'], ['Duyệt yêu cầu xem bài', 'Admin_AccessRequests'], ['Thống kê doanh nghiệp', 'Admin_DNStats'], ['Chuẩn hóa từ khóa', 'Admin_Tags'], ['Nhật ký hệ thống', 'Admin_AuditLog'], ['Cấu hình', 'Admin_Config']]],
  ];
  const roleCards = roles.map(([r, c, items]) => `<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:3px;background:${c}"></span><h2 class="sec">${r}</h2><span class="muted" style="font-size:12px;margin-left:auto">${items.length} màn hình</span></div>
<div style="display:flex;flex-direction:column">${items.map(([l, f]) => `<a href="${f}.dc.html" style="display:flex;align-items:center;justify-content:space-between;height:36px;border-top:1px solid #EFEDE6;font-size:14px;color:#1A1C21">${l}<span style="color:#8A8E97">${ic('right', 16)}</span></a>`).join('')}</div></div>`).join('');
  const sw = [['#DB0000', 'Chính'], ['#A30000', 'Chính (hover)'], ['#FDECEC', 'Nền nhấn'], ['#F5F5F5', 'Nền trang'], ['#FFFFFF', 'Bề mặt'], ['#1847A8', 'Thông tin'], ['#B45309', 'Cảnh báo'], ['#15803D', 'Thành công']];
  const inner = `<div style="width:1440px;height:1180px;background:#F5F5F5;padding:56px 64px;display:flex;flex-direction:column;gap:36px">
<div style="display:flex;justify-content:space-between;align-items:flex-start">
<div style="display:flex;flex-direction:column;gap:14px">${logo(false)}
<h1 style="font-size:44px;font-weight:700;letter-spacing:-.02em;line-height:1.1;max-width:820px">Thiết kế giao diện hệ thống quản lý kết quả học tập đa phương tiện</h1>
<p style="font-size:16px;color:#4A4E57;max-width:760px;line-height:1.6">Bộ màn hình theo SRS v1.1 — 5 vai trò, 18 module, giao diện web. Bấm vào tên màn hình để mở; trong chế độ Play, menu bên trái của mỗi màn hình cũng điều hướng được.</p></div>
<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">
<a class="btn btn-p" href="Auth_Login.dc.html">Bắt đầu từ Đăng nhập ${ic('right', 16)}</a>
<a class="btn" href="Media_Viewer.dc.html">${ic('image', 16)} Trình xem đa phương tiện (M08)</a></div></div>
${grid('repeat(3,minmax(0,1fr))', roleCards, 20)}
<div class="card" style="padding:24px;display:flex;gap:40px;align-items:flex-start">
<div style="display:flex;flex-direction:column;gap:12px;width:360px"><h2 class="sec">Màu</h2>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">${sw.map(([c, l]) => `<div style="display:flex;flex-direction:column;gap:6px"><span style="height:40px;border-radius:8px;background:${c};border:1px solid #E3E1D9"></span><span style="font-size:11px;color:#4A4E57">${l}</span></div>`).join('')}</div></div>
<div style="display:flex;flex-direction:column;gap:12px"><h2 class="sec">Chữ</h2>
<span style="font-size:26px;font-weight:700">Be Vietnam Pro — Tiêu đề</span><span style="font-size:14px">Nội dung 14px, hỗ trợ đầy đủ dấu tiếng Việt.</span><span class="mono" style="font-size:13px">JetBrains Mono · MSSV 22511203 · K7QX2M</span></div>
<div style="display:flex;flex-direction:column;gap:12px;flex:1"><h2 class="sec">Trạng thái bài nộp</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px">${badge('Chưa nộp', 'gray')}${badge('Đã nộp', 'blue')}${badge('Nộp muộn', 'amber')}${badge('Đã chấm', 'green')}${badge('Bị trả lại', 'red')}${badge('Đang đồng bộ Drive', 'amber', 1)}${badge('Tệp không còn trên Drive', 'red', 1)}</div>
<div style="display:flex;gap:8px"><span class="btn btn-p">Nút chính</span><span class="btn">Nút phụ</span><span class="btn btn-d">Xóa</span></div></div>
</div></div>`;
  add('chung', 'Main.dc.html', 'Mục lục thiết kế', 1440, 1180, inner);
}

// Login (interactive role switch)
{
  const inner = `<div style="width:1440px;height:900px;display:flex;background:#F5F5F5">
<div style="width:600px;background:#DB0000;color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between">
${logo()}
<div style="display:flex;flex-direction:column;gap:20px">
<h1 style="font-size:38px;line-height:1.15;font-weight:700;letter-spacing:-.02em">Điểm số và sản phẩm thật của sinh viên, ở cùng một nơi.</h1>
<p style="font-size:15px;line-height:1.7;color:rgba(255,255,255,.88)">Nộp ảnh thiết kế, link Figma, video demo và mã nguồn. Làm bài nhóm bằng mã mời. Phụ huynh theo dõi, doanh nghiệp tìm sinh viên tiềm năng — có kiểm soát quyền xem.</p>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:8px">
${[['image', 'Ảnh + Figma'], ['video', 'Video demo'], ['code', 'Mã nguồn / GitHub'], ['folder', 'Lưu vào Google Drive của GV']].map(([i, t]) => `<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:rgba(255,255,255,.14);font-size:13px;color:#fff">${ic(i, 18)}${t}</div>`).join('')}</div></div>
<span style="font-size:12px;color:rgba(255,255,255,.75)">Trường Đại học [TÊN TRƯỜNG] · Phiên bản 1.1</span></div>
<div style="flex:1;display:flex;align-items:center;justify-content:center">
<div style="width:460px;display:flex;flex-direction:column;gap:22px">
<div style="display:flex;flex-direction:column;gap:6px"><h2 style="font-size:26px;font-weight:700">Đăng nhập</h2><p class="muted" style="font-size:14px">Chọn vai trò của bạn để đăng nhập đúng cách.</p></div>
<div role="tablist" aria-label="Vai trò" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:4px;background:#ECEBE4;border-radius:10px;gap:2px">
<sc-for list="{{roles}}" as="r" hint-placeholder-count="5">
<sc-if value="{{r.on}}" hint-placeholder-val="{{false}}"><button role="tab" aria-selected="true" onClick="{{r.pick}}" style="height:36px;border:0;border-radius:8px;background:#fff;font:600 12px 'Be Vietnam Pro',sans-serif;color:#1A1C21;box-shadow:0 1px 2px rgba(0,0,0,.1);cursor:pointer">{{r.label}}</button></sc-if>
<sc-if value="{{r.off}}" hint-placeholder-val="{{true}}"><button role="tab" aria-selected="false" onClick="{{r.pick}}" style="height:36px;border:0;border-radius:8px;background:transparent;font:600 12px 'Be Vietnam Pro',sans-serif;color:#4A4E57;cursor:pointer">{{r.label}}</button></sc-if>
</sc-for></div>
<div><label class="lbl" for="u">{{fieldLabel}}</label><input id="u" class="inp" placeholder="{{placeholder}}" style="height:46px"><div class="help">{{hint}}</div></div>
<div><div style="display:flex;justify-content:space-between"><label class="lbl" for="p">Mật khẩu</label><a href="Auth_ChangePassword.dc.html" style="font-size:13px;font-weight:600">Quên mật khẩu?</a></div><input id="p" class="inp" type="password" defaultValue="password" style="height:46px"></div>
<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:8px;background:#FDF0DE;color:#8A3B06;font-size:13px;line-height:1.5">${ic('alert', 18)}<span>Sai mật khẩu 3/5 lần. Sau 5 lần liên tiếp, tài khoản sẽ bị khóa tạm thời 15 phút.</span></div>
<a class="btn btn-p" href="{{next}}" style="height:48px;font-size:15px">Đăng nhập</a>
<sc-if value="{{isDn}}" hint-placeholder-val="{{false}}"><p style="font-size:14px;text-align:center" class="muted">Chưa có tài khoản doanh nghiệp? <a href="Auth_DNRegister.dc.html" style="font-weight:600">Đăng ký</a></p></sc-if>
</div></div></div>`;
  const logic = `class Component extends DCLogic {
  renderVals() {
    const cur = (this.state && this.state.role) || 'sv';
    const defs = [
      { id: 'sv', label: 'Sinh viên', f: 'Mã số sinh viên', p: 'VD: 22511203', h: 'Lần đầu đăng nhập, bạn sẽ được yêu cầu đổi mật khẩu và khai báo hồ sơ.', n: 'Auth_ChangePassword.dc.html' },
      { id: 'gv', label: 'Giảng viên', f: 'Mã giảng viên', p: 'VD: GV0417', h: 'Tài khoản do Quản trị viên cấp.', n: 'GV_Dashboard.dc.html' },
      { id: 'ad', label: 'Quản trị', f: 'Tên đăng nhập', p: 'admin', h: 'Chỉ dành cho quản trị hệ thống.', n: 'Admin_Dashboard.dc.html' },
      { id: 'ph', label: 'Phụ huynh', f: 'Số điện thoại', p: 'VD: 0912 345 678', h: 'Dùng SĐT mà con bạn đã khai báo. Mật khẩu ban đầu là SĐT, bắt buộc đổi ở lần đầu.', n: 'PH_Dashboard.dc.html' },
      { id: 'dn', label: 'Doanh nghiệp', f: 'Email doanh nghiệp', p: 'hr@congty.vn', h: 'Chỉ đăng nhập được sau khi tài khoản đã được Quản trị viên duyệt.', n: 'DN_Search.dc.html' }
    ];
    const d = defs.find((x) => x.id === cur);
    return {
      roles: defs.map((x) => ({ label: x.label, on: x.id === cur, off: x.id !== cur, pick: () => this.setState({ role: x.id }) })),
      fieldLabel: d.f, placeholder: d.p, hint: d.h, next: d.n, isDn: cur === 'dn'
    };
  }
}`;
  add('chung', 'Auth_Login.dc.html', 'Đăng nhập (M01)', 1440, 900, inner, logic);
}

// Change password first login
{
  const rule = (ok, t) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${ok ? '#14532D' : '#62666F'}"><span style="color:${ok ? '#15803D' : '#A5A8AF'}">${ic(ok ? 'check' : 'x', 16, 2.2)}</span>${t}</div>`;
  const inner = `<div style="width:1440px;height:900px;background:#F5F5F5;display:flex;flex-direction:column;align-items:center;padding-top:56px;gap:32px">
${logo(false)}
<div style="display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600">
<span style="display:flex;align-items:center;gap:8px;color:#A30000"><span class="av" style="width:26px;height:26px;font-size:12px;background:#DB0000;color:#fff">1</span>Đổi mật khẩu</span><span style="width:48px;height:1px;background:#C9C6BB"></span>
<span style="display:flex;align-items:center;gap:8px;color:#62666F"><span class="av" style="width:26px;height:26px;font-size:12px;background:#E3E1D9;color:#4A4E57">2</span>Khai báo hồ sơ</span><span style="width:48px;height:1px;background:#C9C6BB"></span>
<span style="display:flex;align-items:center;gap:8px;color:#62666F"><span class="av" style="width:26px;height:26px;font-size:12px;background:#E3E1D9;color:#4A4E57">3</span>Bắt đầu sử dụng</span></div>
<div style="display:flex;gap:24px;align-items:flex-start">
<div class="card" style="width:520px;padding:32px;display:flex;flex-direction:column;gap:18px">
<div style="display:flex;flex-direction:column;gap:6px"><h1 style="font-size:22px;font-weight:700">Đặt mật khẩu mới</h1><p class="muted" style="font-size:14px;line-height:1.6">Tài khoản của bạn được hệ thống tạo sẵn. Vì an toàn, bạn cần đổi mật khẩu trước khi tiếp tục.</p></div>
${field('Mật khẩu hiện tại (tạm thời)', `<input class="inp" type="password" defaultValue="22511203">`)}
${field('Mật khẩu mới', `<input class="inp" type="password" defaultValue="Thuha@2026">`, `<div style="display:flex;gap:4px;margin-top:8px">${['#15803D', '#15803D', '#15803D', '#E3E1D9'].map(c => `<span style="flex:1;height:4px;border-radius:2px;background:${c}"></span>`).join('')}</div><div class="help">Độ mạnh: Khá</div>`)}
${field('Nhập lại mật khẩu mới', `<input class="inp" type="password" defaultValue="Thuha@2026">`)}
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${rule(1, 'Tối thiểu 8 ký tự')}${rule(1, 'Có chữ hoa và chữ thường')}${rule(1, 'Có ít nhất 1 chữ số')}${rule(0, 'Khác mật khẩu tạm thời')}</div>
<a class="btn btn-p" href="SV_ProfileSetup.dc.html" style="height:46px">Lưu và tiếp tục</a></div>
<div class="card" style="width:360px;padding:24px;display:flex;flex-direction:column;gap:14px">
<span class="badge b-amber" style="align-self:flex-start">Phụ huynh · xác thực OTP</span>
<h2 class="sec">Nhập mã OTP</h2><p class="muted" style="font-size:13px;line-height:1.6">Mã 6 số đã gửi tới 0912 ••• 678. Dùng cho phụ huynh đăng nhập lần đầu hoặc quên mật khẩu.</p>
<div style="display:flex;gap:8px">${['4', '8', '1', '0', '', ''].map(d => `<input aria-label="Chữ số OTP" class="inp mono" ${d ? `defaultValue="${d}"` : ''} style="width:44px;height:52px;text-align:center;font-size:20px;padding:0">`).join('')}</div>
<p style="font-size:13px" class="muted">Gửi lại mã sau <b style="color:#1A1C21">00:42</b></p>
<a class="btn" href="PH_SelectChild.dc.html">Xác nhận</a></div>
</div></div>`;
  add('chung', 'Auth_ChangePassword.dc.html', 'Đổi mật khẩu lần đầu / OTP (FR-01.4)', 1440, 900, inner);
}

// DN register
{
  const inner = `<div style="width:1440px;height:1000px;background:#F5F5F5;display:flex;flex-direction:column;align-items:center;padding-top:48px;gap:28px">
${logo(false)}
<div style="display:flex;gap:24px;align-items:flex-start">
<div class="card" style="width:640px;padding:32px;display:flex;flex-direction:column;gap:18px">
<div style="display:flex;flex-direction:column;gap:6px"><h1 style="font-size:24px;font-weight:700">Đăng ký tài khoản doanh nghiệp</h1><p class="muted" style="font-size:14px">Tài khoản được Quản trị viên xét duyệt trước khi sử dụng (thường trong 1–2 ngày làm việc).</p></div>
${field('Tên doanh nghiệp', inp('Công ty Cổ phần Công nghệ Sao Việt'))}
${grid('repeat(2,minmax(0,1fr))', field('Mã số thuế', inp('0109876543', '', 'mono')) + field('Lĩnh vực hoạt động', `<select class="inp"><option>Công nghệ thông tin</option><option>Thiết kế</option><option>Marketing</option></select>`), 16)}
${grid('repeat(2,minmax(0,1fr))', field('Người liên hệ', inp('Lê Thị Minh Thư')) + field('SĐT liên hệ', inp('0987 654 321')), 16)}
${field('Email đăng nhập', inp('tuyendung@saoviet.vn'), '<div class="help">Email này dùng để đăng nhập và nhận kết quả duyệt.</div>')}
${grid('repeat(2,minmax(0,1fr))', field('Mật khẩu', `<input class="inp" type="password" defaultValue="********">`) + field('Nhập lại mật khẩu', `<input class="inp" type="password" defaultValue="********">`), 16)}
<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:#30343B"><input type="checkbox" defaultChecked="{{true}}" style="margin-top:2px">Tôi cam kết chỉ dùng thông tin sinh viên cho mục đích tuyển dụng, không tải xuống hay chia sẻ bài làm của sinh viên (Nghị định 13/2023/NĐ-CP).</label>
<a class="btn btn-p" href="Auth_Login.dc.html" style="height:46px">Gửi đăng ký</a></div>
<div style="width:340px;display:flex;flex-direction:column;gap:16px">
<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px"><h2 class="sec">Quy trình</h2>
${[['1', 'Gửi đăng ký', 'Điền thông tin doanh nghiệp', '#DB0000'], ['2', 'Chờ duyệt', 'Quản trị viên kiểm tra mã số thuế', '#B45309'], ['3', 'Tìm kiếm sinh viên', 'Theo GPA, ngành, chủ đề đề tài', '#62666F'], ['4', 'Xin quyền xem bài', 'Được cấp 14–28 ngày', '#62666F']].map(([n, t, d, c]) => `<div style="display:flex;gap:12px"><span class="av" style="width:28px;height:28px;font-size:12px;background:${c};color:#fff">${n}</span><div><div style="font-size:14px;font-weight:600">${t}</div><div class="muted" style="font-size:13px">${d}</div></div></div>`).join('')}</div>
<div class="card" style="padding:20px;display:flex;gap:12px;background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06"><span>${ic('clock', 20)}</span><div style="font-size:13px;line-height:1.5"><b>Sau khi gửi:</b> trạng thái “Chờ duyệt”. Bạn nhận email khi tài khoản được duyệt hoặc bị từ chối kèm lý do.</div></div>
</div></div></div>`;
  add('chung', 'Auth_DNRegister.dc.html', 'Đăng ký doanh nghiệp (FR-12.1)', 1440, 1000, inner);
}

// Media viewer (interactive)
{
  const inner = `<div style="width:1440px;height:900px;background:#0E0F12;color:#fff;display:flex;flex-direction:column">
<header style="height:64px;display:flex;align-items:center;gap:16px;padding:0 24px;border-bottom:1px solid #23262E">
<a href="GV_Grading.dc.html" class="btn btn-g" aria-label="Quay lại" style="color:#fff;width:40px;padding:0">${ic('left', 20)}</a>
<div style="display:flex;flex-direction:column"><span style="font-size:15px;font-weight:600">Ứng dụng đặt lịch cắt tóc BarberGo</span><span style="font-size:12px;color:#9DA2B0">Nhóm 03 · BarberGo Team · BT2 – Thiết kế ứng dụng di động</span></div>
<div style="margin-left:24px;display:flex;gap:4px;padding:3px;background:#1B1D23;border-radius:9px">
<span style="height:34px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;border-radius:7px;background:#2A2F3D;font-size:13px;font-weight:600">${ic('image', 16)}Ảnh (12)</span>
<span style="height:34px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;border-radius:7px;font-size:13px;font-weight:600;color:#B9BDC8">${ic('link', 16)}Figma</span>
<span style="height:34px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;border-radius:7px;font-size:13px;font-weight:600;color:#B9BDC8">${ic('video', 16)}Video</span>
<span style="height:34px;padding:0 14px;display:inline-flex;align-items:center;gap:8px;border-radius:7px;font-size:13px;font-weight:600;color:#B9BDC8">${ic('code', 16)}Mã nguồn</span></div>
<div style="margin-left:auto;display:flex;gap:8px">
<button class="btn btn-g" aria-label="Phóng to" style="color:#fff">${ic('zoom', 18)}</button>
<button class="btn btn-g" aria-label="Toàn màn hình" style="color:#fff">${ic('max', 18)}</button>
<button class="btn" style="background:#1B1D23;border-color:#2E323C;color:#fff">${ic('download', 16)}Tải xuống</button></div>
</header>
<div style="flex:1;display:flex;min-height:0">
<div style="flex:1;display:flex;flex-direction:column;min-width:0">
<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:24px;padding:24px">
<button onClick="{{prev}}" aria-label="Ảnh trước" style="width:52px;height:52px;border-radius:50%;border:1px solid #2E323C;background:#1B1D23;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${ic('left', 22)}</button>
<div class="ph" style="width:760px;height:520px;border-radius:10px;background-color:{{cur.bg}};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#30343B">
${ic('image', 40, 1.4)}<span class="mono" style="font-size:14px;font-weight:600">{{cur.label}}</span><span style="font-size:12px">[Ảnh thiết kế do sinh viên tải lên]</span></div>
<button onClick="{{next}}" aria-label="Ảnh tiếp theo" style="width:52px;height:52px;border-radius:50%;border:1px solid #2E323C;background:#1B1D23;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${ic('right', 22)}</button>
</div>
<div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#B9BDC8"><b style="color:#fff">{{counter}}</b><span>· Phím ← → để chuyển ảnh, vuốt trên di động</span></div>
<div style="display:flex;gap:8px;justify-content:center;padding:16px 24px 20px">
<sc-for list="{{imgs}}" as="im" hint-placeholder-count="12">
<sc-if value="{{im.sel}}" hint-placeholder-val="{{false}}"><button onClick="{{im.go}}" aria-label="{{im.label}}" style="width:64px;height:44px;border-radius:6px;border:2px solid #fff;background:{{im.bg}};cursor:pointer;padding:0"></button></sc-if>
<sc-if value="{{im.unsel}}" hint-placeholder-val="{{true}}"><button onClick="{{im.go}}" aria-label="{{im.label}}" style="width:64px;height:44px;border-radius:6px;border:2px solid transparent;background:{{im.bg}};opacity:.5;cursor:pointer;padding:0"></button></sc-if>
</sc-for></div></div>
<aside style="width:320px;border-left:1px solid #23262E;padding:24px;display:flex;flex-direction:column;gap:18px;font-size:13px">
<div style="display:flex;flex-direction:column;gap:6px"><span style="color:#9DA2B0">Đề tài</span><span style="font-size:15px;font-weight:600">Ứng dụng đặt lịch cắt tóc BarberGo</span>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${['UI Mobile App', 'Đặt lịch', 'Dịch vụ làm đẹp'].map(t => `<span class="chip" style="background:#1B1D23;border-color:#2E323C;color:#DADDE5">${t}</span>`).join('')}</div></div>
<div style="display:flex;flex-direction:column;gap:6px"><span style="color:#9DA2B0">Người nộp</span><span>Trần Minh Khoa · 29/09/2026 14:32</span></div>
<div style="display:flex;flex-direction:column;gap:6px"><span style="color:#9DA2B0">Link Figma</span><a href="https://www.figma.com" style="color:#FF8A8A">figma.com/design/barbergo…</a></div>
<div style="display:flex;flex-direction:column;gap:6px"><span style="color:#9DA2B0">Lưu trữ</span><span style="display:flex;align-items:center;gap:8px;color:#86EFAC">${ic('check', 16)}Đã đồng bộ Google Drive</span></div>
<div style="margin-top:auto;padding:12px;border-radius:8px;background:#1B1D23;color:#B9BDC8;line-height:1.5">Nút Tải xuống chỉ hiện với Giảng viên và chủ bài. Phụ huynh và Doanh nghiệp chỉ được xem.</div>
</aside></div></div>`;
  const logic = `class Component extends DCLogic {
  renderVals() {
    const n = 12;
    const i = (this.state && this.state.i != null) ? this.state.i : 2;
    const tones = ${JSON.stringify(tone)};
    const imgs = [];
    for (let k = 0; k < n; k++) {
      imgs.push({ label: 'anh_' + String(k + 1).padStart(2, '0') + '.png', bg: tones[k], sel: k === i, unsel: k !== i, go: () => this.setState({ i: k }) });
    }
    return {
      imgs: imgs, cur: imgs[i], counter: 'Ảnh ' + (i + 1) + '/' + n,
      prev: () => this.setState({ i: (i - 1 + n) % n }),
      next: () => this.setState({ i: (i + 1) % n })
    };
  }
}`;
  add('chung', 'Media_Viewer.dc.html', 'Trình xem đa phương tiện (M08)', 1440, 900, inner, logic);
}

// ======================================================================
// SINH VIEN
// ======================================================================
// Profile setup (blocking)
{
  const inner = `<div style="width:1440px;height:1240px;background:#F5F5F5;display:flex;flex-direction:column">
<header style="height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#fff;border-bottom:1px solid #E3E1D9">${logo(false)}<span style="display:flex;align-items:center;gap:10px;font-size:13px">${av('NH')}<b>Nguyễn Thu Hà</b><span class="muted mono">22511203</span></span></header>
<div style="display:flex;gap:28px;padding:32px 120px;align-items:flex-start">
<div style="flex:1;display:flex;flex-direction:column;gap:20px">
<div style="display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:10px;background:#FDECEC;color:#A30000;font-size:14px;line-height:1.5">${ic('lock', 20)}<div><b>Hoàn thiện hồ sơ để bắt đầu.</b> Bạn chưa thể xem bài tập, tham gia nhóm hay nộp bài cho đến khi khai báo đủ thông tin bắt buộc (*).</div></div>
${card('Liên hệ của bạn', grid('repeat(2,minmax(0,1fr))', field('Số điện thoại *', inp('0356 781 204')) + field('Email nhận thông báo *', inp('thuha.nguyen@gmail.com'), `<div class="help" style="display:flex;align-items:center;gap:6px;color:#14532D">${ic('check', 14, 2.2)}Đã xác thực email</div>`), 16))}
${card('Số điện thoại phụ huynh / người giám hộ', `<p class="muted" style="font-size:13px;line-height:1.6">Nhập ít nhất một số. Mỗi số sẽ tạo (hoặc liên kết) một tài khoản phụ huynh, đăng nhập bằng chính SĐT đó để xem điểm và bài của bạn.</p>
${grid('repeat(3,minmax(0,1fr))', field('SĐT bố', inp('0912 345 678')) + field('SĐT mẹ', inp('0356 781 204', '', 'inp-err'), '<div class="err">Trùng với SĐT của bạn. Vui lòng nhập số khác.</div>') + field('SĐT người giám hộ', inp('', 'Không bắt buộc')), 16)}
<label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox">Tôi không có SĐT phụ huynh / người giám hộ để khai báo</label>
<select class="inp" disabled="{{true}}" style="background:#F7F6F2;color:#8A8E97"><option>Chọn lý do…</option></select>
<div style="display:flex;gap:10px;padding:12px 14px;border-radius:8px;background:#F7F6F2;font-size:12px;line-height:1.6;color:#4A4E57">${ic('shield', 18)}<span>Theo Nghị định 13/2023/NĐ-CP: SĐT phụ huynh chỉ dùng để tạo tài khoản theo dõi kết quả học tập và gửi cảnh báo học tập. Doanh nghiệp không bao giờ thấy các số này.</span></div>`)}
${card('Hồ sơ năng lực <span class="muted" style="font-weight:500;font-size:13px">— không bắt buộc, hiển thị cho doanh nghiệp</span>', `<div style="display:flex;gap:20px;align-items:center">${av('NH', '#FBE3E3', '#A30000', 72)}<button class="btn btn-sm">${ic('upload', 14)}Tải ảnh đại diện</button></div>
${field('Giới thiệu bản thân', `<textarea class="inp" rows="3" defaultValue="Sinh viên năm 3 ngành Thiết kế đồ họa, yêu thích thiết kế UI/UX cho ứng dụng di động."></textarea>`)}
${field('Kỹ năng', `<div class="inp" style="display:flex;align-items:center;gap:6px;height:auto;min-height:42px;padding:6px 8px;flex-wrap:wrap">${['Figma', 'UI/UX', 'Illustrator', 'Prototyping'].map(t => `<span class="chip">${t} <span class="muted">${ic('x', 12)}</span></span>`).join('')}<span class="muted" style="font-size:13px;padding-left:4px">Thêm kỹ năng…</span></div>`)}
${grid('repeat(3,minmax(0,1fr))', field('GitHub', inp('', 'github.com/…')) + field('Behance', inp('behance.net/thuha')) + field('LinkedIn', inp('', 'linkedin.com/in/…')), 16)}`)}
</div>
<div style="width:340px;display:flex;flex-direction:column;gap:16px;position:sticky;top:0">
<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:14px"><h2 class="sec">Mức hoàn thiện</h2>
<div style="height:8px;border-radius:4px;background:#EFEDE6"><div style="width:75%;height:100%;border-radius:4px;background:#DB0000"></div></div>
${[[1, 'SĐT bản thân'], [1, 'Email nhận thông báo'], [0, 'Ít nhất 1 SĐT phụ huynh hợp lệ'], [1, 'Đổi mật khẩu lần đầu']].map(([ok, t]) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px"><span style="color:${ok ? '#15803D' : '#B42318'}">${ic(ok ? 'check' : 'alert', 16, 2)}</span>${t}</div>`).join('')}</div>
<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:12px">
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 class="sec">Cho phép doanh nghiệp tìm thấy tôi</h2><span class="sw" role="switch" aria-checked="true"></span></div>
<p class="muted" style="font-size:13px;line-height:1.6">Tắt nếu bạn không muốn xuất hiện trong kết quả tìm kiếm của doanh nghiệp. Có thể đổi bất cứ lúc nào.</p></div>
<a class="btn btn-p" href="SV_Dashboard.dc.html" style="height:46px">Lưu hồ sơ</a>
<p class="muted" style="font-size:12px;text-align:center">Chỉ lưu được khi tất cả mục bắt buộc hợp lệ.</p>
</div></div></div>`;
  add('sv', 'SV_ProfileSetup.dc.html', 'Khai báo hồ sơ – chặn truy cập (M03)', 1440, 1240, inner);
}

S('SV', 'SV_Dashboard.dc.html', 'Tổng quan sinh viên', 1440, 1040, {
  page: 'sv', crumbs: 'Sinh viên / Tổng quan', title: 'Chào Hà, còn 2 bài sắp đến hạn', sub: 'Học kỳ 1 · 2026–2027 · Tuần 5',
  body: `${grid('repeat(4,minmax(0,1fr))', tile('GPA tích lũy', '3.42 <span style="font-size:15px;color:#62666F;font-weight:500">/ 4 · 8.1 / 10</span>', '72 tín chỉ tích lũy', 'chart') + tile('Bài tập đang mở', '5', '2 bài hạn trong 3 ngày tới', 'file') + tile('Lời mời vào nhóm', '1', 'Hết hạn sau 71 giờ', 'users') + tile('Doanh nghiệp đã xem bài', '3', '2 doanh nghiệp đang có quyền', 'building'))}
${grid('minmax(0,2fr) minmax(0,1fr)', `<div style="display:flex;flex-direction:column;gap:20px">
${card('Sắp đến hạn', `<table><thead><tr><th>Bài tập</th><th>Hình thức</th><th>Hạn nộp</th><th>Trạng thái</th><th></th></tr></thead><tbody>
${[['BT2 – Thiết kế ứng dụng di động', 'INT3306_02 · Thiết kế giao diện', 'Nhóm · BarberGo Team', '12/10 23:59', 'Còn 2 ngày', 'amber', badge('Đã nộp', 'blue')],
    ['Lab 4 – REST API với Express', 'INT3120_01 · Lập trình Web', 'Cá nhân', '03/10 23:59', 'Còn 3 ngày', 'amber', badge('Chưa nộp', 'gray')],
    ['Đồ án giữa kỳ – Web bán hàng', 'INT3120_01 · Lập trình Web', 'Nhóm · chưa có nhóm', '20/10 23:59', 'Còn 20 ngày', 'gray', badge('Chưa có đề tài', 'red')]].map(([t, l, f, d, r, c, s]) => `<tr><td><a href="SV_Assignment.dc.html" style="font-weight:600;color:#1A1C21">${t}</a><div class="muted" style="font-size:12px">${l}</div></td><td style="font-size:13px">${f}</td><td><div style="font-size:13px">${d}</div>${badge(r, c)}</td><td>${s}</td><td><a class="btn btn-sm" href="SV_Submit.dc.html">Mở</a></td></tr>`).join('')}
</tbody></table>`, '<a href="SV_Assignment.dc.html" style="font-size:13px;font-weight:600">Tất cả bài tập</a>', false)}
${card('Lớp học phần kỳ này', grid('repeat(2,minmax(0,1fr))', [['INT3306_02', 'Thiết kế giao diện người dùng', 'TS. Đỗ Văn Quang', 'Thiết kế', 3, 2], ['INT3120_01', 'Lập trình Web', 'ThS. Phạm Thị Lan', 'Lập trình', 4, 2], ['INT2208_03', 'Công nghệ phần mềm', 'TS. Vũ Đức Anh', 'Lập trình', 2, 1], ['MAT1101_05', 'Xác suất thống kê', 'PGS. Lê Văn Bình', 'Khác', 1, 1]].map(([c, n, g, t, a, d]) => `<a href="SV_Assignment.dc.html" style="display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid #E3E1D9;border-radius:10px;color:#1A1C21">
<div style="display:flex;justify-content:space-between"><span class="mono muted" style="font-size:12px">${c}</span>${badge(t, t === 'Thiết kế' ? 'blue' : t === 'Lập trình' ? 'green' : 'gray')}</div>
<span style="font-size:15px;font-weight:600">${n}</span><span class="muted" style="font-size:13px">${g}</span>
<div style="display:flex;align-items:center;gap:10px;font-size:12px" class="muted"><div style="flex:1;height:6px;border-radius:3px;background:#EFEDE6"><div style="width:${d / a * 100}%;height:100%;border-radius:3px;background:#DB0000"></div></div>${d}/${a} bài đã nộp</div></a>`).join(''), 14))}
</div>
<div style="display:flex;flex-direction:column;gap:20px">
<section class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;border-color:#F5C2C2">
<div style="display:flex;justify-content:space-between;align-items:center"><h2 class="sec">Lời mời vào nhóm</h2>${badge('Mới', 'blue')}</div>
<div style="display:flex;gap:12px">${av('MK')}<div style="font-size:14px;line-height:1.5"><b>Trần Minh Khoa</b> mời bạn vào nhóm <b>BarberGo Team</b> · BT2 – Thiết kế ứng dụng di động</div></div>
<div class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px">${ic('clock', 14)}Nhóm 3/5 thành viên · lời mời tự hủy sau 71 giờ</div>
<div style="display:flex;gap:8px"><a class="btn btn-p btn-sm" href="SV_Assignment.dc.html" style="flex:1">Chấp nhận</a><button class="btn btn-sm" style="flex:1">Từ chối</button></div></section>
${card('Thông báo', [['Trần Minh Khoa đã nộp bài chung cho BT2', '14:32 hôm nay', 1], ['Bài tập mới: Lab 4 – REST API với Express', '09:10 hôm nay', 1], ['Có điểm mới: BT1 – Wireframe · 8.5', 'Hôm qua', 1], ['Công ty CP Sao Việt được cấp quyền xem bài của bạn', '27/09', 0], ['BT2 sắp hết hạn trong 24 giờ', '26/09', 0]].map(([t, d, u]) => `<div style="display:flex;gap:10px;align-items:flex-start"><span class="dot" style="margin-top:7px;background:${u ? '#DB0000' : 'transparent'}"></span><div style="flex:1"><div style="font-size:14px;line-height:1.45;${u ? 'font-weight:600' : ''}">${t}</div><div class="muted" style="font-size:12px">${d}</div></div></div>`).join(''), '<button class="btn btn-g btn-sm" style="color:#DB0000">Đánh dấu đã đọc</button>')}
</div>`, 24)}`
});

S('SV', 'SV_Assignment.dc.html', 'Bài tập, nhóm & đề tài (M05–M06)', 1440, 1320, {
  page: 'sv', crumbs: 'Sinh viên / Thiết kế giao diện người dùng / BT2', title: 'BT2 – Thiết kế ứng dụng di động',
  sub: 'INT3306_02 · TS. Đỗ Văn Quang · Mở 22/09 · Hạn nộp 12/10/2026 23:59 · Trọng số 20%',
  actions: `<span class="badge b-amber" style="height:32px;padding:0 14px;font-size:13px">${ic('clock', 14)}Còn 12 ngày 9 giờ</span><a class="btn btn-p" href="SV_Submit.dc.html">${ic('upload', 16)}Đến trang nộp bài</a>`,
  body: `<div class="card" style="padding:18px 22px;display:flex;align-items:center;gap:16px">
${[['Hình thức', 'Làm nhóm', 1], ['Nhóm & thành viên', '3/5 thành viên', 1], ['Đề tài', 'Chờ GV duyệt', 2], ['Nộp bài', 'Đã nộp 29/09', 1]].map(([t, s, st], k) => `${k ? '<span style="flex:1;height:1px;background:#D6D3C8"></span>' : ''}<div style="display:flex;align-items:center;gap:10px"><span class="av" style="width:30px;height:30px;background:${st === 1 ? '#15803D' : '#B45309'};color:#fff">${st === 1 ? ic('check', 16, 2.4) : ic('clock', 16, 2)}</span><div><div style="font-size:14px;font-weight:600">${t}</div><div class="muted" style="font-size:12px">${s}</div></div></div>`).join('')}</div>
${grid('minmax(0,1fr) minmax(0,1fr)', `<div style="display:flex;flex-direction:column;gap:20px">
${card('Yêu cầu của giảng viên', `<p style="font-size:14px;line-height:1.7;color:#30343B">Thiết kế giao diện cho một ứng dụng di động do nhóm tự chọn đề tài. Tối thiểu 8 màn hình chính, có luồng người dùng rõ ràng và design system cơ bản (màu, chữ, component).</p>
<div style="display:flex;flex-wrap:wrap;gap:8px">${badge('Hình thức: SV tự chọn cá nhân / nhóm', 'gray')}${badge('Nhóm 3–5 người', 'gray')}${badge('Nộp: Ảnh (1–30) + link Figma', 'blue')}${badge('Không nhận nộp muộn', 'red')}${badge('Cần GV duyệt đề tài', 'amber')}</div>
<div style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #E3E1D9;border-radius:8px">${ic('file', 20)}<div style="flex:1"><div style="font-size:14px;font-weight:600">De_bai_BT2.pdf</div><div class="muted" style="font-size:12px">Tài liệu đề bài · 1.2 MB</div></div><button class="btn btn-sm">${ic('download', 14)}Tải</button></div>
<div style="display:flex;flex-direction:column;gap:8px"><span class="lbl" style="margin:0">Đề tài gợi ý từ GV</span><div style="display:flex;flex-wrap:wrap;gap:8px">${['App đặt đồ ăn', 'App quản lý chi tiêu', 'App học ngoại ngữ', 'App đặt lịch dịch vụ'].map(t => `<span class="chip">${t}</span>`).join('')}</div></div>`)}
${card('Nhóm BarberGo Team', `<div style="display:flex;gap:16px;align-items:stretch">
<div style="flex:1;padding:14px;border-radius:10px;background:#F7F6F2;display:flex;flex-direction:column;gap:8px"><span class="lbl" style="margin:0">Mã mời</span>
<div style="display:flex;align-items:center;gap:10px"><span class="mono" style="font-size:24px;font-weight:600;letter-spacing:.18em">K7QX2M</span><button class="btn btn-sm" aria-label="Sao chép mã">${ic('copy', 14)}Sao chép</button><button class="btn btn-sm btn-g" aria-label="Tạo mã mới">${ic('refresh', 14)}</button></div>
<span class="muted" style="font-size:12px">Tự hết hiệu lực khi nhóm đủ 5 người hoặc hết hạn nộp.</span></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px"><label class="lbl" for="ms" style="margin:0">Mời bằng MSSV</label><div style="display:flex;gap:8px"><input id="ms" class="inp mono" placeholder="VD: 22511245"><button class="btn btn-p">${ic('send', 16)}Mời</button></div>
<span class="muted" style="font-size:12px">Chỉ mời được SV cùng lớp học phần, chưa có nhóm.</span></div></div>
<table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Tham gia</th><th></th></tr></thead><tbody>
${[['MK', 'Trần Minh Khoa', '22511198', 'Trưởng nhóm', '22/09'], ['NH', 'Nguyễn Thu Hà (bạn)', '22511203', 'Thành viên', '23/09'], ['LN', 'Lê Hoàng Nam', '22511177', 'Thành viên', '23/09']].map(([a, n, m, r, d]) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${av(a, '#FBE3E3', '#A30000', 32)}<div><div style="font-weight:600">${n}</div><div class="mono muted" style="font-size:12px">${m}</div></div></div></td><td>${r === 'Trưởng nhóm' ? badge(r, 'dark') : `<span style="font-size:13px">${r}</span>`}</td><td class="muted" style="font-size:13px">${d}</td><td style="text-align:right"><button class="btn btn-sm btn-g" aria-label="Tùy chọn">${ic('more', 16)}</button></td></tr>`).join('')}
<tr><td><div style="display:flex;gap:10px;align-items:center">${av('GL', '#EEEDE7', '#62666F', 32)}<div><div style="font-weight:600;color:#62666F">Phạm Gia Linh</div><div class="mono muted" style="font-size:12px">22511245</div></div></div></td><td>${badge('Đang chờ phản hồi', 'amber')}</td><td class="muted" style="font-size:13px">Hủy sau 71 giờ</td><td style="text-align:right"><button class="btn btn-sm btn-g">Thu hồi</button></td></tr>
</tbody></table>
<div style="display:flex;gap:8px"><button class="btn btn-sm">Chuyển quyền trưởng nhóm</button><button class="btn btn-sm btn-d">Rời nhóm</button></div>`, badge('Mở · 3/5', 'green'))}
</div>
<div style="display:flex;flex-direction:column;gap:20px">
${card('Đề tài của nhóm', `<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:8px;background:#FDF0DE;color:#8A3B06;font-size:13px;line-height:1.5">${ic('clock', 18)}<span><b>Chờ giảng viên duyệt.</b> Bạn chỉ nộp được bài sau khi đề tài được duyệt. Các thành viên đều thấy và sửa được đề tài trước hạn nộp.</span></div>
${field('Tên đề tài *', inp('Ứng dụng đặt lịch cắt tóc BarberGo'), '<div class="help">5–200 ký tự · 34/200</div>')}
<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:8px;background:#F7F6F2;font-size:13px;line-height:1.5;color:#4A4E57">${ic('alert', 18)}<span>Nhóm <b>Nhóm 07 · Cut&amp;Go</b> trong lớp đã đăng ký đề tài tương tự “Ứng dụng đặt lịch salon tóc”. GV vẫn cho phép trùng đề tài.</span></div>
${field('Mô tả ngắn', `<textarea class="inp" rows="4" defaultValue="Ứng dụng giúp khách hàng tìm tiệm cắt tóc gần nhất, xem thợ, chọn khung giờ và thanh toán trước. Chức năng chính: tìm kiếm, đặt lịch, nhắc lịch, đánh giá."></textarea>`, '<div class="help">142/1000 ký tự</div>')}
${field('Công nghệ / công cụ', inp('Figma, FigJam, Material 3'))}
<div><label class="lbl">Chủ đề / từ khóa * <span class="muted" style="font-weight:500">(1–5)</span></label>
<div class="inp" style="display:flex;align-items:center;gap:6px;height:auto;min-height:44px;padding:6px 8px;flex-wrap:wrap;outline:2px solid #DB0000;outline-offset:-1px">${['UI Mobile App', 'Đặt lịch', 'Dịch vụ làm đẹp'].map(t => `<span class="chip" style="background:#FDECEC;border-color:#F5C2C2;color:#A30000">${t} ${ic('x', 12)}</span>`).join('')}<span style="font-size:14px;padding-left:4px">thanh to</span><span style="width:1px;height:18px;background:#1A1C21"></span></div>
<div class="card" style="margin-top:6px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.08);display:flex;flex-direction:column">
${[['Thanh toán điện tử', '128 đề tài'], ['Thanh toán trực tuyến', 'gộp vào “Thanh toán điện tử”'], ['Tạo từ khóa mới “thanh to”', '']].map(([t, d], k) => `<div style="display:flex;justify-content:space-between;align-items:center;height:38px;padding:0 10px;border-radius:6px;${k === 0 ? 'background:#FFF4F4' : ''};font-size:14px">${k === 2 ? `<span style="display:flex;gap:8px;align-items:center;color:#DB0000">${ic('plus', 14)}${t}</span>` : `<span>${t}</span>`}<span class="muted" style="font-size:12px">${d}</span></div>`).join('')}</div></div>
<div style="display:flex;justify-content:space-between;align-items:center"><a href="#" style="font-size:13px;font-weight:600;display:flex;gap:6px;align-items:center">${ic('history', 16)}Lịch sử sửa (3)</a><button class="btn btn-p">Lưu đề tài</button></div>`, badge('Chờ duyệt', 'amber', 1))}
${card('Lịch sử thay đổi đề tài', [['Lê Hoàng Nam', 'thêm từ khóa “Dịch vụ làm đẹp”', '28/09 21:14'], ['Nguyễn Thu Hà', 'sửa mô tả', '27/09 10:02'], ['Trần Minh Khoa', 'tạo đề tài “Ứng dụng đặt lịch cắt tóc”', '24/09 16:40']].map(([n, a, t]) => `<div style="display:flex;gap:10px;font-size:13px"><span class="dot" style="background:#A5A8AF;margin-top:6px"></span><div style="flex:1"><b>${n}</b> ${a}</div><span class="muted">${t}</span></div>`).join(''))}
</div>`, 24)}`
});

S('SV', 'SV_Submit.dc.html', 'Nộp bài đa phương tiện (M07)', 1440, 1280, {
  page: 'sv', active: 'SV_Submit', crumbs: 'Sinh viên / BT2 – Thiết kế ứng dụng di động / Nộp bài', title: 'Nộp bài – BT2', sub: 'Đề tài: Ứng dụng đặt lịch cắt tóc BarberGo · Nhóm BarberGo Team · Hạn 12/10/2026 23:59',
  actions: `<a class="btn" href="Media_Viewer.dc.html">${ic('eye', 16)}Xem như giảng viên</a>`,
  body: `<div class="tabs"><span class="tab on">${ic('users', 16)}Bài chung của nhóm</span><span class="tab">${ic('lock', 16)}Bài cá nhân <span class="muted" style="font-weight:500">· chỉ bạn và GV thấy</span></span></div>
${grid('minmax(0,1fr) 340px', `<div style="display:flex;flex-direction:column;gap:20px">
<div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:16px">
${av('MK')}<div style="flex:1"><div style="font-size:14px"><b>Trần Minh Khoa</b> đã nộp bản hiện tại</div><div class="muted" style="font-size:13px">29/09/2026 lúc 14:32 · 12 ảnh · 1 link Figma</div></div>
${badge('Đã nộp', 'blue')}${badge('Đã đồng bộ Drive', 'green', 1)}</div>
${card('Ảnh thiết kế <span class="muted" style="font-weight:500;font-size:13px">12/30 · JPG, PNG, WEBP · ≤ 10 MB/ảnh</span>', `
<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:#1A1C21;color:#fff"><input type="checkbox" defaultChecked="{{true}}" aria-label="Chọn tất cả"><span style="font-size:14px;font-weight:600">Đã chọn 3 ảnh</span><span style="font-size:13px;color:#B9BDC8">Kéo biểu tượng ⋮⋮ để sắp xếp thứ tự hiển thị</span><button class="btn btn-sm" style="margin-left:auto;background:#B42318;border-color:#B42318;color:#fff">${ic('trash', 14)}Xóa 3 ảnh</button><button class="btn btn-sm btn-g" style="color:#fff">Bỏ chọn</button></div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
${Array.from({ length: 8 }, (_, k) => { const sel = [1, 4, 5].includes(k); return `<div style="position:relative;border-radius:10px;padding:4px;border:2px solid ${sel ? '#DB0000' : 'transparent'};background:${sel ? '#FFF4F4' : 'transparent'}">${thumb('anh_' + String(k + 1).padStart(2, '0') + '.png', tone[k], 130)}
<input type="checkbox" ${sel ? 'defaultChecked="{{true}}"' : ''} aria-label="Chọn ảnh ${k + 1}" style="position:absolute;top:12px;left:12px;width:20px;height:20px">
<span style="position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,.9);display:inline-flex;align-items:center;justify-content:center;color:#4A4E57;cursor:grab">${ic('grip', 16)}</span>
<span style="position:absolute;bottom:12px;right:12px;font-size:11px;font-weight:700;background:#1A1C21;color:#fff;border-radius:4px;padding:1px 6px">${k + 1}</span></div>`; }).join('')}</div>
<span class="muted" style="font-size:13px;text-align:center">+ 4 ảnh khác</span>
<div style="border:2px dashed #C9C6BB;border-radius:12px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:8px;background:#FAFAF7">
<span style="color:#DB0000">${ic('upload', 28)}</span><span style="font-size:15px;font-weight:600">Kéo thả ảnh vào đây hoặc <a href="#">chọn tệp</a></span><span class="muted" style="font-size:13px">Hệ thống kiểm tra định dạng thật của tệp, không chỉ phần đuôi.</span></div>
<div style="display:flex;flex-direction:column;gap:10px">
${[['man_hinh_thanh_toan.png', '3.4 MB', 100, 'Xong', 'green'], ['flow_dat_lich.png', '8.1 MB', 64, '64% · còn 6 giây', 'blue'], ['poster_A1.png', '14.2 MB', 0, 'Vượt quá 10 MB', 'red']].map(([f, s, p, st, c]) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid ${c === 'red' ? '#F0C4BF' : '#E3E1D9'};border-radius:8px;background:${c === 'red' ? '#FFFBFA' : '#fff'}">${ic('image', 18)}<div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><span class="mono">${f} <span class="muted">· ${s}</span></span><span style="color:${c === 'red' ? '#B42318' : c === 'green' ? '#15803D' : '#A30000'};font-weight:600">${st}</span></div>${c !== 'red' ? `<div style="height:4px;border-radius:2px;background:#EFEDE6"><div style="width:${p}%;height:100%;border-radius:2px;background:${c === 'green' ? '#15803D' : '#DB0000'}"></div></div>` : ''}</div><button class="btn btn-sm btn-g" aria-label="Hủy tải lên">${ic('x', 14)}</button></div>`).join('')}</div>`)}
${card('Link và ghi chú', `${field('Link Figma *', `<div style="display:flex;gap:8px"><input class="inp" defaultValue="https://www.figma.com/design/Qx82/BarberGo"><a class="btn" href="https://www.figma.com">${ic('link', 16)}Mở</a></div>`, `<div class="help" style="color:#14532D;display:flex;gap:6px;align-items:center">${ic('check', 14, 2.2)}Link hợp lệ thuộc figma.com</div>`)}
${field('Ghi chú bài nộp', `<textarea class="inp" rows="3" defaultValue="Prototype bắt đầu từ frame Splash. Bấm “Đặt lịch” để xem luồng chính."></textarea>`)}
<div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn">Hủy thay đổi</button><a class="btn btn-p" href="SV_ConfirmResubmit.dc.html">${ic('upload', 16)}Nộp lại</a></div>`)}
</div>
<div style="display:flex;flex-direction:column;gap:20px">
${card('Tình trạng', `${[['Trạng thái', badge('Đã nộp', 'blue')], ['Điểm', '<span class="muted">Chưa chấm</span>'], ['Hạn nộp', '12/10/2026 23:59'], ['Nộp muộn', 'Không cho phép'], ['Lưu trên', `<span style="display:flex;gap:6px;align-items:center;color:#0F766E;font-weight:600">${ic('folder', 16)}Drive của GV</span>`]].map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:14px"><span class="muted">${k}</span><span>${v}</span></div>`).join('')}`)}
<div class="card" style="padding:16px;display:flex;gap:10px;background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06;font-size:13px;line-height:1.55">${ic('alert', 18)}<span>Nộp lại sẽ <b>xóa vĩnh viễn</b> bản hiện tại (cả trên Google Drive) và thay bằng bản mới. Mọi thành viên sẽ được thông báo.</span></div>
${card('Lịch sử thao tác', [['Trần Minh Khoa', 'nộp lại (12 ảnh, Figma)', '29/09 14:32'], ['Nguyễn Thu Hà', 'xóa 2 ảnh', '28/09 22:05'], ['Nguyễn Thu Hà', 'nộp lần đầu (10 ảnh)', '27/09 19:48']].map(([n, a, t]) => `<div style="display:flex;flex-direction:column;gap:2px;font-size:13px;padding-bottom:10px;border-bottom:1px solid #EFEDE6"><span><b>${n}</b> ${a}</span><span class="muted" style="font-size:12px">${t}</span></div>`).join('') + '<span class="muted" style="font-size:12px">Nhật ký được giữ lại kể cả khi tệp cũ đã bị xóa.</span>')}
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px"><span style="font-size:13px;font-weight:700">Môn lập trình sẽ hiển thị</span><div style="display:flex;gap:8px;font-size:13px;color:#4A4E57;align-items:center">${ic('video', 16)}Video demo · MP4, WEBM, MOV ≤ 500 MB</div><div style="display:flex;gap:8px;font-size:13px;color:#4A4E57;align-items:center">${ic('code', 16)}Mã nguồn ZIP/RAR/7Z ≤ 100 MB hoặc link GitHub</div></div>
</div>`, 24)}`
});

// Confirm resubmit modal
add('sv', 'SV_ConfirmResubmit.dc.html', 'Hộp thoại xác nhận nộp lại (FR-07.7)', 1440, 900, `<div style="width:1440px;height:900px;background:rgba(21,23,28,.55);display:flex;align-items:center;justify-content:center">
<div role="dialog" aria-modal="true" aria-labelledby="dt" class="card" style="width:520px;padding:28px;display:flex;flex-direction:column;gap:18px;box-shadow:0 24px 64px rgba(0,0,0,.25)">
<span style="width:48px;height:48px;border-radius:12px;background:#FCE8E6;color:#B42318;display:inline-flex;align-items:center;justify-content:center">${ic('alert', 24)}</span>
<div style="display:flex;flex-direction:column;gap:8px"><h1 id="dt" style="font-size:20px;font-weight:700">Nộp lại sẽ xóa bản nộp trước</h1>
<p style="font-size:14px;line-height:1.6;color:#4A4E57">Bản nộp của <b>Trần Minh Khoa</b> lúc 29/09 14:32 (12 ảnh, 1 link Figma) sẽ bị <b>xóa vĩnh viễn</b>, kể cả các tệp trong thư mục Google Drive của giảng viên. Thời gian nộp sẽ tính theo bản mới.</p></div>
<div style="padding:12px 14px;border-radius:8px;background:#F7F6F2;font-size:13px;display:flex;flex-direction:column;gap:6px"><span><b>Bản mới:</b> 14 ảnh · 1 link Figma · ghi chú</span><span class="muted">3 thành viên còn lại sẽ nhận thông báo.</span></div>
<label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" defaultChecked="{{true}}">Tôi hiểu bản cũ không thể khôi phục</label>
<div style="display:flex;justify-content:flex-end;gap:10px"><a class="btn" href="SV_Submit.dc.html">Hủy</a><a class="btn" href="SV_Submit.dc.html" style="background:#B42318;border-color:#B42318;color:#fff">Xóa bản cũ và nộp lại</a></div>
</div></div>`);

S('SV', 'SV_Grades.dc.html', 'Kết quả học tập (M09)', 1440, 1080, {
  page: 'sv', crumbs: 'Sinh viên / Kết quả học tập', title: 'Kết quả học tập', sub: 'Điểm học phần thang 10, quy đổi điểm chữ và thang 4 theo quy chế tín chỉ',
  actions: `<select class="inp" style="width:200px"><option>Tất cả học kỳ</option></select><button class="btn">${ic('download', 16)}Xuất PDF</button>`,
  body: `${grid('repeat(4,minmax(0,1fr))', tile('GPA tích lũy (thang 4)', '3.42', 'Xếp loại: Giỏi', 'chart') + tile('GPA tích lũy (thang 10)', '8.1', '', 'chart') + tile('Tín chỉ tích lũy', '72 <span style="font-size:15px;color:#62666F;font-weight:500">/ 130</span>', '', 'book') + tile('GPA HK2 2025–2026', '3.62', '+0.11 so với kỳ trước', 'chart'))}
${grid('minmax(0,1fr) minmax(0,2fr)', card('GPA theo học kỳ (thang 4)', vbars([['HK1 23–24', 3.1], ['HK2 23–24', 3.28], ['HK1 24–25', 3.35], ['HK2 24–25', 3.51], ['HK2 25–26', 3.62]], { max: 4, h: 220, fmt: v => v.toFixed(2) }) + '<span class="muted" style="font-size:12px">Thang 0–4. Học kỳ hè không có học phần.</span>') +
    card('HK2 · 2025–2026 <span class="muted" style="font-weight:500;font-size:13px">· 5 học phần · 16 tín chỉ</span>', `<table><thead><tr><th>Học phần</th><th>TC</th><th>CC</th><th>BT</th><th>GK</th><th>CK</th><th>Tổng kết</th><th>Chữ</th><th>Hệ 4</th><th></th></tr></thead><tbody>
${[['INT2204', 'Lập trình hướng đối tượng', 3, 10, 8.5, 7.5, 8.0, 8.2, 'B+', 3.5], ['INT2211', 'Cơ sở dữ liệu', 3, 9, 9.0, 8.5, 8.8, 8.8, 'A', 4.0], ['INT2212', 'Kiến trúc máy tính', 3, 10, 7.0, 6.5, 7.2, 7.1, 'B', 3.0], ['DES2105', 'Nghệ thuật chữ', 3, 10, 9.5, 9.0, 9.2, 9.3, 'A', 4.0], ['PES1020', 'Giáo dục thể chất 2', 1, 10, 8.0, '—', 8.5, 8.5, 'A', 4.0]].map(r => `<tr><td><div style="font-weight:600">${r[1]}</div><div class="mono muted" style="font-size:12px">${r[0]}</div></td>${r.slice(2, 7).map(v => `<td class="mono" style="font-size:13px">${v}</td>`).join('')}<td class="mono" style="font-weight:600">${r[7]}</td><td>${badge(r[8], r[8] === 'A' ? 'green' : 'blue')}</td><td class="mono">${r[9].toFixed(1)}</td><td><button class="btn btn-sm btn-g" style="color:#DB0000">Phúc khảo</button></td></tr>`).join('')}
</tbody></table>`, '', false), 24)}
${card('Tiến độ nộp bài học kỳ này', grid('repeat(4,minmax(0,1fr))', [['Thiết kế giao diện', 2, 3], ['Lập trình Web', 2, 4], ['Công nghệ phần mềm', 1, 2], ['Xác suất thống kê', 1, 1]].map(([n, d, a]) => `<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;font-size:14px"><span style="font-weight:600">${n}</span><span class="muted">${d}/${a}</span></div><div style="height:8px;border-radius:4px;background:#EFEDE6"><div style="width:${d / a * 100}%;height:100%;border-radius:4px;background:#DB0000"></div></div></div>`).join(''), 24))}`
});

S('SV', 'SV_Privacy.dc.html', 'Doanh nghiệp & quyền riêng tư (FR-03.5, 13.8, 16.14)', 1440, 1000, {
  page: 'sv', crumbs: 'Sinh viên / Doanh nghiệp & quyền riêng tư', title: 'Doanh nghiệp & quyền riêng tư', sub: 'Theo dõi doanh nghiệp tìm thấy và xem bài của bạn',
  body: `${grid('repeat(3,minmax(0,1fr))', tile('Doanh nghiệp đã xem hồ sơ', '11', '30 ngày gần nhất', 'eye') + tile('Đang có quyền xem bài', '2', 'Quyền tự thu hồi khi hết hạn', 'key') + `<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:700">Cho phép doanh nghiệp tìm thấy tôi</span><span class="sw" role="switch" aria-checked="true"></span></div><p class="muted" style="font-size:13px;line-height:1.55">Doanh nghiệp chỉ thấy họ tên, khóa, ngành, GPA và đề tài đã nộp — không thấy SĐT, email, thông tin phụ huynh hay điểm từng môn.</p></div>`)}
${card('Quyền xem mới được cấp', `<div style="display:flex;gap:16px;align-items:center;padding:16px;border:1px solid #E5E5E5;border-radius:10px;background:#FAFAFA">
<span style="width:44px;height:44px;border-radius:10px;background:#FDECEC;color:#DB0000;display:inline-flex;align-items:center;justify-content:center">${ic('building', 22)}</span>
<div style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:15px;font-weight:600">Công ty CP Công nghệ Sao Việt · Công nghệ thông tin</span><span style="font-size:13px;color:#4A4E57">Quản trị viên đã cấp quyền xem bài 21 ngày (30/09 – 21/10/2026). Mục đích: “Tuyển thực tập sinh UI/UX kỳ Xuân 2027”.</span><span class="muted" style="font-size:12px">Doanh nghiệp chỉ được xem, không tải xuống; mọi lượt xem được ghi vào nhật ký bên dưới.</span></div>
<button class="btn">${ic('alert', 16)}Báo cáo vi phạm</button></div>
<div style="display:flex;gap:10px;align-items:center;font-size:13px;color:#4A4E57">${ic('shield', 16)}<span>Doanh nghiệp xem bài khi được Quản trị viên duyệt yêu cầu (14–28 ngày), bạn không cần phê duyệt. Muốn không bị doanh nghiệp tìm thấy, hãy tắt công tắc ở trên.</span></div>`)}
${grid('minmax(0,1fr) minmax(0,1fr)', card('Doanh nghiệp đang có quyền xem', `<table><thead><tr><th>Doanh nghiệp</th><th>Cấp ngày</th><th>Còn lại</th></tr></thead><tbody>
${[['FPT Software (demo)', '15/09', 14, 28], ['Studio Mây Xanh', '20/09', 4, 14]].map(([n, d, r, t]) => `<tr><td style="font-weight:600">${n}</td><td class="muted" style="font-size:13px">${d}</td><td><div style="display:flex;align-items:center;gap:10px"><div style="width:90px;height:6px;border-radius:3px;background:#EFEDE6"><div style="width:${r / t * 100}%;height:100%;border-radius:3px;background:${r <= 5 ? '#B45309' : '#DB0000'}"></div></div><span style="font-size:13px;font-weight:600">${r} ngày</span></div></td></tr>`).join('')}</tbody></table>`, '', false) +
    card('Nhật ký truy cập bài của bạn', `<table><thead><tr><th>Ai xem</th><th>Bài</th><th>Thời gian</th></tr></thead><tbody>
${[['Studio Mây Xanh', 'BT2 – Ứng dụng BarberGo', '29/09 10:14'], ['Studio Mây Xanh', 'BT1 – Wireframe ví điện tử', '29/09 10:09'], ['FPT Software (demo)', 'Đồ án – Website bán giày', '22/09 15:40'], ['FPT Software (demo)', 'BT2 – Ứng dụng BarberGo', '22/09 15:31']].map(([a, b, t]) => `<tr><td style="font-weight:600;font-size:13px">${a}</td><td style="font-size:13px">${b}</td><td class="muted" style="font-size:13px">${t}</td></tr>`).join('')}</tbody></table>`, '', false), 24)}`
});

// ======================================================================
// GIANG VIEN
// ======================================================================
S('GV', 'GV_Dashboard.dc.html', 'Tổng quan giảng viên', 1440, 1000, {
  page: 'gv', crumbs: 'Giảng viên / Tổng quan', title: 'Chào thầy Quang', sub: 'Học kỳ 1 · 2026–2027 · 3 lớp học phần · 142 sinh viên', bell: 5,
  actions: `<a class="btn btn-p" href="GV_CreateAssignment.dc.html">${ic('plus', 16)}Tạo bài tập</a>`,
  body: `<div class="card" style="padding:16px 20px;display:flex;gap:14px;align-items:center;background:#FCE8E6;border-color:#F0C4BF;color:#7F1D16">${ic('alert', 22)}<div style="flex:1;font-size:14px;line-height:1.5"><b>Mất quyền ghi thư mục Drive</b> của “BT3 – Prototype tương tác” (INT3306_01). 3 bài nộp đang được giữ tạm trên máy chủ và sẽ tự đồng bộ khi quyền được cấp lại.</div><a class="btn btn-sm" href="GV_CreateAssignment.dc.html">Xem cách cấp quyền</a></div>
${grid('repeat(4,minmax(0,1fr))', tile('Bài chờ chấm', '26', '3 bài tập', 'check') + tile('Nộp đúng hạn', '87%', 'Trung bình các bài đã đóng', 'clock') + tile('Đề tài chờ duyệt', '4', 'BT2 · INT3306_02', 'file') + tile('Nhóm thiếu thành viên', '2', 'Dưới mức tối thiểu 3', 'users'))}
${grid('minmax(0,2fr) minmax(0,1fr)', card('Lớp học phần phụ trách', `<table><thead><tr><th>Lớp học phần</th><th>Sĩ số</th><th>Bài tập</th><th>Nộp bài gần nhất</th><th></th></tr></thead><tbody>
${[['INT3306_02', 'Thiết kế giao diện người dùng', 48, '3 (1 đang mở)', 83], ['INT3306_01', 'Thiết kế giao diện người dùng', 52, '3 (1 đang mở)', 71], ['DES3201_01', 'Thiết kế tương tác', 42, '2 (0 đang mở)', 100]].map(([c, n, s, b, p]) => `<tr><td><a href="GV_AssignmentDetail.dc.html" style="font-weight:600;color:#1A1C21">${n}</a><div class="mono muted" style="font-size:12px">${c}</div></td><td>${s}</td><td style="font-size:13px">${b}</td><td><div style="display:flex;gap:10px;align-items:center"><div style="width:100px;height:6px;border-radius:3px;background:#EFEDE6"><div style="width:${p}%;height:100%;border-radius:3px;background:#DB0000"></div></div><span style="font-size:13px">${p}%</span></div></td><td><a class="btn btn-sm" href="GV_AssignmentDetail.dc.html">Mở</a></td></tr>`).join('')}</tbody></table>`, '', false) +
    card('Cần xử lý', [['alert', '#B42318', 'Nhóm 11 chỉ có 2/3 thành viên khi hết hạn BT1', 'INT3306_01'], ['file', '#B45309', '4 đề tài chờ duyệt', 'BT2 · INT3306_02'], ['users', '#B45309', '5 SV chưa có nhóm', 'BT2 · INT3306_02'], ['log', '#62666F', 'Lê Hoàng Nam xin rời nhóm đã nộp bài', 'BT2 · Nhóm 03']].map(([i, c, t, s]) => `<div style="display:flex;gap:12px"><span style="color:${c}">${ic(i, 18)}</span><div style="flex:1"><div style="font-size:14px;font-weight:600;line-height:1.4">${t}</div><div class="muted" style="font-size:12px">${s}</div></div><a href="GV_AssignmentDetail.dc.html" aria-label="Mở" style="color:#8A8E97">${ic('right', 16)}</a></div>`).join('')), 24)}
${grid('minmax(0,1fr) minmax(0,1fr)', card('Phổ điểm BT1 – Wireframe (INT3306_02)', vbars([['<4', 1], ['4–5', 2], ['5–6', 4], ['6–7', 7], ['7–8', 13], ['8–9', 15], ['9–10', 6]], { max: 16, h: 160, hi: 5 }) + '<span class="muted" style="font-size:12px">Số sinh viên theo khoảng điểm · cao nhất: 15 SV ở khoảng 8–9</span>') +
    card('SV lớp được doanh nghiệp quan tâm', hbars([['INT3306_02', 14], ['INT3306_01', 9], ['DES3201_01', 6]], { max: 14, labelW: 110 }) + '<span class="muted" style="font-size:12px">Số SV có ít nhất 1 yêu cầu xem bài từ doanh nghiệp</span>'), 24)}`
});

S('GV', 'GV_CreateAssignment.dc.html', 'Tạo bài tập + thư mục Drive (M05, M18)', 1440, 1480, {
  page: 'gv', crumbs: 'Giảng viên / INT3306_02 / Tạo bài tập', title: 'Tạo bài tập', sub: 'Giảng viên không đặt chủ đề — mỗi nhóm/sinh viên tự nhập đề tài của mình',
  actions: `<button class="btn">Lưu nháp</button><a class="btn btn-p" href="GV_AssignmentDetail.dc.html">Giao bài</a>`,
  body: grid('minmax(0,1fr) 380px', `<div style="display:flex;flex-direction:column;gap:20px">
${card('Thông tin chung', `${field('Tiêu đề *', inp('BT2 – Thiết kế ứng dụng di động'))}
${field('Mô tả / yêu cầu chung', `<textarea class="inp" rows="4" defaultValue="Thiết kế giao diện cho một ứng dụng di động do nhóm tự chọn đề tài. Tối thiểu 8 màn hình chính, có luồng người dùng rõ ràng và design system cơ bản."></textarea>`)}
${grid('repeat(4,minmax(0,1fr))', field('Lớp học phần *', `<select class="inp"><option>INT3306_02</option></select>`) + field('Ngày mở *', inp('22/09/2026 08:00')) + field('Hạn nộp *', inp('12/10/2026 23:59'), '<div class="help">Trong HK1: 07/09 – 10/01</div>') + field('Trọng số điểm (%)', inp('20')), 14)}
${field('Tài liệu đề bài', `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip">${ic('file', 14)}De_bai_BT2.pdf <span class="muted">${ic('x', 12)}</span></span><button class="btn btn-sm">${ic('plus', 14)}Tệp / link</button></div>`, '<div class="help">Tách riêng khỏi thư mục nhận bài.</div>')}`)}
${card('Thư mục Google Drive nhận bài *', `${field('Link thư mục', `<div style="display:flex;gap:8px"><input class="inp mono" style="font-size:13px" defaultValue="https://drive.google.com/drive/folders/1AbC9xYz_UIUX2026"><button class="btn">${ic('refresh', 16)}Kiểm tra lại</button></div>`)}
<div style="display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:10px;background:#F7F6F2">
${[[1, 'Link trỏ tới một thư mục (không phải tệp)'], [1, 'Thư mục tồn tại: “UIUX_HK1_2026”'], [0, 'Hệ thống chưa có quyền ghi (Editor) vào thư mục']].map(([ok, t]) => `<div style="display:flex;gap:10px;align-items:center;font-size:14px;color:${ok ? '#14532D' : '#9B1C12'};font-weight:${ok ? 400 : 600}">${ic(ok ? 'check' : 'x', 16, 2.2)}${t}</div>`).join('')}</div>
<div style="display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #F0C4BF;border-radius:10px;background:#FFFBFA">
<span style="font-size:14px;font-weight:700;color:#7F1D16">Chưa lưu được bài tập. Cấp quyền bằng một trong hai cách:</span>
<div style="display:flex;gap:12px">
<div style="flex:1;display:flex;flex-direction:column;gap:8px;padding:14px;background:#fff;border:1px solid #E3E1D9;border-radius:8px"><span style="font-size:13px;font-weight:700">Cách 1 · Chia sẻ thư mục</span><span class="muted" style="font-size:13px;line-height:1.5">Trên Drive, chia sẻ thư mục với quyền <b>Người chỉnh sửa</b> cho email:</span><div style="display:flex;gap:6px;align-items:center"><span class="mono" style="font-size:12px;padding:6px 8px;background:#F1F0EA;border-radius:6px;flex:1">eduportfolio@[project].iam.gserviceaccount.com</span><button class="btn btn-sm" aria-label="Sao chép email">${ic('copy', 14)}</button></div></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px;padding:14px;background:#fff;border:1px solid #E3E1D9;border-radius:8px"><span style="font-size:13px;font-weight:700">Cách 2 · Liên kết tài khoản Google</span><span class="muted" style="font-size:13px;line-height:1.5">Đăng nhập Google một lần, hệ thống được phép tạo thư mục và ghi tệp cho mọi bài tập sau này.</span><button class="btn btn-sm" style="align-self:flex-start">${ic('link', 14)}Liên kết Google</button></div></div></div>`, badge('Lỗi quyền ghi', 'red', 1))}
${card('Hình thức làm bài', `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${[['Chỉ cá nhân', 0], ['Chỉ nhóm', 0], ['SV tự chọn cá nhân hoặc nhóm', 1]].map(([t, on]) => `<label style="display:flex;gap:10px;align-items:center;padding:14px;border:${on ? '2px solid #DB0000' : '1px solid #E3E1D9'};border-radius:10px;font-size:14px;font-weight:600;background:${on ? '#FFF4F4' : '#fff'}"><input type="radio" name="hinhthuc" ${on ? 'defaultChecked="{{true}}"' : ''}>${t}</label>`).join('')}</div>
${grid('repeat(4,minmax(0,1fr))', field('Số thành viên tối thiểu', `<input class="inp" type="number" defaultValue="3">`) + field('Số thành viên tối đa', `<input class="inp" type="number" defaultValue="5">`), 14)}
<div class="help">Có thể sửa sau khi giao. Nếu giảm tối đa, các nhóm đã vượt sẽ giữ nguyên thành viên nhưng không thêm được người.</div>`)}
${card('Sản phẩm nộp', `<div class="muted" style="font-size:13px">Gợi ý theo loại môn <b style="color:#1A1C21">Thiết kế</b>. Có thể tùy chỉnh cho môn vừa thiết kế vừa lập trình.</div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${[['image', 'Ảnh', 1], ['link', 'Link Figma', 1], ['video', 'Video demo', 0], ['code', 'Mã nguồn / GitHub', 0]].map(([i, t, on]) => `<label style="display:flex;gap:10px;align-items:center;padding:14px;border:1px solid ${on ? '#DB0000' : '#E3E1D9'};border-radius:10px;font-size:14px;font-weight:600"><input type="checkbox" ${on ? 'defaultChecked="{{true}}"' : ''}>${ic(i, 16)}${t}</label>`).join('')}</div>`)}
${card('Đề tài & nộp muộn', [['Cần duyệt đề tài', 'Đề tài ở trạng thái Chờ duyệt; SV chỉ nộp được khi đã duyệt', 1], ['Cho phép trùng đề tài trong lớp', 'Mặc định: cảnh báo nhưng vẫn cho phép', 1], ['Cho phép nộp muộn', 'Tối đa 3 ngày sau hạn, trừ 10% điểm mỗi ngày', 0]].map(([t, d, on]) => `<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;padding:4px 0"><div><div style="font-size:14px;font-weight:600">${t}</div><div class="muted" style="font-size:13px">${d}</div></div><span class="sw ${on ? '' : 'off'}" role="switch" aria-checked="${on ? 'true' : 'false'}"></span></div>`).join(''))}
</div>
<div style="display:flex;flex-direction:column;gap:20px">
${card('Thư mục sẽ được tạo trên Drive', `<div class="mono" style="font-size:12px;line-height:2;color:#30343B;background:#F7F6F2;border-radius:8px;padding:14px;white-space:pre">UIUX_HK1_2026/
└─ INT3306_02_BT2_Thiet_ke_app/
   ├─ Nhom01_BarberGo_Team/
   │  ├─ Bai_chung/
   │  ├─ 22511198_Tran_Minh_Khoa/
   │  └─ 22511203_Nguyen_Thu_Ha/
   ├─ Nhom02_…/
   └─ CaNhan_22511230_…/</div>
<span class="muted" style="font-size:12px;line-height:1.5">Thư mục nhóm tạo khi nhóm được lập; thư mục cá nhân tạo khi SV chọn làm cá nhân. Hệ thống nhận diện thư mục bằng ID, đổi tên trên Drive không làm hỏng liên kết.</span>`, `<span style="color:#0F766E">${ic('folder', 18)}</span>`)}
${card('Quy tắc tệp', [['Ảnh', 'JPG, PNG, WEBP · 1–30 ảnh · ≤ 10 MB'], ['Video', 'MP4, WEBM, MOV · ≤ 500 MB'], ['Mã nguồn', 'ZIP, RAR, 7Z · ≤ 100 MB'], ['Link', 'figma.com, github.com, gitlab.com']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px"><span class="muted">${k}</span><span style="text-align:right">${v}</span></div>`).join('') + '<span class="muted" style="font-size:12px">Do Quản trị viên cấu hình.</span>')}
<div class="card" style="padding:16px;display:flex;gap:10px;font-size:13px;line-height:1.5;color:#4A4E57">${ic('bell', 18)}<span>Khi giao bài, 48 sinh viên của INT3306_02 nhận thông báo trong ứng dụng và qua email.</span></div>
</div>`, 24)
});

S('GV', 'GV_AssignmentDetail.dc.html', 'Bài tập: nhóm, đề tài, bài nộp (M06, FR-06.14)', 1440, 1180, {
  page: 'gv', crumbs: 'Giảng viên / INT3306_02 / BT2 – Thiết kế ứng dụng di động', title: 'BT2 – Thiết kế ứng dụng di động', sub: 'INT3306_02 · Hạn 12/10/2026 23:59 · Nhóm 3–5 · Cần duyệt đề tài',
  actions: `<a class="btn" href="https://drive.google.com" style="color:#0F766E">${ic('folder', 16)}Mở trên Google Drive</a><button class="btn">${ic('download', 16)}Xuất danh sách</button><button class="btn">Sửa bài tập</button><button class="btn">${ic('lock', 16)}Khóa nhóm</button>`,
  body: `${grid('repeat(5,minmax(0,1fr))', tile('Nhóm', '12', '+ 3 SV làm cá nhân') + tile('Đã nộp', '9 / 15', '60% · 1 nộp muộn') + tile('Đề tài chờ duyệt', '4', '') + tile('SV chưa có nhóm', '5', 'Trong 48 SV') + tile('Đồng bộ Drive', '98%', '2 tệp đang chờ'), 16)}
<div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center;background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06;font-size:14px">${ic('alert', 18)}<span>Bạn vừa giảm tối đa từ 6 xuống 5. <b>Nhóm 05</b> (6 thành viên) giữ nguyên thành viên nhưng không thể thêm người.</span></div>
<div class="tabs"><span class="tab on">Nhóm & đề tài</span><span class="tab">Bài nộp</span><span class="tab">SV chưa có nhóm (5)</span><span class="tab">Thống kê</span></div>
${grid('minmax(0,1fr) 320px', `<section class="card" style="overflow:hidden"><table><thead><tr><th>Nhóm</th><th>Đề tài & từ khóa</th><th>TV</th><th>Đề tài</th><th>Bài nộp</th><th>Drive</th><th>Điểm</th><th></th></tr></thead><tbody>
${[['01', 'BarberGo Team', 'Ứng dụng đặt lịch cắt tóc BarberGo', ['UI Mobile App', 'Đặt lịch'], '4/5', ['Chờ duyệt', 'amber'], ['Đã nộp', 'blue'], 'ok', '—'],
    ['02', 'Pixel Pals', 'App quản lý chi tiêu cá nhân MoneyNote', ['Tài chính cá nhân', 'UI Mobile App'], '3/5', ['Đã duyệt', 'green'], ['Đã chấm', 'green'], 'ok', '8.5'],
    ['03', 'Lotus', 'App học tiếng Nhật qua flashcard', ['Giáo dục', 'Gamification'], '5/5', ['Đã duyệt', 'green'], ['Nộp muộn', 'amber'], 'sync', '—'],
    ['04', 'Team Bơ', 'App đặt đồ ăn healthy', ['Thương mại điện tử', 'Food'], '3/5', ['Yêu cầu sửa', 'red'], ['Chưa nộp', 'gray'], '', '—'],
    ['05', 'Six Sense', 'Ứng dụng tìm phòng trọ sinh viên', ['Bất động sản', 'Bản đồ'], '6/5', ['Đã duyệt', 'green'], ['Đã nộp', 'blue'], 'lost', '—'],
    ['07', 'Cut&amp;Go', 'Ứng dụng đặt lịch salon tóc', ['Đặt lịch', 'Dịch vụ làm đẹp'], '3/5', ['Chờ duyệt', 'amber'], ['Chưa nộp', 'gray'], '', '—'],
    ['CN', 'Võ Thị Mai (cá nhân)', 'App nhắc uống nước', ['Sức khỏe'], '1', ['Chờ duyệt', 'amber'], ['Chưa nộp', 'gray'], '', '—']].map(([n, t, d, tags, m, ds, ns, dr, sc]) => `<tr><td><div style="font-weight:600;white-space:nowrap">${n === 'CN' ? '' : 'Nhóm ' + n + ' · '}${t}</div></td><td style="max-width:280px"><div style="font-size:13px;font-weight:600">${d}</div><div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">${tags.map(x => `<span class="chip" style="height:22px;font-size:11px">${x}</span>`).join('')}</div></td><td style="font-size:13px;${m === '6/5' ? 'color:#B42318;font-weight:700' : ''}">${m}</td><td>${badge(ds[0], ds[1])}</td><td>${badge(ns[0], ns[1])}</td><td>${dr === 'ok' ? `<span style="color:#15803D" title="Đã đồng bộ">${ic('check', 16, 2.2)}</span>` : dr === 'sync' ? badge('Đang đồng bộ', 'amber') : dr === 'lost' ? badge('Mất tệp', 'red') : '<span class="muted">—</span>'}</td><td class="mono" style="font-weight:600">${sc}</td><td>${ds[0] === 'Chờ duyệt' ? '<button class="btn btn-sm">Duyệt</button>' : `<a class="btn btn-sm" href="GV_Grading.dc.html">Chấm</a>`}</td></tr>`).join('')}
</tbody></table></section>`, `<div style="display:flex;flex-direction:column;gap:20px">
${card('Duyệt đề tài · Nhóm 01', `<div style="font-size:15px;font-weight:600">Ứng dụng đặt lịch cắt tóc BarberGo</div><p style="font-size:13px;line-height:1.6;color:#4A4E57">Ứng dụng giúp khách hàng tìm tiệm cắt tóc gần nhất, xem thợ, chọn khung giờ và thanh toán trước.</p>
<div style="padding:10px 12px;border-radius:8px;background:#F7F6F2;font-size:12px;color:#4A4E57">Tương tự: Nhóm 07 “Ứng dụng đặt lịch salon tóc”</div>
${field('Nhận xét (bắt buộc khi yêu cầu sửa)', `<textarea class="inp" rows="3" placeholder="Góp ý cho nhóm…"></textarea>`)}
<div style="display:flex;gap:8px"><button class="btn btn-sm" style="flex:1">Yêu cầu sửa</button><button class="btn btn-sm btn-p" style="flex:1">Duyệt</button></div>`)}
${card('SV chưa có nhóm', [['Đặng Quốc Bảo', '22511102'], ['Hồ Ngọc Ánh', '22511115'], ['Tạ Minh Tú', '22511260']].map(([n, m]) => `<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div style="font-size:14px;font-weight:600">${n}</div><div class="mono muted" style="font-size:12px">${m}</div></div><select class="inp" aria-label="Xếp vào nhóm" style="width:120px;height:32px;font-size:13px"><option>Xếp vào…</option><option>Nhóm 02</option><option>Nhóm 04</option></select></div>`).join('') + '<a href="#" style="font-size:13px;font-weight:600">Xem thêm 2 SV</a>')}
</div>`, 20)}`
});

S('GV', 'GV_Grading.dc.html', 'Chấm bài (FR-09.2)', 1440, 1000, {
  page: 'gv', crumbs: 'Giảng viên / BT2 / Chấm bài', title: 'Chấm bài · Nhóm 01 – BarberGo Team', sub: 'Đề tài: Ứng dụng đặt lịch cắt tóc BarberGo · Nộp bởi Trần Minh Khoa 29/09 14:32',
  actions: `<button class="btn">${ic('left', 16)}Nhóm trước</button><span class="muted" style="font-size:13px">1 / 12</span><button class="btn">Nhóm sau ${ic('right', 16)}</button>`,
  body: grid('minmax(0,1fr) 400px', `<div style="display:flex;flex-direction:column;gap:16px">
<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:12px;background:#15171C;border-color:#15171C">
<div style="display:flex;gap:6px">${['Ảnh (12)', 'Figma', 'Bài cá nhân (3)'].map((t, k) => `<span style="height:32px;padding:0 12px;display:inline-flex;align-items:center;border-radius:7px;font-size:13px;font-weight:600;${k === 0 ? 'background:#2A2F3D;color:#fff' : 'color:#B9BDC8'}">${t}</span>`).join('')}<a href="Media_Viewer.dc.html" class="btn btn-sm" style="margin-left:auto;background:#1B1D23;border-color:#2E323C;color:#fff">${ic('max', 14)}Toàn màn hình</a><a href="https://drive.google.com" class="btn btn-sm" style="background:#1B1D23;border-color:#2E323C;color:#fff">${ic('download', 14)}Tải</a></div>
<div style="display:flex;align-items:center;gap:16px"><button aria-label="Ảnh trước" style="width:44px;height:44px;border-radius:50%;border:1px solid #2E323C;background:#1B1D23;color:#fff;display:inline-flex;align-items:center;justify-content:center">${ic('left', 20)}</button>
<div style="flex:1">${thumb('anh_03.png · Màn hình đặt lịch', tone[2], 470)}</div>
<button aria-label="Ảnh tiếp" style="width:44px;height:44px;border-radius:50%;border:1px solid #2E323C;background:#1B1D23;color:#fff;display:inline-flex;align-items:center;justify-content:center">${ic('right', 20)}</button></div>
<div style="display:flex;justify-content:center;gap:6px">${tone.slice(0, 12).map((c, k) => `<span style="width:48px;height:32px;border-radius:4px;background:${c};${k === 2 ? 'outline:2px solid #fff;outline-offset:1px' : 'opacity:.5'}"></span>`).join('')}</div>
<div style="text-align:center;color:#B9BDC8;font-size:13px"><b style="color:#fff">Ảnh 3/12</b></div></div>
<div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center;font-size:13px"><span class="muted">Ghi chú của nhóm:</span><span style="flex:1">Prototype bắt đầu từ frame Splash. Bấm “Đặt lịch” để xem luồng chính.</span><a href="https://www.figma.com" style="font-weight:600;display:flex;gap:6px;align-items:center">${ic('link', 14)}Mở Figma</a></div>
</div>`, `<div style="display:flex;flex-direction:column;gap:16px">
${card('Điểm chung của nhóm', `<div style="display:flex;align-items:flex-end;gap:12px"><div style="flex:1">${field('Điểm (thang 10)', `<input class="inp mono" defaultValue="8.5" style="height:52px;font-size:24px;font-weight:600">`)}</div><span class="muted" style="font-size:13px;padding-bottom:14px">Trọng số 20%</span></div>
${[['Bố cục & phân cấp thị giác', '2.5', '3'], ['Luồng người dùng', '2.0', '2'], ['Design system', '2.0', '3'], ['Prototype', '2.0', '2']].map(([t, v, m]) => `<div style="display:flex;align-items:center;gap:10px;font-size:13px"><span style="flex:1">${t}</span><input class="inp mono" aria-label="${t}" defaultValue="${v}" style="width:64px;height:34px;text-align:center"><span class="muted">/ ${m}</span></div>`).join('')}
${field('Nhận xét', `<textarea class="inp" rows="3" defaultValue="Luồng đặt lịch rõ ràng, prototype mượt. Cần thống nhất khoảng cách và kiểu chữ giữa các màn."></textarea>`)}`, '<span class="muted" style="font-size:12px">Rubric</span>')}
${card('Điều chỉnh điểm từng thành viên', `${[['MK', 'Trần Minh Khoa', '35%', '9.0'], ['NH', 'Nguyễn Thu Hà', '30%', '8.5'], ['LN', 'Lê Hoàng Nam', '20%', '8.0'], ['GL', 'Phạm Gia Linh', '15%', '7.5']].map(([a, n, p, s]) => `<div style="display:flex;align-items:center;gap:10px">${av(a, '#FBE3E3', '#A30000', 30)}<div style="flex:1"><div style="font-size:13px;font-weight:600">${n}</div><div class="muted" style="font-size:12px">Đóng góp ${p}</div></div><input class="inp mono" aria-label="Điểm ${n}" defaultValue="${s}" style="width:70px;height:34px;text-align:center"></div>`).join('')}`, '<span class="muted" style="font-size:12px">Mặc định = điểm chung</span>')}
<div style="display:flex;gap:10px"><button class="btn btn-d" style="flex:1">Trả bài, cho làm lại</button><button class="btn btn-p" style="flex:1">Lưu &amp; chấm tiếp</button></div>
</div>`, 20)
});

{
  const rows = [['22511198', 'Trần Minh Khoa', 10, 9.0, 8.0, 8.5], ['22511203', 'Nguyễn Thu Hà', 10, 8.5, 7.5, 8.0], ['22511177', 'Lê Hoàng Nam', 9, 8.0, 6.5, 7.0], ['22511245', 'Phạm Gia Linh', 8, 7.5, 5.0, 5.5], ['22511102', 'Đặng Quốc Bảo', 10, 9.5, 9.0, 9.2], ['22511115', 'Hồ Ngọc Ánh', 6, 4.0, 3.5, 3.0], ['22511260', 'Tạ Minh Tú', 10, 8.0, 7.0, null], ['22511230', 'Võ Thị Mai', 9, 8.5, 8.0, 8.0]];
  const conv = x => x >= 8.5 ? ['A', 4] : x >= 8 ? ['B+', 3.5] : x >= 7 ? ['B', 3] : x >= 6.5 ? ['C+', 2.5] : x >= 5.5 ? ['C', 2] : x >= 5 ? ['D+', 1.5] : x >= 4 ? ['D', 1] : ['F', 0];
  const body = rows.map(([m, n, cc, bt, gk, ck]) => {
    const tk = ck == null ? null : Math.round((cc * .1 + bt * .3 + gk * .2 + ck * .4) * 10) / 10;
    const [ch, h4] = tk == null ? ['—', null] : conv(tk);
    const cell = (v, err) => `<td style="padding:6px 8px"><input class="inp mono ${err ? 'inp-err' : ''}" aria-label="Điểm" ${v == null ? 'placeholder="—"' : `defaultValue="${v.toFixed ? v.toFixed(1) : v}"`} style="width:64px;height:34px;text-align:center;font-size:13px"></td>`;
    return `<tr><td class="mono" style="font-size:13px">${m}</td><td style="font-weight:600;white-space:nowrap">${n}</td>${cell(cc)}${cell(bt)}${cell(gk)}${cell(ck, ck == null)}<td class="mono" style="font-weight:700">${tk == null ? '<span class="muted">—</span>' : tk.toFixed(1)}</td><td>${tk == null ? '' : badge(ch, ch === 'F' ? 'red' : ch.startsWith('A') ? 'green' : ch.startsWith('B') ? 'blue' : 'gray')}</td><td class="mono">${h4 == null ? '' : h4.toFixed(1)}</td></tr>`;
  }).join('');
  S('GV', 'GV_Gradebook.dc.html', 'Bảng điểm học phần (FR-09.1, 09.5, 09.6)', 1440, 1000, {
    page: 'gv', crumbs: 'Giảng viên / INT3306_02 / Bảng điểm', title: 'Bảng điểm · Thiết kế giao diện người dùng', sub: 'INT3306_02 · 48 sinh viên · 3 tín chỉ · Chưa công bố',
    actions: `<button class="btn">${ic('download', 16)}Tải file mẫu</button><button class="btn">${ic('upload', 16)}Nhập từ Excel</button><button class="btn btn-p">${ic('lock', 16)}Công bố &amp; khóa</button>`,
    body: `<div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:24px"><span style="font-size:14px;font-weight:700">Trọng số</span>
${[['Chuyên cần', 10], ['Bài tập', 30], ['Giữa kỳ', 20], ['Cuối kỳ', 40]].map(([t, v]) => `<label style="display:flex;align-items:center;gap:8px;font-size:13px">${t}<input class="inp mono" defaultValue="${v}" style="width:56px;height:34px;text-align:center"><span class="muted">%</span></label>`).join('')}
<span style="margin-left:auto;display:flex;gap:6px;align-items:center;color:#15803D;font-weight:600;font-size:14px">${ic('check', 16, 2.2)}Tổng = 100%</span></div>
${grid('minmax(0,1fr) 300px', `<section class="card" style="overflow:hidden"><table><thead><tr><th>MSSV</th><th>Họ tên</th><th>CC</th><th>BT</th><th>GK</th><th>CK</th><th>Tổng kết</th><th>Chữ</th><th>Hệ 4</th></tr></thead><tbody>${body}</tbody></table>
<div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #EFEDE6;font-size:13px" class="muted"><span>Hiển thị 8 / 48 · Điểm BT tự tính từ các bài tập theo trọng số</span><span style="color:#B42318;font-weight:600">1 ô còn trống</span></div></section>`,
      `<div style="display:flex;flex-direction:column;gap:20px">${card('Phổ điểm tổng kết', vbars([['F', 1], ['D', 0], ['D+', 1], ['C', 2], ['C+', 3], ['B', 12], ['B+', 14], ['A', 14]], { max: 15, h: 150, hi: 7 }).replace(/<span style="font-size:12px;color:#62666F;white-space:nowrap">/g, '<span style="font-size:11px;color:#62666F;white-space:nowrap">') + '<span class="muted" style="font-size:12px">Số SV theo điểm chữ (47 đã có điểm)</span>')}
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.55"><b>Sau khi công bố</b><span class="muted">Bảng điểm bị khóa. Muốn sửa phải gửi yêu cầu để Quản trị viên mở khóa; mọi thay đổi được ghi nhật ký.</span></div>
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px;font-size:13px"><b>Quy đổi</b>${[['A', '8.5–10', '4.0'], ['B+', '8.0–8.4', '3.5'], ['B', '7.0–7.9', '3.0'], ['C+', '6.5–6.9', '2.5'], ['C', '5.5–6.4', '2.0'], ['D+', '5.0–5.4', '1.5'], ['D', '4.0–4.9', '1.0'], ['F', '< 4.0', '0']].map(([a, b, c]) => `<div style="display:flex;justify-content:space-between" class="mono"><span>${a}</span><span class="muted">${b}</span><span>${c}</span></div>`).join('')}</div></div>`, 20)}`
  });
}

S('GV', 'GV_Search.dc.html', 'Tìm bài theo chủ đề (M10)', 1440, 1040, {
  page: 'gv', crumbs: 'Giảng viên / Tìm bài theo chủ đề', title: 'Tìm bài theo chủ đề', sub: 'Tìm theo tên đề tài và từ khóa sinh viên nhập — không phân biệt dấu và hoa thường',
  body: `<div style="display:flex;gap:10px"><label style="flex:1;display:flex;align-items:center;gap:10px;height:52px;border:2px solid #DB0000;border-radius:10px;padding:0 16px;background:#fff">${ic('search', 20)}<input aria-label="Tìm theo chủ đề" defaultValue="thuong mai dien tu" style="border:0;outline:0;flex:1;font:500 16px 'Be Vietnam Pro',sans-serif"></label><button class="btn btn-p" style="height:52px;padding:0 24px">Tìm kiếm</button></div>
${grid('260px minmax(0,1fr)', `<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:18px;align-self:flex-start">
<div style="display:flex;justify-content:space-between"><span class="sec">Bộ lọc</span><a href="#" style="font-size:13px">Xóa lọc</a></div>
${field('Học kỳ', '<select class="inp"><option>Tất cả</option></select>')}${field('Môn học', '<select class="inp"><option>Tất cả môn</option></select>')}
<div><span class="lbl">Loại bài</span><div style="display:flex;flex-direction:column;gap:8px;font-size:14px"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" defaultChecked="{{true}}">Thiết kế</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" defaultChecked="{{true}}">Lập trình</label></div></div>
<div><span class="lbl">Khoảng điểm</span><div style="display:flex;gap:8px;align-items:center"><input class="inp mono" defaultValue="7.0" aria-label="Từ"><span class="muted">–</span><input class="inp mono" defaultValue="10" aria-label="Đến"></div></div>
${field('Công nghệ', inp('', 'VD: React, Figma'))}
<div><span class="lbl">Phạm vi</span><div class="seg"><span class="on">LHP của tôi</span><span>Cùng khoa</span></div></div></div>`,
    `<div style="display:flex;flex-direction:column;gap:14px">
<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px"><b>38 bài nộp</b> <span class="muted">khớp “thương mại điện tử” · gồm từ khóa đã gộp: TMĐT, E-commerce</span></span><select class="inp" style="width:180px"><option>Liên quan nhất</option></select></div>
${[['Website bán giày thể thao SneakerZ', ['Thương mại điện tử', 'Web'], 'Nhóm 04 · 4 SV', 'INT3120_01 · HK1 26–27', 'Lập trình', '9.0', 1], ['App mua sắm đồ second-hand ReWear', ['Thương mại điện tử', 'UI Mobile App'], 'Nhóm 09 · 3 SV', 'INT3306_01 · HK2 25–26', 'Thiết kế', '8.5', 0], ['Sàn đặt đồ ăn healthy GreenBox', ['Thương mại điện tử', 'Food'], 'Nhóm 04 · 3 SV', 'INT3306_02 · HK1 26–27', 'Thiết kế', '—', 0], ['Hệ thống bán sách trực tuyến', ['Thương mại điện tử', 'Spring Boot'], 'Cá nhân · Võ Thị Mai', 'INT3120_01 · HK2 25–26', 'Lập trình', '8.0', 1]].map(([t, tags, w, l, k, s, code]) => `<div class="card" style="padding:14px;display:flex;gap:16px;align-items:center">
<div style="width:160px;flex-shrink:0">${code ? `<div style="height:100px;border-radius:8px;background:#1A1C21;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px">${ic('play', 18)}video_demo.mp4</div>` : thumb('anh_01.png', tone[t.length % 8], 100)}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:6px"><a href="Media_Viewer.dc.html" style="font-size:16px;font-weight:700;color:#1A1C21">${t}</a>
<div style="display:flex;gap:6px">${tags.map((x, i) => `<span class="chip" style="${i === 0 ? 'background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06;font-weight:600' : ''}">${x}</span>`).join('')}</div>
<span class="muted" style="font-size:13px">${w} · ${l}</span></div>
<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">${badge(k, k === 'Thiết kế' ? 'blue' : 'green')}<span class="mono" style="font-size:20px;font-weight:700">${s}</span><a class="btn btn-sm" href="Media_Viewer.dc.html">${ic('eye', 14)}Xem bài</a></div></div>`).join('')}
<div class="card" style="padding:14px 16px;display:flex;gap:10px;align-items:center;font-size:13px;color:#4A4E57">${ic('copy', 18)}<span><b>Có thể trùng lặp:</b> 2 ảnh của “ReWear” có mã hash trùng với bài HK2 24–25.</span><a href="#" style="margin-left:auto;font-weight:600">So sánh</a></div>
</div>`, 20)}`
});

// ======================================================================
// PHU HUYNH
// ======================================================================
S('PH', 'PH_Dashboard.dc.html', 'Cổng phụ huynh (M11)', 1440, 1040, {
  page: 'ph', crumbs: 'Phụ huynh / Tổng quan', title: 'Kết quả học tập của con', sub: 'Chỉ xem — không thể sửa, tải xuống hay bình luận', bell: 2,
  actions: `<div class="seg" role="tablist" aria-label="Chọn con"><span class="on">Nguyễn Thu Hà · 22511203</span><span>Nguyễn Minh Đức · 24510088</span></div>`,
  body: `<div style="display:flex;flex-direction:column;gap:10px">
<div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center;background:#FCE8E6;border-color:#F0C4BF;color:#7F1D16;font-size:14px">${ic('alert', 18)}<span><b>Quá hạn nộp bài:</b> Lab 3 – Truy vấn SQL (Cơ sở dữ liệu) đã hết hạn ngày 26/09 mà chưa nộp.</span></div>
<div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center;background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06;font-size:14px">${ic('alert', 18)}<span><b>Điểm dưới ngưỡng:</b> Giữa kỳ Kiến trúc máy tính 4.5 / 10.</span></div></div>
${grid('repeat(4,minmax(0,1fr))', tile('GPA tích lũy', '3.42 <span style="font-size:15px;color:#62666F;font-weight:500">/ 4</span>', 'Xếp loại Giỏi', 'chart') + tile('Tín chỉ tích lũy', '72', 'Năm thứ 3 · Thiết kế đồ họa', 'book') + tile('Bài tập kỳ này', '6 / 10', 'đã nộp · 1 quá hạn', 'file') + tile('Học kỳ gần nhất', '3.62', 'HK2 2025–2026', 'chart'))}
${grid('minmax(0,1fr) minmax(0,1fr)', card('GPA theo học kỳ', vbars([['HK1 23–24', 3.1], ['HK2 23–24', 3.28], ['HK1 24–25', 3.35], ['HK2 24–25', 3.51], ['HK2 25–26', 3.62]], { max: 4, h: 200, fmt: v => v.toFixed(2) })) +
    card('Bài nộp gần đây', [['BT2 – Ứng dụng đặt lịch cắt tóc', 'Thiết kế giao diện · Nhóm', 'Đã nộp', 'blue', '—'], ['BT1 – Wireframe ví điện tử', 'Thiết kế giao diện · Cá nhân', 'Đã chấm', 'green', '8.5'], ['Lab 3 – Truy vấn SQL', 'Cơ sở dữ liệu · Cá nhân', 'Quá hạn', 'red', '—'], ['Lab 2 – Express cơ bản', 'Lập trình Web · Cá nhân', 'Đã chấm', 'green', '9.0']].map(([t, s, b, c, d]) => `<div style="display:flex;gap:12px;align-items:center;padding-bottom:12px;border-bottom:1px solid #EFEDE6"><div style="flex:1"><a href="Media_Viewer.dc.html" style="font-size:14px;font-weight:600;color:#1A1C21">${t}</a><div class="muted" style="font-size:12px">${s}</div></div>${badge(b, c)}<span class="mono" style="width:36px;text-align:right;font-weight:700">${d}</span><a href="Media_Viewer.dc.html" class="btn btn-sm btn-g" aria-label="Xem bài">${ic('eye', 16)}</a></div>`).join('')), 24)}`
});

{
  add('ph', 'PH_SelectChild.dc.html', 'Chọn con sau đăng nhập (FR-01.7, 11.5)', 1440, 900, `<div style="width:1440px;height:900px;background:#F5F5F5;display:flex;flex-direction:column">
<header style="height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#fff;border-bottom:1px solid #E5E5E5">${logo(false)}<span style="display:flex;align-items:center;gap:12px;font-size:13px">${av('PH', '#DB0000', '#fff')}<b>0912 345 678</b><a href="Auth_Login.dc.html" class="btn btn-sm">${ic('logout', 14)}Đăng xuất</a></span></header>
<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding-top:72px;gap:32px">
<div style="display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center"><h1 style="font-size:30px;font-weight:700">Chào phụ huynh</h1><p class="muted" style="font-size:15px;line-height:1.6">Số 0912 345 678 đang liên kết với 2 sinh viên. Chọn con để xem kết quả học tập.</p></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;width:880px">
${[['NH', 'Nguyễn Thu Hà', '22511203', 'K67 · Thiết kế đồ họa', 'Bố', '3.42', '6/10', 1], ['MĐ', 'Nguyễn Minh Đức', '24510088', 'K69 · Kỹ thuật phần mềm', 'Bố', '3.05', '4/4', 0]].map(([a, n, m, s, q, g, sub, warn]) => `<a href="PH_Dashboard.dc.html" class="card" style="padding:28px;display:flex;flex-direction:column;gap:20px;color:#1A1C21">
<div style="display:flex;gap:16px;align-items:center">${av(a, '#FBE3E3', '#A30000', 64)}<div style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:20px;font-weight:700">${n}</span><span class="muted mono" style="font-size:13px">${m}</span><span class="muted" style="font-size:13px">${s} · Quan hệ: ${q}</span></div><span style="color:#DB0000">${ic('right', 24)}</span></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
<div style="padding:14px;border-radius:10px;background:#FDEDED"><div style="font-size:12px;font-weight:600;color:#30343B">GPA tích lũy</div><div style="font-size:24px;font-weight:700;color:#C40000">${g}</div></div>
<div style="padding:14px;border-radius:10px;background:#EAF6EC"><div style="font-size:12px;font-weight:600;color:#30343B">Bài đã nộp kỳ này</div><div style="font-size:24px;font-weight:700;color:#15803D">${sub}</div></div></div>
${warn ? `<span class="badge b-red" style="align-self:flex-start">${ic('alert', 12)}1 bài quá hạn</span>` : `<span class="badge b-green" style="align-self:flex-start">${ic('check', 12)}Không có cảnh báo</span>`}</a>`).join('')}</div>
<div style="width:880px;padding:14px 18px;border-radius:10px;background:#FDECEC;color:#A30000;font-size:14px;line-height:1.5;display:flex;gap:10px;align-items:center">${ic('shield', 18)}<span>Bạn chỉ xem được điểm và bài nộp của con mình. Không thể sửa, tải xuống hay bình luận.</span></div>
</div></div>`);
}

S('PH', 'PH_Submissions.dc.html', 'Bài nộp của con – chỉ xem (FR-11.2)', 1440, 1000, {
  page: 'ph', crumbs: 'Phụ huynh / Nguyễn Thu Hà / Bài nộp', title: 'Bài nộp của Nguyễn Thu Hà', sub: 'Chỉ xem — không tải xuống, không bình luận', bell: 2,
  actions: `<div class="seg" role="tablist" aria-label="Chọn con"><span class="on">Nguyễn Thu Hà</span><span>Nguyễn Minh Đức</span></div><select class="inp" style="width:220px"><option>HK1 · 2026–2027</option></select>`,
  body: `${grid('repeat(4,minmax(0,1fr))', tile('Tổng bài tập', '10', 'Học kỳ này', 'file') + tile('Đã nộp', '6', '', 'check') + tile('Đang mở', '3', 'Hạn gần nhất 03/10', 'clock') + tile('Quá hạn', '1', 'Lab 3 – Truy vấn SQL', 'alert'))}
${grid('minmax(0,1fr) 400px', `<section class="card" style="overflow:hidden"><table><thead><tr><th>Bài tập</th><th>Môn học</th><th>Hình thức</th><th>Hạn nộp</th><th>Trạng thái</th><th>Điểm</th><th></th></tr></thead><tbody>
${[['BT2 – Ứng dụng đặt lịch cắt tóc BarberGo', 'Thiết kế giao diện', 'Nhóm', '12/10', 'Đã nộp', 'blue', '—', 1], ['BT1 – Wireframe ví điện tử', 'Thiết kế giao diện', 'Cá nhân', '20/09', 'Đã chấm', 'green', '8.5', 1], ['Lab 4 – REST API với Express', 'Lập trình Web', 'Cá nhân', '03/10', 'Chưa nộp', 'gray', '—', 0], ['Lab 3 – Truy vấn SQL', 'Cơ sở dữ liệu', 'Cá nhân', '26/09', 'Quá hạn', 'red', '—', 0], ['Lab 2 – Express cơ bản', 'Lập trình Web', 'Cá nhân', '19/09', 'Đã chấm', 'green', '9.0', 1], ['Đồ án giữa kỳ – Web bán hàng', 'Lập trình Web', 'Nhóm', '20/10', 'Chưa nộp', 'gray', '—', 0]].map(([t, m, f, d, s, c, sc, v]) => `<tr><td style="font-weight:600">${t}</td><td style="font-size:13px">${m}</td><td style="font-size:13px">${f}</td><td class="mono" style="font-size:13px">${d}</td><td>${badge(s, c)}</td><td class="mono" style="font-weight:700">${sc}</td><td>${v ? `<a class="btn btn-sm" href="Media_Viewer.dc.html">${ic('eye', 14)}Xem</a>` : ''}</td></tr>`).join('')}
</tbody></table></section>`, `<div style="display:flex;flex-direction:column;gap:20px">
${card('Xem nhanh · BT2', `${thumb('anh_01.png', tone[0], 200)}
<div style="display:flex;gap:6px">${tone.slice(1, 6).map(c => `<span style="flex:1;height:44px;border-radius:6px;background:${c}"></span>`).join('')}</div>
<div style="font-size:14px;font-weight:600">Ứng dụng đặt lịch cắt tóc BarberGo</div>
<div class="muted" style="font-size:13px">Nhóm BarberGo Team · nộp bởi Trần Minh Khoa 29/09 14:32 · 12 ảnh + Figma</div>
<a class="btn btn-p" href="Media_Viewer.dc.html">${ic('image', 16)}Mở trình xem</a>`)}
${card('Cảnh báo học tập', [['alert', '#B42318', 'Quá hạn nộp Lab 3 – Truy vấn SQL', '26/09'], ['alert', '#B45309', 'Điểm giữa kỳ Kiến trúc máy tính 4.5', '22/09']].map(([i, c, t, d]) => `<div style="display:flex;gap:10px"><span style="color:${c}">${ic(i, 18)}</span><div style="flex:1;font-size:14px">${t}</div><span class="muted" style="font-size:12px">${d}</span></div>`).join('') + '<span class="muted" style="font-size:12px">Cảnh báo cũng được gửi qua email / SMS.</span>')}
</div>`, 20)}`
});

// ======================================================================
// DOANH NGHIEP
// ======================================================================
S('DN', 'DN_Search.dc.html', 'Tìm kiếm sinh viên (FR-12.2–12.4)', 1440, 1160, {
  page: 'dn', crumbs: 'Doanh nghiệp / Tìm kiếm sinh viên', title: 'Tìm kiếm sinh viên', sub: 'Kết quả sắp xếp theo GPA giảm dần; bằng GPA thì theo số đề tài, rồi MSSV', bell: 1, search: 'MSSV (khớp chính xác)…',
  body: `<div class="card" style="padding:20px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;align-items:end">
${field('MSSV', inp('', 'Khớp chính xác', 'mono'))}${field('Khóa', '<select class="inp"><option>K66, K67</option></select>')}${field('Ngành', '<select class="inp"><option>Thiết kế đồ họa</option></select>')}${field('Lớp', '<select class="inp"><option>Tất cả</option></select>')}
${field('GPA từ', `<div style="display:flex;gap:6px;align-items:center"><input class="inp mono" defaultValue="3.2" aria-label="GPA tối thiểu"><span class="muted">–</span><input class="inp mono" defaultValue="4.0" aria-label="GPA tối đa"></div>`)}
<button class="btn btn-p" style="height:42px">${ic('search', 16)}Tìm kiếm</button>
<div style="grid-column:span 3">${field('Chủ đề đề tài', `<div class="inp" style="display:flex;gap:6px;align-items:center;padding:0 8px"><span class="chip" style="background:#FDECEC;border-color:#F5C2C2;color:#A30000">UI Mobile App ${ic('x', 12)}</span><span class="chip" style="background:#FDECEC;border-color:#F5C2C2;color:#A30000">Thương mại điện tử ${ic('x', 12)}</span></div>`)}</div>
<div style="grid-column:span 3">${field('Kỹ năng', `<div class="inp" style="display:flex;gap:6px;align-items:center;padding:0 8px"><span class="chip" style="background:#FDECEC;border-color:#F5C2C2;color:#A30000">Figma ${ic('x', 12)}</span><span class="muted" style="font-size:13px">Thêm…</span></div>`)}</div></div>
<div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:14px;background:#1A1C21;border-color:#1A1C21;color:#fff"><input type="checkbox" defaultChecked="{{true}}" aria-label="Đã chọn"><span style="font-size:14px;font-weight:600">Đã chọn 2 sinh viên</span><span style="font-size:13px;color:#B9BDC8">Gửi một yêu cầu xem bài cho nhiều sinh viên cùng lúc</span><a class="btn btn-sm btn-p" href="DN_Profile.dc.html" style="margin-left:auto">${ic('send', 14)}Gửi yêu cầu xem bài</a></div>
<section class="card" style="overflow:hidden"><table><thead><tr><th style="width:40px"></th><th>Sinh viên</th><th>Khóa · Ngành</th><th>GPA ↓</th><th>Đề tài đã thực hiện</th><th>Quyền xem</th><th></th></tr></thead><tbody>
${[['Đặng Quốc Bảo', '22511102', 'K67 · Thiết kế đồ họa', 3.86, [['Website bán giày SneakerZ', 'Thương mại điện tử'], ['App thiền MindRest', 'UI Mobile App']], 5, ['Còn 9 ngày', 'green'], 0],
    ['Nguyễn Thu Hà', '22511203', 'K67 · Thiết kế đồ họa', 3.42, [['Ứng dụng đặt lịch cắt tóc BarberGo', 'UI Mobile App'], ['Wireframe ví điện tử', 'Fintech']], 4, ['Chờ duyệt', 'amber'], 0],
    ['Võ Thị Mai', '22511230', 'K67 · Thiết kế đồ họa', 3.42, [['Hệ thống bán sách trực tuyến', 'Thương mại điện tử']], 2, null, 1],
    ['Lý Gia Huy', '21511044', 'K66 · Thiết kế đồ họa', 3.38, [['App mua sắm ReWear', 'Thương mại điện tử'], ['Landing page quán cà phê', 'Web']], 6, null, 1],
    ['Trịnh Khánh Linh', '22511087', 'K67 · Thiết kế đồ họa', 3.25, [['App quản lý chi tiêu MoneyNote', 'UI Mobile App']], 3, ['Hết hạn', 'gray'], 0]].map(([n, m, k, g, ts, cnt, acc, sel]) => `<tr style="${sel ? 'background:#FFF7F7' : ''}"><td><input type="checkbox" ${sel ? 'defaultChecked="{{true}}"' : ''} aria-label="Chọn ${n}"></td><td><a href="DN_Profile.dc.html" style="font-weight:700;color:#1A1C21">${n}</a><div class="mono muted" style="font-size:12px">${m}</div></td><td style="font-size:13px">${k}</td><td class="mono" style="font-size:18px;font-weight:700">${g.toFixed(2)}</td>
<td style="max-width:420px"><div style="display:flex;flex-direction:column;gap:6px">${ts.map(([t, tag]) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px"><span>${t}</span><span class="chip" style="height:22px;font-size:11px">${tag}</span></div>`).join('')}${cnt > ts.length ? `<span class="muted" style="font-size:12px">+ ${cnt - ts.length} đề tài khác</span>` : ''}</div></td>
<td>${acc ? badge(acc[0], acc[1]) : '<span class="muted" style="font-size:13px">Chưa có</span>'}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-g" aria-label="Lưu vào danh sách quan tâm">${ic('bookmark', 16)}</button><a class="btn btn-sm" href="DN_Profile.dc.html">Hồ sơ</a></td></tr>`).join('')}
</tbody></table>
<div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #EFEDE6"><span class="muted" style="font-size:13px">1–20 trong 342 sinh viên · Sinh viên chọn ẩn khỏi tìm kiếm không xuất hiện</span>
<div style="display:flex;gap:4px">${['‹', '1', '2', '3', '…', '18', '›'].map((p, k) => `<button class="btn btn-sm" aria-label="Trang ${p}" style="width:34px;padding:0;${k === 1 ? 'background:#1A1C21;color:#fff;border-color:#1A1C21' : ''}">${p}</button>`).join('')}</div></div></section>`
});

S('DN', 'DN_Profile.dc.html', 'Hồ sơ SV & yêu cầu xem bài (FR-12.5, 13.1)', 1440, 1040, {
  page: 'dn', crumbs: 'Doanh nghiệp / Tìm kiếm / Nguyễn Thu Hà', title: 'Hồ sơ năng lực', bell: 1,
  actions: `<button class="btn">${ic('bookmark', 16)}Quan tâm</button><button class="btn">${ic('mail', 16)}Mời phỏng vấn</button>`,
  body: grid('minmax(0,1fr) 400px', `<div style="display:flex;flex-direction:column;gap:20px">
<div class="card" style="padding:24px;display:flex;gap:20px;align-items:center">${av('NH', '#FBE3E3', '#A30000', 80)}
<div style="flex:1;display:flex;flex-direction:column;gap:6px"><h2 style="font-size:22px;font-weight:700">Nguyễn Thu Hà</h2><span class="muted" style="font-size:14px">K67 · Thiết kế đồ họa · Khoa Mỹ thuật Công nghiệp</span>
<p style="font-size:14px;line-height:1.6;color:#30343B">Sinh viên năm 3 ngành Thiết kế đồ họa, yêu thích thiết kế UI/UX cho ứng dụng di động.</p>
<div style="display:flex;gap:6px">${['Figma', 'UI/UX', 'Illustrator', 'Prototyping'].map(t => `<span class="chip">${t}</span>`).join('')}</div></div>
<div style="text-align:center;padding:16px 24px;border-radius:12px;background:#F7F6F2"><div class="muted" style="font-size:12px;font-weight:600">GPA</div><div class="mono" style="font-size:36px;font-weight:700">3.42</div><div class="muted" style="font-size:12px">thang 4</div></div></div>
${card('Đề tài đã thực hiện <span class="muted" style="font-weight:500;font-size:13px">· chỉ gồm bài đã nộp</span>', `<table><thead><tr><th>Đề tài</th><th>Từ khóa</th><th>Môn · Học kỳ</th><th>Bài</th></tr></thead><tbody>
${[['Ứng dụng đặt lịch cắt tóc BarberGo', ['UI Mobile App', 'Đặt lịch'], 'Thiết kế giao diện · HK1 26–27'], ['Wireframe ví điện tử PayLite', ['Fintech'], 'Thiết kế giao diện · HK1 26–27'], ['Bộ nhận diện quán cà phê Mộc', ['Branding'], 'Nghệ thuật chữ · HK2 25–26'], ['Poster triển lãm số', ['Minh họa'], 'Đồ họa số · HK1 25–26']].map(([t, tags, l]) => `<tr><td style="font-weight:600">${t}</td><td><div style="display:flex;gap:4px">${tags.map(x => `<span class="chip" style="height:22px;font-size:11px">${x}</span>`).join('')}</div></td><td class="muted" style="font-size:13px">${l}</td><td><span style="display:inline-flex;gap:6px;align-items:center;font-size:13px;color:#62666F">${ic('lock', 14)}Cần quyền</span></td></tr>`).join('')}</tbody></table>`, '', false)}
<div class="card" style="padding:14px 18px;font-size:13px;color:#4A4E57;display:flex;gap:10px">${ic('shield', 18)}Doanh nghiệp không thấy SĐT, email, thông tin phụ huynh và điểm chi tiết từng môn của sinh viên.</div>
</div>`, `<div style="display:flex;flex-direction:column;gap:20px">
${card('Gửi yêu cầu xem bài', `<div style="display:flex;flex-wrap:wrap;gap:6px">${['Nguyễn Thu Hà', 'Võ Thị Mai'].map(n => `<span class="chip">${n} ${ic('x', 12)}</span>`).join('')}</div>
${field('Mục đích *', `<textarea class="inp" rows="4" defaultValue="Tuyển thực tập sinh UI/UX kỳ Xuân 2027 cho sản phẩm ứng dụng đặt lịch dịch vụ."></textarea>`)}
<div><span class="lbl">Thời hạn mong muốn</span><div class="seg" style="width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))"><span style="justify-content:center">2 tuần</span><span class="on" style="justify-content:center">3 tuần</span><span style="justify-content:center">4 tuần</span></div><div class="help">Quản trị viên quyết định thời hạn cuối cùng (14–28 ngày).</div></div>
<div style="padding:12px;border-radius:8px;background:#F7F6F2;font-size:12px;line-height:1.6;color:#4A4E57">Quy trình: Quản trị viên duyệt → bạn xem bài ngay (chỉ xem, không tải xuống, mọi lượt xem được ghi lại). Hết hạn, quyền tự thu hồi.</div>
<a class="btn btn-p" href="DN_Dashboard.dc.html">${ic('send', 16)}Gửi yêu cầu</a>`)}
<div class="card" style="padding:16px;display:flex;gap:10px;background:#FDF0DE;border-color:#F3D6B0;color:#8A3B06;font-size:13px;line-height:1.5">${ic('alert', 18)}<span>Không thể gửi trùng: Nguyễn Thu Hà đã có một yêu cầu đang chờ duyệt từ ngày 27/09.</span></div>
</div>`, 24)
});

S('DN', 'DN_Dashboard.dc.html', 'Yêu cầu & thống kê của DN (FR-12.9)', 1440, 1000, {
  page: 'dn', crumbs: 'Doanh nghiệp / Yêu cầu & thống kê', title: 'Yêu cầu & thống kê', sub: 'Công ty CP Công nghệ Sao Việt', bell: 1,
  body: `${grid('repeat(5,minmax(0,1fr))', tile('Chờ duyệt', '2') + tile('Đã duyệt', '5', '3 còn hiệu lực') + tile('Bị từ chối', '1') + tile('Hết hạn / thu hồi', '4') + tile('SV đã xem bài', '7', '31 lượt xem'), 16)}
${grid('minmax(0,3fr) minmax(0,2fr)', card('Quyền xem đang còn hạn', `<table><thead><tr><th>Sinh viên</th><th>Duyệt ngày</th><th>Còn lại</th><th></th></tr></thead><tbody>
${[['Đặng Quốc Bảo', '22511102', '18/09', 9, 21], ['Lý Gia Huy', '21511044', '22/09', 21, 28], ['Trịnh Khánh Linh', '22511087', '16/09', 1, 14]].map(([n, m, d, r, t]) => `<tr><td><div style="font-weight:600">${n}</div><div class="mono muted" style="font-size:12px">${m}</div></td><td class="muted" style="font-size:13px">${d}</td><td><div style="display:flex;gap:10px;align-items:center"><div style="width:120px;height:6px;border-radius:3px;background:#EFEDE6"><div style="width:${r / t * 100}%;height:100%;border-radius:3px;background:${r <= 2 ? '#B45309' : '#DB0000'}"></div></div><span style="font-size:13px;font-weight:600;${r <= 2 ? 'color:#8A3B06' : ''}">${r} ngày${r <= 2 ? ' · sắp hết' : ''}</span></div></td><td><a class="btn btn-sm" href="Media_Viewer.dc.html">${ic('eye', 14)}Xem bài</a></td></tr>`).join('')}</tbody></table>`, '', false) +
    card('Lịch sử yêu cầu', [['Nguyễn Thu Hà', 'Chờ duyệt', 'amber', '27/09'], ['Võ Thị Mai', 'Chờ duyệt', 'amber', '30/09'], ['Phan Anh Tuấn', 'Từ chối · “Mục đích chưa rõ”', 'red', '12/09'], ['Trần Bảo Ngọc', 'Hết hạn', 'gray', '02/09']].map(([n, s, c, d]) => `<div style="display:flex;gap:10px;align-items:center"><span style="flex:1;font-size:14px;font-weight:600">${n}</span>${badge(s, c)}<span class="muted" style="font-size:12px;width:40px;text-align:right">${d}</span></div>`).join('')), 24)}
${grid('minmax(0,1fr) minmax(0,1fr)', card('Tìm kiếm gần đây', [['Ngành Thiết kế đồ họa · GPA ≥ 3.2 · UI Mobile App', '342 kết quả', 'Hôm nay 09:12'], ['Chủ đề: Thương mại điện tử · K66–K67', '128 kết quả', 'Hôm qua'], ['MSSV 22511102', '1 kết quả', '25/09']].map(([q, r, t]) => `<div style="display:flex;gap:12px;align-items:center"><span style="color:#8A8E97">${ic('history', 16)}</span><div style="flex:1"><div style="font-size:14px">${q}</div><div class="muted" style="font-size:12px">${r} · ${t}</div></div><a href="DN_Search.dc.html" class="btn btn-sm">Tìm lại</a></div>`).join('')) +
    card('Sinh viên quan tâm', [['Đặng Quốc Bảo', '3.86', 'K67 · Thiết kế đồ họa'], ['Lý Gia Huy', '3.38', 'K66 · Thiết kế đồ họa'], ['Nguyễn Thu Hà', '3.42', 'K67 · Thiết kế đồ họa']].map(([n, g, s]) => `<div style="display:flex;gap:12px;align-items:center"><span style="color:#DB0000">${ic('bookmark', 16)}</span><div style="flex:1"><a href="DN_Profile.dc.html" style="font-size:14px;font-weight:600;color:#1A1C21">${n}</a><div class="muted" style="font-size:12px">${s}</div></div><span class="mono" style="font-weight:700">${g}</span></div>`).join('')), 24)}`
});

// ======================================================================
// ADMIN
// ======================================================================
S('AD', 'Admin_Dashboard.dc.html', 'Tổng quan quản trị (FR-16.1)', 1440, 1000, {
  page: 'admin', crumbs: 'Quản trị / Tổng quan', title: 'Tổng quan hệ thống', sub: 'Cập nhật 30/09/2026 10:24', bell: 6,
  actions: `<button class="btn">${ic('download', 16)}Xuất báo cáo</button>`,
  body: `${grid('repeat(5,minmax(0,1fr))', tile('Sinh viên', '9.842', '', 'users') + tile('Giảng viên', '318', '', 'user') + tile('Phụ huynh', '14.207', 'tự sinh từ hồ sơ SV', 'users') + tile('Doanh nghiệp', '126', '8 chờ duyệt', 'building') + tile('Yêu cầu xem bài chờ', '14', 'Cũ nhất: 2 ngày', 'key'), 16)}
${grid('minmax(0,2fr) minmax(0,1fr)', card('Bài nộp theo tuần · HK1 2026–2027', vbars([['T1', 120], ['T2', 410], ['T3', 880], ['T4', 1320], ['T5', 1045]], { max: 1400, h: 220, fmt: v => v.toLocaleString('vi-VN'), hi: 3 }) + '<span class="muted" style="font-size:12px">Tuần 4 cao nhất do trùng nhiều hạn nộp</span>') +
    card('Cần xử lý', [['key', '14 yêu cầu xem bài chờ duyệt', 'Admin_AccessRequests'], ['building', '8 doanh nghiệp chờ duyệt tài khoản', 'Admin_Users'], ['lock', '2 yêu cầu mở khóa bảng điểm', 'Admin_AuditLog'], ['tag', '23 từ khóa mới có thể trùng nghĩa', 'Admin_Tags'], ['folder', '3 bài tập mất quyền ghi Drive', 'Admin_AuditLog']].map(([i, t, f]) => `<a href="${f}.dc.html" style="display:flex;gap:12px;align-items:center;color:#1A1C21;font-size:14px;min-height:36px">${ic(i, 18)}<span style="flex:1">${t}</span><span style="color:#8A8E97">${ic('right', 16)}</span></a>`).join('')), 24)}
${grid('repeat(3,minmax(0,1fr))', card('Top chủ đề đề tài kỳ này', hbars([['UI Mobile App', 412], ['Thương mại điện tử', 356], ['Giáo dục', 188], ['Tài chính cá nhân', 142], ['Sức khỏe', 97]], { max: 412, labelW: 140 })) +
    card('Lưu trữ', `<div style="font-size:30px;font-weight:700">1,8 TB</div><span class="muted" style="font-size:13px">Tổng dung lượng tệp trên Drive của 214 giảng viên</span>${hbars([['Video', 1240], ['Mã nguồn', 310], ['Ảnh', 250]], { max: 1240, labelW: 80, fmt: v => v + ' GB' })}<span class="muted" style="font-size:12px">42 tệp đang chờ đồng bộ · 3 lỗi</span>`) +
    card('Người dùng hoạt động 7 ngày', vbars([['T2', 5200], ['T3', 5900], ['T4', 6100], ['T5', 7400], ['T6', 6800], ['T7', 2100], ['CN', 3900]], { max: 8000, h: 140, fmt: v => v.toLocaleString('vi-VN'), hi: 3 })), 20)}`
});

S('AD', 'Admin_Users.dc.html', 'Quản lý người dùng & import (FR-02.1–02.4)', 1440, 1040, {
  page: 'admin', crumbs: 'Quản trị / Người dùng', title: 'Người dùng', bell: 6,
  actions: `<button class="btn">${ic('download', 16)}File mẫu</button><button class="btn">${ic('upload', 16)}Import Excel</button><button class="btn btn-p">${ic('plus', 16)}Thêm sinh viên</button>`,
  body: `<div class="tabs"><span class="tab on">Sinh viên <span class="muted">9.842</span></span><span class="tab">Giảng viên <span class="muted">318</span></span><span class="tab">Doanh nghiệp <span class="badge b-amber">8 chờ duyệt</span></span><span class="tab">Phụ huynh <span class="muted">14.207</span></span></div>
${grid('minmax(0,1fr) 400px', `<section class="card" style="overflow:hidden">
<div style="padding:14px 16px;display:flex;gap:10px;border-bottom:1px solid #EFEDE6">${inp('', 'Tìm MSSV, họ tên, email…')}<select class="inp" style="width:160px"><option>Khóa: tất cả</option></select><select class="inp" style="width:180px"><option>Trạng thái: tất cả</option></select></div>
<table><thead><tr><th>MSSV</th><th>Họ tên</th><th>Lớp · Ngành</th><th>Hồ sơ</th><th>Trạng thái</th><th></th></tr></thead><tbody>
${[['22511203', 'Nguyễn Thu Hà', 'K67TK1 · Thiết kế đồ họa', ['Hoàn thiện', 'green'], ['Hoạt động', 'green']], ['22511198', 'Trần Minh Khoa', 'K67TK1 · Thiết kế đồ họa', ['Hoàn thiện', 'green'], ['Hoạt động', 'green']], ['22511245', 'Phạm Gia Linh', 'K67TK2 · Thiết kế đồ họa', ['Thiếu SĐT PH', 'amber'], ['Hoạt động', 'green']], ['22511310', 'Bùi Quang Vinh', 'K67TK2 · Thiết kế đồ họa', ['Chưa đăng nhập', 'gray'], ['Hoạt động', 'green']], ['21511044', 'Lý Gia Huy', 'K66TK1 · Thiết kế đồ họa', ['Hoàn thiện', 'green'], ['Tạm khóa 15 phút', 'red']], ['24510088', 'Nguyễn Minh Đức', 'K69PM3 · Kỹ thuật phần mềm', ['Hoàn thiện', 'green'], ['Hoạt động', 'green']]].map(([m, n, l, h, s]) => `<tr><td class="mono" style="font-size:13px">${m}</td><td style="font-weight:600">${n}</td><td style="font-size:13px">${l}</td><td>${badge(h[0], h[1])}</td><td>${badge(s[0], s[1], 1)}</td><td style="white-space:nowrap;text-align:right"><button class="btn btn-sm btn-g">Sửa</button><button class="btn btn-sm btn-g">Đặt lại MK</button><button class="btn btn-sm btn-g" aria-label="Thêm">${ic('more', 16)}</button></td></tr>`).join('')}
</tbody></table></section>`, card('Import sinh viên từ Excel', `<div style="display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #E3E1D9;border-radius:8px">${ic('file', 22)}<div style="flex:1"><div style="font-size:14px;font-weight:600">DS_K70_TKDH.xlsx</div><div class="muted" style="font-size:12px">186 dòng · MSSV, họ tên, lớp, khóa, ngành</div></div></div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center">${[['180', 'Hợp lệ', '#14532D', '#E3F2E8'], ['4', 'Trùng MSSV', '#8A3B06', '#FDF0DE'], ['2', 'Lỗi', '#9B1C12', '#FCE8E6']].map(([v, l, c, b]) => `<div style="padding:12px;border-radius:8px;background:${b};color:${c}"><div style="font-size:22px;font-weight:700">${v}</div><div style="font-size:12px;font-weight:600">${l}</div></div>`).join('')}</div>
<table><thead><tr><th>Dòng</th><th>Lỗi</th></tr></thead><tbody><tr><td class="mono">14</td><td style="font-size:13px">MSSV trống</td></tr><tr><td class="mono">97</td><td style="font-size:13px">Ngành “TKĐH” không có trong danh mục</td></tr><tr><td class="mono">22</td><td style="font-size:13px;color:#8A3B06">MSSV 25511020 đã tồn tại — bỏ qua</td></tr></tbody></table>
<div class="help">Mật khẩu ban đầu = MSSV, bắt buộc đổi khi đăng nhập lần đầu.</div>
<div style="display:flex;gap:8px"><button class="btn" style="flex:1">Tải báo cáo lỗi</button><button class="btn btn-p" style="flex:1">Nhập 180 SV</button></div>`), 20)}`
});

S('AD', 'Admin_Academic.dc.html', 'Đào tạo & danh mục (M04, FR-02.5)', 1440, 960, {
  page: 'admin', crumbs: 'Quản trị / Đào tạo & danh mục', title: 'Đào tạo & danh mục', bell: 6,
  actions: `<button class="btn btn-p">${ic('plus', 16)}Mở lớp học phần</button>`,
  body: `<div style="display:flex;gap:6px;flex-wrap:wrap">${['Học kỳ', 'Môn học', 'Lớp học phần', 'Khoa', 'Ngành', 'Khóa', 'Lớp sinh hoạt'].map((t, k) => `<span class="chip" style="height:34px;padding:0 14px;font-weight:600;${k === 2 ? 'background:#1A1C21;color:#fff;border-color:#1A1C21' : 'background:#fff'}">${t}</span>`).join('')}</div>
${grid('minmax(0,1fr) 380px', `<section class="card" style="overflow:hidden">
<div style="padding:14px 16px;display:flex;gap:10px;border-bottom:1px solid #EFEDE6"><select class="inp" style="width:220px"><option>HK1 · 2026–2027</option></select>${inp('', 'Tìm mã LHP, môn, giảng viên…')}</div>
<table><thead><tr><th>Mã LHP</th><th>Môn học</th><th>Loại</th><th>TC</th><th>Giảng viên</th><th>Sĩ số</th><th></th></tr></thead><tbody>
${[['INT3306_02', 'Thiết kế giao diện người dùng', 'Thiết kế', 3, 'TS. Đỗ Văn Quang', 48], ['INT3306_01', 'Thiết kế giao diện người dùng', 'Thiết kế', 3, 'TS. Đỗ Văn Quang', 52], ['INT3120_01', 'Lập trình Web', 'Lập trình', 3, 'ThS. Phạm Thị Lan', 60], ['INT2208_03', 'Công nghệ phần mềm', 'Lập trình', 3, 'TS. Vũ Đức Anh', 55], ['MAT1101_05', 'Xác suất thống kê', 'Khác', 3, 'PGS. Lê Văn Bình', 80], ['DES3201_01', 'Thiết kế tương tác', 'Thiết kế', 2, 'Chưa phân công', 0]].map(([c, n, t, tc, g, s]) => `<tr><td class="mono" style="font-size:13px">${c}</td><td style="font-weight:600">${n}</td><td>${badge(t, t === 'Thiết kế' ? 'blue' : t === 'Lập trình' ? 'green' : 'gray')}</td><td>${tc}</td><td style="font-size:13px;${s ? '' : 'color:#B42318;font-weight:600'}">${g}</td><td>${s || '<span class="muted">—</span>'}</td><td style="text-align:right"><button class="btn btn-sm btn-g">Sửa</button></td></tr>`).join('')}
</tbody></table></section>`, card('Mở lớp học phần', `${field('Môn học', '<select class="inp"><option>DES3201 · Thiết kế tương tác (2 TC · Thiết kế)</option></select>')}${field('Học kỳ', '<select class="inp"><option>HK1 · 2026–2027 (07/09 – 10/01)</option></select>')}${field('Mã lớp học phần', inp('DES3201_01', '', 'mono'))}${field('Giảng viên phụ trách', inp('', 'Tìm theo mã GV hoặc tên…'))}
${field('Danh sách sinh viên', `<div style="border:2px dashed #C9C6BB;border-radius:10px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:6px;background:#FAFAF7">${ic('upload', 22)}<span style="font-size:14px;font-weight:600">Tải file Excel danh sách SV</span><span class="muted" style="font-size:12px">Cột bắt buộc: MSSV</span></div>`)}
<button class="btn btn-p">Lưu lớp học phần</button>`), 20)}`
});

S('AD', 'Admin_AccessRequests.dc.html', 'Duyệt yêu cầu xem bài (M13)', 1440, 1000, {
  page: 'admin', crumbs: 'Quản trị / Yêu cầu xem bài', title: 'Yêu cầu xem bài của doanh nghiệp', bell: 6,
  body: `<div class="tabs"><span class="tab on">Chờ duyệt <span class="badge b-amber">14</span></span><span class="tab">Đang hiệu lực <span class="muted">37</span></span><span class="tab">Từ chối</span><span class="tab">Hết hạn / thu hồi</span></div>
${grid('380px minmax(0,1fr)', `<div class="card" style="display:flex;flex-direction:column;overflow:hidden">
${[['Công ty CP Công nghệ Sao Việt', '2 sinh viên · 3 tuần', '2 ngày trước', 1], ['Studio Mây Xanh', '1 sinh viên · 2 tuần', '1 ngày trước', 0], ['NextGen Solutions', '12 sinh viên · 4 tuần', '5 giờ trước', 0, 1], ['Hoàng Long Media', '3 sinh viên · 3 tuần', '2 giờ trước', 0]].map(([n, s, t, on, warn]) => `<div style="padding:14px 16px;border-bottom:1px solid #EFEDE6;display:flex;flex-direction:column;gap:4px;${on ? 'background:#FFF4F4;box-shadow:inset 3px 0 0 #DB0000' : ''}"><div style="display:flex;justify-content:space-between;gap:8px"><span style="font-size:14px;font-weight:700">${n}</span><span class="muted" style="font-size:12px;white-space:nowrap">${t}</span></div><span class="muted" style="font-size:13px">${s}</span>${warn ? `<span class="badge b-red" style="align-self:flex-start">${ic('alert', 12)}Nhiều yêu cầu bất thường</span>` : ''}</div>`).join('')}</div>`,
    `<div style="display:flex;flex-direction:column;gap:20px">
<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;gap:14px;align-items:center"><span style="width:48px;height:48px;border-radius:12px;background:#EFE7FB;color:#5B21B6;display:inline-flex;align-items:center;justify-content:center">${ic('building', 24)}</span><div style="flex:1"><div style="font-size:18px;font-weight:700">Công ty CP Công nghệ Sao Việt</div><div class="muted" style="font-size:13px">MST 0109876543 · Công nghệ thông tin · Duyệt tài khoản 02/08/2026 · 6 yêu cầu trước (5 duyệt)</div></div>${badge('Chờ duyệt', 'amber', 1)}</div>
<div style="padding:14px;border-radius:8px;background:#F7F6F2;font-size:14px;line-height:1.6"><span class="muted" style="font-size:12px;font-weight:600;display:block">MỤC ĐÍCH</span>Tuyển thực tập sinh UI/UX kỳ Xuân 2027 cho sản phẩm ứng dụng đặt lịch dịch vụ.</div>
<table><thead><tr><th>Sinh viên</th><th>Ngành · GPA</th><th>Bài có thể xem</th><th>Cho phép DN tìm</th></tr></thead><tbody>
<tr><td><b>Nguyễn Thu Hà</b><div class="mono muted" style="font-size:12px">22511203</div></td><td style="font-size:13px">Thiết kế đồ họa · 3.42</td><td style="font-size:13px">4 bài (1 bài nhóm)</td><td>${badge('Có', 'green')}</td></tr>
<tr><td><b>Võ Thị Mai</b><div class="mono muted" style="font-size:12px">22511230</div></td><td style="font-size:13px">Thiết kế đồ họa · 3.42</td><td style="font-size:13px">2 bài</td><td>${badge('Có', 'green')}</td></tr></tbody></table></div>
<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:16px">
<div><span class="lbl">Thời hạn cấp quyền (tính từ lúc duyệt)</span><div class="seg" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:420px"><span style="justify-content:center">14 ngày</span><span class="on" style="justify-content:center">21 ngày</span><span style="justify-content:center">28 ngày</span></div><div class="help">Hết hạn ngày 21/10/2026. DN được báo trước 2 ngày; sau đó quyền tự thu hồi.</div></div>
<div style="display:flex;gap:10px;align-items:center;font-size:13px;color:#4A4E57">${ic('bell', 16)}<span>Duyệt xong, doanh nghiệp xem được bài ngay; sinh viên nhận thông báo để biết.</span></div>
${field('Lý do từ chối (bắt buộc khi từ chối)', `<textarea class="inp" rows="2" placeholder="VD: Mục đích chưa rõ ràng…"></textarea>`)}
<div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn btn-d">Từ chối</button><button class="btn btn-p">${ic('check', 16)}Duyệt 21 ngày</button></div></div>
<div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center;font-size:13px;color:#4A4E57">${ic('key', 18)}<span>Ở tab <b>Đang hiệu lực</b>, Quản trị viên có thể <b>thu hồi sớm</b> khi phát hiện vi phạm.</span></div>
</div>`, 20)}`
});

S('AD', 'Admin_DNStats.dc.html', 'Thống kê doanh nghiệp (FR-16.6–16.13)', 1440, 1320, {
  page: 'admin', crumbs: 'Quản trị / Thống kê doanh nghiệp', title: 'Thống kê doanh nghiệp', bell: 6,
  actions: `<select class="inp" style="width:190px"><option>01/07 – 30/09/2026</option></select><select class="inp" style="width:170px"><option>Mọi lĩnh vực</option></select><select class="inp" style="width:170px"><option>Mọi ngành SV</option></select><button class="btn">${ic('download', 16)}Excel / PDF</button>`,
  body: `${grid('repeat(5,minmax(0,1fr))', tile('Tổng doanh nghiệp', '126') + tile('Chờ duyệt', '8') + tile('Đã duyệt', '112') + tile('Bị khóa', '6') + tile('Hoạt động 30 ngày', '71', 'Có đăng nhập hoặc tìm kiếm'), 16)}
${grid('repeat(3,minmax(0,1fr))', card('Doanh nghiệp theo lĩnh vực', hbars([['Công nghệ thông tin', 58], ['Thiết kế', 27], ['Marketing', 18], ['Truyền thông', 11], ['Giáo dục', 7], ['Khác', 5]], { max: 58, labelW: 140 })) +
    card('Yêu cầu xem bài theo trạng thái', hbars([['Đã duyệt', 214], ['Hết hạn', 131], ['Chờ duyệt', 14], ['Từ chối', 29], ['Thu hồi', 3]], { max: 214, labelW: 90 }) + `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding-top:6px;border-top:1px solid #EFEDE6">${[['Tỉ lệ duyệt', '88%'], ['Xử lý TB', '19 giờ'], ['Còn hiệu lực', '37']].map(([k, v]) => `<div><div class="muted" style="font-size:12px">${k}</div><div style="font-size:20px;font-weight:700">${v}</div></div>`).join('')}</div>`) +
    card('DN đăng ký mới theo tháng', vbars([['T4', 6], ['T5', 9], ['T6', 14], ['T7', 11], ['T8', 17], ['T9', 22]], { max: 24, h: 170 }) + '<span class="muted" style="font-size:12px">Tháng 9: 22 doanh nghiệp mới</span>'), 20)}
${grid('repeat(3,minmax(0,1fr))', card('Lượt tìm kiếm theo tuần', vbars([['T1', 640], ['T2', 710], ['T3', 820], ['T4', 1180], ['T5', 950], ['T6', 1020], ['T7', 1310]], { max: 1400, h: 160, fmt: v => v.toLocaleString('vi-VN') })) +
    card('Tiêu chí tìm nhiều nhất', hbars([['Khoảng GPA', 72], ['Ngành', 64], ['Chủ đề đề tài', 51], ['Khóa', 38], ['Kỹ năng', 22], ['MSSV', 9]], { max: 72, labelW: 110, fmt: v => v + '%' }) + '<span class="muted" style="font-size:12px">% lượt tìm có dùng tiêu chí</span>') +
    card('Chủ đề DN quan tâm nhất', hbars([['UI Mobile App', 488], ['Thương mại điện tử', 402], ['Fintech', 233], ['AI / Machine Learning', 190], ['Game', 84]], { max: 488, labelW: 140 })), 20)}
${grid('minmax(0,1fr) minmax(0,1fr)', card('Sinh viên được quan tâm nhiều nhất', `<table><thead><tr><th>Sinh viên</th><th>Ngành · Khóa</th><th>GPA</th><th>Yêu cầu</th><th>Xem hồ sơ</th></tr></thead><tbody>
${[['Đặng Quốc Bảo', 'TKĐH · K67', '3.86', 9, 41], ['Lương Thế Anh', 'KTPM · K66', '3.79', 7, 36], ['Lý Gia Huy', 'TKĐH · K66', '3.38', 6, 28], ['Nguyễn Thu Hà', 'TKĐH · K67', '3.42', 4, 19]].map(([n, k, g, r, v]) => `<tr><td style="font-weight:600">${n}</td><td style="font-size:13px">${k}</td><td class="mono">${g}</td><td class="mono">${r}</td><td class="mono">${v}</td></tr>`).join('')}</tbody></table>`, '', false) +
    card('Xếp hạng doanh nghiệp hoạt động', `<table><thead><tr><th>Doanh nghiệp</th><th>Tìm kiếm</th><th>Yêu cầu</th><th>Bài đã xem</th><th></th></tr></thead><tbody>
${[['NextGen Solutions', 1204, 48, 12, 1], ['Công ty CP Sao Việt', 322, 8, 31, 0], ['Studio Mây Xanh', 188, 5, 27, 0], ['Hoàng Long Media', 140, 6, 9, 0]].map(([n, s, r, v, w]) => `<tr><td style="font-weight:600">${n}</td><td class="mono">${s.toLocaleString('vi-VN')}</td><td class="mono">${r}</td><td class="mono">${v}</td><td>${w ? `<span class="badge b-red">${ic('alert', 12)}Bất thường</span>` : ''}</td></tr>`).join('')}</tbody></table>`, '', false), 20)}`
});

S('AD', 'Admin_Tags.dc.html', 'Chuẩn hóa từ khóa đề tài (FR-02.5a)', 1440, 960, {
  page: 'admin', crumbs: 'Quản trị / Từ khóa đề tài', title: 'Từ khóa đề tài', sub: 'Gộp các từ khóa trùng nghĩa để tìm kiếm và thống kê chính xác', bell: 6,
  body: grid('minmax(0,1fr) 400px', `<section class="card" style="overflow:hidden">
<div style="padding:14px 16px;display:flex;gap:10px;align-items:center;border-bottom:1px solid #EFEDE6">${inp('thương mại', 'Tìm từ khóa…')}<select class="inp" style="width:200px"><option>Sắp xếp: số đề tài</option></select></div>
<table><thead><tr><th style="width:40px"></th><th>Từ khóa</th><th>Dạng chuẩn hóa</th><th>Số đề tài</th><th>Trạng thái</th></tr></thead><tbody>
${[['Thương mại điện tử', 'thuong mai dien tu', 356, 'Gốc', 'green', 1], ['TMĐT', 'tmdt', 48, 'Chưa gộp', 'amber', 1], ['E-commerce', 'e-commerce', 41, 'Chưa gộp', 'amber', 1], ['thương mại đt', 'thuong mai dt', 6, 'Chưa gộp', 'amber', 0], ['Thương mại xã hội', 'thuong mai xa hoi', 12, 'Khác nghĩa', 'gray', 0], ['thuongmai123', 'thuongmai123', 1, 'Đã ẩn', 'red', 0]].map(([t, n, c, s, col, sel]) => `<tr style="${sel ? 'background:#FFF7F7' : ''}"><td><input type="checkbox" ${sel ? 'defaultChecked="{{true}}"' : ''} aria-label="Chọn ${t}"></td><td style="font-weight:600">${t}</td><td class="mono muted" style="font-size:12px">${n}</td><td class="mono">${c}</td><td>${badge(s, col)}</td></tr>`).join('')}
</tbody></table></section>`, `<div style="display:flex;flex-direction:column;gap:20px">
${card('Gộp 3 từ khóa', `<div style="display:flex;flex-wrap:wrap;gap:6px">${['Thương mại điện tử', 'TMĐT', 'E-commerce'].map(t => `<span class="chip">${t}</span>`).join('')}</div>
<div style="display:flex;justify-content:center;color:#8A8E97">${ic('merge', 22)}</div>
${field('Gộp vào từ khóa', `<select class="inp"><option>Thương mại điện tử (356)</option></select>`)}
<div style="padding:12px;border-radius:8px;background:#F7F6F2;font-size:13px;line-height:1.55;color:#4A4E57">445 đề tài sẽ dùng chung từ khóa “Thương mại điện tử”. Khi SV gõ “TMĐT” hoặc “E-commerce”, ô nhập sẽ gợi ý từ khóa gốc.</div>
<button class="btn btn-p">${ic('merge', 16)}Gộp từ khóa</button>`)}
${card('Từ khóa mới cần xem xét', [['UX writing', 3], ['app đặt lịch', 5], ['Machine learning', 14]].map(([t, c]) => `<div style="display:flex;gap:10px;align-items:center"><span style="flex:1;font-size:14px">${t} <span class="muted" style="font-size:12px">· ${c} đề tài</span></span><button class="btn btn-sm">Gộp…</button><button class="btn btn-sm btn-g">Ẩn</button></div>`).join(''))}
</div>`, 20)
});

S('AD', 'Admin_AuditLog.dc.html', 'Nhật ký hệ thống (M17)', 1440, 960, {
  page: 'admin', crumbs: 'Quản trị / Nhật ký hệ thống', title: 'Nhật ký hệ thống', bell: 6,
  actions: `<button class="btn">${ic('download', 16)}Xuất CSV</button>`,
  body: `<div class="card" style="padding:16px 20px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:14px;align-items:end">${field('Người dùng', inp('', 'Tên đăng nhập / MSSV'))}${field('Loại thao tác', '<select class="inp"><option>Tất cả</option><option>Sửa điểm</option><option>Duyệt quyền DN</option><option>DN xem bài</option></select>')}${field('Từ ngày', inp('23/09/2026'))}${field('Đến ngày', inp('30/09/2026'))}<button class="btn btn-p" style="height:42px">${ic('filter', 16)}Lọc</button></div>
<section class="card" style="overflow:hidden"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Thao tác</th><th>Đối tượng</th><th>Thay đổi</th><th>IP</th></tr></thead><tbody>
${[['30/09 10:14:22', 'studio.mayxanh', 'DN', 'DN xem bài', 'blue', 'Bài nộp #8841 · SV 22511203', '—', '113.161.x.x'],
    ['30/09 09:58:03', 'GV0417', 'GV', 'Sửa điểm (sau công bố)', 'red', 'INT3306_01 · SV 22511177 · CK', '6.5 → 7.0', '14.232.x.x'],
    ['30/09 09:40:11', 'admin', 'AD', 'Mở khóa bảng điểm', 'amber', 'INT3306_01', 'Khóa → Mở', '10.0.0.4'],
    ['30/09 08:12:47', 'admin', 'AD', 'Duyệt quyền DN', 'green', 'Yêu cầu #312 · Sao Việt', '21 ngày', '10.0.0.4'],
    ['29/09 22:05:19', '22511203', 'SV', 'Xóa ảnh', 'gray', 'BT2 · Nhóm 01 · 2 tệp', '12 → 10 ảnh', '42.114.x.x'],
    ['29/09 14:32:08', '22511198', 'SV', 'Nộp bài', 'blue', 'BT2 · Nhóm 01', 'Bản mới (12 ảnh)', '42.118.x.x'],
    ['29/09 11:20:55', 'system', 'HT', 'Đổi SĐT phụ huynh', 'amber', 'SV 22511245 · PH 0978…', 'Gỡ liên kết cũ, tạo TK mới', '—'],
    ['29/09 00:00:01', 'system', 'HT', 'Thu hồi quyền hết hạn', 'gray', '4 yêu cầu', 'DUYET → HET_HAN', '—'],
    ['28/09 19:02:36', '21511044', 'SV', 'Đăng nhập thất bại ×5', 'red', 'Khóa 15 phút', '—', '27.72.x.x']].map(([t, u, r, a, c, o, ch, ip]) => `<tr><td class="mono" style="font-size:12px;white-space:nowrap">${t}</td><td><span class="mono" style="font-size:13px">${u}</span> <span class="muted" style="font-size:11px">${r}</span></td><td>${badge(a, c)}</td><td style="font-size:13px">${o}</td><td class="mono" style="font-size:12px">${ch}</td><td class="mono muted" style="font-size:12px">${ip}</td></tr>`).join('')}
</tbody></table></section>`
});

S('AD', 'Admin_Config.dc.html', 'Cấu hình hệ thống (FR-02.7)', 1440, 1000, {
  page: 'admin', crumbs: 'Quản trị / Cấu hình', title: 'Cấu hình hệ thống', bell: 6,
  actions: `<button class="btn">Hoàn tác</button><button class="btn btn-p">Lưu cấu hình</button>`,
  body: grid('repeat(2,minmax(0,1fr))', `<div style="display:flex;flex-direction:column;gap:20px">
${card('Giới hạn tệp nộp bài', `${grid('repeat(3,minmax(0,1fr))', field('Số ảnh tối đa', inp('30')) + field('Mỗi ảnh (MB)', inp('10')) + field('Video (MB)', inp('500')) + field('Mã nguồn (MB)', inp('100')), 14)}
${field('Định dạng ảnh', `<div style="display:flex;gap:6px">${['JPG', 'JPEG', 'PNG', 'WEBP'].map(t => `<span class="chip">${t} ${ic('x', 12)}</span>`).join('')}</div>`)}
${field('Định dạng video', `<div style="display:flex;gap:6px">${['MP4', 'WEBM', 'MOV'].map(t => `<span class="chip">${t} ${ic('x', 12)}</span>`).join('')}</div>`)}
${field('Định dạng mã nguồn', `<div style="display:flex;gap:6px">${['ZIP', 'RAR', '7Z'].map(t => `<span class="chip">${t} ${ic('x', 12)}</span>`).join('')}</div>`)}`)}
${card('Google Drive', `${field('Tài khoản dịch vụ', `<div style="display:flex;gap:8px"><input class="inp mono" style="font-size:13px" defaultValue="eduportfolio@[project].iam.gserviceaccount.com"><button class="btn" aria-label="Sao chép">${ic('copy', 16)}</button></div>`, `<div class="help" style="color:#14532D;display:flex;gap:6px;align-items:center">${ic('check', 14, 2.2)}Kết nối Drive API hoạt động · khóa được mã hóa</div>`)}
<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:14px;font-weight:600">Cho phép GV liên kết Google (OAuth)</div><div class="muted" style="font-size:13px">Thay cho chia sẻ thư mục thủ công</div></div><span class="sw" role="switch" aria-checked="true"></span></div>
${field('Cảnh báo GV khi dung lượng Drive còn dưới', inp('10%'))}`)}
</div>
<div style="display:flex;flex-direction:column;gap:20px">
${card('Thang điểm & GPA', `<table><thead><tr><th>Điểm chữ</th><th>Thang 10 từ</th><th>Thang 4</th></tr></thead><tbody>${[['A', '8.5', '4.0'], ['B+', '8.0', '3.5'], ['B', '7.0', '3.0'], ['C+', '6.5', '2.5'], ['C', '5.5', '2.0'], ['D+', '5.0', '1.5'], ['D', '4.0', '1.0'], ['F', '0', '0']].map(([a, b, c]) => `<tr><td style="font-weight:700">${a}</td><td style="padding:6px 16px"><input class="inp mono" aria-label="Ngưỡng ${a}" defaultValue="${b}" style="width:80px;height:32px"></td><td style="padding:6px 16px"><input class="inp mono" aria-label="Hệ 4 ${a}" defaultValue="${c}" style="width:80px;height:32px"></td></tr>`).join('')}</tbody></table>
<div class="muted" style="font-size:12px">GPA = Σ(điểm hệ 4 × tín chỉ) / Σ tín chỉ; môn học lại lấy điểm cao nhất.</div>`)}
${card('Bảo mật & thông báo', [['Khóa tài khoản sau số lần sai mật khẩu', '5 lần · 15 phút'], ['Lời mời nhóm tự hủy sau', '72 giờ'], ['Nhắc hạn nộp trước', '24 giờ'], ['Báo DN trước khi quyền xem hết hạn', '2 ngày']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px"><span>${k}</span><input class="inp" defaultValue="${v}" aria-label="${k}" style="width:160px;height:36px"></div>`).join(''))}
</div>`, 24)
});

// ======================================================================
// write files + canvas.json
// ======================================================================
const PAGES = [['chung', 'Chung & Xác thực'], ['sv', 'Sinh viên'], ['gv', 'Giảng viên'], ['ph', 'Phụ huynh'], ['dn', 'Doanh nghiệp'], ['admin', 'Quản trị viên']];
const canvas = { v: 3, createdOnFiles: { v: 1, at: '2026-09-30T16:37:34Z' }, title: 'EduPortfolio UI', launch: { view: 'canvas', page: 'chung' }, pages: PAGES.map(([id, name]) => ({ id, name })), boards: {}, order: [], notes: {}, designSystems: [] };
for (const [pid, pname] of PAGES) {
  const list = boards.filter(b => b.pageId === pid);
  let x = 0, y = 0, rowH = 0, col = 0, maxW = 0;
  for (const b of list) {
    if (col === 3) { x = 0; y += rowH + 120 + 60; rowH = 0; col = 0; }
    canvas.boards[b.file] = { x, y, w: b.w, h: b.h, title: b.title, page: pid, is_interactive: true };
    canvas.order.push(b.file);
    x += b.w + 80; maxW = Math.max(maxW, x - 80); rowH = Math.max(rowH, b.h); col++;
  }
  canvas.notes['t_' + pid] = { x: 0, y: -300, text: pname, kind: 'title1', maxW, page: pid };
  for (const b of list) fs.writeFileSync(path.join(OUT, b.file), page({ title: b.title, w: b.w, h: b.h, inner: b.inner, logic: b.logic }));
}
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 1));
console.log(boards.length, 'boards;', Object.keys(canvas.boards).join(','));
