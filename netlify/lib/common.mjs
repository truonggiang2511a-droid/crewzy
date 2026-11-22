// Dùng chung cho các hàm máy chủ.
import { READY_SLUGS } from './catalog.mjs';
import { createHash, createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';

// Công cụ khách được kết nối thật: các app status 'ready' trong netlify/lib/catalog.mjs.
export const TOOLKITS = READY_SLUGS;
export const MAX_ACCOUNTS_PER_TOOLKIT = 5;
export const UID_PATTERN = /^[a-z0-9-]{8,64}$/;

export const userIdFor = (uid) => `vpai-${uid}`;

export function safeDetail(err) {
  const text = String((err && (err.message || err)) || '').replace(/\b[a-z]{2}_[A-Za-z0-9*_-]+/g, '***');
  return text.slice(0, 300);
}

export function getApiKey() {
  return Netlify.env.get('COMPOSIO_API_KEY') || '';
}

// Ký link MCP: token = base64url(link Composio) + '.' + HMAC-SHA256. Khoá ký suy ra từ COMPOSIO_API_KEY,
// edge function mcp-gateway kiểm tra bằng đúng cách này (Web Crypto).
export function signUpstream(upstreamUrl, apiKey) {
  const payload = Buffer.from(upstreamUrl, 'utf8').toString('base64url');
  const key = createHash('sha256').update('vpai-mcp|' + apiKey, 'utf8').digest();
  const sig = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
  return `${payload}.${sig}`;
}

// ---------- Đăng nhập Google + phiên đăng nhập ----------
// Phiên = cookie vpai_session: base64url(JSON) + '.' + HMAC-SHA256. Khoá ký lấy SESSION_SECRET,
// chưa đặt thì suy ra từ COMPOSIO_API_KEY (đổi khoá Composio thì mọi người phải đăng nhập lại).
export const SESSION_COOKIE = 'vpai_session';
export const SESSION_DAYS = 30;

export function getGoogleClientId() {
  return (Netlify.env.get('GOOGLE_CLIENT_ID') || '').trim();
}

function sessionKey() {
  const secret = Netlify.env.get('SESSION_SECRET') || ('vpai-session|' + getApiKey());
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function signSession(data) {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = createHmac('sha256', sessionKey()).update(payload, 'utf8').digest('base64url');
  return `${payload}.${sig}`;
}

export function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export function readSession(req) {
  const token = readCookie(req, SESSION_COOKIE);
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = createHmac('sha256', sessionKey()).update(payload, 'utf8').digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.uid || !UID_PATTERN.test(data.uid) || !(data.exp > Date.now())) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function sessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

// Mã khách dùng cho Composio. Đã bật đăng nhập Google (có GOOGLE_CLIENT_ID) thì chỉ tin phiên đăng nhập;
// chưa bật thì dùng mã trình duyệt gửi lên như bản thử cũ.
export function resolveUid(req, fallbackUid) {
  const session = readSession(req);
  if (session) return { uid: session.uid, session };
  if (getGoogleClientId()) {
    return { response: Response.json({ error: 'Bạn cần đăng nhập lại.', login: true }, { status: 401 }) };
  }
  if (!UID_PATTERN.test(fallbackUid || '')) {
    return { response: Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 }) };
  }
  return { uid: fallbackUid };
}

// Kiểm tra ID token của Google (RS256) bằng khoá công khai của Google, không gọi tokeninfo.
let jwksCache = { at: 0, keys: [] };

async function googleKeys(force) {
  if (!force && jwksCache.keys.length && Date.now() - jwksCache.at < 3600 * 1000) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('Không tải được khoá của Google (' + res.status + ')');
  const body = await res.json();
  jwksCache = { at: Date.now(), keys: body.keys || [] };
  return jwksCache.keys;
}

export async function verifyGoogleIdToken(idToken, clientId, getKeys = googleKeys) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Mã đăng nhập không đúng dạng');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('Thuật toán ký không hợp lệ');
  let jwk = (await getKeys(false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Không tìm thấy khoá ký của Google');
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1], 'utf8'),
    createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('Chữ ký không hợp lệ');
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw new Error('Nơi cấp không hợp lệ');
  if (claims.aud !== clientId) throw new Error('Mã đăng nhập không dành cho app này');
  if (!(claims.exp > now - 60)) throw new Error('Mã đăng nhập đã hết hạn');
  if (!claims.sub) throw new Error('Thiếu mã người dùng');
  if (claims.email && claims.email_verified === false) throw new Error('Email Google chưa xác minh');
  return claims;
}
