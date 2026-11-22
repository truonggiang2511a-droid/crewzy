// Khung chat Trợ lý AI: nhận tin nhắn, cho AI (Claude hoặc ChatGPT) dùng công cụ Composio của khách, trả về từng bước.
// POST /api/chat  { uid?, mode: 'app'|'claude'|'openai'|'openrouter', key?, model?, messages: [{ role: 'user'|'assistant', content }] }
// Mã khách lấy từ phiên đăng nhập Google; uid trong body chỉ dùng khi chưa bật đăng nhập.
// Trả về NDJSON, mỗi dòng một sự kiện: {type:'tool', label} · {type:'text', text} · {type:'done'} · {type:'error', message}
// mode 'app'  : Bộ não Crewzy bằng khoá ANTHROPIC_API_KEY của Giang — mặc định Claude Opus 5.5 (brain 'can_bang' = Sonnet 5.5, 'tiet_kiem' = Haiku), trừ credit theo token khi bật gói.
// mode khác   : khoá API riêng của khách, gửi kèm mỗi lần, máy chủ không lưu.
// openrouter  : khoá nhận được khi khách bấm Đăng nhập OpenRouter (OAuth PKCE), tiền tính vào tài khoản OpenRouter của khách.
import { instantConfig, instantUsd, recordInstant, INSTANT_NOTE } from '../lib/instant.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Composio } from '@composio/core';
import { APP_NAME, TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, userIdFor, safeDetail, getApiKey, resolveUid } from '../lib/common.js';
import { skillText, appBySlug } from '../lib/catalog.js';
import { getBrand, brandText } from '../lib/brand.js';
import { CREWZY_TOOL_DEFS, VIDEO_TOOL, isCrewzyTool, runCrewzyTool } from '../lib/crewzyTools.js';
import { recordActivity } from '../lib/activity.js';
import { getFeatures, upgradeHint, applyFeatures } from '../lib/billing.js';
import { loadExternalTools } from '../lib/mcpServers.js';
import { collectMedia } from '../lib/media.js';
import { billingOn, gate, makeMeter, prices } from '../lib/billing.js';

const APP_DAILY_CAP = 300;          // tổng lượt chat/ngày chế độ credit của app (cả app)
const USER_DAILY_CAP = 30;          // lượt chat/ngày chế độ credit của app cho MỖI khách
const MAX_STEPS = 16;               // số vòng gọi công cụ tối đa mỗi lượt (đủ để chờ video tạo xong)
const TIME_BUDGET_MS = 150000;      // dừng sớm, nhắn khách gõ "tiếp tục"
const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_OUTPUT_TOKENS = 6000;     // đủ cho báo cáo/7 bài đăng nộp qua CREWZY_NOP_KET_QUA (1500 bị cắt giữa chừng)
// Bộ não Crewzy (chế độ app, khoá của Giang): mặc định Opus 5.5 để nội dung tốt và điều khiển app chuẩn; khách chọn "Tiết kiệm" = Haiku.
// Đổi mặc định bằng biến APP_MODEL. Credit trừ theo giá thật từng model (billing.js AI_MODEL_PRICES).
export const APP_BRAINS = { manh: 'claude-opus-5-5', can_bang: 'claude-sonnet-5-5', tiet_kiem: 'claude-haiku-5-5' };
const appModel = (env, brain) => (brain === 'tiet_kiem' || brain === 'can_bang' ? APP_BRAINS[brain] : (env.APP_MODEL || APP_BRAINS.manh));
const MODELS = { app: 'claude-opus-5-5', claude: 'claude-sonnet-5-5', openai: 'gpt-5.4-mini', gemini: 'gemini-3.8-flash', grok: 'grok-4.7' };
// Gemini và Grok gọi qua cổng tương thích OpenAI (đã tra tài liệu 22/11/2026).
const OPENAI_COMPAT = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  grok: 'https://api.x.ai/v1',
};
const KEY_MODES = ['claude', 'openai', 'gemini', 'grok'];
// Model OpenRouter cho khách chọn (đã kiểm tra có trên openrouter.ai, 22/11/2026). Phần tử đầu là mặc định.
const OPENROUTER_MODELS = ['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5', 'google/gemini-4-neon'];

const SYSTEM_PROMPT = `Bạn là Trợ lý điều hành của ${APP_NAME}, làm việc cho một doanh nghiệp nhỏ ở Việt Nam.
Bạn dùng các công cụ Composio để làm việc trên ứng dụng khách đã kết nối (danh sách và Skill từng app ở cuối).
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
- Khi xong việc, báo kết quả kèm link bài đăng hoặc dữ liệu cụ thể nếu có.
- Viết nội dung, trả lời khách: theo đúng Brain thương hiệu bên dưới; mục nào trống thì hỏi người dùng, không tự bịa.
- Lead: thấy khách để lại số điện thoại/email hoặc khách nóng (hỏi giá, hẹn xem) → gọi CREWZY_BAO_LEAD ngay rồi làm theo viec_tiep (báo chủ qua Gmail/Telegram đã nối, ghi CRM). Báo cáo cho chủ gửi qua kênh trong bao_ceo.
- Hình ảnh thật trước, AI sau: trước khi làm ảnh/video/bài đăng, xem Kho (CREWZY_KHO) và ảnh khách gửi trong chat; nếu kho trống,
  đọc website của khách (CREWZY_DOC_WEB → trường anh) hoặc fanpage (công cụ Facebook/Instagram lấy ảnh bài gần đây), xem ảnh bằng
  CREWZY_XEM_ANH, lưu ảnh đẹp vào Kho (CREWZY_LUU_KHO). Ảnh thật đủ đẹp thì đăng thẳng ảnh thật.
- Ảnh quảng cáo: CREWZY_TAO_ANH chat_luong "dep" + anh_mau (link ảnh thật) để giữ đúng sản phẩm/căn nhà; "nhanh" cho ảnh minh hoạ.
- Video ngắn (Reels/TikTok/Shorts): CREWZY_TAO_VIDEO (dọc 9:16). Đưa ảnh thật vào trường anh để làm ảnh chuyển động;
  chat_luong "dep" cho video như quay thật. Hiện link video cho khách. Gói chưa có mức Đẹp thì công cụ tự hạ và báo, nói lại cho khách.
- Khách bảo "đăng luôn" ngay trong cuộc trò chuyện thì đó là đồng ý: đăng, rồi nộp phiếu với trang_thai da_dang kèm link bài.
- Làm ra kết quả thật, không đẩy việc về cho người dùng: khi được nhờ làm ảnh thì dùng CREWZY_TAO_ANH (Canva API không tạo ảnh từ chữ),
  hiện ảnh bằng cú pháp ![ảnh](link); khi người dùng muốn chỉnh trong Canva thì tải ảnh đó lên Canva (CANVA_CREATE_URL_ASSET_UPLOAD_JOB)
  rồi tạo design từ ảnh (CANVA_POST_DESIGNS) và gửi link chỉnh sửa. Đăng bài có ảnh thì dùng đúng link ảnh đã tạo.
- Người dùng nhờ "chạy quy trình" hoặc việc khớp một quy trình chuẩn (lịch nội dung, soi đối thủ, báo cáo tuần, trả lời bình luận…):
  gọi CREWZY_QUY_TRINH để lấy đúng các bước, kiểm tra app thiếu, làm đúng thứ tự, nộp kết quả kèm quy_trinh.
- Làm xong một sản phẩm (bài viết, kịch bản, báo cáo, danh sách, ảnh/video) thì nộp về Việc chờ duyệt bằng CREWZY_NOP_KET_QUA (nguoi_lam "Trợ lý Crewzy")
  để khách duyệt và lưu lại; khách bảo "làm việc được giao" thì gọi CREWZY_VIEC_CAN_LAM trước.
- Chỉ nói "không làm được" khi công cụ thật sự báo lỗi; nói rõ lỗi gì và cách khắc phục.
- Công cụ tạo ảnh/video của app khác (OpenArt, Higgsfield…) thường trả mã việc trước: gọi CREWZY_CHO (10–30 giây) rồi gọi công cụ
  xem trạng thái của app đó, lặp tới khi có kết quả. Crewzy tự lưu ảnh/video thành link cố định trong trường media_crewzy
  và hiện cho khách xem; khi đăng Facebook/Instagram/YouTube luôn dùng link trong media_crewzy (link gốc của nhà cung cấp hay hết hạn).`;

// Lời dặn đầy đủ cho một lượt: lời dặn chung + Brain thương hiệu + Skill các app đã kết nối.
async function buildSystem(env, composio, uid) {
  const parts = [SYSTEM_PROMPT];
  let connected = [];
  try {
    const res = await composio.connectedAccounts.list({ userIds: [userIdFor(uid)], statuses: ['ACTIVE'], limit: 100 });
    connected = [...new Set((res.items || []).map((i) => i.toolkit && i.toolkit.slug).filter(Boolean))];
  } catch (e) { console.error('list connected failed', e && e.message); }
  try {
    const brand = await getBrand(env, uid);
    const text = brandText(brand);
    parts.push(text ? '# Brain thương hiệu\n' + text : '# Brain thương hiệu\nChưa điền. Khi cần viết nội dung, nhắc người dùng điền ở trang Brain thương hiệu (thuong-hieu.html).');
  } catch (e) { console.error('brand read failed', e && e.message); }
  const names = connected.map((s) => (appBySlug(s) || { name: s }).name);
  parts.push('# Ứng dụng đã kết nối\n' + (names.length ? names.join(', ') : 'Chưa kết nối ứng dụng nào. Hướng dẫn người dùng vào trang Kết nối (ket-noi.html).'));
  const skills = skillText(connected);
  if (skills) parts.push('# Skill từng ứng dụng\n' + skills);
  return { system: parts.join('\n\n'), names, slugs: connected };
}

const encoder = new TextEncoder();

// Gemini (cổng OpenAI) chỉ nhận một phần JSON Schema: bỏ các từ khoá hay làm lỗi 400.
const GEMINI_DROP = new Set(['$schema', '$id', '$ref', '$defs', 'definitions', 'additionalProperties', 'examples', 'default', 'const', 'patternProperties', 'unevaluatedProperties', 'if', 'then', 'else', 'not']);
function geminiSchema(node) {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (GEMINI_DROP.has(k)) continue;
    if (k === 'type' && Array.isArray(v)) { out.type = v.find((t) => t !== 'null') || 'string'; continue; }
    out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v || {}).map(([pk, pv]) => [pk, geminiSchema(pv)])) : geminiSchema(v);
  }
  return out;
}
function geminiSafeTool(t) {
  const f = t.function || t;
  return { type: 'function', function: { name: f.name, description: f.description, parameters: geminiSchema(f.parameters || { type: 'object', properties: {} }) } };
}

function toolLabel(name, input) {
  if (name === 'CREWZY_TAO_ANH') return input && input.chat_luong === 'dep' ? 'Đang tạo ảnh Đẹp (khoảng 20 giây)' : 'Đang tạo ảnh';
  if (name === 'CREWZY_TAO_VIDEO') return input && input.chat_luong === 'dep' ? 'Đang làm video Đẹp (2–4 phút)' : 'Đang làm video (1–3 phút)';
  if (name === 'CREWZY_BRAIN') return 'Đọc Brain thương hiệu';
  if (name === 'CREWZY_XEM_ANH') return 'Đang xem ảnh';
  if (name === 'CREWZY_KHO') return 'Xem Kho lưu trữ';
  if (name === 'CREWZY_BAO_LEAD') return 'Báo khách tiềm năng cho chủ';
  if (name === 'CREWZY_LUU_KHO') return 'Lưu ảnh vào Kho';
  if (name === 'CREWZY_DOC_WEB') return 'Đọc website' + (input && input.url ? ' ' + String(input.url).replace(/^https?:\/\//, '').slice(0, 40) : '');
  if (name === 'CREWZY_VIEC_CAN_LAM') return 'Xem việc Crewzy đang giao';
  if (name === 'CREWZY_QUY_TRINH') return input && input.id ? 'Đọc các bước quy trình ' + input.id : 'Xem thư viện quy trình';
  if (name === 'CREWZY_NOP_KET_QUA') return 'Nộp kết quả vào Việc chờ duyệt';
  if (name === 'CREWZY_CHO') return 'Đang chờ kết quả (' + Math.round(Number((input && input.giay) || 15)) + ' giây)';
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

// Tin nhắn từ trình duyệt: {role, content, files?:[{url, kind, name}]}. File đính kèm chỉ nhận link Crewzy (/api/media, /api/img).
function cleanMessages(raw, origin) {
  const list = Array.isArray(raw) ? raw : [];
  const ours = (u) => typeof u === 'string' && (u.startsWith(origin + '/api/media/') || u.startsWith(origin + '/api/img/'));
  return list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && (m.content.trim() || (Array.isArray(m.files) && m.files.length)))
    .slice(-20)
    .map((m) => {
      const out = { role: m.role, content: m.content.slice(0, 4000) };
      const files = m.role === 'user' && Array.isArray(m.files) ? m.files.filter((f) => f && ours(f.url)).slice(0, 6) : [];
      if (files.length) out.files = files.map((f) => ({ url: f.url, kind: ['image', 'video', 'audio', 'doc'].includes(f.kind) ? f.kind : 'doc', name: String(f.name || '').slice(0, 80) }));
      return out;
    });
}

// Chuyển file đính kèm thành nội dung cho từng loại AI. Ảnh chỉ gửi dạng ảnh ở tin nhắn người dùng CUỐI (đỡ tốn token), tin cũ ghi link.
function withAttachments(messages, style) {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  return messages.map((m, i) => {
    if (!m.files || !m.files.length) return { role: m.role, content: m.content };
    const note = 'Tệp anh/chị gửi kèm (đã lưu trong Kho, dùng link này để đăng hoặc làm ảnh mẫu):\n' + m.files.map((f) => `- ${f.kind === 'image' ? 'Ảnh' : f.kind === 'video' ? 'Video' : f.kind === 'audio' ? 'Âm thanh' : 'Tài liệu'}${f.name ? ' ' + f.name : ''}: ${f.url}`).join('\n');
    const text = (m.content ? m.content + '\n\n' : '') + note;
    const imgs = i === lastUser ? m.files.filter((f) => f.kind === 'image').slice(0, 4) : [];
    if (!imgs.length || style === 'text') return { role: m.role, content: text };
    if (style === 'claude') return { role: m.role, content: [{ type: 'text', text }, ...imgs.map((f) => ({ type: 'image', source: { type: 'url', url: f.url } }))] };
    return { role: m.role, content: [{ type: 'text', text }, ...imgs.map((f) => ({ type: 'image_url', image_url: { url: f.url } }))] };
  });
}

// Đếm lượt chế độ credit của app trong KV (không tuyệt đối chính xác khi gửi cùng lúc, đủ để chặn lạm dụng).
// Trả về null nếu còn lượt, hoặc câu báo lỗi.
export async function takeAppQuota(env, uid) {
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // theo giờ Việt Nam
  const userKey = `usage:${day}:${uid}`;
  const allKey = `usage:${day}:all`;
  const [u, a] = await Promise.all([env.KV.get(userKey), env.KV.get(allKey)]);
  if (Number(u || 0) >= USER_DAILY_CAP) return `Hôm nay anh/chị đã dùng hết ${USER_DAILY_CAP} lượt miễn phí. Đăng nhập OpenRouter ở trang Kết nối → AI của bạn để dùng tiếp, hoặc quay lại ngày mai.`;
  if (Number(a || 0) >= APP_DAILY_CAP) return 'Hôm nay app đã hết lượt miễn phí. Đăng nhập OpenRouter ở trang Kết nối → AI của bạn để dùng tiếp.';
  const ttl = { expirationTtl: 2 * 86400 };
  await Promise.all([env.KV.put(userKey, String(Number(u || 0) + 1), ttl), env.KV.put(allKey, String(Number(a || 0) + 1), ttl)]);
  return null;
}

// Đánh dấu cache ở khối cuối của tin nhắn cuối (chỉ 1 điểm trong hội thoại; tổng ≤4 điểm cache mỗi yêu cầu).
function withCacheMark(convo) {
  if (!convo.length) return convo;
  const out = convo.slice();
  const last = out[out.length - 1];
  const blocks = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content.map((b) => ({ ...b }));
  if (!blocks.length) return convo;
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } };
  out[out.length - 1] = { role: last.role, content: blocks };
  return out;
}

// Vòng gọi công cụ với Claude (Anthropic Messages API)
async function runClaude({ client, model, tools, exec, label = toolLabel, messages, emit, deadline, system, onUsage }) {
  const anthropicTools = tools.map((t) => {
    const f = t.function || t;
    return { name: f.name, description: (f.description || '').slice(0, 1000), input_schema: f.parameters || { type: 'object', properties: {} } };
  });
  // Prompt caching: công cụ + lời dặn + hội thoại tới bước trước được đọc lại từ cache (giá 0,05× với Opus/Sonnet) → mỗi bước sau rẻ hơn nhiều.
  if (anthropicTools.length) anthropicTools[anthropicTools.length - 1].cache_control = { type: 'ephemeral' };
  const systemBlocks = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  const convo = messages.map((m) => ({ role: m.role, content: m.content }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({ model, max_tokens: MAX_OUTPUT_TOKENS, system: systemBlocks, tools: anthropicTools, messages: withCacheMark(convo) });
    // Khoá AI của Giang (chế độ app): trừ credit theo token thật sau mỗi bước; hết credit thì dừng.
    if (onUsage && (await onUsage(res.usage)) === 'stop') {
      emit({ type: 'text', text: 'Đã hết credit nên em dừng ở đây. Vào Gói và credit để nạp thêm rồi nhắn "tiếp tục".' });
      return;
    }
    if (res.stop_reason === 'max_tokens') {
      emit({ type: 'text', text: 'Nội dung dài quá một lượt trả lời, anh/chị nhắn "tiếp tục" để em làm nốt nhé.' });
      return;
    }
    const texts = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (texts) emit({ type: 'text', text: texts });
    const calls = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !calls.length) return;
    convo.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const call of calls) {
      emit({ type: 'tool', label: label(call.name, call.input) });
      let out;
      out = await exec(call.name, call.input || {});
      const text = toolResultText(out);
      // CREWZY_XEM_ANH: gửi ảnh thật cho Claude nhìn (link đã lưu ở R2 của Crewzy nên Anthropic tải được).
      const content = out && Array.isArray(out.xem_anh) && out.xem_anh.length
        ? [{ type: 'text', text }, ...out.xem_anh.map((url) => ({ type: 'image', source: { type: 'url', url } }))]
        : text;
      results.push({ type: 'tool_result', tool_use_id: call.id, content, is_error: !!(out && out.error) });
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
async function runOpenAI({ client, model, tools, exec, label = toolLabel, messages, emit, deadline, system, tokenParam = 'max_completion_tokens' }) {
  const convo = [{ role: 'system', content: system }, ...messages];
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.chat.completions.create({ model, messages: convo, tools, [tokenParam]: MAX_OUTPUT_TOKENS });
    if (res.choices[0].finish_reason === 'length') {
      emit({ type: 'text', text: 'Nội dung dài quá một lượt trả lời, anh/chị nhắn "tiếp tục" để em làm nốt nhé.' });
      return;
    }
    const msg = res.choices[0].message;
    if (msg.content && msg.content.trim()) emit({ type: 'text', text: msg.content.trim() });
    const calls = msg.tool_calls || [];
    if (!calls.length) return;
    convo.push(msg);
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
      emit({ type: 'tool', label: label(call.function.name, args) });
      let out;
      out = await exec(call.function.name, args);
      convo.push({ role: 'tool', tool_call_id: call.id, content: toolResultText(out) });
    }
    if (Date.now() > deadline) {
      emit({ type: 'text', text: 'Việc này còn dài, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
      return;
    }
  }
  emit({ type: 'text', text: 'Em đã chạy nhiều bước, anh/chị nhắn "tiếp tục" để em làm tiếp nhé.' });
}


// Chạy một lượt AI có công cụ (Composio + Crewzy + MCP ngoài). Dùng cho khung chat và cho hẹn giờ tự chạy (cron).
// emit(event): {type:'tool'|'text'|'image'|'video'|'audio', ...}. Lỗi thì ném ra cho nơi gọi xử lý.
export async function runAgent({ env, uid, origin, mode, key, orModel, brain, messages, emit, timeBudgetMs = TIME_BUDGET_MS, meter = null }) {
  const composioKey = getApiKey(env);
  const deadline = Date.now() + timeBudgetMs;
    // Tính năng theo gói (billing.js PLAN_FEATURES): gói MCP For You không có Trợ lý Crewzy; Opus từ gói Tăng trưởng.
    const feat = mode === 'app' ? await getFeatures(env, uid).catch(() => null) : null;
    if (feat && !feat.tro_ly) {
      emit({ type: 'text', text: 'Gói của anh/chị dùng AI riêng (Claude, ChatGPT…) qua link nối AI ở trang Kết nối → AI của bạn. ' + upgradeHint('tro_ly') });
      return;
    }
    if (feat && !feat.opus && (!brain || brain === 'manh')) {
      brain = 'can_bang';
      emit({ type: 'tool', label: 'Gói hiện tại dùng bộ não Cân bằng (Sonnet 5.5). Bộ não Mạnh nhất có từ gói Tăng trưởng.' });
    }
    const composio = new Composio({ apiKey: composioKey });
    // Instant chỉ cho Trợ lý Crewzy (khoá của Giang): đo được tiền từng lần gọi để trừ credit. Khoá riêng của khách thì tắt.
    const instant = mode === 'app' ? await instantConfig(env, uid).catch(() => false) : false;
    const session = await composio.create(userIdFor(uid), {
      toolkits: TOOLKITS,
      multiAccount: { enable: true, maxAccountsPerToolkit: MAX_ACCOUNTS_PER_TOOLKIT },
      instant,
    });
    const [composioTools, built, ext] = await Promise.all([
      session.tools(), buildSystem(env, composio, uid),
      loadExternalTools(env, uid).catch((e) => { console.error('external mcp failed', e && e.message); return { defs: [], names: [], failed: [] }; }),
    ]);
    let tools = [...composioTools, ...CREWZY_TOOL_DEFS, VIDEO_TOOL, ...ext.defs];
    if (mode === 'gemini') tools = tools.map(geminiSafeTool);
    let system = built.system;
    if (instant) system += '\n\n' + INSTANT_NOTE;
    if (ext.names.length || ext.failed.length) {
      system += '\n\n# Máy chủ MCP khác khách đã nối\n'
        + (ext.names.length ? 'Đang dùng được: ' + ext.names.join(', ') + '. Công cụ của chúng có tiền tố m…_ và ghi [tên máy chủ] ở đầu mô tả; gọi thẳng, không cần COMPOSIO_SEARCH_TOOLS.' : '')
        + (ext.failed.length ? '\nTạm không nối được: ' + ext.failed.join(', ') + ' (nhắc khách vào Kết nối → MCP khác để kiểm tra).' : '');
    }
    const seenMedia = new Set();
    const label = (n, i) => (ext.label && ext.label(n)) ? 'Đang chạy ' + ext.label(n) : toolLabel(n, i);
        // Chạy một công cụ: CREWZY_* xử lý ngay trong Worker, còn lại gửi Composio.
    const exec = async (name, args) => {
      const res = await execRaw(name, args);
      // Màn Kết quả: ghi việc đã làm khi công cụ chạy không lỗi.
      if (res && !res.error && !(res.successful === false)) await recordActivity(env, uid, name, args);
      return res;
    };
    const execRaw = async (name, rawArgs) => {
      // Tính năng theo gói: hạ/chặn ảnh-video Đẹp trước khi trừ credit.
      const fx = applyFeatures(name, rawArgs, feat);
      if (fx.error) return { error: fx.error };
      const args = fx.args;
      if (fx.note) emit({ type: 'tool', label: fx.note });
      // Gói và credit: trừ trước khi chạy công cụ tốn tiền (Composio, MCP ngoài, ảnh, video); hết credit thì báo AI.
      if (meter) {
        const no = await meter.tool(name, args);
        if (no) return { error: no };
      }
      if (isCrewzyTool(name)) {
        const out = await runCrewzyTool(env, { uid, origin, name, args, connectedNames: built.names, connected: built.slugs, agent: 'Trợ lý Crewzy', instant: !!instant });
        if (out && out.image) emit({ type: 'image', url: out.image });
        if (out && out.video) emit({ type: 'video', url: out.video });
        return out;
      }
      if (ext.run) {
        const res = await ext.run(name, args);
        if (res) {
          // Ảnh/video máy chủ MCP trả về (dạng dữ liệu hoặc link): lưu thành link cố định của Crewzy, hiện trong chat.
          const media = res.raw ? await collectMedia(env, uid, origin, res.raw, seenMedia, res.tool) : [];
              delete res.tool;
          delete res.raw;
          delete res.images;
          for (const m of media) emit({ type: m.kind === 'video' ? 'video' : m.kind === 'audio' ? 'audio' : 'image', url: m.link });
          if (media.length) {
            res.media_crewzy = media.map((m) => ({ loai: m.kind, link: m.link, ...(m.goc ? { ghi_chu: 'File quá lớn để lưu ở Crewzy, đây là link gốc của nhà cung cấp, có thể hết hạn' } : {}) }));
          }
          return res;
        }
      }
      let res;
      try { res = await session.execute(name, args); } catch (e) { return { error: safeDetail(e) }; }
      // Công cụ Instant: ghi chi tiêu (trần ngày) và trừ credit theo tiền Composio báo về.
      const usd = instant ? instantUsd(res) : 0;
      if (usd > 0) {
        await recordInstant(env, uid, usd).catch((e) => console.error('instant record failed', e && e.message));
        const stop = meter ? await meter.instant(usd, name).catch(() => null) : null;
        if (res && typeof res === 'object') {
          delete res.instantCharge;
          res.crewzy_phi = `Công cụ trả phí qua Crewzy: ${usd.toFixed(4)} USD` + (stop ? '. Khách đã hết credit, dừng lại và báo khách nạp thêm.' : '');
        }
      }
      return res;
    };
    const model = mode === 'openrouter' ? orModel : mode === 'app' ? appModel(env, brain) : MODELS[mode];
    if (mode === 'openrouter') {
      const client = new OpenAI({
        apiKey: key.trim(),
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': origin, 'X-Title': APP_NAME },
      });
      await runOpenAI({ client, model, tools, exec, label, messages: withAttachments(messages, 'openai'), emit, deadline, system, tokenParam: 'max_tokens' });
    } else if (OPENAI_COMPAT[mode]) {
      const client = new OpenAI({ apiKey: key.trim(), baseURL: OPENAI_COMPAT[mode] });
      await runOpenAI({ client, model, tools, exec, label, messages: withAttachments(messages, 'text'), emit, deadline, system, tokenParam: 'max_tokens' });
    } else if (mode === 'openai') {
      const client = new OpenAI({ apiKey: key.trim(), baseURL: 'https://api.openai.com/v1' });
      await runOpenAI({ client, model, tools, exec, label, messages: withAttachments(messages, 'openai'), emit, deadline, system });
    } else {
      const client = mode === 'app' ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic({ apiKey: key.trim(), baseURL: 'https://api.anthropic.com' });
      const onUsage = mode === 'app' && meter ? (u) => meter.tokens(u, 'chat', model) : null;
      await runClaude({ client, model, tools, exec, label, messages: withAttachments(messages, 'claude'), emit, deadline, system, onUsage });
    }
}

export default async (req, env) => {
  if (req.method === 'GET') {
    // Cho giao diện biết chế độ credit của app có bật không.
    return Response.json({ appMode: !!env.ANTHROPIC_API_KEY, openrouterModels: OPENROUTER_MODELS, appModel: env.APP_MODEL || APP_BRAINS.manh });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 }); }
  const { mode, key } = body || {};
  const messages = cleanMessages(body && body.messages, new URL(req.url).origin);
  const who = await resolveUid(req, env, body && body.uid);
  if (who.response) return who.response;
  const uid = who.uid;
  if (!['app', 'openrouter', ...KEY_MODES].includes(mode)) return Response.json({ error: 'Chưa chọn AI.' }, { status: 400 });
  const orModel = OPENROUTER_MODELS.includes(body && body.model) ? body.model : OPENROUTER_MODELS[0];
  if (mode !== 'app' && (typeof key !== 'string' || key.trim().length < 20)) return Response.json({ error: 'Chưa có khoá API hợp lệ.' }, { status: 400 });
  if (!messages.length || messages[messages.length - 1].role !== 'user') return Response.json({ error: 'Chưa có tin nhắn.' }, { status: 400 });
  const composioKey = getApiKey(env);
  if (!composioKey) return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });

  // Gói và credit (khi bật): phải còn hạn gói + đủ credit tối thiểu; credit thay cho trần lượt miễn phí mỗi ngày.
  const email = who.session && who.session.email;
  const blocked = await gate(env, uid, { email, needCredits: prices(env).min_start }).catch((e) => { console.error('gate failed', e && e.message); return null; });
  if (blocked) return Response.json({ error: blocked.error, can: blocked.can }, { status: blocked.status });
  const meter = await makeMeter(env, uid, { email }).catch((e) => { console.error('meter failed', e && e.message); return null; });

  if (mode === 'app') {
    if (!env.ANTHROPIC_API_KEY) return Response.json({ error: 'Chế độ credit của app chưa bật, hãy dùng khoá riêng.' }, { status: 400 });
    if (!billingOn(env)) try {
      const over = await takeAppQuota(env, uid);
      if (over) return Response.json({ error: over }, { status: 429 });
    } catch (e) {
      console.error('quota check failed', e && e.message);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        await runAgent({ env, uid, origin: new URL(req.url).origin, mode, key, orModel, brain: body && body.brain, messages, emit, timeBudgetMs: TIME_BUDGET_MS, meter });
        emit({ type: 'done' });
      } catch (err) {
        console.error('chat failed', mode, err && err.message);
        const detail = safeDetail(err);
        let message = 'AI gặp lỗi, anh/chị thử lại sau ít phút.';
        if (/401|invalid.?api.?key|api key not valid|incorrect api key|api_key_invalid|authentication/i.test(detail)) message = 'Khoá API không đúng hoặc đã hết hạn.';
        else if (/402|insufficient|credits/i.test(detail)) message = mode === 'openrouter' ? 'Tài khoản OpenRouter hết tiền, nạp thêm tại openrouter.ai/settings/credits.' : 'Tài khoản AI hết tiền hoặc hết hạn mức.';
        else if (/429|rate|quota/i.test(detail)) message = 'AI đang quá tải hoặc hết hạn mức, thử lại sau ít phút.';
        emit({ type: 'error', message, detail });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
};

