// GET /api/leads → {leads, stats, trang_thai} · POST {action:'cap_nhat', id, trang_thai?, gia_tri?, ghi_chu?} | {action:'them', ten, sdt, nguon, nhu_cau}
import { resolveUid } from '../lib/common.js';
import { listLeads, updateLead, addLead, leadStats, LEAD_STATES } from '../lib/leads.js';

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  if (req.method === 'GET') {
    const list = await listLeads(env, who.uid);
    return Response.json({ leads: list.slice(0, 100), stats: leadStats(list), trang_thai: LEAD_STATES }, { headers: { 'cache-control': 'no-store' } });
  }
  const out = body.action === 'them' ? await addLead(env, who.uid, { ...body, muc_do: body.muc_do || 'am' }, 'Bạn')
    : body.action === 'cap_nhat' ? await updateLead(env, who.uid, String(body.id || ''), body) : { error: 'Thao tác không hợp lệ.' };
  return Response.json(out, { status: out.error ? 400 : 200 });
};
