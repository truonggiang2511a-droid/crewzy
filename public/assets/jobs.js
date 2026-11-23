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

  // App để khách TỰ SỬA cho ưng ý (đã nối thì mở thẳng web app, chưa nối thì tới trang kết nối).
  var EDIT_APPS = {
    image: [['canva', 'Canva', 'https://www.canva.com/'], ['higgsfield', 'Higgsfield', 'https://higgsfield.ai/', 1], ['gemini', 'Gemini', 'https://gemini.google.com/'], ['flow', 'Google Flow (Veo)', 'https://labs.google/flow', 2], ['figma', 'Figma', 'https://www.figma.com/']],
    video: [['descript_mcp', 'Descript', 'https://web.descript.com/'], ['captions', 'Captions', 'https://desktop.captions.ai/'], ['higgsfield', 'Higgsfield', 'https://higgsfield.ai/', 1], ['flow', 'Google Flow (Veo)', 'https://labs.google/flow', 2], ['heygen', 'HeyGen', 'https://app.heygen.com/'], ['canva', 'Canva', 'https://www.canva.com/'], ['capcut', 'CapCut (web)', 'https://www.capcut.com/editor', 2]],
  };
  var connected = {};
  fetch('/api/status?uid=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }).then(function (d) { connected = (d && d.accounts) || {}; if (data.jobs.length) render(); }).catch(function () {});
  function editApps(kinds) {
    var list = [], seen = {};
    kinds.forEach(function (k) { (EDIT_APPS[k] || []).forEach(function (a) { if (!seen[a[0]]) { seen[a[0]] = 1; list.push(a); } }); });
    list.sort(function (x, y) { return (connected[y[0]] ? 1 : 0) - (connected[x[0]] ? 1 : 0); });
    return list.slice(0, 4).map(function (a) {
      var on = connected[a[0]] || a[3] === 2;
      var href = on ? a[2] : a[3] === 1 ? 'ket-noi.html?tab=mcp&ten=Higgsfield&url=' + encodeURIComponent('https://mcp.higgsfield.ai/mcp') : 'ket-noi.html?app=' + a[0];
      return '<a class="jb-app' + (on ? ' on' : '') + '" href="' + href + '"' + (on ? ' target="_blank" rel="noopener"' : '') + '>' + (a[3] === 2 ? '' : '<img src="https://logos.composio.dev/api/' + a[0] + '" alt="" loading="lazy">') + esc(a[1]) + (on ? ' ↗' : ' · Nối') + '</a>';
    }).join('');
  }
  var REDO = ['Ảnh/video khác phong cách', 'Hook mở đầu mạnh hơn', 'Viết ngắn gọn hơn', 'Đổi góc máy, ánh sáng', 'Thêm lời kêu gọi rõ hơn', 'Hashtag xu hướng hơn', 'Đúng màu thương hiệu hơn'];

  function card(j) {
    var r = j.ket_qua || {};
    var ms = r.media || [];
    var nImg = ms.filter(function (m) { return m.loai === 'image'; }).length, nVid = ms.filter(function (m) { return m.loai === 'video'; }).length;
    var media = ms.map(function (m) {
      if (m.loai === 'video') return '<figure class="jb-m"><video src="' + esc(m.link) + '" controls playsinline preload="metadata"></video></figure>';
      if (m.loai === 'image') return '<figure class="jb-m"><a href="' + esc(m.link) + '" target="_blank" rel="noopener"><img src="' + esc(m.link) + '" alt="" loading="lazy"></a><a class="jb-dl" href="' + esc(m.link) + '" download>Tải về</a></figure>';
      return '<a href="' + esc(m.link) + '" target="_blank" rel="noopener" style="word-break:break-all">' + esc(m.link) + '</a>';
    }).join('');
    var links = (r.lien_ket || []).map(function (l) { return '<a href="' + esc(l) + '" target="_blank" rel="noopener" style="word-break:break-all">' + esc(l) + '</a>'; }).join('<br>');
    var ready = [];
    if (r.noi_dung) ready.push('✓ Bài viết xong');
    if (nImg) ready.push('✓ ' + nImg + ' ảnh');
    if (nVid) ready.push('✓ ' + nVid + ' video');
    if (r.app_da_dung) ready.push('làm bằng ' + esc(r.app_da_dung));
    var review = j.trang_thai === 'cho_duyet';
    var postPrompt = 'Đăng phiếu việc ' + j.id + ' ("' + j.tieu_de + '") đã được duyệt lên đa kênh: gọi CREWZY_VIEC_CAN_LAM với id để lấy đúng bài và ảnh/video, đăng mỗi kênh đúng nội dung và khổ của kênh đó (bỏ kênh không nhận định dạng), rồi nộp lại trạng thái da_dang kèm link từng bài.';
    var acts = [];
    if (review) {
      acts.push('<button type="button" class="btn btn-primary" data-act="duyet-dang">✓ Duyệt & đăng đa kênh</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="duyet">Chỉ duyệt</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="redo-mo">↻ Yêu cầu AI làm lại</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="sua-mo">✎ Sửa bài</button>');
      if (ms.length) acts.push('<button type="button" class="btn btn-ghost" data-act="tu-sua-mo">Tự sửa ảnh/video</button>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="tu_choi">Từ chối</button>');
    } else if (j.trang_thai === 'da_duyet') {
      acts.push('<a class="btn btn-primary" href="' + chatLink(postPrompt) + '">Đăng đa kênh ngay</a>');
      acts.push('<button type="button" class="btn btn-ghost" data-act="da_dang">Đánh dấu đã đăng</button>');
    } else if (j.trang_thai === 'cho_lam' || j.trang_thai === 'dang_lam') {
      acts.push('<a class="btn btn-primary" href="' + chatLink('Làm phiếu việc ' + j.id + ' ("' + j.tieu_de + '"): ' + j.yeu_cau + (j.ghi_chu_khach ? '\nKhách yêu cầu sửa: ' + j.ghi_chu_khach : '') + '\nTrước khi làm ảnh/video gọi CREWZY_PROMPT_PRO. Làm xong nộp CREWZY_NOP_KET_QUA kèm id ' + j.id + ' và prompt_da_dung.') + '">Làm ngay bằng Trợ lý Crewzy</a>');
    }
    acts.push('<button type="button" class="btn btn-ghost" data-act="xoa" style="color:#8A2A12">Xoá</button>');
    var kinds = []; if (nImg) kinds.push('image'); if (nVid) kinds.push('video');
    return '<article class="card jb-card' + (review ? ' review' : '') + '" data-job="' + esc(j.id) + '" data-post="' + esc(postPrompt) + '" id="job-' + esc(j.id) + '"' + (focusId === j.id ? ' style="box-shadow:0 0 0 3px rgba(0,7,205,.18);border-color:var(--accent)"' : '') + '>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
      '<span class="pill">' + esc(data.kinds[j.loai] || j.loai) + '</span>' +
      '<span class="pill ' + (PILL[j.trang_thai] || '') + '">' + esc(data.statuses[j.trang_thai] || j.trang_thai) + '</span>' +
      '<span class="muted" style="font-size:12px;margin-left:auto">' + (j.nguoi_lam ? esc(j.nguoi_lam) + ' · ' : '') + when(j.cap_nhat) + '</span></div>' +
      '<h2 style="margin:0;font-size:17px;font-weight:600">' + esc(j.tieu_de) + '</h2>' +
      (ready.length ? '<p class="jb-ready">' + ready.join(' · ') + '</p>' : '') +
      (j.ghi_chu_khach ? '<p style="margin:0;font-size:13px;color:var(--warn)"><b>Bạn yêu cầu:</b> ' + esc(j.ghi_chu_khach) + '</p>' : '') +
      '<div class="jb-body' + (media ? ' has-media' : '') + '">' +
        (media ? '<div class="jb-media">' + media + '</div>' : '') +
        '<div class="jb-text">' +
          (r.noi_dung ? '<div data-content class="jb-content">' + md(r.noi_dung) + '</div>' +
            '<div data-edit hidden style="display:flex;flex-direction:column;gap:8px"><textarea class="field" rows="12">' + esc(r.noi_dung) + '</textarea><div style="display:flex;gap:8px"><button type="button" class="btn btn-primary" data-act="sua">Lưu bài</button><button type="button" class="btn btn-ghost" data-act="sua-dong">Huỷ</button></div></div>'
            : (j.yeu_cau ? '<p class="muted" style="margin:0;font-size:13px;line-height:1.5"><b>Yêu cầu:</b> ' + esc(j.yeu_cau.slice(0, 400)) + '</p>' : '')) +
          ((r.kenh || []).length ? '<p style="margin:0;font-size:13px"><b>Kênh đăng:</b> ' + esc(r.kenh.join(', ')) + '</p>' : '') +
          (links ? '<p style="margin:0;font-size:13px;line-height:1.6"><b>Liên kết:</b><br>' + links + '</p>' : '') +
          (r.ghi_chu ? '<p class="jb-note"><b>AI ghi chú:</b> ' + esc(r.ghi_chu) + '</p>' : '') +
          (r.prompt_da_dung ? '<details class="jb-prompt"><summary>Prompt AI đã dùng' + (r.app_da_dung ? ' (' + esc(r.app_da_dung) + ')' : '') + '</summary><pre>' + esc(r.prompt_da_dung) + '</pre></details>' : '') +
        '</div>' +
      '</div>' +
      (review ? '<div class="jb-redo" data-redo hidden><p class="label-mono" style="margin:0">Muốn AI sửa gì?</p><div class="jb-chips">' + REDO.map(function (t) { return '<button type="button" class="btn chip btn-ghost" data-chip>' + esc(t) + '</button>'; }).join('') + '</div>' +
        '<textarea class="field" rows="3" data-redo-note placeholder="Ghi thêm ý của bạn, ví dụ: ảnh sáng hơn, người mẫu trẻ hơn, nhắc ưu đãi giảm 10%…"></textarea>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-primary" data-act="redo-ngay">Làm lại ngay bằng Trợ lý</button><button type="button" class="btn btn-ghost" data-act="lam_lai">Gửi AI của tôi làm lại</button><button type="button" class="btn btn-ghost" data-act="redo-dong">Huỷ</button></div></div>' : '') +
      (review && ms.length ? '<div class="jb-redo" data-tusua hidden><p style="margin:0;font-size:13.5px;line-height:1.5">Mở app để tự chỉnh ảnh/video cho ưng ý (tải ảnh/video ở trên về rồi mở trong app), xong dán link bản đã sửa vào đây (hoặc tải lên <a href="kho.html" target="_blank">Kho</a> rồi chép link):</p>' +
        '<div class="jb-chips">' + editApps(kinds) + '</div>' +
        '<input class="field" data-media-link placeholder="https://… link ảnh/video đã sửa (nhiều link cách nhau dấu cách)">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-primary" data-act="thay_media">Dùng bản đã sửa</button><button type="button" class="btn btn-ghost" data-act="tu-sua-dong">Huỷ</button></div></div>' : '') +
      '<div class="jb-acts">' + acts.join('') + '</div></article>';
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
    if (act === 'redo-mo' || act === 'redo-dong') { $('[data-redo]', art).hidden = act === 'redo-dong'; var tu = $('[data-tusua]', art); if (tu) tu.hidden = true; return; }
    if (act === 'tu-sua-mo' || act === 'tu-sua-dong') { $('[data-tusua]', art).hidden = act === 'tu-sua-dong'; $('[data-redo]', art).hidden = true; return; }
    var job = data.jobs.filter(function (x) { return x.id === id; })[0] || {};
    var body = { action: act, id: id };
    if (act === 'sua') body.noi_dung = $('[data-edit] textarea', art).value;
    if (act === 'thay_media') body.media = $('[data-media-link]', art).value.split(/\s+/).filter(Boolean);
    var redoNote = function () {
      var chips = Array.prototype.map.call(art.querySelectorAll('[data-chip].on'), function (c) { return c.textContent; });
      var t = ($('[data-redo-note]', art) || {}).value || '';
      return chips.concat(t.trim() ? [t.trim()] : []).join('; ');
    };
    if (act === 'redo-ngay' || act === 'lam_lai') {
      body.action = 'lam_lai'; body.ghi_chu = redoNote();
      if (!body.ghi_chu) { say('Chọn ít nhất 1 ý hoặc ghi thêm điều cần sửa.'); return; }
    }
    if (act === 'tu_choi') { var note = window.prompt('Lý do từ chối (không bắt buộc)', ''); if (note === null) return; body.ghi_chu = note; }
    if (act === 'duyet-dang') body.action = 'duyet';
    if (act === 'xoa' && !window.confirm('Xoá phiếu việc này?')) return;
    b.disabled = true;
    say('');
    api('POST', body).then(function () {
      if (act === 'duyet-dang') { location.href = chatLink(art.getAttribute('data-post')); return; }
      if (act === 'redo-ngay') { location.href = chatLink('Làm lại phiếu việc ' + id + ' ("' + job.tieu_de + '"). Khách yêu cầu sửa: ' + body.ghi_chu + '. Gọi CREWZY_VIEC_CAN_LAM với id để đọc bản cũ (gồm prompt_da_dung), gọi CREWZY_PROMPT_PRO, viết prompt mới sửa đúng ý khách, làm lại ảnh/video và bài, nộp CREWZY_NOP_KET_QUA kèm id ' + id + ' và prompt_da_dung mới.'); return; }
      return load();
    }).catch(function (err) { b.disabled = false; say(err.message); });
  });
  listEl.addEventListener('click', function (e) { var c = e.target.closest('[data-chip]'); if (c) c.classList.toggle('on'); });

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
