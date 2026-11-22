-- Kho lưu trữ của khách: ảnh, video, âm thanh, tài liệu (file ở R2 /api/media hoặc link ngoài).
CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  kind TEXT NOT NULL,          -- image | video | audio | doc | link
  url TEXT NOT NULL,
  name TEXT,
  source TEXT,                 -- tai_len | ai_tao | web | fanpage | ket_qua | link
  size INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (uid, url)
);
CREATE INDEX IF NOT EXISTS library_uid ON library (uid, created_at);
