// Link tải file lên cho AI (công cụ CREWZY_TAI_LEN) — route PUT /api/upload/<mã ký> ở src/routes/upload.js.
import { signData } from './common.js';
import { newId, EXT } from './media.js';

const PUT_TTL_MS = 2 * 3600 * 1000;

export function badType(ct) {
  return !EXT[ct] ? 'Chỉ nhận ảnh (png, jpg, webp, gif), video (mp4, webm, mov) hoặc âm thanh (mp3, wav, m4a).' : '';
}

// Link sau khi tải biết trước để AI nộp phiếu ngay.
export async function createPutLink(env, origin, uid, ct) {
  const type = String(ct || '').toLowerCase();
  const err = badType(type);
  if (err) return { error: err };
  const id = newId();
  const token = await signData(env, 'upload', { u: uid, i: id, c: type, e: Date.now() + PUT_TTL_MS });
  const put = `${origin}/api/upload/${token}`;
  return { data: {
    put_url: put,
    link_sau_khi_tai: `${origin}/api/media/${id}.${EXT[type]}`,
    lenh: `curl -sS -T "<đường dẫn file>" -H "content-type: ${type}" "${put}"`,
    luu_y: 'Link tải lên dùng 1 lần trong 2 giờ, file ≤ 24MB. Tải xong dùng link_sau_khi_tai để đăng bài hoặc nộp CREWZY_NOP_KET_QUA.',
  } };
}

