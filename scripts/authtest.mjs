// Kiểm tra cục bộ (node scripts/authtest.mjs): ký/đọc phiên, resolveUid, xác minh ID token RS256 với khoá tự tạo, ký link MCP.
import { generateKeyPairSync, sign } from 'node:crypto';
const c = await import('../src/lib/common.js');
const env = { COMPOSIO_API_KEY: 'ak_test_key', GOOGLE_CLIENT_ID: '' };
const assert = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exit(1); } console.log('ok -', msg); };

const token = await c.signSession(env, { uid: 'g-123456789', email: 'a@b.c', exp: Date.now() + 60000 });
const req = (cookie) => new Request('https://x/api', { headers: cookie ? { cookie } : {} });
assert((await c.readSession(req(`${c.SESSION_COOKIE}=${encodeURIComponent(token)}`), env))?.uid === 'g-123456789', 'đọc phiên hợp lệ');
assert((await c.readSession(req(`${c.SESSION_COOKIE}=${token.slice(0, -2)}xx`), env)) === null, 'phiên bị sửa chữ ký → từ chối');
assert((await c.readSession(req(`${c.SESSION_COOKIE}=${await c.signSession(env, { uid: 'g-1234567890', exp: Date.now() - 1 })}`), env)) === null, 'phiên hết hạn → từ chối');
assert((await c.resolveUid(req(), env, 'abcd-1234-efgh')).uid === 'abcd-1234-efgh', 'chưa bật Google: dùng mã trình duyệt');
env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
assert((await c.resolveUid(req(), env, 'abcd-1234-efgh')).response?.status === 401, 'bật Google, không phiên → 401');
assert((await c.resolveUid(req(`a=1; ${c.SESSION_COOKIE}=${encodeURIComponent(token)}`), env, 'other-uid-0000')).uid === 'g-123456789', 'bật Google: lấy mã từ phiên');

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const mk = (claims) => { const h = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' }), b = b64(claims); return `${h}.${b}.${sign('RSA-SHA256', Buffer.from(h + '.' + b), privateKey).toString('base64url')}`; };
const now = Math.floor(Date.now() / 1000);
const good = { iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, sub: '1098', email: 'x@gmail.com', email_verified: true, exp: now + 300 };
const keys = async () => [jwk];
assert((await c.verifyGoogleIdToken(mk(good), env.GOOGLE_CLIENT_ID, keys)).sub === '1098', 'ID token đúng → nhận');
for (const [name, claims] of [['sai aud', { ...good, aud: 'khac' }], ['hết hạn', { ...good, exp: now - 600 }], ['sai iss', { ...good, iss: 'evil' }]]) {
  let failed = false; try { await c.verifyGoogleIdToken(mk(claims), env.GOOGLE_CLIENT_ID, keys); } catch (e) { failed = true; }
  assert(failed, 'ID token ' + name + ' → từ chối');
}
const forged = mk(good).split('.'); forged[1] = b64({ ...good, sub: 'attacker' });
let failed = false; try { await c.verifyGoogleIdToken(forged.join('.'), env.GOOGLE_CLIENT_ID, keys); } catch (e) { failed = true; }
assert(failed, 'ID token bị sửa nội dung → từ chối');

const t = await c.signUpstream('https://backend.composio.dev/tool_router/abc/mcp', env.COMPOSIO_API_KEY);
assert((await c.verifyUpstreamToken(t, env.COMPOSIO_API_KEY))?.hostname === 'backend.composio.dev', 'link MCP ký đúng → nhận');
assert((await c.verifyUpstreamToken(t + 'x', env.COMPOSIO_API_KEY)) === null, 'link MCP bị sửa → từ chối');
