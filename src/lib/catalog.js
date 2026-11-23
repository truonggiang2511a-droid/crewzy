// Danh mục ứng dụng người Việt hay dùng để làm doanh nghiệp, nội dung, thương hiệu.
// Nguồn duy nhất cho: trang Kết nối (qua /api/catalog), danh sách được phép kết nối (TOOLKITS) và Skill nạp cho AI khi chat.
// status: 'ready' = nối nhanh qua Composio được (đã thử tạo link 22/11/2026) · 'soon' = Composio chưa có hoặc cần app riêng.
// CẢNH BÁO: chỉ để 'ready' app đã thử /api/connect ra link. Một slug cần auth config riêng nằm trong TOOLKITS làm hỏng
// composio.create() của MỌI người (chat, link nối AI) với lỗi "require auth configs but none exist".
// logo: lấy từ https://logos.composio.dev/api/<slug>; app 'soon' không có trên Composio thì giao diện hiện chữ cái đầu.

import { EXTRA_APPS, EXTRA_CATEGORIES } from './catalogExtra.js';
import { MCP_DIRECTORY } from './mcpDirectory.js';
import { INDUSTRIES } from './industries.js';

const BASE_CATEGORIES = [
  { id: 'social', name: 'Mạng xã hội' },
  { id: 'ads', name: 'Quảng cáo & đo lường' },
  { id: 'chat', name: 'Nhắn tin & chăm khách' },
  { id: 'office', name: 'Email, lịch, tài liệu' },
  { id: 'sales', name: 'Bán hàng & CRM' },
  { id: 'creative', name: 'Thiết kế & video AI' },
  { id: 'research', name: 'Nghiên cứu & SEO' },
  { id: 'email', name: 'Email marketing' },
  { id: 'care', name: 'Chăm sóc khách hàng' },
  { id: 'work', name: 'Quản lý công việc' },
];
export const CATEGORIES = [...BASE_CATEGORIES, ...EXTRA_CATEGORIES];

// can: AI làm được gì · try: câu lệnh mẫu (bấm để thử trong Trợ lý AI) · rules: luật riêng khi AI dùng app này
const BASE_APPS = [
  // ---------- Mạng xã hội ----------
  { slug: 'facebook', name: 'Facebook Fanpage', cat: 'social', status: 'ready',
    desc: 'Đăng bài, đọc và trả lời bình luận, tin nhắn Fanpage.',
    note: 'Một lần kết nối thấy hết các Fanpage bạn quản lý. Không dùng cho trang cá nhân.',
    can: ['Liệt kê Fanpage đang quản lý', 'Đăng bài chữ, ảnh, link, hẹn giờ đăng', 'Đọc bình luận mới và trả lời', 'Đọc và trả lời tin nhắn Messenger của Fanpage (bot tự trả lời)', 'Xem số liệu bài đăng'],
    try: ['Liệt kê các Fanpage em đang quản lý được', 'Đọc 10 bình luận mới nhất trên Fanpage và gợi ý câu trả lời', 'Đọc tin nhắn Messenger chưa trả lời và soạn câu trả lời'],
    rules: ['Luôn lấy page_id bằng công cụ liệt kê Fanpage trước, hỏi khách chọn trang nếu có nhiều trang', 'Bài hẹn giờ phải cách hiện tại ít nhất 10 phút', 'Trả lời bình luận: lịch sự, ngắn, mời nhắn tin, không đưa giá nếu Brain thương hiệu chưa có giá', 'Tin nhắn Messenger: chỉ gửi khi tin cuối của khách trong 24 giờ (quy định Meta); xin số điện thoại khi khách hỏi mua'] },
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
    note: 'Canva API không tự tạo ảnh từ chữ. Trợ lý AI tạo ảnh bằng công cụ tạo ảnh của Crewzy rồi đưa vào Canva để bạn chỉnh.',
    can: ['Đưa ảnh AI vừa tạo vào Canva thành thiết kế để chỉnh tiếp', 'Liệt kê, tìm thiết kế của bạn', 'Xuất thiết kế ra PNG/JPG/PDF', 'Đổi kích thước thiết kế (gói Pro)'],
    try: ['Làm 1 ảnh quảng cáo dọc 4:5 cho sản phẩm chính rồi đưa vào Canva cho tôi chỉnh', 'Liệt kê thiết kế Canva gần đây của tôi'],
    rules: ['Canva API KHÔNG tạo ảnh từ mô tả: làm ảnh mới thì dùng CREWZY_TAO_ANH, sau đó CANVA_CREATE_URL_ASSET_UPLOAD_JOB với link ảnh, chờ CANVA_GET_URL_ASSET_UPLOADS_JOBID xong rồi CANVA_POST_DESIGNS với asset_id, gửi link chỉnh sửa (edit_url)', 'Xuất ảnh: CANVA_POST_EXPORTS rồi CANVA_GET_DESIGN_EXPORT_JOB_RESULT; link tải hết hạn sau 24 giờ', 'Autofill mẫu thương hiệu chỉ có ở Canva Enterprise, đừng hứa với khách gói thường'] },
  { slug: 'heygen', name: 'HeyGen', cat: 'creative', status: 'ready',
    desc: 'Làm video người dẫn AI nói tiếng Việt.',
    note: 'Kết nối bằng khoá API HeyGen của bạn; tiền dựng video tính vào tài khoản HeyGen.',
    can: ['Liệt kê avatar, giọng đọc', 'Tạo video từ kịch bản'], try: ['Liệt kê các avatar HeyGen tôi dùng được'],
    rules: ['Tạo video tốn tiền tài khoản HeyGen: báo độ dài và chờ đồng ý'] },
  { slug: 'elevenlabs', name: 'ElevenLabs', cat: 'creative', status: 'ready',
    desc: 'Giọng đọc AI cho video, quảng cáo.',
    note: 'Kết nối bằng khoá API ElevenLabs của bạn.', can: ['Liệt kê giọng', 'Chuyển văn bản thành giọng nói'], try: [], rules: ['Tốn tiền tài khoản ElevenLabs: chờ đồng ý với đoạn dài'] },
  { slug: 'capcut', name: 'CapCut', cat: 'creative', status: 'soon', desc: 'Dựng video ngắn.', note: 'CapCut chưa mở API công khai.', can: [], try: [], rules: [] },

  // ---------- Thêm 22/11/2026 (đã thử /api/connect?thu=1 ra link thật). App dùng khoá API: Composio mở trang để khách dán khoá của họ ----------
  { slug: 'pinterest', name: 'Pinterest', cat: 'social', status: 'ready', desc: 'Đăng ghim ảnh, quản lý bảng, xem số liệu.',
    can: ['Tạo ghim từ link ảnh', 'Liệt kê bảng', 'Xem số liệu ghim'], try: ['Liệt kê các bảng Pinterest của tôi'], rules: ['Ảnh phải có link công khai'] },
  { slug: 'reddit', name: 'Reddit', cat: 'social', status: 'ready', desc: 'Đọc thảo luận theo chủ đề, đăng bài vào cộng đồng.',
    can: ['Tìm bài theo từ khoá/cộng đồng', 'Đọc bình luận', 'Đăng bài'], try: ['Tìm 10 bài Reddit đang bàn về sản phẩm cùng ngành'], rules: ['Đọc luật cộng đồng trước khi đăng, không spam'] },
  { slug: 'discord', name: 'Discord', cat: 'chat', status: 'ready', desc: 'Gửi tin, đọc kênh cộng đồng khách hàng.',
    can: ['Đọc tin nhắn kênh', 'Gửi tin vào kênh'], try: ['Đọc 20 tin mới nhất trong kênh cộng đồng'], rules: [] },
  { slug: 'slack', name: 'Slack', cat: 'chat', status: 'ready', desc: 'Gửi báo cáo, nhắc việc cho đội nhóm.',
    can: ['Gửi tin vào kênh', 'Đọc tin nhắn', 'Tìm tin nhắn'], try: ['Gửi lời chào thử vào kênh #general'], rules: ['Báo cáo nội bộ gửi được không cần hỏi lại nếu khách đã hẹn giờ quy trình'] },
  { slug: 'microsoft_teams', name: 'Microsoft Teams', cat: 'chat', status: 'ready', desc: 'Gửi báo cáo, tin nhắn cho nhóm trên Teams.',
    can: ['Gửi tin vào kênh/chat', 'Đọc tin nhắn'], try: ['Liệt kê các nhóm Teams của tôi'], rules: [] },
  { slug: 'webflow', name: 'Webflow', cat: 'office', status: 'ready', desc: 'Đăng bài blog, cập nhật nội dung website Webflow.',
    can: ['Thêm/sửa mục CMS (bài blog)', 'Xuất bản website'], try: ['Liệt kê các bộ sưu tập CMS trên Webflow'], rules: ['Lưu nháp trước, chỉ xuất bản khi khách duyệt'] },
  { slug: 'outlook', name: 'Outlook', cat: 'office', status: 'ready', desc: 'Email và lịch Microsoft 365.',
    can: ['Đọc, tìm email', 'Soạn nháp, gửi email', 'Xem lịch'], try: ['Tìm 5 email mới nhất của khách'], rules: ['Gửi email cho người khác phải hỏi khách trước'] },
  { slug: 'one_drive', name: 'OneDrive', cat: 'office', status: 'ready', desc: 'Lưu và chia sẻ file Microsoft 365.',
    can: ['Tải file lên', 'Tìm file', 'Tạo link chia sẻ'], try: ['Liệt kê file mới nhất trên OneDrive'], rules: [] },
  { slug: 'dropbox', name: 'Dropbox', cat: 'office', status: 'ready', desc: 'Lưu ảnh, video, tài liệu.',
    can: ['Tải file lên', 'Tìm file', 'Tạo link chia sẻ'], try: ['Liệt kê thư mục Dropbox'], rules: [] },
  { slug: 'googleslides', name: 'Google Slides', cat: 'office', status: 'ready', desc: 'Tạo slide báo cáo, đề xuất chiến lược.',
    can: ['Tạo bản trình bày', 'Thêm slide, chữ, ảnh'], try: ['Tạo bản trình bày "Báo cáo tuần" 3 slide'], rules: [] },
  { slug: 'zoom', name: 'Zoom', cat: 'office', status: 'ready', desc: 'Tạo cuộc họp, lấy bản ghi cuộc họp.',
    can: ['Tạo cuộc họp', 'Liệt kê cuộc họp', 'Lấy bản ghi/tóm tắt'], try: ['Liệt kê cuộc họp Zoom tuần này'], rules: [] },
  { slug: 'googlemeet', name: 'Google Meet', cat: 'office', status: 'ready', desc: 'Tạo phòng họp, xem cuộc họp.',
    can: ['Tạo phòng họp'], try: ['Tạo link Google Meet cho buổi tư vấn chiều mai'], rules: [] },
  { slug: 'calendly', name: 'Calendly', cat: 'sales', status: 'ready', desc: 'Lịch hẹn tư vấn, khách tự đặt giờ.',
    can: ['Xem lịch hẹn sắp tới', 'Lấy link đặt lịch'], try: ['Liệt kê lịch hẹn tư vấn tuần này'], rules: [] },
  { slug: 'pipedrive', name: 'Pipedrive', cat: 'sales', status: 'ready', desc: 'CRM theo phễu bán hàng.',
    can: ['Thêm người, tổ chức, deal', 'Cập nhật giai đoạn deal', 'Ghi chú, hoạt động'], try: ['Liệt kê deal đang mở trên Pipedrive'], rules: ['Chỉ thêm khách đã đồng ý được liên hệ'] },
  { slug: 'salesforce', name: 'Salesforce', cat: 'sales', status: 'ready', desc: 'CRM doanh nghiệp: khách, cơ hội, hoạt động.',
    can: ['Tìm/thêm Lead, Contact, Opportunity', 'Cập nhật trạng thái'], try: ['Tìm 10 Lead mới nhất'], rules: ['Chỉ thêm khách đã đồng ý được liên hệ'] },
  { slug: 'zoho', name: 'Zoho CRM', cat: 'sales', status: 'ready', desc: 'CRM Zoho: khách, deal, công việc.',
    can: ['Thêm/tìm Lead, Contact, Deal'], try: ['Tìm 10 khách mới nhất trên Zoho'], rules: ['Chỉ thêm khách đã đồng ý được liên hệ'] },
  { slug: 'stripe', name: 'Stripe', cat: 'sales', status: 'ready', desc: 'Thanh toán quốc tế: đơn, khách, doanh thu.',
    can: ['Xem thanh toán, khách hàng', 'Tạo link thanh toán'], try: ['Tổng doanh thu Stripe 7 ngày qua'], rules: ['Không hoàn tiền hay tạo khoản thu khi chưa có khách đồng ý'] },
  { slug: 'typeform', name: 'Typeform', cat: 'sales', status: 'ready', desc: 'Form đăng ký, khảo sát; đọc câu trả lời mới.',
    can: ['Đọc câu trả lời form', 'Liệt kê form'], try: ['Đọc 10 câu trả lời mới nhất của form đăng ký'], rules: [] },
  { slug: 'mailchimp', name: 'Mailchimp', cat: 'email', status: 'ready', desc: 'Danh sách email, chiến dịch email marketing.',
    can: ['Thêm người vào danh sách', 'Tạo chiến dịch nháp', 'Xem số liệu chiến dịch'], try: ['Xem số liệu 3 chiến dịch email gần nhất'], rules: ['Chỉ tạo chiến dịch nháp, gửi khi khách duyệt', 'Chỉ thêm người đã đồng ý nhận email'] },
  { slug: 'brevo', name: 'Brevo', cat: 'email', status: 'ready', desc: 'Email marketing, SMS, danh sách liên hệ (khoá API).',
    can: ['Thêm liên hệ', 'Tạo chiến dịch email', 'Xem số liệu'], try: ['Liệt kê danh sách liên hệ Brevo'], rules: ['Chỉ gửi khi khách duyệt', 'Chỉ thêm người đã đồng ý nhận email'] },
  { slug: 'klaviyo', name: 'Klaviyo', cat: 'email', status: 'ready', desc: 'Email/SMS cho bán hàng online.',
    can: ['Thêm hồ sơ khách', 'Xem chiến dịch, luồng'], try: ['Xem số liệu các chiến dịch Klaviyo tháng này'], rules: ['Chỉ gửi khi khách duyệt'] },
  { slug: 'kit', name: 'Kit (ConvertKit)', cat: 'email', status: 'ready', desc: 'Bản tin email cho người làm nội dung.',
    can: ['Thêm người đăng ký', 'Tạo bản tin nháp'], try: ['Đếm số người đăng ký mới tuần này'], rules: ['Chỉ gửi khi khách duyệt'] },
  { slug: 'mailerlite', name: 'MailerLite', cat: 'email', status: 'ready', desc: 'Email marketing giá rẻ (khoá API).',
    can: ['Thêm người đăng ký', 'Tạo chiến dịch nháp'], try: ['Liệt kê nhóm người đăng ký MailerLite'], rules: ['Chỉ gửi khi khách duyệt'] },
  { slug: 'sendgrid', name: 'SendGrid', cat: 'email', status: 'ready', desc: 'Gửi email giao dịch, thông báo (khoá API).',
    can: ['Gửi email', 'Quản lý danh sách'], try: ['Kiểm tra kết nối SendGrid'], rules: ['Gửi cho khách phải được duyệt'] },
  { slug: 'zendesk', name: 'Zendesk', cat: 'care', status: 'ready', desc: 'Phiếu hỗ trợ khách hàng.',
    can: ['Đọc phiếu mới', 'Trả lời, gắn nhãn, đổi trạng thái'], try: ['Liệt kê 10 phiếu hỗ trợ đang mở'], rules: ['Trả lời khách phải qua duyệt trừ khi khách đã bật tự trả lời'] },
  { slug: 'intercom', name: 'Intercom', cat: 'care', status: 'ready', desc: 'Chat hỗ trợ trên website, hội thoại khách.',
    can: ['Đọc hội thoại', 'Trả lời, gán người phụ trách'], try: ['Liệt kê hội thoại chưa trả lời'], rules: ['Trả lời khách phải qua duyệt'] },
  { slug: 'freshdesk', name: 'Freshdesk', cat: 'care', status: 'ready', desc: 'Phiếu hỗ trợ, kho câu trả lời.',
    can: ['Đọc phiếu mới', 'Trả lời, đổi trạng thái'], try: ['Liệt kê phiếu Freshdesk đang mở'], rules: ['Trả lời khách phải qua duyệt'] },
  { slug: 'gorgias', name: 'Gorgias', cat: 'care', status: 'ready', desc: 'Hỗ trợ khách cho cửa hàng online.',
    can: ['Đọc phiếu', 'Trả lời'], try: ['Liệt kê phiếu Gorgias mới'], rules: ['Trả lời khách phải qua duyệt'] },
  { slug: 'crisp', name: 'Crisp', cat: 'care', status: 'ready', desc: 'Chat website, hộp thư hỗ trợ (khoá API).',
    can: ['Đọc hội thoại', 'Gửi tin trả lời'], try: ['Liệt kê hội thoại Crisp chưa trả lời'], rules: ['Trả lời khách phải qua duyệt'] },
  { slug: 'airtable', name: 'Airtable', cat: 'work', status: 'ready', desc: 'Bảng dữ liệu: lịch nội dung, khách hàng, kho.',
    can: ['Đọc/thêm/sửa bản ghi', 'Tìm theo trường'], try: ['Liệt kê các base Airtable của tôi'], rules: [] },
  { slug: 'trello', name: 'Trello', cat: 'work', status: 'ready', desc: 'Bảng việc dạng thẻ cho đội nội dung.',
    can: ['Tạo thẻ, chuyển cột, gắn hạn'], try: ['Liệt kê các bảng Trello'], rules: [] },
  { slug: 'asana', name: 'Asana', cat: 'work', status: 'ready', desc: 'Quản lý dự án, giao việc.',
    can: ['Tạo việc, giao người, đặt hạn'], try: ['Liệt kê việc Asana hạn tuần này'], rules: [] },
  { slug: 'clickup', name: 'ClickUp', cat: 'work', status: 'ready', desc: 'Quản lý việc, lịch nội dung.',
    can: ['Tạo việc, cập nhật trạng thái'], try: ['Liệt kê việc ClickUp đang làm'], rules: [] },
  { slug: 'monday', name: 'monday.com', cat: 'work', status: 'ready', desc: 'Bảng công việc cho đội nhóm.',
    can: ['Tạo/cập nhật mục trên bảng'], try: ['Liệt kê các bảng monday.com'], rules: [] },
  { slug: 'figma', name: 'Figma', cat: 'creative', status: 'ready', desc: 'Đọc file thiết kế, xuất ảnh khung.',
    can: ['Đọc file, khung', 'Xuất ảnh khung thiết kế', 'Đọc bình luận'], try: ['Liệt kê file Figma gần đây'], rules: [] },
  { slug: 'google_search_console', name: 'Google Search Console', cat: 'research', status: 'ready', desc: 'Từ khoá, lượt hiển thị, lượt bấm từ Google.',
    can: ['Từ khoá mang khách tới', 'Trang nhiều lượt bấm', 'Lỗi lập chỉ mục'], try: ['20 từ khoá mang nhiều lượt bấm nhất 28 ngày qua'], rules: [] },
  { slug: 'google_maps', name: 'Google Maps', cat: 'research', status: 'ready', desc: 'Tìm địa điểm, đối thủ quanh khu vực, đánh giá.',
    can: ['Tìm địa điểm theo từ khoá/khu vực', 'Xem đánh giá, giờ mở cửa'], try: ['Tìm 10 quán cà phê quanh quận 1 và điểm đánh giá'], rules: [] },
  { slug: 'vidiq_mcp', name: 'vidIQ', cat: 'research', status: 'ready', desc: 'Soi kênh YouTube, Instagram, TikTok đối thủ, từ khoá, video vượt trội (khoá API vidIQ).',
    note: 'Dán khoá API vidIQ khi kết nối (gói Free cũng có MCP, dùng chung credit vidIQ).',
    can: ['Tìm video/Reels vượt trội của đối thủ', 'Xem từng cảnh một video ngắn', 'Nghiên cứu từ khoá YouTube'], try: ['Tìm 5 video vượt trội của kênh đối thủ trong 30 ngày'], rules: ['Học cách làm, không sao chép nội dung đối thủ'] },
  { slug: 'apify', name: 'Apify', cat: 'research', status: 'ready', desc: 'Lấy dữ liệu Reels, TikTok, quảng cáo Facebook, Google Maps (khoá API Apify).',
    can: ['Chạy actor lấy Reels/TikTok của tài khoản', 'Lấy quảng cáo đang chạy từ Thư viện quảng cáo Meta', 'Lấy đánh giá Google Maps'], try: ['Lấy 10 Reels mới nhất của một tài khoản Instagram'], rules: ['Chỉ lấy dữ liệu công khai'] },
  { slug: 'firecrawl', name: 'Firecrawl', cat: 'research', status: 'ready', desc: 'Đọc website, bảng giá, bài viết của đối thủ (khoá API).',
    can: ['Đọc một trang thành chữ', 'Tìm kiếm web', 'Đọc nhiều trang của một website'], try: ['Đọc trang bảng giá của một website đối thủ'], rules: [] },
  { slug: 'semrush', name: 'Semrush', cat: 'research', status: 'ready', desc: 'Từ khoá, lưu lượng, đối thủ SEO (khoá API).',
    can: ['Từ khoá đối thủ đang lên top', 'Ước lượng lưu lượng', 'Backlink'], try: ['Từ khoá hàng đầu của một website đối thủ'], rules: [] },
  { slug: 'ahrefs', name: 'Ahrefs', cat: 'research', status: 'ready', desc: 'SEO: từ khoá, backlink, trang mạnh của đối thủ (khoá API).',
    can: ['Từ khoá tự nhiên', 'Backlink', 'Trang nhiều lưu lượng'], try: ['Trang nhiều lưu lượng nhất của website đối thủ'], rules: [] },
  { slug: 'serpapi', name: 'SerpApi', cat: 'research', status: 'ready', desc: 'Kết quả tìm kiếm Google, Google Maps, Google Trends (khoá API).',
    can: ['Tìm kiếm Google theo từ khoá', 'Xu hướng tìm kiếm'], try: ['Ai đang đứng top Google cho từ khoá chính của tôi'], rules: [] },
  { slug: 'perplexityai', name: 'Perplexity', cat: 'research', status: 'ready', desc: 'Nghiên cứu nhanh có trích nguồn (khoá API).',
    can: ['Hỏi đáp có nguồn', 'Tổng hợp tin thị trường'], try: ['Tóm tắt xu hướng ngành tháng này có nguồn'], rules: ['Ghi nguồn khi dùng số liệu'] },
  { slug: 'tavily', name: 'Tavily', cat: 'research', status: 'ready', desc: 'Tìm kiếm web cho AI (khoá API).',
    can: ['Tìm kiếm và trích nội dung trang'], try: ['Tìm tin mới nhất về đối thủ'], rules: [] },
];

export const APPS = [...BASE_APPS, ...EXTRA_APPS.filter((a) => !BASE_APPS.some((b) => b.slug === a.slug))];

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
  return { categories: CATEGORIES, apps: APPS.map(({ slug, name, cat, status, desc, note, can, try: tryCmds, rules }) => ({ slug, name, cat, status, desc, note: note || '', can, try: tryCmds, rules })),
    mcp: MCP_DIRECTORY.map(({ id, name, url, auth, cat, desc, ngoai, logo, letter, bg, alt }) => ({ id, name, url, auth, cat, desc, ngoai: !!ngoai, logo: logo || '', letter: letter || name[0], bg: bg || '#555', alt: alt || '' })),
    industries: INDUSTRIES };
}
