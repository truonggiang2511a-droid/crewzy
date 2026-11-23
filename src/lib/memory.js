// BỘ NHỚ KHÁCH — AI HỌC KHÁCH (23/11/2026, Giang): mỗi lần khách góp ý, sửa bài, nói thích/không thích, đưa từ ngữ, quy tắc, cách làm việc…
// AI (Trợ lý Crewzy hoặc AI của khách qua link MCP) lưu 1 ghi chú ngắn bằng CREWZY_GHI_NHO. Lần sau bộ nhớ tự nạp vào: lời dặn hệ thống của Trợ lý,
// instructions lúc AI ngoài kết nối, kết quả CREWZY_BRAIN và CREWZY_QUY_TRINH → AI làm đúng phong cách, khỏi hỏi lại.
// Lưu KV mem:<uid> (Agency: theo từng thương hiệu vì mã khách con), tối đa 80 ghi chú, trùng thì bỏ, đầy thì bỏ ghi chú cũ nhất (không bỏ loại quy_tac).
// Code tự ghi thêm khi khách bấm "Yêu cầu AI làm lại"/"Từ chối" có ghi chú ở Việc chờ duyệt (jobs.js) — không cần AI.
import { kvGetJson, kvPutJson } from './common.js';

export const MEM_KINDS = {
  phong_cach: 'Phong cách nội dung, hình ảnh, video',
  tu_ngu: 'Từ ngữ, cách xưng hô, câu chữ nên/không nên dùng',
  quy_tac: 'Quy tắc bắt buộc của khách',
  gop_y: 'Góp ý khi duyệt bài',
  cach_lam: 'Cách làm việc, quy trình khách thích',
  thong_tin: 'Thông tin cần nhớ (sản phẩm, giá, lịch, người phụ trách)',
};
const MAX = 80;
const key = (uid) => 'mem:' + uid;
const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const newId = () => 'm' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');

export const listMem = async (env, uid) => (await kvGetJson(env, key(uid)).catch(() => null)) || [];

export async function addMem(env, uid, { loai, noi_dung, nguon }) {
  const text = String(noi_dung || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (text.length < 4) return { error: 'Ghi chú quá ngắn.' };
  const kind = MEM_KINDS[loai] ? loai : 'cach_lam';
  const list = await listMem(env, uid);
  if (list.some((m) => norm(m.noi_dung) === norm(text))) return { data: { da_co: true, so_ghi_chu: list.length } };
  list.unshift({ id: newId(), loai: kind, noi_dung: text, nguon: String(nguon || 'AI').slice(0, 40), luc: new Date().toISOString() });
  while (list.length > MAX) {
    let drop = -1;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].loai !== 'quy_tac') { drop = i; break; }
    list.splice(drop >= 0 ? drop : list.length - 1, 1);
  }
  await kvPutJson(env, key(uid), list);
  return { data: { da_luu: true, so_ghi_chu: list.length } };
}

export async function removeMem(env, uid, id) {
  const list = await listMem(env, uid);
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  await kvPutJson(env, key(uid), next);
  return true;
}

// Đoạn đưa vào lời dặn AI: nhóm theo loại, mới nhất trước, gọn (≤ 4.000 ký tự).
export function memText(list) {
  if (!list || !list.length) return '';
  const lines = [];
  for (const [k, label] of Object.entries(MEM_KINDS)) {
    const items = list.filter((m) => m.loai === k);
    if (items.length) lines.push(`${label}:\n` + items.slice(0, 20).map((m) => `- ${m.noi_dung}`).join('\n'));
  }
  return lines.join('\n').slice(0, 4000);
}
export async function memBlock(env, uid) {
  const t = memText(await listMem(env, uid));
  return t ? '# Bộ nhớ: AI đã học về khách (LÀM THEO, không hỏi lại điều đã ghi)\n' + t : '';
}

export const MEM_RULE = 'HỌC KHÁCH: mỗi khi khách góp ý, sửa bài/ảnh/video, nói thích hoặc không thích, đưa từ ngữ, cách xưng hô, quy tắc, cách làm việc, thông tin cần nhớ → gọi CREWZY_GHI_NHO NGAY (1 ý ngắn, viết thành quy tắc dùng lại được, ví dụ "Không dùng emoji trong bài Facebook", "Xưng em, gọi khách là anh/chị", "Video mở đầu bằng cảnh mặt tiền nhà"). Không ghi số điện thoại, thông tin cá nhân của khách hàng. Trước khi làm, đọc "Bộ nhớ" và làm đúng; điều đã có trong bộ nhớ thì KHÔNG hỏi lại.';

export const MEM_TOOL_DEFS = [{
  type: 'function',
  function: {
    name: 'CREWZY_GHI_NHO',
    description: 'Lưu 1 điều vừa học được về khách vào Bộ nhớ của thương hiệu trong Crewzy (phong cách, từ ngữ, quy tắc, góp ý khi duyệt, cách làm việc, thông tin cần nhớ) để lần sau mọi AI và mọi quy trình làm đúng ý khách, không hỏi lại. Gọi ngay khi khách góp ý hoặc sửa. Bỏ trống noi_dung + có xoa = xoá ghi chú sai/hết dùng.',
    parameters: { type: 'object', properties: {
      loai: { type: 'string', enum: Object.keys(MEM_KINDS), description: Object.entries(MEM_KINDS).map(([k, v]) => `${k} = ${v}`).join('; ') },
      noi_dung: { type: 'string', description: 'Một ý ngắn (≤ 400 ký tự), viết thành quy tắc dùng lại được.' },
      xoa: { type: 'string', description: 'Mã ghi chú cần xoá (khi khách bảo bỏ một điều đã nhớ).' },
    } },
  },
}];

export async function memTool(env, uid, args, agent) {
  const a = args || {};
  if (a.xoa && !a.noi_dung) return (await removeMem(env, uid, String(a.xoa))) ? { data: { da_xoa: true } } : { error: 'Không có ghi chú này.' };
  return addMem(env, uid, { loai: a.loai, noi_dung: a.noi_dung, nguon: agent || 'AI' });
}
