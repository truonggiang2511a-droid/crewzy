// Thanh toán VietQR dùng chung cho trang Bắt đầu (bat-dau.html) và Gói và credit (goi.html).
// window.crewzyPay.plans(box, data, onPick) vẽ thẻ gói/nạp · crewzyPay.order(box, item, onPaid) tạo đơn, hiện QR, tự hỏi trạng thái tới khi đã trả.
(function () {
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function vnd(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = 'Đã chép'; setTimeout(function () { btn.textContent = t; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    else { var a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) {} a.remove(); }
  }

  function plans(box, data, onPick, opts) {
    opts = opts || {};
    var list = (opts.topup ? data.nap : data.goi) || [];
    box.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">' + list.map(function (p) {
      return '<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:10px;' + (p.noi_bat ? 'border:2px solid var(--text)' : '') + '">' +
        (p.noi_bat ? '<span class="pill" style="align-self:flex-start">Nên chọn</span>' : '') +
        '<b style="font-size:17px">' + esc(p.ten) + '</b>' +
        '<div style="font-size:26px;font-weight:600;letter-spacing:-.02em">' + vnd(p.gia) + (p.ngay ? '<span class="muted" style="font-size:14px;font-weight:400"> / ' + (p.ngay >= 360 ? '1 năm' : p.ngay >= 30 && p.ngay % 30 === 0 ? (p.ngay / 30) + ' tháng' : p.ngay + ' ngày') + '</span>' : '') +
        (p.ngay > 30 ? '<div class="muted" style="font-size:12px">≈ ' + vnd(Math.round(p.gia / (p.ngay >= 360 ? 12 : p.ngay / 30) / 1000) * 1000) + ' mỗi tháng</div>' : '') + '</div>' +
        '<p class="muted" style="margin:0;font-size:13px">' + (p.mo_ta ? esc(p.mo_ta) : Number(p.credits).toLocaleString('vi-VN') + ' credit') + '</p>' +
        // Content khách nhận mỗi tháng (23/11) + ô mua thêm Fanpage / thương hiệu (giá tự cộng).
        (p.noi_dung && p.noi_dung.length ? '<div style="background:#F6F6F6;border-radius:10px;padding:10px 12px"><div class="label-mono" style="font-size:11px;margin-bottom:6px">Content mỗi tháng</div><ul style="margin:0;padding-left:16px;font-size:13px;line-height:1.5">' + p.noi_dung.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '') +
        (p.them ? '<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px">Thêm ' + esc(p.them.ten) + ' <small class="muted">(' + vnd(p.them.gia_thang) + '/tháng mỗi ' + esc(p.them.ten) + ')</small>' +
          '<input type="number" min="0" max="' + p.them.toi_da + '" value="0" data-them="' + esc(p.id) + '" style="width:72px;font:inherit;padding:6px;border:1px solid #E2E2E2;border-radius:8px"></label>' +
          '<div style="font-size:13px" data-them-tong="' + esc(p.id) + '"></div>' : '') +
        (p.loi_ich && p.loi_ich.length ? '<ul style="margin:2px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;font-size:13px;line-height:1.45">' +
          p.loi_ich.map(function (t) { return '<li style="display:flex;gap:8px"><span aria-hidden="true" style="flex:none;width:16px;height:16px;margin-top:2px;border-radius:50%;background:#D4FF4A;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0F0F0F">✓</span><span>' + esc(t) + '</span></li>'; }).join('') +
          '</ul>' +
          (p.khong && p.khong.length ? '<ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.45;color:#8A8A8A">' +
            p.khong.map(function (t) { return '<li style="display:flex;gap:8px"><span aria-hidden="true" style="flex:none;width:16px;height:16px;margin-top:2px;border-radius:50%;background:#EEEEEE;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#8A8A8A">✕</span><span><span class="sr-only">Không có: </span>' + esc(t) + '</span></li>'; }).join('') + '</ul>' : '') +
          '<p class="muted" style="margin:0;font-size:11px">Số lượng ước tính, credit dùng chung cho mọi việc.</p>' : '') +
        '<button type="button" class="btn ' + (p.noi_bat ? 'btn-primary' : 'btn-ghost') + '" data-pick="' + esc(p.id) + '" style="margin-top:auto">' + (opts.topup ? 'Nạp' : 'Chọn gói') + '</button></div>';
    }).join('') + '</div>';
    box.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () {
      var id = b.getAttribute('data-pick'), inp = box.querySelector('[data-them="' + id + '"]');
      var p = list.filter(function (x) { return x.id === id; })[0], n = inp ? Math.max(0, Math.min(p.them.toi_da, parseInt(inp.value, 10) || 0)) : 0;
      onPick(n ? id + '+' + p.them.loai + n : id);
    }); });
    box.querySelectorAll('[data-them]').forEach(function (inp) {
      var id = inp.getAttribute('data-them'), p = list.filter(function (x) { return x.id === id; })[0], out = box.querySelector('[data-them-tong="' + id + '"]');
      var upd = function () {
        var n = Math.max(0, Math.min(p.them.toi_da, parseInt(inp.value, 10) || 0));
        out.innerHTML = n ? 'Tổng: <b>' + (p.them.kem + n) + ' ' + esc(p.them.ten) + '</b> · <b>' + vnd(p.gia + n * p.them.gia_thang * p.them.thang) + '</b>' : 'Đã gồm ' + p.them.kem + ' ' + esc(p.them.ten) + '.';
      };
      inp.addEventListener('input', upd); upd();
    });
  }

  var timer = null;
  function order(box, item, onPaid) {
    clearTimeout(timer);
    box.innerHTML = '<p class="muted">Đang tạo mã thanh toán…</p>';
    fetch('/api/billing/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: item }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.don) { box.innerHTML = '<p style="color:#B42318">' + esc(res.j.error || 'Chưa tạo được đơn.') + '</p>'; return; }
        show(box, res.j.don, onPaid);
      })
      .catch(function () { box.innerHTML = '<p style="color:#B42318">Mất kết nối, thử lại.</p>'; });
  }
  function show(box, d, onPaid) {
    box.innerHTML = '<div class="card" style="padding:18px;display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">' +
      '<img data-qr src="' + esc(d.qr) + '" alt="Mã QR chuyển khoản" width="220" height="220" style="width:220px;height:auto;border-radius:10px;border:1px solid var(--line, #E5E5E5);background:#fff">' +
      '<div style="flex:1 1 240px;display:flex;flex-direction:column;gap:10px;min-width:0">' +
      '<b style="font-size:16px">Quét mã bằng app ngân hàng</b>' +
      '<p class="muted" style="margin:0;font-size:13px">Hoặc chuyển khoản đúng số tiền và nội dung bên dưới. Crewzy tự kích hoạt sau vài giây khi tiền về.</p>' +
      row('Ngân hàng', d.ngan_hang) + row('Số tài khoản', d.so_tk, true) + (d.chu_tk ? row('Chủ tài khoản', d.chu_tk) : '') +
      row('Số tiền', vnd(d.amount), false, String(d.amount)) + row('Nội dung', d.code, true) +
      '<p data-pay-status style="margin:4px 0 0;font-size:14px"><span class="dot-wait"></span> Đang chờ tiền về…</p></div></div>';
    box.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copy(b.getAttribute('data-copy'), b); }); });
    // Ảnh QR từ vietqr.app (tài liệu SePay); lỗi thì thử qr.sepay.vn cùng tham số, vẫn lỗi thì ẩn ảnh (khách chuyển khoản theo thông tin bên cạnh).
    var img = box.querySelector('[data-qr]');
    if (img) img.addEventListener('error', function () {
      if (img.src.indexOf('vietqr.app') >= 0) img.src = img.src.replace('https://vietqr.app/img', 'https://qr.sepay.vn/img');
      else img.style.display = 'none';
    });
    poll(box, d.id, onPaid, 0);
  }
  function row(label, value, canCopy, copyValue) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #EEE;padding-bottom:8px">' +
      '<span class="muted" style="font-size:13px">' + esc(label) + '</span><span style="display:flex;gap:8px;align-items:center;min-width:0"><b style="font-family:var(--font-mono);font-size:14px;overflow-wrap:anywhere">' + esc(value) + '</b>' +
      (canCopy || copyValue ? '<button type="button" class="btn btn-ghost" data-copy="' + esc(copyValue || value) + '" style="min-height:30px;padding:0 10px;font-size:12px">Chép</button>' : '') + '</span></div>';
  }
  function poll(box, id, onPaid, n) {
    timer = setTimeout(function () {
      if (!document.body.contains(box)) return;
      fetch('/api/billing/order?id=' + encodeURIComponent(id), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.don && j.don.status === 'paid') {
          var s = box.querySelector('[data-pay-status]');
          if (s) s.innerHTML = '<b style="color:#067647">Đã nhận tiền. Crewzy đã kích hoạt cho bạn.</b>';
          if (onPaid) onPaid(j.don);
          return;
        }
        poll(box, id, onPaid, n + 1);
      }).catch(function () { poll(box, id, onPaid, n + 1); });
    }, n < 75 ? 4000 : 15000);
  }

  window.crewzyPay = { plans: plans, order: order, show: show, vnd: vnd, esc: esc, copy: copy };
})();
