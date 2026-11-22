// Thư viện quy trình + hẹn giờ.
// GET  /api/workflows                     → {departments, workflows, mcpHosts}
// GET  /api/schedules?uid=                → {schedules, days, modes}
// POST /api/schedules {uid, action:'tao', quy_trinh, gio, ngay, che_do, ghi_chu} | {uid, action:'bat'|'tat'|'xoa', id}
import { resolveUid } from '../lib/common.js';
import { publicWorkflows } from '../lib/workflows.js';
import { listSchedules, createSchedule, updateSchedule, DAYS, MODES } from '../lib/schedules.js';

export default async (req, env) => {
  const url = new URL(req.url);
  if (url.pathname === '/api/workflows') return Response.json(publicWorkflows(), { headers: { 'cache-control': 'public, max-age=300' } });
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  if (req.method === 'GET') return Response.json({ schedules: await listSchedules(env, who.uid), days: DAYS, modes: MODES }, { headers: { 'cache-control': 'no-store' } });
  const out = body.action === 'tao' ? await createSchedule(env, who.uid, body) : await updateSchedule(env, who.uid, String(body.id || ''), body.action);
  return Response.json(out, { status: out.error ? 400 : 200 });
};
