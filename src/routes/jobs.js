// Phiếu việc cho trang Việc chờ duyệt.
// GET  /api/jobs?uid=                     → {jobs, counts, statuses, kinds}
// POST /api/jobs {uid, action:'tao', tieu_de, yeu_cau, loai}  → giao việc mới cho AI của khách
// POST /api/jobs {uid, action:'duyet'|'tu_choi'|'lam_lai'|'xong'|'da_dang'|'sua'|'xoa', id, noi_dung?, ghi_chu?}
// GET  /api/skill.md                      → file SKILL.md cho Claude Code / Codex (cách làm việc với Crewzy)
import { resolveUid, APP_NAME } from '../lib/common.js';
import { listJobs, createJob, updateJobByOwner, STATUSES, KINDS, MCP_PROMPTS } from '../lib/jobs.js';
import { WORKFLOWS, DEPARTMENTS, WORKFLOW_RULES } from '../lib/workflows.js';

function skillMd(origin) {
  return `---
name: crewzy
description: Làm việc cho doanh nghiệp qua Crewzy (marketing, bán hàng, báo cáo). Dùng khi người dùng nhắc Crewzy, phiếu việc, Việc chờ duyệt, Brain thương hiệu, hoặc nhờ viết/đăng bài, làm báo cáo trên các app đã kết nối qua Crewzy.
---

# Crewzy

${APP_NAME} giữ kết nối tới app của doanh nghiệp (Facebook, Instagram, Gmail, Google Sheets/Docs, quảng cáo Meta/Google, Canva…) và phiếu việc.
Bạn là bộ não: nhận việc, làm bằng công cụ MCP "crewzy" cùng các skill bạn có, rồi nộp kết quả về Crewzy.

## Quy trình mỗi lần làm việc
1. \`CREWZY_VIEC_CAN_LAM\` — xem việc được giao (cho_lam) và việc khách đã duyệt (da_duyet).
2. \`CREWZY_BRAIN\` — ĐỌC KỸ Brain thương hiệu trước khi làm bất cứ việc gì: giọng văn, phong cách hình ảnh/video, giọng đọc, nhạc và MẪU THAM KHẢO (video viral, ảnh quảng cáo khách thích, giọng mẫu, nhạc, logo, tư liệu gốc). Mở các link mẫu để học phong cách, làm theo phong cách đó cho thương hiệu khách (không sao chép). Không bịa giá, số liệu, tên người.
3. Làm việc:
   - Đọc/ghi app: tìm công cụ bằng \`COMPOSIO_SEARCH_TOOLS\`, chạy bằng \`COMPOSIO_MULTI_EXECUTE_TOOL\`.
   - Ảnh mới: \`CREWZY_TAO_ANH\` (ảnh không chữ; chữ thêm trong bài hoặc Canva).
   - Công cụ MCP khách đã nối trong Crewzy (tiền tố \`m…_\`): HyperFrames, Shotstack, InVideo, HeyGen (dựng video), ElevenLabs (giọng đọc), Captions, OpusClip, Reap (cắt clip, phụ đề), OpenArt (ảnh/video AI)…
   - Dùng thoải mái skill sẵn có của bạn (viết lách, phân tích dữ liệu, tạo file, chỉnh ảnh, dựng video bằng Remotion, HyperFrames, ffmpeg trên máy…).
   - File tạo trên máy (video render, ảnh, âm thanh ≤ 95MB): gọi \`CREWZY_TAI_LEN\` lấy put_url, chạy lệnh curl nó đưa, rồi dùng \`link_sau_khi_tai\` để đăng hoặc nộp phiếu.
   - Đọc website khách hoặc đối thủ: \`CREWZY_DOC_WEB\` (có sẵn) hoặc công cụ đọc web của bạn. CREWZY_QUY_TRINH báo \`thieu_du_lieu\` (Brain trống, chưa có mẫu, cần chạy quy trình khác trước): báo khách cách bổ sung, không bịa thay.
   - Đăng bài: chỉ đăng định dạng kênh nhận được (\`dinh_dang_kenh\` trong CREWZY_QUY_TRINH): YouTube chỉ video, Instagram không bài chỉ có chữ, TikTok chỉ video/ảnh cuộn. Mỗi kênh một nội dung riêng.
4. \`CREWZY_NOP_KET_QUA\` — nộp MỌI sản phẩm về Crewzy (kèm \`id\` nếu là việc được giao, \`nguoi_lam\` = tên bạn, \`media\` = link ảnh/video, \`lien_ket\` = link Sheet/Docs/bài đăng). Mặc định trạng thái \`cho_duyet\`; báo cáo nội bộ dùng \`xong\`.
5. Việc \`da_duyet\`: đăng/gửi đúng nội dung khách đã duyệt, rồi nộp lại với \`trang_thai: "da_dang"\` và link bài.

## Quy tắc bắt buộc
- Trả lời người dùng bằng tiếng Việt.
- Không đăng, gửi tin/email cho người khác, xoá dữ liệu hay chi tiền khi chưa có phiếu \`da_duyet\` hoặc người dùng chưa đồng ý trong cuộc trò chuyện.
  Người dùng bảo "đăng luôn" trong cuộc trò chuyện = đồng ý: đăng ngay, rồi nộp phiếu với \`trang_thai: "da_dang"\` kèm link bài.
- Không đưa số điện thoại hay thông tin cá nhân của khách lên bài công khai.
- Mỗi trang/kênh một bản nội dung khác nhau khi đăng nhiều nơi.

## Quy trình chuẩn (gọi \`CREWZY_QUY_TRINH\` với id để lấy đúng các bước và app còn thiếu)
${DEPARTMENTS.map((d) => `### ${d.name}\n` + WORKFLOWS.filter((w) => w.phong === d.id).map((w) => `- \`${w.id}\` — ${w.ten} (gợi ý: ${w.lich})`).join('\n')).join('\n')}

Quy tắc khi chạy quy trình:
${WORKFLOW_RULES.map((r) => '- ' + r).join('\n')}

Nghiên cứu đối thủ cần MCP ngoài nối trong Crewzy (Kết nối → MCP khác): Apify (Reels/TikTok, quảng cáo Facebook), Firecrawl (website).
Nếu bạn (AI) đã có connector vidIQ thì dùng thêm vidIQ để xem từng cảnh video của đối thủ.

## Lệnh nhanh (MCP prompts)
- \`lam_viec_crewzy\` — nhận và làm các việc Crewzy giao.
- \`qt_<mã quy trình>\` — chạy một quy trình chuẩn, ví dụ \`qt_lich_noi_dung_tuan\`, \`qt_doi_thu_reels\`, \`qt_bao_cao_tuan\`.

Xem và duyệt kết quả: ${origin}/cho-duyet.html
`;
}

export default async (req, env) => {
  const url = new URL(req.url);
  if (url.pathname === '/api/skill.md') {
    return new Response(skillMd(url.origin), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': 'inline; filename="SKILL.md"', 'cache-control': 'public, max-age=600' } });
  }
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); } }
  else if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const who = await resolveUid(req, env, req.method === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (who.response) return who.response;
  const uid = who.uid;

  if (req.method === 'GET') {
    const jobs = await listJobs(env, uid);
    const counts = {};
    for (const j of jobs) counts[j.trang_thai] = (counts[j.trang_thai] || 0) + 1;
    return Response.json({ jobs, counts, statuses: STATUSES, kinds: KINDS }, { headers: { 'cache-control': 'no-store' } });
  }
  if (body.action === 'tao') {
    if (!String(body.yeu_cau || '').trim() && !body.quy_trinh) return Response.json({ error: 'Hãy ghi việc cần làm.' }, { status: 400 });
    return Response.json({ job: await createJob(env, uid, { tieu_de: body.tieu_de, yeu_cau: body.yeu_cau, loai: body.loai, nguon: 'khach', quy_trinh: body.quy_trinh }) });
  }
  const out = await updateJobByOwner(env, uid, String(body.id || ''), body);
  if (out.error) return Response.json(out, { status: 400 });
  return Response.json(out);
};
