// ▶ RUN CHẠY THẬT NGAY (Trung tâm điều hành + Quy trình): window.crewzyRun.start(nv, {lap}) → POST /api/run start, rồi trang tự chạy lần lượt
// từng bước (POST /api/run step, đọc NDJSON) — không qua trang chat. Khung "Dây chuyền đang chạy" góc màn hình: bước đang làm, công cụ AI đang gọi,
// trạng thái từng bước, nút Dừng; xong mỗi bước có thông báo (và Notification nếu khách cho phép). Phát sự kiện 'crewzy:run' cho cây vận hành vẽ lại.
// Mở lại trang khi dây chuyền còn bước → tự chạy tiếp. Đóng trang → máy chủ làm nốt (cron 15 phút).
(function () {
  if (window.crewzyRun) return;
  var ROOM = { thuong_hieu: 'Thương hiệu', doi_thu: 'Phân tích đối thủ', chien_luoc: 'Chiến lược', noi_dung: 'Nội dung & Video', phan_phoi: 'Sản xuất & Phân phối', quang_cao: 'Marketing', ban_hang: 'Bán hàng', cham_soc: 'CSKH', bao_cao: 'Báo cáo', hang_ngay: 'Hằng ngày' };
  var ST = {
    cho_lam: ['wait', 'Chờ tới lượt'], dang_lam: ['run', 'Đang làm'], cho_duyet: ['ok', 'Xong · chờ bạn duyệt'], da_duyet: ['ok', 'Đã duyệt'],
    da_dang: ['ok', 'Xong · đã đăng/gửi'], xong: ['ok', 'Xong'], tu_choi: ['off', 'Đã bỏ']
  };
  var view = null, driving = false, ctrl = null, now = null, min = false, dock = null, toastBox = null;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uidBody(b) { var u = window.vpaiUid ? window.vpaiUid() : ''; if (u) b.uid = u; return JSON.stringify(b); }
  function fire(d) { document.dispatchEvent(new CustomEvent('crewzy:run', { detail: d })); }
  function api(b) { return fetch('/api/run', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: uidBody(b) }); }

  function toast(html, kind) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'rd-toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    while (toastBox.children.length >= 2) toastBox.firstChild.remove(); // tối đa 2 thông báo cùng lúc cho gọn
    var t = document.createElement('div'); t.className = 'rd-toast ' + (kind || ''); t.innerHTML = html; toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 6000);
  }
  function notify(title, body) { try { if (window.Notification && Notification.permission === 'granted' && document.hidden) new Notification(title, { body: body, tag: 'crewzy-run' }); } catch (e) {} }

  function render() {
    if (!view) { if (dock) dock.hidden = true; return; }
    if (!dock) { dock = document.createElement('section'); dock.className = 'rd'; dock.setAttribute('aria-label', 'Dây chuyền đang chạy'); document.body.appendChild(dock); }
    dock.hidden = false;
    var het = view.het, pct = view.tong ? Math.round(view.xong / view.tong * 100) : 0;
    var head = het ? (view.dung ? '■ Đã dừng dây chuyền' : '✓ Dây chuyền chạy xong') : 'Dây chuyền đang chạy';
    var cur = now && !het ? '<p class="rd-now"><b>' + esc(ROOM[now.phong] || '') + ' · ' + esc(now.ten) + '</b><small>' + esc(now.label || 'AI đang nhận việc…') + '</small></p>' : '';
    if (het && !view.dung) cur = '<p class="rd-now"><b>' + view.xong + ' bước đã làm' + (view.cho_duyet ? ' · ' + view.cho_duyet + ' việc chờ bạn duyệt' : '') + '</b><small>Kết quả nằm ở Việc chờ duyệt và Kết quả.</small></p>';
    var list = view.steps.map(function (s, i) {
      var st = ST[s.trang_thai] || ST.xong, isNow = now && now.job === s.job && !het;
      if (isNow) st = ST.dang_lam;
      return '<li class="' + st[0] + '"><i aria-hidden="true">' + (st[0] === 'ok' ? '✓' : st[0] === 'run' ? '●' : st[0] === 'off' ? '–' : (i + 1)) + '</i><span><b>' + esc(s.ten) + '</b><small>' + esc(ROOM[s.phong] || '') + ' · ' + esc(st[1]) + '</small></span>' +
        (s.trang_thai === 'cho_duyet' ? '<a href="cho-duyet.html?id=' + encodeURIComponent(s.job) + '">Xem</a>' : '') + '</li>';
    }).join('');
    dock.className = 'rd' + (min ? ' min' : '') + (het ? ' done' : '');
    dock.innerHTML = '<div class="rd-head"><span class="rd-dot' + (het ? ' off' : '') + '" aria-hidden="true"></span><b>' + head + '</b><span class="label-mono">' + view.xong + '/' + view.tong + '</span>' +
      '<button type="button" class="rd-x" data-rd-min aria-label="' + (min ? 'Mở rộng' : 'Thu gọn') + '">' + (min ? '▴' : '▾') + '</button>' + (het ? '<button type="button" class="rd-x" data-rd-close aria-label="Đóng">✕</button>' : '') + '</div>' +
      '<div class="rd-bar"><i style="width:' + pct + '%"></i></div>' + cur +
      (min ? '' : '<ol class="rd-steps">' + list + '</ol><div class="rd-act">' + (het ? '' : '<button type="button" class="btn btn-ghost" data-rd-stop>■ Dừng</button>') +
        (view.cho_duyet ? '<a class="btn btn-primary" href="cho-duyet.html">Duyệt ' + view.cho_duyet + ' việc</a>' : '') + '</div>');
  }

  function handle(e) {
    if (e.type === 'step') { now = { job: e.job, ten: e.ten, phong: e.phong, label: e.lai ? 'Làm lại bước chưa xong…' : 'AI đang nhận việc…' }; window.crewzyRunNow = now; }
    else if (e.type === 'tool' && now) { now.label = e.label; window.crewzyRunNow = now; }
    else if (e.type === 'step_done') {
      var st = ST[e.trang_thai] || ST.xong;
      toast('<b>✓ ' + esc(ROOM[e.phong] || '') + ': ' + esc(e.ten) + '</b><small>' + esc(st[1]) + (e.tom_tat ? ' — ' + esc(e.tom_tat.slice(0, 110)) : '') + '</small>' + (e.trang_thai === 'cho_duyet' ? '<a href="cho-duyet.html?id=' + encodeURIComponent(e.job) + '">Duyệt ngay</a>' : ''), 'ok');
      notify('Crewzy: xong ' + e.ten, st[1]);
      now = null; window.crewzyRunNow = null;
    }
    else if (e.type === 'loi') { toast('<b>⚠ ' + esc(e.message) + '</b>', 'warn'); }
    else if (e.type === 'view' && e.run) view = e.run;
    render(); fire(e);
  }

  function finish() {
    driving = false; now = null; window.crewzyRunNow = null;
    if (view && view.het && !view.dung) {
      toast('<b>✓ Dây chuyền chạy xong ' + view.xong + ' bước</b>' + (view.cho_duyet ? '<small>' + view.cho_duyet + ' việc chờ bạn duyệt</small><a href="cho-duyet.html">Duyệt ngay</a>' : ''), 'ok');
      notify('Crewzy: dây chuyền chạy xong', view.xong + ' bước' + (view.cho_duyet ? ', ' + view.cho_duyet + ' việc chờ duyệt' : ''));
    }
    render(); fire({ type: 'end', run: view });
  }

  function step() {
    if (!view || view.het) return finish();
    driving = true;
    ctrl = window.AbortController ? new AbortController() : null;
    api({ action: 'step' }).then(function (r) {
      if ((r.headers.get('content-type') || '').indexOf('ndjson') < 0) return r.json().then(function (j) {
        if (j.run) view = j.run;
        if (j.busy) { now = { job: j.busy.job, ten: j.busy.ten, phong: (view.steps.filter(function (s) { return s.job === j.busy.job; })[0] || {}).phong, label: 'Đang làm (ở tab hoặc máy khác)…' }; window.crewzyRunNow = now; render(); fire({ type: 'tool' }); return setTimeout(step, 12000); }
        return finish();
      });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) return;
          buf += dec.decode(x.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (l) { if (l.trim()) try { handle(JSON.parse(l)); } catch (err) {} });
          return pump();
        });
      }
      return pump().then(function () { if (view && view.het) return finish(); setTimeout(step, 400); });
    }).catch(function () {
      driving = false;
      toast('<b>Mất kết nối giữa chừng.</b><small>Crewzy vẫn làm nốt trên máy chủ, mở lại trang để xem.</small>', 'warn');
      setTimeout(load, 15000);
    });
  }

  function start(nv, opts) {
    opts = opts || {};
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    return api({ action: 'start', nv: nv || undefined, lap: !!opts.lap }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) { if (j.run) { view = j.run; render(); if (!driving) step(); } return j; }
      view = j.run; min = false;
      toast('<b>▶ Bắt đầu chạy ' + view.tong + ' bước</b><small>' + (j.lap && j.lap.bat ? 'Đã bật luôn tự chạy mỗi ngày đúng giờ. ' : '') + 'Theo dõi trên cây và khung bên dưới.</small>', 'ok');
      render(); fire({ type: 'start', run: view });
      if (!driving) step();
      return j;
    });
  }

  function load() {
    var u = window.vpaiUid ? window.vpaiUid() : '';
    fetch('/api/run' + (u ? '?uid=' + encodeURIComponent(u) : ''), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.run) return;
      var fresh = Date.now() - Date.parse(j.run.luc) < 12 * 3600 * 1000;
      if (!fresh) return;
      view = j.run; render();
      if (!view.het && !driving) step();
    }).catch(function () {});
  }

  document.addEventListener('click', function (e) {
    if (!dock || !dock.contains(e.target)) return;
    if (e.target.closest('[data-rd-min]')) { min = !min; render(); }
    else if (e.target.closest('[data-rd-close]')) { view = null; render(); }
    else if (e.target.closest('[data-rd-stop]')) {
      if (!confirm('Dừng dây chuyền? Bước đang làm sẽ dừng ở thao tác kế tiếp, các bước chưa làm được bỏ qua.')) return;
      api({ action: 'dung' }).then(function (r) { return r.json(); }).then(function (j) { if (j.run) view = j.run; now = null; window.crewzyRunNow = null; toast('<b>■ Đã dừng dây chuyền</b>', 'warn'); render(); fire({ type: 'end', run: view }); });
    }
  });

  window.crewzyRun = { start: start, state: function () { return view; }, active: function () { return !!(view && !view.het); } };
  load();
})();
