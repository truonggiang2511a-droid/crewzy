// Danh mục ứng dụng người Việt hay dùng để làm doanh nghiệp, nội dung, thương hiệu.
// Nguồn duy nhất cho: trang Kết nối (qua /api/catalog), danh sách được phép kết nối (TOOLKITS) và Skill nạp cho AI khi chat.
// status: 'ready' = nối nhanh qua Composio được (đã thử tạo link 22/11/2026) · 'soon' = Composio chưa có hoặc cần app riêng.
// CẢNH BÁO: chỉ để 'ready' app đã thử /api/connect ra link. Một slug cần auth config riêng nằm trong TOOLKITS làm hỏng
// composio.create() của MỌI người (chat, link nối AI) với lỗi "require auth configs but none exist".
// logo: lấy từ https://logos.composio.dev/api/<slug>; app 'soon' không có trên Composio thì giao diện hiện chữ cái đầu.

export const CATEGORIES = [
  { id: 'social', name: 'Mạng xã hội' },
  { id: 'ads', name: 'Quảng cáo & đo lường' },
  { id: 'chat', name: 'Nhắn tin & chăm khách' },
  { id: 'office', name: 'Email, lịch, tài liệu' },
  { id: 'sales', name: 'Bán hàng & CRM' },
  { id: 'creative', name: 'Thiết kế & video AI' },
];

// can: AI làm được gì · try: câu lệnh mẫu (bấm để thử trong Trợ lý AI) · rules: luật riêng khi AI dùng app này
export const APPS = [
  // ---------- Mạng xã hội ----------
  { slug: 'facebook', name: 'Facebook Fanpage', cat: 'social', status: 'ready',
    desc: 'Đăng bài, đọc và trả lời bình luận, tin nhắn Fanpage.',
    note: 'Một lần kết nối thấy hết các Fanpage bạn quản lý. Không dùng cho trang cá nhân.',
    can: ['Liệt kê Fanpage đang quản lý', 'Đăng bài chữ, ảnh, link, hẹn giờ đăng', 'Đọc bình luận mới và trả lời', 'Đọc tin nhắn Messenger của Fanpage', 'Xem số liệu bài đăng'],
    try: ['Liệt kê các Fanpage em đang quản lý được', 'Đọc 10 bình luận mới nhất trên Fanpage và gợi ý câu trả lời'],
    rules: ['Luôn lấy page_id bằng công cụ liệt kê Fanpage trước, hỏi khách chọn trang nếu có nhiều trang', 'Bài hẹn giờ phải cách hiện tại ít nhất 10 phút', 'Trả lời bình luận: lịch sự, ngắn, mời nhắn tin, không đưa giá nếu Brain thương hiệu chưa có giá'] },
  { slug: 'instagram', name: 'Instagram', cat: 'social', status: 'ready',
    desc: 'Đăng ảnh, carousel, Reels, đọc bình luận.',
    note: 'Cần tài khoản Business hoặc Creator đã liên kết với Fanpage.',
    can: ['Đăng ảnh, carousel, Reels từ link ảnh/video công khai', 'Đọc và trả lời bình luận', 'Xem số liệu bài đăng'],
    try: ['Xem 5 bài Instagram gần nhất và lượt tương tác'],
    rules: ['Ảnh/video phải có link công khai; ảnh bài đăng nên khổ 4:5, Reels 9:16'] },
  { slug: 'tiktok', name: 'TikTok', cat: 'social', status: 'soon',
    desc: 'Đăng video, xem thông tin và video của kênh.',
    note: 'Composio cần app TikTok developer riêng (đã duyệt) mới nối được. Đang chuẩn bị.',
    can: ['Xem thông tin kênh', 'Liệt kê video đã đăng', 'Đăng video từ link'],
    try: ['Xem thông tin kênh TikTok và 5 video gần nhất'],
    rules: ['Báo trước cho khách: video có thể chỉ hiện riêng tư nếu app chưa được TikTok duyệt'] },
  { slug: 'youtube', name: 'YouTube', cat: 'social', status: 'ready',
    desc: 'Tải video, sửa tiêu đề mô tả, đọc và trả lời bình luận.',
    can: ['Liệt kê video của kênh', 'Sửa tiêu đề, mô tả, thẻ', 'Đọc và trả lời bình luận', 'Xem số liệu video'],
    try: ['Liệt kê 5 video mới nhất của kênh YouTube và lượt xem'],
    rules: ['Sửa tiêu đề/mô tả video đang có lượt xem: đưa bản cũ và bản mới cho khách duyệt trước'] },
  { slug: 'threads', name: 'Threads', cat: 'social', status: 'soon',
    desc: 'Đăng bài ngắn, đọc trả lời trên Threads.',
    note: 'Composio cần app Meta riêng có quyền Threads mới nối được. Đang chuẩn bị.',
    can: ['Đăng bài chữ, ảnh', 'Đọc trả lời bài đăng'], try: ['Soạn 3 bài Threads ngắn giới thiệu sản phẩm, chưa đăng'], rules: [] },
  { slug: 'linkedin', name: 'LinkedIn', cat: 'social', status: 'ready',
    desc: 'Đăng bài trên trang cá nhân hoặc trang công ty.',
    can: ['Đăng bài chữ, ảnh, link'], try: ['Soạn bài LinkedIn giới thiệu doanh nghiệp, chưa đăng'], rules: [] },
  { slug: 'zalo', name: 'Zalo OA', cat: 'chat', status: 'soon',
    desc: 'Nhắn tin chăm sóc khách qua Zalo Official Account.',
    note: 'Composio chưa có Zalo. Sẽ làm kết nối riêng qua Zalo OA API.', can: [], try: [], rules: [] },

  // ---------- Quảng cáo & đo lường ----------
  { slug: 'metaads', name: 'Meta Ads', cat: 'ads', status: 'ready',
    desc: 'Xem chiến dịch, chi tiêu, kết quả quảng cáo Facebook, Instagram.',
    can: ['Liệt kê tài khoản quảng cáo, chiến dịch', 'Xem chi tiêu, lượt hiển thị, tin nhắn, chi phí mỗi kết quả', 'Tạm dừng hoặc bật lại quảng cáo khi khách đồng ý'],
    try: ['Báo cáo chi tiêu và kết quả quảng cáo Meta 7 ngày qua'],
    rules: ['Mọi thay đổi ngân sách, bật/tắt quảng cáo đều là chi tiền: phải tóm tắt và chờ khách đồng ý', 'Báo cáo bằng VNĐ nếu tài khoản dùng VNĐ, ghi rõ khoảng ngày'] },
  { slug: 'googleads', name: 'Google Ads', cat: 'ads', status: 'ready',
    desc: 'Xem chiến dịch tìm kiếm, YouTube, chi tiêu và chuyển đổi.',
    can: ['Liệt kê chiến dịch', 'Xem chi tiêu, lượt nhấp, chuyển đổi'], try: ['Báo cáo Google Ads 7 ngày qua: chi tiêu, lượt nhấp, chuyển đổi'],
    rules: ['Không tự đổi ngân sách hay giá thầu; chỉ đề xuất cho khách duyệt'] },
  { slug: 'tiktok_ads', name: 'TikTok Ads', cat: 'ads', status: 'soon',
    desc: 'Xem chiến dịch và chi tiêu quảng cáo TikTok.', note: 'Đang thử kết nối.', can: [], try: [], rules: [] },
  { slug: 'google_analytics', name: 'Google Analytics', cat: 'ads', status: 'ready',
    desc: 'Xem lượt truy cập website, nguồn khách, chuyển đổi.',
    can: ['Báo cáo lượt truy cập theo ngày, nguồn', 'Xem trang được xem nhiều'], try: ['Website có bao nhiêu lượt truy cập 7 ngày qua, từ nguồn nào?'], rules: [] },
  { slug: 'google_business_profile', name: 'Google Business', cat: 'ads', status: 'soon',
    desc: 'Quản lý hồ sơ cửa hàng trên Google Maps, đọc và trả lời đánh giá.',
    note: 'Composio cần app Google riêng có quyền Business Profile (Google duyệt) mới nối được. Đang chuẩn bị.',
    can: ['Đọc đánh giá mới', 'Trả lời đánh giá', 'Đăng bài cập nhật trên hồ sơ'], try: ['Đọc 5 đánh giá Google mới nhất và gợi ý câu trả lời'],
    rules: ['Trả lời đánh giá xấu: xin lỗi, mời liên hệ riêng, không tranh cãi; luôn cho khách duyệt trước khi đăng'] },

  // ---------- Nhắn tin ----------
  { slug: 'telegram', name: 'Telegram', cat: 'chat', status: 'ready',
    desc: 'Gửi thông báo, tin nhắn qua bot Telegram.',
    note: 'Cần tạo bot bằng @BotFather rồi dán mã bot khi kết nối.',
    can: ['Gửi tin nhắn tới nhóm hoặc người đã nhắn bot', 'Gửi báo cáo hằng ngày'], try: ['Gửi tin nhắn thử "Văn Phòng AI đã kết nối" vào Telegram'],
    rules: ['Chỉ nhắn tới cuộc trò chuyện khách chỉ định'] },
  { slug: 'whatsapp', name: 'WhatsApp Business', cat: 'chat', status: 'ready',
    desc: 'Nhắn tin chăm sóc khách quốc tế qua WhatsApp Business.',
    can: ['Gửi tin nhắn mẫu', 'Đọc tin nhắn đến'], try: [], rules: ['Gửi tin cho khách hàng là việc ra bên ngoài: phải chờ đồng ý'] },

  // ---------- Email, lịch, tài liệu ----------
  { slug: 'gmail', name: 'Gmail', cat: 'office', status: 'ready',
    desc: 'Đọc, soạn, gửi email, gom email khách hỏi.',
    can: ['Tìm và đọc email', 'Soạn nháp, gửi email', 'Gắn nhãn, lọc email khách hỏi mua'], try: ['Tìm email khách hỏi giá trong 7 ngày qua và tóm tắt'],
    rules: ['Ưu tiên tạo bản nháp; chỉ gửi khi khách đồng ý', 'Không xoá email'] },
  { slug: 'googlecalendar', name: 'Google Calendar', cat: 'office', status: 'ready',
    desc: 'Xem lịch, tạo lịch hẹn với khách.',
    can: ['Xem lịch theo ngày, tuần', 'Tạo lịch hẹn, mời khách'], try: ['Xem lịch hẹn tuần này trên Google Calendar'],
    rules: ['Múi giờ Việt Nam (Asia/Ho_Chi_Minh) nếu khách không nói khác', 'Mời người khác vào lịch là việc ra bên ngoài: chờ đồng ý'] },
  { slug: 'googlesheets', name: 'Google Sheets', cat: 'office', status: 'ready',
    desc: 'Đọc, ghi bảng khách hàng, bảng giá, báo cáo.',
    can: ['Đọc dữ liệu bảng', 'Thêm dòng khách mới', 'Cập nhật trạng thái, ghi báo cáo'], try: ['Đọc 10 dòng đầu trong Google Sheet khách hàng của tôi'],
    rules: ['Tìm file bằng tên khách nói; nhiều file trùng tên thì hỏi lại', 'Ghi thêm dòng, không xoá dòng cũ'] },
  { slug: 'googledrive', name: 'Google Drive', cat: 'office', status: 'ready',
    desc: 'Tìm file, lấy ảnh, video, tài liệu để làm nội dung.',
    can: ['Tìm file theo tên', 'Lấy link chia sẻ', 'Tải file lên'], try: ['Tìm thư mục ảnh sản phẩm trên Google Drive'], rules: ['Không đổi quyền chia sẻ file khi khách chưa đồng ý'] },
  { slug: 'googledocs', name: 'Google Docs', cat: 'office', status: 'ready',
    desc: 'Viết, sửa tài liệu, kịch bản, kế hoạch nội dung.',
    can: ['Tạo tài liệu mới', 'Đọc và sửa tài liệu'], try: ['Tạo Google Docs kế hoạch nội dung tuần này'], rules: [] },
  { slug: 'notion', name: 'Notion', cat: 'office', status: 'ready',
    desc: 'Ghi việc, kế hoạch nội dung, kho kiến thức.',
    can: ['Tìm trang, cơ sở dữ liệu', 'Thêm việc, cập nhật trạng thái'], try: ['Liệt kê các trang Notion gần đây'], rules: [] },

  // ---------- Bán hàng & CRM ----------
  { slug: 'hubspot', name: 'HubSpot CRM', cat: 'sales', status: 'ready',
    desc: 'Lưu khách hàng, cơ hội bán, ghi chú chăm sóc.',
    can: ['Thêm, tìm liên hệ', 'Tạo cơ hội bán (deal)', 'Ghi chú chăm sóc'], try: ['Tìm 10 khách mới nhất trong HubSpot'],
    rules: ['Chỉ thêm khách đã đồng ý được liên hệ'] },
  { slug: 'shopee', name: 'Shopee', cat: 'sales', status: 'soon', desc: 'Đơn hàng, sản phẩm, chat với người mua.', note: 'Composio chưa có Shopee. Sẽ nối qua Shopee Open Platform.', can: [], try: [], rules: [] },
  { slug: 'tiktokshop', name: 'TikTok Shop', cat: 'sales', status: 'soon', desc: 'Đơn hàng, sản phẩm TikTok Shop.', note: 'Chưa có trên Composio.', can: [], try: [], rules: [] },
  { slug: 'lazada', name: 'Lazada', cat: 'sales', status: 'soon', desc: 'Đơn hàng và sản phẩm Lazada.', note: 'Chưa có trên Composio.', can: [], try: [], rules: [] },
  { slug: 'haravan', name: 'Haravan', cat: 'sales', status: 'soon', desc: 'Website bán hàng, đơn, kho.', note: 'Chưa có trên Composio.', can: [], try: [], rules: [] },
  { slug: 'sapo', name: 'Sapo', cat: 'sales', status: 'soon', desc: 'Quản lý bán hàng, đơn, kho.', note: 'Chưa có trên Composio.', can: [], try: [], rules: [] },

  // ---------- Thiết kế & video AI ----------
  { slug: 'canva', name: 'Canva', cat: 'creative', status: 'ready',
    desc: 'Tạo thiết kế từ mẫu, xuất ảnh đăng bài.',
    can: ['Tìm thiết kế, tạo thiết kế mới', 'Xuất ảnh PNG/JPG'], try: ['Liệt kê thiết kế Canva gần đây của tôi'], rules: [] },
  { slug: 'heygen', name: 'HeyGen', cat: 'creative', status: 'ready',
    desc: 'Làm video người dẫn AI nói tiếng Việt.',
    note: 'Kết nối bằng khoá API HeyGen của bạn; tiền dựng video tính vào tài khoản HeyGen.',
    can: ['Liệt kê avatar, giọng đọc', 'Tạo video từ kịch bản'], try: ['Liệt kê các avatar HeyGen tôi dùng được'],
    rules: ['Tạo video tốn tiền tài khoản HeyGen: báo độ dài và chờ đồng ý'] },
  { slug: 'elevenlabs', name: 'ElevenLabs', cat: 'creative', status: 'ready',
    desc: 'Giọng đọc AI cho video, quảng cáo.',
    note: 'Kết nối bằng khoá API ElevenLabs của bạn.', can: ['Liệt kê giọng', 'Chuyển văn bản thành giọng nói'], try: [], rules: ['Tốn tiền tài khoản ElevenLabs: chờ đồng ý với đoạn dài'] },
  { slug: 'capcut', name: 'CapCut', cat: 'creative', status: 'soon', desc: 'Dựng video ngắn.', note: 'CapCut chưa mở API công khai.', can: [], try: [], rules: [] },
];

export const appBySlug = (slug) => APPS.find((a) => a.slug === slug);
export const READY_SLUGS = APPS.filter((a) => a.status === 'ready').map((a) => a.slug);

// Skill nạp cho AI: chỉ các app khách đã kết nối, gọn để đỡ tốn chữ.
export function skillText(slugs) {
  return slugs.map(appBySlug).filter((a) => a && a.status === 'ready').map((a) => {
    const lines = [`## ${a.name} (toolkit ${a.slug})`];
    if (a.can.length) lines.push('Làm được: ' + a.can.join('; ') + '.');
    if (a.note) lines.push('Lưu ý: ' + a.note);
    for (const r of a.rules) lines.push('- ' + r);
    return lines.join('\n');
  }).join('\n\n');
}

// Dữ liệu gửi cho giao diện.
export function publicCatalog() {
  return { categories: CATEGORIES, apps: APPS.map(({ slug, name, cat, status, desc, note, can, try: tryCmds, rules }) => ({ slug, name, cat, status, desc, note: note || '', can, try: tryCmds, rules })) };
}
