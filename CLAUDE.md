# CLAUDE.md — Crewzy (trước đây tên tạm "Văn Phòng AI")

Đọc file này trước khi sửa bất cứ thứ gì.

Crewzy ("đội nhân viên AI cho doanh nghiệp") là web app riêng, **không liên quan Lumi**. Tên chốt 22/11/2026 (Giang muốn tên tiếng Anh;
crewzy.ai còn trống, crewzy.com đã có người đăng ký). Tên hiển thị nằm ở APP_NAME (src/lib/common.js), layout.js, title các trang. Ý tưởng: doanh nghiệp có sẵn quy trình của cả công ty
(9 phòng, 20 quy trình). Khách chỉ đăng nhập, kết nối công cụ (chủ yếu qua Composio), nối AI của mình
(Claude hoặc ChatGPT) làm bộ não rồi bấm Run. Giao diện trông như văn phòng có các phòng đang làm việc thật.
Khách mua credit hoặc gói tháng, tiền đó trả Composio, AI và hạ tầng.

**Hiện trạng (22/11/2026): chạy trên Cloudflare Workers (chuyển từ Netlify). Kết nối thật 19 app qua Composio, Trợ lý AI, link nối AI (MCP),
Brain thương hiệu, Quy trình, đăng nhập Google (chờ GOOGLE_CLIENT_ID).** Văn phòng và Việc chờ duyệt vẫn là dữ liệu mẫu.

Chủ dự án: Giang (giao tiếp tiếng Việt). Giao diện, thông báo, tooltip hiển thị cho khách: tiếng Việt.
Tên biến/hàm: tiếng Anh. Không tuyên bố "đã chạy được/đã build xong" nếu chưa thực sự chạy lệnh và thấy kết quả.

---

## 0. Cách làm việc với Giang (lấy theo mục 0 CLAUDE.md của vi-tri-studio, áp dụng cho MỌI yêu cầu)

**Phản biện trước, làm sau.** Mỗi yêu cầu của Giang được xét theo mục tiêu thật (doanh nghiệp không rành công nghệ
kết nối xong là chạy, ra khách và doanh thu thật, app có lãi trên credit) chứ không làm theo nguyên văn.

Mỗi lần nhận yêu cầu:
1. Nêu ngắn mục tiêu thật đằng sau yêu cầu.
2. Đối chiếu với repo và mục 3: cái gì đã có sẵn, cái gì xung đột với điều đã chốt, cái gì sai kỹ thuật/dữ liệu
   (kiểm tra tài liệu thật, không tin tên API trong đề bài).
3. Nói thẳng chỗ chưa ổn, chi phí và rủi ro (tiền API, giấy phép, duyệt app Meta/TikTok/Google), đề xuất cách tốt hơn,
   chia giai đoạn nhỏ, có công tắc bật/tắt.
4. Chỉ hỏi lại quyết định thật sự thuộc về Giang. Yêu cầu rõ và rẻ để làm lại thì làm luôn, ghi rõ đã chọn hướng nào.
5. Giang vẫn chọn hướng của mình sau khi nghe phản biện → làm theo Giang, ghi quyết định vào nhật ký mục 5.

Giang cho phép tự bổ sung/sửa file này khi thấy chi tiết thiếu hoặc sai so với code thật, miễn là kiểm chứng trước khi ghi.
Cập nhật app không được làm ảnh hưởng quảng cáo đang chạy, sự kiện đo chuyển đổi và khách đang dùng.

---

## 1. Cấu trúc và cách chạy

```
public/                 Trang tĩnh (Workers static assets, binding ASSETS, html_handling "none" → giữ đuôi .html); CLAUDE.md, README không lên mạng
public/_headers          X-Robots-Tag: noindex (bản thử không cho Google lập chỉ mục) + header an toàn · public/404.html
public/index.html        Màn 1 · Văn phòng: số liệu, SƠ ĐỒ MẠNG phòng ban (office.js), chi tiết phòng, bảng tin phiếu việc chạy liên tục
public/assets/office.js  Vẽ SVG: Bộ não AI ở tâm, 8 phòng trên elip, đường nhánh FLOWS có hạt sáng chạy (animateMotion), huy hiệu app
                         (sáng khi đã kết nối, lấy thật từ /api/status); phòng ban + bảng tin là dữ liệu mẫu; tôn trọng prefers-reduced-motion
public/cho-duyet.html    Màn 2 · Việc chờ duyệt (DỮ LIỆU THẬT từ 22/11, script assets/jobs.js): Giao việc mới (mẫu, Giao cho AI của tôi /
                         Làm ngay bằng Trợ lý Crewzy), lọc Chờ duyệt/Chờ AI làm/Đã duyệt/Báo cáo, Duyệt/Sửa/Làm lại/Từ chối/Đăng/Xoá, ?id= làm nổi
public/ket-noi.html      Màn 3 · Kết nối (kiểu Composio): lưới logo, lọc thể loại, tìm kiếm, ?app=<slug> trang chi tiết có Skill, ?tab=ai AI của bạn,
                         ?tab=mcp MCP khác (tên máy chủ + link MCP → Kết nối, script assets/mcp-servers.js)
public/quy-trinh.html    Quy trình (assets/quy-trinh.js): 18 quy trình chuẩn từ /api/workflows, lọc 8 phòng (?phong=), app bắt buộc/nên có sáng khi đã
                         nối, MCP ngoài (Apify/Firecrawl/OpenArt), Chạy ngay · Giao cho AI của tôi · Hẹn giờ (hộp thoại), danh sách Lịch đang hẹn
public/thuong-hieu.html  Brain thương hiệu: 11 mục, lưu /api/brand, AI đọc mỗi lượt chat
public/chat.html         Màn 4 · Trợ lý AI: khung chat ra lệnh, AI dùng công cụ Composio (chọn AI, khoá API, gợi ý nhanh)
public/dang-nhap.html    Đăng nhập bằng Google (nút Google Identity Services, chế độ popup); chưa bật thì cho vào thẳng
public/assets/style.css  Bộ màu (tham khảo Composio: --accent #0007CD, nền #FAFAFA, viền #E8E8E8, chữ #1A1A1A), menu .sb, .btn .card .pill .seg .field, điện thoại ≤760px
public/assets/layout.js  Menu trái dùng chung: vẽ vào <nav data-sidebar>; sửa menu ở đây. Có window.vpaiUid()
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
src/lib/common.js         APP_NAME, TOOLKITS, Web Crypto (HMAC phiên, ký link MCP, xác minh ID token Google), resolveUid, KV
src/lib/brand.js          Mục Brain thương hiệu, cleanBrand, brandText (KV brand:<uid>)
src/routes/connect.js     GET /api/connect?toolkit=…[&uid=] → link đăng nhập Composio (multiAccount, alias riêng mỗi lần)
src/routes/status.js      GET /api/status → {accounts: {slug: số tài khoản ACTIVE}}
src/routes/mcpLink.js     GET /api/mcp-link → link https://<site>/mcp/<token>
src/routes/mcpGateway.js  /mcp/* kiểm tra chữ ký token rồi chuyển tiếp MCP tới phiên Composio, gắn x-api-key ở máy chủ; token v2 có mã khách →
                          chèn instructions (Brain + app đã nối + Skill) vào initialize, thêm CREWZY_* vào tools/list, tự chạy tools/call CREWZY_*
src/lib/mcpClient.js      Máy khách MCP Streamable HTTP (SSE/JSON, Mcp-Session-Id) + OAuth chuẩn MCP: oauth-protected-resource → máy chủ cấp quyền
                          → tự đăng ký app (DCR) → PKCE S256 + resource → đổi mã/làm mới token. Chặn http, IP, localhost, link /sse cũ
src/lib/mcpServers.js     Lưu máy chủ MCP của khách (KV mcpsrv:<uid>, tối đa 10, token mã hoá AES-GCM sealText), loadExternalTools cho chat
                          (tối đa 40 công cụ/máy chủ, 80 tổng, tên m<id>_<tool>, mỗi máy chủ chờ tối đa 12 giây)
src/routes/mcpServers.js  GET/POST /api/mcp-servers (add|remove|test) · GET /api/mcp-callback (app kia trả về sau khi khách đồng ý)
src/lib/media.js          Lấy ảnh/video/âm thanh từ kết quả MCP ngoài (dữ liệu base64, resource, link trong JSON/chữ), tải về lưu KV media:<id>
                          (90 ngày, ≤24MB, lớn hơn giữ link gốc), phục vụ /api/media/<id>.<đuôi> công khai có Range (tua video)
src/lib/jobs.js           PHIẾU VIỆC (cầu nối hai chiều với AI của khách): KV jobs:<uid> (≤150), trạng thái cho_lam → cho_duyet → da_duyet → da_dang
                          (+ xong, tu_choi); công cụ CREWZY_VIEC_CAN_LAM, CREWZY_NOP_KET_QUA (tự lưu ảnh/video về /api/media); MCP_PROMPTS
src/routes/jobs.js        GET/POST /api/jobs (tao | duyet | tu_choi | lam_lai | xong | da_dang | sua | xoa) · GET /api/skill.md (SKILL.md cho Claude Code/Codex)
src/lib/workflows.js      THƯ VIỆN QUY TRÌNH CHUẨN (nguồn duy nhất): DEPARTMENTS (8 phòng, có Nghiên cứu đối thủ), WORKFLOWS (18 quy trình: bước,
                          app/nen_co/mcp, lịch gợi ý, loại kết quả), missingFor, workflowPrompt, WORKFLOW_RULES. Sửa/thêm quy trình CHỈ ở đây
src/lib/schedules.js      Hẹn giờ: KV sched:<uid> (≤10 lịch), schedidx; cron */15 (wrangler triggers) → tạo phiếu việc; che_do 'crewzy' thì
                          runAgent chế độ app tự làm (≤3 lượt mỗi lần cron, tính vào trần lượt của app). scripts/schedtest.mjs
src/routes/workflows.js   GET /api/workflows · GET/POST /api/schedules (tao | bat | tat | xoa)
src/lib/crewzyTools.js    Công cụ riêng: CREWZY_TAO_ANH (Workers AI flux-2-klein-4b → dự phòng flux-1-schnell, lưu KV img:<id> 90 ngày,
                          phục vụ /api/img/<id>.jpg công khai, 20 ảnh/ngày/khách) và CREWZY_BRAIN; dùng chung cho chat và MCP
src/routes/chat.js        POST /api/chat → NDJSON {tool|text|done|error}; GET → {appMode, openrouterModels}
src/routes/auth.js        /api/auth/me · /api/auth/google · /api/auth/logout
src/routes/brand.js · catalog.js · openrouterKey.js   GET/POST /api/brand · GET /api/catalog · POST /api/openrouter-key
wrangler.jsonc            Worker "crewzy", nodejs_compat, AI binding AI (Workers AI), KV binding KV (id cefc3dfec3b248929a490ff8cd5cc216, tên crewzy-data), keep_vars
scripts/page.py           Khung trang HTML mới (head + menu + main) · scripts/authtest.mjs: npm test (phiên, ID token, link MCP)
package.json              @composio/core 0.31, @anthropic-ai/sdk, openai; dev: wrangler (npm run dev / npm run deploy)
```

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
  `img:<id>` (ảnh AI, 90 ngày, metadata ct/uid/model), `media:<id>` (ảnh/video từ MCP ngoài, 90 ngày), `imgcount:<ngày>:<uid>`, `mcpsrv:<uid>` (máy chủ MCP khách nối),
  `mcpoauth:<state>` (đang chờ đăng nhập, 15 phút).
  KV nhất quán sau tối đa ~60 giây giữa các vùng; đủ cho tài khoản/Brain/đếm lượt.
- Mã khách gửi lên Composio có dạng `vpai-<uid>` (giữ tiền tố cũ); chỉ cho phép toolkit trong `TOOLKITS` (src/lib/common.js ← catalog).
- Link nối AI: Composio bắt buộc header x-api-key cho mọi link MCP, nên KHÔNG đưa link Composio cho khách.
  Token = base64url(link phiên Composio) + '.' + HMAC-SHA256 (khoá ký = sha256('vpai-mcp|' + COMPOSIO_API_KEY)).
  Đổi COMPOSIO_API_KEY thì mọi link cũ hết hiệu lực. "Tạo link mới" tạo phiên mới nhưng link cũ vẫn chạy (chưa thu hồi được).
  Đã thử qua cổng: initialize, tools/list (6 công cụ gốc COMPOSIO_*), tools/call COMPOSIO_SEARCH_TOOLS ~1 giây.
- Trợ lý AI (/api/chat): chế độ app, claude, openai, gemini, grok (khoá API riêng), openrouter.
  `gemini` = gemini-3.8-flash qua https://generativelanguage.googleapis.com/v1beta/openai/ (schema công cụ được lọc bằng geminiSafeTool);
  `grok` = grok-4.7 qua https://api.x.ai/v1; cả hai dùng `max_tokens`. CHƯA thử với khoá thật (Giang chưa có khoá Gemini/Grok).
  Công cụ MCP ngoài khách đã nối được nạp thêm mỗi lượt; ảnh/video MCP trả về được lưu thành /api/media/<id> (media.js), phát sự kiện
  {type:'image'|'video'|'audio', url} và gửi AI trường media_crewzy để đăng bài bằng link cố định. CREWZY_CHO (5–30 giây, chỉ trong chat,
  không đưa ra link MCP) để AI chờ app tạo video rồi hỏi trạng thái. Mỗi lượt tối đa 16 bước / 150 giây.
  `app` = Claude Haiku 5.5 bằng khoá `ANTHROPIC_API_KEY` của Giang (bí mật Cloudflare; chưa đặt → giao diện tự ẩn chế độ này).
  Trần 30 lượt/ngày mỗi khách + 300 lượt/ngày cả app (KV usage:*, theo giờ Việt Nam; không chống đếm trùng khi gửi cùng lúc).
  `claude` = khoá Anthropic của khách, Claude Sonnet 5.5, `baseURL: 'https://api.anthropic.com'`.
  `openai` = khoá OpenAI của khách, gpt-5.4-mini, `max_completion_tokens`, `baseURL: 'https://api.openai.com/v1'`.
  Khoá khách chỉ lưu trong localStorage trình duyệt (`vpai.key.<mode>`), gửi kèm mỗi lần, máy chủ không lưu.
  Vòng công cụ: `session.tools()` (dạng OpenAI) → đổi sang `input_schema` cho Claude; tối đa 8 bước, dừng ở 60 giây và bảo khách nhắn "tiếp tục".
  Kết quả công cụ cắt còn 12.000 ký tự. Lời dặn hệ thống bắt AI hỏi "đồng ý" trước khi đăng, gửi, xoá, chi tiền.
  Đã thử (22/11): kiểm tra kết nối ~6 giây, tìm công cụ đăng Fanpage, khoá sai báo "Khoá API không đúng"; điện thoại 390px và máy tính 1440px không lỗi console.
  COMPOSIO_MANAGE_CONNECTIONS tự tạo yêu cầu kết nối "đang chờ" (INITIATED) cho mọi công cụ chưa nối; status/connect chỉ đếm ACTIVE nên không sai số.
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
  Công cụ MCP ngoài CHƯA có trong link nối AI (/mcp/*) — Claude/ChatGPT tự thêm connector đó được.
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
- Đăng nhập Google: bật bằng biến `GOOGLE_CLIENT_ID` (Client ID loại Web application, origin https://crewzy.truonggiang2511a.workers.dev và tên miền riêng sau này;
  mã công khai, không cần Client secret). Chưa đặt biến → bản thử chạy như cũ (mã khách theo trình duyệt).
  Phiên = cookie HttpOnly `vpai_session` 30 ngày, ký HMAC bằng `SESSION_SECRET` (chưa đặt thì suy ra từ COMPOSIO_API_KEY).
  ID token kiểm tra bằng khoá công khai Google (JWKS, RS256, aud = Client ID), không gọi tokeninfo. Thử cục bộ: `node scripts/authtest.mjs`.
  Map tài khoản trong KV: `user:<sub>` → {uid,…}, `uid:<uid>` → sub. Lần đầu đăng nhập nhận luôn mã trình duyệt cũ
  (nếu chưa thuộc ai) để giữ kết nối Composio đã làm; còn lại uid = `g-<sub>`. Bật đăng nhập rồi thì mọi hàm (connect, status, mcp-link, chat)
  chỉ tin mã trong phiên (`resolveUid`), bỏ qua uid gửi lên; không có phiên → 401 `{login:true}` → trang tự chuyển sang đăng nhập.
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

## 5. Nhật ký

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

## 6. Việc tiếp theo

- Đưa công cụ MCP ngoài vào link nối AI /mcp/* (để Claude/ChatGPT nối 1 link là có hết); cho chọn bật/tắt từng công cụ MCP ngoài;
  ghi số lượt gọi MCP ngoài vào credit.

- Giang: nộp đơn Sign in with ChatGPT (developers.openai.com/siwc) và tạo OAuth app Linked billing trên Claude Console.
- Khoá OpenRouter/khoá API hiện chỉ lưu trên trình duyệt: muốn tự chạy khi khách vắng mặt phải lưu phía máy chủ (mã hoá) theo tài khoản.
- Bắt buộc trước khi bán: (đăng nhập Google đã có, chờ GOOGLE_CLIENT_ID) lưu và thu hồi link nối AI,
  giới hạn lượt gọi công cụ theo credit (mọi lượt gọi đang tính vào tài khoản Composio của Giang).
- Sau khi kết nối: cho AI đọc thử 1 dòng Google Sheet / gửi thử 1 email (session.execute) để chứng minh chạy thật.
- Bỏ trường `detail` trong lỗi trả về của hàm (cả sự kiện error của /api/chat) khi xong giai đoạn thử.
- Trợ lý AI: trừ credit theo từng khách thay cho trần chung 150 lượt/ngày; nút "Duyệt" bấm được thay cho gõ "đồng ý"; trả lời chạy chữ dần (stream).
- Màn "Kết quả" (khách mới, đơn chốt, doanh thu theo nguồn) và "Gói và credit" (đang để Sắp có trong menu).
- Tạo auth config riêng trên Composio cho TikTok (app TikTok developer), Threads, Google Business; nối riêng Zalo OA, Shopee.
- Trang Văn phòng và Chờ duyệt vẫn là dữ liệu mẫu; canvas Design chưa cập nhật theo giao diện mới.
- Kiểm chứng nhu cầu theo quy trình saas-startup-foundry trước khi làm backend.
