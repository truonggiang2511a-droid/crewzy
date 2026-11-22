// Danh bạ máy chủ MCP (nguồn duy nhất): trang Kết nối (thẻ MCP + Điền nhanh), Quy trình (MCP_HOSTS, chip MCP).
// Đã thử nối qua Crewzy 22/11/2026 bằng POST /api/mcp-servers:
//   auth 'none'  = nối xong ngay, không đăng nhập · 'oauth' = Crewzy tự đăng ký app và ra trang đăng nhập đúng
//   ngoai: true  = máy chủ chặn link quay về của Crewzy (chỉ nhận Claude/ChatGPT…) → khách thêm trong AI của họ
// logo: slug ảnh ở logos.composio.dev (bỏ trống thì hiện chữ cái đầu trên nền bg).
// host: chuỗi để nhận ra máy chủ đã nối trong link khách lưu (HeyGen và HyperFrames chung tên miền → thêm đường dẫn).
const M = (id, name, url, auth, cat, desc, extra = {}) => ({ id, name, url, host: new URL(url).hostname.replace(/^(mcp|ai|docs|api)\./, ''), auth, cat, desc, ...extra });

export const MCP_DIRECTORY = [
  // Làm nội dung, ảnh, video
  M('openart', 'OpenArt', 'https://mcp.openart.ai/mcp', 'oauth', 'creative', 'Tạo ảnh và video AI, ảnh/video về thẳng khung chat để đăng.', { letter: 'O', bg: '#111111' }),
  M('hyperframes', 'HyperFrames (HeyGen)', 'https://mcp.heygen.com/mcp/hyperframes', 'oauth', 'creative', 'Dựng và render video từ HTML: chữ động, slide, motion graphics, video quảng cáo theo mẫu.', { letter: 'H', bg: '#5B3DF5', host: 'heygen.com/mcp/hyperframes' }),
  M('heygen', 'HeyGen', 'https://mcp.heygen.com/mcp/v1/', 'oauth', 'creative', 'Video người dẫn AI (avatar), giọng đọc, dịch video, nhép môi.', { logo: 'heygen', host: 'heygen.com/mcp/v1' }),
  M('shotstack', 'Shotstack', 'https://mcp.shotstack.io/', 'oauth', 'creative', 'Dựng video tự động: ghép cảnh, chữ, nhạc, render trên mây.', { letter: 'S', bg: '#1B1F3B' }),
  M('invideo', 'InVideo AI', 'https://mcp.invideo.io/mcp', 'oauth', 'creative', 'Làm video hoàn chỉnh từ kịch bản: cảnh, giọng, phụ đề, nhạc.', { letter: 'I', bg: '#7B2FF7' }),
  M('elevenlabs', 'ElevenLabs', 'https://api.elevenlabs.io/v1/mcp', 'oauth', 'creative', 'Giọng đọc AI, nhân bản giọng của bạn, nhạc, hiệu ứng âm thanh.', { logo: 'elevenlabs' }),
  M('captions', 'Captions', 'https://mcp.captions.ai/mcp', 'oauth', 'creative', 'Phụ đề tự động, cắt video, người dẫn AI.', { letter: 'C', bg: '#0F0F0F' }),
  M('opus', 'OpusClip', 'https://mcp.opus.pro/mcp', 'oauth', 'creative', 'Cắt video dài thành clip ngắn viral, phụ đề, khổ 9:16.', { letter: 'O', bg: '#6C3BFF' }),
  M('reap', 'Reap', 'https://mcp.reap.video/mcp', 'oauth', 'creative', 'Cắt clip, phụ đề, lồng tiếng, đổi khổ video.', { letter: 'R', bg: '#FF5A1F' }),
  M('metricool', 'Metricool', 'https://ai.metricool.com/mcp', 'oauth', 'social', 'Lên lịch đăng nhiều kênh (cả TikTok), số liệu, giờ đăng tốt nhất.', { letter: 'M', bg: '#1C6BF2' }),
  M('wix', 'Wix', 'https://mcp.wix.com/mcp', 'oauth', 'web', 'Sửa website Wix, blog, cửa hàng.', { logo: 'wix' }),
  M('webflow', 'Webflow', 'https://mcp.webflow.com/mcp', 'oauth', 'web', 'Sửa trang và CMS Webflow.', { logo: 'webflow' }),
  // Nghiên cứu, đối thủ
  M('apify', 'Apify', 'https://mcp.apify.com', 'oauth', 'research', 'Soi Reels, TikTok, quảng cáo Facebook, Google Maps của đối thủ.', { letter: 'A', bg: '#246DFF' }),
  M('firecrawl', 'Firecrawl', 'https://mcp.firecrawl.dev/mcp', 'none', 'research', 'Đọc website, bảng giá đối thủ. Không cần đăng nhập.', { letter: 'F', bg: '#FA5D19' }),
  M('exa', 'Exa', 'https://mcp.exa.ai/mcp', 'oauth', 'research', 'Tìm kiếm web cho AI, tìm công ty, bài viết.', { letter: 'E', bg: '#1F40ED' }),
  M('huggingface', 'Hugging Face', 'https://huggingface.co/mcp', 'none', 'research', 'Tìm mô hình AI, bộ dữ liệu, ứng dụng AI. Không cần đăng nhập.', { letter: 'H', bg: '#FFB000' }),
  M('deepwiki', 'DeepWiki', 'https://mcp.deepwiki.com/mcp', 'none', 'research', 'Hỏi đáp về mã nguồn GitHub. Không cần đăng nhập.', { logo: 'github' }),
  M('context7', 'Context7', 'https://mcp.context7.com/mcp', 'none', 'research', 'Tài liệu thư viện lập trình mới nhất. Không cần đăng nhập.', { letter: 'C', bg: '#059669' }),
  // Công việc, tài liệu, thanh toán
  M('notion', 'Notion', 'https://mcp.notion.com/mcp', 'oauth', 'work', 'Đọc, viết trang và bảng Notion.', { logo: 'notion' }),
  M('linear', 'Linear', 'https://mcp.linear.app/mcp', 'oauth', 'work', 'Tạo và theo dõi việc trên Linear.', { logo: 'linear' }),
  M('monday', 'monday.com', 'https://mcp.monday.com/mcp', 'oauth', 'work', 'Bảng công việc monday.com.', { logo: 'monday' }),
  M('clickup', 'ClickUp', 'https://mcp.clickup.com/mcp', 'oauth', 'work', 'Việc, tài liệu, lịch nội dung ClickUp.', { logo: 'clickup' }),
  M('miro', 'Miro', 'https://mcp.miro.com', 'oauth', 'work', 'Bảng trắng Miro: sơ đồ chiến dịch, ý tưởng.', { logo: 'miro' }),
  M('atlassian', 'Jira & Confluence', 'https://mcp.atlassian.com/v1/mcp', 'oauth', 'work', 'Việc Jira, tài liệu Confluence.', { logo: 'jira' }),
  M('zapier', 'Zapier', 'https://mcp.zapier.com/api/mcp/mcp', 'oauth', 'work', 'Dùng hàng nghìn app qua Zapier (chọn hành động trong tài khoản Zapier).', { letter: 'Z', bg: '#FF4F00' }),
  M('stripe', 'Stripe', 'https://mcp.stripe.com', 'oauth', 'money', 'Khách, thanh toán, link thanh toán Stripe.', { logo: 'stripe' }),
  // Chỉ thêm được trong AI của khách (Claude, ChatGPT…)
  M('vidiq', 'vidIQ', 'https://mcp.vidiq.com/mcp', 'oauth', 'research', 'Soi kênh YouTube, Instagram, TikTok đối thủ, từ khoá.', { ngoai: true, letter: 'V', bg: '#CC0000', alt: 'vidiq_mcp' }),
  M('canva', 'Canva', 'https://mcp.canva.com/mcp', 'oauth', 'creative', 'Thiết kế Canva bằng AI.', { ngoai: true, logo: 'canva', alt: 'canva' }),
  M('hubspot', 'HubSpot', 'https://mcp.hubspot.com', 'oauth', 'sales', 'CRM HubSpot.', { ngoai: true, logo: 'hubspot', alt: 'hubspot' }),
  M('airtable', 'Airtable', 'https://mcp.airtable.com/mcp', 'oauth', 'work', 'Bảng dữ liệu Airtable.', { ngoai: true, logo: 'airtable', alt: 'airtable' }),
  M('figma', 'Figma', 'https://mcp.figma.com/mcp', 'oauth', 'creative', 'File thiết kế Figma.', { ngoai: true, logo: 'figma', alt: 'figma' }),
  M('asana', 'Asana', 'https://mcp.asana.com/v2/mcp', 'oauth', 'work', 'Dự án, việc Asana.', { ngoai: true, logo: 'asana', alt: 'asana' }),
  M('intercom', 'Intercom', 'https://mcp.intercom.com/mcp', 'oauth', 'care', 'Hội thoại hỗ trợ khách Intercom.', { ngoai: true, logo: 'intercom', alt: 'intercom' }),
  M('gamma', 'Gamma', 'https://mcp.gamma.app/mcp', 'oauth', 'creative', 'Làm slide, trang giới thiệu bằng AI.', { ngoai: true, letter: 'G', bg: '#7C3AED' }),
  M('semrush', 'Semrush', 'https://mcp.semrush.com/v1/mcp', 'oauth', 'research', 'Từ khoá, lưu lượng, đối thủ SEO.', { ngoai: true, logo: 'semrush', alt: 'semrush' }),
  M('similarweb', 'Similarweb', 'https://mcp.similarweb.com/mcp', 'oauth', 'research', 'Lưu lượng website đối thủ.', { ngoai: true, letter: 'S', bg: '#092540' }),
];

export const MCP_HOSTS = Object.fromEntries(MCP_DIRECTORY.map((m) => [m.id, m.host]));
export const mcpById = (id) => MCP_DIRECTORY.find((m) => m.id === id);
