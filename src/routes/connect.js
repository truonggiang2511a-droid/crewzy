// Tạo link đăng nhập Composio cho một công cụ (mỗi lần bấm thêm 1 tài khoản, tối đa 5 tài khoản/công cụ).
// GET /api/connect?toolkit=<slug>[&uid=<mã trình duyệt, chỉ dùng khi chưa bật đăng nhập Google>]
import { Composio } from '@composio/core';
import { isAdminEmail, getFeatures, SOCIAL_APPS } from '../lib/billing.js';
import { connectedApps } from '../lib/connected.js';
import { TOOLKITS, MAX_ACCOUNTS_PER_TOOLKIT, userIdFor, safeDetail, getApiKey, resolveUid } from '../lib/common.js';

export default async (req, env) => {
  const url = new URL(req.url);
  const toolkit = url.searchParams.get('toolkit') || '';

  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  // ?thu=1: CHỈ admin (ADMIN_EMAILS) thử app chưa mở để biết Composio có ra link không (thêm app mới: ra link mới đổi 'ready').
  const probe = url.searchParams.get('thu') === '1' && who.session && isAdminEmail(env, who.session.email) && /^[a-z0-9_]{2,40}$/.test(toolkit);
  if (!TOOLKITS.includes(toolkit) && !probe) {
    return Response.json({ error: 'Công cụ này chưa được mở kết nối thật.' }, { status: 400 });
  }
  const uid = who.uid;
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  try {
    const composio = new Composio({ apiKey });
    const userId = userIdFor(uid);
    const existing = await composio.connectedAccounts.list({ userIds: [userId], toolkitSlugs: [toolkit], statuses: ['ACTIVE'] });
    // Theo gói (23/11): số tài khoản mỗi nền tảng (1 / 5 / 10); Agency: mỗi doanh nghiệp tối đa kenh_moi_dn kênh mạng xã hội.
    const feat = probe ? null : await getFeatures(env, uid, who.session && who.session.email).catch(() => null);
    const maxAcc = feat && feat.tai_khoan ? feat.tai_khoan : MAX_ACCOUNTS_PER_TOOLKIT;
    if ((existing.items || []).length >= maxAcc) {
      return Response.json({ error: `Gói hiện tại cho tối đa ${maxAcc} tài khoản mỗi nền tảng. Nâng gói ở trang Gói và credit để nối thêm.` }, { status: 400 });
    }
    if (feat && feat.kenh_moi_dn && SOCIAL_APPS.includes(toolkit)) {
      const have = await connectedApps(env, uid).catch(() => ({}));
      const kenh = Object.entries(have || {}).filter(([k, n]) => SOCIAL_APPS.includes(k) && n > 0).reduce((t, [, n]) => t + n, 0);
      if (kenh >= feat.kenh_moi_dn) return Response.json({ error: `Mỗi doanh nghiệp tối đa ${feat.kenh_moi_dn} kênh mạng xã hội. Gỡ bớt kênh hoặc tạo doanh nghiệp khác.` }, { status: 400 });
    }
    const session = await composio.create(userId, {
      toolkits: [toolkit],
      multiAccount: { enable: true, maxAccountsPerToolkit: Math.max(MAX_ACCOUNTS_PER_TOOLKIT, maxAcc) },
    });
    const request = await session.authorize(toolkit, {
      callbackUrl: url.searchParams.get('back') === 'bat-dau' ? `${url.origin}/bat-dau.html?ket_noi=${toolkit}` : url.searchParams.get('back') === 'chat' ? `${url.origin}/chat.html?ket_noi=${toolkit}` : `${url.origin}/ket-noi.html?ket_noi=${toolkit}`,
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

