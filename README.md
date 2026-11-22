# Crewzy

Đội nhân viên AI cho doanh nghiệp nhỏ ở Việt Nam: kết nối app (qua Composio), điền Brain thương hiệu, giao việc cho Trợ lý AI
và chạy quy trình theo phòng ban. Chạy trên Cloudflare Workers.

- Chạy cục bộ: `npm install`, tạo `.dev.vars` (COMPOSIO_API_KEY=…), `npm run dev` → http://127.0.0.1:8787
- Kiểm tra: `npm test`
- Deploy: push nhánh `main` (Workers Builds tự chạy `npx wrangler deploy`)

Đọc `CLAUDE.md` trước khi sửa.
