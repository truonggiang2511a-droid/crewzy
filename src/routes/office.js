// Văn phòng thật: GET /api/office[?uid=] → mọi số liệu trang Văn phòng cần trong 1 lần gọi (điện thoại đỡ chờ).
// Phòng = DEPARTMENTS của thư viện quy trình. Trạng thái phòng tính từ phiếu việc thật (jobs), lịch hẹn, app đã nối, máy chủ MCP.
// Bảng tin = lịch sử thật của các phiếu (lich_su). Bộ não = AI của khách gần nhất gọi link nối AI (KV aiseen:<uid>) + Trợ lý trong app.
import { instantOn } from '../lib/instant.js';
import { resolveUid, kvGetJson } from '../lib/common.js';
import { connectedApps } from '../lib/connected.js';
import { listJobs, STATUSES } from '../lib/jobs.js';
import { DEPARTMENTS, WORKFLOWS, workflowById, readiness, doneFlows } from '../lib/workflows.js';
import { listSchedules } from '../lib/schedules.js';
import { listServers } from '../lib/mcpServers.js';
import { getBrand } from '../lib/brand.js';
import { appBySlug } from '../lib/catalog.js';
import { listLeads, leadStats } from '../lib/leads.js';

// Lá của Cây vận hành: mỗi nhánh một bộ ứng dụng ĐÚNG chuyên môn (mỗi app một nhiệm vụ), app đã nối hiện trước.
// Sửa ở đây khi muốn đổi app của nhánh; slug phải có trong catalog (scripts/officetest.mjs kiểm).
export const BRANCH_APPS = {
  thuong_hieu: [['googledrive', 'Logo, ảnh, tư liệu'], ['canva', 'Bộ nhận diện'], ['notion', 'Sổ tay thương hiệu']],
  doi_thu: [['apify', 'Soi Reels, TikTok đối thủ'], ['firecrawl', 'Đọc website, bảng giá'], ['semrush', 'Lưu lượng, từ khoá đối thủ'], ['vidiq_mcp', 'Kênh YouTube đối thủ'], ['metaads', 'Thư viện quảng cáo']],
  chien_luoc: [['perplexityai', 'Nghiên cứu thị trường'], ['tavily', 'Tin tức ngành'], ['serpapi', 'Từ khoá Google'], ['notion', 'Kế hoạch chiến lược'], ['googleslides', 'Trình bày kế hoạch']],
  noi_dung: [['canva', 'Thiết kế ảnh'], ['heygen', 'Video người dẫn AI'], ['elevenlabs', 'Giọng đọc'], ['descript_mcp', 'Dựng, cắt video'], ['captions', 'Phụ đề'], ['luma_labs', 'Video từ ảnh']],
  phan_phoi: [['facebook', 'Fanpage'], ['instagram', 'Bài, Reels'], ['youtube', 'Video, Shorts'], ['tiktok', 'Video ngắn'], ['linkedin', 'Bài doanh nghiệp'], ['threads', 'Bài ngắn'], ['pinterest', 'Ghim ảnh']],
  quang_cao: [['metaads', 'Quảng cáo Facebook, Instagram'], ['googleads', 'Quảng cáo Google, YouTube'], ['tiktok_ads', 'Quảng cáo TikTok'], ['google_analytics', 'Đo lường website'], ['google_search_console', 'Hiệu quả tìm kiếm'], ['ahrefs', 'Phân tích SEO'], ['mixpanel', 'Hành vi khách']],
  ban_hang: [['hubspot', 'CRM khách hàng'], ['pipedrive', 'Theo dõi deal'], ['apollo', 'Tìm khách doanh nghiệp'], ['calendly', 'Đặt lịch hẹn'], ['stripe', 'Thu tiền']],
  cham_soc: [['whatsapp', 'Nhắn tin khách'], ['telegram', 'Nhắn tin khách'], ['gmail', 'Email khách'], ['zendesk', 'Phiếu hỗ trợ'], ['intercom', 'Chat trên web']],
  bao_cao: [['googlesheets', 'Bảng số liệu'], ['googledocs', 'Báo cáo'], ['googleslides', 'Slide họp'], ['airtable', 'Cơ sở dữ liệu']],
  hang_ngay: [['gmail', 'Hộp thư'], ['googlecalendar', 'Lịch làm việc'], ['slack', 'Nhắn nội bộ'], ['trello', 'Việc cần làm'], ['googledrive', 'Tài liệu']],
};

// App khách tự nối thêm (ngoài BRANCH_APPS) mọc vào nhánh theo thể loại trong catalog; nút + của nhánh mở Kết nối lọc đúng thể loại.
export const CAT_BRANCH = { social: 'phan_phoi', web: 'phan_phoi', ads: 'quang_cao', analytics: 'quang_cao', chat: 'cham_soc', care: 'cham_soc', phone: 'cham_soc', email: 'cham_soc',
  sales: 'ban_hang', leads: 'ban_hang', money: 'ban_hang', creative: 'noi_dung', media: 'noi_dung', research: 'chien_luoc', office: 'hang_ngay', work: 'hang_ngay' };
export const BRANCH_CAT = { thuong_hieu: 'creative', doi_thu: 'research', chien_luoc: 'research', noi_dung: 'creative', phan_phoi: 'social', quang_cao: 'ads', ban_hang: 'sales', cham_soc: 'chat', bao_cao: 'analytics', hang_ngay: 'office' };
const CAT_NAME = { social: 'Kênh đăng bài', web: 'Website', ads: 'Quảng cáo', analytics: 'Phân tích', chat: 'Nhắn tin khách', care: 'Hỗ trợ khách', phone: 'Gọi điện, SMS', email: 'Email khách',
  sales: 'Bán hàng', leads: 'Tìm khách', money: 'Thanh toán', creative: 'Thiết kế', media: 'Ảnh, video', research: 'Nghiên cứu', office: 'Văn phòng', work: 'Quản lý việc' };

const ALL_BRANCH_APPS = new Set(Object.values(BRANCH_APPS).flat().map(([slug]) => slug));

const KIND_ROOM = { bai_dang: 'phan_phoi', noi_dung: 'noi_dung', cham_soc: 'cham_soc', bao_cao: 'bao_cao', brain: 'thuong_hieu', khac: 'hang_ngay' };
const STALE_MS = 3 * 3600 * 1000; // AI nhận việc quá 3 giờ chưa nộp → coi như chưa làm
const DAY_MS = 86400 * 1000;

const roomOf = (j) => { const w = j.quy_trinh && workflowById(j.quy_trinh); return w ? w.phong : KIND_ROOM[j.loai] || 'hang_ngay'; };

export default async (req, env) => {
  const url = new URL(req.url);
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  const [jobs, schedules, servers, brand, accounts, aiseen, leadList] = await Promise.all([
    listJobs(env, uid), listSchedules(env, uid).catch(() => []), listServers(env, uid).catch(() => []),
    getBrand(env, uid).catch(() => null), connectedApps(env, uid), kvGetJson(env, 'aiseen:' + uid).catch(() => null), listLeads(env, uid).catch(() => []),
  ]);
  const now = Date.now();
  const connected = Object.keys(accounts || {});
  const mcpUrls = servers.filter((s) => !s.off).map((s) => s.url);
  const rctx = { connected, mcpUrls, brand: brand || {}, done: doneFlows(jobs), instant: instantOn(env) && !!env.ANTHROPIC_API_KEY };
  const effective = (j) => (j.trang_thai === 'dang_lam' && now - Date.parse(j.nhan_luc || j.cap_nhat) > STALE_MS ? 'cho_lam' : j.trang_thai);

  const rooms = DEPARTMENTS.map((d) => {
    const mine = jobs.filter((j) => roomOf(j) === d.id);
    const by = (st) => mine.filter((j) => effective(j) === st);
    const working = by('dang_lam'), todo = by('cho_lam'), waiting = by('cho_duyet'), approved = by('da_duyet');
    const doneRecent = mine.filter((j) => ['da_dang', 'xong'].includes(j.trang_thai) && now - Date.parse(j.cap_nhat) < DAY_MS);
    const flows = WORKFLOWS.filter((w) => w.phong === d.id);
    const ready = flows.filter((w) => readiness(w, rctx).san_sang);
    // App của phòng: app đã nối dùng được cho quy trình của phòng (đã nối trước), rồi app gợi ý đầu tiên của nhóm bắt buộc.
    const roomApps = [...new Set(flows.flatMap((w) => (w.cong_cu || []).flatMap((g) => g.apps)))];
    const apps = roomApps.filter((s) => connected.includes(s)).slice(0, 4);
    const suggest = [...new Set(flows.flatMap((w) => (w.cong_cu || []).filter((g) => g.bat_buoc).map((g) => g.apps[0])))].filter((s) => !connected.includes(s)).slice(0, 3);
    // Lá của cây: bộ app đúng chuyên môn của nhánh (BRANCH_APPS) + app đã nối khác mà quy trình của nhánh dùng.
    const curated = (BRANCH_APPS[d.id] || []).filter(([slug]) => appBySlug(slug));
    const extra = connected.filter((x) => !ALL_BRANCH_APPS.has(x) && CAT_BRANCH[(appBySlug(x) || {}).cat] === d.id); // app khách nối thêm → mọc vào nhánh đúng thể loại
    const leaves = [...curated.map(([slug, vai]) => ({ slug, vai })), ...extra.map((slug) => ({ slug, vai: CAT_NAME[(appBySlug(slug) || {}).cat] || 'Ứng dụng của bạn', them: true }))]
      .map((l) => ({ ...l, name: (appBySlug(l.slug) || { name: l.slug }).name, on: connected.includes(l.slug) }));
    leaves.sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0));
    leaves.splice(8);
    const sch = schedules.filter((s) => s.bat && flows.some((w) => w.id === s.quy_trinh));
    let status = 'idle';
    if (waiting.length) status = 'wait';
    else if (working.length) status = 'work';
    else if (todo.length || approved.length) status = 'queue';
    else if (doneRecent.length) status = 'done';
    else if (!ready.length && flows.length) status = 'setup';
    const current = working[0] || waiting[0] || todo[0] || approved[0] || doneRecent[0] || null;
    return {
      id: d.id, name: d.name, status,
      counts: { lam: working.length, cho: todo.length + approved.length, duyet: waiting.length, xong_24h: doneRecent.length, tong: mine.length },
      current: current ? { id: current.id, tieu_de: current.tieu_de, trang_thai: effective(current), mo_ta: STATUSES[effective(current)], nguoi_lam: current.nguoi_lam || '', luc: current.cap_nhat } : null,
      flows: { tong: flows.length, san_sang: ready.length, goi_y: (ready[0] || flows[0] || {}).id || '' },
      apps, leaves, them_cat: BRANCH_CAT[d.id] || '', suggest: suggest.map((slug) => ({ slug, name: (appBySlug(slug) || { name: slug }).name })),
      schedules: sch.map((s) => ({ ten: s.ten, gio: s.gio, den: s.den || '', lap: s.lap || '', che_do: s.che_do })),
    };
  });

  // Bảng tin: lịch sử thật của 40 phiếu gần nhất.
  const events = [];
  for (const j of jobs.slice(0, 40)) {
    for (const h of (j.lich_su || []).slice(-4)) events.push({ luc: h.luc, viec: h.viec, tieu_de: j.tieu_de, phong: roomOf(j), id: j.id, trang_thai: j.trang_thai });
  }
  for (const l of leadList.slice(0, 20)) events.push({ luc: l.luc, viec: (l.muc_do === 'nong' ? 'Lead nóng' : 'Lead mới') + (l.nhu_cau ? ': ' + l.nhu_cau.slice(0, 80) : ''), tieu_de: l.ten + ' · ' + l.nguon, phong: 'ban_hang', lead: l.id });
  events.sort((a, b) => (a.luc < b.luc ? 1 : -1));

  const count = (st) => jobs.filter((j) => effective(j) === st).length;
  const week = jobs.filter((j) => ['da_dang', 'xong'].includes(j.trang_thai) && now - Date.parse(j.cap_nhat) < 7 * DAY_MS).length;
  const b = brand || {};
  const brandFilled = ['name', 'products', 'customers', 'voice', 'offers', 'faq'].filter((k) => b[k]).length;
  const lastAi = jobs.find((j) => j.nguoi_lam && j.nguoi_lam !== 'AI' && j.lich_su && j.lich_su.length);

  return Response.json({
    company: b.name || '',
    kpis: { cho_duyet: count('cho_duyet'), dang_lam: count('dang_lam') + count('cho_lam'), ai_lam: count('dang_lam'), cho_ai: count('cho_lam') + count('da_duyet'), da_xong_7_ngay: week, lich_bat: schedules.filter((s) => s.bat).length, app: connected.length, mcp: mcpUrls.length },
    rooms,
    events: events.slice(0, 14),
    brain: {
      app_mode: !!env.ANTHROPIC_API_KEY,
      ai_ngoai: aiseen ? { ten: aiseen.ten || 'AI của bạn', luc: aiseen.luc } : null,
      nguoi_lam_gan_nhat: lastAi ? { ten: lastAi.nguoi_lam, luc: lastAi.cap_nhat } : null,
    },
    setup: {
      brand: { filled: brandFilled, total: 6, style: !!(b.video_style || b.visual || (b.refs || []).length) },
      apps: connected.length, ai_linked: !!aiseen, jobs: jobs.length, schedules: schedules.length, composio_ok: accounts !== null,
      app_names: connected.slice(0, 12).map((s) => (appBySlug(s) || { name: s }).name),
    },
    leads: { ...leadStats(leadList), moi: leadList.slice(0, 8).map((l) => ({ id: l.id, ten: l.ten, sdt: l.sdt, nguon: l.nguon, nhu_cau: l.nhu_cau, muc_do: l.muc_do, trang_thai: l.trang_thai, luc: l.luc, link: l.link })) },
    autopilot: { bat: schedules.some((s) => s.nguon === 'cay' && s.bat), so_lich: schedules.filter((s) => s.nguon === 'cay' && s.bat).length,
      buoc: schedules.filter((s) => s.nguon === 'cay' && s.bat).map((s) => s.quy_trinh) },
    now: new Date(now).toISOString(),
  }, { headers: { 'cache-control': 'no-store' } });
};
