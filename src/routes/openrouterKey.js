// Dự phòng khi trình duyệt không gọi thẳng được OpenRouter: chuyển tiếp bước đổi mã PKCE lấy khoá.
// POST /api/openrouter-key { code, code_verifier, code_challenge_method } → { key }   (không lưu khoá, không ghi log khoá)
export default async (req, env) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body;
  try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const { code, code_verifier: verifier } = body || {};
  if (typeof code !== 'string' || code.length > 500 || typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) {
    return Response.json({ error: 'Thiếu mã đăng nhập OpenRouter.' }, { status: 400 });
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.key) return Response.json({ error: 'OpenRouter chưa cấp khoá.' }, { status: res.status || 502 });
    return Response.json({ key: data.key }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('openrouter exchange failed', err && err.message);
    return Response.json({ error: 'Không kết nối được OpenRouter.' }, { status: 502 });
  }
};

