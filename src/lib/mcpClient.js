// Máy khách MCP (Streamable HTTP) để Crewzy nối vào máy chủ MCP của app khác, giống "Add custom connector" của Claude.
// Hỗ trợ: không cần đăng nhập · token cố định (Bearer) · OAuth 2.1 theo chuẩn MCP (tìm máy chủ cấp quyền qua
// /.well-known/oauth-protected-resource, tự đăng ký app (DCR), PKCE S256, tham số resource, làm mới token).
// Chưa hỗ trợ kiểu SSE cũ (link kết thúc /sse).

const PROTOCOL = '2025-06-18';
const CLIENT = { name: 'Crewzy', version: '1.0.0' };
const TIMEOUT_MS = 20000;

// ---------- Kiểm tra link (chặn gọi vào mạng nội bộ) ----------
export function checkMcpUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch (e) { return { error: 'Link MCP không đúng dạng (cần https://…).' }; }
  if (url.protocol !== 'https:') return { error: 'Link MCP phải bắt đầu bằng https://' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
    || /^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.')) {
    return { error: 'Link MCP phải là tên miền công khai (không dùng localhost hay địa chỉ IP).' };
  }
  if (/\/sse\/?$/.test(url.pathname)) return { error: 'Link dạng /sse là kiểu MCP cũ, Crewzy chưa hỗ trợ. Hãy dùng link kết thúc bằng /mcp của nhà cung cấp.' };
  url.hash = '';
  return { url };
}

async function timedFetch(url, init = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' }); }
  finally { clearTimeout(t); }
}

// Đọc câu trả lời JSON-RPC: JSON thường hoặc luồng SSE (lấy sự kiện có đúng id).
async function readRpc(res, id) {
  const type = res.headers.get('content-type') || '';
  const text = await res.text();
  if (type.includes('text/event-stream')) {
    let found = null;
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (!data) continue;
      try {
        const msg = JSON.parse(data);
        const list = Array.isArray(msg) ? msg : [msg];
        for (const m of list) if (m && m.id === id) found = m;
      } catch (e) { /* bỏ qua dòng không phải JSON */ }
    }
    return found;
  }
  if (!text) return null;
  try {
    const msg = JSON.parse(text);
    if (Array.isArray(msg)) return msg.find((m) => m && m.id === id) || null;
    return msg;
  } catch (e) { return null; }
}

export class McpAuthError extends Error {
  constructor(res) { super('MCP cần đăng nhập'); this.status = res.status; this.wwwAuth = res.headers.get('www-authenticate') || ''; }
}

// Một phiên nói chuyện với một máy chủ MCP. token: chuỗi Bearer (có thể rỗng).
export class McpConnection {
  constructor(url, token) {
    this.url = String(url);
    this.token = token || '';
    this.sessionId = '';
    this.version = PROTOCOL;
    this.nextId = 1;
    this.info = null;
  }

  headers(extra) {
    const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...extra };
    if (this.token) h.authorization = 'Bearer ' + this.token;
    if (this.sessionId) h['mcp-session-id'] = this.sessionId;
    if (this.info) h['mcp-protocol-version'] = this.version;
    return h;
  }

  async request(method, params) {
    const id = this.nextId++;
    const res = await timedFetch(this.url, { method: 'POST', headers: this.headers(), body: JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) });
    if (res.status === 401 || res.status === 403) throw new McpAuthError(res);
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;
    if (res.status === 404 && this.sessionId) throw new Error('Phiên MCP đã hết hạn');
    if (!res.ok && res.status !== 202) throw new Error(`Máy chủ MCP trả lỗi ${res.status}`);
    const msg = await readRpc(res, id);
    if (!msg) throw new Error('Máy chủ MCP không trả lời đúng chuẩn');
    if (msg.error) throw new Error('MCP: ' + String(msg.error.message || JSON.stringify(msg.error)).slice(0, 200));
    return msg.result;
  }

  async notify(method) {
    try {
      await timedFetch(this.url, { method: 'POST', headers: this.headers(), body: JSON.stringify({ jsonrpc: '2.0', method }) }, 8000);
    } catch (e) { /* thông báo không cần trả lời */ }
  }

  async initialize() {
    const result = await this.request('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT });
    this.info = result || {};
    if (result && result.protocolVersion) this.version = result.protocolVersion;
    await this.notify('notifications/initialized');
    return this.info;
  }

  async listTools(maxPages = 3) {
    const tools = [];
    let cursor;
    for (let i = 0; i < maxPages; i++) {
      const r = await this.request('tools/list', cursor ? { cursor } : {});
      tools.push(...((r && r.tools) || []));
      cursor = r && r.nextCursor;
      if (!cursor) break;
    }
    return tools;
  }

  callTool(name, args) {
    return this.request('tools/call', { name, arguments: args || {} });
  }
}

// ---------- OAuth theo chuẩn MCP ----------
async function getJson(url) {
  try {
    const res = await timedFetch(url, { headers: { accept: 'application/json', 'mcp-protocol-version': PROTOCOL } }, 10000);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

function wellKnown(base, name) {
  const u = new URL(base);
  const path = u.pathname.replace(/\/$/, '');
  const list = [];
  if (path && path !== '/') list.push(`${u.origin}/.well-known/${name}${path}`);
  list.push(`${u.origin}/.well-known/${name}`);
  return list;
}

// Tìm thông tin máy chủ cấp quyền cho một link MCP. wwwAuth: header WWW-Authenticate của câu trả lời 401.
export async function discoverOAuth(mcpUrl, wwwAuth) {
  let prm = null;
  const m = /resource_metadata="([^"]+)"/i.exec(wwwAuth || '');
  if (m) prm = await getJson(m[1]);
  if (!prm) for (const u of wellKnown(mcpUrl, 'oauth-protected-resource')) { prm = await getJson(u); if (prm) break; }
  const scopeHint = /scope="([^"]+)"/i.exec(wwwAuth || '');
  const issuer = (prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers[0]) || new URL(mcpUrl).origin;
  let as = null;
  const asUrls = [...wellKnown(issuer, 'oauth-authorization-server'), ...wellKnown(issuer, 'openid-configuration')];
  for (const u of asUrls) { as = await getJson(u); if (as && as.authorization_endpoint) break; as = null; }
  if (!as) {
    const o = new URL(issuer).origin;
    as = { issuer: o, authorization_endpoint: o + '/authorize', token_endpoint: o + '/token', registration_endpoint: o + '/register' };
  }
  const scopes = (scopeHint && scopeHint[1]) || (prm && Array.isArray(prm.scopes_supported) ? prm.scopes_supported.join(' ') : '');
  return {
    issuer: as.issuer || issuer,
    authorizationEndpoint: as.authorization_endpoint,
    tokenEndpoint: as.token_endpoint,
    registrationEndpoint: as.registration_endpoint || '',
    resource: (prm && prm.resource) || mcpUrl,
    scopes,
    pkce: !as.code_challenge_methods_supported || as.code_challenge_methods_supported.includes('S256'),
  };
}

// Tự đăng ký Crewzy làm app OAuth (Dynamic Client Registration).
export async function registerClient(oauth, redirectUri) {
  if (!oauth.registrationEndpoint) throw new Error('Máy chủ này không cho tự đăng ký app. Hãy dán token truy cập ở mục Nâng cao.');
  const res = await timedFetch(oauth.registrationEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'Crewzy', client_uri: new URL(redirectUri).origin, redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none',
    }),
  }, 15000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_id) throw new Error('Máy chủ từ chối đăng ký app (' + res.status + ').');
  return { clientId: data.client_id, clientSecret: data.client_secret || '', authMethod: data.token_endpoint_auth_method || (data.client_secret ? 'client_secret_post' : 'none') };
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function randomToken(n = 32) { return b64url(crypto.getRandomValues(new Uint8Array(n))); }
export async function pkceChallenge(verifier) { return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))); }

export function authorizeUrl(oauth, client, { redirectUri, state, challenge }) {
  const u = new URL(oauth.authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', client.clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('resource', oauth.resource);
  if (oauth.scopes) u.searchParams.set('scope', oauth.scopes);
  return u.toString();
}

// Đổi mã lấy token, hoặc làm mới token. Trả về {access, refresh, expiresAt}.
export async function tokenRequest(oauth, client, fields) {
  const body = new URLSearchParams({ ...fields, client_id: client.clientId, resource: oauth.resource });
  const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  if (client.clientSecret) {
    if (client.authMethod === 'client_secret_basic') headers.authorization = 'Basic ' + btoa(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`);
    else body.set('client_secret', client.clientSecret);
  }
  const res = await timedFetch(oauth.tokenEndpoint, { method: 'POST', headers, body }, 15000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('Không lấy được quyền truy cập (' + res.status + (data.error ? ' ' + data.error : '') + ').');
  return {
    access: data.access_token,
    refresh: data.refresh_token || fields.refresh_token || '',
    expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0,
  };
}

// Đổi kết quả tools/call của MCP thành dạng {data} / {error} như công cụ Composio.
export function mcpResultToTool(result) {
  if (!result) return { error: 'Máy chủ MCP không trả kết quả' };
  const parts = [];
  const images = [];
  for (const c of result.content || []) {
    if (c.type === 'text') parts.push(c.text);
    else if (c.type === 'image' && c.data) images.push({ data: c.data, mimeType: c.mimeType || 'image/png' });
    else if (c.type === 'resource_link' || c.type === 'resource') parts.push(JSON.stringify(c.resource || { uri: c.uri, name: c.name }));
  }
  const text = parts.join('\n');
  if (result.isError) return { error: text || 'Công cụ báo lỗi' };
  return { data: result.structuredContent ? { text, structured: result.structuredContent } : text, images };
}
