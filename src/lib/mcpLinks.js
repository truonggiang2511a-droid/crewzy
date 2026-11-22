// Quản lý link nối AI (MCP) của khách: mỗi link có mã k riêng nằm trong token (v3), lưu danh sách ở KV mcplinks:<uid>.
// Thu hồi = bỏ k khỏi danh sách → cổng /mcp/* từ chối link đó. Link v2 (trước 22/11, không có k) thu hồi chung bằng cu_off.
// Cổng đọc danh sách mỗi yêu cầu, có bộ nhớ đệm 20 giây trong isolate; KV nhất quán sau tối đa ~60 giây → thu hồi có hiệu lực trong khoảng 1 phút.
import { kvGetJson, kvPutJson } from './common.js';

export const MAX_LINKS = 20;
const key = (uid) => 'mcplinks:' + uid;
const cache = new Map();
const CACHE_MS = 20 * 1000;
const TOUCH_MS = 6 * 3600 * 1000; // ghi "lần dùng gần nhất" tối đa 6 giờ/lần để đỡ tốn lượt ghi KV

async function load(env, uid) {
  const v = await kvGetJson(env, key(uid)).catch(() => null);
  return { links: Array.isArray(v && v.links) ? v.links : [], cu_off: (v && v.cu_off) || null };
}
async function save(env, uid, data) {
  cache.delete(uid);
  await kvPutJson(env, key(uid), data);
}

function newId() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => a[x % a.length]).join('');
}

// Tên dễ hiểu theo thiết bị tạo link: "iPhone · 22/11 18:40".
export function deviceLabel(ua) {
  ua = String(ua || '');
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Máy khác';
  const t = new Date(Date.now() + 7 * 3600 * 1000); // giờ Việt Nam
  const p = (n) => String(n).padStart(2, '0');
  return `${dev} · ${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

export async function addLink(env, uid, ten) {
  const data = await load(env, uid);
  const k = newId();
  data.links.unshift({ k, ten: String(ten || 'Link nối AI').slice(0, 60), tao: new Date().toISOString() });
  // Quá 20 link: bỏ link cũ nhất chưa từng dùng trước, hết thì bỏ link cũ nhất.
  while (data.links.length > MAX_LINKS) {
    let i = -1;
    for (let j = data.links.length - 1; j > 0; j--) if (!data.links[j].dung) { i = j; break; }
    data.links.splice(i > 0 ? i : data.links.length - 1, 1);
  }
  await save(env, uid, data);
  return k;
}

export async function listLinks(env, uid) {
  return load(env, uid);
}

export async function revokeLink(env, uid, k) {
  const data = await load(env, uid);
  const before = data.links.length;
  data.links = data.links.filter((l) => l.k !== k);
  if (data.links.length === before) return false;
  await save(env, uid, data);
  return true;
}

export async function revokeOld(env, uid) {
  const data = await load(env, uid);
  data.cu_off = new Date().toISOString();
  await save(env, uid, data);
}

// Cổng gọi: link còn hiệu lực không. k = null là link v2 (chỉ bị chặn khi khách bấm Thu hồi link cũ).
export async function linkAllowed(env, uid, k) {
  const hit = cache.get(uid);
  let data = hit && Date.now() - hit.at < CACHE_MS ? hit.data : null;
  if (!data) {
    data = await load(env, uid);
    cache.set(uid, { at: Date.now(), data });
  }
  if (!k) return !data.cu_off;
  return data.links.some((l) => l.k === k);
}

// Lúc initialize: ghi AI nào đang dùng link này (Claude, ChatGPT…) để khách nhận ra link nào đang chạy ở đâu.
export async function touchLink(env, uid, k, aiName) {
  if (!k) return;
  const data = await load(env, uid);
  const l = data.links.find((x) => x.k === k);
  if (!l) return;
  const last = l.dung && Date.parse(l.dung.luc);
  if (last && Date.now() - last < TOUCH_MS && l.dung.ten === aiName) return;
  l.dung = { ten: aiName, luc: new Date().toISOString() };
  await save(env, uid, data);
}
