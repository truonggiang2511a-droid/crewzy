// 6 NHIỆM VỤ HẰNG NGÀY (Trung tâm điều hành + trang Quy trình): đọc GET /api/autopilot (nhiem_vu), vẽ thẻ vào [data-missions].
// Mỗi thẻ: 2–3 ô app (đã nối sáng ✓, chưa nối = nút + nối), giờ chạy, ▶ Chạy ngay (Trợ lý làm luôn), công tắc Tự chạy hằng ngày (POST nv).
(function () {
  var box = document.querySelector('[data-missions]');
  if (!box) return;
  var data = null, busy = '';
  var NGAY = { hang_ngay: 'hằng ngày', t2_t6: 'thứ 2–6', t2: 'thứ Hai', cn: 'Chủ nhật', ngay_1: 'ngày 1 hằng tháng' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uidQ = function () { var u = window.vpaiUid ? window.vpaiUid() : ''; return u ? 'uid=' + encodeURIComponent(u) : ''; };
  var logo = function (a) { return a.mcp ? '<b class="mz-ini">' + esc(a.name.charAt(0)) + '</b>' : '<img src="https://logos.composio.dev/api/' + esc(a.slug) + '" alt="" loading="lazy">'; };

  function when(l) { return l.lap === 'moi_gio' ? 'mỗi giờ ' + l.gio + '–' + l.den : l.gio + ' ' + (NGAY[l.ngay] || ''); }
  function runPrompt(m) {
    return 'Chạy nhiệm vụ "' + m.ten + '" ngay bây giờ: lần lượt làm các quy trình ' + m.lich.map(function (l) { return '"' + l.ten + '" (mã ' + l.id + ')'; }).join(', ') +
      '. Với mỗi quy trình gọi CREWZY_QUY_TRINH với id để lấy đúng bước, đọc Brain trước, làm ra kết quả thật và nộp vào Việc chờ duyệt (kèm quy_trinh). Bỏ qua quy trình thiếu app và nói tôi cần nối gì.';
  }

  function slotHtml(sl, m) {
    var chips = sl.da_noi.map(function (a) { return '<a class="mz-app on" href="' + esc(a.href) + '" title="' + esc(a.name) + ' đã nối">' + logo(a) + '<span>' + esc(a.name) + '</span><i>✓</i></a>'; });
    if (!sl.da_noi.length || sl.nhieu) chips = chips.concat(sl.goi_y.slice(0, sl.da_noi.length ? 2 : 3).map(function (a) { return '<a class="mz-app" href="' + esc(a.href) + '" title="Nối ' + esc(a.name) + '">' + logo(a) + '<span>' + esc(a.name) + '</span><i>+</i></a>'; }));
    var note = !sl.da_noi.length ? (sl.san_co ? '<small class="mz-note ok">' + esc(sl.san_co) + '</small>' : sl.bat_buoc ? '<small class="mz-note need">Cần nối ít nhất 1 app</small>' : '<small class="mz-note">Không bắt buộc</small>') : '';
    return '<div class="mz-slot"><p class="mz-vai">' + esc(sl.vai) + (sl.bat_buoc ? ' <em>bắt buộc</em>' : '') + '</p><div class="mz-apps">' + chips.join('') + '</div>' + note + '</div>';
  }

  function card(m) {
    var st = m.dang_chay ? '<span class="mz-st run">● Đang tự chạy</span>' : m.san_sang ? '<span class="mz-st ok">Sẵn sàng</span>' : '<span class="mz-st need">' + esc(m.ly_do || 'Chưa đủ app') + '</span>';
    var lich = m.lich.map(function (l) { return '<li class="' + (l.dang_chay ? 'on' : '') + '"><b>' + esc(when(l)) + '</b> ' + esc(l.buoc) + '</li>'; }).join('');
    var b = busy === m.id;
    return '<article class="card mz-card' + (m.dang_chay ? ' running' : '') + '" style="--mz:' + esc(m.mau) + '" id="nv-' + esc(m.id) + '">' +
      '<div class="mz-top"><h3>' + esc(m.ten) + '</h3>' + st + '</div>' +
      '<p class="mz-desc">' + esc(m.mo_ta) + '</p>' +
      m.slots.map(function (sl) { return slotHtml(sl, m); }).join('') +
      '<a class="mz-more" href="ket-noi.html?cat=' + esc(m.cat) + '">+ Thêm app khác</a>' +
      '<ul class="mz-lich">' + lich + '</ul>' +
      '<div class="mz-act">' +
        '<a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent(runPrompt(m)) + '">▶ Chạy ngay</a>' +
        '<button type="button" class="btn ' + (m.dang_chay ? 'btn-ghost' : 'btn-ghost') + '" data-nv="' + esc(m.id) + '" data-on="' + (m.dang_chay ? '1' : '') + '"' + (b || (!m.dang_chay && !m.san_sang) ? ' disabled' : '') + '>' +
          (b ? 'Đang lưu…' : m.dang_chay ? '⏸ Tắt tự chạy' : '⏰ Tự chạy hằng ngày') + '</button>' +
      '</div></article>';
  }

  function render(msg) {
    if (!data) return;
    var list = data.nhiem_vu || [];
    var running = list.filter(function (m) { return m.dang_chay; }).length;
    var head = '<div class="mz-head"><div><h2>6 nhiệm vụ <span class="hl">hằng ngày</span></h2><p>Mỗi nhiệm vụ chỉ cần 2–3 app. Bấm <b>Chạy ngay</b> để AI làm luôn, hoặc bật <b>Tự chạy hằng ngày</b> để AI làm đúng giờ mỗi ngày. Hôm nay không cần việc nào thì tắt việc đó, chạy việc khác.</p></div>' +
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
    var t = e.target.closest('[data-nv]');
    if (t) return post({ action: t.getAttribute('data-on') ? 'tat' : 'bat', nv: t.getAttribute('data-nv') }, t.getAttribute('data-nv'));
    if (e.target.closest('[data-nv-all]')) return post({ action: 'bat', nv: 'all' }, 'all');
    if (e.target.closest('[data-nv-off]')) return post({ action: 'tat' }, 'all');
  });
  document.addEventListener('crewzy:autopilot-changed', load);
  load();
})();
