// Danh mục app + Skill cho trang Kết nối, Quy trình. GET /api/catalog
import { publicCatalog } from '../lib/catalog.js';

export default async () => Response.json(publicCatalog(), { headers: { 'cache-control': 'public, max-age=300' } });

