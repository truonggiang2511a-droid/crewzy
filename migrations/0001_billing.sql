-- Crewzy: tài khoản, gói, credit, đơn thanh toán, giao dịch SePay, sổ credit.
-- Áp lên D1 thật: Cloudflare MCP d1_database_query (đã chạy 22/11/2026) hoặc
--   npx wrangler d1 migrations apply crewzy-db --remote
-- Chạy thử cục bộ: npx wrangler d1 migrations apply crewzy-db --local

-- Mỗi khách một dòng. plan_until: hết hạn gói (ms). credits có thể âm nhẹ khi trừ theo token sau lượt AI.
CREATE TABLE IF NOT EXISTS accounts (
  uid TEXT PRIMARY KEY,
  email TEXT,
  plan TEXT,
  plan_until INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  ai_choice TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Đơn mua gói / nạp credit. code = nội dung chuyển khoản (CZ + 8 ký tự), khớp với webhook SePay.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  kind TEXT NOT NULL,            -- plan | topup
  item TEXT NOT NULL,            -- mã gói hoặc gói nạp
  amount INTEGER NOT NULL,       -- VND
  credits INTEGER NOT NULL,
  days INTEGER NOT NULL DEFAULT 0,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,          -- pending | paid | cancelled
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  payment_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(uid, created_at);

-- Mọi giao dịch SePay gửi về. id = id giao dịch của SePay (PRIMARY KEY → INSERT OR IGNORE chống trùng khi SePay gửi lại).
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  gateway TEXT,
  account TEXT,
  amount INTEGER,
  content TEXT,
  reference TEXT,
  tx_date TEXT,
  order_id TEXT,
  result TEXT,                   -- da_cong | thieu_tien | khong_khop | sai_tai_khoan | da_tra | chuyen_ra
  raw TEXT,
  created_at INTEGER NOT NULL
);

-- Sổ credit: mỗi lần cộng/trừ một dòng (delta dương = cộng).
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_uid ON ledger(uid, id);
