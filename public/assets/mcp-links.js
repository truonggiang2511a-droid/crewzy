// Kết nối → AI của bạn → "Link đang hoạt động": danh sách link nối AI (GET /api/mcp-links), thu hồi từng link hoặc mọi link cũ (v2).
// Link đang lưu trên máy này (localStorage vpai.aiLink) được đánh dấu; thu hồi nó thì xoá luôn khỏi máy để nút Cài đặt tạo link mới.
(function () {
  var card = document.querySelector('[data-links-card]');
  if (!card) return;
  var uid = window.vpaiUid ? window.vpaiUid() : '';
  var list = card.querySelector('[data-links-list]');
  var msg = card.querySelector('[data-links-msg]');
  var count = card.querySelector('[data-links-count]');
  var oldBox = card.querySelector('[data-links-old]');

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { msg.textContent = t || ''; msg.style.display = t ? 'block' : 'none'; }
  function saved() { try { return localStorage.getItem('vpai.aiLink') || ''; } catch (e) { return ''; } }
  // Mã link (k) và loại link nằm trong token: /mcp/<base64url(JSON)>.<chữ ký>
  function tokenInfo(link) {
    var m = /\/mcp\/([^./?#]+)\./.exec(link || '');
    if (!m) return null;
    try {
      var b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      var txt = decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
      if (txt.charAt(0) !== '{') return { v: 1 };
      var j = JSON.parse(txt);
      return { v: j.k ? 3 : 2, k: j.k || null };
    } catch (e) { return null; }
  }
  function ago(iso) {
    var s = (Date.now() - Date.parse(iso)) / 1000;
    if (!(s >= 0)) return '';
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' phút trước';
    if (s < 86400) return Math.round(s / 3600) + ' giờ trước';
    return Math.round(s / 86400) + ' ngày trước';
  }
  function api(method, body) {
    var url = '/api/mcp-links' + (uid ? '?uid=' + encodeURIComponent(uid) : '');
    return fetch(url, method === 'GET' ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Có lỗi, thử lại sau.'); return j; });
      });
  }

  function render(data) {
    var links = data.links || [];
    var mine = tokenInfo(saved());
    count.textContent = links.length + ' link';
    count.className = links.length ? 'pill pill-ok' : 'pill';
    if (!links.length) {
      list.innerHTML = '<p class="muted" style="margin:0;font-size:14px">Chưa có link nào. Bấm Tạo link nối AI ở trên.</p>';
    } else {
      list.innerHTML = links.map(function (l) {
        var here = mine && mine.k === l.k;
        var used = l.dung ? 'Đang dùng ở <b>' + esc(l.dung.ten) + '</b> · ' + esc(ago(l.dung.luc)) : 'Chưa AI nào dùng';
        return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;border:1px solid #E5E5E5;border-radius:10px;background:#fff">' +
          '<div style="flex:1;min-width:180px"><p style="margin:0;font-weight:600;font-size:14px">' + esc(l.ten) +
          (here ? ' <span class="pill" style="margin-left:4px">Máy này</span>' : '') + '</p>' +
          '<p class="muted" style="margin:2px 0 0;font-size:12.5px">' + used + ' · tạo ' + esc(ago(l.tao)) + '</p></div>' +
          '<button type="button" class="btn btn-ghost" data-revoke="' + esc(l.k) + '">Thu hồi</button></div>';
      }).join('');
    }
    // Link cũ (v2, không có tên) vẫn chạy tới khi khách bấm Thu hồi link cũ.
    oldBox.style.display = data.cu_off ? 'none' : 'flex';
  }

  function load() { api('GET').then(render).catch(function (e) { say(e.message); }); }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-revoke]');
    if (!b) return;
    var k = b.getAttribute('data-revoke');
    var mine = tokenInfo(saved());
    var warn = mine && mine.k === k ? 'Đây là link đang lưu trên máy này. ' : '';
    b.disabled = true; b.textContent = 'Đang thu hồi…'; say('');
    api('POST', { action: 'revoke', k: k }).then(function (data) {
      if (mine && mine.k === k) {
        try { localStorage.removeItem('vpai.aiLink'); } catch (err) {}
        var input = document.getElementById('ai-link'); if (input) input.value = '';
        var box = document.querySelector('[data-ai-box]'); if (box) box.style.display = 'none';
      }
      render(data);
      say(warn + 'Đã thu hồi. AI nào đang dùng link này sẽ báo lỗi trong khoảng 1 phút; muốn dùng tiếp thì tạo link mới và nối lại.');
      msg.style.color = 'var(--ok)';
    }).catch(function (err) { b.disabled = false; b.textContent = 'Thu hồi'; msg.style.color = '#8A2A12'; say(err.message); });
  });

  card.querySelector('[data-links-revoke-old]').addEventListener('click', function (e) {
    var b = e.target; b.disabled = true; say('');
    api('POST', { action: 'revoke_old' }).then(function (data) {
      var mine = tokenInfo(saved());
      if (mine && mine.v !== 3) { try { localStorage.removeItem('vpai.aiLink'); } catch (err) {} }
      render(data);
      msg.style.color = 'var(--ok)'; say('Đã thu hồi mọi link cũ. Link có tên trong danh sách vẫn chạy bình thường.');
    }).catch(function (err) { b.disabled = false; msg.style.color = '#8A2A12'; say(err.message); });
  });

  window.addEventListener('crewzy:ai-link', load);
  load();
})();
