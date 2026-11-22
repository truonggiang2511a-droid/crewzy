// Trang Kết nối: lưới ứng dụng kiểu Composio (logo, mô tả, lọc thể loại, tìm kiếm), trang chi tiết từng app có Skill,
// tab "AI của bạn" (Đăng nhập OpenRouter, link nối AI). Dữ liệu app lấy từ /api/catalog (netlify/lib/catalog.mjs).
(function () {
  var MAX_ACCOUNTS = 5;
  var FEATURED = ['facebook', 'instagram', 'tiktok', 'youtube', 'gmail', 'googlesheets'];
  // App chưa có trên Composio: không có logo ở logos.composio.dev → hiện chữ cái đầu với màu thương hiệu.
  var LETTER = { zalo: ['Z', '#0068FF'], shopee: ['S', '#EE4D2D'], lazada: ['L', '#101566'], haravan: ['H', '#1C76D2'], sapo: ['S', '#1BAA5C'], capcut: ['C', '#111111'] };
  var LOGO_ALIAS = { tiktokshop: 'tiktok' };

  var uid = window.vpaiUid();
  var catalog = { categories: [], apps: [] };
  var accounts = {};
  var state = { filter: 'all', cat: 'all', q: '' };

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var listEl = $('[data-apps-list]');
  var detailEl = $('[data-view="detail"]');
  var appsView = $('[data-view="apps"]');
  var aiView = $('[data-view="ai"]');
  var msgEl = $('[data-apps-msg]');

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function showMsg(el, text) { if (!el) return; el.textContent = text || ''; el.style.display = text ? 'block' : 'none'; }

  function getJson(path) {
    return fetch(path).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().catch(function () { return { error: 'Máy chủ chưa sẵn sàng, thử lại sau.' }; })
        .then(function (body) { return { ok: r.ok, body: body }; });
    });
  }

  function logo(app, size) {
    var s = size || 40;
    if (LETTER[app.slug]) {
      return '<span class="app-logo app-logo-letter" style="width:' + s + 'px;height:' + s + 'px;background:' + LETTER[app.slug][1] + '" aria-hidden="true">' + LETTER[app.slug][0] + '</span>';
    }
    return '<img class="app-logo" src="https://logos.composio.dev/api/' + (LOGO_ALIAS[app.slug] || app.slug) + '" alt="" loading="lazy" style="width:' + s + 'px;height:' + s + 'px">';
  }

  function statusHtml(app) {
    var n = accounts[app.slug] || 0;
    if (app.status !== 'ready') return '<span class="pill">Sắp có</span>';
    if (n > 0) return '<span class="pill pill-ok"><span class="dot"></span>' + n + ' tài khoản</span>';
    return '<button type="button" class="btn btn-primary" data-connect="' + app.slug + '" style="min-height:34px;padding:0 12px;font-size:13px">Kết nối</button>';
  }

  function card(app) {
    var soon = app.status !== 'ready';
    return '<div class="card" data-app="' + app.slug + '" role="button" tabindex="0" aria-label="Xem ' + esc(app.name) + '" style="display:flex;gap:12px;padding:14px;cursor:pointer;min-height:96px' + (soon ? ';background:#FCFCFC' : '') + '">' +
      '<div style="' + (soon ? 'opacity:.55;filter:grayscale(.4)' : '') + '">' + logo(app) + '</div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><p style="margin:0;font-weight:600;font-size:15px">' + esc(app.name) + '</p>' + statusHtml(app) + '</div>' +
      '<p class="muted" style="margin:0;font-size:13px;line-height:1.45">' + esc(app.desc) + '</p></div></div>';
  }

  function grid(apps) {
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">' + apps.map(card).join('') + '</div>';
  }

  function section(title, apps) {
    if (!apps.length) return '';
    return '<div style="display:flex;flex-direction:column;gap:12px"><h2 style="margin:0;font-size:17px;font-weight:600">' + esc(title) + '</h2>' + grid(apps) + '</div>';
  }

  function matches(app) {
    if (state.filter === 'connected' && !(accounts[app.slug] > 0)) return false;
    if (state.cat !== 'all' && app.cat !== state.cat) return false;
    if (state.q) {
      var q = state.q.toLowerCase();
      if ((app.name + ' ' + app.desc + ' ' + app.slug).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }

  function renderCats() {
    var counts = {};
    catalog.apps.forEach(function (a) { counts[a.cat] = (counts[a.cat] || 0) + 1; });
    var items = [{ id: 'all', name: 'Tất cả ứng dụng', n: catalog.apps.length }].concat(catalog.categories.map(function (c) { return { id: c.id, name: c.name, n: counts[c.id] || 0 }; }));
    $('[data-cat-list]').innerHTML = items.map(function (c) {
      var on = state.cat === c.id;
      return '<button type="button" data-cat="' + c.id + '" aria-pressed="' + on + '" style="display:flex;justify-content:space-between;align-items:center;min-height:38px;padding:0 10px;border:0;border-radius:6px;font:inherit;font-size:14px;text-align:left;cursor:pointer;background:' + (on ? '#EFEFEF' : 'transparent') + ';color:var(--text);font-weight:' + (on ? 600 : 400) + '">' + esc(c.name) + '<span class="muted" style="font-size:12px">' + c.n + '</span></button>';
    }).join('');
    var chips = $('[data-cat-chips]');
    chips.innerHTML = items.map(function (c) {
      var on = state.cat === c.id;
      return '<button type="button" data-cat="' + c.id + '" aria-pressed="' + on + '" class="btn ' + (on ? 'btn-primary' : 'btn-ghost') + '" style="min-height:36px;font-size:13px;font-weight:500">' + esc(c.id === 'all' ? 'Tất cả' : c.name) + '</button>';
    }).join('');
  }

  function renderList() {
    var connectedN = catalog.apps.filter(function (a) { return accounts[a.slug] > 0; }).length;
    $('[data-count-all]').textContent = catalog.apps.length;
    $('[data-count-connected]').textContent = connectedN;
    var apps = catalog.apps.filter(matches);
    var html;
    if (!apps.length) {
      html = '<div class="card" style="padding:28px;text-align:center;box-shadow:none;border-style:dashed"><p style="margin:0;font-weight:600">' +
        (state.filter === 'connected' ? 'Bạn chưa kết nối ứng dụng nào' : 'Không tìm thấy ứng dụng') + '</p><p class="muted" style="margin:6px 0 0;font-size:14px">' +
        (state.filter === 'connected' ? 'Bắt đầu với Facebook Fanpage hoặc Gmail.' : 'Thử tên khác, hoặc nhắn để được bổ sung.') + '</p></div>';
    } else if (state.filter === 'all' && state.cat === 'all' && !state.q) {
      var featured = FEATURED.map(function (s) { return catalog.apps.find(function (a) { return a.slug === s; }); }).filter(Boolean);
      html = section('Nên kết nối trước', featured) + catalog.categories.map(function (c) {
        return section(c.name, apps.filter(function (a) { return a.cat === c.id && FEATURED.indexOf(a.slug) === -1; }));
      }).join('');
    } else {
      html = grid(apps);
    }
    listEl.innerHTML = html;
    renderCats();
  }

  function renderDetail(slug, notice) {
    var app = catalog.apps.find(function (a) { return a.slug === slug; });
    if (!app) { showView('apps'); return; }
    var n = accounts[slug] || 0;
    var ready = app.status === 'ready';
    var btn = !ready ? '<button type="button" class="btn btn-ghost" disabled>Sắp có</button>'
      : '<button type="button" class="btn btn-primary" data-connect="' + slug + '"' + (n >= MAX_ACCOUNTS ? ' disabled' : '') + '>' + (n >= MAX_ACCOUNTS ? 'Đã đủ 5 tài khoản' : n > 0 ? 'Thêm tài khoản' : 'Kết nối tài khoản') + '</button>';
    var list = function (items) { return '<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; };
    var skill = ready ? '<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:14px">' +
      '<div><h2 style="margin:0;font-size:17px;font-weight:600">Skill của AI cho ' + esc(app.name) + '</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Trợ lý AI đọc Skill này mỗi khi làm việc trên ' + esc(app.name) + ' qua Composio.</p></div>' +
      (app.can.length ? '<div><p style="margin:0 0 6px;font-size:14px;font-weight:600">AI làm được</p>' + list(app.can) + '</div>' : '') +
      '<div><p style="margin:0 0 6px;font-size:14px;font-weight:600">Luật AI luôn theo</p>' + list(app.rules.concat(['Đăng bài, gửi tin, xoá, chi tiền: tóm tắt rồi chờ bạn đồng ý'])) + '</div>' +
      (app.try.length ? '<div><p style="margin:0 0 8px;font-size:14px;font-weight:600">Thử ngay với Trợ lý AI</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + app.try.map(function (t) {
        return '<a class="btn btn-ghost" style="font-weight:500;white-space:normal;text-align:left;padding:8px 12px" href="chat.html?q=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
      }).join('') + '</div></div>' : '') + '</div>'
      : '<div class="card" style="padding:18px;box-shadow:none;border-style:dashed"><p style="margin:0;font-size:14px">' + esc(app.note || 'Đang chuẩn bị kết nối.') + '</p></div>';
    detailEl.innerHTML = '<a href="ket-noi.html" data-back style="display:inline-flex;align-items:center;gap:4px;min-height:32px;text-decoration:none;color:var(--muted);font-size:14px">‹ Kết nối</a>' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:space-between">' +
      '<div style="display:flex;gap:14px;align-items:flex-start;flex:1;min-width:240px">' + logo(app, 56) +
      '<div><h1 style="margin:0;font-size:26px;font-weight:700">' + esc(app.name) + '</h1><p class="muted" style="margin:6px 0 0;font-size:15px;line-height:1.5">' + esc(app.desc) + '</p>' +
      '<p style="margin:8px 0 0">' + (n > 0 ? '<span class="pill pill-ok"><span class="dot"></span>Đã kết nối ' + n + ' tài khoản</span>' : ready ? '<span class="pill">Chưa kết nối</span>' : '<span class="pill">Sắp có</span>') + '</p></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' + btn + (ready ? '<span class="muted" style="font-size:12px">Tối đa 5 tài khoản</span>' : '') + '</div></div>' +
      (notice ? '<p role="status" style="margin:0;padding:10px 12px;border-radius:6px;background:var(--warn-soft);color:var(--warn);font-size:14px">' + esc(notice) + '</p>' : '') +
      (ready && app.note ? '<p style="margin:0;padding:10px 12px;border-radius:6px;background:#F3F3F3;font-size:14px;line-height:1.5">' + esc(app.note) + '</p>' : '') +
      '<p data-detail-msg role="status" style="margin:0;display:none;padding:10px 12px;border-radius:6px;background:#FDE8E3;color:#8A2A12;font-size:14px"></p>' + skill;
  }

  function showView(view, slug, notice) {
    appsView.hidden = view !== 'apps';
    detailEl.hidden = view !== 'detail';
    aiView.hidden = view !== 'ai';
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === (view === 'ai' ? 'ai' : 'apps'))); });
    if (view === 'detail') { renderDetail(slug, notice); window.scrollTo(0, 0); }
  }

  function route(notice) {
    var p = new URLSearchParams(location.search);
    if (p.get('app')) showView('detail', p.get('app'), notice);
    else if (p.get('tab') === 'ai') showView('ai');
    else showView('apps');
  }

  function go(query) { history.pushState(null, '', 'ket-noi.html' + query); route(); }

  function connect(slug, btn) {
    var label = btn.textContent;
    btn.textContent = 'Đang mở trang đăng nhập…';
    btn.disabled = true;
    getJson('/api/connect?toolkit=' + encodeURIComponent(slug) + '&uid=' + encodeURIComponent(uid)).then(function (res) {
      if (res.ok && res.body.redirectUrl) { location.href = res.body.redirectUrl; return; }
      throw new Error(res.body.error || 'Không kết nối được, thử lại sau.');
    }).catch(function (err) {
      btn.textContent = label;
      btn.disabled = false;
      var el = detailEl.hidden ? msgEl : $('[data-detail-msg]');
      showMsg(el, err.message);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var c = t.closest('[data-connect]');
    if (c) { e.stopPropagation(); if (!c.disabled) connect(c.getAttribute('data-connect'), c); return; }
    var cat = t.closest('[data-cat]');
    if (cat) { state.cat = cat.getAttribute('data-cat'); renderList(); return; }
    var f = t.closest('[data-filter]');
    if (f) {
      state.filter = f.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
      renderList(); return;
    }
    var tab = t.closest('[data-tab]');
    if (tab) { go(tab.getAttribute('data-tab') === 'ai' ? '?tab=ai' : ''); return; }
    if (t.closest('[data-back]')) { e.preventDefault(); go(''); return; }
    var a = t.closest('[data-app]');
    if (a) go('?app=' + a.getAttribute('data-app'));
  });
  document.addEventListener('keydown', function (e) {
    var a = e.target.closest && e.target.closest('[data-app]');
    if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go('?app=' + a.getAttribute('data-app')); }
  });
  $('[data-search]').addEventListener('input', function (e) { state.q = e.target.value.trim(); renderList(); });
  window.addEventListener('popstate', function () { route(); });

  function layoutCats() {
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    $('[data-cat-panel]').style.display = narrow ? 'none' : 'block';
    $('[data-cat-chips]').style.display = narrow ? 'flex' : 'none';
  }
  window.addEventListener('resize', layoutCats);
  layoutCats();

  function refreshStatus() {
    return getJson('/api/status?uid=' + encodeURIComponent(uid)).then(function (res) {
      if (res.ok && res.body.accounts) accounts = res.body.accounts;
    }).catch(function () {});
  }

  var justConnected = new URLSearchParams(location.search).get('ket_noi');
  Promise.all([getJson('/api/catalog'), refreshStatus()]).then(function (r) {
    if (!r[0].ok) throw new Error(r[0].body.error || 'Không tải được danh sách ứng dụng.');
    catalog = r[0].body;
    renderList();
    if (justConnected) {
      history.replaceState(null, '', 'ket-noi.html?app=' + encodeURIComponent(justConnected));
      var notice = accounts[justConnected] ? '' : 'Đang chờ Composio xác nhận kết nối…';
      route(notice);
      if (!accounts[justConnected]) {
        setTimeout(function () {
          refreshStatus().then(function () {
            renderList();
            route(accounts[justConnected] ? '' : 'Chưa thấy kết nối hoàn tất. Nếu bạn đã đăng nhập xong, tải lại trang sau vài giây.');
          });
        }, 3000);
      }
    } else {
      route();
    }
  }).catch(function (err) { listEl.innerHTML = '<p style="color:#8A2A12">' + esc(err.message) + '</p>'; });

  // ---------- AI của bạn: OpenRouter ----------
  var orTile = $('[data-or-tile]');
  var OR = window.VPAIOpenRouter;
  function renderOpenRouter() {
    var on = !!(OR && OR.key());
    var badge = $('[data-or-badge]');
    badge.textContent = on ? 'Đã đăng nhập' : 'Chưa đăng nhập';
    badge.className = 'pill' + (on ? ' pill-ok' : '');
    $('[data-or-login]').style.display = on ? 'none' : 'inline-flex';
    $('[data-or-done]').style.display = on ? 'flex' : 'none';
    var brain = $('[data-brain-badge]');
    brain.textContent = on ? 'Đang dùng OpenRouter' : 'Đang dùng credit của app';
    brain.className = 'pill' + (on ? ' pill-ok' : '');
  }
  if (orTile && OR) {
    $('[data-or-login]').addEventListener('click', function (e) { e.target.disabled = true; e.target.textContent = 'Đang mở OpenRouter…'; OR.login(); });
    $('[data-or-logout]').addEventListener('click', function () {
      OR.logout();
      if (store('vpai.aiMode') === 'openrouter') store('vpai.aiMode', null);
      renderOpenRouter();
    });
    OR.handleCallback().then(function (r) {
      if (r === 'connected') { store('vpai.aiMode', 'openrouter'); history.replaceState(null, '', 'ket-noi.html?tab=ai'); route(); }
      renderOpenRouter();
    }).catch(function (err) { showMsg($('[data-or-msg]'), err.message); history.replaceState(null, '', 'ket-noi.html?tab=ai'); route(); renderOpenRouter(); });
  }

  // ---------- AI của bạn: link nối AI (MCP) ----------
  var AI_KEY = 'vpai.aiLink';
  var aiCreate = $('[data-ai-create]');
  var aiInput = $('#ai-link');
  function showAiLink(link) {
    aiInput.value = link;
    $('[data-ai-box]').style.display = 'flex';
    aiCreate.textContent = 'Tạo link mới';
    var b = $('[data-ai-badge]'); b.textContent = 'Đã có link'; b.className = 'pill pill-ok';
  }
  if (store(AI_KEY)) showAiLink(store(AI_KEY));
  aiCreate.addEventListener('click', function () {
    var label = aiCreate.textContent;
    aiCreate.textContent = 'Đang tạo link…';
    aiCreate.disabled = true;
    showMsg($('[data-ai-msg]'), '');
    getJson('/api/mcp-link?uid=' + encodeURIComponent(uid)).then(function (res) {
      if (!res.ok || !res.body.url) throw new Error(res.body.error || 'Không tạo được link, thử lại sau.');
      store(AI_KEY, res.body.url);
      showAiLink(res.body.url);
      aiCreate.disabled = false;
    }).catch(function (err) { aiCreate.textContent = label; aiCreate.disabled = false; showMsg($('[data-ai-msg]'), err.message); });
  });
  $('[data-ai-copy]').addEventListener('click', function (e) {
    var btn = e.target;
    var done = function () { btn.textContent = 'Đã sao chép'; setTimeout(function () { btn.textContent = 'Sao chép'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(aiInput.value).then(done).catch(function () { aiInput.select(); });
    else { aiInput.select(); try { document.execCommand('copy'); done(); } catch (err) {} }
  });
})();
