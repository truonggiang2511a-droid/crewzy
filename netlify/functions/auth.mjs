// Đăng nhập bằng Google.
// GET  /api/auth/me      → { required, clientId, user | null }   (required = đã đặt GOOGLE_CLIENT_ID)
// POST /api/auth/google  { credential, localUid? } → kiểm tra ID token Google, tạo phiên (cookie), trả { user }
// POST /api/auth/logout  → xoá phiên
// Mã khách (dùng cho Composio) gắn với tài khoản Google, lưu trong Netlify Blobs "vpai-users":
//   user:<google sub> → { uid, email, name, picture, createdAt }    uid:<uid> → <google sub>
// Lần đăng nhập đầu, nếu trình duyệt đã có mã khách cũ chưa thuộc ai thì nhận luôn mã đó để giữ các kết nối đã làm.
import { getStore } from '@netlify/blobs';
import {
  UID_PATTERN, SESSION_DAYS, getGoogleClientId, readSession, signSession, sessionCookie, verifyGoogleIdToken, safeDetail,
} from '../lib/common.mjs';

const publicUser = (s) => (s ? { email: s.email || '', name: s.name || '', picture: s.picture || '' } : null);

async function findOrCreateUid(claims, localUid) {
  const store = getStore({ name: 'vpai-users', consistency: 'strong' });
  const userKey = 'user:' + claims.sub;
  const existing = await store.get(userKey, { type: 'json' });
  if (existing && UID_PATTERN.test(existing.uid || '')) return existing.uid;

  let uid = 'g-' + String(claims.sub).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  if (UID_PATTERN.test(localUid || '') && !localUid.startsWith('g-')) {
    const owner = await store.get('uid:' + localUid);
    if (!owner) uid = localUid;
  }
  await store.setJSON(userKey, { uid, email: claims.email || '', name: claims.name || '', picture: claims.picture || '', createdAt: new Date().toISOString() });
  await store.set('uid:' + uid, String(claims.sub));
  return uid;
}

export default async (req) => {
  const path = new URL(req.url).pathname;
  const clientId = getGoogleClientId();

  if (path.endsWith('/me')) {
    const session = readSession(req);
    return Response.json({ required: !!clientId, clientId, user: publicUser(session) }, { headers: { 'cache-control': 'no-store' } });
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
      const uid = await findOrCreateUid(claims, body && body.localUid);
      const session = {
        uid, sub: String(claims.sub), email: claims.email || '', name: claims.name || '', picture: claims.picture || '',
        exp: Date.now() + SESSION_DAYS * 86400 * 1000,
      };
      return Response.json({ user: publicUser(session) }, { headers: { 'set-cookie': sessionCookie(signSession(session), SESSION_DAYS * 86400) } });
    } catch (err) {
      console.error('login store failed', err && err.message);
      return Response.json({ error: 'Không lưu được tài khoản, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 500 });
    }
  }

  return new Response('Not found', { status: 404 });
};

export const config = { path: ['/api/auth/me', '/api/auth/google', '/api/auth/logout'] };
