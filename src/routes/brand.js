// Brain thương hiệu của khách: AI đọc trước khi viết bài, trả lời khách.
// GET /api/brand[?uid=] → { brand }   ·   POST /api/brand { uid?, brand } → { ok, brand }
// Lưu trong KV khoá brand:<mã khách> (lấy từ phiên đăng nhập; uid chỉ dùng khi chưa bật đăng nhập).
import { resolveUid, safeDetail } from '../lib/common.js';
import { getBrand, putBrand, cleanBrand } from '../lib/brand.js';

export default async (req, env) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const who = await resolveUid(req, env, url.searchParams.get('uid'));
    if (who.response) return who.response;
    const brand = (await getBrand(env, who.uid)) || {};
    return Response.json({ brand }, { headers: { 'cache-control': 'no-store' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const who = await resolveUid(req, env, body && body.uid);
  if (who.response) return who.response;
  try {
    const brand = { ...cleanBrand(body && body.brand), updatedAt: new Date().toISOString() };
    await putBrand(env, who.uid, brand);
    return Response.json({ ok: true, brand });
  } catch (err) {
    console.error('brand save failed', err && err.message);
    return Response.json({ error: 'Chưa lưu được, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 500 });
  }
};

