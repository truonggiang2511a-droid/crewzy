// Đăng nhập Google: kiểm tra phiên trên mọi trang, chuyển sang dang-nhap.html khi bắt buộc đăng nhập,
// hiện email người dùng dưới tên app trong menu, nút Đăng xuất.
(function () {
  var page = location.pathname.split('/').pop() || 'index.html';

  function goLogin() {
    location.replace('dang-nhap.html?next=' + encodeURIComponent(page + location.search));
  }
  window.vpaiNeedLogin = goLogin;

  function clearLocal() {
    try {
      ['vpai.chat', 'vpai.aiLink', 'vpai.key.claude', 'vpai.key.openai', 'vpai.key.openrouter'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function renderUser(user) {
    var brandText = document.querySelector('nav[aria-label="Điều hướng chính"] > div:first-child > div:last-child');
    if (!brandText) return;
    var sub = brandText.querySelector('p:nth-child(2)');
    if (sub) {
      sub.textContent = user.email || user.name || 'Đã đăng nhập';
      sub.style.cssText += ';overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px';
      sub.title = user.email || '';
    }
    var out = document.createElement('button');
    out.type = 'button';
    out.textContent = 'Đăng xuất';
    out.style.cssText = 'margin: 2px 0 0; padding: 0; border: 0; background: none; color: var(--accent); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 24px';
    out.addEventListener('click', function () {
      out.disabled = true;
      fetch('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
        clearLocal();
        location.href = 'dang-nhap.html';
      });
    });
    brandText.appendChild(out);
  }

  window.VPAI_ME = fetch('/api/auth/me', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (me) {
      if (me.required && !me.user) { goLogin(); return me; }
      if (me.user) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { renderUser(me.user); });
        else renderUser(me.user);
      }
      return me;
    })
    .catch(function () { return { required: false, user: null }; });
})();
