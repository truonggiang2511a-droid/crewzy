// Trang Trợ lý AI: khung chat gọi /api/chat, hiện từng bước AI dùng công cụ Composio.
(function () {
  var UID_KEY = 'vpai.uid';
  var MODE_KEY = 'vpai.aiMode';
  var CHAT_KEY = 'vpai.chat';
  var UID_PATTERN = /^[a-z0-9-]{8,64}$/;

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

  var uid = getUid();
  var log = document.getElementById('chat-log');
  var form = document.querySelector('[data-chat-form]');
  var input = document.getElementById('chat-input');
  var sendBtn = document.querySelector('[data-chat-send]');
  var modeSel = document.getElementById('ai-mode');
  var keyBox = document.querySelector('[data-key-box]');
  var keyInput = document.getElementById('ai-key');
  var modeNote = document.querySelector('[data-mode-note]');
  var orBox = document.querySelector('[data-or-box]');
  var orModel = document.getElementById('or-model');
  var brainSel = document.getElementById('ai-brain');
  var brainBox = document.querySelector('[data-brain-box]');
  if (brainSel) { brainSel.value = store('vpai.brain') === 'tiet_kiem' ? 'tiet_kiem' : 'manh'; brainSel.addEventListener('change', function () { store('vpai.brain', brainSel.value); renderMode(); }); }
  var orLogin = orBox.querySelector('[data-or-login]');
  var OR = window.VPAIOpenRouter;
  var suggest = document.querySelector('[data-suggest]');
  var busy = false;
  var appMode = true;

  // items: {kind: 'user'|'assistant'|'tool'|'error', text}
  var items = [];
  try { items = JSON.parse(store(CHAT_KEY) || '[]'); } catch (e) { items = []; }
  if (!Array.isArray(items)) items = [];

  function save() { store(CHAT_KEY, JSON.stringify(items.slice(-60))); }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatText(text) {
    var html = escapeHtml(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Ảnh dạng markdown ![mô tả](link) → hiện ảnh luôn
    html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, function (m, alt, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="' + alt + '" style="display:block;max-width:100%;width:320px;border-radius:8px;margin:6px 0;border:1px solid #E8E8E8"></a>';
    });
    // Link video .mp4/.webm/.mov → hiện trình phát
    html = html.replace(/(^|\s)(https?:\/\/[^\s<)"']+\.(mp4|webm|mov)(\?[^\s<)"']*)?)(?=\s|$)/g, function (m, pre, url) {
      return pre + '<video src="' + url + '" controls playsinline preload="metadata" style="display:block;width:320px;max-width:100%;border-radius:8px;margin:6px 0;background:#000"></video>';
    });
    html = html.replace(/(^|[^"'])(https?:\/\/[^\s<)"']+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return html;
  }

  function bubble(item) {
    var el = document.createElement('div');
    if (item.kind === 'user') {
      el.style.cssText = 'align-self: flex-end; max-width: 85%; padding: 10px 14px; border-radius: 14px 14px 4px 14px; background: #EEF2FF; color: #1B2230; font-size: 15px; line-height: 1.55; white-space: pre-wrap; word-break: break-word';
      el.innerHTML = formatText(item.text);
    } else if (item.kind === 'assistant') {
      el.style.cssText = 'align-self: flex-start; max-width: 90%; padding: 10px 14px; border-radius: 14px 14px 14px 4px; background: #F5F6F8; color: #1B2230; font-size: 15px; line-height: 1.55; white-space: pre-wrap; word-break: break-word';
      el.innerHTML = formatText(item.text);
    } else if (item.kind === 'image') {
      el.style.cssText = 'align-self: flex-start; display: flex; flex-direction: column; gap: 6px; max-width: 90%';
      el.innerHTML = '<a href="' + escapeHtml(item.text) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(item.text) + '" alt="Ảnh AI vừa tạo" style="display:block;width:320px;max-width:100%;border-radius:10px;border:1px solid #E8E8E8"></a>' +
        '<a href="' + escapeHtml(item.text) + '" target="_blank" rel="noopener" download style="font-size:13px">Mở ảnh cỡ lớn / tải về</a>';
    } else if (item.kind === 'video') {
      el.style.cssText = 'align-self: flex-start; display: flex; flex-direction: column; gap: 6px; max-width: 90%';
      el.innerHTML = '<video src="' + escapeHtml(item.text) + '" controls playsinline preload="metadata" style="display:block;width:320px;max-width:100%;border-radius:10px;border:1px solid #E8E8E8;background:#000"></video>' +
        '<a href="' + escapeHtml(item.text) + '" target="_blank" rel="noopener" download style="font-size:13px">Mở video / tải về</a>';
    } else if (item.kind === 'audio') {
      el.style.cssText = 'align-self: flex-start; display: flex; flex-direction: column; gap: 6px; max-width: 90%';
      el.innerHTML = '<audio src="' + escapeHtml(item.text) + '" controls preload="metadata" style="width:320px;max-width:100%"></audio>' +
        '<a href="' + escapeHtml(item.text) + '" target="_blank" rel="noopener" download style="font-size:13px">Tải file âm thanh</a>';
    } else if (item.kind === 'tool') {
      el.style.cssText = 'align-self: flex-start; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5B6472';
      el.innerHTML = '<span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 50%; background: #1E8E4A; flex-shrink: 0"></span><span>' + escapeHtml(item.text) + '</span>';
    } else {
      el.style.cssText = 'align-self: flex-start; max-width: 90%; padding: 10px 14px; border-radius: 12px; background: #FDE8E3; color: #8A2A12; font-size: 14px';
      el.textContent = item.text;
    }
    return el;
  }

  function renderAll() {
    log.innerHTML = '';
    if (!items.length) {
      log.appendChild(bubble({ kind: 'assistant', text: 'Chào anh/chị, em là Trợ lý AI của Crewzy. Anh/chị giao việc bằng tiếng Việt, em sẽ dùng các ứng dụng đã kết nối để làm. Việc đăng bài, gửi tin hay chi tiền em luôn hỏi trước khi làm.' }));
    }
    items.forEach(function (item) { log.appendChild(bubble(item)); });
    log.scrollTop = log.scrollHeight;
  }

  function add(item) {
    items.push(item);
    save();
    log.appendChild(bubble(item));
    log.scrollTop = log.scrollHeight;
  }

  function apiMessages() {
    return items
      .filter(function (i) { return i.kind === 'user' || i.kind === 'assistant'; })
      .map(function (i) { return { role: i.kind, content: i.text }; })
      .slice(-20);
  }

  function keyName(mode) { return 'vpai.key.' + mode; }
  // Chỗ lấy khoá API của từng AI (khoá tính tiền theo lượt dùng, khác gói tháng Claude Pro / ChatGPT Plus).
  var KEY_HINTS = {
    claude: 'Khoá Claude (console.anthropic.com), bắt đầu bằng sk-ant-',
    openai: 'Khoá ChatGPT (platform.openai.com), bắt đầu bằng sk-',
    gemini: 'Khoá Gemini (aistudio.google.com → Get API key)',
    grok: 'Khoá Grok (console.x.ai), bắt đầu bằng xai-'
  };

  function renderMode() {
    var mode = modeSel.value;
    var needsKey = !!KEY_HINTS[mode];
    keyBox.style.display = needsKey ? 'flex' : 'none';
    orBox.style.display = mode === 'openrouter' ? 'flex' : 'none';
    if (brainBox) brainBox.style.display = mode === 'app' && appMode ? 'flex' : 'none';
    if (mode === 'openrouter') {
      var on = !!(OR && OR.key());
      orModel.style.display = on ? 'block' : 'none';
      orBox.querySelector('[data-or-model-label]').style.display = on ? 'block' : 'none';
      orLogin.style.display = on ? 'none' : 'block';
      modeNote.textContent = on
        ? 'Đã đăng nhập OpenRouter. Tiền AI tính vào tài khoản OpenRouter của bạn. Gỡ đăng nhập ở trang Kết nối công cụ.'
        : 'Bấm Đăng nhập OpenRouter, đồng ý trên trang OpenRouter rồi quay lại đây.';
    } else if (needsKey) {
      keyInput.value = store(keyName(mode)) || '';
      keyInput.placeholder = KEY_HINTS[mode];
      modeNote.textContent = 'Khoá chỉ lưu trên trình duyệt này và gửi kèm mỗi lần chat, máy chủ không lưu. Tiền AI tính vào tài khoản của bạn.';
    } else {
      modeNote.textContent = !appMode ? 'Chế độ credit của app chưa bật, hãy chọn khoá API riêng.'
        : brainSel && brainSel.value === 'tiet_kiem' ? 'Haiku 5.5: nhanh, tốn ít credit, hợp việc đơn giản (tra cứu, trả lời ngắn).'
        : 'Opus 5.5: viết nội dung và điều khiển app tốt nhất, tốn credit hơn. Việc đơn giản chọn Tiết kiệm.';
    }
  }

  modeSel.addEventListener('change', function () {
    store(MODE_KEY, modeSel.value);
    renderMode();
  });
  orModel.addEventListener('change', function () { store('vpai.or.model', orModel.value); });
  orLogin.addEventListener('click', function () {
    orLogin.disabled = true;
    orLogin.textContent = 'Đang mở OpenRouter…';
    store(MODE_KEY, 'openrouter');
    OR.login();
  });
  keyInput.addEventListener('change', function () {
    store(keyName(modeSel.value), keyInput.value.trim());
  });

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    sendBtn.textContent = value ? 'Đang làm…' : 'Gửi';
    sendBtn.style.opacity = value ? '0.7' : '1';
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    var mode = modeSel.value;
    var key = mode === 'app' ? undefined : mode === 'openrouter' ? (OR && OR.key()) : (keyInput.value || '').trim();
    if (mode === 'openrouter' && !key) {
      add({ kind: 'error', text: 'Anh/chị bấm Đăng nhập OpenRouter trước nhé.' });
      return;
    }
    if (mode !== 'app' && !key) {
      add({ kind: 'error', text: 'Anh/chị dán khoá API vào ô Khoá API trước nhé.' });
      keyInput.focus();
      return;
    }
    if (key && mode !== 'openrouter') store(keyName(mode), key);
    add({ kind: 'user', text: text });
    input.value = '';
    setBusy(true);

    var thinking = bubble({ kind: 'tool', text: 'Đang suy nghĩ…' });
    log.appendChild(thinking);
    log.scrollTop = log.scrollHeight;
    var turnText = [];

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid: uid, mode: mode, key: key, model: mode === 'openrouter' ? orModel.value : undefined, brain: mode === 'app' && brainSel ? brainSel.value : undefined, messages: apiMessages() })
    }).then(function (res) {
      if (res.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      var type = res.headers.get('content-type') || '';
      if (!res.ok || type.indexOf('ndjson') === -1) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.error || 'Máy chủ chưa trả lời được, thử lại sau.');
        });
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function handle(line) {
        if (!line.trim()) return;
        var ev;
        try { ev = JSON.parse(line); } catch (e) { return; }
        if (thinking.parentNode) thinking.parentNode.removeChild(thinking);
        if (ev.type === 'tool') add({ kind: 'tool', text: ev.label });
        else if (ev.type === 'text') add({ kind: 'assistant', text: ev.text });
        else if (ev.type === 'image' || ev.type === 'video' || ev.type === 'audio') add({ kind: ev.type, text: ev.url });
        else if (ev.type === 'error') add({ kind: 'error', text: ev.message });
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { handle(buffer); return; }
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();
          lines.forEach(handle);
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (thinking.parentNode) thinking.parentNode.removeChild(thinking);
      add({ kind: 'error', text: err.message });
    }).then(function () {
      setBusy(false);
      // Trên điện thoại không tự mở bàn phím sau mỗi câu trả lời.
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) input.focus();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(input.value);
    }
  });
  suggest.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-suggest-text]');
    if (btn) send(btn.getAttribute('data-suggest-text'));
  });
  document.querySelector('[data-chat-clear]').addEventListener('click', function () {
    if (busy) return;
    items = [];
    save();
    renderAll();
  });

  var savedMode = store(MODE_KEY);
  if (savedMode) modeSel.value = savedMode;
  var savedModel = store('vpai.or.model');
  if (savedModel && orModel.querySelector('option[value="' + savedModel + '"]')) orModel.value = savedModel;
  if (OR) {
    OR.handleCallback().then(function (r) {
      if (r === 'connected') {
        modeSel.value = 'openrouter';
        store(MODE_KEY, 'openrouter');
        add({ kind: 'assistant', text: 'Đã đăng nhập OpenRouter. Từ giờ em dùng tài khoản OpenRouter của anh/chị để làm việc.' });
      }
      renderMode();
    }).catch(function (err) {
      add({ kind: 'error', text: err.message });
      renderMode();
    });
  }
  renderMode();
  renderAll();

  // Mở từ trang Quy trình / Kết nối với ?q=…: điền sẵn câu lệnh và gửi luôn một lần.
  var preset = new URLSearchParams(location.search).get('q');
  if (preset) {
    history.replaceState(null, '', location.pathname);
    input.value = preset.slice(0, 2000);
    setTimeout(function () { send(input.value); }, 400);
  }

  fetch('/api/chat').then(function (r) { return r.json(); }).then(function (j) {
    appMode = !!j.appMode;
    var opt = modeSel.querySelector('option[value="app"]');
    if (!appMode) {
      opt.disabled = true;
      opt.textContent = 'Credit của app (chưa bật)';
      if (modeSel.value === 'app') { modeSel.value = 'claude'; store(MODE_KEY, 'claude'); }
    }
    renderMode();
  }).catch(function () {});
})();
