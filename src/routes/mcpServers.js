// Nối máy chủ MCP của app khác vào Crewzy (giống "Add custom connector" của Claude: tên máy chủ + link MCP → Kết nối).
// GET  /api/mcp-servers?uid=            → {servers}
// POST /api/mcp-servers {uid, action:'add', name, url, token?} → {server} | {authUrl} (cần đăng nhập trên trang của app đó)
// POST /api/mcp-servers {uid, action:'remove'|'test', id}
// GET  /api/mcp-callback?code&state     → app kia trả về sau khi khách đồng ý → lưu token → về ket-noi.html?tab=mcp
import { resolveUid, kvGetJson, kvPutJson, sealText, openText } from '../lib/common.js';
import { checkMcpUrl, McpConnection, McpAuthError, discoverOAuth, registerClient, randomToken, pkceChallenge, authorizeUrl, authorizeAccepted, tokenRequest } from '../lib/mcpClient.js';
import { listServers, saveServers, publicServer, newServerId, cleanName, openServer, MAX_SERVERS } from '../lib/mcpServers.js';

const PENDING_TTL = 900;
const callbackUrl = (req) => new URL('/api/mcp-callback', req.url).toString();
const clientDocUrl = (req) => new URL('/api/oauth-client.json', req.url).toString();

// Tài liệu mô tả app Crewzy cho OAuth (Client ID Metadata Document): client_id chính là link này.
function clientDocument(req) {
  const origin = new URL(req.url).origin;
  return Response.json({
    client_id: clientDocUrl(req), client_name: 'Crewzy', client_uri: origin, logo_uri: origin + '/assets/favicon.svg',
    redirect_uris: [callbackUrl(req)], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
const errText = (e) => String((e && e.message) || e || 'Lỗi không rõ').slice(0, 240);

async function probe(url, token) {
  const conn = new McpConnection(url, token);
  const info = await conn.initialize();
  const tools = await conn.listTools();
  return { info, tools };
}

function serverRecord({ id, name, url, auth, tools, info }) {
  return {
    id, name, url, auth, tools: tools.length,
    toolNames: tools.slice(0, 30).map((t) => t.name),
    serverName: (info && info.serverInfo && info.serverInfo.name) || '',
    addedAt: new Date().toISOString(),
  };
}

async function upsert(env, uid, rec) {
  const list = await listServers(env, uid);
  const i = list.findIndex((s) => s.id === rec.id || s.url === rec.url);
  if (i >= 0) { rec.id = list[i].id; list[i] = rec; } else list.unshift(rec);
  await saveServers(env, uid, list);
  return rec;
}

async function startOAuth(req, env, uid, { id, name, url, wwwAuth }) {
  const oauth = await discoverOAuth(url, wwwAuth);
  if (!oauth.authorizationEndpoint || !oauth.tokenEndpoint) throw new Error('Không tìm thấy trang đăng nhập của máy chủ này.');
  const redirectUri = callbackUrl(req);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);
  // Thử lần lượt: client ID dạng link tài liệu (CIMD, chuẩn MCP mới) rồi tự đăng ký (DCR). Chọn cách máy chủ chấp nhận.
  const candidates = [];
  if (oauth.cimd) candidates.push(async () => ({ clientId: clientDocUrl(req), clientSecret: '', authMethod: 'none' }));
  candidates.push(() => registerClient(oauth, redirectUri));
  let client = null;
  let link = '';
  let lastErr = null;
  for (const make of candidates) {
    try {
      const c = await make();
      const l = authorizeUrl(oauth, c, { redirectUri, state, challenge });
      if (await authorizeAccepted(l)) { client = c; link = l; break; }
    } catch (e) { lastErr = e; }
  }
  if (!client) {
    throw new Error(lastErr ? errText(lastErr) : 'Máy chủ này chỉ cho một số app AI được duyệt (như Claude, ChatGPT) đăng nhập, chưa nhận Crewzy.');
  }
  await kvPutJson(env, 'mcpoauth:' + state, {
    uid, id, name, url, redirectUri,
    oauth: { ...oauth, clientId: client.clientId, clientSecret: await sealText(env, client.clientSecret), authMethod: client.authMethod },
    verifier: await sealText(env, verifier),
  }, { expirationTtl: PENDING_TTL });
  return link;
}

async function finishOAuth(req, env) {
  const q = new URL(req.url).searchParams;
  const back = (ok, msg) => Response.redirect(new URL(`/ket-noi.html?tab=mcp&mcp=${ok ? 'ok' : 'err'}&msg=${encodeURIComponent(msg || '')}`, req.url).toString(), 302);
  const state = q.get('state') || '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(state)) return back(false, 'Thiếu mã xác nhận, hãy bấm Kết nối lại.');
  const pending = await kvGetJson(env, 'mcpoauth:' + state);
  if (!pending) return back(false, 'Phiên kết nối đã hết hạn (15 phút), hãy bấm Kết nối lại.');
  await env.KV.delete('mcpoauth:' + state);
  if (q.get('error')) return back(false, 'Bạn chưa đồng ý cho Crewzy truy cập ' + pending.name + '.');
  const code = q.get('code');
  if (!code) return back(false, 'Máy chủ không trả mã đăng nhập.');
  try {
    const o = pending.oauth;
    const client = { clientId: o.clientId, clientSecret: await openText(env, o.clientSecret), authMethod: o.authMethod };
    const t = await tokenRequest(o, client, {
      grant_type: 'authorization_code', code, redirect_uri: pending.redirectUri, code_verifier: await openText(env, pending.verifier),
    });
    const { info, tools } = await probe(pending.url, t.access);
    const rec = serverRecord({ id: pending.id, name: pending.name, url: pending.url, auth: 'oauth', tools, info });
    rec.oauth = { ...o, access: await sealText(env, t.access), refresh: await sealText(env, t.refresh), expiresAt: t.expiresAt };
    await upsert(env, pending.uid, rec);
    return back(true, `Đã nối ${pending.name} (${tools.length} công cụ).`);
  } catch (e) {
    console.error('mcp oauth finish failed', pending.url, errText(e));
    return back(false, 'Nối ' + pending.name + ' chưa được: ' + errText(e));
  }
}

export default async (req, env) => {
  const path = new URL(req.url).pathname;
  if (path === '/api/mcp-callback') return finishOAuth(req, env);
  if (path === '/api/oauth-client.json') return clientDocument(req);

  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? new URL(req.url).searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  const uid = who.uid;

  if (req.method === 'GET') {
    return Response.json({ servers: (await listServers(env, uid)).map(publicServer) }, { headers: { 'cache-control': 'no-store' } });
  }

  const action = body.action;
  if (action === 'remove') {
    const list = await listServers(env, uid);
    await saveServers(env, uid, list.filter((s) => s.id !== body.id));
    return Response.json({ ok: true });
  }

  if (action === 'test') {
    const list = await listServers(env, uid);
    const s = list.find((x) => x.id === body.id);
    if (!s) return Response.json({ error: 'Không tìm thấy máy chủ này.' }, { status: 404 });
    try {
      const { tools } = await openServer(env, s);
      s.tools = tools.length; s.toolNames = tools.slice(0, 30).map((t) => t.name); s.error = '';
      await saveServers(env, uid, list);
      return Response.json({ server: publicServer(s) });
    } catch (e) {
      s.error = e instanceof McpAuthError ? 'Hết quyền truy cập, hãy nối lại.' : errText(e);
      await saveServers(env, uid, list);
      return Response.json({ error: s.error, server: publicServer(s) }, { status: 502 });
    }
  }

  if (action !== 'add') return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  const checked = checkMcpUrl(body.url);
  if (checked.error) return Response.json({ error: checked.error }, { status: 400 });
  const url = checked.url.toString();
  const name = cleanName(body.name, url);
  const list = await listServers(env, uid);
  const existing = list.find((s) => s.url === url);
  if (!existing && list.length >= MAX_SERVERS) return Response.json({ error: `Tối đa ${MAX_SERVERS} máy chủ MCP. Gỡ bớt rồi thêm.` }, { status: 400 });
  const id = existing ? existing.id : newServerId();
  const token = typeof body.token === 'string' ? body.token.trim().replace(/^Bearer\s+/i, '') : '';

  try {
    const { info, tools } = await probe(url, token);
    const rec = serverRecord({ id, name, url, auth: token ? 'token' : 'none', tools, info });
    if (token) rec.token = await sealText(env, token);
    await upsert(env, uid, rec);
    return Response.json({ server: publicServer(rec) });
  } catch (e) {
    if (e instanceof McpAuthError) {
      if (token) return Response.json({ error: 'Token không đúng hoặc đã hết hạn.' }, { status: 400 });
      try {
        const authUrl = await startOAuth(req, env, uid, { id, name, url, wwwAuth: e.wwwAuth });
        return Response.json({ authUrl });
      } catch (e2) {
        console.error('mcp oauth start failed', url, errText(e2));
        return Response.json({ error: 'Máy chủ này cần đăng nhập nhưng chưa nối tự động được: ' + errText(e2) }, { status: 502 });
      }
    }
    console.error('mcp add failed', url, errText(e));
    return Response.json({ error: 'Chưa nối được: ' + errText(e) }, { status: 502 });
  }
};
