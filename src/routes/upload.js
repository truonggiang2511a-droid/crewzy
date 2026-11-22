// Tải file lên Crewzy (ảnh, video, âm thanh ≤ 24MB) → link cố định /api/media/<id>.<đuôi>.
//   POST /api/upload?uid=&ten=     — trang Brain thương hiệu (giọng mẫu, ảnh quảng cáo mẫu, logo, nhạc), thân = file, content-type = loại file
//   PUT  /api/upload/<mã ký>       — AI của khách (Claude Code, Codex) tải video/ảnh vừa dựng trên máy: curl -T file … (mã do CREWZY_TAI_LEN cấp)
// Trần 40 file/ngày mỗi khách (KV upcount:<ngày VN>:<uid>).
import { resolveUid, verifyData } from '../lib/common.js';
import { putMedia, kindOf, MAX_BYTES } from '../lib/media.js';
import { badType } from '../lib/uploads.js';

export const MAX_UPLOADS_PER_DAY = 40;

async function takeUploadQuota(env, uid) {
  const k = `upcount:${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)}:${uid}`;
  const n = Number((await env.KV.get(k)) || 0);
  if (n >= MAX_UPLOADS_PER_DAY) return false;
  await env.KV.put(k, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}


async function store(req, env, uid, ct, fixedId) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return Response.json({ error: 'File lớn hơn 24MB. Nén nhỏ lại hoặc dán link (Google Drive, YouTube…).' }, { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return Response.json({ error: 'File trống.' }, { status: 400 });
  if (bytes.length > MAX_BYTES) return Response.json({ error: 'File lớn hơn 24MB.' }, { status: 413 });
  if (!(await takeUploadQuota(env, uid))) return Response.json({ error: `Đã tải ${MAX_UPLOADS_PER_DAY} file hôm nay. Mai tải tiếp.` }, { status: 429 });
  const origin = new URL(req.url).origin;
  const link = await putMedia(env, uid, origin, bytes, ct, 'upload', fixedId);
  return Response.json({ link, loai: kindOf(ct), kich_thuoc: bytes.length });
}

export default async (req, env) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/api\/upload\/([^/]+)$/);
  if (m) {
    if (req.method !== 'PUT' && req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const d = await verifyData(env, 'upload', m[1]);
    if (!d) return Response.json({ error: 'Link tải lên sai hoặc đã hết hạn. Gọi lại CREWZY_TAI_LEN để lấy link mới.' }, { status: 403 });
    if (await env.KV.get('media:' + d.i, { type: 'stream' }).then((v) => { if (v) v.cancel(); return !!v; })) {
      return Response.json({ error: 'Link này đã dùng. Gọi lại CREWZY_TAI_LEN để lấy link mới.' }, { status: 409 });
    }
    const ct = (req.headers.get('content-type') || d.c).split(';')[0].trim().toLowerCase();
    if (ct !== d.c) return Response.json({ error: `Loại file phải là ${d.c} như lúc xin link.` }, { status: 400 });
    return store(req, env, d.u, ct, d.i);
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const err = badType(ct);
  if (err) return Response.json({ error: err }, { status: 400 });
  return store(req, env, who.uid, ct);
};
