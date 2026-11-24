// Brain thương hiệu: các mục khách điền, làm sạch, và đoạn chữ nạp cho AI. Lưu KV khoá brand:<uid>.
// Từ 22/11: thêm phong cách hình ảnh/video, giọng đọc + nhạc, và MẪU THAM KHẢO (refs): video viral khách thích, ảnh quảng cáo mẫu,
// giọng mẫu, nhạc, logo, tư liệu gốc. AI đọc hết trước mọi quy trình và làm theo mẫu (học cách làm, không sao chép).
export const BRAND_FIELDS = {
  name: 'Tên doanh nghiệp', industry: 'Ngành, lĩnh vực', products: 'Sản phẩm, dịch vụ chính', customers: 'Khách hàng mục tiêu',
  voice: 'Giọng văn', dos: 'Nên nói', donts: 'Không được nói', offers: 'Giá, ưu đãi, chính sách', faq: 'Câu hỏi khách hay hỏi',
  links: 'Website, Fanpage, kênh, link form thu khách, từ khoá bình luận (ví dụ "POST")', hashtags: 'Hashtag, từ khoá',
  visual: 'Nhận diện hình ảnh (logo, màu, font, phong cách ảnh)',
  video_style: 'Phong cách video (độ dài, hook 3 giây đầu, nhịp cắt, phụ đề, người dẫn hay không)',
  audio: 'Giọng đọc và nhạc (giọng nam/nữ, vùng miền, tốc độ, loại nhạc nền)',
  voice_provider: 'Dịch vụ giọng đọc',
  voice_id: 'Mã giọng / tên giọng',
};
// Mục bắt buộc đọc cho việc làm nội dung hình ảnh/video (CREWZY_QUY_TRINH báo thiếu).
export const MEDIA_FIELDS = ['visual', 'video_style', 'audio'];

export const VOICE_PROVIDERS = {
  elevenlabs: 'ElevenLabs', vbee: 'Vbee', fpt: 'FPT.AI', heygen: 'HeyGen', openai: 'OpenAI', google: 'Google', khac: 'Khác', ghi_am: 'Tự thu âm (giọng thật)',
};

export const REF_TYPES = {
  video_mau: 'Video mẫu khách thích (viral, kênh tham khảo)',
  anh_mau: 'Ảnh quảng cáo mẫu khách thích',
  giong_mau: 'Giọng đọc mẫu (giọng của khách hoặc giọng muốn giống)',
  nhac: 'Nhạc nền',
  logo: 'Logo, bộ nhận diện',
  tu_lieu: 'Tư liệu gốc (ảnh/video sản phẩm thật được phép dùng)',
};
const MAX_FIELD = 3000;
const MAX_REFS = 40;
// MÃ MẪU (25/11, Giang): mỗi mẫu có mã ngắn để khách gõ "làm theo mẫu V2" — V video, A ảnh, G giọng, N nhạc, L logo, T tư liệu.
export const REF_PREFIX = { video_mau: 'V', anh_mau: 'A', giong_mau: 'G', nhac: 'N', logo: 'L', tu_lieu: 'T' };
const CODE_RE = /^[A-Z]\d{1,3}$/;
const MAX_ANALYSIS = 8000;
const clipStr = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export const getBrand = (env, uid) => env.KV.get('brand:' + uid, { type: 'json' });
export const putBrand = (env, uid, brand) => env.KV.put('brand:' + uid, JSON.stringify(brand));

// Phân tích AI đã xem mẫu (phan_tich, tom_tat) chỉ máy chủ ghi (/api/phan-tich-mau); khi trang gửi refs lên thì giữ lại theo link từ bản cũ.
function cleanRefs(list, prev) {
  const old = new Map((Array.isArray(prev) ? prev : []).map((r) => [r.link, r]));
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || !REF_TYPES[r.loai] || typeof r.link !== 'string') continue;
    let url;
    try { url = new URL(r.link.trim()); } catch (e) { continue; }
    if (url.protocol !== 'https:') continue;
    const link = url.toString().slice(0, 600);
    const o = old.get(link) || {};
    const item = { loai: r.loai, link, ghi_chu: clipStr(r.ghi_chu, 300) };
    const ma = String(r.ma || o.ma || '').toUpperCase();
    if (CODE_RE.test(ma)) item.ma = ma;
    // Trang gửi lại phân tích nó đang giữ (tránh ghi đè lẫn nhau khi lưu đúng lúc AI vừa xem xong); thiếu thì lấy bản cũ.
    const pt = cleanAnalysis(r.phan_tich) || o.phan_tich;
    if (pt) {
      item.phan_tich = pt;
      item.tom_tat = clipStr(r.phan_tich ? r.tom_tat : o.tom_tat, 240);
      item.phan_tich_luc = clipStr(r.phan_tich ? r.phan_tich_luc : o.phan_tich_luc, 40);
    }
    out.push(item);
    if (out.length >= MAX_REFS) break;
  }
  return assignCodes(out);
}

// Mã trùng hoặc sai chữ đầu theo loại → cấp mã mới (số kế tiếp của loại đó). Mã cũ hợp lệ giữ nguyên để khách nhớ.
export function assignCodes(refs) {
  const used = new Set();
  for (const r of refs) {
    if (r.ma && r.ma[0] === REF_PREFIX[r.loai] && !used.has(r.ma)) used.add(r.ma); else delete r.ma;
  }
  for (const r of refs) {
    if (r.ma) continue;
    const p = REF_PREFIX[r.loai] || 'M';
    let n = 1;
    while (used.has(p + n)) n++;
    r.ma = p + n;
    used.add(r.ma);
  }
  return refs;
}

export function cleanAnalysis(text) { return clipStr(text, MAX_ANALYSIS); }
export const findRef = (brand, ma) => ((brand && brand.refs) || []).find((r) => r.ma === String(ma || '').trim().toUpperCase());

export function cleanBrand(raw, prev) {
  const out = {};
  for (const f of Object.keys(BRAND_FIELDS)) {
    const v = raw && raw[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim().slice(0, MAX_FIELD);
  }
  if (out.voice_provider && !VOICE_PROVIDERS[out.voice_provider]) delete out.voice_provider;
  // refs chỉ ghi khi gửi lên (phiếu "brain" của AI không có refs → giữ refs cũ khi gộp).
  if (raw && Array.isArray(raw.refs)) out.refs = cleanRefs(raw.refs, prev && prev.refs);
  return out;
}

export function brandText(brand) {
  if (!brand) return '';
  const lines = Object.entries(BRAND_FIELDS).filter(([k]) => brand[k]).map(([k, label]) => {
    const v = k === 'voice_provider' ? (VOICE_PROVIDERS[brand[k]] || brand[k]) : brand[k];
    return `- ${label}: ${v}`;
  });
  const refs = brand.refs || [];
  if (refs.length) {
    lines.push('- Mẫu tham khảo (học phong cách, bố cục, nhịp, màu; KHÔNG sao chép nội dung, logo, người trong mẫu). Mỗi mẫu có MÃ: khách nói "theo mẫu V2" = mẫu mã V2. Mẫu có "AI đã xem" thì gọi CREWZY_BRAIN {ma} đọc bản phân tích cách dựng chi tiết rồi làm theo đúng công thức đó:');
    for (const [k, label] of Object.entries(REF_TYPES)) {
      const items = refs.filter((r) => r.loai === k);
      if (!items.length) continue;
      lines.push(`  · ${label}:`);
      for (const r of items) lines.push(`    [${r.ma || '?'}] ${r.link}` + (r.ghi_chu ? ` (${r.ghi_chu})` : '') + (r.tom_tat ? ` — AI đã xem: ${r.tom_tat}` : r.loai === 'video_mau' ? ' — AI chưa xem được (chỉ có link)' : ''));
    }
  }
  return lines.join('\n');
}

// Gói đầy đủ cho quy trình: chữ + mẫu tham khảo + mục còn thiếu. AI phải đọc trước khi làm.
export function brandPack(brand, needMedia) {
  const b = brand || {};
  const thieu = Object.keys(BRAND_FIELDS).filter((k) => ['name', 'products', 'customers', 'voice'].includes(k) && !b[k]).map((k) => BRAND_FIELDS[k]);
  if (needMedia) for (const k of MEDIA_FIELDS) if (!b[k]) thieu.push(BRAND_FIELDS[k]);
  const refs = b.refs || [];
  return {
    tom_tat: brandText(b) || 'Chưa điền Brain thương hiệu.',
    // Bản phân tích đầy đủ dài → chỉ gửi tóm tắt; đọc chi tiết bằng CREWZY_BRAIN {ma}.
    mau_tham_khao: refs.map((r) => ({ ma: r.ma, loai: r.loai, link: r.link, ghi_chu: r.ghi_chu, ai_da_xem: !!r.phan_tich, tom_tat: r.tom_tat || '' })),
    giong_doc: b.voice_provider || b.voice_id ? { dich_vu: VOICE_PROVIDERS[b.voice_provider] || b.voice_provider || '', ma_giong: b.voice_id || '', giong_mau: refs.filter((r) => r.loai === 'giong_mau').map((r) => r.link) } : null,
    nhac: refs.filter((r) => r.loai === 'nhac').map((r) => r.link),
    thieu,
  };
}
