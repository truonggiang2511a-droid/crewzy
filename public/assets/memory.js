// Trang Brain thương hiệu → mục "AI đã học về bạn" (/api/bo-nho): xem, xoá, tự thêm ghi nhớ.
(function () {
  var box = document.querySelector('[data-mem]');
  if (!box) return;
  var form = document.querySelector('[data-mem-add]'), sel = document.querySelector('[data-mem-loai]'), inp = document.querySelector('[data-mem-text]');
  var uid = window.vpaiUid ? window.vpaiUid() : '';
  var q = uid ? '?uid=' + encodeURIComponent(uid) : '';
  var kinds = {};
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function draw(items) {
    if (!items.length) { box.innerHTML = '<p class="muted" style="margin:0;font-size:13px">Chưa có. Khi bạn góp ý hoặc sửa bài, AI sẽ tự ghi nhớ ở đây.</p>'; return; }
    box.innerHTML = items.map(function (m) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:10px">' +
        '<div style="flex:1;min-width:0"><span class="pill" style="font-size:11px">' + esc(kinds[m.loai] || m.loai) + '</span><p style="margin:6px 0 0;font-size:14px;line-height:1.5">' + esc(m.noi_dung) + '</p>' +
        '<p class="muted" style="margin:4px 0 0;font-size:11px">' + esc(m.nguon) + ' · ' + new Date(m.luc).toLocaleDateString('vi-VN') + '</p></div>' +
        '<button type="button" class="btn btn-ghost" data-mem-x="' + esc(m.id) + '" style="min-height:32px;font-size:12px">Xoá</button></div>';
    }).join('');
  }
  function api(method, body) {
    return fetch('/api/bo-nho' + q, { method: method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Lỗi, thử lại.'); return j; }); });
  }
  api('GET').then(function (j) {
    kinds = j.loai || {};
    sel.innerHTML = Object.keys(kinds).map(function (k) { return '<option value="' + k + '">' + esc(kinds[k]) + '</option>'; }).join('');
    draw(j.items || []);
  }).catch(function (e) { box.innerHTML = '<p class="muted" style="margin:0;font-size:13px">' + esc(e.message) + '</p>'; });
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mem-x]'); if (!b) return;
    b.disabled = true;
    api('POST', { action: 'xoa', id: b.getAttribute('data-mem-x') }).then(function (j) { draw(j.items); }).catch(function () { b.disabled = false; });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = inp.value.trim(); if (!t) return;
    api('POST', { action: 'them', loai: sel.value, noi_dung: t }).then(function (j) { inp.value = ''; draw(j.items); }).catch(function (err) { window.alert(err.message); });
  });
})();
