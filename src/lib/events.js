// SỰ KIỆN TỨC THÌ (Event Bus) qua Composio Triggers: app khách đã nối có sự kiện → Composio gọi /api/composio/webhook → Crewzy xử lý ngay.
// Trigger thật đã tra docs.composio.dev/toolkits/<slug>.md (23/11/2026): Facebook, Instagram, TikTok, LinkedIn, Telegram KHÔNG có trigger
// (bình luận vẫn đi lịch trả lời mỗi giờ). Có: Gmail GMAIL_NEW_GMAIL_MESSAGE (poll ~15 phút với auth Composio), Outlook OUTLOOK_MESSAGE_TRIGGER,
// Calendly CALENDLY_MEETING_SCHEDULED (webhook, gói Calendly trả phí), Zendesk ZENDESK_NEW_ZENDESK_TICKET_TRIGGER.
// Xử lý 1 sự kiện: (1) ghi nhật ký sự kiện · (2) có số điện thoại / đặt lịch / hỏi mua → tạo lead NGAY (không cần AI) + gửi Gmail báo chủ NGAY
// · (3) tạo phiếu việc cho AI (trả lời email, chuẩn bị cuộc hẹn…) · (4) đang bật Chạy tự động → xếp hàng để cron 15 phút cho Trợ lý Crewzy làm.
// Đăng ký webhook: 1 subscription cho cả project Composio; tự tạo nếu chưa có, KHÔNG ghi đè nếu project đã có webhook của app khác.
import { Composio } from '@composio/core';
import { getApiKey, userIdFor, kvGetJson, kvPutJson, sealText, openText } from './common.js';
import { addLead, ownerEmail, markLead } from './leads.js';
import { mailOwner, pushCrm } from './notify.js';
import { connectedApps } from './connected.js';
import { createJob } from './jobs.js';
import { workflowById, workflowPrompt } from './workflows.js';

export const TRIGGERS = {
  gmail: { slug: 'GMAIL_NEW_GMAIL_MESSAGE', cfg: { query: 'in:inbox -from:me -subject:"[Crewzy]" -category:promotions -category:social -category:updates -category:forums' }, ten: 'Email mới (Gmail)' },
  outlook: { slug: 'OUTLOOK_MESSAGE_TRIGGER', cfg: {}, ten: 'Email mới (Outlook)' },
  calendly: { slug: 'CALENDLY_MEETING_SCHEDULED', cfg: { scope: 'user' }, ten: 'Khách đặt lịch hẹn (Calendly)' },
  zendesk: { slug: 'ZENDESK_NEW_ZENDESK_TICKET_TRIGGER', cfg: {}, ten: 'Phiếu hỗ trợ mới (Zendesk)' },
  // Form: cần khách chọn form/sheet (KV formcfg:<uid>), không có cấu hình thì không bật.
  typeform: { slug: 'TYPEFORM_NEW_RESPONSE', form: true, ten: 'Khách điền form (Typeform)' },
  googlesheets: { slug: 'GOOGLESHEETS_NEW_ROWS_TRIGGER', form: true, ten: 'Dòng mới trong Sheet form (Google Sheets)' },
};
export const getFormCfg = async (env, uid) => (await kvGetJson(env, 'formcfg:' + uid)) || {};
// Nhận link hoặc mã: typeform.com/to/<id> · docs.google.com/spreadsheets/d/<id>
export function parseFormInput(app, text) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (app === 'typeform') { const m = /typeform\.com\/to\/([A-Za-z0-9]+)/.exec(t); return m ? m[1] : /^[A-Za-z0-9]{4,20}$/.test(t) ? t : ''; }
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(t); return m ? m[1] : /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : '';
}
function triggerCfg(k, form) {
  if (k === 'typeform') return form.typeform ? { form_id: form.typeform } : null;
  if (k === 'googlesheets') return form.sheet ? { spreadsheet_id: form.sheet, start_row: 2, ...(form.sheet_name ? { sheet_name: form.sheet_name } : {}) } : null;
  return TRIGGERS[k].cfg;
}
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
  const form = await getFormCfg(env, uid);
  const want = on ? Object.keys(TRIGGERS).filter((k) => (connected || []).includes(k) && triggerCfg(k, form)) : [];
  // Đổi form/sheet → tạo lại trigger đó.
  const changed = want.filter((k) => have[k] && TRIGGERS[k].form && JSON.stringify(have[k].cfg || null) !== JSON.stringify(triggerCfg(k, form)));
  const toAdd = want.filter((k) => !have[k] || changed.includes(k));
  const toDel = Object.keys(have).filter((k) => !want.includes(k) || changed.includes(k));
  if (!toAdd.length && !toDel.length) return { ok: true, triggers: have };
  const c = composioOf(env);
  const out = { ...have }, loi = [];
  for (const k of toDel) {
    try { if (have[k] && have[k].id) await c.triggers.delete(have[k].id); } catch (e) { /* đã xoá phía Composio */ }
    delete out[k];
  }
  if (toAdd.length) {
    const sub = await ensureSubscription(env, origin).catch((e) => ({ error: e && e.message }));
    if (sub.error) loi.push(sub.error);
    else for (const k of toAdd) {
      try {
        const cfg = triggerCfg(k, form);
        const r = await c.triggers.create(userIdFor(uid), TRIGGERS[k].slug, { triggerConfig: cfg });
        out[k] = { id: r.triggerId, type: r.type, poll: r.pollingInterval || null, luc: new Date().toISOString(), ...(TRIGGERS[k].form ? { cfg } : {}) };
      } catch (e) { loi.push(TRIGGERS[k].ten + ': ' + clip(e && e.message, 160)); }
    }
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
  if (kenh === 'typeform') {
    const fr = d.form_response || {};
    const fields = Object.fromEntries(((fr.definition && fr.definition.fields) || []).map((f) => [f.id, f.title]));
    const val = (a) => a.email || a.phone_number || a.text || a.number || a.date || (a.choice && a.choice.label) || (a.choices && (a.choices.labels || []).join(', ')) || a.url || (a.boolean != null ? (a.boolean ? 'Có' : 'Không') : '');
    const ans = (fr.answers || []).map((a) => ({ q: fields[a.field && a.field.id] || (a.field && a.field.ref) || '', v: String(val(a) || ''), t: a.type }));
    const email = (ans.find((a) => a.t === 'email') || {}).v || '';
    const phone = (ans.find((a) => a.t === 'phone_number') || {}).v || '';
    const name = (ans.find((a) => /tên|name|họ/i.test(a.q) && a.t !== 'email') || {}).v || '';
    return { kenh: 'form', app: kenh, ten: clip(name || email || 'Khách điền form', 80), email: clip(email, 120), sdt: phone,
      tieu_de: 'Khách điền form', noi_dung: clip(ans.map((a) => a.q + ': ' + a.v).join(' · '), 2000), ma: fr.token || d.event_id || '', form: true };
  }
  if (kenh === 'googlesheets') {
    const row = (Array.isArray(d.row_data) ? d.row_data : []).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    const email = row.find((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x)) || '';
    const phone = row.find((x) => PHONE.test(x)) || '';
    const name = row.find((x) => x !== email && x !== phone && !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(x) && x.length < 60) || '';
    return { kenh: 'form', app: kenh, ten: clip(name || email || 'Khách điền form', 80), email: clip(email, 120), sdt: phone,
      tieu_de: 'Dòng mới ' + clip(d.sheet_name || 'Sheet', 40), noi_dung: clip(row.join(' · '), 2000), ma: (d.spreadsheet_id || '') + ':' + (d.row_number || ''), form: true, sheet: String(d.sheet_name || '') };
  }
  return { kenh: 'khac', app: kenh, ten: '', email: '', tieu_de: clip(slug, 80), noi_dung: clip(JSON.stringify(d), 1500), ma: '' };
}

const evKey = (uid) => 'evlog:' + uid;
export const listEvents = async (env, uid) => (await kvGetJson(env, evKey(uid))) || [];

export async function handleEvent(env, uid, slug, data, origin, opts = {}) {
  const e = normalize(slug, data);
  if (e.kenh === 'email') {
    const owner = (await ownerEmail(env, uid)).toLowerCase();
    if (/^\[crewzy\]/i.test(e.tieu_de) || (owner && e.email.toLowerCase() === owner) || AUTO_SENDER.test(e.email)) return { bo_qua: 'email tự động hoặc của chính chủ' };
  }
  if (e.sheet && /khách tiềm năng|báo cáo crewzy/i.test(e.sheet)) return { bo_qua: 'sheet do Crewzy ghi' }; // chống vòng lặp
  const text = e.tieu_de + ' ' + e.noi_dung;
  const sdt = (e.sdt || (PHONE.exec(text) || [])[0] || '').replace(/[^\d+]/g, '');
  const muaHang = BUY.test(text);
  const isLead = !!(sdt || e.hen || e.form || muaHang);
  let lead = null, mailed = false, crm = '';
  const connected = opts.connected || (env.TEST_OFFLINE ? [] : Object.keys((await connectedApps(env, uid)) || {}));
  if (isLead) {
    const r = await addLead(env, uid, { ten: e.ten || e.email, sdt, email: e.email, nguon: e.kenh, nhu_cau: clip((e.hen ? 'Đã đặt lịch hẹn. ' : '') + (e.tieu_de ? e.tieu_de + ': ' : '') + e.noi_dung, 280), muc_do: sdt || e.hen ? 'nong' : 'am' }, 'Crewzy (sự kiện)');
    lead = r.lead || null;
    if (lead && !r.trung) { crm = await pushCrm(env, uid, lead, connected); if (crm) await markLead(env, uid, lead.id, { crm }); }
    if (lead && !r.trung && (lead.muc_do === 'nong' || e.form) && !opts.noMail) {
      mailed = await mailOwner(env, uid, `${lead.muc_do === 'nong' ? 'Lead nóng' : 'Lead mới'}: ${lead.ten}${lead.sdt ? ' · ' + lead.sdt : ''}`,
        `Khách mới vừa ${e.hen ? 'đặt lịch hẹn' : e.form ? 'điền form' : 'liên hệ'} qua ${e.kenh}.\n\nTên: ${lead.ten}\nSố điện thoại: ${lead.sdt || '(chưa có)'}\nEmail: ${lead.email || '(chưa có)'}\nNội dung: ${lead.nhu_cau}\n\n${crm ? 'Đã ghi vào ' + crm + '.\n' : ''}Gọi khách sớm nhé. Xem danh sách khách cần gọi: ${origin}/index.html#leads`, connected);
    }
  }
  // Phiếu việc cho AI: chỉ với sự kiện là khách thật (không phải mọi email).
  let job = null;
  const wf = e.kenh === 'email' ? workflowById('tra_loi_email_khach') : e.kenh === 'calendly' || e.kenh === 'form' ? workflowById('lead_vao_crm') : e.kenh === 'zendesk' ? workflowById('tra_loi_email_khach') : null;
  if (wf) {
    const ctx = `SỰ KIỆN MỚI (${TRIGGERS[e.app] ? TRIGGERS[e.app].ten : e.kenh}) — CHỈ xử lý đúng sự kiện này:\nTừ: ${e.ten} <${e.email}>\nTiêu đề: ${e.tieu_de}\nNội dung: ${e.noi_dung}\n` +
      (lead ? `Crewzy đã lưu lead ${lead.id}${mailed ? ', đã email báo chủ' : ''}${crm ? ', đã ghi vào ' + crm : ''}; nếu chưa báo chủ qua Telegram/Slack đã nối thì báo${crm ? '' : ', ghi khách vào CRM đã nối'}.\n` : 'Nếu là khách hỏi mua/hỏi giá thì gọi CREWZY_BAO_LEAD.\n') +
      (e.kenh === 'calendly' ? 'Khách đã đặt lịch: tạo deal trong CRM đã nối, soạn email xác nhận/chuẩn bị cuộc hẹn (chờ chủ duyệt).\n' : e.kenh === 'form' ? 'Khách vừa điền form: soạn tin/email chào riêng theo Brain (chờ chủ duyệt), chấm nóng/ấm.\n' : 'Soạn trả lời theo Brain thương hiệu (nháp, chờ chủ duyệt trước khi gửi khách). Email rác/quảng cáo thì nộp trang_thai xong, ghi "bỏ qua".\n');
    job = await createJob(env, uid, { quy_trinh: wf.id, tieu_de: (e.hen ? 'Khách đặt lịch: ' : e.form ? 'Khách điền form: ' : e.kenh === 'zendesk' ? 'Phiếu hỗ trợ: ' : 'Email khách: ') + (e.ten || e.email) + (e.tieu_de && !e.hen ? ' — ' + e.tieu_de : ''), yeu_cau: workflowPrompt(wf, ctx), nguon: 'su_kien' });
    if (opts.autoRun !== false && (await autoOn(env, uid))) await enqueue(env, uid, job, `Làm phiếu việc ${job.id}. ${workflowPrompt(wf, ctx)}\nNộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ${job.id}. Không hỏi lại người dùng.`);
  }
  const log = await listEvents(env, uid);
  log.unshift({ id: (job && job.id) || (lead && lead.id) || 'e' + Date.now().toString(36), luc: new Date().toISOString(), kenh: e.kenh, ten: e.ten, tieu_de: e.tieu_de, lead: lead && lead.id, job: job && job.id, da_bao: mailed, crm });
  await kvPutJson(env, evKey(uid), log.slice(0, 60));
  return { lead: lead && lead.id, job: job && job.id, da_bao: mailed, crm };
}

// ---------- Hàng đợi cho Trợ lý Crewzy (cron 15 phút) ----------
export async function autoOn(env, uid) {
  const sch = (await kvGetJson(env, 'sched:' + uid)) || [];
  return sch.some((s) => s.nguon === 'cay' && s.bat && s.che_do === 'crewzy');
}
export async function enqueue(env, uid, job, prompt) {
  const cKey = 'evcount:' + vnDay() + ':' + uid;
  const n = Number((await env.KV.get(cKey)) || 0);
  if (n >= AI_RUNS_PER_DAY) return;
  await env.KV.put(cKey, String(n + 1), { expirationTtl: 2 * 86400 });
  const q = (await kvGetJson(env, 'evq:' + uid)) || [];
  q.push({ job, prompt });
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
