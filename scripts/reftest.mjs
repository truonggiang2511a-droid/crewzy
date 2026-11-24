// Thử mã mẫu (V1/A1…) và giữ bản phân tích AI khi trang lưu lại Brain.
import assert from 'node:assert/strict';
import { cleanBrand, brandText, brandPack, findRef } from '../src/lib/brand.js';

const L = (n) => `https://x.workers.dev/api/media/${String(n).padStart(24, 'a')}.mp4`;
let b = cleanBrand({ refs: [{ loai: 'video_mau', link: L(1) }, { loai: 'anh_mau', link: 'https://x.dev/a.jpg' }, { loai: 'video_mau', link: L(2) }] });
assert.deepEqual(b.refs.map((r) => r.ma), ['V1', 'A1', 'V2']);
// Máy chủ ghi phân tích, trang gửi lại refs không có phân tích → vẫn giữ; xoá V1 → V2 giữ mã, mẫu mới lấy V1 (số trống nhỏ nhất).
b.refs[2].phan_tich = 'Cảnh 1…'; b.refs[2].tom_tat = 'Dọc 9:16, cắt nhanh';
const b2 = cleanBrand({ refs: [{ loai: 'video_mau', link: L(2), ma: 'V2' }, { loai: 'anh_mau', link: 'https://x.dev/a.jpg', ma: 'A1' }, { loai: 'video_mau', link: L(3) }] }, b);
assert.deepEqual(b2.refs.map((r) => r.ma), ['V2', 'A1', 'V1']);
assert.equal(b2.refs[0].phan_tich, 'Cảnh 1…');
// Mã trùng / sai chữ đầu → cấp lại.
const b3 = cleanBrand({ refs: [{ loai: 'anh_mau', link: 'https://x.dev/1.jpg', ma: 'V9' }, { loai: 'anh_mau', link: 'https://x.dev/2.jpg', ma: 'A1' }, { loai: 'anh_mau', link: 'https://x.dev/3.jpg', ma: 'A1' }] });
assert.deepEqual(b3.refs.map((r) => r.ma), ['A2', 'A1', 'A3']);
const t = brandText(b2);
assert.ok(t.includes('[V2]') && t.includes('AI đã xem: Dọc 9:16') && t.includes('[V1]') && t.includes('AI chưa xem'));
const p = brandPack(b2);
assert.equal(p.mau_tham_khao[0].ai_da_xem, true);
assert.equal(p.mau_tham_khao[0].phan_tich, undefined);
assert.equal(findRef(b2, 'v2').link, L(2));
console.log('reftest ok');
