// Trang Thiết lập Crewzy (bat-dau.html): Brain → kênh → AI → thanh toán. Trạng thái lấy từ GET /api/onboarding (máy chủ quyết định, không tin trình duyệt).
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = window.crewzyPay.esc;
  var ORDER = ['brand', 'channel', 'ai', 'paid'];
  var CHANNELS = [
    ['facebook', 'Facebook Fanpage'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'],
    ['gmail', 'Gmail'], ['metaads', 'Quảng cáo Meta'], ['googleads', 'Google Ads'], ['tiktok', 'TikTok', 'soon'],
  ];
  var state = null, view = null, pollTimer = null, aiLink = '';

  function api(path, opts) {
    return fetch(path, Object.assign({ cache: 'no-store', headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().then(function (j) { if (r.status === 401 && j.login && window.vpaiNeedLogin) window.vpaiNeedLogin(); return { ok: r.ok, j: j }; }); });
  }
  function msg(sel, text, kind) { var el = $(sel); if (!el) return; el.textContent = text || ''; el.className = 'ob-msg' + (kind ? ' ' + kind : ''); }

  function firstOpen(st) { for (var i = 0; i < ORDER.length; i++) if (!st.steps[ORDER[i]]) return ORDER[i]; return 'done'; }
  function render() {
    var st = state;
    document.querySelectorAll('[data-go]').forEach(function (b) {
      var k = b.getAttribute('data-go');
      b.setAttribute('data-state', st.steps[k] ? 'done' : k === view ? 'current' : '');
      b.innerHTML = '<b>' + (st.steps[k] ? '✓ XONG' : 'BƯỚC ' + (ORDER.indexOf(k) + 1)) + '</b>' + b.textContent.replace(/^(✓ XONG|BƯỚC \d)/, '');
    });
    document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== view; });
    if (view === 'brand') loadBrand();
    if (view === 'channel') drawApps();
    if (view === 'ai') startAiPoll();
    if (view === 'paid') { loadPlans(); showTrial(); }
  }
  function refresh(goNext) {
    return api('/api/onboarding').then(function (res) {
      if (!res.ok) { $('[data-fatal]').hidden = false; $('[data-fatal]').textContent = res.j.error || 'Chưa tải được, thử lại.'; return; }
      state = res.j;
      if (!state.required) { location.replace('index.html'); return; }
      if (state.done) { view = 'done'; render(); return; }
      if (goNext || !view || view === 'done' || state.steps[view]) view = firstOpen(state);
      render();
    });
  }

  // ---- Bước 1: Brain ----
  var brandLoaded = false, brandAll = {};
  function loadBrand() {
    if (brandLoaded) return;
    brandLoaded = true;
    api('/api/brand').then(function (res) {
      brandAll = (res.j && res.j.brand) || {};
      var f = $('[data-brand]');
      ['name', 'industry', 'products', 'customers', 'voice'].forEach(function (k) { if (brandAll[k]) f.elements[k].value = brandAll[k]; });
      if (brandAll.links) $('[data-web]').value = String(brandAll.links).split(/\s/)[0];
    });
  }
  $('[data-autofill]').addEventListener('click', function (e) {
    var url = $('[data-web]').value.trim();
    if (!url) { msg('[data-web-msg]', 'Dán link website trước.', 'err'); return; }
    e.target.disabled = true; msg('[data-web-msg]', 'Đang đọc website…');
    api('/api/onboarding/brand-from-web', { method: 'POST', body: JSON.stringify({ url: url }) }).then(function (res) {
      e.target.disabled = false;
      if (!res.ok) { msg('[data-web-msg]', res.j.error || 'Chưa đọc được website.', 'err'); return; }
      var f = $('[data-brand]');
      Object.keys(res.j.brand || {}).forEach(function (k) {
        if (f.elements[k] && !f.elements[k].value.trim()) f.elements[k].value = res.j.brand[k];
        else if (!f.elements[k]) brandAll[k] = brandAll[k] || res.j.brand[k];
      });
      msg('[data-web-msg]', res.j.ghi_chu || 'Đã điền sẵn, kiểm tra lại rồi bấm Lưu.', 'ok');
    }).catch(function () { e.target.disabled = false; msg('[data-web-msg]', 'Mất kết nối, thử lại.', 'err'); });
  });
  $('[data-brand]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('[type=submit]');
    var brand = Object.assign({}, brandAll);
    ['name', 'industry', 'products', 'customers', 'voice'].forEach(function (k) { brand[k] = f.elements[k].value.trim(); });
    var web = $('[data-web]').value.trim();
    if (web && !String(brand.links || '').includes(web)) brand.links = (web + ' ' + (brand.links || '')).trim();
    btn.disabled = true; msg('[data-brand-msg]', 'Đang lưu…');
    api('/api/brand', { method: 'POST', body: JSON.stringify({ brand: brand }) }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { msg('[data-brand-msg]', res.j.error || 'Chưa lưu được.', 'err'); return; }
      brandAll = res.j.brand || brand;
      msg('[data-brand-msg]', 'Đã lưu.', 'ok');
      refresh(true);
    });
  });

  // ---- Bước 2: kênh ----
  function drawApps() {
    var on = (state.chi_tiet && state.chi_tiet.kenh) || [];
    $('[data-apps]').innerHTML = CHANNELS.map(function (c) {
      return '<button type="button" class="ob-app" data-app="' + c[0] + '"' + (on.indexOf(c[0]) >= 0 ? ' data-on="1"' : '') + (c[2] ? ' disabled' : '') + '>' +
        '<img src="https://logos.composio.dev/api/' + c[0] + '" alt="" loading="lazy"><span>' + esc(c[1]) + '<br><small class="muted">' +
        (c[2] ? 'Sắp có' : on.indexOf(c[0]) >= 0 ? 'Đã kết nối' : 'Bấm để kết nối') + '</small></span></button>';
    }).join('');
    $('[data-apps]').querySelectorAll('[data-app]:not([disabled])').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true; msg('[data-channel-msg]', 'Đang mở trang đăng nhập…');
        api('/api/connect?toolkit=' + encodeURIComponent(b.getAttribute('data-app')) + '&back=bat-dau').then(function (res) {
          if (res.ok && res.j.redirectUrl) { location.href = res.j.redirectUrl; return; }
          b.disabled = false; msg('[data-channel-msg]', res.j.error || 'Chưa mở được trang đăng nhập.', 'err');
        });
      });
    });
    if (on.length) msg('[data-channel-msg]', 'Đã kết nối: ' + on.join(', '), 'ok');
  }

  // ---- Bước 3: AI ----
  function getLink() {
    if (aiLink) return Promise.resolve(aiLink);
    return api('/api/mcp-link').then(function (res) { if (!res.ok || !res.j.url) throw new Error(res.j.error || 'Chưa tạo được link.'); aiLink = res.j.url; try { localStorage.setItem('vpai.aiLink', aiLink); } catch (e) {} return aiLink; });
  }
  function startAiPoll() {
    getLink().catch(function (e) { msg('[data-ai-msg]', e.message, 'err'); });
    clearTimeout(pollTimer);
    var tick = function () {
      if (view !== 'ai') return;
      api('/api/onboarding').then(function (res) {
        if (res.ok && res.j.steps && res.j.steps.ai) { refresh(true); return; }
        pollTimer = setTimeout(tick, 5000);
      }).catch(function () { pollTimer = setTimeout(tick, 8000); });
    };
    pollTimer = setTimeout(tick, 5000);
  }
  $('[data-claude]').addEventListener('click', function () {
    var w = window.open('about:blank', '_blank');
    getLink().then(function (l) {
      var u = 'https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Crewzy&connectorUrl=' + encodeURIComponent(l);
      if (w) w.location = u; else location.href = u;
      $('[data-ai-wait]').hidden = false;
    }).catch(function (e) { if (w) w.close(); msg('[data-ai-msg]', e.message, 'err'); });
  });
  $('[data-copy-link]').addEventListener('click', function (e) {
    var btn = e.target;
    getLink().then(function (l) { window.crewzyPay.copy(l, btn); $('[data-ai-wait]').hidden = false; }).catch(function (er) { msg('[data-ai-msg]', er.message, 'err'); });
  });
  $('[data-use-crewzy]').addEventListener('click', function (e) {
    e.target.disabled = true;
    api('/api/onboarding', { method: 'POST', body: JSON.stringify({ ai: 'crewzy' }) }).then(function () { refresh(true); });
  });

  // ---- Bước 4: dùng thử miễn phí (1 lần/tài khoản) hoặc thanh toán ----
  function showTrial() {
    var box = $('[data-trial]'), t = state && state.dung_thu;
    if (!box) return;
    box.hidden = !t;
    box.style.display = t ? 'flex' : 'none';
    if (t) $('[data-trial-title]').textContent = 'Dùng thử ' + t.ngay + ' ngày · ' + t.credits + ' credit';
  }
  $('[data-trial-start]').addEventListener('click', function (e) {
    var b = e.target, m = $('[data-trial-msg]');
    b.disabled = true; b.textContent = 'Đang kích hoạt…'; m.style.display = 'none';
    api('/api/onboarding', { method: 'POST', body: JSON.stringify({ trial: true }) }).then(function (res) {
      if (!res.ok) { b.disabled = false; b.textContent = 'Dùng thử miễn phí'; m.textContent = res.j.error || 'Chưa kích hoạt được, thử lại sau.'; m.style.display = 'block'; return; }
      refresh(true);
    });
  });

  // ---- Bước 4: thanh toán ----
  var plansLoaded = false;
  function loadPlans() {
    if (plansLoaded) return;
    plansLoaded = true;
    api('/api/billing').then(function (res) {
      if (!res.ok) { $('[data-plans]').innerHTML = '<p class="ob-msg err">' + esc(res.j.error || 'Chưa tải được gói.') + '</p>'; return; }
      if (!res.j.thanh_toan_mo) $('[data-order]').innerHTML = '<p class="ob-msg err">Thanh toán chuyển khoản chưa mở. Liên hệ Crewzy để được kích hoạt gói.</p>';
      window.crewzyPay.plans($('[data-plans]'), res.j, function (item) {
        $('[data-order]').scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.crewzyPay.order($('[data-order]'), item, function () { setTimeout(function () { refresh(true); }, 1200); });
      });
      var pend = (res.j.don || []).find(function (d) { return d.status === 'pending' && d.qr; });
      if (pend) window.crewzyPay.show($('[data-order]'), pend, function () { setTimeout(function () { refresh(true); }, 1200); });
    });
  }

  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { if (!state) return; view = b.getAttribute('data-go'); render(); });
  });
  refresh(false);
})();
