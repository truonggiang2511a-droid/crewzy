// Kiểm Cây vận hành: mọi nhánh có trong DEPARTMENTS, mọi app của nhánh có trong catalog, quy trình chuyển nhánh đúng.
import assert from 'node:assert/strict';
import { BRANCH_APPS } from '../src/routes/office.js';
import { DEPARTMENTS, WORKFLOWS } from '../src/lib/workflows.js';
import { appBySlug } from '../src/lib/catalog.js';
const ids = DEPARTMENTS.map((d) => d.id);
for (const [k, list] of Object.entries(BRANCH_APPS)) {
  assert.ok(ids.includes(k), 'nhánh lạ ' + k);
  for (const [slug, vai] of list) { assert.ok(appBySlug(slug), 'app không có trong catalog: ' + slug); assert.ok(vai); }
}
for (const id of ids) assert.ok(BRANCH_APPS[id], 'nhánh thiếu app: ' + id);
for (const w of WORKFLOWS) assert.ok(ids.includes(w.phong), w.id);
assert.equal(WORKFLOWS.find((w) => w.id === 'dang_bai_da_duyet').phong, 'phan_phoi');
assert.equal(WORKFLOWS.find((w) => w.id === 'de_xuat_chien_luoc').phong, 'chien_luoc');
console.log('officetest OK', ids.length, 'nhánh');

// Chạy tự động cả cây: bật đúng bước sẵn sàng, theo số lịch của gói, tắt thì xoá đúng lịch của cây.
import { planAutopilot, enableAutopilot, disableAutopilot, CHAIN } from '../src/lib/autopilot.js';
import { listSchedules, createSchedule } from '../src/lib/schedules.js';
const store = new Map();
const env = { KV: { get: async (k, o) => (store.has(k) ? (o && o.type === 'json' ? JSON.parse(store.get(k)) : store.get(k)) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
const brand = { name: 'Nhà Xinh', products: 'Nhà phố', customers: 'Gia đình trẻ', voice: 'Thân thiện' };
const rctx = { connected: ['facebook', 'instagram', 'hubspot', 'gmail', 'googlesheets', 'telegram', 'metaads'], mcpUrls: [], brand, done: new Set(), instant: false };
const noBrand = await enableAutopilot(env, 'u1', { ...rctx, brand: {} }, null);
assert.ok(noBrand.error && noBrand.brand, 'thiếu Brain phải chặn');
await createSchedule(env, 'u1', { quy_trinh: 'bao_cao_tuan', gio: '06:00', ngay: 't2', che_do: 'crewzy' }, null); // lịch riêng của khách
const feat = { lich: 5, tro_ly: true, tu_tra_loi: false };
const plan = await planAutopilot(env, 'u1', rctx, feat);
assert.equal(plan.steps.length, CHAIN.length);
assert.ok(plan.steps.filter((x) => x.se_bat).length <= 4, 'gói 5 lịch, khách đã dùng 1');
const on = await enableAutopilot(env, 'u1', rctx, feat);
assert.ok(on.ok, JSON.stringify(on.loi));
let list = await listSchedules(env, 'u1');
assert.ok(list.length <= 5);
assert.ok(list.filter((s) => s.nguon === 'cay').every((s) => !s.lap), 'gói chưa có tự trả lời thì không chạy mỗi giờ');
assert.ok(list.some((s) => s.nguon === 'cay' && s.quy_trinh === 'lead_vao_crm'), 'ưu tiên khách vào CRM');
await disableAutopilot(env, 'u1');
list = await listSchedules(env, 'u1');
assert.equal(list.length, 1, 'tắt chỉ xoá lịch của cây, giữ lịch riêng');
const full = await enableAutopilot(env, 'u2', rctx, { lich: 10, tro_ly: true, tu_tra_loi: true });
const l2 = await listSchedules(env, 'u2');
assert.ok(l2.some((s) => s.quy_trinh === 'tra_loi_binh_luan' && s.lap === 'moi_gio'), 'gói đủ tính năng: trả lời mỗi giờ');
console.log('autopilot OK', full.bat.length, 'bước bật');
