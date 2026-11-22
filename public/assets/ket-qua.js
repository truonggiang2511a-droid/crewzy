// Màn Kết quả: đọc /api/results?thang= → biên nhận tháng (giờ, tiền tiết kiệm, gấp bao nhiêu lần tiền gói), số việc, biểu đồ ngày, kết quả gần đây.
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var num = function (n) { return Number(n || 0).toLocaleString('vi-VN'); };
  var vnd = function (n) { return num(n) + 'đ'; };
  var KPI = [['dang_bai', 'Bài đã đăng'], ['tra_loi', 'Bình luận đã trả lời'], ['gui_tin', 'Tin nhắn, email'], ['anh', 'Ảnh đã tạo'], ['khach', 'Khách mới vào CRM']];
  var STATUS = { cho_duyet: 'Chờ bạn duyệt', da_duyet: 'Đã duyệt', da_dang: 'Đã đăng', xong: 'Xong' };

  var sel = $('[data-month]');
  var now = new Date(Date.now() + 7 * 3600000);
  for (var i = 0; i < 6; i++) {
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    var m = d.toISOString().slice(0, 7);
    var o = document.createElement('option');
    o.value = m; o.textContent = (i === 0 ? 'Tháng này · ' : '') + 'Tháng ' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
    sel.appendChild(o);
  }
  var q = new URLSearchParams(location.search).get('thang');
  if (q) sel.value = q;
  sel.addEventListener('change', function () { history.replaceState(null, '', '?thang=' + sel.value); load(); });

  function load() {
    $('[data-hero]').innerHTML = '<p style="color:#A3A3A3;margin:0">Đang tải…</p>';
    fetch('/api/results?thang=' + sel.value, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render)
      .catch(function () { $('[data-hero]').innerHTML = '<p style="margin:0">Chưa tải được kết quả, thử lại sau.</p>'; });
  }

  function render(d) {
    if (d.error) { $('[data-hero]').innerHTML = '<p style="margin:0">' + esc(d.error) + '</p>'; return; }
    var v = d.viec || {};
    var tong = KPI.reduce(function (s, k) { return s + (v[k[0]] || 0); }, 0) + (v.video || 0) + (d.ket_qua.tong || 0);
    var hero = '<span class="label-mono" style="color:#A3A3A3">Biên nhận ' + esc(d.tu.split('-').reverse().join('/')) + ' – ' + esc(d.den.split('-').reverse().join('/')) + '</span>';
    if (!tong) {
      hero += '<div style="font-size:26px;font-weight:500;letter-spacing:-.02em">Đội AI chưa làm việc nào trong tháng này</div>' +
        '<p style="margin:0;color:#D4D4D4">Giao việc đầu tiên hoặc hẹn giờ một quy trình, kết quả sẽ hiện ở đây.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><a class="btn" style="background:#D4FF4A;color:#0F0F0F;border-color:#D4FF4A" href="quy-trinh.html">Chọn quy trình</a><a class="btn" style="color:#fff;border-color:#525252" href="chat.html">Nhờ Trợ lý</a></div>';
    } else {
      hero += '<div style="font-size:clamp(26px,4vw,40px);font-weight:500;letter-spacing:-.03em;line-height:1.1">Tiết kiệm <span style="color:#D4FF4A">' + num(d.gio_tiet_kiem) + ' giờ</span> làm việc</div>' +
        '<p style="margin:0;color:#D4D4D4;font-size:15px">Tương đương ' + vnd(d.tien_tiet_kiem) + ' tiền công' +
        (d.gap_lan ? ' · <b style="color:#fff">gấp ' + num(d.gap_lan) + ' lần</b> tiền gói ' + esc(d.goi.ten) + ' (' + vnd(d.goi.gia) + ')' : '') + '.</p>' +
        '<p style="margin:0;color:#A3A3A3;font-size:13px">' + num(tong) + ' việc đã xong · ' + num(d.credit_dung) + ' credit đã dùng' +
        (d.tai_khoan ? ' · còn ' + num(d.tai_khoan.credits) + ' credit' : '') + '</p>';
    }
    $('[data-hero]').innerHTML = hero;

    $('[data-kpis]').innerHTML = KPI.map(function (k) {
      return '<div class="card kpi"><p class="kpi-label">' + esc(k[1]) + '</p><p class="kpi-num">' + num(v[k[0]]) + '</p></div>';
    }).join('');

    // Biểu đồ cột theo ngày (SVG, không thư viện).
    var days = [], map = {};
    (d.series || []).forEach(function (r) { map[r.day] = r.n; });
    for (var t = Date.parse(d.tu + 'T00:00:00Z'); t <= Date.parse(d.den + 'T00:00:00Z'); t += 86400000) { var k = new Date(t).toISOString().slice(0, 10); days.push([k, map[k] || 0]); }
    var max = Math.max.apply(null, days.map(function (x) { return x[1]; }).concat([1]));
    var bw = 22, h = 140, w = days.length * bw;
    $('[data-chart]').innerHTML = days.every(function (x) { return !x[1]; }) ? '<p class="muted" style="margin:0">Chưa có việc nào trong tháng.</p>' :
      '<svg role="img" aria-label="Số việc mỗi ngày" width="' + w + '" height="' + (h + 22) + '" style="display:block">' + days.map(function (x, i) {
        var bh = Math.round((x[1] / max) * (h - 16));
        return '<g><title>' + x[0].slice(8) + '/' + x[0].slice(5, 7) + ': ' + x[1] + ' việc</title><rect x="' + (i * bw + 4) + '" y="' + (h - bh) + '" width="' + (bw - 8) + '" height="' + Math.max(bh, x[1] ? 2 : 0) + '" rx="3" fill="#0F0F0F"/>' +
          (x[1] ? '<text x="' + (i * bw + bw / 2) + '" y="' + (h - bh - 4) + '" text-anchor="middle" font-size="10" fill="#525252">' + x[1] + '</text>' : '') +
          '<text x="' + (i * bw + bw / 2) + '" y="' + (h + 16) + '" text-anchor="middle" font-size="10" fill="#8A8A8A">' + Number(x[0].slice(8)) + '</text></g>';
      }).join('') + '</svg>';

    var rows = Object.keys(d.nhan).filter(function (k) { return v[k]; }).map(function (k) { return [d.nhan[k], v[k]]; });
    rows.push(['Kết quả nộp về Crewzy', d.ket_qua.tong], ['Báo cáo', d.ket_qua.bao_cao]);
    $('[data-detail]').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows.map(function (r) {
      return '<tr style="border-bottom:1px solid #EEE"><td style="padding:8px 0">' + esc(r[0]) + '</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums"><b>' + num(r[1]) + '</b></td></tr>';
    }).join('') + '</table>';

    $('[data-recent]').innerHTML = (d.gan_day || []).length ? (d.gan_day || []).map(function (j) {
      return '<a href="cho-duyet.html?id=' + encodeURIComponent(j.id) + '" style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #EEE;color:inherit;text-decoration:none">' +
        '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.tieu_de) + '</span><span class="muted" style="flex:none;font-size:12px">' + esc(STATUS[j.trang_thai] || '') + '</span></a>';
    }).join('') : '<p class="muted" style="margin:0">Chưa có kết quả nào trong tháng.</p>';

    var tips = [];
    if (!v.dang_bai) tips.push(['Chưa có bài nào được đăng', 'Hẹn giờ quy trình nội dung tuần, AI viết và đăng đều mỗi ngày.', 'quy-trinh.html?phong=noi_dung']);
    if (!v.tra_loi) tips.push(['Chưa trả lời bình luận nào', 'Bật quy trình Tự trả lời bình luận để không bỏ sót khách hỏi giá.', 'quy-trinh.html?phong=cham_soc']);
    if (d.ket_qua.cho_duyet) tips.push([d.ket_qua.cho_duyet + ' kết quả đang chờ bạn duyệt', 'Duyệt để AI đăng ngay.', 'cho-duyet.html']);
    var tb = $('[data-tips]');
    tb.hidden = !tips.length;
    tb.innerHTML = '<h2 style="margin:0;font-size:18px;font-weight:500">Làm nhiều hơn tháng này</h2>' + tips.map(function (t) {
      return '<a href="' + t[2] + '" style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #EEE;color:inherit;text-decoration:none"><span><b>' + esc(t[0]) + '</b><br><span class="muted" style="font-size:13px">' + esc(t[1]) + '</span></span><span aria-hidden="true">→</span></a>';
    }).join('');

    $('[data-note]').textContent = 'Giờ tiết kiệm là ước tính theo thời gian một nhân viên làm tay (bài đăng 20 phút, trả lời bình luận 3 phút, email 5 phút, ảnh 15 phút, video 60 phút, báo cáo 60 phút), quy ra tiền theo ' + vnd(d.gia_gio) + '/giờ. Số việc được ghi từ 22/11/2026.';
  }
  load();
})();
