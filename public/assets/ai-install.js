// "Cài 1 lần bấm" (tab AI của bạn, giống nút Install trên composio.dev): mở thẳng màn thêm connector của AI khách với tên Crewzy + link MCP điền sẵn.
// Link deep link đã kiểm tra 22/11/2026:
//   Claude  https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=…&connectorUrl=… (composio.dev dùng đúng link này;
//           điện thoại đã cài app Claude → mở app; máy tính → claude.ai)
//   Cursor  cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=base64(JSON {type:'http', url})  (tài liệu cursor.com/docs/mcp/install-links)
//   VS Code vscode:mcp/install?<JSON {name, type:'http', url}>
//   ChatGPT, Gemini, Grok chưa có link điền sẵn cho connector tự tạo → tự chép link rồi mở đúng trang cài đặt, khách chỉ dán.
// Chưa có link Crewzy thì tự tạo (GET /api/mcp-link) khi mở tab, lưu localStorage vpai.aiLink (dùng chung connect.js).
(function () {
  var grid = document.querySelector('[data-install-grid]');
  if (!grid) return;
  var msgEl = document.querySelector('[data-install-msg]');
  var KEY = 'vpai.aiLink';
  var uid = window.vpaiUid();
  var creating = null;
  var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(v) { try { if (v === undefined) return localStorage.getItem(KEY); localStorage.setItem(KEY, v); } catch (e) {} return null; }
  function link() { var l = store(); return l && !/\/mcp\/aHR0c/.test(l) ? l : ''; }
  function say(t, ok) { msgEl.hidden = !t; msgEl.textContent = t || ''; msgEl.className = 'ai-install-msg' + (ok ? ' ok' : ''); }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  var AIS = [
    { id: 'claude', name: 'Claude', logo: 'claude', label: 'Cài đặt', where: 'App điện thoại, máy tính, claude.ai',
      go: function (l) { return 'https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Crewzy&connectorUrl=' + encodeURIComponent(l); },
      tip: 'Claude mở màn "Add custom connector" đã điền Crewzy. Bấm Add/Kết nối, rồi trong khung chat bấm + để bật Crewzy.' },
    { id: 'chatgpt', name: 'ChatGPT', logo: 'openai', label: 'Mở và dán', copy: true, where: 'chatgpt.com trên máy tính',
      go: function () { return 'https://chatgpt.com/#settings/Connectors'; },
      tip: 'Đã chép link. Bật Developer mode (Advanced), bấm Create app, đặt tên Crewzy, dán link, chọn No authentication, Tạo.' },
    { id: 'cursor', name: 'Cursor', logo: 'cursor', label: 'Cài đặt', desktop: true, where: 'Cursor trên máy tính',
      go: function (l) { return 'cursor://anysphere.cursor-deeplink/mcp/install?name=Crewzy&config=' + encodeURIComponent(b64(JSON.stringify({ type: 'http', url: l }))); },
      tip: 'Cursor mở hộp cài MCP Crewzy. Bấm Install.' },
    { id: 'vscode', name: 'VS Code', logo: 'visual_studio_code', letter: 'VS', bg: '#0065A9', label: 'Cài đặt', desktop: true, where: 'VS Code (Copilot Chat)',
      go: function (l) { return 'vscode:mcp/install?' + encodeURIComponent(JSON.stringify({ name: 'crewzy', type: 'http', url: l })); },
      tip: 'VS Code mở trang cài máy chủ MCP Crewzy. Bấm Install.' },
    { id: 'claudecode', name: 'Claude Code', logo: 'claude', label: 'Chép lệnh', copyText: function (l) { return 'claude mcp add --transport http --scope user crewzy ' + l; }, where: 'Terminal trên máy tính',
      tip: 'Đã chép lệnh. Dán vào Terminal rồi Enter, mở claude và gõ /mcp để thấy Crewzy.' },
    { id: 'codex', name: 'Codex', logo: 'openai', label: 'Chép lệnh', copyText: function (l) { return 'codex mcp add crewzy --url ' + l; }, where: 'Terminal, VS Code, app ChatGPT máy tính',
      tip: 'Đã chép lệnh. Dán vào Terminal rồi Enter, mở lại Codex.' },
    { id: 'gemini', name: 'Gemini', logo: 'gemini', label: 'Mở và dán', copy: true, where: 'gemini.google.com trên web',
      go: function () { return 'https://gemini.google.com/app'; },
      tip: 'Đã chép link. Settings → Connected Apps → Add a custom app, dán link, Next.' },
    { id: 'grok', name: 'Grok', logo: 'grok', label: 'Mở và dán', copy: true, where: 'grok.com, gói trả phí',
      go: function () { return 'https://grok.com/connectors'; },
      tip: 'Đã chép link. Bấm New Connector → Custom, đặt tên Crewzy, dán link, lưu.' },
    { id: 'any', name: 'AI khác (MCP)', letter: '+', bg: '#0F0F0F', label: 'Chép link MCP', copyText: function (l) { return l; }, where: 'Mọi AI có mục Connectors/MCP',
      tip: 'Đã chép link MCP. Thêm máy chủ kiểu Streamable HTTP, dán link, không cần đăng nhập.' }
  ];

  function icon(a) {
    if (a.letter) return '<span class="ai-ico ai-ico-letter" style="background:' + a.bg + '">' + esc(a.letter) + '</span>';
    return '<img class="ai-ico" src="https://logos.composio.dev/api/' + a.logo + '" alt="" loading="lazy">';
  }
  function render() {
    var list = AIS.filter(function (a) { return !(a.desktop && mobile); }).concat(AIS.filter(function (a) { return a.desktop && mobile; }));
    grid.innerHTML = list.map(function (a) {
      var off = a.desktop && mobile;
      return '<div class="ai-card' + (off ? ' is-off' : '') + '"><div class="ai-card-top">' + icon(a) + '<span class="ai-card-name">' + esc(a.name) + '</span></div>' +
        '<button type="button" class="ai-card-btn" data-install="' + a.id + '"' + (off ? ' disabled' : '') + '>' + (off ? 'Mở trên máy tính' : esc(a.label)) +
        (a.copy || a.copyText ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>' : '') + '</button>' +
        '<p class="ai-card-where">' + esc(a.where) + '</p></div>';
    }).join('');
  }

  function copyNow(text) {
    // Gọi ngay trong lúc bấm (iPhone chỉ cho chép khi đang có thao tác của người dùng).
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(fallback); return true; }
    } catch (e) {}
    return fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(t); return ok;
    }
  }

  function ensureLink() {
    if (link()) return Promise.resolve(link());
    if (creating) return creating;
    creating = fetch('/api/mcp-link?uid=' + encodeURIComponent(uid)).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().then(function (j) { if (!r.ok || !j.url) throw new Error(j.error || 'Chưa tạo được link Crewzy, thử lại sau.'); return j.url; });
    }).then(function (url) {
      store(url);
      var input = document.getElementById('ai-link');
      if (input && !input.value) { input.value = url; var box = document.querySelector('[data-ai-box]'); if (box) box.style.display = 'flex'; }
      if (window.crewzyAiTabs) window.crewzyAiTabs.refresh();
      window.dispatchEvent(new Event('crewzy:ai-link'));
      return url;
    }).finally(function () { creating = null; });
    return creating;
  }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-install]');
    if (!b || b.disabled) return;
    var a = AIS.filter(function (x) { return x.id === b.getAttribute('data-install'); })[0];
    var l = link();
    if (!l) {
      // Chưa có link: tạo xong mới làm được (bấm lại để giữ được quyền chép/mở trên điện thoại).
      b.disabled = true; var old = b.innerHTML; b.textContent = 'Đang chuẩn bị…';
      ensureLink().then(function () { b.disabled = false; b.innerHTML = old; say('Đã chuẩn bị link Crewzy. Bấm lại ' + a.name + ' để cài.', true); })
        .catch(function (err) { b.disabled = false; b.innerHTML = old; say(err.message); });
      return;
    }
    if (a.copyText) { copyNow(a.copyText(l)); say(a.tip, true); return; }
    if (a.copy) copyNow(l);
    say(a.tip, true);
    location.href = a.go(l);
  });

  render();
  // Mở tab AI của bạn là tạo sẵn link (một lần), để mọi nút bấm là chạy ngay.
  // connect.js mở tab sau khi tải danh mục (bất đồng bộ) → theo dõi lúc khối AI hiện ra.
  var view = document.querySelector('[data-view="ai"]');
  function warm() { if (!link() && view && !view.hidden) ensureLink().catch(function (err) { say(err.message); }); }
  if (new URLSearchParams(location.search).get('tab') === 'ai') ensureLink().catch(function (err) { say(err.message); });
  if (view && window.MutationObserver) new MutationObserver(warm).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  warm();
})();
