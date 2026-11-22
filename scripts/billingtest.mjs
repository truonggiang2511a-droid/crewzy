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
const o1 = await call('/api/billing/order', { method: 'POST', body: { item: 'co_ban' } });
assert.equal(o1.status, 200, JSON.stringify(o1.data));
const don = o1.data.don;
assert.match(don.code, /^CZ[A-HJ-NP-Z2-9]{8}$/);
assert.equal(don.amount, 299000);
assert.match(don.qr, /^https:\/\/vietqr\.app\/img\?acc=0123456789&bank=MBBank&amount=299000&des=CZ/);
assert.equal((await call('/api/billing/order', { method: 'POST', body: { item: 'co_ban' } })).data.don.id, don.id);
assert.equal((await call('/api/billing/order', { method: 'POST', body: { item: 'khong_co' } })).status, 400);

// 4. Webhook SePay: sai khoá → 401; thiếu tiền → không cộng; đủ tiền → cộng gói + credit; gửi lại → không cộng lần hai.
const hook = (payload, key = 'whkey') => billingRoute(new Request('https://crewzy.test/api/sepay/webhook', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Apikey ' + key }, body: JSON.stringify(payload) }), env);
const tx = (id, amount, content) => ({ id, gateway: 'MBBank', transactionDate: '2026-11-22 18:30:00', accountNumber: '0123456789', code: null, content, transferType: 'in', transferAmount: amount, referenceCode: 'FT' + id });
assert.equal((await hook(tx(1, 299000, don.code), 'sai')).status, 401);
let r = await hook(tx(2, 100000, 'chuyen tien ' + don.code));
assert.deepEqual(await r.json(), { success: true });
assert.equal((await getAccount(env, UID)).credits, 0, 'thiếu tiền không cộng');
r = await hook(tx(3, 299000, 'NGUYEN VAN A ' + don.code.toLowerCase() + ' thanh toan'));
assert.deepEqual(await r.json(), { success: true });
let acc = await getAccount(env, UID);
assert.equal(acc.credits, 3000);
assert.equal(acc.plan, 'co_ban');
assert.ok(acc.plan_until > Date.now() + 29 * 86400000);
assert.equal((await hook(tx(3, 299000, don.code))).status, 200);
assert.equal((await getAccount(env, UID)).credits, 3000, 'SePay gửi lại cùng id không cộng lần hai');
assert.equal((await hook(tx(4, 299000, don.code))).status, 200);
assert.equal((await getAccount(env, UID)).credits, 3000, 'chuyển lần hai cùng mã đơn đã trả không cộng');
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
assert.equal((await getAccount(env, UID)).credits, 2990);
assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM ledger WHERE uid = ? AND ref = 'Y'").get(UID).n, 0);

// 7. Giá thao tác + đồng hồ đo.
assert.equal(toolPrice(env, 'COMPOSIO_SEARCH_TOOLS', {}), 0);
assert.equal(toolPrice(env, 'COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{}, {}, {}] }), 3);
assert.equal(toolPrice(env, 'CREWZY_QUY_TRINH', {}), 0);
assert.equal(toolPrice(env, 'CREWZY_TAO_ANH', {}), 3);
assert.equal(toolPrice(env, 'CREWZY_TAO_VIDEO', { giay: 8 }), 120);
assert.equal(toolPrice(env, 'm28b8_compose', {}), 1);
assert.equal(toolPrice({ PRICES_JSON: '{"tool":2}' }, 'FACEBOOK_CREATE_POST', {}), 2, 'đổi giá bằng biến PRICES_JSON');
assert.ok(tokenCredits(env, { input_tokens: 20000, output_tokens: 800 }) >= 1);
const meter = await makeMeter(env, UID);
assert.equal(await meter.tool('COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{}, {}] }), null);
assert.equal((await getAccount(env, UID)).credits, 2988);
// Token AI trừ sau, có thể âm; âm thì dừng lượt AI và lượt sau bị chặn.
await chargeAfter(env, UID, 2990, 'ai', 'test');
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
assert.ok(b.so.length >= 3 && b.don.length === 1 && b.goi.length === 3);
const env2 = { ...env, SEPAY_ACCOUNT: '' };
const res2 = await billingRoute(new Request('https://crewzy.test/api/billing/order', { method: 'POST', headers: { 'content-type': 'application/json', cookie: await cookie('khach-test-03', 'c@example.com') }, body: JSON.stringify({ item: 'co_ban' }) }), env2);
assert.equal(res2.status, 503);
// Chưa đăng nhập → 401.
assert.equal((await call('/api/billing', { uid: null })).status, 401);

// 10. Gia hạn cộng dồn: mua thêm khi còn hạn thì cộng tiếp 30 ngày từ ngày hết hạn cũ.
const before = (await getAccount(env, UID)).plan_until;
await grant(env, UID, 3000, 30, 'mua_goi', 'test', 'co_ban');
assert.equal((await getAccount(env, UID)).plan_until, before + 30 * 86400000);

console.log('billingtest OK');
