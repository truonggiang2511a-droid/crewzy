// GET /api/autopilot → kế hoạch Chạy tự động cả cây · POST {action:'bat'|'tat'} → bật/tắt chuỗi lịch (src/lib/autopilot.js).
import { resolveUid } from '../lib/common.js';
import { connectedApps } from '../lib/connected.js';
import { listServers } from '../lib/mcpServers.js';
import { getBrand } from '../lib/brand.js';
import { listJobs } from '../lib/jobs.js';
import { doneFlows } from '../lib/workflows.js';
import { instantOn } from '../lib/instant.js';
import { getFeatures } from '../lib/billing.js';
import { planAutopilot, enableAutopilot, disableAutopilot } from '../lib/autopilot.js';

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  const uid = who.uid;
  const [accounts, servers, brand, jobs, feat] = await Promise.all([connectedApps(env, uid), listServers(env, uid).catch(() => []),
    getBrand(env, uid).catch(() => null), listJobs(env, uid).catch(() => []), getFeatures(env, uid).catch(() => null)]);
  const rctx = { connected: Object.keys(accounts || {}), mcpUrls: servers.filter((s) => !s.off).map((s) => s.url), brand: brand || {}, done: doneFlows(jobs), instant: instantOn(env) && !!env.ANTHROPIC_API_KEY };
  if (req.method === 'GET') return Response.json(await planAutopilot(env, uid, rctx, feat), { headers: { 'cache-control': 'no-store' } });
  if (body.action === 'tat') return Response.json(await disableAutopilot(env, uid));
  if (body.action !== 'bat') return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  if (feat && !feat.lich) return Response.json({ error: 'Gói hiện tại chưa có hẹn giờ tự chạy. Nâng lên gói Cơ bản trở lên ở trang Gói và credit.' }, { status: 400 });
  const out = await enableAutopilot(env, uid, rctx, feat);
  return Response.json(out, { status: out.error ? 400 : 200 });
};
