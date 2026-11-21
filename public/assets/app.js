// Bộ chạy nhỏ cho bản thử: mỗi trang khai báo window.PAGE_LOGIC = { state, vals(state, set) }.
// data-if="key"      hiện/ẩn theo vals[key]
// data-text="key"    in giá trị vals[key]
// data-click="key"   bấm thì gọi vals[key]()
// data-change="key"  đổi (radio) thì gọi vals[key]()
// data-checked="key" đánh dấu radio theo vals[key]
(function () {
  var logic = window.PAGE_LOGIC;
  if (!logic) return;
  var state = Object.assign({}, logic.state);
  var vals = {};

  function set(patch) {
    state = Object.assign({}, state, patch);
    render();
  }

  function render() {
    vals = logic.vals(state, set);
    document.querySelectorAll('[data-if]').forEach(function (el) {
      el.style.display = vals[el.getAttribute('data-if')] ? 'contents' : 'none';
    });
    document.querySelectorAll('[data-text]').forEach(function (el) {
      el.textContent = vals[el.getAttribute('data-text')];
    });
    document.querySelectorAll('[data-checked]').forEach(function (el) {
      el.checked = !!vals[el.getAttribute('data-checked')];
    });
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-click]');
    if (!target) return;
    var fn = vals[target.getAttribute('data-click')];
    if (typeof fn === 'function') fn();
  });

  document.addEventListener('change', function (e) {
    var target = e.target.closest('[data-change]');
    if (!target) return;
    var fn = vals[target.getAttribute('data-change')];
    if (typeof fn === 'function') fn();
  });

  render();
})();
