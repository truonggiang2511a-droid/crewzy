// Máy dựng video (23/11): node scripts/rendertest.mjs — máy dựng giả (fetch giả), KV + R2 giả.
import assert from 'node:assert/strict';
import { renderVideo, renderOn, RENDER_TOOL_DEFS } from '../src/lib/render.js';
import { mediaQuota } from '../src/lib/quota.js';
import { CREWZY_TOOL_DEFS } from '../src/lib/crewzyTools.js';
import { gatewayBase, appAnthropic } from '../src/lib/ai.js';

const mem = new Map(), r2 = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, v); }, getWithMetadata: async () => ({}) };
const MEDIA = { put: async (k, v) => { r2.set(k, v); }, head: async () => null };
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.authorization });
  return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '8' } });
};
const env0 = { KV, MEDIA };
assert.ok((await renderVideo(env0, 'u1', 'https://x.dev', { html: '<html></html>' })).error.includes('chưa bật'), 'chưa bật máy dựng thì báo rõ');
const env = { ...env0, RENDER_URL: 'https://crewzy-render.x.workers.dev', RENDER_SECRET: 's3' };
assert.ok(renderOn(env));
assert.ok((await renderVideo(env, 'u1', 'https://x.dev', {})).error, 'thiếu html/video');
let r = await renderVideo(env, 'u1', 'https://x.dev', { html: '<html><div data-composition></div></html>', tai_nguyen: [{ ten: 'anh1.jpg', url: 'https://x.dev/api/media/a.jpg' }, { ten: 'x', url: 'http://bad' }], giong: 'https://x.dev/v.mp3', nhac: 'https://x.dev/m.mp3', phu_de: '1\n00:00:00,000 --> 00:00:01,000\nXin chào\n' });
assert.ok(r.data.url.startsWith('https://x.dev/api/media/'), r.error);
assert.deepEqual(calls.map((c) => c.url.split('/').pop()), ['render', 'mix'], 'dựng rồi ghép âm thanh');
assert.equal(calls[0].body.assets.length, 1, 'bỏ link không https');
assert.equal(calls[1].body.video.startsWith('https://x.dev/api/media/'), true, 'ghép trên video vừa dựng');
assert.equal(calls[0].auth, 'Bearer s3');
assert.equal(r2.size, 2);
// Hạn mức dựng theo gói: video_thang 10 → 50 lượt/tháng; gói không có video → 20.
assert.equal(await mediaQuota({ KV }, 'u9', { video_thang: 0 }, 'CREWZY_DUNG_VIDEO'), null);
for (let i = 1; i < 20; i++) await mediaQuota({ KV }, 'u9', { video_thang: 0 }, 'CREWZY_DUNG_VIDEO');
assert.ok((await mediaQuota({ KV }, 'u9', { video_thang: 0 }, 'CREWZY_DUNG_VIDEO')).includes('lượt dựng video'));
assert.ok(CREWZY_TOOL_DEFS.some((t) => t.function.name === 'CREWZY_DUNG_VIDEO') && RENDER_TOOL_DEFS.length === 1);
// AI Gateway
assert.equal(gatewayBase({ AI_GATEWAY_URL: 'https://gateway.ai.cloudflare.com/v1/acc/crewzy/' }), 'https://gateway.ai.cloudflare.com/v1/acc/crewzy');
assert.equal(gatewayBase({ AI_GATEWAY_URL: 'https://evil.example/v1/a/b' }), '');
assert.equal(appAnthropic({ ANTHROPIC_API_KEY: 'k', AI_GATEWAY_URL: 'https://gateway.ai.cloudflare.com/v1/acc/crewzy' }).baseURL, 'https://gateway.ai.cloudflare.com/v1/acc/crewzy/anthropic');
console.log('rendertest OK');
