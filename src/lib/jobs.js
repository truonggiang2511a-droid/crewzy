// Phiếu việc: cầu nối hai chiều giữa Crewzy và AI của khách (Claude Code, Codex, Claude, ChatGPT, Gemini, Grok hoặc Trợ lý trong app).
//   Crewzy/khách giao việc (trang Việc chờ duyệt → Giao việc) → AI nhận bằng CREWZY_VIEC_CAN_LAM
//   → AI làm bằng app đã kết nối + skill của nó → nộp bằng CREWZY_NOP_KET_QUA → khách duyệt → AI (hoặc Trợ lý) đăng → cập nhật "đã đăng".
// KV `jobs:<uid>` = mảng phiếu (mới nhất trước, tối đa 150). Chưa chống ghi đè khi 2 nơi ghi cùng lúc (đủ cho giai đoạn thử).
import { addMem } from './memory.js';
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
// Nút ▶ Run trên Cây vận hành (src/lib/runner.js): tạo nhiều phiếu trong 1 lượt ghi KV; dừng giữa chừng → đóng các phiếu chưa làm.
export async function createJobs(env, uid, items) {
  const jobs = await listJobs(env, uid);
  const made = items.map((it) => {
    const w = workflowById(it.quy_trinh);
    return { id: newId(), tieu_de: clip(it.tieu_de, 120) || (w ? w.ten : 'Việc mới'), yeu_cau: clip(it.yeu_cau || (w ? workflowPrompt(w) : ''), 4000),
      loai: w ? w.loai : 'khac', quy_trinh: w ? w.id : undefined, trang_thai: 'cho_lam', ket_qua: null, nguoi_lam: '', nguon: clip(it.nguon || 'run', 40),
      ...(it.run ? { run: String(it.run).slice(0, 20) } : {}), tao_luc: now(), cap_nhat: now(), lich_su: [{ luc: now(), viec: 'Tạo phiếu việc (bấm Run)' }] };
  });
  jobs.unshift(...made.slice().reverse());
  await saveJobs(env, uid, jobs);
  return made;
}
export async function closeJobs(env, uid, ids, note) {
  const jobs = await listJobs(env, uid);
  let n = 0;
  for (const j of jobs) if (ids.includes(j.id) && ['cho_lam', 'dang_lam'].includes(j.trang_thai)) {
    j.trang_thai = 'xong'; j.cap_nhat = now(); j.ket_qua = { ...(j.ket_qua || {}), ghi_chu: clip(note, 300) };
    j.lich_su = [...(j.lich_su || []), { luc: now(), viec: clip(note, 80) }].slice(-20); n++;
  }
  if (n) await saveJobs(env, uid, jobs);
  return n;
}

export async function updateJobByOwner(env, uid, id, { action, noi_dung, ghi_chu, media }) {
  const jobs = await listJobs(env, uid);
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return { error: 'Không tìm thấy phiếu việc.' };
  if (action === 'xoa') { jobs.splice(i, 1); await saveJobs(env, uid, jobs); return { ok: true }; }
  const j = jobs[i];
  const map = { duyet: 'da_duyet', tu_choi: 'tu_choi', lam_lai: 'cho_lam', xong: 'xong', da_dang: 'da_dang' };
  if (action === 'duyet' && j.loai === 'brain' && j.ket_qua && j.ket_qua.brain) {
    // Duyệt Brain thương hiệu AI đề xuất → lưu luôn (chỉ ghi đè mục AI có điền, giữ mục khách đã có).
    const current = (await getBrand(env, uid)) || {};
    await putBrand(env, uid, { ...current, ...cleanBrand(j.ket_qua.brain, current) });
  }
  if (action === 'sua' && j.ket_qua) j.ket_qua.noi_dung = clip(noi_dung, 20000);
  else if (action === 'thay_media') {
    // Khách tự sửa ảnh/video trong app khác (Canva, Higgsfield, Descript…) rồi dán link bản đã sửa / chọn từ Kho.
    const links = (Array.isArray(media) ? media : [media]).map((x) => String(x || '').trim()).filter((x) => /^https:\/\/\S{8,1000}$/.test(x)).slice(0, 8);
    if (!links.length) return { error: 'Dán link https của ảnh/video đã sửa.' };
    j.ket_qua = j.ket_qua || {};
    j.ket_qua.media = links.map((link) => ({ loai: /\.(mp4|webm|mov)(\?|$)/i.test(link) ? 'video' : /\.(jpe?g|png|webp|gif)(\?|$)/i.test(link) || /\/api\/(img|media)\//.test(link) ? 'image' : 'link', link }));
  }
  else if (map[action]) j.trang_thai = map[action];
  else return { error: 'Thao tác không hợp lệ.' };
  if (ghi_chu) j.ghi_chu_khach = clip(ghi_chu, 1000);
  // Học khách: góp ý lúc "Yêu cầu làm lại" / "Từ chối" lưu vào Bộ nhớ để lần sau mọi AI làm đúng ý ngay từ đầu.
  if (ghi_chu && (action === 'lam_lai' || action === 'tu_choi')) {
    await addMem(env, uid, { loai: 'gop_y', noi_dung: `${action === 'tu_choi' ? 'Khách từ chối' : 'Khách yêu cầu sửa'} "${clip(j.tieu_de, 60)}": ${clip(ghi_chu, 300)}`, nguon: 'Duyệt bài' }).catch(() => null);
  }
  j.cap_nhat = now();
  j.lich_su = [...(j.lich_su || []), { luc: now(), viec: action === 'sua' ? 'Bạn sửa nội dung' : action === 'thay_media' ? 'Bạn thay ảnh/video bằng bản tự sửa' : 'Bạn chuyển sang: ' + STATUSES[j.trang_thai] + (ghi_chu ? ' — ' + clip(ghi_chu, 200) : '') }].slice(-20);
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
      parameters: { type: 'object', properties: {
        tat_ca: { type: 'boolean', description: 'true để xem cả việc đã xong, 30 phiếu gần nhất (mặc định chỉ việc cần làm).' },
        id: { type: 'string', description: 'Mã một phiếu: trả đủ nội dung đã nộp (bài, báo cáo, Sổ tay phong cách…) để dùng kết quả quy trình trước. Chỉ đọc, không nhận việc.' },
      } },
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
          prompt_da_dung: { type: 'string', description: 'Prompt đã gửi app làm ảnh/video (theo CREWZY_PROMPT_PRO), để khách xem và yêu cầu làm lại đúng ý.' },
          app_da_dung: { type: 'string', description: 'App đã làm ảnh/video: Higgsfield, HeyGen, Canva, Ảnh AI Crewzy…' },
          gio_dang: { type: 'string', description: 'Giờ hẹn đăng (bài đăng): ISO có múi giờ, vd "2026-11-24T19:00:00+07:00", hoặc "19:00" (hôm nay giờ Việt Nam, đã qua thì ngày mai). Khách duyệt xong Crewzy tự đăng đúng giờ.' },
        },
        required: ['tieu_de', 'noi_dung'],
      },
    },
  },
];

// AI nhận việc → "AI đang làm" (Văn phòng hiện đúng phòng đang làm). Quá 3 giờ chưa nộp thì /api/office coi như chưa làm.
export async function markWorking(env, uid, id, who) {
  const jobs = await listJobs(env, uid);
  const j = jobs.find((x) => x.id === id);
  if (!j || j.trang_thai !== 'cho_lam') return;
  j.trang_thai = 'dang_lam'; j.nhan_luc = now(); j.cap_nhat = now(); j.nguoi_lam = clip(who, 40) || j.nguoi_lam || 'AI';
  j.lich_su = [...(j.lich_su || []), { luc: now(), viec: `${j.nguoi_lam} nhận việc` }].slice(-20);
  await saveJobs(env, uid, jobs);
}

export async function jobsForAi(env, uid, all, who, id) {
  const jobs = await listJobs(env, uid);
  if (id) {
    const j = jobs.find((x) => x.id === id);
    if (!j) return { error: 'Không có phiếu việc ' + id + '. Gọi CREWZY_VIEC_CAN_LAM với tat_ca để xem mã các phiếu.' };
    return { data: { viec: [{
      id: j.id, tieu_de: j.tieu_de, loai: j.loai, quy_trinh: j.quy_trinh || undefined, trang_thai: j.trang_thai, mo_ta_trang_thai: STATUSES[j.trang_thai],
      yeu_cau: j.yeu_cau, ghi_chu_cua_khach: j.ghi_chu_khach || undefined, nguoi_lam: j.nguoi_lam || undefined, cap_nhat: j.cap_nhat || undefined,
      ket_qua_da_nop: j.ket_qua || undefined,
    }] } };
  }
  const want = all ? jobs.slice(0, 30) : jobs.filter((j) => ['cho_lam', 'dang_lam', 'da_duyet'].includes(j.trang_thai));
  if (!all) {
    const todo = want.filter((j) => j.trang_thai === 'cho_lam');
    if (todo.length) {
      const t = now();
      for (const j of todo) {
        j.trang_thai = 'dang_lam'; j.nhan_luc = t; j.cap_nhat = t; j.nguoi_lam = clip(who, 40) || j.nguoi_lam || 'AI';
        j.lich_su = [...(j.lich_su || []), { luc: t, viec: `${j.nguoi_lam} nhận việc` }].slice(-20);
      }
      await saveJobs(env, uid, jobs);
    }
  }
  return {
    data: {
      viec: want.map((j) => ({
        id: j.id, tieu_de: j.tieu_de, loai: j.loai, quy_trinh: j.quy_trinh || undefined, trang_thai: j.trang_thai, mo_ta_trang_thai: STATUSES[j.trang_thai],
        yeu_cau: j.yeu_cau, ghi_chu_cua_khach: j.ghi_chu_khach || undefined,
        ket_qua_da_nop: j.trang_thai === 'da_duyet' && j.ket_qua ? j.ket_qua : undefined,
        gio_dang: j.gio_dang || undefined,
        ...(j.trang_thai === 'da_duyet' && j.gio_dang && !j.xep_dang && Date.parse(j.gio_dang) > Date.now() ? { luu_y: 'Chưa tới giờ hẹn: KHÔNG đăng, Crewzy tự đăng đúng giờ.' } : {}),
      })),
      huong_dan: want.length
        ? 'Việc cho_lam: làm rồi nộp bằng CREWZY_NOP_KET_QUA (kèm id). Việc da_duyet: đăng/gửi đúng nội dung đã duyệt rồi nộp lại với trang_thai da_dang và link bài.'
          + (all ? ' Cần nội dung một phiếu cũ (Sổ tay phong cách, báo cáo tuần, báo cáo đối thủ): gọi lại CREWZY_VIEC_CAN_LAM với id của phiếu đó.' : '')
        : 'Hiện không có việc nào cần làm.',
    },
  };
}

// Duyệt hàng loạt (CREWZY_DUYET_HANG_LOAT, src/lib/publish.js): items [{id, gio_dang}] → da_duyet; gio_dang rỗng = đăng ngay (bỏ giờ hẹn cũ để cron không đăng lại).
export async function approveBatch(env, uid, items, who) {
  const jobs = await listJobs(env, uid);
  const done = [];
  let timed = false;
  for (const it of items) {
    const j = jobs.find((x) => x.id === it.id);
    if (!j || !['cho_duyet', 'da_duyet'].includes(j.trang_thai)) continue;
    j.trang_thai = 'da_duyet'; j.cap_nhat = now();
    if (it.gio_dang) { j.gio_dang = it.gio_dang; delete j.xep_dang; timed = true; } else delete j.gio_dang;
    j.lich_su = [...(j.lich_su || []), { luc: now(), viec: (clip(who, 40) || 'Khách') + ' duyệt' + (it.gio_dang ? ' · hẹn đăng ' + it.gio_dang : ' · đăng ngay') }].slice(-20);
    done.push({ id: j.id, tieu_de: j.tieu_de, kenh: (j.ket_qua && j.ket_qua.kenh) || [], gio_dang: j.gio_dang || '' });
  }
  if (done.length) await saveJobs(env, uid, jobs);
  if (timed) await markPostIndex(env, uid);
  return done;
}

// Giờ hẹn đăng → ISO UTC. "19:00" = hôm nay giờ VN (đã qua thì ngày mai); ISO không múi giờ coi như giờ VN.
export function parseGioDang(v, nowMs = Date.now()) {
  const s = String(v || '').trim();
  if (!s) return '';
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const vnNow = new Date(nowMs + 7 * 3600e3);
    let t = Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), +hm[1], +hm[2]) - 7 * 3600e3;
    if (t < nowMs - 60e3) t += 24 * 3600e3;
    return new Date(t).toISOString();
  }
  const t = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + '+07:00');
  return Number.isFinite(t) && t > nowMs - 7 * 86400e3 && t < nowMs + 60 * 86400e3 ? new Date(t).toISOString() : '';
}
// Chỉ mục khách có bài hẹn giờ (cron đọc, khỏi quét mọi khách).
export async function markPostIndex(env, uid) {
  const idx = (await kvGetJson(env, 'postidx')) || [];
  if (!idx.includes(uid)) { idx.push(uid); await kvPutJson(env, 'postidx', idx.slice(-2000)); }
}
// Cron: phiếu ĐÃ DUYỆT tới giờ đăng → trả về để xếp Trợ lý đăng (đánh dấu xep_dang, mỗi phiếu 1 lần). con_hen = còn phiếu hẹn giờ chưa tới/chưa duyệt.
export async function takeDuePosts(env, uid, nowMs = Date.now()) {
  const jobs = await listJobs(env, uid);
  const due = [];
  for (const j of jobs) {
    if (j.trang_thai === 'da_duyet' && j.gio_dang && !j.xep_dang && Date.parse(j.gio_dang) <= nowMs) {
      j.xep_dang = new Date(nowMs).toISOString();
      j.lich_su = [...(j.lich_su || []), { luc: j.xep_dang, viec: 'Tới giờ hẹn → Crewzy đang đăng' }].slice(-20);
      due.push(j);
    }
  }
  if (due.length) await saveJobs(env, uid, jobs);
  const con_hen = jobs.some((j) => j.gio_dang && !j.xep_dang && ['cho_duyet', 'da_duyet', 'cho_lam', 'dang_lam'].includes(j.trang_thai));
  return { due, con_hen };
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
    prompt_da_dung: a.prompt_da_dung ? clip(a.prompt_da_dung, 4000) : prev.prompt_da_dung || '',
    app_da_dung: a.app_da_dung ? clip(a.app_da_dung, 80) : prev.app_da_dung || '',
  };
  job.trang_thai = status;
  const gio = parseGioDang(a.gio_dang);
  if (gio) { job.gio_dang = gio; delete job.xep_dang; await markPostIndex(env, uid); }
  job.nguoi_lam = clip(a.nguoi_lam, 40) || job.nguoi_lam || 'AI';
  job.cap_nhat = now();
  job.lich_su = [...(job.lich_su || []), { luc: now(), viec: `${job.nguoi_lam} nộp kết quả → ${STATUSES[status]}` }].slice(-20);
  await saveJobs(env, uid, jobs);
  return {
    data: { id: job.id, trang_thai: status, xem_tai: `${origin}/cho-duyet.html?id=${job.id}`, media: job.ket_qua.media, ...(job.gio_dang ? { gio_dang: job.gio_dang } : {}) },
    images: job.ket_qua.media.filter((m) => m.loai === 'image' || m.loai === 'video'),
  };
}

// Câu lệnh mẫu dạng MCP prompts: hiện thành lệnh gạch chéo trong Claude Code (/mcp__crewzy__…) và mục Prompts ở các AI khác.
export const MCP_PROMPTS = [
  { name: 'lam_viec_crewzy', title: 'Làm các việc Crewzy giao', description: 'Nhận phiếu việc từ Crewzy, làm bằng app đã kết nối, nộp kết quả để khách duyệt.',
    text: 'Gọi CREWZY_VIEC_CAN_LAM. Với từng việc cần làm: đọc kỹ Brain thương hiệu và mẫu tham khảo (CREWZY_BRAIN), làm bằng các app đã kết nối và skill bạn có, rồi nộp bằng CREWZY_NOP_KET_QUA kèm id. Với việc đã duyệt: đăng/gửi đúng nội dung đã duyệt rồi nộp lại trạng thái da_dang kèm link. Cuối cùng tóm tắt cho tôi đã làm những gì.' },
  { name: 'len_lich_tuan', title: 'Lên 7 bài cho tuần', description: 'Kế hoạch 7 bài đăng theo Brain thương hiệu, nộp về Crewzy chờ duyệt.',
    text: 'Đọc Brain thương hiệu (CREWZY_BRAIN), lên 7 bài Facebook cho tuần này, mỗi bài một góc khác nhau (lợi ích, câu hỏi khách hay hỏi, hậu trường, ưu đãi, cảm nhận khách). Viết đầy đủ từng bài, rồi nộp về Crewzy bằng CREWZY_NOP_KET_QUA (loai bai_dang) để tôi duyệt. Chưa đăng.' },
  { name: 'bao_cao_tuan', title: 'Báo cáo tuần', description: 'Tổng hợp số liệu quảng cáo và kênh đã kết nối, nộp báo cáo về Crewzy.',
    text: 'Đọc số liệu 7 ngày qua từ các app đã kết nối (quảng cáo Meta/Google, Google Analytics, Fanpage, Sheet bán hàng nếu có). Viết báo cáo: số chính, so với tuần trước, điều tốt, điều cần sửa, 3 việc tuần tới. Nộp về Crewzy bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong).' },
  { name: 'tra_loi_binh_luan', title: 'Soạn trả lời bình luận', description: 'Đọc bình luận mới trên Fanpage, soạn câu trả lời theo giọng thương hiệu, nộp chờ duyệt.',
    text: 'Đọc 20 bình luận mới nhất trên các bài gần đây của Fanpage, soạn câu trả lời cho từng bình luận theo Brain thương hiệu (không đưa số điện thoại khách lên công khai). Nộp danh sách về Crewzy bằng CREWZY_NOP_KET_QUA (loai cham_soc) để tôi duyệt trước khi trả lời.' },
  { name: 'video_quang_cao', title: 'Video quảng cáo ngắn', description: 'Làm video dọc 9:16 bằng app tạo video đã nối (OpenArt…), nộp video + caption về Crewzy.',
    text: 'Chạy quy trình video_tron_goi của Crewzy: gọi CREWZY_QUY_TRINH id "video_tron_goi", đọc kỹ thuong_hieu (phong cách, giọng, nhạc, video/ảnh mẫu), làm đúng từng bước. Dựng bằng công cụ đã nối (HyperFrames, Shotstack, InVideo, HeyGen, OpenArt) hoặc Remotion/HyperFrames/ffmpeg trên máy rồi CREWZY_TAI_LEN. Nộp video + nội dung từng kênh bằng CREWZY_NOP_KET_QUA.' },
];

// Mỗi quy trình chuẩn cũng là một lệnh nhanh: Claude Code gõ /mcp__crewzy__qt_<mã>.
for (const w of WORKFLOWS) {
  MCP_PROMPTS.push({ name: 'qt_' + w.id, title: w.ten, description: w.mo_ta.slice(0, 200), text: workflowPrompt(w) });
}
