// Kho lưu trữ: GET /api/kho?loai=&q=&truoc= → {muc, dung, gioi_han} · POST {action:'xoa', id} | {action:'doi_ten', id, ten} | {action:'them_link', url, ten}
import { resolveUid } from '../lib/common.js';
import { listItems, usageBytes, removeItem, renameItem, addItem, guessKind } from '../lib/library.js';
import { getFeatures } from '../lib/billing.js';

const noStore = { 'cache-control': 'no-store' };

export default async (req, env) => {
  const url = new URL(req.url);
  if (!env.DB) return Response.json({ error: 'Máy chủ chưa có cơ sở dữ liệu.' }, { status: 503 });
  if (req.method === 'GET') {
    const who = await resolveUid(req, env, url.searchParams.get('uid'));
    if (who.response) return who.response;
    const [muc, dung, feat] = await Promise.all([
      listItems(env, who.uid, { kind: url.searchParams.get('loai'), q: url.searchParams.get('q'), before: url.searchParams.get('truoc') }),
      usageBytes(env, who.uid), getFeatures(env, who.uid),
    ]);
    return Response.json({ muc, dung, gioi_han: Math.round((feat.kho_gb || 0) * 1024 * 1024 * 1024) }, { headers: noStore });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body = {};
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const who = await resolveUid(req, env, body.uid);
  if (who.response) return who.response;
  if (body.action === 'xoa') return Response.json({ ok: await removeItem(env, who.uid, String(body.id || '')) });
  if (body.action === 'doi_ten') return Response.json({ ok: await renameItem(env, who.uid, String(body.id || ''), body.ten) });
  if (body.action === 'them_link') {
    const link = String(body.url || '').trim();
    if (!/^https:\/\//.test(link)) return Response.json({ error: 'Link phải bắt đầu bằng https://' }, { status: 400 });
    const id = await addItem(env, who.uid, { url: link, kind: guessKind(link), name: body.ten, source: 'link' });
    return Response.json({ ok: true, id });
  }
  return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
};
