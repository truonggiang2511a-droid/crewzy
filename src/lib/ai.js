// AI của Crewzy (Trợ lý Crewzy, tự chạy, đọc website) đi qua Cloudflare AI Gateway khi có AI_GATEWAY_URL (23/11, gom về Cloudflare):
// nhật ký từng lượt gọi, chi phí, giới hạn chi tiêu, cache trên dashboard Cloudflare → AI → AI Gateway. Không đặt biến = gọi thẳng Anthropic như cũ.
// AI_GATEWAY_URL = https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id> · AI_GATEWAY_TOKEN (nếu gateway bật xác thực).
// Trả tiền qua Cloudflare (Unified Billing) hay giữ khoá Anthropic riêng: chỉnh trong gateway, code không đổi (gateway bỏ qua khoá gửi kèm khi tự giữ khoá).
import Anthropic from '@anthropic-ai/sdk';

export function gatewayBase(env) {
  const u = String(env.AI_GATEWAY_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/[^/]+\/[^/]+$/.test(u) ? u : '';
}

export function appAnthropic(env) {
  const gw = gatewayBase(env);
  if (!gw) return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY || 'cloudflare-gateway',
    baseURL: gw + '/anthropic',
    defaultHeaders: env.AI_GATEWAY_TOKEN ? { 'cf-aig-authorization': 'Bearer ' + env.AI_GATEWAY_TOKEN } : {},
  });
}
