// Đăng nhập bằng Google.
// GET  /api/auth/me      → { required, clientId, user | null }   (required = đã đặt GOOGLE_CLIENT_ID)
// POST /api/auth/google  { credential, localUid? } → kiểm tra ID token Google, tạo phiên (cookie), trả { user }
// POST /api/auth/logout  → xoá phiên
// Mã khách (dùng cho Composio) gắn với tài khoản Google, lưu trong KV:
//   user:<google sub> → { uid, email, name, picture, createdAt }    uid:<uid> → <google sub>
// Lần đăng nhập đầu, nếu trình duyệt đã có mã khách cũ chưa thuộc ai thì nhận luôn mã đó để giữ các kết nối đã làm.
import {
  UID_PATTERN, SESSION_DAYS, kvGetJson, kvPutJson, getGoogleClientId, readSession, signSession, sessionCookie, verifyGoogleIdToken, safeDetail,
} from '../lib/common.js';
import { ensureAccount, onboarding, isAdminEmail, billingOn } from '../lib/billing.js';

const publicUser = (s) => (s ? { email: s.email || '', name: s.name || '', picture: s.picture || '' } : null);

async function findOrCreateUid(env, claims, localUid) {
  const userKey = 'user:' + claims.sub;
  const existing = await kvGetJson(env, userKey);
  if (existing && UID_PATTERN.test(existing.uid || '')) return existing.uid;

  let uid = 'g-' + String(claims.sub).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  if (UID_PATTERN.test(localUid || '') && !localUid.startsWith('g-')) {
    const owner = await env.KV.get('uid:' + localUid);
    if (!owner) uid = localUid;
  }
  await kvPutJson(env, userKey, { uid, email: claims.email || '', name: claims.name || '', picture: claims.picture || '', createdAt: new Date().toISOString() });
  await env.KV.put('uid:' + uid, String(claims.sub));
  return uid;
}

export default async (req, env) => {
  const path = new URL(req.url).pathname;
  const clientId = getGoogleClientId(env);

  if (path.endsWith('/me')) {
    const session = await readSession(req, env);
    let ob = null;
    if (session && billingOn(env)) {
      try { ob = await onboarding(env, session.uid, { email: session.email, admin: isAdminEmail(env, session.email) }); } catch (e) { console.error('onboarding check failed', e && e.message); }
    }
    return Response.json({ required: !!clientId, clientId, user: publicUser(session), billing: billingOn(env), onboarding: ob, admin: !!(session && isAdminEmail(env, session.email)) }, { headers: { 'cache-control': 'no-store' } });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (path.endsWith('/logout')) {
    return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0) } });
  }

  if (path.endsWith('/google')) {
    if (!clientId) return Response.json({ error: 'Đăng nhập Google chưa được bật.' }, { status: 400 });
    let body;
    try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 }); }
    let claims;
    try {
      claims = await verifyGoogleIdToken(body && body.credential, clientId);
    } catch (err) {
      console.error('google verify failed', err && err.message);
      return Response.json({ error: 'Không xác minh được tài khoản Google, thử lại.', detail: safeDetail(err) }, { status: 401 });
    }
    try {
      const uid = await findOrCreateUid(env, claims, body && body.localUid);
      await ensureAccount(env, uid, claims.email || '').catch((e) => console.error('account create failed', e && e.message));
      const session = {
        uid, sub: String(claims.sub), email: claims.email || '', name: claims.name || '', picture: claims.picture || '',
        exp: Date.now() + SESSION_DAYS * 86400 * 1000,
      };
      return Response.json({ user: publicUser(session) }, { headers: { 'set-cookie': sessionCookie(await signSession(env, session), SESSION_DAYS * 86400) } });
    } catch (err) {
      console.error('login store failed', err && err.message);
      return Response.json({ error: 'Không lưu được tài khoản, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 500 });
    }
  }

  return new Response('Not found', { status: 404 });
};

