// NHIỀU THƯƠNG HIỆU TRÊN MỘT LINK NỐI AI (23/11/2026, Giang: AI của khách chỉ đọc được Nhà Xinh Minh Thùy, không thấy Vị Trí Studio).
// Link MCP ký theo mã khách lúc tạo. Thương hiệu con của Agency nằm ở mã "<chủ>-b<n>" → link tạo ở thương hiệu chính không thấy thương hiệu con.
// CREWZY_THUONG_HIEU: AI xem danh sách thương hiệu và chọn thương hiệu đang làm. Lựa chọn lưu theo từng link: KV mcpbiz:<mã link>:<k>
// (chỉ ghi lúc đổi). Cổng MCP đọc lựa chọn mỗi yêu cầu → Brain, Kho, phiếu việc, đăng bài, bộ nhớ đều theo thương hiệu đã chọn.
// Công cụ Composio: phiên Composio của link gắn với mã khách lúc tạo, nên khi đang làm cho thương hiệu khác, cổng tự chạy
// COMPOSIO_MULTI_EXECUTE_TOOL bằng tài khoản của thương hiệu đó (tools.execute), không gửi phiên cũ (tránh đăng nhầm Fanpage).
import { Composio } from '@composio/core';
import { getApiKey, userIdFor, kvGetJson } from './common.js';
import { getBrand, brandText } from './brand.js';

export const ownerOf = (uid) => String(uid || '').replace(/-b\d+$/, '');
const bizNo = (uid) => { const m = /-b(\d+)$/.exec(String(uid || '')); return m ? Number(m[1]) : 0; };
const uidOf = (owner, n) => (n ? `${owner}-b${n}` : owner);
const key = (linkUid, k) => `mcpbiz:${linkUid}:${k || '0'}`;
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '');

export async function listBrands(env, owner) {
  const [data, main] = await Promise.all([kvGetJson(env, 'biz:' + owner).catch(() => null), getBrand(env, owner).catch(() => null)]);
  const items = (data && Array.isArray(data.items) ? data.items : []).map((b) => ({ n: b.n, ten: b.ten }));
  return [{ n: 0, ten: (main && main.name) || 'Thương hiệu chính' }, ...items];
}

// Mã khách đang làm việc cho link này (thương hiệu đã chọn, không chọn thì đúng mã của link).
export async function activeUid(env, linkUid, k) {
  if (!linkUid) return linkUid;
  try {
    const v = await env.KV.get(key(linkUid, k), { type: 'json' });
    if (v && Number.isInteger(v.n)) return uidOf(ownerOf(linkUid), v.n);
  } catch (e) { /* đọc lỗi → giữ mã của link */ }
  return linkUid;
}

export const BRAND_TOOL = {
  name: 'CREWZY_THUONG_HIEU',
  description: 'Xem và CHỌN THƯƠNG HIỆU đang làm việc (tài khoản Agency có nhiều thương hiệu/doanh nghiệp). hanh_dong "xem" = danh sách + thương hiệu đang làm; "chon" + thuong_hieu (tên hoặc số thứ tự) = chuyển sang thương hiệu đó: Brain, Kho, app đã nối, phiếu việc, đăng bài từ đây theo thương hiệu mới. Khách nhắc tên một thương hiệu khác với thương hiệu đang làm thì gọi "xem" rồi "chon" trước khi làm.',
  inputSchema: { type: 'object', properties: {
    hanh_dong: { type: 'string', enum: ['xem', 'chon'], description: 'xem hoặc chon' },
    thuong_hieu: { type: 'string', description: 'Tên thương hiệu (gần đúng cũng được) hoặc số thứ tự trong danh sách, khi chon.' },
  }, required: ['hanh_dong'] },
};

async function connected(env, uid) {
  if (!getApiKey(env) || env.TEST_OFFLINE) return [];
  try {
    const res = await new Composio({ apiKey: getApiKey(env) }).connectedAccounts.list({ userIds: [userIdFor(uid)], statuses: ['ACTIVE'], limit: 100 });
    return [...new Set((res.items || []).map((i) => i.toolkit && i.toolkit.slug).filter(Boolean))];
  } catch (e) { return []; }
}

export async function brandTool(env, linkUid, k, args = {}, origin = '') {
  const owner = ownerOf(linkUid);
  const list = await listBrands(env, owner);
  const cur = await activeUid(env, linkUid, k);
  const curN = bizNo(cur);
  const view = (extra = {}) => ({
    dang_lam_cho: (list.find((b) => b.n === curN) || list[0]).ten,
    danh_sach: list.map((b, i) => ({ so: i + 1, ten: b.ten, dang_chon: b.n === curN })),
    ...extra,
  });
  if (args.hanh_dong !== 'chon') {
    return { data: view(list.length < 2 ? { luu_y: `Tài khoản chỉ có 1 thương hiệu. Thêm thương hiệu ở ${origin}/goi.html (gói Agency) rồi điền Brain cho thương hiệu đó.` } : {}) };
  }
  const q = String(args.thuong_hieu || '').trim();
  if (!q) return { error: 'Thiếu thuong_hieu (tên hoặc số thứ tự). Gọi hanh_dong "xem" để lấy danh sách.' };
  let pick = /^\d+$/.test(q) ? list[Number(q) - 1] : null;
  if (!pick) { const nq = norm(q); pick = list.find((b) => norm(b.ten) === nq) || list.find((b) => nq && (norm(b.ten).includes(nq) || nq.includes(norm(b.ten)))); }
  if (!pick) return { error: `Không có thương hiệu "${q}". Có: ${list.map((b, i) => `${i + 1}. ${b.ten}`).join('; ')}.` };
  await env.KV.put(key(linkUid, k), JSON.stringify({ n: pick.n, luc: new Date().toISOString() }), { expirationTtl: 365 * 86400 });
  const uid = uidOf(owner, pick.n);
  const [brand, apps] = await Promise.all([getBrand(env, uid).catch(() => null), connected(env, uid)]);
  return { data: view({
    dang_lam_cho: pick.ten,
    danh_sach: list.map((b, i) => ({ so: i + 1, ten: b.ten, dang_chon: b.n === pick.n })),
    brain: brandText(brand) || `Thương hiệu này chưa điền Brain. Hỏi khách vài câu rồi lưu bằng CREWZY_LUU_BRAIN, hoặc khách điền ở ${origin}/thuong-hieu.html (chọn thương hiệu ${pick.ten} ở ô chọn doanh nghiệp).`,
    app_da_noi: apps.length ? apps : `Chưa nối app nào cho ${pick.ten}. Khách nối ở ${origin}/ket-noi.html sau khi chọn thương hiệu ${pick.ten} ở ô chọn doanh nghiệp.`,
    luu_y: 'Từ giờ mọi việc (Brain, Kho, phiếu, đăng bài, bộ nhớ) theo thương hiệu này. Bỏ qua Brain và app đã nối của thương hiệu cũ trong hướng dẫn đầu cuộc trò chuyện. Trạng thái kết nối trong COMPOSIO_SEARCH_TOOLS là của thương hiệu chính: tin app_da_noi ở đây.',
  }) };
}

// Chạy COMPOSIO_MULTI_EXECUTE_TOOL bằng tài khoản của thương hiệu đang chọn.
export async function multiExecuteAs(env, uid, args = {}, run) {
  const tools = Array.isArray(args.tools) ? args.tools.slice(0, 20) : [];
  if (!tools.length) return { error: 'Thiếu danh sách tools.' };
  const exec = run || (async (slug, a) => new Composio({ apiKey: getApiKey(env) }).tools.execute(slug, { userId: userIdFor(uid), dangerouslySkipVersionCheck: true, arguments: a }));
  const results = [];
  for (const t of tools) {
    const slug = t && (t.tool_slug || t.slug || t.name);
    if (!slug) { results.push({ successful: false, error: 'Thiếu tool_slug' }); continue; }
    try {
      const r = await exec(slug, (t && t.arguments) || {});
      results.push({ tool_slug: slug, successful: !(r && r.successful === false), data: r && r.data, error: (r && r.error) || null });
    } catch (e) {
      results.push({ tool_slug: slug, successful: false, error: String((e && e.message) || e).slice(0, 300) });
    }
  }
  return { data: { results, ghi_chu: 'Chạy bằng tài khoản của thương hiệu đang chọn trong Crewzy.' } };
}
