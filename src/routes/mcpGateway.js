// Cổng MCP: khách dán https://<site>/mcp/<token> vào Claude/ChatGPT. Cổng kiểm tra chữ ký token,
// rồi chuyển tiếp nguyên yêu cầu MCP tới link phiên của Composio, gắn x-api-key ở máy chủ (khách không thấy khoá).
import { getApiKey, verifyUpstreamToken } from '../lib/common.js';

const plain = (status, text) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export default async (request, env) => {
  const apiKey = getApiKey(env);
  if (!apiKey) return plain(500, 'Máy chủ chưa có khoá COMPOSIO_API_KEY.');
  const token = new URL(request.url).pathname.replace(/^\/mcp\//, '').split('/')[0];
  const upstream = await verifyUpstreamToken(token, apiKey);
  if (!upstream) return plain(403, 'Link nối AI không hợp lệ hoặc đã bị đổi.');
  if (upstream.protocol !== 'https:' || !upstream.hostname.endsWith('composio.dev')) return plain(403, 'Link nối AI không trỏ tới Composio.');

  const headers = new Headers();
  for (const name of ['content-type', 'accept', 'mcp-session-id', 'mcp-protocol-version', 'last-event-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-api-key', apiKey);
  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();

  const res = await fetch(upstream.toString(), init);
  const out = new Headers();
  for (const name of ['content-type', 'mcp-session-id', 'cache-control', 'mcp-protocol-version']) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.body, { status: res.status, headers: out });
};
