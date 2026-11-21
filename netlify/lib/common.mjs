// Dùng chung cho các hàm máy chủ.
import { createHash, createHmac } from 'node:crypto';

// Công cụ khách được kết nối thật (dùng app có sẵn của Composio). TikTok cần app developer riêng nên chưa mở.
export const TOOLKITS = [
  'facebook', 'instagram', 'youtube', 'linkedin',
  'gmail', 'googlesheets', 'googlecalendar', 'googledrive', 'notion', 'hubspot',
];
export const MAX_ACCOUNTS_PER_TOOLKIT = 5;
export const UID_PATTERN = /^[a-z0-9-]{8,64}$/;

export const userIdFor = (uid) => `vpai-${uid}`;

export function safeDetail(err) {
  const text = String((err && (err.message || err)) || '').replace(/\b[a-z]{2}_[A-Za-z0-9*_-]+/g, '***');
  return text.slice(0, 300);
}

export function getApiKey() {
  return Netlify.env.get('COMPOSIO_API_KEY') || '';
}

// Ký link MCP: token = base64url(link Composio) + '.' + HMAC-SHA256. Khoá ký suy ra từ COMPOSIO_API_KEY,
// edge function mcp-gateway kiểm tra bằng đúng cách này (Web Crypto).
export function signUpstream(upstreamUrl, apiKey) {
  const payload = Buffer.from(upstreamUrl, 'utf8').toString('base64url');
  const key = createHash('sha256').update('vpai-mcp|' + apiKey, 'utf8').digest();
  const sig = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
  return `${payload}.${sig}`;
}
