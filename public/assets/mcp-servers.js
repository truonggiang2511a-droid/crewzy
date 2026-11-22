// Tab "MCP khác" ở trang Kết nối: khách điền tên máy chủ + link MCP → Kết nối (giống Add custom connector của Claude).
// Gọi /api/mcp-servers; máy chủ cần đăng nhập thì chuyển sang trang đăng nhập của app đó, xong quay về ?tab=mcp&mcp=ok|err.
(function () {
  // Danh bạ máy chủ MCP lấy từ /api/catalog (src/lib/mcpDirectory.js, đã thử nối 22/11/2026).
  // Máy chủ ngoai (Canva, vidIQ, HubSpot…) chỉ nhận Claude/ChatGPT → hiện riêng, khách sao chép link thêm vào AI của họ.
  var PICKS = [];
  var AUTH_LABEL = { none: 'Không cần đăng nhập', token: 'Dùng token', oauth: 'Đã đăng nhập' };

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var form = $('[data-mcp-form]');
  if (!form) return;
  var listEl = $('[data-mcp-list]');
  var msgEl = $('[data-mcp-msg]');
  var submit = $('[data-mcp-submit]');
  var uid = window.vpaiUid();
  var loaded = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(text, ok) {
    msgEl.textContent = text || '';
    msgEl.style.display = text ? 'block' : 'none';
    msgEl.style.background = ok ? 'var(--ok-soft)' : '#FDE8E3';
    msgEl.style.color = ok ? 'var(--ok)' : '#8A2A12';
  }
  function api(method, body) {
    var opts = method === 'GET' ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: uid }, body)) };
    var url = '/api/mcp-servers' + (method === 'GET' ? '?uid=' + encodeURIComponent(uid) : '');
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().catch(function () { return { error: 'Máy chủ chưa sẵn sàng, thử lại sau.' }; }).then(function (b) { return { ok: r.ok, body: b }; });
    });
  }

  function icon(p) {
    return p.logo ? '<img src="https://logos.composio.dev/api/' + esc(p.logo) + '" alt="" style="width:20px;height:20px;border-radius:4px">'
      : '<span aria-hidden="true" style="width:20px;height:20px;border-radius:4px;background:' + esc(p.bg || '#111') + ';color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + esc(p.letter || p.name[0]) + '</span>';
  }
  function directory(list) {
    PICKS = (list || []).filter(function (p) { return !p.ngoai; });
    var out = (list || []).filter(function (p) { return p.ngoai; });
    $('[data-mcp-picks]').innerHTML = PICKS.map(function (p, i) {
      return '<button type="button" class="btn btn-ghost" data-mcp-pick="' + i + '" style="gap:8px">' + icon(p) + esc(p.name) +
        '<span class="muted" style="font-size:12px;font-weight:400">' + (p.auth === 'none' ? 'Không cần đăng nhập' : 'Đăng nhập ' + esc(p.name)) + '</span></button>';
    }).join('');
    var box = $('[data-mcp-outside]');
    if (box) {
      box.hidden = !out.length;
      $('[data-mcp-outside-list]').innerHTML = out.map(function (p) {
        return '<span class="btn btn-ghost" style="gap:8px;cursor:default;flex-wrap:wrap;max-width:100%;height:auto;padding-top:6px;padding-bottom:6px">' + icon(p) + esc(p.name) +
          '<button type="button" class="btn btn-ghost" data-mcp-copy="' + esc(p.url) + '" style="min-height:28px;padding:0 8px;font-size:12px">Sao chép link</button>' +
          (p.alt ? '<a href="ket-noi.html?app=' + esc(p.alt) + '" style="font-size:12px">hoặc nối qua Composio</a>' : '') + '</span>';
      }).join('');
    }
  }

  function render(servers) {
    if (!servers.length) {
      listEl.innerHTML = '<p class="muted" style="margin:0;font-size:14px">Chưa nối máy chủ MCP nào. Điền tên và link ở trên, hoặc bấm một mục Điền nhanh.</p>';
      return;
    }
    listEl.innerHTML = servers.map(function (s) {
      var names = (s.toolNames || []).slice(0, 12).map(esc).join(', ') + ((s.toolNames || []).length > 12 ? '…' : '');
      return '<div style="padding:12px;border:1px solid var(--line, #E8E8E8);border-radius:8px;display:flex;flex-direction:column;gap:6px">' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
        '<p style="margin:0;font-weight:600;flex:1;min-width:140px">' + esc(s.name) + '</p>' +
        (s.error ? '<span class="pill pill-warn">Lỗi</span>' : '<span class="pill pill-ok">' + s.tools + ' công cụ</span>') +
        '<span class="pill">' + esc(AUTH_LABEL[s.auth] || s.auth) + '</span></div>' +
        '<p class="muted" style="margin:0;font-size:12px;word-break:break-all">' + esc(s.url) + '</p>' +
        (s.error ? '<p style="margin:0;font-size:13px;color:#8A2A12">' + esc(s.error) + '</p>' : '') +
        (names ? '<p class="muted" style="margin:0;font-size:12px;line-height:1.5">Công cụ: ' + names + '</p>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-ghost" data-mcp-test="' + esc(s.id) + '">Kiểm tra lại</button>' +
        (s.error && s.auth === 'oauth' ? '<button type="button" class="btn btn-primary" data-mcp-reconnect="' + esc(s.id) + '">Đăng nhập lại</button>' : '') +
        '<button type="button" class="btn btn-ghost" data-mcp-remove="' + esc(s.id) + '">Gỡ</button></div></div>';
    }).join('');
    listEl._servers = servers;
  }

  function load() {
    api('GET').then(function (res) {
      if (!res.ok) throw new Error(res.body.error || 'Không tải được danh sách.');
      render(res.body.servers || []);
    }).catch(function (err) { listEl.innerHTML = '<p style="margin:0;font-size:14px;color:#8A2A12">' + esc(err.message) + '</p>'; });
  }

  function add(name, url, token) {
    say('');
    submit.disabled = true;
    submit.textContent = 'Đang kết nối…';
    api('POST', { action: 'add', name: name, url: url, token: token || undefined }).then(function (res) {
      if (res.body.authUrl) { submit.textContent = 'Đang mở trang đăng nhập…'; location.href = res.body.authUrl; return; }
      if (!res.ok) throw new Error(res.body.error || 'Chưa nối được.');
      say('Đã nối ' + res.body.server.name + ' (' + res.body.server.tools + ' công cụ). Vào Trợ lý AI để dùng.', true);
      form.reset();
      load();
      submit.disabled = false; submit.textContent = 'Kết nối';
    }).catch(function (err) {
      say(err.message);
      submit.disabled = false; submit.textContent = 'Kết nối';
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = form.url.value.trim();
    if (!/^https:\/\//i.test(url)) { say('Link MCP phải bắt đầu bằng https://'); form.url.focus(); return; }
    add(form.name.value.trim(), url, form.token.value.trim());
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var pick = t.closest('[data-mcp-pick]');
    if (pick) {
      var p = PICKS[Number(pick.getAttribute('data-mcp-pick'))];
      form.name.value = p.name; form.url.value = p.url; form.url.focus();
      say('');
      return;
    }
    var cp = t.closest('[data-mcp-copy]');
    if (cp) {
      var link = cp.getAttribute('data-mcp-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { cp.textContent = 'Đã chép'; }, function () { window.prompt('Sao chép link MCP:', link); });
      return;
    }
    var rm = t.closest('[data-mcp-remove]');
    if (rm) {
      rm.disabled = true;
      api('POST', { action: 'remove', id: rm.getAttribute('data-mcp-remove') }).then(load);
      return;
    }
    var test = t.closest('[data-mcp-test]');
    if (test) {
      test.disabled = true; test.textContent = 'Đang kiểm tra…';
      api('POST', { action: 'test', id: test.getAttribute('data-mcp-test') }).then(load);
      return;
    }
    var re = t.closest('[data-mcp-reconnect]');
    if (re) {
      var s = (listEl._servers || []).filter(function (x) { return x.id === re.getAttribute('data-mcp-reconnect'); })[0];
      if (s) add(s.name, s.url);
    }
  });

  // Quay về từ trang đăng nhập của app kia.
  var q = new URLSearchParams(location.search);
  if (q.get('mcp')) {
    say(q.get('msg') || (q.get('mcp') === 'ok' ? 'Đã nối.' : 'Chưa nối được.'), q.get('mcp') === 'ok');
    history.replaceState(null, '', 'ket-noi.html?tab=mcp');
  }

  // Bấm thẻ MCP ở lưới Kết nối → ?tab=mcp&ten=&url= : điền sẵn ô, khách chỉ bấm Kết nối.
  function prefill(params) {
    if (!params || !params.get('url')) return;
    form.name.value = params.get('ten') || '';
    form.url.value = params.get('url');
    say('Đã điền sẵn ' + (params.get('ten') || 'máy chủ') + '. Bấm Kết nối để nối vào Crewzy.', true);
    form.scrollIntoView({ block: 'center' });
  }
  if (window.crewzyCatalog) directory(window.crewzyCatalog.mcp);
  window.crewzyMcp = { directory: directory, show: function (params) { prefill(params); if (!loaded) { loaded = true; load(); } } };
})();
