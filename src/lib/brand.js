// Brain thương hiệu: các mục khách điền, làm sạch, và đoạn chữ nạp cho AI. Lưu KV khoá brand:<uid>.
// Từ 22/11: thêm phong cách hình ảnh/video, giọng đọc + nhạc, và MẪU THAM KHẢO (refs): video viral khách thích, ảnh quảng cáo mẫu,
// giọng mẫu, nhạc, logo, tư liệu gốc. AI đọc hết trước mọi quy trình và làm theo mẫu (học cách làm, không sao chép).
export const BRAND_FIELDS = {
  name: 'Tên doanh nghiệp', industry: 'Ngành, lĩnh vực', products: 'Sản phẩm, dịch vụ chính', customers: 'Khách hàng mục tiêu',
  voice: 'Giọng văn', dos: 'Nên nói', donts: 'Không được nói', offers: 'Giá, ưu đãi, chính sách', faq: 'Câu hỏi khách hay hỏi',
  links: 'Website, Fanpage, kênh', hashtags: 'Hashtag, từ khoá',
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

export const getBrand = (env, uid) => env.KV.get('brand:' + uid, { type: 'json' });
export const putBrand = (env, uid, brand) => env.KV.put('brand:' + uid, JSON.stringify(brand));

function cleanRefs(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || !REF_TYPES[r.loai] || typeof r.link !== 'string') continue;
    let url;
    try { url = new URL(r.link.trim()); } catch (e) { continue; }
    if (url.protocol !== 'https:') continue;
    out.push({ loai: r.loai, link: url.toString().slice(0, 600), ghi_chu: String(r.ghi_chu || '').trim().slice(0, 300) });
    if (out.length >= MAX_REFS) break;
  }
  return out;
}

export function cleanBrand(raw) {
  const out = {};
  for (const f of Object.keys(BRAND_FIELDS)) {
    const v = raw && raw[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim().slice(0, MAX_FIELD);
  }
  if (out.voice_provider && !VOICE_PROVIDERS[out.voice_provider]) delete out.voice_provider;
  // refs chỉ ghi khi gửi lên (phiếu "brain" của AI không có refs → giữ refs cũ khi gộp).
  if (raw && Array.isArray(raw.refs)) out.refs = cleanRefs(raw.refs);
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
    lines.push('- Mẫu tham khảo (học phong cách, bố cục, nhịp, màu; KHÔNG sao chép nội dung, logo, người trong mẫu):');
    for (const [k, label] of Object.entries(REF_TYPES)) {
      const items = refs.filter((r) => r.loai === k);
      if (items.length) lines.push(`  · ${label}: ` + items.map((r) => r.link + (r.ghi_chu ? ` (${r.ghi_chu})` : '')).join('; '));
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
    mau_tham_khao: refs,
    giong_doc: b.voice_provider || b.voice_id ? { dich_vu: VOICE_PROVIDERS[b.voice_provider] || b.voice_provider || '', ma_giong: b.voice_id || '', giong_mau: refs.filter((r) => r.loai === 'giong_mau').map((r) => r.link) } : null,
    nhac: refs.filter((r) => r.loai === 'nhac').map((r) => r.link),
    thieu,
  };
}
