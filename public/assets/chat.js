// Trang Trợ lý AI (chat.html) — bố cục kiểu Claude/ChatGPT:
//  · Khung chat cuộn riêng, ô soạn tự giãn, gợi ý chỉ hiện khi chưa có tin (không đè lên nhau).
//  · Nút + : tải ảnh/video/tài liệu (lưu Kho qua /api/upload, AI nhìn được ảnh), chọn từ Kho (/api/kho), ứng dụng đã nối + tìm app mới (/api/catalog, /api/status, /api/connect?back=chat).
//  · Micro: ghi âm (MediaRecorder) → /api/giong-noi (Whisper) → gửi luôn như lệnh; trình duyệt không ghi âm được thì dùng nhận giọng nói của trình duyệt.
//  · Loa: đọc to câu trả lời bằng giọng tiếng Việt có sẵn trên máy (speechSynthesis, miễn phí).
//  · Các bước AI dùng công cụ gom thành một dòng "Đã làm N bước" mở ra xem được.
// Lịch sử lưu localStorage vpai.chat; chế độ AI vpai.aiMode, bộ não vpai.brain, khoá vpai.key.<mode>, đọc to crewzy.tts.
(function () {
  var UID_KEY = 'vpai.uid', MODE_KEY = 'vpai.aiMode', CHAT_KEY = 'vpai.chat', TTS_KEY = 'crewzy.tts';
  var UID_PATTERN = /^[a-z0-9-]{8,64}$/;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
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
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(path) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; }

  var uid = getUid();
  var log = document.getElementById('chat-log');
  var thread = $('[data-thread]');
  var form = $('[data-chat-form]');
  var input = document.getElementById('chat-input');
  var sendBtn = $('[data-chat-send]');
  var modeSel = document.getElementById('ai-mode');
  var brainSel = document.getElementById('ai-brain');
  var brainBox = $('[data-brain-box]');
  var keyBox = $('[data-key-box]');
  var keyInput = document.getElementById('ai-key');
  var modeNote = $('[data-mode-note]');
  var orBox = $('[data-or-box]');
  var orModel = document.getElementById('or-model');
  var orLogin = $('[data-or-login]');
  var modelName = $('[data-model-name]');
  var OR = window.VPAIOpenRouter;
  var busy = false, appMode = true, feat = null, controller = null;
  var attachments = []; // {url, kind, name, uploading, local}
  var catalog = null, connected = {};

  // ---------- Lịch sử ----------
  var items = [];
  try { items = JSON.parse(store(CHAT_KEY) || '[]'); } catch (e) { items = []; }
  if (!Array.isArray(items)) items = [];
  function save() { store(CHAT_KEY, JSON.stringify(items.slice(-80))); }

  // ---------- Hiển thị chữ (markdown gọn) ----------
  function shortUrl(u) {
    try { var x = new URL(u); var p = x.pathname.length > 18 ? x.pathname.slice(0, 16) + '…' : x.pathname; return x.hostname.replace(/^www\./, '') + (p === '/' ? '' : p); } catch (e) { return u; }
  }
  function inline(t) {
    var h = esc(t);
    h = h.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, function (m, alt, url) { return '<a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="' + (alt || 'Ảnh') + '" loading="lazy"></a>'; });
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)"']+\.(mp4|webm|mov)(\?[^\s<)"']*)?)/g, function (m, pre, url) { return pre + '<video src="' + url + '" controls playsinline preload="metadata"></video>'; });
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)"']+)/g, function (m, pre, url) {
      var clean = url.replace(/[.,;:!?]+$/, ''), tail = url.slice(clean.length);
      return pre + '<a href="' + clean + '" target="_blank" rel="noopener">' + esc(shortUrl(clean)) + '</a>' + tail;
    });
    return h;
  }
  function formatText(text) {
    var blocks = [], code = null, list = null;
    String(text || '').split('\n').forEach(function (line) {
      if (/^```/.test(line)) {
        if (code) { blocks.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; } else { flush(); code = []; }
        return;
      }
      if (code) { code.push(line); return; }
      var m;
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', i: [] }; } list.i.push(inline(m[1])); return; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', i: [] }; } list.i.push(inline(m[1])); return; }
      flushList();
      if ((m = line.match(/^#{1,4}\s+(.*)$/))) { blocks.push('<h3>' + inline(m[1]) + '</h3>'); return; }
      if (!line.trim()) { blocks.push(''); return; }
      blocks.push('<p>' + inline(line) + '</p>');
    });
    if (code) blocks.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
    flush();
    return blocks.join('').replace(/<\/p><p>/g, '<br>');
    function flushList() { if (list) { blocks.push('<' + list.t + '>' + list.i.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    function flush() { flushList(); }
  }
  function plain(text) {
    return String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, ' ').replace(/[*#`>_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ---------- Vẽ tin nhắn ----------
  var COPY = icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>');
  var SPEAK = icon('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>');
  function fileHtml(f) {
    if (f.kind === 'image') return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '" alt="' + esc(f.name || 'Ảnh đính kèm') + '" loading="lazy"></a>';
    if (f.kind === 'video') return '<video src="' + esc(f.url) + '" muted playsinline preload="metadata"></video>';
    return '<a class="cz-file" href="' + esc(f.url) + '" target="_blank" rel="noopener">📄 <span>' + esc(f.name || 'Tệp') + '</span></a>';
  }
  function aiWrap(inner) {
    var el = document.createElement('div');
    el.className = 'cz-ai';
    el.innerHTML = '<span class="cz-ai-dot" aria-hidden="true">Cz</span><div class="cz-ai-body">' + inner + '</div>';
    return el;
  }
  function renderItem(item) {
    if (item.kind === 'user') {
      var u = document.createElement('div');
      u.className = 'cz-user';
      u.innerHTML = (item.files && item.files.length ? '<div class="cz-files">' + item.files.map(fileHtml).join('') + '</div>' : '') +
        (item.text ? '<div class="cz-msg">' + inline(item.text).replace(/\n/g, '<br>') + '</div>' : '');
      return u;
    }
    if (item.kind === 'assistant') {
      var a = aiWrap('<div class="cz-msg">' + formatText(item.text) + '</div><div class="cz-acts"><button type="button" data-copy title="Chép">' + COPY + '<span class="sr-only">Chép</span></button><button type="button" data-speak title="Đọc to">' + SPEAK + '<span class="sr-only">Đọc to</span></button></div>');
      a.querySelector('[data-copy]').addEventListener('click', function (e) { copyText(item.text, e.currentTarget); });
      a.querySelector('[data-speak]').addEventListener('click', function () { speak(item.text, true); });
      return a;
    }
    if (item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') {
      var tag = item.kind === 'image' ? '<a href="' + esc(item.text) + '" target="_blank" rel="noopener"><img src="' + esc(item.text) + '" alt="Ảnh AI vừa tạo" loading="lazy"></a>'
        : item.kind === 'video' ? '<video src="' + esc(item.text) + '" controls playsinline preload="metadata"></video>'
        : '<audio src="' + esc(item.text) + '" controls preload="metadata" style="width:320px;max-width:100%"></audio>';
      return aiWrap('<div class="cz-media">' + tag + '</div><div style="font-size:13px"><a href="' + esc(item.text) + '" target="_blank" rel="noopener" download>Mở / tải về</a> · <span class="muted">đã lưu vào <a href="kho.html">Kho</a></span></div>');
    }
    if (item.kind === 'steps') {
      var s = aiWrap('');
      s.querySelector('.cz-ai-body').appendChild(stepsEl(item.list, false));
      return s;
    }
    // Mã lỗi kỹ thuật (đã che khoá ở máy chủ) gập lại: khách chụp màn hình gửi là biết nguyên nhân, không cần mở log Cloudflare.
    var err = aiWrap('<div class="cz-err">' + esc(item.text) + (item.detail ? '<details style="margin-top:6px;font-size:12px;opacity:.8"><summary>Mã lỗi kỹ thuật</summary><code style="white-space:pre-wrap;word-break:break-word">' + esc(item.detail) + '</code></details>' : '') + '</div>');
    return err;
  }
  function stepsEl(list, running) {
    var d = document.createElement('details');
    d.className = 'cz-steps';
    var last = list[list.length - 1] || '';
    d.innerHTML = '<summary>' + (running ? '<span class="cz-spin" aria-hidden="true"></span>' + esc(last) : '<span class="cz-ok" aria-hidden="true"></span>Đã làm ' + list.length + ' bước') + '</summary>' +
      '<ol>' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    return d;
  }

  var SUGS = [
    ['Làm bài đăng có ảnh', 'Lấy ảnh thật trong Kho, viết bài và làm ảnh quảng cáo đẹp', 'Xem Kho lưu trữ của tôi, chọn ảnh sản phẩm đẹp nhất, viết 1 bài đăng Facebook theo Brain thương hiệu và làm 1 ảnh quảng cáo Đẹp từ ảnh đó. Chưa đăng, cho tôi xem trước.'],
    ['Lấy ảnh từ website', 'Đọc website, chọn ảnh đẹp lưu vào Kho làm content', 'Đọc website của tôi (link trong Brain thương hiệu), xem các ảnh trên đó, lưu 5 ảnh đẹp nhất vào Kho và gợi ý 3 bài đăng dùng các ảnh này.'],
    ['Làm video ngắn', 'Video dọc 9:16 cho Reels, TikTok từ ảnh thật', 'Làm 1 video dọc 9:16 dài 6 giây từ ảnh sản phẩm đẹp nhất trong Kho, viết kèm caption, nộp vào Việc chờ duyệt.'],
    ['Trả lời bình luận', 'Đọc bình luận mới và soạn câu trả lời', 'Đọc 10 bình luận mới nhất trên Fanpage và soạn câu trả lời theo Brain thương hiệu, cho tôi duyệt trước.'],
    ['Lên lịch nội dung tuần', '7 bài cho 7 ngày, mỗi bài một góc', 'Chạy quy trình lên lịch nội dung tuần: 7 bài cho 7 ngày, mỗi bài một góc khác nhau, nộp vào Việc chờ duyệt.'],
    ['Đã kết nối những gì?', 'Xem app AI đang dùng được', 'Em đang kết nối được những ứng dụng nào của anh/chị? Mỗi app làm được gì cho anh/chị?']
  ];
  function renderEmpty() {
    var el = document.createElement('div');
    el.className = 'cz-empty';
    el.innerHTML = '<div><h2>Hôm nay giao việc gì cho đội AI?</h2><p>Gõ, nói hoặc gửi ảnh. AI dùng các ứng dụng anh/chị đã nối để làm thật.</p></div>' +
      '<div class="cz-sugs">' + SUGS.map(function (s) { return '<button type="button" class="cz-sug" data-sug="' + esc(s[2]) + '"><b style="font-weight:500">' + esc(s[0]) + '</b><small>' + esc(s[1]) + '</small></button>'; }).join('') + '</div>';
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-sug]'); if (b) send(b.getAttribute('data-sug')); });
    return el;
  }
  // Gom các mục 'tool' liền nhau (lịch sử cũ) thành một khối bước.
  function grouped() {
    var out = [], steps = null;
    items.forEach(function (it) {
      if (it.kind === 'tool') { if (!steps) { steps = { kind: 'steps', list: [] }; out.push(steps); } steps.list.push(it.text); return; }
      if (it.kind === 'steps') { out.push(it); steps = null; return; }
      steps = null; out.push(it);
    });
    return out;
  }
  function renderAll() {
    thread.innerHTML = '';
    if (!items.length) thread.appendChild(renderEmpty());
    grouped().filter(function (it) { return it.kind !== 'memo'; }).forEach(function (it) { thread.appendChild(renderItem(it)); });
    scrollEnd();
  }
  // Khung chat cố định (23/11): bàn phím điện thoại mở → co khung chat theo visualViewport, ẩn thanh dưới (style.css html.cz-lock.kb-open).
  (function fitViewport() {
    var root = document.documentElement, vv = window.visualViewport;
    root.classList.add('cz-lock');
    if (!vv) return;
    var fit = function () {
      var kb = window.innerHeight - vv.height > 120;
      root.classList.toggle('kb-open', kb);
      root.style.setProperty('--vvh', vv.height + 'px');
      root.style.setProperty('--vvt', vv.offsetTop + 'px');
      if (kb) requestAnimationFrame(function () { var l = document.getElementById('chat-log'); if (l) l.scrollTop = l.scrollHeight; });
    };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  })();
  function scrollEnd() { requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; }); }
  function add(item) {
    if (!items.length) thread.innerHTML = '';
    items.push(item); save();
    thread.appendChild(renderItem(item));
    scrollEnd();
  }
  function copyText(text, btn) {
    var done = function () { if (btn) { btn.style.color = 'var(--ok)'; setTimeout(function () { btn.style.color = ''; }, 1200); } };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  }

  // ---------- Ô soạn: tự giãn ----------
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 220) + 'px'; updateSend(); }
  input.addEventListener('input', autosize);
  function updateSend() {
    var uploading = attachments.some(function (a) { return a.uploading; });
    sendBtn.disabled = !busy && (uploading || (!input.value.trim() && !attachments.length));
  }

  // ---------- Đính kèm ----------
  var attachList = $('[data-attach-list]');
  var fileInput = $('[data-file]');
  function kindOfType(t) { return /^image\//.test(t) ? 'image' : /^video\//.test(t) ? 'video' : /^audio\//.test(t) ? 'audio' : 'doc'; }
  function renderAttach() {
    attachList.hidden = !attachments.length;
    attachList.innerHTML = attachments.map(function (a, i) {
      var bg = a.kind === 'image' ? ' style="background-image:url(' + esc(a.local || a.url) + ')"' : '';
      var inner = a.kind === 'video' && (a.local || a.url) ? '<video src="' + esc(a.local || a.url) + '" muted playsinline></video>' : a.kind === 'image' ? '' : '📄 <span>' + esc(a.name || 'Tệp') + '</span>';
      return '<div class="cz-chip' + (a.kind === 'image' || a.kind === 'video' ? '' : ' doc') + (a.uploading ? ' busy' : '') + '"' + bg + '>' + inner + (a.uploading ? '<span class="cz-spin" aria-label="Đang tải lên"></span>' : '') +
        '<button type="button" class="cz-chip-x" data-rm="' + i + '" aria-label="Bỏ tệp">×</button></div>';
    }).join('');
    updateSend();
  }
  attachList.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { attachments.splice(Number(b.getAttribute('data-rm')), 1); renderAttach(); } });
  function uploadFile(file) {
    if (attachments.length >= 6) { add({ kind: 'error', text: 'Mỗi tin gửi tối đa 6 tệp.' }); return; }
    var a = { kind: kindOfType(file.type), name: file.name, uploading: true, local: /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : '' };
    attachments.push(a); renderAttach();
    fetch('/api/upload?uid=' + encodeURIComponent(uid) + '&ten=' + encodeURIComponent(file.name.slice(0, 100)), { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.link) throw new Error(res.j.error || 'Chưa tải lên được.');
        a.url = res.j.link; a.kind = res.j.loai || a.kind; a.uploading = false; renderAttach();
      })
      .catch(function (err) {
        var i = attachments.indexOf(a); if (i >= 0) attachments.splice(i, 1);
        renderAttach(); add({ kind: 'error', text: (file.name ? file.name + ': ' : '') + err.message });
      });
  }
  fileInput.addEventListener('change', function () { Array.prototype.forEach.call(fileInput.files, uploadFile); fileInput.value = ''; });
  form.addEventListener('dragover', function (e) { e.preventDefault(); });
  form.addEventListener('drop', function (e) { e.preventDefault(); Array.prototype.forEach.call(e.dataTransfer.files || [], uploadFile); });
  input.addEventListener('paste', function (e) {
    var files = Array.prototype.filter.call((e.clipboardData && e.clipboardData.files) || [], function (f) { return /^image\//.test(f.type); });
    if (files.length) { e.preventDefault(); files.forEach(uploadFile); }
  });

  // ---------- Menu + ----------
  var plusBtn = $('[data-plus]'), plusMenu = $('[data-plus-menu]');
  function openMenu(on) { plusMenu.hidden = !on; plusBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) { var f = plusMenu.querySelector('button'); if (f) f.focus(); } }
  plusBtn.addEventListener('click', function () { openMenu(plusMenu.hidden); });
  document.addEventListener('click', function (e) { if (!plusMenu.hidden && !e.target.closest('[data-plus-menu]') && !e.target.closest('[data-plus]')) openMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !plusMenu.hidden) { openMenu(false); plusBtn.focus(); } });
  plusMenu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    openMenu(false);
    var act = b.getAttribute('data-act');
    if (act === 'file') fileInput.click();
    else if (act === 'kho') openKho();
    else if (act === 'apps') openApps();
    else if (act === 'web') { input.value = 'Đọc website của tôi: https://  — xem các ảnh trên đó, lưu ảnh đẹp vào Kho và gợi ý 3 bài đăng dùng các ảnh này.'; autosize(); input.focus(); input.setSelectionRange(29, 29); }
  });

  // ---------- Kho ----------
  var khoDlg = $('[data-kho]');
  function openKho() {
    var box = $('[data-kho-list]');
    box.innerHTML = '<p class="muted">Đang tải…</p>';
    showDialog(khoDlg);
    fetch('/api/kho?uid=' + encodeURIComponent(uid), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var list = (j.muc || []).filter(function (m) { return m.kind !== 'link'; });
      if (!list.length) { box.innerHTML = '<p class="muted" style="grid-column:1/-1">Kho chưa có gì. Bấm + → Tải ảnh, video, tài liệu, hoặc nhờ AI lấy ảnh từ website của bạn.</p>'; return; }
      box.innerHTML = list.map(function (m, i) {
        var bg = m.kind === 'image' ? ' style="background-image:url(' + esc(m.url) + ')"' : '';
        return '<button type="button" data-k="' + i + '"' + bg + '>' + (m.kind === 'video' ? '<video src="' + esc(m.url) + '" muted playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>' : '') +
          '<span style="position:relative">' + esc(m.name || (m.kind === 'image' ? 'Ảnh' : m.kind === 'video' ? 'Video' : 'Tệp')) + '</span></button>';
      }).join('');
      box.onclick = function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        var m = list[Number(b.getAttribute('data-k'))];
        if (attachments.some(function (a) { return a.url === m.url; }) || attachments.length >= 6) return;
        attachments.push({ url: m.url, kind: m.kind, name: m.name || '' });
        b.setAttribute('aria-pressed', 'true'); renderAttach();
      };
    }).catch(function () { box.innerHTML = '<p class="muted">Chưa tải được Kho.</p>'; });
  }

  // ---------- Ứng dụng ----------
  var appsDlg = $('[data-apps]'), appsQ = $('[data-apps-q]'), appsCount = $('[data-apps-count]');
  function loadApps() {
    return Promise.all([
      catalog ? Promise.resolve(catalog) : fetch('/api/catalog').then(function (r) { return r.json(); }).then(function (j) { catalog = j; return j; }),
      fetch('/api/status?uid=' + encodeURIComponent(uid), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (r) {
      connected = (r[1] && r[1].accounts) || {};
      var n = Object.keys(connected).length;
      appsCount.textContent = n ? n + ' ứng dụng' : 'Nối ứng dụng';
    });
  }
  function appRow(a, on) {
    return '<div class="cz-app"><img src="https://logos.composio.dev/api/' + esc(a.slug) + '" alt="" loading="lazy">' +
      '<div class="cz-app-t"><b>' + esc(a.name) + (on ? ' <span style="color:var(--ok);font-size:12px">● đã nối' + (connected[a.slug] > 1 ? ' ' + connected[a.slug] + ' tài khoản' : '') + '</span>' : '') + '</b><small>' + esc(a.desc || '') + '</small></div>' +
      (on ? '<button type="button" class="btn btn-ghost" data-use="' + esc(a.name) + '">Dùng</button>' : a.status === 'ready' ? '<button type="button" class="btn btn-primary" data-connect="' + esc(a.slug) + '">Kết nối</button>' : '<span class="muted" style="font-size:12px">Sắp có</span>') + '</div>';
  }
  function renderApps() {
    var q = (appsQ.value || '').trim().toLowerCase();
    var apps = (catalog && catalog.apps) || [];
    var match = function (a) { return !q || (a.name + ' ' + a.slug + ' ' + (a.desc || '')).toLowerCase().indexOf(q) >= 0; };
    var on = apps.filter(function (a) { return connected[a.slug] && match(a); });
    var off = apps.filter(function (a) { return !connected[a.slug] && match(a); }).sort(function (a, b) { return (a.status === 'ready' ? 0 : 1) - (b.status === 'ready' ? 0 : 1); }).slice(0, q ? 60 : 24);
    $('[data-apps-list]').innerHTML = (on.length ? '<h3>Đã kết nối · AI dùng được ngay</h3>' + on.map(function (a) { return appRow(a, true); }).join('') : (!q ? '<p class="muted" style="margin:6px 0">Chưa nối ứng dụng nào. Nối Facebook, Gmail, Google Sheets… để AI làm việc thật.</p>' : '')) +
      (off.length ? '<h3>' + (q ? 'Kết quả tìm' : 'Gợi ý kết nối thêm') + '</h3>' + off.map(function (a) { return appRow(a, false); }).join('') : '') +
      (!on.length && !off.length ? '<p class="muted">Không thấy ứng dụng "' + esc(q) + '". <a href="ket-noi.html?tab=mcp">Nối máy chủ MCP khác</a>.</p>' : '') +
      '<p class="muted" style="font-size:12px;margin:10px 0 0">Có ' + apps.filter(function (a) { return a.status === 'ready'; }).length + ' ứng dụng. <a href="ket-noi.html">Mở trang Kết nối</a> để quản lý tài khoản.</p>';
  }
  function openApps() {
    showDialog(appsDlg);
    $('[data-apps-list]').innerHTML = '<p class="muted">Đang tải…</p>';
    loadApps().then(renderApps).catch(function () { $('[data-apps-list]').innerHTML = '<p class="muted">Chưa tải được danh sách.</p>'; });
    setTimeout(function () { appsQ.focus(); }, 50);
  }
  appsQ.addEventListener('input', renderApps);
  $('[data-apps-open]').addEventListener('click', openApps);
  appsDlg.addEventListener('click', function (e) {
    var c = e.target.closest('[data-connect]');
    if (c) {
      c.disabled = true; c.textContent = 'Đang mở…';
      fetch('/api/connect?toolkit=' + encodeURIComponent(c.getAttribute('data-connect')) + '&uid=' + encodeURIComponent(uid) + '&back=chat')
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j.redirectUrl) location.href = j.redirectUrl; else { c.disabled = false; c.textContent = 'Kết nối'; alertIn(j.error || 'Chưa mở được trang kết nối.'); }
        }).catch(function () { c.disabled = false; c.textContent = 'Kết nối'; });
      return;
    }
    var u = e.target.closest('[data-use]');
    if (u) { appsDlg.close(); input.value = (input.value ? input.value + ' ' : '') + 'Dùng ' + u.getAttribute('data-use') + ' để '; autosize(); input.focus(); }
  });
  function alertIn(msg) { var p = document.createElement('p'); p.className = 'cz-err'; p.textContent = msg; $('[data-apps-list]').prepend(p); }

  // ---------- Hộp thoại ----------
  function showDialog(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  document.querySelectorAll('.cz-dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });

  // ---------- Chọn AI ----------
  function keyName(mode) { return 'vpai.key.' + mode; }
  var KEY_HINTS = {
    claude: 'Khoá Claude (console.anthropic.com), bắt đầu bằng sk-ant-',
    openai: 'Khoá ChatGPT (platform.openai.com), bắt đầu bằng sk-',
    gemini: 'Khoá Gemini (aistudio.google.com → Get API key)',
    grok: 'Khoá Grok (console.x.ai), bắt đầu bằng xai-'
  };
  var MODE_LABEL = { app: 'Trợ lý Crewzy', claude: 'Claude (khoá riêng)', openai: 'ChatGPT (khoá riêng)', gemini: 'Gemini (khoá riêng)', grok: 'Grok (khoá riêng)', openrouter: 'OpenRouter' };
  var BRAIN_LABEL = { manh: 'Opus', can_bang: 'Sonnet', tiet_kiem: 'Haiku' };
  if (brainSel) {
    var sb = store('vpai.brain');
    brainSel.value = sb === 'tiet_kiem' || sb === 'can_bang' ? sb : 'manh';
    brainSel.addEventListener('change', function () { store('vpai.brain', brainSel.value); renderMode(); });
  }
  function renderMode() {
    var mode = modeSel.value;
    var needsKey = !!KEY_HINTS[mode];
    keyBox.hidden = !needsKey;
    orBox.hidden = mode !== 'openrouter';
    brainBox.hidden = !(mode === 'app' && appMode);
    modelName.textContent = MODE_LABEL[mode] + (mode === 'app' && appMode ? ' · ' + BRAIN_LABEL[brainSel.value] : '');
    if (mode === 'openrouter') {
      var on = !!(OR && OR.key());
      orModel.hidden = !on; $('[data-or-model-label]').hidden = !on; orLogin.hidden = on;
      modeNote.textContent = on ? 'Đã đăng nhập OpenRouter. Tiền AI tính vào tài khoản OpenRouter của bạn.' : 'Bấm Đăng nhập OpenRouter, đồng ý trên trang OpenRouter rồi quay lại đây.';
    } else if (needsKey) {
      keyInput.value = store(keyName(mode)) || '';
      keyInput.placeholder = KEY_HINTS[mode];
      modeNote.textContent = 'Khoá chỉ lưu trên trình duyệt này, máy chủ không lưu. Tiền AI tính vào tài khoản của bạn.';
    } else {
      modeNote.textContent = !appMode ? 'Chế độ credit của app chưa bật, hãy chọn khoá API riêng.'
        : feat && !feat.tro_ly ? 'Gói hiện tại dùng AI riêng của bạn qua link nối AI. Trợ lý Crewzy có từ gói Cơ bản.'
        : brainSel.value === 'tiet_kiem' ? 'Haiku 5.5: nhanh, tốn ít credit, hợp việc đơn giản (tra cứu, trả lời ngắn).'
        : brainSel.value === 'can_bang' ? 'Sonnet 5.5: viết tốt, điều khiển app ổn, tốn khoảng một nửa credit so với Mạnh nhất. Hợp đăng bài hằng ngày.'
        : 'Opus 5.5: viết nội dung và điều khiển app tốt nhất, tốn credit hơn.';
    }
  }
  modeSel.addEventListener('change', function () { store(MODE_KEY, modeSel.value); renderMode(); });
  orModel.addEventListener('change', function () { store('vpai.or.model', orModel.value); });
  orLogin.addEventListener('click', function () { orLogin.disabled = true; orLogin.textContent = 'Đang mở OpenRouter…'; store(MODE_KEY, 'openrouter'); OR.login(); });
  keyInput.addEventListener('change', function () { store(keyName(modeSel.value), keyInput.value.trim()); });
  $('[data-settings-open]').addEventListener('click', function () { showDialog($('[data-settings]')); });

  // ---------- Đọc to (giọng tiếng Việt của máy) ----------
  var ttsBtn = $('[data-tts]');
  var ttsOn = store(TTS_KEY) === '1';
  var synth = window.speechSynthesis;
  function viVoice() {
    var vs = synth ? synth.getVoices() : [];
    return vs.filter(function (v) { return /^vi(-|_|$)/i.test(v.lang); }).sort(function (a, b) { return (/google|natural|online/i.test(b.name) ? 1 : 0) - (/google|natural|online/i.test(a.name) ? 1 : 0); })[0] || null;
  }
  function speak(text, force) {
    if (!synth || (!ttsOn && !force)) return;
    var t = plain(text).slice(0, 1200);
    if (!t) return;
    synth.cancel();
    var parts = t.match(/[^.!?…\n]{1,220}[.!?…]?/g) || [t];
    var v = viVoice();
    parts.forEach(function (p) { var u = new SpeechSynthesisUtterance(p.trim()); u.lang = 'vi-VN'; if (v) u.voice = v; u.rate = 1.05; synth.speak(u); });
  }
  function renderTts() { ttsBtn.setAttribute('aria-pressed', ttsOn ? 'true' : 'false'); ttsBtn.title = ttsOn ? 'Đang đọc to câu trả lời (bấm để tắt)' : 'Đọc to câu trả lời'; }
  if (!synth) ttsBtn.hidden = true;
  ttsBtn.addEventListener('click', function () { ttsOn = !ttsOn; store(TTS_KEY, ttsOn ? '1' : '0'); renderTts(); if (!ttsOn && synth) synth.cancel(); else speak('Em sẽ đọc to câu trả lời.', true); });
  if (synth && synth.onvoiceschanged !== undefined) synth.onvoiceschanged = function () {};
  renderTts();

  // ---------- Micro: nói để ra lệnh ----------
  var micBtn = $('[data-mic]'), recBox = $('[data-rec]'), recTime = $('[data-rec-time]');
  var rec = null, recChunks = [], recStart = 0, recTimer = null, recStream = null;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!canRecord && !SR) micBtn.hidden = true;
  function pickMime() {
    var list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }
  function setRec(on) {
    micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    micBtn.title = on ? 'Bấm để dừng và gửi' : 'Nói để ra lệnh';
    recBox.hidden = !on;
    clearInterval(recTimer);
    if (on) { recStart = Date.now(); recTimer = setInterval(function () { var s = Math.floor((Date.now() - recStart) / 1000); recTime.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); if (s >= 110) stopRec(); }, 250); }
  }
  function startRec() {
    if (busy) return;
    if (synth) synth.cancel();
    if (!canRecord) return startBrowserSR();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recStream = stream; recChunks = [];
      var mime = pickMime();
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        var blob = new Blob(recChunks, { type: type });
        rec = null; setRec(false);
        if (blob.size < 1200) return;
        transcribe(blob, type);
      };
      rec.start(); setRec(true);
    }).catch(function () {
      if (SR) startBrowserSR(); else add({ kind: 'error', text: 'Chưa dùng được micro. Cho phép trình duyệt dùng micro (biểu tượng ổ khoá cạnh địa chỉ trang) rồi thử lại.' });
    });
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); else if (srObj) srObj.stop(); }
  function transcribe(blob, type) {
    input.placeholder = 'Đang nghe…';
    micBtn.disabled = true;
    fetch('/api/giong-noi?uid=' + encodeURIComponent(uid), { method: 'POST', headers: { 'content-type': type }, body: blob })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Chưa nghe được.');
        var t = (res.j.text || '').trim();
        if (!t) throw new Error('Không nghe rõ, anh/chị nói lại giúp em.');
        send((input.value ? input.value.trim() + ' ' : '') + t);
      })
      .catch(function (err) { add({ kind: 'error', text: err.message }); })
      .then(function () { micBtn.disabled = false; input.placeholder = 'Giao việc cho AI, hoặc bấm micro để nói…'; });
  }
  var srObj = null;
  function startBrowserSR() {
    srObj = new SR(); srObj.lang = 'vi-VN'; srObj.interimResults = true; srObj.continuous = false;
    var finalText = '';
    srObj.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; finalText = t; input.value = t; autosize(); };
    srObj.onend = function () { setRec(false); srObj = null; if (finalText.trim()) send(finalText); };
    srObj.onerror = function () { setRec(false); };
    srObj.start(); setRec(true);
  }
  micBtn.addEventListener('click', function () { if (micBtn.getAttribute('aria-pressed') === 'true') stopRec(); else startRec(); });

  // ---------- Gửi ----------
  function apiMessages() {
    // memo = ghi chú tiến độ máy chủ gửi (không hiện) → gửi lại như tin trợ lý để "tiếp tục" làm đúng chỗ dừng, không làm lại từ đầu.
    return items.filter(function (i) { return i.kind === 'user' || i.kind === 'assistant' || i.kind === 'memo'; })
      .map(function (i) { var m = { role: i.kind === 'memo' ? 'assistant' : i.kind, content: i.text || '' }; if (i.files && i.files.length) m.files = i.files; return m; })
      .slice(-20);
  }
  function setBusy(v) {
    busy = v;
    // Đang làm: nút gửi thành nút DỪNG (ô vuông) bấm được.
    sendBtn.setAttribute('aria-label', v ? 'Dừng' : 'Gửi');
    sendBtn.title = v ? 'Dừng việc AI đang làm' : '';
    sendBtn.innerHTML = v ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>' : icon('<path d="M12 19V5M5 12l7-7 7 7"/>');
    sendBtn.disabled = false; micBtn.disabled = v;
    if (!v) updateSend();
  }
  function send(text) {
    text = (text || '').trim();
    var files = attachments.filter(function (a) { return a.url && !a.uploading; }).map(function (a) { return { url: a.url, kind: a.kind, name: a.name || '' }; });
    if ((!text && !files.length) || busy || attachments.some(function (a) { return a.uploading; })) return;
    var mode = modeSel.value;
    var key = mode === 'app' ? undefined : mode === 'openrouter' ? (OR && OR.key()) : (keyInput.value || store(keyName(mode)) || '').trim();
    if (mode === 'openrouter' && !key) { add({ kind: 'error', text: 'Anh/chị bấm vào tên AI ở trên → Đăng nhập OpenRouter trước nhé.' }); return; }
    if (mode !== 'app' && !key) { add({ kind: 'error', text: 'Anh/chị bấm vào tên AI ở trên và dán khoá API trước nhé.' }); showDialog($('[data-settings]')); return; }
    if (key && mode !== 'openrouter') store(keyName(mode), key);
    add({ kind: 'user', text: text || (files.length ? 'Xem tệp em gửi.' : ''), files: files });
    input.value = ''; attachments = []; renderAttach(); autosize();
    setBusy(true);

    var memo = '', stopped = false;
    controller = window.AbortController ? new AbortController() : null;
    var stepList = [];
    var stepsBox = aiWrap('');
    var stepsBody = stepsBox.querySelector('.cz-ai-body');
    stepsBody.appendChild(stepsEl(['Đang suy nghĩ…'], true));
    thread.appendChild(stepsBox); scrollEnd();
    var spoken = [];
    function closeSteps() {
      if (!stepsBox) return;
      stepsBox.remove(); stepsBox = null;
      if (stepList.length) add({ kind: 'steps', list: stepList.slice() });
      stepList = [];
    }
    function showStep(label) {
      stepList.push(label);
      if (!stepsBox) { stepsBox = aiWrap(''); stepsBody = stepsBox.querySelector('.cz-ai-body'); thread.appendChild(stepsBox); }
      stepsBody.innerHTML = ''; stepsBody.appendChild(stepsEl(stepList, true)); scrollEnd();
    }

    fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid: uid, mode: mode, key: key, model: mode === 'openrouter' ? orModel.value : undefined, brain: mode === 'app' ? brainSel.value : undefined, messages: apiMessages() }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (res.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      var type = res.headers.get('content-type') || '';
      if (!res.ok || type.indexOf('ndjson') === -1) {
        return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'Máy chủ chưa trả lời được, thử lại sau.'); });
      }
      var reader = res.body.getReader(), decoder = new TextDecoder(), buffer = '';
      function handle(line) {
        if (!line.trim()) return;
        var ev; try { ev = JSON.parse(line); } catch (e) { return; }
        if (ev.type === 'tool') { showStep(ev.label); return; }
        if (ev.type === 'memo') { memo = ev.text || ''; return; }
        closeSteps();
        if (ev.type === 'text') { add({ kind: 'assistant', text: ev.text }); spoken.push(ev.text); }
        else if (ev.type === 'image' || ev.type === 'video' || ev.type === 'audio') add({ kind: ev.type, text: ev.url });
        else if (ev.type === 'error') add({ kind: 'error', text: ev.message, detail: ev.detail || '' });
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { handle(buffer); return; }
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(handle);
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      closeSteps();
      if (err && err.name === 'AbortError') { stopped = true; return; }
      add({ kind: 'error', text: err.message });
    }).then(function () {
      closeSteps();
      controller = null;
      if (memo) { items.push({ kind: 'memo', text: memo }); save(); }
      if (stopped) add({ kind: 'assistant', text: 'Đã dừng theo yêu cầu. Việc đã làm xong em ghi lại rồi, anh/chị nhắn "tiếp tục" là em làm tiếp từ chỗ dừng, không làm lại từ đầu.' });
      setBusy(false);
      if (spoken.length) speak(spoken[spoken.length - 1]);
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) input.focus();
    });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); if (busy) { if (controller) controller.abort(); return; } send(input.value); });
  input.addEventListener('keydown', function (e) {
    var mobile = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !mobile) { e.preventDefault(); send(input.value); }
  });
  $('[data-chat-clear]').addEventListener('click', function () {
    if (busy) return;
    if (items.length && !confirmClear()) return;
    items = []; save(); renderAll();
  });
  function confirmClear() { return window.confirm ? window.confirm('Bắt đầu cuộc trò chuyện mới? Cuộc hiện tại sẽ bị xoá khỏi máy này.') : true; }

  // ---------- Khởi động ----------
  var savedMode = store(MODE_KEY);
  if (savedMode && modeSel.querySelector('option[value="' + savedMode + '"]')) modeSel.value = savedMode;
  var savedModel = store('vpai.or.model');
  if (savedModel && orModel.querySelector('option[value="' + savedModel + '"]')) orModel.value = savedModel;
  if (OR) {
    OR.handleCallback().then(function (r) {
      if (r === 'connected') { modeSel.value = 'openrouter'; store(MODE_KEY, 'openrouter'); add({ kind: 'assistant', text: 'Đã đăng nhập OpenRouter. Từ giờ em dùng tài khoản OpenRouter của anh/chị để làm việc.' }); }
      renderMode();
    }).catch(function (err) { add({ kind: 'error', text: err.message }); renderMode(); });
  }
  renderMode(); renderAll(); autosize(); renderAttach();
  loadApps().catch(function () {});

  var qs = new URLSearchParams(location.search);
  if (qs.get('ket_noi')) { add({ kind: 'assistant', text: 'Đã kết nối xong. Anh/chị giao việc cho em dùng ứng dụng vừa nối nhé.' }); }
  var att = qs.get('dinh_kem');
  if (att && /^https:\/\//.test(att)) attachments.push({ url: att, kind: qs.get('loai') || 'image', name: qs.get('ten') || '' });
  var preset = qs.get('q');
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  renderAttach();
  if (preset) { input.value = preset.slice(0, 2000); autosize(); setTimeout(function () { send(input.value); }, 400); }

  fetch('/api/chat').then(function (r) { return r.json(); }).then(function (j) {
    appMode = !!j.appMode;
    var opt = modeSel.querySelector('option[value="app"]');
    if (!appMode) {
      opt.disabled = true; opt.textContent = 'Credit của app (chưa bật)';
      if (modeSel.value === 'app') { modeSel.value = 'claude'; store(MODE_KEY, 'claude'); }
    }
    renderMode();
  }).catch(function () {});
  // Tính năng theo gói: bộ não Opus từ gói Tăng trưởng.
  fetch('/api/billing', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.bat || !j.tinh_nang) return;
    feat = j.tinh_nang;
    var o = brainSel.querySelector('option[value="manh"]');
    if (!feat.opus && o) { o.disabled = true; o.textContent = 'Mạnh nhất · Opus 5.5 (từ gói Tăng trưởng)'; if (brainSel.value === 'manh') { brainSel.value = 'can_bang'; store('vpai.brain', 'can_bang'); } }
    renderMode();
  }).catch(function () {});
})();
