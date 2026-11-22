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
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  var GROUPS = [
    { label: null, links: [
      { href: 'index.html', text: 'Văn phòng', icon: 'home' },
      { href: 'chat.html', text: 'Trợ lý AI', icon: 'chat' },
      { href: 'cho-duyet.html', text: 'Việc chờ duyệt', icon: 'check', badge: '3' }
    ] },
    { label: 'Thiết lập', links: [
      { href: 'ket-noi.html', text: 'Kết nối', icon: 'apps' },
      { href: 'quy-trinh.html', text: 'Quy trình', icon: 'flow' },
      { href: 'thuong-hieu.html', text: 'Brain thương hiệu', icon: 'brain' }
    ] },
    { label: 'Theo dõi', links: [
      { href: '#', text: 'Kết quả', icon: 'chart', soon: true },
      { href: '#', text: 'Gói và credit', icon: 'card', soon: true }
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
        var extra = l.badge ? '<span class="sb-badge">' + l.badge + '</span>' : l.soon ? '<span class="sb-soon">Sắp có</span>' : '';
        html += '<a class="sb-link" href="' + l.href + '"' + current + (l.soon ? ' aria-disabled="true"' : '') + '>' + icon(l.icon) + '<span>' + l.text + '</span>' + extra + '</a>';
      });
      html += '</div>';
    });
    html += '</div><div class="sb-foot"><div class="sb-card"><p style="font-size:13px;font-weight:600">Đang dùng thử</p><p class="muted" style="font-size:12px;margin-top:4px;line-height:1.5">Kết nối app, điền Brain thương hiệu rồi giao việc cho Trợ lý AI.</p></div><div data-user-slot></div></div>';
    nav.innerHTML = html;
    nav.querySelectorAll('a[aria-disabled="true"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
    // Điện thoại: menu là một hàng cuộn ngang → cuộn sẵn tới mục đang mở.
    var cur = nav.querySelector('[aria-current="page"]');
    var row = nav.querySelector('.sb-groups');
    if (cur && row && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, cur.offsetLeft - 12);
  }

  function init() {
    var nav = document.querySelector('nav[data-sidebar]');
    if (nav) render(nav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
