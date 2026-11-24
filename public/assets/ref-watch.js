// "AI xem mẫu" ngay trên trình duyệt (25/11): Claude/ChatGPT không mở được video, nên Crewzy tự xem trước rồi đưa AI khung hình + lời thoại.
// window.crewzyWatchRef(nguồn, { kind: 'video'|'image', onProgress(%, chữ) }) → { thoi_luong, rong, cao, cat, khung:[{t, jpg, cat}], am_thanh:[wav base64] }
// nguồn = File hoặc link cùng trang (/api/media/…) — link TikTok/YouTube bị chặn đọc khung hình nên phải tải file lên.
(function () {
  var SMALL_W = 48, SMALL_H = 27;
  var MAX_KEY = 20, KEY_SIDE = 512, IMG_SIDE = 1024;
  var CHUNK_SEC = 55, MAX_CHUNKS = 4, RATE = 16000;

  function srcOf(source) { return typeof source === 'string' ? source : URL.createObjectURL(source); }
  function b64(dataUrl) { return dataUrl.slice(dataUrl.indexOf(',') + 1); }
  function fit(w, h, side) { var k = Math.min(1, side / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }

  function loadVideo(src) {
    return new Promise(function (ok, fail) {
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      var t = setTimeout(function () { fail(new Error('Video mở quá lâu.')); }, 30000);
      v.onloadeddata = function () { clearTimeout(t); ok(v); };
      v.onerror = function () { clearTimeout(t); fail(new Error('Trình duyệt không mở được video này (thử file .mp4).')); };
      v.src = src;
    });
  }
  function seek(v, t) {
    return new Promise(function (ok) {
      var done = false;
      function fin() { if (!done) { done = true; v.removeEventListener('seeked', fin); ok(); } }
      v.addEventListener('seeked', fin);
      setTimeout(fin, 4000);
      v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
    });
  }

  // Đo chuyển cảnh: so ảnh nhỏ 48×27 giữa hai lần lấy mẫu; đổi khác nhiều = một lần cắt.
  async function detectCuts(v, onProgress) {
    var dur = v.duration, step = Math.min(2, Math.max(0.2, dur / 240));
    var c = document.createElement('canvas'); c.width = SMALL_W; c.height = SMALL_H;
    var g = c.getContext('2d', { willReadFrequently: true });
    var prev = null, cuts = [], n = Math.floor(dur / step);
    for (var i = 0; i <= n; i++) {
      var t = i * step;
      await seek(v, t);
      g.drawImage(v, 0, 0, SMALL_W, SMALL_H);
      var d = g.getImageData(0, 0, SMALL_W, SMALL_H).data;
      if (prev) {
        var sum = 0;
        for (var j = 0; j < d.length; j += 4) sum += Math.abs(d[j] - prev[j]) + Math.abs(d[j + 1] - prev[j + 1]) + Math.abs(d[j + 2] - prev[j + 2]);
        var diff = sum / (SMALL_W * SMALL_H * 3 * 255);
        if (diff > 0.14 && (!cuts.length || t - cuts[cuts.length - 1] > 0.5)) cuts.push(+t.toFixed(2));
      }
      prev = d;
      if (onProgress && i % 8 === 0) onProgress(5 + Math.round(45 * i / Math.max(1, n)), 'Đang xem từng cảnh…');
    }
    return cuts;
  }

  function pickTimes(dur, cuts) {
    var times = [{ t: Math.min(0.3, dur / 2), cat: false }];
    var pool = cuts.map(function (c) { return { t: c + 0.15, cat: true }; });
    if (pool.length > MAX_KEY - 4) { var k = pool.length / (MAX_KEY - 4), sel = []; for (var i = 0; i < MAX_KEY - 4; i++) sel.push(pool[Math.floor(i * k)]); pool = sel; }
    times = times.concat(pool);
    // Đều tay thêm để không sót đoạn dài không cắt (người dẫn nói liền).
    for (var e = 1; e <= 7; e++) {
      var te = dur * e / 8;
      if (!times.some(function (x) { return Math.abs(x.t - te) < dur / 16; })) times.push({ t: te, cat: false });
    }
    times.push({ t: Math.max(0, dur - 0.4), cat: false });
    times.sort(function (a, b) { return a.t - b.t; });
    return times.filter(function (x, i) { return !i || x.t - times[i - 1].t > 0.3; }).slice(0, MAX_KEY + 4);
  }

  async function grabFrames(v, times, onProgress) {
    var wh = fit(v.videoWidth, v.videoHeight, KEY_SIDE);
    var c = document.createElement('canvas'); c.width = wh[0]; c.height = wh[1];
    var g = c.getContext('2d');
    var out = [];
    for (var i = 0; i < times.length; i++) {
      await seek(v, times[i].t);
      g.drawImage(v, 0, 0, wh[0], wh[1]);
      out.push({ t: +times[i].t.toFixed(2), cat: times[i].cat, jpg: b64(c.toDataURL('image/jpeg', 0.72)) });
      if (onProgress) onProgress(50 + Math.round(25 * (i + 1) / times.length), 'Đang chụp khung hình…');
    }
    return out;
  }

  function wavB64(samples) {
    var buf = new ArrayBuffer(44 + samples.length * 2), dv = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, RATE, true);
    dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, samples.length * 2, true);
    for (var i = 0; i < samples.length; i++) { var s = Math.max(-1, Math.min(1, samples[i])); dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    var bytes = new Uint8Array(buf), bin = '';
    for (var j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
    return btoa(bin);
  }

  // Tách tiếng → 16 kHz một kênh → các đoạn WAV 55 giây (tối đa 4 đoạn ≈ 3,6 phút đầu) cho Whisper.
  async function extractAudio(source) {
    try {
      var data = typeof source === 'string' ? await (await fetch(source)).arrayBuffer() : await source.arrayBuffer();
      var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Off) return [];
      var decoded = await new Off(1, 1, 44100).decodeAudioData(data);
      var secs = Math.min(decoded.duration, CHUNK_SEC * MAX_CHUNKS);
      var ctx = new Off(1, Math.ceil(secs * RATE), RATE);
      var node = ctx.createBufferSource(); node.buffer = decoded; node.connect(ctx.destination); node.start(0);
      var pcm = (await ctx.startRendering()).getChannelData(0);
      var peak = 0;
      for (var p = 0; p < pcm.length; p += 50) peak = Math.max(peak, Math.abs(pcm[p]));
      if (peak < 0.01) return []; // video câm
      var out = [];
      for (var i = 0; i < pcm.length && out.length < MAX_CHUNKS; i += CHUNK_SEC * RATE) out.push(wavB64(pcm.subarray(i, i + CHUNK_SEC * RATE)));
      return out;
    } catch (e) { return []; }
  }

  async function watchImage(source) {
    var src = srcOf(source);
    var img = await new Promise(function (ok, fail) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { fail(new Error('Không mở được ảnh.')); }; i.src = src; });
    var wh = fit(img.naturalWidth, img.naturalHeight, IMG_SIDE);
    var c = document.createElement('canvas'); c.width = wh[0]; c.height = wh[1];
    c.getContext('2d').drawImage(img, 0, 0, wh[0], wh[1]);
    if (typeof source !== 'string') URL.revokeObjectURL(src);
    return { rong: img.naturalWidth, cao: img.naturalHeight, khung: [{ t: 0, jpg: b64(c.toDataURL('image/jpeg', 0.82)) }] };
  }

  window.crewzyWatchRef = async function (source, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress;
    if (opts.kind === 'image') return watchImage(source);
    var src = srcOf(source);
    if (onProgress) onProgress(2, 'Đang mở video…');
    var v = await loadVideo(src);
    try {
      var dur = v.duration;
      if (!isFinite(dur) || dur <= 0) throw new Error('Không đọc được độ dài video.');
      var cuts = await detectCuts(v, onProgress);
      var khung = await grabFrames(v, pickTimes(dur, cuts), onProgress);
      if (onProgress) onProgress(78, 'Đang tách lời thoại…');
      var am = await extractAudio(source);
      if (onProgress) onProgress(85, 'AI đang phân tích cách dựng…');
      return { thoi_luong: +dur.toFixed(2), rong: v.videoWidth, cao: v.videoHeight, cat: cuts, khung: khung, am_thanh: am };
    } finally {
      v.removeAttribute('src'); v.load();
      if (typeof source !== 'string') URL.revokeObjectURL(src);
    }
  };
})();
