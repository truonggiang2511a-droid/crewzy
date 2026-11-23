// Thử gói + credit + SePay + 4 bước bắt đầu bằng SQLite thật (node:sqlite) giả lập D1. Chạy: node scripts/billingtest.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import billingRoute from '../src/routes/billing.js';
import { charge, chargeAfter, grant, gate, makeMeter, onboarding, toolPrice, tokenCredits, billingOn, getAccount } from '../src/lib/billing.js';
import { signSession, sessionCookie } from '../src/lib/common.js';

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_billing.sql', import.meta.url), 'utf8'));
  const exec = (sql, p) => {
    const st = db.prepare(sql);
    if (/RETURNING/i.test(sql)) { const rows = st.all(...p); return { results: rows, meta: { changes: rows.length } }; }
    const r = st.run(...p);
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  return {
    db,
    prepare(sql) {
      let p = [];
      const s = {
        bind(...a) { p = a.map((v) => (v === undefined ? null : v)); return s; },
        async run() { return exec(sql, p); },
        async first() { return db.prepare(sql).get(...p) ?? null; },
        async all() { return { results: db.prepare(sql).all(...p) }; },
        _exec: () => exec(sql, p),
      };
      return s;
    },
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map((s) => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const store = new Map();
const KV = {
  async get(k, o) { const v = store.get(k); if (v == null) return null; const t = typeof o === 'string' ? o : o && o.type; return t === 'json' ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
};
globalThis.fetch = async () => new Response('offline', { status: 503 }); // Composio không có mạng → connectedApps trả rỗng

const DB = fakeD1();
const env = { COMPOSIO_API_KEY: 'ak_test', DB, KV, GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', SESSION_SECRET: 's', ADMIN_EMAILS: 'giang@example.com',
  SEPAY_WEBHOOK_KEY: 'whkey', SEPAY_BANK: 'MBBank', SEPAY_ACCOUNT: '0123456789', SEPAY_ACCOUNT_NAME: 'NGUYEN TRUONG GIANG' };
const UID = 'khach-test-01';
assert.equal(billingOn(env), true);
assert.equal(billingOn({ ...env, BILLING: 'off' }), false);
assert.equal(billingOn({ ...env, GOOGLE_CLIENT_ID: '' }), false, 'chưa bật đăng nhập Google thì không chặn ai');

const cookie = async (uid, email) => sessionCookie(await signSession(env, { uid, email, exp: Date.now() + 86400000 }), 86400).split(';')[0];
const call = async (path, { method = 'GET', body, uid = UID, email = 'khach@example.com', headers = {} } = {}) => {
  const h = { 'content-type': 'application/json', ...headers };
  if (uid) h.cookie = await cookie(uid, email);
  const res = await billingRoute(new Request('https://crewzy.test' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, data: await res.json() };
};

// 1. Khách mới: 4 bước đều chưa xong, bị chặn dùng.
let ob = await onboarding(env, UID, { email: 'khach@example.com' });
assert.deepEqual(ob.steps, { brand: false, channel: false, ai: false, paid: false });
assert.equal(ob.done, false);
assert.equal((await gate(env, UID)).status, 402);

// 2. Điền Brain đủ 3 mục, nối kênh (Metricool qua MCP), chọn Trợ lý Crewzy → còn thiếu thanh toán.
await KV.put('brand:' + UID, { name: 'Nhà Xinh Minh Thùy', products: 'Nhà phố Bình Chánh', customers: 'Gia đình trẻ' });
await KV.put('mcpsrv:' + UID, [{ id: 's1', name: 'Metricool', url: 'https://ai.metricool.com/mcp' }]);
assert.equal((await call('/api/onboarding', { method: 'POST', body: { ai: 'crewzy' } })).status, 200);
ob = await onboarding(env, UID, {});
assert.deepEqual(ob.steps, { brand: true, channel: true, ai: true, paid: false });
// AI nối qua link MCP (aiseen) cũng tính là xong bước AI.
await KV.put('aiseen:khach-test-02', { ten: 'Claude' });
assert.equal((await onboarding(env, 'khach-test-02', {})).steps.ai, true);

// 3. Tạo đơn mua gói: có mã CZ…, QR VietQR đúng số tiền; bấm lại dùng lại đơn cũ.
const o1 = await call('/api/billing/order', { method: 'POST', body: { item: 'thang' } });
assert.equal(o1.status, 200, JSON.stringify(o1.data));
const don = o1.data.don;
assert.match(don.code, /^CZ[A-HJ-NP-Z2-9]{8}$/);
assert.equal(don.amount, 199000);
assert.match(don.qr, /^https:\/\/vietqr\.app\/img\?acc=0123456789&bank=MBBank&amount=199000&des=CZ/);
assert.equal((await call('/api/billing/order', { method: 'POST', body: { item: 'thang' } })).data.don.id, don.id);
assert.equal((await call('/api/billing/order', { method: 'POST', body: { item: 'khong_co' } })).status, 400);

// 4. Webhook SePay: sai khoá → 401; thiếu tiền → không cộng; đủ tiền → cộng gói + credit; gửi lại → không cộng lần hai.
const hook = (payload, key = 'whkey') => billingRoute(new Request('https://crewzy.test/api/sepay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Apikey ' + key }, body: JSON.stringify(payload) }), env);
const tx = (id, amount, content) => ({ id, gateway: 'MBBank', transactionDate: '2026-11-22 18:30:00', accountNumber: '0123456789', code: null, content, transferType: 'in', transferAmount: amount, referenceCode: 'FT' + id });
assert.equal((await hook(tx(1, 199000, don.code), 'sai')).status, 401);
let r = await hook(tx(2, 100000, 'chuyen tien ' + don.code));
assert.deepEqual(await r.json(), { success: true });
assert.equal((await getAccount(env, UID)).credits, 0, 'thiếu tiền không cộng');
r = await hook(tx(3, 199000, 'NGUYEN VAN A ' + don.code.toLowerCase() + ' thanh toan'));
assert.deepEqual(await r.json(), { success: true });
let acc = await getAccount(env, UID);
assert.equal(acc.credits, 1500);
assert.equal(acc.plan, 'thang');
assert.ok(acc.plan_until > Date.now() + 29 * 86400000);
assert.equal((await hook(tx(3, 199000, don.code))).status, 200);
assert.equal((await getAccount(env, UID)).credits, 1500, 'SePay gửi lại cùng id không cộng lần hai');
assert.equal((await hook(tx(4, 199000, don.code))).status, 200);
assert.equal((await getAccount(env, UID)).credits, 1500, 'chuyển lần hai cùng mã đơn đã trả không cộng');
assert.equal((await hook(tx(5, 50000, 'tien an trua'))).status, 200);
const pays = DB.db.prepare('SELECT id, result FROM payments ORDER BY id').all().map((x) => x.id + ':' + x.result).join(',');
assert.equal(pays, '2:thieu_tien,3:da_cong,4:da_tra,5:khong_khop');
assert.equal((await call('/api/billing/order?id=' + don.id)).data.don.status, 'paid');

// 5. Xong 4 bước → được dùng.
ob = await onboarding(env, UID, {});
assert.equal(ob.done, true);
assert.equal(await gate(env, UID, { needCredits: 5 }), null);

// 6. Trừ credit nguyên tử: đủ thì trừ + ghi sổ; không đủ thì không trừ, không ghi sổ.
assert.deepEqual(await charge(env, UID, 10, 'cong_cu', 'X'), { ok: true, charged: 10 });
assert.deepEqual(await charge(env, UID, 999999, 'cong_cu', 'Y'), { ok: false, charged: 0 });
assert.equal((await getAccount(env, UID)).credits, 1490);
assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM ledger WHERE uid = ? AND ref = 'Y'").get(UID).n, 0);

// 7. Giá thao tác + đồng hồ đo.
assert.equal(toolPrice(env, 'COMPOSIO_SEARCH_TOOLS', {}), 0);
assert.equal(toolPrice(env, 'COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{}, {}, {}] }), 3);
assert.equal(toolPrice(env, 'CREWZY_QUY_TRINH', {}), 0);
assert.equal(toolPrice(env, 'CREWZY_TAO_ANH', {}), 3);
assert.equal(toolPrice(env, 'CREWZY_TAO_VIDEO', { giay: 8 }), 136, 'video Nhanh 17 credit/giây (LTX 0,03 USD)');
assert.equal(toolPrice(env, 'CREWZY_TAO_VIDEO', { giay: 5, chat_luong: 'dep' }), 325, 'video Đẹp 65 credit/giây (Seedance 0,12 USD)');
assert.equal(toolPrice(env, 'CREWZY_TAO_ANH', { chat_luong: 'dep' }), 25, 'ảnh Đẹp (Seedream 0,04 USD)');
{ // Gói (23/11 16:47): Tháng 199k Haiku · 6 tháng 6×199k Sonnet + Fanpage 10k/tháng · 1 năm 12×199k Opus · Agency 5tr 5 thương hiệu + 100k/tháng/thương hiệu.
  const { planFeatures, applyFeatures, capBrain, ownerUid, priceOf } = await import('../src/lib/billing.js');
  const f1 = planFeatures('thang'), f6 = planFeatures('sau_thang'), fy = planFeatures('mot_nam'), fa = planFeatures('agency');
  assert.equal(f1.tai_khoan, 1); assert.equal(f1.fanpage, 3); assert.equal(f1.bai_ngay, 2); assert.equal(f1.anh_thang, 30); assert.equal(f1.video_thang, 0);
  assert.equal(capBrain('manh', f1), 'tiet_kiem'); assert.equal(capBrain('manh', f6), 'can_bang'); assert.equal(capBrain('manh', fy), 'manh');
  assert.equal(f6.fanpage, 5); assert.equal(planFeatures('sau_thang+fp15').fanpage, 20); assert.equal(fy.fanpage, 10); assert.equal(fa.doanh_nghiep, 5);
  assert.equal(planFeatures('agency+th3').doanh_nghiep, 8);
  assert.equal(planFeatures('mcp_1t').fanpage, 3, 'mã gói cũ vẫn chạy');
  assert.equal(priceOf(env, 'thang').amount, 199000);
  assert.equal(priceOf(env, 'sau_thang').amount, 1194000);
  assert.equal(priceOf(env, 'sau_thang+fp15').amount, 1194000 + 15 * 10000 * 6);
  assert.equal(priceOf(env, 'mot_nam+fp10').amount, 2388000 + 10 * 10000 * 12);
  assert.equal(priceOf(env, 'agency+th3').amount, 5300000);
  assert.equal(priceOf(env, 'sau_thang+fp96'), null, 'vượt tối đa 100 Fanpage');
  assert.equal(priceOf(env, 'thang+fp1'), null, 'gói Tháng không mua thêm Fanpage');
  assert.equal(planFeatures('khong_co').tro_ly, false);
  assert.ok(applyFeatures('CREWZY_TAO_VIDEO', {}, f1).error, 'gói Tháng không có video Crewzy');
  assert.equal(applyFeatures('CREWZY_TAO_VIDEO', { chat_luong: 'dep' }, f6).args.chat_luong, 'nhanh');
  assert.equal(applyFeatures('CREWZY_TAO_VIDEO', { chat_luong: 'dep' }, fy).args.chat_luong, 'dep');
  assert.equal(ownerUid('khach-abc-12-b3'), 'khach-abc-12');
}
assert.equal(toolPrice(env, 'm28b8_compose', {}), 1);
assert.equal(toolPrice({ PRICES_JSON: '{"tool":2}' }, 'FACEBOOK_CREATE_POST', {}), 2, 'đổi giá bằng biến PRICES_JSON');
assert.ok(tokenCredits(env, { input_tokens: 20000, output_tokens: 800 }) >= 1);
const meter = await makeMeter(env, UID);
assert.equal(await meter.tool('COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{}, {}] }), null);
assert.equal((await getAccount(env, UID)).credits, 1488);
// Token AI trừ sau, có thể âm; âm thì dừng lượt AI và lượt sau bị chặn.
await chargeAfter(env, UID, 1490, 'ai', 'test');
assert.equal(await meter.tokens({ input_tokens: 100000, output_tokens: 1000 }), 'stop');
assert.ok((await getAccount(env, UID)).credits < 0);
assert.match(await meter.tool('FACEBOOK_CREATE_POST', {}), /Hết credit/);
assert.equal((await gate(env, UID, { needCredits: 5 })).can, 'nap_credit');

// 8. Admin: không bị chặn, không bị trừ; cấp credit + ngày cho khách theo email.
await DB.prepare('INSERT INTO accounts (uid, email, created_at, updated_at) VALUES (?1, ?2, 0, 0)').bind('admin-giang-01', 'giang@example.com').run();
assert.equal(await gate(env, 'admin-giang-01'), null);
assert.equal(await makeMeter(env, 'admin-giang-01'), null);
assert.equal((await onboarding(env, 'admin-giang-01', { admin: true })).done, true);
assert.equal((await call('/api/billing/admin', { method: 'POST', body: { email: 'khach@example.com', credits: 500 } })).status, 403, 'khách thường không vào được admin');
const g = await call('/api/billing/admin', { method: 'POST', uid: 'admin-giang-01', email: 'giang@example.com', body: { email: 'KHACH@example.com', credits: 500, days: 7 } });
assert.equal(g.status, 200, JSON.stringify(g.data));
assert.ok(g.data.account.credits > 0);
assert.equal((await call('/api/billing/admin', { uid: 'admin-giang-01', email: 'giang@example.com' })).data.tai_khoan.length >= 2, true);

// 9. Trang Gói: số dư, sổ credit, đơn; chưa cấu hình SePay thì không tạo đơn.
const b = (await call('/api/billing')).data;
assert.equal(b.bat, true);
assert.equal(b.thanh_toan_mo, true);
assert.ok(b.so.length >= 3 && b.don.length === 1 && b.goi.length === 4);
const env2 = { ...env, SEPAY_ACCOUNT: '' };
const res2 = await billingRoute(new Request('https://crewzy.test/api/billing/order', { method: 'POST', headers: { 'content-type': 'application/json', cookie: await cookie('khach-test-03', 'c@example.com') }, body: JSON.stringify({ item: 'thang' }) }), env2);
assert.equal(res2.status, 503);
// Chưa đăng nhập → 401.
assert.equal((await call('/api/billing', { uid: null })).status, 401);

// 10. Gia hạn cộng dồn: mua thêm khi còn hạn thì cộng tiếp 30 ngày từ ngày hết hạn cũ.
const before = (await getAccount(env, UID)).plan_until;
await grant(env, UID, 1500, 30, 'mua_goi', 'test', 'thang');
assert.equal((await getAccount(env, UID)).plan_until, before + 30 * 86400000);

console.log('billingtest OK');

// Credit theo model: Opus đắt hơn Haiku; đọc cache rẻ hơn nhiều so với token vào thường.
{
  const opus = tokenCredits(env, { input_tokens: 30000, output_tokens: 1000 }, 'claude-opus-5-5');
  const haiku = tokenCredits(env, { input_tokens: 30000, output_tokens: 1000 }, 'claude-haiku-5-5');
  const cached = tokenCredits(env, { input_tokens: 500, cache_read_input_tokens: 29500, output_tokens: 1000 }, 'claude-opus-5-5');
  assert.ok(opus > haiku * 10, 'Opus tốn hơn Haiku');
  assert.ok(cached < opus / 2, 'cache giảm chi phí');
  // 30.000 vào + 1.000 ra Opus = 0,14 USD × 26.000 × 2 / 100 ≈ 73 credit
  assert.equal(opus, Math.ceil((30000 * 4 + 1000 * 20) / 1e6 * 26000 * 2 / 100));
  console.log('billingtest: credit theo model OK', { opus, haiku, cached });
}

// Dùng thử miễn phí: 1 lần/tài khoản, bấm 2 lần không cộng đôi, đã mua gói thì không được, hết hạn báo đúng câu, TRIAL=off tắt.
{
  const { startTrial, trialAvailable } = await import('../src/lib/billing.js');
  const U = 'khach-dung-thu-01';
  assert.equal(await trialAvailable(env, U), true);
  const [a, b] = await Promise.all([startTrial(env, U, 'a@x.vn'), startTrial(env, U, 'a@x.vn')]);
  assert.equal([a, b].filter((r) => r.ok).length, 1, 'chỉ 1 lần');
  const acc = await getAccount(env, U);
  assert.equal(acc.credits, 300);
  assert.equal(acc.plan, 'dung_thu');
  assert.ok(acc.plan_until > Date.now() + 6 * 86400000);
  assert.equal(await trialAvailable(env, U), false);
  assert.equal(await gate(env, U, { needCredits: 5 }), null, 'đang dùng thử thì được dùng');
  DB.db.prepare('UPDATE accounts SET plan_until = ? WHERE uid = ?').run(Date.now() - 1000, U);
  assert.match((await gate(env, U)).error, /hết thời gian dùng thử/i);
  // Đã từng mua gói → không dùng thử.
  const U2 = 'khach-da-mua-02';
  DB.db.prepare("INSERT INTO orders (id, uid, kind, item, amount, credits, days, code, status, created_at) VALUES ('o-x', ?, 'plan', 'co_ban', 299000, 3000, 30, 'CZAAAA2222', 'paid', 1)").run(U2);
  assert.equal(await trialAvailable(env, U2), false);
  assert.equal((await startTrial(env, U2, 'b@x.vn')).ok, false);
  assert.equal(await trialAvailable({ ...env, TRIAL: 'off' }, 'khach-moi-03'), false);
  console.log('billingtest: dùng thử OK');
}
