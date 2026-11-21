// Trang Kết nối công cụ: kết nối thật qua Composio (hàm /api/connect, /api/status) và tạo link nối AI (/api/mcp-link).
// Đã bật đăng nhập Google thì máy chủ lấy mã khách từ phiên; chưa bật thì dùng mã trình duyệt lưu trong localStorage.
(function () {
  var UID_KEY = 'vpai.uid';
  var AI_KEY = 'vpai.aiLink';
  var UID_PATTERN = /^[a-z0-9-]{8,64}$/;
  var MAX_ACCOUNTS = 5;
  var TEMPLATE_NEEDS = ['facebook', 'instagram', 'youtube'];
  var accounts = {};

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }

  function getUid() {
    var id = store(UID_KEY);
    if (!id || !UID_PATTERN.test(id)) {
      id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).toLowerCase();
      store(UID_KEY, id);
    }
    return id;
  }

  var uid = getUid();

  function getJson(path) {
    return fetch(path).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json()
        .catch(function () { return { error: 'Máy chủ chưa sẵn sàng, thử lại sau.' }; })
        .then(function (body) { return { ok: r.ok, body: body }; });
    });
  }

  function showMsg(el, text) {
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
  }

  function renderTile(tile) {
    var slug = tile.getAttribute('data-real-tile');
    var count = accounts[slug] || 0;
    var badge = tile.querySelector('[data-real-count]');
    var btn = tile.querySelector('[data-real-connect]');
    if (count > 0) {
      badge.textContent = count + ' tài khoản';
      badge.style.background = '#E3F4E8';
      badge.style.color = '#14612D';
      tile.style.borderColor = '#A8DDB8';
      btn.textContent = count >= MAX_ACCOUNTS ? 'Đã đủ 5 tài khoản' : 'Thêm tài khoản';
      btn.disabled = count >= MAX_ACCOUNTS;
      btn.style.background = '#FFFFFF';
      btn.style.color = '#1B2230';
      btn.style.border = '1px solid #CBD2DC';
      btn.style.cursor = btn.disabled ? 'default' : 'pointer';
    } else {
      badge.textContent = 'Chưa kết nối';
      btn.textContent = 'Kết nối';
      btn.disabled = false;
    }
  }

  function renderReady() {
    var orKey = window.VPAIOpenRouter && window.VPAIOpenRouter.key();
    var done = (store(AI_KEY) || orKey ? 1 : 0);
    TEMPLATE_NEEDS.forEach(function (slug) { if (accounts[slug]) done += 1; });
    var countEl = document.querySelector('[data-ready-count]');
    if (countEl) countEl.textContent = String(done);
    var ready = document.querySelector('[data-run-ready]');
    var wait = document.querySelector('[data-run-wait]');
    var missing = document.querySelector('[data-run-missing]');
    if (ready && wait) {
      ready.style.display = done >= 4 ? 'inline-flex' : 'none';
      wait.style.display = done >= 4 ? 'none' : 'inline-block';
      if (missing) missing.textContent = String(4 - done);
    }
  }

  function renderAll() {
    document.querySelectorAll('[data-real-tile]').forEach(renderTile);
    renderReady();
  }

  function refresh(final) {
    return getJson('/api/status?uid=' + encodeURIComponent(uid)).then(function (res) {
      if (res.ok && res.body.accounts) accounts = res.body.accounts;
      renderAll();
      var just = new URLSearchParams(location.search).get('ket_noi');
      if (final && just && !accounts[just]) {
        var tile = document.querySelector('[data-real-tile="' + just + '"]');
        if (tile) showMsg(tile.querySelector('[data-real-msg]'), 'Chưa thấy kết nối hoàn tất. Nếu bạn đã đăng nhập xong, tải lại trang sau vài giây.');
      }
    }).catch(function () {});
  }

  // Bấm kết nối một công cụ
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-real-connect]');
    if (!btn || btn.disabled) return;
    var slug = btn.getAttribute('data-real-connect');
    var tile = btn.closest('[data-real-tile]');
    var msg = tile.querySelector('[data-real-msg]');
    var label = btn.textContent;
    btn.textContent = 'Đang mở trang đăng nhập…';
    btn.disabled = true;
    showMsg(msg, '');
    getJson('/api/connect?toolkit=' + encodeURIComponent(slug) + '&uid=' + encodeURIComponent(uid)).then(function (res) {
      if (res.ok && res.body.redirectUrl) {
        window.location.href = res.body.redirectUrl;
        return;
      }
      throw new Error(res.body.error || 'Không kết nối được, thử lại sau.');
    }).catch(function (err) {
      btn.textContent = label;
      btn.disabled = false;
      showMsg(msg, err.message);
    });
  });

  // Link nối AI
  var aiCreate = document.querySelector('[data-ai-create]');
  var aiBox = document.querySelector('[data-ai-box]');
  var aiMsg = document.querySelector('[data-ai-msg]');
  var aiBadge = document.querySelector('[data-ai-badge]');
  var aiInput = document.getElementById('ai-link');
  var aiCopy = document.querySelector('[data-ai-copy]');

  function showAiLink(link) {
    aiInput.value = link;
    aiBox.style.display = 'flex';
    aiCreate.textContent = 'Tạo link mới';
    aiBadge.textContent = 'Đã có link';
    aiBadge.style.background = '#E3F4E8';
    aiBadge.style.color = '#14612D';
  }

  if (aiCreate) {
    var saved = store(AI_KEY);
    if (saved) showAiLink(saved);

    aiCreate.addEventListener('click', function () {
      var label = aiCreate.textContent;
      aiCreate.textContent = 'Đang tạo link…';
      aiCreate.disabled = true;
      showMsg(aiMsg, '');
      getJson('/api/mcp-link?uid=' + encodeURIComponent(uid)).then(function (res) {
        if (!res.ok || !res.body.url) throw new Error(res.body.error || 'Không tạo được link, thử lại sau.');
        store(AI_KEY, res.body.url);
        showAiLink(res.body.url);
        aiCreate.disabled = false;
        renderReady();
      }).catch(function (err) {
        aiCreate.textContent = label;
        aiCreate.disabled = false;
        showMsg(aiMsg, err.message);
      });
    });

    aiCopy.addEventListener('click', function () {
      var done = function () {
        aiCopy.textContent = 'Đã sao chép';
        setTimeout(function () { aiCopy.textContent = 'Sao chép'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(aiInput.value).then(done).catch(function () { aiInput.select(); });
      } else {
        aiInput.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
      }
    });
  }

  // Đăng nhập OpenRouter (bộ não cho Trợ lý AI)
  var orTile = document.querySelector('[data-or-tile]');
  function renderOpenRouter() {
    if (!orTile || !window.VPAIOpenRouter) return;
    var on = !!window.VPAIOpenRouter.key();
    var badge = orTile.querySelector('[data-or-badge]');
    badge.textContent = on ? 'Đã đăng nhập' : 'Chưa đăng nhập';
    badge.style.background = on ? '#E3F4E8' : '#EEF0F3';
    badge.style.color = on ? '#14612D' : '#3F4652';
    orTile.style.borderColor = on ? '#A8DDB8' : '#E3E6EB';
    orTile.querySelector('[data-or-login]').style.display = on ? 'none' : 'block';
    orTile.querySelector('[data-or-done]').style.display = on ? 'flex' : 'none';
    var brain = document.querySelector('[data-brain-badge]');
    if (brain) {
      brain.textContent = on ? 'Đang dùng OpenRouter' : 'Đang dùng credit của app';
      brain.style.background = on ? '#E3F4E8' : '#EEF0F3';
      brain.style.color = on ? '#14612D' : '#3F4652';
    }
    renderReady();
  }
  if (orTile && window.VPAIOpenRouter) {
    var orMsg = orTile.querySelector('[data-or-msg]');
    orTile.querySelector('[data-or-login]').addEventListener('click', function (e) {
      e.target.disabled = true;
      e.target.textContent = 'Đang mở OpenRouter…';
      window.VPAIOpenRouter.login();
    });
    orTile.querySelector('[data-or-logout]').addEventListener('click', function () {
      window.VPAIOpenRouter.logout();
      try { if (localStorage.getItem('vpai.aiMode') === 'openrouter') localStorage.removeItem('vpai.aiMode'); } catch (e) {}
      renderOpenRouter();
    });
    window.VPAIOpenRouter.handleCallback().then(function (r) {
      if (r === 'connected') {
        try { localStorage.setItem('vpai.aiMode', 'openrouter'); } catch (e) {}
        showMsg(orMsg, '');
      }
      renderOpenRouter();
    }).catch(function (err) {
      showMsg(orMsg, err.message);
      renderOpenRouter();
    });
  }

  renderAll();
  var returning = new URLSearchParams(location.search).get('ket_noi');
  refresh(!returning);
  if (returning) setTimeout(function () { refresh(true); }, 3000);
})();
