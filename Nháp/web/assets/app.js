/* Khung giao diện dùng chung: sidebar, header, icon, modal, toast, bảng phân trang. */
(function () {
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
    book: '<path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h11"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
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
    down: '<path d="m6 9 6 6 6-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
    building: '<path d="M4 21V4h10v17"/><path d="M14 9h6v12"/><path d="M8 8h2M8 12h2M8 16h2M2 21h20"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="m10 8-4 4 4 4"/><path d="M6 12h10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    max: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h8V3M8 21v-7h8v7"/>',
  };
  const ic = (n, s = 18, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  const badge = (t, c = 'gray', dot) => `<span class="badge b-${c}">${dot ? '<span class="dot"></span>' : ''}${esc(t)}</span>`;
  const initials = (name) => { const p = String(name).replace(/^(PGS\.TS\.|TS\.|ThS\.)\s*/, '').trim().split(/\s+/); return ((p[p.length - 2] || '')[0] || '') + ((p[p.length - 1] || '')[0] || ''); };
  const fmtDate = (s) => { if (!s) return ''; const [d, t] = s.split(' '); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}${t ? ' ' + t.slice(0, 5) : ''}`; };
  const db = () => window.Store.db;

  // ---------- điều hướng ----------
  const NAV = {
    admin: {
      label: 'Quản trị viên',
      items: [
        ['giang-vien', 'Tài khoản giảng viên', 'users'],
        ['sinh-vien', 'Tài khoản sinh viên', 'cap'],
        ['phu-huynh', 'Tài khoản phụ huynh', 'user'],
        ['doanh-nghiep', 'Duyệt tài khoản doanh nghiệp', 'building', null, () => db().dn.filter((d) => d.trangThai === 'CHO').length],
        ['danh-muc', 'Quản lý danh mục', 'tag'],
        ['hoc-ky-mon-hoc', 'Học kỳ & môn học', 'book'],
        ['lop-hoc-phan', 'Lớp học phần', 'calendar'],
        ['nhat-ky', 'Nhật ký hệ thống', 'log'],
        ['cau-hinh', 'Cấu hình hệ thống', 'settings'],
      ],
    },
    ph: {
      label: 'Phụ huynh',
      items: [
        ['ket-qua', 'Điểm, GPA & CPA', 'chart'],
        ['bai-nop', 'Bài nộp của con', 'file'],
        ['thong-bao', 'Thông báo & cảnh báo', 'bell', null, () => App.phUnread()],
        ['doi-mat-khau', 'Đổi mật khẩu', 'key'],
      ],
    },
  };

  const App = {
    ic, esc, norm, badge, initials, fmtDate, I,

    // ---------- phiên phụ huynh ----------
    phSession() {
      const s = db().session;
      if (!s.phId) s.phId = 'P1';
      const ph = db().ph.find((p) => p.id === s.phId) || db().ph[0];
      const kids = ph.links.map((l) => ({ ...db().sv.find((x) => x.id === l.svId), qh: l.qh })).filter((k) => k.id);
      if (!s.childId || !kids.some((k) => k.id === s.childId)) s.childId = kids[0] && kids[0].id;
      const child = kids.find((k) => k.id === s.childId);
      return { ph, kids, child };
    },
    phUnread() { const { child } = App.phSession(); return db().thongBao.filter((t) => t.svId === child.id && !t.read).length; },
    // GPA học kỳ & CPA tích lũy (BR-DI-04): Σ(hệ 4 × tín chỉ) / Σ tín chỉ; môn học lại lấy điểm cao nhất (hoặc lần gần nhất theo cấu hình)
    gpa(svId) {
      const hks = db().diem[svId] || [], r2 = (x) => Math.round(x * 100) / 100;
      const best = {};
      const perHk = hks.map((h) => {
        const done = h.mon.filter((m) => m.he4 != null);
        const tc = done.reduce((a, m) => a + m.tc, 0);
        done.forEach((m) => { const b = best[m.monId]; if (!b || (db().config.hocLai === 'GAN_NHAT' ? true : m.he4 > b.he4)) best[m.monId] = m; });
        const vals = Object.values(best), tcAll = vals.reduce((a, m) => a + m.tc, 0);
        const hkInfo = db().hocKy.find((x) => x.id === h.hk) || {};
        return { hk: h.hk, label: `HK${hkInfo.ky} ${String(hkInfo.namHoc || '').replace(/20(\d\d)/g, '$1')}`, full: `Học kỳ ${hkInfo.ky} · ${hkInfo.namHoc}`, dangHoc: !!h.dangHoc, mon: h.mon,
          gpa: tc ? r2(done.reduce((a, m) => a + m.he4 * m.tc, 0) / tc) : null, tc, cpa: tcAll ? r2(vals.reduce((a, m) => a + m.he4 * m.tc, 0) / tcAll) : null, tcTichLuy: vals.filter((m) => m.he4 > 0).reduce((a, m) => a + m.tc, 0) };
      });
      const last = [...perHk].reverse().find((h) => h.cpa != null);
      return { perHk, cpa: last ? last.cpa : null, tcTichLuy: last ? last.tcTichLuy : 0 };
    },
    xepLoai(cpa) { return cpa == null ? '—' : cpa >= 3.6 ? 'Xuất sắc' : cpa >= 3.2 ? 'Giỏi' : cpa >= 2.5 ? 'Khá' : cpa >= 2.0 ? 'Trung bình' : 'Yếu'; },
    lopOf(sv) { const l = db().lopSH.find((x) => x.id === sv.lopId) || {}; const n = db().nganh.find((x) => x.id === l.nganhId) || {}; const k = db().khoaHoc.find((x) => x.id === l.khoaHocId) || {}; return { lop: l.ma || '', nganh: n.ten || '', khoa: k.ten || '' }; },

    // ---------- khung trang ----------
    shell() {
      const b = document.body, role = b.dataset.role, active = b.dataset.active;
      if (!role) return;
      const R = NAV[role];
      const page = document.getElementById('page');
      let user, extra = '';
      if (role === 'admin') user = ['AD', 'admin', 'Quản trị hệ thống'];
      else {
        const { ph, child, kids } = App.phSession();
        user = ['PH', ph.sdt, ph.ten || 'Phụ huynh'];
        const info = App.lopOf(child);
        extra = `<div style="padding:14px;border-radius:12px;border:1px solid var(--line);display:flex;flex-direction:column;gap:10px">
          <div class="side-lbl" style="padding:0">Đang xem</div>
          <div class="cell-user"><span class="av">${esc(initials(child.hoTen))}</span><div><b>${esc(child.hoTen)}</b><span class="mono">${child.mssv}</span></div></div>
          ${kids.length > 1 ? `<a class="btn btn-sm" href="chon-con.html">${ic('swap', 15)} Chọn con khác</a>` : ''}
        </div>`;
      }
      const nav = R.items.map(([f, l, i, parent, cnt]) => {
        const on = f === active ? 'on' : '';
        const n = cnt ? cnt() : 0;
        if (!i) return `<a href="${f}.html" class="sub ${on}">${esc(l)}</a>`;
        return `<a href="${f}.html" class="${on}">${ic(i, 18)}<span style="flex:1">${esc(l)}</span>${n ? `<span class="badge b-red" style="height:20px;padding:0 7px">${n}</span>` : ''}</a>`;
      }).join('');
      const crumbs = b.dataset.crumbs || '';
      const bellN = role === 'ph' ? App.phUnread() : db().dn.filter((d) => d.trangThai === 'CHO').length;
      const bellHref = role === 'ph' ? 'thong-bao.html' : 'doanh-nghiep.html';
      const wrap = document.createElement('div');
      wrap.className = 'app';
      wrap.innerHTML = `
<aside class="side" aria-label="Thanh điều hướng">
  <a class="logo" href="../index.html"><span class="logo-mark">${ic('book', 18, 2)}</span><b>EduPortfolio</b></a>
  ${extra}
  <div class="side-lbl">${R.label}</div>
  <nav class="nav" aria-label="Điều hướng chính">${nav}</nav>
  <div class="me"><span class="av av-red">${user[0]}</span><div class="me-txt"><b>${esc(user[1])}</b><span>${esc(user[2])}</span></div>
    <a href="${role === 'ph' ? 'dang-nhap.html' : '../index.html'}" aria-label="Đăng xuất" title="Đăng xuất" style="color:var(--mut)" data-logout>${ic('logout', 18)}</a></div>
</aside>
<div class="scrim" data-close-menu></div>
<div class="main">
  <header class="top">
    <button class="btn btn-g btn-ic menu-btn" aria-label="Mở menu" data-menu>${ic('menu', 20)}</button>
    <div class="crumbs">${crumbs}</div>
    <a class="btn btn-g btn-ic" href="${bellHref}" aria-label="Thông báo, ${bellN} mục cần xử lý" style="position:relative">${ic('bell', 20)}${bellN ? `<span style="position:absolute;top:2px;right:2px;min-width:18px;height:18px;border-radius:9px;background:#C2410C;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px">${bellN}</span>` : ''}</a>
    <span class="av">${user[0]}</span>
  </header>
  <div class="content"></div>
</div>`;
      wrap.querySelector('.content').appendChild(page);
      b.prepend(wrap);
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('[data-menu]')) wrap.classList.add('open');
        if (e.target.closest('[data-close-menu]')) wrap.classList.remove('open');
        if (e.target.closest('[data-logout]') && role === 'ph') { db().session = {}; window.Store.save(); }
      });
    },

    // ---------- toast ----------
    toast(msg, type = 'ok') {
      let box = document.querySelector('.toasts');
      if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.innerHTML = ic(type === 'ok' ? 'check' : type === 'bad' ? 'alert' : 'info', 18, 2.2) + `<span>${esc(msg)}</span>`;
      box.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    },

    // ---------- modal ----------
    modal({ title, body, foot, size, onMount, drawer }) {
      const bg = document.createElement('div');
      const prev = document.activeElement;
      if (drawer) {
        bg.innerHTML = `<div class="drawer-bg" data-x></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-h"><h3>${esc(title)}</h3><button class="btn btn-g btn-ic" data-x aria-label="Đóng">${ic('x', 20)}</button></div>
          <div class="modal-b" style="flex:1">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</aside>`;
      } else {
        bg.className = 'modal-bg';
        bg.innerHTML = `<div class="modal ${size || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-h"><h3>${esc(title)}</h3><button class="btn btn-g btn-ic" data-x aria-label="Đóng">${ic('x', 20)}</button></div>
          <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
      }
      document.body.appendChild(bg);
      const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
      bg.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) close(); });
      const first = bg.querySelector('.modal-b input:not([type=hidden]), .modal-b select, .modal-b textarea') || bg.querySelector('[data-x]');
      setTimeout(() => first && first.focus(), 30);
      const m = { el: bg, close, $: (s) => bg.querySelector(s), $$: (s) => [...bg.querySelectorAll(s)] };
      onMount && onMount(m);
      return m;
    },

    confirm({ title, msg, ok = 'Xác nhận', danger, reason }) {
      return new Promise((resolve) => {
        const m = App.modal({
          title,
          body: `<p style="line-height:1.6">${msg}</p>${reason ? `<div><label class="lbl" for="cf-reason">${esc(reason)} <span class="req">*</span></label><textarea id="cf-reason" class="inp" rows="3" placeholder="Nhập lý do…"></textarea><div class="err hidden" id="cf-err">Vui lòng nhập lý do.</div></div>` : ''}`,
          foot: `<button class="btn" data-x>Hủy</button><button class="btn ${danger ? 'btn-d' : 'btn-p'}" data-ok>${esc(ok)}</button>`,
        });
        m.$('[data-ok]').onclick = () => {
          let r = true;
          if (reason) { r = m.$('#cf-reason').value.trim(); if (!r) { m.$('#cf-err').classList.remove('hidden'); m.$('#cf-reason').classList.add('bad'); return; } }
          m.close(); resolve(r);
        };
        m.$$('[data-x]').forEach((b) => b.addEventListener('click', () => resolve(false)));
      });
    },

    // ---------- bảng có phân trang ----------
    table(mount, { columns, pageSize = 10, empty = 'Không có dữ liệu phù hợp.', rowAttr }) {
      let rows = [], page = 1;
      const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
      function render() {
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        page = Math.min(page, pages);
        const slice = rows.slice((page - 1) * pageSize, page * pageSize);
        const head = columns.map((c) => `<th class="${c.cls || ''}" ${c.w ? `style="width:${c.w}"` : ''}>${c.h}</th>`).join('');
        const body = slice.length ? slice.map((r) => `<tr ${rowAttr ? rowAttr(r) : ''}>${columns.map((c) => `<td class="${c.cls || ''}">${c.r(r)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${columns.length}" class="empty">${esc(empty)}</td></tr>`;
        const from = rows.length ? (page - 1) * pageSize + 1 : 0, to = Math.min(page * pageSize, rows.length);
        let btns = '', gap = false;
        for (let p = 1; p <= pages; p++) {
          if (p === 1 || p === pages || Math.abs(p - page) <= 1) { btns += `<button data-p="${p}" class="${p === page ? 'on' : ''}" aria-label="Trang ${p}">${p}</button>`; gap = false; }
          else if (!gap) { btns += '<span style="padding:0 4px;align-self:center">…</span>'; gap = true; }
        }
        el.innerHTML = `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
          ${rows.length > pageSize ? `<div class="pager"><span>Hiển thị ${from}–${to} / ${rows.length}</span><div class="pg"><button data-p="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>${btns}<button data-p="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Trang sau">›</button></div></div>` : `<div class="pager"><span>${rows.length} bản ghi</span></div>`}`;
      }
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) { page = +b.dataset.p; render(); } });
      return { set(r, keepPage) { rows = r; if (!keepPage) page = 1; render(); }, render };
    },

    // đọc form thành object
    form(el) { const o = {}; new FormData(el).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; },
    // gắn lỗi cho trường
    fieldErr(el, name, msg) {
      const inp = el.querySelector(`[name="${name}"]`); if (!inp) return;
      inp.classList.toggle('bad', !!msg);
      let e = inp.parentElement.querySelector('.err');
      if (msg) { if (!e) { e = document.createElement('div'); e.className = 'err'; inp.parentElement.appendChild(e); } e.textContent = msg; }
      else if (e) e.remove();
    },
    phoneOk: (s) => /^0(3|5|7|8|9)\d{8}$/.test(s),
    emailOk: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
    save() { window.Store.save(); },
    tempPw() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)]; return s; },
  };

  // nút gạt (switch) dùng chung
  document.addEventListener('click', (e) => {
    const s = e.target.closest('.sw');
    if (s && !s.disabled) { s.setAttribute('aria-checked', s.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); s.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => { App.shell(); document.dispatchEvent(new Event('app:ready')); });
})();
