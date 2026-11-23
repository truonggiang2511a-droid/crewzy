// Gói tháng + credit + 4 bước bắt đầu (Brain → kênh → AI → thanh toán). Dữ liệu tiền nằm ở D1 (binding DB, migrations/0001_billing.sql).
//
// Công tắc: billingOn(env) = có DB + đã bật đăng nhập Google (GOOGLE_CLIENT_ID) + BILLING khác 'off'.
//   Tắt → app chạy như cũ (không chặn, không trừ credit). Bật → khách phải xong 4 bước mới dùng; mọi thao tác tốn tiền trừ credit.
// Admin (email trong ADMIN_EMAILS, cách nhau dấu phẩy): bỏ qua 4 bước, không bị trừ credit, cấp credit/gia hạn cho khách.
// 1 credit ≈ 100 đồng giá bán. Giá gói, gói nạp, giá từng thao tác đổi được bằng biến PLANS_JSON, TOPUPS_JSON, PRICES_JSON (JSON) mà không sửa code.
import { getGoogleClientId } from './common.js';
import { getBrand } from './brand.js';
import { connectedApps } from './connected.js';
import { listServers } from './mcpServers.js';

const DAY = 86400 * 1000;

// GÓI = TÍNH NĂNG + CREDIT (23/11/2026 Giang chốt lại 4 gói). Tính năng kiểm tra ở máy chủ (getFeatures), credit trả chi phí AI/ảnh/video.
//  ai          bộ não cao nhất được dùng: tiet_kiem = Haiku 5.5, can_bang = Sonnet 5.5, manh = Opus 5.5 (Trợ lý Crewzy + tự chạy)
//  tai_khoan   số tài khoản tối đa MỖI nền tảng (Facebook, Instagram, TikTok…)
//  fanpage     số Fanpage tối đa: 1 trang cá nhân Facebook tạo/quản lý tối đa 200 Fanpage (giới hạn Meta công bố) → gói lớn = tai_khoan × 200
//  bai_ngay    số bài tối đa mỗi ngày trên MỖI tài khoản/Fanpage của một nền tảng
//  anh_ngay, video_ngay  số ảnh / video ngắn AI của Crewzy làm mỗi ngày (0 = không có AI ảnh/video của Crewzy, AI của khách tự làm)
//  doanh_nghiep, kenh_moi_dn  Agency: số doanh nghiệp/thương hiệu tạo được, số kênh mạng xã hội tối đa mỗi doanh nghiệp
//  Chi phí thật để định giá: video Nhanh 6 giây ≈ 0,18 USD ≈ 4.700đ (102 credit), ảnh Đẹp ≈ 1.000đ (25 credit), 1 bài Sonnet có ảnh ≈ 55 credit.
//  Credit kèm gói đủ khoảng 60% hạn mức ảnh/video tối đa mỗi ngày; dùng hết hạn mức thì nạp thêm credit (giá credit luôn có lãi ×2).
export const FB_PAGES_PER_PROFILE = 200;
// Kênh mạng xã hội (đếm cho Agency: mỗi doanh nghiệp tối đa kenh_moi_dn tài khoản kênh).
export const SOCIAL_APPS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'threads', 'reddit', 'twitter', 'upload_post'];
export const PLAN_FEATURES = {
  mcp_1t:    { tro_ly: true, ai: 'tiet_kiem', opus: false, anh_dep: false, video: false, video_dep: false, lich: 3,  tu_tra_loi: true, kho_gb: 2,   mcp_ngoai: 3,
               tai_khoan: 1,  fanpage: 3,    bai_ngay: 2,  anh_ngay: 0,  video_ngay: 0,  doanh_nghiep: 1,  kenh_moi_dn: 0 },
  mcp_ai_6t: { tro_ly: true, ai: 'can_bang',  opus: false, anh_dep: true,  video: true,  video_dep: false, lich: 10, tu_tra_loi: true, kho_gb: 20,  mcp_ngoai: 10,
               tai_khoan: 5,  fanpage: 5 * FB_PAGES_PER_PROFILE,  bai_ngay: 10, anh_ngay: 5,  video_ngay: 5,  doanh_nghiep: 1,  kenh_moi_dn: 0 },
  mcp_ai_1n: { tro_ly: true, ai: 'manh',      opus: true,  anh_dep: true,  video: true,  video_dep: true,  lich: 20, tu_tra_loi: true, kho_gb: 50,  mcp_ngoai: 10,
               tai_khoan: 10, fanpage: 10 * FB_PAGES_PER_PROFILE, bai_ngay: 20, anh_ngay: 10, video_ngay: 10, doanh_nghiep: 1,  kenh_moi_dn: 0 },
  agency:    { tro_ly: true, ai: 'manh',      opus: true,  anh_dep: true,  video: true,  video_dep: true,  lich: 10, tu_tra_loi: true, kho_gb: 100, mcp_ngoai: 10,
               tai_khoan: 5,  fanpage: 5 * FB_PAGES_PER_PROFILE,  bai_ngay: 10, anh_ngay: 5,  video_ngay: 5,  doanh_nghiep: 10, kenh_moi_dn: 5 },
};
// Gói cũ (trước 23/11) vẫn chạy cho khách đã mua tới hết hạn.
PLAN_FEATURES.mcp_for_you = { ...PLAN_FEATURES.mcp_1t };
PLAN_FEATURES.co_ban = { ...PLAN_FEATURES.mcp_1t };
PLAN_FEATURES.tang_truong = { ...PLAN_FEATURES.mcp_ai_6t };
PLAN_FEATURES.doanh_nghiep = { ...PLAN_FEATURES.mcp_ai_1n };
PLAN_FEATURES.dung_thu = { ...PLAN_FEATURES.mcp_ai_6t, tai_khoan: 1, fanpage: 3, anh_ngay: 2, video_ngay: 1, kho_gb: 1 }; // dùng thử = nếm gói 6 tháng
const ALL_FEATURES = { ...PLAN_FEATURES.mcp_ai_1n, doanh_nghiep: 10, kenh_moi_dn: 0 };
const NO_FEATURES = { ...PLAN_FEATURES.mcp_1t, tro_ly: false, kho_gb: 0.2, bai_ngay: 0 };
const PLAN_ORDER = ['mcp_1t', 'mcp_ai_6t', 'mcp_ai_1n', 'agency'];
// Tên gói thấp nhất có tính năng (để báo khách nâng gói).
const FEATURE_NAMES = { tro_ly: 'Trợ lý Crewzy trong app', opus: 'bộ não Mạnh nhất (Opus)', anh_dep: 'AI làm ảnh của Crewzy', video: 'AI làm video của Crewzy', video_dep: 'video Đẹp', tu_tra_loi: 'tự trả lời bình luận', lich: 'hẹn giờ tự chạy', doanh_nghiep: 'nhiều doanh nghiệp/thương hiệu' };
export function upgradeHint(feature) {
  const id = PLAN_ORDER.find((p) => { const v = PLAN_FEATURES[p][feature]; return feature === 'doanh_nghiep' ? v > 1 : !!v; });
  const p = DEFAULT_PLANS.find((x) => x.id === id);
  return `${FEATURE_NAMES[feature] || feature} có từ gói ${p ? p.ten : 'cao hơn'}. Vào Gói và credit để nâng gói.`;
}
export function planFeatures(planId) { return PLAN_FEATURES[planId] || NO_FEATURES; }
// Bộ não theo gói: khách chọn cao hơn gói cho phép thì hạ xuống mức của gói.
const BRAIN_RANK = { tiet_kiem: 0, can_bang: 1, manh: 2 };
export function capBrain(brain, feat) {
  const want = BRAIN_RANK[brain] != null ? brain : 'manh';
  const cap = feat && feat.ai ? feat.ai : 'manh';
  return BRAIN_RANK[want] > BRAIN_RANK[cap] ? cap : want;
}
// Agency: dữ liệu mỗi doanh nghiệp nằm ở mã khách con "<chủ>-b<n>"; gói, credit, tài khoản luôn tính theo chủ.
export const ownerUid = (uid) => String(uid || '').replace(/-b\d{1,2}$/, '');
// Tính năng của khách: tắt billing hoặc admin → mở hết; gói hết hạn → như chưa có gói.
export async function getFeatures(env, uid, email) {
  if (!billingOn(env) || !uid) return ALL_FEATURES;
  const acc = await getAccount(env, uid).catch(() => null);
  if (acc && isAdminEmail(env, acc.email || email)) return ALL_FEATURES;
  return isActive(acc) ? planFeatures(acc.plan) : NO_FEATURES;
}

// Điều chỉnh lời gọi công cụ theo gói TRƯỚC khi trừ credit: hạ ảnh/video Đẹp xuống Nhanh nếu gói chưa có, chặn video nếu gói không có.
// Trả {args, error?, note?}; note gửi kèm kết quả để AI báo khách.
export function applyFeatures(name, args, feat) {
  const a = { ...(args || {}) };
  if (!feat) return { args: a };
  if (name === 'CREWZY_TAO_ANH' && !feat.anh_ngay) return { args: a, error: 'Gói hiện tại không có AI làm ảnh của Crewzy: dùng thẳng ảnh thật trong Kho, hoặc AI của khách (Claude, ChatGPT…) tự tạo ảnh rồi tải lên bằng CREWZY_TAI_LEN. ' + upgradeHint('anh_dep') };
  if (name === 'CREWZY_TAO_ANH' && a.chat_luong === 'dep' && !feat.anh_dep) return { args: { ...a, chat_luong: 'nhanh' }, note: 'Đã làm ảnh Nhanh vì ' + upgradeHint('anh_dep') };
  if (name === 'CREWZY_TAO_VIDEO') {
    if (!feat.video) return { args: a, error: upgradeHint('video') };
    if (a.chat_luong === 'dep' && !feat.video_dep) return { args: { ...a, chat_luong: 'nhanh' }, note: 'Đã làm video Nhanh vì ' + upgradeHint('video_dep') };
  }
  return { args: a };
}

const MCP_LINK = '1 link nối Claude, ChatGPT, Gemini, Grok, Claude Code, Codex (Claude cài 1 bấm): AI của bạn tự làm nội dung, ảnh, video';
export const DEFAULT_PLANS = [
  { id: 'mcp_1t', ten: 'MCP For You · 1 tháng', gia: 199000, credits: 1500, ngay: 30,
    mo_ta: 'Đã có Claude hoặc ChatGPT? Nối Crewzy vào AI của bạn: AI của bạn làm nội dung, Crewzy đăng bài, trả lời khách, báo cáo.',
    loi_ich: [MCP_LINK, 'Mỗi nền tảng 1 tài khoản (Facebook, Instagram, TikTok, YouTube, LinkedIn, Pinterest…)', '1 trang cá nhân Facebook → tối đa 3 Fanpage',
      'Tối đa 2 bài (ảnh hoặc video) mỗi ngày trên mỗi nền tảng / mỗi Fanpage', 'Trợ lý Crewzy chạy Claude Haiku: trả lời bình luận, tin nhắn, chatbot, đăng bài', 'Brain thương hiệu, quy trình chuẩn, Việc chờ duyệt, Kho 2GB'],
    khong: ['AI làm ảnh, video của Crewzy (AI của bạn tự làm)', 'Bộ não Sonnet, Opus'] },
  { id: 'mcp_ai_6t', ten: 'MCP + AI Crewzy · 6 tháng', gia: 5990000, credits: 60000, ngay: 180, noi_bat: true,
    mo_ta: 'Đội marketing AI chạy cả ngày: AI của bạn + AI ảnh, video ngắn của Crewzy, đăng hàng loạt nhiều Fanpage.',
    loi_ich: ['Mọi thứ của MCP For You', 'Mỗi nền tảng 5 tài khoản · 5 trang cá nhân Facebook → tối đa 1.000 Fanpage (200 Fanpage/trang cá nhân)',
      'Mỗi ngày 5 ảnh + 5 video ngắn AI của Crewzy, đăng đa nền tảng (tối đa 10 bài/ngày mỗi tài khoản, mỗi Fanpage)',
      'Nhiều Fanpage: tự hẹn giờ lệch 2 phút mỗi trang, đảo ảnh và viết lại bài từng trang để không bị đánh dấu spam', 'Mọi việc chạy Claude Sonnet 5.5 · hẹn giờ 10 quy trình · Kho 20GB',
      '60.000 credit (≈ 10.000/tháng): đủ khoảng 3 video + 5 ảnh mỗi ngày, cần nhiều hơn thì nạp thêm'],
    khong: ['Bộ não Opus', 'Video Đẹp (như quay thật)'] },
  { id: 'mcp_ai_1n', ten: 'MCP + AI Crewzy · 1 năm', gia: 14990000, credits: 180000, ngay: 365,
    mo_ta: 'Cho doanh nghiệp chạy nhiều kênh, nhiều Fanpage cả năm với bộ não mạnh nhất.',
    loi_ich: ['Mọi thứ của gói 6 tháng', 'Mỗi nền tảng 10 tài khoản · 10 trang cá nhân Facebook → tối đa 2.000 Fanpage',
      'Mỗi ngày 10 ảnh + 10 video ngắn AI của Crewzy, có video Đẹp (tối đa 20 bài/ngày mỗi tài khoản, mỗi Fanpage)', 'Mọi việc chạy Claude Opus 5.5 · hẹn giờ 20 quy trình · Kho 50GB',
      '180.000 credit (≈ 15.000/tháng), giá mỗi credit rẻ hơn gói 6 tháng khoảng 17%'] },
  { id: 'agency', ten: 'Agency · 10 doanh nghiệp', gia: 4990000, credits: 40000, ngay: 30,
    mo_ta: 'Cho agency, người làm dịch vụ marketing: quản lý tới 10 doanh nghiệp/thương hiệu riêng, mỗi nơi Brain, Kho, kênh và báo cáo riêng.',
    loi_ich: ['Tạo tối đa 10 doanh nghiệp/thương hiệu, chuyển qua lại 1 chạm', 'Mỗi doanh nghiệp tối đa 5 kênh mạng xã hội, Brain, Kho, Việc chờ duyệt, báo cáo riêng',
      'Mỗi doanh nghiệp mỗi ngày 5 ảnh + 5 video ngắn AI của Crewzy', 'Mọi việc chạy Claude Opus 5.5, có video Đẹp · Kho 100GB', '40.000 credit mỗi tháng dùng chung cho các doanh nghiệp'] },
];
export const DEFAULT_TOPUPS = [
  { id: 'nap_1000', ten: '1.000 credit', gia: 120000, credits: 1000 },
  { id: 'nap_3000', ten: '3.000 credit', gia: 330000, credits: 3000 },
  { id: 'nap_10000', ten: '10.000 credit', gia: 990000, credits: 10000 },
];
// Giá từng thao tác (credit). Chi phí thật tham khảo: Composio ~8đ/lượt, ảnh Workers AI ~45đ, video LTX ~790đ/giây.
export const DEFAULT_PRICES = {
  tool: 1,            // mỗi lượt chạy công cụ app (Composio) hoặc MCP ngoài
  workbench: 3,       // COMPOSIO_REMOTE_WORKBENCH / REMOTE_BASH (chạy nhiều lệnh một lần)
  image: 3,           // CREWZY_TAO_ANH
  video_second: 17,   // CREWZY_TAO_VIDEO Nhanh (LTX 0,03 USD/giây × 26.000 × 2 / 100 = 15,6), mỗi giây
  video_second_dep: 65, // CREWZY_TAO_VIDEO Đẹp (Seedance 2.0 Fast 720p 0,12 USD/giây → 62,4), mỗi giây
  image_dep: 25,      // CREWZY_TAO_ANH Đẹp (Seedream 4.5, 0,04 USD/ảnh → 20,8)
  voice: 1,           // nói để ra lệnh (Whisper 0,0005 USD/phút, tính tượng trưng)
  usd_rate: 26000,    // đổi chi phí AI (USD) ra đồng
  ai_markup: 2,       // giá bán = chi phí AI × 2
  instant_markup: 2,  // giá bán công cụ Instant = tiền Composio tính × 2
  ai_in_per_m: 1,     // USD / 1 triệu token vào (Claude Haiku, khoá của Giang)
  ai_out_per_m: 5,    // USD / 1 triệu token ra
  min_start: 5,       // cần ít nhất 5 credit mới bắt đầu một lượt chat
};
// Công cụ meta của Composio không tốn (tìm công cụ, xem schema, quản lý kết nối).
const FREE_TOOLS = new Set(['COMPOSIO_SEARCH_TOOLS', 'COMPOSIO_GET_TOOL_SCHEMAS', 'COMPOSIO_MANAGE_CONNECTIONS', 'COMPOSIO_WAIT_FOR_CONNECTIONS']);

function parseJson(text, fallback) {
  if (!text) return fallback;
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : fallback; } catch (e) { return fallback; }
}
export const plans = (env) => parseJson(env.PLANS_JSON, DEFAULT_PLANS);
// Dùng thử miễn phí: 1 lần cho mỗi tài khoản (chưa từng dùng thử, chưa từng mua gói). Chi phí tối đa cho Giang ≈ credits × 50đ
// (giá bán 100đ/credit có lãi ×2) → 300 credit ≈ 15.000đ. Đổi bằng TRIAL_JSON {"ngay":7,"credits":300}; tắt bằng TRIAL=off.
export const DEFAULT_TRIAL = { ngay: 7, credits: 300 };
export const trialConfig = (env) => (String(env.TRIAL || '').toLowerCase() === 'off' ? null : { ...DEFAULT_TRIAL, ...parseJson(env.TRIAL_JSON, {}) });
export async function trialAvailable(env, uid) {
  uid = ownerUid(uid);
  const t = trialConfig(env);
  if (!t || !env.DB || !uid) return false;
  const row = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM ledger WHERE uid = ?1 AND reason = 'dung_thu') + (SELECT COUNT(*) FROM orders WHERE uid = ?1 AND status = 'paid') AS n").bind(uid).first();
  return !(row && row.n > 0);
}
// Nguyên tử: ghi sổ chỉ khi chưa từng dùng thử/mua gói, rồi mới cộng credit + hạn (bấm 2 lần cũng chỉ được 1 lần).
export async function startTrial(env, uid, email) {
  uid = ownerUid(uid);
  const t = trialConfig(env);
  if (!t) return { ok: false, error: 'Hiện chưa mở dùng thử.' };
  await ensureAccount(env, uid, email);
  const now = Date.now();
  const [ins] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO ledger (uid, delta, reason, ref, created_at) SELECT ?1, ?2, 'dung_thu', ?3, ?4
      WHERE NOT EXISTS (SELECT 1 FROM ledger WHERE uid = ?1 AND reason = 'dung_thu') AND NOT EXISTS (SELECT 1 FROM orders WHERE uid = ?1 AND status = 'paid')`).bind(uid, t.credits, t.ngay + ' ngày', now),
    env.DB.prepare(`UPDATE accounts SET credits = credits + ?2, plan_until = MAX(plan_until, ?3) + ?4 * ${DAY}, plan = 'dung_thu', updated_at = ?3 WHERE uid = ?1 AND changes() > 0`).bind(uid, t.credits, now, t.ngay),
  ]);
  return ins.meta.changes ? { ok: true, ...t } : { ok: false, error: 'Tài khoản này đã dùng thử rồi. Chọn một gói để dùng tiếp nhé.' };
}
export const topups = (env) => parseJson(env.TOPUPS_JSON, DEFAULT_TOPUPS);
export const prices = (env) => ({ ...DEFAULT_PRICES, ...parseJson(env.PRICES_JSON, {}) });

export const billingOn = (env) => !!(env.DB && getGoogleClientId(env) && String(env.BILLING || '').toLowerCase() !== 'off');
export const isAdminEmail = (env, email) => {
  const list = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
};

// ---------- Tài khoản ----------
export async function ensureAccount(env, uid, email) {
  uid = ownerUid(uid);
  if (!env.DB || !uid) return null;
  const now = Date.now();
  await env.DB.prepare('INSERT INTO accounts (uid, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(uid) DO UPDATE SET email = COALESCE(?2, accounts.email), updated_at = ?3')
    .bind(uid, email || null, now).run();
  return getAccount(env, uid);
}
export async function getAccount(env, uid) {
  uid = ownerUid(uid);
  if (!env.DB || !uid) return null;
  return env.DB.prepare('SELECT * FROM accounts WHERE uid = ?1').bind(uid).first();
}
export const isActive = (acc, now = Date.now()) => !!(acc && acc.plan_until > now);
export function publicAccount(env, acc) {
  if (!acc) return null;
  const p = plans(env).find((x) => x.id === acc.plan);
  return { plan: acc.plan || null, ten_goi: p ? p.ten : acc.plan === 'dung_thu' ? 'Dùng thử' : null, het_han: acc.plan_until || 0, con_han: isActive(acc), credits: acc.credits || 0, ai: acc.ai_choice || null };
}

// ---------- 4 bước bắt đầu ----------
// Kênh: app đăng bài/nhắn khách đã nối qua Composio, hoặc máy chủ MCP đăng bài (Metricool, Wix, Webflow).
export const CHANNEL_APPS = ['facebook', 'instagram', 'youtube', 'linkedin', 'pinterest', 'reddit', 'threads', 'tiktok', 'whatsapp', 'telegram', 'webflow', 'wix', 'metaads', 'googleads', 'gmail', 'outlook', 'mailchimp', 'brevo'];
const CHANNEL_MCP_HOSTS = ['metricool', 'wix.com', 'webflow'];
export const BRAND_REQUIRED = { name: 'Tên doanh nghiệp', products: 'Sản phẩm, dịch vụ chính', customers: 'Khách hàng mục tiêu' };

export async function onboarding(env, uid, { email, admin } = {}) {
  const on = billingOn(env);
  if (!on || !uid) return { required: false, done: true, steps: null };
  if (admin) return { required: true, done: true, admin: true, steps: { brand: true, channel: true, ai: true, paid: true } };
  const [brand, apps, servers, seen, acc, canTrial] = await Promise.all([
    getBrand(env, uid).catch(() => null), connectedApps(env, uid).then((o) => Object.keys(o || {})).catch(() => []), listServers(env, uid).catch(() => []),
    env.KV.get('aiseen:' + uid, { type: 'json' }).catch(() => null), ensureAccount(env, uid, email), trialAvailable(env, uid).catch(() => false),
  ]);
  const b = brand || {};
  const missingBrand = Object.keys(BRAND_REQUIRED).filter((k) => !String(b[k] || '').trim());
  const channelApps = apps.filter((s) => CHANNEL_APPS.includes(s));
  const channelMcp = servers.filter((s) => !s.off && CHANNEL_MCP_HOSTS.some((h) => String(s.url || '').includes(h))).map((s) => s.name);
  const steps = {
    brand: !missingBrand.length,
    channel: channelApps.length + channelMcp.length > 0,
    ai: !!(seen && seen.ten) || (acc && acc.ai_choice === 'crewzy'),
    paid: isActive(acc),
  };
  return {
    required: true, done: steps.brand && steps.channel && steps.ai && steps.paid, steps,
    chi_tiet: { thieu_brain: missingBrand.map((k) => BRAND_REQUIRED[k]), kenh: [...channelApps, ...channelMcp], ai: seen && seen.ten ? seen.ten : acc && acc.ai_choice === 'crewzy' ? 'Trợ lý Crewzy' : null },
    account: publicAccount(env, acc),
    dung_thu: canTrial ? trialConfig(env) : null,
  };
}

// ---------- Credit ----------
// Trừ credit có kiểm tra số dư, nguyên tử trong một lô D1 (UPDATE … WHERE credits >= n, chỉ ghi sổ khi UPDATE có đổi).
export async function charge(env, uid, n, reason, ref) {
  uid = ownerUid(uid);
  n = Math.ceil(Number(n) || 0);
  if (n <= 0) return { ok: true, charged: 0 };
  const now = Date.now();
  const [upd] = await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET credits = credits - ?1, updated_at = ?3 WHERE uid = ?2 AND credits >= ?1').bind(n, uid, now),
    env.DB.prepare('INSERT INTO ledger (uid, delta, reason, ref, created_at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0').bind(uid, -n, reason, ref || null, now),
  ]);
  return upd.meta.changes ? { ok: true, charged: n } : { ok: false, charged: 0 };
}
// Trừ theo chi phí thật sau khi việc đã xảy ra (token AI): luôn trừ, số dư có thể âm nhẹ; lượt sau bị chặn.
// Trả số dư còn lại (null nếu không trừ gì).
export async function chargeAfter(env, uid, n, reason, ref) {
  uid = ownerUid(uid);
  n = Math.ceil(Number(n) || 0);
  if (n <= 0) return null;
  const now = Date.now();
  const [upd] = await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET credits = credits - ?1, updated_at = ?3 WHERE uid = ?2 RETURNING credits').bind(n, uid, now),
    env.DB.prepare('INSERT INTO ledger (uid, delta, reason, ref, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(uid, -n, reason, ref || null, now),
  ]);
  const row = upd.results && upd.results[0];
  return row ? row.credits : null;
}
export async function grant(env, uid, credits, days, reason, ref, planId) {
  uid = ownerUid(uid);
  const now = Date.now();
  const stmts = [
    env.DB.prepare('INSERT INTO accounts (uid, created_at, updated_at) VALUES (?1, ?2, ?2) ON CONFLICT(uid) DO NOTHING').bind(uid, now),
    env.DB.prepare(`UPDATE accounts SET credits = credits + ?2,
      plan_until = CASE WHEN ?3 > 0 THEN MAX(plan_until, ?4) + ?3 * ${DAY} ELSE plan_until END,
      plan = CASE WHEN ?5 IS NOT NULL THEN ?5 ELSE plan END, updated_at = ?4 WHERE uid = ?1`).bind(uid, credits || 0, days || 0, now, planId || null),
  ];
  if (credits) stmts.push(env.DB.prepare('INSERT INTO ledger (uid, delta, reason, ref, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(uid, credits, reason, ref || null, now));
  await env.DB.batch(stmts);
}

// Giá một lượt gọi công cụ (credit). args dùng để đếm số công cụ trong COMPOSIO_MULTI_EXECUTE_TOOL.
export function toolPrice(env, name, args) {
  const p = prices(env);
  if (!name || FREE_TOOLS.has(name)) return 0;
  if (name === 'COMPOSIO_MULTI_EXECUTE_TOOL') return p.tool * Math.max(1, Math.min(50, ((args && args.tools) || []).length));
  if (name === 'COMPOSIO_REMOTE_WORKBENCH' || name === 'COMPOSIO_REMOTE_BASH_TOOL') return p.workbench;
  if (name === 'CREWZY_GIONG_NOI') return p.voice;
  if (name === 'CREWZY_TAO_ANH') return args && args.chat_luong === 'dep' ? p.image_dep : p.image;
  if (name === 'CREWZY_TAO_VIDEO') return (args && args.chat_luong === 'dep' ? p.video_second_dep : p.video_second) * (Number(args && args.giay) || 6);
  if (name.startsWith('CREWZY_')) return 0; // đọc Brain, quy trình, phiếu, đọc web, tải file: miễn phí
  return p.tool; // công cụ app (Composio) hoặc MCP ngoài (m…_)
}
export function instantCredits(env, usd) {
  if (!(usd > 0)) return 0;
  const p = prices(env);
  return Math.max(1, Math.ceil((usd * p.usd_rate * (p.instant_markup || p.ai_markup)) / 100));
}
// Giá Anthropic theo model (USD / 1 triệu token, tra platform.claude.com/docs/en/about-claude/pricing 22/11/2026).
// cr = hệ số giá đọc cache so với giá vào; ghi cache 5 phút = 1,25 × giá vào. Haiku: giá ≤100K token (prompt dài hơn tính ×5).
export const AI_MODEL_PRICES = {
  'claude-opus-5-5': { in: 4, out: 20, cr: 0.05 },
  'claude-sonnet-5-5': { in: 2, out: 10, cr: 0.05 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cr: 0.1, long: 5 },
};
export function tokenCredits(env, usage, model) {
  if (!usage) return 0;
  const p = prices(env);
  const m = (p.ai_models && p.ai_models[model]) || AI_MODEL_PRICES[model] || { in: p.ai_in_per_m, out: p.ai_out_per_m, cr: 0.1 };
  const prompt = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const k = m.long && prompt > 100000 ? m.long : 1;
  const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * m.cr;
  const usd = (inTok * m.in + (usage.output_tokens || 0) * m.out) * k / 1e6;
  return Math.ceil((usd * p.usd_rate * p.ai_markup) / 100);
}

// Đồng hồ đo cho một lượt làm việc. null = không tính (tắt billing hoặc admin).
// meter.tool(name, args) → null nếu được chạy, hoặc chuỗi lỗi để trả cho AI. meter.tokens(usage) trừ theo token (chỉ khoá AI của Giang).
export async function makeMeter(env, uid, { email } = {}) {
  if (!billingOn(env) || !uid) return null;
  const acc = await getAccount(env, uid);
  if (acc && isAdminEmail(env, acc.email || email)) return null;
  const out = (msg) => `${msg} Vào Crewzy → Gói và credit để nạp thêm hoặc gia hạn.`;
  return {
    async tool(name, args) {
      const n = toolPrice(env, name, args);
      if (!n) return null;
      const r = await charge(env, uid, n, 'cong_cu', name);
      return r.ok ? null : out(`Hết credit để chạy ${name} (cần ${n} credit).`);
    },
    // Công cụ Instant (Composio trả bằng ví của Giang): trừ theo USD thật × tỉ giá × hệ số lãi, tối thiểu 1 credit. Có thể âm → dừng.
    async instant(usd, ref) {
      const n = instantCredits(env, usd);
      if (!n) return null;
      const left = await chargeAfter(env, uid, n, 'instant', ref || 'instant');
      return left !== null && left <= 0 ? 'stop' : null;
    },
    async tokens(usage, ref, model) {
      const n = tokenCredits(env, usage, model);
      if (!n) return null;
      const left = await chargeAfter(env, uid, n, 'ai', ref || 'claude');
      return left !== null && left <= 0 ? 'stop' : null;
    },
  };
}

// Kiểm tra trước khi cho dùng: trả null nếu được, hoặc {status, error, onboarding}.
export async function gate(env, uid, { email, needCredits = 0 } = {}) {
  if (!billingOn(env) || !uid) return null;
  const acc = await ensureAccount(env, uid, email);
  if (isAdminEmail(env, (acc && acc.email) || email)) return null;
  if (!isActive(acc)) return { status: 402, error: acc && acc.plan === 'dung_thu' ? 'Đã hết thời gian dùng thử. Vào Crewzy → Gói và credit chọn gói để dùng tiếp (kết quả, kết nối, Brain vẫn giữ nguyên).' : 'Tài khoản chưa kích hoạt gói hoặc gói đã hết hạn. Vào Crewzy → Gói và credit để thanh toán.', can: 'thanh_toan' };
  if (needCredits && (acc.credits || 0) < needCredits) return { status: 402, error: `Còn ${acc.credits || 0} credit, cần ít nhất ${needCredits}. Vào Gói và credit để nạp thêm.`, can: 'nap_credit' };
  return null;
}
