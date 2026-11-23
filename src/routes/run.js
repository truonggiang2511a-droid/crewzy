// /api/run — nút ▶ Run trên Cây vận hành chạy THẬT ngay, không qua chat (src/lib/runner.js).
// GET → trạng thái lượt Run gần nhất (từng bước + trạng thái phiếu thật).
// POST {action:'start', nv?: [mã nhiệm vụ], lap?: true} → tạo phiếu cho các bước sẵn sàng (lap = bật luôn tự chạy mỗi ngày).
// POST {action:'step'} → NDJSON: {type:'step'} → {type:'tool', label}… → {type:'step_done'} → {type:'view'}; hết bước → {type:'end'}.
// POST {action:'dung'} → dừng: bước đang làm dừng ở công cụ kế tiếp, bước chưa làm được đóng lại.
import { resolveUid } from '../lib/common.js';
import { gate, prices } from '../lib/billing.js';
import { planFor } from './autopilot.js';
import { enableAutopilot } from '../lib/autopilot.js';
import { syncTriggers } from '../lib/events.js';
import { missionById } from '../lib/missions.js';
import { startRun, claimNext, runView, stopRun, runJobAuto, stopWatcher, getRun, releaseClaim } from '../lib/runner.js';
import { runAgent, takeAppQuota } from './chat.js';

const encoder = new TextEncoder();
const json = (d, status = 200) => Response.json(d, { status, headers: { 'cache-control': 'no-store' } });

export default async (req, env) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return json({ error: 'Dữ liệu không hợp lệ.' }, 400); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  const uid = who.uid;
  const origin = env.PUBLIC_ORIGIN || url.origin;
  if (req.method === 'GET') return json({ run: await runView(env, uid) });

  if (body.action === 'dung') { await stopRun(env, uid); return json({ ok: true, run: await runView(env, uid) }); }

  if (body.action === 'start') {
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'Máy chủ chưa bật Trợ lý Crewzy (credit). Dùng "Chạy bằng AI của bạn" trên thẻ nhiệm vụ.' }, 400);
    const { plan, rctx, feat } = await planFor(env, uid);
    if (feat && !feat.tro_ly) return json({ error: 'Gói hiện tại chưa có Trợ lý Crewzy tự làm. Dùng "Chạy bằng AI của bạn" hoặc nâng gói.' }, 400);
    const blocked = await gate(env, uid, { email: who.session && who.session.email, needCredits: prices(env).min_start }).catch(() => null);
    if (blocked) return json({ error: blocked.error, can: blocked.can }, 400);
    const nv = [].concat(body.nv || []).filter((x) => missionById(x));
    const out = await startRun(env, uid, plan, nv.length ? nv : null);
    if (out.error) return json({ ...out, plan }, 400);
    // Run cả cây: bật luôn chạy mỗi ngày đúng giờ (nếu gói có lịch) + sự kiện tức thì.
    let lap = null;
    if (body.lap && feat && feat.lich && !plan.bat) {
      const en = await enableAutopilot(env, uid, rctx, feat, nv.length ? nv : null).catch((e) => ({ error: e && e.message }));
      lap = en.error ? { loi: en.error } : { bat: (en.bat || []).length };
      if (!en.error) await syncTriggers(env, uid, rctx.connected, true, origin).catch(() => {});
    }
    return json({ ok: true, run: out.run, lap });
  }

  if (body.action !== 'step') return json({ error: 'Thao tác không hợp lệ.' }, 400);
  const c = await claimNext(env, uid);
  if (!c.step) return json({ het: !!c.het, busy: c.busy ? { job: c.busy.job, ten: c.busy.ten } : null, run: await runView(env, uid) });
  const run = await getRun(env, uid);
  const w = stopWatcher(env, uid, run && run.id);
  const stream = new ReadableStream({
    // Trang đóng giữa chừng: KHÔNG dừng AI (để bước làm xong nếu máy chủ còn chạy); nếu bị cắt, cron làm lại sau 6 phút.
    async start(controller) {
      let open = true;
      const emit = (e) => { if (!open) return; try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')); } catch (err) { open = false; } };
      const s = c.step;
      emit({ type: 'step', i: c.i, n: c.n, job: s.job, ten: s.ten, buoc: s.buoc, phong: s.phong, nv: s.nv, lai: c.lai });
      try {
        const r = await runJobAuto(env, { uid, origin, job: { id: s.job, tieu_de: '▶ ' + s.ten }, prompt: s.prompt, stop: w.stop, who: 'Trợ lý Crewzy (Run)',
          emit: (e) => { if (e.type === 'tool') emit({ type: 'tool', label: e.label }); else if (e.type === 'image' || e.type === 'video') emit(e); }, deps: { runAgent, takeAppQuota } });
        // Hết hạn gói / hết credit: dừng cả dây chuyền, không chạy tiếp các bước sau cho tốn công.
        if (r && r.error) { emit({ type: 'loi', message: r.error, dung: true }); await stopRun(env, uid); }
      } catch (err) {
        console.error('run step failed', uid, s.job, err && err.message);
        emit({ type: 'loi', message: 'AI gặp lỗi ở bước này, Crewzy sẽ thử lại.' });
        await releaseClaim(env, uid, s.job).catch(() => {});
      } finally { w.done(); }
      const view = await runView(env, uid);
      const done = view && view.steps.find((x) => x.job === s.job);
      emit({ type: 'step_done', i: c.i, job: s.job, ten: s.ten, phong: s.phong, trang_thai: done ? done.trang_thai : '', tom_tat: done ? done.tom_tat : '' });
      emit({ type: 'view', run: view });
      open = false;
      try { controller.close(); } catch (e) {}
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
};
