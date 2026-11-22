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
import { MCP_HOSTS, MCP_DIRECTORY } from './mcpDirectory.js';
import { BRAND_FIELDS, REF_TYPES } from './brand.js';
export { MCP_HOSTS };

export const WORKFLOWS = [
  // ---------- Thương hiệu ----------
  { id: 'brain_tu_website', phong: 'thuong_hieu', ten: 'Dựng Brain thương hiệu từ website, Fanpage',
    mo_ta: 'Đọc website và Fanpage của doanh nghiệp, tự điền 11 mục Brain thương hiệu (sản phẩm, khách hàng, giọng văn, giá, câu hỏi thường gặp). Bạn duyệt là Crewzy lưu luôn.',
    lich: 'Một lần khi bắt đầu, làm lại mỗi quý', loai: 'brain',
    hoi: 'Link website và tên Fanpage của doanh nghiệp',
    buoc: [
      'Hỏi người dùng link website/Fanpage nếu chưa có trong yêu cầu.',
      'Đọc website bằng CREWZY_DOC_WEB (có sẵn trong Crewzy) hoặc công cụ đọc web của bạn (firecrawl_scrape nếu đã nối): trang chủ, rồi theo lien_ket đọc trang sản phẩm/dịch vụ, bảng giá, giới thiệu (3–6 trang). Fanpage cần đăng nhập: có Facebook đã nối thì đọc 20 bài gần nhất để học giọng văn, chưa nối thì bỏ qua hoặc nhờ khách dán vài bài.',
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
      'Đọc trang chủ, trang sản phẩm, bảng giá, chính sách của từng đối thủ bằng CREWZY_DOC_WEB (có sẵn) hoặc công cụ đọc web của bạn; chỉ có tên đối thủ thì tìm website bằng công cụ tìm kiếm của bạn (firecrawl_search, Tavily, Exa nếu đã nối).',
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
    lich: 'Thứ Hai hằng tuần, 8:00', loai: 'bai_dang', media: true,
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
    lich: '2–3 lần mỗi tuần', loai: 'bai_dang', media: true,
    buoc: [
      'ĐỌC KỸ thuong_hieu đi kèm (phong cách video, giọng, nhạc, video mẫu khách thích) và Sổ tay phong cách video (phiếu báo cáo quy trình doi_thu_reels gần nhất, xem bằng CREWZY_VIEC_CAN_LAM tat_ca).',
      'Viết kịch bản 6–15 giây: hook 3 giây đầu theo mẫu đã học, 1 giá trị chính, lời kêu gọi.',
      'Dựng video bằng công cụ đã nối (HyperFrames, Shotstack, Creatomate, HeyGen, OpenArt; giọng ElevenLabs theo mã giọng trong Brain) hoặc AI trên máy dựng bằng Remotion/ffmpeg rồi CREWZY_TAI_LEN; không có thì CREWZY_TAO_ANH rồi CREWZY_TAO_VIDEO (trường anh = link ảnh). Công cụ tạo lâu thì chờ bằng CREWZY_CHO rồi xem trạng thái.',
      'Viết caption cho Reels/TikTok/Shorts kèm lời mời nhắn tin.',
      'Nộp bằng CREWZY_NOP_KET_QUA (loai bai_dang, media = link video, noi_dung = kịch bản + caption) để duyệt.',
    ] },
  { id: 'video_tron_goi', phong: 'noi_dung', ten: 'Video trọn gói: học thương hiệu → soi đối thủ → ý tưởng → dựng → đăng mọi kênh',
    mo_ta: 'AI đọc kỹ Brain thương hiệu và các video, ảnh mẫu bạn thích, soi video nổi bật của đối thủ, đề xuất 3 ý tưởng cho bạn chọn, rồi viết kịch bản, lồng giọng, nhạc, dựng và render video (kèm ảnh bìa, ảnh 4:5), viết nội dung riêng cho từng kênh. Bạn duyệt là đăng lên mọi kênh đã nối, đúng định dạng từng kênh.',
    lich: '1–2 lần mỗi tuần', loai: 'bai_dang', media: true,
    hoi: 'Chủ đề hoặc sản phẩm muốn làm video (bỏ trống để AI tự đề xuất)',
    buoc: [
      'ĐỌC KỸ thuong_hieu đi kèm (Brain, phong cách video, giọng đọc, nhạc, mẫu tham khảo). Mở từng video mẫu và ảnh mẫu khách thích, ghi lại: hook 3 giây đầu, số cảnh, nhịp cắt, kiểu chữ trên màn hình, màu, nhạc, lời kêu gọi. Mục phong cách hoặc giọng còn trống: hỏi khách 1 lần, khách không trả lời thì dùng mặc định và ghi rõ.',
      'Nghiên cứu: xem 3–5 video nổi bật gần đây của đối thủ hoặc trong ngành (vidIQ, Apify, YouTube đã nối; hoặc báo cáo quy trình doi_thu_reels gần nhất qua CREWZY_VIEC_CAN_LAM tat_ca). Rút ra 3 điều họ làm tốt và 1 khoảng trống mình làm khác được.',
      'Đề xuất 3 ý tưởng, mỗi ý tưởng: hook, cấu trúc 3–6 cảnh, thời lượng, khổ (9:16 hay 16:9), kênh hợp nhất, vì sao dễ ra khách. Nếu khách CHƯA chọn ý tưởng (trong phiếu, cuộc trò chuyện) và không bảo "làm luôn": nộp CREWZY_NOP_KET_QUA (loai noi_dung, ghi_chu "Chọn 1 trong 3 ý tưởng rồi bấm Làm lại kèm số ý tưởng") rồi DỪNG.',
      'Ý tưởng đã chọn → kịch bản từng cảnh: hình ảnh/cảnh quay, lời đọc, chữ trên màn hình, thời gian. Chỉ dùng thông tin thật trong Brain; không bịa giá, số liệu, lời khách.',
      'Giọng đọc: dùng dịch vụ và mã giọng trong Brain (ElevenLabs/HeyGen đã nối, hoặc giọng mẫu khách tải lên làm tham chiếu); chưa có thì dùng giọng sẵn có hợp phong cách. Nhạc: nhạc trong Brain, không có thì nhạc không bản quyền, nhỏ hơn giọng.',
      'Dựng và render bằng công cụ đã nối, theo thứ tự ưu tiên: HyperFrames, Shotstack, Creatomate, InVideo, HeyGen (MCP hoặc app). AI chạy trên máy (Claude Code, Codex) có thể dựng bằng Remotion, HyperFrames hoặc ffmpeg rồi tải file lên bằng CREWZY_TAI_LEN. Không có công cụ nào thì CREWZY_TAO_ANH + CREWZY_TAO_VIDEO. Tư liệu thật của khách (mau_tham_khao loai tu_lieu) được ưu tiên hơn ảnh AI.',
      'Xuất đủ khổ cho các kênh sẽ đăng: video 9:16 (Reels, TikTok, Shorts), thêm 16:9 nếu đăng YouTube thường; 1 ảnh bìa và 1 ảnh 4:5 hoặc bộ carousel cho kênh nhận ảnh. Mọi file phải có link Crewzy (media_crewzy hoặc link_sau_khi_tai).',
      'Viết nội dung riêng cho TỪNG kênh đã nối theo dinh_dang_kenh: tiêu đề, mô tả, hashtag, lời mời nhắn tin. Kênh không nhận định dạng đó thì bỏ kênh đó và ghi chú (ví dụ YouTube không đăng ảnh, Instagram không đăng bài chỉ có chữ).',
      'Nộp CREWZY_NOP_KET_QUA (loai bai_dang, media = video + ảnh, noi_dung = nội dung từng kênh, kenh = các kênh sẽ đăng) để duyệt. Khi phiếu da_duyet (hoặc khách bảo "đăng luôn"): đăng từng kênh đúng định dạng, rồi nộp da_dang kèm link từng kênh.',
    ] },
  { id: 'edit_video_co_san', phong: 'noi_dung', ten: 'Dựng lại video bạn đã quay: cắt, phụ đề, nhạc, nhiều khổ',
    mo_ta: 'Bạn gửi video quay sẵn (tải lên Crewzy hoặc link Drive/YouTube). AI cắt đoạn thừa, thêm hook, phụ đề, nhạc, logo theo Brain, cắt thêm 3–5 clip ngắn, xuất đúng khổ từng kênh rồi viết nội dung. Bạn duyệt là đăng.',
    lich: 'Khi có video mới', loai: 'bai_dang', media: true,
    hoi: 'Link video gốc (tải lên ở Brain thương hiệu → Mẫu tham khảo → Tư liệu gốc, hoặc dán link)',
    buoc: [
      'ĐỌC KỸ thuong_hieu đi kèm: phong cách video, nhận diện (logo, màu, font), giọng, nhạc, video mẫu khách thích.',
      'Lấy video gốc từ phiếu, cuộc trò chuyện hoặc mau_tham_khao loai tu_lieu mới nhất. Chép lời (Captions, AssemblyAI, Rev nếu đã nối, hoặc công cụ của bạn) để tìm đoạn hay.',
      'Lên bản dựng: hook 3 giây đầu từ câu mạnh nhất, bỏ khoảng lặng và câu vấp, phụ đề theo phong cách, nhạc nhỏ dưới giọng, logo theo nhận diện, lời kêu gọi cuối.',
      'Dựng bằng công cụ đã nối: Captions, OpusClip, Reap (cắt clip ngắn, phụ đề), Shotstack, Creatomate, HyperFrames; AI trên máy dùng Remotion hoặc ffmpeg rồi CREWZY_TAI_LEN. Xuất 1 bản đầy đủ và 3–5 clip 9:16.',
      'Viết nội dung riêng từng kênh theo dinh_dang_kenh, bỏ kênh không nhận video.',
      'Nộp CREWZY_NOP_KET_QUA (loai bai_dang, media = các link video, noi_dung = nội dung từng kênh) để duyệt; da_duyet thì đăng và nộp da_dang kèm link.',
    ] },
  { id: 'dang_bai_da_duyet', phong: 'noi_dung', ten: 'Đăng bài đã duyệt',
    mo_ta: 'Đăng các phiếu bài đã được bạn duyệt lên đúng kênh, rồi cập nhật "Đã đăng" kèm link bài. Hẹn giờ chạy mỗi ngày.',
    lich: 'Mỗi ngày 9:00 và 19:00', loai: 'bai_dang',
    buoc: [
      'Gọi CREWZY_VIEC_CAN_LAM, lấy các phiếu trạng thái da_duyet có loai bai_dang.',
      'Với từng phiếu: đăng đúng nội dung và ảnh/video đã duyệt lên kênh ghi trong phiếu, đúng dinh_dang_kenh (Facebook: FACEBOOK_CREATE_POST/FACEBOOK_CREATE_PHOTO_POST/video; Instagram: tạo media rồi publish, Reels cho video; YouTube chỉ video, Shorts cho video dọc ≤ 60 giây). Kênh không nhận định dạng của bài thì bỏ qua và ghi chú. Mỗi lần đăng tối đa 3 bài, cách nhau vài phút nếu nhiều trang.',
      'Đăng xong gọi CREWZY_NOP_KET_QUA với id phiếu, trang_thai da_dang, lien_ket = link bài. Lỗi thì thử lại 1 lần, vẫn lỗi thì nộp ghi_chu nêu lỗi và giữ nguyên trạng thái.',
    ] },

  // ---------- Quảng cáo ----------
  { id: 'anh_quang_cao_theo_mau', phong: 'quang_cao', ten: 'Ảnh quảng cáo theo mẫu bạn thích',
    mo_ta: 'AI xem các ảnh quảng cáo mẫu bạn đã thêm vào Brain thương hiệu, học bố cục, màu, kiểu chữ, rồi làm bộ ảnh mới cho sản phẩm của bạn đủ khổ (4:5, 1:1, 9:16) kèm câu chữ. Bạn duyệt là đăng hoặc đưa vào quảng cáo.',
    lich: 'Mỗi tuần hoặc khi có ưu đãi mới', loai: 'noi_dung', media: true,
    hoi: 'Sản phẩm hoặc ưu đãi cần làm ảnh',
    buoc: [
      'ĐỌC KỸ thuong_hieu đi kèm: nhận diện hình ảnh, ảnh quảng cáo mẫu (mau_tham_khao loai anh_mau), logo, tư liệu gốc. Mô tả từng ảnh mẫu: bố cục, vị trí sản phẩm, màu, kiểu chữ, độ dài câu chữ.',
      'Chưa có ảnh mẫu nào: hỏi khách thêm 2–3 ảnh mẫu ở Brain thương hiệu, hoặc làm theo nhận diện hình ảnh và ghi rõ.',
      'Viết 3 câu tiêu đề ngắn + 1 lời kêu gọi theo Brain (không bịa giá, ưu đãi).',
      'Làm ảnh theo bố cục mẫu bằng công cụ đã nối (Canva, OpenArt, Bannerbear, Placid, fal.ai, Gemini, OpenAI) hoặc CREWZY_TAO_ANH; ưu tiên ảnh sản phẩm thật của khách (tu_lieu). Không chép logo, người, chữ của mẫu.',
      'Xuất đủ khổ: 4:5 cho bảng tin, 1:1, 9:16 cho story/Reels. Mọi ảnh phải có link Crewzy.',
      'Nộp CREWZY_NOP_KET_QUA (loai noi_dung, media = các ảnh, noi_dung = tiêu đề + nội dung từng kênh theo dinh_dang_kenh) để duyệt; da_duyet thì đăng các kênh nhận ảnh (không đăng lên YouTube) rồi nộp da_dang.',
    ] },
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
    lich: 'Mỗi 2 tuần', loai: 'noi_dung', media: true,
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
  { id: 'tim_khach_doanh_nghiep', phong: 'ban_hang', ten: 'Tìm khách doanh nghiệp và soạn chuỗi email chào hàng',
    mo_ta: 'Tìm công ty đúng ngành, khu vực (Apollo, Hunter, Google Maps), lấy người phụ trách, soạn chuỗi 3 email chào hàng riêng từng công ty để bạn duyệt rồi mới gửi (mẫu "lead generation → cold email" hay dùng trên n8n/Make).',
    lich: 'Thứ Hai và thứ Năm, 9:00', loai: 'cham_soc',
    hoi: 'Ngành, khu vực, cỡ công ty và chức danh người muốn tiếp cận',
    buoc: [
      'Đọc Brain thương hiệu: sản phẩm, khách lý tưởng, lợi ích chính. Thiếu ngành/khu vực thì hỏi khách.',
      'Tìm 10–20 công ty đúng tiêu chí bằng app đã nối (Apollo, Lusha, Google Maps, Apify) và người phụ trách đúng chức danh; email lấy từ Apollo/Hunter (chỉ email công việc).',
      'Bỏ công ty đã có trong CRM hoặc đã chào trong 90 ngày. Ghi danh sách vào CRM hoặc bảng "Khách doanh nghiệp".',
      'Soạn chuỗi 3 email ngắn cho từng công ty (chào, nhắc sau 3 ngày, chốt sau 7 ngày), mỗi email nêu một lợi ích thật, không bịa số liệu.',
      'Nộp CREWZY_NOP_KET_QUA (loai cham_soc) kèm danh sách + email nháp. Chỉ khi phiếu được duyệt mới đưa vào lemlist/Instantly/Smartlead/Reply.io hoặc Gmail để gửi.',
    ] },
  { id: 'bao_gia_sau_cuoc_goi', phong: 'ban_hang', ten: 'Tóm tắt cuộc gọi và soạn báo giá',
    mo_ta: 'Đọc bản ghi cuộc gọi/cuộc họp với khách (Fireflies, Gong, Aircall), tóm tắt nhu cầu, cập nhật CRM và soạn báo giá nháp (PandaDoc, Qwilr, Google Docs).',
    lich: 'Mỗi ngày 17:30', loai: 'cham_soc',
    buoc: [
      'Lấy bản ghi các cuộc gọi/cuộc họp với khách trong ngày từ app đã nối.',
      'Tóm tắt mỗi cuộc: khách là ai, nhu cầu, ngân sách nếu khách nói, phản đối, hẹn bước tiếp theo. Không suy đoán thêm.',
      'Cập nhật ghi chú và bước tiếp theo vào CRM đã nối.',
      'Khách cần báo giá: soạn báo giá nháp từ bảng giá trong Brain thương hiệu (không tự đặt giá mới) bằng PandaDoc/Qwilr/Google Docs.',
      'Nộp CREWZY_NOP_KET_QUA (loai cham_soc, lien_ket = link báo giá) để duyệt trước khi gửi khách.',
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
  { id: 'tra_loi_binh_luan', phong: 'cham_soc', ten: 'Trả lời bình luận trên các nền tảng',
    mo_ta: 'Đọc bình luận mới trên Facebook, Instagram, YouTube, LinkedIn (và các kênh khác đã nối), phân loại, trả lời theo giọng thương hiệu. Bật "tự trả lời" khi hẹn giờ thì AI trả lời ngay câu thường (cảm ơn, hỏi giá → mời nhắn tin, câu có trong FAQ); câu nhạy cảm luôn chờ bạn duyệt.',
    lich: 'Mỗi giờ từ 8:00 tới 22:00 (bật tự trả lời) hoặc 3 lần mỗi ngày', loai: 'cham_soc', tu_dong: true,
    buoc: [
      'ĐỌC KỸ thuong_hieu đi kèm: giọng văn, nên nói, không được nói, giá và ưu đãi, câu hỏi thường gặp.',
      'Đọc bình luận chưa trả lời trên các bài 7 ngày gần đây của mọi kênh có bình luận đã nối (Facebook, Instagram, YouTube, LinkedIn…). Bỏ bình luận của chính trang.',
      'Phân loại: khen/cảm ơn, hỏi giá/hỏi mua, câu hỏi có trong FAQ, phàn nàn/đổi trả, pháp lý/nhạy cảm, spam.',
      'Soạn trả lời ngắn theo Brain: hỏi giá mà Brain không có giá → mời nhắn tin; không công khai số điện thoại hay thông tin khách; phàn nàn → xin lỗi, mời nhắn riêng; spam → đề xuất ẩn.',
      'Nếu yêu cầu ghi "TỰ TRẢ LỜI ĐÃ BẬT": trả lời ngay các bình luận khen, hỏi giá/hỏi mua, câu có trong FAQ (tối đa 30 bình luận mỗi lượt); KHÔNG tự trả lời phàn nàn, đổi trả, pháp lý, chửi bới, câu không chắc. Không bật thì không trả lời công khai.',
      'Nộp CREWZY_NOP_KET_QUA (loai cham_soc): danh sách đã tự trả lời (link + câu trả lời, trang_thai da_dang nếu chỉ có loại này) và danh sách chờ duyệt. Khi phiếu được duyệt, trả lời đúng nội dung rồi nộp da_dang.',
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
// Định dạng mỗi kênh đăng được (qua API). AI chỉ đăng định dạng có trong danh sách; kênh không nhận thì bỏ qua.
export const FORMATS = { chu: 'Bài chữ', anh: 'Ảnh', nhieu_anh: 'Nhiều ảnh (carousel)', video_doc: 'Video dọc 9:16 (Reels/Shorts)', video_ngang: 'Video ngang 16:9', story: 'Story 24 giờ', bai_viet: 'Bài viết website/blog' };
export const PLATFORM_FORMATS = {
  facebook: { ten: 'Facebook Fanpage', dang: ['chu', 'anh', 'nhieu_anh', 'video_doc', 'video_ngang'], kho: 'Ảnh 4:5 hoặc 1:1; Reels 9:16 tối đa 90 giây', ghi_chu: 'Bài chữ nên kèm ảnh; link đặt trong bài.' },
  instagram: { ten: 'Instagram', dang: ['anh', 'nhieu_anh', 'video_doc', 'story'], kho: 'Ảnh 4:5 (1080×1350); Reels/Story 9:16', ghi_chu: 'KHÔNG đăng bài chỉ có chữ; link trong bài không bấm được, ghi "link ở tiểu sử".' },
  youtube: { ten: 'YouTube', dang: ['video_ngang', 'video_doc'], kho: 'Video 16:9; Shorts 9:16 tối đa 60 giây', ghi_chu: 'CHỈ đăng video, KHÔNG đăng ảnh hay bài chữ. Cần tiêu đề ≤ 100 ký tự, mô tả, thẻ.' },
  tiktok: { ten: 'TikTok', dang: ['video_doc', 'nhieu_anh'], kho: 'Video 9:16; ảnh cuộn dọc', ghi_chu: 'Không đăng bài chữ. App chưa được TikTok duyệt thì bài chỉ ở chế độ riêng tư.' },
  linkedin: { ten: 'LinkedIn', dang: ['chu', 'anh', 'nhieu_anh', 'video_ngang', 'video_doc'], kho: 'Ảnh 1:1 hoặc 4:5; video ngang hoặc dọc', ghi_chu: 'Giọng chuyên môn, ít hashtag (3–5).' },
  pinterest: { ten: 'Pinterest', dang: ['anh', 'video_doc'], kho: 'Ảnh dọc 2:3 (1000×1500)', ghi_chu: 'Mỗi ghim nên có link về website.' },
  threads: { ten: 'Threads', dang: ['chu', 'anh', 'nhieu_anh', 'video_doc'], kho: 'Ảnh 4:5; video dọc', ghi_chu: '' },
  reddit: { ten: 'Reddit', dang: ['chu', 'anh'], kho: '', ghi_chu: 'Đọc luật từng nhóm; không đăng quảng cáo lộ liễu.' },
  sprout_social: { ten: 'Sprout Social', dang: ['chu', 'anh', 'nhieu_anh', 'video_doc', 'video_ngang'], kho: 'Theo từng kênh bên trong Sprout', ghi_chu: 'Áp dụng luật định dạng của kênh đích.' },
  wix: { ten: 'Wix (blog)', dang: ['bai_viet'], kho: '', ghi_chu: 'Bài blog có tiêu đề, ảnh bìa.' },
  webflow: { ten: 'Webflow (CMS)', dang: ['bai_viet'], kho: '', ghi_chu: '' },
  framer: { ten: 'Framer (CMS)', dang: ['bai_viet'], kho: '', ghi_chu: '' },
  'mcp:metricool': { ten: 'Metricool (nhiều kênh, cả TikTok)', dang: ['chu', 'anh', 'nhieu_anh', 'video_doc', 'video_ngang', 'story'], kho: 'Theo từng kênh trong Metricool', ghi_chu: 'Áp dụng luật định dạng của kênh đích (YouTube chỉ video, Instagram không bài chữ).' },
};
export function formatsFor(connected, mcpIds) {
  const out = {};
  for (const k of Object.keys(PLATFORM_FORMATS)) {
    const on = k.startsWith('mcp:') ? (mcpIds || []).includes(k.slice(4)) : (connected || []).includes(k);
    if (on) out[k] = { ...PLATFORM_FORMATS[k], dang: PLATFORM_FORMATS[k].dang.map((f) => FORMATS[f]) };
  }
  return out;
}

const G = {
  luu: { vai: 'Nơi lưu kết quả, lịch', apps: ['googlesheets', 'notion', 'airtable', 'googledocs', 'clickup', 'trello', 'asana', 'monday', 'coda', 'basecamp', 'wrike', 'excel', 'googledrive', 'one_drive', 'dropbox', 'box'], mcp: ['notion', 'monday', 'clickup'] },
  tai_lieu: { vai: 'Nơi lưu báo cáo, tài liệu', apps: ['googledocs', 'notion', 'googleslides', 'confluence', 'coda', 'onenote', 'googledrive', 'one_drive', 'dropbox', 'box', 'share_point'], mcp: ['notion'] },
  kenh_dang: { vai: 'Kênh đăng bài', apps: ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'sprout_social', 'webflow', 'wix', 'framer', 'reddit', 'line', 'tiktok', 'threads'], mcp: ['metricool', 'wix', 'webflow'] },
  fanpage: { vai: 'Kênh có bình luận', apps: ['facebook', 'instagram', 'youtube', 'linkedin', 'sprout_social', 'reddit', 'tiktok'], mcp: ['metricool'] },
  nhan_noi_bo: { vai: 'Gửi báo cáo nội bộ', apps: ['telegram', 'slack', 'microsoft_teams', 'discord', 'gmail', 'outlook', 'whatsapp', 'line'] },
  crm: { vai: 'CRM / danh sách khách', apps: ['hubspot', 'pipedrive', 'salesforce', 'zoho', 'close', 'copper', 'freshsales', 'attio', 'nutshell', 'capsule_crm', 'agile_crm', 'folk', 'centralstationcrm', 'active_campaign', 'googlesheets', 'airtable', 'notion'] },
  nguon_khach: { vai: 'Nguồn khách mới', apps: ['gmail', 'outlook', 'facebook', 'instagram', 'typeform', 'jotform', 'tally', 'paperform', 'googlesheets', 'calendly', 'cal', 'savvycal', 'intercom', 'crisp', 'front', 'aircall', 'dialpad'] },
  tim_khach_b2b: { vai: 'Tìm khách doanh nghiệp', apps: ['apollo', 'hunter', 'lusha', 'google_maps', 'dataforseo'], mcp: ['apify', 'exa'] },
  chao_hang: { vai: 'Gửi chuỗi email chào hàng', apps: ['lemlist', 'instantly', 'smartlead', 'reply_io', 'apollo', 'gmail', 'outlook'] },
  hop_thu: { vai: 'Hộp thư / công cụ hỗ trợ', apps: ['gmail', 'outlook', 'zendesk', 'intercom', 'freshdesk', 'zoho_desk', 'front', 'gorgias', 'crisp', 're_amaze', 'gleap'] },
  email_mkt: { vai: 'Gửi email / tin chăm sóc', apps: ['gmail', 'outlook', 'mailchimp', 'brevo', 'klaviyo', 'active_campaign', 'getresponse', 'send_pulse', 'omnisend', 'customerio', 'kit', 'mailerlite', 'moosend', 'benchmark_email', 'beehiiv', 'sendgrid', 'whatsapp', 'telegram', 'line', 'twilio', 'clicksend'] },
  quang_cao: { vai: 'Tài khoản quảng cáo', apps: ['metaads', 'googleads', 'tiktok_ads'] },
  do_luong: { vai: 'Số liệu website, kênh', apps: ['google_analytics', 'google_search_console', 'posthog', 'mixpanel', 'amplitude', 'facebook', 'instagram', 'youtube', 'sprout_social', 'stripe', 'square', 'bigcommerce'], mcp: ['metricool'] },
  doanh_thu: { vai: 'Doanh thu, đơn hàng', apps: ['stripe', 'square', 'clover', 'bigcommerce', 'gumroad', 'lemon_squeezy', 'quickbooks', 'zoho_books', 'googlesheets'], mcp: ['stripe'] },
  bao_gia: { vai: 'Báo giá, hợp đồng', apps: ['pandadoc', 'qwilr', 'dropbox_sign', 'googledocs', 'zoho_invoice'] },
  lich: { vai: 'Lịch, cuộc hẹn', apps: ['googlecalendar', 'outlook', 'calendly', 'cal', 'savvycal', 'zoom', 'googlemeet', 'webex'] },
  ghi_hop: { vai: 'Ghi âm, chép lời cuộc gọi/họp', apps: ['fireflies', 'gong', 'aircall', 'dialpad', 'assemblyai', 'rev'] },
  anh_video: { vai: 'Làm ảnh, video', apps: ['canva', 'heygen', 'elevenlabs', 'figma', 'runway', 'fal_ai', 'synthesia', 'bannerbear', 'creatomate', 'shotstack', 'placid', 'remove_bg', 'cloudinary', 'pexels', 'unsplash', 'openai', 'gemini'], mcp: ['openart', 'heygen'], san_co: 'Crewzy có sẵn tạo ảnh và video (credit của app)',
    san_co_mcp: 'Crewzy có sẵn tạo ảnh (CREWZY_TAO_ANH); làm video bằng credit Crewzy chỉ có trong Trợ lý AI của app, AI ngoài dùng app làm video đã nối' },
  dung_video: { vai: 'Dựng, render video', apps: ['shotstack', 'creatomate', 'descript_mcp', 'heygen', 'synthesia', 'runway', 'luma_labs', 'fal_ai', 'cloudinary'], mcp: ['hyperframes', 'shotstack', 'invideo', 'heygen', 'openart'], san_co: 'Crewzy có sẵn làm video ngắn bằng AI (credit của app); AI chạy trên máy (Claude Code, Codex) dựng bằng Remotion, HyperFrames, ffmpeg rồi tải lên Crewzy',
    san_co_mcp: 'AI chạy trên máy (Claude Code, Codex) dựng bằng Remotion, HyperFrames, ffmpeg rồi tải lên bằng CREWZY_TAI_LEN; làm video bằng credit Crewzy chỉ có trong Trợ lý AI của app' },
  giong_doc: { vai: 'Giọng đọc, lồng tiếng', apps: ['elevenlabs', 'cartesia', 'fish_audio', 'heygen', 'openai', 'gemini'], mcp: ['elevenlabs', 'heygen'], san_co: 'Giọng mẫu và mã giọng trong Brain thương hiệu' },
  cat_clip: { vai: 'Cắt clip ngắn, phụ đề tự động', apps: ['captions', 'descript_mcp', 'assemblyai', 'rev'], mcp: ['captions', 'opus', 'reap'] },
  soi_video: { vai: 'Soi video đối thủ (Reels, TikTok, YouTube)', apps: ['vidiq_mcp', 'apify', 'youtube'], mcp: ['apify', 'vidiq'] },
  soi_web: { vai: 'Đọc website, SEO đối thủ', apps: ['firecrawl', 'semrush', 'ahrefs', 'dataforseo', 'moz', 'serpapi', 'tavily', 'perplexityai', 'google_maps'], mcp: ['firecrawl', 'exa'], san_co: 'Crewzy có sẵn đọc website (CREWZY_DOC_WEB); AI của bạn tự đọc web cũng được. Nối Semrush, Ahrefs nếu cần số liệu SEO.' },
  soi_qc: { vai: 'Thư viện quảng cáo đối thủ', apps: ['apify'], mcp: ['apify'] },
  doc_web_minh: { vai: 'Đọc website của mình', apps: ['firecrawl', 'tavily', 'webflow', 'wix', 'framer'], mcp: ['firecrawl'], san_co: 'Crewzy có sẵn đọc website (CREWZY_DOC_WEB); AI của bạn tự đọc web cũng được. Không cần nối thêm app.' },
};
const req = (g) => ({ ...G[g], key: g, bat_buoc: true });
const opt = (g) => ({ ...G[g], key: g, bat_buoc: false });

const TOOLSETS = {
  brain_tu_website: { kenh: ['website', 'facebook'], cong_cu: [req('doc_web_minh'), opt('fanpage')] },
  doi_thu_reels: { kenh: ['instagram', 'tiktok', 'youtube', 'facebook'], cong_cu: [req('soi_video'), opt('tai_lieu')] },
  doi_thu_website: { kenh: ['website'], cong_cu: [req('soi_web'), opt('luu')] },
  doi_thu_quang_cao: { kenh: ['facebook', 'instagram', 'ads'], cong_cu: [req('soi_qc'), opt('tai_lieu')] },
  lich_noi_dung_tuan: { kenh: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest'], cong_cu: [req('kenh_dang'), opt('anh_video'), opt('luu')] },
  mot_noi_dung_nhieu_kenh: { kenh: ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'website'], cong_cu: [opt('kenh_dang'), opt('luu')] },
  video_theo_phong_cach: { kenh: ['tiktok', 'instagram', 'youtube', 'facebook'], cong_cu: [opt('dung_video'), opt('giong_doc'), opt('anh_video'), opt('kenh_dang')] },
  video_tron_goi: { kenh: ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'pinterest'], cong_cu: [opt('soi_video'), req('dung_video'), opt('giong_doc'), opt('anh_video'), req('kenh_dang'), opt('luu')] },
  edit_video_co_san: { kenh: ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'], cong_cu: [req('dung_video'), opt('cat_clip'), opt('giong_doc'), opt('kenh_dang')] },
  anh_quang_cao_theo_mau: { kenh: ['facebook', 'instagram', 'linkedin', 'pinterest', 'ads'], cong_cu: [req('anh_video'), opt('quang_cao'), opt('kenh_dang')] },
  dang_bai_da_duyet: { kenh: ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'website'], cong_cu: [req('kenh_dang')] },
  theo_doi_quang_cao: { kenh: ['ads', 'facebook'], cong_cu: [req('quang_cao'), opt('nhan_noi_bo')] },
  mau_quang_cao_moi: { kenh: ['ads', 'facebook', 'instagram'], cong_cu: [opt('quang_cao'), opt('anh_video')] },
  lead_vao_crm: { kenh: ['crm', 'email', 'facebook'], cong_cu: [req('nguon_khach'), req('crm'), opt('email_mkt')] },
  tim_khach_doanh_nghiep: { kenh: ['crm', 'email', 'linkedin'], cong_cu: [req('tim_khach_b2b'), opt('crm'), opt('chao_hang')] },
  bao_gia_sau_cuoc_goi: { kenh: ['crm', 'email'], cong_cu: [req('ghi_hop'), opt('crm'), opt('bao_gia')] },
  nhac_cham_soc_deal: { kenh: ['crm'], cong_cu: [req('crm'), opt('email_mkt'), opt('nhan_noi_bo')] },
  tra_loi_binh_luan: { kenh: ['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'], cong_cu: [req('fanpage')] },
  tra_loi_email_khach: { kenh: ['email'], cong_cu: [req('hop_thu')] },
  cham_soc_sau_mua: { kenh: ['email', 'crm', 'zalo'], cong_cu: [req('crm'), req('email_mkt')] },
  bao_cao_tuan: { kenh: ['ads', 'website', 'facebook', 'crm', 'noi_bo'], cong_cu: [opt('do_luong'), opt('quang_cao'), opt('doanh_thu'), opt('crm'), opt('tai_lieu'), opt('nhan_noi_bo')] },
  de_xuat_chien_luoc: { kenh: ['noi_bo'], cong_cu: [opt('tai_lieu')] },
  ban_tin_sang: { kenh: ['noi_bo', 'email'], cong_cu: [opt('lich'), opt('hop_thu'), opt('quang_cao'), opt('doanh_thu'), req('nhan_noi_bo')] },
};
for (const w of WORKFLOWS) Object.assign(w, TOOLSETS[w.id] || { kenh: [], cong_cu: [] });

// ---------- Điều kiện DỮ LIỆU (ngoài app) để quy trình ra kết quả thật ----------
// Đủ app chưa đủ: thiếu Brain, mẫu tham khảo, quy trình phải chạy trước hay nguồn số liệu thì AI làm ra kết quả rỗng.
// brain: các mục Brain phải có · mau: ít nhất 1 mẫu tham khảo loại đó · truoc: quy trình phải có kết quả trước (thay: thứ thay thế được)
// nguon: ít nhất 1 nhóm công cụ (theo key) đã nối. bat_buoc false = chỉ nhắc "nên có", không chặn.
const BRAIN_MIN = ['name', 'products'];
const brainCan = (truong, bat_buoc = true) => ({ loai: 'brain', truong, bat_buoc });
const mauCan = (kieu, bat_buoc = true) => ({ loai: 'mau', kieu, bat_buoc });
const truocCan = (quy_trinh, thay = {}, bat_buoc = true) => ({ loai: 'truoc', quy_trinh, thay, bat_buoc });
const nguonCan = (nhom) => ({ loai: 'nguon', nhom, bat_buoc: true });
const NEEDS = {
  doi_thu_website: [brainCan(BRAIN_MIN, false)],
  lich_noi_dung_tuan: [brainCan(BRAIN_MIN), truocCan('doi_thu_reels', {}, false)],
  mot_noi_dung_nhieu_kenh: [brainCan(BRAIN_MIN)],
  video_theo_phong_cach: [brainCan(BRAIN_MIN), truocCan('doi_thu_reels', { brain: 'video_style', mau: 'video_mau' })],
  video_tron_goi: [brainCan(BRAIN_MIN), mauCan('video_mau', false)],
  edit_video_co_san: [brainCan(BRAIN_MIN)],
  anh_quang_cao_theo_mau: [brainCan(BRAIN_MIN), mauCan('anh_mau')],
  mau_quang_cao_moi: [brainCan(BRAIN_MIN)],
  lead_vao_crm: [brainCan(BRAIN_MIN)],
  tim_khach_doanh_nghiep: [brainCan(BRAIN_MIN), brainCan(['customers'], false)],
  bao_gia_sau_cuoc_goi: [brainCan(['offers'], false)],
  nhac_cham_soc_deal: [brainCan(BRAIN_MIN)],
  tra_loi_binh_luan: [brainCan(BRAIN_MIN), brainCan(['faq', 'voice'], false)],
  tra_loi_email_khach: [brainCan([...BRAIN_MIN, 'faq'])],
  cham_soc_sau_mua: [brainCan(BRAIN_MIN)],
  bao_cao_tuan: [nguonCan(['do_luong', 'quang_cao', 'doanh_thu', 'crm'])],
  de_xuat_chien_luoc: [brainCan(BRAIN_MIN), truocCan('bao_cao_tuan')],
};
for (const w of WORKFLOWS) w.can = NEEDS[w.id] || [];

export const workflowById = (id) => WORKFLOWS.find((w) => w.id === id) || null;

// Danh sách cho giao diện (không lộ gì nhạy cảm).
export function publicWorkflows() {
  return { departments: DEPARTMENTS, workflows: WORKFLOWS, mcpHosts: MCP_HOSTS, channels: CHANNELS, formats: FORMATS, platformFormats: PLATFORM_FORMATS,
    mcpInfo: Object.fromEntries(MCP_DIRECTORY.map((m) => [m.id, { name: m.name, url: m.url, note: m.desc, ngoai: !!m.ngoai, logo: m.logo || '', letter: m.letter || m.name[0], bg: m.bg || '#555' }])) };
}

// Kiểm tra từng nhóm công cụ: nhóm có app/MCP đã nối thì đạt; nhóm bắt buộc chưa có gì → thiếu.
// connected: slug Composio ACTIVE; mcpUrls: link MCP ngoài khách đã nối.
export function groupStatus(w, connected, mcpUrls) {
  const set = new Set(connected || []);
  const urls = (mcpUrls || []).join(' ');
  return (w.cong_cu || []).map((g) => {
    const apps = (g.apps || []).filter((s) => set.has(s));
    const mcp = (g.mcp || []).filter((m) => urls.includes(MCP_HOSTS[m] || m));
    return { vai: g.vai, bat_buoc: !!g.bat_buoc, san_co: g.san_co || '', san_co_mcp: g.san_co_mcp, da_noi: [...apps, ...mcp.map((m) => 'mcp:' + m)], goi_y: g.apps || [], goi_y_mcp: g.mcp || [], dat: !!(apps.length || mcp.length || g.san_co) };
  });
}
export function missingFor(w, connected, mcpUrls) {
  const groups = groupStatus(w, connected, mcpUrls);
  return { nhom: groups.filter((g) => g.bat_buoc && !g.dat).map((g) => g.vai), groups };
}

// Phiếu có kết quả (kể cả đang chờ duyệt) = quy trình đó đã chạy ra sản phẩm dùng được cho quy trình sau.
const RESULT_STATES = new Set(['cho_duyet', 'da_duyet', 'da_dang', 'xong']);
export const doneFlows = (jobs) => new Set((jobs || []).filter((j) => j.quy_trinh && RESULT_STATES.has(j.trang_thai) && !/^Chưa chạy tự động/.test(j.noi_dung || '')).map((j) => j.quy_trinh));
const filled = (b, k) => typeof b[k] === 'string' ? !!b[k].trim() : !!b[k];
const hasRef = (b, kieu) => (b.refs || []).some((r) => r && r.loai === kieu);
const anchor = (id) => { const x = workflowById(id); return 'quy-trinh.html?phong=' + (x ? x.phong : 'all') + '#wf-' + id; };

function checkNeed(c, b, done, groups) {
  if (c.loai === 'brain') {
    const lack = c.truong.filter((k) => !filled(b, k));
    if (!lack.length) return null;
    const ten = lack.map((k) => BRAND_FIELDS[k] || k).join(', ');
    return { loai: 'brain', ten: 'Brain thương hiệu còn trống: ' + ten,
      cach: 'Chạy "Dựng Brain thương hiệu từ website, Fanpage" (AI tự điền, bạn duyệt) hoặc tự điền ở trang Brain thương hiệu.',
      nut: 'Dựng Brain trước', link: anchor('brain_tu_website') };
  }
  if (c.loai === 'mau') {
    if (hasRef(b, c.kieu)) return null;
    return { loai: 'mau', ten: 'Chưa có ' + (REF_TYPES[c.kieu] || c.kieu).toLowerCase() + ' trong Brain',
      cach: 'Thêm 2–3 mẫu ở Brain thương hiệu → Mẫu tham khảo (dán link hoặc tải lên).', nut: 'Thêm mẫu', link: 'thuong-hieu.html#mau-tham-khao' };
  }
  if (c.loai === 'truoc') {
    if (done.has(c.quy_trinh) || (c.thay.brain && filled(b, c.thay.brain)) || (c.thay.mau && hasRef(b, c.thay.mau))) return null;
    const x = workflowById(c.quy_trinh);
    const alt = [c.thay.brain && 'điền "' + BRAND_FIELDS[c.thay.brain].split(' (')[0] + '" ở Brain', c.thay.mau && 'thêm ' + REF_TYPES[c.thay.mau].split(' (')[0].toLowerCase()].filter(Boolean);
    return { loai: 'truoc', quy_trinh: c.quy_trinh, ten: 'Cần chạy trước: ' + x.ten,
      cach: 'Chạy quy trình "' + x.ten + '" một lần để có kết quả dùng cho quy trình này' + (alt.length ? ', hoặc ' + alt.join(' hoặc ') : '') + '.',
      nut: 'Chạy trước quy trình này', link: anchor(c.quy_trinh) };
  }
  if (c.loai === 'nguon') {
    const gs = groups.filter((g) => c.nhom.includes(g.key));
    if (gs.some((g) => g.da_noi.length)) return null;
    const first = (gs[0] && gs[0].goi_y[0]) || '';
    return { loai: 'nguon', ten: 'Chưa có nguồn số liệu nào (' + gs.map((g) => g.vai.toLowerCase()).join(', ') + ')',
      cach: 'Nối ít nhất 1 app có số liệu (Google Analytics, Fanpage, Meta Ads, CRM…) thì báo cáo mới có số.', nut: 'Nối 1 nguồn số liệu', link: 'ket-noi.html' + (first ? '?app=' + first : '') };
  }
  return null;
}

// Sẵn sàng thật = đủ app bắt buộc + đủ điều kiện dữ liệu. ctx: { connected, mcpUrls, brand, jobs | done }.
export function readiness(w, ctx) {
  const miss = missingFor(w, ctx.connected, ctx.mcpUrls);
  const b = ctx.brand || {};
  const done = ctx.done || doneFlows(ctx.jobs);
  const groups = miss.groups.map((g, i) => ({ ...g, key: (w.cong_cu[i] || {}).key }));
  const thieu = [], nen = [];
  for (const c of w.can || []) { const r = checkNeed(c, b, done, groups); if (r) (c.bat_buoc ? thieu : nen).push(r); }
  return { san_sang: !miss.nhom.length && !thieu.length, thieu_nhom: miss.nhom, thieu_du_lieu: thieu, nen_co: nen, groups: miss.groups };
}

// Câu lệnh chạy một quy trình (Trợ lý trong app, phiếu việc, hẹn giờ, MCP prompt).
export function workflowPrompt(w, extra) {
  return `Chạy quy trình "${w.ten}" (mã ${w.id}) của Crewzy. Gọi CREWZY_QUY_TRINH với id "${w.id}" để lấy đúng các bước, làm lần lượt từng bước, `
    + 'cuối cùng nộp kết quả bằng CREWZY_NOP_KET_QUA kèm quy_trinh "' + w.id + '".' + (extra ? '\nThông tin thêm: ' + extra : '');
}

// ---------- Bản cho AI ngoài (link MCP) ----------
// CREWZY_TAO_VIDEO (tốn tiền thật của Giang) và CREWZY_CHO (treo Worker) chỉ có trong Trợ lý AI của app.
// Cổng MCP từ chối gọi thẳng hai công cụ này; quy trình trả qua MCP được viết lại để không bảo AI ngoài gọi chúng.
// Thêm câu mới nhắc hai công cụ này vào quy trình thì phải thêm luật viết lại ở đây (scripts/gatewaytest.mjs sẽ báo).
export const APP_ONLY_TOOLS = ['CREWZY_TAO_VIDEO', 'CREWZY_CHO'];
const MCP_VIDEO_FALLBACK = 'chưa nối công cụ dựng video nào thì làm ảnh bằng CREWZY_TAO_ANH, nộp kịch bản + ảnh để khách duyệt, ghi_chu gợi ý khách nối HyperFrames (Kết nối → MCP khác) hoặc mở Trợ lý AI trong Crewzy để làm video bằng credit của app';
const MCP_REWRITES = [
  [/; không có thì CREWZY_TAO_ANH rồi CREWZY_TAO_VIDEO \(trường anh = link ảnh\)\./g, '; ' + MCP_VIDEO_FALLBACK + '.'],
  [/Không có công cụ nào thì CREWZY_TAO_ANH \+ CREWZY_TAO_VIDEO\./g, 'Không có công cụ nào: ' + MCP_VIDEO_FALLBACK + '.'],
  [/Công cụ tạo lâu thì chờ bằng CREWZY_CHO rồi xem trạng thái\./g, 'Công cụ tạo lâu thì đợi 20–30 giây rồi gọi công cụ xem trạng thái của app đó.'],
  [/bằng credit Crewzy hoặc OpenArt/g, 'bằng công cụ dựng video đã nối (HyperFrames, OpenArt…)'],
];
export function forMcp(text) {
  let t = String(text || '');
  for (const [re, to] of MCP_REWRITES) t = t.replace(re, to);
  return t;
}

export const WORKFLOW_RULES = [
  'BƯỚC 0 BẮT BUỘC: đọc kỹ thuong_hieu kèm trong kết quả CREWZY_QUY_TRINH (Brain, phong cách hình ảnh/video, giọng đọc, nhạc, mẫu tham khảo) TRƯỚC khi làm bất cứ việc gì. Mở các link mẫu khách thích để học phong cách; làm theo phong cách đó cho thương hiệu của khách, không sao chép nội dung, logo, người trong mẫu. Mục trong thuong_hieu.thieu: hỏi khách 1 lần hoặc dùng mặc định và ghi rõ trong kết quả.',
  'Đăng bài: chỉ đăng lên kênh có định dạng phù hợp trong dinh_dang_kenh (vd YouTube chỉ nhận video, Instagram không nhận bài chỉ có chữ); kênh không nhận thì bỏ qua và ghi chú. Mỗi kênh một nội dung riêng đúng văn phong và khổ ảnh/video của kênh đó.',
  'Ảnh/video tạo ở công cụ khác phải có link Crewzy trước khi đăng hoặc nộp: dùng media_crewzy trong kết quả công cụ, hoặc AI trên máy tải file lên bằng CREWZY_TAI_LEN.',
  'Làm đúng thứ tự các bước; không bỏ bước, không tự thêm việc ra bên ngoài.',
  'Trước khi chạy: xem nhóm công cụ (cong_cu). Mỗi nhóm dùng app ĐÃ NỐI (da_noi), nối nhiều thì chọn app phù hợp kênh/khách yêu cầu. Nhóm bắt buộc chưa nối gì thì dừng, báo khách nối một app trong goi_y, nộp phiếu ghi_chu nêu nhóm thiếu.',
  'Nhóm không bắt buộc chưa nối thì bỏ qua phần đó (hoặc dùng công cụ sẵn có của Crewzy) và ghi chú trong kết quả.',
  'Mỗi bước gọi công cụ lỗi: thử lại 1 lần; vẫn lỗi thì dừng, nộp CREWZY_NOP_KET_QUA với ghi_chu nêu bước và lỗi.',
  'Đăng bài, gửi tin/email, trả lời công khai, chi tiền: chỉ làm khi phiếu đã được duyệt (da_duyet) hoặc khách bảo "đăng luôn" trong cuộc trò chuyện.',
  'Luôn đọc Brain thương hiệu trước khi viết; không bịa giá, số liệu, lời khách; không đưa số điện thoại khách lên chỗ công khai.',
  'Kết thúc LUÔN bằng CREWZY_NOP_KET_QUA kèm quy_trinh = mã quy trình (và id phiếu nếu chạy từ phiếu việc).',
];
