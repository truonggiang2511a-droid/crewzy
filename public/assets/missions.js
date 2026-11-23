// 6 NHIỆM VỤ HẰNG NGÀY (Trung tâm điều hành + trang Quy trình): đọc GET /api/autopilot (nhiem_vu), vẽ thẻ vào [data-missions].
// Mỗi thẻ: 2–3 ô app (đã nối sáng ✓, chưa nối = nút + nối), giờ chạy, ▶ Chạy ngay (Trợ lý làm luôn), công tắc Tự chạy hằng ngày (POST nv).
(function () {
  var box = document.querySelector('[data-missions]');
  if (!box) return;
  var data = null, busy = '', open = '';
  var NGAY = { hang_ngay: 'hằng ngày', t2_t6: 'thứ 2–6', t2: 'thứ Hai', cn: 'Chủ nhật', ngay_1: 'ngày 1 hằng tháng' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uidQ = function () { var u = window.vpaiUid ? window.vpaiUid() : ''; return u ? 'uid=' + encodeURIComponent(u) : ''; };
  var logo = function (a) { return a.mcp ? '<b class="mz-ini">' + esc(a.name.charAt(0)) + '</b>' : '<img src="https://logos.composio.dev/api/' + esc(a.slug) + '" alt="" loading="lazy">'; };

  function when(l) { return l.lap === 'moi_gio' ? 'mỗi giờ ' + l.gio + '–' + l.den : l.gio + ' ' + (NGAY[l.ngay] || ''); }
  function runPrompt(m) {
    return 'Chạy nhiệm vụ "' + m.ten + '" ngay bây giờ: lần lượt làm các quy trình ' + m.lich.map(function (l) { return '"' + l.ten + '" (mã ' + l.id + ')'; }).join(', ') +
      '. Với mỗi quy trình gọi CREWZY_QUY_TRINH với id để lấy đúng bước, đọc Brain trước, làm ra kết quả thật và nộp vào Việc chờ duyệt (kèm quy_trinh). Bỏ qua quy trình thiếu app và nói tôi cần nối gì.';
  }

  // Nối xong quay về đúng nhiệm vụ này (ket-noi.html đọc tro_ve).
  function back(href, m) { return href.indexOf('ket-noi.html') === 0 ? href + (href.indexOf('?') > 0 ? '&' : '?') + 'tro_ve=' + encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + '#nv-' + m.id) : href; }
  // ----- Hộp thoại chọn app trước khi chạy (trắc nghiệm) -----
  var dlg = null; // { id, mode: 'chay'|'tu_chay', sel: { s0:[], s1:[], bao_cao:[] } }
  function optsOf(sl) { var o = sl.da_noi.map(function (a) { return { v: a.slug, n: a.name }; }); if (sl.san_co) o.push({ v: 'crewzy', n: 'Công cụ có sẵn của Crewzy' }); return o; }
  function openDlg(m, mode) {
    var sel = {}, saved = m.chon || {};
    m.slots.forEach(function (sl, i) { var o = optsOf(sl), s = (saved['s' + i] || []).filter(function (v) { return o.some(function (x) { return x.v === v; }); }); sel['s' + i] = s.length ? s : (sl.nhieu ? o.filter(function (x) { return x.v !== 'crewzy'; }).map(function (x) { return x.v; }).concat(o.length && !o.some(function (x) { return x.v !== 'crewzy'; }) ? ['crewzy'] : []) : o.slice(0, 1).map(function (x) { return x.v; })); });
    sel.bao_cao = (saved.bao_cao && saved.bao_cao.length) ? saved.bao_cao : ['crewzy'];
    dlg = { id: m.id, mode: mode, sel: sel }; render();
  }
  function dlgHtml(m) {
    var q = m.slots.map(function (sl, i) {
      var o = optsOf(sl), key = 's' + i;
      if (!o.length) return '<fieldset class="mz-q"><legend>' + esc(sl.vai) + '</legend><p class="muted">Chưa nối app nào. <a href="' + esc(back('ket-noi.html?cat=' + (sl.cat || m.cat), m)) + '">+ Nối app</a></p></fieldset>';
      var type = sl.nhieu ? 'checkbox' : 'radio';
      return '<fieldset class="mz-q"><legend>' + esc(sl.vai) + (sl.nhieu ? ' <small>(chọn nhiều)</small>' : '') + '</legend>' + o.map(function (x) {
        var on = (dlg.sel[key] || []).indexOf(x.v) >= 0;
        return '<label class="mz-opt"><input type="' + type + '" name="' + key + '" data-q="' + key + '" value="' + esc(x.v) + '"' + (on ? ' checked' : '') + '> ' + esc(x.n) + '</label>';
      }).join('') + '<a class="mz-more" href="' + esc(back('ket-noi.html?cat=' + (sl.cat || m.cat), m)) + '">+ Thêm app của bạn</a></fieldset>';
    }).join('');
    var rep = (data.bao_cao_ung_vien || []).map(function (x) { return { v: x.slug, n: x.name }; }); rep.unshift({ v: 'crewzy', n: 'Chỉ trong Crewzy (Việc chờ duyệt, Kết quả)' });
    var r = '<fieldset class="mz-q"><legend>Báo cáo kết quả gửi về đâu? <small>(chọn nhiều)</small></legend>' + rep.map(function (x) {
      return '<label class="mz-opt"><input type="checkbox" data-q="bao_cao" value="' + esc(x.v) + '"' + ((dlg.sel.bao_cao || []).indexOf(x.v) >= 0 ? ' checked' : '') + '> ' + esc(x.n) + '</label>';
    }).join('') + '<a class="mz-more" href="' + esc(back('ket-noi.html?cat=office', m)) + '">+ Nối Google Sheets, Gmail, Telegram…</a></fieldset>';
    return '<div class="mz-dlg" role="dialog" aria-modal="true"><div class="mz-dlg-box"><h3>' + esc(m.ten) + '</h3><p class="muted">Chọn app AI sẽ dùng và nơi nhận báo cáo, rồi bấm bắt đầu. Lựa chọn được nhớ cho các lần sau.</p>' + q + r +
      '<div class="mz-act"><button type="button" class="btn btn-primary" data-dlg-go>' + (dlg.mode === 'tu_chay' ? '⏰ Lưu và bật tự chạy' : '▶ Bắt đầu chạy') + '</button><button type="button" class="btn btn-ghost" data-dlg-x>Huỷ</button></div></div></div>';
  }
  function prefLine(m, sel) {
    var nm = function (v) { return v === 'crewzy' ? 'công cụ có sẵn của Crewzy' : (function () { var f = null; m.slots.forEach(function (sl) { sl.da_noi.concat(sl.goi_y).forEach(function (a) { if (a.slug === v) f = a.name; }); }); (data.bao_cao_ung_vien || []).forEach(function (a) { if (a.slug === v) f = a.name; }); return f || v; })(); };
    var l = []; m.slots.forEach(function (sl, i) { var s = sel['s' + i] || []; if (s.length) l.push('- ' + sl.vai + ': dùng ' + s.map(nm).join(', ')); });
    if ((sel.bao_cao || []).length) l.push('- Báo cáo kết quả gửi về: ' + sel.bao_cao.map(function (s) { return s === 'crewzy' ? 'chỉ trong Crewzy (Việc chờ duyệt, Kết quả)' : nm(s); }).join(', '));
    return l.length ? '\n\nLỰA CHỌN CỦA KHÁCH (khách đã chọn trong Crewzy, làm ĐÚNG như vậy, không tự đổi app, không hỏi lại):\n' + l.join('\n') : '';
  }
  function slotHtml(sl, m) {
    var chips = sl.da_noi.map(function (a) { return '<a class="mz-app on" href="' + esc(a.href) + '" title="' + esc(a.name) + ' đã nối">' + logo(a) + '<span>' + esc(a.name) + '</span><i>✓</i></a>'; });
    chips = chips.concat(sl.goi_y.map(function (a) { return '<a class="mz-app" href="' + esc(back(a.href, m)) + '" title="Nối ' + esc(a.name) + '">' + logo(a) + '<span>' + esc(a.name) + '</span><i>+</i></a>'; }));
    chips = chips.concat((sl.web || []).map(function (w) { return '<a class="mz-app web" href="' + esc(w.url) + '" target="_blank" rel="noopener" title="' + esc(w.name) + ' chưa có cổng kết nối: mở web để tự chỉnh"><b class="mz-ini" style="background:' + esc(w.bg) + ';color:#fff;display:grid;place-items:center;font-size:11px">' + esc(w.letter) + '</b><span>' + esc(w.name) + '</span><i>↗</i></a>'; }));
    if ((sl.sap_co || []).length) chips.push('<span class="mz-app" style="border-style:solid;color:var(--muted)" title="Chưa nối được ngay"><span>' + esc(sl.sap_co.join(', ')) + ' · sắp có</span></span>');
    if (sl.cat) chips.push('<a class="mz-app plus" href="' + esc(back('ket-noi.html?cat=' + sl.cat, m)) + '" title="Thêm app của bạn, AI sẽ dùng đúng app bạn nối"><span>+ Thêm app của bạn</span></a>');
    var note = !sl.da_noi.length ? (sl.san_co ? '<small class="mz-note ok">' + esc(sl.san_co) + '</small>' : sl.bat_buoc ? '<small class="mz-note need">Cần nối ít nhất 1 app</small>' : '<small class="mz-note">Không bắt buộc</small>') : '';
    return '<div class="mz-slot"><p class="mz-vai">' + esc(sl.vai) + (sl.bat_buoc ? ' <em>bắt buộc</em>' : '') + '</p><div class="mz-apps">' + chips.join('') + '</div>' + note + '</div>';
  }

  // Thẻ GỌN: tên + trạng thái + logo app đã nối/cần nối + giờ chạy kế tiếp + 2 nút. Bấm "Chi tiết" mới mở ô app và lịch.
  function card(m) {
    var st = m.dang_chay ? '<span class="mz-st run">● Đang tự chạy</span>' : m.san_sang ? '<span class="mz-st ok">Sẵn sàng</span>' : '<span class="mz-st need">Cần nối app</span>';
    var on = [], need = 0, total = m.slots.length;
    m.slots.forEach(function (sl) { if (sl.da_noi.length) on = on.concat(sl.da_noi); else if (sl.bat_buoc) need++; });
    var okSlots = m.slots.filter(function (sl) { return sl.da_noi.length || sl.san_co; }).length;
    var cand = []; m.slots.forEach(function (sl) { sl.goi_y.slice(0, 2).forEach(function (a) { cand.push(a); }); });
    var logos = on.slice(0, 5).map(function (a) { return '<span class="mz-mini" title="' + esc(a.name) + '">' + logo(a) + '</span>'; }).join('') + (on.length > 5 ? '<span class="mz-mini more">+' + (on.length - 5) + '</span>' : '') +
      cand.slice(0, Math.max(0, 6 - on.length)).map(function (a) { return '<span class="mz-mini off" title="' + esc(a.name) + ' (chưa nối)">' + logo(a) + '</span>'; }).join('') + '<span class="mz-mini more" title="Bấm Chi tiết để thêm app">+</span>';
    var first = m.lich[0];
    var isOpen = open === m.id, b = busy === m.id;
    var detail = !isOpen ? '' : '<div class="mz-detail"><p class="mz-desc">' + esc(m.mo_ta) + '</p>' +
      m.slots.map(function (sl) { return slotHtml(sl, m); }).join('') +
      '<a class="mz-more" href="' + esc(back('ket-noi.html?cat=' + m.cat, m)) + '">+ Thêm app khác</a>' +
      '<ul class="mz-lich">' + m.lich.map(function (l) { return '<li class="' + (l.dang_chay ? 'on' : '') + '"><b>' + esc(when(l)) + '</b> ' + esc(l.buoc) + '</li>'; }).join('') + '</ul></div>';
    return '<article class="card mz-card' + (m.dang_chay ? ' running' : '') + (isOpen ? ' open' : '') + '" style="--mz:' + esc(m.mau) + '" id="nv-' + esc(m.id) + '">' +
      '<button type="button" class="mz-sum" data-open="' + esc(m.id) + '" aria-expanded="' + isOpen + '">' +
        '<span class="mz-top"><b class="mz-name">' + esc(m.ten) + '</b>' + st + '</span>' +
        '<span class="mz-line"><span class="mz-logos">' + logos + '</span>' +
        '<span class="mz-meta">' + okSlots + '/' + total + ' ô app · ' + esc(first ? when(first) : '') + '</span></span>' +
        (!m.san_sang && m.ly_do ? '<span class="mz-why">' + esc(m.ly_do) + '</span>' : '') +
        '<span class="mz-chev" aria-hidden="true">' + (isOpen ? '▴ Thu gọn' : '▾ Chi tiết') + '</span>' +
      '</button>' + detail +
      '<div class="mz-act">' +
        '<button type="button" class="btn btn-primary" data-run="' + esc(m.id) + '">▶ Chạy ngay</button>' +
        (!m.dang_chay && !m.san_sang ? '<button type="button" class="btn btn-ghost" data-open="' + esc(m.id) + '">+ Nối app</button>' :
        '<button type="button" class="btn btn-ghost" data-nv="' + esc(m.id) + '" data-on="' + (m.dang_chay ? '1' : '') + '"' + (b ? ' disabled' : '') + '>' +
          (b ? 'Đang lưu…' : m.dang_chay ? '⏸ Tắt tự chạy' : '⏰ Tự chạy') + '</button>') +
      '</div></article>';
  }

  function render(msg) {
    if (!data) return;
    var list = data.nhiem_vu || [];
    var running = list.filter(function (m) { return m.dang_chay; }).length;
    var head = '<div class="mz-head"><div><h2>6 nhiệm vụ <span class="hl">hằng ngày</span></h2><p>Mỗi nhiệm vụ chỉ cần 2–3 app. <b>Chạy ngay</b> để AI làm luôn, <b>Tự chạy</b> để AI làm đúng giờ mỗi ngày.</p></div>' +
      '<div class="mz-all">' + (running ? '<span class="label-mono">' + running + '/6 đang tự chạy</span>' : '') +
      '<button type="button" class="btn btn-primary" data-nv-all' + (busy ? ' disabled' : '') + '>' + (busy === 'all' ? 'Đang bật…' : '▶ Run tất cả') + '</button>' +
      (running ? '<button type="button" class="btn btn-ghost" data-nv-off' + (busy ? ' disabled' : '') + '>Tắt hết</button>' : '') + '</div></div>';
    var warn = !data.brand_ok ? '<p class="mz-warn">Điền <a href="thuong-hieu.html">Brain thương hiệu</a> (tên, sản phẩm, khách hàng, giọng văn) trước khi bật tự chạy, để AI làm đúng thương hiệu.</p>' : '';
    if (data.lich_goi === 0) warn += '<p class="mz-warn">Gói hiện tại chưa có tự chạy theo giờ — vẫn bấm Chạy ngay được. <a href="goi.html">Nâng gói</a> để AI tự làm mỗi ngày.</p>';
    box.innerHTML = head + warn + (msg ? '<p class="mz-msg">' + msg + '</p>' : '') + '<div class="mz-grid">' + list.map(card).join('') + '</div>' + (dlg && missionById(dlg.id) ? dlgHtml(missionById(dlg.id)) : '');
  }

  function missionById(id) { return ((data && data.nhiem_vu) || []).filter(function (m) { return m.id === id; })[0]; }

  function load() {
    var q = uidQ();
    fetch('/api/autopilot' + (q ? '?' + q : ''), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.nhiem_vu) { data = j; render(); }
    }).catch(function () { box.innerHTML = '<p class="muted">Chưa tải được nhiệm vụ. Tải lại trang.</p>'; });
  }

  function post(body, key) {
    busy = key; render();
    var u = window.vpaiUid ? window.vpaiUid() : '';
    if (u) body.uid = u;
    fetch('/api/autopilot', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (j) {
        busy = '';
        if (j.nhiem_vu) data.nhiem_vu = j.nhiem_vu;
        var msg = j.error ? '⚠ ' + esc(j.error) : body.action === 'bat' ? '✓ Đã bật. AI sẽ làm đúng giờ, việc cần duyệt về <a href="cho-duyet.html">Việc chờ duyệt</a>.' : '✓ Đã tắt.';
        if (j.loi && j.loi.length) msg += '<br><small>' + j.loi.map(esc).join('<br>') + '</small>';
        if (j.brand) msg += ' <a href="thuong-hieu.html">Mở Brain</a>';
        render(msg);
        document.dispatchEvent(new CustomEvent('crewzy:autopilot'));
      }).catch(function () { busy = ''; render('⚠ Lỗi mạng, thử lại.'); });
  }

  box.addEventListener('change', function (e) {
    var q = e.target.closest('[data-q]');
    if (!q || !dlg) return;
    var k = q.getAttribute('data-q'), v = q.value, cur = dlg.sel[k] || [];
    if (q.type === 'radio') dlg.sel[k] = [v];
    else dlg.sel[k] = q.checked ? cur.concat([v]) : cur.filter(function (x) { return x !== v; });
  });
  box.addEventListener('click', function (e) {
    var run = e.target.closest('[data-run]');
    if (run) { var mm = missionById(run.getAttribute('data-run')); if (mm) openDlg(mm, 'chay'); return; }
    if (e.target.closest('[data-dlg-x]')) { dlg = null; return render(); }
    if (e.target.closest('[data-dlg-go]') && dlg) {
      var m0 = missionById(dlg.id), d0 = dlg, u = window.vpaiUid ? window.vpaiUid() : '';
      fetch('/api/autopilot', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'chon', nv: d0.id, chon: d0.sel, uid: u || undefined }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j.nhiem_vu) data.nhiem_vu = j.nhiem_vu;
          dlg = null;
          if (d0.mode === 'chay') { location.href = 'chat.html?q=' + encodeURIComponent(runPrompt(m0) + prefLine(m0, d0.sel)); return; }
          post({ action: 'bat', nv: d0.id }, d0.id);
        }).catch(function () { render('⚠ Lỗi mạng, thử lại.'); });
      return;
    }
    var o = e.target.closest('[data-open]');
    if (o) { open = open === o.getAttribute('data-open') ? '' : o.getAttribute('data-open'); return render(); }
    var t = e.target.closest('[data-nv]');
    if (t) { if (!t.getAttribute('data-on')) { var m1 = missionById(t.getAttribute('data-nv')); if (m1) return openDlg(m1, 'tu_chay'); } return post({ action: t.getAttribute('data-on') ? 'tat' : 'bat', nv: t.getAttribute('data-nv') }, t.getAttribute('data-nv')); }
    if (e.target.closest('[data-nv-all]')) return post({ action: 'bat', nv: 'all' }, 'all');
    if (e.target.closest('[data-nv-off]')) return post({ action: 'tat' }, 'all');
  });
  document.addEventListener('crewzy:autopilot-changed', load);
  load();
})();
