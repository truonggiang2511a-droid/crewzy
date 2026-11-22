// Công cụ riêng của Crewzy (ngoài công cụ Composio), dùng chung cho Trợ lý AI trong app và link MCP của khách.
// CREWZY_TAO_ANH: tạo ảnh thật bằng Workers AI, lưu KV, trả link công khai https://<site>/api/img/<id>.jpg
//   (dùng được để đăng Facebook/Instagram, tải lên Canva/Drive). Canva API KHÔNG tạo ảnh từ chữ nên phải dùng công cụ này.
// CREWZY_BRAIN: đọc Brain thương hiệu + danh sách app đã kết nối (cho AI bên ngoài như Claude/ChatGPT/Gemini/Grok).
import { getBrand, brandText, brandPack } from './brand.js';
import { createPutLink } from './uploads.js';
import { JOB_TOOL_DEFS, jobsForAi, submitResult } from './jobs.js';
import { rehostUrl, putMedia } from './media.js';
import { WORKFLOWS, DEPARTMENTS, workflowById, readiness, doneFlows, WORKFLOW_RULES, formatsFor, MCP_HOSTS, forMcp } from './workflows.js';
import { readWebsite } from './webRead.js';
import { listJobs } from './jobs.js';
import { mcpById } from './mcpDirectory.js';
import { listServers } from './mcpServers.js';
import { LIBRARY_TOOL_DEFS, libraryTool, addItem } from './library.js';

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
      description: 'Tạo một ảnh mới từ mô tả, hoặc biến ảnh thật của khách thành ảnh quảng cáo đẹp (chat_luong dep + anh_mau). Trả về link ảnh công khai dùng được để đăng Facebook/Instagram hoặc tải lên Canva/Drive. Viết mô tả bằng tiếng Anh, chi tiết (chủ thể, bối cảnh, ánh sáng, góc máy, phong cách). Ảnh không nên chứa chữ (AI vẽ chữ tiếng Việt hay sai); chữ thêm sau trong bài đăng hoặc Canva.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Mô tả ảnh bằng tiếng Anh, 20–80 từ.' },
          kho: { type: 'string', enum: Object.keys(SIZES), description: 'Khổ ảnh: vuong (1:1), doc (4:5 bài đăng; mức Đẹp ra 3:4), story (9:16), ngang (16:9). Mặc định doc.' },
          chat_luong: { type: 'string', enum: ['nhanh', 'dep'], description: 'nhanh = 3 credit, ảnh minh hoạ nhanh (mặc định). dep = 25 credit, ảnh quảng cáo đẹp 2K (Seedream 4.5), giữ đúng sản phẩm khi có anh_mau. Gói chưa có thì tự hạ xuống nhanh.' },
          anh_mau: { type: 'array', items: { type: 'string' }, description: 'Chỉ mức dep: 1–4 link https ảnh thật của khách (từ CREWZY_KHO, ảnh khách gửi trong chat, ảnh website/fanpage đã lưu) để AI giữ đúng sản phẩm, căn nhà, khuôn mặt, phong cách.' },
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

// Video bằng credit của Crewzy (chỉ Trợ lý trong app, không đưa ra link MCP vì tốn tiền thật của Giang).
// Model bên thứ ba trên Cloudflare (env.AI.run + AI Gateway "default", trả bằng credit Unified Billing nạp trên dashboard):
// LTX-2.3 Fast 0,03 USD/giây 720p (mặc định) → dự phòng Grok Imagine Video 0,05 USD/giây 480p. Video tải về lưu /api/media.
export const VIDEO_TOOL = {
  type: 'function',
  function: {
    name: 'CREWZY_TAO_VIDEO',
    description: 'Tạo một video ngắn (6–10 giây, có âm thanh) từ mô tả, hoặc làm ảnh chuyển động từ link ảnh (ví dụ ảnh vừa tạo bằng CREWZY_TAO_ANH). Mất khoảng 1–3 phút. Viết mô tả bằng tiếng Anh: chủ thể, hành động, bối cảnh, góc máy, ánh sáng. Không yêu cầu chữ trong video. Trả về link video dùng để đăng Reels/TikTok/Facebook.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Mô tả video bằng tiếng Anh, 20–100 từ.' },
        kho: { type: 'string', enum: ['doc', 'ngang'], description: 'doc = 9:16 (Reels, TikTok, Shorts, mặc định), ngang = 16:9.' },
        giay: { type: 'number', enum: [5, 6, 8, 10], description: 'Độ dài, mặc định 6 giây (mức dep nên 5 giây).' },
        anh: { type: 'string', description: 'Link ảnh https làm khung hình đầu (không bắt buộc). Nên dùng ảnh thật của khách từ CREWZY_KHO.' },
        chat_luong: { type: 'string', enum: ['nhanh', 'dep'], description: 'nhanh = 17 credit/giây (LTX, mặc định). dep = 65 credit/giây, video như quay thật 720p (Seedance 2.0), dùng anh hoặc anh_mau. Gói chưa có thì tự hạ xuống nhanh.' },
        anh_mau: { type: 'array', items: { type: 'string' }, description: 'Chỉ mức dep, khi không có anh: 1–4 link ảnh thật (sản phẩm, nhân vật, bối cảnh) để video giữ đúng hình.' },
      },
      required: ['prompt'],
    },
  },
};
const VIDEO_USER_DAILY = 3;   // video/ngày mỗi khách
const VIDEO_APP_DAILY = 30;   // video/ngày cả app (chặn tiền chạy quá tay)

const pickUrl = (out, key) => {
  const r = (out && out.result) || out || {};
  if (typeof r[key] === 'string') return r[key];
  const arr = r[key + 's'];
  return Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : '';
};
const httpsList = (v, n) => (Array.isArray(v) ? v : v ? [v] : []).map(String).filter((u) => /^https:\/\//.test(u)).slice(0, n);

async function runVideoModel(env, { prompt, kho, giay, anh, dep, mau }) {
  const gateway = { gateway: { id: env.AI_GATEWAY_ID || 'default' } };
  const errors = [];
  // Mức Đẹp: Seedance 2.0 Fast 720p (0,12 USD/giây, có âm thanh). Ảnh đầu (anh) hoặc 1–4 ảnh mẫu (anh_mau), không dùng chung.
  if (dep) {
    try {
      const input = { prompt, duration: Math.min(12, Math.max(4, giay)), resolution: '720p', aspect_ratio: kho === 'ngang' ? '16:9' : '9:16', fps: 24, camera_fixed: false, watermark: false, generate_audio: true };
      if (anh) input.image = anh; else if (mau.length) input.reference_images = mau;
      const out = await env.AI.run('bytedance/seedance-2.0-fast', input, gateway);
      const url = pickUrl(out, 'video');
      if (url) return { url, model: 'seedance-2.0-fast' };
      errors.push('seedance: ' + JSON.stringify(out).slice(0, 200));
    } catch (e) { errors.push('seedance: ' + (e && e.message)); }
  }
  try {
    const input = { prompt, duration: giay, fps: 24, resolution: kho === 'ngang' ? '1280x720' : '720x1280', generate_audio: true };
    if (anh) input.image_uri = anh;
    const out = await env.AI.run('lightricks/ltx-2-3-fast', input, gateway);
    const url = out && (out.result && out.result.video || out.video);
    if (url) return { url, model: 'ltx-2-3-fast' };
    errors.push('ltx: ' + JSON.stringify(out).slice(0, 200));
  } catch (e) { errors.push('ltx: ' + (e && e.message)); }
  try {
    const input = { prompt, duration: giay, aspect_ratio: kho === 'ngang' ? '16:9' : '9:16', resolution: '480p' };
    if (anh) input.image = { url: anh };
    const out = await env.AI.run('xai/grok-imagine-video', input, gateway);
    const url = out && (out.result && out.result.video || out.video);
    if (url) return { url, model: 'grok-imagine-video' };
    errors.push('grok: ' + JSON.stringify(out).slice(0, 200));
  } catch (e) { errors.push('grok: ' + (e && e.message)); }
  const text = errors.join(' | ');
  console.error('video failed', text);
  if (/credit|balance|402|payment|billing|insufficient/i.test(text)) throw new Error('Máy chủ chưa nạp credit làm video (AI Gateway → Unified Billing trên Cloudflare).');
  throw new Error('Chưa tạo được video: ' + text.slice(0, 200));
}

export async function createVideo(env, uid, origin, args) {
  if (!env.AI) return { error: 'Máy chủ chưa bật Workers AI (binding AI).' };
  if (env.CREWZY_VIDEO === 'off') return { error: 'Tính năng làm video đang tắt.' };
  const prompt = String((args && args.prompt) || '').trim().slice(0, 2000);
  if (prompt.length < 5) return { error: 'Thiếu mô tả video.' };
  const giay = [6, 8, 10].includes(Number(args && args.giay)) ? Number(args.giay) : 6;
  const kho = args && args.kho === 'ngang' ? 'ngang' : 'doc';
  const anh = /^https:\/\//.test((args && args.anh) || '') ? args.anh : '';
  const dep = args && args.chat_luong === 'dep';
  const mau = httpsList(args && args.anh_mau, 4);
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const uKey = `vidcount:${day}:${uid}`;
  const aKey = `vidcount:${day}:all`;
  const [u, a] = await Promise.all([env.KV.get(uKey), env.KV.get(aKey)]);
  if (Number(u || 0) >= VIDEO_USER_DAILY) return { error: `Hôm nay đã làm đủ ${VIDEO_USER_DAILY} video, quay lại ngày mai.` };
  if (Number(a || 0) >= VIDEO_APP_DAILY) return { error: 'Hôm nay app đã hết lượt làm video, quay lại ngày mai.' };
  const { url, model } = await runVideoModel(env, { prompt, kho, giay, anh, dep, mau });
  const ttl = { expirationTtl: 2 * 86400 };
  await Promise.all([env.KV.put(uKey, String(Number(u || 0) + 1), ttl), env.KV.put(aKey, String(Number(a || 0) + 1), ttl)]);
  const saved = await rehostUrl(env, uid, origin, url).catch(() => null);
  const link = saved && saved.link || url;
  if (saved && !saved.goc) await addItem(env, uid, { url: link, kind: 'video', source: 'ai_tao', name: 'Video AI ' + giay + ' giây', note: prompt.slice(0, 300) });
  return {
    data: { url: link, giay, kho: kho === 'doc' ? 'dọc 9:16' : 'ngang 16:9', model, ghi_chu: 'Video lưu 90 ngày. Dùng link này để đăng Reels/TikTok/Facebook hoặc nộp vào phiếu việc.' },
    video: link,
  };
}

CREWZY_TOOL_DEFS.push(...LIBRARY_TOOL_DEFS);

// Link tải file lên cho AI chạy trên máy khách (Claude Code, Codex): video/ảnh vừa dựng bằng Remotion, HyperFrames, ffmpeg…
CREWZY_TOOL_DEFS.push({
  type: 'function',
  function: {
    name: 'CREWZY_TAI_LEN',
    description: 'Xin link tải 1 file (video, ảnh, âm thanh ≤ 95MB) từ máy của bạn lên Crewzy, dùng khi bạn là AI chạy trên máy (Claude Code, Codex) và vừa dựng/render file bằng Remotion, HyperFrames, ffmpeg… Trả put_url + lệnh curl; tải xong dùng link_sau_khi_tai để đăng bài hoặc nộp CREWZY_NOP_KET_QUA. Mỗi file xin 1 link.',
    parameters: { type: 'object', properties: { loai_file: { type: 'string', enum: ['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/mp4'], description: 'Loại file, ví dụ video/mp4.' } }, required: ['loai_file'] },
  },
});

// Quy trình chuẩn (src/lib/workflows.js): AI lấy đúng các bước + kiểm tra app thiếu trước khi chạy.
CREWZY_TOOL_DEFS.push({
  type: 'function',
  function: {
    name: 'CREWZY_QUY_TRINH',
    description: 'Thư viện quy trình chuẩn của Crewzy (thương hiệu, nghiên cứu đối thủ, nội dung & video, quảng cáo, bán hàng, chăm sóc khách, báo cáo & chiến lược, việc hằng ngày). Không truyền id → danh sách quy trình kèm app còn thiếu. Truyền id → các bước chi tiết, quy tắc bắt buộc và app thiếu. LUÔN gọi trước khi chạy một quy trình và làm đúng thứ tự các bước.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'Mã quy trình, ví dụ lich_noi_dung_tuan, doi_thu_reels, bao_cao_tuan.' } } },
  },
});

function mcpHint(groups) {
  const ids = [...new Set(groups.filter((g) => !g.dat).flatMap((g) => g.goi_y_mcp || []))].map(mcpById).filter((m) => m && !m.ngoai);
  return ids.length ? ' (' + ids.map((m) => `${m.name}: ${m.url}`).join(', ') + ')' : '';
}
// surface 'mcp' = AI ngoài qua link nối AI: viết lại câu nhắc công cụ chỉ có trong Trợ lý AI của app (forMcp, san_co_mcp).
async function workflowTool(env, uid, args, connected, surface, instant) {
  const mcp = surface === 'mcp';
  const tx = (t) => (mcp ? forMcp(t) : t);
  const groupsOut = (gs) => gs.map(({ san_co_mcp, ...g }) => (mcp && san_co_mcp ? { ...g, san_co: san_co_mcp } : g));
  const servers = (await listServers(env, uid).catch(() => [])).filter((x) => !x.off);
  const urls = servers.map((x) => x.url);
  const depName = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.name]));
  const id = args && args.id;
  const [brand, jobs] = await Promise.all([getBrand(env, uid).catch(() => null), listJobs(env, uid).catch(() => [])]);
  const ctx = { connected, mcpUrls: urls, brand, done: doneFlows(jobs), instant };
  const short = (r) => r.thieu_du_lieu.map((x) => x.ten + ' → ' + x.cach);
  if (!id) {
    return { data: { quy_trinh: WORKFLOWS.map((w) => {
      const r = readiness(w, ctx);
      // Gọn: danh sách đầy đủ từng vượt 12.000 ký tự (chat cắt kết quả) → chỉ tên, mô tả ngắn, thiếu gì; cách bổ sung xem khi gọi kèm id.
      const thieu = [...r.thieu_nhom, ...r.thieu_du_lieu.map((x) => (x.ten.length > 80 ? x.ten.slice(0, 77) + '…' : x.ten))];
      const mo = tx(w.mo_ta);
      return { id: w.id, phong: depName[w.phong], ten: w.ten, mo_ta: mo.length > 110 ? mo.slice(0, 107) + '…' : mo, san_sang: r.san_sang, thieu: thieu.length ? thieu : undefined };
    }), ghi_chu: 'Gọi lại với id để lấy các bước chi tiết, app/dữ liệu còn thiếu và cách bổ sung. Khách mới: bắt đầu bằng brain_tu_website.' } };
  }
  const w = workflowById(id);
  if (!w) return { error: 'Không có quy trình ' + id + '. Gọi CREWZY_QUY_TRINH không kèm id để xem danh sách.' };
  const r = readiness(w, ctx);
  const miss = { nhom: r.thieu_nhom, groups: r.groups };
  const mcpIds = Object.keys(MCP_HOSTS).filter((k) => urls.some((u) => u.includes(MCP_HOSTS[k])));
  return { data: {
    doc_truoc: 'BƯỚC 0: đọc kỹ thuong_hieu dưới đây (và mở các link mẫu tham khảo) trước khi làm bất cứ bước nào.',
    thuong_hieu: brandPack(brand, !!w.media),
    dinh_dang_kenh: formatsFor(connected, mcpIds),
    id: w.id, phong: depName[w.phong], ten: w.ten, mo_ta: tx(w.mo_ta), can_hoi_khach: w.hoi || undefined,
    kenh: w.kenh, loai_ket_qua: w.loai,
    cong_cu: groupsOut(miss.groups), thieu_nhom: miss.nhom, san_sang: r.san_sang,
    thieu_du_lieu: r.thieu_du_lieu.length ? short(r) : undefined,
    nen_co: r.nen_co.length ? r.nen_co.map((x) => x.ten + ' → ' + x.cach) : undefined,
    luu_y_du_lieu: r.thieu_du_lieu.length ? 'Chưa đủ dữ liệu để ra kết quả thật. Báo khách mục còn thiếu và cách bổ sung (hoặc chạy quy trình cần chạy trước), KHÔNG tự bịa nội dung thay cho dữ liệu thiếu.' : undefined,
    cac_buoc: w.buoc.map((b, i) => `${i + 1}. ${tx(b)}`),
    quy_tac: WORKFLOW_RULES,
    huong_dan_noi: miss.nhom.length
      ? 'Còn thiếu: ' + miss.nhom.join(', ') + '. Khách nối MỘT app bất kỳ trong goi_y của nhóm đó ở Crewzy → Kết nối → Ứng dụng (app dùng khoá API như vidIQ, Apify, Firecrawl, Semrush: Composio mở trang để dán khoá). MCP ngoài' + mcpHint(miss.groups) + ': Kết nối → MCP khác (máy chủ nối ở đó dùng được ngay trong link nối AI).'
      : undefined,
    ghi_chu_cong_cu: 'Công cụ của app tìm bằng COMPOSIO_SEARCH_TOOLS (vd "post to pinterest", "add contact pipedrive", "apify run actor") rồi chạy bằng COMPOSIO_MULTI_EXECUTE_TOOL; công cụ MCP ngoài có tiền tố m…_.',
  } };
}

// Đọc website công khai (src/lib/webRead.js): bước Dựng Brain và So sánh đối thủ không cần nối app đọc web.
CREWZY_TOOL_DEFS.push({
  type: 'function',
  function: {
    name: 'CREWZY_DOC_WEB',
    description: 'Đọc một trang web công khai (website của khách hoặc đối thủ): trả tiêu đề, mô tả, các mục, chữ chính (tối đa 12.000 ký tự) và lien_ket = các trang con cùng website để đọc tiếp (sản phẩm, bảng giá, giới thiệu). Không đọc được trang cần đăng nhập (Facebook, Instagram, TikTok).',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Link trang web, ví dụ https://tenmien.vn hoặc một trang con.' } }, required: ['url'] },
  },
});

// Cho AI nhìn ảnh (website, fanpage, kho): ảnh được lưu sang R2 của Crewzy trước (link chắc chắn mở được) rồi gửi cho AI dạng ảnh.
CREWZY_TOOL_DEFS.push({
  type: 'function',
  function: {
    name: 'CREWZY_XEM_ANH',
    description: 'Nhìn 1–4 ảnh (link https: ảnh trên website trong trường anh của CREWZY_DOC_WEB, ảnh fanpage, ảnh trong Kho) để mô tả, chọn ảnh đẹp nhất, viết caption đúng với ảnh, hoặc lên ý tưởng ảnh/video theo phong cách đó. Trả lại link đã lưu ở Crewzy để dùng tiếp.',
    parameters: { type: 'object', properties: { links: { type: 'array', items: { type: 'string' }, description: '1–4 link ảnh https.' } }, required: ['links'] },
  },
});

async function viewImages(env, uid, origin, args) {
  const links = httpsList(args && args.links, 4);
  if (!links.length) return { error: 'Thiếu link ảnh https.' };
  const ok = [];
  for (const u of links) {
    const ours = u.startsWith(origin + '/api/');
    const r = ours ? { kind: 'image', link: u } : await rehostUrl(env, uid, origin, u).catch(() => null);
    if (r && r.kind === 'image' && !r.goc) ok.push(r.link);
  }
  if (!ok.length) return { error: 'Không mở được ảnh nào (trang chặn tải, không phải ảnh, hoặc ảnh quá lớn).' };
  return { data: { da_xem: ok.length, links: ok, ghi_chu: 'Các ảnh ở ngay sau đây. Muốn giữ lâu thì lưu vào Kho bằng CREWZY_LUU_KHO.' }, xem_anh: ok };
}

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

const DEP_RATIO = { vuong: '1:1', doc: '3:4', story: '9:16', ngang: '16:9' };
// Ảnh Đẹp: Seedream 4.5 (ByteDance, 0,04 USD/ảnh, 2K, nhận tới nhiều ảnh mẫu) qua AI Gateway (Unified Billing, Giang nạp trên Cloudflare).
async function createImageDep(env, uid, origin, prompt, kho, mau) {
  const input = { prompt, size: '2K', aspect_ratio: mau.length && !DEP_RATIO[kho] ? 'match_input_image' : DEP_RATIO[kho] || '3:4' };
  if (mau.length) input.image_input = mau;
  let out;
  try {
    out = await env.AI.run('bytedance/seedream-4.5', input, { gateway: { id: env.AI_GATEWAY_ID || 'default' } });
  } catch (e) {
    const msg = String(e && e.message);
    if (/credit|balance|402|payment|billing|insufficient/i.test(msg)) throw new Error('Máy chủ chưa nạp credit cho ảnh Đẹp (Cloudflare → AI Gateway → Unified Billing). Tạm dùng chat_luong nhanh.');
    throw e;
  }
  const url = pickUrl(out, 'image');
  if (!url) throw new Error('Mô hình ảnh Đẹp không trả về ảnh: ' + JSON.stringify(out).slice(0, 160));
  const saved = await rehostUrl(env, uid, origin, url).catch(() => null);
  const link = saved && !saved.goc ? saved.link : url;
  await addItem(env, uid, { url: link, kind: 'image', source: 'ai_tao', name: 'Ảnh AI (Đẹp)', note: prompt.slice(0, 300) });
  return { data: { url: link, chat_luong: 'Đẹp 2K (Seedream 4.5)', da_dung_anh_mau: mau.length, ghi_chu: 'Ảnh đã lưu vào Kho. Hiện ảnh cho khách bằng ![ảnh](link) và dùng link này để đăng.' }, image: link };
}

export async function createImage(env, uid, origin, args) {
  if (!env.AI) return { error: 'Máy chủ chưa bật Workers AI (binding AI).' };
  const prompt = String((args && args.prompt) || '').trim().slice(0, 2000);
  if (prompt.length < 5) return { error: 'Thiếu mô tả ảnh.' };
  if (args && args.chat_luong === 'dep') return await createImageDep(env, uid, origin, prompt, args.kho, httpsList(args.anh_mau, 4));
  const size = SIZES[args && args.kho] || SIZES.doc;
  const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const capKey = `imgcount:${day}:${uid}`;
  const used = Number((await env.KV.get(capKey)) || 0);
  if (used >= DAILY_IMAGE_CAP) return { error: `Hôm nay đã tạo đủ ${DAILY_IMAGE_CAP} ảnh, quay lại ngày mai.` };
  const { bytes, model } = await runImageModel(env, prompt, size);
  // Có R2: lưu lâu dài (ảnh nằm trong Kho của khách); chưa có R2 thì KV 90 ngày như cũ.
  let url;
  if (env.MEDIA) url = await putMedia(env, uid, origin, bytes, 'image/jpeg', 'ai:' + model);
  else {
    const id = newId();
    await env.KV.put('img:' + id, bytes, { expirationTtl: IMAGE_TTL, metadata: { ct: 'image/jpeg', uid, model } });
    url = `${origin}/api/img/${id}.jpg`;
  }
  await env.KV.put(capKey, String(used + 1), { expirationTtl: 2 * 86400 });
  await addItem(env, uid, { url, kind: 'image', source: 'ai_tao', size: bytes.length, name: 'Ảnh AI', note: prompt.slice(0, 300) });
  return { data: { url, kho: size.label, ghi_chu: 'Ảnh đã lưu vào Kho. Dùng link này để đăng bài hoặc tải lên Canva/Drive. Hiện ảnh cho khách bằng cú pháp ![ảnh](link).' }, image: url };
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
  const pack = brandPack(brand, true);
  return { data: { brain: text || 'Chưa điền Brain thương hiệu. Hỏi người dùng thông tin cần thiết, không tự bịa.', mau_tham_khao: pack.mau_tham_khao, giong_doc: pack.giong_doc, nhac: pack.nhac, con_thieu: pack.thieu, app_da_ket_noi: connectedNames || [] } };
}

export async function runCrewzyTool(env, { uid, origin, name, args, connectedNames, connected, agent, surface, instant }) {
  try {
    if (name === 'CREWZY_TAO_ANH') return await createImage(env, uid, origin, args);
    if (name === 'CREWZY_BRAIN') return await readBrain(env, uid, connectedNames);
    if (name === 'CREWZY_TAO_VIDEO') return await createVideo(env, uid, origin, args);
    if (name === 'CREWZY_QUY_TRINH') return await workflowTool(env, uid, args, connected || [], surface, !!instant);
    if (name === 'CREWZY_VIEC_CAN_LAM') return await jobsForAi(env, uid, args && args.tat_ca, agent, args && args.id);
    if (name === 'CREWZY_NOP_KET_QUA') return await submitResult(env, uid, origin, args);
    if (name === 'CREWZY_DOC_WEB') return await readWebsite(args && args.url);
    if (name === 'CREWZY_XEM_ANH') return await viewImages(env, uid, origin, args);
    if (name === 'CREWZY_KHO' || name === 'CREWZY_LUU_KHO') return await libraryTool(env, uid, origin, name, args || {});
    if (name === 'CREWZY_TAI_LEN') return await createPutLink(env, origin, uid, args && args.loai_file);
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
