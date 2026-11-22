// Brain thương hiệu của khách: AI đọc trước khi viết bài, trả lời khách.
// GET /api/brand[?uid=] → { brand }   ·   POST /api/brand { uid?, brand } → { ok, brand }
// Lưu trong Netlify Blobs "vpai-brand", khoá = mã khách (lấy từ phiên đăng nhập; uid chỉ dùng khi chưa bật đăng nhập).
import { resolveUid, safeDetail } from '../lib/common.mjs';
import { brandStore, cleanBrand } from '../lib/brand.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const store = brandStore();
  if (req.method === 'GET') {
    const who = resolveUid(req, url.searchParams.get('uid'));
    if (who.response) return who.response;
    const brand = (await store.get(who.uid, { type: 'json' })) || {};
    return Response.json({ brand }, { headers: { 'cache-control': 'no-store' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const who = resolveUid(req, body && body.uid);
  if (who.response) return who.response;
  try {
    const brand = { ...cleanBrand(body && body.brand), updatedAt: new Date().toISOString() };
    await store.setJSON(who.uid, brand);
    return Response.json({ ok: true, brand });
  } catch (err) {
    console.error('brand save failed', err && err.message);
    return Response.json({ error: 'Chưa lưu được, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 500 });
  }
};

export const config = { path: '/api/brand' };
