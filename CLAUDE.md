# CLAUDE.md — Văn Phòng AI (tên tạm)

Đọc file này trước khi sửa bất cứ thứ gì.

Văn Phòng AI là web app riêng, **không liên quan Lumi**. Ý tưởng: doanh nghiệp có sẵn quy trình của cả công ty
(9 phòng, 20 quy trình). Khách chỉ đăng nhập, kết nối công cụ (chủ yếu qua Composio), nối AI của mình
(Claude hoặc ChatGPT) làm bộ não rồi bấm Run. Giao diện trông như văn phòng có các phòng đang làm việc thật.
Khách mua credit hoặc gói tháng, tiền đó trả Composio, AI và hạ tầng.

**Hiện trạng (22/11/2026): bản thử giao diện + kết nối thật 10 công cụ qua Composio + link nối AI của khách (MCP).** Chưa có đăng nhập khách thật
(mỗi trình duyệt có mã khách riêng trong localStorage `vpai.uid`), các số liệu khác là dữ liệu mẫu.

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
public/                 Thư mục được đưa lên mạng (Netlify publish = "public"); CLAUDE.md, README không lên mạng
public/index.html        Màn 1 · Văn phòng: 9 phòng, trạng thái, bảng tin phiếu việc
public/cho-duyet.html    Màn 2 · Việc chờ duyệt: chi tiền, lịch đăng, xác minh sản phẩm (bấm duyệt được)
public/ket-noi.html      Màn 3 · Kết nối công cụ: tiến độ 5 công cụ, chọn credit hoặc khoá API, nút Run
public/chat.html         Màn 4 · Trợ lý AI: khung chat ra lệnh, AI dùng công cụ Composio (chọn AI, khoá API, gợi ý nhanh)
public/assets/style.css  Biến màu --accent, focus, menu gọn trên điện thoại (≤640px)
public/assets/app.js     Bộ chạy nhỏ: data-if, data-text, data-click, data-change, data-checked
public/assets/favicon.svg
public/assets/connect.js   Trang Kết nối: thẻ thật từng công cụ (số tài khoản, Thêm tài khoản), tạo link nối AI, sao chép
public/assets/chat.js      Trang Trợ lý AI: gọi /api/chat, đọc NDJSON từng dòng, lưu lịch sử + chế độ + khoá trong localStorage
netlify/lib/common.mjs     Danh sách TOOLKITS (10 công cụ), tối đa 5 tài khoản/công cụ, ký link MCP (signUpstream)
netlify/functions/connect.mjs   GET /api/connect?toolkit=…&uid=… → link đăng nhập Composio (multiAccount, alias riêng mỗi lần)
netlify/functions/status.mjs    GET /api/status?uid=… → {accounts: {slug: số tài khoản ACTIVE}}
netlify/functions/mcp-link.mjs  GET /api/mcp-link?uid=… → link https://<site>/mcp/<token> để dán vào Claude/ChatGPT
netlify/functions/chat.mjs      POST /api/chat → NDJSON {tool|text|done|error}; GET /api/chat → {appMode}
netlify/edge-functions/mcp-gateway.js  /mcp/* kiểm tra chữ ký token rồi chuyển tiếp MCP tới phiên Composio, gắn x-api-key ở máy chủ
package.json            @composio/core 0.31, @anthropic-ai/sdk, openai, @netlify/blobs (Netlify tự cài khi build)
netlify.toml            publish = "public", functions = netlify/functions (esbuild), header X-Robots-Tag: noindex (bản thử không cho Google lập chỉ mục)
```

- Biến môi trường Netlify: `COMPOSIO_API_KEY` (bí mật). **Đổi giá trị xong phải deploy lại** thì hàm máy chủ mới nhận khoá mới.
- Mã khách gửi lên Composio có dạng `vpai-<uid>`; chỉ cho phép toolkit trong `TOOLKITS` (netlify/lib/common.mjs).
  10 công cụ đã thử tạo link được (22/11): facebook, instagram, youtube, linkedin, gmail, googlesheets, googlecalendar, googledrive, notion, hubspot.
  TikTok chưa mở: cần app TikTok developer riêng và qua kiểm duyệt.
- Link nối AI: Composio bắt buộc header x-api-key cho mọi link MCP, nên KHÔNG đưa link Composio cho khách.
  Token = base64url(link phiên Composio) + '.' + HMAC-SHA256 (khoá ký = sha256('vpai-mcp|' + COMPOSIO_API_KEY)).
  Đổi COMPOSIO_API_KEY thì mọi link cũ hết hiệu lực. "Tạo link mới" tạo phiên mới nhưng link cũ vẫn chạy (chưa thu hồi được).
  Đã thử qua cổng: initialize, tools/list (6 công cụ gốc COMPOSIO_*), tools/call COMPOSIO_SEARCH_TOOLS ~1 giây.
- Trợ lý AI (/api/chat): 3 chế độ.
  `app` = Claude Haiku 5.5 qua Netlify AI Gateway (Netlify tự gắn ANTHROPIC_API_KEY/BASE_URL, tính vào credit Netlify của Giang),
  trần 150 lượt/ngày toàn site đếm trong Netlify Blobs `vpai-usage` (khoá `chat-YYYY-MM-DD`, chưa chống đếm trùng khi gửi cùng lúc).
  `claude` = khoá Anthropic của khách, Claude Sonnet 5.5, phải đặt `baseURL: 'https://api.anthropic.com'` để không đi qua Gateway.
  `openai` = khoá OpenAI của khách, gpt-5.4-mini, `max_completion_tokens`, `baseURL: 'https://api.openai.com/v1'`.
  Khoá khách chỉ lưu trong localStorage trình duyệt (`vpai.key.<mode>`), gửi kèm mỗi lần, máy chủ không lưu.
  Vòng công cụ: `session.tools()` (dạng OpenAI) → đổi sang `input_schema` cho Claude; tối đa 8 bước, dừng ở 45 giây và bảo khách nhắn "tiếp tục".
  Kết quả công cụ cắt còn 12.000 ký tự. Lời dặn hệ thống bắt AI hỏi "đồng ý" trước khi đăng, gửi, xoá, chi tiền.
  Đã thử (22/11): kiểm tra kết nối ~6 giây, tìm công cụ đăng Fanpage, khoá sai báo "Khoá API không đúng"; điện thoại 390px và máy tính 1440px không lỗi console.
  COMPOSIO_MANAGE_CONNECTIONS tự tạo yêu cầu kết nối "đang chờ" (INITIATED) cho mọi công cụ chưa nối; status/connect chỉ đếm ACTIVE nên không sai số.
  Huy hiệu "Powered by Netlify" nằm góc phải dưới: trang chat chừa 76–80px dưới cùng để không che nút Gửi.
- Mỗi trang có tương tác khai báo `window.PAGE_LOGIC = { state, vals(state, set) }` trong thẻ `<script>` ngay trước `assets/app.js`.
- Chạy cục bộ: `python3 -m http.server 8765 -d public` trong thư mục repo, mở `http://127.0.0.1:8765/`.
- Netlify: dự án `van-phong-ai`, site id `26e332c7-f0ff-4912-81ad-5154ae75eb88`, link https://van-phong-ai.netlify.app
  (deploy thủ công qua Netlify MCP, chưa nối Git tự deploy). `.netlify/` đã nằm trong `.gitignore`.
- Bản gốc thiết kế (canvas Design, chỉnh trực tiếp được): https://claude.ai/artifact/NUTG94g3zTHJDHiUzmCxhS
  Ba trang HTML ở đây được chuyển từ canvas đó; sửa giao diện lớn thì sửa canvas trước rồi chuyển lại, hoặc sửa thẳng HTML và ghi nhật ký.
- Tài liệu quy trình 9 phòng, 20 quy trình, lộ trình: https://claude.ai/artifact/Htar34ehr6gbL1TzT8qVoG

## 2. Quy trình cập nhật (bắt buộc mỗi lần sửa)

1. Sửa file → chạy cục bộ → thử bằng Playwright (`channel="chrome"`, mở `127.0.0.1`): bấm duyệt, lọc, kết nối, Run;
   chụp màn 1440px và 390px; không có lỗi console.
   Lưu ý: mỗi nút có 2 bản (đang chọn/không chọn) nằm trong `data-if`, selector phải dùng `button:visible:has-text("…")`.
2. Push lên GitHub (nhánh `main`).
3. Deploy Netlify rồi kiểm tra link thật bằng `curl -I` (200) và mở trên điện thoại.

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
  node_modules ra ngoài repo trước khi chạy lệnh (đỡ tải lên), deploy xong nhớ trả lại.

## 6. Việc tiếp theo

- Bắt buộc trước khi bán: đăng nhập khách thật (thay mã trong localStorage), lưu và thu hồi link nối AI,
  giới hạn lượt gọi công cụ theo credit (mọi lượt gọi đang tính vào tài khoản Composio của Giang).
- Sau khi kết nối: cho AI đọc thử 1 dòng Google Sheet / gửi thử 1 email (session.execute) để chứng minh chạy thật.
- Bỏ trường `detail` trong lỗi trả về của hàm (cả sự kiện error của /api/chat) khi xong giai đoạn thử.
- Trợ lý AI: trừ credit theo từng khách thay cho trần chung 150 lượt/ngày; nút "Duyệt" bấm được thay cho gõ "đồng ý"; trả lời chạy chữ dần (stream).
- Màn "Kết quả" (khách mới, đơn chốt, doanh thu theo nguồn) và "Gói và credit".
- Kiểm chứng nhu cầu theo quy trình saas-startup-foundry trước khi làm backend.
