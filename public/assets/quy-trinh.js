// Trang Quy trình: thư viện quy trình chuẩn từ /api/workflows (nguồn: src/lib/workflows.js).
// Mỗi quy trình: app bắt buộc / nên có (sáng = đã kết nối), MCP ngoài cần nối, các bước, nút Chạy ngay / Giao cho AI của tôi / Hẹn giờ.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var uid = window.vpaiUid();
  var listEl = $('[data-flows]');
  var msgEl = $('[data-msg]');
  var data = { departments: [], workflows: [], mcpHosts: {} };
  var accounts = {};
  var mcpUrls = [];
  var names = {};
  var dep = new URLSearchParams(location.search).get('phong') || 'all';
  var channel = new URLSearchParams(location.search).get('kenh') || 'all';
  // Ngành: ?nganh= hoặc lựa chọn đã lưu ở trang Kết nối (localStorage crewzy.nganh). Chọn ngành → chỉ hiện quy trình nên chạy, theo thứ tự ưu tiên.
  var industries = [];
  var brandData = {};
  var flowStatus = {}; // /api/workflows/status: đủ app + đủ dữ liệu (Brain, mẫu, quy trình chạy trước, nguồn số liệu)
  var nganh = new URLSearchParams(location.search).get('nganh') || (function () { try { return localStorage.getItem('crewzy.nganh') || 'all'; } catch (e) { return 'all'; } })();
  function saveNganh() { try { if (nganh === 'all') localStorage.removeItem('crewzy.nganh'); else localStorage.setItem('crewzy.nganh', nganh); } catch (e) {} }
  function chip(attr, id, label, on) {
    return '<button type="button" ' + attr + '="' + id + '" aria-pressed="' + on + '" style="min-height:32px;padding:0 12px;border-radius:99px;border:1px solid ' + (on ? 'var(--primary)' : '#D4D4D4') + ';background:' + (on ? 'var(--primary)' : '#fff') + ';color:' + (on ? '#fff' : 'inherit') + ';font:inherit;font-size:13px;cursor:pointer">' + esc(label) + '</button>';
  }
  function renderIndustries() {
    var box = $('[data-industries]'); if (!box) return;
    box.innerHTML = [chip('data-nganh', 'all', 'Tất cả', nganh === 'all')].concat(industries.map(function (x) { return chip('data-nganh', x.id, x.name, nganh === x.id); })).join('');
    var cur = industries.filter(function (x) { return x.id === nganh; })[0];
    var note = $('[data-industry-note]');
    note.hidden = !cur;
    if (cur) note.innerHTML = esc(cur.vi_sao) + ' Chạy theo thứ tự từ trái sang phải. <a href="ket-noi.html?nganh=' + cur.id + '">Xem app nên nối</a>';
  }
  var catalogStatus = {};
  var sched = { schedules: [], days: {}, modes: {} };
  var MCP_INFO = {
    apify: { name: 'Apify', letter: 'A', bg: '#246DFF', note: 'soi Reels/TikTok, quảng cáo Facebook' },
    firecrawl: { name: 'Firecrawl', letter: 'F', bg: '#FA5D19', note: 'đọc website' },
    openart: { name: 'OpenArt', letter: 'O', bg: '#111', note: 'ảnh, video AI' },
    vidiq: { name: 'vidIQ', letter: 'V', bg: '#CC0000', note: 'chỉ trong Claude/ChatGPT của bạn' }
  };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t, ok) { msgEl.textContent = t || ''; msgEl.style.display = t ? 'block' : 'none'; msgEl.style.background = ok ? 'var(--ok-soft)' : '#FDE8E3'; msgEl.style.color = ok ? 'var(--ok)' : '#8A2A12'; }
  function json(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && window.vpaiNeedLogin) window.vpaiNeedLogin();
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.error || 'Có lỗi, thử lại.'); return b; });
    });
  }
  function post(url, body) { return json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid: uid }, body)) }); }

  function appIcon(slug, on, required) {
    var label = (names[slug] || slug) + (on ? ' · đã kết nối' : required ? ' · cần kết nối' : ' · nên có');
    return '<a href="ket-noi.html?app=' + slug + '" title="' + esc(label) + '" style="position:relative;display:inline-flex"><img src="https://logos.composio.dev/api/' + slug + '" alt="' + esc(label) + '" style="width:26px;height:26px;border-radius:6px;background:#fff;border:1px solid var(--line, #E8E8E8);padding:2px;' + (on ? '' : 'opacity:.4;filter:grayscale(1)') + '">' +
      (required && !on ? '<span aria-hidden="true" style="position:absolute;right:-3px;top:-3px;width:9px;height:9px;border-radius:50%;background:#D93025;border:2px solid #fff"></span>' : '') + '</a>';
  }
  function mcpChip(m, on) {
    var i = (data.mcpInfo && data.mcpInfo[m]) || MCP_INFO[m] || { name: m, letter: m[0].toUpperCase(), bg: '#555', note: '' };
    var href = i.ngoai ? 'ket-noi.html?tab=ai' : 'ket-noi.html?tab=mcp' + (i.url ? '&ten=' + encodeURIComponent(i.name) + '&url=' + encodeURIComponent(i.url) : '');
    var pic = i.logo ? '<img src="https://logos.composio.dev/api/' + esc(i.logo) + '" alt="" style="width:20px;height:20px;border-radius:50%">'
      : '<span style="width:20px;height:20px;border-radius:50%;background:' + i.bg + ';color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + esc(i.letter) + '</span>';
    return '<a href="' + href + '" title="' + esc(i.name + ' · ' + i.note + (on ? ' · đã nối' : i.ngoai ? ' · thêm trong AI của bạn' : ' · bấm để nối MCP')) + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 2px;border-radius:99px;border:1px solid var(--line, #E8E8E8);font-size:12px;color:inherit;text-decoration:none;' + (on ? '' : 'opacity:.55') + '">' +
      pic + esc(i.name) + '</a>';
  }
  function mcpOn(m) { var host = data.mcpHosts[m] || m; return mcpUrls.some(function (u) { return u.indexOf(host) >= 0; }); }

  function renderChannels() {
    var keys = ['all'].concat(Object.keys(data.channels || {}));
    $('[data-channels]').innerHTML = keys.map(function (k) {
      var on = channel === k;
      return '<button type="button" data-channel="' + k + '" aria-pressed="' + on + '" style="min-height:32px;padding:0 12px;border-radius:99px;border:1px solid ' + (on ? 'var(--primary)' : '#D4D4D4') + ';background:' + (on ? 'var(--primary)' : '#fff') + ';color:' + (on ? '#fff' : 'inherit') + ';font:inherit;font-size:13px;cursor:pointer">' + esc(k === 'all' ? 'Tất cả' : data.channels[k]) + '</button>';
    }).join('');
  }

  // CHỌN CÔNG CỤ CHO LẦN CHẠY (23/11): app đã nối bấm để chọn/bỏ chọn (không ngắt kết nối), nhớ trong trình duyệt (crewzy.qtchon),
  // ghép vào lệnh Chạy ngay / Giao cho AI / ghi chú Hẹn giờ để AI dùng đúng app khách chọn. Chưa chọn lần nào = dùng mọi app đã nối.
  var qtSel = (function () { try { return JSON.parse(localStorage.getItem('crewzy.qtchon') || '{}') || {}; } catch (e) { return {}; } })();
  function connOf(g) { return g.apps.filter(function (s) { return accounts[s] > 0; }).concat((g.mcp || []).filter(mcpOn).map(function (m) { return 'mcp:' + m; })); }
  function selG(wid, gi, g) { var c = connOf(g), s = qtSel[wid] && qtSel[wid][gi]; return s ? s.filter(function (v) { return c.indexOf(v) >= 0; }) : c; }
  function nameOf(v) { if (v.indexOf('mcp:') === 0) { var k = v.slice(4); var i = (data.mcpInfo && data.mcpInfo[k]) || MCP_INFO[k]; return (i && i.name) || k; } return names[v] || v; }
  function prefOf(w, compact) {
    var l = [];
    (w.cong_cu || []).forEach(function (g, gi) {
      if (!connOf(g).length) return;
      var s = selG(w.id, gi, g);
      l.push((compact ? '' : '- ') + g.vai + ': ' + (s.length ? 'dùng ' + s.map(nameOf).join(', ') : 'không dùng app nào lần này'));
    });
    if (!l.length) return '';
    return compact ? 'Khách chọn công cụ: ' + l.join('; ') + '.' : '\n\nLỰA CHỌN CỦA KHÁCH (làm ĐÚNG như vậy, không tự đổi app):\n' + l.join('\n');
  }
  function runHref(w) {
    return 'chat.html?q=' + encodeURIComponent('Chạy quy trình "' + w.ten + '" (mã ' + w.id + '): gọi CREWZY_QUY_TRINH với id "' + w.id + '" để lấy các bước, làm đúng thứ tự, nộp kết quả kèm quy_trinh.' + (w.hoi ? ' Hỏi tôi: ' + w.hoi + ' nếu cần.' : '') + prefOf(w));
  }
  function tgIcon(wid, gi, v, on) {
    var tip = nameOf(v) + (on ? ' · đang dùng lần này (bấm để bỏ chọn, vẫn giữ kết nối)' : ' · đã nối, lần này không dùng (bấm để chọn)');
    var key = esc(wid + '|' + gi + '|' + v);
    if (v.indexOf('mcp:') === 0) return '<button type="button" class="qt-tg mcp' + (on ? '' : ' unsel') + '" data-qt-tg="' + key + '" aria-pressed="' + on + '" title="' + esc(tip) + '">' + esc(nameOf(v)) + (on ? ' ✓' : '') + '</button>';
    return '<button type="button" class="qt-tg' + (on ? '' : ' unsel') + '" data-qt-tg="' + key + '" aria-pressed="' + on + '" title="' + esc(tip) + '"><img src="https://logos.composio.dev/api/' + esc(v) + '" alt="' + esc(nameOf(v)) + '">' + (on ? '<i aria-hidden="true">✓</i>' : '') + '</button>';
  }
  // Một nhóm công cụ: các app thay thế nhau, nối 1 app là đủ. Hiện app đã nối trước, app gợi ý sau.
  function groupRow(g, gi, w) {
    var connectedApps = g.apps.filter(function (s) { return accounts[s] > 0; });
    var mcpConnected = (g.mcp || []).filter(mcpOn);
    var ok = connectedApps.length || mcpConnected.length || g.san_co;
    var order = connectedApps.concat(g.apps.filter(function (s) { return connectedApps.indexOf(s) < 0 && catalogStatus[s] === 'ready'; }));
    var sel = w ? selG(w.id, gi, g) : connectedApps;
    var icons = order.slice(0, 10).map(function (s) { return accounts[s] > 0 && w ? tgIcon(w.id, gi, s, sel.indexOf(s) >= 0) : appIcon(s, accounts[s] > 0, false); }).join('');
    var more = order.length > 10 ? '<span class="muted" style="font-size:12px">+' + (order.length - 10) + '</span>' : '';
    var soon = g.apps.filter(function (s) { return catalogStatus[s] && catalogStatus[s] !== 'ready'; }).map(function (s) { return names[s] || s; });
    var chips = (g.mcp || []).map(function (m) { return mcpOn(m) && w ? tgIcon(w.id, gi, 'mcp:' + m, sel.indexOf('mcp:' + m) >= 0) : mcpChip(m, mcpOn(m)); }).join('') +
      '<a class="qt-plus" href="ket-noi.html" title="Thêm app của bạn cho việc này">+</a>';
    return '<div data-grow="' + (w ? esc(w.id + '|' + gi) : '') + '" style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;background:' + (ok ? '#F6FBF7' : g.bat_buoc ? '#FFF6F4' : '#F7F7F8') + '">' +
      '<p style="margin:0;font-size:12px;font-weight:600;display:flex;gap:6px;align-items:center">' + esc(g.vai) +
      (g.bat_buoc ? '<span style="font-weight:500;color:' + (ok ? 'var(--ok)' : '#B3261E') + '">' + (ok ? '· đã có' : '· cần nối 1 app') + '</span>' : '<span class="muted" style="font-weight:500">· không bắt buộc' + (ok ? ', đã có' : '') + '</span>') + '</p>' +
      (g.san_co ? '<p class="muted" style="margin:0;font-size:12px">' + esc(g.san_co) + '</p>' : '') +
      '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">' + icons + more + chips + '</div>' +
      (soon.length ? '<p class="muted" style="margin:0;font-size:11px">Sắp có: ' + esc(soon.join(', ')) + '</p>' : '') + '</div>';
  }
  function groupsReady(w) {
    return (w.cong_cu || []).filter(function (g) { return g.bat_buoc; }).every(function (g) {
      return g.san_co || g.apps.some(function (s) { return accounts[s] > 0; }) || (g.mcp || []).some(mcpOn);
    });
  }
  function firstMissing(w) {
    var g = (w.cong_cu || []).filter(function (x) { return x.bat_buoc && !(x.san_co || x.apps.some(function (s) { return accounts[s] > 0; }) || (x.mcp || []).some(mcpOn)); })[0];
    if (!g) return null;
    var app = g.apps.filter(function (s) { return catalogStatus[s] === 'ready'; })[0];
    return { group: g, app: app };
  }

  // Nút sửa điều kiện dữ liệu: quy trình khác trên trang này → nhảy tới thẻ đó; còn lại mở trang (Brain, Kết nối).
  function needBtn(x, cls) {
    var m = /^quy-trinh\.html\?phong=[a-z_]+#wf-([a-z_]+)$/.exec(x.link || '');
    return m ? '<button type="button" class="' + cls + '" data-goto="' + m[1] + '">' + esc(x.nut) + '</button>' : '<a class="' + cls + '" href="' + esc(x.link) + '">' + esc(x.nut) + '</a>';
  }
  function goTo(id) {
    var w = data.workflows.filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    var cur = industries.filter(function (x) { return x.id === nganh; })[0];
    if (cur && cur.workflows.indexOf(id) < 0) { nganh = 'all'; saveNganh(); }
    dep = w.phong; channel = 'all'; syncUrl(); render();
    var el = document.getElementById('wf-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.style.transition = 'box-shadow .3s'; el.style.boxShadow = '0 0 0 3px var(--highlight, #D4FF4A)';
    setTimeout(function () { el.style.boxShadow = ''; }, 2200);
  }

  function renderDeps() {
    var deps = [{ id: 'all', name: 'Tất cả' }].concat(data.departments);
    $('[data-deps]').innerHTML = deps.map(function (d) {
      var n = d.id === 'all' ? data.workflows.length : data.workflows.filter(function (w) { return w.phong === d.id; }).length;
      return '<button type="button" data-dep="' + d.id + '" aria-pressed="' + (dep === d.id) + '">' + esc(d.name) + ' <span class="num">' + n + '</span></button>';
    }).join('');
  }

  function render() {
    renderDeps();
    renderChannels();
    renderIndustries();
    var depName = {}; data.departments.forEach(function (d) { depName[d.id] = d.name; });
    var cur = industries.filter(function (x) { return x.id === nganh; })[0];
    var list = data.workflows.filter(function (w) { return (dep === 'all' || w.phong === dep) && (channel === 'all' || (w.kenh || []).indexOf(channel) >= 0) && (!cur || cur.workflows.indexOf(w.id) >= 0); });
    if (cur) list.sort(function (a, b) { return cur.workflows.indexOf(a.id) - cur.workflows.indexOf(b.id); });
    if (!list.length) { listEl.innerHTML = '<p class="muted" style="margin:0">Chưa có quy trình cho lựa chọn này.</p>'; return; }
    listEl.innerHTML = list.map(function (w) {
      var appsOk = groupsReady(w);
      var st = flowStatus[w.id];
      var lack = (st && st.thieu_du_lieu) || [];
      var soft = (st && st.nen_co) || [];
      var ready = appsOk && !lack.length;
      var miss = firstMissing(w);
      var kenh = (w.kenh || []).map(function (k) { return '<span class="pill" style="font-size:11px">' + esc((data.channels || {})[k] || k) + '</span>'; }).join('');
      var groups = (w.cong_cu || []).map(function (g, gi) { return groupRow(g, gi, w); }).join('');
      var fix = miss ? (miss.app ? '<a class="btn btn-primary wrap" href="ket-noi.html?app=' + miss.app + '">Nối 1 app: ' + esc(miss.group.vai) + '</a>' : '<a class="btn btn-primary wrap" href="ket-noi.html?tab=mcp">Nối ' + esc(miss.group.vai.toLowerCase()) + '</a>') : '';
      if (!fix && lack.length) fix = needBtn(lack[0], 'btn btn-primary');
      var needBox = lack.length || soft.length ? '<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:8px;background:' + (lack.length ? '#FFF6F4' : '#F7F7F8') + '">' +
        '<p style="margin:0;font-size:12px;font-weight:600">' + (lack.length ? 'Cần có trước khi chạy để ra kết quả thật' : 'Nên có để kết quả tốt hơn') + '</p>' +
        lack.concat(soft).map(function (x, i) {
          return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12px;line-height:1.5"><span style="flex:1;min-width:180px"><b style="font-weight:600;color:' + (i < lack.length ? '#B3261E' : 'inherit') + '">' + esc(x.ten) + '.</b> <span class="muted">' + esc(x.cach) + '</span></span>' + (i === 0 && lack.length && !miss ? '' : needBtn(x, 'btn btn-ghost chip')) + '</div>';
        }).join('') + '</div>' : '';
      return '<article class="card" id="wf-' + w.id + '" style="padding:16px;display:flex;flex-direction:column;gap:10px;scroll-margin-top:80px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><p class="muted" style="margin:0;font-size:12px;font-weight:600">' + esc(depName[w.phong]) + '</p><h2 style="margin:2px 0 0;font-size:16px;font-weight:600">' + esc(w.ten) + '</h2></div>' +
        (ready ? '<span class="pill pill-ok">Sẵn sàng</span>' : !appsOk ? '<span class="pill pill-warn">Thiếu kết nối</span>' : '<span class="pill pill-warn">' + (lack[0].loai === 'truoc' ? 'Chạy quy trình trước' : 'Thiếu dữ liệu') + '</span>') + '</div>' +
        '<p class="muted" style="margin:0;font-size:13px;line-height:1.55">' + esc(w.mo_ta) + '</p>' +
        '<p style="margin:0;font-size:12px;color:#4A4A4A">Gợi ý lịch: ' + esc(w.lich) + '</p>' +
        (kenh ? '<div style="display:flex;gap:4px;flex-wrap:wrap">' + kenh + '</div>' : '') +
        needBox +
        (w.media && !(brandData.video_style || brandData.visual || (brandData.refs || []).length) ? '<p style="margin:0;padding:8px 10px;border-radius:6px;background:var(--warn-soft);color:var(--warn);font-size:12px;line-height:1.5">AI làm theo phong cách và mẫu bạn thích: thêm <a href="thuong-hieu.html#f-visual">phong cách hình ảnh/video, giọng đọc và video, ảnh mẫu</a> ở Brain thương hiệu để ra đúng gu.</p>' : '') +
        (w.tu_dong ? '<p class="muted" style="margin:0;font-size:12px">Có chế độ tự trả lời: bấm Hẹn giờ → Mỗi giờ → bật "Cho AI tự trả lời câu thường".</p>' : '') +
        (groups ? '<details' + (ready || window.innerWidth <= 760 ? '' : ' open') + '><summary style="cursor:pointer;font-size:13px;font-weight:600">Công cụ chạy quy trình (' + (w.cong_cu || []).length + ' vai trò, chọn app bạn dùng)</summary><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' + groups + '</div></details>' : '') +
        '<details><summary style="cursor:pointer;font-size:13px;font-weight:600">Các bước (' + w.buoc.length + ')</summary><ol style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.6">' + w.buoc.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ol></details>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">' + (fix ||
          '<a class="btn btn-primary" data-run-link="' + w.id + '" href="' + esc(runHref(w)) + '">Chạy ngay</a>') +
        '<button type="button" class="btn btn-ghost" data-assign="' + w.id + '">Giao cho AI của tôi</button>' +
        '<button type="button" class="btn btn-ghost" data-sched="' + w.id + '">Hẹn giờ</button></div></article>';
    }).join('');
  }

  function syncUrl() {
    var q = [];
    if (dep !== 'all') q.push('phong=' + dep);
    if (channel !== 'all') q.push('kenh=' + channel);
    if (nganh !== 'all') q.push('nganh=' + nganh);
    history.replaceState(null, '', 'quy-trinh.html' + (q.length ? '?' + q.join('&') : ''));
  }

  function renderSched() {
    var box = $('[data-sched-box]');
    box.hidden = !sched.schedules.length;
    $('[data-sched-list]').innerHTML = sched.schedules.map(function (s) {
      return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line, #E8E8E8);border-radius:8px' + (s.bat ? '' : ';opacity:.55') + '">' +
        '<div style="flex:1;min-width:200px"><p style="margin:0;font-weight:600;font-size:14px">' + esc(s.ten) + '</p><p class="muted" style="margin:2px 0 0;font-size:12px">' + esc(sched.days[s.ngay] || s.ngay) + (s.lap === 'moi_gio' ? ' mỗi giờ ' + esc(s.gio) + '–' + esc(s.den || '22:00') : ' lúc ' + esc(s.gio)) + (s.tu_dong ? ' · tự trả lời câu thường' : '') + ' · ' + esc(sched.modes[s.che_do] || s.che_do) + (s.lan_cuoi ? ' · lần gần nhất ' + esc(s.lan_cuoi) : '') + '</p></div>' +
        '<button type="button" class="btn btn-ghost" data-sact="' + (s.bat ? 'tat' : 'bat') + '" data-sid="' + s.id + '">' + (s.bat ? 'Tạm dừng' : 'Bật lại') + '</button>' +
        '<button type="button" class="btn btn-ghost" data-sact="xoa" data-sid="' + s.id + '" style="color:#8A2A12">Xoá</button></div>';
    }).join('');
  }

  function loadSched() {
    return json('/api/schedules?uid=' + encodeURIComponent(uid)).then(function (d) { sched = d; renderSched(); }).catch(function () {});
  }

  // Hẹn giờ
  var dialog = $('[data-sched-dialog]');
  var sform = $('[data-sched-form]');
  var schedFor = null;
  function openSched(id) {
    var w = data.workflows.filter(function (x) { return x.id === id; })[0];
    schedFor = w;
    $('[data-sched-title]').textContent = 'Hẹn giờ: ' + w.ten;
    sform.ngay.innerHTML = Object.keys(sched.days).map(function (k) { return '<option value="' + k + '">' + esc(sched.days[k]) + '</option>'; }).join('');
    sform.che_do.innerHTML = Object.keys(sched.modes).map(function (k) { return '<option value="' + k + '">' + esc(sched.modes[k]) + '</option>'; }).join('');
    var lich = (w.lich || '').toLowerCase();
    sform.ngay.value = /thứ hai hằng tuần|thứ hai \d/.test(lich) ? 't2' : /thứ hai đến thứ sáu/.test(lich) ? 't2_t6' : /ngày 1/.test(lich) ? 'ngay_1' : 'hang_ngay';
    var m = /(\d{1,2}):(\d{2})/.exec(w.lich || '');
    sform.gio.value = m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '08:00';
    $('[data-sched-msg]').style.display = 'none';
    sform.lap.value = w.tu_dong ? 'moi_gio' : '';
    var tw = $('[data-tudong-wrap]'); tw.hidden = !w.tu_dong; tw.style.display = w.tu_dong ? 'flex' : 'none';
    sform.tu_dong.checked = false;
    syncRepeat();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  $('[data-sched-cancel]').addEventListener('click', function () { dialog.close(); });
  // Lặp mỗi giờ: hiện ô "Tới", bắt buộc Trợ lý Crewzy tự làm; quy trình có tu_dong thì hiện ô cho tự trả lời.
  function syncRepeat() {
    var hourly = sform.lap.value === 'moi_gio';
    $('[data-den-wrap]').hidden = !hourly;
    $('[data-den-wrap]').style.display = hourly ? 'flex' : 'none';
    $('[data-gio-label]').textContent = hourly ? 'Từ (giờ Việt Nam)' : 'Giờ (giờ Việt Nam)';
    $('[data-lap-note]').hidden = !hourly;
    if (hourly) sform.che_do.value = 'crewzy';
    Array.prototype.forEach.call(sform.che_do.options, function (o) { o.disabled = hourly && o.value !== 'crewzy'; });
  }
  sform.lap.addEventListener('change', syncRepeat);
  sform.addEventListener('submit', function (e) {
    e.preventDefault();
    var pc = prefOf(schedFor, true);
    post('/api/schedules', { action: 'tao', quy_trinh: schedFor.id, gio: sform.gio.value, ngay: sform.ngay.value, che_do: sform.che_do.value, ghi_chu: [pc, sform.ghi_chu.value].filter(Boolean).join(' ').slice(0, 500),
      lap: sform.lap.value, den: sform.den.value, tu_dong: !!(schedFor.tu_dong && sform.tu_dong.checked) }).then(function () {
      dialog.close(); sform.ghi_chu.value = '';
      say('Đã hẹn giờ "' + schedFor.ten + '". Tới giờ kết quả sẽ về Việc chờ duyệt.', true);
      loadSched();
    }).catch(function (err) { var m = $('[data-sched-msg]'); m.textContent = err.message; m.style.display = 'block'; });
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var qg = t.closest('[data-qt-tg]');
    if (qg) {
      var p = qg.getAttribute('data-qt-tg').split('|'), wid = p[0], gi = +p[1], v = p.slice(2).join('|');
      var w = data.workflows.filter(function (x) { return x.id === wid; })[0], g = w && w.cong_cu[gi];
      if (!g) return;
      var cur = selG(wid, gi, g), on = cur.indexOf(v) >= 0;
      if (on && g.bat_buoc && cur.length === 1 && !g.san_co) { say('"' + g.vai + '" cần ít nhất 1 app. Chọn app khác trước rồi mới bỏ ' + nameOf(v) + '.'); return; }
      qtSel[wid] = qtSel[wid] || {}; qtSel[wid][gi] = on ? cur.filter(function (x) { return x !== v; }) : cur.concat([v]);
      try { localStorage.setItem('crewzy.qtchon', JSON.stringify(qtSel)); } catch (err) {}
      var row = document.querySelector('[data-grow="' + wid + '|' + gi + '"]');
      if (row) row.outerHTML = groupRow(g, gi, w);
      var rl = document.querySelector('[data-run-link="' + wid + '"]');
      if (rl) rl.setAttribute('href', runHref(w));
      return;
    }
    var gt = t.closest('[data-goto]');
    if (gt) { goTo(gt.getAttribute('data-goto')); return; }
    var d = t.closest('[data-dep]');
    if (d) { dep = d.getAttribute('data-dep'); syncUrl(); render(); return; }
    var ng = t.closest('[data-nganh]');
    if (ng) { nganh = ng.getAttribute('data-nganh'); saveNganh(); syncUrl(); render(); return; }
    var c = t.closest('[data-channel]');
    if (c) { channel = c.getAttribute('data-channel'); syncUrl(); render(); return; }
    var a = t.closest('[data-assign]');
    if (a) {
      a.disabled = true;
      var wa = data.workflows.filter(function (x) { return x.id === a.getAttribute('data-assign'); })[0], pa = wa ? prefOf(wa) : '';
      post('/api/jobs', Object.assign({ action: 'tao', quy_trinh: a.getAttribute('data-assign') }, pa ? { yeu_cau: 'Chạy quy trình "' + wa.ten + '" (mã ' + wa.id + ') của Crewzy. Gọi CREWZY_QUY_TRINH với id "' + wa.id + '" để lấy đúng các bước, làm lần lượt, cuối cùng nộp kết quả bằng CREWZY_NOP_KET_QUA kèm quy_trinh "' + wa.id + '".' + pa } : {})).then(function (r) {
        say('Đã giao "' + r.job.tieu_de + '". Bảo AI của bạn "làm việc Crewzy" (Claude Code: /mcp__crewzy__lam_viec_crewzy) để nó nhận việc.', true);
        a.disabled = false;
      }).catch(function (err) { say(err.message); a.disabled = false; });
      return;
    }
    var s = t.closest('[data-sched]');
    if (s) { openSched(s.getAttribute('data-sched')); return; }
    var sa = t.closest('[data-sact]');
    if (sa) {
      var act = sa.getAttribute('data-sact');
      if (act === 'xoa' && !window.confirm('Xoá lịch này?')) return;
      sa.disabled = true;
      post('/api/schedules', { action: act, id: sa.getAttribute('data-sid') }).then(loadSched).catch(function (err) { say(err.message); });
    }
  });

  Promise.all([
    json('/api/workflows'),
    json('/api/catalog').catch(function () { return { apps: [] }; }),
    json('/api/status?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    json('/api/mcp-servers?uid=' + encodeURIComponent(uid)).catch(function () { return { servers: [] }; }),
    json('/api/brand?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    json('/api/workflows/status?uid=' + encodeURIComponent(uid)).catch(function () { return {}; }),
    loadSched()
  ]).then(function (r) {
    data = r[0];
    (r[1].apps || []).forEach(function (a) { names[a.slug] = a.name; catalogStatus[a.slug] = a.status; });
    industries = r[1].industries || [];
    if (nganh !== 'all' && !industries.some(function (x) { return x.id === nganh; })) nganh = 'all';
    accounts = (r[2] && r[2].accounts) || {};
    mcpUrls = ((r[3] && r[3].servers) || []).map(function (s) { return s.url; });
    var b = (r[4] && r[4].brand) || {};
    brandData = b;
    flowStatus = (r[5] && r[5].status) || {};
    $('[data-brand-warn]').hidden = !!(b.name || b.products);
    render();
    var h = /^#wf-([a-z_]+)$/.exec(location.hash);
    if (h) goTo(h[1]);
  }).catch(function (err) { listEl.innerHTML = ''; say(err.message); });
})();
