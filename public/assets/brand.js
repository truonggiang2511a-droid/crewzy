// Trang Brain thương hiệu: đọc/lưu /api/brand theo tài khoản.
// Mẫu tham khảo (refs): link hoặc file tải lên /api/upload → {ma, loai, link, ghi_chu, tom_tat, phan_tich}; lưu chung trong Brain.
// 25/11: tải nhiều file một lần (thanh % từng file, lần lượt), tải xong TỰ LƯU; mã mẫu V1/A1… để khách gõ "làm theo mẫu V1";
// "AI xem mẫu" (assets/ref-watch.js → /api/phan-tich-mau): Crewzy xem video/ảnh, AI viết bản phân tích cách dựng lưu vào mẫu.
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
  var queue = [];          // file đang chờ tải
  var uploading = null;    // {name, pct, xhr}
  var watching = {};       // link → {pct, text}
  var watchQueue = [];
  var saving = null, saveAgain = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function changed() { dirty = true; count(); msg.textContent = 'Có thay đổi chưa lưu'; }
  function count() {
    var n = fields.filter(function (f) { return f.value.trim(); }).length + (refs.some(function (r) { return r.link; }) ? 1 : 0);
    var total = fields.length + 1;
    progress.textContent = 'Đã điền ' + n + '/' + total;
    progress.className = 'pill' + (n >= 8 ? ' pill-ok' : n ? ' pill-warn' : '');
  }
  var own = function (l) { return /\/api\/media\/[a-f0-9]{24}\./.test(l || '') && (l.indexOf(location.origin) === 0 || l.charAt(0) === '/'); };
  function mediaKind(r) {
    var l = (r.link || '').toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/.test(l)) return 'image';
    if (/\.(mp4|webm|mov|m4v)$/.test(l)) return 'video';
    if (/\.(mp3|wav|m4a)$/.test(l)) return 'audio';
    return '';
  }
  function preview(r) {
    var l = r.link || '', k = mediaKind(r);
    if (!own(l)) return '';
    if (k === 'image') return '<img src="' + esc(l) + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;flex:none">';
    if (k === 'video') return '<video src="' + esc(l) + '#t=0.5" muted playsinline preload="metadata" style="width:64px;height:64px;object-fit:cover;border-radius:6px;flex:none;background:#111"></video>';
    if (k === 'audio') return '<audio src="' + esc(l) + '" controls preload="none" style="width:200px;flex:none"></audio>';
    return '';
  }
  function canWatch(r) { var k = mediaKind(r); return own(r.link) && (k === 'video' || k === 'image'); }
  function watchBox(r) {
    var w = watching[r.link];
    if (w) return '<div style="flex:1 1 100%;display:flex;flex-direction:column;gap:4px"><div style="height:6px;background:#EEE;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + w.pct + '%;background:#0007CD;transition:width .3s"></div></div><span class="muted" style="font-size:12px">' + esc(w.text) + '</span></div>';
    if (watchQueue.indexOf(r.link) >= 0) return '<div class="muted" style="flex:1 1 100%;font-size:12px">Đang chờ tới lượt AI xem…</div>';
    if (r.phan_tich) {
      return '<details style="flex:1 1 100%;font-size:13px"><summary style="cursor:pointer"><b style="color:#0A7B34">✓ AI đã xem mẫu này</b> — ' + esc(r.tom_tat || 'xem bản phân tích') + '</summary>' +
        '<div style="white-space:pre-wrap;line-height:1.55;margin-top:8px;padding:12px;background:#FAFAFA;border:1px solid #EEE;border-radius:8px;max-height:420px;overflow:auto">' + esc(r.phan_tich) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><button type="button" class="btn btn-ghost" data-ref-watch="' + esc(r.link) + '" style="min-height:32px;font-size:12px">↻ Cho AI xem lại</button></div></details>';
    }
    if (canWatch(r)) return '<div style="flex:1 1 100%;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-ghost" data-ref-watch="' + esc(r.link) + '" style="min-height:32px;font-size:12px">👁 Cho AI xem mẫu</button><span class="muted" style="font-size:12px">AI xem từng cảnh, nghe lời thoại, ghi lại cách dựng để làm theo.</span></div>';
    if (r.loai === 'video_mau' && r.link && !own(r.link)) return '<div class="muted" style="flex:1 1 100%;font-size:12px;line-height:1.5">AI chưa xem được video qua link (TikTok, YouTube chặn). Tải video về máy rồi bấm <b>Tải file lên</b> để AI xem và học cách dựng.</div>';
    return '';
  }
  function codeBadge(r) {
    if (!r.ma) return '<span class="muted" title="Mã có sau khi lưu" style="font:600 12px var(--mono, monospace);padding:4px 8px;border:1px dashed #CCC;border-radius:6px;flex:none">…</span>';
    return '<button type="button" data-ref-copy="' + esc(r.ma) + '" title="Bấm để chép mã. Gõ trong chat: làm theo mẫu ' + esc(r.ma) + '" style="font:700 13px var(--mono, monospace);padding:4px 10px;border:0;border-radius:6px;background:#D4FF4A;color:#0F0F0F;cursor:pointer;flex:none">' + esc(r.ma) + '</button>';
  }
  function renderRefs() {
    var rows = refs.map(function (r, i) {
      var opts = Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (r.loai === k ? ' selected' : '') + '>' + TYPES[k] + '</option>'; }).join('');
      return '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1px solid var(--line,#E8E8E8);border-radius:8px">' + codeBadge(r) + preview(r) +
        '<select class="field" data-ref-type="' + i + '" aria-label="Loại mẫu" style="flex:0 1 200px;min-width:160px">' + opts + '</select>' +
        '<input class="field" data-ref-link="' + i + '" value="' + esc(r.link) + '" placeholder="https://… (TikTok, Reels, YouTube, Drive)" aria-label="Link mẫu" style="flex:2 1 240px;min-width:200px">' +
        '<input class="field" data-ref-note="' + i + '" value="' + esc(r.ghi_chu) + '" placeholder="Thích điều gì? Ví dụ: hook 3 giây đầu, màu, nhạc" aria-label="Ghi chú" style="flex:2 1 220px;min-width:180px">' +
        '<button type="button" class="btn btn-ghost" data-ref-del="' + i + '" aria-label="Xoá mẫu" style="min-height:36px">Xoá</button>' + watchBox(r) + '</div>';
    });
    var up = (uploading ? [uploading] : []).concat(queue.map(function (f) { return { name: f.name, pct: 0, wait: true }; })).map(function (u) {
      return '<div style="display:flex;flex-direction:column;gap:6px;padding:10px;border:1px dashed #BBB;border-radius:8px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span>' + esc(u.name) + '</span><span class="muted">' + (u.wait ? 'Chờ tới lượt' : u.pct + '%') + '</span></div>' +
        '<div style="height:6px;background:#EEE;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + u.pct + '%;background:#0F0F0F;transition:width .2s"></div></div></div>';
    });
    refsEl.innerHTML = rows.concat(up).join('') || '<p class="muted" style="margin:0;font-size:13px">Chưa có mẫu nào. Thêm 2–5 video bạn thích và vài ảnh quảng cáo mẫu để AI làm đúng gu.</p>';
    count();
  }

  function handle401(r) { if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin(); return r; }
  function keepRef(r) { return { ma: r.ma, loai: r.loai, link: r.link, ghi_chu: r.ghi_chu || '', tom_tat: r.tom_tat || '', phan_tich: r.phan_tich || '', phan_tich_luc: r.phan_tich_luc || '' }; }

  fetch('/api/brand?uid=' + encodeURIComponent(uid)).then(handle401).then(function (r) { return r.json(); }).then(function (j) {
    var b = (j && j.brand) || {};
    fields.forEach(function (f) { if (b[f.name]) f.value = b[f.name]; });
    refs = (b.refs || []).map(keepRef);
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
    if (t.hasAttribute('data-ref-type')) { refs[+t.getAttribute('data-ref-type')].loai = t.value; refs[+t.getAttribute('data-ref-type')].ma = ''; changed(); save(true); }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var v = t.closest('[data-voice]');
    if (v) { append('voice', v.getAttribute('data-voice')); return; }
    var a = t.closest('[data-append]');
    if (a) { append(a.getAttribute('data-append'), a.getAttribute('data-text')); return; }
    if (t.closest('[data-ref-add]')) { refs.push({ loai: 'video_mau', link: '', ghi_chu: '' }); renderRefs(); var inputs = refsEl.querySelectorAll('[data-ref-link]'); if (inputs.length) inputs[inputs.length - 1].focus(); changed(); return; }
    var d = t.closest('[data-ref-del]');
    if (d) { refs.splice(+d.getAttribute('data-ref-del'), 1); renderRefs(); changed(); save(true); return; }
    var c = t.closest('[data-ref-copy]');
    if (c) {
      var text = 'Làm theo mẫu ' + c.getAttribute('data-ref-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { refMsg.textContent = 'Đã chép "' + text + '". Dán vào chat với AI.'; }, function () { refMsg.textContent = 'Gõ trong chat: ' + text; });
      return;
    }
    var w = t.closest('[data-ref-watch]');
    if (w) { enqueueWatch(w.getAttribute('data-ref-watch')); }
  });
  function append(name, text) {
    var f = form.querySelector('[name="' + name + '"]');
    if (f.value.indexOf(text) === -1) f.value = f.value.trim() ? f.value.trim() + '; ' + text : text;
    changed();
  }

  // ---------- Tải nhiều file: lần lượt từng file, có %, xong file nào thêm mẫu + tự lưu + cho AI xem ----------
  document.querySelector('[data-ref-file]').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    var big = files.filter(function (f) { return f.size > 95 * 1024 * 1024; });
    files = files.filter(function (f) { return f.size <= 95 * 1024 * 1024; });
    refMsg.textContent = big.length ? 'Bỏ qua ' + big.length + ' file lớn hơn 95MB (nén nhỏ lại hoặc dán link Google Drive).' : '';
    queue = queue.concat(files);
    renderRefs();
    nextUpload();
  });
  function nextUpload() {
    if (uploading || !queue.length) return;
    var file = queue.shift();
    uploading = { name: file.name, pct: 0 };
    renderRefs();
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?uid=' + encodeURIComponent(uid) + '&ten=' + encodeURIComponent(file.name.slice(0, 100)));
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = function (ev) {
      if (!ev.lengthComputable) return;
      var p = Math.min(99, Math.round(ev.loaded / ev.total * 100));
      if (p !== uploading.pct) { uploading.pct = p; renderRefs(); }
    };
    xhr.onload = function () {
      var j = {};
      try { j = JSON.parse(xhr.responseText || '{}'); } catch (err) { /* trống */ }
      if (xhr.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      if (xhr.status >= 200 && xhr.status < 300 && j.link) {
        var loai = j.loai === 'video' ? 'video_mau' : j.loai === 'audio' ? 'giong_mau' : 'anh_mau';
        refs.push({ loai: loai, link: j.link, ghi_chu: file.name.replace(/\.[^.]+$/, '').slice(0, 80) });
        dirty = true;
        save(true);
        if (loai !== 'giong_mau') enqueueWatch(j.link, file);
      } else {
        refMsg.textContent = file.name + ': ' + (j.error || 'chưa tải lên được (mạng chập chờn?). Thử lại file này.');
      }
      done();
    };
    xhr.onerror = function () { refMsg.textContent = file.name + ': mất mạng giữa chừng, chọn lại file này để tải tiếp.'; done(); };
    xhr.send(file);
    function done() { uploading = null; renderRefs(); nextUpload(); }
  }

  // ---------- AI xem mẫu: lần lượt từng mẫu ----------
  var files = {}; // link → File vừa tải (xem từ file trên máy, khỏi tải lại)
  var busyWatch = false;
  function enqueueWatch(link, file) {
    if (!link || watching[link] || watchQueue.indexOf(link) >= 0) return;
    if (file) files[link] = file;
    watchQueue.push(link);
    renderRefs();
    nextWatch();
  }
  function nextWatch() {
    if (busyWatch || !watchQueue.length) return;
    var link = watchQueue.shift();
    var r = refs.filter(function (x) { return x.link === link; })[0];
    if (!r || !window.crewzyWatchRef) { nextWatch(); return; }
    busyWatch = true;
    var kind = mediaKind(r) || (files[link] && /^image\//.test(files[link].type) ? 'image' : 'video');
    watching[link] = { pct: 1, text: kind === 'image' ? 'AI đang xem ảnh…' : 'Đang mở video…' };
    renderRefs();
    var tick = function (p, text) { watching[link] = { pct: p, text: text }; renderRefs(); };
    var slow;
    window.crewzyWatchRef(files[link] || link, { kind: kind, onProgress: tick })
      .then(function (data) {
        tick(kind === 'image' ? 60 : 88, 'AI đang phân tích cách dựng (khoảng 30–60 giây)…');
        var p = kind === 'image' ? 60 : 88;
        slow = setInterval(function () { if (p < 98) { p++; tick(p, 'AI đang phân tích cách dựng (khoảng 30–60 giây)…'); } }, 1500);
        data.link = link; data.loai = r.loai; data.ghi_chu = r.ghi_chu;
        return fetch('/api/phan-tich-mau?uid=' + encodeURIComponent(uid), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
          .then(handle401)
          .then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || 'AI chưa xem được mẫu.'); return j; }); });
      })
      .then(function (j) {
        refs.forEach(function (x) { if (x.link === link) { x.ma = j.ma || x.ma; x.tom_tat = j.tom_tat; x.phan_tich = j.phan_tich; x.phan_tich_luc = new Date().toISOString(); } });
        refMsg.textContent = 'AI đã xem xong mẫu ' + (j.ma || '') + (kind === 'video' && !j.loi_thoai ? ' (không nghe ra lời thoại, chỉ phân tích hình).' : '.') + ' Gõ trong chat: "làm theo mẫu ' + (j.ma || '') + '".';
        save(true);
      })
      .catch(function (err) { refMsg.textContent = 'Mẫu ' + (r.ma || '') + ': ' + err.message; })
      .then(function () { clearInterval(slow); delete watching[link]; delete files[link]; busyWatch = false; renderRefs(); nextWatch(); });
  }

  // ---------- Lưu (bấm nút hoặc tự lưu). Không bao giờ kẹt nút: có hạn chờ 30 giây, đang lưu thì xếp lượt sau. ----------
  function save(auto) {
    if (saving) { saveAgain = true; return saving; }
    var brand = {};
    fields.forEach(function (f) { brand[f.name] = f.value; });
    brand.refs = refs.filter(function (r) { return /^https:\/\//i.test(r.link || ''); }).map(keepRef);
    var bad = refs.filter(function (r) { return r.link && !/^https:\/\//i.test(r.link); }).length;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
    saving = fetch('/api/brand', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: uid, brand: brand }), signal: ctl && ctl.signal })
      .then(handle401)
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Chưa lưu được.'); return j; }); })
      .then(function (j) {
        dirty = false;
        // Cập nhật mã từ máy chủ, giữ mẫu vừa thêm trong lúc đang lưu.
        var saved = (j.brand && j.brand.refs) || [];
        saved.forEach(function (s) { refs.forEach(function (x) { if (x.link === s.link) { x.ma = s.ma; if (s.phan_tich && !x.phan_tich) { x.phan_tich = s.phan_tich; x.tom_tat = s.tom_tat; } } }); });
        renderRefs();
        var pending = queue.length + (uploading ? 1 : 0);
        msg.textContent = (auto ? 'Đã tự lưu' : 'Đã lưu') + ' lúc ' + new Date().toLocaleTimeString('vi-VN') + '. AI dùng từ lượt làm việc tiếp theo.' +
          (pending ? ' Còn ' + pending + ' file đang tải, xong sẽ tự lưu.' : '') + (bad ? ' Bỏ ' + bad + ' link không bắt đầu bằng https://.' : '');
      })
      .catch(function (err) { dirty = true; msg.textContent = err.name === 'AbortError' ? 'Mạng chậm, chưa lưu được. Bấm Lưu lại.' : err.message; })
      .then(function () {
        clearTimeout(timer);
        saving = null;
        saveBtn.disabled = false; saveBtn.textContent = 'Lưu Brain thương hiệu';
        if (saveAgain) { saveAgain = false; save(true); }
      });
    return saving;
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); save(false); });

  window.addEventListener('beforeunload', function (e) {
    if (dirty || uploading || queue.length || busyWatch) { e.preventDefault(); e.returnValue = ''; }
  });
})();
