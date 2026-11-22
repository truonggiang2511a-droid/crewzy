// Trang Brain thương hiệu: đọc/lưu /api/brand theo tài khoản.
(function () {
  var uid = window.vpaiUid();
  var form = document.querySelector('[data-brand-form]');
  var msg = document.querySelector('[data-save-msg]');
  var saveBtn = document.querySelector('[data-save]');
  var progress = document.querySelector('[data-progress]');
  var fields = Array.prototype.slice.call(form.querySelectorAll('[name]'));
  var dirty = false;

  function count() {
    var n = fields.filter(function (f) { return f.value.trim(); }).length;
    progress.textContent = 'Đã điền ' + n + '/' + fields.length;
    progress.className = 'pill' + (n >= 6 ? ' pill-ok' : n ? ' pill-warn' : '');
  }

  function handle401(r) { if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin(); return r; }

  fetch('/api/brand?uid=' + encodeURIComponent(uid)).then(handle401).then(function (r) { return r.json(); }).then(function (j) {
    var b = (j && j.brand) || {};
    fields.forEach(function (f) { if (b[f.name]) f.value = b[f.name]; });
    if (b.updatedAt) msg.textContent = 'Lưu lần cuối: ' + new Date(b.updatedAt).toLocaleString('vi-VN');
    count();
  }).catch(function () { msg.textContent = 'Chưa tải được dữ liệu đã lưu.'; });

  form.addEventListener('input', function () { dirty = true; count(); msg.textContent = 'Có thay đổi chưa lưu'; });

  document.querySelectorAll('[data-voice]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = document.getElementById('f-voice');
      var t = b.getAttribute('data-voice');
      if (v.value.indexOf(t) === -1) v.value = v.value.trim() ? v.value.trim() + '; ' + t : t;
      dirty = true; count(); msg.textContent = 'Có thay đổi chưa lưu';
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var brand = {};
    fields.forEach(function (f) { brand[f.name] = f.value; });
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';
    fetch('/api/brand', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: uid, brand: brand }) })
      .then(handle401)
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Chưa lưu được.'); return j; }); })
      .then(function () { dirty = false; msg.textContent = 'Đã lưu. Trợ lý AI sẽ dùng từ lượt chat tiếp theo.'; })
      .catch(function (err) { msg.textContent = err.message; })
      .then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Lưu Brain thương hiệu'; });
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
