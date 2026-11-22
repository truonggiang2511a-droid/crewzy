// Lấy ảnh/video mà máy chủ MCP khác (OpenArt, Higgsfield, Runway…) trả về, lưu lại thành link cố định của Crewzy
// để hiện trong khung chat và đăng Facebook/Instagram (link gốc của nhà cung cấp thường hết hạn sau vài giờ).
// KV `media:<id>` (90 ngày, metadata ct/uid/src), phục vụ GET /api/media/<id>.<đuôi> có hỗ trợ Range (tua video).
// KV giới hạn 25 MiB mỗi giá trị → file lớn hơn giữ link gốc và báo AI biết link có thể hết hạn.

const MEDIA_TTL = 90 * 86400;
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_PER_CALL = 4;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a' };
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4v|mp3|wav|m4a)(\?|#|$)/i;
const MEDIA_KEY = /(image|img|video|media|output|result|asset|file|download|thumbnail|preview|url|uri|src)/i;

function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
}
const kindOf = (ct) => (ct.startsWith('video/') ? 'video' : ct.startsWith('audio/') ? 'audio' : 'image');
function b64ToBytes(b64) { const bin = atob(b64); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); }

function isPublicHttps(u) {
  try {
    const url = new URL(u);
    const h = url.hostname;
    return url.protocol === 'https:' && h.includes('.') && !/^[\d.]+$/.test(h) && !h.includes(':') && h !== 'localhost';
  } catch (e) { return false; }
}

// Gom các ứng viên ảnh/video từ kết quả tools/call của MCP.
export function findMediaCandidates(result) {
  const out = [];
  const seen = new Set();
  const addUrl = (u, hinted) => {
    const url = String(u).replace(/[),.\]]+$/, '');
    if (seen.has(url) || !isPublicHttps(url)) return;
    if (!hinted && !MEDIA_EXT.test(url)) return;
    seen.add(url);
    out.push({ url, sure: MEDIA_EXT.test(url) });
  };
  const walk = (node, key, depth) => {
    if (depth > 6 || node == null) return;
    if (typeof node === 'string') {
      if (/^https:\/\//.test(node)) addUrl(node, MEDIA_KEY.test(key || ''));
      else for (const m of node.matchAll(/https:\/\/[^\s"'<>)\]]+/g)) addUrl(m[0], false);
      return;
    }
    if (Array.isArray(node)) { node.slice(0, 50).forEach((v) => walk(v, key, depth + 1)); return; }
    if (typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k, depth + 1);
  };
  for (const c of (result && result.content) || []) {
    if ((c.type === 'image' || c.type === 'audio') && c.data) out.push({ data: c.data, ct: c.mimeType || (c.type === 'image' ? 'image/png' : 'audio/mpeg') });
    else if (c.type === 'resource' && c.resource) {
      if (c.resource.blob && /^(image|video|audio)\//.test(c.resource.mimeType || '')) out.push({ data: c.resource.blob, ct: c.resource.mimeType });
      else if (c.resource.uri) addUrl(c.resource.uri, /^(image|video|audio)\//.test(c.resource.mimeType || ''));
      if (c.resource.text) walk(c.resource.text, '', 0);
    } else if (c.type === 'resource_link' && c.uri) addUrl(c.uri, /^(image|video|audio)\//.test(c.mimeType || '') || true);
    else if (c.type === 'text' && c.text) {
      let parsed = null;
      try { parsed = JSON.parse(c.text); } catch (e) { /* chữ thường */ }
      walk(parsed || c.text, '', 0);
    }
  }
  if (result && result.structuredContent) walk(result.structuredContent, '', 0);
  return out.slice(0, MAX_PER_CALL * 2);
}

async function putMedia(env, uid, origin, bytes, ct, src) {
  const id = newId();
  await env.KV.put('media:' + id, bytes, { expirationTtl: MEDIA_TTL, metadata: { ct, uid, src: (src || '').slice(0, 300) } });
  return `${origin}/api/media/${id}.${EXT[ct] || 'bin'}`;
}

// Tải một link về và lưu lại. Trả {kind, link, goc?} hoặc null nếu không phải ảnh/video.
export async function rehostUrl(env, uid, origin, url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^(image|video|audio)\//.test(ct)) { res.body && res.body.cancel(); return null; }
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) { res.body && res.body.cancel(); return { kind: kindOf(ct), link: url, goc: true }; }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { kind: kindOf(ct), link: url, goc: true };
    return { kind: kindOf(ct), link: await putMedia(env, uid, origin, buf, ct, url) };
  } catch (e) {
    console.error('rehost failed', url.slice(0, 120), e && e.message);
    return null;
  } finally { clearTimeout(t); }
}

// Từ kết quả MCP → danh sách ảnh/video đã lưu. seen: Set dùng chung cả lượt chat để không lưu trùng.
export async function collectMedia(env, uid, origin, result, seen) {
  const found = [];
  for (const c of findMediaCandidates(result)) {
    if (found.length >= MAX_PER_CALL) break;
    if (c.data) {
      try {
        const bytes = b64ToBytes(c.data);
        if (bytes.length > MAX_BYTES) continue;
        const ct = EXT[c.ct] ? c.ct : 'image/png';
        found.push({ kind: kindOf(ct), link: await putMedia(env, uid, origin, bytes, ct, 'mcp') });
      } catch (e) { console.error('store media failed', e && e.message); }
      continue;
    }
    if (seen && seen.has(c.url)) continue;
    if (seen) seen.add(c.url);
    const item = await rehostUrl(env, uid, origin, c.url);
    if (item) found.push(item);
  }
  return found;
}

// GET /api/media/<id>.<đuôi> — công khai để Facebook/Instagram/Canva tải được; hỗ trợ Range cho video.
export async function serveMedia(request, env) {
  const m = new URL(request.url).pathname.match(/^\/api\/media\/([a-f0-9]{24})(\.[a-z0-9]{2,4})?$/);
  if (!m) return new Response('Không tìm thấy file', { status: 404 });
  const { value, metadata } = await env.KV.getWithMetadata('media:' + m[1], { type: 'arrayBuffer' });
  if (!value) return new Response('File đã hết hạn hoặc không tồn tại', { status: 404 });
  const ct = (metadata && metadata.ct) || 'application/octet-stream';
  const size = value.byteLength;
  const base = { 'content-type': ct, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(value.slice(start, end + 1), { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  return new Response(value, { headers: { ...base, 'content-length': String(size) } });
}
