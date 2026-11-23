// Composio Instant: công cụ tìm kiếm, đọc web, giọng đọc, dữ liệu khách hàng… chạy bằng tài khoản của Composio, trả từ ví Composio của Giang
// (giá gốc nhà cung cấp, 0% phí thêm; tra docs.composio.dev/docs/instant-tools 22/11/2026). Khách không phải đăng ký, không cần khoá API.
// Crewzy trừ credit của khách theo số USD Composio báo về (returnInstantCharge) × tỉ giá × hệ số lãi.
// CHỈ bật trong Trợ lý Crewzy (chat + hẹn giờ) vì ở đó đo được tiền từng lần gọi; link nối AI (MCP) tắt Instant (không đo được).
// Composio không có trần chi tiêu theo tiền → Crewzy tự đặt trần mỗi ngày: toàn app INSTANT_DAILY_USD (mặc định 1) và mỗi khách
// INSTANT_USER_DAILY_USD (mặc định 0,3). Hết trần thì phiên tạo với instant:false (công cụ đó sẽ đòi khách tự kết nối).
// Tắt hẳn: biến INSTANT=off.

// Toolkit có Instant (dashboard Composio → Toolkits → Instant, 22/11/2026) và đã có trong danh mục Crewzy.
export const INSTANT_APPS = ['serpapi', 'firecrawl', 'tavily', 'elevenlabs', 'google_maps', 'apollo', 'semrush', 'ahrefs', 'higgsfield'];

// Bộ lọc công cụ cấp PHIÊN (cú pháp tools:{toolkit:{enable:[…]}} đã có trong docs.composio.dev/docs/configuring-sessions): Higgsfield chỉ lộ công cụ ảnh.
export const sessionToolLimits = () => Object.fromEntries(Object.entries(INSTANT_TOOL_LIMITS).map(([k, v]) => [k, { enable: v }]));
// Higgsfield Instant (23/11/2026): chỉ cho ẢNH + xem trạng thái. Video (Seedance ~2 USD/lần, trừ trước, không huỷ được, lỗi vẫn mất tiền) KHÔNG bật Instant:
// khách làm video Higgsfield bằng tài khoản của họ (MCP Higgsfield hoặc khoá API). Cú pháp instant.tools theo docs.composio.dev/docs/instant-tools.
export const INSTANT_TOOL_LIMITS = { higgsfield: ['HIGGSFIELD_GENERATE_SOUL_STANDARD_IMAGE', 'HIGGSFIELD_GENERATE_SOUL_V2_IMAGE', 'HIGGSFIELD_GENERATE_IMAGE_WITH_REFERENCES', 'HIGGSFIELD_ESTIMATE_SOUL_V2_COST', 'HIGGSFIELD_LIST_SOUL_V2_STYLES', 'HIGGSFIELD_GET_REQUEST_STATUS'] };

const vnDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
export const instantOn = (env) => String(env.INSTANT || '').toLowerCase() !== 'off';
const limits = (env) => ({ app: num(env.INSTANT_DAILY_USD, 1), user: num(env.INSTANT_USER_DAILY_USD, 0.3) });

async function spent(env, key) { return num(await env.KV.get(key).catch(() => null), 0); }

// Cấu hình instant cho composio.create của Trợ lý Crewzy: còn trần thì bật kèm báo giá, hết thì false.
export async function instantConfig(env, uid) {
  if (!instantOn(env) || !env.KV) return false;
  const day = vnDay(), lim = limits(env);
  const [a, u] = await Promise.all([spent(env, `instusd:${day}:all`), spent(env, `instusd:${day}:${uid}`)]);
  if (a >= lim.app || u >= lim.user) return false;
  return { returnInstantCharge: true, returnPricesInSearch: true };
}

// Lấy số USD Composio tính cho một lần chạy. Ưu tiên trường instantCharge ở ngoài; không có thì cộng các instant_charge lồng bên trong
// (COMPOSIO_MULTI_EXECUTE_TOOL chạy nhiều công cụ một lúc). amount là chuỗi số thập phân USD.
export function instantUsd(result) {
  const amt = (c) => { if (!c) return 0; if (typeof c === 'number' || typeof c === 'string') return num(c, 0); return num(c.amount, 0); };
  if (!result || typeof result !== 'object') return 0;
  const top = result.instantCharge ?? result.instant_charge;
  if (top) return amt(top);
  let sum = 0, seen = 0;
  const walk = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 6 || seen > 2000) return;
    seen++;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'instantCharge' || k === 'instant_charge') sum += amt(v);
      else if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(result.data, 0);
  return sum;
}

// Ghi chi tiêu (toàn app + khách) để giữ trần ngày. Chỉ ghi khi có tiền (đỡ tốn lượt ghi KV).
export async function recordInstant(env, uid, usd) {
  if (!(usd > 0) || !env.KV) return;
  const day = vnDay(), ttl = { expirationTtl: 3 * 86400 };
  const ka = `instusd:${day}:all`, ku = `instusd:${day}:${uid}`;
  const [a, u] = await Promise.all([spent(env, ka), spent(env, ku)]);
  await Promise.all([env.KV.put(ka, String(+(a + usd).toFixed(6)), ttl), env.KV.put(ku, String(+(u + usd).toFixed(6)), ttl)]);
}

export const INSTANT_NOTE = `# Công cụ Crewzy trả hộ (Instant)
Các app ${INSTANT_APPS.join(', ')} chạy được NGAY cả khi khách chưa kết nối: Crewzy trả tiền nhà cung cấp và trừ credit của khách
(kết quả tìm công cụ có giá từng lần gọi). Đừng bắt khách đăng ký hay kết nối các app này. Dùng vừa đủ (ví dụ tìm 10–20 kết quả, không quét cả nghìn trang)
và báo khách biết mình đã dùng công cụ trả phí nào.`;
