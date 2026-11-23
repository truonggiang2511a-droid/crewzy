// Bộ nhớ AI học về khách (23/11). GET /api/bo-nho → {items, loai} · POST {action:'them', loai, noi_dung} | {action:'xoa', id}
import { resolveUid, json } from '../lib/common.js';
import { listMem, addMem, removeMem, MEM_KINDS } from '../lib/memory.js';

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { body = {}; } }
  const who = await resolveUid(req, env, url.searchParams.get('uid') || body.uid);
  if (who.response) return who.response;
  const uid = who.uid;
  if (req.method === 'GET') return json({ items: await listMem(env, uid), loai: MEM_KINDS }, 200, { 'cache-control': 'no-store' });
  if (req.method !== 'POST') return json({ error: 'Không hỗ trợ.' }, 405);
  if (body.action === 'xoa') return (await removeMem(env, uid, String(body.id || ''))) ? json({ ok: true, items: await listMem(env, uid) }) : json({ error: 'Không có ghi chú này.' }, 404);
  if (body.action === 'them') {
    const r = await addMem(env, uid, { loai: body.loai, noi_dung: body.noi_dung, nguon: 'Bạn tự thêm' });
    return r.error ? json(r, 400) : json({ ok: true, items: await listMem(env, uid) });
  }
  return json({ error: 'Thao tác không hợp lệ.' }, 400);
};
