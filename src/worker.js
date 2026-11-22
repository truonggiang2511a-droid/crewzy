// Crewzy · Cloudflare Worker: phục vụ trang tĩnh trong public/ (binding ASSETS) và các API.
// /api/* và /mcp/* chạy Worker trước (wrangler.jsonc → assets.run_worker_first), còn lại trả file tĩnh.
import upload from './routes/upload.js';
import auth from './routes/auth.js';
import brand from './routes/brand.js';
import catalog from './routes/catalog.js';
import chat from './routes/chat.js';
import connect from './routes/connect.js';
import mcpLink from './routes/mcpLink.js';
import openrouterKey from './routes/openrouterKey.js';
import status from './routes/status.js';
import mcpGateway from './routes/mcpGateway.js';
import mcpServers from './routes/mcpServers.js';
import jobs from './routes/jobs.js';
import workflows from './routes/workflows.js';
import { runAgent, takeAppQuota } from './routes/chat.js';
import { runDueSchedules } from './lib/schedules.js';
import { submitResult } from './lib/jobs.js';
import { serveImage } from './lib/crewzyTools.js';
import { serveMedia } from './lib/media.js';

const ROUTES = {
  '/api/auth/me': auth, '/api/auth/google': auth, '/api/auth/logout': auth,
  '/api/brand': brand, '/api/catalog': catalog, '/api/chat': chat, '/api/connect': connect,
  '/api/mcp-link': mcpLink, '/api/jobs': jobs, '/api/workflows': workflows, '/api/schedules': workflows, '/api/skill.md': jobs, '/api/mcp-servers': mcpServers, '/api/mcp-callback': mcpServers, '/api/oauth-client.json': mcpServers, '/api/openrouter-key': openrouterKey, '/api/status': status,
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
      const over = await takeAppQuota(env, uid).catch(() => null);
      if (over) {
        await submitResult(env, uid, origin, { id: job.id, tieu_de: job.tieu_de, noi_dung: 'Chưa chạy tự động: ' + over, trang_thai: 'xong', nguoi_lam: 'Crewzy (hẹn giờ)' });
        return;
      }
      const texts = [];
      await runAgent({ env, uid, origin, mode: 'app', messages: [{ role: 'user', content: prompt }], emit: (e) => { if (e.type === 'text') texts.push(e.text); }, timeBudgetMs: 240000 });
      console.log('auto run done', uid, job.id, texts.join(' ').slice(0, 200));
    };
    ctx.waitUntil(runDueSchedules(env, { origin, runAuto }).then((r) => console.log('schedules', JSON.stringify(r))).catch((e) => console.error('schedules failed', e && e.stack)));
  },
};
