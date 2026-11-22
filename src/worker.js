// Crewzy · Cloudflare Worker: phục vụ trang tĩnh trong public/ (binding ASSETS) và các API.
// /api/* và /mcp/* chạy Worker trước (wrangler.jsonc → assets.run_worker_first), còn lại trả file tĩnh.
import upload from './routes/upload.js';
import office from './routes/office.js';
import autopilot from './routes/autopilot.js';
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
import voice from './routes/voice.js';
import { runAgent, takeAppQuota } from './routes/chat.js';
import { runDueSchedules } from './lib/schedules.js';
import { submitResult } from './lib/jobs.js';
import { serveImage } from './lib/crewzyTools.js';
import { serveMedia } from './lib/media.js';
import { markWorking } from './lib/jobs.js';
import { gate, makeMeter, prices, plans } from './lib/billing.js';
import { runWeeklyReports } from './lib/activity.js';
import { listJobs } from './lib/jobs.js';

const ROUTES = {
  '/api/auth/me': auth, '/api/auth/google': auth, '/api/auth/logout': auth,
  '/api/brand': brand, '/api/catalog': catalog, '/api/chat': chat, '/api/connect': connect,
  '/api/mcp-link': mcpLink, '/api/mcp-links': mcpLinks, '/api/jobs': jobs, '/api/workflows': workflows, '/api/workflows/status': workflows, '/api/schedules': workflows, '/api/skill.md': jobs, '/api/mcp-servers': mcpServers, '/api/mcp-callback': mcpServers, '/api/oauth-client.json': mcpServers, '/api/openrouter-key': openrouterKey, '/api/status': status, '/api/office': office, '/api/autopilot': autopilot, '/api/results': results, '/api/kho': kho, '/api/giong-noi': voice,
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
    const runAuto = async (uid, job, prompt) => {
      if (!env.ANTHROPIC_API_KEY) {
        await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: 'Chưa chạy tự động: máy chủ chưa bật credit của Crewzy. Hãy giao cho AI của bạn hoặc bấm Làm ngay bằng Trợ lý Crewzy.', trang_thai: 'xong', nguoi_lam: 'Crewzy (hẹn giờ)' });
        return;
      }
      // Gói và credit (khi bật): hết hạn gói hoặc hết credit thì không tự chạy; còn thì trừ theo token + công cụ như chat.
      const blocked = await gate(env, uid, { needCredits: prices(env).min_start }).catch(() => null);
      if (blocked) {
        await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: 'Chưa chạy tự động: ' + blocked.error, trang_thai: 'xong', nguoi_lam: 'Crewzy (hẹn giờ)' });
        return;
      }
      const meter = await makeMeter(env, uid).catch(() => null);
      const over = meter ? null : await takeAppQuota(env, uid).catch(() => null);
      if (over) {
        await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: 'Chưa chạy tự động: ' + over, trang_thai: 'xong', nguoi_lam: 'Crewzy (hẹn giờ)' });
        return;
      }
      await markWorking(env, uid, job.id, 'Trợ lý Crewzy (hẹn giờ)').catch(() => {});
      const texts = [];
      // Tự trả lời bình luận chạy mỗi giờ → Haiku cho rẻ; lịch làm nội dung/báo cáo → Opus (mặc định).
      const brain = /TỰ TRẢ LỜI ĐÃ BẬT/.test(prompt) ? 'tiet_kiem' : 'can_bang'; // lịch nội dung/báo cáo chạy Sonnet (khớp số lượng trong mô tả gói)
      await runAgent({ env, uid, origin, mode: 'app', brain, messages: [{ role: 'user', content: prompt }], emit: (e) => { if (e.type === 'text') texts.push(e.text); }, timeBudgetMs: 240000, meter });
      console.log('auto run done', uid, job.id, texts.join(' ').slice(0, 200));
    };
    ctx.waitUntil(runWeeklyReports(env, { origin, submitResult, listJobs, plans: plans(env) }).then((r) => console.log('weekly', JSON.stringify(r))).catch((e) => console.error('weekly failed', e && e.stack)));
    ctx.waitUntil(runDueSchedules(env, { origin, runAuto }).then((r) => console.log('schedules', JSON.stringify(r))).catch((e) => console.error('schedules failed', e && e.stack)));
  },
};
