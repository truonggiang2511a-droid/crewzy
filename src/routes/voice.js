// Nói để ra lệnh: POST /api/giong-noi (thân = file âm thanh ghi từ micro, content-type audio/webm | audio/mp4 | audio/ogg | audio/wav)
// → Whisper large v3 turbo trên Workers AI (Cloudflare tự chạy, 0,000513 USD/phút, tính vào hạn mức miễn phí Workers AI) → {text}.
// Giới hạn: ≤ 3MB (~2–3 phút), 150 lần/ngày mỗi khách (KV voicecount:*). Khi bật gói: cần gói có Trợ lý Crewzy, trừ 1 credit/lần.
import { Buffer } from 'node:buffer';
import { resolveUid } from '../lib/common.js';
import { getFeatures, upgradeHint, makeMeter } from '../lib/billing.js';

const MAX_BYTES = 3 * 1024 * 1024;
const DAILY = 150;

export default async (req, env) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.AI) return Response.json({ error: 'Máy chủ chưa bật Workers AI.' }, { status: 503 });
  const who = await resolveUid(req, env, new URL(req.url).searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!/^audio\/|^video\/webm$/.test(ct)) return Response.json({ error: 'Cần file âm thanh.' }, { status: 400 });
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES) return Response.json({ error: 'Đoạn ghi âm dài quá, nói ngắn lại (dưới 2 phút).' }, { status: 413 });
  const feat = await getFeatures(env, uid).catch(() => null);
  if (feat && !feat.tro_ly) return Response.json({ error: upgradeHint('tro_ly') }, { status: 402 });
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const k = `voicecount:${day}:${uid}`;
  const n = Number((await env.KV.get(k)) || 0);
  if (n >= DAILY) return Response.json({ error: 'Hôm nay đã dùng giọng nói nhiều lần, gõ chữ giúp em nhé.' }, { status: 429 });
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return Response.json({ error: 'Không nghe thấy gì, thử lại.' }, { status: 400 });
  if (buf.byteLength > MAX_BYTES) return Response.json({ error: 'Đoạn ghi âm dài quá, nói ngắn lại (dưới 2 phút).' }, { status: 413 });
  const meter = await makeMeter(env, uid).catch(() => null);
  if (meter) {
    const no = await meter.tool('CREWZY_GIONG_NOI', {});
    if (no) return Response.json({ error: no }, { status: 402 });
  }
  try {
    const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: Buffer.from(buf).toString('base64'), language: 'vi', vad_filter: true });
    await env.KV.put(k, String(n + 1), { expirationTtl: 2 * 86400 });
    const text = String((out && (out.text || (out.result && out.result.text))) || '').trim();
    return Response.json({ text });
  } catch (e) {
    console.error('voice failed', e && e.message);
    if (/neuron|4006|daily free/i.test(String(e && e.message))) return Response.json({ error: 'Hôm nay máy chủ đã hết hạn mức nghe giọng nói, gõ chữ giúp em nhé.' }, { status: 503 });
    return Response.json({ error: 'Chưa nghe được, thử nói lại hoặc gõ chữ.' }, { status: 502 });
  }
};
