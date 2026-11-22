// Máy chủ MCP của app khác mà khách tự nối vào Crewzy (trang Kết nối → MCP khác).
// KV `mcpsrv:<uid>` → [{id, name, url, auth: 'none'|'token'|'oauth', token (mã hoá), oauth: {...}, tools, toolNames, toolDesc, addedAt,
//   off (tắt cả máy chủ), disabled: [tên công cụ khách tắt]}] — công tắc dùng chung cho Trợ lý AI và link nối AI.
// Token và refresh token luôn mã hoá bằng sealText trước khi lưu.
import { kvGetJson, kvPutJson, sealText, openText } from './common.js';
import { McpConnection, McpAuthError, tokenRequest, mcpResultToTool } from './mcpClient.js';

export const MAX_SERVERS = 10;
const MAX_TOOLS_PER_SERVER = 40;
const MAX_EXTERNAL_TOOLS = 80;
const CONNECT_TIMEOUT_MS = 12000;

const key = (uid) => 'mcpsrv:' + uid;
export const listServers = async (env, uid) => (await kvGetJson(env, key(uid))) || [];
export const saveServers = (env, uid, list) => kvPutJson(env, key(uid), list.slice(0, MAX_SERVERS));

export const MAX_STORED_TOOLS = 80;
export function publicServer(s) {
  const names = (s.toolNames || []).filter((n) => !isInternalTool(n)).slice(0, MAX_STORED_TOOLS);
  const disabled = (s.disabled || []).filter((n) => names.includes(n));
  return { id: s.id, name: s.name, url: s.url, auth: s.auth, tools: Math.max(0, (s.tools || 0) - (s.toolNames || []).filter(isInternalTool).length), toolNames: names, toolDesc: s.toolDesc || {},
    off: !!s.off, disabled, active: s.off ? 0 : Math.min(names.length - disabled.length, MAX_TOOLS_PER_SERVER), maxActive: MAX_TOOLS_PER_SERVER,
    addedAt: s.addedAt, error: s.error || '' };
}
// Lưu tên + mô tả ngắn công cụ để trang Kết nối vẽ công tắc.
export function toolMeta(tools) {
  const list = tools.filter((t) => !isInternalTool(t.name)).slice(0, MAX_STORED_TOOLS);
  return { toolNames: list.map((t) => t.name), toolDesc: Object.fromEntries(list.map((t) => [t.name, String(t.title || t.description || '').replace(/\s+/g, ' ').slice(0, 120)])) };
}
// Công cụ nội bộ của máy chủ ngoài (vd HyperFrames internal_widget_event, internal_prepare_…_download: "chỉ widget gọi,
// AI không bao giờ gọi") → luôn ẩn khỏi AI và khỏi công tắc trên trang Kết nối.
export const isInternalTool = (name) => /^internal[_-]/i.test(String(name || ''));
const isOn = (s, toolName) => !s.off && !isInternalTool(toolName) && !(s.disabled || []).includes(toolName);

export function newServerId() {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return 's' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function cleanName(name, url) {
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, 40);
  return n || new URL(url).hostname.replace(/^mcp\./, '');
}

// Lấy token còn hạn; OAuth sắp hết hạn thì làm mới và lưu lại (changed = true).
async function bearerFor(env, s, force) {
  if (s.auth === 'token') return { token: await openText(env, s.token) };
  if (s.auth !== 'oauth' || !s.oauth) return { token: '' };
  const o = s.oauth;
  const access = await openText(env, o.access);
  if (!force && access && (!o.expiresAt || o.expiresAt > Date.now() + 60000)) return { token: access };
  const refresh = await openText(env, o.refresh);
  if (!refresh) return { token: access };
  const client = { clientId: o.clientId, clientSecret: await openText(env, o.clientSecret), authMethod: o.authMethod };
  const t = await tokenRequest(o, client, { grant_type: 'refresh_token', refresh_token: refresh });
  o.access = await sealText(env, t.access);
  o.refresh = await sealText(env, t.refresh);
  o.expiresAt = t.expiresAt;
  return { token: t.access, changed: true };
}

// Mở phiên tới một máy chủ đã lưu: initialize + tools/list. Token OAuth hỏng thì làm mới 1 lần.
export async function openServer(env, s) {
  let auth = await bearerFor(env, s, false);
  let changed = !!auth.changed;
  const attempt = async (token) => {
    const conn = new McpConnection(s.url, token);
    await conn.initialize();
    const tools = await conn.listTools();
    return { conn, tools };
  };
  try {
    const out = await attempt(auth.token);
    return { ...out, changed };
  } catch (e) {
    if (!(e instanceof McpAuthError) || s.auth !== 'oauth') throw e;
    auth = await bearerFor(env, s, true);
    const out = await attempt(auth.token);
    return { ...out, changed: true };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('Máy chủ MCP trả lời quá chậm')), ms))]);
}

const safeName = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

// Nạp công cụ của mọi máy chủ MCP khách đã nối, cho Trợ lý AI. Trả về định nghĩa dạng OpenAI + hàm chạy.
export async function loadExternalTools(env, uid) {
  const all = await listServers(env, uid);
  const servers = all.filter((s) => !s.off);
  const out = { defs: [], names: [], failed: [], run: null };
  if (!servers.length) return out;
  const map = new Map();
  let dirty = false;
  const results = await Promise.allSettled(servers.map((s) => withTimeout(openServer(env, s), CONNECT_TIMEOUT_MS)));
  results.forEach((r, i) => {
    const s = servers[i];
    if (r.status !== 'fulfilled') {
      out.failed.push(s.name);
      console.error('mcp server failed', s.url, r.reason && r.reason.message);
      return;
    }
    if (r.value.changed) dirty = true;
    out.names.push(s.name);
    for (const t of r.value.tools.filter((x) => isOn(s, x.name)).slice(0, MAX_TOOLS_PER_SERVER)) {
      if (out.defs.length >= MAX_EXTERNAL_TOOLS) break;
      const name = ('m' + s.id.slice(1, 5) + '_' + safeName(t.name)).slice(0, 64);
      if (map.has(name)) continue;
      map.set(name, { conn: r.value.conn, tool: t.name, server: s.name });
      const schema = t.inputSchema && typeof t.inputSchema === 'object' ? { ...t.inputSchema } : {};
      if (schema.type !== 'object') schema.type = 'object';
      if (!schema.properties) schema.properties = {};
      out.defs.push({ type: 'function', function: { name, description: `[${s.name}] ${(t.description || t.title || t.name)}`.slice(0, 600), parameters: schema } });
    }
  });
  if (dirty) { try { await saveServers(env, uid, all); } catch (e) { console.error('save mcp tokens failed', e && e.message); } }
  out.run = async (name, args) => {
    const hit = map.get(name);
    if (!hit) return null;
    try { const raw = await hit.conn.callTool(hit.tool, args); return { ...mcpResultToTool(raw), raw, tool: hit.tool }; }
    catch (e) { return { error: `${hit.server}: ${String((e && e.message) || e).slice(0, 200)}` }; }
  };
  out.label = (name) => { const hit = map.get(name); return hit ? `${hit.server}: ${hit.tool}` : ''; };
  return out;
}

// Link nối AI (/mcp/*): chạy MỘT công cụ MCP ngoài theo tên m<id4>_<tool> — chỉ mở đúng máy chủ đó (cổng không giữ phiên giữa các lượt).
export const EXTERNAL_TOOL_RE = /^m[0-9a-f]{4}_/;
export async function callExternalTool(env, uid, name, args) {
  const servers = await listServers(env, uid);
  const s = servers.find((x) => name.startsWith('m' + x.id.slice(1, 5) + '_'));
  if (!s) return { error: 'Không tìm thấy máy chủ MCP của công cụ này (có thể khách đã gỡ). Gọi tools/list lại.' };
  if (s.off) return { error: `Khách đã tắt máy chủ ${s.name} trong Crewzy (Kết nối → MCP khác). Không dùng máy chủ này.` };
  let opened;
  try { opened = await withTimeout(openServer(env, s), CONNECT_TIMEOUT_MS); }
  catch (e) { return { error: `${s.name}: chưa mở được (${String((e && e.message) || e).slice(0, 160)}). Khách vào Crewzy → Kết nối → MCP khác bấm Kiểm tra/Nối lại.` }; }
  if (opened.changed) { try { await saveServers(env, uid, servers); } catch (e) { console.error('save mcp tokens failed', e && e.message); } }
  const t = opened.tools.find((x) => ('m' + s.id.slice(1, 5) + '_' + safeName(x.name)).slice(0, 64) === name);
  if (!t) return { error: `${s.name} không còn công cụ này. Gọi tools/list lại.` };
  if (!isOn(s, t.name)) return { error: `Khách đã tắt công cụ ${t.name} của ${s.name} trong Crewzy. Không dùng công cụ này, báo khách nếu cần bật lại.` };
  try { return { raw: await opened.conn.callTool(t.name, args || {}), tool: t.name, server: s.name }; }
  catch (e) { return { error: `${s.name}: ${String((e && e.message) || e).slice(0, 200)}` }; }
}
