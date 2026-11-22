// Lấy ảnh/video mà máy chủ MCP khác (OpenArt, Higgsfield, Runway…) trả về, lưu lại thành link cố định của Crewzy
// để hiện trong khung chat và đăng Facebook/Instagram (link gốc của nhà cung cấp thường hết hạn sau vài giờ).
// Từ 22/11/2026 lưu vào R2 (binding MEDIA, bucket crewzy-media, khoá media/<id>): miễn phí 10GB, không tính băng thông,
// file tới 95MB (Worker nhận thân tối đa 100MB). Chưa có binding MEDIA thì lưu KV `media:<id>` như cũ (90 ngày, ≤24MB).
// GET /api/media/<id>.<đuôi> đọc R2 trước rồi tới KV (file cũ trước khi chuyển vẫn mở được), có hỗ trợ Range (tua video).
// File lớn hơn giới hạn → giữ link gốc và báo AI biết link có thể hết hạn.

const MEDIA_TTL = 90 * 86400;
export const MAX_BYTES_KV = 24 * 1024 * 1024;
export const MAX_BYTES_R2 = 95 * 1024 * 1024;
export const MAX_BYTES = MAX_BYTES_KV; // giữ tên cũ cho nơi chưa có env
export const maxBytes = (env) => (env && env.MEDIA ? MAX_BYTES_R2 : MAX_BYTES_KV);
export const maxLabel = (env) => Math.round(maxBytes(env) / 1024 / 1024) + 'MB';
const r2Key = (id) => 'media/' + id;
const MAX_PER_CALL = 4;
export const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a' };
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4v|mp3|wav|m4a)(\?|#|$)/i;
const MEDIA_KEY = /(image|img|video|media|output|result|asset|file|download|thumbnail|preview|url|uri|src)/i;

export function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
}
export const kindOf = (ct) => (ct.startsWith('video/') ? 'video' : ct.startsWith('audio/') ? 'audio' : 'image');
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

// Luồng có độ dài biết trước → đưa thẳng vào R2 không giữ cả file trong bộ nhớ (FixedLengthStream của Workers);
// không biết độ dài hoặc chạy ngoài Workers (test) thì đọc hết rồi lưu.
async function bodyFor(stream, len) {
  if (len > 0 && typeof FixedLengthStream === 'function') {
    const f = new FixedLengthStream(len);
    stream.pipeTo(f.writable).catch((e) => console.error('media pipe failed', e && e.message));
    return f.readable;
  }
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// body: Uint8Array/ArrayBuffer hoặc ReadableStream (khi đó truyền len = content-length).
export async function putMedia(env, uid, origin, body, ct, src, fixedId, len) {
  const id = fixedId || newId();
  const meta = { uid: String(uid || ''), src: (src || '').slice(0, 300) };
  if (env.MEDIA) {
    const data = body && typeof body.getReader === 'function' ? await bodyFor(body, len || 0) : body;
    await env.MEDIA.put(r2Key(id), data, { httpMetadata: { contentType: ct }, customMetadata: meta });
  } else {
    const data = body && typeof body.getReader === 'function' ? new Uint8Array(await new Response(body).arrayBuffer()) : body;
    await env.KV.put('media:' + id, data, { expirationTtl: MEDIA_TTL, metadata: { ct, ...meta } });
  }
  return `${origin}/api/media/${id}.${EXT[ct] || 'bin'}`;
}

// Mã file đã có chưa (link tải lên dùng 1 lần).
export async function mediaExists(env, id) {
  if (env.MEDIA && (await env.MEDIA.head(r2Key(id)))) return true;
  const v = await env.KV.get('media:' + id, { type: 'stream' });
  if (v) { v.cancel(); return true; }
  return false;
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
    const max = maxBytes(env);
    if (len > max) { res.body && res.body.cancel(); return { kind: kindOf(ct), link: url, goc: true }; }
    if (len > 0 && env.MEDIA) return { kind: kindOf(ct), link: await putMedia(env, uid, origin, res.body, ct, url, null, len) };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > max) return { kind: kindOf(ct), link: url, goc: true };
    return { kind: kindOf(ct), link: await putMedia(env, uid, origin, buf, ct, url) };
  } catch (e) {
    console.error('rehost failed', url.slice(0, 120), e && e.message);
    return null;
  } finally { clearTimeout(t); }
}

// Từ kết quả MCP → danh sách ảnh/video đã lưu. seen: Set dùng chung cả lượt chat để không lưu trùng.
// Công cụ đọc/tìm (scrape, search, list…) trả về rất nhiều link ảnh của trang web → chỉ lấy ảnh dạng dữ liệu, không tải link.
const READ_TOOL = /(scrape|crawl|search|read|list|parse|extract|fetch|browse|map|wiki|docs|query)/i;
const MAKE_TOOL = /(generat|create|render|image|video|edit|upscale|animate|status|result|job|task|download|output)/i;
export function wantsLinkMedia(toolName) {
  return !toolName || !READ_TOOL.test(toolName) || MAKE_TOOL.test(toolName);
}

export async function collectMedia(env, uid, origin, result, seen, toolName) {
  const found = [];
  const linksOk = wantsLinkMedia(toolName);
  for (const c of findMediaCandidates(result)) {
    if (!c.data && !linksOk) continue;
    if (found.length >= MAX_PER_CALL) break;
    if (c.data) {
      try {
        const bytes = b64ToBytes(c.data);
        if (bytes.length > maxBytes(env)) continue;
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
  if (env.MEDIA) {
    const r = await serveR2(request, env, m[1]);
    if (r) return r;
  }
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

// Đọc từ R2: không có file → null (thử tiếp KV). Range "bytes=a-b" | "bytes=a-" | "bytes=-n".
async function serveR2(request, env, id) {
  const head = await env.MEDIA.head(r2Key(id));
  if (!head) return null;
  const size = head.size;
  const base = { 'content-type': (head.httpMetadata && head.httpMetadata.contentType) || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400', etag: head.httpEtag };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    const obj = await env.MEDIA.get(r2Key(id), { range: { offset: start, length: end - start + 1 } });
    if (!obj) return null;
    return new Response(obj.body, { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  const obj = await env.MEDIA.get(r2Key(id));
  if (!obj) return null;
  return new Response(obj.body, { headers: { ...base, 'content-length': String(size) } });
}
