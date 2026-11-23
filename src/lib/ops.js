// VẬN HÀNH TỰ ĐỘNG BẰNG CODE (không gọi AI, không chiếm số lịch của gói) cho khách đang bật Chạy tự động cả cây:
// - runBacklog (mỗi 30 phút): phiếu chờ duyệt quá 4 giờ → nhắc chủ; phiếu AI nhận quá 3 giờ chưa nộp (lịch/sự kiện) → xếp lại hàng đợi 1 lần;
//   lead nóng chưa gọi quá 2 giờ → nhắc lần hai. Gộp 1 email/lượt, chỉ gửi 7:00–21:30 (giờ VN), mỗi việc nhắc 1 lần (KV nhac:<uid>).
// - runDigest (18:00 số liệu ngày, 22:00 tổng kết ngày): lead, chốt, doanh thu theo nguồn, việc AI đã làm, credit đã tiêu, việc tồn, lịch ngày mai
//   → phiếu báo cáo (loai bao_cao, xong) + Gmail cho chủ. Cờ KV digest:<ngày>:<giờ>:<uid> chống gửi trùng.
import { kvGetJson, kvPutJson } from './common.js';
import { listJobs, submitResult } from './jobs.js';
import { listLeads, leadStats, markLead } from './leads.js';
import { listSchedules, DAYS } from './schedules.js';
import { buildResults, KIND_LABELS } from './activity.js';
import { mailOwner } from './notify.js';
import { autoOn, enqueue, listEvents } from './events.js';

const H = 3600 * 1000;
const vn = (d = new Date()) => { const x = new Date(d.getTime() + 7 * H); return { day: x.toISOString().slice(0, 10), min: x.getUTCHours() * 60 + x.getUTCMinutes(), dow: x.getUTCDay() }; };
const money = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

async function autoUsers(env) {
  const uids = (await kvGetJson(env, 'schedidx')) || [];
  const out = [];
  for (const uid of uids) {
    const sch = await listSchedules(env, uid);
    if (sch.some((s) => s.nguon === 'cay' && s.bat)) out.push({ uid, sch, crewzy: sch.some((s) => s.nguon === 'cay' && s.bat && s.che_do === 'crewzy') });
  }
  return out;
}

export async function backlogFor(env, uid, { now = new Date(), crewzy = false, origin = '', send = true } = {}) {
  const t = now.getTime();
  const nKey = 'nhac:' + uid;
  const seen = (await kvGetJson(env, nKey)) || {};
  for (const k of Object.keys(seen)) if (t - seen[k] > 3 * 24 * H) delete seen[k];
  const jobs = await listJobs(env, uid);
  const leads = await listLeads(env, uid);
  const age = (iso) => t - Date.parse(iso || 0);
  const duyet = jobs.filter((j) => j.trang_thai === 'cho_duyet' && age(j.cap_nhat) > 4 * H && !seen['d:' + j.id]);
  const ket = jobs.filter((j) => j.trang_thai === 'dang_lam' && age(j.nhan_luc || j.cap_nhat) > 3 * H && ['hen_gio', 'su_kien'].includes(j.nguon) && !seen['r:' + j.id]);
  const nong = leads.filter((l) => l.trang_thai === 'moi' && l.muc_do === 'nong' && age(l.luc) > 2 * H && !seen['l:' + l.id]);
  // Việc kẹt: xếp lại hàng đợi cho Trợ lý Crewzy (1 lần mỗi phiếu), không cần chờ giờ làm việc.
  let requeued = 0;
  if (crewzy) for (const j of ket) {
    await enqueue(env, uid, j, `Làm lại phiếu việc ${j.id} (lần trước chưa nộp kết quả). ${j.yeu_cau || ''}\nNộp bằng CREWZY_NOP_KET_QUA kèm id ${j.id}. Không hỏi lại người dùng.`);
    seen['r:' + j.id] = t; requeued++;
  }
  const v = vn(now);
  const workHours = v.min >= 7 * 60 && v.min <= 21 * 60 + 30;
  let mailed = false;
  if ((duyet.length || nong.length) && workHours) {
    const lines = [];
    if (nong.length) lines.push(`${nong.length} khách nóng chưa gọi (quá 2 giờ):\n` + nong.slice(0, 8).map((l) => `- ${l.ten}${l.sdt ? ' · ' + l.sdt : ''} · ${l.nguon} · ${l.nhu_cau || ''}`).join('\n'));
    if (duyet.length) lines.push(`${duyet.length} việc AI làm xong đang chờ bạn duyệt (quá 4 giờ):\n` + duyet.slice(0, 8).map((j) => `- ${j.tieu_de}`).join('\n'));
    if (send) mailed = await mailOwner(env, uid, `Việc cần bạn: ${[nong.length && nong.length + ' khách nóng chưa gọi', duyet.length && duyet.length + ' việc chờ duyệt'].filter(Boolean).join(', ')}`,
      lines.join('\n\n') + `\n\nMở Crewzy: ${origin}/index.html#leads · Duyệt: ${origin}/cho-duyet.html`);
    for (const j of duyet) seen['d:' + j.id] = t;
    for (const l of nong) { seen['l:' + l.id] = t; await markLead(env, uid, l.id, { nhac: new Date(t).toISOString() }); }
    const log = await listEvents(env, uid);
    log.unshift({ id: 'n' + t.toString(36), luc: new Date(t).toISOString(), kenh: 'nhac', ten: 'Crewzy', tieu_de: `Nhắc: ${nong.length} khách nóng chưa gọi, ${duyet.length} việc chờ duyệt`, da_bao: mailed });
    await kvPutJson(env, 'evlog:' + uid, log.slice(0, 60));
  }
  await kvPutJson(env, nKey, seen);
  return { cho_duyet: duyet.length, khach_nong: nong.length, xep_lai: requeued, email: mailed };
}

export async function runBacklog(env, { origin, now = new Date() }) {
  if (vn(now).min % 30 >= 15) return { bo_qua: 'chưa tới mốc 30 phút' };
  const users = await autoUsers(env);
  let n = 0;
  for (const u of users) { try { await backlogFor(env, u.uid, { now, crewzy: u.crewzy, origin }); n++; } catch (e) { console.error('backlog failed', u.uid, e && e.message); } }
  return { users: n };
}

// Nội dung tổng kết ngày (dùng cho 18:00 và 22:00).
export async function digestText(env, uid, { now = new Date(), slot = 18 } = {}) {
  const v = vn(now);
  const [jobs, leads, sch] = await Promise.all([listJobs(env, uid), listLeads(env, uid), listSchedules(env, uid)]);
  const st = leadStats(leads, now);
  const res = await buildResults(env, uid, { from: v.day, to: v.day, jobs }).catch(() => null);
  const today = leads.filter((l) => vn(new Date(l.luc)).day === v.day);
  const chotHom = leads.filter((l) => l.trang_thai === 'da_chot' && l.chot_luc && vn(new Date(l.chot_luc)).day === v.day);
  const doanhThu = chotHom.reduce((s, l) => s + (l.gia_tri || 0), 0);
  const byNguon = {};
  for (const l of today) byNguon[l.nguon] = (byNguon[l.nguon] || 0) + 1;
  const viec = res ? Object.entries(res.viec || {}).filter(([, n]) => n).map(([k, n]) => `${(KIND_LABELS && KIND_LABELS[k]) || k}: ${n}`) : [];
  const choDuyet = jobs.filter((j) => j.trang_thai === 'cho_duyet').length;
  const choAi = jobs.filter((j) => ['cho_lam', 'dang_lam', 'da_duyet'].includes(j.trang_thai)).length;
  const canGoi = leads.filter((l) => l.trang_thai === 'moi').slice(0, 6);
  const out = [
    `KHÁCH: ${today.length} lead mới hôm nay (${today.filter((l) => l.muc_do === 'nong').length} nóng)${Object.keys(byNguon).length ? ' · ' + Object.entries(byNguon).map(([k, n]) => k + ' ' + n).join(', ') : ''}`,
    `DOANH THU: ${chotHom.length} đơn chốt hôm nay · ${money(doanhThu)} · tháng này ${st.chot_thang} đơn, ${money(st.doanh_thu_thang)}`,
    `CHI PHÍ: ${res ? res.credit_dung : 0} credit Crewzy hôm nay${res && res.gio_tiet_kiem ? ` · tiết kiệm khoảng ${res.gio_tiet_kiem} giờ công` : ''} (chi tiêu quảng cáo xem báo cáo "Theo dõi quảng cáo" 9:00)`,
    `AI ĐÃ LÀM: ${viec.length ? viec.join(' · ') : 'chưa có việc'}`,
    `CÒN TỒN: ${choDuyet} việc chờ bạn duyệt · ${choAi} việc AI đang/sắp làm · ${st.can_goi} khách chưa gọi`,
  ];
  if (canGoi.length) out.push('KHÁCH CẦN GỌI:\n' + canGoi.map((l) => `- ${l.ten}${l.sdt ? ' · ' + l.sdt : ''} · ${l.nguon}${l.muc_do === 'nong' ? ' · NÓNG' : ''}`).join('\n'));
  if (slot === 22) {
    const tmr = (v.dow + 1) % 7;
    const map = { 0: 'cn', 1: 't2', 2: 't3', 3: 't4', 4: 't5', 5: 't6', 6: 't7' };
    const nextDom = new Date(now.getTime() + 7 * H + 24 * H).getUTCDate();
    const runs = sch.filter((s) => s.bat && (s.ngay === 'hang_ngay' || s.ngay === map[tmr] || (s.ngay === 't2_t6' && tmr >= 1 && tmr <= 5) || (s.ngay === 'ngay_1' && nextDom === 1)))
      .sort((a, b) => (a.gio < b.gio ? -1 : 1)).map((s) => `- ${s.gio}${s.lap === 'moi_gio' ? '–' + s.den + ' mỗi giờ' : ''} ${s.ten}`);
    if (runs.length) out.push('NGÀY MAI ĐỘI AI SẼ LÀM:\n' + runs.join('\n'));
  }
  return { tieu_de: (slot === 22 ? 'Tổng kết ngày ' : 'Số liệu 18:00 ngày ') + v.day.split('-').reverse().join('/'), noi_dung: out.join('\n\n'), lead: today.length, doanh_thu: doanhThu };
}

export async function runDigest(env, { origin, now = new Date() }) {
  const v = vn(now);
  const slot = v.min >= 18 * 60 && v.min < 18 * 60 + 15 ? 18 : v.min >= 22 * 60 && v.min < 22 * 60 + 15 ? 22 : 0;
  if (!slot || env.DAILY_DIGEST === 'off') return { bo_qua: true };
  const users = await autoUsers(env);
  let sent = 0;
  for (const u of users) {
    const flag = `digest:${v.day}:${slot}:${u.uid}`;
    if (await env.KV.get(flag)) continue;
    await env.KV.put(flag, '1', { expirationTtl: 2 * 86400 });
    try {
      const d = await digestText(env, u.uid, { now, slot });
      await submitResult(env, u.uid, origin, { tieu_de: d.tieu_de, noi_dung: d.noi_dung, loai: 'bao_cao', trang_thai: 'xong', nguoi_lam: 'Crewzy (tổng kết tự động)' });
      await mailOwner(env, u.uid, d.tieu_de, d.noi_dung + `\n\nXem chi tiết: ${origin}/ket-qua.html`);
      sent++;
    } catch (e) { console.error('digest failed', u.uid, e && e.message); }
  }
  return { slot, sent };
}
