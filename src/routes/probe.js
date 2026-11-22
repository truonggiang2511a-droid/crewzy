// TẠM THỜI (xoá sau khi chốt danh mục): GET /api/probe-toolkits?cursor= → danh sách toolkit Composio (slug, tên, thể loại, kiểu đăng nhập).
import { getApiKey } from '../lib/common.js';
export default async (req, env) => {
  const url = new URL(req.url);
  const q = new URLSearchParams({ limit: '1000' });
  if (url.searchParams.get('cursor')) q.set('cursor', url.searchParams.get('cursor'));
  const res = await fetch('https://backend.composio.dev/api/v3/toolkits?' + q, { headers: { 'x-api-key': getApiKey(env) } });
  const data = await res.json();
  const items = (data.items || []).map((t) => ({
    slug: t.slug, name: t.name, cats: ((t.meta && t.meta.categories) || []).map((c) => c.name || c.slug || c).slice(0, 3),
    tools: t.meta && t.meta.tools_count, managed: t.composio_managed_auth_schemes || [], schemes: t.auth_schemes || [], no_auth: !!t.no_auth,
    desc: String((t.meta && t.meta.description) || '').slice(0, 140),
  }));
  return Response.json({ count: items.length, next: data.next_cursor || null, items });
};
