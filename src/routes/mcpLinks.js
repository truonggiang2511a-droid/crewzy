// Danh sách và thu hồi link nối AI.
// GET  /api/mcp-links[?uid=]  → {links:[{k,ten,tao,dung}], cu_off}
// POST /api/mcp-links {action:'revoke', k} | {action:'revoke_old'}
import { resolveUid, json } from '../lib/common.js';
import { listLinks, revokeLink, revokeOld } from '../lib/mcpLinks.js';

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { body = {}; } }
  const who = await resolveUid(req, env, url.searchParams.get('uid') || body.uid);
  if (who.response) return who.response;
  const uid = who.uid;

  if (req.method === 'GET') return json(await listLinks(env, uid));
  if (req.method !== 'POST') return json({ error: 'Không hỗ trợ.' }, 405);

  if (body.action === 'revoke') {
    if (!/^[a-z0-9]{6,16}$/.test(body.k || '')) return json({ error: 'Mã link không hợp lệ.' }, 400);
    const ok = await revokeLink(env, uid, body.k);
    if (!ok) return json({ error: 'Không tìm thấy link này (có thể đã thu hồi).' }, 404);
    return json({ ok: true, ...(await listLinks(env, uid)) });
  }
  if (body.action === 'revoke_old') {
    await revokeOld(env, uid);
    return json({ ok: true, ...(await listLinks(env, uid)) });
  }
  return json({ error: 'Thao tác không hợp lệ.' }, 400);
};
