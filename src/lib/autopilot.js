// CHẠY TỰ ĐỘNG CẢ CÂY (+ việc chạy bằng code không chiếm lịch: soát tồn đọng 30 phút, tổng kết 18:00/22:00 — src/lib/ops.js): 1 nút trên Cây vận hành bật cả chuỗi quy trình theo giờ (dây chuyền doanh nghiệp):
// nội dung → đăng các kênh → trả lời bình luận → khách vào CRM → nhắc sale → báo cáo vào Sheet → bản tin sáng cho CEO → chiến lược tháng.
// Mỗi bước = 1 lịch (schedules.js) gắn nguon 'cay'. Chỉ bật bước ĐÃ sẵn sàng (đủ app + dữ liệu, readiness); bước chưa đủ trả về để khách nối thêm.
// Đăng bài/gửi khách vẫn qua cổng duyệt (WORKFLOW_RULES); CEO duyệt 1 chạm ở Việc chờ duyệt. Số lịch theo gói (feat.lich).
import { workflowById, readiness } from './workflows.js';
import { listSchedules, createSchedule, updateSchedule } from './schedules.js';
import { appBySlug } from './catalog.js';
import { PRIORITY, missionById, missionOf, MISSIONS } from './missions.js';

// Dây chuyền = các bước theo giờ của 6 nhiệm vụ (src/lib/missions.js), thứ tự = ưu tiên khi gói giới hạn số lịch.
export const CHAIN = PRIORITY.flatMap((nv) => missionById(nv).lich.map((l) => ({ ...l, nv })));
export const NGUON = 'cay';
const BRAND_KEYS = ['name', 'products', 'customers', 'voice', 'offers', 'faq'];
export const brandReady = (b) => BRAND_KEYS.filter((k) => b && String(b[k] || '').trim()).length >= 4;

// Kế hoạch cho khách: từng bước sẵn sàng hay thiếu gì, bước nào sẽ bật theo gói.
// nvOn: nhiệm vụ sẽ bật (mặc định = các nhiệm vụ đang bật, chưa bật gì thì cả 6). Lịch của nhiệm vụ khác vẫn giữ chỗ.
const nvOf = (s) => s.nv || (missionOf(s.quy_trinh) || {}).id;
export async function planAutopilot(env, uid, rctx, feat, nvOn) {
  const schedules = await listSchedules(env, uid);
  const mine = schedules.filter((s) => s.nguon === NGUON);
  const active = new Set(mine.filter((s) => s.bat).map(nvOf));
  const want = new Set(nvOn || (active.size ? [...active] : PRIORITY));
  const others = schedules.length - mine.length;
  const canAuto = !feat || feat.tro_ly;
  let slots = Math.max(0, (feat ? feat.lich : 10) - others);
  const steps = CHAIN.map((c) => {
    const w = workflowById(c.id);
    const r = readiness(w, rctx);
    const miss = (r.groups || []).filter((g) => g.bat_buoc && !g.dat).filter((g) => g.goi_y.length).map((g) => ({ vai: g.vai, slug: g.goi_y[0], name: (appBySlug(g.goi_y[0]) || { name: g.goi_y[0] }).name }));
    let ly_do = '';
    if (!r.san_sang) ly_do = miss.length ? 'Cần nối: ' + miss.map((m) => m.name).join(', ') : (r.thieu_du_lieu[0] || {}).ten || 'Chưa đủ dữ liệu';
    else if (c.lap && feat && !feat.tu_tra_loi) ly_do = 'Trả lời mỗi giờ có từ gói Tăng trưởng (sẽ chạy 1 lần/ngày lúc 08:00)';
    const bat = want.has(c.nv) && r.san_sang && slots > 0;
    if (bat) slots--;
    else if (r.san_sang && !ly_do) ly_do = 'Gói hiện tại hết số lịch, nâng gói để bật';
    return { ...c, ten: w.ten, phong: w.phong, san_sang: r.san_sang, se_bat: bat, ly_do, thieu: miss, dang_chay: mine.some((s) => s.quy_trinh === c.id && s.bat) };
  });
  const missions = MISSIONS.map((m) => { const st = steps.filter((x) => x.nv === m.id); return { id: m.id, ten: m.ten, dang_chay: mine.some((s) => s.bat && nvOf(s) === m.id), san_sang: st.some((x) => x.san_sang), buoc: st.length }; });
  return { bat: mine.some((s) => s.bat), so_lich: mine.length, brand_ok: brandReady(rctx.brand), che_do: canAuto ? 'crewzy' : 'ai_cua_toi', steps, missions };
}

// nv: danh sách nhiệm vụ cần bật (bỏ trống = cả 6). Nhiệm vụ đang bật khác vẫn giữ nguyên.
export async function enableAutopilot(env, uid, rctx, feat, nv) {
  if (!brandReady(rctx.brand)) return { error: 'Điền Brain thương hiệu trước (ít nhất tên, sản phẩm, khách hàng, giọng văn) để AI làm đúng thương hiệu.', brand: true };
  const cur = (await listSchedules(env, uid)).filter((s) => s.nguon === NGUON && s.bat).map(nvOf);
  const want = nv && nv.length ? [...new Set([...cur, ...nv])] : PRIORITY;
  await disableAutopilot(env, uid);
  const plan = await planAutopilot(env, uid, rctx, feat, want);
  const on = plan.steps.filter((s) => s.se_bat);
  if (!on.length) return { error: nv && nv.length === 1 ? 'Nhiệm vụ này chưa đủ app để chạy. Nối app theo gợi ý trên thẻ rồi bấm lại.' : 'Chưa có bước nào đủ app để chạy. Nối thêm app theo gợi ý rồi bấm lại.', plan };
  const made = [], loi = [];
  for (const s of on) {
    const hourly = s.lap && (!feat || feat.tu_tra_loi) && plan.che_do === 'crewzy';
    const out = await createSchedule(env, uid, { quy_trinh: s.id, gio: s.gio, ngay: s.ngay, che_do: plan.che_do, ghi_chu: 'Nhiệm vụ ' + missionById(s.nv).ten + ': ' + s.buoc, nguon: NGUON, nv: s.nv,
      ...(hourly ? { lap: 'moi_gio', den: s.den, tu_dong: true } : {}) }, feat);
    if (out.error) loi.push(s.ten + ': ' + out.error); else made.push(s.id);
  }
  const skipped = nv && nv.length ? nv.filter((id) => !on.some((s) => s.nv === id)) : [];
  if (skipped.length) loi.push(...skipped.map((id) => missionById(id).ten + ': chưa đủ app hoặc gói hết số lịch'));
  return { ok: made.length > 0, bat: made, loi, plan: await planAutopilot(env, uid, rctx, feat) };
}

// nv bỏ trống = tắt cả dây chuyền; có nv = chỉ tắt các nhiệm vụ đó.
export async function disableAutopilot(env, uid, nv) {
  const list = await listSchedules(env, uid);
  for (const s of list.filter((x) => x.nguon === NGUON && (!nv || nv.includes(nvOf(x))))) await updateSchedule(env, uid, s.id, 'xoa');
  return { ok: true };
}
