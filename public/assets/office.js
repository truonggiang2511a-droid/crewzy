// Trang Văn phòng: sơ đồ mạng các phòng ban (SVG) với đường nhánh nối phòng ↔ phòng, hạt sáng chạy theo đường
// như phiếu việc đang được chuyển; vòng ngoài là logo app đã kết nối (lấy thật từ /api/status).
// Số liệu phòng ban và bảng tin vẫn là DỮ LIỆU MẪU cho tới khi nối phiếu việc thật (xem CLAUDE.md mục 6).
(function () {
  var uid = window.vpaiUid();
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  // status: work = đang làm · wait = chờ bạn duyệt · idle = rảnh · done = vừa xong
  var DEPTS = [
    { id: 'product', name: 'Sản phẩm', short: 'Sản phẩm', staff: 'Minh', status: 'wait', task: 'Căn A15 chờ bạn xác minh giá', progress: 100, queue: 2, apps: ['googledrive'] },
    { id: 'research', name: 'Nghiên cứu đối thủ', short: 'Đối thủ', staff: 'Vy', status: 'work', task: 'Soi 12 Reels của 3 đối thủ, học hook 3 giây đầu', progress: 45, queue: 1, apps: [], phong: 'doi_thu' },
    { id: 'image', name: 'Hình ảnh', short: 'Hình ảnh', staff: 'Lan', status: 'work', task: 'Làm bộ ảnh căn A12 (6/10 ảnh)', progress: 60, queue: 1, apps: ['canva'] },
    { id: 'video', name: 'Video', short: 'Video', staff: 'Huy', status: 'work', task: 'Dựng video 30 giây căn A12', progress: 35, queue: 2, apps: ['youtube', 'heygen'] },
    { id: 'content', name: 'Nội dung', short: 'Nội dung', staff: 'Thảo', status: 'wait', task: 'Lịch 7 bài tuần 23–29/11 chờ duyệt', progress: 100, queue: 0, apps: ['facebook', 'instagram'] },
    { id: 'ads', name: 'Quảng cáo', short: 'Quảng cáo', staff: 'Quân', status: 'wait', task: 'Đề xuất tăng ngân sách bài thắng', progress: 100, queue: 1, apps: ['metaads', 'googleads'] },
    { id: 'care', name: 'Chăm sóc khách', short: 'CSKH', staff: 'Ngọc', status: 'work', task: 'Trả lời 4 tin nhắn mới trên Fanpage', progress: 70, queue: 2, apps: ['gmail', 'telegram'] },
    { id: 'sales', name: 'Sale', short: 'Sale', staff: 'Tuấn', status: 'work', task: 'Nhắc gọi 2 khách mới trong 9 phút', progress: 80, queue: 3, apps: ['hubspot', 'googlesheets'] },
    { id: 'report', name: 'Báo cáo', short: 'Báo cáo', staff: 'An', status: 'idle', task: 'Báo cáo ngày lúc 7:30 sáng mai', progress: 0, queue: 0, apps: ['google_analytics'] }
  ];
  // Phòng ở sơ đồ → phòng trong thư viện quy trình (src/lib/workflows.js DEPARTMENTS).
  var ROOM_DEP = { product: 'thuong_hieu', research: 'doi_thu', image: 'noi_dung', video: 'noi_dung', content: 'noi_dung', ads: 'quang_cao', care: 'cham_soc', sales: 'ban_hang', report: 'bao_cao' };
  var CENTER = { id: 'brain', name: 'Ban giám đốc', sub: 'Bộ não AI', staff: 'Trợ lý điều hành' };
  // Dòng việc chuyển giữa các phòng (đường nhánh). Mỗi lần "chuyển phiếu" có hạt sáng chạy theo.
  var FLOWS = [
    ['product', 'image', 'Căn A12 đủ thông tin, bắt đầu làm ảnh'],
    ['research', 'video', 'Sổ tay phong cách video tuần này: 5 mẫu hook đối thủ hiệu quả'],
    ['research', 'ads', '3 góc quảng cáo đối thủ chạy lâu nhất, đề xuất thử A/B'],
    ['image', 'video', 'Bộ ảnh căn A12 đủ để dựng video'],
    ['video', 'content', 'Video 30 giây xong, chuyển viết bài'],
    ['content', 'ads', 'Bài nhiều tương tác nhất đề xuất chạy quảng cáo'],
    ['ads', 'care', 'Quảng cáo về 5 tin nhắn mới'],
    ['care', 'sales', 'Khách mới để lại số, giao sale gọi'],
    ['sales', 'report', 'Chốt 1 đơn, ghi doanh thu'],
    ['report', 'brain', 'Báo cáo ngày gửi Ban giám đốc'],
    ['brain', 'content', 'Giao chủ đề tuần mới cho Nội dung'],
    ['care', 'product', 'Khách hỏi căn góc, cần thêm thông tin'],
    ['brain', 'ads', 'Duyệt trần ngân sách 300.000đ/ngày']
  ];
  var STATUS = {
    work: { label: 'Đang làm', color: '#22C55E' },
    wait: { label: 'Chờ bạn duyệt', color: '#F5A524' },
    idle: { label: 'Rảnh', color: '#7C8597' },
    done: { label: 'Vừa xong', color: '#38BDF8' }
  };

  var graphBox = document.querySelector('[data-graph]');
  var feedEl = document.querySelector('[data-feed]');
  var detailEl = document.querySelector('[data-detail]');
  var connected = {};
  var nodes = {};
  var selected = null;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function deptById(id) { return id === 'brain' ? CENTER : DEPTS.find(function (d) { return d.id === id; }); }

  // Đường cong giữa hai điểm, uốn nhẹ ra ngoài so với tâm để các nhánh không chồng lên nhau.
  function curve(a, b, cx, cy, bend) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = mx - cx, dy = my - cy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = bend == null ? 0.28 : bend;
    var qx = mx + dx / len * (len * k), qy = my + dy / len * (len * k);
    return 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
  }

  function render() {
    var w = graphBox.clientWidth;
    var compact = w < 640;
    var W = compact ? 400 : 860, H = compact ? 470 : 560;
    var cx = W / 2, cy = H / 2 + (compact ? 6 : 0);
    var rx = compact ? 148 : 305, ry = compact ? 168 : 195;
    graphBox.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Sơ đồ các phòng ban và đường chuyển việc giữa các phòng', style: 'width:100%;height:auto;display:block' }, graphBox);
    var defs = el('defs', {}, svg);
    var glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '3', result: 'b' }, glow);
    var merge = el('feMerge', {}, glow);
    el('feMergeNode', { in: 'b' }, merge); el('feMergeNode', { in: 'SourceGraphic' }, merge);
    var grad = el('radialGradient', { id: 'core' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#3D4BFF', 'stop-opacity': '0.55' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#3D4BFF', 'stop-opacity': '0' }, grad);

    // Vòng quỹ đạo mờ
    el('ellipse', { cx: cx, cy: cy, rx: rx, ry: ry, fill: 'none', stroke: 'rgba(148,163,255,0.10)', 'stroke-dasharray': '2 6' }, svg);
    el('ellipse', { cx: cx, cy: cy, rx: rx * 0.55, ry: ry * 0.55, fill: 'none', stroke: 'rgba(148,163,255,0.07)' }, svg);
    el('circle', { cx: cx, cy: cy, r: compact ? 70 : 110, fill: 'url(#core)' }, svg);

    // Toạ độ phòng ban trên elip
    DEPTS.forEach(function (d, i) {
      var ang = -Math.PI / 2 + i * (2 * Math.PI / DEPTS.length);
      nodes[d.id] = { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang), ang: ang, d: d };
    });
    nodes.brain = { x: cx, y: cy, d: CENTER };

    // Nan hoa: tâm → mỗi phòng
    var linkLayer = el('g', {}, svg);
    DEPTS.forEach(function (d) {
      var n = nodes[d.id];
      el('line', { x1: cx, y1: cy, x2: n.x, y2: n.y, stroke: 'rgba(148,163,255,0.14)', 'stroke-width': 1, 'stroke-dasharray': '3 5' }, linkLayer);
    });
    // Đường nhánh giữa các phòng
    FLOWS.forEach(function (f, i) {
      var a = nodes[f[0]], b = nodes[f[1]];
      var bend = (f[0] === 'brain' || f[1] === 'brain') ? 0.08 : (Math.abs(DEPTS.indexOf(deptById(f[0])) - DEPTS.indexOf(deptById(f[1]))) > 1 ? -0.35 : 0.22);
      var p = el('path', { id: 'flow-' + i, d: curve(a, b, cx, cy, bend), fill: 'none', stroke: 'rgba(110,135,255,0.62)', 'stroke-width': 1.8 }, linkLayer);
      p.setAttribute('data-flow', i);
    });

    // Nút phòng ban
    var nodeLayer = el('g', {}, svg);
    DEPTS.forEach(function (d) { drawNode(nodeLayer, nodes[d.id], compact, false); });
    drawNode(nodeLayer, nodes.brain, compact, true);

    // App của từng phòng: huy hiệu logo nhỏ gắn sát nút (sáng = đã kết nối, mờ = chưa)
    var appLayer = el('g', {}, svg);
    DEPTS.forEach(function (d) {
      var n = nodes[d.id];
      var r = compact ? 25 : 32;
      d.apps.slice(0, 2).forEach(function (slug, j) {
        var a = Math.PI / 4 + j * 0.62;
        var bx = n.x + (r + 2) * Math.cos(a), by = n.y + (r + 2) * Math.sin(a);
        var on = connected[slug] > 0;
        var br = compact ? 8 : 10;
        el('circle', { cx: bx, cy: by, r: br + 1.5, fill: on ? '#22D3EE' : '#2A3355' }, appLayer);
        el('circle', { cx: bx, cy: by, r: br, fill: '#FFFFFF', opacity: on ? 1 : 0.7 }, appLayer);
        var img = el('image', { href: 'https://logos.composio.dev/api/' + slug, x: bx - br * 0.72, y: by - br * 0.72, width: br * 1.44, height: br * 1.44, opacity: on ? 1 : 0.45 }, appLayer);
        var tt = el('title', {}, img); tt.textContent = slug + (on ? ' · đã kết nối' : ' · chưa kết nối');
      });
    });

    // Hạt sáng chạy theo các đường đang hoạt động
    if (!reduceMotion) {
      var pLayer = el('g', {}, svg);
      FLOWS.forEach(function (f, i) {
        if (i > 8) return;
        var dot = el('circle', { r: compact ? 3 : 4, fill: '#7DD3FC', filter: 'url(#glow)' }, pLayer);
        var anim = el('animateMotion', { dur: (3.2 + (i % 4) * 0.7) + 's', repeatCount: 'indefinite', begin: (-i * 0.7) + 's', rotate: 'auto' }, dot);
        el('mpath', { href: '#flow-' + i }, anim);
      });
    }
    if (selected) highlight(selected);
  }

  function drawNode(layer, n, compact, isCenter) {
    var d = n.d;
    var st = isCenter ? { color: '#8B9BFF', label: 'Điều phối' } : STATUS[d.status];
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': (d.name) + ': ' + st.label, 'data-node': d.id, style: 'cursor:pointer' }, layer);
    var r = isCenter ? (compact ? 38 : 50) : (compact ? 25 : 32);
    if (!isCenter && d.status === 'work' && !reduceMotion) {
      var pulse = el('circle', { cx: n.x, cy: n.y, r: r, fill: 'none', stroke: st.color, 'stroke-width': 2, opacity: 0.6 }, g);
      el('animate', { attributeName: 'r', values: r + ';' + (r + 12), dur: '1.8s', repeatCount: 'indefinite' }, pulse);
      el('animate', { attributeName: 'opacity', values: '0.6;0', dur: '1.8s', repeatCount: 'indefinite' }, pulse);
    }
    el('circle', { cx: n.x, cy: n.y, r: r + 4, fill: 'none', stroke: st.color, 'stroke-width': isCenter ? 1.5 : 2.5, opacity: isCenter ? 0.6 : 0.95 }, g);
    el('circle', { cx: n.x, cy: n.y, r: r, fill: isCenter ? '#151C3A' : '#111733', stroke: 'rgba(148,163,255,0.35)', 'stroke-width': 1, class: 'onode-core' }, g);
    if (isCenter) {
      var ic = el('path', { d: 'M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z', transform: 'translate(' + n.x + ' ' + (n.y - (compact ? 6 : 8)) + ') scale(' + (compact ? 0.8 : 1) + ')', fill: '#A5B4FF' }, g);
      var t1 = el('text', { x: n.x, y: n.y + (compact ? 16 : 20), 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': compact ? 10 : 13, 'font-weight': 700 }, g); t1.textContent = 'Bộ não AI';
      return ic;
    }
    var initial = el('text', { x: n.x, y: n.y + (compact ? 5 : 6), 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': compact ? 14 : 17, 'font-weight': 700 }, g);
    initial.textContent = d.staff.charAt(0);
    var below = n.y > (graphBox.clientWidth < 640 ? 235 : 280);
    var ly = below ? n.y + r + (compact ? 19 : 22) : n.y - r - (compact ? 9 : 26);
    var name = el('text', { x: n.x, y: ly, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': compact ? 11 : 15, 'font-weight': 600 }, g);
    name.textContent = compact ? d.short : d.name;
    if (!compact) {
      var sub = el('text', { x: n.x, y: ly + 16, 'text-anchor': 'middle', fill: st.color, 'font-size': 12 }, g);
      sub.textContent = st.label + (d.queue ? ' · ' + d.queue + ' việc chờ' : '');
    }
  }

  function highlight(id) {
    document.querySelectorAll('[data-node]').forEach(function (g) {
      var core = g.querySelector('.onode-core');
      if (core) core.setAttribute('stroke', g.getAttribute('data-node') === id ? '#FFFFFF' : 'rgba(148,163,255,0.35)');
      if (core) core.setAttribute('stroke-width', g.getAttribute('data-node') === id ? 2.5 : 1);
    });
    document.querySelectorAll('[data-flow]').forEach(function (p) {
      var f = FLOWS[+p.getAttribute('data-flow')];
      var on = f[0] === id || f[1] === id;
      p.setAttribute('stroke', on ? 'rgba(125,211,252,0.95)' : 'rgba(99,122,255,0.22)');
      p.setAttribute('stroke-width', on ? 2.4 : 1.2);
    });
  }

  function showDetail(id) {
    selected = id;
    highlight(id);
    var d = deptById(id);
    if (id === 'brain') {
      var waiting = DEPTS.filter(function (x) { return x.status === 'wait'; });
      var ais = [['claude', 'claude', 'Claude'], ['chatgpt', 'openai', 'ChatGPT'], ['gemini', 'gemini', 'Gemini'], ['grok', 'grok', 'Grok']];
      detailEl.innerHTML = '<p class="od-kicker">Điều phối toàn văn phòng</p><h3 class="od-title">Bộ não AI</h3>' +
        '<p class="od-text">Nối AI bạn đang dùng làm bộ não. AI đó đọc Brain thương hiệu, làm việc thật trên các app đã kết nối và hỏi bạn trước khi đăng hay gửi.</p>' +
        '<div class="od-ai-grid">' + ais.map(function (a) {
          return '<a class="od-ai" href="ket-noi.html?tab=ai&ai=' + a[0] + '"><img src="https://logos.composio.dev/api/' + a[1] + '" alt=""><span>' + a[2] + '</span></a>';
        }).join('') + '</div>' +
        '<div class="od-actions"><a class="btn btn-primary" href="chat.html">Dùng ngay trong Crewzy</a><a class="btn btn-ghost od-ghost" href="ket-noi.html?tab=ai">Đăng nhập OpenRouter</a></div>' +
        (waiting.length ? '<p class="od-meta" style="margin-top:14px">Đang chờ bạn quyết ' + waiting.length + ' việc:</p><ul class="od-list">' + waiting.map(function (x) { return '<li><span class="od-dot" style="background:#F5A524"></span>' + esc(x.name) + ': ' + esc(x.task) + '</li>'; }).join('') + '</ul>' : '');
      return;
    }
    var st = STATUS[d.status];
    var ins = FLOWS.filter(function (f) { return f[1] === id; }).map(function (f) { return deptById(f[0]).name; });
    var outs = FLOWS.filter(function (f) { return f[0] === id; }).map(function (f) { return deptById(f[1]).name; });
    var apps = d.apps.map(function (s) { var on = connected[s] > 0; return '<a class="od-app" href="ket-noi.html?app=' + s + '" title="' + (on ? 'Đã kết nối' : 'Chưa kết nối') + '"><img src="https://logos.composio.dev/api/' + s + '" alt="" style="' + (on ? '' : 'opacity:.4;filter:grayscale(1)') + '"></a>'; }).join('');
    detailEl.innerHTML = '<p class="od-kicker">Nhân viên AI: ' + esc(d.staff) + '</p><h3 class="od-title">Phòng ' + esc(d.name) + '</h3>' +
      '<p class="od-status" style="color:' + st.color + '"><span class="od-dot" style="background:' + st.color + '"></span>' + st.label + (d.queue ? ' · ' + d.queue + ' việc trong hàng chờ' : '') + '</p>' +
      '<p class="od-text">' + esc(d.task) + '</p>' +
      (d.progress ? '<div class="od-bar"><div style="width:' + d.progress + '%;background:' + st.color + '"></div></div>' : '') +
      '<p class="od-meta">Nhận việc từ: ' + (ins.length ? esc(ins.join(', ')) : '—') + '<br>Chuyển việc cho: ' + (outs.length ? esc(outs.join(', ')) : '—') + '</p>' +
      '<div class="od-apps">' + apps + '</div>' +
      '<div class="od-actions">' + (d.status === 'wait' ? '<a class="btn btn-primary" href="cho-duyet.html">Duyệt ngay</a>' : '<a class="btn btn-primary" href="chat.html?q=' + encodeURIComponent('Giao việc cho Phòng ' + d.name + ': ') + '">Giao việc</a>') +
      '<a class="btn btn-ghost od-ghost" href="quy-trinh.html?phong=' + (ROOM_DEP[d.id] || '') + '">Quy trình của phòng</a></div>';
  }

  graphBox.addEventListener('click', function (e) {
    var g = e.target.closest('[data-node]');
    if (g) showDetail(g.getAttribute('data-node'));
  });
  graphBox.addEventListener('keydown', function (e) {
    var g = e.target.closest && e.target.closest('[data-node]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showDetail(g.getAttribute('data-node')); }
  });

  // ---------- Bảng tin phiếu việc chạy liên tục (dữ liệu mẫu) ----------
  var feedIndex = 0;
  function timeNow() { return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }); }
  function pushFeed(animated) {
    var f = FLOWS[feedIndex % FLOWS.length];
    feedIndex++;
    var a = deptById(f[0]), b = deptById(f[1]);
    var li = document.createElement('li');
    li.className = 'of-item' + (animated ? ' of-new' : '');
    li.innerHTML = '<span class="of-time">' + timeNow() + '</span><div><p class="of-route">' + esc(a.name) + ' <span aria-hidden="true">→</span> ' + esc(b.name) + '</p><p class="of-text">' + esc(f[2]) + '</p></div>';
    feedEl.insertBefore(li, feedEl.firstChild);
    while (feedEl.children.length > 7) feedEl.removeChild(feedEl.lastChild);
    // Nháy sáng đường tương ứng trên sơ đồ
    var idx = (feedIndex - 1) % FLOWS.length;
    var p = document.querySelector('[data-flow="' + idx + '"]');
    if (p && !selected) {
      p.setAttribute('stroke', 'rgba(125,211,252,1)'); p.setAttribute('stroke-width', 2.6);
      setTimeout(function () { if (!selected) { p.setAttribute('stroke', 'rgba(110,135,255,0.62)'); p.setAttribute('stroke-width', 1.8); } }, 1600);
    }
    var done = document.querySelector('[data-kpi-done]');
    if (done && animated) done.textContent = String(+done.textContent + 1);
  }
  for (var i = 0; i < 5; i++) pushFeed(false);
  if (!reduceMotion) setInterval(function () { pushFeed(true); }, 4200);

  // Đồng hồ giờ Việt Nam
  var clock = document.querySelector('[data-clock]');
  function tick() { if (clock) clock.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }); }
  tick(); setInterval(tick, 1000);

  // Số liệu
  var counts = { work: 0, wait: 0, idle: 0 };
  DEPTS.forEach(function (d) { counts[d.status] = (counts[d.status] || 0) + 1; });
  document.querySelector('[data-kpi-work]').textContent = counts.work;
  document.querySelector('[data-kpi-wait]').textContent = counts.wait;

  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
  render();
  showDetail('brain');

  // App đã kết nối (dữ liệu thật)
  fetch('/api/status?uid=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }).then(function (j) {
    connected = (j && j.accounts) || {};
    var n = Object.keys(connected).length;
    document.querySelector('[data-kpi-apps]').textContent = n;
    render();
    if (selected) showDetail(selected);
  }).catch(function () {});
  fetch('/api/brand?uid=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }).then(function (j) {
    var name = j && j.brand && j.brand.name;
    if (name) document.querySelector('[data-company]').textContent = name;
  }).catch(function () {});
})();
