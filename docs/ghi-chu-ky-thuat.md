# Crewzy — Ghi chú kỹ thuật chi tiết

Chuyển từ CLAUDE.md mục 1 ngày 23/11/2026 để CLAUDE.md gọn (đỡ token mỗi lượt). Đọc phần liên quan khi cần sửa đúng chỗ đó.

- Cloudflare: Worker `crewzy` trên tài khoản Cloudflare truonggiang2511a@gmail.com (cùng tài khoản vi-tri-studio, dung-video-ai —
  KHÔNG đụng vào các Worker đó; GitHub truonggiang2511a-droid chỉ nối được với MỘT tài khoản Cloudflare, chính là tài khoản này;
  tài khoản hungnguyen2511ab có KV crewzy-data c16eb86713c0479690faa6dae0be62c7 tạo nhầm, không dùng), địa chỉ https://crewzy.truonggiang2511a.workers.dev
  Deploy: GitHub repo nối Workers Builds (giống vi-tri-studio) → push nhánh main là tự `npx wrangler deploy`.
  Khoá bí mật đặt trên dashboard (Worker → Settings → Variables and Secrets): COMPOSIO_API_KEY, ANTHROPIC_API_KEY (chế độ credit của app),
  SESSION_SECRET, GOOGLE_CLIENT_ID. Không ghi vars trong wrangler.jsonc; `keep_vars: true` để deploy không xoá biến trên dashboard.
  Chạy cục bộ: tạo `.dev.vars` (đã gitignore) rồi `npx wrangler dev --local` → http://127.0.0.1:8787 (KV giả lập cục bộ).
  Đã thử cục bộ 22/11: mọi route, KV ghi/đọc Brain, Composio SDK chạy trong workerd (gọi tới backend.composio.dev được), Playwright 2 khổ màn.
  Đã chạy thật 22/11 (account 03b6191738250b652c9472dcc6129114, Worker tạo qua dashboard → Import repository, deploy ~50 giây):
  /api/catalog, Brain KV, /api/connect ra link Composio, chat chế độ app ~3–4 giây (có gọi công cụ Composio, không vượt CPU gói Free),
  link nối AI qua /mcp/* initialize OK. 3 khoá bí mật COMPOSIO_API_KEY, ANTHROPIC_API_KEY, SESSION_SECRET do Giang tự đặt trên dashboard.
  Gói Workers Free giới hạn 10ms CPU mỗi lượt: chat chủ yếu chờ mạng nên thường đủ; lỗi "exceeded CPU" thì lên Workers Paid (5 USD/tháng).
- KV (thay Netlify Blobs): `user:<google sub>`, `uid:<uid>`, `brand:<uid>`, `usage:<ngày VN>:<uid|all>` (tự xoá sau 2 ngày),
  `img:<id>` (ảnh AI, 90 ngày, metadata ct/uid/model), `media:<id>` (ảnh/video trước 22/11, 90 ngày; file mới lưu R2 media/<id>), `imgcount:<ngày>:<uid>`, `mcpsrv:<uid>` (máy chủ MCP khách nối),
  `mcpoauth:<state>` (đang chờ đăng nhập, 15 phút).
  KV nhất quán sau tối đa ~60 giây giữa các vùng; đủ cho tài khoản/Brain/đếm lượt.
- Mã khách gửi lên Composio có dạng `vpai-<uid>` (giữ tiền tố cũ); chỉ cho phép toolkit trong `TOOLKITS` (src/lib/common.js ← catalog).
- Link nối AI: Composio bắt buộc header x-api-key cho mọi link MCP, nên KHÔNG đưa link Composio cho khách.
  Token = base64url(link phiên Composio) + '.' + HMAC-SHA256 (khoá ký = sha256('vpai-mcp|' + COMPOSIO_API_KEY)).
  Đổi COMPOSIO_API_KEY thì mọi link cũ hết hiệu lực. Từ 22/11 tối: token v3 = {u, id, k}; khách thu hồi từng link ở Kết nối → AI của bạn
  (cổng trả 403 "đã bị thu hồi", hiệu lực ≤ ~1 phút do đệm + KV). Link v2 (không k) chạy tới khi bấm "Thu hồi link cũ". Bật gói thì link v1 bị từ chối.
  Đã thử qua cổng: initialize, tools/list (6 công cụ gốc COMPOSIO_*), tools/call COMPOSIO_SEARCH_TOOLS ~1 giây.
- Trợ lý AI (/api/chat): chế độ app, claude, openai, gemini, grok (khoá API riêng), openrouter.
  `gemini` = gemini-3.8-flash qua https://generativelanguage.googleapis.com/v1beta/openai/ (schema công cụ được lọc bằng geminiSafeTool);
  `grok` = grok-4.7 qua https://api.x.ai/v1; cả hai dùng `max_tokens`. CHƯA thử với khoá thật (Giang chưa có khoá Gemini/Grok).
  Công cụ MCP ngoài khách đã nối được nạp thêm mỗi lượt; ảnh/video MCP trả về được lưu thành /api/media/<id> (media.js), phát sự kiện
  {type:'image'|'video'|'audio', url} và gửi AI trường media_crewzy để đăng bài bằng link cố định. CREWZY_CHO (5–30 giây, chỉ trong chat,
  không đưa ra link MCP) để AI chờ app tạo video rồi hỏi trạng thái. Mỗi lượt tối đa 16 bước / 150 giây.
  `app` = Bộ não Crewzy bằng khoá `ANTHROPIC_API_KEY` của Giang: MẶC ĐỊNH Claude Opus 5.5 (từ 22/11 tối, Giang muốn khách thấy giá trị bằng model mạnh;
  đổi bằng biến APP_MODEL), khách chọn "Tiết kiệm" = Haiku 5.5 (body.brain 'tiet_kiem', ô Bộ não ở chat.html). Lịch tự trả lời bình luận mỗi giờ
  chạy Haiku, lịch nội dung/báo cáo chạy Opus. runClaude bật prompt caching (công cụ + lời dặn + tin cuối, ≤3 điểm cache) → bước sau đọc cache 0,05× giá.
  Credit theo giá thật từng model (billing.js AI_MODEL_PRICES: Opus 4/20, Sonnet 2/10, Haiku 0,1/0,5 USD/triệu token, ×26.000đ ×2, 1 credit = 100đ):
  1 bước Opus 30K vào + 1K ra ≈ 73 credit, có cache ≈ 15 credit. Chưa đặt khoá → giao diện tự ẩn chế độ này.
  Trần 30 lượt/ngày mỗi khách + 300 lượt/ngày cả app (KV usage:*, theo giờ Việt Nam; không chống đếm trùng khi gửi cùng lúc).
  `claude` = khoá Anthropic của khách, Claude Sonnet 5.5, `baseURL: 'https://api.anthropic.com'`.
  `openai` = khoá OpenAI của khách, gpt-5.4-mini, `max_completion_tokens`, `baseURL: 'https://api.openai.com/v1'`.
  Khoá khách chỉ lưu trong localStorage trình duyệt (`vpai.key.<mode>`), gửi kèm mỗi lần, máy chủ không lưu.
  Vòng công cụ: `session.tools()` (dạng OpenAI) → đổi sang `input_schema` cho Claude; tối đa 8 bước, dừng ở 60 giây và bảo khách nhắn "tiếp tục".
  Kết quả công cụ cắt còn 12.000 ký tự. Lời dặn hệ thống bắt AI hỏi "đồng ý" trước khi đăng, gửi, xoá, chi tiền.
  Đã thử (22/11): kiểm tra kết nối ~6 giây, tìm công cụ đăng Fanpage, khoá sai báo "Khoá API không đúng"; điện thoại 390px và máy tính 1440px không lỗi console.
  COMPOSIO_MANAGE_CONNECTIONS tự tạo yêu cầu kết nối "đang chờ" (INITIATED) cho mọi công cụ chưa nối; status/connect chỉ đếm ACTIVE nên không sai số.
- Mở rộng danh mục 22/11 (thử từng slug qua /api/connect tạm cho phép ?thu=1, đã gỡ): thêm 45 app ready → 64 app: pinterest, reddit, discord, slack,
  microsoft_teams, webflow, outlook, one_drive, dropbox, googleslides, zoom, googlemeet, calendly, pipedrive, salesforce, zoho, stripe, typeform,
  mailchimp, brevo, klaviyo, kit, mailerlite, sendgrid, zendesk, intercom, freshdesk, gorgias, crisp, airtable, trello, asana, clickup, monday, figma,
  google_search_console, google_maps, vidiq_mcp (vidIQ qua Composio bằng khoá API!), apify, firecrawl, semrush, ahrefs, serpapi, perplexityai, tavily.
  Thêm thể loại research, email, care, work. KHÔNG nối nhanh được: twitter, shopify, googleforms (cần app riêng); wordpress, google_forms,
  sendinblue, convertkit, activecampaign, zoho_crm, surveymonkey, tidio, google_slides, googlesearchconsole (slug sai hoặc lỗi 400).
- Mở rộng lần 2 (22/11, Giang: "thêm nhiều kết nối, quy trình có gì thì kết nối cũng phải có"): lấy 1.842 toolkit qua API v3 /toolkits,
  lọc theo thể loại kinh doanh, thử 132 slug song song bằng /api/connect?thu=1 (route tạm /api/probe-toolkits + ?thu=1 ĐÃ GỠ) → 116 ra link,
  đưa 107 vào catalogExtra.js (bỏ trùng googlesuper, ahrefs_mcp, semrush_mcp, notion_mcp, canva_mcp, microsoft_365; bỏ amazon 0 công cụ, affinity, twitch)
  → 182 app, 171 ready, 16 thể loại (thêm Phân tích, Website & bản tin, Tìm khách & chào hàng, Gọi điện & SMS, Thanh toán & kế toán, Ảnh video ghi âm).
  KHÔNG ra link (cần auth config): buffer, microsoft_advertising, linkedin_ads, constant_contact, aweber, zoominfo, docusign, sign_now, zoho_bookings,
  ebay, paypal, xero, help_scout, livechat, smartsheet, vimeo. Composio KHÔNG có: hootsuite, later, metricool, ghost, substack, woocommerce, etsy,
  trustpilot, drip, keap, acuity, loom, descript, deepl, highlevel (slug highlevel_location chưa thử).
  Máy chủ MCP thử qua /api/mcp-servers: không đăng nhập = Firecrawl, DeepWiki, Context7, Hugging Face; ra trang đăng nhập = OpenArt, Apify, Notion,
  Linear, Metricool (ai.metricool.com/mcp), HeyGen, monday, ClickUp, Miro, Atlassian, Wix, Webflow, Stripe, Zapier, Exa; chặn link quay về của
  Crewzy (ghi ngoai) = vidIQ, Canva, HubSpot, Airtable, Figma, Asana, Intercom, Gamma, Semrush, Similarweb, PayPal, Square, Box; lỗi 404/530 = Jina,
  ElevenLabs, Zoom, Rube; Linkup lệch phiên bản giao thức. Thẻ MCP ở Kết nối → ?tab=mcp&ten=&url= điền sẵn; máy chủ ngoai có nút Sao chép link.
  Quy trình: nhóm công cụ G thêm app mới + nhóm tim_khach_b2b, chao_hang, doanh_thu, bao_gia, ghi_hop; thêm 2 quy trình tim_khach_doanh_nghiep,
  bao_gia_sau_cuoc_goi (20 quy trình). Mọi app trong G đều có trong catalog (kiểm bằng script trong nhật ký).
- Video + thương hiệu sâu (22/11, Giang: "quy trình edit video đăng các nền tảng, HyperFrames, Remotion, đọc kỹ thương hiệu trước, video viral/ảnh mẫu
  khách thích, giọng khách, Vbee/ElevenLabs, tự trả lời bình luận, luồng brand → đối thủ → ý tưởng → edit/render → nội dung → duyệt → đăng đúng định dạng"):
  3 quy trình mới video_tron_goi (2 giai đoạn: nộp 3 ý tưởng rồi DỪNG chờ khách chọn, sau đó dựng), edit_video_co_san, anh_quang_cao_theo_mau;
  cờ media:true (QUY_TRINH báo thiếu phong cách/giọng), tu_dong:true (tra_loi_binh_luan đổi thành mọi nền tảng). WORKFLOW_RULES bắt đầu bằng BƯỚC 0
  đọc thuong_hieu; CREWZY_QUY_TRINH trả thêm doc_truoc, thuong_hieu (brandPack), dinh_dang_kenh (formatsFor: chỉ kênh đã nối).
  PLATFORM_FORMATS/FORMATS trong workflows.js: YouTube chỉ video, Instagram không bài chữ, TikTok video/ảnh cuộn… AI bỏ kênh không nhận định dạng.
  Nhóm công cụ mới: dung_video (san_co: credit Crewzy + Remotion/HyperFrames/ffmpeg trên máy khách), giong_doc, cat_clip.
  CREWZY_TAI_LEN: AI trên máy (Claude Code/Codex) dựng xong → xin put_url → curl -T → link_sau_khi_tai. Đã thử thật: PUT ra /api/media 200,
  dùng lại link báo 409. Lịch: lap 'moi_gio' (gio→den, chỉ chế độ crewzy, mốc chống trùng theo giờ runKey), tu_dong (prompt "TỰ TRẢ LỜI ĐÃ BẬT":
  tự trả lời khen/hỏi giá/FAQ, câu nhạy cảm chờ duyệt). AUTO_RUNS_PER_TICK 6. 15 lượt/ngày mỗi khách khung 8–22 giờ (tính vào 30 lượt).
  MCP đã thử ra trang đăng nhập: HyperFrames https://mcp.heygen.com/mcp/hyperframes, HeyGen https://mcp.heygen.com/mcp/v1/, ElevenLabs
  https://api.elevenlabs.io/v1/mcp (CIMD), Shotstack https://mcp.shotstack.io/, InVideo, Captions, OpusClip, Reap. Descript MCP, Submagic lỗi 530.
  HyperFrames ghi trong tài liệu: compose/render tắt với client CLI/IDE — CHƯA biết có nhận Crewzy không (cần tài khoản HeyGen để thử).
  Composio thêm (đã thử ra link): descript_mcp, captions, luma_labs, cartesia, fish_audio → 187 app, 176 ready.
  Remotion KHÔNG có MCP render trên mây (@remotion/mcp chỉ tra tài liệu, chạy máy) → dùng trong Claude Code/Codex của khách (npx skills add
  remotion-dev/skills, npx remotion render) rồi CREWZY_TAI_LEN. Giấy phép Remotion: miễn phí cá nhân/công ty ≤3 người, lớn hơn mua license.
  Vbee, FPT.AI: không có MCP/Composio → khách tải giọng mẫu vào Brain (giong_mau) hoặc ghi tên giọng; muốn đọc thẳng phải làm kết nối API riêng.
- Giao diện kiểu composio.dev (22/11, Giang: "font chữ và tất cả bên trong giống Composio nhưng là Crewzy"): đã lấy token thật từ CSS
  composio.dev (font-sans = Geist, mono = JetBrains Mono, --background #f6f6f6, --foreground #0f0f0f, --primary gần đen, --brand-readable #0007cd,
  --highlight #d4ff4a, --radius .625rem, tracking -.011em, tiêu đề nét 400–500). Tiêu đề trang 1 cụm chữ xanh (.hl). Không dùng font Roobert TRIAL,
  Flecha Test (bản dùng thử có bản quyền), logo, ảnh minh hoạ của Composio. Logo Crewzy: ô đen "Cz" + chấm xanh chanh.
- Giao diện điện thoại + Văn phòng thật (22/11, Giang: "mobile gọn, sạch, dễ dùng; văn phòng phải mô phỏng thật, hiệu quả công việc"):
  bỏ menu cuộn ngang, thay bằng thanh dưới kiểu app + bảng Thêm; hàng lọc/chip (.hrow) một hàng cuộn ngang; mô tả trang cắt 2 dòng;
  Trợ lý AI kiểu nhắn tin (khung chat chiếm phần còn lại, gợi ý cuộn ngang, ô nhập tròn sát thanh dưới). Văn phòng bỏ dữ liệu mẫu:
  AI gọi CREWZY_VIEC_CAN_LAM → phiếu cho_lam chuyển dang_lam (nhan_luc, "<AI> nhận việc"); cron runAuto gọi markWorking trước khi chạy.
  KV aiseen:<uid> chỉ ghi lúc initialize (gói KV Free 1.000 lượt ghi/ngày — đừng ghi mỗi tools/call).
- "Sẵn sàng" = đủ app + ĐỦ DỮ LIỆU (22/11, Claude của Giang gọi thử qua link nối AI và báo 2 lỗi: Báo cáo tuần "chạy được" khi chưa nối
  app nào; Ảnh theo mẫu "chạy được" khi Brain trống; Video theo phong cách cần sổ tay của doi_thu_reels; Dựng Brain bị khoá vì thiếu app đọc web).
  workflows.js: NEEDS → w.can (brain: mục Brain phải có · mau: loại mẫu tham khảo · truoc: quy trình phải có kết quả trước, thay thế được bằng mục
  Brain/mẫu · nguon: ít nhất 1 nhóm công cụ theo key); bat_buoc false = "nên có", không chặn. readiness(w, {connected, mcpUrls, brand, jobs|done})
  là NGUỒN DUY NHẤT cho CREWZY_QUY_TRINH (thieu_du_lieu, nen_co, luu_y_du_lieu), /api/office (phòng setup) và GET /api/workflows/status?uid=
  (trang Quy trình: nhãn Thiếu dữ liệu / Chạy quy trình trước, hộp "Cần có trước khi chạy", nút nhảy tới thẻ #wf-<id>). doneFlows: phiếu
  cho_duyet/da_duyet/da_dang/xong có quy_trinh (bỏ phiếu "Chưa chạy tự động…"). Nhóm công cụ có key (req/opt). Test: scripts/readytest.mjs (npm test).
  CREWZY_DOC_WEB (src/lib/webRead.js): Crewzy tự đọc trang web công khai (≤1,5MB, trả ≤12.000 ký tự + lien_ket cùng website), chặn IP nội bộ/localhost,
  từ chối Facebook/Instagram/TikTok/LinkedIn/Zalo (cần đăng nhập) → nhóm doc_web_minh và soi_web có san_co, Dựng Brain chạy được khi chưa nối gì.
  connectedApps chuyển sang src/lib/connected.js (office + workflows status dùng chung).
- Danh mục app (22/11/2026, đã thử /api/connect): nối nhanh được facebook, instagram, youtube, linkedin, metaads, googleads,
  google_analytics, telegram, whatsapp, gmail, googlecalendar, googlesheets, googledrive, googledocs, notion, hubspot, canva, heygen, elevenlabs.
  Cần auth config riêng (để 'soon'): tiktok, threads, google_business_profile, tiktok_ads. Composio KHÔNG có: Zalo, Shopee, Lazada,
  TikTok Shop, Haravan, Sapo, CapCut (hiện chữ cái đầu thay logo). Logo: https://logos.composio.dev/api/<slug> (trả ảnh mặc định
  cả với slug không tồn tại → không dùng để kiểm tra app có hay không; kiểm bằng ô tìm kiếm trên dashboard hoặc /api/connect).
  Thêm app: thêm vào APPS trong catalog.js với status 'soon', deploy, gọi /api/connect?toolkit=<slug>&uid=test-xxxxxxxx, ra redirectUrl
  thì mới đổi 'ready'. Một slug 'ready' mà cần auth config làm hỏng composio.create() của mọi người (chat, link nối AI).
- AI phải làm ra kết quả thật (22/11): Canva API (49 công cụ Composio) KHÔNG tạo ảnh từ chữ — Giang nhờ Trợ lý "làm ảnh" thì
  AI chỉ gửi link Canva để tự làm. Đã thêm CREWZY_TAO_ANH; Skill Canva hướng dẫn: tạo ảnh → CANVA_CREATE_URL_ASSET_UPLOAD_JOB →
  CANVA_POST_DESIGNS → gửi edit_url. Chat phát sự kiện {type:'image', url} và giao diện hiện ảnh (kể cả cú pháp ![](link)).
  Đã thử thật: "làm ảnh dọc 4:5 nhà phố hoàng hôn" → ảnh 896×1120 thật trong ~13 giây (flux-2-klein-4b).
  Workers AI không chạy với `wrangler dev --local` ("Binding AI needs to be run remotely") → thử trên trang thật.
- Nối AI bên ngoài (đã tra 22/11/2026): Claude (Connectors → Add custom connector), ChatGPT (Developer mode → Create app, No auth, gói Plus+),
  Gemini (gemini.google.com → Settings → Connected Apps → Add a custom app; chỉ web, giao diện tiếng Anh, cần Keep Activity),
  Grok (grok.com/connectors → New Connector → Custom, gói trả phí). Cả 4 nhận cùng link /mcp/<token> không cần đăng nhập.
  Link cũ (v1, token bắt đầu aHR0c) vẫn chạy nhưng thiếu Brain/công cụ Crewzy; connect.js tự xoá link cũ đã lưu và nhắc tạo lại.
  Đã thử thật: initialize có instructions + serverInfo "Crewzy (Composio)", tools/list có CREWZY_TAO_ANH, CREWZY_BRAIN, tools/call CREWZY_BRAIN OK.
- Nối MCP của app khác (22/11/2026, Giang muốn giống Claude: "trên tên máy chủ, dưới link MCP, khách bấm kết nối"):
  Đã thử thật trên Cloudflare: DeepWiki (không đăng nhập, 3 công cụ) nối được, chat chế độ app gọi DeepWiki: ask_wiki_question
  trả lời đúng trong ~14 giây; Notion, Canva, Linear tự đăng ký app OAuth và ra link đăng nhập đúng (chưa bấm đồng ý vì cần tài khoản
  thật); Context7 không đăng nhập, 2 công cụ. Link đăng nhập trả về https://<site>/api/mcp-callback, nên tên miền mới vẫn chạy.
  Đăng ký app OAuth: nếu máy chủ báo client_id_metadata_document_supported thì dùng client_id = https://<site>/api/oauth-client.json
  (CIMD, tài liệu do Worker trả), không thì tự đăng ký (DCR). Link đăng nhập được kiểm tra ở máy chủ trước (authorizeAccepted)
  để khách không bị kẹt ở trang lỗi. Đã thử 22/11: Linear hiện trang đồng ý "Crewzy is requesting access", Notion chuyển sang đăng nhập Notion.
  CANVA MCP (mcp.canva.com) chỉ nhận redirect của Claude, ChatGPT và localhost — DCR lẫn CIMD đều báo "Invalid redirect URI"
  → bỏ khỏi Điền nhanh, nút Canva dẫn sang ket-noi.html?app=canva (Composio). Muốn dùng MCP Canva phải xin Canva duyệt.
  OpenArt (https://mcp.openart.ai/mcp, ảnh + video) nhận Crewzy: DCR ra link đăng nhập openart.ai (scope full_access) — chưa đăng nhập thử.
  Định dạng kết quả của OpenArt chưa xem được (cần tài khoản) → media.js đoán theo khoá JSON (url, video_url, image…) + content-type khi tải.
  Từ 22/11 (chiều): link nối AI /mcp/* CÓ công cụ MCP ngoài: tools/list gọi loadExternalTools (thêm m<id4>_<tool>), tools/call chạy
  callExternalTool (chỉ mở đúng máy chủ đó, làm mới token OAuth, ảnh/video → media_crewzy link /api/media), initialize ghi danh sách máy chủ.
  Đã thử thật: DeepWiki qua link nối AI — tools/list ~1,1 giây có 3 công cụ m3ab2_*, tools/call read_wiki_structure ~0,9 giây trả đúng.
  Công tắc (22/11): bản ghi máy chủ có off (tắt cả máy chủ) + disabled [tên công cụ]; POST /api/mcp-servers action toggle {id, on} |
  {id, tool, on} | {id, tools:[…], on}. loadExternalTools bỏ máy chủ off và công cụ tắt (lọc TRƯỚC khi cắt 40 công cụ), callExternalTool
  từ chối công cụ tắt; nối lại/đăng nhập lại giữ công tắc (upsert). Lưu tối đa 80 tên + mô tả ngắn (toolMeta) để vẽ công tắc.
- Video bằng credit Crewzy (22/11, Giang: "credit Crewzy phải làm được ảnh và video, không chỉ chat"): CREWZY_TAO_VIDEO (chỉ Trợ lý trong app)
  gọi model bên thứ ba qua env.AI.run(..., {gateway:{id: AI_GATEWAY_ID||'default'}}): lightricks/ltx-2-3-fast (0,03 USD/giây 720p, dọc 720x1280,
  có âm thanh, image_uri cho ảnh chuyển động) → dự phòng xai/grok-imagine-video (0,05 USD/giây 480p). Model bên thứ ba BẮT BUỘC AI Gateway +
  Unified Billing: Giang nạp credit ở Cloudflare dashboard → AI Gateway (phí 5%). Trần 3 video/khách/ngày, 30/app/ngày (KV vidcount:*),
  tắt bằng biến CREWZY_VIDEO=off. Video tải về lưu /api/media (≤24MB). Chưa nạp credit → báo "Máy chủ chưa nạp credit làm video".
  Cloudflare còn có Kling v3 (0,112 USD/giây), Veo 3, Seedance 2.x, Runway Gen-4.5, Pixverse, Vidu… cùng cách gọi.
  Quy tắc mới: khách bảo "đăng luôn" trong chat (app hoặc AI của khách) = đồng ý, đăng ngay rồi nộp phiếu da_dang.
- Workers AI (tra 22/11/2026): miễn phí 10.000 neurons/ngày (reset 7 giờ sáng VN), vượt thì 0,011 USD/1.000 neurons (chỉ gói Workers Paid,
  gói Free hết là báo lỗi). flux-2-klein-4b: 26,05 neurons mỗi ô 512×512 đầu ra → ảnh 4:5 (6 ô) ≈ 156 neurons ≈ 60 ảnh/ngày miễn phí,
  sau đó ≈ 0,0017 USD/ảnh. Chat chế độ app dùng khoá Anthropic, không tính vào Workers AI.
- Chat nạp vào lời dặn mỗi lượt: lời dặn chung + Brain thương hiệu + tên app đã kết nối + Skill của các app đó (skillText).
- Google Cloud: project riêng **Crewzy** (crewzy-515511, tài khoản truonggiang2511a@gmail.com), Google Auth Platform: External, ĐÃ chuyển
  production 22/11 (chỉ openid/email/profile → không cần Google duyệt; thêm logo hoặc scope nhạy cảm thì phải duyệt). OAuth client "Crewzy Web"
  496481547353-1476vkee5aocagfajus82sccpmiu2048.apps.googleusercontent.com, origin https://crewzy.truonggiang2511a.workers.dev
  (đổi tên miền thì thêm origin mới ở Clients → Crewzy Web; Google báo áp dụng sau 5 phút tới vài giờ). Client secret không dùng.
- Đăng nhập Google: bật bằng biến `GOOGLE_CLIENT_ID` (Client ID loại Web application, origin https://crewzy.truonggiang2511a.workers.dev và tên miền riêng sau này;
  mã công khai, không cần Client secret). Chưa đặt biến → bản thử chạy như cũ (mã khách theo trình duyệt).
  Phiên = cookie HttpOnly `vpai_session` 30 ngày, ký HMAC bằng `SESSION_SECRET` (chưa đặt thì suy ra từ COMPOSIO_API_KEY).
  ID token kiểm tra bằng khoá công khai Google (JWKS, RS256, aud = Client ID), không gọi tokeninfo. Thử cục bộ: `node scripts/authtest.mjs`.
  Map tài khoản trong KV: `user:<sub>` → {uid,…}, `uid:<uid>` → sub. Lần đầu đăng nhập nhận luôn mã trình duyệt cũ
  (nếu chưa thuộc ai) để giữ kết nối Composio đã làm; còn lại uid = `g-<sub>`. Bật đăng nhập rồi thì mọi hàm (connect, status, mcp-link, chat)
  chỉ tin mã trong phiên (`resolveUid`), bỏ qua uid gửi lên; không có phiên → 401 `{login:true}` → trang tự chuyển sang đăng nhập.
- Cài 1 lần bấm (22/11, Giang: "bấm Install như Composio là vào thẳng app Claude, điền sẵn, khách chỉ bấm kết nối"): public/assets/ai-install.js
  + khối #cai-dat đầu tab AI của bạn. Claude dùng ĐÚNG link composio.dev đang dùng: https://claude.ai/customize/connectors?modal=add-custom-connector
  &connectorName=Crewzy&connectorUrl=<link> (điện thoại có app Claude → mở app; máy tính → claude.ai). Cursor: cursor://anysphere.cursor-deeplink/mcp/
  install?name=Crewzy&config=base64({type:'http',url}); VS Code: vscode:mcp/install?<JSON>; hai nút này tắt trên điện thoại. ChatGPT/Gemini/Grok
  không có link điền sẵn cho connector tự tạo (Composio dùng app đã duyệt trong thư mục ChatGPT/Grok) → tự chép link rồi mở trang cài đặt.
  Claude Code/Codex/AI khác: chép lệnh/link. Mở tab là tự tạo link (/api/mcp-link) nếu chưa có, để nút bấm chạy ngay (iPhone chỉ cho chép khi
  đang bấm). Văn phòng → Bộ não: nút Claude mở thẳng link điền sẵn khi đã có link.
- Tab AI của bạn làm theo kiểu openart.ai/mcp (Giang gửi 22/11): 3 bước có số (tạo link → chọn AI theo tab Claude/ChatGPT/Gemini/Grok/
  Cursor/AI khác → câu lệnh mẫu sao chép được), thư viện "Câu lệnh mẫu" lọc Marketing/Mạng xã hội/Bán hàng/Báo cáo (nút Thử trong Crewzy
  → chat.html?q=, Sao chép), Câu hỏi thường gặp. Dữ liệu tab + câu lệnh nằm trong public/assets/ai-prompts.js (window.crewzyAiTabs.select).
- Claude Code (22/11, tra code.claude.com/docs/en/mcp): khách nối Claude Code VÀO Crewzy bằng
  `claude mcp add --transport http --scope user crewzy <link>` (tab Claude Code ở AI của bạn tự điền link, có nút sao chép);
  đăng nhập Claude Code bằng tài khoản claude.ai thì connector Crewzy thêm ở claude.ai có sẵn. Đã thử CLI thật: `claude mcp list` → Connected.
  Chiều ngược lại (khung chat Crewzy điều khiển Claude Code của khách) KHÔNG làm: `claude mcp serve` chỉ chạy stdio trên máy khách,
  Worker trên mây không gọi tới được; muốn được phải mở đường hầm từ máy khách ra internet và để lộ Bash/sửa file của máy → quá rủi ro
  cho khách không rành kỹ thuật. Gói Claude Pro/Max cũng không được dùng làm bộ não trong app khác.
- Hai chiều AI của khách ↔ Crewzy (22/11, Giang: "bằng mọi cách nối Model của khách, dùng skill Claude Code/Codex, trả kết quả về Crewzy"):
  link MCP v2 có thêm CREWZY_VIEC_CAN_LAM + CREWZY_NOP_KET_QUA; initialize khai báo capabilities.prompts và cổng tự trả prompts/list,
  prompts/get (5 lệnh: lam_viec_crewzy, len_lich_tuan, bao_cao_tuan, tra_loi_binh_luan, video_quang_cao → Claude Code hiện /mcp__crewzy__<tên>).
  Tab Codex (`codex mcp add crewzy --url <link>`, cấu hình dùng chung CLI/VS Code/app ChatGPT máy tính) và Claude Code có lệnh cài Skill
  (curl /api/skill.md vào ~/.claude/skills/crewzy/ hoặc ~/.codex/skills/crewzy/). Trợ lý trong app cũng nộp kết quả vào phiếu việc.
  Menu "Việc chờ duyệt" hiện số phiếu cho_duyet thật (layout.js → /api/jobs). Tự chạy khi khách vắng: khách đặt lịch trong AI của họ
  (scheduled task của Claude/ChatGPT, cron `claude -p "/mcp__crewzy__lam_viec_crewzy"`) — Crewzy không gọi được AI của khách (không có sampling).
- Quy trình chuẩn + phòng Nghiên cứu đối thủ (22/11, Giang: "tham khảo n8n/Make, thêm quy trình, skill cho AI của khách, phòng đối thủ soi
  Reels/website, hẹn giờ, app liên kết chặt"): 18 quy trình học từ mẫu n8n/Make dùng nhiều nhất (nội dung + đăng đa kênh, lead → CRM →
  chăm sóc, soạn trả lời bình luận + chuyển câu nhạy cảm, email tự trả lời từ kiến thức, theo dõi đối thủ, báo cáo định kỳ).
  AI lấy bước bằng CREWZY_QUY_TRINH (không id → danh sách + app thiếu; có id → bước, quy tắc, app thiếu) — có trong chat, link MCP;
  mỗi quy trình là MCP prompt qt_<mã> (Claude Code: /mcp__crewzy__qt_<mã>); SKILL.md liệt kê đủ quy trình + quy tắc.
  Phiếu có trường quy_trinh; loai 'brain': khách Duyệt → Crewzy tự lưu Brain thương hiệu (cleanBrand, giữ mục cũ).
  Soi đối thủ (đã thử 22/11): Apify MCP https://mcp.apify.com nhận Crewzy (CIMD → console.apify.com), Firecrawl https://mcp.firecrawl.dev/mcp
  không cần đăng nhập (3 công cụ scrape/search/parse). vidIQ (https://mcp.vidiq.com/mcp) và Canva chặn redirect_uri lạ ("redirect_uri is not
  allowed") → vidIQ chỉ dùng trong Claude/ChatGPT của khách; quy trình ghi "có vidIQ thì dùng thêm". Composio có toolkit vidiq_mcp (API key) — chưa thử.
  Văn phòng có thêm phòng Nghiên cứu đối thủ (office.js), nút "Quy trình của phòng" → quy-trinh.html?phong=<id> (ROOM_DEP).
  runAgent (src/routes/chat.js) tách riêng để cron dùng lại; takeAppQuota export.
- Bấm nút Bộ não AI ở Văn phòng: khung chi tiết có 4 nút Claude/ChatGPT/Gemini/Grok → ket-noi.html?tab=ai&ai=<x> (làm nổi hướng dẫn).
  Logo AI: logos.composio.dev/api/claude|openai|gemini|grok (anthropic, chatgpt, xai trả ảnh mặc định).
- Đăng nhập AI (đã nghiên cứu 22/11/2026):
  OpenRouter OAuth PKCE chạy ngay, không cần đăng ký app: `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256`,
  quay về `?code=` → POST https://openrouter.ai/api/v1/auth/keys {code, code_verifier, code_challenge_method} → {key}. Chat gọi qua
  OpenAI SDK baseURL https://openrouter.ai/api/v1, dùng `max_tokens`. Model cho chọn: anthropic/claude-sonnet-5.5, anthropic/claude-haiku-5.5,
  google/gemini-4-neon (đã thấy trên openrouter.ai; muốn thêm model phải sửa cả OPENROUTER_MODELS trong src/routes/chat.js và chat.html).
  "Sign in with ChatGPT" (dùng gói Plus/Pro trong app khác) có từ 9–10/2026 nhưng app thương mại đóng mã phải được OpenAI chọn → cần nộp đơn.
  Claude: gói Pro/Max cấm dùng trong app bên thứ ba; đường hợp lệ là Linked billing (beta) cho tổ chức Claude Console trả trực tiếp
  (tạo OAuth app trên Console, Anthropic duyệt, thử nghiệm 10 người ≤ 50 USD/tháng, gửi `billing_policy` bill_to user_profile).
  Google/Gemini: đăng nhập Google chỉ là danh tính, không dùng được gói Gemini; Google cấm mượn token Gemini CLI từ 2/2026 → chỉ khoá API.
  Composio không làm "bộ não": toolkit openai/gemini của Composio là công cụ dùng khoá API, không có đăng nhập tài khoản AI.
- Mỗi trang có tương tác khai báo `window.PAGE_LOGIC = { state, vals(state, set) }` trong thẻ `<script>` ngay trước `assets/app.js`.
- Bản Netlify cũ (https://van-phong-ai.netlify.app, site id 26e332c7-f0ff-4912-81ad-5154ae75eb88) giữ làm dự phòng, KHÔNG cập nhật nữa;
  xoá khi Crewzy trên Cloudflare chạy ổn. Dữ liệu Blobs bên đó (Brain, map tài khoản) không chuyển sang; kết nối Composio vẫn còn
  (gắn với vpai-<uid>), nhưng mã trình duyệt khác tên miền nên phải kết nối lại trên Crewzy.
- Bản gốc thiết kế (canvas Design, chỉnh trực tiếp được): https://claude.ai/artifact/NUTG94g3zTHJDHiUzmCxhS
  Ba trang HTML ở đây được chuyển từ canvas đó; sửa giao diện lớn thì sửa canvas trước rồi chuyển lại, hoặc sửa thẳng HTML và ghi nhật ký.
- Tài liệu quy trình 9 phòng, 20 quy trình, lộ trình: https://claude.ai/artifact/Htar34ehr6gbL1TzT8qVoG

