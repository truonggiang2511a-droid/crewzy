// Crewzy · Cloudflare Worker: phục vụ trang tĩnh trong public/ (binding ASSETS) và các API.
// /api/* và /mcp/* chạy Worker trước (wrangler.jsonc → assets.run_worker_first), còn lại trả file tĩnh.
import upload from './routes/upload.js';
import office from './routes/office.js';
import autopilot from './routes/autopilot.js';
import leads from './routes/leads.js';
import { handleWebhook, runEventQueue } from './lib/events.js';
import { runBacklog, runDigest, runDuePosts } from './lib/ops.js';
import { runInbox } from './lib/inbox.js';
import { runJobAuto, runPendingRuns } from './lib/runner.js';
import run from './routes/run.js';
import auth from './routes/auth.js';
import brand from './routes/brand.js';
import catalog from './routes/catalog.js';
import chat from './routes/chat.js';
import connect from './routes/connect.js';
import mcpLink from './routes/mcpLink.js';
import mcpLinks from './routes/mcpLinks.js';
import openrouterKey from './routes/openrouterKey.js';
import status from './routes/status.js';
import mcpGateway from './routes/mcpGateway.js';
import mcpServers from './routes/mcpServers.js';
import jobs from './routes/jobs.js';
import workflows from './routes/workflows.js';
import billing from './routes/billing.js';
import results from './routes/results.js';
import kho from './routes/kho.js';
import business from './routes/business.js';
import memoryRoute from './routes/memory.js';
import refAnalyze from './routes/refAnalyze.js';
import voice from './routes/voice.js';
import { runAgent, takeAppQuota } from './routes/chat.js';
import { runDueSchedules } from './lib/schedules.js';
import { submitResult } from './lib/jobs.js';
import { serveImage } from './lib/crewzyTools.js';
import { serveMedia } from './lib/media.js';
import { markWorking } from './lib/jobs.js';
import { gate, makeMeter, prices, plans, getFeatures } from './lib/billing.js';
import { runWeeklyReports } from './lib/activity.js';
import { listJobs } from './lib/jobs.js';

const ROUTES = {
  '/api/auth/me': auth, '/api/auth/google': auth, '/api/auth/logout': auth,
  '/api/brand': brand, '/api/catalog': catalog, '/api/chat': chat, '/api/connect': connect,
  '/api/mcp-link': mcpLink, '/api/mcp-links': mcpLinks, '/api/jobs': jobs, '/api/workflows': workflows, '/api/workflows/status': workflows, '/api/schedules': workflows, '/api/skill.md': jobs, '/api/mcp-servers': mcpServers, '/api/mcp-callback': mcpServers, '/api/oauth-client.json': mcpServers, '/api/openrouter-key': openrouterKey, '/api/status': status, '/api/office': office, '/api/autopilot': autopilot, '/api/leads': leads, '/api/results': results, '/api/kho': kho, '/api/giong-noi': voice, '/api/doanh-nghiep': business, '/api/run': run, '/api/bo-nho': memoryRoute, '/api/phan-tich-mau': refAnalyze,
  '/api/billing': billing, '/api/billing/order': billing, '/api/billing/admin': billing, '/api/sepay/webhook': billing, '/api/onboarding': billing, '/api/onboarding/brand-from-web': billing,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    try {
      // Trang tĩnh phục vụ đúng tên file .html (html_handling: none) → '/' trả về index.html.
      if (pathname === '/') return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
      if (pathname.startsWith('/mcp/')) return await mcpGateway(request, env, ctx);
      if (pathname.startsWith('/api/img/')) return await serveImage(request, env);
      if (pathname.startsWith('/api/media/')) return await serveMedia(request, env);
      if (pathname === '/api/upload' || pathname.startsWith('/api/upload/')) return await upload(request, env);
      if (pathname === '/api/composio/webhook' && request.method === 'POST') return await handleWebhook(request, env, env.PUBLIC_ORIGIN || new URL(request.url).origin);
      const handler = ROUTES[pathname];
      if (handler) return await handler(request, env, ctx);
      if (pathname.startsWith('/api/')) return Response.json({ error: 'Không có API này.' }, { status: 404 });
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('worker error', pathname, err && err.stack);
      return Response.json({ error: 'Máy chủ gặp lỗi, thử lại sau ít phút.' }, { status: 500 });
    }
  },

  // Cron mỗi 15 phút (wrangler.jsonc → triggers.crons): chạy các quy trình đã hẹn giờ.
  async scheduled(controller, env, ctx) {
    const origin = env.PUBLIC_ORIGIN || 'https://crewzy.truonggiang2511a.workers.dev';
    // Chạy 1 phiếu bằng Trợ lý Crewzy (src/lib/runner.js runJobAuto: kiểm gói/credit, đo credit, nhận việc, chạy AI, AI quên nộp thì tự đóng phiếu).
    const runAuto = (uid, job, prompt) => runJobAuto(env, { uid, origin, job, prompt, deps: { runAgent, takeAppQuota } }).then((r) => console.log('auto run done', uid, job.id, (r && (r.error || r.text)) || ''));
    ctx.waitUntil(runWeeklyReports(env, { origin, submitResult, listJobs, plans: plans(env) }).then((r) => console.log('weekly', JSON.stringify(r))).catch((e) => console.error('weekly failed', e && e.stack)));
    ctx.waitUntil(runBacklog(env, { origin }).then((r) => console.log('backlog', JSON.stringify(r))).catch((e) => console.error('backlog failed', e && e.stack)));
    ctx.waitUntil(runDigest(env, { origin }).then((r) => console.log('digest', JSON.stringify(r))).catch((e) => console.error('digest failed', e && e.stack)));
    // Đăng bài hẹn giờ: xếp hàng TRƯỚC khi chạy hàng đợi để bài tới giờ được đăng ngay lượt này.
    await runDuePosts(env).then((r) => console.log('due posts', JSON.stringify(r))).catch((e) => console.error('due posts failed', e && e.stack));
    // Trực Fanpage 15 phút: quét bằng code trước hàng đợi để bình luận/tin nhắn mới được AI trả lời ngay lượt này.
    await runInbox(env).then((r) => console.log('inbox', JSON.stringify(r))).catch((e) => console.error('inbox failed', e && e.stack));
    ctx.waitUntil(runEventQueue(env, { origin, runAuto }).then((r) => console.log('events', JSON.stringify(r))).catch((e) => console.error('events failed', e && e.stack)));
    // Run trên cây mà trang đã đóng giữa chừng → làm nốt.
    ctx.waitUntil(runPendingRuns(env, { origin, deps: { runAgent, takeAppQuota } }).then((r) => console.log('runs', JSON.stringify(r))).catch((e) => console.error('runs failed', e && e.stack)));
    ctx.waitUntil(runDueSchedules(env, { origin, runAuto }).then((r) => console.log('schedules', JSON.stringify(r))).catch((e) => console.error('schedules failed', e && e.stack)));
  },
};
