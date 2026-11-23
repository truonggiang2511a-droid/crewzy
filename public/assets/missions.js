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

  // CHẠY BẰNG AI CỦA KHÁCH (23/11): Claude/ChatGPT… đã nối link MCP Crewzy. Lệnh ngắn, các bước chuẩn nằm trong CREWZY_QUY_TRINH
  // (AI đọc 1 lần là làm đúng). Chỉ quy trình hằng ngày; "Đăng bài đã duyệt" Crewzy tự làm theo giờ hẹn nên bỏ.
  function aiPrompt(m) {
    var l = m.lich.filter(function (x) { return x.ngay === 'hang_ngay' && x.id !== 'dang_bai_da_duyet'; });
    if (!l.length) l = m.lich.slice(0, 1);
    return 'Dùng connector Crewzy. Chạy nhiệm vụ "' + m.ten + '" của doanh nghiệp tôi: gọi CREWZY_QUY_TRINH với id ' + l.map(function (x) { return x.id; }).join(', ') +
      ' để lấy đúng các bước, rồi làm lần lượt TỪNG BƯỚC tới khi xong, không bỏ bước. BƯỚC 0 kiểm tra Brain và Kho: thiếu thông tin, ảnh, video, màu hay logo thì hỏi tôi một lần cho đủ; tôi trả lời thì lưu bằng CREWZY_LUU_BRAIN / CREWZY_LUU_KHO rồi làm tiếp. Ảnh và video: bạn tự do sáng tạo bằng khả năng và công cụ của chính bạn (hoặc app tôi đã nối), không cần theo cách làm của Crewzy, không tự ghép ảnh/video bằng code (Python, FFmpeg); chỉ cần đúng sản phẩm thật, đúng thương hiệu, đúng khổ từng kênh. Nộp mọi kết quả về Crewzy bằng CREWZY_NOP_KET_QUA (bài đăng kèm gio_dang) để tôi duyệt.';
  }
  var aiPanel = null; // { id, text, links: null | [{ten, luc}] }
  // Điều kiện trước khi chạy: mọi ô bắt buộc (kênh mạng xã hội ≥1) + nơi nhận báo cáo ≥1. Ô khác chỉ gợi ý.
  var REPORT_SUG = [{ slug: 'gmail', name: 'Gmail' }, { slug: 'googlesheets', name: 'Google Sheets' }, { slug: 'telegram', name: 'Telegram' }];
  function needsOf(m) {
    var req = m.slots.filter(function (sl) { return sl.bat_buoc; }).map(function (sl) {
      return { vai: sl.vai + ' (bắt buộc ít nhất 1)', ok: sl.da_noi.length > 0, have: sl.da_noi, sug: sl.goi_y.slice(0, 4), cat: sl.cat || m.cat };
    });
    var rep = data.bao_cao_ung_vien || [];
    req.push({ vai: 'Nơi nhận báo cáo kết quả (bắt buộc ít nhất 1)', ok: rep.length > 0, have: rep, sug: REPORT_SUG, cat: 'office' });
    var opt = m.slots.filter(function (sl) { return !sl.bat_buoc && !sl.da_noi.length && !/báo cáo/i.test(sl.vai); });
    return { req: req, opt: opt, ok: req.every(function (r) { return r.ok; }) };
  }
  function chip(a, m, on) {
    var href = on ? (a.href || 'ket-noi.html?app=' + a.slug) : back(a.href || ('ket-noi.html?app=' + a.slug), m);
    return '<a class="mz-app' + (on ? ' on' : '') + '" href="' + esc(href) + '">' + (a.logo || a.slug ? logo(a) : '') + '<span>' + esc(a.name) + '</span><i>' + (on ? '✓' : '+') + '</i></a>';
  }
  function aiPanelHtml(m) {
    var t = aiPanel.text, n = needsOf(m);
    var used = (aiPanel.links || []).filter(function (l) { return l.dung; }).map(function (l) { return l.dung; });
    var s1 = '<li><b>Kiểm tra ứng dụng</b>' + n.req.map(function (r) {
      return '<div class="mz-need ' + (r.ok ? 'ok' : 'miss') + '"><span>' + (r.ok ? '✓ ' : '✗ ') + esc(r.vai) + '</span><div class="mz-apps">' +
        (r.ok ? r.have.map(function (a) { return chip(a, m, true); }).join('') : r.sug.map(function (a) { return chip(a, m, false); }).join('') +
          '<a class="mz-app plus" href="' + esc(back('ket-noi.html?cat=' + r.cat, m)) + '"><span>+ App khác</span></a>') + '</div></div>';
    }).join('') + (n.opt.length ? '<div class="mz-need opt"><span>Nên có thêm (không bắt buộc) để chạy đúng quy trình chuẩn:</span><div class="mz-apps">' +
      n.opt.map(function (sl) { return sl.goi_y.slice(0, 2).map(function (a) { return chip(a, m, false); }).join(''); }).join('') + '</div></div>' : '') + '</li>';
    var s2 = '<li><b>Nối Crewzy vào AI của bạn</b>' + (used.length
      ? '<p class="mz-need ok" style="margin:6px 0">✓ Đã nối với ' + esc(used.map(function (u) { return u.ten; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</p><details><summary>Nối thêm AI khác</summary><div class="ai-install-grid" data-mz-install></div><p class="ai-install-msg" data-mz-install-msg hidden></p></details>'
      : aiPanel.links === null ? '<p class="muted" style="margin:6px 0">Đang kiểm tra…</p>'
      : '<p class="muted" style="margin:6px 0">Bấm <b>Cài đặt</b> ở Claude: app Claude mở sẵn tên <b>Crewzy</b> và link MCP, bạn chỉ bấm <b>Kết nối</b>. Lệnh chạy được chép sẵn để dán vào chat.</p><div class="ai-install-grid" data-mz-install></div><p class="ai-install-msg" data-mz-install-msg hidden></p>') + '</li>';
    var s3 = '<li><b>Bắt đầu chạy</b><p class="muted" style="margin:6px 0">' + (n.ok ? 'Mở Claude với lệnh điền sẵn, bấm gửi là AI chạy đúng quy trình chuẩn, hỏi bạn phần còn thiếu, nộp kết quả về <a href="cho-duyet.html">Việc chờ duyệt</a>.' : 'Nối đủ các mục bắt buộc ở bước 1 để bắt đầu.') + '</p>' +
      '<div class="mz-act"><a class="btn btn-primary' + (n.ok ? '' : ' is-disabled') + '"' + (n.ok ? ' href="https://claude.ai/new?q=' + encodeURIComponent(t) + '" target="_blank" rel="noopener"' : ' aria-disabled="true"') + '>▶ Mở Claude và chạy</a>' +
      '<button type="button" class="btn btn-ghost" data-ai-copy' + (n.ok ? '' : ' disabled') + '>Chép lệnh (ChatGPT, Gemini…)</button></div>' +
      '<details><summary>Xem lệnh</summary><textarea class="mz-cmd" readonly rows="6" style="width:100%;font-size:13px">' + esc(t) + '</textarea></details></li>';
    return '<div class="mz-dlg" role="dialog" aria-modal="true"><div class="mz-dlg-box"><h3>Chạy "' + esc(m.ten) + '" bằng AI của bạn</h3><ol class="mz-steps">' + s1 + s2 + s3 + '</ol>' +
      '<div class="mz-act"><button type="button" class="btn btn-ghost" data-dlg-x>Đóng</button></div></div></div>';
  }
  function openAi(m, sel) {
    aiPanel = { id: m.id, text: aiPrompt(m) + (sel ? prefLine(m, sel) : ''), links: null };
    render();
    refreshLinks(m);
  }
  function refreshLinks(m) {
    var u = window.vpaiUid ? window.vpaiUid() : '';
    fetch('/api/mcp-links' + (u ? '?uid=' + encodeURIComponent(u) : ''), { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { if (aiPanel && aiPanel.id === m.id) { aiPanel.links = (j && j.links) || []; render(); } })
      .catch(function () { if (aiPanel) { aiPanel.links = []; render(); } });
  }
  // Sau mỗi lần vẽ: gắn lưới nút Cài đặt (ai-install.js) vào bảng.
  function mountInstall() {
    var g = box.querySelector('[data-mz-install]');
    if (!g || !window.crewzyAiInstall || !aiPanel) return;
    var text = aiPanel.text;
    window.crewzyAiInstall.mount(g, box.querySelector('[data-mz-install-msg]'), { only: ['claude', 'chatgpt', 'claudecode', 'codex', 'gemini', 'grok'], newTab: true, warm: true, extraCopy: function () { return text; } });
  }
  // Quay lại trang sau khi bấm Kết nối trong Claude → kiểm tra lại đã nối chưa.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && aiPanel && !(aiPanel.links || []).some(function (l) { return l.dung; })) { var mm = missionById(aiPanel.id); if (mm) refreshLinks(mm); } });

  // Nối xong quay về đúng nhiệm vụ này (ket-noi.html đọc tro_ve).
  function back(href, m) { return href.indexOf('ket-noi.html') === 0 ? href + (href.indexOf('?') > 0 ? '&' : '?') + 'tro_ve=' + encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + '#nv-' + m.id) : href; }
  // ----- CHỌN CÔNG CỤ CHO LẦN CHẠY (23/11): bấm logo app đã nối để chọn/bỏ chọn (KHÔNG ngắt kết nối), lưu vào lựa chọn nhiệm vụ (apref)
  // → lệnh cho AI ghi đúng app được chọn ("dùng Canva…"). Chưa chọn lần nào: ô nhiều app = chọn hết, ô 1 app = app đầu.
  function selOf(m, i) {
    var sl = m.slots[i], conn = sl.da_noi.map(function (a) { return a.slug; }), s = (m.chon || {})['s' + i];
    if (s) return s.filter(function (v) { return v === 'crewzy' || conn.indexOf(v) >= 0; });
    return sl.nhieu ? conn : conn.slice(0, 1);
  }
  function fullSel(m) { var o = {}; m.slots.forEach(function (sl, i) { o['s' + i] = selOf(m, i); }); o.bao_cao = ((m.chon || {}).bao_cao || []).slice(); return o; }
  function tgBtn(m, i, a, big) {
    var on = selOf(m, i).indexOf(a.slug) >= 0;
    var tip = a.name + (on ? ' · đang dùng cho lần chạy này (bấm để bỏ chọn, vẫn giữ kết nối)' : ' · đã nối, lần này không dùng (bấm để chọn)');
    return big
      ? '<button type="button" class="mz-app on tg' + (on ? '' : ' unsel') + '" data-tg="' + esc(m.id + '|' + i + '|' + a.slug) + '" aria-pressed="' + on + '" title="' + esc(tip) + '">' + logo(a) + '<span>' + esc(a.name) + '</span><i>' + (on ? '✓' : '○') + '</i></button>'
      : '<button type="button" class="mz-mini tg' + (on ? ' sel' : ' unsel') + '" data-tg="' + esc(m.id + '|' + i + '|' + a.slug) + '" aria-pressed="' + on + '" title="' + esc(tip) + '">' + logo(a) + (on ? '<i aria-hidden="true">✓</i>' : '') + '</button>';
  }
  var saveT = null;
  function toggle(key) {
    var p = key.split('|'), m = missionById(p[0]); if (!m) return;
    var i = +p[1], slug = p.slice(2).join('|'), sl = m.slots[i], cur = selOf(m, i), on = cur.indexOf(slug) >= 0;
    if (on && sl.bat_buoc && cur.length === 1) return render('⚠ "' + esc(sl.vai) + '" cần ít nhất 1 app. Chọn app khác trước rồi mới bỏ ' + esc((sl.da_noi.filter(function (a) { return a.slug === slug; })[0] || {}).name || slug) + '.');
    var next = on ? cur.filter(function (v) { return v !== slug; }) : (sl.nhieu ? cur.concat([slug]) : [slug]);
    var sel = fullSel(m); sel['s' + i] = next; m.chon = sel;
    render();
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var u = window.vpaiUid ? window.vpaiUid() : '';
      fetch('/api/autopilot', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'chon', nv: m.id, chon: m.chon, uid: u || undefined }) }).catch(function () {});
    }, 500);
  }
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
      '<div class="mz-act"><button type="button" class="btn btn-primary" data-dlg-go>' + (dlg.mode === 'tu_chay' ? '⏰ Lưu và bật tự chạy' : dlg.mode === 'ai' ? 'Tiếp tục' : '▶ Bắt đầu chạy') + '</button><button type="button" class="btn btn-ghost" data-dlg-x>Huỷ</button></div></div></div>';
  }
  function prefLine(m, sel) {
    var nm = function (v) { return v === 'crewzy' ? 'công cụ có sẵn của Crewzy' : (function () { var f = null; m.slots.forEach(function (sl) { sl.da_noi.concat(sl.goi_y).forEach(function (a) { if (a.slug === v) f = a.name; }); }); (data.bao_cao_ung_vien || []).forEach(function (a) { if (a.slug === v) f = a.name; }); return f || v; })(); };
    var l = []; m.slots.forEach(function (sl, i) { var s = sel['s' + i] || []; if (s.length) l.push('- ' + sl.vai + ': dùng ' + s.map(nm).join(', ')); });
    if ((sel.bao_cao || []).length) l.push('- Báo cáo kết quả gửi về: ' + sel.bao_cao.map(function (s) { return s === 'crewzy' ? 'chỉ trong Crewzy (Việc chờ duyệt, Kết quả)' : nm(s); }).join(', '));
    return l.length ? '\n\nLỰA CHỌN CỦA KHÁCH (khách đã chọn trong Crewzy, làm ĐÚNG như vậy, không tự đổi app, không hỏi lại):\n' + l.join('\n') : '';
  }
  function slotHtml(sl, m) {
    var idx = m.slots.indexOf(sl);
    var chips = sl.da_noi.map(function (a) { return tgBtn(m, idx, a, true); });
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
    // Hàng công cụ: app đã nối = nút chọn/bỏ chọn (✓), app gợi ý chưa nối = mờ (bấm để nối), + = thêm app của bạn.
    var tg = [];
    m.slots.forEach(function (sl, i) { sl.da_noi.forEach(function (a) { tg.push(tgBtn(m, i, a, false)); }); });
    var logos = tg.join('') + cand.slice(0, Math.max(0, 6 - tg.length)).map(function (a) { return '<a class="mz-mini off" href="' + esc(back(a.href, m)) + '" title="Nối ' + esc(a.name) + '">' + logo(a) + '</a>'; }).join('') +
      '<a class="mz-mini plus" href="' + esc(back('ket-noi.html?cat=' + m.cat, m)) + '" title="Thêm app của bạn vào nhiệm vụ này">+</a>';
    var first = m.lich[0];
    var isOpen = open === m.id, b = busy === m.id;
    var detail = !isOpen ? '' : '<div class="mz-detail"><p class="mz-desc">' + esc(m.mo_ta) + '</p>' +
      m.slots.map(function (sl) { return slotHtml(sl, m); }).join('') +
      '<a class="mz-more" href="' + esc(back('ket-noi.html?cat=' + m.cat, m)) + '">+ Thêm app khác</a>' +
      '<ul class="mz-lich">' + m.lich.map(function (l) { return '<li class="' + (l.dang_chay ? 'on' : '') + '"><b>' + esc(when(l)) + '</b> ' + esc(l.buoc) + '</li>'; }).join('') + '</ul></div>';
    return '<article class="card mz-card' + (m.dang_chay ? ' running' : '') + (isOpen ? ' open' : '') + '" style="--mz:' + esc(m.mau) + '" id="nv-' + esc(m.id) + '">' +
      '<button type="button" class="mz-sum" data-open="' + esc(m.id) + '" aria-expanded="' + isOpen + '">' +
        '<span class="mz-top"><b class="mz-name">' + esc(m.ten) + '</b>' + st + '</span>' +
        '<span class="mz-meta">' + okSlots + '/' + total + ' ô app · ' + esc(first ? when(first) : '') + '</span>' +
        (!m.san_sang && m.ly_do ? '<span class="mz-why">' + esc(m.ly_do) + '</span>' : '') +
        '<span class="mz-chev" aria-hidden="true">' + (isOpen ? '▴ Thu gọn' : '▾ Chi tiết') + '</span>' +
      '</button>' + '<div class="mz-logos mz-tools">' + logos + '</div>' + detail +
      '<div class="mz-act">' +
        '<button type="button" class="btn btn-primary" data-run="' + esc(m.id) + '">▶ Chạy ngay</button>' +
        '<button type="button" class="btn btn-ghost" data-ai-run="' + esc(m.id) + '" title="Chạy bằng Claude/ChatGPT của bạn (nối Crewzy 1 lần bấm)">✦ <span class="mz-long">Chạy bằng </span>AI của bạn</button>' +
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
      '<button type="button" class="btn btn-primary" data-nv-all' + (busy ? ' disabled' : '') + '>' + (busy === 'all' ? 'Đang khởi động…' : '▶ Run tất cả') + '</button>' +
      (running ? '<button type="button" class="btn btn-ghost" data-nv-off' + (busy ? ' disabled' : '') + '>Tắt hết</button>' : '') + '</div></div>';
    var warn = !data.brand_ok ? '<p class="mz-warn">Điền <a href="thuong-hieu.html">Brain thương hiệu</a> (tên, sản phẩm, khách hàng, giọng văn) trước khi bật tự chạy, để AI làm đúng thương hiệu.</p>' : '';
    if (data.lich_goi === 0) warn += '<p class="mz-warn">Gói hiện tại chưa có tự chạy theo giờ — vẫn bấm Chạy ngay được. <a href="goi.html">Nâng gói</a> để AI tự làm mỗi ngày.</p>';
    box.innerHTML = head + warn + (msg ? '<p class="mz-msg">' + msg + '</p>' : '') + '<div class="mz-grid">' + list.map(card).join('') + '</div>' + (dlg && missionById(dlg.id) ? dlgHtml(missionById(dlg.id)) : '') + (aiPanel && missionById(aiPanel.id) ? aiPanelHtml(missionById(aiPanel.id)) : '');
    mountInstall();
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

  // Lưu lựa chọn công cụ rồi chạy theo chế độ (chay = Trợ lý làm ngay, ai = AI của khách, tu_chay = bật tự chạy).
  function goDlg() {
      var m0 = missionById(dlg.id), d0 = dlg, u = window.vpaiUid ? window.vpaiUid() : '';
      fetch('/api/autopilot', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'chon', nv: d0.id, chon: d0.sel, uid: u || undefined }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j.nhiem_vu) data.nhiem_vu = j.nhiem_vu;
          dlg = null;
          // ▶ Chạy ngay: Trợ lý Crewzy làm thật ngay tại chỗ (assets/run.js), không chuyển sang chat; máy chủ chưa bật Trợ lý thì mới mở chat.
          if (d0.mode === 'chay') {
            if (!window.crewzyRun) { location.href = 'chat.html?q=' + encodeURIComponent(runPrompt(m0) + prefLine(m0, d0.sel)); return; }
            render('▶ Đang khởi động ' + esc(m0.ten) + '…');
            window.crewzyRun.start([m0.id]).then(function (out) {
              if (out && out.error && !out.run) return render('⚠ ' + esc(out.error) + (out.brand ? ' <a href="thuong-hieu.html">Mở Brain</a>' : ''));
              render('▶ ' + esc(m0.ten) + ' đang chạy. Theo dõi ở khung "Dây chuyền đang chạy"' + (document.querySelector('[data-graph]') ? ' và trên cây' : '') + '.');
            }).catch(function () { render('⚠ Lỗi mạng, thử lại.'); });
            return;
          }
          if (d0.mode === 'ai') { openAi(m0, d0.sel); return; }
          post({ action: 'bat', nv: d0.id }, d0.id);
        }).catch(function () { render('⚠ Lỗi mạng, thử lại.'); });
  }
  box.addEventListener('change', function (e) {
    var q = e.target.closest('[data-q]');
    if (!q || !dlg) return;
    var k = q.getAttribute('data-q'), v = q.value, cur = dlg.sel[k] || [];
    if (q.type === 'radio') dlg.sel[k] = [v];
    else dlg.sel[k] = q.checked ? cur.concat([v]) : cur.filter(function (x) { return x !== v; });
  });
  box.addEventListener('click', function (e) {
    var tgl = e.target.closest('[data-tg]');
    if (tgl) { e.preventDefault(); toggle(tgl.getAttribute('data-tg')); return; }
    var run = e.target.closest('[data-run]');
    // Chọn công cụ ngay trên thẻ rồi → chạy luôn với lựa chọn đó (hộp thoại trắc nghiệm chỉ còn khi chưa có trình chạy).
    if (run) { var mm = missionById(run.getAttribute('data-run')); if (mm) { if (window.crewzyRun) { dlg = { id: mm.id, mode: 'chay', sel: fullSel(mm) }; goDlg(); } else openDlg(mm, 'chay'); } return; }
    var air = e.target.closest('[data-ai-run]');
    // Đủ app bắt buộc → hỏi chọn app trước (trắc nghiệm) rồi mở bảng; thiếu → mở thẳng bảng để thấy cần nối gì.
    if (air) { var ma = missionById(air.getAttribute('data-ai-run')); if (ma) openAi(ma, fullSel(ma)); return; }
    if (e.target.closest('[data-ai-copy]') && aiPanel) {
      var bt = e.target.closest('[data-ai-copy]'), ta = box.querySelector('.mz-cmd');
      var ok = function () { bt.textContent = '✓ Đã chép'; };
      if (navigator.clipboard) navigator.clipboard.writeText(aiPanel.text).then(ok, function () { if (ta) { ta.select(); document.execCommand('copy'); ok(); } });
      else if (ta) { ta.select(); document.execCommand('copy'); ok(); }
      return;
    }
    if (e.target.closest('[data-dlg-x]')) { dlg = null; aiPanel = null; return render(); }
    if (e.target.closest('[data-dlg-go]') && dlg) return goDlg();
    var o = e.target.closest('[data-open]');
    if (o) { open = open === o.getAttribute('data-open') ? '' : o.getAttribute('data-open'); return render(); }
    var t = e.target.closest('[data-nv]');
    if (t) { if (!t.getAttribute('data-on')) { var m1 = missionById(t.getAttribute('data-nv')); if (m1) { dlg = { id: m1.id, mode: 'tu_chay', sel: fullSel(m1) }; return goDlg(); } } return post({ action: t.getAttribute('data-on') ? 'tat' : 'bat', nv: t.getAttribute('data-nv') }, t.getAttribute('data-nv')); }
    // ▶ Run tất cả: chạy thật ngay các bước hằng ngày đã sẵn sàng + bật tự chạy mỗi ngày.
    if (e.target.closest('[data-nv-all]')) {
      if (!window.crewzyRun) return post({ action: 'bat', nv: 'all' }, 'all');
      busy = 'all'; render();
      return window.crewzyRun.start(null, { lap: true }).then(function (out) {
        busy = '';
        if (out && out.error && !out.run) return render('⚠ ' + esc(out.error) + (out.brand ? ' <a href="thuong-hieu.html">Mở Brain</a>' : ''));
        render('▶ Đang chạy ' + ((out.run && out.run.tong) || '') + ' bước. Theo dõi ở khung "Dây chuyền đang chạy".' + (out.lap && out.lap.bat ? ' Đã bật tự chạy mỗi ngày.' : ''));
        document.dispatchEvent(new CustomEvent('crewzy:autopilot'));
      }).catch(function () { busy = ''; render('⚠ Lỗi mạng, thử lại.'); });
    }
    if (e.target.closest('[data-nv-off]')) return post({ action: 'tat' }, 'all');
  });
  document.addEventListener('crewzy:autopilot-changed', load);
  load();
})();
