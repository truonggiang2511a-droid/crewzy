// Tải file lên Crewzy (ảnh, video, âm thanh ≤ 95MB khi có R2, ≤ 24MB nếu chỉ có KV) → link cố định /api/media/<id>.<đuôi>.
//   POST /api/upload?uid=&ten=     — trang Brain thương hiệu (giọng mẫu, ảnh quảng cáo mẫu, logo, nhạc), thân = file, content-type = loại file
//   PUT  /api/upload/<mã ký>       — AI của khách (Claude Code, Codex) tải video/ảnh vừa dựng trên máy: curl -T file … (mã do CREWZY_TAI_LEN cấp)
// Trần 40 file/ngày mỗi khách (KV upcount:<ngày VN>:<uid>).
import { resolveUid, verifyData } from '../lib/common.js';
import { putMedia, kindOf, maxBytes, maxLabel, mediaExists } from '../lib/media.js';
import { badType } from '../lib/uploads.js';
import { addItem, usageBytes } from '../lib/library.js';
import { getFeatures } from '../lib/billing.js';

export const MAX_UPLOADS_PER_DAY = 40;

async function takeUploadQuota(env, uid) {
  const k = `upcount:${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)}:${uid}`;
  const n = Number((await env.KV.get(k)) || 0);
  if (n >= MAX_UPLOADS_PER_DAY) return false;
  await env.KV.put(k, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}


async function store(req, env, uid, ct, fixedId, onSaved) {
  const max = maxBytes(env);
  const tooBig = () => Response.json({ error: `File lớn hơn ${maxLabel(env)}. Nén nhỏ lại hoặc dán link (Google Drive, YouTube…).` }, { status: 413 });
  const len = Number(req.headers.get('content-length') || 0);
  if (len > max) return tooBig();
  const origin = new URL(req.url).origin;
  // Có R2 + biết độ dài: đưa thẳng luồng vào R2 (video lớn không chiếm bộ nhớ Worker).
  if (env.MEDIA && len > 0 && req.body) {
    if (!(await takeUploadQuota(env, uid))) return Response.json({ error: `Đã tải ${MAX_UPLOADS_PER_DAY} file hôm nay. Mai tải tiếp.` }, { status: 429 });
    const link = await putMedia(env, uid, origin, req.body, ct, 'upload', fixedId, len);
    if (onSaved) await onSaved(link, len);
    return Response.json({ link, loai: kindOf(ct), kich_thuoc: len });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return Response.json({ error: 'File trống.' }, { status: 400 });
  if (bytes.length > max) return tooBig();
  if (!(await takeUploadQuota(env, uid))) return Response.json({ error: `Đã tải ${MAX_UPLOADS_PER_DAY} file hôm nay. Mai tải tiếp.` }, { status: 429 });
  const link = await putMedia(env, uid, origin, bytes, ct, 'upload', fixedId);
  if (onSaved) await onSaved(link, bytes.length);
  return Response.json({ link, loai: kindOf(ct), kich_thuoc: bytes.length });
}

export default async (req, env) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/api\/upload\/([^/]+)$/);
  if (m) {
    if (req.method !== 'PUT' && req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const d = await verifyData(env, 'upload', m[1]);
    if (!d) return Response.json({ error: 'Link tải lên sai hoặc đã hết hạn. Gọi lại CREWZY_TAI_LEN để lấy link mới.' }, { status: 403 });
    if (await mediaExists(env, d.i)) {
      return Response.json({ error: 'Link này đã dùng. Gọi lại CREWZY_TAI_LEN để lấy link mới.' }, { status: 409 });
    }
    const ct = (req.headers.get('content-type') || d.c).split(';')[0].trim().toLowerCase();
    if (ct !== d.c) return Response.json({ error: `Loại file phải là ${d.c} như lúc xin link.` }, { status: 400 });
    return store(req, env, d.u, ct, d.i, (link, size) => addItem(env, d.u, { url: link, kind: kindOf(ct), source: 'ket_qua', size, name: 'File AI tải lên' }));
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const err = badType(ct);
  if (err) return Response.json({ error: err }, { status: 400 });
  // Dung lượng Kho theo gói (PLAN_FEATURES.kho_gb).
  const feat = await getFeatures(env, who.uid).catch(() => null);
  if (feat && env.DB) {
    const limit = (feat.kho_gb || 0) * 1024 * 1024 * 1024;
    const used = await usageBytes(env, who.uid).catch(() => 0);
    if (used + Number(req.headers.get('content-length') || 0) > limit) return Response.json({ error: `Kho đã đầy (${Math.round(limit / 1024 / 1024)}MB theo gói). Xoá bớt file trong Kho hoặc nâng gói.` }, { status: 413 });
  }
  const ten = (url.searchParams.get('ten') || '').slice(0, 120);
  const nguon = url.searchParams.get('kho') === '0' ? null : 'tai_len';
  return store(req, env, who.uid, ct, null, nguon ? (link, size) => addItem(env, who.uid, { url: link, kind: kindOf(ct), source: nguon, size, name: ten }) : null);
};
