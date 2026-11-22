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

// Mô tả gói: mọi gói đều nối KHÔNG GIỚI HẠN kênh/app (code không giới hạn theo gói) — gói khác nhau ở credit.
// Số lượng ước tính theo giá credit thật (bộ não Cân bằng = Sonnet 5.5, có cache; Opus tốn ~gấp đôi, Haiku ~1/5):
//   1 bài có ảnh đăng lên mọi kênh đã nối ≈ 55 credit (4 bước Sonnet ~48 + ảnh 3 + đăng ~1/kênh)
//   1 trả lời bình luận/tin nhắn (lịch tự trả lời chạy Haiku) ≈ 6 · 1 báo cáo tuần ≈ 100 · 1 video AI 10 giây = 150 · 1 lần soi đối thủ ≈ 200
//   Cơ bản 3.000 = 30×55 + 150×6 + 4×100 = 2.950 · Tăng trưởng 8.000 = 80×55 + 400×6 + 5×150 + 4×100 = 7.950
//   Doanh nghiệp 20.000 = 180×55 + 1.000×6 + 15×150 + 8×100 + 4×200 = 19.750. Đổi credit gói thì sửa lại các số này.
const ALL_CHANNELS = 'Nối không giới hạn kênh: Facebook, Instagram, YouTube, LinkedIn, Pinterest, Telegram, WhatsApp, Gmail… (176 app)';
export const DEFAULT_PLANS = [
  // MCP For You: khách dùng Claude/ChatGPT/Gemini/Grok CỦA HỌ qua link nối AI → Giang không trả token AI, chỉ trả lượt Composio (~8đ, bán 1 credit = 75–100đ)
  // + ảnh. 1 bài kèm ảnh đăng 6 kênh ≈ 10 credit (ảnh 3 + 6 lượt đăng + 1 đọc), 1 trả lời bình luận ≈ 2, báo cáo tuần (đọc số các kênh) ≈ 50.
  // 2.000 = 100×10 + 400×2 + 4×50 = 2.000. Giá vốn/credit 74,5đ ≥ 50đ nên dù khách tiêu credit vào Trợ lý Crewzy (Opus/Sonnet) vẫn lời.
  { id: 'mcp_for_you', ten: 'MCP For You', gia: 149000, credits: 2000, ngay: 30, mo_ta: 'Đã có Claude, ChatGPT, Gemini hay Grok? Nối Crewzy vào AI của bạn bằng 1 link, AI của bạn làm việc thật trên mọi kênh.',
    loi_ich: [ALL_CHANNELS, '1 link nối Claude, ChatGPT, Gemini, Grok, Claude Code, Codex, Cursor (Claude và Cursor cài 1 bấm), không cần khoá API', '100 bài kèm ảnh mỗi tháng, mỗi bài đăng cùng lúc mọi kênh: 6 kênh = 600 lượt đăng', '400 bình luận, tin nhắn được AI của bạn trả lời', '23 quy trình + 28 lệnh nhanh (/mcp__crewzy__…) + Brain thương hiệu tự nạp vào AI', 'Kết quả nộp về Crewzy để duyệt, đăng, xem báo cáo', 'Tiền AI không tính vào credit: AI của bạn suy nghĩ, Crewzy chỉ tính lượt chạy app'] },
  { id: 'co_ban', ten: 'Cơ bản', gia: 299000, credits: 3000, ngay: 30, mo_ta: 'Cửa hàng, cá nhân kinh doanh tự động hoá nội dung và chăm khách.',
    loi_ich: [ALL_CHANNELS, '30 bài kèm ảnh mỗi tháng, mỗi bài đăng cùng lúc lên MỌI kênh (6 kênh = 180 lượt đăng)', '150 bình luận, tin nhắn được trả lời tự động', '4 báo cáo tuần: bài nào ra khách, kênh nào hiệu quả', '23 quy trình mẫu + Brain thương hiệu + hẹn giờ tự chạy'] },
  { id: 'tang_truong', ten: 'Tăng trưởng', gia: 699000, credits: 8000, ngay: 30, mo_ta: 'Doanh nghiệp nhỏ muốn có mặt hằng ngày trên mọi kênh.', noi_bat: true,
    loi_ich: [ALL_CHANNELS, '80 bài kèm ảnh mỗi tháng (gần 3 bài/ngày), đăng cùng lúc mọi kênh: 6 kênh = 480 lượt đăng', '400 bình luận, tin nhắn được trả lời tự động', '5 video ngắn AI dọc 9:16 cho Reels, TikTok, Shorts', '4 báo cáo tuần + gợi ý nội dung tuần sau', 'Mỗi credit rẻ hơn 13% so với gói Cơ bản'] },
  { id: 'doanh_nghiep', ten: 'Doanh nghiệp', gia: 1490000, credits: 20000, ngay: 30, mo_ta: 'Cả đội nhân viên AI: nhiều phòng, nhiều thương hiệu chạy cùng lúc.',
    loi_ich: [ALL_CHANNELS, '180 bài kèm ảnh mỗi tháng (6 bài/ngày), mọi kênh: 6 kênh = 1.080 lượt đăng', '1.000 bình luận, tin nhắn được trả lời tự động', '15 video ngắn AI mỗi tháng', '8 báo cáo + 4 lần soi đối thủ (Reels, website, quảng cáo)', 'Tìm khách doanh nghiệp, báo giá, chăm khách vào CRM', 'Mỗi credit rẻ hơn 25% so với gói Cơ bản'] },
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
  video_second: 15,   // CREWZY_TAO_VIDEO, mỗi giây
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
  const t = trialConfig(env);
  if (!t || !env.DB || !uid) return false;
  const row = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM ledger WHERE uid = ?1 AND reason = 'dung_thu') + (SELECT COUNT(*) FROM orders WHERE uid = ?1 AND status = 'paid') AS n").bind(uid).first();
  return !(row && row.n > 0);
}
// Nguyên tử: ghi sổ chỉ khi chưa từng dùng thử/mua gói, rồi mới cộng credit + hạn (bấm 2 lần cũng chỉ được 1 lần).
export async function startTrial(env, uid, email) {
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
  if (!env.DB || !uid) return null;
  const now = Date.now();
  await env.DB.prepare('INSERT INTO accounts (uid, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(uid) DO UPDATE SET email = COALESCE(?2, accounts.email), updated_at = ?3')
    .bind(uid, email || null, now).run();
  return getAccount(env, uid);
}
export async function getAccount(env, uid) {
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
  if (name === 'CREWZY_TAO_ANH') return p.image;
  if (name === 'CREWZY_TAO_VIDEO') return p.video_second * (Number(args && args.giay) || 6);
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
