// Brain thương hiệu: các mục khách điền, làm sạch, và đoạn chữ nạp cho AI. Lưu KV khoá brand:<uid>.
export const BRAND_FIELDS = {
  name: 'Tên doanh nghiệp', industry: 'Ngành, lĩnh vực', products: 'Sản phẩm, dịch vụ chính', customers: 'Khách hàng mục tiêu',
  voice: 'Giọng văn', dos: 'Nên nói', donts: 'Không được nói', offers: 'Giá, ưu đãi, chính sách', faq: 'Câu hỏi khách hay hỏi',
  links: 'Website, Fanpage, kênh', hashtags: 'Hashtag, từ khoá',
};
const MAX_FIELD = 3000;

export const getBrand = (env, uid) => env.KV.get('brand:' + uid, { type: 'json' });
export const putBrand = (env, uid, brand) => env.KV.put('brand:' + uid, JSON.stringify(brand));

export function cleanBrand(raw) {
  const out = {};
  for (const f of Object.keys(BRAND_FIELDS)) {
    const v = raw && raw[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim().slice(0, MAX_FIELD);
  }
  return out;
}

export function brandText(brand) {
  return Object.entries(BRAND_FIELDS).filter(([k]) => brand && brand[k]).map(([k, label]) => `- ${label}: ${brand[k]}`).join('\n');
}
