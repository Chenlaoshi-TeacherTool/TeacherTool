var CW = window.ChenWordlist || null;
var DE = window.DeckExport || null;

var S = {
  chars: [],
  order: [],
  opts: { pinyin: true, rings: 'auto', size: 'auto', grid: 20, flower: true },
  title: ''
};
var $ = function (s) { return document.querySelector(s); };
function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1800); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isHan(ch) { return ch >= '一' && ch <= '龥'; }
function pinyinOf(t) { return CW ? CW.toPinyin(t, { spaced: (t || '').length >= 4 }) : ''; }

/* ---------- input ---------- */
// space / comma / newline present -> split by word; otherwise split by single character
function parseChars(text) {
  var raw = String(text).replace(/　/g, ' ');
  var hasSep = /[\s、，,；;\/|]/.test(raw.trim());
  var tokens;
  if (hasSep) {
    tokens = raw.split(/[\s、，,；;\/|]+/);
  } else {
    tokens = raw.split('');
  }
  var out = [], seen = {};
  tokens.forEach(function (tk) {
    var t = tk.replace(/[^一-龥]/g, '');
    if (!t) return;
    if (seen[t]) return;
    seen[t] = 1;
    out.push(t);
  });
  return out;
}
function setChars(list) {
  S.chars = list;
  S.order = list.slice();
  renderChips(); renderPreview();
}
function renderChips() {
  var box = $('#chips'); box.innerHTML = '';
  S.order.forEach(function (ch) { var c = el('span', 'chip'); c.textContent = ch; box.appendChild(c); });
  $('#count').textContent = S.order.length;
  $('#empty').style.display = S.order.length ? 'none' : '';
}

/* ---------- circle layout ---------- */
function layout() {
  var n = S.order.length;
  var want = S.opts.rings === 'auto' ? (n > 30 ? 3 : n > 16 ? 2 : 1) : +S.opts.rings;
  if (want === 1 || n < 8) return [{ chars: S.order, r: 1 }];
  var radii = want >= 3 ? [1, 0.68, 0.40] : [1, 0.52];
  var total = radii.reduce(function (a, b) { return a + b; }, 0);
  var out = [], used = 0;
  radii.forEach(function (r, i) {
    var take = (i === radii.length - 1) ? (n - used) : Math.round(n * r / total);
    take = Math.max(take, 1);
    out.push({ chars: S.order.slice(used, used + take), r: r });
    used += take;
  });
  return out.filter(function (ring) { return ring.chars.length; });
}
// Font size is chosen from the chord length between adjacent characters so tiles never overlap
function fitFontSize(R, rings, centerR, withPinyin) {
  var maxLen = 1;
  S.order.forEach(function (t) { if (t.length > maxLen) maxLen = t.length; });
  var padW = 0.9;
  var hFactor = 1.55 + (withPinyin ? 0.52 : 0);
  var chordFactor = 0.9, radialFactor = 0.92;
  var best = 1e9, i;
  rings.forEach(function (ring) {
    var m = Math.max(ring.chars.length, 1);
    var rr = R * ring.r;
    var chord = m === 1 ? rr * 1.6 : 2 * rr * Math.sin(Math.PI / m);
    best = Math.min(best, chord * chordFactor / (maxLen + padW));
  });
  for (i = 0; i + 1 < rings.length; i++) {
    var radial = R * rings[i].r - R * rings[i + 1].r;
    best = Math.min(best, radial * radialFactor / hFactor);
  }
  if (rings.length > 1) {
    var innermost = (R * rings[rings.length - 1].r - centerR - 8) * 2;
    best = Math.min(best, innermost / hFactor);
  }
  return Math.max(11, Math.min(best, R * 0.155));
}
// Sunflower: petals + seed head (matches the site's logo language)
function sunflowerG(cx, cy, rOut, rSeed, petals) {
  var g = '', i;
  for (i = 0; i < petals; i++) {
    var a = (i / petals) * 360;
    var pl = (rOut - rSeed * 0.9);
    var ry = pl / 2, rx = Math.max(6, (2 * Math.PI * rOut / petals) * 0.30);
    var cyP = cy - (rSeed * 0.9 + ry);
    g += '<ellipse cx="' + cx + '" cy="' + cyP + '" rx="' + rx + '" ry="' + ry + '" fill="#F6C43C" stroke="#1B2A47" stroke-width="' + Math.max(2, rx * 0.14) + '" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>';
  }
  g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rSeed + '" fill="#4A3520" stroke="#1B2A47" stroke-width="' + Math.max(3, rSeed * 0.09) + '"/>';
  var dots = Math.min(14, Math.max(6, Math.round(rSeed / 7)));
  for (i = 0; i < dots; i++) {
    var ang = i * 2.39996, rad = rSeed * 0.62 * Math.sqrt((i + 1) / dots);
    g += '<circle cx="' + (cx + rad * Math.cos(ang)) + '" cy="' + (cy + rad * Math.sin(ang)) + '" r="' + Math.max(1.6, rSeed * 0.05) + '" fill="#6B4E30"/>';
  }
  return g;
}
function leafG(cx, cy, len, rot) {
  return '<g transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')">' +
    '<path d="M' + cx + ' ' + cy + ' q' + (len * 0.5) + ' -' + (len * 0.5) + ' ' + len + ' 0 q-' + (len * 0.5) + ' ' + (len * 0.5) + ' -' + len + ' 0z" ' +
    'fill="#5A9E4B" stroke="#1B2A47" stroke-width="' + Math.max(2, len * 0.07) + '" stroke-linejoin="round"/></g>';
}

function circleSVG(w, h, opt) {
  opt = opt || {};
  var cx = w / 2, cy = h / 2;
  var rings = layout();
  var basePad = opt.pad || 70;
  var R = Math.min(w, h) / 2 - basePad;
  var cr0 = Math.max(42, R * 0.16);
  var fs = fitFontSize(R, rings, cr0, S.opts.pinyin);
  var need = fs * (S.opts.pinyin ? 1.32 : 0.95) + 10;
  if (need > basePad) {
    R = Math.min(w, h) / 2 - need;
    cr0 = Math.max(38, R * 0.16);
    fs = fitFontSize(R, rings, cr0, S.opts.pinyin);
  }
  if (S.opts.size !== 'auto') fs = Math.min(+S.opts.size, fs * 1.3);
  var pillH = fs * 1.5;
  var flower = S.opts.flower !== false;

  var g = '';
  g += '<rect width="' + w + '" height="' + h + '" fill="#FBF6E9"/>';

  var innerR = R * rings[rings.length - 1].r;
  var petalOuter = innerR - pillH * 0.62 - 8;

  if (flower && petalOuter > cr0 * 1.3) {
    g += leafG(cx - petalOuter * 0.86, cy + petalOuter * 0.68, petalOuter * 0.52, 28);
    g += leafG(cx + petalOuter * 0.34, cy + petalOuter * 0.68, petalOuter * 0.52, -28);
    var petals = Math.max(10, Math.min(18, rings[rings.length - 1].chars.length));
    g += sunflowerG(cx, cy, petalOuter, cr0, petals);
  } else {
    rings.forEach(function (ring) {
      g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * ring.r) + '" fill="none" stroke="#D6E2CE" stroke-width="3" stroke-dasharray="10 10"/>';
    });
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + cr0 + '" fill="#35604C" stroke="#1B2A47" stroke-width="6"/>';
  }

  if (opt.centerChar) {
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (cr0 * 0.98) + '" fill="#35604C" stroke="#1B2A47" stroke-width="5"/>';
    g += '<text x="' + cx + '" y="' + (cy + cr0 * 0.34) + '" font-size="' + (cr0 * 0.9) + '" font-weight="700" fill="#F6C43C" text-anchor="middle">' + esc(opt.centerChar) + '</text>';
  } else if (!flower || petalOuter <= cr0 * 1.3) {
    g += '<text x="' + cx + '" y="' + (cy - 2) + '" font-size="' + (cr0 * 0.42) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">汉字</text>';
    g += '<text x="' + cx + '" y="' + (cy + cr0 * 0.5) + '" font-size="' + (cr0 * 0.42) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">快跑</text>';
  }

  var idx = 0;
  rings.forEach(function (ring, ri) {
    var m = ring.chars.length;
    ring.chars.forEach(function (tk, i) {
      var a = (i / m) * Math.PI * 2 - Math.PI / 2 + (ri ? Math.PI / m : 0);
      var rr = R * ring.r;
      var x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      var pw = Math.max(pillH, tk.length * fs + fs * 0.78);
      g += '<g class="hz" data-ch="' + esc(tk) + '" data-i="' + idx + '">';
      g += '<rect x="' + (x - pw / 2) + '" y="' + (y - pillH / 2) + '" width="' + pw + '" height="' + pillH + '" rx="' + (pillH / 2) + '" fill="#fff" stroke="#1B2A47" stroke-width="' + Math.max(2.5, fs * 0.09) + '"/>';
      g += '<text x="' + x + '" y="' + (y + fs * 0.35) + '" font-size="' + fs + '" font-weight="700" fill="#1B2A47" text-anchor="middle">' + esc(tk) + '</text>';
      if (S.opts.pinyin) {
        var pyv = pinyinOf(tk);
        if (pyv) {
          var outward = (y >= cy) ? 1 : -1;
          var pyY = outward > 0 ? (y + pillH / 2 + fs * 0.38) : (y - pillH / 2 - fs * 0.14);
          g += '<text x="' + x + '" y="' + pyY + '" font-size="' + (fs * 0.33) + '" fill="#3E6E58" text-anchor="middle">' + esc(pyv) + '</text>';
        }
      }
      g += '</g>';
      idx++;
    });
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}

/* ---------- grid paper ---------- */
function gridSVG(w, h, cells, label) {
  var cols = cells <= 16 ? 4 : 5;
  var rows = Math.ceil(cells / cols);
  var pad = 26;
  var cw = (w - pad * 2) / cols, chh = (h - pad * 2 - 34) / rows;
  var g = '<rect width="' + w + '" height="' + h + '" fill="#fff"/>';
  g += '<text x="' + pad + '" y="' + (pad + 4) + '" font-size="22" font-weight="700" fill="#1B2A47">' + esc(label || 'Grid') + '</text>';
  g += '<text x="' + (w - pad) + '" y="' + (pad + 4) + '" font-size="16" fill="#5A6B57" text-anchor="end">Mark an X here each time your partner finds a character</text>';
  for (var i = 0; i < cells; i++) {
    var r = Math.floor(i / cols), c = i % cols;
    var x = pad + c * cw, y = pad + 22 + r * chh;
    g += '<rect x="' + x + '" y="' + y + '" width="' + (cw - 6) + '" height="' + (chh - 6) + '" fill="#FBF6E9" stroke="#1B2A47" stroke-width="3"/>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}

/* ---------- A4 print sheet ---------- */
function sheetSVG() {
  var W = 794, H = 1123;
  var g = '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
  g += '<rect x="24" y="24" width="' + (W - 48) + '" height="54" rx="12" fill="#35604C" stroke="#1B2A47" stroke-width="4"/>';
  g += '<text x="' + (W / 2) + '" y="60" font-size="28" font-weight="700" fill="#F2F6EF" text-anchor="middle">Character Race　' + esc(S.title || '') + '</text>';
  g += '<text x="30" y="102" font-size="15" fill="#1B2A47">Name ＿＿＿＿＿＿＿＿　Partner ＿＿＿＿＿＿＿＿　Date ＿＿＿＿＿＿</text>';
  var cW = W - 48, cH = 672;
  g += '<g transform="translate(24,116)">' + circleSVG(cW, cH, { pad: 46 }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<g transform="translate(24,800)">' + gridSVG(cW, 262, S.opts.grid, 'Grid').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<text x="' + (W / 2) + '" y="1092" font-size="14" fill="#5A6B57" text-anchor="middle">One partner calls out a character while the other finds it on the wheel. The caller marks an X on the grid each round, then switch.</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}

function renderPreview() {
  $('#preview').innerHTML = S.order.length ? circleSVG(900, 640) :
    '<div style="padding:50px;text-align:center;color:#9AA79E">No characters yet</div>';
}

/* ---------- game ---------- */
var G = { target: '', score: 0, miss: 0, left: 60, timer: null, running: false };
function speak(ch) {
  if (!$('#optSpeak').checked) return;
  try {
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(ch);
    u.lang = 'zh-CN'; u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function openGame() {
  if (S.order.length < 4) { toast('Add at least 4 characters'); return; }
  $('#game').classList.add('open');
  G.score = 0; G.miss = 0; G.left = +$('#gtime').value || 60; G.running = false; G.target = '';
  drawGame();
  if ($('#game').requestFullscreen) $('#game').requestFullscreen().catch(function () {});
}
function closeGame() {
  stopTimer();
  $('#game').classList.remove('open');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
}
function drawGame() {
  $('#gstage').innerHTML = circleSVG(1000, 700, { centerChar: G.target });
  $('#gscore').textContent = G.score;
  $('#gmiss').textContent = G.miss;
  $('#gleft').textContent = G.left;
  var svg = $('#gstage svg');
  Array.prototype.forEach.call(svg.querySelectorAll('.hz'), function (node) {
    node.style.cursor = 'pointer';
    node.addEventListener('click', function () { guess(node.getAttribute('data-ch'), node); });
  });
}
function nextTarget() {
  var pool = S.order.filter(function (c) { return c !== G.target; });
  G.target = pool[Math.floor(Math.random() * pool.length)];
  drawGame();
  speak(G.target);
}
function guess(ch, node) {
  if (!G.target) { nextTarget(); return; }
  var shape = node.querySelector('rect, circle');
  if (!shape) return;
  if (ch === G.target) {
    G.score++;
    shape.setAttribute('fill', '#A9C99A');
    setTimeout(nextTarget, 260);
  } else {
    G.miss++;
    shape.setAttribute('fill', '#F7C9C4');
    setTimeout(function () { shape.setAttribute('fill', '#fff'); }, 380);
    $('#gmiss').textContent = G.miss;
  }
  $('#gscore').textContent = G.score;
}
function startTimer() {
  if (G.running) return;
  G.running = true;
  if (!G.target) nextTarget();
  G.timer = setInterval(function () {
    G.left--;
    $('#gleft').textContent = G.left;
    if (G.left <= 0) {
      stopTimer();
      $('#gstage').innerHTML = '<div style="text-align:center;color:#F2F6EF">' +
        '<div style="font-size:64px;font-weight:700">Time\'s up!</div>' +
        '<div style="font-size:40px;margin-top:14px">' + G.score + ' correct　' + G.miss + ' missed</div></div>';
    }
  }, 1000);
}
function stopTimer() { G.running = false; clearInterval(G.timer); }

/* ---------- export ---------- */
function svgToJpegLocal(svg, w, h, cb) {
  if (!DE) { toast('Missing deck-export.js'); return; }
  DE.svgToJpeg(svg, w, h, 2).then(cb).catch(function () { toast('Export failed'); });
}
function exportPNG() {
  if (!S.order.length) { toast('Add some characters first'); return; }
  var svg = sheetSVG();
  svgToJpegLocal(svg, 794, 1123, function (im) {
    DE.download((S.title || 'character-race') + '.jpg', im.bytes, 'image/jpeg');
  });
}
function exportPDF() {
  if (!S.order.length) { toast('Add some characters first'); return; }
  svgToJpegLocal(sheetSVG(), 794, 1123, function (im) {
    var bytes = DE.buildPDF([im], { pageWidth: 595, pageHeight: 842 });
    DE.download((S.title || 'character-race') + '.pdf', bytes, 'application/pdf');
    toast('PDF ready');
  });
}
function exportPPTX() {
  if (!S.order.length) { toast('Add some characters first'); return; }
  svgToJpegLocal(circleSVG(1600, 900), 1600, 900, function (im) {
    var bytes = DE.buildPPTX([im]);
    DE.download((S.title || 'character-race') + '.pptx', bytes,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    toast('PPTX ready (for screen display)');
  });
}
function doPrint(copies) {
  if (!S.order.length) { toast('Add some characters first'); return; }
  var area = $('#printArea'); area.innerHTML = '';
  for (var i = 0; i < copies; i++) {
    var d = el('div', 'psheet');
    d.innerHTML = sheetSVG();
    area.appendChild(d);
  }
  setTimeout(function () { window.print(); }, 150);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', function () {
  if (!CW) $('#coreWarn').style.display = '';
  if (!window.speechSynthesis) { $('#optSpeak').checked = false; $('#optSpeak').disabled = true; }

  $('#btnMake').addEventListener('click', function () {
    var got = parseChars($('#src').value);
    if (!got.length) { toast('No characters found'); return; }
    setChars(got); toast('Loaded ' + got.length + ' characters');
  });
  $('#btnDemo').addEventListener('click', function () {
    $('#src').value = '你好 谢谢 老师 同学 学校 朋友 高兴 一心一意 马马虎虎';
    $('#title').value = 'Lesson 1 · Common Words';
    S.title = $('#title').value;
    setChars(parseChars($('#src').value));
  });
  $('#btnFromList').addEventListener('click', function () {
    if (!CW) { toast('Needs wordlist-core.js'); return; }
    var all = CW.listAll();
    if (!all.length) { toast('No saved word lists yet'); return; }
    var names = all.map(function (r, i) { return (i + 1) + '. ' + r.name + ' (' + r.count + ')'; }).join('\n');
    var k = parseInt(prompt('Pick a word list, enter its number:\n' + names, '1'), 10) - 1;
    if (isNaN(k) || !all[k]) return;
    var list = CW.load(all[k].id);
    if (!list) return;
    var text = list.items.map(function (it) { return it.zh; }).join('');
    $('#src').value = text;
    if (!$('#title').value) { $('#title').value = list.name; S.title = list.name; }
    setChars(parseChars(text));
  });
  $('#btnShuffle').addEventListener('click', function () {
    for (var i = S.order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = S.order[i]; S.order[i] = S.order[j]; S.order[j] = t;
    }
    renderChips(); renderPreview(); toast('Positions shuffled');
  });
  $('#btnClear').addEventListener('click', function () { setChars([]); });
  $('#title').addEventListener('input', function () { S.title = this.value; });

  $('#optPy').addEventListener('change', function () { S.opts.pinyin = this.checked; renderPreview(); });
  $('#optFlower').addEventListener('change', function () { S.opts.flower = this.checked; renderPreview(); });
  $('#optRings').addEventListener('change', function () { S.opts.rings = this.value; renderPreview(); });
  $('#optSize').addEventListener('change', function () { S.opts.size = this.value; renderPreview(); });
  $('#optGrid').addEventListener('change', function () { S.opts.grid = +this.value; });

  $('#btnGame').addEventListener('click', openGame);
  $('#btnPrint1').addEventListener('click', function () { doPrint(1); });
  $('#btnPrint4').addEventListener('click', function () { doPrint(4); });
  $('#btnPNG').addEventListener('click', exportPNG);
  $('#btnPDF').addEventListener('click', exportPDF);
  $('#btnPPTX').addEventListener('click', exportPPTX);

  $('#gNext').addEventListener('click', nextTarget);
  $('#gStart').addEventListener('click', startTimer);
  $('#gStop').addEventListener('click', stopTimer);
  $('#gAgain').addEventListener('click', function () {
    G.score = 0; G.miss = 0; G.left = +$('#gtime').value || 60; stopTimer(); G.target = ''; drawGame();
  });
  $('#gExit').addEventListener('click', closeGame);
  $('#gSay').addEventListener('click', function () { if (G.target) speak(G.target); });
  document.addEventListener('keydown', function (e) {
    if (!$('#game').classList.contains('open')) return;
    if (e.key === 'Escape') closeGame();
    else if (e.key === ' ') { e.preventDefault(); nextTarget(); }
  });

  renderChips(); renderPreview();
});
