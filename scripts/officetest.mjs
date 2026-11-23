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
const env = { KV: { get: async (k, o) => (store.has(k) ? (o && o.type === 'json' ? JSON.parse(store.get(k)) : store.get(k)) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } }, TEST_OFFLINE: true };
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

// 6 nhiệm vụ: mỗi nhiệm vụ 2–3 ô app, app có trong catalog; bật/tắt riêng từng nhiệm vụ, nhiệm vụ khác giữ nguyên.
import { MISSIONS, slotStatus, missionOf } from '../src/lib/missions.js';
import { appBySlug as appOf } from '../src/lib/catalog.js';
import { workflowById as wfOf } from '../src/lib/workflows.js';
assert.equal(MISSIONS.length, 6);
for (const m of MISSIONS) {
  assert.ok(m.slots.length >= 2 && m.slots.length <= (m.id === 'san_xuat' ? 5 : 3), m.id + ' phải có 2–3 ô app (sản xuất 5: thêm form thu khách, giọng đọc + nhạc)');
  for (const sl of m.slots) for (const a of sl.apps) assert.ok(a.startsWith('mcp:') || appOf(a), m.id + ': app lạ ' + a);
  for (const l of m.lich) { assert.ok(wfOf(l.id), m.id + ': quy trình lạ ' + l.id); assert.equal(missionOf(l.id).id, m.id); }
}
assert.equal(new Set(CHAIN.map((c) => c.id)).size, CHAIN.length, 'mỗi quy trình chỉ thuộc 1 nhiệm vụ');
const ss = slotStatus(MISSIONS[0].slots[1], ['facebook', 'instagram'], []);
assert.equal(ss.da_noi.length, 2); assert.ok(ss.ok);
assert.ok(slotStatus(MISSIONS[0].slots[0], [], ['https://mcp.higgsfield.ai/mcp']).da_noi.some((a) => a.slug === 'higgsfield'));
const f10 = { lich: 10, tro_ly: true, tu_tra_loi: true };
const one = await enableAutopilot(env, 'u4', rctx, f10, ['cham_soc_mxh']);
assert.ok(one.ok, JSON.stringify(one));
let l4 = await listSchedules(env, 'u4');
assert.ok(l4.length && l4.every((s) => s.nv === 'cham_soc_mxh'), 'chỉ bật nhiệm vụ đã chọn');
await enableAutopilot(env, 'u4', rctx, f10, ['bao_cao_ceo']);
l4 = await listSchedules(env, 'u4');
assert.ok(l4.some((s) => s.nv === 'cham_soc_mxh') && l4.some((s) => s.nv === 'bao_cao_ceo'), 'bật thêm nhiệm vụ không tắt nhiệm vụ cũ');
await disableAutopilot(env, 'u4', ['cham_soc_mxh']);
l4 = await listSchedules(env, 'u4');
assert.ok(l4.length && l4.every((s) => s.nv === 'bao_cao_ceo'), 'tắt riêng 1 nhiệm vụ');
const p4 = await planAutopilot(env, 'u4', rctx, f10);
assert.ok(p4.missions.find((m) => m.id === 'bao_cao_ceo').dang_chay && !p4.missions.find((m) => m.id === 'cham_soc_mxh').dang_chay);
console.log('missions OK');

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

// Sự kiện tức thì (Composio trigger): rút thông tin, lọc email tự động/của chính chủ, tạo lead + phiếu việc, xếp hàng khi bật chạy tự động.
import { normalize, handleEvent, listEvents, runEventQueue } from '../src/lib/events.js';
const g = normalize('GMAIL_NEW_GMAIL_MESSAGE', { sender: 'Nguyễn Văn A <a@gmail.com>', subject: 'Hỏi giá nhà 2 tầng', message_text: 'Cho em xin báo giá, sđt 0912 345 678' });
assert.equal(g.kenh, 'email'); assert.equal(g.email, 'a@gmail.com'); assert.equal(g.ten, 'Nguyễn Văn A');
const ev1 = await handleEvent(env, 'u3', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'Nguyễn Văn A <a@gmail.com>', subject: 'Hỏi giá nhà 2 tầng', message_text: 'Cho em xin báo giá, sđt 0912 345 678' }, 'https://x', { noMail: true });
assert.ok(ev1.lead && ev1.job, 'email có số → lead + phiếu');
const l3 = (await listLeads(env, 'u3')).find((l) => l.id === ev1.lead);
assert.equal(l3.sdt, '0912345678'); assert.equal(l3.muc_do, 'nong'); assert.equal(l3.nguon, 'email');
assert.ok((await handleEvent(env, 'u3', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'Shop <no-reply@shop.vn>', subject: 'Khuyến mãi' }, 'https://x', { noMail: true })).bo_qua);
assert.ok((await handleEvent(env, 'u3', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'ceo@nhaxinh.vn', subject: 'abc' }, 'https://x', { noMail: true })).bo_qua, 'email của chính chủ bỏ qua (chống vòng lặp)');
assert.ok((await handleEvent(env, 'u3', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'x@y.vn', subject: '[Crewzy] Lead nóng' }, 'https://x', { noMail: true })).bo_qua);
const cal = await handleEvent(env, 'u3', 'CALENDLY_MEETING_SCHEDULED', { name: 'Chị Mai', email: 'mai@x.vn', questions_and_answers: [{ question: 'SĐT', answer: '0988 111 222' }] }, 'https://x', { noMail: true });
assert.ok(cal.lead, 'đặt lịch = lead nóng');
const nolead = await handleEvent(env, 'u3', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'Bạn B <b@x.vn>', subject: 'Cảm ơn', message_text: 'Hôm qua vui quá' }, 'https://x', { noMail: true });
assert.ok(!nolead.lead && nolead.job, 'email thường: không lead, vẫn có phiếu soạn trả lời');
assert.ok((await listEvents(env, 'u3')).length >= 3);
// Bật chạy tự động (u2 có lịch nguon cay chế độ crewzy) → sự kiện vào hàng đợi, cron chạy.
await handleEvent(env, 'u2', 'GMAIL_NEW_GMAIL_MESSAGE', { sender: 'K <k@x.vn>', subject: 'Muốn mua nhà', message_text: 'tư vấn giúp' }, 'https://x', { noMail: true });
const ranJobs = [];
const qr = await runEventQueue(env, { runAuto: async (uid, job) => { ranJobs.push(uid + ':' + job.id); }, origin: 'https://x' });
assert.equal(qr.ran, 1); assert.ok(ranJobs[0].startsWith('u2:'));
assert.equal((await runEventQueue(env, { runAuto: async () => {}, origin: 'https://x' })).ran, 0, 'hàng đợi đã rỗng');
console.log('events OK');

// Webhook Composio thật (V3, chữ ký v1 HMAC): đúng khoá → xử lý; sai khoá → 401; gửi lại cùng webhook-id → bỏ qua.
import { handleWebhook } from '../src/lib/events.js';
import { sealText } from '../src/lib/common.js';
env.SESSION_SECRET = 'test-secret-123'; env.COMPOSIO_API_KEY = 'ak_test_offline';
const WH = 'whsec_test_abc';
store.set('composio:whsecret', await sealText(env, WH));
const sign = async (id, ts, body, secret) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return 'v1,' + Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${body}`))).toString('base64'); };
const bodyV3 = JSON.stringify({ id: 'msg_1', timestamp: new Date().toISOString(), type: 'composio.trigger.message', metadata: { log_id: 'l', trigger_slug: 'CALENDLY_MEETING_SCHEDULED', trigger_id: 'ti_1', connected_account_id: 'ca_1', auth_config_id: 'ac_1', user_id: 'vpai-u5' }, data: { name: 'Anh Tuấn', email: 't@x.vn', questions_and_answers: [{ question: 'Phone', answer: '0903 222 333' }] } });
const ts = String(Math.floor(Date.now() / 1000));
const mk = async (secret, id = 'wh_1') => new Request('https://x/api/composio/webhook', { method: 'POST', body: bodyV3, headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': await sign(id, ts, bodyV3, secret) } });
assert.equal((await handleWebhook(await mk('sai-khoa'), env, 'https://x')).status, 401);
const okRes = await (await handleWebhook(await mk(WH), env, 'https://x')).json();
assert.ok(okRes.ok && okRes.lead, JSON.stringify(okRes));
assert.equal((await listLeads(env, 'u5'))[0].sdt, '0903222333');
assert.ok((await (await handleWebhook(await mk(WH), env, 'https://x')).json()).trung, 'gửi lại cùng id phải bỏ qua');
console.log('webhook OK');

// Form (Typeform / Google Sheets) → lead; sheet do Crewzy ghi bị bỏ qua.
const tf = normalize('TYPEFORM_NEW_RESPONSE', { form_response: { token: 't1', definition: { fields: [{ id: 'a', title: 'Họ tên' }, { id: 'b', title: 'Số điện thoại' }, { id: 'c', title: 'Email' }] },
  answers: [{ field: { id: 'a' }, type: 'text', text: 'Chị Hằng' }, { field: { id: 'b' }, type: 'phone_number', phone_number: '+84901234567' }, { field: { id: 'c' }, type: 'email', email: 'hang@x.vn' }] } });
assert.equal(tf.ten, 'Chị Hằng'); assert.equal(tf.sdt, '+84901234567'); assert.equal(tf.email, 'hang@x.vn'); assert.ok(tf.form);
const fr = await handleEvent(env, 'u6', 'TYPEFORM_NEW_RESPONSE', { form_response: { token: 't1', definition: { fields: [{ id: 'a', title: 'Tên' }] }, answers: [{ field: { id: 'a' }, type: 'text', text: 'Anh Long' }] } }, 'https://x', { noMail: true });
assert.ok(fr.lead, 'form không số vẫn là lead');
const sh = normalize('GOOGLESHEETS_NEW_ROWS_TRIGGER', { row_data: ['23/11/2026 9:00', 'Cô Ba', '0987 654 321', 'ba@x.vn', 'Hỏi nhà 3 tỷ'], sheet_name: 'Câu trả lời biểu mẫu 1', spreadsheet_id: 's', row_number: 5 });
assert.equal(sh.ten, 'Cô Ba'); assert.equal(sh.email, 'ba@x.vn'); assert.ok(sh.sdt);
assert.ok((await handleEvent(env, 'u6', 'GOOGLESHEETS_NEW_ROWS_TRIGGER', { row_data: ['A', '0911222333'], sheet_name: 'Khách tiềm năng' }, 'https://x', { noMail: true })).bo_qua, 'sheet do Crewzy ghi');
import { parseFormInput } from '../src/lib/events.js';
assert.equal(parseFormInput('typeform', 'https://form.typeform.com/to/x2DfMTz9'), 'x2DfMTz9');
assert.equal(parseFormInput('googlesheets', 'abc'), '');
console.log('form OK');

// Soát tồn đọng + tổng kết ngày (code, không AI).
import { backlogFor, digestText } from '../src/lib/ops.js';
const old = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
store.set('jobs:u7', JSON.stringify([
  { id: 'j1', tieu_de: 'Bài đăng thứ Hai', trang_thai: 'cho_duyet', cap_nhat: old, lich_su: [] },
  { id: 'j2', tieu_de: 'Trả lời bình luận', trang_thai: 'dang_lam', nhan_luc: old, cap_nhat: old, nguon: 'hen_gio', yeu_cau: 'x', lich_su: [] },
  { id: 'j3', tieu_de: 'Mới', trang_thai: 'cho_duyet', cap_nhat: new Date().toISOString(), lich_su: [] },
]));
store.set('leads:u7', JSON.stringify([{ id: 'lA', ten: 'Chị Na', sdt: '0909000111', nguon: 'facebook', muc_do: 'nong', trang_thai: 'moi', luc: old }, { id: 'lB', ten: 'Anh Tư', nguon: 'email', muc_do: 'nong', trang_thai: 'moi', luc: new Date().toISOString() }]));
const noon = new Date(Date.UTC(2026, 10, 23, 5, 0)); // 12:00 giờ VN
const bl = await backlogFor(env, 'u7', { now: new Date(), crewzy: true, origin: 'https://x', send: false });
assert.equal(bl.cho_duyet, 1); assert.equal(bl.khach_nong, 1); assert.equal(bl.xep_lai, 1);
const bl2 = await backlogFor(env, 'u7', { now: new Date(), crewzy: true, origin: 'https://x', send: false });
assert.equal(bl2.xep_lai, 0, 'mỗi phiếu chỉ xếp lại 1 lần');
const dg = await digestText(env, 'u7', { slot: 22 });
assert.ok(dg.noi_dung.includes('KHÁCH CẦN GỌI') && dg.noi_dung.includes('Chị Na') && dg.noi_dung.includes('CÒN TỒN'), dg.noi_dung);
console.log('ops OK');

// Bộ não prompt: bản chỉ đạo theo Brain + luật app + khổ kênh, không gọi AI.
import { promptPro } from '../src/lib/promptPro.js';
store.set('brand:u5', JSON.stringify({ name: 'Nhà Xinh', products: 'Nhà phố Bình Chánh', customers: 'Gia đình trẻ', voice: 'Thân thiện', visual: 'Tông be, ánh nắng ấm', refs: [{ loai: 'video_mau', link: 'https://example.com/v.mp4' }] }));
const pp = await promptPro(env, 'u5', { loai: 'video', app: 'higgsfield', muc_tieu: 'Giới thiệu nhà mẫu', kenh: ['tiktok', 'twitter', 'abc'] });
assert.equal(pp.data.luat_app.ten, 'Higgsfield');
assert.ok(pp.data.dinh_dang_kenh.tiktok && pp.data.dinh_dang_kenh.x && !pp.data.dinh_dang_kenh.abc);
assert.equal(pp.data.phong_cach.hinh_anh, 'Tông be, ánh nắng ấm');
assert.equal(pp.data.mau_khach_thich.length, 1);
console.log('promptPro OK');
