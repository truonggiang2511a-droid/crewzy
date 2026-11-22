// Hẹn giờ chạy quy trình. KV `sched:<uid>` = [{id, quy_trinh, gio 'HH:MM', ngay, che_do, bat, lan_cuoi, tao_luc}],
// KV `schedidx` = danh sách uid có lịch (để cron biết duyệt ai). Cron Cloudflare (wrangler.jsonc triggers) chạy mỗi 15 phút:
//   tới giờ → tạo phiếu việc (cho_lam) cho AI của khách nhận; che_do 'crewzy' thì Trợ lý Crewzy tự chạy bằng credit của app.
import { kvGetJson, kvPutJson } from './common.js';
import { workflowById, workflowPrompt } from './workflows.js';
import { createJob } from './jobs.js';

export const MAX_SCHEDULES = 10;
export const DAYS = { hang_ngay: 'Mỗi ngày', t2_t6: 'Thứ Hai – thứ Sáu', t2: 'Thứ Hai', t3: 'Thứ Ba', t4: 'Thứ Tư', t5: 'Thứ Năm', t6: 'Thứ Sáu', t7: 'Thứ Bảy', cn: 'Chủ nhật', ngay_1: 'Ngày 1 hằng tháng' };
export const MODES = { ai_cua_toi: 'Giao cho AI của tôi', crewzy: 'Trợ lý Crewzy tự làm' };
const LATE_WINDOW_MIN = 120; // quá giờ hẹn 2 tiếng thì bỏ lượt hôm đó
const AUTO_RUNS_PER_TICK = 3;

const key = (uid) => 'sched:' + uid;
export const listSchedules = async (env, uid) => (await kvGetJson(env, key(uid))) || [];

async function setIndex(env, uid, has) {
  const idx = (await kvGetJson(env, 'schedidx')) || [];
  const set = new Set(idx);
  if (has) set.add(uid); else set.delete(uid);
  if (set.size !== idx.length) await kvPutJson(env, 'schedidx', [...set]);
}

async function save(env, uid, list) {
  await kvPutJson(env, key(uid), list.slice(0, MAX_SCHEDULES));
  await setIndex(env, uid, list.length > 0);
}

export function vnNow(date = new Date()) {
  const d = new Date(date.getTime() + 7 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay(), dom: d.getUTCDate() };
}

function dayMatches(ngay, t) {
  const map = { cn: 0, t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6 };
  if (ngay === 'hang_ngay') return true;
  if (ngay === 't2_t6') return t.dow >= 1 && t.dow <= 5;
  if (ngay === 'ngay_1') return t.dom === 1;
  return map[ngay] === t.dow;
}

export function isDue(s, t) {
  if (!s.bat || s.lan_cuoi === t.day || !dayMatches(s.ngay, t)) return false;
  const [h, m] = String(s.gio || '').split(':').map(Number);
  const at = h * 60 + m;
  return t.minutes >= at && t.minutes - at <= LATE_WINDOW_MIN;
}

export async function createSchedule(env, uid, { quy_trinh, gio, ngay, che_do, ghi_chu }) {
  const w = workflowById(quy_trinh);
  if (!w) return { error: 'Không có quy trình này.' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(gio || ''))) return { error: 'Giờ không hợp lệ (dạng 08:00).' };
  if (!DAYS[ngay]) return { error: 'Chọn ngày chạy.' };
  const list = await listSchedules(env, uid);
  if (list.length >= MAX_SCHEDULES) return { error: `Tối đa ${MAX_SCHEDULES} lịch. Xoá bớt rồi thêm.` };
  const s = {
    id: 'h' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join(''),
    quy_trinh: w.id, ten: w.ten, gio, ngay, che_do: MODES[che_do] ? che_do : 'ai_cua_toi', bat: true, lan_cuoi: '',
    ghi_chu: String(ghi_chu || '').slice(0, 500), tao_luc: new Date().toISOString(),
  };
  list.push(s);
  await save(env, uid, list);
  return { schedule: s };
}

export async function updateSchedule(env, uid, id, action) {
  const list = await listSchedules(env, uid);
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return { error: 'Không tìm thấy lịch.' };
  if (action === 'xoa') list.splice(i, 1);
  else if (action === 'bat' || action === 'tat') list[i].bat = action === 'bat';
  else return { error: 'Thao tác không hợp lệ.' };
  await save(env, uid, list);
  return { ok: true };
}

// Cron: tạo phiếu việc cho lịch tới giờ; lịch chế độ 'crewzy' thì chạy Trợ lý ngay (tối đa AUTO_RUNS_PER_TICK lượt mỗi lần cron).
// runAuto(uid, job, prompt) do worker truyền vào (tránh vòng phụ thuộc với routes/chat.js).
export async function runDueSchedules(env, { origin, runAuto, now = new Date() }) {
  const t = vnNow(now);
  const uids = (await kvGetJson(env, 'schedidx')) || [];
  const auto = [];
  let created = 0;
  for (const uid of uids) {
    const list = await listSchedules(env, uid);
    let changed = false;
    for (const s of list) {
      if (!isDue(s, t)) continue;
      const w = workflowById(s.quy_trinh);
      s.lan_cuoi = t.day;
      changed = true;
      if (!w) continue;
      const extra = s.ghi_chu ? 'Ghi chú của chủ: ' + s.ghi_chu : '';
      const job = await createJob(env, uid, { quy_trinh: w.id, tieu_de: `${w.ten} (hẹn giờ ${s.gio})`, yeu_cau: workflowPrompt(w, extra), nguon: 'hen_gio' });
      created++;
      if (s.che_do === 'crewzy') auto.push({ uid, job, prompt: `Làm phiếu việc ${job.id}. ${workflowPrompt(w, extra)}\nNộp kết quả bằng CREWZY_NOP_KET_QUA kèm id ${job.id}. Không hỏi lại người dùng: thiếu thông tin thì ghi rõ trong ghi_chu.` });
    }
    if (changed) await kvPutJson(env, key(uid), list);
  }
  let ran = 0;
  for (const a of auto.slice(0, AUTO_RUNS_PER_TICK)) {
    try { await runAuto(a.uid, a.job, a.prompt, origin); ran++; } catch (e) { console.error('auto run failed', a.uid, e && e.message); }
  }
  return { created, ran, skipped: Math.max(0, auto.length - AUTO_RUNS_PER_TICK) };
}
