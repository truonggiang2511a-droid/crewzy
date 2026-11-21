// Tạo link đăng nhập Composio cho một công cụ, rồi trả về để trình duyệt chuyển khách sang trang đăng nhập.
// GET /api/connect?toolkit=gmail&uid=<mã khách trên trình duyệt>
import { Composio } from '@composio/core';

const ALLOWED_TOOLKITS = new Set(['gmail', 'googlesheets']);
const UID_PATTERN = /^[a-z0-9-]{8,64}$/;

function safeDetail(err) {
  const text = String((err && (err.message || err)) || '').replace(/\b[a-z]{2}_[A-Za-z0-9*_-]+/g, '***');
  return text.slice(0, 300);
}

export default async (req) => {
  const url = new URL(req.url);
  const toolkit = url.searchParams.get('toolkit') || '';
  const uid = url.searchParams.get('uid') || '';

  if (!ALLOWED_TOOLKITS.has(toolkit)) {
    return Response.json({ error: 'Công cụ này chưa được mở kết nối thật.' }, { status: 400 });
  }
  if (!UID_PATTERN.test(uid)) {
    return Response.json({ error: 'Mã khách không hợp lệ.' }, { status: 400 });
  }

  const apiKey = Netlify.env.get('COMPOSIO_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'Máy chủ chưa có khoá COMPOSIO_API_KEY.' }, { status: 500 });
  }

  try {
    const composio = new Composio({ apiKey });
    const session = await composio.create(`vpai-${uid}`, { toolkits: [toolkit] });
    const request = await session.authorize(toolkit, {
      callbackUrl: `${url.origin}/ket-noi.html?ket_noi=${toolkit}`,
    });
    if (!request.redirectUrl) {
      return Response.json({ error: 'Composio không trả về link đăng nhập.' }, { status: 502 });
    }
    return Response.json({ redirectUrl: request.redirectUrl });
  } catch (err) {
    console.error('connect failed', toolkit, err && err.message);
    return Response.json({ error: 'Không tạo được link kết nối, thử lại sau ít phút.', detail: safeDetail(err) }, { status: 502 });
  }
};

export const config = { path: '/api/connect' };
