// Trang Gói và credit (goi.html): tóm tắt gói, mua/gia hạn, nạp credit (VietQR), sổ credit, đơn; khu quản trị cho ADMIN_EMAILS.
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var P = window.crewzyPay, esc = P.esc, vnd = P.vnd;
  var data = null, tab = 'goi';
  var REASONS = { cong_cu: 'Chạy công cụ', ai: 'Trợ lý AI', mua_goi: 'Mua gói', nap_credit: 'Nạp credit', admin: 'Quản trị cấp' };
  function d(ms) { return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function api(path, opts) {
    return fetch(path, Object.assign({ cache: 'no-store', headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().then(function (j) { if (r.status === 401 && j.login && window.vpaiNeedLogin) window.vpaiNeedLogin(); return { ok: r.ok, j: j }; }); });
  }
  function table(head, rows) {
    if (!rows.length) return '<p class="muted" style="margin:0;font-size:14px">Chưa có.</p>';
    return '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>' + head.map(function (h) { return '<th style="text-align:left;padding:8px 6px;border-bottom:1px solid #E5E5E5;font-weight:500;color:var(--muted)">' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td style="padding:8px 6px;border-bottom:1px solid #F0F0F0">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function load() {
    api('/api/billing').then(function (res) {
      if (!res.ok) { $('[data-summary]').innerHTML = '<p style="color:#B42318">' + esc(res.j.error || 'Chưa tải được.') + '</p>'; return; }
      data = res.j;
      var a = data.account || {};
      var kpi = function (label, value, sub) { return '<div><p class="label-mono" style="margin:0 0 6px">' + label + '</p><div style="font-size:24px;font-weight:600;letter-spacing:-.02em">' + value + '</div>' + (sub ? '<p class="muted" style="margin:4px 0 0;font-size:13px">' + sub + '</p>' : '') + '</div>'; };
      $('[data-summary]').innerHTML = kpi('Gói', esc(a.ten_goi || 'Chưa có'), a.con_han ? 'Còn hạn' : (data.bat ? 'Chưa kích hoạt hoặc đã hết hạn' : 'Đang mở tự do')) +
        kpi('Hết hạn', a.het_han ? d(a.het_han) : '—') +
        kpi('Credit còn', '<span style="color:' + ((a.credits || 0) <= 0 ? '#B42318' : 'inherit') + '">' + Number(a.credits || 0).toLocaleString('vi-VN') + '</span>', '≈ ' + vnd((a.credits || 0) * 100));
      drawPlans();
      var g = data.gia || {};
      $('[data-prices]').innerHTML = 'Chạy một công cụ app (đăng bài, đọc số liệu, gửi email…): <b>' + g.cong_cu + ' credit</b> · Tạo ảnh: <b>' + g.anh + ' credit</b> · Video: <b>' + g.video_giay + ' credit/giây</b> · Chạy lệnh hàng loạt: <b>' + g.workbench + ' credit</b> · Trợ lý Crewzy: theo độ dài trò chuyện. Tìm công cụ, đọc Brain, quy trình, phiếu việc: miễn phí.';
      $('[data-ledger]').innerHTML = table(['Thời gian', 'Việc', 'Credit'], (data.so || []).map(function (l) {
        return [d(l.created_at), esc((REASONS[l.reason] || l.reason) + (l.ref && l.reason === 'cong_cu' ? ' · ' + l.ref : '')), '<b style="color:' + (l.delta > 0 ? '#067647' : 'inherit') + '">' + (l.delta > 0 ? '+' : '') + l.delta + '</b>'];
      }));
      $('[data-orders]').innerHTML = table(['Ngày', 'Nội dung CK', 'Số tiền', 'Trạng thái'], (data.don || []).map(function (o) {
        return [d(o.tao_luc), '<code>' + esc(o.code) + '</code>', vnd(o.amount), o.status === 'paid' ? '<b style="color:#067647">Đã trả</b>' : o.status === 'pending' ? 'Chờ chuyển khoản' : esc(o.status)];
      }));
      if (data.admin) loadAdmin();
    });
  }
  function drawPlans() {
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === tab)); });
    if (!data.thanh_toan_mo) { $('[data-plans]').innerHTML = '<p class="muted">Thanh toán chuyển khoản chưa mở. Liên hệ Crewzy để được kích hoạt.</p>'; return; }
    P.plans($('[data-plans]'), data, function (item) {
      $('[data-order]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      P.order($('[data-order]'), item, function () { setTimeout(load, 1200); });
    }, { topup: tab === 'nap' });
  }
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); if (data) drawPlans(); }); });

  function loadAdmin() {
    $('[data-admin]').hidden = false;
    var sel = $('[data-plan-select]');
    if (sel.options.length === 1) (data.goi || []).forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.ten; sel.appendChild(o); });
    api('/api/billing/admin').then(function (res) {
      if (!res.ok) return;
      $('[data-accounts]').innerHTML = '<h3 style="margin:8px 0;font-size:15px;font-weight:600">Tài khoản</h3>' + table(['Email', 'Gói', 'Hết hạn', 'Credit', 'AI'], (res.j.tai_khoan || []).map(function (t) {
        return [esc(t.email || t.uid), esc(t.plan || '—'), d(t.plan_until), String(t.credits), esc(t.ai_choice || '')];
      }));
      $('[data-payments]').innerHTML = '<h3 style="margin:8px 0;font-size:15px;font-weight:600">Giao dịch SePay gần đây</h3>' + table(['Lúc', 'Số tiền', 'Nội dung', 'Kết quả'], (res.j.giao_dich || []).map(function (p) {
        return [d(p.created_at), vnd(p.amount), esc(String(p.content || '').slice(0, 60)), esc(p.result || '')];
      }));
    });
  }
  $('[data-grant]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    api('/api/billing/admin', { method: 'POST', body: JSON.stringify({ email: f.elements.email.value.trim(), credits: Number(f.elements.credits.value), days: Number(f.elements.days.value), plan: f.elements.plan.value }) }).then(function (res) {
      btn.disabled = false;
      var m = $('[data-grant-msg]');
      m.textContent = res.ok ? 'Đã cấp. Credit hiện có: ' + res.j.account.credits + ', hết hạn ' + d(res.j.account.het_han) : (res.j.error || 'Chưa cấp được.');
      m.style.color = res.ok ? '#067647' : '#B42318';
      if (res.ok) loadAdmin();
    });
  });
  load();
})();
