// Thử màn Kết quả + báo cáo tuần: ghi việc theo tên công cụ, tổng hợp tháng, giờ tiết kiệm, /api/results, cron thứ Hai (1 lần/tuần).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { recordActivity, buildResults, runWeeklyReports, vnDay, classify } from '../src/lib/activity.js';
import resultsRoute from '../src/routes/results.js';
import { signSession, sessionCookie } from '../src/lib/common.js';
import { submitResult, listJobs } from '../src/lib/jobs.js';
import { plans } from '../src/lib/billing.js';

const db = new DatabaseSync(':memory:');
for (const f of ['0001_billing.sql', '0002_activity.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const run = (sql, p) => { const r = db.prepare(sql).run(...p); return { meta: { changes: Number(r.changes) } }; };
const DB = {
  prepare(sql) { let p = []; const s = { bind(...a) { p = a.map((v) => (v === undefined ? null : v)); return s; }, async run() { return run(sql, p); },
    async first() { return db.prepare(sql).get(...p) ?? null; }, async all() { return { results: db.prepare(sql).all(...p) }; }, _exec: () => run(sql, p) }; return s; },
  async batch(st) { db.exec('BEGIN'); try { const o = st.map((s) => s._exec()); db.exec('COMMIT'); return o; } catch (e) { db.exec('ROLLBACK'); throw e; } },
};
const store = new Map();
const KV = { async get(k, o) { const v = store.get(k); if (v == null) return null; return (o === 'json' || (o && o.type === 'json')) ? JSON.parse(v) : v; }, async put(k, v) { store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }, async delete(k) { store.delete(k); } };
globalThis.fetch = async () => new Response('offline', { status: 503 });
const env = { DB, KV, COMPOSIO_API_KEY: 'ak_test', SESSION_SECRET: 's' };
const UID = 'khach-kq-0001';

assert.equal(classify('FACEBOOK_CREATE_POST'), 'dang_bai');
assert.equal(classify('COMPOSIO_SEARCH_TOOLS'), null);
await recordActivity(env, UID, 'FACEBOOK_CREATE_POST', {});
await recordActivity(env, UID, 'COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{ tool_slug: 'INSTAGRAM_PUBLISH_MEDIA' }, { tool_slug: 'FACEBOOK_REPLY_TO_COMMENT' }, { tool_slug: 'FACEBOOK_REPLY_TO_COMMENT' }] });
await recordActivity(env, UID, 'CREWZY_TAO_ANH', {});
await recordActivity(env, UID, 'CREWZY_BRAIN', {});
await submitResult(env, UID, 'https://crewzy.test', { tieu_de: '7 bài tuần', noi_dung: 'abc', loai: 'bai_dang', nguoi_lam: 'Claude' });
await submitResult(env, UID, 'https://crewzy.test', { tieu_de: 'Báo cáo tự động', noi_dung: 'x', loai: 'bao_cao', trang_thai: 'xong', nguoi_lam: 'Crewzy' });
const day = vnDay();
const r = await buildResults(env, UID, { from: day.slice(0, 7) + '-01', to: day, jobs: await listJobs(env, UID), plan: { gia: 149000 } });
assert.deepEqual(r.viec, { dang_bai: 2, tra_loi: 2, anh: 1 });
assert.equal(r.ket_qua.tong, 1, 'phiếu do Crewzy tự tạo không tính là việc AI làm');
// 2×20 + 2×3 + 15 + 1×20 = 81 phút = 1,4 giờ (làm tròn 0,1) → 70.000đ
assert.equal(r.gio_tiet_kiem, 1.4);
assert.equal(r.tien_tiet_kiem, 70000);
assert.equal(r.series.length, 1);

const cookie = sessionCookie(await signSession(env, { uid: UID, email: 'k@x.vn', exp: Date.now() + 86400000 }), 86400).split(';')[0];
const res = await resultsRoute(new Request('https://crewzy.test/api/results', { headers: { cookie } }), env);
const j = await res.json();
assert.equal(res.status, 200);
assert.equal(j.viec.dang_bai, 2);

// Báo cáo tuần: chỉ chạy thứ Hai ≥ 8 giờ VN, 1 lần. Giả lập bằng cách đặt giờ.
const realNow = Date.now;
const monday9 = Date.parse('2026-11-23T09:00:00+07:00');
db.prepare("UPDATE activity SET day = '2026-11-20', month = '2026-11'").run();
Date.now = () => monday9;
const w1 = await runWeeklyReports(env, { origin: 'https://crewzy.test', submitResult, listJobs, plans: plans(env) });
const w2 = await runWeeklyReports(env, { origin: 'https://crewzy.test', submitResult, listJobs, plans: plans(env) });
Date.now = () => Date.parse('2026-11-24T09:00:00+07:00');
const w3 = await runWeeklyReports(env, { origin: 'https://crewzy.test', submitResult, listJobs, plans: plans(env) });
Date.now = realNow;
assert.equal(w1.sent, 1);
assert.equal(w2.skip, 'done');
assert.equal(w3.skip, 'not monday 8h');
const rep = (await listJobs(env, UID)).find((x) => /Báo cáo tuần Crewzy/.test(x.tieu_de));
assert.ok(rep && /Bài đã đăng: 2/.test(rep.ket_qua.noi_dung), 'phiếu báo cáo tuần có số bài');
console.log('resultstest OK', JSON.stringify(r.viec), r.gio_tiet_kiem + ' giờ');
