// Tạo link MCP riêng cho khách để dán vào Claude hoặc ChatGPT.
// Link trỏ về cổng /mcp/<token> của app; cổng gắn khoá Composio ở máy chủ, khách không thấy khoá.
// GET /api/mcp-link?uid=<mã khách trên trình duyệt>
import { Composio } from '@composio/core';
import { TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, UID_PATTERN, userIdFor, safeDetail, getApiKey, signUpstream } from '../lib/common.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const uid = url.searchParams.get('uid') || '';
  if (!UID_PATTERN.test(uid)) {
    return Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 });
  }
  const apiKey = getApiKey();
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
    const token = signUpstream(upstream, apiKey);
    return Response.json({ url: `${url.origin}/mcp/${token}` });
  } catch (err) {
    console.error('mcp-link failed', err && err.message);
    return Response.json({ error: 'Không tạo được link nối AI, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 502 });
  }
};

export const config = { path: '/api/mcp-link' };
