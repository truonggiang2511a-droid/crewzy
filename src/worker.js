// Crewzy · Cloudflare Worker: phục vụ trang tĩnh trong public/ (binding ASSETS) và các API.
// /api/* và /mcp/* chạy Worker trước (wrangler.jsonc → assets.run_worker_first), còn lại trả file tĩnh.
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
import { serveImage } from './lib/crewzyTools.js';
import { serveMedia } from './lib/media.js';

const ROUTES = {
  '/api/auth/me': auth, '/api/auth/google': auth, '/api/auth/logout': auth,
  '/api/brand': brand, '/api/catalog': catalog, '/api/chat': chat, '/api/connect': connect,
  '/api/mcp-link': mcpLink, '/api/mcp-servers': mcpServers, '/api/mcp-callback': mcpServers, '/api/oauth-client.json': mcpServers, '/api/openrouter-key': openrouterKey, '/api/status': status,
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
      const handler = ROUTES[pathname];
      if (handler) return await handler(request, env, ctx);
      if (pathname.startsWith('/api/')) return Response.json({ error: 'Không có API này.' }, { status: 404 });
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('worker error', pathname, err && err.stack);
      return Response.json({ error: 'Máy chủ gặp lỗi, thử lại sau ít phút.' }, { status: 500 });
    }
  },
};
