// Menu trái dùng chung cho mọi trang: vẽ vào <nav data-sidebar>. Sửa menu ở đây, không sửa từng trang.
// Cũng cung cấp window.vpaiUid() (mã khách theo trình duyệt, dùng khi chưa bật đăng nhập Google).
(function () {
  var UID_PATTERN = /^[a-z0-9-]{8,64}$/;
  window.vpaiUid = function () {
    var id = null;
    try { id = localStorage.getItem('vpai.uid'); } catch (e) {}
    if (!id || !UID_PATTERN.test(id)) {
      id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).toLowerCase();
      try { localStorage.setItem('vpai.uid', id); } catch (e) {}
    }
    return id;
  };

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    chat: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
    apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 13.5v7M13.5 17h7"/>',
    flow: '<rect x="3" y="4" width="6" height="5" rx="1.2"/><rect x="15" y="15" width="6" height="5" rx="1.2"/><path d="M6 9v4a2 2 0 0 0 2 2h7"/>',
    brain: '<path d="M12 3.5 14.2 9l5.3 2-5.3 2L12 18.5 9.8 13l-5.3-2 5.3-2z"/><path d="M19 3v3M17.5 4.5h3"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  var GROUPS = [
    { label: null, links: [
      { href: 'index.html', text: 'Văn phòng', icon: 'home' },
      { href: 'chat.html', text: 'Trợ lý AI', icon: 'chat' },
      { href: 'cho-duyet.html', text: 'Việc chờ duyệt', icon: 'check', badgeKey: 'jobs' }
    ] },
    { label: 'Thiết lập', links: [
      { href: 'ket-noi.html', text: 'Kết nối', icon: 'apps' },
      { href: 'quy-trinh.html', text: 'Quy trình', icon: 'flow' },
      { href: 'thuong-hieu.html', text: 'Brain thương hiệu', icon: 'brain' }
    ] },
    { label: 'Theo dõi', links: [
      { href: '#', text: 'Kết quả', icon: 'chart', soon: true },
      { href: 'goi.html', text: 'Gói và credit', icon: 'card' }
    ] }
  ];

  function render(nav) {
    var page = location.pathname.split('/').pop() || 'index.html';
    nav.className = 'sb';
    var html = '<div class="sb-brand"><div class="sb-logo" aria-hidden="true">Cz</div><div><p class="sb-name">Crewzy</p><p class="sb-sub" data-brand-sub>Đội nhân viên AI</p></div></div><div class="sb-groups">';
    GROUPS.forEach(function (g) {
      if (g.label) html += '<p class="sb-label">' + g.label + '</p>';
      html += '<div class="sb-links">';
      g.links.forEach(function (l) {
        var current = l.href === page ? ' aria-current="page"' : '';
        var extra = l.badgeKey ? '<span class="sb-badge" data-badge="' + l.badgeKey + '" hidden></span>' : l.soon ? '<span class="sb-soon">Sắp có</span>' : '';
        html += '<a class="sb-link" href="' + l.href + '"' + current + (l.soon ? ' aria-disabled="true"' : '') + '>' + icon(l.icon) + '<span>' + l.text + '</span>' + extra + '</a>';
      });
      html += '</div>';
    });
    html += '</div><div class="sb-foot"><div class="sb-card"><p style="font-size:13px;font-weight:600">Đang dùng thử</p><p class="muted" style="font-size:12px;margin-top:4px;line-height:1.5">Kết nối app, điền Brain thương hiệu rồi giao việc cho Trợ lý AI.</p></div><div data-user-slot></div></div>';
    nav.innerHTML = html;
    nav.querySelectorAll('a[aria-disabled="true"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
    renderMobile(page);
  }

  // Điện thoại (≤760px): thanh trên gọn (logo) + thanh dưới 5 mục kiểu app + bảng "Thêm" trượt lên. Máy tính dùng menu trái.
  var TABS = [
    { href: 'index.html', text: 'Văn phòng', icon: 'home' },
    { href: 'cho-duyet.html', text: 'Duyệt', icon: 'check', badgeKey: 'jobs' },
    { href: 'chat.html', text: 'Trợ lý', icon: 'chat' },
    { href: 'quy-trinh.html', text: 'Quy trình', icon: 'flow' }
  ];
  var MORE = [
    { href: 'ket-noi.html', text: 'Kết nối app và AI', sub: 'Facebook, Gmail, Claude, ChatGPT…', icon: 'apps' },
    { href: 'thuong-hieu.html', text: 'Brain thương hiệu', sub: 'Giọng văn, sản phẩm, mẫu video và ảnh', icon: 'brain' },
    { href: '#', text: 'Kết quả', sub: 'Sắp có', icon: 'chart', soon: true },
    { href: 'goi.html', text: 'Gói và credit', sub: 'Hạn gói, credit, thanh toán', icon: 'card' }
  ];
  function renderMobile(page) {
    if (document.querySelector('.mbar')) return;
    var inMore = MORE.some(function (m) { return m.href === page; });
    var top = document.createElement('header');
    top.className = 'mtop';
    top.innerHTML = '<a href="index.html" class="mtop-brand" aria-label="Crewzy, về Văn phòng"><span class="sb-logo" aria-hidden="true">Cz</span><span><b>Crewzy</b><small data-brand-sub-m>Đội nhân viên AI</small></span></a>' +
      '<a href="ket-noi.html" class="mtop-link"' + (page === 'ket-noi.html' ? ' aria-current="page"' : '') + '>' + icon('apps') + '<span>Kết nối</span></a>';
    document.body.insertBefore(top, document.body.firstChild);
    var bar = document.createElement('nav');
    bar.className = 'mbar';
    bar.setAttribute('aria-label', 'Điều hướng chính');
    bar.innerHTML = TABS.map(function (t) {
      return '<a href="' + t.href + '"' + (t.href === page ? ' aria-current="page"' : '') + '>' + icon(t.icon) + '<span>' + t.text + '</span>' +
        (t.badgeKey ? '<i class="mbar-badge" data-badge="' + t.badgeKey + '" hidden></i>' : '') + '</a>';
    }).join('') + '<button type="button" data-more-open' + (inMore ? ' aria-current="page"' : '') + ' aria-haspopup="dialog">' + icon('more') + '<span>Thêm</span></button>';
    document.body.appendChild(bar);
    var sheet = document.createElement('div');
    sheet.className = 'msheet';
    sheet.hidden = true;
    sheet.innerHTML = '<div class="msheet-bg" data-more-close></div><div class="msheet-card" role="dialog" aria-modal="true" aria-label="Thêm">' +
      '<div class="msheet-head"><p>Thêm</p><button type="button" class="msheet-x" data-more-close aria-label="Đóng">' + icon('close') + '</button></div>' +
      MORE.map(function (m) {
        return '<a class="msheet-item" href="' + m.href + '"' + (m.soon ? ' aria-disabled="true"' : '') + (m.href === page ? ' aria-current="page"' : '') + '>' + icon(m.icon) +
          '<span><b>' + m.text + '</b><small>' + m.sub + '</small></span></a>';
      }).join('') + '<div data-user-slot-m></div></div>';
    document.body.appendChild(sheet);
    function open(on) { sheet.hidden = !on; document.documentElement.classList.toggle('msheet-open', on); }
    bar.querySelector('[data-more-open]').addEventListener('click', function () { open(true); });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-more-close]')) open(false);
      var a = e.target.closest('a[aria-disabled="true"]'); if (a) e.preventDefault();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) open(false); });
  }

  // Số phiếu việc chờ duyệt thật (từ /api/jobs). Trang Việc chờ duyệt gọi window.vpaiSetJobBadge(n) khi số đổi.
  window.vpaiSetJobBadge = function (n) {
    document.querySelectorAll('[data-badge="jobs"]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  };
  function loadBadge() {
    if (!window.vpaiUid || location.pathname.indexOf('dang-nhap') >= 0) return;
    fetch('/api/jobs?uid=' + encodeURIComponent(window.vpaiUid())).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.counts) window.vpaiSetJobBadge(d.counts.cho_duyet || 0);
    }).catch(function () {});
  }

  function init() {
    var nav = document.querySelector('nav[data-sidebar]');
    if (nav) { render(nav); loadBadge(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
