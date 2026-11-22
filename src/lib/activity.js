// Ghi lại việc AI thực sự làm (đăng bài, trả lời, gửi tin, ảnh, video, thêm khách, đọc số liệu) → bảng D1 activity theo ngày (giờ VN).
// Dùng cho màn Kết quả (biên nhận tháng) và báo cáo tuần tự động. Ghi best-effort: lỗi không làm hỏng công cụ.
// Chat (Trợ lý Crewzy) chỉ ghi khi công cụ chạy xong không lỗi; cổng MCP ghi lúc gọi (không đọc được kết quả Composio đã chuyển tiếp).
const SOCIAL = /^(FACEBOOK|INSTAGRAM|YOUTUBE|LINKEDIN|PINTEREST|TWITTER|THREADS|TIKTOK|REDDIT|METRICOOL|BUFFER)_/;
const SKIP = /^(COMPOSIO_(SEARCH_TOOLS|GET_TOOL_SCHEMAS|MANAGE_CONNECTIONS|WAIT_FOR_CONNECTIONS)|CREWZY_(?!TAO_ANH|TAO_VIDEO))/;

export const KIND_LABELS = { dang_bai: 'Bài đã đăng', tra_loi: 'Bình luận đã trả lời', gui_tin: 'Tin nhắn, email đã gửi', anh: 'Ảnh đã tạo', video: 'Video đã tạo', khach: 'Khách thêm vào CRM', doc: 'Lần đọc số liệu', khac: 'Việc khác trên app' };

export function classify(name) {
  const raw = String(name || '');
  const ext = /^m[0-9a-f]{4}_/.test(raw);
  const n = (ext ? raw.slice(6) : raw).toUpperCase().replace(/[-\s]/g, '_');
  if (!n || SKIP.test(n)) return null;
  if (n === 'CREWZY_TAO_ANH') return 'anh';
  if (n === 'CREWZY_TAO_VIDEO') return 'video';
  if (/REPLY|COMMENT/.test(n) && /CREATE|POST|SEND|ADD|REPLY/.test(n) && !/GET|LIST|FETCH/.test(n)) return 'tra_loi';
  if (/SEND_(EMAIL|MESSAGE|SMS|TEXT|DRAFT|MAIL)|SEND$|SEND_A_|REPLY_TO_THREAD/.test(n)) return 'gui_tin';
  if (SOCIAL.test(n) && /(CREATE|PUBLISH|SHARE|UPLOAD|SCHEDULE|POST).*(POST|PHOTO|VIDEO|REEL|STORY|PIN|TWEET|SHORT|FEED|MEDIA)|PUBLISH|_POST$/.test(n) && !/CONTAINER|GET|LIST|DELETE/.test(n)) return 'dang_bai';
  if (/(GENERATE|CREATE|RENDER|COMPOSE).*(VIDEO|CLIP)|RENDER_VIDEO|^COMPOSE$/.test(n)) return 'video';
  if (/(GENERATE|CREATE|EDIT).*(IMAGE|PHOTO|PICTURE)|^GENERATE_IMAGE/.test(n)) return 'anh';
  if (/(CREATE|ADD|UPSERT).*(CONTACT|LEAD|DEAL|PERSON|CUSTOMER|SUBSCRIBER)/.test(n)) return 'khach';
  if (/GET|LIST|FETCH|SEARCH|READ|INSIGHT|REPORT|ANALYTIC|STATS|METRIC|QUERY|SCRAPE|FIND/.test(n)) return 'doc';
  return 'khac';
}

// Một lần gọi có thể gồm nhiều công cụ (COMPOSIO_MULTI_EXECUTE_TOOL).
export function kindsOf(name, args) {
  if (name === 'COMPOSIO_MULTI_EXECUTE_TOOL') {
    const list = (args && Array.isArray(args.tools) ? args.tools : []).slice(0, 50);
    return list.map((t) => classify(t && (t.tool_slug || t.slug || t.name))).filter(Boolean);
  }
  const k = classify(name);
  return k ? [k] : [];
}

const vnNow = (t = Date.now()) => new Date(t + 7 * 3600 * 1000).toISOString();
export const vnDay = (t) => vnNow(t).slice(0, 10);
export const vnMonth = (t) => vnNow(t).slice(0, 7);

export async function recordActivity(env, uid, name, args) {
  if (!env.DB || !uid) return;
  const kinds = kindsOf(name, args);
  if (!kinds.length) return;
  const count = {};
  for (const k of kinds) count[k] = (count[k] || 0) + 1;
  const day = vnDay(), month = day.slice(0, 7);
  try {
    await env.DB.batch(Object.entries(count).map(([k, n]) => env.DB.prepare(
      'INSERT INTO activity (uid, month, day, kind, n) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (uid, day, kind) DO UPDATE SET n = n + ?5').bind(uid, month, day, k, n)));
  } catch (e) { console.error('activity record failed', e && e.message); }
}

// Phút một người làm tay mỗi việc (ước tính để quy ra giờ tiết kiệm). Đổi bằng biến RESULT_MINUTES_JSON.
export const DEFAULT_MINUTES = { dang_bai: 20, tra_loi: 3, gui_tin: 5, anh: 15, video: 60, khach: 5, doc: 5, khac: 3, ket_qua: 20, bao_cao: 60 };
export const HOUR_VND = 50000; // giá 1 giờ nhân viên để quy ra tiền (đổi bằng RESULT_HOUR_VND)

export async function activitySummary(env, uid, from, to) {
  if (!env.DB) return {};
  const r = await env.DB.prepare('SELECT kind, SUM(n) AS n FROM activity WHERE uid = ?1 AND day >= ?2 AND day <= ?3 GROUP BY kind').bind(uid, from, to).all();
  return Object.fromEntries((r.results || []).map((x) => [x.kind, x.n]));
}

// Biên nhận một khoảng ngày (giờ VN, YYYY-MM-DD): việc đã làm + kết quả đã nộp + credit đã dùng + giờ/tiền tiết kiệm ước tính.
// Dùng chung cho GET /api/results và báo cáo tuần (cron). jobs = danh sách phiếu (KV), plan = gói hiện tại (có thể null).
export async function buildResults(env, uid, { from, to, jobs = [], plan = null }) {
  const minutes = { ...DEFAULT_MINUTES, ...safeJson(env.RESULT_MINUTES_JSON) };
  const hourVnd = Number(env.RESULT_HOUR_VND) || HOUR_VND;
  const fromMs = Date.parse(from + 'T00:00:00+07:00'), toMs = Date.parse(to + 'T23:59:59+07:00');
  const inRange = (iso) => { const t = Date.parse(iso || ''); return t >= fromMs && t <= toMs; };
  const done = jobs.filter((j) => j.ket_qua && !String(j.nguoi_lam || '').startsWith('Crewzy') && ['cho_duyet', 'da_duyet', 'da_dang', 'xong'].includes(j.trang_thai) && inRange(j.cap_nhat));
  const viec = await activitySummary(env, uid, from, to).catch(() => ({}));
  const ket_qua = { tong: done.length, bao_cao: done.filter((j) => j.loai === 'bao_cao').length, da_dang: done.filter((j) => j.trang_thai === 'da_dang').length, cho_duyet: done.filter((j) => j.trang_thai === 'cho_duyet').length };
  let creditDung = 0, series = [];
  if (env.DB) {
    const [c, s] = await Promise.all([
      env.DB.prepare('SELECT COALESCE(SUM(-delta), 0) AS n FROM ledger WHERE uid = ?1 AND delta < 0 AND created_at BETWEEN ?2 AND ?3').bind(uid, fromMs, toMs).first().catch(() => null),
      env.DB.prepare("SELECT day, SUM(n) AS n FROM activity WHERE uid = ?1 AND day >= ?2 AND day <= ?3 AND kind IN ('dang_bai','tra_loi','gui_tin','anh','video','khach') GROUP BY day ORDER BY day").bind(uid, from, to).all().catch(() => null),
    ]);
    creditDung = (c && c.n) || 0;
    series = (s && s.results) || [];
  }
  let phut = 0;
  for (const [k, n] of Object.entries(viec)) phut += (minutes[k] || 0) * n;
  phut += ket_qua.bao_cao * minutes.bao_cao + (ket_qua.tong - ket_qua.bao_cao) * minutes.ket_qua;
  const gio = Math.round(phut / 6) / 10;
  const tien = Math.round((gio * hourVnd) / 1000) * 1000;
  return {
    tu: from, den: to, viec, nhan: KIND_LABELS, ket_qua, credit_dung: creditDung, series,
    gio_tiet_kiem: gio, tien_tiet_kiem: tien, gia_gio: hourVnd,
    gap_lan: plan && plan.gia ? Math.round((tien / plan.gia) * 10) / 10 : null,
    gan_day: done.slice(0, 8).map((j) => ({ id: j.id, tieu_de: j.tieu_de || '(không tiêu đề)', loai: j.loai, trang_thai: j.trang_thai, luc: j.cap_nhat, nguoi_lam: j.nguoi_lam || '' })),
  };
}
function safeJson(t) { try { return t ? JSON.parse(t) : {}; } catch (e) { return {}; } }

// Báo cáo tuần tự động (cron, thứ Hai từ 8 giờ VN, 1 lần/tuần): mỗi tài khoản có việc trong 7 ngày → 1 phiếu "Báo cáo tuần Crewzy"
// (loai bao_cao, trang_thai xong) ở Việc chờ duyệt, kèm link màn Kết quả. Không gọi AI → không tốn credit. Tắt bằng WEEKLY_REPORT=off.
export async function runWeeklyReports(env, { origin, submitResult, listJobs, plans }) {
  if (!env.DB || String(env.WEEKLY_REPORT || '').toLowerCase() === 'off') return { skip: 'off' };
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  if (vn.getUTCDay() !== 1 || vn.getUTCHours() < 8) return { skip: 'not monday 8h' };
  const flag = 'weekly:' + vnDay();
  if (await env.KV.get(flag)) return { skip: 'done' };
  await env.KV.put(flag, '1', { expirationTtl: 8 * 86400 });
  const from = vnDay(Date.now() - 7 * 86400000), to = vnDay(Date.now() - 86400000);
  const rows = await env.DB.prepare("SELECT DISTINCT a.uid, c.plan FROM activity a LEFT JOIN accounts c ON c.uid = a.uid WHERE a.day >= ?1 AND a.day <= ?2 LIMIT 500").bind(from, to).all();
  let sent = 0;
  for (const r of rows.results || []) {
    try {
      const plan = plans.find((p) => p.id === r.plan) || null;
      const jobs = await listJobs(env, r.uid);
      const d = await buildResults(env, r.uid, { from, to, jobs, plan });
      const v = d.viec;
      const lines = Object.keys(KIND_LABELS).filter((k) => v[k]).map((k) => `- ${KIND_LABELS[k]}: ${v[k]}`);
      if (d.ket_qua.tong) lines.push(`- Kết quả nộp về Crewzy: ${d.ket_qua.tong}`);
      if (!lines.length) continue;
      const fmt = (x) => x.slice(8) + '/' + x.slice(5, 7);
      await submitResult(env, r.uid, origin, {
        tieu_de: `Báo cáo tuần Crewzy ${fmt(from)} – ${fmt(to)}`, loai: 'bao_cao', trang_thai: 'xong', nguoi_lam: 'Crewzy',
        noi_dung: `Tuần qua đội AI đã làm:\n${lines.join('\n')}\n\nTiết kiệm khoảng ${d.gio_tiet_kiem} giờ làm việc (≈ ${d.tien_tiet_kiem.toLocaleString('vi-VN')}đ tiền công). Đã dùng ${d.credit_dung} credit.\n\nXem chi tiết: ${origin}/ket-qua.html`,
      });
      sent++;
    } catch (e) { console.error('weekly report failed', r.uid, e && e.message); }
  }
  return { sent };
}
