// Trang Văn phòng — MÔ PHỎNG THẬT từ /api/office (phiếu việc, lịch hẹn, app đã nối, máy chủ MCP, AI của khách).
// Máy tính: sơ đồ mạng SVG (Bộ não AI ở tâm, 8 phòng = 8 phòng của thư viện quy trình), hạt sáng CHỈ chạy trên đường có việc thật.
// Điện thoại: lưới ô phòng dễ bấm + khung chi tiết. Bảng tin = lịch sử thật của phiếu việc. Tự cập nhật 20 giây/lần khi đang mở trang.
(function () {
  var uid = window.vpaiUid();
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var POLL_MS = 20000;

  var STATUS = {
    work: { label: 'Đang làm', color: '#22C55E' },
    wait: { label: 'Chờ bạn duyệt', color: '#F5A524' },
    queue: { label: 'Chờ AI nhận việc', color: '#60A5FA' },
    done: { label: 'Vừa xong', color: '#22D3EE' },
    setup: { label: 'Cần nối app', color: '#F87171' },
    idle: { label: 'Rảnh', color: '#7C8597' }
  };
  var SHORT = { thuong_hieu: 'Thương hiệu', doi_thu: 'Đối thủ', noi_dung: 'Nội dung', quang_cao: 'Quảng cáo', ban_hang: 'Bán hàng', cham_soc: 'CSKH', bao_cao: 'Báo cáo', hang_ngay: 'Hằng ngày' };
  var ICON = {
    thuong_hieu: 'M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 15.3 7 18l1.2-5.6L4 8.6 9.6 8z',
    doi_thu: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20',
    noi_dung: 'M4 6h16v12H4zM10 9.5v5l4-2.5z',
    quang_cao: 'M4 10v4h3l6 4V6L7 10zM16.5 9a4 4 0 0 1 0 6',
    ban_hang: 'M4 6h2l2 10h10l2-7H7M10 20h.01M17 20h.01',
    cham_soc: 'M4 5h16v11H9l-5 4zM8 10h8M8 13h5',
    bao_cao: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
    hang_ngay: 'M5 5h14v14H5zM5 9h14M9 3v4M15 3v4'
  };
  // Đường chuyển việc giữa các phòng (luồng chuẩn của doanh nghiệp). Hạt sáng chỉ chạy khi có việc thật ở 2 đầu.
  var EDGES = [
    ['thuong_hieu', 'noi_dung'], ['doi_thu', 'noi_dung'], ['doi_thu', 'quang_cao'], ['noi_dung', 'quang_cao'],
    ['quang_cao', 'cham_soc'], ['cham_soc', 'ban_hang'], ['ban_hang', 'bao_cao'], ['hang_ngay', 'bao_cao'],
    ['bao_cao', 'brain'], ['brain', 'noi_dung'], ['brain', 'cham_soc']
  ];

  var graphBox = document.querySelector('[data-graph]');
  var tilesBox = document.querySelector('[data-tiles]');
  var feedEl = document.querySelector('[data-feed]');
  var detailEl = document.querySelector('[data-detail]');
  var state = null;
  var nodes = {};
  var selected = 'brain';
  var seenEvents = {};
  var firstLoad = true;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function room(id) { return state && state.rooms.filter(function (r) { return r.id === id; })[0]; }
  function isMobile() { return window.innerWidth <= 760; }
  function ago(iso) {
    if (!iso) return '';
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'vừa xong';
    if (s < 3600) return Math.floor(s / 60) + ' phút trước';
    if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
    return Math.floor(s / 86400) + ' ngày trước';
  }
  function hhmm(iso) { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }); }
  function logo(slug, size) { return '<img src="https://logos.composio.dev/api/' + esc(slug) + '" alt="" loading="lazy" style="width:' + size + 'px;height:' + size + 'px;border-radius:5px;background:#fff">'; }
  function edgeActive(e) {
    var a = e[0] === 'brain' ? null : room(e[0]), b = e[1] === 'brain' ? null : room(e[1]);
    var aOn = a ? (a.counts.xong_24h || a.counts.lam || a.counts.duyet) : brainActive();
    var bOn = b ? (b.counts.lam || b.counts.cho || b.counts.duyet || b.counts.xong_24h) : brainActive();
    return !!(aOn && bOn);
  }
  function brainActive() {
    if (!state) return false;
    var ai = state.brain.ai_ngoai;
    return state.kpis.ai_lam > 0 || (ai && Date.now() - Date.parse(ai.luc) < 15 * 60000);
  }

  // ---------- Sơ đồ SVG (máy tính) ----------
  function curve(a, b, cx, cy, bend) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - cx, dy = my - cy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var qx = mx + dx / len * (len * bend), qy = my + dy / len * (len * bend);
    return 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
  }
  function renderGraph() {
    if (!state || isMobile()) { graphBox.innerHTML = ''; return; }
    var W = 860, H = 540, cx = W / 2, cy = H / 2, rx = 300, ry = 190;
    graphBox.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Sơ đồ phòng ban: trạng thái thật của từng phòng', style: 'width:100%;height:auto;display:block' }, graphBox);
    var defs = el('defs', {}, svg);
    var glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '3', result: 'b' }, glow);
    var merge = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, merge); el('feMergeNode', { in: 'SourceGraphic' }, merge);
    var grad = el('radialGradient', { id: 'core' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#3D4BFF', 'stop-opacity': brainActive() ? '0.65' : '0.35' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#3D4BFF', 'stop-opacity': '0' }, grad);
    el('ellipse', { cx: cx, cy: cy, rx: rx, ry: ry, fill: 'none', stroke: 'rgba(148,163,255,0.10)', 'stroke-dasharray': '2 6' }, svg);
    el('circle', { cx: cx, cy: cy, r: 110, fill: 'url(#core)' }, svg);
    state.rooms.forEach(function (r, i) {
      var ang = -Math.PI / 2 + i * (2 * Math.PI / state.rooms.length);
      nodes[r.id] = { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang), r: r };
    });
    nodes.brain = { x: cx, y: cy };
    var links = el('g', {}, svg);
    state.rooms.forEach(function (r) { var n = nodes[r.id]; el('line', { x1: cx, y1: cy, x2: n.x, y2: n.y, stroke: 'rgba(148,163,255,0.10)', 'stroke-dasharray': '3 6' }, links); });
    EDGES.forEach(function (e, i) {
      var on = edgeActive(e);
      var bend = (e[0] === 'brain' || e[1] === 'brain') ? 0.06 : 0.24;
      var p = el('path', { id: 'edge-' + i, d: curve(nodes[e[0]], nodes[e[1]], cx, cy, bend), fill: 'none', stroke: on ? 'rgba(125,170,255,0.75)' : 'rgba(110,135,255,0.18)', 'stroke-width': on ? 2 : 1.2 }, links);
      p.setAttribute('data-edge', i);
      if (on && !reduceMotion) {
        var dot = el('circle', { r: 4, fill: '#7DD3FC', filter: 'url(#glow)' }, svg);
        var anim = el('animateMotion', { dur: (3 + (i % 3) * 0.8) + 's', repeatCount: 'indefinite', begin: (-i * 0.6) + 's' }, dot);
        el('mpath', { href: '#edge-' + i }, anim);
      }
    });
    var layer = el('g', {}, svg);
    state.rooms.forEach(function (r) { drawRoom(layer, nodes[r.id], r); });
    drawBrain(layer, nodes.brain);
    highlight(selected);
  }
  function drawRoom(layer, n, r) {
    var st = STATUS[r.status];
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': r.name + ': ' + st.label, 'data-node': r.id, style: 'cursor:pointer' }, layer);
    var R = 32;
    if (r.status === 'work' && !reduceMotion) {
      var pulse = el('circle', { cx: n.x, cy: n.y, r: R, fill: 'none', stroke: st.color, 'stroke-width': 2, opacity: 0.6 }, g);
      el('animate', { attributeName: 'r', values: R + ';' + (R + 13), dur: '1.8s', repeatCount: 'indefinite' }, pulse);
      el('animate', { attributeName: 'opacity', values: '0.6;0', dur: '1.8s', repeatCount: 'indefinite' }, pulse);
    }
    el('circle', { cx: n.x, cy: n.y, r: R + 4, fill: 'none', stroke: st.color, 'stroke-width': 2.5 }, g);
    el('circle', { cx: n.x, cy: n.y, r: R, fill: '#111733', stroke: 'rgba(148,163,255,0.35)', class: 'onode-core' }, g);
    el('path', { d: ICON[r.id] || ICON.hang_ngay, transform: 'translate(' + (n.x - 12) + ' ' + (n.y - 12) + ')', fill: 'none', stroke: '#E6E9FF', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var badge = r.counts.duyet || r.counts.lam || r.counts.cho;
    if (badge) {
      el('circle', { cx: n.x + 24, cy: n.y - 24, r: 10, fill: st.color }, g);
      var bt = el('text', { x: n.x + 24, y: n.y - 20, 'text-anchor': 'middle', fill: '#0B1020', 'font-size': 11, 'font-weight': 700 }, g); bt.textContent = badge;
    }
    var below = n.y > 270;
    var ly = below ? n.y + R + 22 : n.y - R - 28;
    var name = el('text', { x: n.x, y: ly, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 15, 'font-weight': 600 }, g); name.textContent = r.name;
    var sub = el('text', { x: n.x, y: ly + 16, 'text-anchor': 'middle', fill: st.color, 'font-size': 12 }, g);
    sub.textContent = st.label + (r.status === 'done' ? ' · ' + r.counts.xong_24h + ' việc' : r.status === 'setup' ? '' : '');
    // Logo app đã nối của phòng (tối đa 2)
    r.apps.slice(0, 2).forEach(function (slug, j) {
      var a = Math.PI / 4 + j * 0.62, bx = n.x + (R + 3) * Math.cos(a), by = n.y + (R + 3) * Math.sin(a);
      el('circle', { cx: bx, cy: by, r: 11, fill: '#22D3EE' }, g);
      el('circle', { cx: bx, cy: by, r: 9.5, fill: '#FFFFFF' }, g);
      el('image', { href: 'https://logos.composio.dev/api/' + slug, x: bx - 7, y: by - 7, width: 14, height: 14 }, g);
    });
  }
  function drawBrain(layer, n) {
    var on = brainActive();
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': 'Bộ não AI', 'data-node': 'brain', style: 'cursor:pointer' }, layer);
    if (on && !reduceMotion) {
      var p = el('circle', { cx: n.x, cy: n.y, r: 52, fill: 'none', stroke: '#8B9BFF', 'stroke-width': 2, opacity: 0.5 }, g);
      el('animate', { attributeName: 'r', values: '52;68', dur: '2.4s', repeatCount: 'indefinite' }, p);
      el('animate', { attributeName: 'opacity', values: '0.5;0', dur: '2.4s', repeatCount: 'indefinite' }, p);
    }
    el('circle', { cx: n.x, cy: n.y, r: 54, fill: 'none', stroke: '#8B9BFF', 'stroke-width': 1.5, opacity: 0.6 }, g);
    el('circle', { cx: n.x, cy: n.y, r: 50, fill: '#151C3A', stroke: 'rgba(148,163,255,0.35)', class: 'onode-core' }, g);
    el('path', { d: 'M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z', transform: 'translate(' + n.x + ' ' + (n.y - 10) + ')', fill: on ? '#C7D0FF' : '#7F8BC9' }, g);
    var t = el('text', { x: n.x, y: n.y + 18, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 13, 'font-weight': 700 }, g); t.textContent = 'Bộ não AI';
    var s = el('text', { x: n.x, y: n.y + 33, 'text-anchor': 'middle', fill: on ? '#86EFAC' : '#9AA3C7', 'font-size': 11 }, g); s.textContent = on ? 'hoạt động' : 'chờ việc';
  }
  function highlight(id) {
    document.querySelectorAll('[data-node]').forEach(function (g) {
      var core = g.querySelector('.onode-core');
      if (core) { core.setAttribute('stroke', g.getAttribute('data-node') === id ? '#FFFFFF' : 'rgba(148,163,255,0.35)'); core.setAttribute('stroke-width', g.getAttribute('data-node') === id ? 2.5 : 1); }
    });
    document.querySelectorAll('[data-tile]').forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-tile') === id)); });
  }

  // ---------- Ô phòng (điện thoại) ----------
  function renderTiles() {
    if (!state || !isMobile()) { tilesBox.innerHTML = ''; return; }
    var b = brainActive();
    var html = '<button type="button" class="of-tile of-tile-brain" data-tile="brain" aria-pressed="false"><span class="of-tile-dot" style="background:' + (b ? '#86EFAC' : '#7C8597') + '"></span>' +
      '<b>Bộ não AI</b><small>' + esc(brainLine()) + '</small></button>';
    html += state.rooms.map(function (r) {
      var st = STATUS[r.status];
      var line = r.current ? r.current.tieu_de : r.status === 'setup' ? 'Nối app để bắt đầu' : r.schedules.length ? 'Lịch: ' + r.schedules[0].ten : 'Chưa có việc';
      var n = r.counts.duyet || r.counts.lam || r.counts.cho;
      return '<button type="button" class="of-tile" data-tile="' + r.id + '" aria-pressed="false" style="--st:' + st.color + '">' +
        '<span class="of-tile-dot' + (r.status === 'work' && !reduceMotion ? ' of-pulse' : '') + '"></span>' +
        (n ? '<i class="of-tile-n">' + n + '</i>' : '') +
        '<b>' + esc(SHORT[r.id] || r.name) + '</b><span class="of-tile-st">' + st.label + '</span><small>' + esc(line) + '</small></button>';
    }).join('');
    tilesBox.innerHTML = html;
    highlight(selected);
  }

  function brainLine() {
    var ai = state.brain.ai_ngoai;
    if (ai && Date.now() - Date.parse(ai.luc) < 15 * 60000) return ai.ten + ' đang nối';
    if (state.kpis.ai_lam) return 'Đang làm ' + state.kpis.ai_lam + ' việc';
    if (state.kpis.cho_ai) return state.kpis.cho_ai + ' việc chờ AI nhận';
    if (ai) return ai.ten + ' · ' + ago(ai.luc);
    return state.brain.app_mode ? 'Trợ lý Crewzy sẵn sàng' : 'Chưa nối AI';
  }

  // ---------- Khung chi tiết ----------
  function showDetail(id) {
    selected = id;
    highlight(id);
    if (!state) return;
    if (id === 'brain') { detailEl.innerHTML = brainDetail(); return; }
    var r = room(id); if (!r) return;
    var st = STATUS[r.status];
    var cur = r.current;
    var counts = '<div class="od-counts">' +
      '<span><b>' + r.counts.lam + '</b>đang làm</span><span><b>' + r.counts.cho + '</b>chờ AI</span><span><b>' + r.counts.duyet + '</b>chờ duyệt</span><span><b>' + r.counts.xong_24h + '</b>xong 24h</span></div>';
    var apps = r.apps.length ? '<div class="od-apps">' + r.apps.map(function (s) { return '<a class="od-app" href="ket-noi.html?app=' + s + '" title="Đã nối">' + logo(s, 22) + '</a>'; }).join('') + '</div>' : '';
    var miss = r.suggest.length ? '<p class="od-meta">Nên nối: ' + r.suggest.map(function (s) { return '<a href="ket-noi.html?app=' + s.slug + '">' + esc(s.name) + '</a>'; }).join(', ') + '</p>' : '';
    var sch = r.schedules.length ? '<p class="od-meta">Lịch tự chạy: ' + r.schedules.map(function (s) { return esc(s.ten) + ' (' + (s.lap === 'moi_gio' ? 'mỗi giờ ' + esc(s.gio) + '–' + esc(s.den) : esc(s.gio)) + ')'; }).join('; ') + '</p>' : '';
    var primary = r.status === 'wait' ? '<a class="btn btn-primary" href="cho-duyet.html">Duyệt ' + r.counts.duyet + ' việc</a>'
      : r.status === 'setup' && r.suggest[0] ? '<a class="btn btn-primary" href="ket-noi.html?app=' + r.suggest[0].slug + '">Nối ' + esc(r.suggest[0].name) + ' để bắt đầu</a>'
      : '<a class="btn btn-primary" href="quy-trinh.html?phong=' + r.id + '">Chạy quy trình của phòng</a>';
    detailEl.innerHTML = '<p class="od-kicker">Phòng</p><h3 class="od-title">' + esc(r.name) + '</h3>' +
      '<p class="od-status" style="color:' + st.color + '"><span class="od-dot" style="background:' + st.color + '"></span>' + st.label + '</p>' +
      (cur ? '<a class="od-job" href="cho-duyet.html?id=' + cur.id + '"><b>' + esc(cur.tieu_de) + '</b><small>' + esc(cur.mo_ta) + (cur.nguoi_lam ? ' · ' + esc(cur.nguoi_lam) : '') + ' · ' + ago(cur.luc) + '</small></a>'
        : '<p class="od-text">' + (r.status === 'setup' ? 'Phòng chưa đủ app để chạy quy trình nào.' : 'Chưa có việc. Chạy một quy trình hoặc giao việc để phòng bắt đầu.') + '</p>') +
      counts + '<p class="od-meta">Quy trình sẵn sàng: ' + r.flows.san_sang + '/' + r.flows.tong + '</p>' + sch + apps + miss +
      '<div class="od-actions">' + primary + '<a class="btn btn-ghost od-ghost" href="chat.html?q=' + encodeURIComponent('Giao việc cho phòng ' + r.name + ': ') + '">Giao việc</a></div>';
  }
  function brainDetail() {
    var b = state.brain;
    var ai = b.ai_ngoai;
    var ais = [['claude', 'claude', 'Claude'], ['chatgpt', 'openai', 'ChatGPT'], ['gemini', 'gemini', 'Gemini'], ['grok', 'grok', 'Grok']];
    return '<p class="od-kicker">Điều phối toàn văn phòng</p><h3 class="od-title">Bộ não AI</h3>' +
      '<ul class="od-list">' +
      '<li><span class="od-dot" style="background:' + (b.app_mode ? '#22C55E' : '#7C8597') + '"></span>Trợ lý Crewzy: ' + (b.app_mode ? 'sẵn sàng (dùng credit của app)' : 'chưa bật') + '</li>' +
      '<li><span class="od-dot" style="background:' + (ai ? '#22C55E' : '#7C8597') + '"></span>AI của bạn: ' + (ai ? esc(ai.ten) + ' nối lần cuối ' + ago(ai.luc) : 'chưa nối (dán link Crewzy vào Claude, ChatGPT…)') + '</li>' +
      (b.nguoi_lam_gan_nhat ? '<li><span class="od-dot" style="background:#22D3EE"></span>Làm việc gần nhất: ' + esc(b.nguoi_lam_gan_nhat.ten) + ' · ' + ago(b.nguoi_lam_gan_nhat.luc) + '</li>' : '') +
      '<li><span class="od-dot" style="background:#F5A524"></span>' + state.kpis.cho_duyet + ' việc chờ bạn duyệt · ' + state.kpis.ai_lam + ' đang làm · ' + state.kpis.cho_ai + ' chờ AI nhận</li></ul>' +
      (state.kpis.cho_ai && !state.kpis.ai_lam ? '<p class="od-meta">Việc chờ AI nhận: bảo AI của bạn "làm việc Crewzy", hoặc mở phiếu và bấm Làm ngay bằng Trợ lý Crewzy.</p>' : '') +
      (ai ? '' : '<div class="od-ai-grid">' + ais.map(function (a) { return '<a class="od-ai" href="ket-noi.html?tab=ai&ai=' + a[0] + '"><img src="https://logos.composio.dev/api/' + a[1] + '" alt=""><span>' + a[2] + '</span></a>'; }).join('') + '</div>') +
      '<div class="od-actions"><a class="btn btn-primary" href="chat.html">Giao việc cho Trợ lý</a><a class="btn btn-ghost od-ghost" href="ket-noi.html?tab=ai">' + (ai ? 'Link nối AI' : 'Nối AI của bạn') + '</a></div>';
  }

  // ---------- Bảng tin thật ----------
  function renderFeed() {
    var evs = state.events || [];
    if (!evs.length) {
      feedEl.innerHTML = '<li class="of-empty">Chưa có hoạt động. Khi AI nhận việc, nộp kết quả hay bạn duyệt, mọi việc hiện ở đây theo thời gian thật.</li>';
      return;
    }
    var fresh = [];
    feedEl.innerHTML = evs.slice(0, 10).map(function (e) {
      var k = e.id + '|' + e.luc;
      var isNew = !firstLoad && !seenEvents[k];
      if (isNew) fresh.push(e.phong);
      seenEvents[k] = 1;
      return '<li class="of-item' + (isNew ? ' of-new' : '') + '"><span class="of-time" title="' + esc(new Date(e.luc).toLocaleString('vi-VN')) + '">' + hhmm(e.luc) + '</span><div><p class="of-route">' +
        esc((room(e.phong) || {}).name || '') + '</p><p class="of-text"><a href="cho-duyet.html?id=' + e.id + '">' + esc(e.tieu_de) + '</a> · ' + esc(e.viec) + '</p></div></li>';
    }).join('');
    fresh.forEach(flash);
  }
  function flash(roomId) {
    var g = document.querySelector('[data-node="' + roomId + '"] .onode-core') || document.querySelector('[data-tile="' + roomId + '"]');
    if (!g) return;
    g.classList.add('of-flash');
    setTimeout(function () { g.classList.remove('of-flash'); }, 1800);
  }

  // ---------- Việc nên làm tiếp + số liệu ----------
  function renderTop() {
    var k = state.kpis, s = state.setup;
    Object.keys(k).forEach(function (key) { var n = document.querySelector('[data-kpi="' + key + '"]'); if (n) n.textContent = k[key]; });
    var mcp = document.querySelector('[data-kpi-mcp]'); if (mcp) mcp.textContent = k.mcp ? '+ ' + k.mcp + ' máy chủ MCP' : 'Kết nối thêm';
    if (state.company) {
      document.querySelector('[data-company]').textContent = state.company;
      document.querySelectorAll('[data-brand-sub],[data-brand-sub-m]').forEach(function (x) { x.textContent = state.company; });
    }
    var live = document.querySelector('[data-live-text]');
    var working = state.rooms.filter(function (r) { return r.status === 'work'; }).length;
    live.textContent = k.ai_lam ? 'AI đang làm ' + k.ai_lam + ' việc' + (k.cho_ai ? ' · ' + k.cho_ai + ' chờ nhận' : '')
      : k.cho_ai ? k.cho_ai + ' việc chờ AI nhận' : k.lich_bat ? k.lich_bat + ' lịch tự chạy đang bật' : 'Văn phòng đang rảnh';
    document.querySelector('[data-live]').className = 'pill live-pill ' + (k.ai_lam || working ? 'pill-ok' : k.cho_ai ? 'pill-warn' : '');
    var urgent = document.querySelector('[data-urgent]');
    urgent.hidden = !k.cho_duyet;
    document.querySelector('[data-urgent-n]').textContent = k.cho_duyet;
    var nganh = ''; try { nganh = localStorage.getItem('crewzy.nganh') || ''; } catch (e) {}
    var steps = [
      { done: s.brand.filled >= 4, t: 'Điền Brain thương hiệu', d: 'Sản phẩm, khách hàng, giọng văn, giá. AI đọc trước mọi việc.', href: 'thuong-hieu.html', cta: 'Điền ngay' },
      { done: s.apps >= 3, t: 'Nối 3 app bạn dùng', d: s.apps ? 'Đã nối: ' + s.app_names.slice(0, 4).join(', ') : 'Chọn ngành để biết nên nối app nào trước.', href: 'ket-noi.html' + (nganh ? '?nganh=' + nganh : ''), cta: 'Kết nối' },
      { done: s.ai_linked || s.jobs > 0, t: 'Chọn bộ não AI', d: 'Dùng Trợ lý Crewzy ngay, hoặc dán link vào Claude, ChatGPT của bạn.', href: 'ket-noi.html?tab=ai', cta: 'Nối AI' },
      { done: s.jobs > 0, t: 'Chạy quy trình đầu tiên', d: 'Gợi ý: Trả lời bình luận hoặc Lịch nội dung 7 ngày.', href: 'quy-trinh.html' + (nganh ? '?nganh=' + nganh : ''), cta: 'Chạy' },
      { done: s.schedules > 0, t: 'Hẹn giờ để văn phòng tự chạy', d: 'Ví dụ: trả lời bình luận mỗi giờ, báo cáo sáng thứ Hai.', href: 'quy-trinh.html', cta: 'Hẹn giờ' }
    ];
    var doneN = steps.filter(function (x) { return x.done; }).length;
    var box = document.querySelector('[data-steps]');
    box.hidden = doneN === steps.length;
    document.querySelector('[data-steps-progress]').textContent = doneN + '/' + steps.length;
    document.querySelector('[data-steps-bar]').style.width = Math.round(doneN * 100 / steps.length) + '%';
    var next = steps.filter(function (x) { return !x.done; })[0];
    document.querySelector('[data-steps-list]').innerHTML = steps.map(function (x) {
      return '<li class="' + (x.done ? 'is-done' : x === next ? 'is-next' : '') + '"><span class="of-step-ic" aria-hidden="true">' + (x.done ? '✓' : '') + '</span>' +
        '<div><b>' + x.t + '</b>' + (x.done ? '' : '<small>' + esc(x.d) + '</small>') + '</div>' +
        (x.done ? '' : '<a class="btn ' + (x === next ? 'btn-primary' : 'btn-ghost') + '" href="' + x.href + '">' + x.cta + '</a>') + '</li>';
    }).join('');
  }

  function renderAll() {
    renderTop();
    renderGraph();
    renderTiles();
    renderFeed();
    showDetail(selected);
    firstLoad = false;
  }

  function load() {
    return fetch('/api/office?uid=' + encodeURIComponent(uid)).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      if (!r.ok) throw new Error('Chưa tải được số liệu văn phòng.');
      return r.json();
    }).then(function (d) {
      state = d;
      renderAll();
      if (window.vpaiSetJobBadge) window.vpaiSetJobBadge(d.kpis.cho_duyet || 0);
    }).catch(function (err) {
      if (!state) { document.querySelector('[data-live-text]').textContent = 'Mất kết nối'; feedEl.innerHTML = '<li class="of-empty">' + esc(err.message) + ' Tải lại trang sau ít phút.</li>'; }
    });
  }

  function pick(e) {
    var g = e.target.closest('[data-node],[data-tile]');
    if (!g) return;
    showDetail(g.getAttribute('data-node') || g.getAttribute('data-tile'));
    if (isMobile()) detailEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  graphBox.addEventListener('click', pick);
  tilesBox.addEventListener('click', pick);
  graphBox.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });

  var clock = document.querySelector('[data-clock]');
  function tick() { clock.textContent = new Date().toLocaleString('vi-VN', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }); }
  tick(); setInterval(tick, 30000);

  var lastMobile = isMobile();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (isMobile() !== lastMobile) { lastMobile = isMobile(); renderGraph(); renderTiles(); } else if (!isMobile()) renderGraph(); }, 150); });

  load();
  setInterval(function () { if (!document.hidden) load(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
