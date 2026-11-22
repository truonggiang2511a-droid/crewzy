// Kiểm tra "sẵn sàng" = đủ app + đủ dữ liệu (Brain, mẫu, quy trình chạy trước, nguồn số liệu) và bộ đọc web. Chạy: node scripts/readytest.mjs
import assert from 'node:assert/strict';
import { WORKFLOWS, workflowById, readiness, doneFlows } from '../src/lib/workflows.js';
import { extractPage, blockedHost } from '../src/lib/webRead.js';

const R = (id, ctx) => readiness(workflowById(id), { connected: [], mcpUrls: [], brand: {}, jobs: [], ...ctx });
const brain = { name: 'Nhà Xinh Minh Thùy', products: 'Nhà phố Bình Chánh' };

// 1. Khách mới, chưa nối gì: bước đầu Dựng Brain phải chạy được (Crewzy có sẵn đọc web).
assert.equal(R('brain_tu_website').san_sang, true);
assert.equal(R('doi_thu_website').san_sang, true);
// 2. Báo cáo tuần không còn "sẵn sàng" khi chưa có nguồn số liệu nào.
assert.equal(R('bao_cao_tuan').san_sang, false);
assert.equal(R('bao_cao_tuan').thieu_du_lieu[0].loai, 'nguon');
assert.equal(R('bao_cao_tuan', { connected: ['google_analytics'] }).san_sang, true);
// 3. Ảnh theo mẫu cần Brain + ảnh mẫu (và app làm ảnh có sẵn credit Crewzy).
let r = R('anh_quang_cao_theo_mau');
assert.equal(r.san_sang, false);
assert.deepEqual(r.thieu_du_lieu.map((x) => x.loai), ['brain', 'mau']);
assert.equal(R('anh_quang_cao_theo_mau', { brand: { ...brain, refs: [{ loai: 'anh_mau', url: 'https://x.vn/a.jpg' }] } }).san_sang, true);
// 4. Video theo phong cách cần sổ tay từ doi_thu_reels (hoặc phong cách video / video mẫu trong Brain).
r = R('video_theo_phong_cach', { brand: brain });
assert.equal(r.thieu_du_lieu[0].loai, 'truoc');
assert.equal(r.thieu_du_lieu[0].quy_trinh, 'doi_thu_reels');
assert.equal(R('video_theo_phong_cach', { brand: brain, jobs: [{ quy_trinh: 'doi_thu_reels', trang_thai: 'xong', noi_dung: 'Sổ tay' }] }).san_sang, true);
assert.equal(R('video_theo_phong_cach', { brand: brain, jobs: [{ quy_trinh: 'doi_thu_reels', trang_thai: 'xong', noi_dung: 'Chưa chạy tự động: hết lượt' }] }).san_sang, false);
assert.equal(R('video_theo_phong_cach', { brand: { ...brain, video_style: 'Hook 3 giây, phụ đề to' } }).san_sang, true);
assert.equal(R('video_theo_phong_cach', { brand: { ...brain, refs: [{ loai: 'video_mau', url: 'https://x' }] } }).san_sang, true);
// 5. Thiếu app vẫn báo thiếu nhóm; "nên có" không chặn.
assert.ok(R('tra_loi_binh_luan', { brand: brain }).thieu_nhom.length);
r = R('tra_loi_binh_luan', { brand: brain, connected: ['facebook'] });
assert.equal(r.san_sang, true);
assert.ok(r.nen_co.length);
assert.equal(R('de_xuat_chien_luoc', { brand: brain }).san_sang, false);
// 6. Mọi điều kiện trỏ tới quy trình có thật, mọi quy trình trả kết quả không lỗi.
for (const w of WORKFLOWS) {
  for (const c of w.can) if (c.loai === 'truoc') assert.ok(workflowById(c.quy_trinh), w.id + ' → ' + c.quy_trinh);
  const x = readiness(w, { connected: [], mcpUrls: [], brand: {}, done: new Set() });
  for (const t of x.thieu_du_lieu.concat(x.nen_co)) assert.ok(t.ten && t.cach && t.nut && t.link, w.id);
}
assert.equal(doneFlows([{ quy_trinh: 'a', trang_thai: 'cho_lam' }, { quy_trinh: 'b', trang_thai: 'cho_duyet' }]).has('b'), true);
// 7. Bộ đọc web: chặn địa chỉ nội bộ, tách chữ + link cùng website.
for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', 'printer.local', 'intranet']) assert.equal(blockedHost(h), true, h);
for (const h of ['nhaxinhminhthuy.vn', '8.8.8.8', 'www.google.com']) assert.equal(blockedHost(h), false, h);
const page = extractPage(`<html><head><title>Nhà Xinh &amp; Minh Thùy</title><meta name="description" content="Nhà phố Bình Chánh"><style>.a{}</style></head>
<body><script>var x=1</script><h1>Nhà phố 1 trệt 1 lầu</h1><p>Giá 2,9 tỷ</p><ul><li>Sổ hồng riêng</li></ul>
<a href="/bang-gia">Bảng giá</a><a href="https://other.com/x">Ngoài</a><a href="/anh.jpg">Ảnh</a><a href="/bang-gia#top">Trùng</a><a class=x href=/gioi-thieu>Giới thiệu</a><a href="#top">Lên</a></body></html>`, 'https://nhaxinh.vn/');
assert.equal(page.tieu_de, 'Nhà Xinh & Minh Thùy');
assert.equal(page.mo_ta, 'Nhà phố Bình Chánh');
assert.deepEqual(page.muc, ['Nhà phố 1 trệt 1 lầu']);
assert.ok(page.chu.includes('Giá 2,9 tỷ') && page.chu.includes('- Sổ hồng riêng') && !page.chu.includes('var x'));
assert.deepEqual(page.lien_ket.map((l) => l.url), ['https://nhaxinh.vn/bang-gia', 'https://nhaxinh.vn/gioi-thieu']);
console.log('readytest OK');
