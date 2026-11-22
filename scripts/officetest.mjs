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

// Lead: lưu, gộp trùng số trong 7 ngày, kênh báo CEO theo app đã nối, chốt đơn ra doanh thu theo nguồn.
import { leadTool, listLeads, updateLead, leadStats } from '../src/lib/leads.js';
store.set('uid:u3', 'sub3'); store.set('user:sub3', JSON.stringify({ uid: 'u3', email: 'ceo@nhaxinh.vn' }));
const r1 = await leadTool(env, 'u3', { ten: 'Chị Lan', sdt: '0909 123 456', nguon: 'facebook', nhu_cau: 'Hỏi giá nhà 2 tầng', muc_do: 'nong' }, ['gmail', 'telegram', 'hubspot'], 'Trợ lý Crewzy');
assert.equal(r1.data.email_ceo, 'ceo@nhaxinh.vn');
assert.deepEqual(r1.data.kenh_bao, ['Gmail', 'Telegram']);
assert.ok(r1.data.viec_tiep[0].includes('ceo@nhaxinh.vn') && r1.data.viec_tiep[1].includes('HubSpot'));
const r2 = await leadTool(env, 'u3', { ten: 'Lan', sdt: '0909123456', nguon: 'facebook', nhu_cau: 'Muốn xem nhà thứ Bảy' }, ['gmail'], 'x');
assert.ok(r2.data.trung, 'trùng số phải gộp');
assert.equal((await listLeads(env, 'u3')).length, 1);
const r3 = await leadTool(env, 'u3', { ten: 'Anh Minh', sdt: '0911000111', nguon: 'tiktok', muc_do: 'am' }, [], 'x');
assert.ok(r3.data.ghi_chu, 'chưa nối kênh báo thì nhắc');
assert.ok((await leadTool(env, 'u3', {}, [], 'x')).error);
await updateLead(env, 'u3', r1.data.id, { trang_thai: 'da_chot', gia_tri: 1500000000 });
const st = leadStats(await listLeads(env, 'u3'));
assert.equal(st.hom_nay, 2); assert.equal(st.chot_thang, 1); assert.equal(st.doanh_thu_thang, 1500000000); assert.equal(st.theo_nguon.facebook.doanh_thu, 1500000000); assert.equal(st.can_goi, 1);
console.log('leads OK');
