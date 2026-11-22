// Tạo link MCP riêng cho khách để dán vào Claude hoặc ChatGPT.
// Link trỏ về cổng /mcp/<token> của app; cổng gắn khoá Composio ở máy chủ, khách không thấy khoá.
// GET /api/mcp-link[?uid=<mã trình duyệt, chỉ dùng khi chưa bật đăng nhập Google>]
import { Composio } from '@composio/core';
import { TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, userIdFor, safeDetail, getApiKey, signUpstream, resolveUid } from '../lib/common.js';

export default async (req, env) => {
  const url = new URL(req.url);
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  try {
    const composio = new Composio({ apiKey });
    const session = await composio.create(userIdFor(uid), {
      mcp: true,
      toolkits: TOOLKITS,
      multiAccount: { enable: true, maxAccountsPerToolkit: MAX_ACCOUNTS_PER_TOOLKIT },
    });
    const upstream = session.mcp && session.mcp.url;
    if (!upstream) {
      return Response.json({ error: 'Composio không trả về link MCP.' }, { status: 502 });
    }
    const token = await signUpstream(upstream, apiKey);
    return Response.json({ url: `${url.origin}/mcp/${token}` });
  } catch (err) {
    console.error('mcp-link failed', err && err.message);
    return Response.json({ error: 'Không tạo được link nối AI, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 502 });
  }
};

