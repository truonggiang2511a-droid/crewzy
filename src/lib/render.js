// MÁY DỰNG VIDEO CỦA CREWZY (23/11): Worker riêng "crewzy-render" (render/: Cloudflare Containers, HyperFrames + FFmpeg) — Worker chính gọi qua
// RENDER_URL + RENDER_SECRET. Chưa đặt 2 biến này (chưa bật gói Workers Paid) → công cụ báo chưa bật, mọi thứ khác chạy như cũ.
// CREWZY_DUNG_VIDEO: (1) html HyperFrames → MP4 (chữ động, icon động, biểu đồ động, ảnh thật chuyển động) · (2) ghép giọng + nhạc + phụ đề vào video.
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
