// Đăng nhập OpenRouter bằng OAuth PKCE: khách đăng nhập trên openrouter.ai, app nhận khoá gắn với tài khoản khách.
// Khoá chỉ lưu trong localStorage trình duyệt này (vpai.key.openrouter), gửi kèm khi chat, máy chủ không lưu.
(function () {
  var KEY = 'vpai.key.openrouter';
  var VERIFIER = 'vpai.or.verifier';
  var STATE = 'vpai.or.state';

  function ls(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }
  function ss(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }

  function b64url(bytes) {
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomString(n) {
    var bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return b64url(bytes);
  }

  function login() {
    var verifier = randomString(48);
    var state = randomString(16);
    ss(VERIFIER, verifier);
    ss(STATE, state);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (hash) {
      var callback = location.origin + location.pathname;
      location.href = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(callback) +
        '&code_challenge=' + b64url(new Uint8Array(hash)) + '&code_challenge_method=S256' +
        '&key_label=' + encodeURIComponent('Crewzy') + '&state=' + state;
    });
  }

  function exchange(code, verifier) {
    var body = JSON.stringify({ code: code, code_verifier: verifier, code_challenge_method: 'S256' });
    var direct = fetch('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body });
    return direct.catch(function () {
      // Trình duyệt chặn gọi thẳng thì đổi qua máy chủ của app (chỉ chuyển tiếp, không lưu khoá).
      return fetch('/api/openrouter-key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || !j.key) throw new Error('OpenRouter chưa cấp khoá (' + res.status + '). Bấm Đăng nhập OpenRouter lại.');
        return j.key;
      });
    });
  }

  // Gọi khi trang tải: nếu vừa quay về từ OpenRouter thì đổi mã lấy khoá. Trả về Promise<'connected'|null>.
  function handleCallback() {
    var params = new URLSearchParams(location.search);
    var code = params.get('code');
    var verifier = ss(VERIFIER);
    if (!code || !verifier) return Promise.resolve(null);
    var state = params.get('state');
    var expected = ss(STATE);
    ss(VERIFIER, null);
    ss(STATE, null);
    params.delete('code');
    params.delete('state');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : ''));
    if (state && expected && state !== expected) return Promise.reject(new Error('Phiên đăng nhập OpenRouter không khớp, thử lại.'));
    return exchange(code, verifier).then(function (key) {
      ls(KEY, key);
      return 'connected';
    });
  }

  window.VPAIOpenRouter = {
    key: function () { return ls(KEY) || ''; },
    login: login,
    logout: function () { ls(KEY, null); },
    handleCallback: handleCallback
  };
})();
