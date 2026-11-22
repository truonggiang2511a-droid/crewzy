// Gói, credit, thanh toán VietQR qua SePay và 4 bước bắt đầu.
//   GET  /api/billing                  → { bat, account, goi, nap, gia, don (10 gần nhất), so (30 dòng sổ credit), thanh_toan_mo, admin }
//   POST /api/billing/order {item}     → tạo đơn: { don: {id, code, amount, qr, ngan_hang, so_tk, chu_tk, het_han} }
//   GET  /api/billing/order?id=        → { don: {..., status} }   (trình duyệt hỏi mỗi 4 giây tới khi paid)
//   GET  /api/billing/admin            → admin: 100 tài khoản gần nhất · POST {email|uid, credits, days, plan} → cấp credit/gia hạn
//   POST /api/sepay/webhook            → SePay báo có tiền vào (header Authorization: Apikey <SEPAY_WEBHOOK_KEY>)
//   GET  /api/onboarding               → trạng thái 4 bước · POST /api/onboarding {ai: 'crewzy'} → chọn Trợ lý Crewzy làm bộ não
//   POST /api/onboarding/brand-from-web {url} → đọc website, Claude điền sẵn Brain (khách xem lại rồi bấm Lưu)
// Biến môi trường: SEPAY_WEBHOOK_KEY (bí mật), SEPAY_BANK (vd MBBank, VCB), SEPAY_ACCOUNT (số tài khoản), SEPAY_ACCOUNT_NAME, ADMIN_EMAILS.
import Anthropic from '@anthropic-ai/sdk';
import { resolveUid, safeDetail, sameText } from '../lib/common.js';
import {
  billingOn, plans, topups, prices, ensureAccount, getAccount, publicAccount, isAdminEmail, onboarding, grant,
} from '../lib/billing.js';
import { readWebsite } from '../lib/webRead.js';
import { BRAND_FIELDS } from '../lib/brand.js';

const ORDER_TTL = 24 * 3600 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ 0/O, 1/I cho khỏi gõ nhầm
const CODE_RE = /CZ[A-HJ-NP-Z2-9]{8}/;
const noStore = { 'cache-control': 'no-store' };

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return 'CZ' + Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
}
const newId = () => 'o' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('');
const sepayReady = (env) => !!(env.SEPAY_ACCOUNT && env.SEPAY_BANK && env.SEPAY_WEBHOOK_KEY);
const qrUrl = (env, amount, code) => `https://vietqr.app/img?acc=${encodeURIComponent(env.SEPAY_ACCOUNT)}&bank=${encodeURIComponent(env.SEPAY_BANK)}&amount=${amount}&des=${code}&template=compact`;

function publicOrder(env, o) {
  return {
    id: o.id, code: o.code, kind: o.kind, item: o.item, amount: o.amount, credits: o.credits, days: o.days, status: o.status,
    tao_luc: o.created_at, tra_luc: o.paid_at || null,
    qr: o.status === 'pending' && sepayReady(env) ? qrUrl(env, o.amount, o.code) : null,
    ngan_hang: env.SEPAY_BANK || '', so_tk: env.SEPAY_ACCOUNT || '', chu_tk: env.SEPAY_ACCOUNT_NAME || '',
  };
}
function findItem(env, item) {
  const p = plans(env).find((x) => x.id === item);
  if (p) return { kind: 'plan', item: p.id, amount: p.gia, credits: p.credits, days: p.ngay };
  const t = topups(env).find((x) => x.id === item);
  if (t) return { kind: 'topup', item: t.id, amount: t.gia, credits: t.credits, days: 0 };
  return null;
}

// ---------- SePay webhook ----------
async function sepayWebhook(req, env) {
  const auth = req.headers.get('authorization') || '';
  if (!env.SEPAY_WEBHOOK_KEY || !sameText(auth, 'Apikey ' + env.SEPAY_WEBHOOK_KEY)) return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  let t;
  try { t = await req.json(); } catch (e) { return Response.json({ success: false, error: 'bad json' }, { status: 400 }); }
  const id = Number(t && t.id);
  if (!Number.isFinite(id) || id <= 0) return Response.json({ success: false, error: 'missing id' }, { status: 400 });
  const now = Date.now();
  const content = String(t.content || '') + ' ' + String(t.code || '') + ' ' + String(t.description || '');
  const amount = Math.round(Number(t.transferAmount) || 0);
  // Chống trùng: id SePay là PRIMARY KEY, gửi lại thì INSERT bị bỏ qua → trả success, không cộng lần hai.
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payments (id, gateway, account, amount, content, reference, tx_date, raw, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(id, String(t.gateway || ''), String(t.accountNumber || ''), amount, content.slice(0, 500), String(t.referenceCode || ''), String(t.transactionDate || ''), JSON.stringify(t).slice(0, 4000), now).run();
  if (!ins.meta.changes) return Response.json({ success: true, duplicate: true });
  const setResult = (result, orderId) => env.DB.prepare('UPDATE payments SET result = ?2, order_id = ?3 WHERE id = ?1').bind(id, result, orderId || null).run();

  if (String(t.transferType || 'in') !== 'in') { await setResult('chuyen_ra'); return Response.json({ success: true }); }
  if (env.SEPAY_ACCOUNT && t.accountNumber && String(t.accountNumber) !== String(env.SEPAY_ACCOUNT)) { await setResult('sai_tai_khoan'); return Response.json({ success: true }); }
  const m = content.toUpperCase().replace(/\s+/g, ' ').match(CODE_RE);
  if (!m) { await setResult('khong_khop'); return Response.json({ success: true }); }
  const order = await env.DB.prepare('SELECT * FROM orders WHERE code = ?1').bind(m[0]).first();
  if (!order) { await setResult('khong_khop'); return Response.json({ success: true }); }
  if (order.status === 'paid') { await setResult('da_tra', order.id); return Response.json({ success: true }); }
  if (amount < order.amount) { await setResult('thieu_tien', order.id); return Response.json({ success: true }); }
  // Đánh dấu đã trả có điều kiện (status = pending) → hai webhook trùng mã cũng chỉ một cái cộng credit.
  const upd = await env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = ?2, payment_id = ?3 WHERE id = ?1 AND status = 'pending'").bind(order.id, now, id).run();
  if (!upd.meta.changes) { await setResult('da_tra', order.id); return Response.json({ success: true }); }
  await grant(env, order.uid, order.credits, order.days, order.kind === 'plan' ? 'mua_goi' : 'nap_credit', order.id, order.kind === 'plan' ? order.item : null);
  await setResult('da_cong', order.id);
  console.log('sepay paid', order.id, order.uid, amount);
  return Response.json({ success: true });
}

// ---------- Brain từ website ----------
async function brandFromWeb(env, url) {
  const page = await readWebsite(url);
  if (page.error) return { error: page.error };
  const d = page.data;
  const text = [d.tieu_de, d.mo_ta, ...(d.muc || []), d.chu].filter(Boolean).join('\n').slice(0, 9000);
  if (!env.ANTHROPIC_API_KEY) return { brand: { name: d.tieu_de || '', links: d.url } , ghi_chu: 'Chỉ lấy được tên từ tiêu đề trang. Điền các mục còn lại.' };
  const fields = ['name', 'industry', 'products', 'customers', 'voice', 'offers', 'faq', 'hashtags'];
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-haiku-5-5', max_tokens: 1200,
    system: 'Bạn điền hồ sơ thương hiệu cho doanh nghiệp Việt Nam từ nội dung website. Chỉ dùng thông tin có trong nội dung, không bịa giá, số liệu, lời khách. Mục không có thông tin thì để chuỗi rỗng. Trả về DUY NHẤT một object JSON.',
    messages: [{ role: 'user', content: `Website: ${d.url}\nCác mục cần điền (khoá: ý nghĩa): ${fields.map((k) => k + ': ' + BRAND_FIELDS[k]).join('; ')}.\nvoice = giọng văn suy ra từ cách website viết (vd thân thiện, chuyên nghiệp, xưng hô).\n\nNỘI DUNG:\n${text}` }],
  });
  const raw = (res.content.find((b) => b.type === 'text') || {}).text || '';
  let j = {};
  try { j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { return { error: 'Chưa đọc ra thông tin từ website, điền tay giúp em.' }; }
  const brand = {};
  for (const k of fields) if (typeof j[k] === 'string' && j[k].trim()) brand[k] = j[k].trim().slice(0, 2000);
  brand.links = d.url;
  return { brand, ghi_chu: 'Crewzy đã điền sẵn từ website. Kiểm tra, sửa cho đúng rồi bấm Lưu.' };
}

export default async (req, env, ctx) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === '/api/sepay/webhook') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.DB) return Response.json({ success: false, error: 'no db' }, { status: 503 });
    return sepayWebhook(req, env);
  }

  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  const email = (who.session && who.session.email) || '';
  const admin = isAdminEmail(env, email);

  if (path === '/api/onboarding') {
    if (req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch (e) { /* trống */ }
      if (body.ai === 'crewzy' && env.DB) {
        await ensureAccount(env, uid, email);
        await env.DB.prepare("UPDATE accounts SET ai_choice = 'crewzy', updated_at = ?2 WHERE uid = ?1").bind(uid, Date.now()).run();
      }
    }
    return Response.json(await onboarding(env, uid, { email, admin }), { headers: noStore });
  }
  if (path === '/api/onboarding/brand-from-web') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let body = {};
    try { body = await req.json(); } catch (e) { /* trống */ }
    try {
      const out = await brandFromWeb(env, body.url);
      return Response.json(out, { status: out.error ? 400 : 200 });
    } catch (e) {
      console.error('brand from web failed', e && e.message);
      return Response.json({ error: 'Chưa đọc được website, thử lại hoặc điền tay.', detail: safeDetail(e) }, { status: 502 });
    }
  }

  if (!env.DB) return Response.json({ error: 'Máy chủ chưa có cơ sở dữ liệu thanh toán.' }, { status: 503 });

  if (path === '/api/billing') {
    const acc = await ensureAccount(env, uid, email);
    const [orders, ledger] = await Promise.all([
      env.DB.prepare('SELECT * FROM orders WHERE uid = ?1 ORDER BY created_at DESC LIMIT 10').bind(uid).all(),
      env.DB.prepare('SELECT delta, reason, ref, created_at FROM ledger WHERE uid = ?1 ORDER BY id DESC LIMIT 30').bind(uid).all(),
    ]);
    const p = prices(env);
    return Response.json({
      bat: billingOn(env), admin, account: publicAccount(env, acc), goi: plans(env), nap: topups(env),
      gia: { cong_cu: p.tool, anh: p.image, video_giay: p.video_second, workbench: p.workbench },
      don: (orders.results || []).map((o) => publicOrder(env, o)), so: ledger.results || [], thanh_toan_mo: sepayReady(env),
    }, { headers: noStore });
  }

  if (path === '/api/billing/order') {
    if (req.method === 'GET') {
      const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?1 AND uid = ?2').bind(url.searchParams.get('id') || '', uid).first();
      if (!o) return Response.json({ error: 'Không có đơn này.' }, { status: 404 });
      return Response.json({ don: publicOrder(env, o) }, { headers: noStore });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!sepayReady(env)) return Response.json({ error: 'Thanh toán chuyển khoản chưa mở. Liên hệ Crewzy để kích hoạt gói.' }, { status: 503 });
    let body = {};
    try { body = await req.json(); } catch (e) { /* trống */ }
    const it = findItem(env, body.item);
    if (!it) return Response.json({ error: 'Gói không hợp lệ.' }, { status: 400 });
    await ensureAccount(env, uid, email);
    // Dùng lại đơn đang chờ cùng gói trong 24 giờ (khách bấm lại không sinh thêm mã).
    const now = Date.now();
    const old = await env.DB.prepare("SELECT * FROM orders WHERE uid = ?1 AND item = ?2 AND status = 'pending' AND created_at > ?3 ORDER BY created_at DESC LIMIT 1").bind(uid, it.item, now - ORDER_TTL).first();
    if (old) return Response.json({ don: publicOrder(env, old) });
    const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE uid = ?1 AND status = 'pending' AND created_at > ?2").bind(uid, now - ORDER_TTL).first();
    if (pending && pending.n >= 5) return Response.json({ error: 'Bạn có nhiều đơn chưa thanh toán. Chuyển khoản đơn cũ hoặc đợi 24 giờ.' }, { status: 429 });
    for (let i = 0; i < 3; i++) {
      const o = { id: newId(), uid, ...it, code: newCode(), status: 'pending', created_at: now };
      try {
        await env.DB.prepare('INSERT INTO orders (id, uid, kind, item, amount, credits, days, code, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
          .bind(o.id, o.uid, o.kind, o.item, o.amount, o.credits, o.days, o.code, o.status, o.created_at).run();
        return Response.json({ don: publicOrder(env, o) });
      } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
    }
    return Response.json({ error: 'Chưa tạo được đơn, thử lại.' }, { status: 500 });
  }

  if (path === '/api/billing/admin') {
    if (!admin) return Response.json({ error: 'Chỉ quản trị viên.' }, { status: 403 });
    if (req.method === 'GET') {
      const rows = await env.DB.prepare('SELECT uid, email, plan, plan_until, credits, ai_choice, created_at FROM accounts ORDER BY updated_at DESC LIMIT 100').all();
      const pays = await env.DB.prepare('SELECT id, amount, content, result, order_id, created_at FROM payments ORDER BY created_at DESC LIMIT 30').all();
      return Response.json({ tai_khoan: rows.results || [], giao_dich: pays.results || [] }, { headers: noStore });
    }
    let body = {};
    try { body = await req.json(); } catch (e) { /* trống */ }
    let target = body.uid ? await getAccount(env, body.uid) : null;
    if (!target && body.email) target = await env.DB.prepare('SELECT * FROM accounts WHERE lower(email) = lower(?1)').bind(String(body.email)).first();
    if (!target) return Response.json({ error: 'Không tìm thấy tài khoản (khách phải đăng nhập Crewzy ít nhất một lần).' }, { status: 404 });
    const credits = Math.round(Number(body.credits) || 0);
    const days = Math.max(0, Math.round(Number(body.days) || 0));
    const plan = plans(env).find((x) => x.id === body.plan) ? body.plan : null;
    if (!credits && !days) return Response.json({ error: 'Nhập số credit hoặc số ngày.' }, { status: 400 });
    await grant(env, target.uid, credits, days, 'admin', 'admin:' + email, plan);
    return Response.json({ ok: true, account: publicAccount(env, await getAccount(env, target.uid)) });
  }

  return Response.json({ error: 'Không có API này.' }, { status: 404 });
};


