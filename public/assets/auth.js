// Đăng nhập Google: kiểm tra phiên trên mọi trang, chuyển sang dang-nhap.html khi bắt buộc đăng nhập,
// hiện người dùng + nút Đăng xuất ở chân menu (ô [data-user-slot] do layout.js vẽ).
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

  function esc(t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderUser(user) {
    // Máy tính: chân menu trái · điện thoại: bảng "Thêm" (layout.js vẽ [data-user-slot-m]).
    document.querySelectorAll('[data-user-slot-m]').forEach(function (m) { if (!m.hasAttribute('data-user-slot')) m.setAttribute('data-user-slot', ''); });
    document.querySelectorAll('[data-user-slot]').forEach(function (slot) { renderUserInto(slot, user); });
  }
  function renderUserInto(slot, user) {
    var initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
    var avatar = user.picture ? '<img src="' + esc(user.picture) + '" alt="" referrerpolicy="no-referrer">' : esc(initial);
    slot.innerHTML = '<div class="sb-user"><div class="sb-avatar">' + avatar + '</div><div class="sb-who" style="min-width:0;flex:1">' +
      '<p style="margin:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(user.name || 'Tài khoản') + '</p>' +
      '<p class="muted" style="margin:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(user.email) + '</p></div>' +
      '<button type="button" class="sb-out">Đăng xuất</button></div>';
    slot.querySelector('.sb-out').addEventListener('click', function (e) {
      e.target.disabled = true;
      fetch('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
        clearLocal();
        location.href = 'dang-nhap.html';
      });
    });
  }

  window.VPAI_ME = fetch('/api/auth/me', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (me) {
      if (me.required && !me.user) { goLogin(); return me; }
      // Gói và credit bật: chưa xong 4 bước (Brain → kênh → AI → thanh toán) thì đưa về trang Thiết lập. Máy chủ cũng chặn API, đây chỉ để dẫn đường.
      var free = ['bat-dau.html', 'dang-nhap.html', 'goi.html', 'ket-noi.html'];
      if (me.user && me.billing && me.onboarding && !me.onboarding.done && free.indexOf(page) < 0) { location.replace('bat-dau.html'); return me; }
      if (me.user) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { renderUser(me.user); }, 0); });
        else renderUser(me.user);
      }
      return me;
    })
    .catch(function () { return { required: false, user: null }; });
})();
