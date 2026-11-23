// AGENCY — nhiều doanh nghiệp/thương hiệu (23/11/2026). Gói agency: tối đa feat.doanh_nghiep (10) gồm doanh nghiệp chính (mã chủ) + 9 doanh nghiệp con.
// GET  /api/doanh-nghiep → { items:[{n, ten}], dang_chon, toi_da, chinh }
// POST { action:'tao', ten } | { action:'chon', n } (0 = doanh nghiệp chính) | { action:'doi_ten', n, ten }
// Dữ liệu mỗi doanh nghiệp con nằm ở mã khách "<chủ>-b<n>" (resolveUid đọc cookie cz_biz); gói/credit tính theo chủ.
import { resolveUid, kvGetJson, kvPutJson, json, BIZ_COOKIE } from '../lib/common.js';
import { getFeatures, upgradeHint } from '../lib/billing.js';
import { getBrand } from '../lib/brand.js';

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
const cookie = (n) => `${BIZ_COOKIE}=${n}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${n ? 365 * 86400 : 0}`;

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { body = {}; } }
  const who = await resolveUid(req, env, url.searchParams.get('uid') || body.uid);
  if (who.response) return who.response;
  if (!who.session) return json({ error: 'Cần đăng nhập Google để dùng nhiều doanh nghiệp.' }, 401);
  const owner = who.owner || who.uid;
  const key = 'biz:' + owner;
  const data = (await kvGetJson(env, key)) || { items: [] };
  const feat = await getFeatures(env, owner, who.session.email).catch(() => null);
  const max = Math.max(1, (feat && feat.doanh_nghiep) || 1);
  const mainBrand = await getBrand(env, owner).catch(() => null);
  const view = (extra = {}) => json({ items: data.items, dang_chon: who.biz || 0, toi_da: max, chinh: (mainBrand && mainBrand.name) || 'Doanh nghiệp chính', ...extra });

  if (req.method === 'GET') return view();
  if (req.method !== 'POST') return json({ error: 'Không hỗ trợ.' }, 405);

  if (body.action === 'tao') {
    if (max <= 1) return json({ error: upgradeHint('doanh_nghiep') }, 402);
    if (data.items.length + 1 >= max) return json({ error: `Gói hiện tại có ${max} thương hiệu. Mua thêm thương hiệu (100.000đ/tháng/thương hiệu) ở trang Gói và credit.` }, 400);
    const ten = clean(body.ten);
    if (!ten) return json({ error: 'Nhập tên doanh nghiệp/thương hiệu.' }, 400);
    const used = new Set(data.items.map((b) => b.n));
    let n = 1; while (used.has(n) && n <= 40) n++;
    if (n > 40) return json({ error: 'Đã đủ số doanh nghiệp.' }, 400);
    data.items.push({ n, ten, tao: new Date().toISOString() });
    await kvPutJson(env, key, data);
    // Tạo xong chuyển sang doanh nghiệp mới để điền Brain, nối kênh ngay.
    return new Response(JSON.stringify({ ok: true, items: data.items, dang_chon: n, toi_da: max }), { headers: { 'content-type': 'application/json', 'set-cookie': cookie(n) } });
  }
  if (body.action === 'chon') {
    const n = Number(body.n) || 0;
    if (n && !data.items.some((b) => b.n === n)) return json({ error: 'Không có doanh nghiệp này.' }, 404);
    return new Response(JSON.stringify({ ok: true, dang_chon: n }), { headers: { 'content-type': 'application/json', 'set-cookie': cookie(n) } });
  }
  if (body.action === 'doi_ten') {
    const b = data.items.find((x) => x.n === Number(body.n));
    const ten = clean(body.ten);
    if (!b || !ten) return json({ error: 'Thiếu doanh nghiệp hoặc tên.' }, 400);
    b.ten = ten;
    await kvPutJson(env, key, data);
    return view({ ok: true });
  }
  return json({ error: 'Thao tác không hợp lệ.' }, 400);
};
