// Trang Kho lưu trữ (kho.html): lưới ảnh/video/tài liệu từ /api/kho, lọc, tìm, tải lên (/api/upload, kéo thả nhiều file),
// dán link, đổi tên, chép link, "Dùng trong chat" (chat.html?dinh_kem=), xoá. Dung lượng theo gói (gioi_han).
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var uid = window.vpaiUid ? window.vpaiUid() : '';
  var grid = $('[data-grid]'), more = $('[data-more]'), q = $('[data-q]'), fileInput = $('[data-file]');
  var kind = '', items = [], timer = null;
  var SRC = { tai_len: 'Bạn tải lên', ai_tao: 'AI tạo', web: 'Từ website', fanpage: 'Từ fanpage', ket_qua: 'Từ kết quả', link: 'Link' };
  var KIND = { image: 'Ảnh', video: 'Video', audio: 'Âm thanh', doc: 'Tài liệu', link: 'Link' };
  function size(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function load(append) {
    var before = append && items.length ? items[items.length - 1].created_at : '';
    if (!append) grid.innerHTML = '<p class="muted">Đang tải…</p>';
    fetch('/api/kho?uid=' + encodeURIComponent(uid) + '&loai=' + kind + '&q=' + encodeURIComponent(q.value.trim()) + (before ? '&truoc=' + before : ''), { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Chưa tải được Kho.');
        var j = res.j;
        items = append ? items.concat(j.muc || []) : (j.muc || []);
        more.hidden = (j.muc || []).length < 60;
        var pct = j.gioi_han ? Math.min(100, Math.round((j.dung / j.gioi_han) * 100)) : 0;
        $('[data-usage-text]').textContent = 'Đã dùng ' + size(j.dung || 0) + (j.gioi_han ? ' / ' + size(j.gioi_han) + ' (' + pct + '%)' : '');
        $('[data-usage-bar]').style.width = pct + '%';
        $('[data-usage-bar]').style.background = pct > 90 ? '#B42318' : 'var(--text)';
        render();
      })
      .catch(function (e) { grid.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }
  function thumb(m) {
    if (m.kind === 'image') return '<img src="' + esc(m.url) + '" alt="' + esc(m.name || 'Ảnh') + '" loading="lazy">';
    if (m.kind === 'video') return '<video src="' + esc(m.url) + '#t=0.5" muted playsinline preload="metadata"></video><span class="kho-badge">Video</span>';
    var ic = m.kind === 'audio' ? '🎵' : m.kind === 'doc' ? '📄' : '🔗';
    return '<div class="kho-ic">' + ic + '<small>' + esc((m.url.split('?')[0].split('.').pop() || '').toUpperCase().slice(0, 4)) + '</small></div>';
  }
  function render() {
    if (!items.length) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1;padding:28px;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center">' +
        '<b style="font-size:17px;font-weight:500">Kho chưa có gì' + (kind || q.value ? ' khớp bộ lọc' : '') + '</b>' +
        '<p class="muted" style="margin:0;max-width:440px">Tải ảnh sản phẩm, video, logo lên đây. Hoặc nhờ Trợ lý: "Đọc website của tôi, lưu ảnh đẹp vào Kho".</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn btn-primary" data-upload2>Tải lên</button><a class="btn btn-ghost" href="chat.html?q=' + encodeURIComponent('Đọc website của tôi (link trong Brain thương hiệu), xem ảnh trên đó và lưu 8 ảnh đẹp nhất vào Kho.') + '">Nhờ AI lấy ảnh từ web</a></div></div>';
      var b = grid.querySelector('[data-upload2]'); if (b) b.addEventListener('click', function () { fileInput.click(); });
      return;
    }
    grid.innerHTML = items.map(function (m, i) {
      var name = m.name || KIND[m.kind] || 'Tệp';
      return '<article class="card kho-item"><a class="kho-thumb" href="' + esc(m.url) + '" target="_blank" rel="noopener" aria-label="Mở ' + esc(name) + '">' + thumb(m) + '</a>' +
        '<div class="kho-meta"><b title="' + esc(name) + '">' + esc(name) + '</b><small class="muted">' + esc(SRC[m.source] || '') + (m.size ? ' · ' + size(m.size) : '') + '</small></div>' +
        '<div class="kho-acts">' +
        (m.kind !== 'link' ? '<a class="btn btn-ghost" href="chat.html?dinh_kem=' + encodeURIComponent(m.url) + '&loai=' + m.kind + '&ten=' + encodeURIComponent(m.name || '') + '" title="Gửi cho Trợ lý AI">Dùng</a>' : '') +
        '<button type="button" class="btn btn-ghost" data-copy="' + i + '" title="Chép link">Link</button>' +
        '<button type="button" class="btn btn-ghost" data-rename="' + i + '" title="Đổi tên">Tên</button>' +
        '<button type="button" class="btn btn-ghost" data-del="' + i + '" title="Xoá" aria-label="Xoá ' + esc(name) + '">Xoá</button></div></article>';
    }).join('');
  }
  grid.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-copy]'))) {
      var m = items[Number(b.getAttribute('data-copy'))];
      if (navigator.clipboard) navigator.clipboard.writeText(m.url).then(function () { b.textContent = 'Đã chép'; setTimeout(function () { b.textContent = 'Link'; }, 1200); });
    } else if ((b = e.target.closest('[data-rename]'))) {
      var r = items[Number(b.getAttribute('data-rename'))];
      var ten = window.prompt('Tên mới (để AI dễ tìm, ví dụ: Mặt tiền nhà Bình Chánh)', r.name || '');
      if (ten == null) return;
      post({ action: 'doi_ten', id: r.id, ten: ten.trim() }).then(function () { r.name = ten.trim(); render(); });
    } else if ((b = e.target.closest('[data-del]'))) {
      var d = items[Number(b.getAttribute('data-del'))];
      if (!window.confirm('Xoá "' + (d.name || 'tệp này') + '" khỏi Kho? File sẽ bị xoá hẳn, bài đã đăng dùng link này có thể mất ảnh.')) return;
      post({ action: 'xoa', id: d.id }).then(function () { load(false); });
    }
  });
  function post(body) { body.uid = uid; return fetch('/api/kho', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }

  $('[data-filters]').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    kind = b.getAttribute('data-f');
    document.querySelectorAll('[data-f]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    load(false);
  });
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { load(false); }, 300); });
  more.addEventListener('click', function () { load(true); });
  $('[data-upload]').addEventListener('click', function () { fileInput.click(); });
  $('[data-add-link]').addEventListener('click', function () {
    var u = window.prompt('Dán link ảnh, video, Google Drive, YouTube… (https://)');
    if (!u) return;
    var ten = window.prompt('Tên để AI dễ tìm (không bắt buộc)', '') || '';
    post({ action: 'them_link', url: u.trim(), ten: ten.trim() }).then(function (j) { if (j.error) window.alert(j.error); else load(false); });
  });

  // Tải lên nhiều file, hiện tiến độ ngay trong lưới.
  var queue = 0;
  function upload(files) {
    Array.prototype.forEach.call(files, function (f) {
      queue++;
      var tmp = document.createElement('article');
      tmp.className = 'card kho-item';
      tmp.innerHTML = '<div class="kho-thumb"><div class="kho-ic"><span class="cz-spin" aria-hidden="true"></span><small>Đang tải</small></div></div><div class="kho-meta"><b>' + esc(f.name) + '</b><small class="muted">' + size(f.size) + '</small></div>';
      if (!items.length) grid.innerHTML = '';
      grid.prepend(tmp);
      fetch('/api/upload?uid=' + encodeURIComponent(uid) + '&ten=' + encodeURIComponent(f.name.slice(0, 100)), { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) { if (!res.ok) throw new Error(res.j.error || 'Chưa tải lên được.'); })
        .catch(function (e) { tmp.querySelector('.kho-meta small').textContent = e.message; tmp.querySelector('.kho-meta small').style.color = '#B42318'; tmp.querySelector('.kho-ic').textContent = '⚠️'; })
        .then(function () { queue--; if (!queue) setTimeout(function () { load(false); }, 400); });
    });
  }
  fileInput.addEventListener('change', function () { upload(fileInput.files); fileInput.value = ''; });
  var drop = $('[data-drop]');
  document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); drop.hidden = false; } });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) drop.hidden = true; });
  document.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); drop.hidden = true; upload(e.dataTransfer.files); } });
  load(false);
})();
