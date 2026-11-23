// Thử "ảnh thật trước" + ghi chú tiến độ (23/11): node scripts/realphototest.mjs
import assert from 'node:assert/strict';
import { imageShortcut, realPhotos } from '../src/lib/crewzyTools.js';
import { memoText } from '../src/routes/chat.js';

const rows = [
  { id: 1, kind: 'image', url: 'https://x.dev/api/media/ai1.jpg', source: 'ai_tao', name: 'ảnh AI' },
  { id: 2, kind: 'image', url: 'https://x.dev/api/media/that1.jpg', source: 'tai_len', name: 'Nhà mặt tiền' },
  { id: 3, kind: 'image', url: 'https://x.dev/api/media/that2.jpg', source: 'web', name: 'Phòng khách' },
];
const db = (list) => ({ prepare: () => ({ bind: () => ({ all: async () => ({ results: list }) }) }) });
const env = { DB: db(rows) };

assert.deepEqual((await realPhotos(env, 'u')).map((r) => r.url), ['https://x.dev/api/media/that1.jpg', 'https://x.dev/api/media/that2.jpg'], 'bỏ ảnh AI tạo');
// Kho có ảnh thật, AI định vẽ ảnh nhanh → trả ảnh thật
const a = await imageShortcut(env, 'u', { prompt: 'a modern house', chat_luong: 'nhanh' }, { anh_dep: true });
assert.equal(a.anh_that.length, 2);
// Khách yêu cầu rõ ảnh AI → cho vẽ
assert.equal(await imageShortcut(env, 'u', { prompt: 'x', khach_yeu_cau_ai: true }, null), null);
// Có ảnh mẫu + gói có ảnh Đẹp → cho chạy Seedream
assert.equal(await imageShortcut(env, 'u', { prompt: 'x', chat_luong: 'dep', anh_mau: ['https://x.dev/a.jpg'] }, { anh_dep: true }), null);
// Có ảnh mẫu nhưng gói chưa có ảnh Đẹp → dùng thẳng ảnh thật, không hạ xuống ảnh giả
const b = await imageShortcut(env, 'u', { prompt: 'x', chat_luong: 'dep', anh_mau: ['https://x.dev/a.jpg'] }, { anh_dep: false });
assert.deepEqual(b.anh_that, ['https://x.dev/a.jpg']);
// Kho trống → vẽ như cũ
assert.equal(await imageShortcut({ DB: db([]) }, 'u', { prompt: 'x' }, null), null);

const m = memoText(['CREWZY_TAO_ANH: ĐÃ TẠO ảnh · https://x.dev/api/img/a.jpg', 'CREWZY_NOP_KET_QUA: ĐÃ NỘP phiếu chờ duyệt · id:j123'], true);
assert.ok(m.includes('KHÔNG tạo lại') && m.includes('DỪNG') && m.includes('j123'));
assert.equal(memoText([], false), '');
console.log('realphototest OK');

// Hẹn giờ đăng + lưu Brain (23/11)
import { parseGioDang, submitResult, takeDuePosts, updateJobByOwner } from '../src/lib/jobs.js';
import { runCrewzyTool } from '../src/lib/crewzyTools.js';
const mem = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, v); } };
const env2 = { KV };
const base = Date.parse('2026-11-23T08:00:00Z'); // 15:00 giờ VN
assert.equal(parseGioDang('19:00', base), '2026-11-23T12:00:00.000Z', '19:00 hôm nay giờ VN');
assert.equal(parseGioDang('07:00', base), '2026-11-24T00:00:00.000Z', 'đã qua → ngày mai');
assert.equal(parseGioDang('2026-11-24T19:00:00+07:00', base), '2026-11-24T12:00:00.000Z');
assert.equal(parseGioDang('2026-11-24 19:00', base), '2026-11-24T12:00:00.000Z', 'không múi giờ = giờ VN');
assert.equal(parseGioDang('xyz', base), '');
const r1 = await submitResult(env2, 'u9', 'https://x.dev', { tieu_de: 'Bài 1', noi_dung: 'abc', loai: 'bai_dang', gio_dang: '2026-11-23T15:00:00+07:00' });
assert.ok(r1.data.gio_dang);
assert.deepEqual(JSON.parse(mem.get('postidx')), ['u9']);
let t = await takeDuePosts(env2, 'u9', base + 3600e3);
assert.equal(t.due.length, 0, 'chưa duyệt thì chưa đăng'); assert.equal(t.con_hen, true);
await updateJobByOwner(env2, 'u9', r1.data.id, { action: 'duyet' });
t = await takeDuePosts(env2, 'u9', base - 3600e3);
assert.equal(t.due.length, 0, 'chưa tới giờ');
t = await takeDuePosts(env2, 'u9', base + 60e3);
assert.equal(t.due.length, 1, 'tới giờ + đã duyệt → đăng');
t = await takeDuePosts(env2, 'u9', base + 120e3);
assert.equal(t.due.length, 0, 'mỗi phiếu xếp 1 lần'); assert.equal(t.con_hen, false);
const b1 = await runCrewzyTool(env2, { uid: 'u9', origin: 'https://x.dev', name: 'CREWZY_LUU_BRAIN', args: { muc: { visual: 'Màu chính #0B5FFF, logo chữ CZ', voice: 'Thân thiện' } } });
assert.equal(b1.data.da_luu.length, 2);
await runCrewzyTool(env2, { uid: 'u9', origin: 'https://x.dev', name: 'CREWZY_LUU_BRAIN', args: { muc: { visual: 'Font Be Vietnam Pro' } } });
const br = JSON.parse(mem.get('brand:u9'));
assert.ok(br.visual.includes('#0B5FFF') && br.visual.includes('Be Vietnam Pro'), 'nối thêm');
await runCrewzyTool(env2, { uid: 'u9', origin: 'https://x.dev', name: 'CREWZY_LUU_BRAIN', args: { muc: { voice: 'Chuyên nghiệp' }, che_do: 'thay' } });
assert.equal(JSON.parse(mem.get('brand:u9')).voice, 'Chuyên nghiệp');
console.log('hẹn giờ + Brain OK');
