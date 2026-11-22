// Cổng MCP: khách dán https://<site>/mcp/<token> vào Claude / ChatGPT / Gemini / Grok.
// Cổng kiểm tra chữ ký token rồi chuyển tiếp yêu cầu MCP tới phiên Composio (gắn x-api-key ở máy chủ, khách không thấy khoá).
// Với token v2 (có mã khách), cổng còn:
//   - initialize: chèn "instructions" = cách làm việc + Brain thương hiệu + app đã kết nối + Skill từng app
//   - tools/list: thêm công cụ CREWZY_TAO_ANH, CREWZY_BRAIN vào danh sách công cụ Composio
//   - tools/call CREWZY_*: tự chạy trong Worker (không gửi Composio)
import { Composio } from '@composio/core';
import { APP_NAME, getApiKey, verifyUpstreamToken, userIdFor } from '../lib/common.js';
import { skillText, appBySlug } from '../lib/catalog.js';
import { getBrand, brandText } from '../lib/brand.js';
import { CREWZY_TOOL_DEFS, isCrewzyTool, runCrewzyTool } from '../lib/crewzyTools.js';
import { MCP_PROMPTS } from '../lib/jobs.js';

const plain = (status, text) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

const MCP_TOOLS = CREWZY_TOOL_DEFS.filter((t) => t.function.name !== 'CREWZY_CHO').map((t) => ({ name: t.function.name, description: t.function.description, inputSchema: t.function.parameters }));

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
  const [slugs, brand] = await Promise.all([connectedApps(env, uid), getBrand(env, uid).catch(() => null)]);
  const names = slugs.map((s) => (appBySlug(s) || { name: s }).name);
  const parts = [
    `Bạn đang làm việc cho một doanh nghiệp qua ${APP_NAME}. Dùng công cụ Composio để làm việc thật trên các app khách đã kết nối:`,
    'tìm công cụ bằng COMPOSIO_SEARCH_TOOLS → chạy bằng COMPOSIO_MULTI_EXECUTE_TOOL. Cần ảnh mới thì dùng CREWZY_TAO_ANH (Canva API không tạo ảnh từ chữ).',
    'Luôn trả lời bằng tiếng Việt. Trước khi đăng bài, gửi tin/email cho người khác, xoá dữ liệu hay chi tiền quảng cáo: tóm tắt và hỏi người dùng đồng ý.',
    'Không bịa giá, số liệu; không đưa số điện thoại khách lên bài công khai. Làm ra kết quả thật (bài đăng, ảnh, báo cáo), không đẩy việc về cho người dùng.',
    'Phiếu việc: khách giao việc trong Crewzy → xem bằng CREWZY_VIEC_CAN_LAM. Làm xong MỌI sản phẩm (bài viết, báo cáo, kịch bản, danh sách khách, ảnh/video, file bạn tạo bằng skill của mình) thì nộp về Crewzy bằng CREWZY_NOP_KET_QUA (ghi nguoi_lam là tên của bạn) để khách duyệt, đăng và xem báo cáo. Việc khách đã duyệt (da_duyet): đăng/gửi rồi nộp lại trạng thái da_dang kèm link.',
    '# Brain thương hiệu\n' + (brandText(brand) || 'Chưa điền (người dùng điền ở trang Brain thương hiệu của Crewzy). Hỏi khi cần.'),
    '# App đã kết nối\n' + (names.length ? names.join(', ') : 'Chưa có. Người dùng kết nối ở trang Kết nối của Crewzy.'),
  ];
  const skills = skillText(slugs);
  if (skills) parts.push('# Skill từng app\n' + skills);
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

export default async (request, env) => {
  const apiKey = getApiKey(env);
  if (!apiKey) return plain(500, 'Máy chủ chưa có khoá COMPOSIO_API_KEY.');
  const reqUrl = new URL(request.url);
  const token = reqUrl.pathname.replace(/^\/mcp\//, '').split('/')[0];
  const upstream = await verifyUpstreamToken(token, apiKey);
  if (!upstream) return plain(403, 'Link nối AI không hợp lệ hoặc đã bị đổi.');
  if (upstream.protocol !== 'https:' || !upstream.hostname.endsWith('composio.dev')) return plain(403, 'Link nối AI không trỏ tới Composio.');
  const uid = upstream.crewzyUid || null;

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

  // Công cụ của Crewzy: tự trả lời, không gửi Composio.
  if (rpc && rpc.method === 'tools/call' && rpc.params && isCrewzyTool(rpc.params.name)) {
    const names = rpc.params.name === 'CREWZY_BRAIN' ? (await connectedApps(env, uid)).map((s) => (appBySlug(s) || { name: s }).name) : [];
    const out = await runCrewzyTool(env, { uid, origin: reqUrl.origin, name: rpc.params.name, args: rpc.params.arguments || {}, connectedNames: names });
    const text = out.error ? 'Lỗi: ' + out.error : JSON.stringify(out.data);
    const result = { content: [{ type: 'text', text }], isError: !!out.error };
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result }, { headers: { 'mcp-session-id': request.headers.get('mcp-session-id') || '' } });
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
    patched = rewriteRpc(text, ct, rpc.id, (result) => { result.tools = [...(result.tools || []), ...MCP_TOOLS]; });
  } else {
    const ins = await buildInstructions(env, uid);
    patched = rewriteRpc(text, ct, rpc.id, (result) => {
      result.instructions = [result.instructions, ins.text].filter(Boolean).join('\n\n');
      result.serverInfo = { ...(result.serverInfo || {}), name: APP_NAME + ' (Composio)' };
      result.capabilities = { ...(result.capabilities || {}), prompts: { listChanged: false } };
    });
  }
  out.delete('content-length');
  return new Response(patched, { status: res.status, headers: out });
};
