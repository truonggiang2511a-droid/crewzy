// Việc Crewzy tự làm bằng code (không gọi AI, không tốn token): gửi Gmail báo chủ, ghi khách vào CRM ngay khi có lead.
// Dùng composio.tools.execute với tài khoản app khách đã nối (vpai-<uid>). Lỗi thì im lặng trả false: AI sẽ làm bù ở lượt sau.
import { Composio } from '@composio/core';
import { getApiKey, userIdFor } from './common.js';
import { ownerEmail } from './leads.js';

export const runTool = async (env, uid, slug, args) => {
  if (!getApiKey(env) || env.TEST_OFFLINE) throw new Error('chưa có khoá Composio');
  const r = await new Composio({ apiKey: getApiKey(env) }).tools.execute(slug, { userId: userIdFor(uid), dangerouslySkipVersionCheck: true, arguments: args });
  if (r && r.successful === false) throw new Error(String(r.error || 'không thành công').slice(0, 200));
  return r;
};

// Gmail báo chủ (tiêu đề luôn bắt đầu bằng [Crewzy] để trigger Gmail bỏ qua, không thành vòng lặp).
export async function mailOwner(env, uid, subject, text, connected) {
  if (connected && !connected.includes('gmail')) return false;
  const to = await ownerEmail(env, uid);
  if (!to) return false;
  try { await runTool(env, uid, 'GMAIL_SEND_EMAIL', { recipient_email: to, subject: '[Crewzy] ' + subject, body: text }); return true; }
  catch (e) { console.error('mail owner failed', uid, e && e.message); return false; }
}

// Ghi lead vào CRM đã nối (ưu tiên HubSpot, rồi Pipedrive). Trả tên CRM đã ghi hoặc ''.
export async function pushCrm(env, uid, lead, connected) {
  const set = new Set(connected || []);
  const parts = String(lead.ten || '').trim().split(/\s+/);
  try {
    if (set.has('hubspot')) {
      await runTool(env, uid, 'HUBSPOT_CREATE_CONTACT', { firstname: parts.slice(1).join(' ') || parts[0] || 'Khách', lastname: parts.length > 1 ? parts[0] : '',
        ...(lead.email ? { email: lead.email } : {}), ...(lead.sdt ? { phone: lead.sdt } : {}), message: `[${lead.nguon}] ${lead.nhu_cau || ''}`.slice(0, 900) });
      return 'HubSpot';
    }
    if (set.has('pipedrive')) {
      await runTool(env, uid, 'PIPEDRIVE_ADD_A_PERSON', { name: lead.ten || 'Khách', ...(lead.email ? { email: [{ value: lead.email, primary: true }] } : {}), ...(lead.sdt ? { phone: [{ value: lead.sdt, primary: true }] } : {}) });
      return 'Pipedrive';
    }
  } catch (e) { console.error('push crm failed', uid, e && e.message); }
  return '';
}
