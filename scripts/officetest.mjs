// Kiểm Cây vận hành: mọi nhánh có trong DEPARTMENTS, mọi app của nhánh có trong catalog, quy trình chuyển nhánh đúng.
import assert from 'node:assert/strict';
import { BRANCH_APPS } from '../src/routes/office.js';
import { DEPARTMENTS, WORKFLOWS } from '../src/lib/workflows.js';
import { appBySlug } from '../src/lib/catalog.js';
const ids = DEPARTMENTS.map((d) => d.id);
for (const [k, list] of Object.entries(BRANCH_APPS)) {
  assert.ok(ids.includes(k), 'nhánh lạ ' + k);
  for (const [slug, vai] of list) { assert.ok(appBySlug(slug), 'app không có trong catalog: ' + slug); assert.ok(vai); }
}
for (const id of ids) assert.ok(BRANCH_APPS[id], 'nhánh thiếu app: ' + id);
for (const w of WORKFLOWS) assert.ok(ids.includes(w.phong), w.id);
assert.equal(WORKFLOWS.find((w) => w.id === 'dang_bai_da_duyet').phong, 'phan_phoi');
assert.equal(WORKFLOWS.find((w) => w.id === 'de_xuat_chien_luoc').phong, 'chien_luoc');
console.log('officetest OK', ids.length, 'nhánh');
