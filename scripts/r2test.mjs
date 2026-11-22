// Thử lưu media vào R2 (binding MEDIA) bằng bucket giả: tải lên qua link CREWZY_TAI_LEN, đọc lại, Range (tua video),
// link dùng 1 lần, file lớn hơn 24MB vẫn nhận, file cũ trong KV vẫn mở được, không có R2 thì quay về KV. Chạy: node scripts/r2test.mjs
import assert from 'node:assert/strict';
import uploadRoute from '../src/routes/upload.js';
import { serveMedia, putMedia, rehostUrl, maxBytes } from '../src/lib/media.js';
import { createPutLink } from '../src/lib/uploads.js';

function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k, o) { const v = m.get(k); if (v == null) return null; const t = typeof o === 'string' ? o : o && o.type;
      if (t === 'json') return JSON.parse(v.value); if (t === 'stream') return new Response(v.value).body; return v.value; },
    async put(k, value, opts) { m.set(k, { value, metadata: opts && opts.metadata }); },
    async getWithMetadata(k) { const v = m.get(k); if (!v) return { value: null, metadata: null };
      const val = typeof v.value === 'string' ? new TextEncoder().encode(v.value).buffer : (v.value.buffer ? v.value.buffer.slice(v.value.byteOffset, v.value.byteOffset + v.value.byteLength) : v.value);
      return { value: val, metadata: v.metadata }; },
  };
}
function fakeR2() {
  const m = new Map();
  const info = (k, o) => ({ key: k, size: o.bytes.length, httpEtag: '"e"', httpMetadata: o.httpMetadata, customMetadata: o.customMetadata });
  return {
    m,
    async put(k, data, opts) {
      const bytes = data && typeof data.getReader === 'function' ? new Uint8Array(await new Response(data).arrayBuffer()) : new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);
      m.set(k, { bytes, ...opts });
    },
    async head(k) { const o = m.get(k); return o ? info(k, o) : null; },
    async get(k, opts) {
      const o = m.get(k); if (!o) return null;
      const r = opts && opts.range;
      const bytes = r ? o.bytes.slice(r.offset, r.offset + r.length) : o.bytes;
      return { ...info(k, o), body: new Response(bytes).body };
    },
  };
}

const ORIGIN = 'https://crewzy.test';
const env = { KV: fakeKV(), MEDIA: fakeR2(), SESSION_SECRET: 's' };
assert.equal(maxBytes(env), 95 * 1024 * 1024);
assert.equal(maxBytes({ KV: env.KV }), 24 * 1024 * 1024);

// 1. AI trên máy: xin link → PUT → file nằm trong R2, đọc lại đúng nội dung và loại file.
const video = new Uint8Array(1000).map((_, i) => i % 251);
const link = (await createPutLink(env, ORIGIN, 'khach-test-01', 'video/mp4')).data;
const put = await uploadRoute(new Request(link.put_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': '1000' }, body: video }), env);
assert.equal(put.status, 200, await put.clone().text());
assert.equal((await put.json()).link, link.link_sau_khi_tai);
assert.equal(env.MEDIA.m.size, 1);
assert.equal([...env.KV.m.keys()].filter((k) => k.startsWith('media:')).length, 0, 'không còn ghi video vào KV');
let res = await serveMedia(new Request(link.link_sau_khi_tai), env);
assert.equal(res.status, 200);
assert.equal(res.headers.get('content-type'), 'video/mp4');
assert.deepEqual(new Uint8Array(await res.arrayBuffer()), video);

// 2. Range (trình phát video tua, Facebook tải từng đoạn).
res = await serveMedia(new Request(link.link_sau_khi_tai, { headers: { range: 'bytes=10-19' } }), env);
assert.equal(res.status, 206);
assert.equal(res.headers.get('content-range'), 'bytes 10-19/1000');
assert.deepEqual(new Uint8Array(await res.arrayBuffer()), video.slice(10, 20));
res = await serveMedia(new Request(link.link_sau_khi_tai, { headers: { range: 'bytes=-5' } }), env);
assert.deepEqual(new Uint8Array(await res.arrayBuffer()), video.slice(995));
assert.equal((await serveMedia(new Request(link.link_sau_khi_tai, { headers: { range: 'bytes=5000-' } }), env)).status, 416);

// 3. Link tải lên chỉ dùng 1 lần.
const again = await uploadRoute(new Request(link.put_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': '3' }, body: new Uint8Array(3) }), env);
assert.equal(again.status, 409);

// 4. File 30MB (quá KV, trong hạn R2) vẫn nhận; báo trước content-length lớn hơn 95MB thì từ chối ngay.
const big = (await createPutLink(env, ORIGIN, 'khach-test-01', 'video/mp4')).data;
const bigRes = await uploadRoute(new Request(big.put_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(30 * 1024 * 1024) }, body: new Uint8Array(30 * 1024 * 1024) }), env);
assert.equal(bigRes.status, 200);
const huge = (await createPutLink(env, ORIGIN, 'khach-test-01', 'video/mp4')).data;
const hugeRes = await uploadRoute(new Request(huge.put_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(96 * 1024 * 1024) }, body: new Uint8Array(8) }), env);
assert.equal(hugeRes.status, 413);
assert.match((await hugeRes.json()).error, /95MB/);

// 5. File cũ lưu trong KV trước khi chuyển vẫn mở được.
const oldId = 'a'.repeat(24);
await env.KV.put('media:' + oldId, new Uint8Array([1, 2, 3]), { metadata: { ct: 'image/png' } });
res = await serveMedia(new Request(`${ORIGIN}/api/media/${oldId}.png`), env);
assert.equal(res.status, 200);
assert.deepEqual(new Uint8Array(await res.arrayBuffer()), new Uint8Array([1, 2, 3]));
assert.equal((await serveMedia(new Request(`${ORIGIN}/api/media/${'b'.repeat(24)}.png`), env)).status, 404);

// 6. Tải lại link của nhà cung cấp (HyperFrames, OpenArt…) → vào R2.
globalThis.fetch = async () => new Response(new Uint8Array(500), { headers: { 'content-type': 'video/mp4', 'content-length': '500' } });
const re = await rehostUrl(env, 'khach-test-01', ORIGIN, 'https://cdn.example.com/v.mp4');
assert.equal(re.kind, 'video');
assert.match(re.link, /\/api\/media\/[a-f0-9]{24}\.mp4$/);
assert.equal((await env.MEDIA.head('media/' + re.link.match(/([a-f0-9]{24})/)[1])).size, 500);

// 7. Chưa có binding MEDIA → lưu KV như cũ.
const kvOnly = { KV: fakeKV() };
const l2 = await putMedia(kvOnly, 'u', ORIGIN, new Uint8Array([9]), 'image/png', 't');
assert.equal((await serveMedia(new Request(l2), kvOnly)).status, 200);

console.log('r2test OK');
