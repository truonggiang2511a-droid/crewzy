// Trang Quy trình: mẫu việc theo phòng ban. Mỗi mẫu cần một số app (logo), bấm Chạy → Trợ lý AI nhận câu lệnh mẫu.
(function () {
  var uid = window.vpaiUid();
  // need: app bắt buộc · optional: app nên có · prompt: câu lệnh gửi Trợ lý AI
  var FLOWS = [
    { name: 'Tuần nội dung đa kênh', team: 'Phòng Nội dung', need: ['facebook'], optional: ['instagram', 'tiktok', 'threads'],
      desc: 'Lên 7 ý tưởng, viết 7 bài theo giọng thương hiệu, bạn duyệt rồi hẹn giờ đăng cả tuần.',
      steps: ['Đọc Brain thương hiệu', 'Đề xuất 7 ý tưởng, bạn chọn', 'Viết bài cho từng kênh', 'Bạn duyệt', 'Hẹn giờ đăng'],
      prompt: 'Chạy quy trình Tuần nội dung đa kênh: đọc Brain thương hiệu, đề xuất 7 ý tưởng bài đăng cho 7 ngày tới (mỗi ý tưởng 1 dòng: góc nội dung, kênh, giờ đăng). Chờ tôi chọn rồi mới viết bài, chưa đăng gì.' },
    { name: 'Trả lời bình luận và gom khách', team: 'Phòng Chăm sóc khách', need: ['facebook'], optional: ['googlesheets'],
      desc: 'Đọc bình luận mới trên Fanpage, soạn câu trả lời, ghi khách quan tâm vào Google Sheet.',
      steps: ['Đọc bình luận 24 giờ qua', 'Phân loại: hỏi giá, quan tâm, khác', 'Soạn câu trả lời', 'Bạn duyệt rồi trả lời', 'Ghi khách vào Sheet'],
      prompt: 'Chạy quy trình Trả lời bình luận: đọc bình luận mới trong 24 giờ qua trên Fanpage, phân loại (hỏi giá / quan tâm / khác) và soạn câu trả lời theo Brain thương hiệu. Đưa tôi duyệt trước khi trả lời.' },
    { name: 'Báo cáo quảng cáo hằng tuần', team: 'Phòng Quảng cáo', need: ['metaads'], optional: ['googleads', 'googlesheets', 'telegram'],
      desc: 'Tổng hợp chi tiêu, kết quả, chi phí mỗi khách; chỉ ra chiến dịch nên tăng, nên tắt.',
      steps: ['Lấy số liệu 7 ngày', 'So sánh với tuần trước', 'Đề xuất tăng, giảm, tắt', 'Bạn quyết định'],
      prompt: 'Chạy quy trình Báo cáo quảng cáo tuần: lấy chi tiêu, kết quả, chi phí mỗi kết quả của các chiến dịch Meta Ads 7 ngày qua, so với 7 ngày trước đó, rồi đề xuất chiến dịch nên tăng, giảm, tắt. Chỉ đề xuất, không tự thay đổi.' },
    { name: 'Chăm sóc khách qua email', team: 'Phòng Bán hàng', need: ['gmail'], optional: ['googlesheets', 'hubspot'],
      desc: 'Tìm email khách hỏi mua, soạn thư trả lời và lưu khách vào danh sách chăm sóc.',
      steps: ['Tìm email khách hỏi 7 ngày qua', 'Tóm tắt nhu cầu', 'Soạn thư nháp', 'Bạn duyệt rồi gửi'],
      prompt: 'Chạy quy trình Chăm sóc khách qua email: tìm email khách hỏi mua hoặc hỏi giá trong 7 ngày qua, tóm tắt nhu cầu từng người và soạn thư trả lời dạng nháp theo Brain thương hiệu. Chưa gửi.' },
    { name: 'Trả lời đánh giá Google', team: 'Phòng Thương hiệu', need: ['google_business_profile'], optional: [],
      desc: 'Đọc đánh giá mới trên Google Maps, soạn câu cảm ơn hoặc xin lỗi đúng mực.',
      steps: ['Đọc đánh giá mới', 'Soạn câu trả lời', 'Bạn duyệt rồi đăng'],
      prompt: 'Chạy quy trình Trả lời đánh giá Google: đọc các đánh giá mới chưa trả lời, soạn câu trả lời cho từng đánh giá (cảm ơn đánh giá tốt, xin lỗi và mời liên hệ với đánh giá xấu). Đưa tôi duyệt trước khi đăng.' },
    { name: 'Lịch hẹn và nhắc việc', team: 'Phòng Hành chính', need: ['googlecalendar'], optional: ['telegram'],
      desc: 'Xem lịch tuần, nhắc các cuộc hẹn quan trọng, gửi tóm tắt qua Telegram.',
      steps: ['Đọc lịch 7 ngày tới', 'Đánh dấu hẹn quan trọng', 'Gửi tóm tắt'],
      prompt: 'Chạy quy trình Lịch hẹn: xem lịch 7 ngày tới trên Google Calendar, tóm tắt các cuộc hẹn theo ngày và chỉ ra ngày nào bận, ngày nào trống.' },
    { name: 'Video người dẫn AI từ bài viết', team: 'Phòng Video', need: ['heygen'], optional: ['youtube'],
      desc: 'Biến một bài viết thành kịch bản 45 giây và dựng video người dẫn AI nói tiếng Việt.',
      steps: ['Viết kịch bản 45 giây', 'Bạn duyệt kịch bản', 'Chọn avatar, giọng', 'Dựng video (tốn credit HeyGen)'],
      prompt: 'Chạy quy trình Video người dẫn AI: viết kịch bản video dọc 45 giây giới thiệu sản phẩm chính trong Brain thương hiệu (3 giây đầu gây chú ý, giữa nêu giá trị, cuối mời nhắn tin). Chờ tôi duyệt kịch bản rồi mới dựng.' }
  ];

  var listEl = document.querySelector('[data-flows]');
  var names = {};
  var statusOf = {};
  function esc(t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function logo(slug, on) {
    return '<img src="https://logos.composio.dev/api/' + slug + '" alt="' + esc(names[slug] || slug) + '" title="' + esc(names[slug] || slug) + (on ? ' · đã kết nối' : ' · chưa kết nối') + '" style="width:26px;height:26px;border-radius:6px;background:#fff;border:1px solid var(--line);padding:2px;' + (on ? '' : 'opacity:.45;filter:grayscale(1)') + '">';
  }

  function render(accounts) {
    listEl.innerHTML = FLOWS.map(function (f, i) {
      var missing = f.need.filter(function (s) { return !(accounts[s] > 0); });
      var ready = !missing.length;
      var soon = f.need.some(function (s) { return statusOf[s] && statusOf[s] !== 'ready'; });
      var apps = f.need.concat(f.optional).map(function (s) { return logo(s, accounts[s] > 0); }).join('');
      return '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><p class="muted" style="margin:0;font-size:12px;font-weight:600">' + esc(f.team) + '</p><h2 style="margin:2px 0 0;font-size:17px;font-weight:600">' + esc(f.name) + '</h2></div>' +
        (soon ? '<span class="pill">Sắp có</span>' : ready ? '<span class="pill pill-ok"><span class="dot"></span>Sẵn sàng</span>' : '<span class="pill pill-warn">Thiếu kết nối</span>') + '</div>' +
        '<p class="muted" style="margin:0;font-size:14px;line-height:1.5">' + esc(f.desc) + '</p>' +
        '<ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.7">' + f.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' + apps + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">' +
        (soon ? '<button type="button" class="btn btn-ghost" disabled>Chờ mở kết nối ' + esc(names[f.need[0]] || '') + '</button>' : ready ? '<a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent(f.prompt) + '">Chạy với Trợ lý AI</a>'
          : '<a class="btn btn-primary" href="ket-noi.html?app=' + missing[0] + '">Kết nối ' + esc(names[missing[0]] || missing[0]) + '</a>') +
        '</div></div>';
    }).join('');
  }

  function json(url) { return fetch(url).then(function (r) { if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin(); return r.json(); }); }
  Promise.all([
    json('/api/catalog').catch(function () { return { apps: [] }; }),
    json('/api/status?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    json('/api/brand?uid=' + encodeURIComponent(uid)).catch(function () { return {}; })
  ]).then(function (r) {
    (r[0].apps || []).forEach(function (a) { names[a.slug] = a.name; statusOf[a.slug] = a.status; });
    render((r[1] && r[1].accounts) || {});
    var b = (r[2] && r[2].brand) || {};
    document.querySelector('[data-brand-warn]').hidden = !!(b.name || b.products);
  });
})();
