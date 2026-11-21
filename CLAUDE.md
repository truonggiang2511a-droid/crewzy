# CLAUDE.md — Văn Phòng AI (tên tạm)

Đọc file này trước khi sửa bất cứ thứ gì.

Văn Phòng AI là web app riêng, **không liên quan Lumi**. Ý tưởng: doanh nghiệp có sẵn quy trình của cả công ty
(9 phòng, 20 quy trình). Khách chỉ đăng nhập, kết nối công cụ (chủ yếu qua Composio), nối AI của mình
(Claude hoặc ChatGPT) làm bộ não rồi bấm Run. Giao diện trông như văn phòng có các phòng đang làm việc thật.
Khách mua credit hoặc gói tháng, tiền đó trả Composio, AI và hạ tầng.

**Hiện trạng (21/11/2026): bản thử giao diện tĩnh.** Chưa có backend, chưa có đăng nhập thật, mọi số liệu là dữ liệu mẫu.

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
public/assets/style.css  Biến màu --accent, focus, menu gọn trên điện thoại (≤640px)
public/assets/app.js     Bộ chạy nhỏ: data-if, data-text, data-click, data-change, data-checked
public/assets/favicon.svg
netlify.toml            publish = "public", header X-Robots-Tag: noindex (bản thử không cho Google lập chỉ mục)
```

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

## 6. Việc tiếp theo

- Màn "Kết quả" (khách mới, đơn chốt, doanh thu theo nguồn) và "Gói và credit".
- Kiểm chứng nhu cầu theo quy trình saas-startup-foundry trước khi làm backend.
