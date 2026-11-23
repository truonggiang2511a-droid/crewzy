// ▶ RUN TRÊN CÂY VẬN HÀNH (23/11): bấm Run → Crewzy tạo phiếu cho từng bước của dây chuyền rồi Trợ lý Crewzy làm THẬT ngay, từng bước một,
// không qua trang chat. Trang đang mở gọi POST /api/run {action:'step'} (NDJSON) để chạy bước kế tiếp và thấy trạng thái tức thì trên cây;
// trang đóng giữa chừng thì cron 15 phút làm nốt (runPendingRuns). Trạng thái trên cây lấy từ phiếu việc thật (cho_lam → dang_lam → cho_duyet/da_dang/xong).
// KV run:<uid> = {id, luc, last, dung, steps:[{job, qt, ten, buoc, phong, nv, prompt, claim, lan}]} · runidx = khách còn bước chưa làm (cho cron).
import { kvGetJson, kvPutJson } from './common.js';
import { listJobs, createJobs, closeJobs, markWorking, submitResult } from './jobs.js';
import { workflowById, workflowPrompt } from './workflows.js';
import { missionById, prefText } from './missions.js';
import { gate, makeMeter, prices, getFeatures } from './billing.js';

const MIN = 60 * 1000;
const STALE_MS = 6 * MIN;      // bước đã nhận mà quá 6 phút chưa xong (trang đóng giữa chừng) → làm lại
const MAX_TRIES = 2;
const STEP_BUDGET_MS = 240000;
// Thứ tự dây chuyền 1 ngày: làm nội dung → đăng → trả lời khách → CRM → nhắc sale → quảng cáo → bản tin cho chủ (tổng kết cuối).
export const RUN_ORDER = ['san_xuat_5x5', 'dang_bai_da_duyet', 'tra_loi_binh_luan', 'tra_loi_tin_nhan', 'lead_vao_crm', 'nhac_cham_soc_deal', 'theo_doi_quang_cao',
  'lich_noi_dung_tuan', 'doi_thu_reels', 'de_xuat_chien_luoc', 'bao_cao_tuan', 'ban_tin_sang'];
const DAILY = ['hang_ngay', 't2_t6'];
const runKey = (uid) => 'run:' + uid;
const FINAL = ['cho_duyet', 'da_duyet', 'da_dang', 'xong', 'tu_choi'];

export const getRun = (env, uid) => kvGetJson(env, runKey(uid));

// Chọn bước: Run cả cây = bước hằng ngày đã sẵn sàng; Run 1 nhiệm vụ = mọi bước sẵn sàng của nhiệm vụ đó (kể cả bước tuần/tháng).
export function pickSteps(plan, nv) {
  const seen = new Set();
  return plan.steps
    .filter((s) => s.san_sang && (nv && nv.length ? nv.includes(s.nv) : DAILY.includes(s.ngay)))
    .filter((s) => !seen.has(s.id) && seen.add(s.id))
    .sort((a, b) => (RUN_ORDER.indexOf(a.id) + 1 || 99) - (RUN_ORDER.indexOf(b.id) + 1 || 99));
}

export function stepView(run, jobs) {
  const byId = Object.fromEntries((jobs || []).map((j) => [j.id, j]));
  const steps = (run.steps || []).map((s) => {
    const j = byId[s.job] || {};
    return { job: s.job, ten: s.ten, buoc: s.buoc, phong: s.phong, nv: s.nv, trang_thai: j.trang_thai || 'xong', tieu_de: j.tieu_de || s.ten,
      ghi_chu: (j.ket_qua && j.ket_qua.ghi_chu) || '', tom_tat: String((j.ket_qua && j.ket_qua.noi_dung) || '').replace(/\s+/g, ' ').slice(0, 160), cap_nhat: j.cap_nhat || '' };
  });
  const xong = steps.filter((s) => FINAL.includes(s.trang_thai)).length;
  return { id: run.id, luc: run.luc, dung: !!run.dung, steps, tong: steps.length, xong, cho_duyet: steps.filter((s) => s.trang_thai === 'cho_duyet').length,
    dang: steps.find((s) => s.trang_thai === 'dang_lam') || null, het: xong >= steps.length || !!run.dung };
}

export async function runView(env, uid) {
  const run = await getRun(env, uid);
  if (!run) return null;
  return stepView(run, await listJobs(env, uid));
}

function stepPrompt(w, s, pref) {
  const notes = ['BẤM RUN: chủ vừa bấm Run trên Cây vận hành, làm NGAY bước "' + s.buoc + '" (chỉ phần mới từ lần chạy trước).'];
  if (w.tu_dong) notes.push('TỰ TRẢ LỜI ĐÃ BẬT: chủ cho phép trả lời ngay câu thường theo bước của quy trình; câu nhạy cảm vẫn nộp chờ duyệt.');
  if (pref) notes.push(pref);
  return workflowPrompt(w, notes.join('\n'));
}

export async function startRun(env, uid, plan, nv) {
  const cur = await runView(env, uid);
  if (cur && !cur.het) return { error: 'Dây chuyền đang chạy (' + cur.xong + '/' + cur.tong + ' bước). Đợi xong hoặc bấm Dừng.', run: cur };
  if (!plan.brand_ok) return { error: 'Điền Brain thương hiệu trước (tên, sản phẩm, khách hàng, giọng văn) để AI làm đúng thương hiệu.', brand: true };
  const steps = pickSteps(plan, nv);
  if (!steps.length) return { error: nv && nv.length === 1 ? 'Nhiệm vụ này chưa đủ app để chạy. Nối app theo gợi ý rồi bấm lại.' : 'Chưa có bước nào đủ app để chạy. Nối thêm app theo gợi ý rồi bấm lại.' };
  const prefs = (await kvGetJson(env, 'apref:' + uid).catch(() => null)) || {};
  const id = 'r' + Date.now().toString(36);
  const items = steps.map((s) => {
    const w = workflowById(s.id);
    const pref = s.nv && missionById(s.nv) ? prefText(missionById(s.nv), prefs[s.nv]) : '';
    return { s, w, yeu_cau: stepPrompt(w, s, pref) };
  });
  const jobs = await createJobs(env, uid, items.map((x) => ({ quy_trinh: x.w.id, tieu_de: '▶ ' + x.w.ten, yeu_cau: x.yeu_cau, nguon: 'run', run: id })));
  const run = { id, luc: new Date().toISOString(), last: 0, steps: items.map((x, i) => ({ job: jobs[i].id, qt: x.w.id, ten: x.w.ten, buoc: x.s.buoc, phong: x.w.phong, nv: x.s.nv, claim: 0, lan: 0,
    prompt: `Làm phiếu việc ${jobs[i].id}. ${x.yeu_cau}\nNộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ${jobs[i].id}. Không hỏi lại người dùng: thiếu thông tin thì ghi rõ trong ghi_chu.` })) };
  await kvPutJson(env, runKey(uid), run);
  const idx = (await kvGetJson(env, 'runidx')) || [];
  if (!idx.includes(uid)) { idx.push(uid); await kvPutJson(env, 'runidx', idx); }
  return { run: stepView(run, jobs) };
}

// Nhận bước kế tiếp (lần lượt từng bước). Bước khác đang làm dở (chưa quá hạn) → trả busy để tab thứ 2 chỉ theo dõi.
export async function claimNext(env, uid, now = Date.now()) {
  const run = await getRun(env, uid);
  if (!run || run.dung) return { het: true };
  const jobs = await listJobs(env, uid);
  const st = (s) => (jobs.find((j) => j.id === s.job) || {}).trang_thai || 'xong';
  for (const s of run.steps) {
    const t = st(s);
    if (FINAL.includes(t)) continue;
    const fresh = s.claim && now - s.claim < STALE_MS;
    if (fresh) return { busy: s };
    if (s.lan >= MAX_TRIES) { await closeJobs(env, uid, [s.job], 'Chưa làm xong sau ' + MAX_TRIES + ' lần thử, bỏ qua bước này.'); continue; }
    s.claim = now; s.lan++; run.last = now;
    await kvPutJson(env, runKey(uid), run);
    return { step: s, i: run.steps.indexOf(s), n: run.steps.length, lai: s.lan > 1 || t === 'dang_lam' };
  }
  await dropIdx(env, uid);
  return { het: true };
}

// Bước lỗi giữa chừng → nhả để lượt sau làm lại ngay (vẫn tính số lần thử).
export async function releaseClaim(env, uid, job) {
  const run = await getRun(env, uid);
  const s = run && run.steps.find((x) => x.job === job);
  if (s && s.claim) { s.claim = 0; await kvPutJson(env, runKey(uid), run); }
}

async function dropIdx(env, uid) {
  const idx = (await kvGetJson(env, 'runidx')) || [];
  if (idx.includes(uid)) await kvPutJson(env, 'runidx', idx.filter((x) => x !== uid));
}

export async function stopRun(env, uid) {
  const run = await getRun(env, uid);
  if (!run) return { ok: true };
  run.dung = true;
  await kvPutJson(env, runKey(uid), run);
  const jobs = await listJobs(env, uid);
  const open = run.steps.filter((s) => { const j = jobs.find((x) => x.id === s.job); return j && j.trang_thai === 'cho_lam'; }).map((s) => s.job);
  await closeJobs(env, uid, open, 'Chủ bấm Dừng dây chuyền, bước này chưa làm.');
  await dropIdx(env, uid);
  return { ok: true };
}

// Chạy 1 phiếu bằng Trợ lý Crewzy (dùng chung cho Run, hẹn giờ, sự kiện): kiểm gói/credit, đo credit, nhận việc, chạy AI.
// deps.runAgent/takeAppQuota truyền từ worker để tránh vòng phụ thuộc với routes/chat.js.
export async function runJobAuto(env, { uid, origin, job, prompt, emit = () => {}, stop, who = 'Trợ lý Crewzy (hẹn giờ)', deps }) {
  const fail = async (msg) => { await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: 'Chưa chạy tự động: ' + msg, trang_thai: 'xong', nguoi_lam: who }); return { error: msg }; };
  if (!env.ANTHROPIC_API_KEY) return fail('máy chủ chưa bật credit của Crewzy. Hãy giao cho AI của bạn hoặc bấm Làm ngay bằng Trợ lý Crewzy.');
  const blocked = await gate(env, uid, { needCredits: prices(env).min_start }).catch(() => null);
  if (blocked) return fail(blocked.error);
  const meter = await makeMeter(env, uid).catch(() => null);
  const over = meter ? null : await deps.takeAppQuota(env, uid).catch(() => null);
  if (over) return fail(over);
  if (job.id) await markWorking(env, uid, job.id, who).catch(() => {});
  const featB = await getFeatures(env, uid).catch(() => null);
  // Bộ não theo gói; riêng đăng bài hẹn giờ (máy móc) luôn Haiku cho rẻ.
  const brain = /ĐĂNG THEO GIỜ HẸN/.test(prompt) ? 'tiet_kiem' : (featB && featB.ai) || 'can_bang';
  const texts = [];
  await deps.runAgent({ env, uid, origin, mode: 'app', brain, messages: [{ role: 'user', content: prompt }],
    emit: (e) => { if (e.type === 'text') texts.push(e.text); emit(e); }, timeBudgetMs: STEP_BUDGET_MS, meter, ...(stop ? { stop } : {}) });
  // AI quên nộp phiếu → đóng phiếu bằng lời AI viết để cây không kẹt "Đang làm".
  const j = (await listJobs(env, uid)).find((x) => x.id === job.id);
  if (j && ['cho_lam', 'dang_lam'].includes(j.trang_thai) && stop && stop.stopped) await closeJobs(env, uid, [job.id], 'Chủ bấm Dừng, AI dừng giữa chừng. ' + texts.join(' ').slice(0, 200));
  else if (j && ['cho_lam', 'dang_lam'].includes(j.trang_thai)) {
    await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: texts.join('\n').slice(0, 6000) || 'AI đã chạy nhưng không nộp kết quả.', trang_thai: 'cho_duyet', nguoi_lam: who });
  }
  return { text: texts.join(' ').slice(0, 300) };
}

// Cờ Dừng đọc từ KV mỗi 8 giây (vòng AI kiểm stop.stopped trước mỗi bước/công cụ).
export function stopWatcher(env, uid, runId) {
  let flag = false;
  const t = setInterval(() => { getRun(env, uid).then((r) => { if (!r || r.id !== runId || r.dung) flag = true; }).catch(() => {}); }, 8000);
  return { stop: { get stopped() { return flag; }, set stopped(v) { flag = !!v; } }, done: () => clearInterval(t) };
}

// Cron: trang đã đóng (không ai nhận bước quá 6 phút) → làm nốt tối đa 1 bước/khách/lượt.
export async function runPendingRuns(env, { origin, deps, now = Date.now(), maxRuns = 2 }) {
  const idx = (await kvGetJson(env, 'runidx')) || [];
  let ran = 0;
  for (const uid of idx) {
    if (ran >= maxRuns) break;
    const run = await getRun(env, uid);
    if (!run || run.dung) { await dropIdx(env, uid); continue; }
    if (now - Math.max(run.last || 0, Date.parse(run.luc) || 0) < STALE_MS) continue; // trang đang chạy
    const c = await claimNext(env, uid, now);
    if (!c.step) continue;
    const w = stopWatcher(env, uid, run.id);
    try { await runJobAuto(env, { uid, origin, job: { id: c.step.job, tieu_de: '▶ ' + c.step.ten }, prompt: c.step.prompt, stop: w.stop, who: 'Trợ lý Crewzy (Run)', deps }); ran++; }
    catch (e) { console.error('run pending failed', uid, e && e.message); }
    finally { w.done(); }
  }
  return { ran };
}
