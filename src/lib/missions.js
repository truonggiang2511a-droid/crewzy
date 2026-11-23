// 6 NHIỆM VỤ HẰNG NGÀY (Giang 23/11): mỗi nhiệm vụ = 1 việc cố định của doanh nghiệp, chỉ cần nối 2–3 loại app (ô "slot"),
// muốn thêm app thì bấm +. Khách bấm Chạy ngay (Trợ lý làm luôn) hoặc bật Tự chạy hằng ngày (lịch). Run tất cả = bật cả 6.
// lich = các bước theo giờ (quy trình trong workflows.js) — đây là NGUỒN DUY NHẤT của dây chuyền Run (autopilot.js CHAIN lấy từ đây).
// Slot: apps = ứng viên (đã nối cái nào thì dùng cái đó), 'mcp:<id>' = máy chủ MCP ngoài; bat_buoc = thiếu thì chưa chạy được; san_co = Crewzy có sẵn.
import { appBySlug } from './catalog.js';
import { MCP_HOSTS } from './mcpDirectory.js';

export const MISSIONS = [
  { id: 'san_xuat', ten: 'Sản xuất & phân phối nội dung', icon: 'noi_dung', mau: '#E879F9', cat: 'social',
    mo_ta: 'AI làm ảnh/video đẹp từ Brain thương hiệu, viết bài chuyển đổi (hashtag, lời kêu gọi), bạn duyệt 1 chạm rồi đăng mọi mạng xã hội.',
    slots: [
      { vai: 'AI làm ảnh, video', apps: ['mcp:higgsfield', 'heygen', 'gemini', 'canva', 'runway', 'elevenlabs'], cat: 'creative', san_co: 'Crewzy có sẵn ảnh/video AI (credit)',
        web: [{ id: 'flow', name: 'Google Flow (Veo)', url: 'https://labs.google/flow', letter: 'F', bg: '#1A73E8' }, { id: 'capcut', name: 'CapCut', url: 'https://www.capcut.com/editor', letter: 'C', bg: '#111111' }] },
      { vai: 'Kênh đăng bài', apps: ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'threads', 'upload_post', 'reddit'], cat: 'social', bat_buoc: true, nhieu: true },
      { vai: 'Form thu khách (link gắn dưới bài đăng)', apps: ['googleforms', 'typeform', 'tally', 'jotform'], cat: 'office', nhieu: true, san_co: 'Chưa có form thì AI dùng link website' },
      { vai: 'Bảng báo cáo bài đã đăng (AI tự lập bảng, gửi link qua email)', apps: ['googlesheets', 'gmail', 'notion', 'airtable'], cat: 'office', nhieu: true, san_co: 'Báo cáo xem trong Kết quả' },
    ],
    lich: [
      { id: 'san_xuat_5x5', gio: '06:30', ngay: 'hang_ngay', buoc: '5 ảnh + 5 video ngắn từ ảnh thật, bài riêng từng kênh, hẹn 10 giờ đăng cả ngày (chờ duyệt)', tu: 'noi_dung', toi: 'phan_phoi' },
      { id: 'dang_bai_da_duyet', gio: '10:00', ngay: 'hang_ngay', buoc: 'Đăng bài đã duyệt lên mọi kênh, ghi báo cáo Google Sheet, email link', tu: 'noi_dung', toi: 'phan_phoi' },
      { id: 'lich_noi_dung_tuan', gio: '07:30', ngay: 't2', buoc: 'Thứ Hai: lên lịch nội dung 7 ngày', tu: 'chien_luoc', toi: 'noi_dung' },
    ] },
  { id: 'cham_soc_mxh', ten: 'Chăm sóc đa nền tảng', icon: 'cham_soc', mau: '#2DD4BF', cat: 'chat',
    mo_ta: 'Bot trả lời tin nhắn và bình luận theo Brain, xin số điện thoại, khách nóng báo bạn ngay. Fanpage: Crewzy trực 15 phút/lần cả ngày lẫn đêm, có tin mới là AI trả lời liền.',
    slots: [
      { vai: 'Kênh có tin nhắn, bình luận', apps: ['facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp'], bat_buoc: true, nhieu: true },
      { vai: 'Nhận báo khách nóng', apps: ['telegram', 'gmail'], san_co: 'Báo trong Crewzy' },
    ],
    lich: [
      { id: 'tra_loi_tin_nhan', gio: '08:00', den: '22:00', lap: 'moi_gio', ngay: 'hang_ngay', buoc: 'Bot trả lời tin nhắn, xin số khách', tu: 'phan_phoi', toi: 'cham_soc' },
      { id: 'tra_loi_binh_luan', gio: '08:00', den: '22:00', lap: 'moi_gio', ngay: 'hang_ngay', buoc: 'Trả lời bình luận, gom khách hỏi giá', tu: 'phan_phoi', toi: 'cham_soc' },
    ] },
  { id: 'quang_cao', ten: 'Quảng cáo đa nền tảng', icon: 'quang_cao', mau: '#FBBF24', cat: 'ads',
    mo_ta: 'Mỗi sáng xem số liệu Meta/Google/TikTok Ads, báo ngay khi bất thường, đề xuất tăng/giảm/tắt và mẫu quảng cáo mới (bạn tự bấm chi tiền).',
    slots: [
      { vai: 'Tài khoản quảng cáo', apps: ['metaads', 'googleads', 'tiktok_ads'], bat_buoc: true, nhieu: true },
      { vai: 'Đo lường website', apps: ['google_analytics'] },
    ],
    lich: [{ id: 'theo_doi_quang_cao', gio: '09:00', ngay: 'hang_ngay', buoc: 'Kiểm quảng cáo, báo ngay khi bất thường', tu: 'quang_cao', toi: 'bao_cao' }] },
  { id: 'bao_cao_ceo', ten: 'Báo cáo CEO', icon: 'bao_cao', mau: '#A78BFA', cat: 'analytics',
    mo_ta: 'Số khách, lead, doanh thu theo nguồn gửi bạn mỗi ngày (7:00, 18:00, 22:00) và ghi vào CRM/Sheet; báo cáo có biểu đồ, tải PDF.',
    slots: [
      { vai: 'CRM / bảng số liệu', apps: ['hubspot', 'pipedrive', 'googlesheets'], san_co: 'Bảng khách tiềm năng của Crewzy' },
      { vai: 'Nhận báo cáo', apps: ['gmail', 'telegram'], san_co: 'Xem trong Crewzy' },
    ],
    lich: [
      { id: 'ban_tin_sang', gio: '07:00', ngay: 'hang_ngay', buoc: 'Bản tin sáng: số khách, việc cần gọi', tu: 'bao_cao', toi: 'hang_ngay' },
      { id: 'bao_cao_tuan', gio: '07:15', ngay: 't2', buoc: 'Thứ Hai: báo cáo tuần ghi vào Sheet/CRM', tu: 'ban_hang', toi: 'bao_cao' },
    ] },
  { id: 'cham_soc_khach', ten: 'Chăm sóc khách hàng hằng ngày', icon: 'ban_hang', mau: '#FB923C', cat: 'sales',
    mo_ta: 'Khách mới vào CRM, nhắc sale gọi khách chưa chăm, soạn email/tin chăm sóc; có số điện thoại thì gọi bằng AI.',
    slots: [
      { vai: 'CRM', apps: ['hubspot', 'pipedrive', 'googlesheets'], bat_buoc: true },
      { vai: 'Email, tin nhắn', apps: ['gmail', 'telegram'] },
      { vai: 'Gọi điện AI', apps: ['vapi', 'retellai', 'bland_ai', 'twilio', 'aircall'] },
    ],
    lich: [
      { id: 'lead_vao_crm', gio: '08:30', ngay: 'hang_ngay', buoc: 'Khách mới vào CRM, soạn tin chào', tu: 'quang_cao', toi: 'ban_hang' },
      { id: 'nhac_cham_soc_deal', gio: '09:30', ngay: 't2_t6', buoc: 'Nhắc sale gọi khách chưa chăm', tu: 'ban_hang', toi: 'hang_ngay' },
    ] },
  { id: 'nghien_cuu', ten: 'Nghiên cứu đối thủ & thị trường', icon: 'doi_thu', mau: '#34D399', cat: 'research',
    mo_ta: 'Soi Reels/website/quảng cáo đối thủ, xu hướng và câu hỏi khách hay tìm → ý tưởng cho nội dung và quảng cáo.',
    slots: [
      { vai: 'Soi đối thủ', apps: ['apify', 'firecrawl'], san_co: 'Crewzy có sẵn đọc website' },
      { vai: 'Nghiên cứu thị trường', apps: ['perplexityai', 'tavily'] },
    ],
    lich: [
      { id: 'doi_thu_reels', gio: '20:00', ngay: 'cn', buoc: 'Chủ nhật: soi đối thủ, học phong cách', tu: 'doi_thu', toi: 'chien_luoc' },
      { id: 'de_xuat_chien_luoc', gio: '08:00', ngay: 'ngay_1', buoc: 'Ngày 1: chiến lược tháng', tu: 'bao_cao', toi: 'chien_luoc' },
    ] },
];
// Ưu tiên khi gói giới hạn số lịch: ra khách trước, rồi nội dung, quảng cáo, báo cáo, nghiên cứu.
export const PRIORITY = ['cham_soc_khach', 'cham_soc_mxh', 'san_xuat', 'quang_cao', 'bao_cao_ceo', 'nghien_cuu'];
// Nơi báo cáo khách có thể chọn (chỉ hiện app đã nối) + lựa chọn app của khách cho từng ô (chon = {s0: ['higgsfield'], s1: [...], bao_cao: [...]}).
export const REPORT_APPS = ['googlesheets', 'notion', 'airtable', 'gmail', 'telegram', 'slack', 'microsoft_teams', 'discord'];
export function cleanChon(m, chon) {
  const out = {};
  const ok = (arr, allow) => [...new Set([].concat(arr || []).map(String))].filter((x) => x === 'crewzy' || allow.includes(x)).slice(0, 12);
  m.slots.forEach((sl, i) => { const v = ok(chon && chon['s' + i], sl.apps.map((a) => a.replace(/^mcp:/, ''))); if (v.length) out['s' + i] = v; });
  const b = ok(chon && chon.bao_cao, REPORT_APPS); if (b.length) out.bao_cao = b;
  return out;
}
const nameOfSlug = (s) => s === 'crewzy' ? 'công cụ có sẵn của Crewzy' : nameOf(appBySlug(s) ? s : 'mcp:' + s);
export function prefText(m, chon) {
  if (!chon) return '';
  const l = [];
  m.slots.forEach((sl, i) => { if (chon['s' + i] && chon['s' + i].length) l.push(`- ${sl.vai}: dùng ${chon['s' + i].map(nameOfSlug).join(', ')}`); });
  if (chon.bao_cao && chon.bao_cao.length) l.push(`- Báo cáo kết quả gửi về: ${chon.bao_cao.map((s) => s === 'crewzy' ? 'chỉ trong Crewzy (Việc chờ duyệt, Kết quả)' : nameOf(appBySlug(s) ? s : 'mcp:' + s)).join(', ')}`);
  return l.length ? 'LỰA CHỌN CỦA KHÁCH (khách đã chọn trong Crewzy, làm ĐÚNG như vậy, không tự đổi app):\n' + l.join('\n') : '';
}
export const missionOf = (workflowId) => MISSIONS.find((m) => m.lich.some((l) => l.id === workflowId));
export const missionById = (id) => MISSIONS.find((m) => m.id === id);

const MCP_URL = { higgsfield: 'https://mcp.higgsfield.ai/mcp' };
const hrefOf = (s, name) => s.startsWith('mcp:') ? 'ket-noi.html?tab=mcp&ten=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(MCP_URL[s.slice(4)] || '') : 'ket-noi.html?app=' + s;
const nameOf = (slug) => slug.startsWith('mcp:') ? ({ higgsfield: 'Higgsfield' }[slug.slice(4)] || slug.slice(4)) : (appBySlug(slug) || { name: slug }).name;
const isOn = (slug, connected, mcpUrls) => slug.startsWith('mcp:') ? (mcpUrls || []).some((u) => u.includes(MCP_HOSTS[slug.slice(4)] || slug.slice(4))) : (connected || []).includes(slug);

// Trạng thái slot cho giao diện: app đã nối (tối đa 3 hiện ra) + ứng viên đầu tiên chưa nối để gợi ý.
export function slotStatus(slot, connected, mcpUrls) {
  const apps = slot.apps.filter((s) => s.startsWith('mcp:') || appBySlug(s)).map((s) => ({ slug: s.replace(/^mcp:/, ''), mcp: s.startsWith('mcp:'), name: nameOf(s), on: isOn(s, connected, mcpUrls),
    soon: !s.startsWith('mcp:') && (appBySlug(s) || {}).status !== 'ready', href: hrefOf(s, nameOf(s)) }));
  const on = apps.filter((a) => a.on);
  return { vai: slot.vai, cat: slot.cat || '', web: slot.web || [], bat_buoc: !!slot.bat_buoc, nhieu: !!slot.nhieu, san_co: slot.san_co || '', da_noi: on, goi_y: apps.filter((a) => !a.on && !a.soon).slice(0, 6), sap_co: apps.filter((a) => a.soon).map((a) => a.name), ok: !!(on.length || slot.san_co || !slot.bat_buoc) };
}
