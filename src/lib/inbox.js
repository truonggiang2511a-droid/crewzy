// TRỰC FANPAGE 15 PHÚT (23/11): Composio Facebook đọc/trả lời được bình luận và Messenger nhưng KHÔNG có trigger (docs.composio.dev/toolkits/facebook.md: Triggers 0)
// → Crewzy tự hỏi bằng code (composio.tools.execute, KHÔNG gọi AI): mỗi Fanpage 2 lượt gọi/lần (bài + bình luận lồng trong fields, hội thoại + tin cuối).
// Chỉ khi có bình luận/tin nhắn MỚI của khách mới xếp 1 lượt Trợ lý Crewzy (evq) trả lời đúng các mục đó → không có gì mới thì không tốn AI, không ghi KV.
// Ai được trực: khách bật Run (nguon 'cay') chế độ crewzy có lịch tra_loi_binh_luan/tra_loi_tin_nhan và đã nối Facebook.
// Nhịp: 7:00–22:59 mỗi lượt cron (15 phút), đêm mỗi giờ 1 lần (INBOX_NIGHT=off thì tắt đêm, INBOX=off tắt hẳn). Có số điện thoại → lưu lead + Gmail báo chủ ngay bằng code.
// KV inbox:<uid> = {since, seen[], pages[{id,name}], pages_at, khac[]}: chỉ ghi khi có mục mới hoặc làm mới danh sách Fanpage (1 lần/ngày).
import { kvGetJson, kvPutJson } from './common.js';
import { connectedApps } from './connected.js';
import { addLead, markLead } from './leads.js';
import { mailOwner, pushCrm, runTool } from './notify.js';
import { enqueue, listEvents, PHONE } from './events.js';

const H = 3600 * 1000;
export const INBOX_WORKFLOWS = ['tra_loi_binh_luan', 'tra_loi_tin_nhan'];
// Kênh có bình luận/tin nhắn mà Crewzy CHƯA trực bằng code → lịch mỗi giờ vẫn chạy AI cho các kênh này.
export const OTHER_CHANNELS = ['instagram', 'youtube', 'linkedin', 'tiktok', 'whatsapp', 'threads'];
const RUNS_PER_DAY = 60;      // trần lượt AI trả lời/khách/ngày (mỗi lượt gom mọi mục mới của 1 lần quét)
const LOOKBACK_MS = 10 * 60 * 1000; // quét chồng 10 phút để không sót bình luận Facebook hiện chậm; seen[] chống trả lời 2 lần
const COMMENT_MAX_AGE = 3 * 24 * H;
const MSG_MAX_AGE = 23 * H;   // quy tắc 24 giờ của Messenger (chừa 1 giờ)

const vnMin = (now) => { const x = new Date(now.getTime() + 7 * H); return x.getUTCHours() * 60 + x.getUTCMinutes(); };
const fbTime = (s) => Date.parse(String(s || '').replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) || 0;
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
export const inboxKey = (uid) => 'inbox:' + uid;

export function inboxDue(env, now = new Date()) {
  if (env.INBOX === 'off') return false;
  const m = vnMin(now);
  if (m >= 7 * 60 && m < 23 * 60) return true;
  return env.INBOX_NIGHT !== 'off' && m % 60 < 15;
}

// Lấy mảng bản ghi từ kết quả Composio (data có thể là {data:[...]}, {response_data:{data:[...]}} …).
export function listOf(x, depth = 0) {
  if (!x || depth > 3) return [];
  if (Array.isArray(x)) return x.filter((i) => i && typeof i === 'object');
  if (typeof x !== 'object') return [];
  if (Array.isArray(x.data)) return listOf(x.data);
  for (const v of Object.values(x)) { const l = listOf(v, depth + 1); if (l.length && l[0].id) return l; }
  return [];
}

// Tìm mục mới của khách trên 1 Fanpage (hàm thuần, có test).
export function newItems(page, posts, convs, { since, seen = [], now = Date.now() }) {
  const from = since - LOOKBACK_MS;
  const done = new Set(seen);
  const comments = [], messages = [];
  for (const p of posts) {
    for (const c of listOf(p.comments)) {
      const t = fbTime(c.created_time);
      if (!c.id || done.has(c.id) || t <= from || now - t > COMMENT_MAX_AGE) continue;
      if (c.from && String(c.from.id) === String(page.id)) continue; // trang tự trả lời
      if (!clip(c.message, 1)) continue; // chỉ sticker/ảnh: bỏ
      comments.push({ id: c.id, t, ten: clip(c.from && c.from.name, 60) || 'Khách', noi_dung: clip(c.message, 400), post_id: p.id, bai: clip(p.message, 90), link: p.permalink_url || '', page });
    }
  }
  for (const cv of convs) {
    const last = listOf(cv.messages)[0];
    const t = fbTime((last && last.created_time) || cv.updated_time);
    if (!cv.id || now - t > MSG_MAX_AGE || t <= from) continue;
    const key = cv.id + '@' + ((last && last.id) || t);
    if (done.has(key)) continue;
    if (last && last.from && String(last.from.id) === String(page.id)) continue; // tin cuối là của trang: đã trả lời
    const sender = (last && last.from) || (listOf(cv.participants).find((p) => String(p.id) !== String(page.id))) || {};
    messages.push({ id: key, conv: cv.id, t, ten: clip(sender.name, 60) || 'Khách', psid: sender.id ? String(sender.id) : '', noi_dung: clip((last && last.message) || cv.snippet, 400), link: cv.link ? 'https://facebook.com' + cv.link : '', page });
  }
  return { comments, messages };
}

export function replyPrompt({ comments, messages }, leads, hhmm) {
  const L = [`TRỰC FANPAGE (Crewzy phát hiện lúc ${hhmm}): ${comments.length} bình luận và ${messages.length} tin nhắn MỚI của khách cần trả lời NGAY. CHỈ xử lý đúng các mục dưới, không quét lại cả trang, không làm việc khác.`];
  if (comments.length) {
    L.push('BÌNH LUẬN → trả lời bằng FACEBOOK_CREATE_COMMENT (object_id = comment_id, message = câu trả lời):');
    for (const c of comments) L.push(`- Fanpage "${c.page.name}" · bài ${c.post_id}${c.bai ? ` ("${c.bai}")` : ''} · comment_id ${c.id} · ${c.ten}: "${c.noi_dung}"`);
  }
  if (messages.length) {
    L.push('TIN NHẮN MESSENGER → đọc FACEBOOK_GET_CONVERSATION_MESSAGES (page_id, conversation_id, limit 10) để hiểu ngữ cảnh rồi gửi FACEBOOK_SEND_MESSAGE (page_id, recipient_id = PSID, messaging_type "RESPONSE", message_text):');
    for (const m of messages) L.push(`- Fanpage "${m.page.name}" page_id ${m.page.id} · conversation_id ${m.conv} · ${m.ten}${m.psid ? ' (PSID ' + m.psid + ')' : ''}: "${m.noi_dung}"`);
  }
  if (leads.length) L.push(`Crewzy ĐÃ tự lưu lead và báo chủ cho khách để lại số: ${leads.join(', ')} → không gọi CREWZY_BAO_LEAD lại cho họ, chỉ trả lời "nhân viên sẽ gọi anh/chị trong ít phút".`);
  L.push('TỰ TRẢ LỜI ĐÃ BẬT: chủ đã cho phép trả lời ngay, không cần hỏi. Viết 1–3 câu, đúng giọng Brain thương hiệu và bộ nhớ về khách, chỉ dùng giá/thông tin có trong Brain (không bịa), KHÔNG ghi số điện thoại hay thông tin cá nhân của khách vào bình luận công khai.',
    'Hỏi giá/hỏi mua/muốn xem: trả lời ngắn theo Brain rồi mời nhắn tin hoặc để lại số điện thoại; bình luận chỉ gồm từ khoá của bài (ví dụ "POST") → trả lời cảm ơn trong bình luận VÀ nhắn riêng thông tin đã hứa. Khách nóng chưa có số → CREWZY_BAO_LEAD (nguon "facebook", muc_do am).',
    'KHÔNG tự trả lời: phàn nàn, đổi trả, pháp lý, chửi bới, câu không chắc → soạn sẵn câu trả lời để chủ duyệt. Spam/quảng cáo: bỏ qua.',
    'Xong: nộp CREWZY_NOP_KET_QUA (loai cham_soc, nguoi_lam "Trợ lý Crewzy (trực Fanpage)"): danh sách đã trả lời (khách + câu trả lời); có mục chờ duyệt thì trang_thai cho_duyet kèm câu soạn sẵn, không có thì da_dang. Không hỏi lại người dùng.');
  return L.join('\n');
}

// Khách đang trực Fanpage (Run chế độ crewzy có lịch trả lời).
export function inboxWanted(schedules) {
  return (schedules || []).some((s) => s.nguon === 'cay' && s.bat && s.che_do === 'crewzy' && INBOX_WORKFLOWS.includes(s.quy_trinh));
}

// Danh sách Fanpage (làm mới 1 lần/ngày). Trả null nếu chưa nối Facebook.
async function ensurePages(env, uid, st, { run, now, connected }) {
  if (st.pages && st.pages.length && now - (st.pages_at || 0) < 24 * H) return false;
  const apps = connected || (await connectedApps(env, uid));
  if (!apps) return false; // Composio lỗi: giữ nguyên, thử lại lượt sau
  st.khac = OTHER_CHANNELS.filter((k) => apps[k]);
  if (!apps.facebook) { const had = st.pages && st.pages.length; st.pages = []; st.pages_at = now; return !!had; }
  const r = await run(env, uid, 'FACEBOOK_LIST_MANAGED_PAGES', { fields: 'id,name', limit: 100 });
  st.pages = listOf(r && r.data).map((p) => ({ id: String(p.id), name: clip(p.name, 60) || 'Fanpage' })).filter((p) => p.id).slice(0, 200);
  st.pages_at = now;
  st.cursor = 0;
  return true;
}

export async function watchUser(env, uid, { run = runTool, now = new Date(), connected, pagesPerTick } = {}) {
  const t = now.getTime();
  const st = (await kvGetJson(env, inboxKey(uid))) || {};
  let dirty = false;
  if (!st.since) { st.since = t; dirty = true; } // lần đầu: chỉ trả lời việc mới từ lúc bật
  if (await ensurePages(env, uid, st, { run, now: t, connected })) dirty = true;
  const pages = st.pages || [];
  if (!pages.length) { if (dirty) await kvPutJson(env, inboxKey(uid), st); return { pages: 0 }; }
  // Nhiều Fanpage: mỗi lượt quét tối đa N trang, xoay vòng (con trỏ chỉ ghi khi có mục mới để tiết kiệm lượt ghi KV).
  const per = Math.max(1, Number(pagesPerTick || env.INBOX_PAGES_PER_TICK) || 10);
  const start = (st.cursor || 0) % pages.length;
  const batch = pages.length <= per ? pages : Array.from({ length: per }, (_, i) => pages[(start + i) % pages.length]);
  const found = { comments: [], messages: [] };
  let errors = 0;
  for (const page of batch) {
    try {
      const [p, c] = await Promise.all([
        run(env, uid, 'FACEBOOK_GET_PAGE_POSTS', { page_id: page.id, limit: 10, fields: 'id,message,permalink_url,created_time,updated_time,comments.order(reverse_chronological).limit(10){id,from,message,created_time}' }),
        run(env, uid, 'FACEBOOK_GET_PAGE_CONVERSATIONS', { page_id: page.id, limit: 10, fields: 'id,updated_time,link,snippet,participants,messages.limit(1){id,from,message,created_time}' }).catch((e) => { errors++; console.error('inbox conv failed', uid, page.id, e && e.message); return null; }),
      ]);
      const n = newItems(page, listOf(p && p.data), listOf(c && c.data), { since: st.since, seen: st.seen, now: t });
      found.comments.push(...n.comments); found.messages.push(...n.messages);
    } catch (e) { errors++; console.error('inbox page failed', uid, page.id, e && e.message); }
  }
  if (pages.length > per) { st.cursor = (start + per) % pages.length; }
  const items = [...found.comments, ...found.messages];
  if (!items.length) { if (dirty) await kvPutJson(env, inboxKey(uid), st); return { pages: batch.length, moi: 0, errors }; }

  // Có số điện thoại → lead + Gmail báo chủ ngay bằng code (không chờ AI).
  const leadNames = [];
  for (const it of items) {
    const sdt = ((PHONE.exec(it.noi_dung) || [])[0] || '').replace(/[^\d+]/g, '');
    if (!sdt) continue;
    const r = await addLead(env, uid, { ten: it.ten, sdt, nguon: 'facebook', nhu_cau: `${it.conv ? 'Nhắn Messenger' : 'Bình luận'} Fanpage ${it.page.name}: ${it.noi_dung}`, muc_do: 'nong', link: it.link }, 'Crewzy (trực Fanpage)').catch(() => ({}));
    if (!r.lead) continue;
    leadNames.push(it.ten);
    if (r.trung) continue;
    const crm = await pushCrm(env, uid, r.lead, connected && Object.keys(connected));
    if (crm) await markLead(env, uid, r.lead.id, { crm });
    await mailOwner(env, uid, `Lead nóng từ Fanpage: ${it.ten} · ${sdt}`, `Khách vừa ${it.conv ? 'nhắn tin' : 'bình luận'} trên Fanpage ${it.page.name} và để lại số.\n\nTên: ${it.ten}\nSố điện thoại: ${sdt}\nNội dung: ${it.noi_dung}\n${it.link ? 'Link: ' + it.link + '\n' : ''}${crm ? 'Đã ghi vào ' + crm + '.\n' : ''}\nGọi khách sớm nhé.`);
  }
  const hhmm = new Date(t + 7 * H).toISOString().slice(11, 16);
  const queued = await enqueue(env, uid, { tieu_de: `Trả lời ${found.comments.length} bình luận, ${found.messages.length} tin nhắn Fanpage` }, replyPrompt(found, leadNames, hhmm), { cap: Number(env.INBOX_RUNS_PER_DAY) || RUNS_PER_DAY, tag: 'inbox' });
  st.since = t;
  st.seen = [...items.map((i) => i.id), ...(st.seen || [])].slice(0, 150);
  await kvPutJson(env, inboxKey(uid), st);
  const log = await listEvents(env, uid);
  log.unshift({ id: 'f' + t.toString(36), luc: now.toISOString(), kenh: 'facebook', ten: items.length === 1 ? items[0].ten : items.length + ' khách',
    tieu_de: queued ? `Fanpage: ${found.comments.length} bình luận, ${found.messages.length} tin nhắn mới → AI đang trả lời` : `Fanpage: ${items.length} mục mới nhưng đã hết ${Number(env.INBOX_RUNS_PER_DAY) || RUNS_PER_DAY} lượt tự trả lời hôm nay`, da_bao: leadNames.length > 0 });
  await kvPutJson(env, 'evlog:' + uid, log.slice(0, 60));
  return { pages: batch.length, moi: items.length, binh_luan: found.comments.length, tin_nhan: found.messages.length, lead: leadNames.length, xep: queued, errors };
}

// Cron: quét mọi khách đang trực Fanpage.
export async function runInbox(env, { now = new Date(), run } = {}) {
  if (!inboxDue(env, now)) return { bo_qua: true };
  const uids = (await kvGetJson(env, 'schedidx')) || [];
  const out = { users: 0, moi: 0 };
  for (const uid of uids) {
    const sch = (await kvGetJson(env, 'sched:' + uid)) || [];
    if (!inboxWanted(sch)) continue;
    try { const r = await watchUser(env, uid, { now, ...(run ? { run } : {}) }); out.users++; out.moi += r.moi || 0; }
    catch (e) { console.error('inbox failed', uid, e && e.message); }
  }
  return out;
}

// Lịch "mỗi giờ" trả lời bình luận/tin nhắn: Fanpage đã có trực 15 phút → AI chỉ còn lo kênh khác; không có kênh khác thì bỏ lượt (tiết kiệm AI).
export async function hourlyCover(env, uid) {
  const st = await kvGetJson(env, inboxKey(uid));
  if (!st || !st.pages || !st.pages.length) return null;
  return { khac: st.khac || [] };
}
