// Công cụ riêng của Crewzy (ngoài công cụ Composio), dùng chung cho Trợ lý AI trong app và link MCP của khách.
// CREWZY_TAO_ANH: tạo ảnh thật bằng Workers AI, lưu KV, trả link công khai https://<site>/api/img/<id>.jpg
//   (dùng được để đăng Facebook/Instagram, tải lên Canva/Drive). Canva API KHÔNG tạo ảnh từ chữ nên phải dùng công cụ này.
// CREWZY_BRAIN: đọc Brain thương hiệu + danh sách app đã kết nối (cho AI bên ngoài như Claude/ChatGPT/Gemini/Grok).
import { getBrand, brandText } from './brand.js';
import { JOB_TOOL_DEFS, jobsForAi, submitResult } from './jobs.js';

const SIZES = {
  vuong: { width: 1024, height: 1024, label: 'vuông 1:1' },
  doc: { width: 896, height: 1120, label: 'dọc 4:5 (bài đăng)' },
  story: { width: 720, height: 1280, label: 'dọc 9:16 (story, Reels)' },
  ngang: { width: 1280, height: 720, label: 'ngang 16:9' },
};
const IMAGE_TTL = 90 * 86400;
const DAILY_IMAGE_CAP = 20; // ảnh/ngày cho mỗi khách (Workers AI có hạn mức miễn phí theo ngày)

export const CREWZY_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'CREWZY_TAO_ANH',
      description: 'Tạo một ảnh mới từ mô tả (ảnh quảng cáo, ảnh bài đăng, ảnh minh hoạ). Trả về link ảnh công khai dùng được để đăng Facebook/Instagram hoặc tải lên Canva/Drive. Viết mô tả bằng tiếng Anh, chi tiết (chủ thể, bối cảnh, ánh sáng, góc máy, phong cách). Ảnh không nên chứa chữ (AI vẽ chữ tiếng Việt hay sai); chữ thêm sau trong bài đăng hoặc Canva.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Mô tả ảnh bằng tiếng Anh, 20–80 từ.' },
          kho: { type: 'string', enum: Object.keys(SIZES), description: 'Khổ ảnh: vuong (1:1), doc (4:5 bài đăng), story (9:16), ngang (16:9). Mặc định doc.' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'CREWZY_BRAIN',
      description: 'Đọc Brain thương hiệu của doanh nghiệp (tên, sản phẩm, khách hàng, giọng văn, điều không được nói, giá/ưu đãi, câu hỏi thường gặp) và danh sách app đã kết nối. Gọi trước khi viết nội dung hoặc trả lời khách.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Chỉ dùng trong Trợ lý AI của Crewzy (không đưa ra link MCP): chờ việc tạo video/ảnh của app khác xong.
CREWZY_TOOL_DEFS.push({
  type: 'function',
  function: {
    name: 'CREWZY_CHO',
    description: 'Chờ vài giây rồi mới làm bước tiếp theo. Dùng khi một app đang tạo video/ảnh và trả về mã việc: chờ rồi gọi công cụ xem trạng thái của app đó.',
    parameters: { type: 'object', properties: { giay: { type: 'number', description: 'Số giây chờ, từ 5 đến 30.' } }, required: ['giay'] },
  },
});

// Phiếu việc: AI của khách nhận việc và nộp kết quả về Crewzy (src/lib/jobs.js).
CREWZY_TOOL_DEFS.push(...JOB_TOOL_DEFS);

export const isCrewzyTool = (name) => typeof name === 'string' && name.startsWith('CREWZY_');

function newId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function runImageModel(env, prompt, size) {
  // FLUX.2 [klein] 4B (đẹp hơn, chỉnh được khổ, nhận multipart); lỗi thì dùng FLUX.1 schnell (luôn vuông 1024).
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(size.width));
    form.append('height', String(size.height));
    const fr = new Response(form);
    const out = await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b', { multipart: { body: fr.body, contentType: fr.headers.get('content-type') } });
    if (out && out.image) return { bytes: b64ToBytes(out.image), model: 'flux-2-klein-4b' };
  } catch (e) {
    console.error('flux-2-klein failed', e && e.message);
  }
  let out;
  try {
    out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 6 });
  } catch (e) {
    // Gói Workers Free: hết 10.000 neurons/ngày thì Workers AI báo lỗi tới 7 giờ sáng (00:00 UTC).
    if (/neuron|4006|daily free allocation/i.test(String(e && e.message))) throw new Error('Hôm nay đã hết hạn mức tạo ảnh của máy chủ, thử lại sau 7 giờ sáng mai.');
    throw e;
  }
  if (!out || !out.image) throw new Error('Mô hình ảnh không trả về ảnh');
  return { bytes: b64ToBytes(out.image), model: 'flux-1-schnell' };
}

export async function createImage(env, uid, origin, args) {
  if (!env.AI) return { error: 'Máy chủ chưa bật Workers AI (binding AI).' };
  const prompt = String((args && args.prompt) || '').trim().slice(0, 2000);
  if (prompt.length < 5) return { error: 'Thiếu mô tả ảnh.' };
  const size = SIZES[args && args.kho] || SIZES.doc;
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const capKey = `imgcount:${day}:${uid}`;
  const used = Number((await env.KV.get(capKey)) || 0);
  if (used >= DAILY_IMAGE_CAP) return { error: `Hôm nay đã tạo đủ ${DAILY_IMAGE_CAP} ảnh, quay lại ngày mai.` };
  const { bytes, model } = await runImageModel(env, prompt, size);
  const id = newId();
  await env.KV.put('img:' + id, bytes, { expirationTtl: IMAGE_TTL, metadata: { ct: 'image/jpeg', uid, model } });
  await env.KV.put(capKey, String(used + 1), { expirationTtl: 2 * 86400 });
  const url = `${origin}/api/img/${id}.jpg`;
  return { data: { url, kho: size.label, ghi_chu: 'Ảnh lưu 90 ngày. Dùng link này để đăng bài hoặc tải lên Canva/Drive. Hiện ảnh cho khách bằng cú pháp ![ảnh](link).' }, image: url };
}

// Lưu ảnh (base64) do công cụ khác trả về thành link công khai /api/img/<id>.jpg (90 ngày).
export async function storeImageBytes(env, uid, origin, base64, mimeType) {
  const bytes = b64ToBytes(base64);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('Ảnh quá lớn');
  const id = newId();
  await env.KV.put('img:' + id, bytes, { expirationTtl: IMAGE_TTL, metadata: { ct: /^image\/(png|jpeg|webp|gif)$/.test(mimeType) ? mimeType : 'image/png', uid, model: 'mcp' } });
  return `${origin}/api/img/${id}.jpg`;
}

export async function readBrain(env, uid, connectedNames) {
  const brand = await getBrand(env, uid);
  const text = brandText(brand);
  return { data: { brain: text || 'Chưa điền Brain thương hiệu. Hỏi người dùng thông tin cần thiết, không tự bịa.', app_da_ket_noi: connectedNames || [] } };
}

export async function runCrewzyTool(env, { uid, origin, name, args, connectedNames }) {
  try {
    if (name === 'CREWZY_TAO_ANH') return await createImage(env, uid, origin, args);
    if (name === 'CREWZY_BRAIN') return await readBrain(env, uid, connectedNames);
    if (name === 'CREWZY_VIEC_CAN_LAM') return await jobsForAi(env, uid, args && args.tat_ca);
    if (name === 'CREWZY_NOP_KET_QUA') return await submitResult(env, uid, origin, args);
    if (name === 'CREWZY_CHO') {
      const s = Math.min(30, Math.max(5, Number((args && args.giay) || 15)));
      await new Promise((r) => setTimeout(r, s * 1000));
      return { data: `Đã chờ ${s} giây. Giờ kiểm tra trạng thái.` };
    }
    return { error: 'Không có công cụ ' + name };
  } catch (e) {
    console.error('crewzy tool failed', name, e && e.message);
    return { error: String((e && e.message) || e).slice(0, 300) };
  }
}

// GET /api/img/<id>.jpg — trả ảnh đã tạo (công khai để Facebook/Canva tải được).
export async function serveImage(request, env) {
  const m = new URL(request.url).pathname.match(/^\/api\/img\/([a-f0-9]{24})(\.jpg)?$/);
  if (!m) return new Response('Không tìm thấy ảnh', { status: 404 });
  const { value, metadata } = await env.KV.getWithMetadata('img:' + m[1], { type: 'arrayBuffer' });
  if (!value) return new Response('Ảnh đã hết hạn hoặc không tồn tại', { status: 404 });
  return new Response(value, { headers: { 'content-type': (metadata && metadata.ct) || 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
}
