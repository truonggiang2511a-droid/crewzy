// Worker "crewzy-render" (Cloudflare Containers, cần gói Workers Paid): nhận lệnh dựng từ Worker chính "crewzy" (RENDER_SECRET),
// chuyển vào container Renderer (HyperFrames + FFmpeg) rồi trả MP4 về. Worker chính tự lưu R2 + Kho và tính hạn mức gói.
import { Container, getContainer } from '@cloudflare/containers';

export class Renderer extends Container {
  defaultPort = 8080;
  sleepAfter = '3m'; // rảnh 3 phút thì tắt, không tốn tiền
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    if (!env.RENDER_SECRET || request.headers.get('authorization') !== 'Bearer ' + env.RENDER_SECRET) return new Response('Không có quyền', { status: 401 });
    if (request.method !== 'POST' || !['/render', '/image', '/mix'].includes(url.pathname)) return new Response('Không có', { status: 404 });
    // Chia việc ra vài máy (tối đa max_instances) để nhiều khách dựng cùng lúc.
    const slot = Math.floor(Math.random() * (Number(env.RENDER_SLOTS) || 3));
    const box = getContainer(env.RENDERER, 'r' + slot);
    return box.fetch(new Request('http://renderer' + url.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() }));
  },
};
