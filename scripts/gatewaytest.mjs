// Thử cổng MCP (src/routes/mcpGateway.js) như một AI ngoài: danh sách công cụ, chặn công cụ chỉ dành cho Trợ lý trong app,
// quy trình bản MCP không nhắc công cụ AI ngoài không có, đọc nội dung phiếu cũ, tên AI thật khi nhận việc. Không cần mạng.
// Chạy: node scripts/gatewaytest.mjs (đã gộp vào npm test)
import assert from 'node:assert/strict';
import gateway from '../src/routes/mcpGateway.js';
import { signUpstream } from '../src/lib/common.js';
import { WORKFLOWS } from '../src/lib/workflows.js';

const API_KEY = 'ak_test';
const UID = 'khach-test-01';
const UPSTREAM = 'https://backend.composio.dev/tool_router/abc/mcp';

// KV giả trong bộ nhớ.
const store = new Map();
const KV = {
  async get(k, opt) { const v = store.get(k); if (v == null) return null; const t = typeof opt === 'string' ? opt : opt && opt.type; return t === 'json' && typeof v === 'string' ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async getWithMetadata(k) { return { value: store.get(k) ?? null, metadata: null }; },
  async list() { return { keys: [], list_complete: true }; },
};
const env = { COMPOSIO_API_KEY: API_KEY, SESSION_SECRET: 'secret-test', KV };
const waits = [];
const ctx = { waitUntil: (p) => waits.push(p) };

// Composio giả: tools/list trả 1 công cụ, initialize trả máy chủ trống. Mọi gọi khác (SDK Composio) → lỗi để code tự bỏ qua.
let upstreamCalls = 0;
globalThis.fetch = async (url, init = {}) => {
  if (String(url) === UPSTREAM) {
    upstreamCalls++;
    const msg = JSON.parse(new TextDecoder().decode(init.body));
    const result = msg.method === 'tools/list' ? { tools: [{ name: 'COMPOSIO_SEARCH_TOOLS', inputSchema: { type: 'object' } }] }
      : { protocolVersion: '2025-06-18', serverInfo: { name: 'Composio' }, capabilities: { tools: {} } };
    return Response.json({ jsonrpc: '2.0', id: msg.id, result });
  }
  return new Response('offline', { status: 503 });
};

const token = await signUpstream(UPSTREAM, API_KEY, UID);
let n = 0;
async function rpc(method, params) {
  const id = ++n;
  const res = await gateway(new Request('https://crewzy.test/mcp/' + token, {
    method: 'POST', headers: { 'content-type': 'application/json', 'mcp-session-id': 's1' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }), env, ctx);
  const j = await res.json();
  assert.equal(j.id, id);
  return j.result;
}
const call = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args });
  const text = r.content[0].text;
  return { isError: r.isError, text, data: r.isError ? null : JSON.parse(text) };
};

// 1. initialize ghi tên AI thật (clientInfo) để phiếu việc biết ai đang làm.
await rpc('initialize', { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-ai', version: '1' }, capabilities: {} });
await Promise.all(waits);
assert.equal(JSON.parse(store.get('aiseen:' + UID)).ten, 'Claude');

// 2. tools/list: có đủ công cụ Crewzy cho AI ngoài, không lộ công cụ chỉ dành cho Trợ lý trong app.
const names = (await rpc('tools/list', {})).tools.map((t) => t.name);
// 23/11: máy dựng của Crewzy chỉ cho Trợ lý Crewzy, AI của khách không thấy.
{ const tl = (await rpc('tools/list', {})).tools.map((t) => t.name); assert.ok(!tl.includes('CREWZY_DUNG_VIDEO') && !tl.includes('CREWZY_THIET_KE_ANH'), 'máy dựng không lộ qua MCP'); }
// 23/11: bảng duyệt nội dung trong chat (MCP Apps).
{ const tl = (await rpc('tools/list', {})).tools; const xem = tl.find((t) => t.name === 'CREWZY_XEM_NOI_DUNG');
  assert.equal(xem._meta.ui.resourceUri, 'ui://crewzy/duyet.html');
  assert.ok(tl.find((t) => t.name === 'CREWZY_DUYET_HANG_LOAT')._meta.ui.visibility.includes('app'));
  const rr = await rpc('resources/read', { uri: 'ui://crewzy/duyet.html' });
  assert.equal(rr.contents[0].mimeType, 'text/html;profile=mcp-app'); assert.ok(rr.contents[0].text.includes('ui/initialize'));
  assert.ok(rr.contents[0]._meta.ui.csp.resourceDomains.length);
  assert.equal((await rpc('resources/list', {})).resources[0].uri, 'ui://crewzy/duyet.html');
  const xr = await call('CREWZY_XEM_NOI_DUNG', {}); assert.ok(xr.data && 'so_bai' in xr.data); }
for (const want of ['COMPOSIO_SEARCH_TOOLS', 'CREWZY_BRAIN', 'CREWZY_TAO_ANH', 'CREWZY_QUY_TRINH', 'CREWZY_DOC_WEB', 'CREWZY_TAI_LEN', 'CREWZY_VIEC_CAN_LAM', 'CREWZY_NOP_KET_QUA']) {
  assert.ok(names.includes(want), 'thiếu ' + want);
}
for (const hidden of ['CREWZY_TAO_VIDEO', 'CREWZY_CHO']) assert.ok(!names.includes(hidden), 'lộ ' + hidden);

// 3. Gọi thẳng công cụ ẩn qua MCP bị từ chối (không tốn tiền làm video, không treo Worker), không gửi sang Composio.
const before = upstreamCalls;
for (const hidden of ['CREWZY_TAO_VIDEO', 'CREWZY_CHO', 'CREWZY_KHONG_CO']) {
  const r = await call(hidden, { prompt: 'a cat', giay: 30 });
  assert.equal(r.isError, true, hidden);
  assert.match(r.text, /Trợ lý AI|Không có công cụ/);
}
assert.equal(upstreamCalls, before);

// 4. Quy trình trả qua MCP không nhắc công cụ AI ngoài không có (bước, nhóm công cụ, mô tả).
const HIDDEN_RE = /CREWZY_TAO_VIDEO|CREWZY_CHO\b/;
for (const w of WORKFLOWS) {
  const r = await call('CREWZY_QUY_TRINH', { id: w.id });
  assert.equal(r.isError, false, w.id);
  assert.ok(!HIDDEN_RE.test(r.text), w.id + ' còn nhắc công cụ ẩn');
  assert.ok(!/làm video ngắn bằng AI \(credit|tạo ảnh và video \(credit/.test(r.text), w.id + ' còn hứa làm video bằng credit');
}
const vid = (await call('CREWZY_QUY_TRINH', { id: 'video_theo_phong_cach' })).data;
assert.ok(vid.cac_buoc.some((b) => b.includes('kịch bản') && b.includes('prompt')), 'không có công cụ video → nộp kịch bản + prompt');
// 23/11: AI của khách tự do sáng tạo ảnh/video, không theo cách làm của Crewzy, không tự ghép bằng Python/FFmpeg.
const sx = (await call('CREWZY_QUY_TRINH', { id: 'san_xuat_5x5' })).data;
assert.ok(sx.tu_do_sang_tao && sx.tu_do_sang_tao.includes('TỰ DO SÁNG TẠO'));
assert.ok(!/ffmpeg|python/i.test(sx.cac_buoc.join(' ')), 'các bước không bảo AI dùng Python/FFmpeg');
assert.ok(sx.quy_tac.some((q) => q.startsWith('GỢI Ý PROMPT')) && !sx.quy_tac.some((q) => q.startsWith('ĐẠO DIỄN PROMPT')), 'bộ não prompt chỉ là gợi ý');
assert.ok(vid.cac_buoc.some((b) => /Trợ lý Crewzy/.test(b)), 'bước dự phòng phải chỉ khách sang Trợ lý AI để làm video bằng credit');
const listRes = await call('CREWZY_QUY_TRINH', {});
assert.ok(!listRes.text.match(HIDDEN_RE));
// Danh sách phải gọn dưới 12.000 ký tự (chat cắt kết quả công cụ ở 12.000) và vẫn nói rõ quy trình cần chạy trước.
assert.ok(listRes.text.length < 10000, 'danh sách quy trình dài ' + listRes.text.length);
assert.ok(listRes.data.quy_trinh.find((q) => q.id === 'video_theo_phong_cach').thieu.some((t) => /Cần chạy trước: Soi Reels/.test(t)));

// Công cụ nội bộ của máy chủ MCP ngoài (internal_*) không bao giờ đưa cho AI hay lên công tắc.
const { isInternalTool, publicServer, toolMeta } = await import('../src/lib/mcpServers.js');
assert.ok(isInternalTool('internal_widget_event') && isInternalTool('internal-x') && !isInternalTool('compose'));
const ps = publicServer({ id: 's1', tools: 3, toolNames: ['compose', 'internal_widget_event', 'render_video'] });
assert.deepEqual(ps.toolNames, ['compose', 'render_video']);
assert.equal(ps.tools, 2);
assert.deepEqual(toolMeta([{ name: 'internal_a' }, { name: 'b' }]).toolNames, ['b']);

// 5. Nộp báo cáo (trạng thái xong) rồi đọc lại đầy đủ nội dung theo id — để quy trình sau dùng kết quả quy trình trước.
const sub = await call('CREWZY_NOP_KET_QUA', { tieu_de: 'Sổ tay phong cách video', noi_dung: '# Sổ tay\nHook 3 giây: câu hỏi.', loai: 'bao_cao', trang_thai: 'xong', quy_trinh: 'doi_thu_reels' });
assert.equal(sub.isError, false);
const list = (await call('CREWZY_VIEC_CAN_LAM', { tat_ca: true })).data;
const item = list.viec.find((v) => v.id === sub.data.id);
assert.ok(item && item.quy_trinh === 'doi_thu_reels');
const one = (await call('CREWZY_VIEC_CAN_LAM', { id: sub.data.id })).data;
assert.equal(one.viec.length, 1);
assert.match(one.viec[0].ket_qua_da_nop.noi_dung, /Hook 3 giây/);
assert.equal((await call('CREWZY_VIEC_CAN_LAM', { id: 'v-khong-co' })).isError, true);
// Danh sách tóm tắt có cách đọc nội dung (không dồn cả nội dung vào danh sách cho đỡ tốn token).
assert.match(list.huong_dan, /id/);

// 6. Nhận việc ghi tên AI thật (lấy từ lúc initialize), không phải "AI của bạn".
store.set('vpai-jobs:' + UID, store.get('vpai-jobs:' + UID) || '[]');
const jobsKey = [...store.keys()].find((k) => k.includes(UID) && k.includes('job'));
const jobs = JSON.parse(store.get(jobsKey));
jobs.unshift({ id: 'vtodo1', tieu_de: 'Viết 1 bài', loai: 'bai_dang', trang_thai: 'cho_lam', tao_luc: new Date().toISOString() });
store.set(jobsKey, JSON.stringify(jobs));
await call('CREWZY_VIEC_CAN_LAM');
assert.equal(JSON.parse(store.get(jobsKey)).find((j) => j.id === 'vtodo1').nguoi_lam, 'Claude');

console.log('gatewaytest OK');

// ---------- Thu hồi link nối AI (src/lib/mcpLinks.js) ----------
{
  const { addLink, revokeLink, revokeOld, listLinks, deviceLabel } = await import('../src/lib/mcpLinks.js');
  const UID2 = 'khach-thu-hoi-02';
  const init = (tok) => gateway(new Request('https://crewzy.test/mcp/' + tok, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'chatgpt' }, capabilities: {} } }),
  }), env, ctx);
  assert.match(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'), /^iPhone · \d\d\/\d\d \d\d:\d\d$/);
  const k1 = await addLink(env, UID2, 'Máy A');
  const k2 = await addLink(env, UID2, 'Máy B');
  const t1 = await signUpstream(UPSTREAM, API_KEY, UID2, k1);
  const t2 = await signUpstream(UPSTREAM, API_KEY, UID2, k2);
  const tOld = await signUpstream(UPSTREAM, API_KEY, UID2); // link v2, không có mã
  assert.equal((await init(t1)).status, 200);
  await Promise.all(waits);
  assert.equal((await listLinks(env, UID2)).links.find((l) => l.k === k1).dung.ten, 'ChatGPT', 'ghi AI đang dùng link');
  assert.equal(await revokeLink(env, UID2, k1), true);
  const r1 = await init(t1);
  assert.equal(r1.status, 403, 'link đã thu hồi bị chặn');
  assert.match(await r1.text(), /thu hồi/);
  assert.equal((await init(t2)).status, 200, 'link khác vẫn chạy');
  assert.equal((await init(tOld)).status, 200, 'link cũ chạy tới khi thu hồi link cũ');
  await revokeOld(env, UID2);
  assert.equal((await init(tOld)).status, 403, 'thu hồi link cũ');
  assert.equal((await init(t2)).status, 200, 'link có tên không bị ảnh hưởng');
  // Quá 20 link: bỏ link cũ nhất chưa dùng, giữ link đang dùng (k2 đã dùng).
  for (let i = 0; i < 25; i++) await addLink(env, UID2, 'x' + i);
  const after = (await listLinks(env, UID2)).links;
  assert.equal(after.length, 20);
  assert.ok(after.some((l) => l.k === k2), 'giữ link đang dùng');
  // Bật gói: link v1 (không mã khách) bị từ chối.
  const v1 = await signUpstream(UPSTREAM, API_KEY);
  const envBill = { ...env, DB: {}, GOOGLE_CLIENT_ID: 'x.apps.googleusercontent.com' };
  const rv1 = await gateway(new Request('https://crewzy.test/mcp/' + v1, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) }), envBill, ctx);
  assert.equal(rv1.status, 403);
  console.log('gatewaytest: thu hồi link OK');
}
