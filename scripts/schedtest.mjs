// Thử hẹn giờ quy trình với KV giả: tới giờ thì tạo phiếu việc, chế độ crewzy thì gọi runAuto, không chạy lặp trong ngày.
import assert from 'node:assert/strict';
import { createSchedule, runDueSchedules, isDue, vnNow } from '../src/lib/schedules.js';
import { listJobs } from '../src/lib/jobs.js';
const store = new Map();
const env = { KV: { get: async (k, o) => { const v = store.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
const uid = 'test-sched-0001';
assert.ok((await createSchedule(env, uid, { quy_trinh: 'khong_co', gio: '08:00', ngay: 'hang_ngay' })).error);
assert.ok((await createSchedule(env, uid, { quy_trinh: 'bao_cao_tuan', gio: '25:00', ngay: 'hang_ngay' })).error);
const a = await createSchedule(env, uid, { quy_trinh: 'ban_tin_sang', gio: '07:00', ngay: 'hang_ngay', che_do: 'crewzy' });
await createSchedule(env, uid, { quy_trinh: 'bao_cao_tuan', gio: '07:00', ngay: 't2', che_do: 'ai_cua_toi' });
assert.ok(a.schedule.id);
// 07:10 giờ VN, thứ Hai 23/11/2026 = 00:10 UTC
const mon = new Date('2026-11-23T00:10:00Z');
assert.equal(vnNow(mon).dow, 1);
const calls = [];
const r = await runDueSchedules(env, { origin: 'https://x', now: mon, runAuto: async (u, job) => { calls.push(job.id); } });
assert.equal(r.created, 2); assert.equal(r.ran, 1); assert.equal(calls.length, 1);
const jobs = await listJobs(env, uid);
assert.equal(jobs.length, 2); assert.ok(jobs.every((j) => j.trang_thai === 'cho_lam' && j.quy_trinh));
const r2 = await runDueSchedules(env, { origin: 'https://x', now: new Date('2026-11-23T00:25:00Z'), runAuto: async () => {} });
assert.equal(r2.created, 0);
assert.equal(isDue({ bat: true, gio: '07:00', ngay: 'hang_ngay', lan_cuoi: '' }, vnNow(new Date('2026-11-23T03:30:00Z'))), false); // trễ quá 2 tiếng
// Lịch mỗi giờ (chỉ chế độ crewzy), có tự trả lời
assert.ok((await createSchedule(env, 'test-sched-0002', { quy_trinh: 'tra_loi_binh_luan', gio: '08:00', den: '22:00', ngay: 'hang_ngay', lap: 'moi_gio', che_do: 'ai_cua_toi' })).error);
const h = await createSchedule(env, 'test-sched-0002', { quy_trinh: 'tra_loi_binh_luan', gio: '08:00', den: '22:00', ngay: 'hang_ngay', lap: 'moi_gio', che_do: 'crewzy', tu_dong: true });
assert.equal(h.schedule.lap, 'moi_gio'); assert.equal(h.schedule.tu_dong, true);
const prompts = [];
const run = (iso) => runDueSchedules(env, { origin: 'https://x', now: new Date(iso), runAuto: async (u, job, p) => { if (u === 'test-sched-0002') prompts.push(p); } });
await run('2026-11-23T02:05:00Z'); // 09:05 VN
await run('2026-11-23T02:20:00Z'); // 09:20 VN — cùng giờ, không chạy lại
await run('2026-11-23T03:05:00Z'); // 10:05 VN
await run('2026-11-23T16:05:00Z'); // 23:05 VN — ngoài khung giờ
assert.equal(prompts.length, 2); assert.ok(prompts[0].includes('TỰ TRẢ LỜI ĐÃ BẬT'));
console.log('schedtest OK');
