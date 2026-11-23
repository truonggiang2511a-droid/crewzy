// Máy dựng trong container (Node 22, không thư viện ngoài). Chỉ Worker crewzy-render gọi tới (container không mở ra Internet).
// POST /render {html, assets:[{name,url}]} → hyperframes render → MP4
// POST /image {html, assets, at} → dựng rồi lấy 1 khung → JPG (ảnh quảng cáo thiết kế)
// POST /mix {video, voice?, music?, srt?, music_volume?} → ffmpeg: nhạc nền (nhỏ lại khi có giọng), giọng đọc, phụ đề tiếng Việt → MP4
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';

const MAX_DL = 120 * 1024 * 1024;
const run = (cmd, args, cwd, ms = 240000) => new Promise((ok, no) => {
  const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  p.stdout.on('data', () => {});
  const t = setTimeout(() => { p.kill('SIGKILL'); no(new Error(cmd + ' quá thời gian')); }, ms);
  p.on('close', (c) => { clearTimeout(t); c === 0 ? ok() : no(new Error(cmd + ' lỗi ' + c + ': ' + err.slice(-600))); });
});
async function download(url, file) {
  if (!/^https:\/\//.test(url)) throw new Error('Chỉ nhận link https: ' + url);
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('Không tải được ' + url + ' (' + r.status + ')');
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > MAX_DL) throw new Error('File quá lớn: ' + url);
  await writeFile(file, b);
  return file;
}
const safe = (n) => basename(String(n || '')).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'file';
async function body(req) { const c = []; let n = 0; for await (const x of req) { n += x.length; if (n > 2e6) throw new Error('Yêu cầu quá lớn'); c.push(x); } return JSON.parse(Buffer.concat(c).toString('utf8') || '{}'); }
async function sendFile(res, file) {
  const s = await stat(file);
  res.writeHead(200, { 'content-type': file.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4', 'content-length': s.size });
  await new Promise((ok, no) => createReadStream(file).on('error', no).on('end', ok).pipe(res));
}

export async function mix(dir, j) {
  const v = await download(j.video, join(dir, 'in.mp4'));
  const args = ['-y', '-i', v];
  let idx = 1, voice = -1, music = -1;
  if (j.voice) { args.push('-i', await download(j.voice, join(dir, 'voice' + (j.voice.match(/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i) || ['', 'mp3'])[1]))); voice = idx++; }
  if (j.music) { args.push('-stream_loop', '-1', '-i', await download(j.music, join(dir, 'music' + (j.music.match(/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i) || ['', 'mp3'])[1]))); music = idx++; }
  const vf = [];
  if (j.srt) {
    await writeFile(join(dir, 'sub.srt'), String(j.srt).slice(0, 20000));
    vf.push("subtitles=sub.srt:force_style='FontName=Noto Sans,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=60,Alignment=2'");
  }
  const mv = Math.max(0.02, Math.min(1, Number(j.music_volume) || (voice >= 0 ? 0.18 : 0.6)));
  const af = [];
  if (voice >= 0 && music >= 0) af.push(`[${music}:a]volume=${mv}[m]`, `[${voice}:a]volume=1.0[v]`, '[v][m]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]');
  else if (voice >= 0) af.push(`[${voice}:a]volume=1.0,apad[a]`); // đệm im lặng để video không bị cắt theo độ dài giọng
  else if (music >= 0) af.push(`[${music}:a]volume=${mv}[a]`);
  if (vf.length) args.push('-vf', vf.join(','));
  if (af.length) args.push('-filter_complex', af.join(';'), '-map', '0:v:0', '-map', '[a]');
  else args.push('-map', '0:v:0', '-map', '0:a?');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4');
  await run('ffmpeg', args, dir);
  return join(dir, 'out.mp4');
}

export async function render(dir, j) {
  if (!/<html|<div/i.test(String(j.html || ''))) throw new Error('Thiếu html bản dựng HyperFrames');
  await writeFile(join(dir, 'index.html'), String(j.html).slice(0, 400000));
  for (const a of (j.assets || []).slice(0, 30)) await download(a.url, join(dir, safe(a.name)));
  try { await run('hyperframes', ['render', '-o', 'out.mp4'], dir, 280000); }
  catch (e) {
    // Dựng lỗi: chạy kiểm tra bản dựng để trả lý do cụ thể cho AI sửa.
    let lint = '';
    try { await run('hyperframes', ['lint'], dir, 60000); } catch (le) { lint = String(le.message || '').slice(-800); }
    throw new Error(String(e.message || e).slice(-500) + (lint ? ' | Kiểm tra bản dựng: ' + lint : ''));
  }
  return join(dir, 'out.mp4');
}

export async function image(dir, j) {
  const mp4 = await render(dir, j);
  const at = Math.max(0, Math.min(60, Number(j.at) || 0.5));
  await run('ffmpeg', ['-y', '-ss', String(at), '-i', mp4, '-frames:v', '1', '-q:v', '2', 'out.jpg'], dir, 60000);
  return join(dir, 'out.jpg');
}

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    const fn = req.method !== 'POST' ? null : req.url === '/render' ? render : req.url === '/image' ? image : req.url === '/mix' ? mix : null;
    if (!fn) { res.writeHead(404); return res.end('not found'); }
    const dir = await mkdtemp(join(tmpdir(), 'cz-'));
    try { await sendFile(res, await fn(dir, await body(req))); }
    catch (e) { if (!res.headersSent) { res.writeHead(400, { 'content-type': 'application/json' }); } res.end(JSON.stringify({ error: String(e.message || e).slice(0, 800) })); }
    finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
  }).listen(Number(process.env.PORT) || 8080);
}
