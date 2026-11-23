// Trực Fanpage 15 phút (23/11): node scripts/inboxtest.mjs — Composio giả, KV giả.
import assert from 'node:assert/strict';
import { watchUser, runInbox, newItems, inboxDue, listOf, hourlyCover } from '../src/lib/inbox.js';
import { listLeads } from '../src/lib/leads.js';

const mem = new Map();
let writes = 0;
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { writes++; mem.set(k, v); } };
const env = { KV, TEST_OFFLINE: '1' };
const PAGE = { id: '111', name: 'Nhà Xinh' };
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', '+0000');
let T0 = Date.parse('2026-11-23T03:00:00Z'); // 10:00 giờ VN
let feed = { posts: [], convs: [] };
const calls = [];
const run = async (_env, _uid, slug, args) => {
  calls.push(slug);
  if (slug === 'FACEBOOK_LIST_MANAGED_PAGES') return { data: { data: [PAGE] } };
  if (slug === 'FACEBOOK_GET_PAGE_POSTS') { assert.equal(args.page_id, '111'); return { data: { response_data: { data: feed.posts } } }; }
  if (slug === 'FACEBOOK_GET_PAGE_CONVERSATIONS') return { data: { data: feed.convs } };
  throw new Error('không có ' + slug);
};
const connected = { facebook: 1, gmail: 1 };

assert.ok(inboxDue({}, new Date(T0)), '10:00 có trực');
assert.ok(!inboxDue({}, new Date(Date.parse('2026-11-22T19:20:00Z'))), '2:20 sáng chỉ quét đầu giờ');
assert.ok(inboxDue({}, new Date(Date.parse('2026-11-22T19:05:00Z'))), '2:05 sáng quét');
assert.ok(!inboxDue({ INBOX: 'off' }, new Date(T0)));
assert.deepEqual(listOf({ data: { response_data: { data: [{ id: 'a' }] } } }), [{ id: 'a' }]);

// Lần đầu: ghi mốc, đọc danh sách Fanpage, không trả lời việc cũ.
feed.posts = [{ id: '111_9', message: 'Nhà mặt tiền 5,6 tỷ', comments: { data: [{ id: 'c_old', from: { id: '9', name: 'Cũ' }, message: 'giá?', created_time: iso(T0 - 3600e3) }] } }];
let r = await watchUser(env, 'u1', { run, now: new Date(T0), connected });
assert.equal(r.moi, 0, 'không trả lời bình luận trước khi bật');
assert.ok(calls.includes('FACEBOOK_LIST_MANAGED_PAGES'));

// 15 phút sau: không có gì mới → không ghi KV, không xếp AI.
calls.length = 0; const w0 = writes;
r = await watchUser(env, 'u1', { run, now: new Date(T0 + 15 * 60e3), connected });
assert.equal(r.moi, 0); assert.equal(writes, w0, 'không có gì mới thì không ghi KV');
assert.deepEqual(calls.sort(), ['FACEBOOK_GET_PAGE_CONVERSATIONS', 'FACEBOOK_GET_PAGE_POSTS'], '2 lượt gọi/Fanpage, không đọc lại danh sách trang');

// Có bình luận mới + câu trả lời của chính trang + tin nhắn có số điện thoại.
const t1 = T0 + 20 * 60e3;
feed.posts[0].comments.data.push(
  { id: 'c1', from: { id: '9', name: 'Chị Lan' }, message: 'Giá bao nhiêu vậy?', created_time: iso(t1) },
  { id: 'c2', from: { id: '111', name: 'Nhà Xinh' }, message: 'Dạ em gửi ạ', created_time: iso(t1) },
);
feed.convs = [
  { id: 't_1', updated_time: iso(t1), messages: { data: [{ id: 'm1', from: { id: '77', name: 'Anh Tâm' }, message: 'Cho anh xem nhà, sđt 0906 123 456', created_time: iso(t1) }] } },
  { id: 't_2', updated_time: iso(t1), messages: { data: [{ id: 'm2', from: { id: '111', name: 'Nhà Xinh' }, message: 'Dạ vâng', created_time: iso(t1) }] } },
];
r = await watchUser(env, 'u1', { run, now: new Date(T0 + 30 * 60e3), connected });
assert.equal(r.binh_luan, 1, 'bỏ bình luận của chính trang'); assert.equal(r.tin_nhan, 1, 'bỏ hội thoại tin cuối là của trang');
assert.equal(r.lead, 1); assert.equal(r.xep, true);
const q = JSON.parse(mem.get('evq:u1'));
assert.ok(q[0].prompt.includes('comment_id c1') && q[0].prompt.includes('PSID 77') && q[0].prompt.includes('FACEBOOK_SEND_MESSAGE'));
assert.ok(q[0].prompt.includes('Anh Tâm'), 'báo AI lead đã lưu');
assert.equal((await listLeads(env, 'u1'))[0].sdt, '0906123456');
assert.ok(JSON.parse(mem.get('evlog:u1'))[0].tieu_de.includes('AI đang trả lời'));

// Lượt sau: cùng dữ liệu → không trả lời lại.
r = await watchUser(env, 'u1', { run, now: new Date(T0 + 45 * 60e3), connected });
assert.equal(r.moi, 0, 'không trả lời 2 lần');

// Tin nhắn quá 24 giờ không gửi (luật Messenger).
const n = newItems(PAGE, [], [{ id: 't_9', updated_time: iso(T0 - 30 * 3600e3), messages: { data: [{ id: 'x', from: { id: '5' }, message: 'hi', created_time: iso(T0 - 30 * 3600e3) }] } }], { since: T0 - 40 * 3600e3, now: T0 });
assert.equal(n.messages.length, 0);

// Lịch mỗi giờ: chỉ có Facebook → bỏ lượt; có Instagram → chỉ lo Instagram.
assert.deepEqual(await hourlyCover(env, 'u1'), { khac: [] });
await watchUser(env, 'u2', { run, now: new Date(T0), connected: { facebook: 1, instagram: 1 } });
assert.deepEqual((await hourlyCover(env, 'u2')).khac, ['instagram']);
assert.equal(await hourlyCover(env, 'u9'), null);

// runInbox chỉ quét khách bật Run chế độ crewzy có lịch trả lời.
mem.set('schedidx', JSON.stringify(['u3', 'u4']));
mem.set('sched:u3', JSON.stringify([{ nguon: 'cay', bat: true, che_do: 'crewzy', quy_trinh: 'tra_loi_binh_luan' }]));
mem.set('sched:u4', JSON.stringify([{ nguon: 'cay', bat: true, che_do: 'ai_cua_toi', quy_trinh: 'tra_loi_binh_luan' }]));
mem.set('inbox:u3', JSON.stringify({ since: T0, pages: [PAGE], pages_at: T0, khac: [] }));
r = await runInbox(env, { now: new Date(T0 + 5 * 60e3), run });
assert.equal(r.users, 1);
console.log('inboxtest OK');
