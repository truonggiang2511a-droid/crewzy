// MÁY DỰNG VIDEO CỦA CREWZY (23/11): Worker riêng "crewzy-render" (render/: Cloudflare Containers, HyperFrames + FFmpeg) — Worker chính gọi qua
// RENDER_URL + RENDER_SECRET. Chưa đặt 2 biến này (chưa bật gói Workers Paid) → công cụ báo chưa bật, mọi thứ khác chạy như cũ.
// CHỈ Trợ lý Crewzy dùng (APP_ONLY_TOOLS, 23/11 Giang); AI của khách qua link MCP tự làm bằng skill của khách.
// CREWZY_DUNG_VIDEO: (1) html HyperFrames → MP4 (chữ động, icon động, biểu đồ động, ảnh thật chuyển động) · (2) ghép giọng + nhạc + phụ đề vào video.
// CREWZY_THIET_KE_ANH: html (khung ảnh) → JPG thiết kế từ ảnh thật (tiêu đề, giá, logo, màu thương hiệu) cho bài đăng/quảng cáo.
import { putMedia } from './media.js';
import { addItem } from './library.js';

export const RENDER_TOOL_DEFS = [{ type: 'function', function: { name: 'CREWZY_DUNG_VIDEO',
  description: 'Máy dựng video của Crewzy (HyperFrames + FFmpeg trên Cloudflare), mất 1–3 phút. (1) html = bản dựng HyperFrames hoàn chỉnh (HTML + CSS + GSAP, khung 1080×1920 cho Reels/TikTok/Shorts/Story, 1080×1350 cho bảng tin, 1920×1080 cho YouTube ngang; ảnh/video/nhạc gọi bằng đúng tên file trong tai_nguyen) → MP4: chữ động, icon động, biểu đồ số liệu động, ảnh thật chuyển động, giới thiệu sản phẩm theo màu/font/logo trong Brain. (2) video có sẵn (hoặc video vừa dựng ở bước 1) + giong (file giọng đọc) + nhac (nhạc nền an toàn bản quyền) + phu_de (SRT tiếng Việt) → ghép âm thanh, nhạc tự nhỏ lại dưới giọng, phụ đề chữ trắng nền mờ. Làm cả 2 trong 1 lần được. Chỉ dùng ảnh/video thật của khách (Kho) và tài nguyên an toàn bản quyền. Kết quả lưu vào Kho, trả link MP4 để nộp phiếu/đăng.',
  parameters: { type: 'object', properties: {
    html: { type: 'string', description: 'Bản dựng HyperFrames (toàn bộ file index.html). Bỏ trống nếu chỉ ghép âm thanh vào video có sẵn.' },
    tai_nguyen: { type: 'array', items: { type: 'object', properties: { ten: { type: 'string', description: 'Tên file dùng trong html, vd anh1.jpg' }, url: { type: 'string', description: 'Link https (ảnh Kho, logo, nhạc…)' } }, required: ['ten', 'url'] }, description: 'Ảnh, video, logo, nhạc mà html dùng (tối đa 30).' },
    video: { type: 'string', description: 'Link https video có sẵn để ghép âm thanh/phụ đề (khi không có html).' },
    giong: { type: 'string', description: 'Link https file giọng đọc (mp3/wav) từ ElevenLabs, Vbee, HeyGen… hoặc Kho.' },
    nhac: { type: 'string', description: 'Link https nhạc nền an toàn bản quyền (tự lặp cho đủ dài).' },
    phu_de: { type: 'string', description: 'Phụ đề dạng SRT tiếng Việt (khớp lời đọc).' },
    am_luong_nhac: { type: 'number', description: '0.05–1. Mặc định 0.18 khi có giọng, 0.6 khi chỉ nhạc.' },
    ten: { type: 'string', description: 'Tên video lưu trong Kho.' },
  } } } }];

RENDER_TOOL_DEFS.push({ type: 'function', function: { name: 'CREWZY_THIET_KE_ANH',
  description: 'Thiết kế ẢNH QUẢNG CÁO ĐẸP bằng máy dựng của Crewzy: html = 1 khung HyperFrames tĩnh (hoặc có chuyển động, lấy khung tại giây `luc`) dùng ẢNH THẬT trong Kho làm nền/chủ thể + tiêu đề ngắn, giá/ưu đãi, nút kêu gọi, logo, màu và font trong Brain. Khổ theo nơi đăng: 1080×1350 bảng tin, 1080×1080 vuông, 1080×1920 story, 1000×1500 Pinterest. Không bịa sản phẩm, giá, người. Trả link JPG lưu Kho.',
  parameters: { type: 'object', properties: {
    html: { type: 'string', description: 'Bản dựng HyperFrames (toàn bộ index.html) của khung ảnh.' },
    tai_nguyen: { type: 'array', items: { type: 'object', properties: { ten: { type: 'string' }, url: { type: 'string' } }, required: ['ten', 'url'] }, description: 'Ảnh thật, logo, font… mà html dùng.' },
    luc: { type: 'number', description: 'Lấy khung tại giây thứ mấy (mặc định 0,5).' },
    ten: { type: 'string', description: 'Tên ảnh lưu trong Kho.' },
  }, required: ['html'] } } });

export const renderOn = (env) => !!(env.RENDER_URL && env.RENDER_SECRET);

async function call(env, path, payload) {
  const r = await fetch(String(env.RENDER_URL).replace(/\/+$/, '') + path, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RENDER_SECRET },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(295000),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); let m = t; try { m = JSON.parse(t).error || t; } catch (e) {} throw new Error(String(m || r.status).slice(0, 400)); }
  return r;
}

export async function renderVideo(env, uid, origin, args = {}) {
  if (!renderOn(env)) return { error: 'Máy dựng video của Crewzy chưa bật. Dùng công cụ dựng đã nối (HyperFrames, Shotstack, Creatomate, Canva…) hoặc nộp kịch bản + file giọng/nhạc riêng để khách ghép.' };
  const html = String(args.html || '');
  const hasAudio = args.giong || args.nhac || args.phu_de;
  if (!html && !(args.video && hasAudio)) return { error: 'Cần html (bản dựng HyperFrames) hoặc video + giọng/nhạc/phụ đề.' };
  const https = (u) => (/^https:\/\//.test(String(u || '')) ? String(u) : '');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const aKey = `dungcount:${day}:all`;
  const used = Number((await env.KV.get(aKey)) || 0);
  if (used >= (Number(env.RENDER_APP_DAILY) || 300)) return { error: 'Hôm nay máy dựng của Crewzy đã hết lượt, quay lại ngày mai.' };
  const save = async (res, note) => putMedia(env, uid, origin, res.body, 'video/mp4', note, null, Number(res.headers.get('content-length')) || 0);
  try {
    let link = https(args.video);
    if (html) {
      const assets = (Array.isArray(args.tai_nguyen) ? args.tai_nguyen : []).filter((a) => a && https(a.url)).slice(0, 30).map((a) => ({ name: String(a.ten || '').slice(0, 80), url: a.url }));
      link = await save(await call(env, '/render', { html, assets }), 'hyperframes');
    }
    if (hasAudio) link = await save(await call(env, '/mix', { video: link, voice: https(args.giong), music: https(args.nhac), srt: args.phu_de ? String(args.phu_de) : '', music_volume: args.am_luong_nhac }), 'mix');
    await env.KV.put(aKey, String(used + 1), { expirationTtl: 2 * 86400 });
    await addItem(env, uid, { url: link, kind: 'video', source: 'ai_tao', name: String(args.ten || 'Video dựng ' + day).slice(0, 80), note: hasAudio ? 'Có giọng/nhạc/phụ đề' : 'Dựng bằng HyperFrames' }).catch(() => {});
    return { data: { url: link, ghi_chu: 'Video đã lưu vào Kho. Dùng link này để nộp phiếu (media) hoặc đăng Reels/TikTok/Shorts.' }, video: link };
  } catch (e) {
    return { error: 'Máy dựng báo lỗi: ' + (e && e.message) + '. Sửa bản dựng (html, tên file tài nguyên) rồi thử lại 1 lần.' };
  }
}

export async function designImage(env, uid, origin, args = {}) {
  if (!renderOn(env)) return { error: 'Máy dựng của Crewzy chưa bật. Dùng ảnh thật trong Kho hoặc CREWZY_TAO_ANH.' };
  if (!/<html|<div/i.test(String(args.html || ''))) return { error: 'Thiếu html bản dựng khung ảnh.' };
  const assets = (Array.isArray(args.tai_nguyen) ? args.tai_nguyen : []).filter((a) => a && /^https:\/\//.test(String(a.url || ''))).slice(0, 30).map((a) => ({ name: String(a.ten || '').slice(0, 80), url: a.url }));
  try {
    const res = await call(env, '/image', { html: String(args.html), assets, at: Number(args.luc) || 0.5 });
    const link = await putMedia(env, uid, origin, res.body, 'image/jpeg', 'thiet-ke', null, Number(res.headers.get('content-length')) || 0);
    await addItem(env, uid, { url: link, kind: 'image', source: 'ai_tao', name: String(args.ten || 'Ảnh thiết kế').slice(0, 80), note: 'Thiết kế bằng máy dựng Crewzy' }).catch(() => {});
    return { data: { url: link, ghi_chu: 'Ảnh đã lưu vào Kho. Dùng link này để nộp phiếu (media) hoặc đăng.' }, image: link };
  } catch (e) {
    return { error: 'Máy dựng báo lỗi: ' + (e && e.message) + '. Sửa bản dựng rồi thử lại 1 lần.' };
  }
}
