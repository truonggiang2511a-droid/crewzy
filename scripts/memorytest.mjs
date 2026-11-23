// Bộ nhớ AI học khách (23/11): node scripts/memorytest.mjs
import assert from 'node:assert/strict';
import { addMem, listMem, memText, memBlock, MEM_TOOL_DEFS } from '../src/lib/memory.js';
import { runCrewzyTool, CREWZY_TOOL_DEFS } from '../src/lib/crewzyTools.js';
import { submitResult, updateJobByOwner } from '../src/lib/jobs.js';

const mem = new Map();
const KV = { get: async (k, o) => { const v = mem.get(k); return v == null ? null : (o && o.type === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { mem.set(k, v); } };
const env = { KV };
assert.ok(CREWZY_TOOL_DEFS.some((t) => t.function.name === 'CREWZY_GHI_NHO'), 'có công cụ ghi nhớ');
let r = await runCrewzyTool(env, { uid: 'u1', origin: 'https://x.dev', name: 'CREWZY_GHI_NHO', args: { loai: 'tu_ngu', noi_dung: 'Xưng em, gọi khách là anh/chị' }, agent: 'Claude' });
assert.equal(r.data.da_luu, true);
r = await runCrewzyTool(env, { uid: 'u1', origin: 'https://x.dev', name: 'CREWZY_GHI_NHO', args: { loai: 'tu_ngu', noi_dung: '  xưng em,   gọi khách là anh/chị ' } });
assert.equal(r.data.da_co, true, 'trùng thì không lưu lại');
await addMem(env, 'u1', { loai: 'quy_tac', noi_dung: 'Không dùng emoji trong bài Facebook' });
for (let i = 0; i < 90; i++) await addMem(env, 'u1', { loai: 'phong_cach', noi_dung: 'Ghi chú thử ' + i });
const list = await listMem(env, 'u1');
assert.equal(list.length, 80, 'tối đa 80');
assert.ok(list.some((m) => m.loai === 'quy_tac'), 'đầy thì giữ quy tắc bắt buộc');
assert.ok(memText(list).includes('Không dùng emoji'));
assert.ok((await memBlock(env, 'u1')).startsWith('# Bộ nhớ'));
// CREWZY_BRAIN trả kèm bộ nhớ
const b = await runCrewzyTool(env, { uid: 'u1', origin: 'https://x.dev', name: 'CREWZY_BRAIN', args: {} });
assert.ok(b.data.bo_nho_ve_khach.includes('Không dùng emoji'));
// Góp ý khi duyệt → tự ghi bộ nhớ
const j = await submitResult(env, 'u2', 'https://x.dev', { tieu_de: 'Bài Facebook 1', noi_dung: 'abc', loai: 'bai_dang' });
await updateJobByOwner(env, 'u2', j.data.id, { action: 'lam_lai', ghi_chu: 'Câu mở đầu dài quá, viết ngắn lại' });
assert.ok(memText(await listMem(env, 'u2')).includes('Câu mở đầu dài quá'));
// Xoá
const id = (await listMem(env, 'u2'))[0].id;
r = await runCrewzyTool(env, { uid: 'u2', origin: 'https://x.dev', name: 'CREWZY_GHI_NHO', args: { xoa: id } });
assert.equal(r.data.da_xoa, true);
assert.equal((await listMem(env, 'u2')).length, 0);
assert.equal(MEM_TOOL_DEFS[0].function.name, 'CREWZY_GHI_NHO');
console.log('memorytest OK');
