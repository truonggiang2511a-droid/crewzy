// Tab "AI của bạn" ở trang Kết nối, làm theo kiểu trang MCP của OpenArt (openart.ai/mcp):
// bước 2 chọn AI (Claude, ChatGPT, Gemini, Grok, Cursor, AI khác) → hướng dẫn 3 bước; bước 3 câu lệnh mẫu;
// thư viện câu lệnh lọc Marketing / Mạng xã hội / Bán hàng / Báo cáo, có Thử trong Crewzy và Sao chép.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var clientsEl = $('[data-ai-clients]');
  if (!clientsEl) return;
  var panel = $('[data-ai-panel]');
  var sampleEl = $('[data-ai-sample]');
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Hướng dẫn đã tra ngày 22/11/2026 (xem CLAUDE.md, mục Nối AI bên ngoài).
  var CLIENTS = [
    { id: 'claude', name: 'Claude', logo: 'claude', need: 'claude.ai, gói Pro trở lên', steps: ['Mở claude.ai → Cài đặt (Settings) → <b>Connectors</b>.', 'Bấm <b>Add custom connector</b>, đặt tên <b>Crewzy</b>, dán link ở bước 1, bấm Add.', 'Trong khung chat bấm nút <b>+</b> → bật Crewzy.'], sample: 'Dùng Crewzy: đọc Brain thương hiệu rồi lên 7 bài Facebook cho tuần này, ghi vào Google Sheet để tôi duyệt.' },
    { id: 'chatgpt', name: 'ChatGPT', logo: 'openai', need: 'chatgpt.com, gói Plus trở lên', steps: ['Settings → Apps → Advanced settings → bật <b>Developer mode</b>.', 'Bấm <b>Create app</b>, đặt tên <b>Crewzy</b>, dán link ở bước 1, phần xác thực chọn <b>No authentication</b>, lưu.', 'Khi chat gõ <b>@Crewzy</b> hoặc chọn app Crewzy rồi giao việc.'], sample: '@Crewzy làm 1 ảnh quảng cáo dọc 4:5 cho sản phẩm chính rồi đưa vào Canva cho tôi chỉnh.' },
    { id: 'gemini', name: 'Gemini', logo: 'gemini', need: 'gemini.google.com trên web, giao diện tiếng Anh', steps: ['Settings → <b>Connected Apps</b> → Custom apps → <b>Add a custom app</b>.', 'Dán link ở bước 1, bấm Next rồi đồng ý kết nối (cần bật Keep Activity).', 'Thêm xong dùng được cả trên app Gemini điện thoại.'], sample: 'Dùng Crewzy đọc số liệu quảng cáo Meta 7 ngày qua và chỉ ra chiến dịch nên tắt.' },
    { id: 'grok', name: 'Grok', logo: 'grok', need: 'grok.com, gói trả phí', steps: ['Mở <b>grok.com/connectors</b>.', 'Bấm <b>New Connector</b> → <b>Custom</b>, đặt tên Crewzy, dán link ở bước 1, lưu.', 'Khi chat bật connector Crewzy rồi giao việc.'], sample: 'Dùng Crewzy viết 3 bài đăng ưu đãi cuối tuần theo Brain thương hiệu, cho tôi duyệt trước khi đăng.' },
    { id: 'cursor', name: 'Cursor', logo: 'cursor', need: 'Cursor trên máy tính', steps: ['Settings → <b>MCP &amp; Integrations</b> → <b>New MCP server</b> (mở file mcp.json).', 'Dán: <code style="font-size:12px">{"mcpServers":{"crewzy":{"url":"LINK_Ở_BƯỚC_1"}}}</code> rồi lưu.', 'Trong khung Agent giao việc, Crewzy hiện trong danh sách công cụ.'], sample: 'Dùng Crewzy lấy 20 bình luận mới nhất trên Fanpage và soạn câu trả lời theo giọng thương hiệu.' },
    { id: 'other', name: 'AI khác', logo: '', need: 'Mọi AI có mục Connectors hoặc MCP', steps: ['Vào phần <b>Connectors</b>, <b>Integrations</b> hoặc <b>MCP</b> trong cài đặt của AI đó.', 'Thêm máy chủ mới: kiểu <b>Streamable HTTP</b>, dán link ở bước 1, chọn không cần đăng nhập (link đã có khoá riêng).', 'Giao việc bằng tiếng Việt; AI sẽ tự đọc hướng dẫn của Crewzy.'], sample: 'Dùng Crewzy kiểm tra các app tôi đã kết nối và gợi ý 3 việc marketing nên làm hôm nay.' }
  ];

  function logoHtml(c) {
    if (!c.logo) return '<span aria-hidden="true" style="width:18px;height:18px;border-radius:4px;background:#1A1A1A;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">+</span>';
    return '<img src="https://logos.composio.dev/api/' + c.logo + '" alt="" style="width:18px;height:18px;border-radius:4px;background:#fff">';
  }

  clientsEl.innerHTML = CLIENTS.map(function (c) {
    return '<button type="button" role="tab" data-ai-client="' + c.id + '" aria-selected="false" aria-pressed="false">' + logoHtml(c) + esc(c.name) + '</button>';
  }).join('');

  function select(id) {
    var c = CLIENTS.filter(function (x) { return x.id === id; })[0] || CLIENTS[0];
    clientsEl.querySelectorAll('[data-ai-client]').forEach(function (b) {
      var on = b.getAttribute('data-ai-client') === c.id;
      b.setAttribute('aria-selected', String(on)); b.setAttribute('aria-pressed', String(on));
    });
    panel.setAttribute('data-ai-guide', c.id);
    panel.innerHTML = '<p class="muted" style="margin:0 0 6px;font-size:12px">' + esc(c.need) + '</p><ol style="margin:0;padding-left:20px">' +
      c.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    sampleEl.textContent = c.sample;
    try { localStorage.setItem('vpai.aiClient', c.id); } catch (e) {}
  }
  clientsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-ai-client]'); if (b) select(b.getAttribute('data-ai-client')); });

  function copy(text, btn) {
    var old = btn.textContent;
    var done = function () { btn.textContent = 'Đã sao chép'; setTimeout(function () { btn.textContent = old; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () {});
    else {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(t);
    }
  }
  $('[data-copy-sample]').addEventListener('click', function (e) { copy(sampleEl.textContent, e.currentTarget); });

  // ---------- Thư viện câu lệnh ----------
  var CATS = [['all', 'Tất cả'], ['marketing', 'Marketing'], ['social', 'Mạng xã hội'], ['sales', 'Bán hàng'], ['report', 'Báo cáo']];
  var PROMPTS = [
    { cat: 'marketing', title: 'Lên 7 bài cho tuần', apps: ['googlesheets', 'facebook'], text: 'Đọc Brain thương hiệu, lên kế hoạch 7 bài Facebook cho tuần này, mỗi bài một góc (lợi ích, câu hỏi khách hay hỏi, hậu trường, ưu đãi, cảm nhận khách). Viết sẵn nội dung và ghi vào một Google Sheet mới. Chưa đăng, gửi tôi duyệt.' },
    { cat: 'marketing', title: 'Ảnh quảng cáo rồi chỉnh trong Canva', apps: ['canva'], text: 'Làm 1 ảnh quảng cáo dọc 4:5 cho sản phẩm chính trong Brain thương hiệu, không chèn chữ vào ảnh, rồi đưa ảnh vào Canva và gửi tôi link để thêm chữ, logo.' },
    { cat: 'marketing', title: 'Video quảng cáo 15 giây (OpenArt)', apps: ['openart'], text: 'Dùng OpenArt làm 1 video dọc 9:16 dài khoảng 15 giây giới thiệu sản phẩm chính theo Brain thương hiệu. Làm xong cho tôi xem video và viết sẵn caption kèm lời kêu gọi nhắn tin.' },
    { cat: 'marketing', title: 'Kịch bản video ngắn', apps: ['googledocs'], text: 'Viết 3 kịch bản video TikTok/Reels 30 giây cho sản phẩm chính: 3 giây đầu gây chú ý, phần giá trị, lời mời nhắn tin. Ghi vào Google Docs.' },
    { cat: 'social', title: 'Đăng bài ưu đãi lên Fanpage', apps: ['facebook'], text: 'Viết bài giới thiệu ưu đãi tháng này theo Brain thương hiệu, tạo kèm 1 ảnh minh hoạ, cho tôi xem trước rồi đăng lên Fanpage khi tôi đồng ý.' },
    { cat: 'social', title: 'Trả lời bình luận', apps: ['facebook'], text: 'Đọc 20 bình luận mới nhất trên bài gần nhất của Fanpage, soạn câu trả lời cho từng bình luận theo giọng thương hiệu và liệt kê để tôi duyệt trước khi trả lời.' },
    { cat: 'social', title: 'Một nội dung, ba kênh', apps: ['instagram', 'linkedin', 'youtube'], text: 'Lấy bài Facebook mới nhất, viết lại thành 1 caption Instagram, 1 bài LinkedIn và 1 mô tả YouTube Shorts phù hợp từng kênh. Gửi tôi duyệt trước khi đăng.' },
    { cat: 'sales', title: 'Lọc khách tiềm năng từ email', apps: ['gmail', 'googlesheets'], text: 'Đọc email khách hỏi giá trong 7 ngày qua, lập danh sách khách tiềm năng (tên, nhu cầu, mức quan tâm) vào Google Sheet và soạn sẵn email trả lời cho từng người để tôi duyệt.' },
    { cat: 'sales', title: 'Chuỗi email chăm sóc khách', apps: ['googledocs', 'gmail'], text: 'Soạn chuỗi 3 email chăm sóc khách đã mua (cảm ơn, hướng dẫn dùng, mời mua lại) theo Brain thương hiệu và lưu vào Google Docs.' },
    { cat: 'sales', title: 'Deal cần gọi lại (HubSpot)', apps: ['hubspot'], text: 'Tìm các deal trên HubSpot chưa liên hệ quá 7 ngày, xếp theo giá trị và gợi ý bước tiếp theo cho từng deal.' },
    { cat: 'report', title: 'Báo cáo quảng cáo tuần', apps: ['metaads', 'googledocs'], text: 'Đọc số liệu quảng cáo Meta 7 ngày qua theo từng chiến dịch: chi tiêu, số tin nhắn, chi phí mỗi tin nhắn. Chỉ ra chiến dịch tốt và chiến dịch nên tắt, ghi báo cáo vào Google Docs.' },
    { cat: 'report', title: 'Báo cáo website 30 ngày', apps: ['google_analytics'], text: 'Lấy số liệu Google Analytics 30 ngày qua: lượt truy cập, nguồn khách, trang xem nhiều, so với 30 ngày trước, tóm tắt 5 ý chính và 3 việc nên làm.' },
    { cat: 'report', title: 'Lịch hẹn tuần tới', apps: ['googlecalendar', 'gmail'], text: 'Đọc lịch Google tuần tới, liệt kê các cuộc hẹn với khách và soạn sẵn email nhắc lịch cho từng người để tôi duyệt.' }
  ];
  var catName = {}; CATS.forEach(function (c) { catName[c[0]] = c[1]; });
  var filterEl = $('[data-prompt-filters]');
  var grid = $('[data-prompt-grid]');
  var current = 'all';

  function appIcon(slug) {
    if (slug === 'openart') return '<span title="OpenArt" style="width:20px;height:20px;border-radius:5px;background:#111;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">O</span>';
    return '<img src="https://logos.composio.dev/api/' + slug + '" alt="" title="' + esc(slug) + '" style="width:20px;height:20px;border-radius:5px" loading="lazy">';
  }
  function renderPrompts() {
    filterEl.querySelectorAll('[data-pf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pf') === current)); });
    grid.innerHTML = PROMPTS.map(function (p, i) {
      if (current !== 'all' && p.cat !== current) return '';
      return '<div class="prompt-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span class="tag">' + esc(catName[p.cat]) + '</span>' +
        '<span style="display:inline-flex;gap:4px">' + p.apps.map(appIcon).join('') + '</span></div>' +
        '<p style="margin:0;font-weight:600;font-size:15px">' + esc(p.title) + '</p><p class="txt">' + esc(p.text) + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto"><a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent(p.text) + '">Thử trong Crewzy</a>' +
        '<button type="button" class="btn btn-ghost" data-copy-prompt="' + i + '">Sao chép</button></div></div>';
    }).join('');
  }
  filterEl.innerHTML = CATS.map(function (c) { return '<button type="button" data-pf="' + c[0] + '" aria-pressed="false">' + esc(c[1]) + '</button>'; }).join('');
  filterEl.addEventListener('click', function (e) { var b = e.target.closest('[data-pf]'); if (b) { current = b.getAttribute('data-pf'); renderPrompts(); } });
  grid.addEventListener('click', function (e) { var b = e.target.closest('[data-copy-prompt]'); if (b) copy(PROMPTS[Number(b.getAttribute('data-copy-prompt'))].text, b); });

  var start = new URLSearchParams(location.search).get('ai');
  var saved = null;
  try { saved = localStorage.getItem('vpai.aiClient'); } catch (e) {}
  select(start || saved || 'claude');
  renderPrompts();
  window.crewzyAiTabs = { select: select };
})();
