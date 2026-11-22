// Trung tâm điều hành (trước là Văn phòng) — Cây vận hành MÔ PHỎNG THẬT từ /api/office (phiếu việc, lịch hẹn, app đã nối, máy chủ MCP, AI của khách).
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

  // ---------- CÂY VẬN HÀNH (máy tính) ----------
  // Rễ = nguồn nuôi (Thương hiệu, Kho & dữ liệu, Nghiên cứu đối thủ) · Thân = Bộ não AI điều phối · Cành = phòng ban (mỗi phòng một màu)
  // · Lá = ứng dụng, mỗi app một nhiệm vụ (vai trò trong quy trình). Đường sáng + hạt chạy CHỈ khi có việc thật (nhựa sống chảy từ rễ lên lá).
  var COLOR = { thuong_hieu: '#A3E635', doi_thu: '#4ADE80', noi_dung: '#F472B6', quang_cao: '#FBBF24', ban_hang: '#FB923C', cham_soc: '#2DD4BF', bao_cao: '#A78BFA', hang_ngay: '#38BDF8', kho: '#FDE68A', brain: '#6D7BFF' };
  var BRANCH = { hang_ngay: [110, 330], noi_dung: [255, 205], quang_cao: [420, 130], cham_soc: [580, 130], ban_hang: [745, 205], bao_cao: [890, 330] };
  var ROOTS = { thuong_hieu: [285, 690], kho: [500, 728], doi_thu: [715, 690] };
  var TRUNK = { x: 500, top: 372, base: 612 };
  function roomBusy(r) { return r && (r.counts.lam || r.counts.cho || r.counts.duyet || r.counts.xong_24h); }
  function cubic(x1, y1, x2, y2, c1x, c1y, c2x, c2y) { return 'M' + x1 + ' ' + y1 + ' C' + c1x + ' ' + c1y + ' ' + c2x + ' ' + c2y + ' ' + x2 + ' ' + y2; }
  var pathN = 0;
  function flowPath(parent, d, color, on, w, dur) {
    var id = 'fp' + (pathN++);
    el('path', { id: id, d: d, fill: 'none', stroke: color, 'stroke-opacity': on ? 0.95 : 0.22, 'stroke-width': on ? w : Math.max(1.2, w * 0.45), 'stroke-linecap': 'round' }, parent);
    if (on && !reduceMotion) {
      for (var k = 0; k < 2; k++) {
        var dot = el('circle', { r: 3.2, fill: '#FFFFFF', filter: 'url(#glow)' }, parent);
        var an = el('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', begin: (-k * dur / 2 - pathN * 0.37) + 's' }, dot);
        el('mpath', { href: '#' + id }, an);
      }
    }
  }
  function leafRing(parent, x, y, leaf, color) {
    var g = el('g', { 'data-leaf': leaf.slug, style: 'cursor:pointer' }, parent);
    el('title', {}, g).textContent = leaf.name + ' · ' + leaf.vai + (leaf.on ? ' (đã nối)' : ' (chưa nối, bấm để nối)');
    el('circle', { cx: x, cy: y, r: 19, fill: '#151515', stroke: color, 'stroke-width': leaf.on ? 2.2 : 1.4, 'stroke-dasharray': leaf.on ? '3 2.2' : '2 4', opacity: leaf.on ? 1 : 0.55 }, g);
    el('circle', { cx: x, cy: y, r: 13, fill: '#FFFFFF', opacity: leaf.on ? 1 : 0.35 }, g);
    var img = el('image', { href: 'https://logos.composio.dev/api/' + leaf.slug, x: x - 9, y: y - 9, width: 18, height: 18 }, g);
    if (!leaf.on) img.setAttribute('opacity', '0.45');
    if (!leaf.on) { el('circle', { cx: x + 13, cy: y - 13, r: 6.5, fill: color }, g); var pt = el('text', { x: x + 13, y: y - 10.3, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#0B0B0B' }, g); pt.textContent = '+'; }
  }
  function renderGraph() {
    if (!state || isMobile()) { graphBox.innerHTML = ''; return; }
    var W = 1000, H = 800;
    pathN = 0; nodes = {};
    graphBox.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Cây vận hành: rễ là thương hiệu và dữ liệu, thân là bộ não AI, cành là phòng ban, lá là ứng dụng', style: 'width:100%;height:auto;display:block' }, graphBox);
    var defs = el('defs', {}, svg);
    var glow = el('filter', { id: 'glow', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs);
    el('feGaussianBlur', { stdDeviation: '2.6', result: 'b' }, glow);
    var mg = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    var tg = el('linearGradient', { id: 'trunkG', x1: '0', y1: '1', x2: '0', y2: '0' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#2A2A2A' }, tg); el('stop', { offset: '55%', 'stop-color': '#2B3270' }, tg); el('stop', { offset: '100%', 'stop-color': '#4652FF' }, tg);
    var halo = el('radialGradient', { id: 'halo' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#4652FF', 'stop-opacity': brainActive() ? 0.45 : 0.22 }, halo); el('stop', { offset: '100%', 'stop-color': '#4652FF', 'stop-opacity': 0 }, halo);

    // Mặt đất + tán lá mờ
    el('ellipse', { cx: 500, cy: 300, rx: 470, ry: 250, fill: 'url(#halo)' }, svg);
    el('line', { x1: 60, y1: TRUNK.base, x2: 940, y2: TRUNK.base, stroke: 'rgba(255,255,255,0.10)', 'stroke-dasharray': '2 7' }, svg);
    var gl = el('text', { x: 66, y: TRUNK.base - 8, fill: '#5C5C5C', 'font-size': 10.5, 'font-family': 'JetBrains Mono, monospace', 'letter-spacing': '1.5' }, svg); gl.textContent = 'MẶT ĐẤT · KHÁCH HÀNG NHÌN THẤY PHẦN TRÊN';

    var flows = el('g', {}, svg), layer = el('g', {}, svg);
    var brainOn = brainActive();
    var anyBusy = state.rooms.some(roomBusy);

    // RỄ → thân
    Object.keys(ROOTS).forEach(function (id, i) {
      var p = ROOTS[id], r = room(id);
      var on = id === 'kho' ? brainOn : !!roomBusy(r) || (brainOn && id === 'thuong_hieu');
      flowPath(flows, cubic(p[0], p[1] - 22, TRUNK.x + (i - 1) * 14, TRUNK.base - 4, p[0], p[1] - 90, TRUNK.x + (i - 1) * 40, TRUNK.base + 40), COLOR[id], on || anyBusy, 5, 2.6);
    });
    // Thân cây
    el('path', { d: 'M' + (TRUNK.x - 30) + ' ' + TRUNK.base + ' C' + (TRUNK.x - 18) + ' 520 ' + (TRUNK.x - 14) + ' 430 ' + (TRUNK.x - 22) + ' ' + TRUNK.top +
      ' L' + (TRUNK.x + 22) + ' ' + TRUNK.top + ' C' + (TRUNK.x + 14) + ' 430 ' + (TRUNK.x + 18) + ' 520 ' + (TRUNK.x + 30) + ' ' + TRUNK.base + ' Z', fill: 'url(#trunkG)', stroke: 'rgba(255,255,255,0.12)' }, flows);
    if (brainOn && !reduceMotion) {
      var sap = el('path', { id: 'sap', d: 'M' + TRUNK.x + ' ' + TRUNK.base + ' L' + TRUNK.x + ' ' + TRUNK.top, stroke: 'none', fill: 'none' }, flows);
      for (var q = 0; q < 3; q++) { var sd = el('circle', { r: 3.5, fill: '#C7CDFF', filter: 'url(#glow)' }, flows); var sa = el('animateMotion', { dur: '2.2s', repeatCount: 'indefinite', begin: (-q * 0.73) + 's' }, sd); el('mpath', { href: '#sap' }, sa); }
    }
    // CÀNH: thân → phòng ban
    Object.keys(BRANCH).forEach(function (id, i) {
      var p = BRANCH[id], r = room(id); if (!r) return;
      var on = !!roomBusy(r);
      var sx = TRUNK.x + (p[0] < 500 ? -8 : 8), sy = TRUNK.top + 18 + Math.abs(p[0] - 500) / 20;
      // Cành đi vào bên hông nút (phía thân cây) để không đè lên tên phòng ở dưới nút.
      var vx = sx - p[0], vy = sy - p[1], vl = Math.sqrt(vx * vx + vy * vy) || 1;
      var ex = p[0] + vx / vl * 34, ey = p[1] + vy / vl * 34;
      if (Math.abs(p[0] - 500) < 120) { ex = p[0] + (p[0] < 500 ? 30 : -30); ey = p[1] + 14; }
      flowPath(flows, cubic(sx, sy, ex, ey, sx + (p[0] - 500) * 0.2, sy - 60, ex + (sx - ex) * 0.35, ey + 20), COLOR[id], on, 7, 2.4);
    });
    // Luồng chuyển việc giữa các phòng (vòng cung mảnh trong tán)
    EDGES.forEach(function (e) {
      if (!BRANCH[e[0]] || !BRANCH[e[1]]) return; // chỉ vẽ luồng giữa các cành (rễ đã nuôi qua thân)
      var a = BRANCH[e[0]], b2 = BRANCH[e[1]];
      var on = edgeActive(e);
      var mx = (a[0] + b2[0]) / 2, my = Math.min(a[1], b2[1]) - 60;
      var id = 'x' + (pathN++);
      el('path', { id: id, d: 'M' + a[0] + ' ' + (a[1] - 30) + ' Q' + mx + ' ' + my + ' ' + b2[0] + ' ' + (b2[1] - 30), fill: 'none', stroke: COLOR[e[1]], 'stroke-opacity': on ? 0.8 : 0.12, 'stroke-width': on ? 1.8 : 1, 'stroke-dasharray': on ? '' : '3 5' }, flows);
      if (on && !reduceMotion) { var dd = el('circle', { r: 2.6, fill: COLOR[e[1]], filter: 'url(#glow)' }, flows); var aa = el('animateMotion', { dur: '3.4s', repeatCount: 'indefinite' }, dd); el('mpath', { href: '#' + id }, aa); }
    });
    // LÁ: phòng ban → ứng dụng
    Object.keys(BRANCH).forEach(function (id) {
      var p = BRANCH[id], r = room(id); if (!r) return;
      var leaves = (r.leaves || []).slice(0, 5);
      var dir = Math.atan2(p[1] - 470, p[0] - 500);
      leaves.forEach(function (lf, j) {
        var spread = (j - (leaves.length - 1) / 2) * 0.52;
        var ang = dir + spread, dist = 78 + (j % 2) * 14;
        var lx = Math.max(24, Math.min(W - 24, p[0] + Math.cos(ang) * dist)), ly = Math.max(24, p[1] + Math.sin(ang) * dist);
        el('line', { x1: p[0], y1: p[1], x2: lx, y2: ly, stroke: COLOR[id], 'stroke-opacity': lf.on ? 0.7 : 0.25, 'stroke-width': lf.on ? 1.6 : 1 }, flows);
        leafRing(layer, lx, ly, lf, COLOR[id]);
      });
    });
    // Rễ con: ứng dụng của Thương hiệu / Đối thủ mọc xuống dưới
    ['thuong_hieu', 'doi_thu'].forEach(function (id) {
      var p = ROOTS[id], r = room(id); if (!r) return;
      (r.leaves || []).slice(0, 3).forEach(function (lf, j) {
        var lx = p[0] + (id === 'thuong_hieu' ? -1 : 1) * (95 + j * 4) * Math.cos(0.5 - j * 0.5), ly = p[1] + 10 + j * 30;
        lx = Math.max(24, Math.min(W - 24, lx + (id === 'thuong_hieu' ? -j * 12 : j * 12)));
        el('path', { d: 'M' + p[0] + ' ' + p[1] + ' Q' + ((p[0] + lx) / 2) + ' ' + (ly + 20) + ' ' + lx + ' ' + ly, fill: 'none', stroke: COLOR[id], 'stroke-opacity': lf.on ? 0.6 : 0.22 }, flows);
        leafRing(layer, lx, ly, lf, COLOR[id]);
      });
    });

    // Nút phòng ban + rễ
    state.rooms.forEach(function (r) {
      var p = BRANCH[r.id] || ROOTS[r.id]; if (!p) return;
      nodes[r.id] = { x: p[0], y: p[1] };
      drawRoom(layer, nodes[r.id], r, !!ROOTS[r.id]);
    });
    drawKho(layer, ROOTS.kho);
    drawBrain(layer, { x: TRUNK.x, y: 470 });
    highlight(selected);
  }
  function drawRoom(layer, n, r, isRoot) {
    var st = STATUS[r.status], col = COLOR[r.id] || '#999';
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': r.name + ': ' + st.label, 'data-node': r.id, style: 'cursor:pointer' }, layer);
    var R = isRoot ? 24 : 28;
    if (r.status === 'work' && !reduceMotion) {
      var pulse = el('circle', { cx: n.x, cy: n.y, r: R, fill: 'none', stroke: col, 'stroke-width': 2, opacity: 0.7 }, g);
      el('animate', { attributeName: 'r', values: R + ';' + (R + 14), dur: '1.8s', repeatCount: 'indefinite' }, pulse);
      el('animate', { attributeName: 'opacity', values: '0.7;0', dur: '1.8s', repeatCount: 'indefinite' }, pulse);
    }
    el('circle', { cx: n.x, cy: n.y, r: R + 5, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-dasharray': '4 2.5' }, g);
    el('circle', { cx: n.x, cy: n.y, r: R, fill: '#181818', stroke: 'rgba(255,255,255,0.22)', class: 'onode-core' }, g);
    el('path', { d: ICON[r.id] || ICON.hang_ngay, transform: 'translate(' + (n.x - 12) + ' ' + (n.y - 12) + ')', fill: 'none', stroke: col, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('circle', { cx: n.x + R * 0.72, cy: n.y + R * 0.72, r: 5.5, fill: st.color, stroke: '#0F0F0F', 'stroke-width': 2 }, g);
    var badge = r.counts.duyet || r.counts.lam || r.counts.cho;
    if (badge) {
      el('circle', { cx: n.x + R * 0.75, cy: n.y - R * 0.75, r: 10, fill: st.color }, g);
      var bt = el('text', { x: n.x + R * 0.75, y: n.y - R * 0.75 + 4, 'text-anchor': 'middle', fill: '#0B1020', 'font-size': 11, 'font-weight': 700 }, g); bt.textContent = badge;
    }
    var ly = isRoot ? n.y + R + 20 : n.y + R + 20;
    var name = el('text', { x: n.x, y: ly, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 13.5, 'font-weight': 600 }, g); name.textContent = SHORT[r.id] || r.name;
    var sub = el('text', { x: n.x, y: ly + 15, 'text-anchor': 'middle', fill: st.color, 'font-size': 11 }, g);
    sub.textContent = st.label + (r.status === 'done' ? ' · ' + r.counts.xong_24h + ' việc' : '');
  }
  function drawKho(layer, p) {
    var g = el('g', { class: 'onode', tabindex: '0', role: 'link', 'aria-label': 'Kho lưu trữ: ảnh, video, tài liệu của bạn', 'data-href': 'kho.html', style: 'cursor:pointer' }, layer);
    el('circle', { cx: p[0], cy: p[1], r: 27, fill: 'none', stroke: COLOR.kho, 'stroke-width': 2, 'stroke-dasharray': '4 2.5' }, g);
    el('circle', { cx: p[0], cy: p[1], r: 22, fill: '#181818', stroke: 'rgba(255,255,255,0.22)' }, g);
    el('path', { d: 'M3 7h18v13H3zM3 7l2-4h14l2 4M9 11h6', transform: 'translate(' + (p[0] - 12) + ' ' + (p[1] - 12) + ')', fill: 'none', stroke: COLOR.kho, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var t = el('text', { x: p[0], y: p[1] + 42, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 13.5, 'font-weight': 600 }, g); t.textContent = 'Kho & dữ liệu';
    var s = el('text', { x: p[0], y: p[1] + 57, 'text-anchor': 'middle', fill: '#8F8F8F', 'font-size': 11 }, g); s.textContent = 'ảnh, video, tài liệu';
  }
  function drawBrain(layer, n) {
    var on = brainActive();
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': 'Bộ não AI điều phối', 'data-node': 'brain', style: 'cursor:pointer' }, layer);
    if (on && !reduceMotion) {
      var p = el('circle', { cx: n.x, cy: n.y, r: 40, fill: 'none', stroke: '#8B95FF', 'stroke-width': 2, opacity: 0.6 }, g);
      el('animate', { attributeName: 'r', values: '40;58', dur: '2.4s', repeatCount: 'indefinite' }, p);
      el('animate', { attributeName: 'opacity', values: '0.6;0', dur: '2.4s', repeatCount: 'indefinite' }, p);
    }
    el('circle', { cx: n.x, cy: n.y, r: 42, fill: 'none', stroke: '#8B95FF', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g);
    el('circle', { cx: n.x, cy: n.y, r: 37, fill: '#141633', stroke: 'rgba(255,255,255,0.25)', class: 'onode-core' }, g);
    el('path', { d: 'M0 -12 L3.5 -3.5 L12 0 L3.5 3.5 L0 12 L-3.5 3.5 L-12 0 L-3.5 -3.5 Z', transform: 'translate(' + n.x + ' ' + (n.y - 9) + ')', fill: on ? '#D4FF4A' : '#9AA0C8' }, g);
    var t = el('text', { x: n.x, y: n.y + 15, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 11.5, 'font-weight': 700 }, g); t.textContent = 'Bộ não AI';
    var s = el('text', { x: n.x, y: n.y + 28, 'text-anchor': 'middle', fill: on ? '#86EFAC' : '#9AA0C8', 'font-size': 9.5 }, g);
    var ai = state.brain.ai_ngoai;
    s.textContent = on ? 'đang điều phối' : ai ? ai.ten.slice(0, 16) : state.brain.app_mode ? 'Trợ lý Crewzy' : 'chờ nối AI';
  }
  function highlight(id) {
    document.querySelectorAll('[data-node]').forEach(function (g) {
      var core = g.querySelector('.onode-core');
      if (core) { core.setAttribute('stroke', g.getAttribute('data-node') === id ? '#FFFFFF' : 'rgba(255,255,255,0.22)'); core.setAttribute('stroke-width', g.getAttribute('data-node') === id ? 2.5 : 1); }
    });
    document.querySelectorAll('[data-tile]').forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-tile') === id)); });
  }

  // ---------- Ô phòng (điện thoại) ----------
  function renderTiles() {
    if (!state || !isMobile()) { tilesBox.innerHTML = ''; return; }
    var b = brainActive();
    var html = '<button type="button" class="of-tile of-tile-brain" data-tile="brain" aria-pressed="false"><span class="of-tile-dot" style="background:' + (b ? '#4ADE80' : '#7C8597') + '"></span>' +
      '<b>Bộ não AI</b><small>' + esc(brainLine()) + '</small></button>';
    html += state.rooms.map(function (r) {
      var st = STATUS[r.status];
      var line = r.current ? r.current.tieu_de : r.status === 'setup' ? 'Nối app để bắt đầu' : r.schedules.length ? 'Lịch: ' + r.schedules[0].ten : 'Chưa có việc';
      var n = r.counts.duyet || r.counts.lam || r.counts.cho;
      return '<button type="button" class="of-tile" data-tile="' + r.id + '" aria-pressed="false" style="--st:' + st.color + ';border-left:3px solid ' + (COLOR[r.id] || '#333') + '">' +
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
    var apps = (r.leaves || []).length ? '<p class="od-meta" style="margin-bottom:4px">Ứng dụng của phòng · mỗi app một nhiệm vụ</p><ul class="od-leaves">' + r.leaves.map(function (l) {
      return '<li><a href="ket-noi.html?app=' + esc(l.slug) + '"' + (l.on ? '' : ' class="off"') + '>' + logo(l.slug, 20) + '<span><b>' + esc(l.name) + '</b><small>' + esc(l.vai) + (l.on ? '' : ' · chưa nối') + '</small></span></a></li>'; }).join('') + '</ul>' : '';
    var miss = r.suggest.length ? '<p class="od-meta">Nên nối: ' + r.suggest.map(function (s) { return '<a href="ket-noi.html?app=' + s.slug + '">' + esc(s.name) + '</a>'; }).join(', ') + '</p>' : '';
    var sch = r.schedules.length ? '<p class="od-meta">Lịch tự chạy: ' + r.schedules.map(function (s) { return esc(s.ten) + ' (' + (s.lap === 'moi_gio' ? 'mỗi giờ ' + esc(s.gio) + '–' + esc(s.den) : esc(s.gio)) + ')'; }).join('; ') + '</p>' : '';
    var primary = r.status === 'wait' ? '<a class="btn btn-primary" href="cho-duyet.html">Duyệt ' + r.counts.duyet + ' việc</a>'
      : r.status === 'setup' && r.suggest[0] ? '<a class="btn btn-primary" href="ket-noi.html?app=' + r.suggest[0].slug + '">Nối ' + esc(r.suggest[0].name) + ' để bắt đầu</a>'
      : '<a class="btn btn-primary" href="quy-trinh.html?phong=' + r.id + '">Chạy quy trình của phòng</a>';
    detailEl.innerHTML = '<p class="od-kicker" style="color:' + (COLOR[r.id] || '#8F8F8F') + '">' + (r.id === 'thuong_hieu' || r.id === 'doi_thu' ? 'Rễ · nguồn nuôi' : 'Cành · phòng ban') + '</p><h3 class="od-title">' + esc(r.name) + '</h3>' +
      '<p class="od-status" style="color:' + st.color + '"><span class="od-dot" style="background:' + st.color + '"></span>' + st.label + '</p>' +
      (cur ? '<a class="od-job" href="cho-duyet.html?id=' + cur.id + '"><b>' + esc(cur.tieu_de) + '</b><small>' + esc(cur.mo_ta) + (cur.nguoi_lam ? ' · ' + esc(cur.nguoi_lam) : '') + ' · ' + ago(cur.luc) + '</small></a>'
        : '<p class="od-text">' + (r.status === 'setup' ? 'Phòng chưa đủ app để chạy quy trình nào.' : 'Chưa có việc. Chạy một quy trình hoặc giao việc để phòng bắt đầu.') + '</p>') +
      counts + '<p class="od-meta">Quy trình sẵn sàng: ' + r.flows.san_sang + '/' + r.flows.tong + '</p>' + sch + apps + miss +
      '<div class="od-actions">' + primary + '<a class="btn btn-ghost od-ghost" href="chat.html?q=' + encodeURIComponent('Giao việc cho phòng ' + r.name + ': ') + '">Giao việc</a></div>';
  }
  function savedLink() { try { var l = localStorage.getItem('vpai.aiLink') || ''; return /\/mcp\/aHR0c/.test(l) ? '' : l; } catch (e) { return ''; } }
  function brainDetail() {
    var b = state.brain;
    var ai = b.ai_ngoai;
    var ais = [['claude', 'claude', 'Claude'], ['chatgpt', 'openai', 'ChatGPT'], ['gemini', 'gemini', 'Gemini'], ['grok', 'grok', 'Grok']];
    return '<p class="od-kicker">Thân cây · điều phối mọi phòng ban</p><h3 class="od-title">Bộ não AI</h3>' +
      '<ul class="od-list">' +
      '<li><span class="od-dot" style="background:' + (b.app_mode ? '#22C55E' : '#7C8597') + '"></span>Trợ lý Crewzy: ' + (b.app_mode ? 'sẵn sàng (dùng credit của app)' : 'chưa bật') + '</li>' +
      '<li><span class="od-dot" style="background:' + (ai ? '#22C55E' : '#7C8597') + '"></span>AI của bạn: ' + (ai ? esc(ai.ten) + ' nối lần cuối ' + ago(ai.luc) : 'chưa nối (dán link Crewzy vào Claude, ChatGPT…)') + '</li>' +
      (b.nguoi_lam_gan_nhat ? '<li><span class="od-dot" style="background:#22D3EE"></span>Làm việc gần nhất: ' + esc(b.nguoi_lam_gan_nhat.ten) + ' · ' + ago(b.nguoi_lam_gan_nhat.luc) + '</li>' : '') +
      '<li><span class="od-dot" style="background:#F5A524"></span>' + state.kpis.cho_duyet + ' việc chờ bạn duyệt · ' + state.kpis.ai_lam + ' đang làm · ' + state.kpis.cho_ai + ' chờ AI nhận</li></ul>' +
      (state.kpis.cho_ai && !state.kpis.ai_lam ? '<p class="od-meta">Việc chờ AI nhận: bảo AI của bạn "làm việc Crewzy", hoặc mở phiếu và bấm Làm ngay bằng Trợ lý Crewzy.</p>' : '') +
      (ai ? '' : '<div class="od-ai-grid">' + ais.map(function (a) {
        // Đã có link Crewzy: bấm Claude là mở thẳng màn thêm connector (điền sẵn); còn lại sang tab Cài 1 lần bấm.
        var href = a[0] === 'claude' && savedLink() ? 'https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Crewzy&connectorUrl=' + encodeURIComponent(savedLink()) : 'ket-noi.html?tab=ai#cai-dat';
        return '<a class="od-ai" href="' + href + '"><img src="https://logos.composio.dev/api/' + a[1] + '" alt=""><span>' + a[2] + '</span></a>'; }).join('') + '</div>') +
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
      : k.cho_ai ? k.cho_ai + ' việc chờ AI nhận' : k.lich_bat ? k.lich_bat + ' lịch tự chạy đang bật' : 'Đội AI đang rảnh';
    document.querySelector('[data-live]').className = 'pill live-pill ' + (k.ai_lam || working ? 'pill-ok' : k.cho_ai ? 'pill-warn' : '');
    var urgent = document.querySelector('[data-urgent]');
    urgent.hidden = !k.cho_duyet;
    document.querySelector('[data-urgent-n]').textContent = k.cho_duyet;
    var nganh = ''; try { nganh = localStorage.getItem('crewzy.nganh') || ''; } catch (e) {}
    var steps = [
      { done: s.brand.filled >= 4, t: 'Điền Brain thương hiệu', d: 'Sản phẩm, khách hàng, giọng văn, giá. AI đọc trước mọi việc.', href: 'thuong-hieu.html', cta: 'Điền ngay' },
      { done: s.apps >= 3, t: 'Nối 3 app bạn dùng', d: s.apps ? 'Đã nối: ' + s.app_names.slice(0, 4).join(', ') : 'Chọn ngành để biết nên nối app nào trước.', href: 'ket-noi.html' + (nganh ? '?nganh=' + nganh : ''), cta: 'Kết nối' },
      { done: s.ai_linked || s.jobs > 0, t: 'Chọn bộ não AI', d: 'Cài Crewzy vào Claude, ChatGPT… bằng 1 lần bấm, hoặc dùng Trợ lý Crewzy ngay.', href: 'ket-noi.html?tab=ai#cai-dat', cta: 'Cài vào AI' },
      { done: s.jobs > 0, t: 'Chạy quy trình đầu tiên', d: 'Gợi ý: Trả lời bình luận hoặc Lịch nội dung 7 ngày.', href: 'quy-trinh.html' + (nganh ? '?nganh=' + nganh : ''), cta: 'Chạy' },
      { done: s.schedules > 0, t: 'Hẹn giờ để đội AI tự chạy', d: 'Ví dụ: trả lời bình luận mỗi giờ, báo cáo sáng thứ Hai.', href: 'quy-trinh.html', cta: 'Hẹn giờ' }
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
      if (!r.ok) throw new Error('Chưa tải được số liệu.');
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
    var lf = e.target.closest('[data-leaf]');
    if (lf) { location.href = 'ket-noi.html?app=' + encodeURIComponent(lf.getAttribute('data-leaf')); return; }
    var lk = e.target.closest('[data-href]');
    if (lk) { location.href = lk.getAttribute('data-href'); return; }
    var g = e.target.closest('[data-node],[data-tile]');
    if (!g) return;
    showDetail(g.getAttribute('data-node') || g.getAttribute('data-tile'));
    if (isMobile()) detailEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  graphBox.addEventListener('click', pick);
  tilesBox.addEventListener('click', pick);
  graphBox.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
  graphBox.addEventListener('mouseover', function (e) { var lf = e.target.closest('[data-leaf]'); graphBox.style.cursor = lf ? 'pointer' : ''; });

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
