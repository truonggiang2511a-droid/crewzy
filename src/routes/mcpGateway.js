// Cổng MCP: khách dán https://<site>/mcp/<token> vào Claude / ChatGPT / Gemini / Grok.
// Cổng kiểm tra chữ ký token rồi chuyển tiếp yêu cầu MCP tới phiên Composio (gắn x-api-key ở máy chủ, khách không thấy khoá).
// Với token v2 (có mã khách), cổng còn:
//   - initialize: chèn "instructions" = cách làm việc + Brain thương hiệu + app đã kết nối + Skill từng app
//   - tools/list: thêm công cụ CREWZY_TAO_ANH, CREWZY_BRAIN vào danh sách công cụ Composio
//   - tools/call CREWZY_*: tự chạy trong Worker (không gửi Composio)
//   - máy chủ MCP khách nối ở Kết nối → MCP khác (OpenArt, Apify, Metricool…): thêm công cụ m<id4>_<tool> vào tools/list,
//     tools/call chạy thẳng tới máy chủ đó (token OAuth giữ ở Crewzy), ảnh/video lưu thành link /api/media cố định
import { Composio } from '@composio/core';
import { linkAllowed, touchLink } from '../lib/mcpLinks.js';
import { APP_NAME, getApiKey, verifyUpstreamToken, userIdFor } from '../lib/common.js';
import { skillText, appBySlug } from '../lib/catalog.js';
import { getBrand, brandText } from '../lib/brand.js';
import { CREWZY_TOOL_DEFS, isCrewzyTool, runCrewzyTool, imageShortcut } from '../lib/crewzyTools.js';
import { UI_URI, publishUiHtml } from '../lib/publish.js';
import { recordActivity } from '../lib/activity.js';
import { MCP_PROMPTS } from '../lib/jobs.js';
import { APP_ONLY_TOOLS, MCP_MEDIA_FREE } from '../lib/workflows.js';
import { billingOn, gate, makeMeter, getFeatures, applyFeatures } from '../lib/billing.js';
import { postQuota, mediaQuota, planNote } from '../lib/quota.js';
import { memBlock, MEM_RULE } from '../lib/memory.js';
import { loadExternalTools, callExternalTool, EXTERNAL_TOOL_RE, listServers } from '../lib/mcpServers.js';
import { collectMedia } from '../lib/media.js';

const plain = (status, text) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

// Công cụ Crewzy đưa ra link MCP. CREWZY_TAO_VIDEO, CREWZY_CHO chỉ dùng trong Trợ lý AI của app (APP_ONLY_TOOLS):
// không liệt kê VÀ không cho gọi thẳng qua MCP (gọi đúng tên vẫn bị chặn, tránh tốn tiền làm video / treo Worker).
// MCP Apps (Claude, ChatGPT): CREWZY_XEM_NOI_DUNG vẽ bảng duyệt ngay trong chat (ui://crewzy/duyet.html); bảng gọi được CREWZY_DUYET_HANG_LOAT.
const UI_META = { CREWZY_XEM_NOI_DUNG: { ui: { resourceUri: UI_URI, visibility: ['model', 'app'] } }, CREWZY_DUYET_HANG_LOAT: { ui: { visibility: ['model', 'app'] } } };
const MCP_TOOLS = CREWZY_TOOL_DEFS.filter((t) => !APP_ONLY_TOOLS.includes(t.function.name)).map((t) => ({ name: t.function.name, description: t.function.description, inputSchema: t.function.parameters, ...(UI_META[t.function.name] ? { _meta: UI_META[t.function.name] } : {}) }));
const MCP_TOOL_NAMES = new Set(MCP_TOOLS.map((t) => t.name));

// Tên AI của khách ghi lúc initialize (aiseen:<uid>) — để phiếu việc ghi "Claude nhận việc" thay vì "AI của bạn".
async function seenAi(env, uid) {
  try { const v = await env.KV.get('aiseen:' + uid, { type: 'json' }); return (v && v.ten) || 'AI của bạn'; } catch (e) { return 'AI của bạn'; }
}

async function connectedApps(env, uid) {
  try {
    const composio = new Composio({ apiKey: getApiKey(env) });
    const res = await composio.connectedAccounts.list({ userIds: [userIdFor(uid)], statuses: ['ACTIVE'], limit: 100 });
    return [...new Set((res.items || []).map((i) => i.toolkit && i.toolkit.slug).filter(Boolean))];
  } catch (e) {
    console.error('mcp list connected failed', e && e.message);
    return [];
  }
}

async function buildInstructions(env, uid) {
  const [slugs, brand, servers] = await Promise.all([connectedApps(env, uid), getBrand(env, uid).catch(() => null), listServers(env, uid).catch(() => [])]);
  const names = slugs.map((s) => (appBySlug(s) || { name: s }).name);
  const parts = [
    `Bạn đang làm việc cho một doanh nghiệp qua ${APP_NAME}. Dùng công cụ Composio để làm việc thật trên các app khách đã kết nối:`,
    'tìm công cụ bằng COMPOSIO_SEARCH_TOOLS → chạy bằng COMPOSIO_MULTI_EXECUTE_TOOL. ' + MCP_MEDIA_FREE,
    'Luôn trả lời bằng tiếng Việt. Trước khi đăng bài, gửi tin/email cho người khác, xoá dữ liệu hay chi tiền quảng cáo: tóm tắt và hỏi người dùng đồng ý.',
    'Không bịa giá, số liệu; không đưa số điện thoại khách lên bài công khai. Làm ra kết quả thật (bài đăng, ảnh, báo cáo), không đẩy việc về cho người dùng.',
    'Quy trình chuẩn: khi chạy một quy trình (hoặc phiếu việc có quy_trinh), gọi CREWZY_QUY_TRINH với id để lấy đúng các bước, kiểm tra app thiếu và làm đúng thứ tự. Lệnh nhanh: prompts qt_<mã>.',
    'Phiếu việc: khách giao việc trong Crewzy → xem bằng CREWZY_VIEC_CAN_LAM. Làm xong MỌI sản phẩm (bài viết, báo cáo, kịch bản, danh sách khách, ảnh/video, file bạn tạo bằng skill của mình) thì nộp về Crewzy bằng CREWZY_NOP_KET_QUA (ghi nguoi_lam là tên của bạn) để khách duyệt, đăng và xem báo cáo. Việc khách đã duyệt (da_duyet): đăng/gửi rồi nộp lại trạng thái da_dang kèm link. Khách bảo "đăng luôn" ngay trong cuộc trò chuyện thì đó là đồng ý: đăng ngay rồi nộp phiếu trạng thái da_dang kèm link (không cần chờ duyệt trong Crewzy).',
    '# Brain thương hiệu\n' + (brandText(brand) || 'Chưa điền (người dùng điền ở trang Brain thương hiệu của Crewzy). Hỏi khi cần.'),
    '# App đã kết nối\n' + (names.length ? names.join(', ') : 'Chưa có. Người dùng kết nối ở trang Kết nối của Crewzy.'),
  ];
  if (servers.length) {
    parts.push('# Máy chủ MCP đã nối trong Crewzy\n' + servers.map((x) => `${x.name}: công cụ có tiền tố m${x.id.slice(1, 5)}_`).join('; ')
      + '\nGọi thẳng các công cụ này (Crewzy giữ đăng nhập). Kết quả có ảnh/video thì dùng link trong media_crewzy để đăng hoặc nộp phiếu (link gốc của nhà cung cấp hay hết hạn).');
  }
  const skills = skillText(slugs);
  if (skills) parts.push('# Skill từng app\n' + skills);
  const note = planNote(await getFeatures(env, uid).catch(() => null));
  if (note) parts.push(note);
  const mem = await memBlock(env, uid).catch(() => '');
  parts.push(MEM_RULE + (mem ? '\n' + mem : ''));
  return { text: parts.join('\n'), names };
}

// Sửa kết quả JSON-RPC trong phản hồi của Composio (JSON thường hoặc SSE "data: {...}").
function rewriteRpc(text, contentType, id, fn) {
  const patch = (obj) => { if (obj && obj.id === id && obj.result) fn(obj.result); return obj; };
  if ((contentType || '').includes('text/event-stream')) {
    return text.split('\n').map((line) => {
      if (!line.startsWith('data:')) return line;
      try { return 'data: ' + JSON.stringify(patch(JSON.parse(line.slice(5).trim()))); } catch (e) { return line; }
    }).join('\n');
  }
  try { return JSON.stringify(patch(JSON.parse(text))); } catch (e) { return text; }
}

// Tên thân thiện cho AI của khách từ clientInfo.name (claude-ai, claude-code, openai-mcp, codex-mcp-client, cursor…).
function aiName(raw) {
  const n = String(raw || '').toLowerCase();
  if (n.includes('claude-code') || n.includes('claude code')) return 'Claude Code';
  if (n.includes('claude')) return 'Claude';
  if (n.includes('codex')) return 'Codex';
  if (n.includes('openai') || n.includes('chatgpt')) return 'ChatGPT';
  if (n.includes('gemini')) return 'Gemini';
  if (n.includes('grok') || n.includes('xai')) return 'Grok';
  if (n.includes('cursor')) return 'Cursor';
  return raw ? String(raw).slice(0, 30) : 'AI của bạn';
}

export default async (request, env, ctx) => {
  const apiKey = getApiKey(env);
  if (!apiKey) return plain(500, 'Máy chủ chưa có khoá COMPOSIO_API_KEY.');
  const reqUrl = new URL(request.url);
  const token = reqUrl.pathname.replace(/^\/mcp\//, '').split('/')[0];
  const upstream = await verifyUpstreamToken(token, apiKey);
  if (!upstream) return plain(403, 'Link nối AI không hợp lệ hoặc đã bị đổi.');
  if (upstream.protocol !== 'https:' || !upstream.hostname.endsWith('composio.dev')) return plain(403, 'Link nối AI không trỏ tới Composio.');
  const uid = upstream.crewzyUid || null;
  // Bật gói: link v1 (không có mã khách) không tính được credit → bắt tạo link mới. Link đã thu hồi → từ chối.
  if (!uid && billingOn(env)) return plain(403, 'Link nối AI này đã cũ. Vào Crewzy → Kết nối → AI của bạn để tạo link mới.');
  if (uid && !(await linkAllowed(env, uid, upstream.crewzyLink).catch(() => true))) {
    return plain(403, 'Link nối AI này đã bị thu hồi. Vào Crewzy → Kết nối → AI của bạn để tạo link mới rồi nối lại.');
  }

  let bodyBuf = null;
  let rpc = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    bodyBuf = await request.arrayBuffer();
    if (uid) { try { rpc = JSON.parse(new TextDecoder().decode(bodyBuf)); } catch (e) { rpc = null; } }
  }
  if (Array.isArray(rpc)) rpc = null; // gói nhiều yêu cầu: chuyển thẳng, không thêm phần Crewzy

  // Câu lệnh mẫu (MCP prompts): Claude Code hiện thành /mcp__crewzy__<tên>.
  if (rpc && (rpc.method === 'prompts/list' || rpc.method === 'prompts/get')) {
    const sid = { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } };
    if (rpc.method === 'prompts/list') {
      return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { prompts: MCP_PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description })) } }, sid);
    }
    const p = MCP_PROMPTS.find((x) => x.name === (rpc.params && rpc.params.name));
    if (!p) return Response.json({ jsonrpc: '2.0', id: rpc.id, error: { code: -32602, message: 'Không có câu lệnh này' } }, sid);
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text } }] } }, sid);
  }

  // Tài nguyên giao diện (MCP Apps): bảng duyệt nội dung. Crewzy tự trả lời, không gửi Composio.
  if (rpc && (rpc.method === 'resources/list' || rpc.method === 'resources/read' || rpc.method === 'resources/templates/list')) {
    const sid = { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } };
    const res0 = { uri: UI_URI, name: 'Bảng duyệt nội dung Crewzy', mimeType: 'text/html;profile=mcp-app' };
    if (rpc.method === 'resources/templates/list') return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { resourceTemplates: [] } }, sid);
    if (rpc.method === 'resources/list') return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { resources: [res0] } }, sid);
    if ((rpc.params && rpc.params.uri) !== UI_URI) return Response.json({ jsonrpc: '2.0', id: rpc.id, error: { code: -32002, message: 'Không có tài nguyên này' } }, sid);
    const origin = env.PUBLIC_ORIGIN || reqUrl.origin;
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { contents: [{ ...res0, text: publishUiHtml(), _meta: { ui: { csp: { resourceDomains: [origin], connectDomains: [] }, prefersBorder: false } } }] } }, sid);
  }

  // Tính năng theo gói: ảnh Đẹp chỉ từ gói Tăng trưởng (hạ xuống Nhanh trước khi trừ credit).
  if (rpc && rpc.method === 'tools/call' && rpc.params && uid && rpc.params.name === 'CREWZY_TAO_ANH') {
    const feat = await getFeatures(env, uid).catch(() => null);
    // Ảnh thật trước (giống Trợ lý Crewzy): trả ảnh thật trong Kho thay vì vẽ ảnh giả, không trừ credit.
    const sc = await imageShortcut(env, uid, rpc.params.arguments || {}, feat).catch(() => null);
    if (sc) return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: JSON.stringify(sc) }] } }, { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } });
    const fx = applyFeatures(rpc.params.name, rpc.params.arguments || {}, feat);
    rpc.params.arguments = fx.args;
  }

  // Hạn mức gói (23/11): bài đăng mỗi nền tảng/ngày, ảnh AI Crewzy/ngày — AI của khách đăng qua COMPOSIO_MULTI_EXECUTE_TOOL hoặc gọi thẳng.
  if (rpc && rpc.method === 'tools/call' && rpc.params && uid && /^(COMPOSIO_MULTI_EXECUTE_TOOL|CREWZY_TAO_ANH)$|_(POST|PUBLISH|UPLOAD|SHARE)/i.test(rpc.params.name || '')) {
    const featQ = await getFeatures(env, uid).catch(() => null);
    const over = (await mediaQuota(env, uid, featQ, rpc.params.name).catch(() => null)) || (await postQuota(env, uid, featQ, rpc.params.name, rpc.params.arguments || {}).catch(() => null));
    if (over) return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: 'Lỗi: ' + over }], isError: true } }, { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } });
  }

  // Gói và credit (khi bật): mọi tools/call cần gói còn hạn; công cụ tốn tiền trừ credit TRƯỚC khi chạy (kể cả gửi sang Composio).
  // initialize / tools/list vẫn cho qua để bước "Kết nối AI" lúc bắt đầu ghi nhận được AI của khách.
  if (rpc && rpc.method === 'tools/call' && rpc.params && uid && billingOn(env) && !(isCrewzyTool(rpc.params.name) && !MCP_TOOL_NAMES.has(rpc.params.name))) {
    const sid = { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } };
    const fail = (text) => Response.json({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: 'Lỗi: ' + text }], isError: true } }, sid);
    const blocked = await gate(env, uid).catch((e) => { console.error('gateway gate failed', e && e.message); return null; });
    if (blocked) return fail(`${blocked.error} Mở ${reqUrl.origin}/goi.html để thanh toán. Báo khách điều này, không thử lại công cụ.`);
    const meter = await makeMeter(env, uid).catch(() => null);
    const no = meter ? await meter.tool(rpc.params.name, rpc.params.arguments || {}) : null;
    if (no) return fail(no + ` (${reqUrl.origin}/goi.html)`);
  }

  // Màn Kết quả: ghi việc AI của khách làm qua link nối AI (ghi lúc gọi, không chờ kết quả).
  if (rpc && rpc.method === 'tools/call' && rpc.params && uid) {
    const rec = recordActivity(env, uid, rpc.params.name, rpc.params.arguments || {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(rec); else await rec;
  }

  // Công cụ của Crewzy: tự trả lời, không gửi Composio.
  if (rpc && rpc.method === 'tools/call' && rpc.params && isCrewzyTool(rpc.params.name)) {
    if (!MCP_TOOL_NAMES.has(rpc.params.name)) {
      const msg = APP_ONLY_TOOLS.includes(rpc.params.name)
        ? `Lỗi: ${rpc.params.name} chỉ có trong Trợ lý AI của Crewzy (dùng credit của app), AI nối qua link MCP không gọi được. Làm video bằng app đã nối (HyperFrames, OpenArt…) hoặc nhờ khách mở Trợ lý AI trong Crewzy.`
        : `Lỗi: Không có công cụ ${rpc.params.name}.`;
      return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: msg }], isError: true } }, { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } });
    }
    const needApps = rpc.params.name === 'CREWZY_BRAIN' || rpc.params.name === 'CREWZY_QUY_TRINH';
    const slugs = needApps ? await connectedApps(env, uid) : [];
    const names = slugs.map((s) => (appBySlug(s) || { name: s }).name);
    const out = await runCrewzyTool(env, { uid, origin: reqUrl.origin, name: rpc.params.name, args: rpc.params.arguments || {}, connectedNames: names, connected: slugs, surface: 'mcp',
      agent: rpc.params.name === 'CREWZY_VIEC_CAN_LAM' ? await seenAi(env, uid) : 'AI của bạn' });
    const text = out.error ? 'Lỗi: ' + out.error : JSON.stringify(out.data);
    const result = { content: [{ type: 'text', text }], isError: !!out.error };
    if (!out.error && rpc.params.name === 'CREWZY_XEM_NOI_DUNG') result.structuredContent = out.data; // dữ liệu cho bảng duyệt
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result }, { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } });
  }

  // Công cụ của máy chủ MCP khách đã nối trong Crewzy.
  if (rpc && rpc.method === 'tools/call' && rpc.params && EXTERNAL_TOOL_RE.test(rpc.params.name || '')) {
    const sid = { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } };
    const out = await callExternalTool(env, uid, rpc.params.name, rpc.params.arguments || {});
    if (out.error) return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: 'Lỗi: ' + out.error }], isError: true } }, sid);
    const raw = out.raw || {};
    const content = Array.isArray(raw.content) ? raw.content.slice() : [{ type: 'text', text: JSON.stringify(raw).slice(0, 12000) }];
    try {
      const media = await collectMedia(env, uid, reqUrl.origin, raw, new Set(), out.tool);
      if (media.length) content.push({ type: 'text', text: JSON.stringify({ media_crewzy: media.map((m) => ({ loai: m.kind, link: m.link })) }) });
    } catch (e) { console.error('gateway media failed', e && e.message); }
    const result = { content, isError: !!raw.isError };
    if (raw.structuredContent) result.structuredContent = raw.structuredContent;
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result }, sid);
  }

  const headers = new Headers();
  for (const name of ['content-type', 'accept', 'mcp-session-id', 'mcp-protocol-version', 'last-event-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-api-key', apiKey);
  const init = { method: request.method, headers };
  if (bodyBuf) init.body = bodyBuf;

  const res = await fetch(upstream.toString(), init);
  const out = new Headers();
  for (const name of ['content-type', 'mcp-session-id', 'cache-control', 'mcp-protocol-version']) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }

  const wantsPatch = rpc && (rpc.method === 'initialize' || rpc.method === 'tools/list') && res.ok;
  if (!wantsPatch) return new Response(res.body, { status: res.status, headers: out });

  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  let patched = text;
  if (rpc.method === 'tools/list') {
    const ext = await loadExternalTools(env, uid).catch((e) => { console.error('gateway ext tools failed', e && e.message); return { defs: [] }; });
    const extTools = ext.defs.map((d) => ({ name: d.function.name, description: d.function.description, inputSchema: d.function.parameters }));
    patched = rewriteRpc(text, ct, rpc.id, (result) => { result.tools = [...(result.tools || []), ...MCP_TOOLS, ...extTools]; });
  } else {
    // Ghi lại AI của khách vừa nối (Văn phòng → Bộ não hiện "Claude hoạt động 5 phút trước"). Chỉ ghi lúc initialize để đỡ tốn lượt ghi KV.
    const ci = (rpc.params && rpc.params.clientInfo) || {};
    ctx && ctx.waitUntil && ctx.waitUntil(env.KV.put('aiseen:' + uid, JSON.stringify({ ten: aiName(ci.name), luc: new Date().toISOString() }), { expirationTtl: 60 * 86400 }).catch(() => {}));
    ctx && ctx.waitUntil && ctx.waitUntil(touchLink(env, uid, upstream.crewzyLink, aiName(ci.name)).catch(() => {}));
    const ins = await buildInstructions(env, uid);
    patched = rewriteRpc(text, ct, rpc.id, (result) => {
      result.instructions = [result.instructions, ins.text].filter(Boolean).join('\n\n');
      result.serverInfo = { ...(result.serverInfo || {}), name: APP_NAME + ' (Composio)' };
      result.capabilities = { ...(result.capabilities || {}), prompts: { listChanged: false }, resources: { ...((result.capabilities || {}).resources || {}) } };
    });
  }
  out.delete('content-length');
  return new Response(patched, { status: res.status, headers: out });
};
