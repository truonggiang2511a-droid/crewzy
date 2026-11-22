// KHO LƯU TRỮ của khách (D1 bảng library, migrations/0003_library.sql): ảnh, video, âm thanh, tài liệu.
// Tự vào kho: file khách tải lên (trang Kho, ô chat, Brain), ảnh/video AI tạo (CREWZY_TAO_ANH/TAO_VIDEO), ảnh AI lấy từ website/fanpage (CREWZY_LUU_KHO).
// File nằm ở R2 (/api/media/<id>.<đuôi>) — xoá trong kho thì xoá luôn file R2 của khách đó. Dung lượng tối đa theo gói (PLAN_FEATURES.kho_gb).
import { rehostUrl, kindOf } from './media.js';

const MEDIA_ID = /\/api\/media\/([a-f0-9]{24})\.[a-z0-9]{2,4}$/;
const newId = () => 'k' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('');
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
export const KINDS = { image: 'Ảnh', video: 'Video', audio: 'Âm thanh', doc: 'Tài liệu', link: 'Link' };
export const SOURCES = { tai_len: 'Bạn tải lên', ai_tao: 'AI tạo', web: 'Lấy từ website', fanpage: 'Lấy từ fanpage', ket_qua: 'Từ kết quả', link: 'Link bạn dán' };

export function guessKind(url) {
  const u = String(url || '').toLowerCase().split('?')[0];
  if (/\.(png|jpe?g|webp|gif)$/.test(u) || u.includes('/api/img/')) return 'image';
  if (/\.(mp4|webm|mov|m4v)$/.test(u)) return 'video';
  if (/\.(mp3|wav|m4a|weba)$/.test(u)) return 'audio';
  if (/\.(pdf|docx|xlsx|pptx|txt|csv)$/.test(u)) return 'doc';
  return 'link';
}

export async function addItem(env, uid, { url, kind, name, source, size = 0, note }) {
  if (!env.DB || !uid || !/^https:\/\//.test(url || '')) return null;
  const id = newId();
  try {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO library (id, uid, kind, url, name, source, size, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(id, uid, KINDS[kind] ? kind : guessKind(url), clip(url, 1000), clip(name, 120) || null, SOURCES[source] ? source : 'link', Math.max(0, Number(size) || 0), clip(note, 300) || null, Date.now()).run();
    return r.meta && r.meta.changes ? id : null;
  } catch (e) { console.error('library add failed', e && e.message); return null; }
}

export async function listItems(env, uid, { kind, q, before, limit = 60 } = {}) {
  if (!env.DB) return [];
  const where = ['uid = ?1'];
  const args = [uid];
  if (KINDS[kind]) { args.push(kind); where.push(`kind = ?${args.length}`); }
  if (q) { args.push('%' + clip(q, 60) + '%'); where.push(`(name LIKE ?${args.length} OR note LIKE ?${args.length})`); }
  if (before) { args.push(Number(before)); where.push(`created_at < ?${args.length}`); }
  args.push(Math.min(200, Math.max(1, Number(limit) || 60)));
  const r = await env.DB.prepare(`SELECT id, kind, url, name, source, size, note, created_at FROM library WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?${args.length}`).bind(...args).all();
  return r.results || [];
}

export async function usageBytes(env, uid) {
  if (!env.DB) return 0;
  const r = await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM library WHERE uid = ?1').bind(uid).first().catch(() => null);
  return (r && r.n) || 0;
}

export async function removeItem(env, uid, id) {
  if (!env.DB) return false;
  const row = await env.DB.prepare('SELECT url FROM library WHERE id = ?1 AND uid = ?2').bind(id, uid).first();
  if (!row) return false;
  await env.DB.prepare('DELETE FROM library WHERE id = ?1 AND uid = ?2').bind(id, uid).run();
  // Chỉ xoá file R2 nếu file đó do chính khách này lưu (customMetadata.uid).
  const m = MEDIA_ID.exec(row.url);
  if (m && env.MEDIA) {
    const head = await env.MEDIA.head('media/' + m[1]).catch(() => null);
    if (head && head.customMetadata && head.customMetadata.uid === uid) await env.MEDIA.delete('media/' + m[1]).catch(() => {});
  }
  return true;
}

export async function renameItem(env, uid, id, name) {
  if (!env.DB) return false;
  const r = await env.DB.prepare('UPDATE library SET name = ?3 WHERE id = ?1 AND uid = ?2').bind(id, uid, clip(name, 120)).run();
  return !!(r.meta && r.meta.changes);
}

// Công cụ AI: đọc kho (để dùng ảnh/video thật của khách làm nội dung) và lưu ảnh lấy từ web/fanpage vào kho.
export const LIBRARY_TOOL_DEFS = [
  { type: 'function', function: {
    name: 'CREWZY_KHO',
    description: 'Xem Kho lưu trữ của khách: ảnh sản phẩm thật, video, logo, tài liệu khách đã tải lên hoặc AI đã lưu. LUÔN xem kho trước khi làm ảnh/video/bài đăng để dùng hình thật của khách (đưa link ảnh vào anh_mau của CREWZY_TAO_ANH hoặc anh của CREWZY_TAO_VIDEO, hoặc đăng thẳng).',
    parameters: { type: 'object', properties: {
      loai: { type: 'string', enum: Object.keys(KINDS), description: 'Lọc theo loại: image, video, audio, doc, link.' },
      tim: { type: 'string', description: 'Từ khoá trong tên hoặc ghi chú.' },
    } },
  } },
  { type: 'function', function: {
    name: 'CREWZY_LUU_KHO',
    description: 'Lưu ảnh/video (link https) vào Kho lưu trữ của khách thành link cố định của Crewzy. Dùng sau CREWZY_DOC_WEB (ảnh trên website của khách) hoặc ảnh lấy từ fanpage qua công cụ Facebook/Instagram, để làm content hoặc làm ảnh mẫu cho CREWZY_TAO_ANH. Tối đa 10 link mỗi lần.',
    parameters: { type: 'object', properties: {
      links: { type: 'array', items: { type: 'string' }, description: 'Link https của ảnh/video.' },
      nguon: { type: 'string', enum: ['web', 'fanpage', 'ket_qua'], description: 'Lấy từ đâu.' },
      ghi_chu: { type: 'string', description: 'Mô tả ngắn để tìm lại (ví dụ: ảnh mặt tiền căn nhà Bình Chánh).' },
    }, required: ['links'] },
  } },
];

export async function libraryTool(env, uid, origin, name, args) {
  if (name === 'CREWZY_KHO') {
    const items = await listItems(env, uid, { kind: args && args.loai, q: args && args.tim, limit: 40 });
    return { data: { so_luong: items.length, muc: items.map((i) => ({ loai: i.kind, link: i.url, ten: i.name || undefined, nguon: SOURCES[i.source] || i.source, ghi_chu: i.note || undefined })),
      ghi_chu: items.length ? 'Dùng link ảnh thật này cho bài đăng hoặc làm ảnh mẫu (anh_mau) khi tạo ảnh/video.' : 'Kho trống. Gợi ý khách tải ảnh sản phẩm lên trang Kho, hoặc đọc website/fanpage của khách để lấy ảnh (CREWZY_DOC_WEB rồi CREWZY_LUU_KHO).' } };
  }
  if (name === 'CREWZY_LUU_KHO') {
    const links = (Array.isArray(args && args.links) ? args.links : []).filter((u) => /^https:\/\//.test(String(u))).slice(0, 10);
    if (!links.length) return { error: 'Thiếu link https của ảnh/video.' };
    const src = ['web', 'fanpage', 'ket_qua'].includes(args && args.nguon) ? args.nguon : 'web';
    const saved = [];
    for (const u of links) {
      const r = await rehostUrl(env, uid, origin, u).catch(() => null);
      if (!r || r.goc) continue;
      await addItem(env, uid, { url: r.link, kind: r.kind, source: src, note: args && args.ghi_chu, name: (args && args.ghi_chu) || '' });
      saved.push({ loai: r.kind, link: r.link });
    }
    return saved.length ? { data: { da_luu: saved, ghi_chu: 'Đã lưu vào Kho. Dùng các link này để đăng bài hoặc làm ảnh mẫu.' } } : { error: 'Không lưu được link nào (không phải ảnh/video, quá lớn, hoặc trang chặn tải).' };
  }
  return { error: 'Không có công cụ ' + name };
}
export { kindOf };
