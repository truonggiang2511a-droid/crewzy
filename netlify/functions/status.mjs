// Trả về danh sách công cụ đã kết nối thật (trạng thái ACTIVE) của một khách.
// GET /api/status?uid=<mã khách trên trình duyệt>
import { Composio } from '@composio/core';

const UID_PATTERN = /^[a-z0-9-]{8,64}$/;
const TOOLKITS = ['gmail', 'googlesheets'];

function safeDetail(err) {
  const text = String((err && (err.message || err)) || '').replace(/\b[a-z]{2}_[A-Za-z0-9*_-]+/g, '***');
  return text.slice(0, 300);
}

export default async (req) => {
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!UID_PATTERN.test(uid)) {
    return Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 });
  }

  const apiKey = Netlify.env.get('COMPOSIO_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  const userId = `vpai-${uid}`;
  const composio = new Composio({ apiKey });
  try {
    let connected;
    try {
      const result = await composio.connectedAccounts.list({ userIds: [userId], statuses: ['ACTIVE'] });
      connected = (result.items || []).map((item) => item.toolkit && item.toolkit.slug);
    } catch (listErr) {
      // Khoá có quyền giới hạn có thể không đọc được danh sách tài khoản: hỏi qua phiên làm việc thay thế.
      const session = await composio.create(userId, { toolkits: TOOLKITS });
      const result = await session.toolkits({ toolkits: TOOLKITS });
      connected = (result.items || []).filter((item) => item.connection && item.connection.isActive).map((item) => item.slug);
    }
    return Response.json({ connected: [...new Set(connected.filter(Boolean))] });
  } catch (err) {
    console.error('status failed', err && err.message);
    return Response.json({ error: 'Không đọc được trạng thái kết nối.', detail: safeDetail(err) }, { status: 502 });
  }
};

export const config = { path: '/api/status' };
