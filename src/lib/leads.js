// KHÁCH TIỀM NĂNG (lead) + BÁO CEO NGAY. KV leads:<uid> = [{id, ten, sdt, email, nguon, nhu_cau, muc_do, link, ghi_chu, luc, trang_thai, gia_tri, chot_luc, nguoi_bao}] ≤300, mới nhất trước.
// AI (Trợ lý Crewzy, lịch tự chạy, AI của khách qua link MCP) gọi CREWZY_BAO_LEAD khi bình luận/tin nhắn có số điện thoại hoặc khách nóng:
// Crewzy lưu lead (hiện ngay trên Trung tâm điều hành: số Lead hôm nay, thông báo, danh sách gọi) và trả về kênh báo CEO đã nối
// (Gmail tới email chủ tài khoản, Telegram, Slack, Teams, Discord) + CRM đã nối để AI gửi/ghi tiếp bằng công cụ Composio.
// CEO đánh dấu Đã gọi / Chốt (+ số tiền) → báo cáo doanh thu theo nguồn (đóng vòng lead → tiền).
import { kvGetJson, kvPutJson } from './common.js';

const key = (uid) => 'leads:' + uid;
const MAX = 300;
export const LEAD_STATES = { moi: 'Mới', da_goi: 'Đã gọi', hen: 'Đã hẹn', da_chot: 'Đã chốt', huy: 'Không mua' };
const NOTIFY = [['gmail', 'Gmail'], ['telegram', 'Telegram'], ['slack', 'Slack'], ['microsoft_teams', 'Microsoft Teams'], ['discord', 'Discord'], ['whatsapp', 'WhatsApp'], ['outlook', 'Outlook']];
const CRM = [['hubspot', 'HubSpot'], ['pipedrive', 'Pipedrive'], ['salesforce', 'Salesforce'], ['zoho', 'Zoho CRM'], ['googlesheets', 'Google Sheets (bảng Khách tiềm năng)'], ['airtable', 'Airtable']];

export const listLeads = async (env, uid) => (await kvGetJson(env, key(uid))) || [];
const vnDay = (iso) => new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString().slice(0, 10);
const digits = (s) => String(s || '').replace(/\D/g, '');
const clip = (s, n) => String(s || '').trim().slice(0, n);

// Email chủ tài khoản (đăng nhập Google) để AI gửi báo lead / báo cáo qua Gmail.
export async function ownerEmail(env, uid) {
  try {
    const sub = await env.KV.get('uid:' + uid);
    if (!sub) return '';
    const u = await kvGetJson(env, 'user:' + sub);
    return (u && u.email) || '';
  } catch (e) { return ''; }
}

// Kênh báo CEO + CRM theo app khách đã nối (dùng cho CREWZY_BAO_LEAD và CREWZY_QUY_TRINH).
export async function ceoChannels(env, uid, connected) {
  const set = new Set(connected || []);
  const email = await ownerEmail(env, uid);
  return {
    email_ceo: email || undefined,
    kenh_bao: NOTIFY.filter(([s]) => set.has(s)).map(([, n]) => n),
    crm: CRM.filter(([s]) => set.has(s)).map(([, n]) => n),
  };
}

export async function addLead(env, uid, a, who) {
  const sdt = clip(a.sdt, 20), email = clip(a.email, 120), ten = clip(a.ten, 80) || 'Khách chưa rõ tên';
  if (!sdt && !email && !clip(a.nhu_cau, 10)) return { error: 'Thiếu thông tin: cần số điện thoại, email hoặc nhu cầu của khách.' };
  const list = await listLeads(env, uid);
  const now = new Date().toISOString();
  const week = Date.now() - 7 * 86400000;
  const dup = list.find((l) => Date.parse(l.luc) > week && ((sdt && digits(l.sdt) === digits(sdt)) || (email && l.email === email) || (a.link && l.link === a.link)));
  if (dup) {
    dup.nhu_cau = clip(a.nhu_cau, 300) || dup.nhu_cau;
    if (a.muc_do === 'nong') dup.muc_do = 'nong';
    dup.cap_nhat = now;
    await kvPutJson(env, key(uid), list);
    return { lead: dup, trung: true };
  }
  const lead = {
    id: 'l' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join(''),
    ten, sdt, email, nguon: clip(a.nguon, 40) || 'khác', nhu_cau: clip(a.nhu_cau, 300), muc_do: ['nong', 'am', 'lanh'].includes(a.muc_do) ? a.muc_do : 'am',
    link: /^https?:\/\//.test(String(a.link || '')) ? clip(a.link, 400) : '', ghi_chu: clip(a.ghi_chu, 300), luc: now, trang_thai: 'moi', gia_tri: 0, nguoi_bao: clip(who, 40),
  };
  list.unshift(lead);
  await kvPutJson(env, key(uid), list.slice(0, MAX));
  return { lead };
}

export async function updateLead(env, uid, id, { trang_thai, gia_tri, ghi_chu }) {
  const list = await listLeads(env, uid);
  const i = list.findIndex((l) => l.id === id);
  if (i < 0) return { error: 'Không tìm thấy khách.' };
  if (trang_thai === 'xoa') list.splice(i, 1);
  else {
    if (trang_thai && !LEAD_STATES[trang_thai]) return { error: 'Trạng thái không hợp lệ.' };
    const l = list[i];
    if (trang_thai) { l.trang_thai = trang_thai; if (trang_thai === 'da_chot') l.chot_luc = new Date().toISOString(); }
    if (gia_tri != null) l.gia_tri = Math.max(0, Math.round(Number(gia_tri) || 0));
    if (ghi_chu != null) l.ghi_chu = clip(ghi_chu, 300);
    l.cap_nhat = new Date().toISOString();
  }
  await kvPutJson(env, key(uid), list);
  return { ok: true };
}

// Số liệu: hôm nay, tháng này, doanh thu đã chốt theo nguồn.
export function leadStats(list, now = new Date()) {
  const today = vnDay(now.toISOString()), month = today.slice(0, 7);
  const hom_nay = list.filter((l) => vnDay(l.luc) === today);
  const thang = list.filter((l) => vnDay(l.luc).slice(0, 7) === month);
  const chot = list.filter((l) => l.trang_thai === 'da_chot' && vnDay(l.chot_luc || l.luc).slice(0, 7) === month);
  const theo_nguon = {};
  for (const l of thang) { const n = theo_nguon[l.nguon] || (theo_nguon[l.nguon] = { lead: 0, chot: 0, doanh_thu: 0 }); n.lead++; }
  for (const l of chot) { const n = theo_nguon[l.nguon] || (theo_nguon[l.nguon] = { lead: 0, chot: 0, doanh_thu: 0 }); n.chot++; n.doanh_thu += l.gia_tri || 0; }
  return {
    hom_nay: hom_nay.length, nong_hom_nay: hom_nay.filter((l) => l.muc_do === 'nong').length,
    can_goi: list.filter((l) => l.trang_thai === 'moi').length,
    thang: thang.length, chot_thang: chot.length, doanh_thu_thang: chot.reduce((s, l) => s + (l.gia_tri || 0), 0), theo_nguon,
  };
}

export const LEAD_TOOL_DEFS = [{ type: 'function', function: {
  name: 'CREWZY_BAO_LEAD',
  description: 'Báo khách tiềm năng (lead) về Crewzy NGAY khi bình luận/tin nhắn/email có số điện thoại, email, hoặc khách nóng (hỏi giá, hẹn xem, muốn mua). Crewzy lưu lead, hiện thông báo cho chủ trên Trung tâm điều hành, và trả về kênh báo CEO + CRM đã nối để bạn gửi tiếp. Gọi mỗi khách 1 lần (trùng số trong 7 ngày Crewzy tự gộp). Không bao giờ đăng số điện thoại khách lên chỗ công khai.',
  parameters: { type: 'object', properties: {
    ten: { type: 'string', description: 'Tên khách (tên tài khoản bình luận nếu chưa rõ).' },
    sdt: { type: 'string', description: 'Số điện thoại khách để lại (nếu có).' },
    email: { type: 'string' },
    nguon: { type: 'string', description: 'Kênh: facebook, instagram, tiktok, youtube, zalo, website, email, quang_cao…' },
    nhu_cau: { type: 'string', description: 'Khách cần gì, sản phẩm quan tâm, ngân sách, thời gian (1–2 câu).' },
    muc_do: { type: 'string', enum: ['nong', 'am', 'lanh'], description: 'nong = có số/hỏi giá/hẹn xem/muốn mua ngay; am = quan tâm; lanh = hỏi chung.' },
    link: { type: 'string', description: 'Link bình luận/tin nhắn gốc.' },
    ghi_chu: { type: 'string' },
  } },
} }];

export async function leadTool(env, uid, args, connected, agent) {
  const out = await addLead(env, uid, args || {}, agent || '');
  if (out.error) return { error: out.error };
  const ch = await ceoChannels(env, uid, connected);
  const l = out.lead;
  const tin = `${l.muc_do === 'nong' ? 'LEAD NÓNG' : 'Lead mới'}: ${l.ten}${l.sdt ? ' · ' + l.sdt : ''} · ${l.nguon} · ${l.nhu_cau || ''}${l.link ? ' · ' + l.link : ''}`;
  const viec = [];
  if (!out.trung) {
    if (ch.kenh_bao.length) viec.push('Gửi NGAY tin dưới đây cho chủ doanh nghiệp qua ' + ch.kenh_bao.join(', ') + (ch.email_ceo ? ' (Gmail gửi tới ' + ch.email_ceo + ')' : '') + '. Đây là tin nội bộ cho chủ, không cần hỏi duyệt.');
    if (ch.crm.length) viec.push('Tạo liên hệ (và deal nếu là khách nóng) trong ' + ch.crm[0] + ' với tên, số, nhu cầu, nguồn.');
    viec.push('Trả lời khách: cảm ơn, báo nhân viên sẽ gọi sớm (nhắn riêng, không lặp lại số điện thoại công khai).');
  }
  return { data: {
    da_luu: true, trung: !!out.trung, id: l.id, tin_bao_ceo: tin, ...ch,
    viec_tiep: viec.length ? viec : ['Khách này đã báo trước đó (đã gộp), không cần báo lại.'],
    ghi_chu: ch.kenh_bao.length ? undefined : 'Chủ chưa nối kênh báo (Gmail, Telegram, Slack). Lead đã hiện trên Trung tâm điều hành của Crewzy; nhắc chủ nối Gmail hoặc Telegram để nhận báo ngay.',
  } };
}
