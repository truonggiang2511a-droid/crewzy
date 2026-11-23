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
  function slotHtml(sl, m) {
    var chips = sl.da_noi.map(function (a) { return '<a class="mz-app on" href="' + esc(a.href) + '" title="' + esc(a.name) + ' đã nối">' + logo(a) + '<span>' + esc(a.name) + '</span><i>✓</i></a>'; });
    chips = chips.concat(sl.goi_y.map(function (a) { return '<a class="mz-app" href="' + esc(back(a.href, m)) + '" title="Nối ' + esc(a.name) + '">' + logo(a) + '<span>' + esc(a.name) + '</span><i>+</i></a>'; }));
    chips = chips.concat((sl.web || []).map(function (w) { return '<a class="mz-app web" href="' + esc(w.url) + '" target="_blank" rel="noopener" title="' + esc(w.name) + ' chưa có cổng kết nối: mở web để tự chỉnh"><b class="mz-ini" style="background:' + esc(w.bg) + ';color:#fff;display:grid;place-items:center;font-size:11px">' + esc(w.letter) + '</b><span>' + esc(w.name) + '</span><i>↗</i></a>'; }));
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
        '<a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent(runPrompt(m)) + '">▶ Chạy ngay</a>' +
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
    box.innerHTML = head + warn + (msg ? '<p class="mz-msg">' + msg + '</p>' : '') + '<div class="mz-grid">' + list.map(card).join('') + '</div>';
  }

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

  box.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]');
    if (o) { open = open === o.getAttribute('data-open') ? '' : o.getAttribute('data-open'); return render(); }
    var t = e.target.closest('[data-nv]');
    if (t) return post({ action: t.getAttribute('data-on') ? 'tat' : 'bat', nv: t.getAttribute('data-nv') }, t.getAttribute('data-nv'));
    if (e.target.closest('[data-nv-all]')) return post({ action: 'bat', nv: 'all' }, 'all');
    if (e.target.closest('[data-nv-off]')) return post({ action: 'tat' }, 'all');
  });
  document.addEventListener('crewzy:autopilot-changed', load);
  load();
})();
