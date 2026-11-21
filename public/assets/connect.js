// Kết nối thật Gmail và Google Sheets qua Composio (hàm máy chủ /api/connect và /api/status trên Netlify).
// Bản thử chưa có đăng nhập: mỗi trình duyệt có một mã khách riêng lưu trong localStorage.
(function () {
  var KEY = 'vpai.uid';
  var UID_PATTERN = /^[a-z0-9-]{8,64}$/;

  function getUid() {
    var id = null;
    try { id = localStorage.getItem(KEY); } catch (e) {}
    if (!id || !UID_PATTERN.test(id)) {
      id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).toLowerCase();
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }
    return id;
  }

  var uid = getUid();

  function showMsg(tile, text) {
    var msg = tile.querySelector('[data-real-msg]');
    msg.textContent = text;
    msg.style.display = text ? 'block' : 'none';
  }

  function markConnected(slug) {
    var tile = document.querySelector('[data-real-tile="' + slug + '"]');
    if (!tile) return;
    var btn = tile.querySelector('[data-real-connect]');
    btn.textContent = 'Đã kết nối';
    btn.disabled = true;
    btn.style.background = '#E3F4E8';
    btn.style.color = '#14612D';
    btn.style.cursor = 'default';
    tile.style.borderColor = '#A8DDB8';
    showMsg(tile, '');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-real-connect]');
    if (!btn || btn.disabled) return;
    var slug = btn.getAttribute('data-real-connect');
    var tile = btn.closest('[data-real-tile]');
    var label = btn.textContent;
    btn.textContent = 'Đang mở trang đăng nhập…';
    btn.disabled = true;
    showMsg(tile, '');
    fetch('/api/connect?toolkit=' + encodeURIComponent(slug) + '&uid=' + encodeURIComponent(uid))
      .then(function (r) {
        return r.json()
          .catch(function () { return { error: 'Máy chủ kết nối chưa sẵn sàng, thử lại sau.' }; })
          .then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (res) {
        if (res.ok && res.body.redirectUrl) {
          window.location.href = res.body.redirectUrl;
        } else {
          throw new Error(res.body.error || 'Không kết nối được, thử lại sau.');
        }
      })
      .catch(function (err) {
        btn.textContent = label;
        btn.disabled = false;
        showMsg(tile, err.message);
      });
  });

  function refresh(final) {
    fetch('/api/status?uid=' + encodeURIComponent(uid))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var connected = j.connected || [];
        connected.forEach(markConnected);
        var just = new URLSearchParams(location.search).get('ket_noi');
        if (final && just && connected.indexOf(just) === -1) {
          var tile = document.querySelector('[data-real-tile="' + just + '"]');
          if (tile) showMsg(tile, 'Chưa thấy kết nối hoàn tất. Nếu bạn đã đăng nhập xong, tải lại trang sau vài giây.');
        }
      })
      .catch(function () {});
  }

  var returning = new URLSearchParams(location.search).get('ket_noi');
  refresh(!returning);
  if (returning) setTimeout(function () { refresh(true); }, 3000);
})();
