# Crewzy — Nhật ký (quyết định, bài học, việc đã làm)

Chuyển từ CLAUDE.md mục 5 ngày 23/11/2026. GHI MỤC MỚI VÀO CUỐI FILE NÀY (không ghi vào CLAUDE.md).

- 21/11/2026: Tạo repo. Chuyển 3 màn hình từ canvas Design (định dạng .dc.html cần runtime riêng) sang HTML tĩnh + `assets/app.js`.
  Chuyển trang web vào `public/` để CLAUDE.md không bị đưa lên mạng.
  Trên điện thoại menu bên trái chiếm hết màn đầu → thu thành hàng cuộn ngang, ẩn ô credit (≤640px).
- 21/11/2026: Giang chốt làm app riêng, không gắn vào Lumi (sau khi nghe phản biện về việc trùng chức năng với Lumi).

- 22/11/2026: Nối thật Gmail, Google Sheets qua Composio bằng Netlify Functions. Bài học về khoá Composio:
  khoá `ck_` là khoá mục For You (consumer), app phải dùng khoá dự án `ak_` ở mục Platform → Settings → API Keys.
  Khoá có phân quyền: "Write only" KHÔNG gồm đọc; quyền cố định lúc tạo. Cần: Session management, Connected accounts,
  Auth configs = Read and write; Toolkits, Tools = Read only; Session tool execution = Write only.
  Trên điện thoại menu Composio bị ẩn: link thẳng https://dashboard.composio.dev/~/project/settings/api-keys
- 22/11/2026: Mở rộng 10 công cụ, nhiều tài khoản/công cụ, dựng cổng MCP trên Edge (hàm thường giới hạn 10 giây, Edge chỉ tính CPU).
- 22/11/2026: Token deploy của Netlify MCP hết hạn sau khoảng 40 phút (lỗi 401) → gọi lại deploy-site để lấy lệnh mới.
- 22/11/2026: Từ đây `public/` là nguồn chính, không chạy lại `convert.py` từ canvas (sẽ mất nút kết nối thật).
- 22/11/2026: Thêm Trợ lý AI (chat.html + /api/chat). Claude Pro / ChatGPT Plus không dùng được trong web của bên thứ ba,
  nên chat trong app phải dùng khoá API của khách hoặc credit của app (Netlify AI Gateway). Deploy bằng Netlify MCP: tạm dời
  node_modules ra ngoài repo trước khi chạy lệnh (đỡ tải lên), deploy xong nhớ trả lại — dùng `trap '…mv lại…' EXIT` trong cùng
  lệnh, vì lệnh bị ngắt giữa chừng từng để quên node_modules ở ngoài.
- 22/11/2026: Giang muốn Văn phòng "kiểu công nghệ, đường nhánh toả giữa các phòng, như doanh nghiệp chạy 24/24" → làm sơ đồ mạng
  nền tối trong khung sáng (giữ phần còn lại sáng kiểu Composio cho dễ đọc). Bài học SVG: hạt animateMotion có begin dương nằm ở (0,0)
  trước khi chạy → dùng begin âm. Logo app đặt vòng ngoài đè lên chữ → gắn huy hiệu sát nút.
- 22/11/2026: Chuyển từ Netlify sang Cloudflare Workers + đổi tên Crewzy. Bỏ Netlify AI Gateway (credit app dùng khoá Anthropic của Giang),
  Blobs → KV, node:crypto → Web Crypto, edge function → route /mcp/*. Workers assets mặc định đổi /x.html → /x (307) nên đặt
  html_handling "none" và cho '/' chạy Worker trả index.html. Giữ prefix vpai-/vpai. trong mã để không mất dữ liệu cũ.
- 22/11/2026: Thiết kế lại theo dashboard Composio (Giang mở bằng Chrome cho xem): menu trái chung, trang Kết nối lưới logo + lọc thể loại
  + chi tiết có Skill, thêm Quy trình và Brain thương hiệu. Giữ Be Vietnam Pro thay Geist (dấu tiếng Việt), nút ≥40px, mô tả việc làm
  được thay vì "61 công cụ". Thử app mới thì tiktok/threads/google_business_profile lỗi "require auth configs" và làm hỏng luôn
  link nối AI của mọi người → bài học ở mục 1. Chrome của Giang tự dịch dashboard Composio sang tiếng Việt (tên app bị dịch, vd "Khái niệm" = Notion).
- 22/11/2026: Giang muốn "đăng nhập Google để nối tài khoản AI của khách qua Composio". Phản biện: Composio và Google không làm được
  việc này (xem mục 1, Đăng nhập AI) → làm đăng nhập Google cho tài khoản Văn Phòng AI + nút Đăng nhập OpenRouter, ChatGPT/Claude để "Sắp có".

- 22/11/2026: Giang hỏi "không kết nối SDK các Model vô app được à, Jarvis làm được". Phản biện: gói Claude Pro/Max bị Anthropic cấm dùng
  trong app khác (2/2026), Sign in with ChatGPT chỉ cho đối tác OpenAI duyệt → làm khoá API cho cả 4 AI (Claude, ChatGPT, Gemini, Grok)
  + nối MCP của app khác vào Crewzy (máy khách MCP + OAuth tự động). Thử bằng máy chủ giả: `node scripts/mcptest.mjs` (đã gộp vào npm test).
- 22/11/2026: Claude (claude.ai, nối qua link MCP) tự gọi thử từng công cụ và tìm ra 4 lỗi, Giang đồng ý sửa:
  (1) CREWZY_TAO_VIDEO đã giấu khỏi tools/list nhưng gọi đúng tên vẫn chạy (cổng chuyển mọi CREWZY_* vào runCrewzyTool) → chặn theo danh sách MCP_TOOLS;
  (2) quy trình video bảo AI ngoài gọi CREWZY_TAO_VIDEO/CREWZY_CHO → bản MCP viết lại bằng forMcp; (3) VIEC_CAN_LAM chỉ trả nội dung phiếu
  da_duyet nên quy trình sau không đọc được Sổ tay phong cách/báo cáo tuần → thêm tham số id; (4) phiếu ghi "AI của bạn" → lấy tên từ aiseen.
  Bài học: claude.ai giữ danh sách công cụ cũ của connector (bấm làm mới vẫn không thấy công cụ mới như CREWZY_DOC_WEB) → thêm công cụ mới thì
  báo khách ngắt/nối lại connector. Cổng không giữ kết nối nên khai tools.listChanged cũng vô ích (không gửi được thông báo).
- 22/11/2026: Giang hỏi làm video gửi qua Crewzy có tốn API không → không tốn khoá AI của Crewzy; chỗ tốn là lưu file (KV miễn phí 1GB,
  ≤24MB/file, link HyperFrames hết hạn 7 ngày nên file to không giữ được). Chuyển media sang R2 bucket crewzy-media (miễn phí 10GB, không phí
  băng thông, $0.015/GB-tháng sau đó; tài khoản đã bật R2 sẵn nhờ dung-video-ai nên không phải gắn thẻ). Giới hạn 95MB vì Worker nhận thân ≤100MB.
  Đã thử trên workerd (wrangler dev): file 30MB lên/xuống giống hệt từng byte, Range 206 đúng. Chưa có luật tự xoá trong bucket (file giữ mãi,
  rẻ); muốn xoá sau 90 ngày thì thêm Object lifecycle rule trên dashboard R2 → crewzy-media → Settings.
- 22/11/2026: Giang chốt KHÔNG tự xin duyệt app Meta/Google cho Crewzy, dùng app quản lý chung của Composio làm trung gian (sau khi nghe
  phản biện: màn đồng ý hiện tên Composio; Meta hạn chế/thu hồi app chung thì mọi khách hỏng cùng lúc; Composio khuyên dùng app riêng khi chạy thật).
  Giữ 5 tài khoản/công cụ (Composio cho 2–10); 1 lần nối Facebook dùng được mọi Fanpage nick đó quản lý.
- 22/11/2026: Giang dặn bớt phản biện, tập trung tự nghĩ cách làm mới, gợi ý gỡ rối và đề xuất ý tưởng → viết lại mục 0.
- 22/11/2026: Rà toàn bộ trên bản thật: 176/176 app ready ra link kết nối (thử bằng uid test-audit-2211, xargs -P 8 gọi /api/connect),
  danh mục/quy trình/ngành/MCP khớp nhau (chỉ tiktok, threads, tiktok_ads còn 'soon'), mọi API < 0,25 giây, 9 trang không lỗi console.
  Sửa: (1) CREWZY_QUY_TRINH không id dài > 12.000 ký tự → chat cắt, AI chỉ đọc nửa danh sách → bản gọn (mo_ta ≤110 ký tự, thieu ngắn), ~7.400 ký tự;
  (2) máy chủ MCP ngoài lộ công cụ nội bộ (HyperFrames internal_*: "AI không bao giờ gọi") → isInternalTool ẩn khỏi AI và công tắc;
  (3) điện thoại tràn ngang: .seg.hrow ở Quy trình (911px, do .hrow max-width:none !important đè .seg) và nút dài (Điền nhanh MCP,
  "Nối 1 app: …") → thêm .seg.hrow max-width 100% và lớp .btn.wrap cho nút được xuống dòng. Kiểm bằng Playwright 360/390/1440: hết tràn.
  Cách dò phần tử tràn: duyệt body *, lấy phần tử có right > innerWidth mà không nằm trong cha overflow auto/hidden (script trong lịch sử chat).
- 22/11/2026: Giang: "đăng nhập Gmail, tính credit hoặc gói, khách vào bắt buộc điền thương hiệu → kết nối kênh → kết nối AI → thanh toán
  trước khi dùng, chặt chẽ và hiệu quả". Làm: D1 crewzy-db + src/lib/billing.js + routes/billing.js + bat-dau.html + goi.html.
  CÔNG TẮC: billingOn chỉ bật khi đã đặt GOOGLE_CLIENT_ID (chưa đặt → app chạy như cũ, không ai bị chặn); tắt khẩn cấp BILLING=off.
  ĐẶT ADMIN_EMAILS TRƯỚC khi đặt GOOGLE_CLIENT_ID, không thì Giang cũng bị bắt thanh toán. Chặn ở máy chủ: /api/chat (gói còn hạn + ≥5 credit,
  credit thay trần 30 lượt/ngày), cổng MCP tools/call (initialize/tools/list vẫn qua để bước AI ghi aiseen), cron tự chạy; trình duyệt chỉ dẫn đường
  (auth.js chuyển về bat-dau.html, trừ bat-dau/dang-nhap/goi/ket-noi). Trừ credit TRƯỚC khi chạy công cụ (Composio, MCP ngoài, ảnh 3, video 15/giây,
  MULTI_EXECUTE theo số công cụ, workbench 3; meta tìm công cụ + CREWZY_* đọc/ghi: miễn phí); token Claude của Giang trừ SAU mỗi bước theo usage
  (USD 1/5 mỗi triệu token × 26.000đ × 2, 1 credit = 100đ), âm thì dừng lượt. Gói mặc định: Cơ bản 299k/3.000, Tăng trưởng 699k/8.000,
  Doanh nghiệp 1,49tr/20.000 (30 ngày); nạp 1.000/120k, 3.000/330k, 10.000/990k. Credit giữ lại khi hết hạn, dùng tiếp khi gia hạn.
  Đã thử: npm test (billingtest 10 nhóm), wrangler dev --local với D1 local (npx wrangler d1 migrations apply crewzy-db --local) + phiên tự ký
  (signSession) + Playwright: vào / → bat-dau → lưu Brain → (kênh Metricool đặt sẵn trong KV) → Trợ lý Crewzy → chọn Tăng trưởng → curl webhook
  → trang tự sang "Xong", Gói hiện 8.000 credit; admin không bị chặn, cấp 500 credit được. Chưa thử webhook SePay thật và ảnh QR thật
  (sandbox chặn mạng ra vietqr.app). Tự điền Brain từ website dùng readWebsite + Claude Haiku (khoá của Giang, ~1 lượt nhỏ).

- 22/11/2026 (tối): Tạo project Google Cloud Crewzy + OAuth client Web (Chrome, Giang tự tích điều khoản Google), chuyển app production.
  Màn đồng ý cần trang chủ + chính sách + điều khoản → thêm chinh-sach.html, dieu-khoan.html (cũng là việc bắt buộc trước khi chạy quảng cáo).
  Thu hồi link nối AI: token v3 có mã k, danh sách KV mcplinks:<uid>, thẻ "Link đang hoạt động" (tên thiết bị, AI đang dùng, Thu hồi).
  Test: gatewaytest (thu hồi, link khác vẫn chạy, link v2 + revoke_old, giữ link đang dùng khi quá 20, bật gói chặn link v1); Playwright 1440/390.

- 22/11/2026 (tối): Giang muốn dùng model mạnh (Opus 5.5) để khách thấy giá trị. Gói Claude Pro không dùng được trong app khác →
  dùng API Opus 5.5 bằng khoá của Giang, trừ credit theo giá thật + prompt caching. Tra giá platform.claude.com: Haiku 5.5 chỉ 0,1/0,5 USD
  (trước đó billing tính nhầm 1/5). CHƯA thử với khoá thật (bật gói rồi nên chat cần phiên đăng nhập) → Giang chat thử 1 câu ở Trợ lý sau deploy.

- 22/11/2026 (tối): Giang đi vắng, dặn "bật Instant + tính credit vẫn lời + cho dùng thử". Đã bật Instant trong Composio (Platform → project Settings
  → General → Instant; hộp thoại báo: bật là MỌI phiên cũ lẫn mới đều có Instant, tắt riêng từng phiên được). Ví mới có 2 USD tặng 1 lần; nạp thêm cần
  gói Composio Pro. Link nối AI tạo TRƯỚC 22/11 tối vẫn có Instant (không đo được) → rủi ro giới hạn trong số dư ví; khách tạo link mới là tắt.
  Credit Instant = USD × 26.000 × instant_markup 2 / 100, tối thiểu 1 (0,01 USD → 6 credit). Lãi gói (giá vốn 50đ/credit vì bán ×2):
  Cơ bản 299k − 3.000×50 = 149k · Tăng trưởng 699k − 400k = 299k · Doanh nghiệp 1,49tr − 1tr = 490k, chưa trừ Composio Pro 29 USD/tháng chia chung.
  Dùng thử: 7 ngày + 300 credit, 1 lần/tài khoản (ledger reason 'dung_thu', đã mua gói thì không), nguyên tử bằng INSERT … WHERE NOT EXISTS +
  UPDATE … WHERE changes()>0; plan 'dung_thu' (ten_goi "Dùng thử"), hết hạn gate báo "Đã hết thời gian dùng thử". Nút ở bước 4 bat-dau (đổi tên
  "Dùng thử / Gói"); POST /api/onboarding {trial:true}. TRIAL_JSON / TRIAL=off. Chi phí tối đa cho Giang ≈ 15.000đ/khách dùng thử.
  ĐÃ thử thật trên trang (tài khoản Giang, admin nên không trừ credit): Opus 5.5 + Instant SERPAPI_SEARCH khi CHƯA nối SerpApi → trả 3 kết quả Google
  đúng (~0,025 USD/lần tìm, dùng 2 USD tặng của ví). Chưa xác nhận instantCharge có về để trừ credit khách (xem log/KV instusd:* khi có khách thật).

- 22/11/2026 (tối): Thêm bộ não Cân bằng = Sonnet 5.5 (brain 'can_bang') vào ô Bộ não ở Trợ lý; lịch nội dung/báo cáo (cron) đổi từ Opus sang Sonnet
  (tự trả lời bình luận vẫn Haiku) cho khớp số lượng trong mô tả gói. Gói có loi_ich (danh sách lợi ích + số lượng/tháng, pay.js vẽ dấu ✓):
  mọi gói nối không giới hạn kênh; số bài/bình luận/video tính từ giá credit thật (công thức ở ghi chú trên DEFAULT_PLANS, đổi credit gói thì sửa số).
  Không ghi Zalo/TikTok là kênh nối được (Composio không có Zalo, TikTok còn 'soon').
- 22/11/2026 (tối): Thêm gói MCP For You 149k/30 ngày/2.000 credit (Giang để Claude quyết giá): khách dùng AI của họ qua link nối AI, Giang không trả
  token, chỉ lượt Composio (~8đ) + ảnh → số lượng cao nhất (100 bài × mọi kênh, 400 bình luận); 74,5đ/credit vẫn lời nếu khách tiêu vào Trợ lý Crewzy.
  Không giới hạn chức năng theo gói (gói chỉ khác credit) → khách gói này vẫn dùng được Trợ lý Crewzy, trừ credit như thường.
- 22/11/2026 (tối): Màn Kết quả + biên nhận tháng + nhắc gia hạn + báo cáo tuần tự động (Giang: "làm luôn" đề xuất 1+2) để khách thấy giá trị và gia hạn.
  Nhắc gia hạn chỉ trong app (thanh đầu trang + thẻ menu: còn ≤3 ngày, hết hạn, credit <10% gói; Đóng = ẩn tới hôm sau). CHƯA gửi email: cần nhà cung cấp
  email (vd Resend, Giang tạo khoá RESEND_API_KEY + xác minh tên miền). Số việc chỉ đếm từ 22/11; cổng MCP đếm cả lần gọi lỗi (không đọc được kết quả).
- 23/11/2026: Giang: "gói cao nhiều tính năng hơn (khách sẽ chọn MCP hết), ô chat có Voice, sửa lỗi ô chat xê dịch/chữ che, ô chat như Claude/ChatGPT
  (tải ảnh/video, app đã nối, tìm app để nối), AI đọc ảnh web/fanpage làm content trong chat, Kho lưu trữ như Lumi, model ảnh/video đẹp".
  (1) GÓI = TÍNH NĂNG: billing.js PLAN_FEATURES {tro_ly, opus, anh_dep, video, video_dep, lich, tu_tra_loi, kho_gb, mcp_ngoai}; MCP For You không Trợ lý/
  không hẹn giờ/không ảnh-video đẹp; Cơ bản có Trợ lý (Sonnet/Haiku), 3 lịch; Tăng trưởng + Opus, ảnh Đẹp, video Nhanh, tự trả lời; Doanh nghiệp + video Đẹp.
  dung_thu = Tăng trưởng. Chặn ở máy chủ: runAgent (tro_ly, Opus→Sonnet), applyFeatures trước meter (hạ Đẹp→Nhanh, chặn video), createSchedule, upload (kho_gb),
  /api/giong-noi. Thẻ gói có khong[] (✕ xám). /api/billing trả tinh_nang. Lỗi gốc ô chat: ô gợi ý flex-wrap + textarea resize trong main flex 100vh → chồng nhau.
  (2) Model (tra docs Cloudflare 23/11): ảnh Đẹp bytedance/seedream-4.5 0,04 USD (image_input ≤ nhiều ảnh mẫu, aspect 3:4/9:16/1:1/16:9, size 2K) = 25 credit;
  video Đẹp bytedance/seedance-2.0-fast 720p 0,12 USD/giây (image | reference_images ≤4, 4–12 giây, generate_audio) = 65 credit/giây; video Nhanh LTX nâng 15→17
  credit/giây (trước lỗ nhẹ). Cả hai cần AI Gateway Unified Billing (Giang nạp trên Cloudflare). Phương án khác đã xem: Kling v3 0,112–0,168/giây (ảnh chỉ base64),
  Veo 3.1, Kling v4 0,157–0,235, Seedance 2.0 0,15, Pixverse v6 0,045–0,06, Kling v3 image 0,027, Seedream 4.0 0,03, Seedream 5 Pro 0,045, Recraft v4.1 0,035.
  Giọng nói: STT = @cf/openai/whisper-large-v3-turbo (Cloudflare tự chạy, không cần nạp). TTS = speechSynthesis của máy (miễn phí, giọng vi-VN có sẵn trên
  Chrome/Android/iOS); Inworld TTS / ElevenLabs v3 qua AI Gateway có thể thêm sau (chưa xác minh tiếng Việt của Inworld).
  (3) AI nhìn ảnh: CREWZY_DOC_WEB trả anh[] (og:image + img/srcset, bỏ svg/icon/1px, ≤24); CREWZY_XEM_ANH lưu ảnh sang R2 rồi gửi Claude dạng image url
  (link Crewzy luôn mở được → không làm hỏng cả lượt nếu web chặn hotlink); ảnh khách gửi trong chat: chỉ tin user CUỐI gửi dạng ảnh (Claude image, OpenAI
  image_url, Gemini/Grok chữ). Test: scripts/librarytest.mjs.
- 23/11/2026: Giang gửi ảnh đồ thị app của composio.dev, muốn đổi tên Văn phòng cho chuyên nghiệp + vẽ kiểu cây (rễ, thân, lá) mô tả luồng việc,
  phòng ban phối hợp, mỗi app một nhiệm vụ, bộ não AI điều khiển. Đổi tên = "Trung tâm điều hành"; sơ đồ = "Cây vận hành" (office.js renderGraph viết lại,
  /api/office thêm rooms[].leaves {slug,name,vai,on} ≤6). Điện thoại vẫn lưới ô phòng (thêm viền màu phòng). Đã thử Playwright 1440/390 dữ liệu giả, không lỗi.
- 22/11/2026 (đêm): Giang muốn cây gọn theo nhóm chuyên nghiệp: thêm 2 nhánh dưới (dưới Hằng ngày và Báo cáo), gom mạng xã hội vào Sản xuất & Phân phối,
  Quảng cáo → Marketing & Phân tích (Meta/Google/TikTok Ads + Analytics, Search Console, Ahrefs, Mixpanel), thêm Nghiên cứu & Chiến lược, bỏ app lạc nhóm.
  DEPARTMENTS thêm phan_phoi; GIỮ id cũ (doi_thu = Nghiên cứu & Chiến lược, quang_cao = Marketing & Phân tích) để link ?phong= cũ không hỏng.
  Chuyển quy trình: mot_noi_dung_nhieu_kenh + dang_bai_da_duyet → phan_phoi; de_xuat_chien_luoc → doi_thu; phiếu loai bai_dang → phan_phoi.
  Lá cây giờ lấy từ BRANCH_APPS (danh sách tay, không suy từ quy trình nữa vì từng lẫn Google Sheets vào Nội dung). Test: scripts/officetest.mjs.
- 22/11/2026 (đêm, lần 2): Giang muốn trả lại rễ Phân tích đối thủ, vẽ cây đẹp hơn, có cây trên điện thoại, luồng sáng/chuyển động khi có việc thật.
  doi_thu = Phân tích đối thủ (rễ, 3 quy trình soi đối thủ); id mới chien_luoc = Nghiên cứu & Chiến lược (nhánh: de_xuat_chien_luoc + quy trình mới
  nghien_cuu_thi_truong). office.js: 1 hàm vẽ cho 2 bố cục (LAYOUT), nhánh gradient từ thân, thân có vân, đất, sao; phòng có việc thật → quầng sáng,
  vòng xoay, xung, lá đã nối sáng nhấp nháy, vạch chảy + hạt chạy trên nhánh/rễ, nhựa chạy trong thân; phòng rảnh thì tối dịu. Tôn trọng prefers-reduced-motion.
- 22/11/2026 (đêm, lần 3): Giang: "khách chỉ muốn bấm Run trên cây là ra kết quả thật, CEO chỉ gọi khách và chờ Lead, còn lại AI làm; có dấu + nối thêm app
  thì cây mọc thêm; dây nối các bộ phận theo quy trình; Brain đủ thì bấm chạy hằng ngày đúng giờ". Làm: autopilot.js + thanh "Chạy tự động cả cây" + hộp thoại dây
  chuyền (từng bước sẵn sàng / Nối app còn thiếu), nút + mỗi nhánh, lá app nối thêm theo thể loại, dây theo CHAIN. Bao_cao_tuan ghi 1 dòng/tuần vào Sheet
  "Báo cáo Crewzy"; ban_tin_sang đưa số khách mới + danh sách khách cần gọi lên đầu. Đăng bài/gửi khách vẫn qua cổng duyệt (an toàn tài khoản, đúng mục 3).
  Test: scripts/officetest.mjs (thiếu Brain chặn, giới hạn lịch gói, ưu tiên lead, tắt giữ lịch riêng, gói đủ thì trả lời mỗi giờ). Chưa thử trên tài khoản thật.
- 22/11/2026 (đêm, lần 4): Giang "làm tiếp như đề xuất: báo về kênh đã nối (Gmail…), AI trả lời bình luận xin số, nhận diện lead nóng gửi CEO qua email/Zalo/
  Tele/CRM, thông báo liên tục". Làm: leads.js + CREWZY_BAO_LEAD + /api/leads + bảng lead + ô lead trên cây + thông báo mọi trang; tra_loi_binh_luan mời để lại số và
  gọi CREWZY_BAO_LEAD; ban_tin_sang/bao_cao_tuan gửi chủ qua bao_ceo; WORKFLOW_RULES thêm BÁO CHỦ + LEAD. Zalo chưa có (Composio không có) → báo qua Gmail/Telegram.
  Lead chỉ về khi AI chạy (lịch trả lời bình luận mỗi giờ hoặc khách chat) — không phải webhook tức thời từ Facebook. AI ngoài (claude.ai) phải ngắt/nối lại connector
  mới thấy CREWZY_BAO_LEAD. Test: officetest (lưu, gộp trùng, kênh báo, chốt → doanh thu).
- 23/11/2026: Giang hỏi Crewzy đã đủ kiến trúc 9 lớp (Brain, Agent runtime, Connector, DB, Event bus, Queue, Scheduler, Monitoring, Voice) chưa → thiếu
  Event bus, Queue, Monitoring; đề xuất làm trên Cloudflare (không Supabase/Redis/LangGraph). Giang: "làm mục 1" → events.js. Phát hiện: Composio KHÔNG có trigger
  bình luận Facebook/Instagram → bình luận vẫn quét mỗi giờ; sự kiện tức thì cho Gmail/Outlook/Calendly/Zendesk. AI xử lý sự kiện chờ cron ≤15 phút (chưa có
  Queues — cần Workers Paid); lead + email báo chủ thì ngay khi webhook tới. CHƯA thử với Composio thật (webhook tạo khi khách đầu tiên bật Run có Gmail…).
- 23/11/2026: Giang gửi mô hình A. Event-driven (form/email/lead/quảng cáo bất thường) + B. Scheduled (7:00, 9:00, 30 phút, 18:00, 22:00), hỏi Crewzy làm tốt chưa →
  "làm hết": (1) ops.js soát tồn 30 phút + (2) tổng kết 18:00/22:00 bằng code; (3) theo_doi_quang_cao 9:00 vào CHAIN (nhắc sale dời 9:30) với ngưỡng bất thường,
  báo chủ ngay, không tự chi tiền; (4) form Typeform/Google Sheets → lead (bỏ sheet "Khách tiềm năng"/"Báo cáo Crewzy" chống vòng lặp); (5) lead → HubSpot/Pipedrive ngay
  bằng code (notify.js). Test: officetest (form, ops). CHƯA thử với Composio thật (tools.execute GMAIL_SEND_EMAIL/HUBSPOT_CREATE_CONTACT, trigger Typeform/Sheets).
- 23/11/2026: Giang hỏi bot trả lời tin nhắn + Zalo. Zalo: Composio không có → đường chính thức là Zalo OA (OA phải được Zalo duyệt, app developers.zalo.me,
  webhook, tin tư vấn trong khung 48 giờ theo SDK — kiểm lại docs chính thức khi làm); KHÔNG làm Zalo cá nhân (thư viện không chính thức, dễ khoá số). Giang chọn làm
  bot Messenger trước: quy trình tra_loi_tin_nhan (FACEBOOK_GET_PAGE_CONVERSATIONS/GET_CONVERSATION_MESSAGES/SEND_MESSAGE + INSTAGRAM_LIST_ALL_CONVERSATIONS/
  SEND_TEXT_MESSAGE, quy tắc 24 giờ của Meta, xin số → CREWZY_BAO_LEAD), nhóm công cụ hop_tin, tu_dong, đứng đầu CHAIN Run (mỗi giờ 8–22, Haiku), lá Messenger/
  Instagram ở nhánh CSKH. CHƯA thử thật: app Composio quản lý chung có quyền pages_messaging hay không phải thử bằng Fanpage Nhà Xinh.
- 23/11/2026: Giang hỏi nối Higgsfield + công cụ ảnh/video chuyên nghiệp để mỗi sáng Run làm nội dung đa nền tảng. Tra thật: MCP chính thức
  https://mcp.higgsfield.ai/mcp (OAuth Clerk, có registration_endpoint DCR + CIMD; DCR với redirect https://crewzy…/api/mcp-callback ĐÃ được nhận 23/11),
  trừ credit trong tài khoản Higgsfield của khách. Composio cũng có toolkit higgsfield (API_KEY, 14 công cụ, Instant hỗ trợ một phần) — chưa thêm vào catalog.
  Làm: Higgsfield vào danh bạ MCP (Điền nhanh), nhóm anh_video/dung_video nhận mcp higgsfield, lá MCP ở nhánh Nội dung (BRANCH_MCP, sáng khi đã nối, bấm → tab MCP
  điền sẵn), quy trình noi_dung_moi_sang (6:30 mỗi ngày trong CHAIN: Brain + lịch tuần + Kho → Higgsfield hoặc ảnh/video credit Crewzy → bài riêng từng kênh →
  chờ duyệt → 10:00 dang_bai_da_duyet đăng). CHƯA đăng nhập Higgsfield thật (cần tài khoản), định dạng kết quả ảnh/video của Higgsfield chưa xem.

- 23/11/2026: Giang: "tạo lại quy trình gồm 6 đầu việc chính hằng ngày, khách bấm Run hoặc hẹn giờ, mỗi quy trình nối 2–3 app, muốn thêm bấm +".
  Làm: src/lib/missions.js (6 nhiệm vụ; Giang kể 5, nhiệm vụ 6 Nghiên cứu đối thủ & thị trường do Claude thêm vì nuôi ý tưởng cho nội dung/quảng cáo — đổi được),
  CHAIN của autopilot lấy từ missions (cùng 12 quy trình như cũ, lịch có nv), /api/autopilot GET trả nhiem_vu, POST nhận nv (bật thêm không tắt nhiệm vụ khác,
  tắt riêng; tắt hết mới tắt trigger). Thẻ nhiệm vụ ở Trung tâm điều hành + đầu trang Quy trình (thư viện 23 quy trình giữ bên dưới). Gọi điện AI: nhóm goi_dien
  (Twilio, Aircall, Dialpad, ClickSend, Plivo + Vapi/Retell AI/Bland AI để 'soon' vì CHƯA thử /api/connect — thử ra link rồi đổi 'ready'); nhac_cham_soc_deal soạn
  kịch bản gọi chờ duyệt, không tự gọi. Báo cáo CEO dạng PDF: nút "Tải PDF" ở Kết quả (window.print + @media print ẩn menu) — chưa có file PDF đính kèm email.
  Test: officetest "missions OK". Playwright 1440/390 không tràn ngang.

- 23/11/2026: Giang: "thu gọn 6 thẻ, bật gọi điện AI thật, Bộ não Crewzy là trợ lý prompt cấp cao vào app khách nối (Higgsfield…) làm ảnh/video chuyên nghiệp, content
  dễ lên xu hướng, màn duyệt rõ (đã xong gì, làm lại, gợi ý app tự sửa rồi mới đăng đa kênh), thêm mạng xã hội nếu nối được". Làm: thẻ nhiệm vụ gọn (logo app đã nối,
  x/y ô app, giờ chạy, Chi tiết mở ra); promptPro.js; màn duyệt mới; thay_media. Gọi điện AI: vapi, retellai, bland_ai (Composio, API_KEY) đổi 'ready'; MXH: upload_post
  (Upload-Post, 1 khoá API đăng TikTok/X/Threads/Bluesky/Reddit/Pinterest…, đây là đường có TikTok/X/Threads mà không cần auth config riêng). 4 slug này CHƯA thử
  /api/connect trên trang thật (Chrome không kết nối được lúc làm) → common.js UNVERIFIED + createSession: tạo phiên lỗi "auth config" thì tạo lại không có chúng, chat/
  link nối AI của mọi người không hỏng. /api/connect thêm ?thu=1 CHỈ cho admin để thử slug chưa mở. Composio có nhưng OAuth (cần auth config, giữ 'soon'/chưa thêm):
  twitter, threads, tiktok, snapchat, twitch, kick, vimeo, wordpress_com, buffer, discordbot. KHÔNG có: bluesky, mastodon, tumblr, medium, zalo, lemon8.

- 23/11/2026: Giang hỏi phiên dài có tốn token không → rút gọn CLAUDE.md 93KB → 36KB: ghi chú kỹ thuật sang docs/ghi-chu-ky-thuat.md, nhật ký sang file này. Từ nay nhắc Giang mở phiên mới khi phiên dài.

## 23/11/2026 — Veo/Flow + báo cáo Google Sheet sau khi đăng
- Giang: thêm app làm ảnh/video (Higgsfield, HeyGen, Veo, Google Flow) cho nhánh Sản xuất & Phân phối; sau khi đăng hết nền tảng AI ghi Google Sheet (bài, nền tảng, giờ, thành công/thất bại + lý do, link từng nền tảng), chưa có bảng thì tự lập, rồi email link cho chủ.
- Đã làm: Higgsfield/HeyGen đã có sẵn → thêm `gemini` (đổi tên "Gemini (Veo)", Veo dùng khoá Gemini) vào slot san_xuat, lá cây `noi_dung`, APP_RULES promptPro; Google Flow KHÔNG có API/MCP → chỉ là link mở web trong "Tự sửa" (jobs.js, loại 2). workflows.js: `dang_bai_da_duyet` thêm 3 bước (ghi Sheet "Crewzy – Báo cáo bài đã đăng", tự tạo nếu chưa có, email email_ceo qua bao_ceo), nhóm công cụ tuỳ chọn `bang_dang_bai`, `gui_link_bang`; mission san_xuat thêm slot 3 (googlesheets).
- npm test OK. CHƯA thử thật: AI tạo Sheet + ghi dòng + gửi Gmail trên tài khoản thật; video Veo qua Composio gemini (kiểm tên công cụ video của toolkit).
- (23/11, sau) Giang: muốn THẤY biểu tượng Veo/HeyGen/CapCut ở nhiệm vụ nội dung + nút + ở từng ô (video, MXH, báo cáo), nối xong quay về, AI dùng đúng app/nền tảng khách nối. Đã làm: slot có `cat` + `web` (Google Flow, CapCut = chip mở web ↗, chưa có API), goi_y tối đa 6, chip "+ Thêm app của bạn" → ket-noi.html?cat=…&tro_ve=index.html#nv-<id> (connect.js lưu localStorage crewzy.troVe, nối xong tự quay về; chỉ app Composio, MCP OAuth chưa quay về); thẻ gọn hiện logo mờ app chưa nối; WORKFLOW_RULES "APP CỦA KHÁCH LÀ DANH SÁCH DUY NHẤT". CHƯA xem bằng trình duyệt (chỉ node --check + npm test).
- (23/11, 12:15) Giang: Google Form + form/website gắn bình luận ghim, CTA bình luận 1 từ khoá "POST", lead từ mọi nguồn vào CRM (nhiệt/trạng thái), chăm sóc NGAY (email→Gmail, số→gọi nếu có app gọi), lưu lịch sử cuộc gọi, báo CEO tuần nóng/ấm/lạnh + gợi ý sale. Đã làm: catalog `googleforms` status 'soon' (Composio không quản lý OAuth Google Forms, cần auth config riêng; trigger không có → đọc LIST_RESPONSES hoặc Sheet); workflow mới `tao_form_thu_khach` + nhóm `form_khach`; steps CTA/bình luận đầu tiên (ghim nếu kênh cho phép, Facebook chưa có API ghim) trong noi_dung_moi_sang/dang_bai_da_duyet; tra_loi_binh_luan nhận bình luận từ khoá → nhắn riêng xin số → CREWZY_BAO_LEAD; lead_vao_crm: bảng "Crewzy – CRM khách hàng" (cột Nhiệt/Trạng thái/Đã chăm sóc/Lịch sử/Gợi ý sale), chăm sóc ngay; leads.js: công cụ CREWZY_CHAM_SOC_LEAD (careLead, lịch sử ≤20), trạng thái da_cham_soc, leadsWeekly + activity.runWeeklyReports gửi Gmail CEO; UI Trung tâm điều hành hiện Nóng/Ấm/Lạnh, đã chăm sóc bằng gì, gợi ý sale; mission san_xuat thêm slot Form (4 ô). Thêm công cụ CREWZY_* mới → khách phải ngắt/nối lại connector. CHƯA thử thật: gọi Vapi thật, Gmail gửi khách, tạo Google Form (chưa nối được), ghim bình luận.
- (23/11, 12:34) Giang: khách nối nhiều app (edit video, làm ảnh…) thì phải HỎI trắc nghiệm dùng app nào + báo cáo về đâu rồi mới chạy. Đã làm: hộp thoại trắc nghiệm ở ▶ Chạy ngay và ⏰ Tự chạy (missions.js: radio 1 app/ô, checkbox ô nhiều; báo cáo chọn Crewzy/Sheets/Gmail/Telegram… theo app đã nối); lưu KV `apref:<uid>` (POST /api/autopilot action 'chon', cleanChon/prefText trong missions.js) → prompt Chạy ngay và lịch cron (schedules.js) đều kèm "LỰA CHỌN CỦA KHÁCH"; WORKFLOW_RULES + chat.js: không có lựa chọn mà nối ≥2 app cùng loại → AI hỏi A/B/C trong chat. CHƯA xem bằng trình duyệt.
- (23/11, 12:45) Giang thấy Composio có Higgsfield dạng Instant (⚡, 13–14 tool) + Higgsfield MCP (101 tool). Đã làm: catalog `higgsfield` (creative), INSTANT_APPS thêm higgsfield, INSTANT_TOOL_LIMITS: Instant CHỈ cho ảnh (Soul Standard/V2, ảnh theo ảnh mẫu, ước giá, style, trạng thái) vì video Seedance ~2 USD/lần trừ trước, không huỷ, lỗi vẫn mất tiền; instantConfig gửi `tools:{higgsfield:{enable:[...]}}` (cú pháp docs.composio.dev/docs/instant-tools, CHƯA thử thật trên Composio); higgsfield vào UNVERIFIED (createSession tự thử lại nếu lỗi auth) và nhóm anh_video. Video Higgsfield vẫn qua MCP Higgsfield của khách. Giang cần bật Instant Toolkits trong Settings project Composio (đã thấy ⚡) và nạp số dư.
- (23/11, 13:40) LỖI: chat báo "AI gặp lỗi" mọi tin sau khi thêm Higgsfield — nghi `instant.tools` bị Composio từ chối. Sửa: instantConfig bỏ `tools`; bộ lọc công cụ Higgsfield chuyển sang cấp phiên (`tools:{higgsfield:{enable:[ảnh]}}` trong chat.js, sessionToolLimits); createSession tự thử lại không kèm tools/instant nếu composio.create lỗi (common.js). Nguyên nhân gốc CHƯA xác nhận bằng log thật (chưa đọc được log Worker): Giang gửi tin thử lại sau deploy; nếu vẫn lỗi, xem Workers → Logs dòng "chat failed".
- (23/11, 14:40) LỖI vẫn còn sau bản 13:40 (Giang chụp 14:32, Trợ lý Crewzy · Haiku). Nguyên nhân gốc tìm theo đường đi dữ liệu: thêm `higgsfield` vào TOOLKITS → composio.create lỗi → tầng dự phòng cuối của createSession bỏ app UNVERIFIED khỏi toolkits nhưng vẫn giữ `tools:{higgsfield:…}` (và chỉ chạy khi lỗi có chữ "auth config") → Composio từ chối → mọi tin chat lỗi. Sửa: createSession 3 tầng không phụ thuộc chữ lỗi (gốc → bỏ app UNVERIFIED khỏi cả toolkits lẫn tools, giữ Instant → tối thiểu không tools/instant), ghi log từng tầng. Ô lỗi chat có "Mã lỗi kỹ thuật" gập lại (detail đã che khoá) để khách/Giang chụp màn hình là biết nguyên nhân. Đã thử bằng Composio giả + npm test; CHƯA thử trên bản thật (chưa đọc được log Worker). Nếu vào tầng 1, ảnh Higgsfield Instant tạm không có (chat vẫn chạy): Giang mở /api/connect?toolkit=higgsfield&thu=1 để xem Composio cần gì.
- (23/11, 15:05) Mã lỗi kỹ thuật lộ nguyên nhân thật: Claude 400 "tools.21.custom.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level" (một công cụ có schema tầng ngoài anyOf, xuất hiện từ khi bật Higgsfield). Giang chốt BỎ Higgsfield khỏi Crewzy trả hộ, chỉ gợi ý, khách tự nối/gỡ. Đã làm: bỏ higgsfield khỏi INSTANT_APPS, INSTANT_TOOL_LIMITS = {} (chat chỉ gửi `tools` khi có bộ lọc), catalog higgsfield → 'soon' (không vào phiên Composio, ghi chú nối MCP Higgsfield của khách), bỏ khỏi UNVERIFIED; MCP Higgsfield vẫn là gợi ý ở nhiệm vụ/cây. Lưới an toàn: `safeTopSchema` (chat.js) gộp oneOf/anyOf/allOf tầng ngoài thành object cho MỌI công cụ trước khi gửi Claude/OpenRouter/OpenAI. npm test + instanttest + officetest qua; CHƯA thử chat thật sau deploy.
- (23/11, 15:40) Giang: AI không lấy ảnh thật thương hiệu (vẽ ảnh giả), không dừng được khi đang chạy, bấm "tiếp tục" thì chạy lại quy trình từ đầu + làm thêm ảnh (tốn token). Nguyên nhân "chạy lại": lịch sử gửi lên chỉ có chữ, không có việc/ảnh đã làm. Đã làm: (1) ẢNH THẬT TRƯỚC — `imageShortcut` (crewzyTools.js, gọi ở chat + cổng MCP, TRƯỚC khi trừ credit): Kho có ảnh thật (bỏ ảnh source ai_tao) mà CREWZY_TAO_ANH không có anh_mau → trả ảnh thật để đăng; dep + anh_mau mà gói chưa có ảnh Đẹp → đăng thẳng ảnh thật thay vì hạ xuống ảnh AI nhanh; tham số mới `khach_yeu_cau_ai` cho trường hợp khách muốn ảnh AI. (2) NÚT DỪNG — nút gửi thành ■ khi đang làm, AbortController; máy chủ ReadableStream.cancel → stop.stopped, vòng AI dừng trước bước/công cụ kế. (3) GHI CHÚ TIẾN ĐỘ — mỗi công cụ xong → memoLine (việc + link ảnh/video + mã phiếu/lỗi), sự kiện `memo`, trình duyệt cất item kind 'memo' (ẩn) và gửi lại như tin trợ lý; lời dặn hệ thống: "tiếp tục" làm tiếp, không đọc lại quy trình/không tạo lại ảnh/không nộp trùng. max_tokens giữ phần chữ đã viết. Test: scripts/realphototest.mjs (vào npm test), Playwright 390px với /api/chat giả (memo vào lịch sử, nút Dừng, tin "Đã dừng"). CHƯA thử với AI thật.
- (23/11, 16:10) Giang hỏi: Python/FFmpeg/giọng đọc đã làm chưa → CHƯA (cần Giang chốt Workers Paid để chạy Cloudflare Containers). Giang muốn nhiệm vụ Sản xuất chạy bằng Claude của khách qua link MCP: 1 lần Run = 5 ảnh nhiều khổ + 5 video ngắn, hẹn giờ đăng cả ngày đa nền tảng; thiếu Brain/tư liệu thì hỏi khách trong chat, lưu Kho/Brain rồi làm tiếp. Đã làm: quy trình `san_xuat_5x5` (7 bước, forMcp viết lại bước video cho AI ngoài), nhiệm vụ san_xuat 06:30 dùng quy trình này; công cụ CREWZY_LUU_BRAIN; CREWZY_KHO trả link tai_len; CREWZY_NOP_KET_QUA có gio_dang + cron runDuePosts tự đăng phiếu đã duyệt đúng giờ (Trợ lý Haiku, tính credit, ≤20 lượt AI/ngày/khách chung với sự kiện); UI Việc chờ duyệt hiện ⏰ và nút Duyệt · tự đăng; thẻ nhiệm vụ "✦ Chạy bằng AI của tôi" (lệnh ngắn + Mở Claude/Chép lệnh). Test realphototest (hẹn giờ, Brain), npm test, Playwright 390px. CHƯA thử: Claude thật qua link MCP chạy trọn 10 bài; tự chạy cron 06:30 bằng Trợ lý có thể không xong 10 bài trong 1 lượt (240 giây, 16 bước) — cần chia lượt nếu Giang muốn tự chạy bằng credit.
