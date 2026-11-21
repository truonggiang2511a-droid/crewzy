// Cổng MCP: khách dán https://<site>/mcp/<token> vào Claude/ChatGPT. Cổng kiểm tra chữ ký token,
// rồi chuyển tiếp nguyên yêu cầu MCP tới link phiên của Composio, gắn x-api-key ở máy chủ.
// Chạy trên Edge (ít CPU, không bị giới hạn 10 giây như hàm thường khi chờ Composio trả lời).

const enc = new TextEncoder();

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function expectedSig(payload, apiKey) {
  const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode('vpai-mcp|' + apiKey));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return toBase64Url(new Uint8Array(mac));
}

const plain = (status, text) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export default async (request) => {
  const apiKey = Netlify.env.get('COMPOSIO_API_KEY');
  if (!apiKey) return plain(500, 'Máy chủ chưa có khoá COMPOSIO_API_KEY.');

  const token = new URL(request.url).pathname.replace(/^\/mcp\//, '').split('/')[0];
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return plain(404, 'Link nối AI không hợp lệ.');
  if (!sameText(await expectedSig(payload, apiKey), sig)) return plain(403, 'Link nối AI không hợp lệ hoặc đã bị đổi.');

  let upstream;
  try {
    upstream = new URL(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return plain(400, 'Link nối AI hỏng.');
  }
  if (upstream.protocol !== 'https:' || !upstream.hostname.endsWith('composio.dev')) {
    return plain(403, 'Link nối AI không trỏ tới Composio.');
  }

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

export const config = { path: '/mcp/*' };
