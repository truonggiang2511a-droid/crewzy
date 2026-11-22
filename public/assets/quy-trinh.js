// Trang Quy trình: thư viện quy trình chuẩn từ /api/workflows (nguồn: src/lib/workflows.js).
// Mỗi quy trình: app bắt buộc / nên có (sáng = đã kết nối), MCP ngoài cần nối, các bước, nút Chạy ngay / Giao cho AI của tôi / Hẹn giờ.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var uid = window.vpaiUid();
  var listEl = $('[data-flows]');
  var msgEl = $('[data-msg]');
  var data = { departments: [], workflows: [], mcpHosts: {} };
  var accounts = {};
  var mcpUrls = [];
  var names = {};
  var dep = new URLSearchParams(location.search).get('phong') || 'all';
  var sched = { schedules: [], days: {}, modes: {} };
  var MCP_INFO = {
    apify: { name: 'Apify', letter: 'A', bg: '#246DFF', note: 'soi Reels/TikTok, quảng cáo Facebook' },
    firecrawl: { name: 'Firecrawl', letter: 'F', bg: '#FA5D19', note: 'đọc website' },
    openart: { name: 'OpenArt', letter: 'O', bg: '#111', note: 'ảnh, video AI' },
    vidiq: { name: 'vidIQ', letter: 'V', bg: '#CC0000', note: 'chỉ trong Claude/ChatGPT của bạn' }
  };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t, ok) { msgEl.textContent = t || ''; msgEl.style.display = t ? 'block' : 'none'; msgEl.style.background = ok ? 'var(--ok-soft)' : '#FDE8E3'; msgEl.style.color = ok ? 'var(--ok)' : '#8A2A12'; }
  function json(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.error || 'Có lỗi, thử lại.'); return b; });
    });
  }
  function post(url, body) { return json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: uid }, body)) }); }

  function appIcon(slug, on, required) {
    var label = (names[slug] || slug) + (on ? ' · đã kết nối' : required ? ' · cần kết nối' : ' · nên có');
    return '<a href="ket-noi.html?app=' + slug + '" title="' + esc(label) + '" style="position:relative;display:inline-flex"><img src="https://logos.composio.dev/api/' + slug + '" alt="' + esc(label) + '" style="width:26px;height:26px;border-radius:6px;background:#fff;border:1px solid var(--line, #E8E8E8);padding:2px;' + (on ? '' : 'opacity:.4;filter:grayscale(1)') + '">' +
      (required && !on ? '<span aria-hidden="true" style="position:absolute;right:-3px;top:-3px;width:9px;height:9px;border-radius:50%;background:#D93025;border:2px solid #fff"></span>' : '') + '</a>';
  }
  function mcpChip(m, on) {
    var i = MCP_INFO[m] || { name: m, letter: m[0].toUpperCase(), bg: '#555', note: '' };
    return '<a href="ket-noi.html?tab=mcp" title="' + esc(i.name + ' · ' + i.note + (on ? ' · đã nối' : ' · cần nối ở MCP khác')) + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 2px;border-radius:99px;border:1px solid var(--line, #E8E8E8);font-size:12px;color:inherit;text-decoration:none;' + (on ? '' : 'opacity:.55') + '">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:' + i.bg + ';color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + i.letter + '</span>' + esc(i.name) + '</a>';
  }
  function mcpOn(m) { var host = data.mcpHosts[m] || m; return mcpUrls.some(function (u) { return u.indexOf(host) >= 0; }); }

  function renderDeps() {
    var deps = [{ id: 'all', name: 'Tất cả' }].concat(data.departments);
    $('[data-deps]').innerHTML = deps.map(function (d) {
      var n = d.id === 'all' ? data.workflows.length : data.workflows.filter(function (w) { return w.phong === d.id; }).length;
      return '<button type="button" data-dep="' + d.id + '" aria-pressed="' + (dep === d.id) + '">' + esc(d.name) + ' <span class="num">' + n + '</span></button>';
    }).join('');
  }

  function render() {
    renderDeps();
    var depName = {}; data.departments.forEach(function (d) { depName[d.id] = d.name; });
    var list = data.workflows.filter(function (w) { return dep === 'all' || w.phong === dep; });
    listEl.innerHTML = list.map(function (w) {
      var missApp = w.app.filter(function (s) { return !(accounts[s] > 0); });
      var missMcp = w.mcp.filter(function (m) { return m !== 'openart' && !mcpOn(m); });
      var ready = !missApp.length && !missMcp.length;
      var icons = w.app.map(function (s) { return appIcon(s, accounts[s] > 0, true); }).concat(w.nen_co.map(function (s) { return appIcon(s, accounts[s] > 0, false); })).join('');
      var chips = w.mcp.map(function (m) { return mcpChip(m, mcpOn(m)); }).join('');
      var fix = missApp.length ? '<a class="btn btn-primary" href="ket-noi.html?app=' + missApp[0] + '">Kết nối ' + esc(names[missApp[0]] || missApp[0]) + '</a>'
        : missMcp.length ? '<a class="btn btn-primary" href="ket-noi.html?tab=mcp">Nối ' + esc((MCP_INFO[missMcp[0]] || {}).name || missMcp[0]) + '</a>' : '';
      return '<article class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><p class="muted" style="margin:0;font-size:12px;font-weight:600">' + esc(depName[w.phong]) + '</p><h2 style="margin:2px 0 0;font-size:16px;font-weight:600">' + esc(w.ten) + '</h2></div>' +
        (ready ? '<span class="pill pill-ok">Sẵn sàng</span>' : '<span class="pill pill-warn">Thiếu kết nối</span>') + '</div>' +
        '<p class="muted" style="margin:0;font-size:13px;line-height:1.55">' + esc(w.mo_ta) + '</p>' +
        '<p style="margin:0;font-size:12px;color:#4A4A4A">Gợi ý lịch: ' + esc(w.lich) + '</p>' +
        ((icons || chips) ? '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' + icons + chips + '</div>' : '') +
        '<details><summary style="cursor:pointer;font-size:13px;font-weight:600">Các bước (' + w.buoc.length + ')</summary><ol style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.6">' + w.buoc.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ol></details>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">' + (fix ||
          '<a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent('Chạy quy trình "' + w.ten + '" (mã ' + w.id + '): gọi CREWZY_QUY_TRINH với id "' + w.id + '" để lấy các bước, làm đúng thứ tự, nộp kết quả kèm quy_trinh.' + (w.hoi ? ' Hỏi tôi: ' + w.hoi + ' nếu cần.' : '')) + '">Chạy ngay</a>') +
        '<button type="button" class="btn btn-ghost" data-assign="' + w.id + '">Giao cho AI của tôi</button>' +
        '<button type="button" class="btn btn-ghost" data-sched="' + w.id + '">Hẹn giờ</button></div></article>';
    }).join('');
  }

  function renderSched() {
    var box = $('[data-sched-box]');
    box.hidden = !sched.schedules.length;
    $('[data-sched-list]').innerHTML = sched.schedules.map(function (s) {
      return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line, #E8E8E8);border-radius:8px' + (s.bat ? '' : ';opacity:.55') + '">' +
        '<div style="flex:1;min-width:200px"><p style="margin:0;font-weight:600;font-size:14px">' + esc(s.ten) + '</p><p class="muted" style="margin:2px 0 0;font-size:12px">' + esc(sched.days[s.ngay] || s.ngay) + ' lúc ' + esc(s.gio) + ' · ' + esc(sched.modes[s.che_do] || s.che_do) + (s.lan_cuoi ? ' · lần gần nhất ' + esc(s.lan_cuoi) : '') + '</p></div>' +
        '<button type="button" class="btn btn-ghost" data-sact="' + (s.bat ? 'tat' : 'bat') + '" data-sid="' + s.id + '">' + (s.bat ? 'Tạm dừng' : 'Bật lại') + '</button>' +
        '<button type="button" class="btn btn-ghost" data-sact="xoa" data-sid="' + s.id + '" style="color:#8A2A12">Xoá</button></div>';
    }).join('');
  }

  function loadSched() {
    return json('/api/schedules?uid=' + encodeURIComponent(uid)).then(function (d) { sched = d; renderSched(); }).catch(function () {});
  }

  // Hẹn giờ
  var dialog = $('[data-sched-dialog]');
  var sform = $('[data-sched-form]');
  var schedFor = null;
  function openSched(id) {
    var w = data.workflows.filter(function (x) { return x.id === id; })[0];
    schedFor = w;
    $('[data-sched-title]').textContent = 'Hẹn giờ: ' + w.ten;
    sform.ngay.innerHTML = Object.keys(sched.days).map(function (k) { return '<option value="' + k + '">' + esc(sched.days[k]) + '</option>'; }).join('');
    sform.che_do.innerHTML = Object.keys(sched.modes).map(function (k) { return '<option value="' + k + '">' + esc(sched.modes[k]) + '</option>'; }).join('');
    var lich = (w.lich || '').toLowerCase();
    sform.ngay.value = /thứ hai hằng tuần|thứ hai \d/.test(lich) ? 't2' : /thứ hai đến thứ sáu/.test(lich) ? 't2_t6' : /ngày 1/.test(lich) ? 'ngay_1' : 'hang_ngay';
    var m = /(\d{1,2}):(\d{2})/.exec(w.lich || '');
    sform.gio.value = m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '08:00';
    $('[data-sched-msg]').style.display = 'none';
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  $('[data-sched-cancel]').addEventListener('click', function () { dialog.close(); });
  sform.addEventListener('submit', function (e) {
    e.preventDefault();
    post('/api/schedules', { action: 'tao', quy_trinh: schedFor.id, gio: sform.gio.value, ngay: sform.ngay.value, che_do: sform.che_do.value, ghi_chu: sform.ghi_chu.value }).then(function () {
      dialog.close(); sform.ghi_chu.value = '';
      say('Đã hẹn giờ "' + schedFor.ten + '". Tới giờ kết quả sẽ về Việc chờ duyệt.', true);
      loadSched();
    }).catch(function (err) { var m = $('[data-sched-msg]'); m.textContent = err.message; m.style.display = 'block'; });
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var d = t.closest('[data-dep]');
    if (d) { dep = d.getAttribute('data-dep'); history.replaceState(null, '', dep === 'all' ? 'quy-trinh.html' : 'quy-trinh.html?phong=' + dep); render(); return; }
    var a = t.closest('[data-assign]');
    if (a) {
      a.disabled = true;
      post('/api/jobs', { action: 'tao', quy_trinh: a.getAttribute('data-assign') }).then(function (r) {
        say('Đã giao "' + r.job.tieu_de + '". Bảo AI của bạn "làm việc Crewzy" (Claude Code: /mcp__crewzy__lam_viec_crewzy) để nó nhận việc.', true);
        a.disabled = false;
      }).catch(function (err) { say(err.message); a.disabled = false; });
      return;
    }
    var s = t.closest('[data-sched]');
    if (s) { openSched(s.getAttribute('data-sched')); return; }
    var sa = t.closest('[data-sact]');
    if (sa) {
      var act = sa.getAttribute('data-sact');
      if (act === 'xoa' && !window.confirm('Xoá lịch này?')) return;
      sa.disabled = true;
      post('/api/schedules', { action: act, id: sa.getAttribute('data-sid') }).then(loadSched).catch(function (err) { say(err.message); });
    }
  });

  Promise.all([
    json('/api/workflows'),
    json('/api/catalog').catch(function () { return { apps: [] }; }),
    json('/api/status?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    json('/api/mcp-servers?uid=' + encodeURIComponent(uid)).catch(function () { return { servers: [] }; }),
    json('/api/brand?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    loadSched()
  ]).then(function (r) {
    data = r[0];
    (r[1].apps || []).forEach(function (a) { names[a.slug] = a.name; });
    accounts = (r[2] && r[2].accounts) || {};
    mcpUrls = ((r[3] && r[3].servers) || []).map(function (s) { return s.url; });
    var b = (r[4] && r[4].brand) || {};
    $('[data-brand-warn]').hidden = !!(b.name || b.products);
    render();
  }).catch(function (err) { listEl.innerHTML = ''; say(err.message); });
})();
