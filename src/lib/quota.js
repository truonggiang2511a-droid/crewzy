// HẠN MỨC THEO GÓI (23/11/2026): đếm trong KV theo ngày giờ Việt Nam, kiểm tra TRƯỚC khi chạy công cụ (chat Trợ lý + cổng MCP).
// - Bài đăng: mỗi nền tảng tối đa bai_ngay × số tài khoản (Facebook: × số Fanpage) mỗi ngày. Nhận diện bài đăng bằng activity.classify === 'dang_bai'.
// - Ảnh / video AI của Crewzy (CREWZY_TAO_ANH / CREWZY_TAO_VIDEO): anh_thang / video_thang MỖI THÁNG (Agency: tính riêng từng thương hiệu vì mã khách con).
// Trả về câu báo lỗi (AI đọc và nói lại cho khách) hoặc null. Đếm lúc cho chạy (lỗi giữa chừng vẫn tính, chấp nhận để khỏi ghi KV hai lần).
import { classify } from './activity.js';

const vnDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TTL = { expirationTtl: 2 * 86400 };
const TTL_MONTH = { expirationTtl: 40 * 86400 };
export const toolkitOf = (slug) => { const m = String(slug || '').toLowerCase().match(/^([a-z0-9]+)_/); return m ? m[1] : ''; };

// Các slug công cụ thật trong một lời gọi (COMPOSIO_MULTI_EXECUTE_TOOL gói nhiều công cụ).
export function slugsOf(name, args) {
  if (name === 'COMPOSIO_MULTI_EXECUTE_TOOL') return ((args && args.tools) || []).map((t) => t && (t.tool_slug || t.slug || t.name)).filter(Boolean);
  return [name];
}

export async function postQuota(env, uid, feat, name, args) {
  if (!feat || feat.bai_ngay == null || !env.KV) return null;
  const counts = {};
  for (const s of slugsOf(name, args)) if (classify(s) === 'dang_bai') { const tk = toolkitOf(s); if (tk) counts[tk] = (counts[tk] || 0) + 1; }
  const tks = Object.keys(counts);
  if (!tks.length) return null;
  const day = vnDay();
  const cur = {};
  for (const tk of tks) {
    const limit = feat.bai_ngay * (tk === 'facebook' ? Math.max(1, feat.fanpage || 1) : Math.max(1, feat.tai_khoan || 1));
    cur[tk] = Number((await env.KV.get(`post:${day}:${uid}:${tk}`)) || 0);
    if (!limit || cur[tk] + counts[tk] > limit) {
      return `Hôm nay đã đăng đủ hạn mức gói trên ${tk} (${limit} bài/ngày: ${feat.bai_ngay} bài × ${tk === 'facebook' ? (feat.fanpage || 1) + ' Fanpage' : (feat.tai_khoan || 1) + ' tài khoản'}). Hẹn giờ đăng sang ngày mai (CREWZY_NOP_KET_QUA kèm gio_dang) hoặc nâng gói. Báo khách, không thử lại.`;
    }
  }
  for (const tk of tks) await env.KV.put(`post:${day}:${uid}:${tk}`, String(cur[tk] + counts[tk]), TTL);
  return null;
}

export async function mediaQuota(env, uid, feat, name) {
  if (!feat || !env.KV) return null;
  const kind = name === 'CREWZY_TAO_ANH' ? 'anh' : name === 'CREWZY_TAO_VIDEO' ? 'video' : name === 'CREWZY_DUNG_VIDEO' ? 'dung' : null;
  if (!kind) return null;
  // Dựng bằng máy của Crewzy (rẻ, không gọi mô hình AI video): mặc định gấp 5 lần số video AI của gói, tối thiểu 20/tháng.
  const limit = kind === 'anh' ? feat.anh_thang : kind === 'video' ? feat.video_thang : (feat.dung_thang != null ? feat.dung_thang : Math.max(20, (feat.video_thang || 0) * 5));
  if (limit == null) return null;
  const key = `czmedia:${vnDay().slice(0, 7)}:${uid}:${kind}`;
  const n = Number((await env.KV.get(key)) || 0);
  if (n >= limit) return limit
    ? `Tháng này đã dùng hết ${limit} ${kind === 'anh' ? 'ảnh' : kind === 'dung' ? 'lượt dựng video' : 'video'} AI của Crewzy theo gói. Dùng ảnh/video thật trong Kho, hoặc AI của khách tự làm rồi tải lên bằng CREWZY_TAI_LEN; tháng sau làm tiếp hoặc nâng gói.`
    : `Gói hiện tại không có ${kind === 'anh' ? 'ảnh' : 'video'} AI của Crewzy: dùng ảnh/video thật trong Kho, hoặc AI của khách (Claude, ChatGPT…) tự làm rồi tải lên bằng CREWZY_TAI_LEN.`;
  await env.KV.put(key, String(n + 1), TTL_MONTH);
  return null;
}

// Đoạn nhắc hạn mức gói cho AI (Trợ lý + AI của khách qua link MCP): số tài khoản, Fanpage, bài/ngày, ảnh/video, cách đăng nhiều Fanpage.
export function planNote(feat) {
  if (!feat || feat.bai_ngay == null) return '';
  const l = [`# Hạn mức gói của khách`,
    `- Mỗi nền tảng tối đa ${feat.tai_khoan} tài khoản; Facebook tối đa ${feat.fanpage} Fanpage. Khách quản lý nhiều Fanpage hơn thì hỏi khách chọn đúng ${feat.fanpage} trang để đăng.`,
    `- Tối đa ${feat.bai_ngay} bài/ngày trên mỗi tài khoản hoặc mỗi Fanpage. Vượt thì hẹn giờ sang ngày mai.`,
    `- AI của Crewzy làm tối đa ${feat.anh_thang || 0} ảnh và ${feat.video_thang || 0} video ngắn mỗi tháng${feat.video_thang ? '' : ' (video do AI của khách tự làm)'}; ưu tiên ảnh/video thật trong Kho và AI của khách.`,
    '- ĐĂNG NHIỀU FANPAGE/TÀI KHOẢN CÙNG NỀN TẢNG: mỗi trang một phiếu CREWZY_NOP_KET_QUA riêng, gio_dang lệch nhau 2 phút (trang 1 đúng giờ, trang 2 +2 phút, trang 3 +4 phút…); SPIN nội dung từng trang: đảo thứ tự ảnh, đổi câu mở đầu, viết lại thân bài và CTA bằng từ ngữ khác, giữ nguyên thông tin thật (giá, sản phẩm, link) — không đăng y hệt nhau để tránh bị đánh dấu spam.'];
  return l.join('\n');
}
