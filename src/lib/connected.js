// App Composio đang ACTIVE của một khách → {slug: số tài khoản}. null nếu Composio lỗi (đừng coi là "chưa nối gì").
import { Composio } from '@composio/core';
import { getApiKey, userIdFor } from './common.js';

export async function connectedApps(env, uid) {
  try {
    const composio = new Composio({ apiKey: getApiKey(env) });
    const res = await composio.connectedAccounts.list({ userIds: [userIdFor(uid)], statuses: ['ACTIVE'], limit: 100 });
    const out = {};
    for (const i of res.items || []) { const s = i.toolkit && i.toolkit.slug; if (s) out[s] = (out[s] || 0) + 1; }
    return out;
  } catch (e) { console.error('connected apps failed', e && e.message); return null; }
}
