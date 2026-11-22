// THƯ VIỆN QUY TRÌNH CHUẨN của Crewzy — nguồn duy nhất cho trang Quy trình, Trợ lý AI, link MCP (CREWZY_QUY_TRINH, prompts) và hẹn giờ.
// Học từ các mẫu n8n/Make được dùng nhiều nhất (tra 22/11/2026): tạo nội dung + đăng đa kênh, lead → CRM → chăm sóc,
// soạn trả lời bình luận và chuyển câu nhạy cảm cho người duyệt, email tự trả lời từ kho kiến thức, theo dõi đối thủ, báo cáo định kỳ.
// Mỗi quy trình: các bước có thứ tự, kênh/nền tảng (kenh) và nhóm công cụ theo vai trò (cong_cu, app thay thế nhau — xem TOOLSETS),
// đầu ra luôn nộp về phiếu việc bằng CREWZY_NOP_KET_QUA kèm quy_trinh = id. Việc ra ngoài (đăng, gửi, chi tiền) luôn qua cổng duyệt.

export const DEPARTMENTS = [
  { id: 'thuong_hieu', name: 'Thương hiệu' },
  { id: 'doi_thu', name: 'Nghiên cứu đối thủ' },
  { id: 'noi_dung', name: 'Nội dung & Video' },
  { id: 'quang_cao', name: 'Quảng cáo' },
  { id: 'ban_hang', name: 'Bán hàng' },
  { id: 'cham_soc', name: 'Chăm sóc khách' },
  { id: 'bao_cao', name: 'Báo cáo & Chiến lược' },
  { id: 'hang_ngay', name: 'Việc hằng ngày' },
];

// mcp: tên máy chủ MCP ngoài khách cần nối ở Kết nối → MCP khác (khớp theo tên miền trong link).
export const MCP_HOSTS = { apify: 'apify.com', firecrawl: 'firecrawl.dev', openart: 'openart.ai', vidiq: 'vidiq.com' };

export const WORKFLOWS = [
  // ---------- Thương hiệu ----------
  { id: 'brain_tu_website', phong: 'thuong_hieu', ten: 'Dựng Brain thương hiệu từ website, Fanpage',
    mo_ta: 'Đọc website và Fanpage của doanh nghiệp, tự điền 11 mục Brain thương hiệu (sản phẩm, khách hàng, giọng văn, giá, câu hỏi thường gặp). Bạn duyệt là Crewzy lưu luôn.',
    lich: 'Một lần khi bắt đầu, làm lại mỗi quý', loai: 'brain',
    hoi: 'Link website và tên Fanpage của doanh nghiệp',
    buoc: [
      'Hỏi người dùng link website/Fanpage nếu chưa có trong yêu cầu.',
      'Đọc website bằng firecrawl_scrape (trang chủ, trang sản phẩm/dịch vụ, bảng giá, giới thiệu). Có Fanpage đã nối thì đọc 20 bài gần nhất để học giọng văn.',
      'Điền các mục Brain (khoá tiếng Anh): name (tên doanh nghiệp), industry (ngành), products (sản phẩm, dịch vụ chính), customers (khách hàng mục tiêu), voice (giọng văn), dos (nên nói), donts (không được nói), offers (giá, ưu đãi, chính sách), faq (câu hỏi khách hay hỏi kèm trả lời), links (website, Fanpage, kênh), hashtags. Chỉ dùng thông tin thật đọc được; mục không có thông tin thì bỏ trống.',
      'Nộp bằng CREWZY_NOP_KET_QUA với loai "brain", noi_dung là bản tóm tắt dễ đọc, và trường brain là object các mục trên. Khi khách duyệt, Crewzy tự lưu vào Brain thương hiệu.',
    ] },

  // ---------- Nghiên cứu đối thủ ----------
  { id: 'doi_thu_reels', phong: 'doi_thu', ten: 'Soi Reels/TikTok của đối thủ, học phong cách video',
    mo_ta: 'Lấy 10–20 video ngắn nhiều lượt xem nhất của 2–3 đối thủ, phân tích hook 3 giây đầu, bố cục, nhịp cắt, chữ trên màn hình, nhạc, lời kêu gọi. Ra "Sổ tay phong cách video" để làm theo.',
    lich: 'Mỗi tuần 1 lần', loai: 'bao_cao',
    hoi: 'Tên tài khoản Instagram/TikTok/Fanpage của 2–3 đối thủ',
    buoc: [
      'Hỏi người dùng tài khoản đối thủ nếu chưa có (Instagram, TikTok hoặc Fanpage).',
      'Dùng Apify: search-actors tìm actor lấy Reels/TikTok (ví dụ instagram reel scraper, tiktok scraper), fetch-actor-details xem tham số, call-actor lấy 10–20 video mới và nhiều view nhất của từng đối thủ, get-dataset-items đọc kết quả (view, like, bình luận, caption, thời lượng, link). AI của khách có vidIQ thì dùng vidIQ để xem từng cảnh của video tốt nhất.',
      'Chọn 5 video hiệu quả nhất (view/like cao so với trung bình của tài khoản). Với mỗi video ghi: hook 3 giây đầu, cấu trúc (mở – giá trị – kêu gọi), thời lượng, nhịp cắt, chữ trên màn hình, kiểu nhạc/giọng, lời kêu gọi, vì sao hiệu quả.',
      'Viết "Sổ tay phong cách video": 5 mẫu hook dùng được cho doanh nghiệp mình, 3 cấu trúc video, quy tắc hình/chữ/nhạc, 5 ý tưởng video cụ thể theo Brain thương hiệu. Không sao chép nội dung đối thủ, chỉ học cách làm.',
      'Có nơi lưu tài liệu đã nối (Google Docs, Notion, OneDrive…) thì lưu sổ tay vào Docs. Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong) kèm link video đối thủ trong lien_ket.',
    ] },
  { id: 'doi_thu_website', phong: 'doi_thu', ten: 'So sánh website, bảng giá, ưu đãi của đối thủ',
    mo_ta: 'Đọc website 2–3 đối thủ, so với mình về sản phẩm, giá, ưu đãi, cam kết, cách viết. Chỉ ra khoảng trống mình chiếm được.',
    lich: 'Mỗi tháng 1 lần', loai: 'bao_cao',
    hoi: 'Link website 2–3 đối thủ',
    buoc: [
      'Hỏi link website đối thủ nếu chưa có.',
      'Dùng firecrawl_scrape đọc trang chủ, trang sản phẩm, bảng giá, chính sách của từng đối thủ (firecrawl_search nếu chỉ có tên).',
      'Lập bảng so sánh: sản phẩm chính, giá, ưu đãi, cam kết/bảo hành, khách hàng nhắm tới, điểm mạnh, điểm yếu, cách viết tiêu đề.',
      'So với Brain thương hiệu của mình: 3 khoảng trống nên chiếm, 3 điều cần sửa trên website/bài đăng của mình.',
      'Có nơi lưu đã nối (Google Sheets, Notion, Airtable…) thì ghi bảng so sánh vào Sheet. Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong).',
    ] },
  { id: 'doi_thu_quang_cao', phong: 'doi_thu', ten: 'Xem quảng cáo Facebook đối thủ đang chạy',
    mo_ta: 'Lấy quảng cáo đang chạy của đối thủ từ Thư viện quảng cáo Meta: mẫu chạy lâu nhất (thường là mẫu hiệu quả), góc nói, ưu đãi, định dạng.',
    lich: 'Mỗi 2 tuần', loai: 'bao_cao',
    hoi: 'Tên Fanpage hoặc link Thư viện quảng cáo của đối thủ',
    buoc: [
      'Hỏi tên Fanpage đối thủ nếu chưa có.',
      'Dùng Apify: search-actors tìm actor "facebook ads library", call-actor lấy quảng cáo đang chạy ở Việt Nam của từng đối thủ, get-dataset-items đọc kết quả (ngày bắt đầu, nội dung, ảnh/video, lời kêu gọi).',
      'Xếp theo số ngày đã chạy: mẫu chạy trên 14 ngày coi là mẫu hiệu quả. Phân tích góc nói, ưu đãi, định dạng, lời kêu gọi.',
      'Đề xuất 3 góc quảng cáo mới cho mình (không sao chép), kèm gợi ý hình/video.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong) kèm link quảng cáo trong lien_ket.',
    ] },

  // ---------- Nội dung & Video ----------
  { id: 'lich_noi_dung_tuan', phong: 'noi_dung', ten: 'Lịch nội dung 7 ngày',
    mo_ta: 'Lên 7 bài theo Brain thương hiệu và Sổ tay phong cách, mỗi bài một góc, có ảnh minh hoạ. Bạn duyệt, sau đó quy trình "Đăng bài đã duyệt" tự đăng.',
    lich: 'Thứ Hai hằng tuần, 8:00', loai: 'bai_dang',
    buoc: [
      'Đọc Brain thương hiệu (CREWZY_BRAIN). Xem phiếu việc gần đây (CREWZY_VIEC_CAN_LAM tat_ca) để lấy Sổ tay phong cách video nếu có và tránh lặp góc cũ.',
      'Lên 7 góc khác nhau: lợi ích, câu hỏi khách hay hỏi, hậu trường, cảm nhận khách (chỉ dùng lời thật), ưu đãi, mẹo hữu ích, so sánh trước/sau.',
      'Viết đủ 7 bài: câu đầu nói thẳng lợi ích hoặc nỗi lo, mỗi bài một ý, kết bằng lời mời nhắn tin cụ thể. Không đưa số điện thoại khách.',
      'Tạo ảnh 4:5 cho 2–3 bài quan trọng bằng CREWZY_TAO_ANH (ảnh không chữ).',
      'Có nơi lưu đã nối (Google Sheets, Notion, Airtable…) thì ghi lịch (ngày, giờ, kênh, nội dung, link ảnh) vào Sheet.',
      'Nộp mỗi bài thành một phiếu bằng CREWZY_NOP_KET_QUA (loai bai_dang, kenh, media) để khách duyệt từng bài. Chưa đăng.',
    ] },
  { id: 'mot_noi_dung_nhieu_kenh', phong: 'noi_dung', ten: 'Một nội dung, nhiều kênh',
    mo_ta: 'Từ một bài/video gốc, viết lại cho Facebook, Instagram, LinkedIn, YouTube Shorts, TikTok đúng văn phong từng kênh.',
    lich: 'Khi có bài gốc mới', loai: 'bai_dang',
    hoi: 'Bài gốc hoặc link bài/video gốc',
    buoc: [
      'Lấy bài gốc (người dùng dán, hoặc bài Facebook mới nhất nếu đã nối).',
      'Viết lại cho từng kênh: Facebook (kể chuyện, kêu gọi nhắn tin), Instagram (ngắn, hashtag), LinkedIn (chuyên môn), YouTube Shorts/TikTok (tiêu đề + mô tả + 3 hashtag).',
      'Mỗi kênh một phiên bản khác hẳn, không trùng câu.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai bai_dang, kenh liệt kê đủ) để duyệt.',
    ] },
  { id: 'video_theo_phong_cach', phong: 'noi_dung', ten: 'Video ngắn theo phong cách đã học',
    mo_ta: 'Viết kịch bản theo Sổ tay phong cách (hook, cấu trúc, nhịp), tạo video dọc 9:16 bằng credit Crewzy hoặc OpenArt, kèm caption. Bạn duyệt rồi đăng.',
    lich: '2–3 lần mỗi tuần', loai: 'bai_dang',
    buoc: [
      'Đọc Brain thương hiệu và Sổ tay phong cách video (phiếu báo cáo quy trình doi_thu_reels gần nhất, xem bằng CREWZY_VIEC_CAN_LAM tat_ca).',
      'Viết kịch bản 6–15 giây: hook 3 giây đầu theo mẫu đã học, 1 giá trị chính, lời kêu gọi.',
      'Tạo ảnh sản phẩm bằng CREWZY_TAO_ANH rồi làm video bằng CREWZY_TAO_VIDEO (trường anh = link ảnh). Có OpenArt đã nối thì có thể dùng OpenArt (chờ bằng CREWZY_CHO rồi xem trạng thái).',
      'Viết caption cho Reels/TikTok/Shorts kèm lời mời nhắn tin.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai bai_dang, media = link video, noi_dung = kịch bản + caption) để duyệt.',
    ] },
  { id: 'dang_bai_da_duyet', phong: 'noi_dung', ten: 'Đăng bài đã duyệt',
    mo_ta: 'Đăng các phiếu bài đã được bạn duyệt lên đúng kênh, rồi cập nhật "Đã đăng" kèm link bài. Hẹn giờ chạy mỗi ngày.',
    lich: 'Mỗi ngày 9:00 và 19:00', loai: 'bai_dang',
    buoc: [
      'Gọi CREWZY_VIEC_CAN_LAM, lấy các phiếu trạng thái da_duyet có loai bai_dang.',
      'Với từng phiếu: đăng đúng nội dung và ảnh/video đã duyệt lên kênh ghi trong phiếu (Facebook: FACEBOOK_CREATE_POST/FACEBOOK_CREATE_PHOTO_POST; Instagram: tạo media rồi publish). Mỗi lần đăng tối đa 3 bài, cách nhau vài phút nếu nhiều trang.',
      'Đăng xong gọi CREWZY_NOP_KET_QUA với id phiếu, trang_thai da_dang, lien_ket = link bài. Lỗi thì thử lại 1 lần, vẫn lỗi thì nộp ghi_chu nêu lỗi và giữ nguyên trạng thái.',
    ] },

  // ---------- Quảng cáo ----------
  { id: 'theo_doi_quang_cao', phong: 'quang_cao', ten: 'Theo dõi quảng cáo hằng ngày',
    mo_ta: 'Mỗi sáng đọc chi tiêu, kết quả, chi phí mỗi kết quả của từng chiến dịch; cảnh báo chiến dịch đắt lên hoặc hết ngân sách; đề xuất tăng/giảm/tắt (không tự chi tiền).',
    lich: 'Mỗi ngày 7:30', loai: 'bao_cao',
    buoc: [
      'Lấy số liệu hôm qua và 7 ngày của từng chiến dịch đang chạy (Meta Ads, Google Ads nếu có): chi tiêu, kết quả, chi phí mỗi kết quả, CTR, tần suất.',
      'Đánh dấu: chi phí mỗi kết quả tăng hơn 30% so với trung bình 7 ngày, tần suất trên 3, chi tiêu gần hết ngân sách, chiến dịch tốt nhất.',
      'Đề xuất cụ thể (tăng 20%, giảm, tắt, thay mẫu) kèm lý do. KHÔNG tự thay đổi ngân sách hay trạng thái.',
      'Có kênh nhắn nội bộ đã nối (Telegram, Slack, Teams…) thì gửi tóm tắt 5 dòng cho chủ doanh nghiệp. Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai cho_duyet để chủ quyết định).',
    ] },
  { id: 'mau_quang_cao_moi', phong: 'quang_cao', ten: 'Viết mẫu quảng cáo mới (3 góc)',
    mo_ta: 'Dựa trên quảng cáo tốt nhất của mình và góc đối thủ, viết 3 mẫu quảng cáo khác góc kèm ảnh để thử A/B.',
    lich: 'Mỗi 2 tuần', loai: 'noi_dung',
    buoc: [
      'Đọc Brain thương hiệu; có Meta Ads thì xem 3 quảng cáo tốt nhất 30 ngày qua; xem báo cáo quảng cáo đối thủ gần nhất nếu có.',
      'Viết 3 mẫu khác góc (nỗi lo, lợi ích, bằng chứng/ưu đãi): tiêu đề, nội dung chính, lời kêu gọi.',
      'Tạo 1 ảnh 4:5 cho mỗi mẫu bằng CREWZY_TAO_ANH.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai noi_dung, media) để duyệt. Không tự tạo chiến dịch.',
    ] },

  // ---------- Bán hàng ----------
  { id: 'lead_vao_crm', phong: 'ban_hang', ten: 'Gom khách tiềm năng vào danh sách và chào lại',
    mo_ta: 'Gom khách từ email, form, bình luận hỏi giá vào Google Sheet/HubSpot, chấm nóng/ấm/lạnh, soạn tin chào cho từng người (mẫu "lead → CRM → chăm sóc" hay dùng nhất trên n8n).',
    lich: 'Mỗi ngày 10:00 và 16:00', loai: 'cham_soc',
    buoc: [
      'Đọc nguồn khách mới từ lần chạy trước: email hỏi mua/hỏi giá (Gmail), bình luận hỏi giá trên Fanpage, dòng mới trong Sheet form.',
      'Với mỗi khách: tên, kênh, nhu cầu, sản phẩm quan tâm, mức độ (nóng = hỏi giá/hẹn xem, ấm = quan tâm, lạnh = hỏi chung). Bỏ trùng.',
      'Ghi vào CRM đã nối (HubSpot, Pipedrive, Salesforce, Zoho: tạo liên hệ + deal) hoặc bảng "Khách tiềm năng" trên Google Sheets/Airtable (tạo nếu chưa có). Không đưa số điện thoại lên chỗ công khai.',
      'Soạn tin/email chào riêng cho từng khách nóng và ấm theo Brain thương hiệu.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai cham_soc, lien_ket = link Sheet) để duyệt trước khi gửi.',
    ] },
  { id: 'nhac_cham_soc_deal', phong: 'ban_hang', ten: 'Nhắc khách chưa được chăm sóc',
    mo_ta: 'Tìm khách/deal chưa liên hệ quá 3 và 7 ngày, gợi ý bước tiếp theo và soạn tin nhắn để sale gửi.',
    lich: 'Thứ Hai đến thứ Sáu, 8:30', loai: 'cham_soc',
    buoc: [
      'Đọc danh sách khách/deal từ CRM đã nối (HubSpot, Pipedrive, Salesforce, Zoho) hoặc bảng "Khách tiềm năng".',
      'Lọc khách chưa liên hệ quá 3 ngày (nóng) và 7 ngày (ấm), xếp theo giá trị.',
      'Gợi ý bước tiếp theo và soạn tin nhắn ngắn cho từng khách.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai cham_soc) để duyệt.',
    ] },

  // ---------- Chăm sóc khách ----------
  { id: 'tra_loi_binh_luan', phong: 'cham_soc', ten: 'Trả lời bình luận Fanpage',
    mo_ta: 'Đọc bình luận mới, phân loại (hỏi giá, khen, phàn nàn, spam), soạn trả lời theo giọng thương hiệu; câu nhạy cảm đưa chủ duyệt (mẫu n8n "draft replies to social comments").',
    lich: 'Mỗi ngày 9:00, 14:00, 20:00', loai: 'cham_soc',
    buoc: [
      'Đọc bình luận chưa trả lời trên các bài 7 ngày gần đây của Fanpage (và Instagram nếu có).',
      'Phân loại: hỏi giá/hỏi mua, khen, phàn nàn, câu hỏi khác, spam.',
      'Soạn trả lời theo Brain thương hiệu: hỏi giá thì mời nhắn tin (không công khai số điện thoại khách), phàn nàn thì xin lỗi và mời nhắn riêng, spam thì đề xuất ẩn.',
      'Nộp danh sách (link bình luận + câu trả lời) bằng CREWZY_NOP_KET_QUA (loai cham_soc). Khi phiếu được duyệt, trả lời đúng nội dung rồi nộp da_dang.',
    ] },
  { id: 'tra_loi_email_khach', phong: 'cham_soc', ten: 'Trả lời email khách từ câu hỏi thường gặp',
    mo_ta: 'Đọc email khách mới, trả lời câu hỏi có sẵn trong Brain (giá, chính sách, giao hàng), soạn nháp trong Gmail; câu khó chuyển chủ.',
    lich: 'Mỗi 2 giờ trong giờ làm việc', loai: 'cham_soc',
    buoc: [
      'Đọc email/phiếu hỗ trợ chưa trả lời trong 24 giờ qua từ hộp thư đã nối (Gmail, Outlook) hoặc công cụ hỗ trợ (Zendesk, Intercom, Freshdesk, Gorgias, Crisp); bỏ quảng cáo, thông báo hệ thống.',
      'Với câu hỏi có câu trả lời trong Brain thương hiệu: soạn trả lời và lưu thành THƯ NHÁP/ghi chú nội bộ (không gửi).',
      'Câu hỏi không có trong Brain hoặc khiếu nại: đánh dấu cần chủ trả lời.',
      'Nộp danh sách (người gửi, tóm tắt, đã soạn nháp/cần chủ) bằng CREWZY_NOP_KET_QUA (loai cham_soc).',
    ] },
  { id: 'cham_soc_sau_mua', phong: 'cham_soc', ten: 'Chăm sóc sau mua',
    mo_ta: 'Chuỗi tin cho khách vừa mua: cảm ơn ngay, hướng dẫn dùng sau 2 ngày, xin đánh giá sau 7 ngày, mời mua lại sau 30 ngày.',
    lich: 'Mỗi ngày 10:00', loai: 'cham_soc',
    buoc: [
      'Đọc danh sách đơn/khách đã mua (Sheet "Khách đã mua" hoặc nguồn khách chỉ định), cột ngày mua.',
      'Chọn khách đến mốc hôm nay: 0, 2, 7, 30 ngày sau mua.',
      'Soạn tin đúng mốc theo Brain thương hiệu (cảm ơn, hướng dẫn, xin đánh giá, mời mua lại kèm ưu đãi thật nếu có).',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai cham_soc) để duyệt rồi mới gửi.',
    ] },

  // ---------- Báo cáo & Chiến lược ----------
  { id: 'bao_cao_tuan', phong: 'bao_cao', ten: 'Báo cáo hiệu suất tuần',
    mo_ta: 'Gom số liệu quảng cáo, website, Fanpage, khách mới và việc đã làm trong tuần; so với tuần trước; chỉ ra điều tốt, điều cần sửa, 3 việc tuần tới.',
    lich: 'Thứ Hai 7:00', loai: 'bao_cao',
    buoc: [
      'Lấy số 7 ngày qua và 7 ngày trước đó: quảng cáo (chi tiêu, kết quả, chi phí/kết quả), website (lượt truy cập, nguồn), Fanpage (bài đăng, tương tác), khách mới (Sheet/HubSpot).',
      'Xem phiếu việc tuần qua (CREWZY_VIEC_CAN_LAM tat_ca): bao nhiêu bài đăng, video, khách được chăm sóc.',
      'Viết báo cáo: 5 số chính kèm % thay đổi, 3 điều tốt, 3 điều cần sửa, 3 việc tuần tới.',
      'Có nơi lưu tài liệu đã nối (Google Docs, Notion, OneDrive…) thì lưu báo cáo vào Docs; có kênh nhắn nội bộ đã nối (Telegram, Slack, Gmail…) thì gửi tóm tắt cho chủ. Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong).',
    ] },
  { id: 'de_xuat_chien_luoc', phong: 'bao_cao', ten: 'Đề xuất chiến lược tháng',
    mo_ta: 'Từ báo cáo tuần, nghiên cứu đối thủ và Brain thương hiệu, đề xuất mục tiêu, kênh, nội dung chủ đạo, ngân sách quảng cáo và lịch việc cho tháng tới.',
    lich: 'Ngày 1 hằng tháng', loai: 'bao_cao',
    buoc: [
      'Đọc Brain thương hiệu, 4 báo cáo tuần và các báo cáo đối thủ gần nhất (CREWZY_VIEC_CAN_LAM tat_ca).',
      'Đề xuất: 1–3 mục tiêu đo được, kênh ưu tiên, 3 chủ đề nội dung chủ đạo, ngân sách quảng cáo gợi ý theo kênh, các quy trình nên hẹn giờ.',
      'Lập lịch việc 4 tuần (tuần nào làm gì).',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai cho_duyet) để chủ duyệt.',
    ] },

  // ---------- Việc hằng ngày ----------
  { id: 'ban_tin_sang', phong: 'hang_ngay', ten: 'Bản tin sáng cho chủ doanh nghiệp',
    mo_ta: 'Mỗi sáng: việc chờ duyệt, lịch hẹn hôm nay, số liệu hôm qua, email quan trọng, khách nóng cần gọi. Gửi qua Telegram hoặc Gmail.',
    lich: 'Mỗi ngày 7:00', loai: 'bao_cao',
    buoc: [
      'Gọi CREWZY_VIEC_CAN_LAM tat_ca: đếm phiếu chờ duyệt, việc AI đang làm.',
      'Lịch hôm nay (Google Calendar), email quan trọng chưa đọc (Gmail, bỏ quảng cáo), chi tiêu và kết quả quảng cáo hôm qua (nếu có), khách nóng chưa liên hệ.',
      'Viết bản tin dưới 12 dòng, việc cần chủ làm ghi trước.',
      'Gửi qua kênh nhắn nội bộ đã nối (Telegram, Slack, Teams, Zalo sau này) hoặc email cho chủ. Nộp bằng CREWZY_NOP_KET_QUA (loai bao_cao, trang_thai xong).',
    ] },
];


// ---------- Kênh / nền tảng và bộ công cụ gợi ý cho từng quy trình ----------
// Mỗi quy trình có các NHÓM CÔNG CỤ theo vai trò; trong một nhóm, khách nối MỘT app bất kỳ là đủ (app thay thế nhau).
// bat_buoc: thiếu cả nhóm thì quy trình chưa chạy được · san_co: Crewzy đã có sẵn (không cần nối).
export const CHANNELS = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', pinterest: 'Pinterest',
  zalo: 'Zalo', website: 'Website & SEO', email: 'Email', ads: 'Quảng cáo', crm: 'CRM & bán hàng', noi_bo: 'Nội bộ',
};
const G = {
  luu: { vai: 'Nơi lưu kết quả, lịch', apps: ['googlesheets', 'notion', 'airtable', 'googledocs', 'clickup', 'trello', 'asana', 'monday', 'googledrive', 'one_drive', 'dropbox'] },
  tai_lieu: { vai: 'Nơi lưu báo cáo, tài liệu', apps: ['googledocs', 'notion', 'googleslides', 'googledrive', 'one_drive', 'dropbox'] },
  kenh_dang: { vai: 'Kênh đăng bài', apps: ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'webflow', 'reddit', 'tiktok', 'threads'] },
  fanpage: { vai: 'Fanpage / kênh có bình luận', apps: ['facebook', 'instagram', 'youtube'] },
  nhan_noi_bo: { vai: 'Gửi báo cáo nội bộ', apps: ['telegram', 'slack', 'microsoft_teams', 'discord', 'gmail', 'outlook', 'whatsapp'] },
  crm: { vai: 'CRM / danh sách khách', apps: ['hubspot', 'pipedrive', 'salesforce', 'zoho', 'googlesheets', 'airtable', 'notion'] },
  nguon_khach: { vai: 'Nguồn khách mới', apps: ['gmail', 'outlook', 'facebook', 'instagram', 'typeform', 'googlesheets', 'calendly', 'intercom', 'crisp'] },
  hop_thu: { vai: 'Hộp thư / công cụ hỗ trợ', apps: ['gmail', 'outlook', 'zendesk', 'intercom', 'freshdesk', 'gorgias', 'crisp'] },
  email_mkt: { vai: 'Gửi email / tin chăm sóc', apps: ['gmail', 'outlook', 'mailchimp', 'brevo', 'klaviyo', 'kit', 'mailerlite', 'sendgrid', 'whatsapp', 'telegram'] },
  quang_cao: { vai: 'Tài khoản quảng cáo', apps: ['metaads', 'googleads', 'tiktok_ads'] },
  do_luong: { vai: 'Số liệu website, kênh', apps: ['google_analytics', 'google_search_console', 'facebook', 'instagram', 'youtube', 'stripe'] },
  lich: { vai: 'Lịch, cuộc hẹn', apps: ['googlecalendar', 'outlook', 'calendly', 'zoom', 'googlemeet'] },
  anh_video: { vai: 'Làm ảnh, video', apps: ['canva', 'heygen', 'elevenlabs', 'figma'], mcp: ['openart'], san_co: 'Crewzy có sẵn tạo ảnh và video (credit của app)' },
  soi_video: { vai: 'Soi video đối thủ (Reels, TikTok, YouTube)', apps: ['vidiq_mcp', 'apify', 'youtube'], mcp: ['apify', 'vidiq'] },
  soi_web: { vai: 'Đọc website, SEO đối thủ', apps: ['firecrawl', 'semrush', 'ahrefs', 'serpapi', 'tavily', 'perplexityai', 'google_maps'], mcp: ['firecrawl'] },
  soi_qc: { vai: 'Thư viện quảng cáo đối thủ', apps: ['apify'], mcp: ['apify'] },
  doc_web_minh: { vai: 'Đọc website của mình', apps: ['firecrawl', 'tavily', 'webflow'], mcp: ['firecrawl'] },
};
const req = (g) => ({ ...G[g], bat_buoc: true });
const opt = (g) => ({ ...G[g], bat_buoc: false });

const TOOLSETS = {
  brain_tu_website: { kenh: ['website', 'facebook'], cong_cu: [req('doc_web_minh'), opt('fanpage')] },
  doi_thu_reels: { kenh: ['instagram', 'tiktok', 'youtube', 'facebook'], cong_cu: [req('soi_video'), opt('tai_lieu')] },
  doi_thu_website: { kenh: ['website'], cong_cu: [req('soi_web'), opt('luu')] },
  doi_thu_quang_cao: { kenh: ['facebook', 'instagram', 'ads'], cong_cu: [req('soi_qc'), opt('tai_lieu')] },
  lich_noi_dung_tuan: { kenh: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest'], cong_cu: [req('kenh_dang'), opt('anh_video'), opt('luu')] },
  mot_noi_dung_nhieu_kenh: { kenh: ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'website'], cong_cu: [opt('kenh_dang'), opt('luu')] },
  video_theo_phong_cach: { kenh: ['tiktok', 'instagram', 'youtube', 'facebook'], cong_cu: [opt('anh_video'), opt('kenh_dang')] },
  dang_bai_da_duyet: { kenh: ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'website'], cong_cu: [req('kenh_dang')] },
  theo_doi_quang_cao: { kenh: ['ads', 'facebook'], cong_cu: [req('quang_cao'), opt('nhan_noi_bo')] },
  mau_quang_cao_moi: { kenh: ['ads', 'facebook', 'instagram'], cong_cu: [opt('quang_cao'), opt('anh_video')] },
  lead_vao_crm: { kenh: ['crm', 'email', 'facebook'], cong_cu: [req('nguon_khach'), req('crm'), opt('email_mkt')] },
  nhac_cham_soc_deal: { kenh: ['crm'], cong_cu: [req('crm'), opt('email_mkt'), opt('nhan_noi_bo')] },
  tra_loi_binh_luan: { kenh: ['facebook', 'instagram', 'youtube'], cong_cu: [req('fanpage')] },
  tra_loi_email_khach: { kenh: ['email'], cong_cu: [req('hop_thu')] },
  cham_soc_sau_mua: { kenh: ['email', 'crm', 'zalo'], cong_cu: [req('crm'), req('email_mkt')] },
  bao_cao_tuan: { kenh: ['ads', 'website', 'facebook', 'crm', 'noi_bo'], cong_cu: [opt('do_luong'), opt('quang_cao'), opt('crm'), opt('tai_lieu'), opt('nhan_noi_bo')] },
  de_xuat_chien_luoc: { kenh: ['noi_bo'], cong_cu: [opt('tai_lieu')] },
  ban_tin_sang: { kenh: ['noi_bo', 'email'], cong_cu: [opt('lich'), opt('hop_thu'), opt('quang_cao'), req('nhan_noi_bo')] },
};
for (const w of WORKFLOWS) Object.assign(w, TOOLSETS[w.id] || { kenh: [], cong_cu: [] });

export const workflowById = (id) => WORKFLOWS.find((w) => w.id === id) || null;

// Danh sách cho giao diện (không lộ gì nhạy cảm).
export function publicWorkflows() {
  return { departments: DEPARTMENTS, workflows: WORKFLOWS, mcpHosts: MCP_HOSTS, channels: CHANNELS };
}

// Kiểm tra từng nhóm công cụ: nhóm có app/MCP đã nối thì đạt; nhóm bắt buộc chưa có gì → thiếu.
// connected: slug Composio ACTIVE; mcpUrls: link MCP ngoài khách đã nối.
export function groupStatus(w, connected, mcpUrls) {
  const set = new Set(connected || []);
  const urls = (mcpUrls || []).join(' ');
  return (w.cong_cu || []).map((g) => {
    const apps = (g.apps || []).filter((s) => set.has(s));
    const mcp = (g.mcp || []).filter((m) => urls.includes(MCP_HOSTS[m] || m));
    return { vai: g.vai, bat_buoc: !!g.bat_buoc, san_co: g.san_co || '', da_noi: [...apps, ...mcp.map((m) => 'mcp:' + m)], goi_y: g.apps || [], goi_y_mcp: g.mcp || [], dat: !!(apps.length || mcp.length || g.san_co) };
  });
}
export function missingFor(w, connected, mcpUrls) {
  const groups = groupStatus(w, connected, mcpUrls);
  return { nhom: groups.filter((g) => g.bat_buoc && !g.dat).map((g) => g.vai), groups };
}

// Câu lệnh chạy một quy trình (Trợ lý trong app, phiếu việc, hẹn giờ, MCP prompt).
export function workflowPrompt(w, extra) {
  return `Chạy quy trình "${w.ten}" (mã ${w.id}) của Crewzy. Gọi CREWZY_QUY_TRINH với id "${w.id}" để lấy đúng các bước, làm lần lượt từng bước, `
    + 'cuối cùng nộp kết quả bằng CREWZY_NOP_KET_QUA kèm quy_trinh "' + w.id + '".' + (extra ? '\nThông tin thêm: ' + extra : '');
}

export const WORKFLOW_RULES = [
  'Làm đúng thứ tự các bước; không bỏ bước, không tự thêm việc ra bên ngoài.',
  'Trước khi chạy: xem nhóm công cụ (cong_cu). Mỗi nhóm dùng app ĐÃ NỐI (da_noi), nối nhiều thì chọn app phù hợp kênh/khách yêu cầu. Nhóm bắt buộc chưa nối gì thì dừng, báo khách nối một app trong goi_y, nộp phiếu ghi_chu nêu nhóm thiếu.',
  'Nhóm không bắt buộc chưa nối thì bỏ qua phần đó (hoặc dùng công cụ sẵn có của Crewzy) và ghi chú trong kết quả.',
  'Mỗi bước gọi công cụ lỗi: thử lại 1 lần; vẫn lỗi thì dừng, nộp CREWZY_NOP_KET_QUA với ghi_chu nêu bước và lỗi.',
  'Đăng bài, gửi tin/email, trả lời công khai, chi tiền: chỉ làm khi phiếu đã được duyệt (da_duyet) hoặc khách bảo "đăng luôn" trong cuộc trò chuyện.',
  'Luôn đọc Brain thương hiệu trước khi viết; không bịa giá, số liệu, lời khách; không đưa số điện thoại khách lên chỗ công khai.',
  'Kết thúc LUÔN bằng CREWZY_NOP_KET_QUA kèm quy_trinh = mã quy trình (và id phiếu nếu chạy từ phiếu việc).',
];
