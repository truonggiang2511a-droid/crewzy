// Trang Brain thương hiệu: đọc/lưu /api/brand theo tài khoản.
// Mẫu tham khảo (refs): link hoặc file tải lên /api/upload → {loai, link, ghi_chu}; lưu chung trong Brain.
(function () {
  var uid = window.vpaiUid();
  var form = document.querySelector('[data-brand-form]');
  var msg = document.querySelector('[data-save-msg]');
  var saveBtn = document.querySelector('[data-save]');
  var progress = document.querySelector('[data-progress]');
  var refsEl = document.querySelector('[data-refs]');
  var refMsg = document.querySelector('[data-ref-msg]');
  var fields = Array.prototype.slice.call(form.querySelectorAll('[name]'));
  var TYPES = {
    video_mau: 'Video mẫu thích', anh_mau: 'Ảnh quảng cáo mẫu', giong_mau: 'Giọng đọc mẫu',
    nhac: 'Nhạc nền', logo: 'Logo, nhận diện', tu_lieu: 'Tư liệu gốc (ảnh/video thật)'
  };
  var refs = [];
  var dirty = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function changed() { dirty = true; count(); msg.textContent = 'Có thay đổi chưa lưu'; }
  function count() {
    var n = fields.filter(function (f) { return f.value.trim(); }).length + (refs.some(function (r) { return r.link; }) ? 1 : 0);
    var total = fields.length + 1;
    progress.textContent = 'Đã điền ' + n + '/' + total;
    progress.className = 'pill' + (n >= 8 ? ' pill-ok' : n ? ' pill-warn' : '');
  }
  function preview(r) {
    var l = r.link || '';
    if (!/\/api\/media\//.test(l)) return '';
    if (/\.(png|jpg|webp|gif)$/.test(l)) return '<img src="' + esc(l) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;flex:none">';
    if (/\.(mp4|webm|mov)$/.test(l)) return '<video src="' + esc(l) + '" muted playsinline preload="metadata" style="width:56px;height:56px;object-fit:cover;border-radius:6px;flex:none;background:#111"></video>';
    if (/\.(mp3|wav|m4a)$/.test(l)) return '<audio src="' + esc(l) + '" controls preload="none" style="width:200px;flex:none"></audio>';
    return '';
  }
  function renderRefs() {
    refsEl.innerHTML = refs.length ? refs.map(function (r, i) {
      var opts = Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (r.loai === k ? ' selected' : '') + '>' + TYPES[k] + '</option>'; }).join('');
      return '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1px solid var(--line,#E8E8E8);border-radius:8px">' + preview(r) +
        '<select class="field" data-ref-type="' + i + '" aria-label="Loại mẫu" style="flex:0 1 200px;min-width:160px">' + opts + '</select>' +
        '<input class="field" data-ref-link="' + i + '" value="' + esc(r.link) + '" placeholder="https://… (TikTok, Reels, YouTube, Drive)" aria-label="Link mẫu" style="flex:2 1 240px;min-width:200px">' +
        '<input class="field" data-ref-note="' + i + '" value="' + esc(r.ghi_chu) + '" placeholder="Thích điều gì? Ví dụ: hook 3 giây đầu, màu, nhạc" aria-label="Ghi chú" style="flex:2 1 220px;min-width:180px">' +
        '<button type="button" class="btn btn-ghost" data-ref-del="' + i + '" aria-label="Xoá mẫu" style="min-height:36px">Xoá</button></div>';
    }).join('') : '<p class="muted" style="margin:0;font-size:13px">Chưa có mẫu nào. Thêm 2–5 video bạn thích và vài ảnh quảng cáo mẫu để AI làm đúng gu.</p>';
    count();
  }

  function handle401(r) { if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin(); return r; }

  fetch('/api/brand?uid=' + encodeURIComponent(uid)).then(handle401).then(function (r) { return r.json(); }).then(function (j) {
    var b = (j && j.brand) || {};
    fields.forEach(function (f) { if (b[f.name]) f.value = b[f.name]; });
    refs = (b.refs || []).map(function (r) { return { loai: r.loai, link: r.link, ghi_chu: r.ghi_chu || '' }; });
    renderRefs();
    if (b.updatedAt) msg.textContent = 'Lưu lần cuối: ' + new Date(b.updatedAt).toLocaleString('vi-VN');
    count();
  }).catch(function () { msg.textContent = 'Chưa tải được dữ liệu đã lưu.'; renderRefs(); });

  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-ref-link')) refs[+t.getAttribute('data-ref-link')].link = t.value.trim();
    else if (t.hasAttribute('data-ref-note')) refs[+t.getAttribute('data-ref-note')].ghi_chu = t.value;
    changed();
  });
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-ref-type')) { refs[+t.getAttribute('data-ref-type')].loai = t.value; changed(); }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var v = t.closest('[data-voice]');
    if (v) { append('voice', v.getAttribute('data-voice')); return; }
    var a = t.closest('[data-append]');
    if (a) { append(a.getAttribute('data-append'), a.getAttribute('data-text')); return; }
    if (t.closest('[data-ref-add]')) { refs.push({ loai: 'video_mau', link: '', ghi_chu: '' }); renderRefs(); var inputs = refsEl.querySelectorAll('[data-ref-link]'); if (inputs.length) inputs[inputs.length - 1].focus(); changed(); return; }
    var d = t.closest('[data-ref-del]');
    if (d) { refs.splice(+d.getAttribute('data-ref-del'), 1); renderRefs(); changed(); }
  });
  function append(name, text) {
    var f = form.querySelector('[name="' + name + '"]');
    if (f.value.indexOf(text) === -1) f.value = f.value.trim() ? f.value.trim() + '; ' + text : text;
    changed();
  }

  // Tải file lên: ảnh → ảnh mẫu, video → video mẫu, âm thanh → giọng mẫu (đổi loại được sau).
  document.querySelector('[data-ref-file]').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 95 * 1024 * 1024) { refMsg.textContent = 'File lớn hơn 95MB. Nén nhỏ lại hoặc dán link Google Drive.'; return; }
    refMsg.textContent = 'Đang tải ' + file.name + '…';
    fetch('/api/upload?uid=' + encodeURIComponent(uid), { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })
      .then(handle401)
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Chưa tải lên được.'); return j; }); })
      .then(function (j) {
        var loai = j.loai === 'video' ? 'video_mau' : j.loai === 'audio' ? 'giong_mau' : 'anh_mau';
        refs.push({ loai: loai, link: j.link, ghi_chu: file.name.replace(/\.[^.]+$/, '').slice(0, 80) });
        renderRefs(); changed();
        refMsg.textContent = 'Đã tải lên. Nhớ bấm Lưu Brain thương hiệu.';
      })
      .catch(function (err) { refMsg.textContent = err.message; });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var brand = {};
    fields.forEach(function (f) { brand[f.name] = f.value; });
    brand.refs = refs.filter(function (r) { return /^https:\/\//i.test(r.link || ''); });
    var bad = refs.filter(function (r) { return r.link && !/^https:\/\//i.test(r.link); }).length;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';
    fetch('/api/brand', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: uid, brand: brand }) })
      .then(handle401)
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Chưa lưu được.'); return j; }); })
      .then(function (j) {
        dirty = false;
        refs = ((j.brand && j.brand.refs) || []).map(function (r) { return { loai: r.loai, link: r.link, ghi_chu: r.ghi_chu || '' }; });
        renderRefs();
        msg.textContent = 'Đã lưu. AI dùng từ lượt làm việc tiếp theo.' + (bad ? ' Bỏ ' + bad + ' link không bắt đầu bằng https://.' : '');
      })
      .catch(function (err) { msg.textContent = err.message; })
      .then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Lưu Brain thương hiệu'; });
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
