// CHẠY TỰ ĐỘNG CẢ CÂY: 1 nút trên Cây vận hành bật cả chuỗi quy trình theo giờ (dây chuyền doanh nghiệp):
// nội dung → đăng các kênh → trả lời bình luận → khách vào CRM → nhắc sale → báo cáo vào Sheet → bản tin sáng cho CEO → chiến lược tháng.
// Mỗi bước = 1 lịch (schedules.js) gắn nguon 'cay'. Chỉ bật bước ĐÃ sẵn sàng (đủ app + dữ liệu, readiness); bước chưa đủ trả về để khách nối thêm.
// Đăng bài/gửi khách vẫn qua cổng duyệt (WORKFLOW_RULES); CEO duyệt 1 chạm ở Việc chờ duyệt. Số lịch theo gói (feat.lich).
import { workflowById, readiness } from './workflows.js';
import { listSchedules, createSchedule, updateSchedule } from './schedules.js';
import { appBySlug } from './catalog.js';

// Thứ tự = ưu tiên khi gói giới hạn số lịch (ra khách trước, rồi nội dung, rồi báo cáo).
export const CHAIN = [
  { id: 'lead_vao_crm', gio: '08:30', ngay: 'hang_ngay', buoc: 'Khách mới → CRM, chào lại', tu: 'quang_cao', toi: 'ban_hang' },
  { id: 'tra_loi_binh_luan', gio: '08:00', den: '22:00', lap: 'moi_gio', ngay: 'hang_ngay', buoc: 'Trả lời bình luận, gom khách hỏi giá', tu: 'phan_phoi', toi: 'cham_soc' },
  { id: 'nhac_cham_soc_deal', gio: '09:00', ngay: 't2_t6', buoc: 'Nhắc sale gọi khách chưa chăm', tu: 'ban_hang', toi: 'hang_ngay' },
  { id: 'ban_tin_sang', gio: '07:00', ngay: 'hang_ngay', buoc: 'Bản tin sáng cho CEO: số khách, việc cần gọi', tu: 'bao_cao', toi: 'hang_ngay' },
  { id: 'lich_noi_dung_tuan', gio: '07:30', ngay: 't2', buoc: 'Lên lịch nội dung 7 ngày', tu: 'chien_luoc', toi: 'noi_dung' },
  { id: 'dang_bai_da_duyet', gio: '10:00', ngay: 'hang_ngay', buoc: 'Đăng bài đã duyệt lên mọi kênh', tu: 'noi_dung', toi: 'phan_phoi' },
  { id: 'bao_cao_tuan', gio: '07:15', ngay: 't2', buoc: 'Báo cáo tuần ghi vào Google Sheets', tu: 'ban_hang', toi: 'bao_cao' },
  { id: 'doi_thu_reels', gio: '20:00', ngay: 'cn', buoc: 'Soi đối thủ, học phong cách', tu: 'doi_thu', toi: 'chien_luoc' },
  { id: 'de_xuat_chien_luoc', gio: '08:00', ngay: 'ngay_1', buoc: 'Chiến lược tháng', tu: 'bao_cao', toi: 'chien_luoc' },
];
export const NGUON = 'cay';
const BRAND_KEYS = ['name', 'products', 'customers', 'voice', 'offers', 'faq'];
export const brandReady = (b) => BRAND_KEYS.filter((k) => b && String(b[k] || '').trim()).length >= 4;

// Kế hoạch cho khách: từng bước sẵn sàng hay thiếu gì, bước nào sẽ bật theo gói.
export async function planAutopilot(env, uid, rctx, feat) {
  const schedules = await listSchedules(env, uid);
  const mine = schedules.filter((s) => s.nguon === NGUON);
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
    const bat = r.san_sang && slots > 0;
    if (bat) slots--;
    else if (r.san_sang && !ly_do) ly_do = 'Gói hiện tại hết số lịch, nâng gói để bật';
    return { ...c, ten: w.ten, phong: w.phong, san_sang: r.san_sang, se_bat: bat, ly_do, thieu: miss, dang_chay: mine.some((s) => s.quy_trinh === c.id && s.bat) };
  });
  return { bat: mine.some((s) => s.bat), so_lich: mine.length, brand_ok: brandReady(rctx.brand), che_do: canAuto ? 'crewzy' : 'ai_cua_toi', steps };
}

export async function enableAutopilot(env, uid, rctx, feat) {
  if (!brandReady(rctx.brand)) return { error: 'Điền Brain thương hiệu trước (ít nhất tên, sản phẩm, khách hàng, giọng văn) để AI làm đúng thương hiệu.', brand: true };
  await disableAutopilot(env, uid);
  const plan = await planAutopilot(env, uid, rctx, feat);
  const on = plan.steps.filter((s) => s.se_bat);
  if (!on.length) return { error: 'Chưa có bước nào đủ app để chạy. Nối thêm app theo gợi ý trên cây rồi bấm lại.', plan };
  const made = [], loi = [];
  for (const s of on) {
    const hourly = s.lap && (!feat || feat.tu_tra_loi) && plan.che_do === 'crewzy';
    const out = await createSchedule(env, uid, { quy_trinh: s.id, gio: s.gio, ngay: s.ngay, che_do: plan.che_do, ghi_chu: 'Chạy tự động cả cây: ' + s.buoc, nguon: NGUON,
      ...(hourly ? { lap: 'moi_gio', den: s.den, tu_dong: true } : {}) }, feat);
    if (out.error) loi.push(s.ten + ': ' + out.error); else made.push(s.id);
  }
  return { ok: made.length > 0, bat: made, loi, plan: await planAutopilot(env, uid, rctx, feat) };
}

export async function disableAutopilot(env, uid) {
  const list = await listSchedules(env, uid);
  for (const s of list.filter((x) => x.nguon === NGUON)) await updateSchedule(env, uid, s.id, 'xoa');
  return { ok: true };
}
