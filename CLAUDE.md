# CLAUDE.md — Crewzy (trước đây tên tạm "Văn Phòng AI")

Đọc file này trước khi sửa bất cứ thứ gì.

Crewzy ("đội nhân viên AI cho doanh nghiệp") là web app riêng, **không liên quan Lumi**. Tên chốt 22/11/2026 (Giang muốn tên tiếng Anh;
crewzy.ai còn trống, crewzy.com đã có người đăng ký). Tên hiển thị nằm ở APP_NAME (src/lib/common.js), layout.js, title các trang. Ý tưởng: doanh nghiệp có sẵn quy trình của cả công ty
(9 phòng, 20 quy trình). Khách chỉ đăng nhập, kết nối công cụ (chủ yếu qua Composio), nối AI của mình
(Claude hoặc ChatGPT) làm bộ não rồi bấm Run. Giao diện trông như văn phòng có các phòng đang làm việc thật.
Khách mua credit hoặc gói tháng, tiền đó trả Composio, AI và hạ tầng.

**Hiện trạng (22/11/2026): chạy trên Cloudflare Workers (chuyển từ Netlify). Kết nối thật 176 app qua Composio + danh bạ 36 máy chủ MCP, 23 quy trình (có video trọn gói), Trợ lý AI, link nối AI (MCP),
Brain thương hiệu, Quy trình, đăng nhập Google + gói/credit (BẬT trên bản thật từ 22/11 tối, GOOGLE_CLIENT_ID đã đặt).** Văn phòng chạy bằng số liệu thật (/api/office) từ 22/11.

Chủ dự án: Giang (giao tiếp tiếng Việt). Giao diện, thông báo, tooltip hiển thị cho khách: tiếng Việt.
Tên biến/hàm: tiếng Anh. Không tuyên bố "đã chạy được/đã build xong" nếu chưa thực sự chạy lệnh và thấy kết quả.

---

## 0. Cách làm việc với Giang (áp dụng cho MỌI yêu cầu, sửa 22/11/2026 theo ý Giang)

**Gỡ rối và đề xuất ý tưởng, không bắt bẻ.** Mục tiêu là tìm ra hướng giải quyết tối ưu cho mục tiêu thật (doanh nghiệp
không rành công nghệ kết nối xong là chạy, ra khách và doanh thu thật, app có lãi trên credit), không phải soi lỗi đề xuất của Giang.

Mỗi lần nhận yêu cầu:
1. Hiểu mục tiêu thật đằng sau yêu cầu (nói 1 câu nếu cần cho rõ).
2. Tự tư duy ra cách làm, kể cả cách mới Giang chưa nghĩ tới; tận dụng cái repo đã có, kiểm tra tài liệu thật trước khi dùng một API.
3. Đề xuất hướng tốt nhất (kèm 1–2 phương án khác thật ngắn nếu đáng cân nhắc), rồi làm luôn nếu yêu cầu rõ và dễ làm lại.
4. Rủi ro thật (tốn tiền, mất dữ liệu, làm hỏng khách đang dùng/quảng cáo, bị nền tảng chặn) chỉ nêu 1–2 câu KÈM cách né.
   Không liệt kê lỗi vụn, không phản biện từng chi tiết, không mở đầu bằng "chỗ chưa ổn".
5. Chỉ hỏi lại quyết định thật sự thuộc về Giang. Giang chọn hướng nào thì làm hướng đó, ghi quyết định vào nhật ký mục 5.

**Giữ file này gọn (đọc mỗi lượt, tốn token):** chi tiết kỹ thuật → docs/ghi-chu-ky-thuat.md, nhật ký → docs/nhat-ky.md. Khi phiên làm việc đã dài
(đã tóm tắt ngữ cảnh) hoặc file này vượt ~50KB: NHẮC Giang mở phiên mới / rút gọn file.

Giang cho phép tự bổ sung/sửa file này khi thấy chi tiết thiếu hoặc sai so với code thật, miễn là kiểm chứng trước khi ghi.
Cập nhật app không được làm ảnh hưởng quảng cáo đang chạy, sự kiện đo chuyển đổi và khách đang dùng.

---

## 1. Cấu trúc và cách chạy

```
public/                 Trang tĩnh (Workers static assets, binding ASSETS, html_handling "none" → giữ đuôi .html); CLAUDE.md, README không lên mạng
public/_headers          X-Robots-Tag: noindex (bản thử không cho Google lập chỉ mục) + header an toàn · public/404.html
public/index.html        Màn 1 · TRUNG TÂM ĐIỀU HÀNH (đổi tên từ Văn phòng 23/11; thanh dưới điện thoại ghi "Điều hành"): việc gấp (chờ duyệt), Việc nên làm tiếp (5 bước thiết lập), 5 số liệu, sơ đồ phòng, chi tiết, hoạt động
public/assets/office.js  Đọc /api/office mỗi 20 giây (khi trang đang mở). Máy tính: CÂY VẬN HÀNH SVG 1000×800 — rễ (Thương hiệu, Phân tích đối thủ, Kho & dữ liệu)
                         → thân (Bộ não AI) → 8 nhánh phòng ban (6 trên + 2 dưới: Sản xuất & Phân phối, Nghiên cứu & Chiến lược; LAYOUT.desk/LAYOUT.mob) → lá = ứng dụng
                         (room.leaves từ BRANCH_APPS trong src/routes/office.js: bộ app đúng chuyên môn mỗi nhánh + nhiệm vụ, ≤7, đã nối viền liền, chưa nối mờ + dấu +, bấm lá → ket-noi.html?app=); hạt sáng CHỈ chạy khi có việc thật; điện thoại: cùng cây (LAYOUT.mob 400×640, tên ngắn MSHORT, ≤3 lá) + lưới ô phòng bên dưới. Trạng thái phòng: work/wait/queue/done/setup/idle
src/routes/office.js     GET /api/office: phòng (phiếu theo quy_trinh→phong, loai→phòng), app đã nối/nên nối, lịch, sự kiện (lich_su),
                         bộ não (aiseen:<uid> do cổng MCP ghi lúc initialize + Trợ lý app), setup. dang_lam quá 3 giờ coi như cho_lam
public/cho-duyet.html    Màn 2 · Việc chờ duyệt (DỮ LIỆU THẬT từ 22/11, script assets/jobs.js): Giao việc mới (mẫu, Giao cho AI của tôi /
                         Làm ngay bằng Trợ lý Crewzy), lọc Chờ duyệt/Chờ AI làm/Đã duyệt/Báo cáo, ?id= làm nổi. Từ 23/11: thẻ hiện "✓ Bài viết xong · N ảnh · N video",
                         ảnh/video lớn bên trái + bài bên phải, Prompt AI đã dùng; nút ✓ Duyệt & đăng đa kênh (duyệt rồi mở Trợ lý đăng), ↻ Yêu cầu AI làm lại (chip ý sửa
                         + ghi chú → Làm lại ngay bằng Trợ lý / Gửi AI của tôi), Tự sửa ảnh/video (app đã nối mở thẳng web, chưa nối → Kết nối; dán link bản sửa → action thay_media)
public/ket-noi.html      Màn 3 · Kết nối (kiểu Composio): lưới logo, lọc thể loại, tìm kiếm, ?app=<slug> trang chi tiết có Skill, ?tab=ai AI của bạn,
                         ?tab=mcp MCP khác (tên máy chủ + link MCP → Kết nối, script assets/mcp-servers.js)
public/quy-trinh.html    Quy trình (assets/quy-trinh.js): 20 quy trình chuẩn từ /api/workflows, lọc 8 phòng (?phong=), app bắt buộc/nên có sáng khi đã
                         nối, MCP ngoài (Apify/Firecrawl/OpenArt), Chạy ngay · Giao cho AI của tôi · Hẹn giờ (hộp thoại), danh sách Lịch đang hẹn
public/thuong-hieu.html  Brain thương hiệu: 16 mục + Mẫu tham khảo (refs: video/ảnh mẫu, giọng mẫu, nhạc, logo, tư liệu; dán link hoặc tải file
                         qua /api/upload), lưu /api/brand, AI đọc mỗi lượt chat và BƯỚC 0 của mọi quy trình.
                         25/11: tải nhiều file (XHR có %, lần lượt) → TỰ LƯU; MÃ MẪU V/A/G/N/L/T + số (brand.js assignCodes, giữ mã cũ) → khách gõ "theo mẫu V1",
                         AI gọi CREWZY_BRAIN {ma}. AI XEM MẪU: assets/ref-watch.js (trình duyệt đo cắt cảnh 48×27, ≤24 khung 512px, tiếng 16kHz 4×55s WAV)
                         → POST /api/phan-tich-mau (src/routes/refAnalyze.js: Whisper + Claude Sonnet 5.5 nhìn khung → phan_tich/tom_tat lưu vào ref, 30 lần/ngày,
                         trừ credit theo token). Link TikTok/YouTube không xem được (CORS) → bảo khách tải file. brandPack chỉ gửi tom_tat, chi tiết qua {ma}
public/chat.html         Màn 4 · Trợ lý AI kiểu Claude/ChatGPT (23/11, assets/chat.js): main lưới 3 hàng (đầu · khung chat cuộn · ô soạn) nên ô soạn KHÔNG đè tin;
                         điện thoại: html.cz-lock (body fixed, chỉ khung tin cuộn, khung chat fixed giữa .mtop và .mbar; bàn phím mở → visualViewport + class kb-open);
                         ô soạn tự giãn ≤220px; nút + (tải ảnh/video/tài liệu → /api/upload vào Kho, chọn từ Kho, Ứng dụng: đã nối + tìm + Kết nối
                         /api/connect?back=chat, lấy ảnh từ web); micro → /api/giong-noi (MediaRecorder, dự phòng SpeechRecognition) rồi gửi luôn;
                         loa = đọc to bằng speechSynthesis vi-VN (crewzy.tts); bước công cụ gom "Đã làm N bước"; chọn AI/bộ não trong hộp thoại;
                         ?q= gửi sẵn, ?dinh_kem=<link>&loai= đính kèm sẵn (từ Kho). Tin user có files [{url,kind,name}] (chỉ link /api/media|/api/img)
public/kho.html          Kho lưu trữ (assets/kho.js): lưới ảnh/video/tài liệu/link từ /api/kho, lọc, tìm, tải nhiều file/kéo thả, dán link, đổi tên,
                         Dùng (→ chat), xoá (xoá cả file R2 của chính khách), thanh dung lượng theo gói
public/dang-nhap.html    Đăng nhập bằng Google (nút Google Identity Services, chế độ popup); chưa bật thì cho vào thẳng
public/bat-dau.html      Thiết lập 4 bước BẮT BUỘC khi bật gói (assets/bat-dau.js): Brain (3 mục + tự điền từ website) → kết nối ≥1 kênh
                         (/api/connect?back=bat-dau quay lại đây) → AI (link MCP: Claude 1 bấm/chép link, tự nhận khi aiseen có; hoặc Trợ lý Crewzy)
                         → chọn gói + VietQR (assets/pay.js), tự hỏi trạng thái đơn tới khi paid → "Vào Văn phòng". Không có menu trái
public/ket-qua.html      Kết quả (assets/ket-qua.js): biên nhận tháng từ /api/results?thang= (giờ + tiền tiết kiệm, gấp bao nhiêu lần tiền gói),
                         5 số chính, cột việc mỗi ngày (SVG), chi tiết, kết quả gần đây, gợi ý làm thêm. layout.js: thẻ gói dưới menu + thanh nhắc gia hạn
public/goi.html          Gói và credit (assets/goi.js): tóm tắt gói/hạn/credit, gia hạn, nạp credit, bảng giá, sổ credit, đơn; khu quản trị (ADMIN_EMAILS):
                         cấp credit/ngày theo email, 100 tài khoản, 30 giao dịch SePay gần nhất
public/assets/pay.js     Dùng chung: thẻ gói/nạp, tạo đơn, hiện QR (vietqr.app → lỗi thì qr.sepay.vn) + thông tin chuyển khoản có nút Chép, hỏi trạng thái 4 giây/lần
public/assets/style.css  Phong cách composio.dev (22/11): Geist + JetBrains Mono (cả hai có bộ chữ tiếng Việt), nền #F6F6F6, thẻ trắng viền #E5E5E5 bo 12px,
                         chữ #0F0F0F, nút .btn = mono in hoa góc vuông (chính màu đen), .btn.chip = chip lọc chữ thường bo tròn, .hl = chữ xanh #0007CD
                         trong tiêu đề, nhãn mono in hoa (.label-mono, kpi, sb-label), --highlight #D4FF4A; khung Văn phòng tối trung tính #0F0F0F
public/assets/layout.js  Menu trái dùng chung (máy tính) + điện thoại ≤760px: thanh trên .mtop (logo, Kết nối), thanh dưới .mbar 5 mục
                         (Văn phòng, Duyệt có số, Trợ lý, Quy trình, Thêm) và bảng .msheet (Kết nối, Brain, Kết quả, Gói, tài khoản). Có window.vpaiUid()
public/assets/app.js     Bộ chạy nhỏ: data-if, data-text, data-click, data-change, data-checked
public/assets/favicon.svg
public/assets/connect.js   Trang Kết nối: vẽ từ /api/catalog + /api/status, kết nối, chi tiết + Skill, OpenRouter, link nối AI
public/assets/quy-trinh.js · brand.js  Script trang Quy trình (mẫu FLOWS nằm ở đây) và Brain thương hiệu
public/assets/chat.js      Trang Trợ lý AI: gọi /api/chat, đọc NDJSON từng dòng, lưu lịch sử + chế độ + khoá trong localStorage
public/assets/auth.js      Có trên mọi trang (trong <head>): hỏi /api/auth/me, bắt buộc đăng nhập thì chuyển sang dang-nhap.html, hiện email + Đăng xuất dưới tên app
public/assets/openrouter.js  Đăng nhập OpenRouter (OAuth PKCE) trên trình duyệt, khoá lưu localStorage vpai.key.openrouter
scripts/page.py           Khung trang HTML mới (head + menu + main): from page import page
src/worker.js             Worker: '/' → index.html, /api/* → src/routes, /mcp/* → cổng MCP, còn lại → ASSETS
src/lib/catalog.js        NGUỒN DUY NHẤT danh mục app: thể loại, mô tả, status ready/soon, Skill (can/try/rules); TOOLKITS = app ready
                          (gộp thêm src/lib/catalogExtra.js: 107 app + 6 thể loại mở rộng; /api/catalog trả thêm mcp = danh bạ MCP)
src/lib/mcpDirectory.js   DANH BẠ MÁY CHỦ MCP (nguồn duy nhất): id, link, auth none|oauth, ngoai (chỉ nhận Claude/ChatGPT) → thẻ MCP ở Kết nối,
                          Điền nhanh ở tab MCP khác, MCP_HOSTS + chip MCP trong Quy trình
src/lib/industries.js     GÓI THEO NGÀNH (7 ngành): app nên nối (5–7, theo thứ tự), MCP, quy trình nên chạy → Kết nối "Bạn kinh doanh gì?" (?nganh=)
                          + thanh tiến độ, Quy trình lọc ?nganh=; lựa chọn lưu localStorage crewzy.nganh dùng chung 2 trang
src/lib/common.js         APP_NAME, TOOLKITS, Web Crypto (HMAC phiên, ký link MCP, xác minh ID token Google), resolveUid, KV
src/lib/brand.js          Mục Brain (BRAND_FIELDS gồm visual, video_style, audio, voice_provider, voice_id), REF_TYPES, cleanBrand (refs chỉ ghi
                          khi gửi lên → phiếu brain của AI không xoá refs), brandText, brandPack (gói cho quy trình: tóm tắt, mẫu, giọng, nhạc, thiếu)
src/routes/upload.js      POST /api/upload (trang Brain, ≤95MB ảnh/video/âm thanh) · PUT /api/upload/<mã ký> (AI trên máy curl -T, mã từ
                          CREWZY_TAI_LEN, 2 giờ, dùng 1 lần, src/lib/uploads.js); 40 file/ngày/khách (KV upcount:*); lưu qua putMedia (R2)
src/routes/connect.js     GET /api/connect?toolkit=…[&uid=] → link đăng nhập Composio (multiAccount, alias riêng mỗi lần)
src/routes/status.js      GET /api/status → {accounts: {slug: số tài khoản ACTIVE}}
src/routes/mcpLink.js     GET /api/mcp-link → link https://<site>/mcp/<token> (token v3 có mã link k, tên theo thiết bị tạo)
src/lib/mcpLinks.js       Link nối AI của khách: KV mcplinks:<uid> {links:[{k,ten,tao,dung:{ten AI,luc}}] ≤20, cu_off}; linkAllowed (cổng gọi mỗi yêu cầu,
                          đệm 20 giây) · touchLink lúc initialize (≤1 lần/6 giờ) · thu hồi từng link / mọi link v2 cũ. Quá 20 → bỏ link cũ nhất chưa dùng
src/routes/mcpLinks.js    GET/POST /api/mcp-links (revoke {k} | revoke_old) → thẻ "Link đang hoạt động" ở Kết nối → AI của bạn (assets/mcp-links.js)
public/chinh-sach.html · dieu-khoan.html  Chính sách bảo mật + Điều khoản (trang tĩnh, không auth.js; link ở dang-nhap.html và màn đồng ý Google)
src/routes/mcpGateway.js  /mcp/* kiểm tra chữ ký token rồi chuyển tiếp MCP tới phiên Composio, gắn x-api-key ở máy chủ; token v2 có mã khách →
                          chèn instructions (Brain + app đã nối + Skill) vào initialize, thêm CREWZY_* vào tools/list, tự chạy tools/call CREWZY_*.
                          APP_ONLY_TOOLS (CREWZY_TAO_VIDEO tốn tiền thật, CREWZY_CHO treo Worker) không liệt kê VÀ bị chặn khi gọi thẳng qua MCP;
                          tools/call gửi surface 'mcp' → CREWZY_QUY_TRINH trả bản forMcp (workflows.js); nhận việc ghi tên AI từ aiseen:<uid>
src/lib/mcpClient.js      Máy khách MCP Streamable HTTP (SSE/JSON, Mcp-Session-Id) + OAuth chuẩn MCP: oauth-protected-resource → máy chủ cấp quyền
                          → tự đăng ký app (DCR) → PKCE S256 + resource → đổi mã/làm mới token. Chặn http, IP, localhost, link /sse cũ
src/lib/mcpServers.js     Lưu máy chủ MCP của khách (KV mcpsrv:<uid>, tối đa 10, token mã hoá AES-GCM sealText), loadExternalTools cho chat
                          (tối đa 40 công cụ/máy chủ, 80 tổng, tên m<id>_<tool>, mỗi máy chủ chờ tối đa 12 giây)
src/routes/mcpServers.js  GET/POST /api/mcp-servers (add|remove|test) · GET /api/mcp-callback (app kia trả về sau khi khách đồng ý)
src/lib/media.js          Lấy ảnh/video/âm thanh từ kết quả MCP ngoài (dữ liệu base64, resource, link trong JSON/chữ), tải về lưu R2
                          (binding MEDIA, bucket crewzy-media, khoá media/<id>, ≤95MB, truyền luồng thẳng bằng FixedLengthStream; không có MEDIA
                          thì KV media:<id> ≤24MB như cũ), lớn hơn giữ link gốc. /api/media/<id>.<đuôi> đọc R2 rồi tới KV (file cũ), có Range
src/lib/jobs.js           PHIẾU VIỆC (cầu nối hai chiều với AI của khách): KV jobs:<uid> (≤150), trạng thái cho_lam → cho_duyet → da_duyet → da_dang
                          (+ xong, tu_choi); công cụ CREWZY_VIEC_CAN_LAM (id = đọc đủ nội dung một phiếu cũ, chỉ đọc), CREWZY_NOP_KET_QUA
                          (tự lưu ảnh/video về /api/media); MCP_PROMPTS
src/routes/jobs.js        GET/POST /api/jobs (tao | duyet | tu_choi | lam_lai | xong | da_dang | sua | xoa) · GET /api/skill.md (SKILL.md cho Claude Code/Codex)
src/lib/workflows.js      THƯ VIỆN QUY TRÌNH CHUẨN (nguồn duy nhất): DEPARTMENTS (10 phòng: Thương hiệu, Phân tích đối thủ, Nghiên cứu & Chiến lược, Nội dung & Video, Sản xuất & Phân phối, Marketing & Phân tích, Bán hàng, CSKH, Báo cáo, Hằng ngày), WORKFLOWS (20 quy trình: bước,
                          lịch gợi ý, loại kết quả), CHANNELS (12 kênh/nền tảng), nhóm công cụ G + TOOLSETS (mỗi quy trình: kenh + cong_cu = các vai trò,
                          mỗi vai trò nhiều app thay thế, bat_buoc/san_co/san_co_mcp), groupStatus/missingFor, workflowPrompt, WORKFLOW_RULES,
                          APP_ONLY_TOOLS + forMcp (viết lại câu nhắc công cụ chỉ có trong app cho AI ngoài). Sửa/thêm CHỈ ở đây
src/lib/schedules.js      Hẹn giờ: KV sched:<uid> (≤10 lịch), schedidx; cron */15 (wrangler triggers) → tạo phiếu việc; che_do 'crewzy' thì
                          runAgent chế độ app tự làm (≤3 lượt mỗi lần cron, tính vào trần lượt của app). scripts/schedtest.mjs
src/routes/workflows.js   GET /api/workflows · GET /api/workflows/status?uid= (sẵn sàng thật) · GET/POST /api/schedules (tao | bat | tat | xoa)
src/lib/crewzyTools.js    Công cụ riêng: CREWZY_TAO_ANH (Workers AI flux-2-klein-4b → dự phòng flux-1-schnell, lưu KV img:<id> 90 ngày,
                          phục vụ /api/img/<id>.jpg công khai, 20 ảnh/ngày/khách) và CREWZY_BRAIN; dùng chung cho chat và MCP
src/lib/billing.js        GÓI + CREDIT (nguồn duy nhất): billingOn (DB + GOOGLE_CLIENT_ID + BILLING≠off), gói/nạp/giá mặc định (đổi bằng PLANS_JSON,
                          TOPUPS_JSON, PRICES_JSON), onboarding() 4 bước, charge (nguyên tử: UPDATE … WHERE credits>=n + ledger WHERE changes()>0),
                          chargeAfter (token AI, có thể âm, RETURNING), grant (cộng dồn hạn gói), toolPrice, tokenCredits, makeMeter, gate, ADMIN_EMAILS
src/lib/instant.js        COMPOSIO INSTANT (22/11 tối): INSTANT_APPS (serpapi, firecrawl, tavily, elevenlabs, google_maps, apollo, semrush, ahrefs) chạy
                          không cần khách kết nối, Composio trả từ ví của Giang (giá gốc 0% phí) → instantConfig (trần ngày: app INSTANT_DAILY_USD=1,
                          khách INSTANT_USER_DAILY_USD=0,3, tắt INSTANT=off), instantUsd đọc instantCharge, recordInstant (KV instusd:<ngày VN>:<uid|all>).
                          CHỈ Trợ lý Crewzy (chat mode app + cron) bật Instant; mcpLink tạo phiên instant:false (cổng MCP không đo được tiền).
                          readiness ctx.instant → nhóm có app Instant coi như đủ (chat, trang Quy trình, Văn phòng). Test: scripts/instanttest.mjs
src/lib/activity.js       VIỆC AI ĐÃ LÀM: classify(tên công cụ) → dang_bai/tra_loi/gui_tin/anh/video/khach/doc/khac, recordActivity → D1 activity
                          (uid, day, kind, n; migrations/0002_activity.sql, ĐÃ áp lên D1 thật 22/11). Chat ghi khi công cụ chạy không lỗi, cổng MCP ghi lúc gọi.
                          buildResults (giờ tiết kiệm theo DEFAULT_MINUTES, 50.000đ/giờ; RESULT_MINUTES_JSON, RESULT_HOUR_VND), runWeeklyReports (cron thứ Hai
                          ≥8 giờ VN, cờ KV weekly:<ngày>, phiếu 'Báo cáo tuần Crewzy' loai bao_cao, không gọi AI; WEEKLY_REPORT=off). Phiếu nguoi_lam 'Crewzy…' không tính.
src/lib/missions.js       6 NHIỆM VỤ HẰNG NGÀY (nguồn duy nhất của dây chuyền Run): san_xuat, cham_soc_mxh, quang_cao, bao_cao_ceo, cham_soc_khach, nghien_cuu;
                          mỗi nhiệm vụ 2–3 slot app (apps ứng viên, 'mcp:<id>', bat_buoc, nhieu, san_co) + lich (quy trình theo giờ, tu/toi cho dây trên cây).
                          PRIORITY = thứ tự ưu tiên khi gói hết số lịch; slotStatus (đã nối/gợi ý/href). Thẻ: public/assets/missions.js vào [data-missions]
                          ở Trung tâm điều hành + đầu trang Quy trình (▶ Chạy ngay → chat.html?q=, Tự chạy hằng ngày → POST /api/autopilot {action, nv}, Run tất cả)
                          Chọn công cụ (23/11): logo app đã nối trên thẻ = nút chọn/bỏ chọn (✓, KHÔNG ngắt kết nối; ô bắt buộc giữ ≥1) → POST action 'chon' (apref) → prefText vào lệnh
                          (Run/lịch/AI của bạn); nút + thêm app của khách. Trang Quy trình: nhóm công cụ cũng chọn/bỏ chọn (localStorage crewzy.qtchon) → lệnh Chạy ngay/Giao AI/ghi chú Hẹn giờ
src/lib/autopilot.js      CHẠY TỰ ĐỘNG CẢ CÂY (nút ▶ Run trên Cây vận hành): CHAIN = PRIORITY × missions.lich (12 bước, lịch gắn nv = mã nhiệm vụ; bật/tắt riêng từng nhiệm vụ), (lead → CRM, trả lời bình luận mỗi giờ, nhắc sale, bản tin sáng CEO,
                          lịch nội dung, đăng bài đã duyệt, báo cáo tuần vào Google Sheets, soi đối thủ, chiến lược tháng) = lịch nguon 'cay'; chỉ bật bước
                          readiness sẵn sàng, theo số lịch gói (ưu tiên ra khách trước); cần Brain ≥4/6 mục. GET/POST /api/autopilot (src/routes/autopilot.js).
                          Dây giữa phòng trên cây = EDGES trong office.js (khớp CHAIN tu→toi): bật tự động → dây đứt nét chảy chậm, có việc thật → sáng + hạt.
                          Nút + mỗi nhánh → ket-noi.html?cat=<BRANCH_CAT>; app khách nối thêm mọc lá ở nhánh theo CAT_BRANCH (src/routes/office.js)
src/lib/promptPro.js      BỘ NÃO PROMPT: CREWZY_PROMPT_PRO (chat + link MCP, không gọi AI) = Brain + mẫu khách thích + APP_RULES (Higgsfield, HeyGen, Canva, ảnh/video Crewzy,
                          Descript, Captions, ElevenLabs) + CHANNEL (khổ, hook, công thức bài, CTA, hashtag từng kênh) + tự kiểm. WORKFLOW_RULES "ĐẠO DIỄN PROMPT" + lời dặn chat
                          bắt gọi trước khi làm ảnh/video/bài; phiếu nộp kèm prompt_da_dung, app_da_dung (hiện ở Việc chờ duyệt)
src/lib/leads.js          KHÁCH TIỀM NĂNG + BÁO CEO NGAY: KV leads:<uid> (≤300), công cụ CREWZY_BAO_LEAD (chat + link MCP; gộp trùng số 7 ngày) trả email_ceo
                          (email Google của chủ: uid:<uid> → user:<sub>), kenh_bao (Gmail/Telegram/Slack/Teams/Discord/WhatsApp/Outlook đã nối), crm, viec_tiep để AI gửi
                          tiếp bằng Composio. CREWZY_QUY_TRINH trả bao_ceo (báo cáo/bản tin gửi chủ qua các kênh đó). GET/POST /api/leads (cap_nhat: da_goi|hen|da_chot
                          +gia_tri|huy|xoa; them). leadStats: hôm nay, cần gọi, chốt + doanh thu tháng theo nguồn. Trung tâm điều hành: ô "N lead hôm nay" trên thân cây,
                          bảng Khách tiềm năng (Gọi tel:, Đã gọi, Chốt + số tiền), lead vào Hoạt động. layout.js: thông báo lead mọi trang (60 giây, Notification nếu bật)
src/lib/events.js         SỰ KIỆN TỨC THÌ (Composio Triggers): TRIGGERS gmail GMAIL_NEW_GMAIL_MESSAGE (query bỏ from:me, [Crewzy], quảng cáo; poll ~15 phút),
                          outlook OUTLOOK_MESSAGE_TRIGGER, calendly CALENDLY_MEETING_SCHEDULED (scope user), zendesk ZENDESK_NEW_ZENDESK_TICKET_TRIGGER, typeform TYPEFORM_NEW_RESPONSE (form_id) +
                          googlesheets GOOGLESHEETS_NEW_ROWS_TRIGGER (spreadsheet_id, sheet_name) — form/sheet khách dán link ở hộp thoại Run (KV formcfg:<uid>, POST /api/autopilot action form). Facebook/Instagram/
                          TikTok/LinkedIn/Telegram KHÔNG có trigger (tra docs.composio.dev/toolkits/<slug>.md 23/11). ensureSubscription: 1 webhook cho cả project →
                          https://<site>/api/composio/webhook, khoá ký lưu KV composio:whsecret (sealText); KHÔNG ghi đè nếu project đã có webhook khác. syncTriggers
                          (KV trg:<uid>) chạy khi bật/tắt Run và khi /api/office thấy app có trigger mới nối. handleWebhook: verifyWebhook (v1 HMAC), chống lặp evseen:<id>,
                          vpai-<uid>. handleEvent: lọc email tự động/của chính chủ (chống vòng lặp), có SĐT/đặt lịch/hỏi mua → addLead ngay + GMAIL_SEND_EMAIL báo chủ
                          ngay (tools.execute, dangerouslySkipVersionCheck), phiếu việc nguon su_kien; bật Run chế độ crewzy → evq:<uid> (≤20 lượt AI/ngày) → cron
                          runEventQueue (4/lượt cron). Nhật ký evlog:<uid> vào Hoạt động. Test: officetest (events + webhook ký thật)
src/lib/inbox.js          TRỰC FANPAGE 15 PHÚT (23/11, Composio Facebook không có trigger): cron quét bằng code (runTool, không AI) mỗi Fanpage 2 lượt gọi: FACEBOOK_GET_PAGE_POSTS
                          (fields lồng comments) + FACEBOOK_GET_PAGE_CONVERSATIONS (fields lồng messages.limit(1)); chỉ khách bật Run chế độ crewzy có lịch tra_loi_*; 7:00–22:59
                          mỗi 15 phút, đêm mỗi giờ (INBOX_NIGHT=off, INBOX=off). Có mục mới của khách → lead+Gmail ngay nếu có SĐT, xếp evq 1 lượt AI trả lời đúng comment_id/PSID
                          (trần INBOX_RUNS_PER_DAY=60). KV inbox:<uid> {since, seen, pages, khac} chỉ ghi khi có mục mới. Lịch mỗi giờ tra_loi_* bỏ Facebook (hourlyCover). Test: inboxtest
src/lib/runner.js         ▶ RUN CHẠY THẬT TRÊN CÂY (23/11, không qua chat): /api/run (src/routes/run.js) start → createJobs 1 lượt ghi cho bước sẵn sàng (cả cây = bước hằng ngày theo
                          RUN_ORDER, 1 nhiệm vụ = mọi bước của nó; lap → bật luôn tự chạy mỗi ngày) · step (NDJSON: step/tool/step_done/view, lần lượt từng bước, claim KV run:<uid>,
                          tab thứ 2 nhận busy) · dung (cờ KV, stopWatcher 8 giây) · runJobAuto dùng chung cron (AI quên nộp → tự đóng phiếu cho_duyet). Trang đóng → runPendingRuns
                          (cron, quá 6 phút không ai nhận) làm nốt. Giao diện: public/assets/run.js (khung "Dây chuyền đang chạy" + thông báo + Notification, sự kiện crewzy:run),
                          office.js window.crewzyRunNow → nhánh sáng "▶ <việc AI đang làm>"; /api/office: đang làm ưu tiên hơn chờ duyệt. Test: runtest
src/lib/notify.js         Việc làm bằng code qua composio.tools.execute (không AI): mailOwner (GMAIL_SEND_EMAIL tới email chủ, tiêu đề [Crewzy]), pushCrm (HUBSPOT_CREATE_CONTACT
                          → PIPEDRIVE_ADD_A_PERSON). Dùng khi có lead (CREWZY_BAO_LEAD và sự kiện) → lead.crm. TEST_OFFLINE/không khoá thì bỏ qua
src/lib/ops.js            VẬN HÀNH BẰNG CODE cho khách bật Run (không AI, không chiếm lịch): runBacklog mỗi 30 phút (chờ duyệt >4 giờ, lead nóng chưa gọi >2 giờ → 1 Gmail
                          gộp, 7:00–21:30, nhắc 1 lần/việc KV nhac:<uid>; phiếu dang_lam >3 giờ nguồn hen_gio/su_kien → xếp lại evq 1 lần) · runDigest 18:00 (số liệu ngày)
                          và 22:00 (tổng kết + lịch ngày mai): phiếu bao_cao 'Crewzy (tổng kết tự động)' + Gmail, cờ digest:<ngày>:<giờ>:<uid>, tắt DAILY_DIGEST=off
src/lib/library.js        KHO (D1 library, migrations/0003_library.sql ĐÃ áp lên D1 thật 23/11): addItem (UNIQUE uid+url), listItems, usageBytes, removeItem,
                          CREWZY_KHO + CREWZY_LUU_KHO (AI đọc kho, lưu ảnh web/fanpage vào kho qua rehostUrl). Tự vào kho: upload (tai_len, PUT của AI = ket_qua),
                          ảnh/video AI tạo (ai_tao). Ảnh Nhanh giờ lưu R2 (putMedia) thay KV img 90 ngày khi có MEDIA
src/routes/kho.js         GET/POST /api/kho · src/routes/voice.js POST /api/giong-noi (Whisper large v3 turbo, language vi, ≤3MB, 150 lần/ngày, 1 credit)
src/routes/results.js     GET /api/results?thang=YYYY-MM | ?tuan=1 · Test: scripts/resultstest.mjs
src/routes/billing.js     /api/billing · /api/billing/order (tạo đơn mã CZ+8 ký tự, dùng lại đơn chờ 24 giờ, ≤5 đơn chờ) · /api/billing/admin ·
                          /api/sepay/webhook (Apikey, INSERT OR IGNORE theo id SePay, khớp mã trong content/code/description, kiểm đủ tiền,
                          đánh dấu paid có điều kiện status='pending', luôn trả {success:true} khi khoá đúng) · /api/onboarding · /api/onboarding/brand-from-web
migrations/0001_billing.sql  D1 crewzy-db: accounts, orders, payments, ledger (đã áp lên D1 thật 22/11 qua Cloudflare MCP d1_database_query)
src/routes/chat.js        POST /api/chat → NDJSON {tool|text|done|error}; GET → {appMode, openrouterModels}
src/routes/auth.js        /api/auth/me · /api/auth/google · /api/auth/logout
src/routes/brand.js · catalog.js · openrouterKey.js   GET/POST /api/brand · GET /api/catalog · POST /api/openrouter-key
wrangler.jsonc            Worker "crewzy", nodejs_compat, AI binding AI (Workers AI), KV binding KV (id cefc3dfec3b248929a490ff8cd5cc216, tên crewzy-data),
                          R2 binding MEDIA (bucket crewzy-media, tạo 22/11, vùng ENAM), D1 binding DB (crewzy-db 42d830fe-378c-44f5-8d9f-7f3a42b1ca70, APAC), keep_vars
scripts/page.py           Khung trang HTML mới (head + menu + main) · scripts/authtest.mjs: npm test (phiên, ID token, link MCP)
scripts/r2test.mjs        Thử lưu media vào R2 (bucket giả): PUT, đọc lại, Range, link dùng 1 lần, file 30MB, file cũ KV vẫn mở, không R2 → KV
scripts/billingtest.mjs   Thử gói/credit/SePay/4 bước bằng node:sqlite giả D1 (webhook chống trùng, thiếu tiền, trừ nguyên tử, admin, cộng dồn hạn)
scripts/gatewaytest.mjs   Thử cổng MCP như AI ngoài (KV + Composio giả): tools/list, chặn APP_ONLY_TOOLS, quy trình không nhắc công cụ ẩn, đọc phiếu theo id
src/lib/jobs.js (23/11)   gio_dang (parseGioDang: "19:00"/ISO, giờ VN) + chỉ mục KV postidx → ops.runDuePosts mỗi cron: phiếu ĐÃ DUYỆT tới giờ → evq Trợ lý (Haiku) đăng đúng phiếu
                          (xep_dang, mỗi phiếu 1 lần). Việc chờ duyệt: nút "Duyệt · tự đăng lúc …". AI ngoài thấy luu_y "chưa tới giờ hẹn: KHÔNG đăng"
Quy trình san_xuat_5x5    Nhiệm vụ Sản xuất 06:30: 5 ảnh nhiều khổ + 5 video 9:16 từ ảnh THẬT, bài từng kênh, 10 khung giờ; BƯỚC 0 thiếu Brain/≥5 ảnh Kho → DỪNG hỏi,
                          lưu bằng CREWZY_LUU_BRAIN (crewzyTools: khách gõ trong chat → ghi thẳng Brain, nối thêm/thay) / CREWZY_LUU_KHO (CREWZY_KHO trả tai_len = /kho.html).
                          Thẻ nhiệm vụ có "✦ Chạy bằng AI của tôi" (missions.js aiPrompt → claude.ai/new?q= hoặc chép lệnh)
Chat (23/11)              imageShortcut: Kho có ảnh thật → CREWZY_TAO_ANH trả ảnh thật (không vẽ ảnh giả, không trừ credit), khach_yeu_cau_ai mới cho vẽ;
                          nút Dừng (AbortController ↔ ReadableStream.cancel → stop.stopped); sự kiện memo (memoLine) cất vào lịch sử để "tiếp tục" không làm lại;
                          safeTopSchema gộp oneOf/anyOf/allOf tầng ngoài của mọi công cụ (Claude từ chối cả lượt nếu có). Test: scripts/realphototest.mjs
Gói (23/11 16:47, billing.js) 4 gói: thang 199k/30 ngày (Haiku, 1 tài khoản/nền tảng, 3 Fanpage, 2 bài/ngày, 30 ảnh AI/tháng, không video Crewzy) · sau_thang 6×199k
                          (Sonnet, 5 tài khoản, 5 Fanpage + mua thêm 10k/tháng/trang tới 100, 3 bài/ngày, 90 ảnh + 10 video/tháng) · mot_nam 12×199k (Opus, 10 tài khoản, 10 Fanpage
                          + mua thêm tới 200, 5 bài/ngày, 150 ảnh + 20 video, video Đẹp) · agency 5tr/tháng (Opus, 5 thương hiệu + 100k/tháng/thương hiệu tới 30, 5 kênh & 20 Fanpage/TH,
                          150 ảnh + 30 video/tháng/TH). Mua thêm nằm trong mã gói "sau_thang+fp15", "agency+th3" (parsePlanId/priceOf/planFeatures), không đổi D1. Mã cũ map sang gói mới.
                          capBrain hạ bộ não; src/lib/quota.js: postQuota (bài/ngày/nền tảng), mediaQuota (ảnh/video Crewzy/THÁNG), planNote (hạn mức + lệch 2 phút + spin).
                          pay.js: khung "Content mỗi tháng" + ô "Thêm Fanpage/thương hiệu" tự cộng giá. Test: agencytest, billingtest
Nhiều thương hiệu/1 link  src/lib/mcpBrand.js (23/11): link MCP ký theo mã khách lúc tạo → CREWZY_THUONG_HIEU (xem|chon theo tên gần đúng/số) lưu KV mcpbiz:<mã link>:<k>;
  (MCP, 23/11)            cổng đọc mỗi yêu cầu → uid = thương hiệu đã chọn cho Brain/Kho/phiếu/bộ nhớ/hạn mức; linkAllowed + touchLink vẫn theo mã link. Khác mã link thì
                          COMPOSIO_MULTI_EXECUTE_TOOL chạy bằng tools.execute với tài khoản thương hiệu đã chọn (không gửi phiên cũ), MANAGE_CONNECTIONS → link Kết nối.
                          instructions liệt kê các thương hiệu khi ≥2. Test: gatewaytest. Khách phải ngắt/nối lại connector để thấy công cụ mới
Agency (23/11)            Doanh nghiệp con = mã khách "<chủ>-b<n>" (cookie cz_biz, KV biz:<chủ>, /api/doanh-nghiep tao|chon|doi_ten, src/routes/business.js); resolveUid trả
                          {uid, owner, biz}; billing.js ownerUid() trong getAccount/charge/grant… → tiền/gói theo chủ; trang Gói dùng owner, 4 bước theo DN. layout.js: ô chọn DN
Bộ nhớ AI học khách (23/11) src/lib/memory.js: KV mem:<uid> (≤80 ghi chú, loại phong_cach/tu_ngu/quy_tac/gop_y/cach_lam/thong_tin, trùng bỏ, đầy bỏ cũ trừ quy_tac);
                          công cụ CREWZY_GHI_NHO (chat + link MCP, lưu/xoá) · memBlock + MEM_RULE nạp vào system Trợ lý và instructions MCP · CREWZY_BRAIN và CREWZY_QUY_TRINH trả
                          bo_nho_ve_khach · WORKFLOW_RULES "HỌC KHÁCH" · jobs.js: góp ý khi Làm lại/Từ chối tự ghi bộ nhớ · /api/bo-nho + mục "AI đã học về bạn" ở thuong-hieu.html
                          (assets/memory.js). Test: scripts/memorytest.mjs. AI ngoài phải ngắt/nối lại connector để thấy CREWZY_GHI_NHO
MCP: ảnh/video (23/11)    Chạy qua link MCP: AI của khách TỰ DO SÁNG TẠO ảnh/video (MCP_MEDIA_FREE trong workflows.js: instructions cổng MCP + tu_do_sang_tao của CREWZY_QUY_TRINH;
                          forMcp đổi "AI LÀM ẢNH/VIDEO", ĐẠO DIỄN PROMPT → GỢI Ý PROMPT không bắt buộc, bỏ nhắc ffmpeg); KHÔNG tự ghép ảnh/video bằng Python/FFmpeg khi khách
                          không yêu cầu; không có công cụ → ảnh thật Kho + prompt cho khách. Crewzy chỉ lưu + đăng. Trợ lý Crewzy trong app giữ cách làm cũ
Âm thanh + đa dạng (23/11) WORKFLOW_RULES 'ĐA DẠNG NỘI DUNG' (ảnh, carousel, ảnh động, motion/chữ động/icon động/biểu đồ động, video thật, người dẫn AI, trend) và 'ÂM THANH VIDEO'
                          (HỎI KHÁCH trước: giọng+nhạc / chỉ nhạc / không; lưu CREWZY_GHI_NHO; giọng theo Brain giong_doc — app đã nối ElevenLabs/HeyGen/Fish/Cartesia, Vbee/FPT chưa có cổng
                          → khách tạo trên studio.vbee.vn rồi tải Kho; nhạc an toàn bản quyền; luôn phụ đề; ghép bằng HyperFrames/Shotstack/Creatomate). Nhiệm vụ san_xuat ô s4 "Giọng đọc,
                          nhạc nền" (thêm cuối để không lệch apref). MCP_MEDIA_FREE cho motion bằng công cụ chuyên. Máy chủ Crewzy chưa tự ghép âm thanh (cần container/công cụ dựng)
src/lib/publish.js        DUYỆT NỘI DUNG TRONG CHAT (23/11): CREWZY_XEM_NOI_DUNG (xổ bài chờ duyệt + ảnh/video + kênh · vị trí + giờ vàng đề xuất) và CREWZY_DUYET_HANG_LOAT
                          (dang_ngay → AI đăng luôn | gio_vang → 10 khung GOLDEN, Crewzy tự đăng qua runDuePosts | hen_gio lệch 2 phút/bài; jobs.approveBatch). Qua link MCP:
                          bảng duyệt MCP Apps ui://crewzy/duyet.html (mcpGateway: _meta.ui.resourceUri, resources/list|read, structuredContent; iframe ui/initialize →
                          tool-result → tools/call, ui/message để nhờ AI đăng ngay/sửa bài). PLATFORM_FORMATS.vi_tri = vị trí + khổ + công cụ Composio đã kiểm (FB ảnh/nhiều ảnh/
                          Reels/video/Story ảnh; IG feed/carousel 2–10 ảnh 4:5–1.91:1/Reels/Story; YouTube Shorts/dài). Luật MỘT LẦN ĐỦ VỊ TRÍ + DUYỆT TRONG CHAT. Test: publishtest
src/lib/ai.js             AI GATEWAY (23/11, gom về Cloudflare): appAnthropic(env) — có AI_GATEWAY_URL (https://gateway.ai.cloudflare.com/v1/<acc>/<gw>, AI_GATEWAY_TOKEN nếu bật xác thực)
                          thì Trợ lý Crewzy/cron/đọc website gọi Claude qua AI Gateway (log, chi phí, giới hạn chi tiêu; Unified Billing tuỳ chọn trên dashboard). Không đặt = gọi thẳng Anthropic
render/                   MÁY DỰNG VIDEO (23/11): Worker RIÊNG "crewzy-render" (Workers Builds root dir render/, cần gói Workers Paid) = Cloudflare Containers standard-4 ×3,
                          Dockerfile Node 22 + FFmpeg + font Noto + HyperFrames (Apache 2.0) + chrome-headless-shell; server.mjs POST /render {html, assets} · /mix {video, voice, music, srt}
                          (nhạc lặp + nhỏ dưới giọng, phụ đề tiếng Việt; /mix ĐÃ thử bằng ffmpeg cục bộ, /render CHƯA thử). src/lib/render.js CREWZY_DUNG_VIDEO (chat + MCP) gọi
                          RENDER_URL + RENDER_SECRET → lưu R2 (putMedia) + Kho; hạn mức 'dung' = dung_thang hoặc max(20, video_thang×5)/tháng, trần app RENDER_APP_DAILY=300. Test: rendertest
                          CHỈ TRỢ LÝ CREWZY (23/11 Giang): CREWZY_DUNG_VIDEO + CREWZY_THIET_KE_ANH (POST /image: dựng rồi lấy 1 khung JPG, trừ hạn mức ảnh) nằm trong APP_ONLY_TOOLS;
                          khách nối MCP thì AI của khách dựng bằng SKILL/công cụ của khách (MCP_MEDIA_FREE ưu tiên skill), duyệt + đăng trong chat của khách, Crewzy đăng + chăm sóc khách
package.json              @composio/core 0.31, @anthropic-ai/sdk, openai; dev: wrangler (npm run dev / npm run deploy)
```

**Cốt lõi vận hành (chi tiết: docs/ghi-chu-ky-thuat.md):**
- Cloudflare: Worker `crewzy`, tài khoản truonggiang2511a@gmail.com (KHÔNG đụng Worker vi-tri-studio, dung-video-ai), https://crewzy.truonggiang2511a.workers.dev.
  Push nhánh `main` → Workers Builds tự deploy. Khoá bí mật Giang tự đặt trên dashboard (COMPOSIO_API_KEY ak_, ANTHROPIC_API_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID,
  ADMIN_EMAILS, SEPAY_*); không ghi vars vào wrangler.jsonc (`keep_vars: true`). Chạy cục bộ: `npx wrangler dev --local` (Workers AI không chạy cục bộ).
- Đăng nhập Google + gói/credit đang BẬT: mọi API chỉ tin uid trong phiên (`resolveUid`), không phiên → 401. Admin (ADMIN_EMAILS) không bị trừ credit.
- Mã khách trên Composio = `vpai-<uid>`. THÊM APP: để 'soon' → admin mở /api/connect?toolkit=<slug>&thu=1 → ra redirectUrl mới đổi 'ready'.
  Slug 'ready' cần auth config làm hỏng composio.create() của mọi người; lưới an toàn: UNVERIFIED + createSession (src/lib/common.js).
- Link nối AI không bao giờ đưa link Composio cho khách (cần x-api-key) → cổng /mcp/<token> ký HMAC. Thêm công cụ CREWZY_* mới: khách phải ngắt/nối lại connector ở claude.ai.
- Không có: Zalo, Shopee, TikTok Shop (Composio không có); TikTok/Threads/X qua Composio cần auth config riêng → dùng Upload-Post.
- KV Free 1.000 lượt ghi/ngày: đừng ghi KV mỗi tools/call.

## 2. Quy trình cập nhật (bắt buộc mỗi lần sửa)

1. Sửa file → `npm test` → `npx wrangler dev --local` → thử bằng Playwright (`channel="chrome"`, mở `127.0.0.1:8787`): bấm duyệt, lọc, kết nối, Run;
   chụp màn 1440px và 390px; không có lỗi console.
   Lưu ý: mỗi nút có 2 bản (đang chọn/không chọn) nằm trong `data-if`, selector phải dùng `button:visible:has-text("…")`.
2. Push lên GitHub (nhánh `main`).
3. Workers Builds tự deploy khi push main; kiểm tra link thật bằng `curl` (200, /api/catalog) và mở trên điện thoại.

## 3. Điều đã chốt về sản phẩm (21/11/2026)

- **4 phần:** thư viện mẫu quy trình · bộ chạy luồng (phiếu việc, sự kiện, luật Khi → Làm → Rồi, lịch, cổng duyệt, thử lại)
  · lớp kết nối (Composio + Zalo + API riêng, bọc một lớp để đổi nhà cung cấp được) · bộ não.
- **Bộ não 2 chế độ:** chat = AI của khách qua 1 link MCP của app; tự chạy khi khách vắng mặt = khoá API của khách hoặc credit.
  AI của khách không "đăng nhập qua Composio"; Composio chỉ giữ kết nối tới app.
- **Cổng duyệt 3 mức:** tự chạy (việc nội bộ) · duyệt nhanh (đăng bài, tin chăm sóc) · chủ bắt buộc duyệt (chi tiền, xác minh sản phẩm).
- **"Chạy tới khi xong"** phải có điểm kết thúc, số bước tối đa, trần credit, dừng ở mọi cổng duyệt. AI điền mẫu, không tự nghĩ quy trình mới.
- **Giá:** gói tháng = phí nền tảng + credit kèm; credit trả AI, ảnh, video, có lãi. Chi phí lớn nhất là AI, Composio rẻ
  (gói Pro 29 USD/tháng có 100.000 lượt gọi, vượt 0,0003 USD/lượt — kiểm lại giá vì Composio đổi giá nhiều lần).
- **Màn hình ưu tiên:** "Việc chờ duyệt" và "Kết quả" quan trọng hơn cảnh văn phòng; màn kết nối làm như danh sách việc cần tick.

**Ràng buộc kỹ thuật đã kiểm chứng (đừng đề xuất lại):**
- Không host lại n8n cho khách: giấy phép bản cộng đồng cấm, bản Embed tốn khoảng 50.000 USD/năm → tự xây bộ chạy luồng.
- MCP sampling (server mượn AI của khách) đã bị bỏ dần từ bản 2026-07-28, ChatGPT Apps chưa hỗ trợ → tự chạy phải có model ở server.
- Composio: app quản lý chung không dành cho chạy thật → cần app OAuth riêng, vẫn phải xin Meta/TikTok/Google duyệt.
  TikTok chưa qua kiểm duyệt thì bài chỉ đăng chế độ riêng tư. Composio không có Zalo.

## 4. Cẩm nang làm app (theo mục 4 CLAUDE.md của vi-tri-studio)

- Chốt 1 lõi tạo giá trị trước: mẫu "Chatbot bình luận + giao sale" (vòng ra tiền) rồi mới tới nội dung, video, quảng cáo.
- Ngăn xếp đã chứng minh: HTML/JS thuần + esbuild → Cloudflare (Worker + assets) hoặc Netlify → Supabase (RPC `security definer`,
  trình duyệt chỉ dùng khoá publishable) → SePay webhook cho VietQR.
- Tài khoản, credit, gói trả tiền nằm trong SQL; máy chủ kiểm tra credit trước khi gọi dịch vụ AI tốn phí.
- Webhook thanh toán: xác thực khoá, chống trùng, kiểm tra đủ tiền, ghi log mọi giao dịch.
- Trước khi chạy quảng cáo: trang giới thiệu, chính sách bảo mật, điều khoản, cookie; Pixel + CAPI cùng `event_id`; sự kiện gắn đúng lúc có giá trị.
- Sửa lỗi: tìm nguyên nhân gốc theo đường đi dữ liệu, sửa xong ghi 1 dòng vào mục 5.
- Đánh dấu "chạy được" phải xét cả dữ liệu đầu vào và quy trình cần chạy trước, không chỉ app đã nối; nhờ chính AI của khách gọi thử qua link MCP để bắt lỗi kiểu này.

## 5. Nhật ký

Ghi vào **docs/nhat-ky.md** (cuối file). Mỗi lần sửa: 1–3 dòng (yêu cầu của Giang, đã làm gì, cái gì CHƯA thử thật).

## 6. Việc tiếp theo

- Giang (đăng nhập admin): mở /api/connect?toolkit=vapi (rồi retellai, bland_ai, upload_post) → thấy redirectUrl là chạy; xoá slug đó khỏi UNVERIFIED.
- (Đã đưa MCP ngoài vào link nối AI và có công tắc 22/11.) Còn: ghi số lượt gọi MCP ngoài vào credit.

- Giang: nộp đơn Sign in with ChatGPT (developers.openai.com/siwc) và tạo OAuth app Linked billing trên Claude Console.
- Khoá OpenRouter/khoá API hiện chỉ lưu trên trình duyệt: muốn tự chạy khi khách vắng mặt phải lưu phía máy chủ (mã hoá) theo tài khoản.
- (ĐÃ làm 22/11 tối, cả GOOGLE_CLIENT_ID.) Giang bật gói (theo thứ tự): ADMIN_EMAILS → SEPAY_WEBHOOK_KEY, SEPAY_BANK, SEPAY_ACCOUNT, SEPAY_ACCOUNT_NAME (+ trên my.sepay.vn tạo webhook
  https://crewzy.truonggiang2511a.workers.dev/api/sepay/webhook, xác thực API Key) → GOOGLE_CLIENT_ID. Sau đó thử 1 đơn 2.000đ bằng PLANS_JSON tạm.
- Sau khi kết nối: cho AI đọc thử 1 dòng Google Sheet / gửi thử 1 email (session.execute) để chứng minh chạy thật.
- Bỏ trường `detail` trong lỗi trả về của hàm (cả sự kiện error của /api/chat) khi xong giai đoạn thử.
- Trợ lý AI: trừ credit theo từng khách thay cho trần chung 150 lượt/ngày; nút "Duyệt" bấm được thay cho gõ "đồng ý"; trả lời chạy chữ dần (stream).
- (Đã có màn Kết quả 22/11.) Còn: doanh thu theo nguồn, đơn chốt; email báo cáo tuần + nhắc gia hạn (cần Resend).
- Tạo auth config riêng trên Composio cho TikTok (app TikTok developer), Threads, Google Business; nối riêng Zalo OA, Shopee.
- Canvas Design chưa cập nhật theo giao diện mới (Văn phòng, Chờ duyệt đã dùng dữ liệu thật).
- Kiểm chứng nhu cầu theo quy trình saas-startup-foundry trước khi làm backend.
