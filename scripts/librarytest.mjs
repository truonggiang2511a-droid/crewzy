// Thử Kho lưu trữ (D1 giả bằng node:sqlite) + ảnh trong CREWZY_DOC_WEB + đính kèm ảnh trong tin nhắn.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { addItem, listItems, removeItem, usageBytes, libraryTool, guessKind } from '../src/lib/library.js';
import { extractPage } from '../src/lib/webRead.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0003_library.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql) { let p = []; const s = { bind(...a) { p = a.map((v) => (v === undefined ? null : v)); return s; },
  async run() { const r = db.prepare(sql).run(...p); return { meta: { changes: Number(r.changes) } }; },
  async first() { return db.prepare(sql).get(...p) ?? null; }, async all() { return { results: db.prepare(sql).all(...p) }; } }; return s; } };
const deleted = [];
const MEDIA = { async head(k) { return k === 'media/aaaaaaaaaaaaaaaaaaaaaaaa' ? { customMetadata: { uid: 'u1' } } : { customMetadata: { uid: 'khac' } }; }, async delete(k) { deleted.push(k); } };
const env = { DB, MEDIA };

assert.equal(guessKind('https://x.vn/a.JPG?v=1'), 'image');
assert.equal(guessKind('https://x.vn/a.mp4'), 'video');
assert.equal(guessKind('https://x.vn/bao-gia.pdf'), 'doc');
const id1 = await addItem(env, 'u1', { url: 'https://c.test/api/media/aaaaaaaaaaaaaaaaaaaaaaaa.jpg', kind: 'image', source: 'tai_len', size: 1000, name: 'Mặt tiền nhà' });
assert.ok(id1);
assert.equal(await addItem(env, 'u1', { url: 'https://c.test/api/media/aaaaaaaaaaaaaaaaaaaaaaaa.jpg', kind: 'image' }), null, 'cùng link không vào kho 2 lần');
await addItem(env, 'u1', { url: 'https://c.test/api/media/bbbbbbbbbbbbbbbbbbbbbbbb.mp4', kind: 'video', source: 'ai_tao', size: 5000 });
await addItem(env, 'u2', { url: 'https://c.test/api/media/cccccccccccccccccccccccc.jpg', kind: 'image', size: 9 });
assert.equal(await addItem(env, 'u1', { url: 'http://khong-an-toan.vn/a.jpg' }), null, 'chỉ nhận https');
assert.equal((await listItems(env, 'u1')).length, 2);
assert.equal((await listItems(env, 'u1', { kind: 'video' })).length, 1);
assert.equal((await listItems(env, 'u1', { q: 'tiền' })).length, 1);
assert.equal(await usageBytes(env, 'u1'), 6000);
const kho = await libraryTool(env, 'u1', 'https://c.test', 'CREWZY_KHO', { loai: 'image' });
assert.equal(kho.data.so_luong, 1);
assert.equal(await removeItem(env, 'u2', id1), false, 'không xoá được đồ của khách khác');
assert.equal(await removeItem(env, 'u1', id1), true);
assert.deepEqual(deleted, ['media/aaaaaaaaaaaaaaaaaaaaaaaa'], 'xoá file R2 của chính khách');

const page = extractPage('<html><head><meta property="og:image" content="/og.jpg"></head><body><img src="/logo.svg"><img src="/a.jpg" alt="Mặt tiền" width="800"><img src="/p.gif" width="1" height="1"><img srcset="/c-300.jpg 300w, /c-1200.jpg 1200w"></body></html>', 'https://nha.vn/');
assert.deepEqual(page.anh.map((a) => a.url), ['https://nha.vn/og.jpg', 'https://nha.vn/a.jpg', 'https://nha.vn/c-1200.jpg']);
console.log('librarytest OK');
