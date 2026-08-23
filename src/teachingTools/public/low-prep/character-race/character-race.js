var CW = window.ChenWordlist || null;
var DE = window.DeckExport || null;

var S = {
  chars: [],
  order: [],
  terms: {},
  opts: { targetLanguage: 'english', rings: 'auto', size: 'auto', grid: 20, flower: true },
  title: ''
};
var $ = function (s) { return document.querySelector(s); };
function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1800); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isHan(ch) { return ch >= '一' && ch <= '龥'; }
function pinyinOf(t) { return CW ? CW.toPinyin(t, { spaced: (t || '').length >= 4 }) : ''; }
function englishOf(t) { return CW && typeof CW.toEnglish === 'function' ? CW.toEnglish(t) : ''; }

function targetText(t) {
  var term = S.terms[t] || {};
  return S.opts.targetLanguage === 'english'
    ? (term.en || englishOf(t))
    : (term.py || pinyinOf(t));
}

function targetLanguageName() {
  return S.opts.targetLanguage === 'english' ? 'definition' : 'pinyin';
}

function updateTargetLanguageHint() {
  var hint = $('#targetLanguageHint');
  if (!hint) return;
  var missing = S.order.filter(function (term) { return !targetText(term); }).length;
  hint.textContent = 'Each tile shows the term with its optional ' + targetLanguageName() + ' underneath.' +
    (missing ? ' ' + missing + ' term' + (missing === 1 ? '' : 's') + ' do not have that support line yet.' : '');
}

/* ---------- input ---------- */
// Split subject terms by line, delimiter, or whitespace; keep unspaced Chinese text compatible.
function parseChars(text) {
  var raw = String(text).replace(/　/g, ' ').trim();
  var tokens;
  if (/\r?\n/.test(raw)) {
    tokens = raw.split(/\r?\n/);
  } else if (/[、，,；;\/]/.test(raw)) {
    tokens = raw.split(/[、，,；;\/]+/);
  } else if (/^[一-龥]+$/.test(raw)) {
    tokens = raw.split('');
  } else {
    tokens = raw.split(/\s+/);
  }
  var out = [], seen = {};
  tokens.forEach(function (tk) {
    var t = String(tk || '').trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (seen[t]) return;
    seen[t] = 1;
    out.push(t);
  });
  return out;
}
function parseTerms(text) {
  var raw = String(text || '');
  var terms = [];
  if (/[|｜]/.test(raw)) {
    raw.split(/\r?\n/).forEach(function (line) {
      var parts = line.split(/\s*[|｜]\s*/).map(function (part) { return part.trim(); });
      if (parts.length < 2) {
        parseChars(line).forEach(function (zh) { terms.push({ zh: zh }); });
        return;
      }
      var zh = String(parts[0] || '').trim().replace(/\s+/g, ' ');
      if (!zh) return;
      terms.push({
        zh: zh,
        py: parts.length >= 3 ? parts[1] : '',
        en: parts.length >= 3 ? parts[2] : parts[1]
      });
    });
  } else {
    parseChars(raw).forEach(function (zh) { terms.push({ zh: zh }); });
  }
  return terms;
}

function setTerms(list) {
  var seen = {}, order = [], terms = {};
  list.forEach(function (item) {
    var zh = String(item && item.zh || '').trim().replace(/\s+/g, ' ');
    if (!zh || seen[zh]) return;
    seen[zh] = true;
    terms[zh] = {
      zh: zh,
      py: String(item.py || pinyinOf(zh) || '').trim(),
      en: String(item.en || englishOf(zh) || '').trim()
    };
    order.push(zh);
  });
  S.terms = terms;
  S.chars = order.slice();
  S.order = order;
  renderChips(); renderPreview(); updateTargetLanguageHint();
}
function renderChips() {
  var box = $('#chips'); box.innerHTML = '';
  S.order.forEach(function (ch) {
    var c = el('span', 'chip');
    var target = targetText(ch);
    c.textContent = ch + (target ? ' · ' + target : '');
    box.appendChild(c);
  });
  $('#count').textContent = S.order.length;
  $('#empty').style.display = S.order.length ? 'none' : '';
}

function initLibraryPicker() {
  if (!window.ChenLibraryPicker) return;
  var picker = ChenLibraryPicker.create({
    root: $('#raceLibraryPicker'),
    source: 'wordlists',
    min: 1,
    title: 'Add terms from the library',
    hint: 'Choose one or more vocabulary topics to add their terms to your wheel.',
    importLabel: 'Add terms from selected topics',
    onImport: function (lists) {
      var combined = S.order.map(function (zh) { return S.terms[zh]; });
      var added = 0;
      lists.forEach(function (list) {
        (list.items || []).forEach(function (item) {
          if (!item.zh || S.terms[item.zh]) return;
          combined.push({ zh: item.zh, py: item.py || '', en: item.en || '' });
          added += 1;
        });
      });
      $('#src').value = combined.map(function (item) { return item.zh + ' | ' + item.py + ' | ' + item.en; }).join('\n');
      setTerms(combined);
      if (added) toast('Added ' + added + ' term' + (added === 1 ? '' : 's') + ' from the library.');
      picker.reset();
    }
  });
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
// Font size is chosen from the chord length between adjacent terms so tiles never overlap.
function fitFontSize(R, rings, centerR, withTarget) {
  var maxLen = 1;
  S.order.forEach(function (t) { if (t.length > maxLen) maxLen = t.length; });
  var padW = 0.9;
  var hFactor = 1.55 + (withTarget ? 0.52 : 0);
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
  var fs = fitFontSize(R, rings, cr0, true);
  var need = fs * 1.32 + 10;
  if (need > basePad) {
    R = Math.min(w, h) / 2 - need;
    cr0 = Math.max(38, R * 0.16);
    fs = fitFontSize(R, rings, cr0, true);
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
    var centerText = opt.centerTarget ? (targetText(opt.centerChar) || opt.centerChar) : opt.centerChar;
    var centerFont = Math.max(13, Math.min(cr0 * 0.9, cr0 * 3.2 / Math.max(1, centerText.length)));
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (cr0 * 0.98) + '" fill="#35604C" stroke="#1B2A47" stroke-width="5"/>';
    g += '<text x="' + cx + '" y="' + (cy + centerFont * 0.34) + '" font-size="' + centerFont + '" font-weight="700" fill="#F6C43C" text-anchor="middle">' + esc(centerText) + '</text>';
  } else if (!flower || petalOuter <= cr0 * 1.3) {
    g += '<text x="' + cx + '" y="' + (cy - 2) + '" font-size="' + (cr0 * 0.38) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">TERM</text>';
    g += '<text x="' + cx + '" y="' + (cy + cr0 * 0.45) + '" font-size="' + (cr0 * 0.38) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">RACE</text>';
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
      var target = targetText(tk);
      if (target) {
          var targetFont = Math.max(8, Math.min(fs * 0.34, fs * 2.7 / Math.max(1, target.length)));
          var outward = (y >= cy) ? 1 : -1;
          var targetY = outward > 0 ? (y + pillH / 2 + fs * 0.38) : (y - pillH / 2 - fs * 0.14);
          g += '<text x="' + x + '" y="' + targetY + '" font-size="' + targetFont + '" fill="#3E6E58" text-anchor="middle">' + esc(target) + '</text>';
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
  g += '<text x="' + (w - pad) + '" y="' + (pad + 4) + '" font-size="16" fill="#5A6B57" text-anchor="end">Mark an X here each time your partner finds a term</text>';
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
  g += '<text x="' + (W / 2) + '" y="60" font-size="28" font-weight="700" fill="#F2F6EF" text-anchor="middle">Term Race · ' + esc(S.title || '') + '</text>';
  g += '<text x="30" y="102" font-size="15" fill="#1B2A47">Name ＿＿＿＿＿＿＿＿　Partner ＿＿＿＿＿＿＿＿　Date ＿＿＿＿＿＿</text>';
  var cW = W - 48, cH = 672;
  g += '<g transform="translate(24,116)">' + circleSVG(cW, cH, { pad: 46 }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<g transform="translate(24,800)">' + gridSVG(cW, 262, S.opts.grid, 'Grid').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<text x="' + (W / 2) + '" y="1092" font-size="14" fill="#5A6B57" text-anchor="middle">One partner gives a clue while the other finds the term on the wheel. Mark an X on the grid each round, then switch.</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}

function renderPreview() {
  $('#preview').innerHTML = S.order.length ? circleSVG(900, 640) :
    '<div style="padding:50px;text-align:center;color:#9AA79E">No terms yet</div>';
}

/* ---------- game ---------- */
var G = { target: '', score: 0, miss: 0, left: 60, timer: null, running: false };
function speak(ch) {
  if (!$('#optSpeak').checked) return;
  try {
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(ch);
    u.lang = /[\u3400-\u9fff]/.test(ch) ? 'zh-CN' : 'en-US'; u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function openGame() {
  if (S.order.length < 4) { toast('Add at least 4 terms'); return; }
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
  $('#gstage').innerHTML = circleSVG(1000, 700, { centerChar: G.target, centerTarget: true });
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
  if (!S.order.length) { toast('Add some terms first'); return; }
  var svg = sheetSVG();
  svgToJpegLocal(svg, 794, 1123, function (im) {
    DE.download((S.title || 'term-race') + '.jpg', im.bytes, 'image/jpeg');
  });
}
function exportPDF() {
  if (!S.order.length) { toast('Add some terms first'); return; }
  svgToJpegLocal(sheetSVG(), 794, 1123, function (im) {
    var bytes = DE.buildPDF([im], { pageWidth: 595, pageHeight: 842 });
    DE.download((S.title || 'term-race') + '.pdf', bytes, 'application/pdf');
    toast('PDF ready');
  });
}
function exportPPTX() {
  if (!S.order.length) { toast('Add some terms first'); return; }
  svgToJpegLocal(circleSVG(1600, 900), 1600, 900, function (im) {
    var bytes = DE.buildPPTX([im]);
    DE.download((S.title || 'term-race') + '.pptx', bytes,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    toast('PPTX ready (for screen display)');
  });
}
function doPrint(copies) {
  if (!S.order.length) { toast('Add some terms first'); return; }
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
    var got = parseTerms($('#src').value);
    if (!got.length) { toast('No terms found.'); return; }
    setTerms(got); toast('Loaded ' + got.length + ' terms');
  });
  $('#btnDemo').addEventListener('click', function () {
    $('#src').value = 'hypothesis | | a testable explanation\nevidence | | information that supports a claim\nvariable | | a factor that can change\nobserve | | notice and record\nmeasure | | find a quantity\ncompare | | find similarities and differences\npattern | | something that repeats\nresult | | what happened\nrevise | | improve after reviewing';
    $('#title').value = 'Scientific Thinking · Core Terms';
    S.title = $('#title').value;
    setTerms(parseTerms($('#src').value));
  });
  initLibraryPicker();
  $('#btnFromList').addEventListener('click', function () {
    if (!CW) { toast('Needs wordlist-core.js'); return; }
    var all = CW.listAll();
    if (!all.length) { toast('No saved word lists yet'); return; }
    var names = all.map(function (r, i) { return (i + 1) + '. ' + r.name + ' (' + r.count + ')'; }).join('\n');
    var k = parseInt(prompt('Pick a word list, enter its number:\n' + names, '1'), 10) - 1;
    if (isNaN(k) || !all[k]) return;
    var list = CW.load(all[k].id);
    if (!list) return;
    var terms = list.items.map(function (it) { return { zh: it.zh || '', py: it.py || '', en: it.en || '' }; });
    $('#src').value = terms.map(function (item) { return item.zh + ' | ' + item.py + ' | ' + item.en; }).join('\n');
    if (!$('#title').value) { $('#title').value = list.name; S.title = list.name; }
    setTerms(terms);
  });
  $('#btnShuffle').addEventListener('click', function () {
    for (var i = S.order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = S.order[i]; S.order[i] = S.order[j]; S.order[j] = t;
    }
    renderChips(); renderPreview(); toast('Positions shuffled');
  });
  $('#btnClear').addEventListener('click', function () { setTerms([]); });
  $('#title').addEventListener('input', function () { S.title = this.value; });

  $('#optTargetLanguage').addEventListener('change', function () {
    S.opts.targetLanguage = this.value;
    renderChips(); renderPreview(); updateTargetLanguageHint();
  });
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

  renderChips(); renderPreview(); updateTargetLanguageHint();
});
