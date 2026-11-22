// Thử Composio Instant (src/lib/instant.js): đọc tiền từng lần gọi, trừ credit có lãi, trần chi tiêu ngày, quy trình coi nhóm Instant là đủ.
// Chạy: node scripts/instanttest.mjs (đã gộp vào npm test)
import assert from 'node:assert/strict';
import { instantUsd, instantConfig, recordInstant, INSTANT_APPS } from '../src/lib/instant.js';
import { instantCredits } from '../src/lib/billing.js';
import { WORKFLOWS, readiness } from '../src/lib/workflows.js';

const store = new Map();
const KV = { async get(k) { return store.get(k) ?? null; }, async put(k, v) { store.set(k, v); } };
const env = { KV };

// 1. Đọc tiền: ngoài cùng, lồng trong MULTI_EXECUTE, không có.
assert.equal(instantUsd({ instantCharge: { amount: '0.0125', currency: 'USD', charged_by: 'composio' } }), 0.0125);
assert.equal(instantUsd({ data: { results: [{ response: { instant_charge: { amount: '0.01' } } }, { response: { instantCharge: { amount: '0.002' } } }] } }), 0.012);
assert.equal(instantUsd({ data: { ok: true } }), 0);
assert.equal(instantUsd(null), 0);

// 2. Credit: 0,01 USD × 26.000 × 2 / 100 = 5,2 → 6 credit; rất rẻ vẫn tối thiểu 1; không tốn thì 0.
assert.equal(instantCredits(env, 0.01), 6);
assert.equal(instantCredits(env, 0.0001), 1);
assert.equal(instantCredits(env, 0), 0);

// 3. Trần ngày: khách vượt 0,3 USD thì tắt Instant cho khách đó, khách khác vẫn dùng; toàn app vượt 1 USD thì tắt hết.
assert.deepEqual(await instantConfig(env, 'khach-a'), { returnInstantCharge: true, returnPricesInSearch: true });
await recordInstant(env, 'khach-a', 0.31);
assert.equal(await instantConfig(env, 'khach-a'), false);
assert.ok(await instantConfig(env, 'khach-b'));
await recordInstant(env, 'khach-b', 0.29); await recordInstant(env, 'khach-c', 0.29); await recordInstant(env, 'khach-d', 0.2);
assert.equal(await instantConfig(env, 'khach-e'), false, 'toàn app vượt 1 USD');
assert.equal(await instantConfig({ KV, INSTANT: 'off' }, 'khach-z'), false);
assert.ok(await instantConfig({ KV: { async get() { return null; } }, INSTANT_DAILY_USD: '5' }, 'khach-z'));

// 4. Quy trình: nhóm có app Instant (vd tìm khách doanh nghiệp: apollo, google_maps) đủ khi chạy bằng Trợ lý Crewzy, không đủ qua link MCP.
const w = WORKFLOWS.find((x) => (x.cong_cu || []).some((g) => g.bat_buoc && !g.san_co && (g.apps || []).some((a) => INSTANT_APPS.includes(a))));
assert.ok(w, 'có quy trình cần app Instant');
const base = { connected: [], mcpUrls: [], brand: {}, done: new Set() };
const off = readiness(w, base), on = readiness(w, { ...base, instant: true });
assert.ok(off.thieu_nhom.length > on.thieu_nhom.length, 'Instant bớt nhóm còn thiếu');
assert.ok(on.groups.some((g) => g.instant && g.instant.length), 'ghi app Instant dùng hộ');
console.log('instanttest OK', w.id);
