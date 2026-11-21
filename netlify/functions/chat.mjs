// Khung chat Trợ lý AI: nhận tin nhắn, cho AI (Claude hoặc ChatGPT) dùng công cụ Composio của khách, trả về từng bước.
// POST /api/chat  { uid, mode: 'app'|'claude'|'openai', key?, messages: [{ role: 'user'|'assistant', content }] }
// Trả về NDJSON, mỗi dòng một sự kiện: {type:'tool', label} · {type:'text', text} · {type:'done'} · {type:'error', message}
// mode 'app'  : AI qua Netlify AI Gateway, tính vào credit Netlify của Giang, có trần lượt/ngày.
// mode khác   : khoá API riêng của khách, gửi kèm mỗi lần, máy chủ không lưu.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getStore } from '@netlify/blobs';
import { Composio } from '@composio/core';
import { TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, UID_PATTERN, userIdFor, safeDetail, getApiKey } from '../lib/common.mjs';

const APP_DAILY_CAP = 150;          // số lượt chat/ngày cho chế độ credit của app (toàn site)
const MAX_STEPS = 8;                // số vòng gọi công cụ tối đa mỗi lượt
const TIME_BUDGET_MS = 45000;       // dừng sớm để không vượt giới hạn thời gian của hàm
const MAX_TOOL_RESULT_CHARS = 12000;
const MODELS = { app: 'claude-haiku-5-5', claude: 'claude-sonnet-5-5', openai: 'gpt-5.4-mini' };

const SYSTEM_PROMPT = `Bạn là Trợ lý điều hành của Văn Phòng AI, làm việc cho một doanh nghiệp nhỏ ở Việt Nam.
Bạn dùng các công cụ Composio để làm việc trên ứng dụng khách đã kết nối: Facebook Fanpage, Instagram, YouTube, LinkedIn,
Gmail, Google Sheets, Google Calendar, Google Drive, Notion, HubSpot.
Cách dùng công cụ: tìm công cụ bằng COMPOSIO_SEARCH_TOOLS, xem tham số bằng COMPOSIO_GET_TOOL_SCHEMAS nếu cần,
kiểm tra hoặc tạo kết nối bằng COMPOSIO_MANAGE_CONNECTIONS, rồi chạy bằng COMPOSIO_MULTI_EXECUTE_TOOL.
Quy tắc bắt buộc:
- Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng, xưng "em", gọi người dùng là "anh/chị".
- Trước mọi việc ra bên ngoài (đăng bài công khai, gửi email hay tin nhắn cho người khác, xoá dữ liệu, chi tiền quảng cáo):
  tóm tắt chính xác việc sẽ làm (nội dung, kênh, thời gian) rồi hỏi "Anh/chị đồng ý không?". Chỉ làm khi người dùng xác nhận.
- Việc chỉ đọc (xem danh sách trang, đọc bình luận, đọc Sheet, xem lịch) thì làm luôn, không cần hỏi.
- Chỉ dùng thông tin có thật do người dùng đưa hoặc đọc được từ công cụ. Không bịa giá, số liệu, tên người.
- Không đưa số điện thoại hay thông tin cá nhân của khách hàng lên bài đăng công khai.
- Nếu ứng dụng chưa kết nối, nói người dùng vào trang Kết nối công cụ (ket-noi.html) để kết nối, hoặc đưa link kết nối từ COMPOSIO_MANAGE_CONNECTIONS.
- Khi xong việc, báo kết quả kèm link bài đăng hoặc dữ liệu cụ thể nếu có.`;

const encoder = new TextEncoder();

function toolLabel(name, input) {
  if (name === 'COMPOSIO_SEARCH_TOOLS') return 'Tìm công cụ phù hợp';
  if (name === 'COMPOSIO_GET_TOOL_SCHEMAS') return 'Xem cách dùng công cụ';
  if (name === 'COMPOSIO_MANAGE_CONNECTIONS') return 'Kiểm tra kết nối ứng dụng';
  if (name === 'COMPOSIO_MULTI_EXECUTE_TOOL') {
    const slugs = ((input && input.tools) || []).map((t) => t && (t.tool_slug || t.slug)).filter(Boolean);
    return slugs.length ? 'Đang chạy: ' + slugs.join(', ') : 'Đang chạy công cụ';
  }
  if (name === 'COMPOSIO_REMOTE_WORKBENCH' || name === 'COMPOSIO_REMOTE_BASH_TOOL') return 'Xử lý dữ liệu';
  return 'Đang chạy: ' + name;
}

function toolResultText(result) {
  let text;
  try {
    text = JSON.stringify(result && result.error ? { error: result.error, data: result.data } : (result && result.data) ?? result);
  } catch (e) {
    text = String(result);
  }
  return text.length > MAX_TOOL_RESULT_CHARS ? text.slice(0, MAX_TOOL_RESULT_CHARS) + '…(đã cắt bớt)' : text;
}

function cleanMessages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

async function takeAppQuota() {
  const store = getStore('vpai-usage');
  const day = new Date().toISOString().slice(0, 10);
  const used = Number((await store.get('chat-' + day)) || 0);
  if (used >= APP_DAILY_CAP) return false;
  await store.set('chat-' + day, String(used + 1));
  return true;
}

// Vòng gọi công cụ với Claude (Anthropic Messages API)
async function runClaude({ client, model, tools, session, messages, emit, deadline }) {
  const anthropicTools = tools.map((t) => {
    const f = t.function || t;
    return { name: f.name, description: (f.description || '').slice(0, 1000), input_schema: f.parameters || { type: 'object', properties: {} } };
  });
  const convo = messages.map((m) => ({ role: m.role, content: m.content }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({ model, max_tokens: 1500, system: SYSTEM_PROMPT, tools: anthropicTools, messages: convo });
    const texts = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (texts) emit({ type: 'text', text: texts });
    const calls = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !calls.length) return;
    convo.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const call of calls) {
      emit({ type: 'tool', label: toolLabel(call.name, call.input) });
      let out;
      try { out = await session.execute(call.name, call.input || {}); } catch (e) { out = { error: safeDetail(e) }; }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: toolResultText(out), is_error: !!(out && out.error) });
    }
    convo.push({ role: 'user', content: results });
    if (Date.now() > deadline) {
      emit({ type: 'text', text: 'Việc này còn dài, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
      return;
    }
  }
  emit({ type: 'text', text: 'Em đã chạy nhiều bước, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
}

// Vòng gọi công cụ với ChatGPT (OpenAI Chat Completions)
async function runOpenAI({ client, model, tools, session, messages, emit, deadline }) {
  const convo = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.chat.completions.create({ model, messages: convo, tools, max_completion_tokens: 1500 });
    const msg = res.choices[0].message;
    if (msg.content && msg.content.trim()) emit({ type: 'text', text: msg.content.trim() });
    const calls = msg.tool_calls || [];
    if (!calls.length) return;
    convo.push(msg);
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
      emit({ type: 'tool', label: toolLabel(call.function.name, args) });
      let out;
      try { out = await session.execute(call.function.name, args); } catch (e) { out = { error: safeDetail(e) }; }
      convo.push({ role: 'tool', tool_call_id: call.id, content: toolResultText(out) });
    }
    if (Date.now() > deadline) {
      emit({ type: 'text', text: 'Việc này còn dài, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
      return;
    }
  }
  emit({ type: 'text', text: 'Em đã chạy nhiều bước, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
}

export default async (req) => {
  if (req.method === 'GET') {
    // Cho giao diện biết chế độ credit của app có bật không.
    return Response.json({ appMode: !!Netlify.env.get('ANTHROPIC_BASE_URL') });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 }); }
  const { uid, mode, key } = body || {};
  const messages = cleanMessages(body && body.messages);
  if (!UID_PATTERN.test(uid || '')) return Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 });
  if (!['app', 'claude', 'openai'].includes(mode)) return Response.json({ error: 'Chưa chọn AI.' }, { status: 400 });
  if (mode !== 'app' && (typeof key !== 'string' || key.trim().length < 20)) return Response.json({ error: 'Chưa có khoá API hợp lệ.' }, { status: 400 });
  if (!messages.length || messages[messages.length - 1].role !== 'user') return Response.json({ error: 'Chưa có tin nhắn.' }, { status: 400 });
  const composioKey = getApiKey();
  if (!composioKey) return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });

  if (mode === 'app') {
    if (!Netlify.env.get('ANTHROPIC_BASE_URL')) return Response.json({ error: 'Chế độ credit của app chưa bật, hãy dùng khoá riêng.' }, { status: 400 });
    try {
      if (!(await takeAppQuota())) return Response.json({ error: 'Hôm nay đã hết lượt dùng thử bằng credit của app, hãy dùng khoá riêng hoặc quay lại ngày mai.' }, { status: 429 });
    } catch (e) {
      console.error('quota check failed', e && e.message);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      const deadline = Date.now() + TIME_BUDGET_MS;
      try {
        const composio = new Composio({ apiKey: composioKey });
        const session = await composio.create(userIdFor(uid), {
          toolkits: TOOLKITS,
          multiAccount: { enable: true, maxAccountsPerToolkit: MAX_ACCOUNTS_PER_TOOLKIT },
        });
        const tools = await session.tools();
        const model = MODELS[mode];
        if (mode === 'openai') {
          const client = new OpenAI({ apiKey: key.trim(), baseURL: 'https://api.openai.com/v1' });
          await runOpenAI({ client, model, tools, session, messages, emit, deadline });
        } else {
          const client = mode === 'app' ? new Anthropic() : new Anthropic({ apiKey: key.trim(), baseURL: 'https://api.anthropic.com' });
          await runClaude({ client, model, tools, session, messages, emit, deadline });
        }
        emit({ type: 'done' });
      } catch (err) {
        console.error('chat failed', mode, err && err.message);
        const detail = safeDetail(err);
        let message = 'AI gặp lỗi, anh/chị thử lại sau ít phút.';
        if (/401|invalid.?api.?key|authentication/i.test(detail)) message = 'Khoá API không đúng hoặc đã hết hạn.';
        else if (/429|rate|quota|credit/i.test(detail)) message = 'AI đang quá tải hoặc hết hạn mức, thử lại sau ít phút.';
        emit({ type: 'error', message, detail });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
};

export const config = { path: '/api/chat' };
