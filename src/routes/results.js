// Màn Kết quả: GET /api/results?thang=YYYY-MM | ?tuan=1 (7 ngày gần nhất) → biên nhận việc AI đã làm + so với gói.
import { resolveUid } from '../lib/common.js';
import { listJobs } from '../lib/jobs.js';
import { buildResults, vnDay, vnMonth } from '../lib/activity.js';
import { getAccount, plans, publicAccount, billingOn } from '../lib/billing.js';

export function monthRange(m) {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const end = `${m}-${String(last).padStart(2, '0')}`;
  const today = vnDay();
  return { from: `${m}-01`, to: end < today ? end : today };
}

export default async (req, env) => {
  const url = new URL(req.url);
  const who = await resolveUid(req, env, url.searchParams.get('uid'));
  if (who.response) return who.response;
  const uid = who.uid;
  let range;
  if (url.searchParams.get('tuan')) range = { from: vnDay(Date.now() - 6 * 86400000), to: vnDay() };
  else {
    const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('thang') || '') ? url.searchParams.get('thang') : vnMonth();
    range = monthRange(m);
  }
  const [jobs, acc] = await Promise.all([listJobs(env, uid), env.DB ? getAccount(env, uid).catch(() => null) : null]);
  const plan = acc ? plans(env).find((p) => p.id === acc.plan) || null : null;
  const out = await buildResults(env, uid, { ...range, jobs, plan });
  return Response.json({ ...out, goi: plan ? { ten: plan.ten, gia: plan.gia, credits: plan.credits } : null, tai_khoan: acc && billingOn(env) ? publicAccount(env, acc) : null },
    { headers: { 'cache-control': 'no-store' } });
};
