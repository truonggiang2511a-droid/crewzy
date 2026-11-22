// Thử máy khách MCP ngoài với một máy chủ giả (không cần mạng): SSE, phiên, 401 → tìm OAuth → DCR → đổi mã lấy token.
import assert from 'node:assert/strict';
import { McpConnection, McpAuthError, checkMcpUrl, discoverOAuth, registerClient, authorizeUrl, tokenRequest, pkceChallenge, mcpResultToTool } from '../src/lib/mcpClient.js';

const MCP = 'https://mcp.example.com/mcp';
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push(url);
  const h = init.headers || {};
  if (url === MCP) {
    const msg = JSON.parse(init.body);
    if (h.authorization !== 'Bearer good') {
      return new Response('', { status: 401, headers: { 'www-authenticate': 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"' } });
    }
    if (!msg.id) return new Response(null, { status: 202 });
    if (msg.method !== 'initialize') assert.equal(h['mcp-session-id'], 'sess-1');
    const result = msg.method === 'initialize' ? { protocolVersion: '2025-06-18', serverInfo: { name: 'Fake' } }
      : msg.method === 'tools/list' ? { tools: [{ name: 'create-page', description: 'Tạo trang', inputSchema: { type: 'object', properties: { title: { type: 'string' } } } }] }
      : { content: [{ type: 'text', text: 'đã tạo' }, { type: 'image', data: 'AAAA', mimeType: 'image/png' }] };
    const body = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n\n`;
    return new Response(body, { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 'sess-1' } });
  }
  if (url === 'https://mcp.example.com/.well-known/oauth-protected-resource/mcp') return Response.json({ resource: MCP, authorization_servers: ['https://auth.example.com'], scopes_supported: ['read', 'write'] });
  if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') return Response.json({ issuer: 'https://auth.example.com', authorization_endpoint: 'https://auth.example.com/authorize', token_endpoint: 'https://auth.example.com/token', registration_endpoint: 'https://auth.example.com/register', code_challenge_methods_supported: ['S256'] });
  if (url === 'https://auth.example.com/register') return Response.json({ client_id: 'cid-1' }, { status: 201 });
  if (url === 'https://auth.example.com/token') {
    const b = new URLSearchParams(String(init.body));
    assert.equal(b.get('resource'), MCP);
    assert.equal(b.get('client_id'), 'cid-1');
    return Response.json({ access_token: 'good', refresh_token: 'r1', expires_in: 3600 });
  }
  return new Response('not found', { status: 404 });
};

assert.ok(checkMcpUrl('http://x.com/mcp').error);
assert.ok(checkMcpUrl('https://127.0.0.1/mcp').error);
assert.ok(checkMcpUrl('https://localhost/mcp').error);
assert.ok(checkMcpUrl('https://a.com/sse').error);
assert.ok(checkMcpUrl(MCP).url);

// Chưa có token → 401
let authErr;
try { await new McpConnection(MCP, '').initialize(); } catch (e) { authErr = e; }
assert.ok(authErr instanceof McpAuthError);

const oauth = await discoverOAuth(MCP, authErr.wwwAuth);
assert.equal(oauth.tokenEndpoint, 'https://auth.example.com/token');
assert.equal(oauth.scopes, 'read write');
const client = await registerClient(oauth, 'https://crewzy.test/api/mcp-callback');
assert.equal(client.clientId, 'cid-1');
const link = new URL(authorizeUrl(oauth, client, { redirectUri: 'https://crewzy.test/api/mcp-callback', state: 's'.repeat(24), challenge: await pkceChallenge('v'.repeat(64)) }));
assert.equal(link.searchParams.get('resource'), MCP);
assert.equal(link.searchParams.get('code_challenge_method'), 'S256');
const t = await tokenRequest(oauth, client, { grant_type: 'authorization_code', code: 'c', redirect_uri: 'x', code_verifier: 'v' });
assert.equal(t.access, 'good');

const conn = new McpConnection(MCP, t.access);
const info = await conn.initialize();
assert.equal(info.serverInfo.name, 'Fake');
const tools = await conn.listTools();
assert.equal(tools[0].name, 'create-page');
const res = mcpResultToTool(await conn.callTool('create-page', { title: 'A' }));
assert.equal(res.data, 'đã tạo');
assert.equal(res.images.length, 1);
console.log('mcptest OK');
