// GET /api/autopilot → kế hoạch + 6 nhiệm vụ (nhiem_vu) · POST {action:'bat'|'tat', nv?: <mã nhiệm vụ>|'all'} → bật/tắt chuỗi lịch (src/lib/autopilot.js).
import { resolveUid } from '../lib/common.js';
import { connectedApps } from '../lib/connected.js';
import { listServers } from '../lib/mcpServers.js';
import { getBrand } from '../lib/brand.js';
import { listJobs } from '../lib/jobs.js';
import { doneFlows } from '../lib/workflows.js';
import { instantOn } from '../lib/instant.js';
import { getFeatures } from '../lib/billing.js';
import { planAutopilot, enableAutopilot, disableAutopilot } from '../lib/autopilot.js';
import { syncTriggers, listTriggers, TRIGGERS, getFormCfg, parseFormInput } from '../lib/events.js';
import { kvPutJson } from '../lib/common.js';
import { MISSIONS, missionById, slotStatus, REPORT_APPS, cleanChon } from '../lib/missions.js';
import { appBySlug } from '../lib/catalog.js';
import { kvGetJson } from '../lib/common.js';

// 6 nhiệm vụ cho giao diện: ô app (đã nối / gợi ý), giờ chạy, sẵn sàng, đang chạy, lý do chưa chạy.
function missionView(plan, rctx, prefs = {}) {
  return MISSIONS.map((m) => {
    const st = plan.steps.filter((x) => x.nv === m.id);
    const sum = plan.missions.find((x) => x.id === m.id) || {};
    const slots = m.slots.map((sl) => slotStatus(sl, rctx.connected, rctx.mcpUrls));
    const ly_do = !sum.san_sang ? (st.find((x) => x.ly_do) || {}).ly_do || 'Chưa đủ app' : '';
    return { chon: prefs[m.id] || {}, id: m.id, ten: m.ten, mo_ta: m.mo_ta, mau: m.mau, icon: m.icon, cat: m.cat, slots, dang_chay: !!sum.dang_chay, san_sang: !!sum.san_sang, ly_do,
      lich: st.map((x) => ({ id: x.id, ten: x.ten, gio: x.gio, den: x.den, lap: x.lap, ngay: x.ngay, buoc: x.buoc, san_sang: x.san_sang, dang_chay: x.dang_chay, ly_do: x.ly_do })) };
  });
}

// Dùng chung cho /api/run: app đã nối + Brain + phiếu → kế hoạch dây chuyền của khách.
export async function planFor(env, uid) {
  const [accounts, servers, brand, jobs, feat] = await Promise.all([connectedApps(env, uid), listServers(env, uid).catch(() => []),
    getBrand(env, uid).catch(() => null), listJobs(env, uid).catch(() => []), getFeatures(env, uid).catch(() => null)]);
  const rctx = { connected: Object.keys(accounts || {}), mcpUrls: servers.filter((s) => !s.off).map((s) => s.url), brand: brand || {}, done: doneFlows(jobs), instant: instantOn(env) && !!env.ANTHROPIC_API_KEY };
  return { plan: await planAutopilot(env, uid, rctx, feat), rctx, feat, accounts };
}

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
  const prefs = (await kvGetJson(env, 'apref:' + uid).catch(() => null)) || {};
  const baoCao = REPORT_APPS.filter((x) => rctx.connected.includes(x)).map((x) => ({ slug: x, name: (appBySlug(x) || { name: x }).name }));
  const origin = env.PUBLIC_ORIGIN || url.origin;
  const suKien = async () => { const [t, f] = await Promise.all([listTriggers(env, uid), getFormCfg(env, uid)]); return Object.keys(TRIGGERS).map((k) => ({ app: k, ten: TRIGGERS[k].ten, da_noi: rctx.connected.includes(k), bat: !!t[k], form: !!TRIGGERS[k].form, gia_tri: k === 'typeform' ? f.typeform || '' : k === 'googlesheets' ? f.sheet || '' : undefined, ten_sheet: k === 'googlesheets' ? f.sheet_name || '' : undefined })); };
  if (req.method === 'GET') { const plan = await planAutopilot(env, uid, rctx, feat); return Response.json({ ...plan, nhiem_vu: missionView(plan, rctx, prefs), bao_cao_ung_vien: baoCao, lich_goi: feat ? feat.lich : null, su_kien: await suKien() }, { headers: { 'cache-control': 'no-store' } }); }
  const nv = body.nv && body.nv !== 'all' ? [].concat(body.nv).filter((x) => missionById(x)) : null;
  if (body.nv && body.nv !== 'all' && !(nv && nv.length)) return Response.json({ error: 'Không có nhiệm vụ này.' }, { status: 400 });
  if (body.action === 'form') {
    const f = await getFormCfg(env, uid);
    if (body.typeform != null) { const v = parseFormInput('typeform', body.typeform); if (body.typeform && !v) return Response.json({ error: 'Link Typeform chưa đúng (dạng form.typeform.com/to/<mã>).' }, { status: 400 }); f.typeform = v; }
    if (body.sheet != null) { const v = parseFormInput('googlesheets', body.sheet); if (body.sheet && !v) return Response.json({ error: 'Link Google Sheet chưa đúng (dạng docs.google.com/spreadsheets/d/<mã>).' }, { status: 400 }); f.sheet = v; f.sheet_name = String(body.sheet_name || '').trim().slice(0, 80); }
    await kvPutJson(env, 'formcfg:' + uid, f);
    const plan = await planAutopilot(env, uid, rctx, feat);
    let loi = [];
    if (plan.bat) { const t = await syncTriggers(env, uid, rctx.connected, true, origin).catch((e) => ({ loi: [e && e.message] })); loi = t.loi || []; }
    return Response.json({ ok: !loi.length, loi, su_kien: await suKien(), ghi_chu: plan.bat ? undefined : 'Đã lưu. Bấm Bật chạy tự động để bắt đầu nhận khách từ form.' });
  }
  if (body.action === 'chon') {
    const m = nv && nv.length === 1 ? missionById(nv[0]) : null;
    if (!m) return Response.json({ error: 'Chọn 1 nhiệm vụ.' }, { status: 400 });
    prefs[m.id] = cleanChon(m, body.chon);
    await kvPutJson(env, 'apref:' + uid, prefs);
    const plan = await planAutopilot(env, uid, rctx, feat);
    return Response.json({ ok: true, chon: prefs[m.id], nhiem_vu: missionView(plan, rctx, prefs), bao_cao_ung_vien: baoCao });
  }
  if (body.action === 'tat') {
    await disableAutopilot(env, uid, nv);
    const plan = await planAutopilot(env, uid, rctx, feat);
    if (!plan.bat) await syncTriggers(env, uid, rctx.connected, false, origin).catch(() => {});
    return Response.json({ ok: true, nhiem_vu: missionView(plan, rctx, prefs), bat: plan.bat });
  }
  if (body.action !== 'bat') return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  if (feat && !feat.lich) return Response.json({ error: 'Gói hiện tại chưa có hẹn giờ tự chạy. Nâng lên gói Cơ bản trở lên ở trang Gói và credit.' }, { status: 400 });
  const out = await enableAutopilot(env, uid, rctx, feat, nv);
  if (!out.error) {
    const t = await syncTriggers(env, uid, rctx.connected, true, origin).catch((e) => ({ loi: [e && e.message] }));
    if (t.loi && t.loi.length) out.loi = [...(out.loi || []), ...t.loi.map((x) => 'Sự kiện tức thì: ' + x)];
    out.su_kien = await suKien();
  }
  if (out.plan) out.nhiem_vu = missionView(out.plan, rctx);
  return Response.json(out, { status: out.error ? 400 : 200 });
};
