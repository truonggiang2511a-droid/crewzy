// ▶ Run chạy thật trên cây (23/11): node scripts/runtest.mjs — KV giả, AI giả.
import assert from 'node:assert/strict';
import { startRun, claimNext, runView, stopRun, runJobAuto, runPendingRuns, pickSteps, getRun } from '../src/lib/runner.js';
import { listJobs, submitResult, markWorking } from '../src/lib/jobs.js';

const mem = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, v); }, delete: async (k) => mem.delete(k) };
const env = { KV, ANTHROPIC_API_KEY: 'x' };
const O = 'https://x.dev';
const plan = { brand_ok: true, steps: [
  { id: 'ban_tin_sang', nv: 'bao_cao_ceo', ngay: 'hang_ngay', buoc: 'Bản tin sáng', san_sang: true },
  { id: 'tra_loi_binh_luan', nv: 'cham_soc_mxh', ngay: 'hang_ngay', buoc: 'Trả lời bình luận', san_sang: true },
  { id: 'san_xuat_5x5', nv: 'san_xuat', ngay: 'hang_ngay', buoc: '5 ảnh + 5 video', san_sang: true },
  { id: 'lich_noi_dung_tuan', nv: 'san_xuat', ngay: 't2', buoc: 'Lịch tuần', san_sang: true },
  { id: 'theo_doi_quang_cao', nv: 'quang_cao', ngay: 'hang_ngay', buoc: 'Quảng cáo', san_sang: false },
] };
assert.deepEqual(pickSteps(plan).map((s) => s.id), ['san_xuat_5x5', 'tra_loi_binh_luan', 'ban_tin_sang'], 'Run cả cây: bước hằng ngày đã sẵn sàng, theo thứ tự dây chuyền, bản tin cuối');
assert.deepEqual(pickSteps(plan, ['san_xuat']).map((s) => s.id), ['san_xuat_5x5', 'lich_noi_dung_tuan'], 'Run 1 nhiệm vụ: cả bước tuần');
assert.ok((await startRun(env, 'u1', { ...plan, brand_ok: false })).brand);

let r = await startRun(env, 'u1', plan);
assert.equal(r.run.tong, 3);
assert.equal((await listJobs(env, 'u1')).filter((j) => j.nguon === 'run' && j.trang_thai === 'cho_lam').length, 3, 'tạo 3 phiếu thật');
assert.ok((await startRun(env, 'u1', plan)).error, 'đang chạy thì không chạy chồng');

// AI giả: bước 1 nộp chờ duyệt, bước 2 quên nộp, bước 3 nộp xong.
const tools = [];
let n = 0;
const deps = { takeAppQuota: async () => null, runAgent: async ({ uid, messages, emit }) => {
  n++; const id = /phiếu việc (v[0-9a-f]+)/.exec(messages[0].content)[1];
  assert.ok(messages[0].content.includes('BẤM RUN'));
  emit({ type: 'tool', label: 'Đọc bình luận Facebook' }); tools.push(id);
  if (n === 1) await submitResult(env, uid, O, { id, tieu_de: '5 bài', noi_dung: 'ok', trang_thai: 'cho_duyet' });
  if (n === 2) emit({ type: 'text', text: 'Đã trả lời 3 bình luận.' });
  if (n === 3) await submitResult(env, uid, O, { id, tieu_de: 'Bản tin', noi_dung: 'xong', trang_thai: 'xong' });
} };
const t0 = Date.now();
let c = await claimNext(env, 'u1', t0);
assert.equal(c.i, 0);
assert.ok((await claimNext(env, 'u1', t0 + 1000)).busy, 'bước đang làm → tab khác chỉ theo dõi');
const ev = [];
await runJobAuto(env, { uid: 'u1', origin: O, job: { id: c.step.job }, prompt: c.step.prompt, emit: (e) => ev.push(e), deps });
assert.ok(ev.some((e) => e.type === 'tool'));
let v = await runView(env, 'u1');
assert.equal(v.steps[0].trang_thai, 'cho_duyet'); assert.equal(v.xong, 1);
c = await claimNext(env, 'u1', t0 + 2000);
await runJobAuto(env, { uid: 'u1', origin: O, job: { id: c.step.job }, prompt: c.step.prompt, deps });
v = await runView(env, 'u1');
assert.equal(v.steps[1].trang_thai, 'cho_duyet', 'AI quên nộp → Crewzy tự đóng phiếu bằng lời AI, cây không kẹt Đang làm');
assert.ok(v.steps[1].tom_tat.includes('3 bình luận'));

// Trang đóng giữa chừng: bước 3 nhận rồi bỏ dở → cron làm lại sau 6 phút.
c = await claimNext(env, 'u1', t0 + 3000);
assert.equal(c.i, 2);
let cr = await runPendingRuns(env, { origin: O, deps, now: t0 + 4000 });
assert.equal(cr.ran, 0, 'trang còn đang chạy thì cron không chen');
cr = await runPendingRuns(env, { origin: O, deps, now: t0 + 7 * 60000 });
assert.equal(cr.ran, 1);
v = await runView(env, 'u1');
assert.equal(v.het, true); assert.equal(v.cho_duyet, 2);
assert.ok((await claimNext(env, 'u1', t0 + 8 * 60000)).het);
assert.deepEqual(JSON.parse(mem.get('runidx')), [], 'xong thì bỏ khỏi hàng cron');

// Dừng: bước chưa làm đóng lại, không chạy tiếp.
await startRun(env, 'u2', plan);
c = await claimNext(env, 'u2', t0);
await markWorking(env, 'u2', c.step.job, 'Trợ lý');
await stopRun(env, 'u2');
v = await runView(env, 'u2');
assert.equal(v.dung, true); assert.equal(v.het, true);
assert.equal(v.steps.filter((s) => s.trang_thai === 'xong').length, 2, '2 bước chưa làm được đóng');
assert.ok((await claimNext(env, 'u2', t0 + 1000)).het);
const stopped = { stopped: true };
await runJobAuto(env, { uid: 'u2', origin: O, job: { id: c.step.job }, prompt: c.step.prompt, stop: stopped, deps: { takeAppQuota: async () => null, runAgent: async () => {} } });
assert.equal((await runView(env, 'u2')).steps[0].trang_thai, 'xong', 'bước đang làm dừng → đóng, không treo Đang làm');
assert.ok((await getRun(env, 'u2')).dung);
console.log('runtest OK');
