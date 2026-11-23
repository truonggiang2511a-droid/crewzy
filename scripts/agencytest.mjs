// Agency nhiều doanh nghiệp (23/11): node scripts/agencytest.mjs
import assert from 'node:assert/strict';
import { signSession, resolveUid, SESSION_COOKIE } from '../src/lib/common.js';
import business from '../src/routes/business.js';
import { postQuota, mediaQuota, planNote } from '../src/lib/quota.js';
import { planFeatures } from '../src/lib/billing.js';

const mem = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, typeof v === 'string' ? v : JSON.stringify(v)); } };
const env = { KV, SESSION_SECRET: 's3cret-test', GOOGLE_CLIENT_ID: 'x.apps.googleusercontent.com' }; // không DB → billing tắt → mở mọi tính năng (10 doanh nghiệp)
const OWNER = 'chu-agency-01';
const tok = await signSession(env, { uid: OWNER, email: 'a@b.vn', exp: Date.now() + 86400e3 });
const req = (path, { method = 'GET', body, biz } = {}) => new Request('https://crewzy.test' + path, { method, headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${encodeURIComponent(tok)}` + (biz != null ? `; cz_biz=${biz}` : '') }, body: body ? JSON.stringify(body) : undefined });

let r = await business(req('/api/doanh-nghiep'), env); let j = await r.json();
assert.equal(j.toi_da, 10, 'billing tắt = mở 10'); assert.equal(j.items.length, 0); assert.equal(j.dang_chon, 0);
r = await business(req('/api/doanh-nghiep', { method: 'POST', body: { action: 'tao', ten: 'Spa Hoa Mai' } }), env); j = await r.json();
assert.equal(j.dang_chon, 1); assert.match(r.headers.get('set-cookie'), /cz_biz=1/);
// Cookie cz_biz=1 → mã khách con; cookie lạ → về doanh nghiệp chính.
assert.equal((await resolveUid(req('/x', { biz: 1 }), env)).uid, OWNER + '-b1');
assert.equal((await resolveUid(req('/x', { biz: 5 }), env)).uid, OWNER, 'doanh nghiệp không có trong danh sách');
assert.equal((await resolveUid(req('/x'), env)).uid, OWNER);
for (let i = 0; i < 8; i++) await business(req('/api/doanh-nghiep', { method: 'POST', body: { action: 'tao', ten: 'DN ' + i } }), env);
r = await business(req('/api/doanh-nghiep', { method: 'POST', body: { action: 'tao', ten: 'Quá' } }), env);
assert.equal(r.status, 400, 'tối đa 10 doanh nghiệp (1 chính + 9)');
r = await business(req('/api/doanh-nghiep', { method: 'POST', body: { action: 'chon', n: 0 } }), env);
assert.match(r.headers.get('set-cookie'), /cz_biz=0; .*Max-Age=0/);

// Hạn mức: MCP 1 tháng 2 bài/ngày/nền tảng (Facebook × 3 Fanpage = 6), không AI ảnh Crewzy.
const f1 = planFeatures('thang');
const post = (name, args) => postQuota(env, 'k1', f1, name, args);
assert.equal(await post('INSTAGRAM_CREATE_POST', {}), null);
assert.equal(await post('INSTAGRAM_CREATE_POST', {}), null);
assert.match(await post('INSTAGRAM_CREATE_POST', {}), /hạn mức gói trên instagram/);
assert.equal(await post('COMPOSIO_MULTI_EXECUTE_TOOL', { tools: [{ tool_slug: 'FACEBOOK_CREATE_POST' }, { tool_slug: 'FACEBOOK_CREATE_PHOTO_POST' }] }), null);
assert.equal(await post('FACEBOOK_LIST_MANAGED_PAGES', {}), null, 'đọc không tính');
assert.match(await mediaQuota(env, 'k1', f1, 'CREWZY_TAO_VIDEO'), /không có video AI/);
for (let i = 0; i < 30; i++) assert.equal(await mediaQuota(env, 'k1', f1, 'CREWZY_TAO_ANH'), null);
assert.match(await mediaQuota(env, 'k1', f1, 'CREWZY_TAO_ANH'), /hết 30 ảnh/);
const f6 = planFeatures('sau_thang');
for (let i = 0; i < 10; i++) assert.equal(await mediaQuota(env, 'k6', f6, 'CREWZY_TAO_VIDEO'), null);
assert.match(await mediaQuota(env, 'k6', f6, 'CREWZY_TAO_VIDEO'), /hết 10 video/);
assert.ok(planNote(planFeatures('sau_thang+fp15')).includes('20 Fanpage') && planNote(f6).includes('2 phút'));
console.log('agencytest OK');
