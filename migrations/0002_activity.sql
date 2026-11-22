-- Nhật ký việc AI đã làm theo tháng (giờ Việt Nam) cho màn Kết quả và báo cáo tuần.
CREATE TABLE IF NOT EXISTS activity (
  uid TEXT NOT NULL,
  month TEXT NOT NULL,      -- YYYY-MM
  day TEXT NOT NULL,        -- YYYY-MM-DD
  kind TEXT NOT NULL,       -- dang_bai | tra_loi | gui_tin | anh | video | khach | doc | khac
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, day, kind)
);
CREATE INDEX IF NOT EXISTS activity_month ON activity (uid, month);
