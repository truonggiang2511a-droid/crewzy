// Dùng chung cho mọi route của Worker. Biến môi trường/khoá bí mật đọc từ `env` (Cloudflare bindings).
// Mật mã dùng Web Crypto (crypto.subtle) để chạy gọn trên Workers.
import { READY_SLUGS } from './catalog.js';

export const APP_NAME = 'Crewzy';

// Công cụ khách được kết nối thật: các app status 'ready' trong src/lib/catalog.js.
export const TOOLKITS = READY_SLUGS;
// App 'ready' CHƯA thử /api/connect trên trang thật (auth API_KEY nên gần như chắc chạy). Lưới an toàn: tạo phiên lỗi "auth config"
// thì tạo lại không có các app này để chat/link nối AI của mọi người không hỏng. Thử ra link (admin: /api/connect?toolkit=<slug>) rồi xoá khỏi đây.
export const UNVERIFIED = ['vapi', 'retellai', 'bland_ai', 'upload_post', 'higgsfield'];
// Lưới an toàn nhiều tầng (23/11 sửa lỗi "AI gặp lỗi" sau khi thêm Higgsfield): bản cũ ở tầng cuối bỏ app UNVERIFIED khỏi toolkits
// nhưng VẪN giữ tools:{higgsfield:…} → Composio từ chối vì bộ lọc trỏ tới app không có trong phiên → chat chết với mọi khách.
// Giờ: mỗi tầng bỏ app UNVERIFIED khỏi CẢ toolkits lẫn tools, không phụ thuộc chữ trong thông báo lỗi; tầng cuối là cấu hình tối thiểu.
const dropKeys = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
  return Object.keys(out).length ? out : undefined;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
export async function createSession(composio, userId, opts) {
  const safeToolkits = opts.toolkits ? opts.toolkits.filter((t) => !UNVERIFIED.includes(t)) : undefined;
  const { tools, instant, ...base } = opts;
  const attempts = [
    opts,
    // Bỏ app chưa kiểm chứng (cả bộ lọc tools của chúng), giữ Instant cho các app khác.
    clean({ ...opts, toolkits: safeToolkits, tools: dropKeys(tools, UNVERIFIED) }),
    // Tối thiểu: không tools, không instant, không app chưa kiểm chứng.
    clean({ ...base, toolkits: safeToolkits }),
  ];
  let lastErr;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const s = await composio.create(userId, attempts[i]);
      if (i > 0) console.error('composio.create ok at fallback', i);
      return s;
    } catch (e) {
      lastErr = e;
      console.error('composio.create failed', i, e && e.message);
    }
  }
  throw lastErr;
}
export const MAX_ACCOUNTS_PER_TOOLKIT = 5;
export const UID_PATTERN = /^[a-z0-9-]{8,64}$/;

// Giữ tiền tố cũ 'vpai-' để các kết nối Composio đã làm trên bản Netlify vẫn dùng được.
export const userIdFor = (uid) => `vpai-${uid}`;

export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });

export function safeDetail(err) {
  const text = String((err && (err.message || err)) || '').replace(/\b[a-z]{2}_[A-Za-z0-9*_-]+/g, '***');
  return text.slice(0, 300);
}

export const getApiKey = (env) => env.COMPOSIO_API_KEY || '';
export const getGoogleClientId = (env) => (env.GOOGLE_CLIENT_ID || '').trim();

// ---------- base64url + HMAC ----------
const enc = new TextEncoder();
export function toB64Url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64Url(text) {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(text).length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
export const b64UrlText = (text) => toB64Url(enc.encode(text));
export const textFromB64Url = (b64) => new TextDecoder().decode(fromB64Url(b64));

export function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(secretText, payload) {
  const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode(secretText));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64Url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

// Link nối AI: token = base64url(payload) + '.' + HMAC (khoá suy ra từ COMPOSIO_API_KEY). Cổng /mcp/* kiểm tra lại.
// v2: payload = JSON {u: link phiên Composio, id: mã khách} (cổng biết khách là ai để thêm Brain, Skill, công cụ Crewzy).
// v1 (link cũ): payload = link phiên Composio, vẫn chạy nhưng không có phần Crewzy.
// v3: thêm k = mã link (src/lib/mcpLinks.js) để khách thu hồi từng link; link v2 không có k thu hồi bằng "Thu hồi link cũ".
export async function signUpstream(upstreamUrl, apiKey, uid, linkId) {
  const payload = b64UrlText(uid ? JSON.stringify(linkId ? { u: upstreamUrl, id: uid, k: linkId } : { u: upstreamUrl, id: uid }) : upstreamUrl);
  return `${payload}.${await hmac('vpai-mcp|' + apiKey, payload)}`;
}
export async function verifyUpstreamToken(token, apiKey) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  if (!sameText(await hmac('vpai-mcp|' + apiKey, payload), sig)) return null;
  try {
    const text = textFromB64Url(payload);
    if (text.startsWith('{')) {
      const j = JSON.parse(text);
      const url = new URL(j.u);
      url.crewzyUid = UID_PATTERN.test(j.id || '') ? j.id : null;
      url.crewzyLink = /^[a-z0-9]{6,16}$/.test(j.k || '') ? j.k : null;
      return url;
    }
    return new URL(text);
  } catch (e) { return null; }
}

// Mã ký dùng chung cho link có hạn (vd link tải file lên cho AI): base64url(JSON) + '.' + HMAC theo mục đích.
export async function signData(env, purpose, data) {
  const payload = b64UrlText(JSON.stringify(data));
  return `${payload}.${await hmac('crewzy-' + purpose + '|' + sessionSecret(env), payload)}`;
}
export async function verifyData(env, purpose, token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  if (!sameText(await hmac('crewzy-' + purpose + '|' + sessionSecret(env), payload), sig)) return null;
  try { const d = JSON.parse(textFromB64Url(payload)); return d && (!d.e || d.e > Date.now()) ? d : null; } catch (e) { return null; }
}

// ---------- Phiên đăng nhập ----------
// Cookie vpai_session = base64url(JSON) + '.' + HMAC. Khoá ký: SESSION_SECRET, chưa đặt thì suy ra từ COMPOSIO_API_KEY.
export const SESSION_COOKIE = 'vpai_session';
export const SESSION_DAYS = 30;
const sessionSecret = (env) => env.SESSION_SECRET || ('vpai-session|' + getApiKey(env));

export async function signSession(env, data) {
  const payload = b64UrlText(JSON.stringify(data));
  return `${payload}.${await hmac(sessionSecret(env), payload)}`;
}

export function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export async function readSession(req, env) {
  const token = readCookie(req, SESSION_COOKIE);
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  if (!sameText(await hmac(sessionSecret(env), payload), token.slice(dot + 1))) return null;
  try {
    const data = JSON.parse(textFromB64Url(payload));
    if (!data || !data.uid || !UID_PATTERN.test(data.uid) || !(data.exp > Date.now())) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export const sessionCookie = (token, maxAgeSeconds) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

// Mã khách cho Composio. Đã bật đăng nhập Google (có GOOGLE_CLIENT_ID) thì chỉ tin phiên; chưa bật thì dùng mã trình duyệt gửi lên.
export async function resolveUid(req, env, fallbackUid) {
  const session = await readSession(req, env);
  if (session) return { uid: session.uid, session };
  if (getGoogleClientId(env)) return { response: json({ error: 'Bạn cần đăng nhập lại.', login: true }, 401) };
  if (!UID_PATTERN.test(fallbackUid || '')) return { response: json({ error: 'Mã khách không hợp lệ.' }, 400) };
  return { uid: fallbackUid };
}

// ---------- Xác minh ID token Google (RS256, khoá công khai JWKS) ----------
let jwksCache = { at: 0, keys: [] };
async function googleKeys(force) {
  if (!force && jwksCache.keys.length && Date.now() - jwksCache.at < 3600 * 1000) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('Không tải được khoá của Google (' + res.status + ')');
  jwksCache = { at: Date.now(), keys: (await res.json()).keys || [] };
  return jwksCache.keys;
}

export async function verifyGoogleIdToken(idToken, clientId, getKeys = googleKeys) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Mã đăng nhập không đúng dạng');
  const header = JSON.parse(textFromB64Url(parts[0]));
  const claims = JSON.parse(textFromB64Url(parts[1]));
  if (header.alg !== 'RS256') throw new Error('Thuật toán ký không hợp lệ');
  let jwk = (await getKeys(false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Không tìm thấy khoá ký của Google');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64Url(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('Chữ ký không hợp lệ');
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') throw new Error('Nơi cấp không hợp lệ');
  if (claims.aud !== clientId) throw new Error('Mã đăng nhập không dành cho app này');
  if (!(claims.exp > now - 60)) throw new Error('Mã đăng nhập đã hết hạn');
  if (!claims.sub) throw new Error('Thiếu mã người dùng');
  if (claims.email && claims.email_verified === false) throw new Error('Email Google chưa xác minh');
  return claims;
}

// ---------- Mã hoá bí mật lưu KV (token MCP ngoài) ----------
// AES-GCM, khoá suy ra từ SESSION_SECRET (chưa đặt thì từ COMPOSIO_API_KEY). Đổi khoá → token cũ không giải được, khách nối lại.
async function boxKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('crewzy-box|' + sessionSecret(env)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function sealText(env, text) {
  if (!text) return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await boxKey(env), enc.encode(String(text)));
  return toB64Url(iv) + '.' + toB64Url(ct);
}
export async function openText(env, sealed) {
  if (!sealed) return '';
  try {
    const [iv, ct] = String(sealed).split('.');
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64Url(iv) }, await boxKey(env), fromB64Url(ct));
    return new TextDecoder().decode(out);
  } catch (e) { return ''; }
}

// ---------- KV (thay Netlify Blobs) ----------
// Khoá: user:<google sub> · uid:<uid> · brand:<uid> · usage:<ngày>:<uid|all>
export const kvGetJson = (env, key) => env.KV.get(key, { type: 'json' });
export const kvPutJson = (env, key, value, opts) => env.KV.put(key, JSON.stringify(value), opts);
