// Xem & duyệt nội dung trong chat (23/11): node scripts/publishtest.mjs
import assert from 'node:assert/strict';
import { goldenTimes, previewPosts, approvePosts, PUBLISH_TOOL_DEFS, publishUiHtml, UI_URI } from '../src/lib/publish.js';
import { submitResult, listJobs, takeDuePosts } from '../src/lib/jobs.js';
import { PLATFORM_FORMATS, WORKFLOW_RULES, workflowById } from '../src/lib/workflows.js';

const mem = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, v); } };
const env = { KV };
const O = 'https://crewzy.test';
const now = Date.parse('2026-11-23T05:00:00Z'); // 12:00 giờ VN
const g = goldenTimes(4, now);
assert.deepEqual(g.map((x) => new Date(Date.parse(x) + 7 * 3600e3).toISOString().slice(11, 16)), ['13:00', '15:00', '17:00', '19:00'], 'giờ vàng còn lại trong ngày');
assert.equal(goldenTimes(12, now).length, 12, 'hết khung hôm nay thì sang ngày mai');

const ids = [];
for (let i = 1; i <= 3; i++) {
  const r = await submitResult(env, 'u1', O, { tieu_de: 'Bài ' + i, noi_dung: 'Nội dung ' + i, loai: 'bai_dang', kenh: ['Facebook · Bảng tin', 'Instagram · Reels'], media: [O + '/api/media/a' + i + '.jpg'], ...(i === 1 ? { gio_dang: '2026-11-23T20:30:00+07:00' } : {}) });
  ids.push(r.data.id);
}
await submitResult(env, 'u1', O, { tieu_de: 'Báo cáo', noi_dung: 'x', loai: 'bao_cao' });
const p = await previewPosts(env, 'u1', O, {}, now);
assert.equal(p.data.so_bai, 3, 'chỉ bài đăng, không lẫn báo cáo');
assert.equal(p.data.bai.find((b) => b.id === ids[0]).gio_vang_vn.slice(0, 5), '20:30', 'giữ giờ AI đề xuất');
assert.ok(p.data.bai.every((b) => b.gio_vang && b.media.length === 1));

let a = await approvePosts(env, 'u1', { ids: [ids[0], ids[1]], cach: 'gio_vang' }, 'Khách', now);
assert.equal(a.data.da_duyet, 2);
const jobs = await listJobs(env, 'u1');
assert.ok(jobs.filter((j) => [ids[0], ids[1]].includes(j.id)).every((j) => j.trang_thai === 'da_duyet' && j.gio_dang));
assert.deepEqual(JSON.parse(mem.get('postidx')), ['u1'], 'vào hàng đăng theo giờ của Crewzy');
const due = await takeDuePosts(env, 'u1', Date.parse('2026-11-23T14:00:00Z'));
assert.equal(due.due.length, 2, 'tới giờ Crewzy tự đăng');

a = await approvePosts(env, 'u1', { ids: [ids[2]], cach: 'dang_ngay' }, 'Khách', now);
assert.ok(a.data.viec_tiep.includes('ĐĂNG NGAY'));
assert.ok(!(await listJobs(env, 'u1')).find((j) => j.id === ids[2]).gio_dang, 'đăng ngay: bỏ giờ hẹn để cron không đăng lại');
assert.ok((await approvePosts(env, 'u1', { ids: ['khong_co'], cach: 'gio_vang' })).error);
const h = await approvePosts(env, 'u2', { ids: ['x'], cach: 'hen_gio', gio: 'abc' });
assert.ok(h.error);

assert.deepEqual(PUBLISH_TOOL_DEFS.map((t) => t.function.name), ['CREWZY_XEM_NOI_DUNG', 'CREWZY_DUYET_HANG_LOAT']);
const html = publishUiHtml();
assert.ok(html.includes("'ui/initialize'") && html.includes('ui/notifications/tool-result') && html.includes('CREWZY_DUYET_HANG_LOAT') && html.includes("'ui/message'"));
assert.ok(UI_URI.startsWith('ui://'));
assert.ok(PLATFORM_FORMATS.instagram.vi_tri.some((v) => v.includes('INSTAGRAM_CREATE_CAROUSEL_CONTAINER')) && PLATFORM_FORMATS.facebook.vi_tri.some((v) => v.includes('FACEBOOK_PUBLISH_PAGE_REEL')));
for (const k of ['MỘT LẦN ĐỦ VỊ TRÍ', 'DUYỆT TRONG CHAT', 'ĐA DẠNG NỘI DUNG', 'ÂM THANH VIDEO']) assert.ok(WORKFLOW_RULES.some((r) => r.startsWith(k)), k);
assert.ok(WORKFLOW_RULES.find((r) => r.startsWith('ÂM THANH VIDEO')).includes('HỎI KHÁCH'), 'hỏi khách trước khi lồng giọng');
assert.ok(workflowById('san_xuat_5x5').buoc.some((b) => b.includes('5 DẠNG KHÁC NHAU') && b.includes('phụ đề')));
assert.ok(workflowById('san_xuat_5x5').buoc.some((b) => b.includes('CREWZY_XEM_NOI_DUNG')));
console.log('publishtest OK');
