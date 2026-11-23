// SỰ KIỆN TỨC THÌ (Event Bus) qua Composio Triggers: app khách đã nối có sự kiện → Composio gọi /api/composio/webhook → Crewzy xử lý ngay.
// Trigger thật đã tra docs.composio.dev/toolkits/<slug>.md (23/11/2026): Facebook, Instagram, TikTok, LinkedIn, Telegram KHÔNG có trigger
// (bình luận vẫn đi lịch trả lời mỗi giờ). Có: Gmail GMAIL_NEW_GMAIL_MESSAGE (poll ~15 phút với auth Composio), Outlook OUTLOOK_MESSAGE_TRIGGER,
// Calendly CALENDLY_MEETING_SCHEDULED (webhook, gói Calendly trả phí), Zendesk ZENDESK_NEW_ZENDESK_TICKET_TRIGGER.
// Xử lý 1 sự kiện: (1) ghi nhật ký sự kiện · (2) có số điện thoại / đặt lịch / hỏi mua → tạo lead NGAY (không cần AI) + gửi Gmail báo chủ NGAY
// · (3) tạo phiếu việc cho AI (trả lời email, chuẩn bị cuộc hẹn…) · (4) đang bật Chạy tự động → xếp hàng để cron 15 phút cho Trợ lý Crewzy làm.
// Đăng ký webhook: 1 subscription cho cả project Composio; tự tạo nếu chưa có, KHÔNG ghi đè nếu project đã có webhook của app khác.
import { Composio } from '@composio/core';
import { getApiKey, userIdFor, kvGetJson, kvPutJson, sealText, openText } from './common.js';
import { addLead, ownerEmail } from './leads.js';
import { createJob } from './jobs.js';
import { workflowById, workflowPrompt } from './workflows.js';

export const TRIGGERS = {
  gmail: { slug: 'GMAIL_NEW_GMAIL_MESSAGE', cfg: { query: 'in:inbox -from:me -subject:"[Crewzy]" -category:promotions -category:social -category:updates -category:forums' }, ten: 'Email mới (Gmail)' },
  outlook: { slug: 'OUTLOOK_MESSAGE_TRIGGER', cfg: {}, ten: 'Email mới (Outlook)' },
  calendly: { slug: 'CALENDLY_MEETING_SCHEDULED', cfg: { scope: 'user' }, ten: 'Khách đặt lịch hẹn (Calendly)' },
  zendesk: { slug: 'ZENDESK_NEW_ZENDESK_TICKET_TRIGGER', cfg: {}, ten: 'Phiếu hỗ trợ mới (Zendesk)' },
};
const SLUG_KENH = Object.fromEntries(Object.entries(TRIGGERS).map(([k, v]) => [v.slug, k]));
const WEBHOOK_PATH = '/api/composio/webhook';
const SECRET_KEY = 'composio:whsecret';
const AI_RUNS_PER_DAY = 20;
const AUTO_PER_TICK = 4;

const composioOf = (env) => new Composio({ apiKey: getApiKey(env) });
const vnDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const PHONE = /(?:\+?84|0)(?:[\s.\-]?\d){8,10}\b/;
const BUY = /(báo giá|bao gia|giá bao nhiêu|gia bao nhieu|bảng giá|muốn mua|mua (nhà|đất|căn|sản phẩm|hàng)|đặt (hàng|mua|cọc|lịch)|tư vấn|xem nhà|đi xem|còn hàng|quote|pricing|price)/i;
const AUTO_SENDER = /(no-?reply|noreply|notification|mailer-daemon|newsletter|marketing|bounce|donotreply)/i;

// ---------- Đăng ký webhook của project (1 lần) ----------
export async function ensureSubscription(env, origin) {
  const have = await env.KV.get(SECRET_KEY);
  if (have) return { ok: true };
  const url = origin.replace(/\/$/, '') + WEBHOOK_PATH;
  const c = composioOf(env);
  const list = await c.webhooks.subscriptions.list().catch(() => ({ items: [] }));
  const items = (list && list.items) || [];
  let sub = items.find((x) => x.webhookUrl === url);
  if (!sub && items.length) return { error: 'Project Composio đã có webhook của app khác (' + items[0].webhookUrl + '). Không ghi đè để khỏi làm hỏng app đó.' };
  if (!sub) sub = await c.triggers.setWebhookSubscription({ webhookUrl: url });
  if (sub && !sub.secret && sub.id) sub = await c.webhooks.subscriptions.get(sub.id);
  if (!sub || !sub.secret) return { error: 'Composio không trả khoá ký webhook.' };
  await env.KV.put(SECRET_KEY, await sealText(env, sub.secret));
  return { ok: true, created: true };
}

// ---------- Bật/tắt trigger cho 1 khách theo app đã nối ----------
const trgKey = (uid) => 'trg:' + uid;
export const listTriggers = async (env, uid) => (await kvGetJson(env, trgKey(uid))) || {};

export async function syncTriggers(env, uid, connected, on, origin) {
  const have = await listTriggers(env, uid);
  const want = on ? Object.keys(TRIGGERS).filter((k) => (connected || []).includes(k)) : [];
  const toAdd = want.filter((k) => !have[k]);
  const toDel = Object.keys(have).filter((k) => !want.includes(k));
  if (!toAdd.length && !toDel.length) return { ok: true, triggers: have };
  const c = composioOf(env);
  const out = { ...have }, loi = [];
  if (toAdd.length) {
    const sub = await ensureSubscription(env, origin).catch((e) => ({ error: e && e.message }));
    if (sub.error) loi.push(sub.error);
    else for (const k of toAdd) {
      try {
        const r = await c.triggers.create(userIdFor(uid), TRIGGERS[k].slug, { triggerConfig: TRIGGERS[k].cfg });
        out[k] = { id: r.triggerId, type: r.type, poll: r.pollingInterval || null, luc: new Date().toISOString() };
      } catch (e) { loi.push(TRIGGERS[k].ten + ': ' + clip(e && e.message, 160)); }
    }
  }
  for (const k of toDel) {
    try { if (have[k] && have[k].id) await c.triggers.delete(have[k].id); } catch (e) { /* đã xoá phía Composio */ }
    delete out[k];
  }
  await kvPutJson(env, trgKey(uid), out);
  return { ok: !loi.length, triggers: out, loi };
}

// ---------- Nhận webhook ----------
export async function handleWebhook(req, env, origin) {
  const sealed = await env.KV.get(SECRET_KEY);
  if (!sealed) return new Response('not configured', { status: 404 });
  const secret = await openText(env, sealed);
  const body = await req.text();
  const id = req.headers.get('webhook-id') || '';
  let parsed;
  try {
    parsed = await composioOf(env).triggers.verifyWebhook({ payload: body, signature: req.headers.get('webhook-signature') || '', id, timestamp: req.headers.get('webhook-timestamp') || '', secret });
  } catch (e) {
    console.error('composio webhook verify failed', e && e.message);
    return new Response('invalid signature', { status: 401 });
  }
  // Chống xử lý lặp: Composio thử lại với cùng webhook-id.
  const seenKey = 'evseen:' + (id || parsed.payload.id);
  if (await env.KV.get(seenKey)) return Response.json({ ok: true, trung: true });
  await env.KV.put(seenKey, '1', { expirationTtl: 3 * 86400 });
  const p = parsed.payload;
  const userId = p.userId || (p.metadata && p.metadata.connectedAccount && p.metadata.connectedAccount.userId) || '';
  const uid = userId.startsWith('vpai-') ? userId.slice(5) : '';
  if (!uid) return Response.json({ ok: true, bo_qua: 'không rõ khách' });
  const out = await handleEvent(env, uid, p.triggerSlug, p.payload || {}, origin);
  return Response.json({ ok: true, ...out });
}

// Rút thông tin chung từ payload các trigger (tên trường khác nhau mỗi app).
export function normalize(slug, d) {
  const kenh = SLUG_KENH[slug] || 'khac';
  const pick = (...ks) => { for (const k of ks) { const v = k.split('.').reduce((o, x) => (o == null ? o : o[x]), d); if (v != null && v !== '') return typeof v === 'string' ? v : JSON.stringify(v); } return ''; };
  if (kenh === 'gmail' || kenh === 'outlook') {
    const from = pick('sender', 'from.emailAddress.address', 'from', 'sender_email');
    const m = /^(.*?)\s*<([^>]+)>/.exec(from);
    return { kenh: 'email', app: kenh, ten: clip(m ? m[1].replace(/"/g, '') : pick('from.emailAddress.name') || from, 80), email: clip(m ? m[2] : from, 120),
      tieu_de: clip(pick('subject'), 200), noi_dung: clip(pick('message_text', 'body.content', 'bodyPreview', 'preview.body', 'body'), 3000), ma: pick('message_id', 'id', 'thread_id') };
  }
  if (kenh === 'calendly') {
    const qa = Array.isArray(d.questions_and_answers) ? d.questions_and_answers.map((q) => (q.question || '') + ': ' + (q.answer || '')).join(' · ') : '';
    return { kenh: 'calendly', app: kenh, ten: clip(d.name || [d.first_name, d.last_name].filter(Boolean).join(' '), 80), email: clip(d.email, 120),
      tieu_de: 'Đặt lịch hẹn', noi_dung: clip(qa, 1500), ma: pick('uri', 'event'), hen: true };
  }
  if (kenh === 'zendesk') {
    const t = d.ticket || d;
    return { kenh: 'zendesk', app: kenh, ten: clip(t.requester_name || (t.via && t.via.source && t.via.source.from && t.via.source.from.name) || 'Khách Zendesk', 80),
      email: clip(t.requester_email || (t.via && t.via.source && t.via.source.from && t.via.source.from.address) || '', 120), tieu_de: clip(t.subject, 200), noi_dung: clip(t.description, 3000), ma: String(t.id || '') };
  }
  return { kenh: 'khac', app: kenh, ten: '', email: '', tieu_de: clip(slug, 80), noi_dung: clip(JSON.stringify(d), 1500), ma: '' };
}

// Gửi Gmail báo chủ ngay (không qua AI). Thất bại thì im lặng: phiếu việc + AI sẽ báo sau.
async function mailOwner(env, uid, subject, text) {
  const to = await ownerEmail(env, uid);
  if (!to) return false;
  try {
    const r = await composioOf(env).tools.execute('GMAIL_SEND_EMAIL', { userId: userIdFor(uid), dangerouslySkipVersionCheck: true,
      arguments: { recipient_email: to, subject: '[Crewzy] ' + subject, body: text } });
    return !!(r && r.successful !== false);
  } catch (e) { console.error('mail owner failed', uid, e && e.message); return false; }
}

const evKey = (uid) => 'evlog:' + uid;
export const listEvents = async (env, uid) => (await kvGetJson(env, evKey(uid))) || [];

export async function handleEvent(env, uid, slug, data, origin, opts = {}) {
  const e = normalize(slug, data);
  if (e.kenh === 'email') {
    const owner = (await ownerEmail(env, uid)).toLowerCase();
    if (/^\[crewzy\]/i.test(e.tieu_de) || (owner && e.email.toLowerCase() === owner) || AUTO_SENDER.test(e.email)) return { bo_qua: 'email tự động hoặc của chính chủ' };
  }
  const text = e.tieu_de + ' ' + e.noi_dung;
  const sdt = ((PHONE.exec(text) || [])[0] || '').replace(/[^\d+]/g, '');
  const muaHang = BUY.test(text);
  const isLead = !!(sdt || e.hen || muaHang);
  let lead = null, mailed = false;
  if (isLead) {
    const r = await addLead(env, uid, { ten: e.ten || e.email, sdt, email: e.email, nguon: e.kenh, nhu_cau: clip((e.hen ? 'Đã đặt lịch hẹn. ' : '') + (e.tieu_de ? e.tieu_de + ': ' : '') + e.noi_dung, 280), muc_do: sdt || e.hen ? 'nong' : 'am' }, 'Crewzy (sự kiện)');
    lead = r.lead || null;
    if (lead && !r.trung && lead.muc_do === 'nong' && !opts.noMail) {
      mailed = await mailOwner(env, uid, `Lead nóng: ${lead.ten}${lead.sdt ? ' · ' + lead.sdt : ''}`,
        `Khách mới vừa ${e.hen ? 'đặt lịch hẹn' : 'liên hệ'} qua ${e.kenh}.\n\nTên: ${lead.ten}\nSố điện thoại: ${lead.sdt || '(chưa có)'}\nEmail: ${lead.email || '(chưa có)'}\nNội dung: ${lead.nhu_cau}\n\nGọi khách sớm nhé. Xem danh sách khách cần gọi: ${origin}/index.html#leads`);
    }
  }
  // Phiếu việc cho AI: chỉ với sự kiện là khách thật (không phải mọi email).
  let job = null;
  const wf = e.kenh === 'email' ? workflowById('tra_loi_email_khach') : e.kenh === 'calendly' ? workflowById('lead_vao_crm') : e.kenh === 'zendesk' ? workflowById('tra_loi_email_khach') : null;
  if (wf) {
    const ctx = `SỰ KIỆN MỚI (${TRIGGERS[e.app] ? TRIGGERS[e.app].ten : e.kenh}) — CHỈ xử lý đúng sự kiện này:\nTừ: ${e.ten} <${e.email}>\nTiêu đề: ${e.tieu_de}\nNội dung: ${e.noi_dung}\n` +
      (lead ? `Crewzy đã lưu lead ${lead.id}${mailed ? ' và đã email báo chủ' : ''}; nếu chưa báo chủ qua Telegram/Slack đã nối thì báo, ghi khách vào CRM đã nối.\n` : 'Nếu là khách hỏi mua/hỏi giá thì gọi CREWZY_BAO_LEAD.\n') +
      (e.kenh === 'calendly' ? 'Khách đã đặt lịch: tạo liên hệ + deal trong CRM đã nối, soạn email xác nhận/chuẩn bị cuộc hẹn (chờ chủ duyệt).\n' : 'Soạn trả lời theo Brain thương hiệu (nháp, chờ chủ duyệt trước khi gửi khách). Email rác/quảng cáo thì nộp trang_thai xong, ghi "bỏ qua".\n');
    job = await createJob(env, uid, { quy_trinh: wf.id, tieu_de: (e.hen ? 'Khách đặt lịch: ' : e.kenh === 'zendesk' ? 'Phiếu hỗ trợ: ' : 'Email khách: ') + (e.ten || e.email) + (e.tieu_de && !e.hen ? ' — ' + e.tieu_de : ''), yeu_cau: workflowPrompt(wf, ctx), nguon: 'su_kien' });
    if (opts.autoRun !== false && (await autoOn(env, uid))) await enqueue(env, uid, job, ctx, wf);
  }
  const log = await listEvents(env, uid);
  log.unshift({ id: (job && job.id) || (lead && lead.id) || 'e' + Date.now().toString(36), luc: new Date().toISOString(), kenh: e.kenh, ten: e.ten, tieu_de: e.tieu_de, lead: lead && lead.id, job: job && job.id, da_bao: mailed });
  await kvPutJson(env, evKey(uid), log.slice(0, 60));
  return { lead: lead && lead.id, job: job && job.id, da_bao: mailed };
}

// ---------- Hàng đợi cho Trợ lý Crewzy (cron 15 phút) ----------
async function autoOn(env, uid) {
  const sch = (await kvGetJson(env, 'sched:' + uid)) || [];
  return sch.some((s) => s.nguon === 'cay' && s.bat && s.che_do === 'crewzy');
}
async function enqueue(env, uid, job, ctx, wf) {
  const cKey = 'evcount:' + vnDay() + ':' + uid;
  const n = Number((await env.KV.get(cKey)) || 0);
  if (n >= AI_RUNS_PER_DAY) return;
  await env.KV.put(cKey, String(n + 1), { expirationTtl: 2 * 86400 });
  const q = (await kvGetJson(env, 'evq:' + uid)) || [];
  q.push({ job, prompt: `Làm phiếu việc ${job.id}. ${workflowPrompt(wf, ctx)}\nNộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ${job.id}. Không hỏi lại người dùng.` });
  await kvPutJson(env, 'evq:' + uid, q.slice(-20));
  const idx = (await kvGetJson(env, 'evqidx')) || [];
  if (!idx.includes(uid)) { idx.push(uid); await kvPutJson(env, 'evqidx', idx); }
}

export async function runEventQueue(env, { runAuto, origin }) {
  const idx = (await kvGetJson(env, 'evqidx')) || [];
  let ran = 0;
  const left = [];
  for (const uid of idx) {
    const q = (await kvGetJson(env, 'evq:' + uid)) || [];
    while (q.length && ran < AUTO_PER_TICK) {
      const a = q.shift();
      try { await runAuto(uid, a.job, a.prompt, origin); ran++; } catch (e) { console.error('event run failed', uid, e && e.message); }
    }
    await kvPutJson(env, 'evq:' + uid, q);
    if (q.length) left.push(uid);
  }
  if (left.length !== idx.length) await kvPutJson(env, 'evqidx', left);
  return { ran, waiting: left.length };
}
