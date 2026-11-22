// Trang Việc chờ duyệt: phiếu việc thật từ /api/jobs (AI của khách hoặc Trợ lý Crewzy nộp kết quả qua CREWZY_NOP_KET_QUA).
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var uid = window.vpaiUid();
  var listEl = $('[data-list]');
  var msgEl = $('[data-msg]');
  var form = $('[data-new-form]');
  var data = { jobs: [], counts: {}, statuses: {}, kinds: {} };
  var filter = 'cho_duyet';
  var focusId = new URLSearchParams(location.search).get('id');

  var FILTERS = [['cho_duyet', 'Chờ duyệt'], ['cho_lam', 'Chờ AI làm'], ['da_duyet', 'Đã duyệt'], ['bao_cao', 'Báo cáo'], ['all', 'Tất cả']];
  var TEMPLATES = [
    ['', '— Tự viết —', '', 'khac'],
    ['tuan', 'Lên 7 bài cho tuần', 'Đọc Brain thương hiệu, lên 7 bài Facebook cho tuần này, mỗi bài một góc khác nhau (lợi ích, câu hỏi khách hay hỏi, hậu trường, ưu đãi, cảm nhận khách). Viết đầy đủ từng bài, kèm gợi ý ảnh. Nộp về Crewzy để tôi duyệt, chưa đăng.', 'bai_dang'],
    ['anh', 'Ảnh quảng cáo sản phẩm chính', 'Làm 2 ảnh quảng cáo dọc 4:5 cho sản phẩm chính theo Brain thương hiệu (không chèn chữ vào ảnh) và viết caption cho từng ảnh. Nộp về Crewzy để tôi duyệt.', 'bai_dang'],
    ['video', 'Video ngắn 15 giây', 'Dùng app tạo video đã kết nối (ví dụ OpenArt) làm 1 video dọc 9:16 khoảng 15 giây giới thiệu sản phẩm chính, kèm caption có lời mời nhắn tin. Nộp video + caption về Crewzy.', 'bai_dang'],
    ['binhluan', 'Soạn trả lời bình luận', 'Đọc 20 bình luận mới nhất trên Fanpage, soạn câu trả lời cho từng bình luận theo giọng thương hiệu (không đưa số điện thoại khách lên công khai). Nộp danh sách để tôi duyệt.', 'cham_soc'],
    ['baocao', 'Báo cáo tuần', 'Đọc số liệu 7 ngày qua từ các app đã kết nối (quảng cáo, Analytics, Fanpage, Sheet bán hàng nếu có). Báo cáo: số chính, so với tuần trước, điều tốt, điều cần sửa, 3 việc tuần tới.', 'bao_cao'],
    ['email', 'Email chăm sóc khách cũ', 'Soạn chuỗi 3 email chăm sóc khách đã mua (cảm ơn, hướng dẫn dùng, mời mua lại) theo Brain thương hiệu. Nộp để tôi duyệt trước khi gửi.', 'cham_soc']
  ];

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function md(t) {
    var h = esc(t);
    h = h.replace(/^### (.*)$/gm, '<strong style="font-size:15px">$1</strong>').replace(/^## (.*)$/gm, '<strong style="font-size:16px">$1</strong>').replace(/^# (.*)$/gm, '<strong style="font-size:17px">$1</strong>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return h;
  }
  function when(iso) {
    try { return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); } catch (e) { return ''; }
  }
  function say(t) { msgEl.textContent = t || ''; msgEl.style.display = t ? 'block' : 'none'; }
  function api(method, body) {
    var opts = method === 'GET' ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: uid }, body)) };
    return fetch('/api/jobs' + (method === 'GET' ? '?uid=' + encodeURIComponent(uid) : ''), opts).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().catch(function () { return { error: 'Máy chủ chưa sẵn sàng.' }; }).then(function (b) { if (!r.ok) throw new Error(b.error || 'Có lỗi, thử lại.'); return b; });
    });
  }
  var PILL = { cho_duyet: 'pill-warn', da_duyet: 'pill-ok', da_dang: 'pill-ok', xong: 'pill-ok' };

  function renderFilters() {
    $('[data-filters]').innerHTML = FILTERS.map(function (f) {
      var n = f[0] === 'all' ? data.jobs.length : f[0] === 'bao_cao' ? data.jobs.filter(function (j) { return j.loai === 'bao_cao'; }).length : (data.counts[f[0]] || 0);
      return '<button type="button" data-filter="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + (n ? ' <span class="num">' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  function chatLink(text) { return 'chat.html?q=' + encodeURIComponent(text); }

  function card(j) {
    var r = j.ket_qua || {};
    var media = (r.media || []).map(function (m) {
      if (m.loai === 'video') return '<video src="' + esc(m.link) + '" controls playsinline preload="metadata" style="width:220px;max-width:100%;border-radius:8px;background:#000"></video>';
      if (m.loai === 'image') return '<a href="' + esc(m.link) + '" target="_blank" rel="noopener"><img src="' + esc(m.link) + '" alt="" loading="lazy" style="width:160px;max-width:100%;border-radius:8px;border:1px solid #E8E8E8"></a>';
      return '<a href="' + esc(m.link) + '" target="_blank" rel="noopener">' + esc(m.link) + '</a>';
    }).join('');
    var links = (r.lien_ket || []).map(function (l) { return '<a href="' + esc(l) + '" target="_blank" rel="noopener" style="word-break:break-all">' + esc(l) + '</a>'; }).join('<br>');
    var acts = [];
    if (j.trang_thai === 'cho_duyet') {
      acts.push('<button type="button" class="btn btn-primary" data-act="duyet">Duyệt</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="sua-mo">Sửa nội dung</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="lam_lai">Yêu cầu làm lại</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="tu_choi">Từ chối</button>');
    } else if (j.trang_thai === 'da_duyet') {
      acts.push('<a class="btn btn-primary" href="' + chatLink('Đăng phiếu việc ' + j.id + ' ("' + j.tieu_de + '") đã được duyệt: gọi CREWZY_VIEC_CAN_LAM để lấy đúng nội dung, đăng lên kênh phù hợp, rồi nộp lại trạng thái da_dang kèm link bài.') + '">Đăng ngay bằng Trợ lý Crewzy</a>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="da_dang">Đánh dấu đã đăng</button>');
    } else if (j.trang_thai === 'cho_lam' || j.trang_thai === 'dang_lam') {
      acts.push('<a class="btn btn-primary" href="' + chatLink('Làm phiếu việc ' + j.id + ' ("' + j.tieu_de + '"): ' + j.yeu_cau + '\nLàm xong nộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ' + j.id + '.') + '">Làm ngay bằng Trợ lý Crewzy</a>');
    }
    acts.push('<button type="button" class="btn btn-ghost" data-act="xoa" style="color:#8A2A12">Xoá</button>');
    return '<article class="card" data-job="' + esc(j.id) + '" id="job-' + esc(j.id) + '" style="padding:16px 18px;display:flex;flex-direction:column;gap:10px' + (focusId === j.id ? ';box-shadow:0 0 0 3px rgba(0,7,205,.18);border-color:var(--accent)' : '') + '">' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
      '<span class="pill">' + esc(data.kinds[j.loai] || j.loai) + '</span>' +
      '<span class="pill ' + (PILL[j.trang_thai] || '') + '">' + esc(data.statuses[j.trang_thai] || j.trang_thai) + '</span>' +
      '<span class="muted" style="font-size:12px;margin-left:auto">' + (j.nguoi_lam ? esc(j.nguoi_lam) + ' · ' : '') + when(j.cap_nhat) + '</span></div>' +
      '<h2 style="margin:0;font-size:17px;font-weight:600">' + esc(j.tieu_de) + '</h2>' +
      (j.yeu_cau ? '<p class="muted" style="margin:0;font-size:13px;line-height:1.5"><b>Yêu cầu:</b> ' + esc(j.yeu_cau.slice(0, 400)) + '</p>' : '') +
      (j.ghi_chu_khach ? '<p style="margin:0;font-size:13px;color:var(--warn)"><b>Bạn ghi chú:</b> ' + esc(j.ghi_chu_khach) + '</p>' : '') +
      (r.noi_dung ? '<div data-content style="font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:360px;overflow:auto;padding:12px;border-radius:8px;background:#F7F7F8">' + md(r.noi_dung) + '</div>' +
        '<div data-edit hidden style="display:flex;flex-direction:column;gap:8px"><textarea class="field" rows="10">' + esc(r.noi_dung) + '</textarea><div style="display:flex;gap:8px"><button type="button" class="btn btn-primary" data-act="sua">Lưu nội dung</button><button type="button" class="btn btn-ghost" data-act="sua-dong">Huỷ</button></div></div>' : '') +
      (media ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' + media + '</div>' : '') +
      ((r.kenh || []).length ? '<p style="margin:0;font-size:13px"><b>Kênh:</b> ' + esc(r.kenh.join(', ')) + '</p>' : '') +
      (links ? '<p style="margin:0;font-size:13px;line-height:1.6"><b>Liên kết:</b><br>' + links + '</p>' : '') +
      (r.ghi_chu ? '<p style="margin:0;font-size:13px;padding:8px 10px;border-radius:6px;background:var(--warn-soft);color:var(--warn)"><b>AI ghi chú:</b> ' + esc(r.ghi_chu) + '</p>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' + acts.join('') + '</div></article>';
  }

  function render() {
    renderFilters();
    if (window.vpaiSetJobBadge) window.vpaiSetJobBadge(data.counts.cho_duyet || 0);
    var jobs = data.jobs.filter(function (j) {
      if (filter === 'all') return true;
      if (filter === 'bao_cao') return j.loai === 'bao_cao';
      return j.trang_thai === filter;
    });
    if (!jobs.length) {
      var empty = filter === 'cho_duyet'
        ? 'Chưa có kết quả nào chờ duyệt. Bấm <b>Giao việc mới</b>, hoặc bảo AI của bạn (Claude Code, ChatGPT, Claude…) "làm việc Crewzy". AI làm xong sẽ nộp kết quả về đây.'
        : 'Không có phiếu việc ở mục này.';
      listEl.innerHTML = '<div class="card" style="padding:18px"><p class="muted" style="margin:0;font-size:14px;line-height:1.6">' + empty + '</p></div>';
      return;
    }
    listEl.innerHTML = jobs.map(card).join('');
    if (focusId) {
      var el = document.getElementById('job-' + focusId);
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
      focusId = null;
    }
  }

  function load() {
    return api('GET').then(function (d) {
      data = d;
      if (focusId) { var f = d.jobs.filter(function (j) { return j.id === focusId; })[0]; if (f) filter = f.loai === 'bao_cao' && f.trang_thai === 'xong' ? 'bao_cao' : f.trang_thai; }
      render();
    }).catch(function (e) { say(e.message); listEl.innerHTML = ''; });
  }

  $('[data-filters]').addEventListener('click', function (e) { var b = e.target.closest('[data-filter]'); if (b) { filter = b.getAttribute('data-filter'); render(); } });

  listEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var art = b.closest('[data-job]');
    var id = art.getAttribute('data-job');
    var act = b.getAttribute('data-act');
    if (act === 'sua-mo' || act === 'sua-dong') {
      var open = act === 'sua-mo';
      $('[data-edit]', art).hidden = !open;
      $('[data-content]', art).style.display = open ? 'none' : '';
      return;
    }
    var body = { action: act, id: id };
    if (act === 'sua') body.noi_dung = $('[data-edit] textarea', art).value;
    if (act === 'lam_lai' || act === 'tu_choi') {
      var note = window.prompt(act === 'lam_lai' ? 'Cần AI sửa gì? (AI sẽ đọc ghi chú này khi làm lại)' : 'Lý do từ chối (không bắt buộc)', '');
      if (note === null) return;
      body.ghi_chu = note;
    }
    if (act === 'xoa' && !window.confirm('Xoá phiếu việc này?')) return;
    b.disabled = true;
    say('');
    api('POST', body).then(load).catch(function (err) { b.disabled = false; say(err.message); });
  });

  // Giao việc mới
  var sel = $('[data-template]');
  sel.innerHTML = TEMPLATES.map(function (t, i) { return '<option value="' + i + '">' + esc(t[1]) + '</option>'; }).join('');
  sel.addEventListener('change', function () {
    var t = TEMPLATES[Number(sel.value)];
    if (!t[0]) return;
    form.tieu_de.value = t[1]; form.yeu_cau.value = t[2]; form.loai.value = t[3];
  });
  $('[data-new-toggle]').addEventListener('click', function () { form.hidden = !form.hidden; if (!form.hidden) form.tieu_de.focus(); });
  var submitter = 'ai';
  form.querySelectorAll('[data-submit]').forEach(function (b) { b.addEventListener('click', function () { submitter = b.getAttribute('data-submit'); }); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('[data-new-msg]');
    m.style.display = 'none';
    var yeu = form.yeu_cau.value.trim();
    if (!yeu) { m.textContent = 'Hãy ghi việc cần làm.'; m.style.display = 'block'; form.yeu_cau.focus(); return; }
    var tieu = form.tieu_de.value.trim() || yeu.slice(0, 60);
    api('POST', { action: 'tao', tieu_de: tieu, yeu_cau: yeu, loai: form.loai.value }).then(function (res) {
      var j = res.job;
      if (submitter === 'crewzy') {
        location.href = chatLink('Làm phiếu việc ' + j.id + ' ("' + j.tieu_de + '"): ' + j.yeu_cau + '\nLàm xong nộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ' + j.id + '.');
        return;
      }
      form.reset(); form.hidden = true; filter = 'cho_lam';
      say('');
      return load();
    }).catch(function (err) { m.textContent = err.message; m.style.display = 'block'; });
  });

  load();
})();
