// Số tài khoản đã kết nối thật (ACTIVE) theo từng công cụ của một khách.
// GET /api/status[?uid=<mã trình duyệt, chỉ dùng khi chưa bật đăng nhập Google>]
import { Composio } from '@composio/core';
import { userIdFor, safeDetail, getApiKey, resolveUid } from '../lib/common.js';

export default async (req, env) => {
  const who = await resolveUid(req, env, new URL(req.url).searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  try {
    const composio = new Composio({ apiKey });
    const result = await composio.connectedAccounts.list({ userIds: [userIdFor(uid)], statuses: ['ACTIVE'], limit: 100 });
    const accounts = {};
    for (const item of result.items || []) {
      const slug = item.toolkit && item.toolkit.slug;
      if (slug) accounts[slug] = (accounts[slug] || 0) + 1;
    }
    return Response.json({ accounts, connected: Object.keys(accounts) });
  } catch (err) {
    console.error('status failed', err && err.message);
    return Response.json({ error: 'Không đọc được trạng thái kết nối.', detail: safeDetail(err) }, { status: 502 });
  }
};

