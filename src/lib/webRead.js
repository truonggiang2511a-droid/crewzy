// CREWZY_DOC_WEB: Crewzy tự đọc một trang web công khai (website khách, đối thủ) để bước "Dựng Brain từ website"
// và "So sánh website đối thủ" không bị khoá vì thiếu app đọc web. Không đọc trang cần đăng nhập (Facebook, Instagram).
// Chỉ http/https, chặn địa chỉ nội bộ; đọc tối đa 1,5MB, trả tối đa 12.000 ký tự chữ + link cùng website để đọc tiếp.
const MAX_BYTES = 1_500_000;
const MAX_TEXT = 12000;
const MAX_LINKS = 40;
const MAX_IMAGES = 24;
const LOGIN_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|tiktok\.com|zalo\.me|linkedin\.com)$/i;

export function blockedHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || /\.(local|localhost|internal|lan|home|arpa)$/.test(h) || !h.includes('.') && !h.includes(':')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || /^(fc|fd|fe8|fe9|fea|feb)/.test(h) || h.startsWith('::ffff:');
  return false;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®' };
export function decode(t) {
  return String(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return ENT[e.toLowerCase()] ?? all;
  });
}
const clean = (t) => decode(String(t).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const meta = (html, re) => { const m = html.match(re); return m ? clean(m[1]) : ''; };

// Tách HTML thành tiêu đề, mô tả, mục, chữ chính, link cùng website. Hàm thuần để test bằng Node.
export function extractPage(html, pageUrl) {
  const base = new URL(pageUrl);
  let body = String(html).replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|canvas)\b[\s\S]*?<\/\1>/gi, ' ');
  const title = meta(body, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const mo_ta = meta(body, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || meta(body, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)
    || meta(body, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const muc = [];
  body.replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lv, t) => { const x = clean(t); if (x && muc.length < 40 && !muc.includes(x)) muc.push(x); return _; });
  const links = [];
  const seen = new Set();
  body.replace(/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi, (_, h1, h2, h3, t) => {
    const href = (h1 ?? h2 ?? h3 ?? '').split('#')[0];
    if (!href || links.length >= MAX_LINKS) return _;
    let u; try { u = new URL(decode(href), base); } catch (e) { return _; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return _;
    u.hash = '';
    const k = u.toString();
    if (k === base.toString() || seen.has(k) || /\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|mp3)(\?|$)/i.test(u.pathname)) return _;
    seen.add(k);
    links.push({ chu: clean(t).slice(0, 80), url: k });
    return _;
  });
  // Ảnh trên trang (để AI xem và lưu vào Kho làm content): og:image trước, rồi <img> (src, data-src, srcset lớn nhất). Bỏ icon, svg, ảnh 1px.
  const anh = [];
  const seenImg = new Set();
  const addImg = (raw, alt, w, h) => {
    if (!raw || anh.length >= MAX_IMAGES) return;
    let u; try { u = new URL(decode(raw.trim()), base); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol) || /\.(svg|ico)(\?|$)/i.test(u.pathname) || /(sprite|pixel|tracking|spacer|blank|1x1|favicon|icon[-_]?\d*\.)/i.test(u.pathname)) return;
    if ((w && Number(w) < 120) || (h && Number(h) < 120)) return;
    const k = u.toString();
    if (seenImg.has(k)) return;
    seenImg.add(k);
    anh.push({ url: k, mo_ta: clean(alt || '').slice(0, 100) || undefined });
  };
  const og = body.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i) || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (og) addImg(og[1], 'Ảnh đại diện của trang');
  body.replace(/<img\b[^>]*>/gi, (tag) => {
    const at = (n) => { const m = tag.match(new RegExp('\\s' + n + '=(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : ''; };
    let src = at('data-src') || at('data-lazy-src') || at('data-original') || at('src');
    const set = at('srcset') || at('data-srcset');
    if (set) { const best = set.split(',').map((x) => x.trim().split(/\s+/)).sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))[0]; if (best && best[0]) src = best[0]; }
    if (src && !src.startsWith('data:')) addImg(src, at('alt'), at('width'), at('height'));
    return tag;
  });
  const main = (body.match(/<main\b[\s\S]*?<\/main>/i) || body.match(/<body\b[\s\S]*<\/body>/i) || [body])[0];
  const text = decode(main
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|dd|dt)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { tieu_de: title, mo_ta, muc, chu: text.slice(0, MAX_TEXT), bi_cat: text.length > MAX_TEXT, lien_ket: links, anh };
}

async function readCapped(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.length;
    if (n >= MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
  }
  const all = new Uint8Array(Math.min(n, MAX_BYTES));
  let o = 0;
  for (const c of chunks) { const part = c.subarray(0, all.length - o); all.set(part, o); o += part.length; if (o >= all.length) break; }
  const ct = res.headers.get('content-type') || '';
  const cs = (ct.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
  try { return new TextDecoder(cs).decode(all); } catch (e) { return new TextDecoder().decode(all); }
}

export async function readWebsite(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || '').trim().replace(/^(?!https?:\/\/)/i, 'https://')); } catch (e) { return { error: 'Link không hợp lệ. Gửi dạng https://ten-mien.vn' }; }
  if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) return { error: 'Chỉ đọc được trang web công khai (http/https).' };
  if (LOGIN_HOSTS.test(u.hostname)) {
    return { error: u.hostname + ' cần đăng nhập nên Crewzy không đọc thẳng được. Fanpage/Instagram: nối app đó ở Crewzy → Kết nối rồi đọc bằng công cụ của app, hoặc nhờ khách dán vài bài gần đây.' };
  }
  let res;
  try {
    res = await fetch(u.toString(), {
      redirect: 'follow', signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; CrewzyBot/1.0; +https://crewzy.truonggiang2511a.workers.dev)', accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', 'accept-language': 'vi-VN,vi;q=0.9,en;q=0.7' },
    });
  } catch (e) {
    return { error: 'Không mở được ' + u.hostname + (e && e.name === 'TimeoutError' ? ' (quá 12 giây)' : '') + '. Kiểm tra lại link hoặc thử trang khác.' };
  }
  const final = new URL(res.url || u.toString());
  if (blockedHost(final.hostname)) return { error: 'Trang chuyển hướng tới địa chỉ không đọc được.' };
  if (!res.ok) return { error: `${final.hostname} trả lỗi ${res.status}. Trang có thể chặn máy đọc tự động: thử trang con khác, hoặc dùng công cụ đọc web của AI bạn.` };
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct && !/html|text\/plain|xml|json/.test(ct)) return { error: 'Link không phải trang web (loại ' + ct.split(';')[0] + ').' };
  const html = await readCapped(res);
  const page = /html|xml/.test(ct) || /<html|<body|<div/i.test(html) ? extractPage(html, final.toString()) : { tieu_de: '', mo_ta: '', muc: [], chu: html.slice(0, MAX_TEXT), bi_cat: html.length > MAX_TEXT, lien_ket: [], anh: [] };
  const it = page.chu.length < 300;
  return { data: { url: final.toString(), ...page,
    ghi_chu: (it ? 'Trang có rất ít chữ (có thể chạy bằng JavaScript hoặc chặn máy đọc). Thử các trang trong lien_ket, hoặc dùng công cụ đọc web của bạn.'
      : 'Đọc tiếp 2–5 trang quan trọng trong lien_ket (sản phẩm, dịch vụ, bảng giá, giới thiệu, liên hệ). Chỉ dùng thông tin thật đọc được.')
    + (page.anh && page.anh.length ? ' Trang có ' + page.anh.length + ' ảnh trong trường anh: xem ảnh bằng CREWZY_XEM_ANH để chọn ảnh đẹp, lưu vào Kho bằng CREWZY_LUU_KHO rồi dùng làm bài đăng hoặc ảnh mẫu (anh_mau) khi tạo ảnh/video.' : '') } };
}
