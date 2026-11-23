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
