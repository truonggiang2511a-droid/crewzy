// AI XEM MẪU (25/11, Giang: Claude/ChatGPT không mở được video → không học được phong cách dựng).
// Trình duyệt tự "xem" video (public/assets/ref-watch.js): cắt khung hình ở mỗi lần chuyển cảnh + đều tay, đo nhịp cắt, tách tiếng 16 kHz.
// POST /api/phan-tich-mau { link, loai, ma?, ghi_chu?, thoi_luong, rong, cao, cat:[giây], khung:[{t, jpg(base64)}], am_thanh:[wav base64] }
//   → Whisper (Workers AI) nghe lời thoại từng đoạn → Claude Sonnet xem khung hình + lời thoại + số liệu nhịp cắt
//   → bản phân tích cách dựng (Markdown) + tóm tắt 1 câu → ghi vào mẫu trong Brain (brand.refs[].phan_tich/tom_tat), trả về trang.
// Mọi AI (Trợ lý Crewzy, Claude/ChatGPT qua link MCP) đọc lại bằng CREWZY_BRAIN {ma}. Trừ credit theo token thật (makeMeter.tokens).
import { resolveUid } from '../lib/common.js';
import { getBrand, putBrand, cleanAnalysis, assignCodes, REF_TYPES } from '../lib/brand.js';
import { gate, makeMeter } from '../lib/billing.js';
import { appAnthropic } from '../lib/ai.js';

const MODEL = 'claude-sonnet-5-5';
const MAX_FRAMES = 24;
const MAX_FRAME_B64 = 400 * 1024;
const MAX_AUDIO_CHUNKS = 4;
const MAX_AUDIO_B64 = 3 * 1024 * 1024;
const DAILY = 30;

const SYSTEM = `Bạn là đạo diễn dựng video và giám đốc hình ảnh cho các doanh nghiệp Việt Nam. Bạn nhận các khung hình cắt ra từ MỘT video mẫu (kèm mốc giây), số liệu nhịp cắt đo bằng máy và lời thoại đã nghe được.
Việc của bạn: phân tích THẬT CHI TIẾT cách video này được quay và dựng để một AI khác (hoặc người dựng) làm lại ĐÚNG PHONG CÁCH ĐÓ cho thương hiệu khác.
Chỉ nói điều nhìn thấy trong khung hình / nghe trong lời thoại / có trong số liệu. Điều phải đoán (nhạc, hiệu ứng giữa hai khung) thì ghi "(ước đoán)". Không nhận xét chung chung kiểu "video hấp dẫn".
Viết tiếng Việt, Markdown, đúng các mục sau:
## Tổng quan — thể loại, khổ hình, độ dài, đối tượng, cảm xúc chủ đạo (2–3 câu)
## Hook 3 giây đầu — khung hình mở, chữ trên màn hình, câu nói đầu, vì sao giữ người xem
## Cấu trúc theo thời gian — bảng | Mốc | Cảnh/góc máy | Chữ trên màn hình | Lời/âm thanh | Mục đích | cho từng đoạn chính
## Nhịp dựng — số cảnh, trung bình giây/cảnh, chỗ nhanh/chậm, kiểu chuyển cảnh (cắt thẳng, zoom, trượt, nhảy…)
## Quay phim — cỡ cảnh (cận, trung, toàn, flycam), góc máy, chuyển động máy, ánh sáng, người dẫn (vị trí, ánh mắt, trang phục)
## Chữ và đồ hoạ — font (đậm/mảnh, có chân/không), cỡ, màu chữ + viền/nền (ghi mã màu hex ước lượng), vị trí, hiệu ứng chữ, phụ đề, icon, sticker, motion graphics, logo
## Màu sắc — bảng màu chủ đạo (hex ước lượng), tông (ấm/lạnh, tương phản, bão hoà), kiểu LUT
## Âm thanh — giọng (nam/nữ, vùng miền, tốc độ, cảm xúc), nhạc nền (ước đoán thể loại, nhịp), hiệu ứng âm thanh
## Lời thoại và cách viết — công thức kịch bản (ví dụ: nỗi đau → lợi ích → bằng chứng → kêu gọi), câu chốt, CTA
## Công thức dựng lại — danh sách đánh số các bước cụ thể để dựng video MỚI cùng phong cách cho thương hiệu khác: độ dài, số cảnh, thời lượng từng cảnh, chữ gì ở đâu, chuyển cảnh, nhạc, CTA
## Prompt mẫu — 1 đoạn prompt tiếng Việt ngắn gọn để giao cho AI dựng video (thay [sản phẩm], [thương hiệu])
Cuối cùng một dòng riêng bắt đầu bằng "TÓM TẮT:" ≤ 220 ký tự, gom phong cách thành một câu (khổ, độ dài, nhịp, kiểu chữ, màu, âm thanh).`;

const SYSTEM_IMAGE = `Bạn là giám đốc hình ảnh cho các doanh nghiệp Việt Nam. Bạn nhận MỘT ảnh mẫu (ảnh quảng cáo, logo hoặc tư liệu) khách thích.
Phân tích THẬT CHI TIẾT để AI khác làm ảnh MỚI cùng phong cách cho thương hiệu khác. Chỉ nói điều nhìn thấy. Viết tiếng Việt, Markdown, các mục:
## Tổng quan — loại ảnh, khổ, mục đích
## Bố cục — chủ thể ở đâu, tỉ lệ, khoảng trống, đường dẫn mắt, lưới
## Chữ — tiêu đề/phụ đề/giá/CTA: font (đậm/mảnh, có chân/không), cỡ tương đối, màu + mã hex ước lượng, vị trí, hiệu ứng
## Màu và ánh sáng — bảng màu (hex ước lượng), tông, kiểu chỉnh màu
## Đồ hoạ — khung, icon, sticker, hình khối, logo, nhãn giá
## Công thức làm lại — các bước cụ thể để thiết kế ảnh mới cùng phong cách
## Prompt mẫu — 1 đoạn prompt tiếng Việt (thay [sản phẩm], [thương hiệu])
Cuối cùng một dòng "TÓM TẮT:" ≤ 220 ký tự.`;

const bad = (error, status = 400) => Response.json({ error }, { status });
const fmt = (s) => { const n = Math.max(0, Number(s) || 0); return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`; };

async function listen(env, chunks) {
  if (!env.AI || !chunks.length) return '';
  const parts = [];
  for (const b64 of chunks) {
    try {
      const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64, vad_filter: true });
      const t = String((out && (out.text || (out.result && out.result.text))) || '').trim();
      if (t) parts.push(t);
    } catch (e) { console.error('ref whisper failed', e && e.message); }
  }
  return parts.join(' ');
}

export default async (req, env) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  if (!env.ANTHROPIC_API_KEY) return bad('Máy chủ chưa đặt khoá AI nên chưa xem mẫu được.', 503);
  let body;
  try { body = await req.json(); } catch (e) { return bad('Dữ liệu không hợp lệ (video quá dài?). Thử lại.'); }
  const link = String((body && body.link) || '').trim();
  if (!/^https:\/\//.test(link)) return bad('Thiếu link mẫu.');
  const loai = REF_TYPES[body.loai] ? body.loai : 'video_mau';
  const frames = (Array.isArray(body.khung) ? body.khung : []).filter((f) => f && typeof f.jpg === 'string' && f.jpg.length < MAX_FRAME_B64).slice(0, MAX_FRAMES);
  if (!frames.length) return bad('Chưa lấy được khung hình nào từ mẫu.');
  const audio = (Array.isArray(body.am_thanh) ? body.am_thanh : []).filter((a) => typeof a === 'string' && a.length < MAX_AUDIO_B64).slice(0, MAX_AUDIO_CHUNKS);

  const g = await gate(env, uid, { email: who.session && who.session.email, needCredits: 5 });
  if (g) return Response.json({ error: g.error }, { status: g.status });
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const ck = `refcount:${day}:${uid}`;
  const used = Number((await env.KV.get(ck)) || 0);
  if (used >= DAILY) return bad(`Hôm nay đã cho AI xem ${DAILY} mẫu. Mai xem tiếp nhé.`, 429);

  const isVideo = frames.length > 1;
  const dur = Number(body.thoi_luong) || 0;
  const cuts = (Array.isArray(body.cat) ? body.cat : []).map(Number).filter((x) => x >= 0).sort((a, b) => a - b).slice(0, 400);
  const transcript = isVideo ? await listen(env, audio) : '';

  const facts = [];
  if (isVideo) {
    const scenes = cuts.length + 1;
    facts.push(`Độ dài: ${dur.toFixed(1)} giây (${fmt(dur)}). Khổ: ${body.rong || '?'}×${body.cao || '?'}${body.rong && body.cao ? (body.rong < body.cao ? ' (dọc)' : body.rong > body.cao ? ' (ngang)' : ' (vuông)') : ''}.`);
    facts.push(`Máy đo chuyển cảnh: ${cuts.length} lần cắt → khoảng ${scenes} cảnh, trung bình ${(dur / scenes).toFixed(1)} giây/cảnh.` + (cuts.length ? ` Mốc cắt (giây): ${cuts.map((c) => c.toFixed(1)).join(', ')}.` : ' (Có thể là một cảnh liền hoặc chuyển cảnh mượt máy không bắt được.)'));
    facts.push(transcript ? `LỜI THOẠI NGHE ĐƯỢC (Whisper, có thể sai chính tả):\n${transcript.slice(0, 12000)}` : (audio.length ? 'Không nghe ra lời thoại (có thể chỉ có nhạc).' : 'Không tách được âm thanh (trình duyệt không đọc được tiếng của file này).'));
  }
  if (body.ghi_chu) facts.push(`Khách ghi chú điều thích ở mẫu: ${String(body.ghi_chu).slice(0, 300)}`);

  const content = [];
  for (const f of frames) {
    if (isVideo) content.push({ type: 'text', text: `Khung ở giây ${Number(f.t || 0).toFixed(1)}${f.cat ? ' (ngay sau một lần cắt cảnh)' : ''}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.jpg } });
  }
  content.push({ type: 'text', text: (facts.join('\n\n') || 'Ảnh mẫu khách thích.') + '\n\nPhân tích theo đúng các mục đã dặn.' });

  let res;
  try {
    res = await appAnthropic(env).messages.create({ model: MODEL, max_tokens: isVideo ? 5000 : 2500, system: isVideo ? SYSTEM : SYSTEM_IMAGE, messages: [{ role: 'user', content }] });
  } catch (e) {
    console.error('ref analyze failed', e && e.message);
    return bad('AI chưa xem được mẫu lúc này, thử lại sau ít phút.', 502);
  }
  await env.KV.put(ck, String(used + 1), { expirationTtl: 2 * 86400 });
  const meter = await makeMeter(env, uid).catch(() => null);
  if (meter) await meter.tokens(res.usage, 'xem_mau', MODEL).catch(() => {});

  let text = ((res.content || []).find((b) => b.type === 'text') || {}).text || '';
  const m = text.match(/TÓM TẮT:\s*(.+)\s*$/);
  const tom_tat = (m ? m[1] : text.replace(/[#|*]/g, ' ').replace(/\s+/g, ' ')).trim().slice(0, 240);
  if (m) text = text.slice(0, m.index).trim();
  if (isVideo && transcript) text += `\n\n## Lời thoại gốc (máy nghe)\n${transcript.slice(0, 2500)}`;
  const phan_tich = cleanAnalysis(text);

  // Ghi vào đúng mẫu trong Brain (mẫu chưa lưu thì thêm vào luôn để khỏi mất phân tích).
  const brand = (await getBrand(env, uid)) || {};
  const refs = Array.isArray(brand.refs) ? brand.refs : [];
  let ref = refs.find((r) => r.link === link);
  if (!ref) { ref = { loai, link, ghi_chu: String(body.ghi_chu || '').slice(0, 300) }; refs.push(ref); }
  Object.assign(ref, { phan_tich, tom_tat, phan_tich_luc: new Date().toISOString() });
  brand.refs = assignCodes(refs);
  await putBrand(env, uid, brand);
  return Response.json({ ok: true, ma: ref.ma, tom_tat, phan_tich, loi_thoai: !!transcript });
};
