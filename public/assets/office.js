// Trung tâm điều hành (trước là Văn phòng) — Cây vận hành MÔ PHỎNG THẬT từ /api/office (phiếu việc, lịch hẹn, app đã nối, máy chủ MCP, AI của khách).
// Máy tính: Cây vận hành SVG (rễ Thương hiệu + Kho, thân Bộ não AI, 8 nhánh = phòng của thư viện quy trình), hạt sáng CHỈ chạy trên đường có việc thật.
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
  var SHORT = { thuong_hieu: 'Thương hiệu', doi_thu: 'Phân tích đối thủ', chien_luoc: 'Nghiên cứu & Chiến lược', noi_dung: 'Nội dung & Video', phan_phoi: 'Sản xuất & Phân phối', quang_cao: 'Marketing & Phân tích', ban_hang: 'Bán hàng', cham_soc: 'CSKH', bao_cao: 'Báo cáo', hang_ngay: 'Hằng ngày' };
  var ICON = {
    thuong_hieu: 'M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 15.3 7 18l1.2-5.6L4 8.6 9.6 8z',
    doi_thu: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20',
    chien_luoc: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11v2M12 12l7-7',
    noi_dung: 'M4 6h16v12H4zM10 9.5v5l4-2.5z',
    phan_phoi: 'M21 3 3 10.5l7 2.5 2.5 7.5zM10 13l11-10',
    quang_cao: 'M4 19h16M6 16l4-5 3 3 5-7M15 7h3v3',
    ban_hang: 'M4 6h2l2 10h10l2-7H7M10 20h.01M17 20h.01',
    cham_soc: 'M4 5h16v11H9l-5 4zM8 10h8M8 13h5',
    bao_cao: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
    hang_ngay: 'M5 5h14v14H5zM5 9h14M9 3v4M15 3v4'
  };
  // Đường chuyển việc giữa các phòng (luồng chuẩn của doanh nghiệp). Hạt sáng chỉ chạy khi có việc thật ở 2 đầu.
  // Dây chuyền tự động (khớp CHAIN trong src/lib/autopilot.js): [từ phòng, tới phòng, quy trình]. Bật chạy tự động → dây hiện "đã nối";
  // có việc thật ở 2 đầu → dây sáng + hạt chạy.
  var EDGES = [
    ['doi_thu', 'chien_luoc', 'doi_thu_reels'], ['chien_luoc', 'noi_dung', 'lich_noi_dung_tuan'], ['noi_dung', 'phan_phoi', 'dang_bai_da_duyet'],
    ['phan_phoi', 'cham_soc', 'tra_loi_binh_luan'], ['cham_soc', 'ban_hang', 'tra_loi_binh_luan'], ['quang_cao', 'ban_hang', 'lead_vao_crm'],
    ['ban_hang', 'hang_ngay', 'nhac_cham_soc_deal'], ['ban_hang', 'bao_cao', 'bao_cao_tuan'], ['bao_cao', 'hang_ngay', 'ban_tin_sang'], ['bao_cao', 'chien_luoc', 'de_xuat_chien_luoc']
  ];
  var DAY_TXT = { hang_ngay: 'Mỗi ngày', t2_t6: 'Thứ Hai – Sáu', t2: 'Thứ Hai', cn: 'Chủ nhật', ngay_1: 'Ngày 1 hằng tháng', t3: 'Thứ Ba', t4: 'Thứ Tư', t5: 'Thứ Năm', t6: 'Thứ Sáu', t7: 'Thứ Bảy' };

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

  // ---------- CÂY VẬN HÀNH (máy tính + điện thoại) ----------
  // Rễ = nguồn nuôi (Thương hiệu, Phân tích đối thủ, Kho & dữ liệu) · Thân = Bộ não AI điều phối · 8 nhánh = phòng ban (mỗi phòng một màu)
  // · Lá = ứng dụng, mỗi app một nhiệm vụ. Bình thường cây tối dịu; phòng có việc THẬT thì cả nhánh, lá đã nối và luồng tới thân sáng lên + hạt chạy.
  var COLOR = { thuong_hieu: '#A3E635', doi_thu: '#4ADE80', chien_luoc: '#34D399', noi_dung: '#F472B6', phan_phoi: '#E879F9', quang_cao: '#FBBF24', ban_hang: '#FB923C', cham_soc: '#2DD4BF', bao_cao: '#A78BFA', hang_ngay: '#38BDF8', kho: '#FDE68A', brain: '#6D7BFF' };
  var MSHORT = { thuong_hieu: 'Thương hiệu', doi_thu: 'Đối thủ', chien_luoc: 'Chiến lược', noi_dung: 'Nội dung', phan_phoi: 'Phân phối', quang_cao: 'Marketing', ban_hang: 'Bán hàng', cham_soc: 'CSKH', bao_cao: 'Báo cáo', hang_ngay: 'Hằng ngày' };
  // Bố cục: node [x, y, hướng lá (độ, bỏ trống = toả ra xa thân), nhãn ở trên?]
  var LAYOUT = {
    desk: { W: 1000, H: 830, R: 28, RR: 24, BR: 38, leafR: 19, logo: 18, dist: 80, alt: 14, maxLeaf: 7, font: 13.5, sub: 11, names: SHORT,
      trunk: { x: 500, top: 360, base: 600, w: 30 }, brain: [500, 455], ground: 'MẶT ĐẤT',
      branch: { hang_ngay: [110, 320], noi_dung: [255, 195], quang_cao: [420, 120], cham_soc: [580, 120], ban_hang: [745, 195], bao_cao: [890, 320], phan_phoi: [150, 500, 122, 1], chien_luoc: [850, 500, 58, 1] },
      roots: { thuong_hieu: [235, 690, [150, 185, 215]], doi_thu: [500, 705, [28, 62, 90, 118, 152]], kho: [765, 690] } },
    mob: { W: 400, H: 640, R: 17, RR: 15, BR: 27, leafR: 10.5, logo: 11, dist: 40, alt: 7, maxLeaf: 3, font: 10.5, sub: 8.5, names: MSHORT,
      trunk: { x: 200, top: 268, base: 470, w: 16 }, brain: [200, 335], ground: '',
      branch: { hang_ngay: [44, 262, -112], noi_dung: [96, 158], quang_cao: [162, 86], cham_soc: [238, 86], ban_hang: [304, 158], bao_cao: [356, 262, -68], phan_phoi: [60, 405, 112, 1], chien_luoc: [340, 405, 68, 1] },
      roots: { thuong_hieu: [84, 556, [158, 202]], doi_thu: [200, 584, [12, 168]], kho: [316, 560] } }
  };
  var L = LAYOUT.desk;
  function roomBusy(r) { return r && (r.counts.lam || r.counts.cho || r.counts.duyet || r.counts.xong_24h); }
  function cubic(x1, y1, x2, y2, c1x, c1y, c2x, c2y) { return 'M' + x1 + ' ' + y1 + ' C' + c1x + ' ' + c1y + ' ' + c2x + ' ' + c2y + ' ' + x2 + ' ' + y2; }
  var pathN = 0;
  var defsEl = null;
  function grad(c1, c2, x1, y1, x2, y2) {
    var id = 'g' + (pathN++);
    var g = el('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: x1, y1: y1, x2: x2, y2: y2 }, defsEl);
    el('stop', { offset: '0%', 'stop-color': c1 }, g); el('stop', { offset: '100%', 'stop-color': c2 }, g);
    return 'url(#' + id + ')';
  }
  // Một luồng: tắt = mảnh, mờ. Bật = quầng sáng + lõi gradient + vạch chảy + hạt sáng chạy dọc.
  function flowPath(parent, d, color, on, w, dur, from) {
    var id = 'fp' + (pathN++);
    var stroke = from ? grad(from[2], color, from[0], from[1], from[3], from[4]) : color;
    if (on) el('path', { d: d, fill: 'none', stroke: color, 'stroke-opacity': 0.28, 'stroke-width': w * 2.6, 'stroke-linecap': 'round', filter: 'url(#soft)' }, parent);
    el('path', { id: id, d: d, fill: 'none', stroke: stroke, 'stroke-opacity': on ? 1 : 0.2, 'stroke-width': on ? w : Math.max(1.1, w * 0.42), 'stroke-linecap': 'round' }, parent);
    if (on && !reduceMotion) {
      var dash = el('path', { d: d, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.55, 'stroke-width': Math.max(1, w * 0.32), 'stroke-linecap': 'round', 'stroke-dasharray': '1.5 16' }, parent);
      el('animate', { attributeName: 'stroke-dashoffset', from: '0', to: '-35', dur: '1.1s', repeatCount: 'indefinite' }, dash);
      for (var k = 0; k < 2; k++) {
        var dot = el('circle', { r: Math.max(2.2, w * 0.45), fill: '#FFFFFF', filter: 'url(#glow)' }, parent);
        var an = el('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', begin: (-k * dur / 2 - pathN * 0.37) + 's' }, dot);
        el('mpath', { href: '#' + id }, an);
      }
    }
  }
  function leafRing(parent, x, y, leaf, color, lit) {
    var r = L.leafR;
    if (leaf.plus) { // nút + : nối thêm app vào nhánh, Crewzy tự mọc thêm lá
      var pg = el('g', { 'data-href': 'ket-noi.html' + (leaf.cat ? '?cat=' + leaf.cat : ''), class: 'oleaf', role: 'link', 'aria-label': 'Nối thêm ứng dụng', style: 'cursor:pointer' }, parent);
      el('title', {}, pg).textContent = 'Nối thêm ứng dụng vào nhánh này';
      el('circle', { cx: x, cy: y, r: r * 0.82, fill: '#111', stroke: color, 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, pg);
      var tp = el('text', { x: x, y: y + r * 0.38, 'text-anchor': 'middle', 'font-size': r * 1.15, 'font-weight': 600, fill: color }, pg); tp.textContent = '+';
      return;
    }
    var g = el('g', { 'data-leaf': leaf.slug, class: 'oleaf', style: 'cursor:pointer' }, parent);
    el('title', {}, g).textContent = leaf.name + ' · ' + leaf.vai + (leaf.on ? ' (đã nối)' : ' (chưa nối, bấm để nối)');
    if (lit && leaf.on) {
      var gl = el('circle', { cx: x, cy: y, r: r + 4, fill: color, opacity: 0.35, filter: 'url(#soft)' }, g);
      if (!reduceMotion) el('animate', { attributeName: 'opacity', values: '0.15;0.5;0.15', dur: '2s', repeatCount: 'indefinite' }, gl);
    }
    el('circle', { cx: x, cy: y, r: r, fill: '#141414', stroke: color, 'stroke-width': leaf.on ? 2 : 1.2, 'stroke-dasharray': leaf.on ? '' : '2 3.5', opacity: leaf.on ? 1 : 0.55 }, g);
    el('circle', { cx: x, cy: y, r: r * 0.7, fill: '#FFFFFF', opacity: leaf.on ? 1 : 0.3 }, g);
    var img = el('image', { href: 'https://logos.composio.dev/api/' + leaf.slug, x: x - L.logo / 2, y: y - L.logo / 2, width: L.logo, height: L.logo }, g);
    if (!leaf.on) {
      img.setAttribute('opacity', '0.45');
      var br = r * 0.36;
      el('circle', { cx: x + r * 0.7, cy: y - r * 0.7, r: br, fill: color }, g);
      var pt = el('text', { x: x + r * 0.7, y: y - r * 0.7 + br * 0.42, 'text-anchor': 'middle', 'font-size': br * 1.5, 'font-weight': 700, fill: '#0B0B0B' }, g); pt.textContent = '+';
    }
  }
  function label(g, x, y, text, size, color, weight) {
    var w = text.length * size * 0.56 + 10;
    el('rect', { x: x - w / 2, y: y - size * 0.95, width: w, height: size * 1.35, rx: size * 0.5, fill: 'rgba(10,10,10,0.72)' }, g);
    var t = el('text', { x: x, y: y, 'text-anchor': 'middle', fill: color, 'font-size': size, 'font-weight': weight || 600 }, g); t.textContent = text;
  }
  function leafSpots(p, n, angles, dir, mult) {
    var out = [];
    var step = n > 5 ? 0.4 : n > 3 ? 0.52 : 0.62;
    for (var j = 0; j < n; j++) {
      var ang = angles ? angles[j] * Math.PI / 180 : dir + (j - (n - 1) / 2) * step;
      var dist = L.dist * (mult || 1) + (angles ? (j % 2) * L.alt * 0.6 : (j % 2) * L.alt);
      out.push([Math.max(L.leafR + 4, Math.min(L.W - L.leafR - 4, p[0] + Math.cos(ang) * dist)), Math.max(L.leafR + 4, p[1] + Math.sin(ang) * dist)]);
    }
    return out;
  }
  function renderGraph() {
    if (!state) { graphBox.innerHTML = ''; return; }
    L = isMobile() ? LAYOUT.mob : LAYOUT.desk;
    var W = L.W, H = L.H, T = L.trunk, B = L.brain;
    pathN = 0; nodes = {};
    graphBox.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Cây vận hành: rễ là thương hiệu, đối thủ và dữ liệu, thân là bộ não AI, nhánh là phòng ban, lá là ứng dụng', style: 'width:100%;height:auto;display:block' }, graphBox);
    defsEl = el('defs', {}, svg);
    var glow = el('filter', { id: 'glow', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defsEl);
    el('feGaussianBlur', { stdDeviation: '2.6', result: 'b' }, glow);
    var mg = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    var soft = el('filter', { id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defsEl); el('feGaussianBlur', { stdDeviation: isMobile() ? 2.5 : 4 }, soft);
    var tg = el('linearGradient', { id: 'trunkG', x1: '0', y1: '1', x2: '0', y2: '0' }, defsEl);
    el('stop', { offset: '0%', 'stop-color': '#3A2E22' }, tg); el('stop', { offset: '45%', 'stop-color': '#2B3270' }, tg); el('stop', { offset: '100%', 'stop-color': '#4652FF' }, tg);
    var brainOn = brainActive();
    var anyBusy = state.rooms.some(roomBusy);
    var halo = el('radialGradient', { id: 'halo' }, defsEl);
    el('stop', { offset: '0%', 'stop-color': '#4652FF', 'stop-opacity': brainOn || anyBusy ? 0.42 : 0.2 }, halo); el('stop', { offset: '100%', 'stop-color': '#4652FF', 'stop-opacity': 0 }, halo);
    var soil = el('linearGradient', { id: 'soil', x1: '0', y1: '0', x2: '0', y2: '1' }, defsEl);
    el('stop', { offset: '0%', 'stop-color': '#2A2118', 'stop-opacity': 0.55 }, soil); el('stop', { offset: '100%', 'stop-color': '#0F0F0F', 'stop-opacity': 0 }, soil);

    // Nền: tán sáng, sao lấp lánh, đất dưới mặt đất
    var canopy = el('ellipse', { cx: W / 2, cy: T.top - H * 0.08, rx: W * 0.48, ry: H * 0.33, fill: 'url(#halo)' }, svg);
    if ((brainOn || anyBusy) && !reduceMotion) el('animate', { attributeName: 'opacity', values: '0.75;1;0.75', dur: '4s', repeatCount: 'indefinite' }, canopy);
    for (var si = 0; si < 26; si++) {
      var sx0 = (si * 137.5 % W), sy0 = (si * 71.3 % (T.base - 40)) + 10;
      var star = el('circle', { cx: sx0, cy: sy0, r: si % 3 ? 0.9 : 1.4, fill: '#FFFFFF', opacity: 0.18 }, svg);
      if (!reduceMotion && si % 4 === 0) el('animate', { attributeName: 'opacity', values: '0.05;0.4;0.05', dur: (3 + si % 5) + 's', repeatCount: 'indefinite' }, star);
    }
    el('rect', { x: 0, y: T.base, width: W, height: H - T.base, fill: 'url(#soil)' }, svg);
    el('line', { x1: W * 0.04, y1: T.base, x2: W * 0.96, y2: T.base, stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '2 7' }, svg);
    if (L.ground) { var gt = el('text', { x: W * 0.22, y: T.base - 8, fill: '#5C5C5C', 'font-size': 10.5, 'font-family': 'JetBrains Mono, monospace', 'letter-spacing': '1.5' }, svg); gt.textContent = L.ground; }

    var flows = el('g', {}, svg), layer = el('g', {}, svg);

    // RỄ → gốc thân (nhựa chảy lên khi rễ hoặc cả cây có việc)
    Object.keys(L.roots).forEach(function (id) {
      var p = L.roots[id], r = room(id);
      var on = id === 'kho' ? (brainOn || anyBusy) : !!roomBusy(r) || ((brainOn || anyBusy) && id === 'thuong_hieu');
      var side = p[0] < T.x - 5 ? -1 : p[0] > T.x + 5 ? 1 : 0;
      var top = p[1] - L.RR - 4;
      flowPath(flows, cubic(p[0], top, T.x + side * T.w * 0.45, T.base - 4, p[0], top - (T.base > 500 ? 60 : 34), T.x + side * T.w * 1.3, T.base + (T.base > 500 ? 40 : 24)), COLOR[id], on, isMobile() ? 3 : 5, 2.6, [T.x, T.base, '#3A2E22', p[0], p[1]]);
    });
    // Thân cây có vân
    var tw = T.w;
    el('path', { d: 'M' + (T.x - tw) + ' ' + T.base + ' C' + (T.x - tw * 0.6) + ' ' + (T.base - (T.base - T.top) * 0.35) + ' ' + (T.x - tw * 0.45) + ' ' + (T.top + (T.base - T.top) * 0.3) + ' ' + (T.x - tw * 0.72) + ' ' + T.top +
      ' L' + (T.x + tw * 0.72) + ' ' + T.top + ' C' + (T.x + tw * 0.45) + ' ' + (T.top + (T.base - T.top) * 0.3) + ' ' + (T.x + tw * 0.6) + ' ' + (T.base - (T.base - T.top) * 0.35) + ' ' + (T.x + tw) + ' ' + T.base + ' Z', fill: 'url(#trunkG)', stroke: 'rgba(255,255,255,0.12)' }, flows);
    [-0.32, 0.05, 0.38].forEach(function (k) { el('path', { d: 'M' + (T.x + k * tw) + ' ' + (T.base - 6) + ' Q' + (T.x + k * tw * 0.4) + ' ' + ((T.base + T.top) / 2) + ' ' + (T.x + k * tw * 0.7) + ' ' + (T.top + 8), stroke: 'rgba(255,255,255,0.07)', fill: 'none' }, flows); });
    if ((brainOn || anyBusy) && !reduceMotion) {
      el('path', { id: 'sap', d: 'M' + T.x + ' ' + T.base + ' L' + T.x + ' ' + T.top, stroke: 'none', fill: 'none' }, flows);
      for (var q = 0; q < 3; q++) { var sd = el('circle', { r: isMobile() ? 2.4 : 3.5, fill: '#C7CDFF', filter: 'url(#glow)' }, flows); var sa = el('animateMotion', { dur: '2.2s', repeatCount: 'indefinite', begin: (-q * 0.73) + 's' }, sd); el('mpath', { href: '#sap' }, sa); }
    }
    // NHÁNH: thân → phòng ban (gradient từ màu thân sang màu phòng)
    Object.keys(L.branch).forEach(function (id) {
      var p = L.branch[id], r = room(id); if (!r) return;
      var on = !!roomBusy(r), low = !!p[3], left = p[0] < T.x;
      var sx = T.x + (left ? -1 : 1) * (low ? T.w * 0.5 : T.w * 0.25);
      var sy = low ? T.base - (T.base - T.top) * 0.32 : T.top + 14 + Math.abs(p[0] - T.x) / 20;
      var vx = sx - p[0], vy = sy - p[1], vl = Math.sqrt(vx * vx + vy * vy) || 1;
      var ex = p[0] + vx / vl * (L.R + 6), ey = p[1] + vy / vl * (L.R + 6);
      if (Math.abs(p[0] - T.x) < W * 0.12) { ex = p[0] + (left ? 1 : -1) * (L.R + 2); ey = p[1] + L.R * 0.5; }
      var d = low ? cubic(sx, sy, ex, ey, sx + (p[0] - T.x) * 0.3, sy + 10, ex + (sx - ex) * 0.4, ey + 10)
        : cubic(sx, sy, ex, ey, sx + (p[0] - T.x) * 0.2, sy - H * 0.075, ex + (sx - ex) * 0.35, ey + H * 0.025);
      flowPath(flows, d, COLOR[id], on, isMobile() ? 4 : 7, 2.4, [sx, sy, '#5560FF', ex, ey]);
    });
    // Luồng chuyển việc giữa các phòng (vòng cung mảnh trong tán)
    var auto = state.autopilot || { buoc: [] };
    EDGES.forEach(function (e) {
      var a = L.branch[e[0]] || L.roots[e[0]], b2 = L.branch[e[1]] || L.roots[e[1]]; if (!a || !b2) return;
      var on = edgeActive(e), armed = auto.buoc.indexOf(e[2]) >= 0;
      if (!on && !armed && isMobile()) return; // điện thoại: chỉ vẽ dây đang chạy hoặc đã bật tự động
      var off = L.R + 2;
      var mx = (a[0] + b2[0]) / 2, my = Math.min(a[1], b2[1]) - H * 0.07, ay = a[1] - off, by = b2[1] - off;
      if (Math.abs(a[1] - b2[1]) > H * 0.18) { mx = (a[0] + b2[0]) / 2 + (mx < T.x ? W * 0.07 : -W * 0.07); my = (a[1] + b2[1]) / 2; ay = a[1]; by = b2[1]; }
      var id = 'x' + (pathN++), col = COLOR[e[1]];
      var path = el('path', { id: id, d: 'M' + a[0] + ' ' + ay + ' Q' + mx + ' ' + my + ' ' + b2[0] + ' ' + by, fill: 'none', stroke: col, 'stroke-opacity': on ? 0.9 : armed ? 0.5 : 0.1, 'stroke-width': on ? 2 : armed ? 1.5 : 1, 'stroke-dasharray': on || armed ? '5 5' : '3 6' }, flows);
      el('title', {}, path).textContent = (SHORT[e[0]] || e[0]) + ' → ' + (SHORT[e[1]] || e[1]) + (armed ? ' · tự động' : '');
      if ((on || armed) && !reduceMotion) el('animate', { attributeName: 'stroke-dashoffset', from: '0', to: '-20', dur: on ? '0.7s' : '2.4s', repeatCount: 'indefinite' }, path);
      if (on && !reduceMotion) { var dd = el('circle', { r: 2.8, fill: col, filter: 'url(#glow)' }, flows); var aa = el('animateMotion', { dur: '3s', repeatCount: 'indefinite' }, dd); el('mpath', { href: '#' + id }, aa); }
    });
    // LÁ: phòng ban → ứng dụng (cuống cong; nhánh có việc thì lá đã nối sáng theo)
    function grow(id, p, leaves, angles, dir, mult) {
      var lit = !!roomBusy(room(id)) || (id === 'kho' && brainOn);
      leafSpots(p, leaves.length, angles, dir, mult).forEach(function (pt, j) {
        var lf = leaves[j];
        var cx = (p[0] + pt[0]) / 2 + (pt[1] - p[1]) * 0.15, cy = (p[1] + pt[1]) / 2 - (pt[0] - p[0]) * 0.15;
        el('path', { d: 'M' + p[0] + ' ' + p[1] + ' Q' + cx + ' ' + cy + ' ' + pt[0] + ' ' + pt[1], fill: 'none', stroke: COLOR[id], 'stroke-opacity': lf.on ? (lit ? 0.9 : 0.55) : 0.2, 'stroke-width': lf.on ? (lit ? 1.8 : 1.3) : 1, 'stroke-dasharray': lf.plus ? '2 4' : '' }, flows);
        leafRing(layer, pt[0], pt[1], lf, COLOR[id], lit);
      });
    }
    Object.keys(L.branch).forEach(function (id) {
      var p = L.branch[id], r = room(id); if (!r) return;
      var dir = p[2] != null ? p[2] * Math.PI / 180 : Math.atan2(p[1] - B[1], p[0] - B[0]);
      grow(id, p, (r.leaves || []).slice(0, L.maxLeaf).concat([{ plus: true, cat: r.them_cat }]), null, dir);
    });
    Object.keys(L.roots).forEach(function (id) {
      var p = L.roots[id], r = room(id); if (!r || !p[2]) return;
      grow(id, p, (r.leaves || []).slice(0, p[2].length), p[2], null, 1.25);
    });

    // Nút phòng ban + rễ
    state.rooms.forEach(function (r) {
      var p = L.branch[r.id] || L.roots[r.id]; if (!p) return;
      nodes[r.id] = { x: p[0], y: p[1] };
      drawRoom(layer, nodes[r.id], r, !!L.roots[r.id], !!(L.branch[r.id] && L.branch[r.id][3]));
    });
    drawKho(layer, L.roots.kho, brainOn || anyBusy);
    drawBrain(layer, { x: B[0], y: B[1] });
    highlight(selected);
  }
  function drawRoom(layer, n, r, isRoot, labelTop) {
    var st = STATUS[r.status], col = COLOR[r.id] || '#999', busy = !!roomBusy(r);
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': r.name + ': ' + st.label, 'data-node': r.id, style: 'cursor:pointer' }, layer);
    var R = isRoot ? L.RR : L.R;
    if (busy) {
      var aura = el('circle', { cx: n.x, cy: n.y, r: R + 10, fill: col, opacity: 0.28, filter: 'url(#soft)' }, g);
      if (!reduceMotion) el('animate', { attributeName: 'opacity', values: '0.15;0.4;0.15', dur: '2.2s', repeatCount: 'indefinite' }, aura);
    }
    if (busy && !reduceMotion) {
      var pulse = el('circle', { cx: n.x, cy: n.y, r: R, fill: 'none', stroke: col, 'stroke-width': 2, opacity: 0.7 }, g);
      el('animate', { attributeName: 'r', values: R + ';' + (R + R * 0.55), dur: '1.8s', repeatCount: 'indefinite' }, pulse);
      el('animate', { attributeName: 'opacity', values: '0.7;0', dur: '1.8s', repeatCount: 'indefinite' }, pulse);
    }
    var ring = el('circle', { cx: n.x, cy: n.y, r: R + R * 0.18, fill: 'none', stroke: col, 'stroke-width': busy ? 2.4 : 1.6, 'stroke-dasharray': busy ? '' : '4 2.5', opacity: busy ? 1 : 0.6 }, g);
    if (busy && !reduceMotion) { ring.setAttribute('stroke-dasharray', '10 4'); el('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 ' + n.x + ' ' + n.y, to: '360 ' + n.x + ' ' + n.y, dur: '9s', repeatCount: 'indefinite' }, ring); }
    el('circle', { cx: n.x, cy: n.y, r: R, fill: busy ? '#1D1D1D' : '#161616', stroke: 'rgba(255,255,255,0.22)', class: 'onode-core' }, g);
    var sc = R / 28;
    el('path', { d: ICON[r.id] || ICON.hang_ngay, transform: 'translate(' + (n.x - 12 * sc) + ' ' + (n.y - 12 * sc) + ') scale(' + sc + ')', fill: 'none', stroke: col, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: busy ? 1 : 0.8 }, g);
    el('circle', { cx: n.x + R * 0.72, cy: n.y + R * 0.72, r: Math.max(3.5, R * 0.2), fill: st.color, stroke: '#0F0F0F', 'stroke-width': 2 }, g);
    var badge = r.counts.duyet || r.counts.lam || r.counts.cho;
    if (badge) {
      var bR = Math.max(7, R * 0.36);
      el('circle', { cx: n.x + R * 0.75, cy: n.y - R * 0.75, r: bR, fill: st.color }, g);
      var bt = el('text', { x: n.x + R * 0.75, y: n.y - R * 0.75 + bR * 0.4, 'text-anchor': 'middle', fill: '#0B1020', 'font-size': bR * 1.1, 'font-weight': 700 }, g); bt.textContent = badge;
    }
    var ly = labelTop ? n.y - R - L.font * 1.9 : n.y + R + L.font * 1.45;
    label(g, n.x, ly, L.names[r.id] || r.name, L.font, '#FFFFFF');
    var t2 = el('text', { x: n.x, y: ly + L.sub * 1.4, 'text-anchor': 'middle', fill: st.color, 'font-size': L.sub }, g);
    t2.textContent = isMobile() && r.status === 'idle' ? '' : st.label + (r.status === 'done' && !isMobile() ? ' · ' + r.counts.xong_24h + ' việc' : '');
  }
  function drawKho(layer, p, lit) {
    var R = L.RR;
    var g = el('g', { class: 'onode', tabindex: '0', role: 'link', 'aria-label': 'Kho lưu trữ: ảnh, video, tài liệu của bạn', 'data-href': 'kho.html', style: 'cursor:pointer' }, layer);
    if (lit) el('circle', { cx: p[0], cy: p[1], r: R + 9, fill: COLOR.kho, opacity: 0.22, filter: 'url(#soft)' }, g);
    el('circle', { cx: p[0], cy: p[1], r: R + R * 0.2, fill: 'none', stroke: COLOR.kho, 'stroke-width': 2, 'stroke-dasharray': '4 2.5', opacity: lit ? 1 : 0.6 }, g);
    el('circle', { cx: p[0], cy: p[1], r: R * 0.92, fill: '#181818', stroke: 'rgba(255,255,255,0.22)' }, g);
    var sc = R / 24;
    el('path', { d: 'M3 7h18v13H3zM3 7l2-4h14l2 4M9 11h6', transform: 'translate(' + (p[0] - 12 * sc) + ' ' + (p[1] - 12 * sc) + ') scale(' + sc + ')', fill: 'none', stroke: COLOR.kho, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var ly = p[1] + R + L.font * 1.45;
    label(g, p[0], ly, isMobile() ? 'Kho' : 'Kho & dữ liệu', L.font, '#FFFFFF');
    var s2 = el('text', { x: p[0], y: ly + L.sub * 1.4, 'text-anchor': 'middle', fill: '#8F8F8F', 'font-size': L.sub }, g); s2.textContent = 'ảnh, video, tài liệu';
  }
  function drawBrain(layer, n) {
    var on = brainActive() || state.rooms.some(roomBusy);
    var R = L.BR;
    var g = el('g', { class: 'onode', tabindex: '0', role: 'button', 'aria-label': 'Bộ não AI điều phối', 'data-node': 'brain', style: 'cursor:pointer' }, layer);
    var aura = el('circle', { cx: n.x, cy: n.y, r: R + 12, fill: '#4652FF', opacity: on ? 0.35 : 0.12, filter: 'url(#soft)' }, g);
    if (!reduceMotion) el('animate', { attributeName: 'opacity', values: on ? '0.2;0.55;0.2' : '0.08;0.18;0.08', dur: on ? '2.4s' : '5s', repeatCount: 'indefinite' }, aura);
    if (on && !reduceMotion) {
      var p = el('circle', { cx: n.x, cy: n.y, r: R, fill: 'none', stroke: '#8B95FF', 'stroke-width': 2, opacity: 0.6 }, g);
      el('animate', { attributeName: 'r', values: R + ';' + (R * 1.45), dur: '2.4s', repeatCount: 'indefinite' }, p);
      el('animate', { attributeName: 'opacity', values: '0.6;0', dur: '2.4s', repeatCount: 'indefinite' }, p);
    }
    var ring = el('circle', { cx: n.x, cy: n.y, r: R + 5, fill: 'none', stroke: '#8B95FF', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g);
    if (on && !reduceMotion) el('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 ' + n.x + ' ' + n.y, to: '-360 ' + n.x + ' ' + n.y, dur: '12s', repeatCount: 'indefinite' }, ring);
    el('circle', { cx: n.x, cy: n.y, r: R, fill: '#141633', stroke: 'rgba(255,255,255,0.25)', class: 'onode-core' }, g);
    var sc = R / 38;
    el('path', { d: 'M0 -12 L3.5 -3.5 L12 0 L3.5 3.5 L0 12 L-3.5 3.5 L-12 0 L-3.5 -3.5 Z', transform: 'translate(' + n.x + ' ' + (n.y - 9 * sc) + ') scale(' + sc + ')', fill: on ? '#D4FF4A' : '#9AA0C8' }, g);
    var t = el('text', { x: n.x, y: n.y + 15 * sc, 'text-anchor': 'middle', fill: '#FFFFFF', 'font-size': 11.5 * Math.max(sc, 0.85), 'font-weight': 700 }, g); t.textContent = 'Bộ não AI';
    var s2 = el('text', { x: n.x, y: n.y + 28 * sc, 'text-anchor': 'middle', fill: on ? '#86EFAC' : '#9AA0C8', 'font-size': 9.5 * Math.max(sc, 0.85) }, g);
    var ai = state.brain.ai_ngoai;
    s2.textContent = on ? 'đang điều phối' : ai ? ai.ten.slice(0, isMobile() ? 10 : 16) : state.brain.app_mode ? (isMobile() ? 'Trợ lý' : 'Trợ lý Crewzy') : 'chờ nối AI';
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
    detailEl.innerHTML = '<p class="od-kicker" style="color:' + (COLOR[r.id] || '#8F8F8F') + '">' + (LAYOUT.desk.roots[r.id] ? 'Rễ · nguồn nuôi' : 'Nhánh · phòng ban') + '</p><h3 class="od-title">' + esc(r.name) + '</h3>' +
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

  // ---------- Chạy tự động cả cây ----------
  var autoBox = document.querySelector('[data-auto]');
  var autoDlg = document.querySelector('[data-auto-dlg]');
  var autoBody = document.querySelector('[data-auto-body]');
  function renderAuto() {
    var a = state.autopilot || {};
    autoBox.className = 'of-auto' + (a.bat ? ' on' : '');
    autoBox.innerHTML = a.bat
      ? '<p><span class="of-auto-dot" aria-hidden="true"></span><b>Đang chạy tự động</b> · ' + a.so_lich + ' bước theo giờ<small>AI tự làm theo dây chuyền. Bạn chỉ cần duyệt bài và gọi khách trong bản tin sáng.</small></p><div style="display:flex;gap:8px"><button type="button" class="btn btn-ghost" data-auto-open>Xem dây chuyền</button></div>'
      : '<p><b>Chạy tự động cả cây</b><small>Bấm 1 lần: nội dung → đăng kênh → trả lời bình luận → khách vào CRM → nhắc sale → báo cáo vào Sheet, mỗi ngày đúng giờ.</small></p><button type="button" class="btn btn-run" data-auto-open>▶ Run</button>';
  }
  function openAuto() {
    autoBody.innerHTML = '<p class="muted">Đang kiểm tra app và Brain…</p>';
    if (autoDlg.showModal) autoDlg.showModal(); else autoDlg.setAttribute('open', '');
    fetch('/api/autopilot?uid=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }).then(drawPlan).catch(function () { autoBody.innerHTML = '<p>Chưa tải được. Thử lại sau ít phút.</p>'; });
  }
  function drawPlan(p, msg) {
    var steps = p.steps || [];
    var nOn = steps.filter(function (x) { return x.se_bat; }).length;
    var html = '';
    if (msg) html += '<p class="of-auto-note" style="color:#B45309">' + esc(msg) + '</p>';
    if (!p.brand_ok) html += '<p class="of-auto-note" style="color:#B45309">Cần điền Brain thương hiệu trước (tên, sản phẩm, khách hàng, giọng văn) để AI làm đúng thương hiệu. <a href="thuong-hieu.html">Điền Brain</a></p>';
    html += '<p class="of-auto-note">' + (p.che_do === 'crewzy' ? 'Trợ lý Crewzy tự làm đúng giờ bằng credit của gói.' : 'Tới giờ Crewzy giao phiếu việc cho AI của bạn (Claude, ChatGPT…).') +
      ' Bài đăng và tin gửi khách vẫn chờ bạn duyệt 1 chạm ở Việc chờ duyệt.</p><ol class="of-chain">' + steps.map(function (x) {
      var right = x.dang_chay ? '<span class="ok">● Đang chạy</span>' : x.se_bat ? '<span class="ok">✓ Sẵn sàng</span>'
        : x.thieu.length ? '<a class="btn btn-ghost" href="ket-noi.html?app=' + esc(x.thieu[0].slug) + '">Nối ' + esc(x.thieu[0].name) + '</a>' : '<span class="muted" style="font-size:12px">Chưa bật</span>';
      return '<li class="' + (x.se_bat || x.dang_chay ? '' : 'off') + '"><i style="background:' + (COLOR[x.toi] || '#999') + '"></i><div><b>' + esc(x.buoc) + '</b><small>' +
        esc((SHORT[x.tu] || '') + ' → ' + (SHORT[x.toi] || '')) + ' · ' + esc(DAY_TXT[x.ngay] || '') + ' ' + esc(x.lap ? x.gio + '–' + x.den + ' mỗi giờ' : x.gio) + (x.ly_do ? ' · ' + esc(x.ly_do) : '') + '</small></div>' + right + '</li>';
    }).join('') + '</ol>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + (p.bat ? '<button type="button" class="btn btn-ghost" data-auto-off>Tắt chạy tự động</button>' : '') +
      '<button type="button" class="btn btn-primary" data-auto-on' + (!p.brand_ok || !nOn ? ' disabled' : '') + '>' + (p.bat ? 'Cập nhật dây chuyền (' + nOn + ' bước)' : 'Bật chạy tự động (' + nOn + ' bước)') + '</button></div>';
    autoBody.innerHTML = html;
  }
  function autoPost(action) {
    autoBody.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    fetch('/api/autopilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: uid, action: action }) })
      .then(function (r) { return r.json(); }).then(function (out) {
        if (out.error) { if (out.plan) drawPlan(out.plan, out.error); else fetch('/api/autopilot?uid=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }).then(function (pl) { drawPlan(pl, out.error); }); return; }
        if (out.plan) drawPlan(out.plan, out.loi && out.loi.length ? 'Một số bước chưa bật: ' + out.loi.join('; ') : ''); else autoDlg.close();
        load();
      });
  }
  autoBox.addEventListener('click', function (e) { if (e.target.closest('[data-auto-open]')) openAuto(); });
  autoDlg.addEventListener('click', function (e) {
    if (e.target === autoDlg || e.target.closest('[data-auto-close]')) autoDlg.close();
    else if (e.target.closest('[data-auto-on]')) autoPost('bat');
    else if (e.target.closest('[data-auto-off]')) autoPost('tat');
  });

  function renderAll() {
    renderTop();
    renderAuto();
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
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (isMobile() !== lastMobile) { lastMobile = isMobile(); renderGraph(); renderTiles(); } }, 150); });

  load();
  setInterval(function () { if (!document.hidden) load(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
