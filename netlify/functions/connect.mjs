// Tạo link đăng nhập Composio cho một công cụ (mỗi lần bấm thêm 1 tài khoản, tối đa 5 tài khoản/công cụ).
// GET /api/connect?toolkit=<slug>&uid=<mã khách trên trình duyệt>
import { Composio } from '@composio/core';
import { TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, UID_PATTERN, userIdFor, safeDetail, getApiKey } from '../lib/common.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const toolkit = url.searchParams.get('toolkit') || '';
  const uid = url.searchParams.get('uid') || '';

  if (!TOOLKITS.includes(toolkit)) {
    return Response.json({ error: 'Công cụ này chưa được mở kết nối thật.' }, { status: 400 });
  }
  if (!UID_PATTERN.test(uid)) {
    return Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 });
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  try {
    const composio = new Composio({ apiKey });
    const userId = userIdFor(uid);
    const existing = await composio.connectedAccounts.list({ userIds: [userId], toolkitSlugs: [toolkit], statuses: ['ACTIVE'] });
    if ((existing.items || []).length >= MAX_ACCOUNTS_PER_TOOLKIT) {
      return Response.json({ error: `Đã đủ ${MAX_ACCOUNTS_PER_TOOLKIT} tài khoản cho công cụ này.` }, { status: 400 });
    }
    const session = await composio.create(userId, {
      toolkits: [toolkit],
      multiAccount: { enable: true, maxAccountsPerToolkit: MAX_ACCOUNTS_PER_TOOLKIT },
    });
    const request = await session.authorize(toolkit, {
      callbackUrl: `${url.origin}/ket-noi.html?ket_noi=${toolkit}`,
      alias: `${toolkit}-${Date.now().toString(36)}`,
    });
    if (!request.redirectUrl) {
      return Response.json({ error: 'Composio không trả về link đăng nhập.' }, { status: 502 });
    }
    return Response.json({ redirectUrl: request.redirectUrl });
  } catch (err) {
    console.error('connect failed', toolkit, err && err.message);
    const detail = safeDetail(err);
    const needsOwnApp = /auth.?config|managed/i.test(detail);
    return Response.json({
      error: needsOwnApp ? 'Công cụ này cần app riêng, chưa kết nối nhanh được.' : 'Không tạo được link kết nối, thử lại sau ít phút.',
      detail,
    }, { status: 502 });
  }
};

export const config = { path: '/api/connect' };
