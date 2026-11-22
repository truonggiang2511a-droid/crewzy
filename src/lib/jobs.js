// Phiếu việc: cầu nối hai chiều giữa Crewzy và AI của khách (Claude Code, Codex, Claude, ChatGPT, Gemini, Grok hoặc Trợ lý trong app).
//   Crewzy/khách giao việc (trang Việc chờ duyệt → Giao việc) → AI nhận bằng CREWZY_VIEC_CAN_LAM
//   → AI làm bằng app đã kết nối + skill của nó → nộp bằng CREWZY_NOP_KET_QUA → khách duyệt → AI (hoặc Trợ lý) đăng → cập nhật "đã đăng".
// KV `jobs:<uid>` = mảng phiếu (mới nhất trước, tối đa 150). Chưa chống ghi đè khi 2 nơi ghi cùng lúc (đủ cho giai đoạn thử).
import { kvGetJson, kvPutJson } from './common.js';
import { rehostUrl } from './media.js';
import { getBrand, putBrand, cleanBrand, BRAND_FIELDS } from './brand.js';
import { WORKFLOWS, workflowById, workflowPrompt } from './workflows.js';

export const STATUSES = {
  cho_lam: 'Chờ AI làm',
  dang_lam: 'AI đang làm',
  cho_duyet: 'Chờ bạn duyệt',
  da_duyet: 'Đã duyệt, chờ đăng',
  da_dang: 'Đã đăng',
  xong: 'Xong',
  tu_choi: 'Đã từ chối',
};
export const KINDS = { bai_dang: 'Bài đăng', bao_cao: 'Báo cáo', noi_dung: 'Nội dung', cham_soc: 'Chăm sóc khách', brain: 'Brain thương hiệu', khac: 'Việc khác' };
const MAX_JOBS = 150;
const key = (uid) => 'jobs:' + uid;

export const listJobs = async (env, uid) => (await kvGetJson(env, key(uid))) || [];
const saveJobs = (env, uid, jobs) => kvPutJson(env, key(uid), jobs.slice(0, MAX_JOBS));
const now = () => new Date().toISOString();
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
function newId() { return 'v' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (x) => x.toString(16).padStart(2, '0')).join(''); }

function cleanList(v, n, len) {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.map((x) => clip(typeof x === 'string' ? x : JSON.stringify(x), len)).filter(Boolean).slice(0, n);
}

export async function createJob(env, uid, { tieu_de, yeu_cau, loai, nguon, quy_trinh }) {
  const jobs = await listJobs(env, uid);
  const w = workflowById(quy_trinh);
  const job = {
    id: newId(), tieu_de: clip(tieu_de, 120) || (w ? w.ten : 'Việc mới'), yeu_cau: clip(yeu_cau || (w ? workflowPrompt(w) : ''), 4000),
    loai: KINDS[loai] ? loai : w ? w.loai : 'khac', quy_trinh: w ? w.id : undefined,
    trang_thai: 'cho_lam', ket_qua: null, nguoi_lam: '', nguon: clip(nguon || 'khach', 40),
    tao_luc: now(), cap_nhat: now(), lich_su: [{ luc: now(), viec: 'Tạo phiếu việc' }],
  };
  jobs.unshift(job);
  await saveJobs(env, uid, jobs);
  return job;
}

// Khách thao tác trên trang: duyệt, từ chối, sửa nội dung, xoá.
export async function updateJobByOwner(env, uid, id, { action, noi_dung, ghi_chu }) {
  const jobs = await listJobs(env, uid);
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return { error: 'Không tìm thấy phiếu việc.' };
  if (action === 'xoa') { jobs.splice(i, 1); await saveJobs(env, uid, jobs); return { ok: true }; }
  const j = jobs[i];
  const map = { duyet: 'da_duyet', tu_choi: 'tu_choi', lam_lai: 'cho_lam', xong: 'xong', da_dang: 'da_dang' };
  if (action === 'duyet' && j.loai === 'brain' && j.ket_qua && j.ket_qua.brain) {
    // Duyệt Brain thương hiệu AI đề xuất → lưu luôn (chỉ ghi đè mục AI có điền, giữ mục khách đã có).
    const current = (await getBrand(env, uid)) || {};
    await putBrand(env, uid, { ...current, ...cleanBrand(j.ket_qua.brain) });
  }
  if (action === 'sua' && j.ket_qua) j.ket_qua.noi_dung = clip(noi_dung, 20000);
  else if (map[action]) j.trang_thai = map[action];
  else return { error: 'Thao tác không hợp lệ.' };
  if (ghi_chu) j.ghi_chu_khach = clip(ghi_chu, 1000);
  j.cap_nhat = now();
  j.lich_su = [...(j.lich_su || []), { luc: now(), viec: action === 'sua' ? 'Bạn sửa nội dung' : 'Bạn chuyển sang: ' + STATUSES[j.trang_thai] + (ghi_chu ? ' — ' + clip(ghi_chu, 200) : '') }].slice(-20);
  await saveJobs(env, uid, jobs);
  return { job: j };
}

// ---------- Công cụ cho AI ----------
export const JOB_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'CREWZY_VIEC_CAN_LAM',
      description: 'Xem các phiếu việc Crewzy đang giao: việc "cho_lam" (cần làm), "da_duyet" (khách đã duyệt, cần đăng/gửi rồi báo lại), và việc bị yêu cầu làm lại kèm ghi chú của khách. Gọi đầu tiên khi người dùng bảo "làm việc Crewzy" hoặc "làm các việc được giao".',
      parameters: { type: 'object', properties: { tat_ca: { type: 'boolean', description: 'true để xem cả việc đã xong (mặc định chỉ việc cần làm).' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'CREWZY_NOP_KET_QUA',
      description: 'Nộp kết quả công việc về Crewzy để khách xem, duyệt, đăng và làm báo cáo. Dùng sau khi làm xong một việc (bài đăng, kịch bản, báo cáo, danh sách khách, ảnh/video…), kể cả việc người dùng giao trực tiếp không có phiếu (bỏ trống id → tạo phiếu mới). Khi đã đăng/gửi xong một việc đã duyệt: gọi lại với id, trang_thai "da_dang" và lien_ket là link bài đăng.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Mã phiếu việc (lấy từ CREWZY_VIEC_CAN_LAM). Bỏ trống nếu là việc mới.' },
          tieu_de: { type: 'string', description: 'Tiêu đề ngắn, ví dụ "7 bài Facebook tuần 48".' },
          loai: { type: 'string', enum: Object.keys(KINDS), description: 'bai_dang, bao_cao, noi_dung, cham_soc, khac.' },
          noi_dung: { type: 'string', description: 'Nội dung đầy đủ (markdown): bài viết, báo cáo, bảng số liệu tóm tắt…' },
          media: { type: 'array', items: { type: 'string' }, description: 'Link ảnh/video dùng cho việc này (Crewzy tự lưu lại link cố định).' },
          kenh: { type: 'array', items: { type: 'string' }, description: 'Kênh định đăng/gửi, ví dụ ["Facebook: Trang ABC", "Instagram"].' },
          lien_ket: { type: 'array', items: { type: 'string' }, description: 'Link liên quan: bài đã đăng, Google Sheet/Docs, thiết kế Canva…' },
          trang_thai: { type: 'string', enum: ['cho_duyet', 'da_dang', 'xong'], description: 'cho_duyet (mặc định, chờ khách duyệt), da_dang (đã đăng/gửi xong), xong (việc nội bộ không cần duyệt).' },
          nguoi_lam: { type: 'string', description: 'Tên AI đang làm, ví dụ "Claude Code", "Codex", "ChatGPT".' },
          quy_trinh: { type: 'string', description: 'Mã quy trình Crewzy đang chạy (lấy từ CREWZY_QUY_TRINH), nếu có.' },
          brain: { type: 'object', description: 'Chỉ dùng với loai "brain": các mục Brain đề xuất (name, industry, products, customers, voice, dos, donts, offers, faq, links, hashtags). Khách duyệt là Crewzy lưu.', properties: Object.fromEntries(Object.keys(BRAND_FIELDS).map((k) => [k, { type: 'string' }])) },
          ghi_chu: { type: 'string', description: 'Ghi chú cho khách (điều cần kiểm tra, số liệu còn thiếu…).' },
        },
        required: ['tieu_de', 'noi_dung'],
      },
    },
  },
];

export async function jobsForAi(env, uid, all) {
  const jobs = await listJobs(env, uid);
  const want = all ? jobs.slice(0, 30) : jobs.filter((j) => ['cho_lam', 'dang_lam', 'da_duyet'].includes(j.trang_thai));
  return {
    data: {
      viec: want.map((j) => ({
        id: j.id, tieu_de: j.tieu_de, loai: j.loai, quy_trinh: j.quy_trinh || undefined, trang_thai: j.trang_thai, mo_ta_trang_thai: STATUSES[j.trang_thai],
        yeu_cau: j.yeu_cau, ghi_chu_cua_khach: j.ghi_chu_khach || undefined,
        ket_qua_da_nop: j.trang_thai === 'da_duyet' && j.ket_qua ? j.ket_qua : undefined,
      })),
      huong_dan: want.length
        ? 'Việc cho_lam: làm rồi nộp bằng CREWZY_NOP_KET_QUA (kèm id). Việc da_duyet: đăng/gửi đúng nội dung đã duyệt rồi nộp lại với trang_thai da_dang và link bài.'
        : 'Hiện không có việc nào cần làm.',
    },
  };
}

export async function submitResult(env, uid, origin, args) {
  const a = args || {};
  const jobs = await listJobs(env, uid);
  let job = a.id ? jobs.find((j) => j.id === a.id) : null;
  if (a.id && !job) return { error: 'Không có phiếu việc ' + a.id + '. Bỏ trống id để tạo phiếu mới.' };
  if (!job) {
    job = { id: newId(), tieu_de: '', yeu_cau: '', loai: 'khac', trang_thai: 'cho_lam', nguon: 'ai', tao_luc: now(), lich_su: [] };
    jobs.unshift(job);
  }
  // Lưu lại ảnh/video ở link cố định của Crewzy (link nhà cung cấp hay hết hạn).
  const media = [];
  for (const link of cleanList(a.media, 8, 1000)) {
    if (link.startsWith(origin + '/api/')) { media.push({ loai: /\.(mp4|webm|mov)$/i.test(link) ? 'video' : 'image', link }); continue; }
    const item = /^https:\/\//.test(link) ? await rehostUrl(env, uid, origin, link).catch(() => null) : null;
    media.push(item ? { loai: item.kind, link: item.link } : { loai: 'link', link });
  }
  const status = ['cho_duyet', 'da_dang', 'xong'].includes(a.trang_thai) ? a.trang_thai : 'cho_duyet';
  const prev = job.ket_qua || {};
  job.tieu_de = clip(a.tieu_de, 120) || job.tieu_de || 'Kết quả';
  if (KINDS[a.loai]) job.loai = a.loai;
  if (a.quy_trinh && workflowById(a.quy_trinh)) job.quy_trinh = a.quy_trinh;
  job.ket_qua = {
    noi_dung: a.noi_dung ? clip(a.noi_dung, 20000) : prev.noi_dung || '',
    media: media.length ? media : prev.media || [],
    kenh: a.kenh ? cleanList(a.kenh, 10, 120) : prev.kenh || [],
    lien_ket: [...new Set([...(prev.lien_ket || []), ...cleanList(a.lien_ket, 10, 1000)])].slice(0, 15),
    ghi_chu: a.ghi_chu ? clip(a.ghi_chu, 2000) : prev.ghi_chu || '',
    brain: a.brain && typeof a.brain === 'object' ? cleanBrand(a.brain) : prev.brain,
  };
  job.trang_thai = status;
  job.nguoi_lam = clip(a.nguoi_lam, 40) || job.nguoi_lam || 'AI';
  job.cap_nhat = now();
  job.lich_su = [...(job.lich_su || []), { luc: now(), viec: `${job.nguoi_lam} nộp kết quả → ${STATUSES[status]}` }].slice(-20);
  await saveJobs(env, uid, jobs);
  return {
    data: { id: job.id, trang_thai: status, xem_tai: `${origin}/cho-duyet.html?id=${job.id}`, media: job.ket_qua.media },
    images: job.ket_qua.media.filter((m) => m.loai === 'image' || m.loai === 'video'),
  };
}

// Câu lệnh mẫu dạng MCP prompts: hiện thành lệnh gạch chéo trong Claude Code (/mcp__crewzy__…) và mục Prompts ở các AI khác.
export const MCP_PROMPTS = [
  { name: 'lam_viec_crewzy', title: 'Làm các việc Crewzy giao', description: 'Nhận phiếu việc từ Crewzy, làm bằng app đã kết nối, nộp kết quả để khách duyệt.',
    text: 'Gọi CREWZY_VIEC_CAN_LAM. Với từng việc cần làm: đọc Brain thương hiệu (CREWZY_BRAIN), làm bằng các app đã kết nối và skill bạn có, rồi nộp bằng CREWZY_NOP_KET_QUA kèm id. Với việc đã duyệt: đăng/gửi đúng nội dung đã duyệt rồi nộp lại trạng thái da_dang kèm link. Cuối cùng tóm tắt cho tôi đã làm những gì.' },
  { name: 'len_lich_tuan', title: 'Lên 7 bài cho tuần', description: 'Kế hoạch 7 bài đăng theo Brain thương hiệu, nộp về Crewzy chờ duyệt.',
    text: 'Đọc Brain thương hiệu (CREWZY_BRAIN), lên 7 bài Facebook cho tuần này, mỗi bài một góc khác nhau (lợi ích, câu hỏi khách hay hỏi, hậu trường, ưu đãi, cảm nhận khách). Viết đầy đủ từng bài, rồi nộp về Crewzy bằng CREWZY_NOP_KET_QUA (loai bai_dang) để tôi duyệt. Chưa đăng.' },
  { name: 'bao_cao_tuan', title: 'Báo cáo tuần', description: 'Tổng hợp số liệu quảng cáo và kênh đã kết nối, nộp báo cáo về Crewzy.',
    text: 'Đọc số liệu 7 ngày qua từ các app đã kết nối (quảng cáo Meta/Google, Google Analytics, Fanpage, Sheet bán hàng nếu có). Viết báo cáo: số chính, so với tuần trước, điều tốt, điều cần sửa, 3 việc tuần tới. Nộp về Crewzy bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong).' },
  { name: 'tra_loi_binh_luan', title: 'Soạn trả lời bình luận', description: 'Đọc bình luận mới trên Fanpage, soạn câu trả lời theo giọng thương hiệu, nộp chờ duyệt.',
    text: 'Đọc 20 bình luận mới nhất trên các bài gần đây của Fanpage, soạn câu trả lời cho từng bình luận theo Brain thương hiệu (không đưa số điện thoại khách lên công khai). Nộp danh sách về Crewzy bằng CREWZY_NOP_KET_QUA (loai cham_soc) để tôi duyệt trước khi trả lời.' },
  { name: 'video_quang_cao', title: 'Video quảng cáo ngắn', description: 'Làm video dọc 9:16 bằng app tạo video đã nối (OpenArt…), nộp video + caption về Crewzy.',
    text: 'Dùng app tạo video đã kết nối (ví dụ OpenArt) làm 1 video dọc 9:16 khoảng 15 giây giới thiệu sản phẩm chính theo Brain thương hiệu. Chờ tới khi video xong, viết caption kèm lời mời nhắn tin, rồi nộp về Crewzy bằng CREWZY_NOP_KET_QUA với link video trong media.' },
];

// Mỗi quy trình chuẩn cũng là một lệnh nhanh: Claude Code gõ /mcp__crewzy__qt_<mã>.
for (const w of WORKFLOWS) {
  MCP_PROMPTS.push({ name: 'qt_' + w.id, title: w.ten, description: w.mo_ta.slice(0, 200), text: workflowPrompt(w) });
}
