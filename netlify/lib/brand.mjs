// Brain thương hiệu: các mục khách điền, làm sạch, và đoạn chữ nạp cho AI.
import { getStore } from '@netlify/blobs';

export const BRAND_FIELDS = {
  name: 'Tên doanh nghiệp', industry: 'Ngành, lĩnh vực', products: 'Sản phẩm, dịch vụ chính', customers: 'Khách hàng mục tiêu',
  voice: 'Giọng văn', dos: 'Nên nói', donts: 'Không được nói', offers: 'Giá, ưu đãi, chính sách', faq: 'Câu hỏi khách hay hỏi',
  links: 'Website, Fanpage, kênh', hashtags: 'Hashtag, từ khoá',
};
const MAX_FIELD = 3000;

export const brandStore = () => getStore({ name: 'vpai-brand', consistency: 'strong' });

export function cleanBrand(raw) {
  const out = {};
  for (const f of Object.keys(BRAND_FIELDS)) {
    const v = raw && raw[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim().slice(0, MAX_FIELD);
  }
  return out;
}

export function brandText(brand) {
  const lines = Object.entries(BRAND_FIELDS).filter(([k]) => brand && brand[k]).map(([k, label]) => `- ${label}: ${brand[k]}`);
  return lines.join('\n');
}
