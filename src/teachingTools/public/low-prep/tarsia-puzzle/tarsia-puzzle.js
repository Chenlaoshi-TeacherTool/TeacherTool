var CW = window.ChenWordlist || null;
var DE = window.DeckExport || null;

var S = {
  pairs: [],
  rows: 2,
  cols: 4,
  languages: ['zh', 'en'],
  title: ''
};

var $ = function (s) { return document.querySelector(s); };
function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200); }

/* ---------------- input parsing ---------------- */
// One pair per line: 中文 / english  (accepts / , or a tab as the separator)
function parsePairs(text) {
  var lines = String(text).split(/\n+/);
  var out = [];
  lines.forEach(function (ln) {
    var t = ln.trim();
    if (!t) return;
    var parts = t.split(/[\/\t,，]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length < 2) return;
    out.push({
      zh: parts[0],
      en: parts[1],
      py: parts[2] || autoPinyin(parts[0])
    });
  });
  return out;
}
function setPairs(list) {
  S.pairs = list;
  renderPairList();
  renderPreview();
}
function renderPairList() {
  var box = $('#pairList'); box.innerHTML = '';
  var languages = matchingLanguages();
  var extra = extraLanguage();
  S.pairs.forEach(function (p) {
    var c = el('span', 'chip');
    var labels = languages.map(function (language) { return termFor(p, language); });
    if (extra) labels.push(termFor(p, extra));
    c.textContent = labels.join(' / ');
    box.appendChild(c);
  });
  $('#count').textContent = S.pairs.length;
  $('#empty').style.display = S.pairs.length ? 'none' : '';
}

/* ---------------- tarsia grid geometry ---------------- */
// Every unit cell is split by both diagonals into 4 triangles (top/right/bottom/left).
// Horizontally touching triangles (right of a cell + left of its neighbor) and vertically
// touching triangles (bottom of a cell + top of the cell below) each form one matching slot —
// one triangle gets the Chinese term, its neighbor gets the English term.
function buildSlots(rows, cols) {
  var slots = [];
  var r, c;
  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols - 1; c++) {
      slots.push({ a: { r: r, c: c, side: 'right' }, b: { r: r, c: c + 1, side: 'left' } });
    }
  }
  for (r = 0; r < rows - 1; r++) {
    for (c = 0; c < cols; c++) {
      slots.push({ a: { r: r, c: c, side: 'bottom' }, b: { r: r + 1, c: c, side: 'top' } });
    }
  }
  return slots;
}
// The four outer-facing triangles per border cell have no neighbor to match with —
// they still get a term each (cycling back through the word list) so the sheet reads as full.
function buildBorderSlots(rows, cols) {
  var slots = [], r, c;
  for (c = 0; c < cols; c++) { slots.push({ r: 0, c: c, side: 'top' }); }
  for (c = 0; c < cols; c++) { slots.push({ r: rows - 1, c: c, side: 'bottom' }); }
  for (r = 0; r < rows; r++) { slots.push({ r: r, c: 0, side: 'left' }); }
  for (r = 0; r < rows; r++) { slots.push({ r: r, c: cols - 1, side: 'right' }); }
  return slots;
}
function shrinkFont(text, base, vertical) {
  var len = String(text || '').length;
  var cap = vertical ? 7 : 9;
  if (len <= cap) return base;
  return Math.max(9, base * (cap / len));
}

var LANGUAGE_ORDER = ['zh', 'en', 'py'];

function autoPinyin(text) {
  if (CW && typeof CW.toPinyin === 'function') return CW.toPinyin(text || '', { spaced: true });
  return '';
}

function matchingLanguages() {
  return LANGUAGE_ORDER.filter(function (language) {
    return S.languages.indexOf(language) !== -1;
  }).slice(0, 2);
}

function extraLanguage() {
  var matching = matchingLanguages();
  return LANGUAGE_ORDER.find(function (language) {
    return S.languages.indexOf(language) !== -1 && matching.indexOf(language) === -1;
  }) || null;
}

function termFor(pair, language) {
  if (language === 'py') return pair.py || autoPinyin(pair.zh) || pair.zh;
  if (language === 'en') return pair.en || pair.zh;
  return pair.zh || pair.en || pair.py;
}

function hasTerm(pair, language) {
  if (language === 'py') return !!(pair.py || autoPinyin(pair.zh));
  return !!pair[language];
}
// Main label: sits parallel to the triangle's own outer (cross-cell) edge.
function triangleSVG(cellR, cellC, side, s, text, fontBase) {
  var x0 = cellC * s, y0 = cellR * s, cx = x0 + s / 2, cy = y0 + s / 2;
  var tx, ty, rot = 0, vertical = (side === 'left' || side === 'right');
  if (side === 'top') { tx = cx; ty = y0 + s * 0.20; }
  else if (side === 'bottom') { tx = cx; ty = y0 + s * 0.80; }
  else if (side === 'left') { tx = x0 + s * 0.20; ty = cy; rot = -90; }
  else { tx = x0 + s * 0.80; ty = cy; rot = 90; }
  if (!text) return '';
  var fs = shrinkFont(text, fontBase, vertical);
  return '<g transform="rotate(' + rot + ' ' + tx + ' ' + ty + ')">' +
    '<text x="' + tx + '" y="' + ty + '" font-size="' + fs + '" font-weight="700" fill="#1B2A47" text-anchor="middle" dominant-baseline="middle">' + esc(text) + '</text></g>';
}
// Secondary label (e.g. pinyin): sits parallel to one of the triangle's two diagonal
// (same-cell) edges instead of stacking under the main label, per-side so it never
// collides with the same edge's label drawn by the neighboring triangle that shares it.
function diagonalTextSVG(cellR, cellC, side, s, text, fontSize) {
  if (!text) return '';
  var x0 = cellC * s, y0 = cellR * s;
  var mid, dir; // dir = unit-ish offset pushing the label into this triangle's own interior
  if (side === 'top') { mid = [x0 + s * 0.25, y0 + s * 0.25]; dir = [1, -1]; }
  else if (side === 'left') { mid = [x0 + s * 0.25, y0 + s * 0.25]; dir = [-1, 1]; }
  else if (side === 'bottom') { mid = [x0 + s * 0.75, y0 + s * 0.75]; dir = [-1, 1]; }
  else { mid = [x0 + s * 0.75, y0 + s * 0.75]; dir = [1, -1]; }
  var off = s * 0.12;
  var tx = mid[0] + dir[0] * off, ty = mid[1] + dir[1] * off;
  return '<g transform="rotate(45 ' + tx + ' ' + ty + ')">' +
    '<text x="' + tx + '" y="' + ty + '" font-size="' + fontSize + '" fill="#3E6E58" text-anchor="middle" dominant-baseline="middle">' + esc(text) + '</text></g>';
}
function gridSVG() {
  var rows = S.rows, cols = S.cols, s = 150, pad = 24;
  var W = cols * s + pad * 2, H = rows * s + pad * 2;
  var slots = buildSlots(rows, cols);
  var need = slots.length;
  var pairs = S.pairs;
  var used = Math.min(need, pairs.length);
  var g = '<rect width="' + W + '" height="' + H + '" fill="#FBF6E9"/>';
  g += '<g transform="translate(' + pad + ',' + pad + ')">';
  g += '<rect x="0" y="0" width="' + (cols * s) + '" height="' + (rows * s) + '" fill="#fff" stroke="#1B2A47" stroke-width="4"/>';
  var r, c;
  // Column and row separators so each cell is a fully closed square — without these the
  // diagonals of neighboring cells silently merge into one undivided diamond.
  for (c = 1; c < cols; c++) {
    g += '<path d="M' + (c * s) + ' 0 L' + (c * s) + ' ' + (rows * s) + '" stroke="#1B2A47" stroke-width="4" fill="none"/>';
  }
  for (r = 1; r < rows; r++) {
    g += '<path d="M0 ' + (r * s) + ' L' + (cols * s) + ' ' + (r * s) + '" stroke="#1B2A47" stroke-width="4" fill="none"/>';
  }
  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      var x0 = c * s, y0 = r * s;
      g += '<path d="M' + x0 + ' ' + y0 + ' L' + (x0 + s) + ' ' + (y0 + s) + ' M' + (x0 + s) + ' ' + y0 + ' L' + x0 + ' ' + (y0 + s) + '" stroke="#1B2A47" stroke-width="2.5" fill="none"/>';
    }
  }
  var fontBase = Math.max(13, s * 0.135);
  var diagFont = fontBase * 0.62;
  var matching = matchingLanguages();
  var extra = extraLanguage();
  var extraAnchor = matching.indexOf('zh') !== -1 ? 'zh' : matching[0];
  function drawWord(slotEnd, text, language, pair) {
    g += triangleSVG(slotEnd.r, slotEnd.c, slotEnd.side, s, text, fontBase);
    // The optional third language uses the triangle's diagonal edge, so it remains
    // readable without taking over another matching edge.
    if (extra && language === extraAnchor) {
      g += diagonalTextSVG(slotEnd.r, slotEnd.c, slotEnd.side, s, termFor(pair, extra), diagFont);
    }
  }
  for (var i = 0; i < used; i++) {
    var slot = slots[i], pair = pairs[i];
    var firstLanguage = matching[0], secondLanguage = matching[1];
    var firstOnA = Math.random() < 0.5;
    var firstEnd = firstOnA ? slot.a : slot.b;
    var secondEnd = firstOnA ? slot.b : slot.a;
    drawWord(firstEnd, termFor(pair, firstLanguage), firstLanguage, pair);
    drawWord(secondEnd, termFor(pair, secondLanguage), secondLanguage, pair);
  }
  if (pairs.length) {
    var flat = [];
    pairs.forEach(function (p) {
      matching.forEach(function (language) {
        flat.push({ text: termFor(p, language), language: language, pair: p });
      });
    });
    var border = buildBorderSlots(rows, cols);
    border.forEach(function (slot, bi) {
      var term = flat[bi % flat.length];
      drawWord(slot, term.text, term.language, term.pair);
    });
  }
  g += '</g>';
  if (S.title) {
    g += '<text x="' + (W / 2) + '" y="18" font-size="15" font-weight="700" fill="#5A6B57" text-anchor="middle">' + esc(S.title) + '</text>';
  }
  return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>', need: need, used: used };
}
function renderPreview() {
  var box = $('#preview');
  if (!S.pairs.length) {
    box.innerHTML = '<div style="padding:50px;text-align:center;color:#9AA79E">Add some word pairs to build the puzzle</div>';
    $('#slotinfo').textContent = '';
    return;
  }
  var out = gridSVG();
  box.innerHTML = out.svg;
  var msg;
  if (out.need > out.used) {
    msg = 'Grid has ' + out.need + ' slots, only ' + out.used + ' filled — add more pairs or shrink the grid.';
  } else if (out.need < S.pairs.length) {
    msg = 'Grid has ' + out.need + ' slots — only the first ' + out.need + ' of ' + S.pairs.length + ' pairs were used. Add rows/columns to fit them all.';
  } else {
    msg = 'Grid has exactly ' + out.need + ' slots — every pair fits.';
  }
  if (S.languages.indexOf('py') !== -1 && S.pairs.some(function (p) { return !p.py; })) {
    msg += ' Missing pinyin was generated automatically from the Chinese term.';
  }
  $('#slotinfo').textContent = msg;
}

/* ---------------- export ---------------- */
function svgToJpegLocal(svg, w, h, cb) {
  if (!DE) { toast('Missing deck-export.js'); return; }
  DE.svgToJpeg(svg, w, h, 2).then(cb).catch(function () { toast('Export failed'); });
}
function currentDims() {
  var s = 150, pad = 24;
  return { w: S.cols * s + pad * 2, h: S.rows * s + pad * 2 };
}
function exportPNG() {
  if (!S.pairs.length) { toast('Add some word pairs first'); return; }
  var d = currentDims();
  svgToJpegLocal(gridSVG().svg, d.w, d.h, function (im) {
    DE.download((S.title || 'tarsia-puzzle') + '.jpg', im.bytes, 'image/jpeg');
  });
}
function exportPDF() {
  if (!S.pairs.length) { toast('Add some word pairs first'); return; }
  var d = currentDims();
  svgToJpegLocal(gridSVG().svg, d.w, d.h, function (im) {
    var bytes = DE.buildPDF([im], { pageWidth: 842, pageHeight: 595 });
    DE.download((S.title || 'tarsia-puzzle') + '.pdf', bytes, 'application/pdf');
    toast('PDF ready');
  });
}
function doPrint() {
  if (!S.pairs.length) { toast('Add some word pairs first'); return; }
  var area = $('#printArea'); area.innerHTML = '';
  var d = el('div', 'psheet');
  d.innerHTML = gridSVG().svg;
  area.appendChild(d);
  setTimeout(function () { window.print(); }, 150);
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (!CW) $('#coreWarn').style.display = '';

  $('#btnMake').addEventListener('click', function () {
    var got = parsePairs($('#src').value);
    if (!got.length) { toast('No valid pairs found — one pair per line, e.g. 你好 / hello'); return; }
    setPairs(got); toast('Loaded ' + got.length + ' pairs');
  });
  $('#btnDemo').addEventListener('click', function () {
    $('#src').value = [
      '你好 / hello / nǐ hǎo', '谢谢 / thank you / xiè xiè', '老师 / teacher / lǎo shī', '同学 / classmate / tóng xué',
      '学校 / school / xué xiào', '朋友 / friend / péng yǒu', '高兴 / happy / gāo xìng', '国家 / country / guó jiā',
      '果汁 / juice / guǒ zhī', '好吃 / delicious / hǎo chī'
    ].join('\n');
    $('#title').value = 'Lesson 1 · Common Words';
    S.title = $('#title').value;
    setPairs(parsePairs($('#src').value));
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
    var wantedLanguages = matchingLanguages();
    var got = list.items.map(function (it) {
      return { zh: it.zh || '', en: it.en || '', py: it.py || autoPinyin(it.zh || '') };
    }).filter(function (p) {
      return wantedLanguages.every(function (language) { return hasTerm(p, language); });
    });
    if (!got.length) { toast('This list does not include both selected puzzle languages'); return; }
    if (!$('#title').value) { $('#title').value = list.name; S.title = list.name; }
    setPairs(got);
    toast('Loaded ' + got.length + ' pairs from "' + list.name + '"');
  });
  $('#btnShuffle').addEventListener('click', function () {
    for (var i = S.pairs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = S.pairs[i]; S.pairs[i] = S.pairs[j]; S.pairs[j] = t;
    }
    renderPreview(); toast('Pair order shuffled');
  });
  $('#btnClear').addEventListener('click', function () { setPairs([]); });
  $('#title').addEventListener('input', function () { S.title = this.value; renderPreview(); });

  $('#optRows').addEventListener('change', function () { S.rows = +this.value; renderPreview(); });
  $('#optCols').addEventListener('change', function () { S.cols = +this.value; renderPreview(); });
  document.querySelectorAll('input[name="displayLanguage"]').forEach(function (input) {
    input.addEventListener('change', function () {
      var selected = Array.from(document.querySelectorAll('input[name="displayLanguage"]:checked')).map(function (box) {
        return box.value;
      });
      if (selected.length < 2) {
        input.checked = true;
        toast('Choose at least two languages for a matching puzzle');
        return;
      }
      S.languages = selected;
      renderPairList();
      renderPreview();
    });
  });

  $('#btnPrint').addEventListener('click', doPrint);
  $('#btnPNG').addEventListener('click', exportPNG);
  $('#btnPDF').addEventListener('click', exportPDF);

  renderPairList(); renderPreview();
});
