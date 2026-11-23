// BỘ NÃO PROMPT CẤP CAO (23/11, Giang: "AI Crewzy là trợ lý prompt cấp cao: vào app khách nối (Higgsfield…) viết prompt chuyên nghiệp làm ảnh/video,
// kết quả về Crewzy để khách duyệt; AI content viết hay, dễ lên xu hướng").
// CREWZY_PROMPT_PRO KHÔNG gọi thêm AI (không tốn token): ghép Brain thương hiệu + mẫu tham khảo + luật riêng từng app ảnh/video + định dạng từng kênh
// thành "bản chỉ đạo" (brief). AI đang làm việc (Trợ lý Crewzy hoặc AI của khách) dựa vào đó viết prompt cuối, gọi app, rồi nộp phiếu kèm prompt_da_dung
// để khách xem/sửa/làm lại. Có trong chat và link nối AI (MCP).
import { getBrand, brandPack } from './brand.js';

// Luật viết prompt cho từng công cụ (theo cách các app này hiểu prompt tốt nhất).
const APP_RULES = {
  higgsfield: { ten: 'Higgsfield', ngon_ngu: 'tiếng Anh',
    cach: ['Viết 1 đoạn tiếng Anh 40–90 từ theo thứ tự: chủ thể + hành động → bối cảnh → ánh sáng → chuyển động máy quay → phong cách/ống kính → không khí.',
      'Chọn 1 chuyển động máy rõ ràng (slow dolly-in, orbit 180°, crane up, handheld follow, FPV fly-through, crash zoom) — không trộn nhiều chuyển động trong 1 cảnh.',
      'Video 5–10 giây/cảnh; video dài thì chia nhiều cảnh rồi ghép, mỗi cảnh 1 prompt.',
      'Có ảnh sản phẩm/ảnh mẫu thì dùng chế độ ảnh → video (image-to-video) để giữ đúng sản phẩm thật.'],
    mau: 'Close-up of {chu_the}, {hanh_dong}, in {boi_canh}, golden-hour rim light, slow dolly-in, shallow depth of field, 35mm anamorphic, cinematic color grade, {phong_cach}, vertical 9:16' },
  heygen: { ten: 'HeyGen', ngon_ngu: 'tiếng Việt cho lời thoại',
    cach: ['Viết kịch bản lời nói 60–120 chữ/30 giây, câu ngắn, có ngắt nghỉ; 3 giây đầu là hook.', 'Ghi cảnh nền, trang phục, cử chỉ theo từng đoạn.', 'Chọn giọng/avatar theo Brain (giọng nam/nữ, vùng miền).'] },
  canva: { ten: 'Canva', ngon_ngu: 'tiếng Việt',
    cach: ['Canva API không vẽ ảnh từ chữ: tạo ảnh bằng CREWZY_TAO_ANH/Higgsfield trước, rồi tải vào Canva làm thiết kế (chữ, logo, khung).', 'Brief: khổ, tiêu đề ≤8 chữ, màu/font theo nhận diện, vị trí logo.'] },
  crewzy_anh: { ten: 'Ảnh AI của Crewzy (CREWZY_TAO_ANH)', ngon_ngu: 'tiếng Anh',
    cach: ['Prompt tiếng Anh chi tiết: chủ thể cụ thể, chất liệu, bố cục (rule of thirds, chừa khoảng trống cho chữ), ánh sáng, ống kính, màu thương hiệu.',
      'Chất lượng Đẹp (gói Tăng trưởng trở lên) nhận ảnh mẫu (anh_mau) để giữ phong cách/sản phẩm.', 'Không viết chữ dài trong ảnh — chữ thêm sau bằng Canva.'],
    mau: '{chu_the}, {boi_canh}, soft natural window light, editorial product photography, 50mm, clean composition with negative space at top for text, {mau_sac}, photorealistic, high detail' },
  crewzy_video: { ten: 'Video AI của Crewzy (CREWZY_TAO_VIDEO)', ngon_ngu: 'tiếng Anh',
    cach: ['1 cảnh 5–10 giây, 1 hành động + 1 chuyển động máy.', 'Có ảnh sản phẩm thì truyền ảnh để video chuyển động từ ảnh thật.'] },
  descript_mcp: { ten: 'Descript', ngon_ngu: 'tiếng Việt', cach: ['Cắt khoảng lặng, thêm phụ đề lớn giữa màn, nhịp cắt 1–2 giây/cảnh cho video ngắn.'] },
  captions: { ten: 'Captions', ngon_ngu: 'tiếng Việt', cach: ['Phụ đề động theo từ, nhấn màu từ khoá; hook chữ to 3 giây đầu.'] },
  elevenlabs: { ten: 'ElevenLabs', ngon_ngu: 'tiếng Việt', cach: ['Lời đọc viết như nói: câu ngắn, dấu phẩy để ngắt, số viết bằng chữ khi cần đọc tự nhiên.'] },
};

// Định dạng + công thức nội dung dễ lên xu hướng theo từng kênh.
const CHANNEL = {
  tiktok: { kho: '9:16, 15–45 giây', hook: '1–2 giây đầu: câu gây tò mò/nỗi đau + chữ to giữa màn', bai: 'Caption ≤150 ký tự, 3–5 hashtag (1–2 hashtag xu hướng + ngách + thương hiệu)', cta: 'Bình luận từ khoá để nhận thông tin' },
  instagram: { kho: 'Reels 9:16 15–30 giây; bài 4:5; carousel 4:5 tối đa 10 ảnh', hook: 'Khung đầu tiên đủ hiểu khi tắt tiếng', bai: 'Dòng đầu ≤125 ký tự là hook, xuống dòng thoáng, 5–10 hashtag cuối bài', cta: 'Lưu lại / nhắn tin từ khoá' },
  facebook: { kho: 'Video 4:5 hoặc 9:16; ảnh 4:5', hook: 'Câu đầu nói thẳng lợi ích/nỗi lo, trước nút Xem thêm', bai: '80–200 chữ, kể chuyện ngắn hoặc danh sách 3–5 ý, 1–3 hashtag', cta: 'Nhắn tin Fanpage / bình luận để được tư vấn' },
  youtube: { kho: 'Shorts 9:16 ≤60 giây; video dài 16:9', hook: 'Tiêu đề ≤60 ký tự có từ khoá + con số; Shorts vào thẳng nội dung', bai: 'Mô tả 2 dòng đầu chứa từ khoá, 3 hashtag', cta: 'Đăng ký kênh / link mô tả' },
  linkedin: { kho: 'Ảnh 1:1 hoặc 4:5, tài liệu PDF carousel', hook: 'Dòng đầu là nhận định/con số gây chú ý', bai: '120–250 chữ, đoạn 1–2 câu, giọng chuyên gia, 3 hashtag', cta: 'Hỏi ý kiến cuối bài để kéo bình luận' },
  threads: { kho: 'Chữ, ảnh 4:5', hook: 'Câu mở như đang nói chuyện', bai: '≤500 ký tự, 1 ý, có thể chuỗi 3–5 bài', cta: 'Đặt câu hỏi mở' },
  x: { kho: 'Ảnh 16:9 hoặc 1:1, video ≤2 phút', hook: 'Câu đầu ≤100 ký tự', bai: '≤280 ký tự hoặc chuỗi bài, 1–2 hashtag', cta: 'Trả lời / đăng lại' },
  pinterest: { kho: '2:3 (1000×1500)', hook: 'Chữ lớn trên ảnh nêu lợi ích', bai: 'Tiêu đề có từ khoá tìm kiếm, mô tả 2–3 câu', cta: 'Link về website' },
};
const alias = (k) => ({ twitter: 'x', upload_post: 'tiktok', reels: 'instagram', shorts: 'youtube' }[k] || k);

export const PROMPT_TOOL_DEFS = [{ type: 'function', function: {
  name: 'CREWZY_PROMPT_PRO',
  description: 'BỘ NÃO PROMPT: gọi TRƯỚC khi làm ảnh/video (Higgsfield, HeyGen, Canva, CREWZY_TAO_ANH/VIDEO, MCP ảnh-video khác) hoặc viết bài đăng. Trả bản chỉ đạo: tóm tắt thương hiệu, phong cách hình ảnh/video, ảnh mẫu khách thích, luật viết prompt riêng của app đó (khung prompt mẫu), khổ/độ dài từng kênh, công thức hook–nội dung–CTA–hashtag dễ lên xu hướng, danh sách tự kiểm. Bạn viết prompt cuối theo đó, gọi app, rồi nộp CREWZY_NOP_KET_QUA kèm prompt_da_dung.',
  parameters: { type: 'object', properties: {
    loai: { type: 'string', enum: ['anh', 'video', 'bai_viet'], description: 'Làm ảnh, video hay chỉ viết bài.' },
    app: { type: 'string', description: 'App sẽ dùng: higgsfield, heygen, canva, crewzy_anh, crewzy_video, descript_mcp, captions, elevenlabs… (bỏ trống nếu chỉ viết bài).' },
    muc_tieu: { type: 'string', description: 'Nội dung cần làm (sản phẩm, ưu đãi, chủ đề, ý tưởng đã chọn).' },
    kenh: { type: 'array', items: { type: 'string' }, description: 'Kênh sẽ đăng: tiktok, instagram, facebook, youtube, linkedin, threads, x, pinterest.' },
  }, required: ['loai'] },
} }];

export async function promptPro(env, uid, args) {
  const a = args || {};
  const brand = (await getBrand(env, uid).catch(() => null)) || {};
  const pack = brandPack(brand, a.loai !== 'bai_viet');
  const appKey = String(a.app || (a.loai === 'anh' ? 'crewzy_anh' : a.loai === 'video' ? 'crewzy_video' : '')).toLowerCase().replace(/^m[0-9a-f]{4}_.*$/, 'higgsfield');
  const rules = APP_RULES[appKey] || (appKey ? { ten: appKey, ngon_ngu: 'tiếng Anh cho ảnh/video', cach: ['Đọc mô tả công cụ của app, dùng đúng tham số khổ/độ dài; prompt theo thứ tự chủ thể → bối cảnh → ánh sáng → máy quay → phong cách.'] } : null);
  const kenh = [...new Set((a.kenh && a.kenh.length ? a.kenh : ['facebook', 'instagram', 'tiktok']).map((k) => alias(String(k).toLowerCase())))].filter((k) => CHANNEL[k]);
  const mau = (brand.refs || []).filter((r) => ['video_mau', 'anh_mau', 'logo'].includes(r.loai)).slice(0, 8);
  return { data: {
    buoc: [
      '1. Đọc thuong_hieu + phong_cach + mau_khach_thich dưới đây; muc_tieu chưa rõ thì chọn góc bán hàng mạnh nhất từ sản phẩm/ưu đãi trong Brain, không bịa giá.',
      '2. Tìm xu hướng nếu có công cụ (SerpApi/Tavily/Perplexity, vidIQ, Apify TikTok/Reels): âm thanh, định dạng, chủ đề đang lên trong ngách 7 ngày gần đây; không có thì dùng công thức kênh bên dưới.',
      '3. Viết prompt cuối theo luat_app (đúng ngôn ngữ, đủ chủ thể/bối cảnh/ánh sáng/máy quay/phong cách, màu và cảm xúc thương hiệu); có ảnh mẫu/ảnh sản phẩm thì truyền vào app để giữ đúng sản phẩm thật.',
      '4. Gọi app tạo 2–3 phương án (khác góc máy hoặc khác hook) để khách chọn; mỗi kênh đúng khổ trong dinh_dang_kenh.',
      '5. Viết bài riêng từng kênh theo cong_thuc_kenh (hook → giá trị → CTA → hashtag), giọng văn theo Brain.',
      '6. Chạy tu_kiem, rồi nộp CREWZY_NOP_KET_QUA: anh/video = link media_crewzy, noi_dung = bài từng kênh, prompt_da_dung = prompt đã gửi app, app_da_dung = tên app. Khách duyệt/yêu cầu làm lại trong Crewzy.',
    ],
    thuong_hieu: pack.tom_tat,
    phong_cach: { hinh_anh: brand.visual || '', video: brand.video_style || '', am_thanh: brand.audio || '', hashtag_thuong_hieu: brand.hashtags || '' },
    mau_khach_thich: mau,
    luat_app: rules,
    dinh_dang_kenh: Object.fromEntries(kenh.map((k) => [k, { kho: CHANNEL[k].kho, hook: CHANNEL[k].hook }])),
    cong_thuc_kenh: Object.fromEntries(kenh.map((k) => [k, { bai: CHANNEL[k].bai, cta: CHANNEL[k].cta }])),
    cong_thuc_hook: ['Nỗi đau: "Đừng … nếu chưa biết điều này"', 'Con số: "3 lỗi khiến …"', 'Trước/sau', 'Bí mật nghề/hậu trường', 'Câu hỏi đúng tâm lý khách', 'Phản biện điều ai cũng tin'],
    tu_kiem: ['Đúng sản phẩm thật, không bịa giá/thông số', 'Hook nằm trong 1–2 giây đầu / dòng đầu', 'Đúng khổ từng kênh', 'Có CTA cụ thể', 'Màu, giọng, logo đúng thương hiệu', 'Không số điện thoại khách, không chữ sai chính tả trong ảnh', 'Có ít nhất 2 phương án để khách chọn'],
    con_thieu: pack.thieu,
  } };
}
