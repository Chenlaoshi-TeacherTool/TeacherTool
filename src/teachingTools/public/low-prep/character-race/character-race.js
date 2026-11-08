var CW = window.ChenWordlist || null;
var DE = window.DeckExport || null;

var S = {
  chars: [],
  order: [],
  terms: {},
  opts: { targetLanguage: 'english', rings: 'auto', size: 'auto', grid: 20, shape: 'circle' },
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
  if (S.opts.targetLanguage === 'none') return '';
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
  if (S.opts.targetLanguage === 'none') { hint.textContent = 'Each tile shows only the term.'; return; }
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

/* ---------- track shapes ---------- */
// Every shape is one closed line; extra rings are smaller copies of it around the same centre.
// Terms are spaced evenly along the line, then the font size is solved so no two tiles overlap.
var TF = 0.46;            // support-line size relative to the term size
var SHEET_W = 746, SHEET_H = 672;   // wheel area on the A4 sheet (794px wide = 96 dpi)
function sgnPow(v, p) { return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), p); }
var SHAPES = {
  circle: { pt: function (a) { return [Math.cos(a), Math.sin(a)]; } },
  oval: { pt: function (a) { return [Math.cos(a), Math.sin(a)]; }, fit: true },
  square: { pt: function (a) { return [sgnPow(Math.cos(a), 0.3), sgnPow(Math.sin(a), 0.3)]; } },
  heart: { pt: function (a) {
    // classic heart curve blended with a circle so the point and dip stay soft (room for words)
    var t = a + Math.PI / 2, s = Math.sin(t);
    var hx = 16 * s * s * s / 16, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    return [hx * 0.7 + Math.cos(a) * 0.3, hy * 0.7 + Math.sin(a) * 0.3];
  } },
  cloud: { pt: function (a) {
    // round puffs along the top and sides (a puff, not a dent, at top and each side), a flatter base
    var sn = Math.sin(a), base = Math.max(0, sn);
    var r = 0.78 + 0.22 * Math.pow(Math.abs(Math.cos(6 * a)), 0.55) * (1 - 0.9 * base);
    return [r * Math.cos(a) * 1.45, r * sn * (1 - 0.25 * base)];
  } },
  butterfly: { antennae: true, offs: [0.5], pt: function (a) {
    var c = Math.cos(a), s = Math.sin(a);
    var r = (0.55 + 0.45 * Math.pow(Math.abs(Math.sin(2 * a)), 0.8) + 0.1 * c * c) * (1 - 0.14 * s);
    return [r * c * 1.15, r * s];
  } }
};
var SHAPE_CACHE = {};
function shapeInfo(name) {
  if (!SHAPES[name]) name = 'circle';
  if (SHAPE_CACHE[name]) return SHAPE_CACHE[name];
  var def = SHAPES[name], N = 600, raw = [], i;
  var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (i = 0; i < N; i++) {
    var p = def.pt(-Math.PI / 2 + 2 * Math.PI * i / N);
    raw.push(p);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
  SHAPE_CACHE[name] = {
    name: name, fit: !!def.fit, offs: def.offs || [0, 0.5], antennae: !!def.antennae,
    aspect: hx / hy,
    unit: raw.map(function (p) { return [(p[0] - mx) / hx, (p[1] - my) / hy]; })
  };
  return SHAPE_CACHE[name];
}

// Approximate text width in em: CJK = 1, Latin ≈ 0.56 (bold sans).
function emW(s) {
  var w = 0, i, c;
  s = String(s || '');
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c >= 0x2E80 && c <= 0x9FFF || c >= 0xF900 && c <= 0xFAFF || c >= 0xFF00 && c <= 0xFFEF) w += 1;
    else if (c === 32) w += 0.3;
    else if (c >= 65 && c <= 90) w += 0.68;
    else w += 0.56;
  }
  return w;
}
function clipLine(l, maxEm) {
  if (emW(l) <= maxEm) return l;
  while (l.length > 1 && emW(l + '…') > maxEm) l = l.slice(0, -1);
  return l.replace(/\s+$/, '') + '…';
}
// Up to two lines for a support line, so long definitions stay readable instead of shrinking.
function wrapLines(text, maxEm) {
  text = String(text || '').trim();
  if (!text) return [];
  if (emW(text) <= maxEm) return [text];
  var spaced = /\s/.test(text), sep = spaced ? ' ' : '';
  var parts = spaced ? text.split(/\s+/) : text.split('');
  var lines = [], cur = '';
  parts.forEach(function (p) {
    var nx = cur ? cur + sep + p : p;
    if (cur && emW(nx) > maxEm) { lines.push(cur); cur = p; } else cur = nx;
  });
  if (cur) lines.push(cur);
  if (lines.length > 2) lines = [lines[0], lines.slice(1).join(sep)];
  return lines.map(function (l) { return clipLine(l, maxEm); });
}
// Tile size in units of the term font size.
function termMetrics() {
  var M = {};
  S.order.forEach(function (tk) {
    var pw = Math.max(1.5, emW(tk) + 0.78);
    var lines = wrapLines(targetText(tk), Math.max(pw, 5.2) / TF);
    var tw = 0;
    lines.forEach(function (l) { tw = Math.max(tw, emW(l) * TF); });
    M[tk] = { pw: pw, lines: lines, W: Math.max(pw, tw) / 2 + 0.14, th: lines.length ? 0.12 + lines.length * TF * 1.18 : 0 };
  });
  return M;
}

function ringSplit(count) {
  var n = S.order.length;
  if (count <= 1 || n < 8) return [{ chars: S.order, r: 1 }];
  var radii = count >= 3 ? [1, 0.7, 0.42] : [1, 0.56];
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
function placeAlong(pts, m, off) {
  var n = pts.length, L = [0], i;
  for (i = 1; i <= n; i++) {
    var a = pts[i - 1], b = pts[i % n];
    L.push(L[i - 1] + Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])));
  }
  var total = L[n], out = [], j = 0;
  for (var k = 0; k < m; k++) {
    var d = ((k + off) / m) * total;
    while (j < n - 1 && L[j + 1] < d) j++;
    var seg = L[j + 1] - L[j] || 1, f = (d - L[j]) / seg;
    var p = pts[j], q = pts[(j + 1) % n];
    out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
  }
  return out;
}
function geometry(w, h, rings, shp, s, off0) {
  var cx = w / 2, cy = h / 2, hw = w / 2 * s, hh = h / 2 * s, sx, sy;
  if (shp.fit) { sx = hw; sy = hh; } else { sx = Math.min(hw, hh * shp.aspect); sy = sx / shp.aspect; }
  var g = { cx: cx, cy: cy, sx: sx, sy: sy, cr0: Math.max(34, Math.min(sx, sy) * 0.16), items: [], curves: [] };
  rings.forEach(function (ring, ri) {
    var pts = shp.unit.map(function (p) { return [cx + p[0] * sx * ring.r, cy + p[1] * sy * ring.r]; });
    g.curves.push(pts);
    var off = (off0 + (ri % 2) * 0.5) % 1;
    placeAlong(pts, ring.chars.length, off).forEach(function (p, i) {
      g.items.push({ tk: ring.chars[i], x: p[0], y: p[1] });
    });
  });
  return g;
}
// Largest term size where no tiles overlap each other, the centre badge, or the page edge.
function fitFs(w, h, g, M) {
  var fs = Math.min(w, h) * 0.085, it = g.items, n = it.length, i, j, edge = 6;
  it.forEach(function (p) {
    var m = M[p.tk], below = p.y >= g.cy;
    p.W = m.W; p.below = below;
    p.up = 0.8 + (below ? 0 : m.th); p.dn = 0.8 + (below ? m.th : 0);
  });
  for (i = 0; i < n; i++) {
    var a = it[i];
    fs = Math.min(fs, (a.x - edge) / a.W, (w - edge - a.x) / a.W, (a.y - edge) / a.up, (h - edge - a.y) / a.dn);
    var cfx = (Math.abs(a.x - g.cx) - g.cr0) / a.W;
    var cfy = a.y >= g.cy ? (a.y - g.cy - g.cr0) / a.up : (g.cy - a.y - g.cr0) / a.dn;
    fs = Math.min(fs, Math.max(cfx, cfy));
    for (j = i + 1; j < n; j++) {
      var b = it[j];
      var fx = Math.abs(a.x - b.x) / (a.W + b.W);
      var fy = a.y <= b.y ? (b.y - a.y) / (a.dn + b.up) : (a.y - b.y) / (b.dn + a.up);
      fs = Math.min(fs, Math.max(fx, fy));
    }
  }
  return Math.max(fs, 1);
}
function solveLayout(w, h, rings, M, shp) {
  var best = null;
  // Try both symmetric starting points (a term at the top, or two either side of it).
  shp.offs.forEach(function (off0) {
    for (var s = 0.94; s >= 0.5; s -= 0.02) {
      var g = geometry(w, h, rings, shp, s, off0);
      g.fs = fitFs(w, h, g, M);
      if (!best || g.fs > best.fs * 1.001) best = g;
    }
  });
  return best;
}
// Ring count is decided on the printed sheet so preview, game and print all match.
var RING_MEMO = { key: '', count: 1 };
function ringCount(M, shp) {
  var n = S.order.length;
  if (n < 8) return 1;
  if (S.opts.rings !== 'auto') return +S.opts.rings;
  var key = shp.name + '|' + S.opts.targetLanguage + '|' + S.order.join('\u0001');
  if (RING_MEMO.key === key) return RING_MEMO.count;
  // Fewest rings that still print comfortably (about 20pt); otherwise whichever prints largest.
  var COMFY = 27, bestC = 1, bestFs = solveLayout(SHEET_W, SHEET_H, ringSplit(1), M, shp).fs;
  [2, 3].forEach(function (c) {
    if (bestFs >= COMFY || n < (c === 2 ? 14 : 26)) return;   // a few words never need inner rings
    var fs = solveLayout(SHEET_W, SHEET_H, ringSplit(c), M, shp).fs;
    if (fs > bestFs * 1.08) { bestFs = fs; bestC = c; }
  });
  RING_MEMO = { key: key, count: bestC };
  return bestC;
}
function trackLayout(w, h) {
  var shp = shapeInfo(S.opts.shape), M = termMetrics();
  var g = solveLayout(w, h, ringSplit(ringCount(M, shp)), M, shp);
  g.M = M; g.shp = shp;
  return g;
}
// Printed term size in points (sheet is 96 dpi, so px × 0.75).
function printPt() {
  if (!S.order.length) return 0;
  return Math.round(trackLayout(SHEET_W, SHEET_H).fs * 0.75);
}
// Chinese terms print in Kaiti (the handwriting style students learn); Latin terms stay in bold sans.
var KAI = "'KaiTi', 'STKaiti', 'Kaiti SC', 'BiauKai', '楷体', serif";
function termFontAttr(t) {
  return /[㐀-鿿]/.test(t) ? ' font-family="' + KAI + '" font-weight="400"' : ' font-weight="700"';
}
// Pinyin uses Andika: every a is the single-storey ɑ, like school textbooks (SimSun mixes both shapes).
var PY_FONT = "'Andika', 'Century Gothic', 'Segoe UI', Arial, sans-serif";
function supportFontAttr() {
  return S.opts.targetLanguage === 'pinyin' ? ' font-family="' + PY_FONT + '"' : '';
}
function pathD(pts) {
  return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z';
}

// opt.order draws the track with its own word order (each battle side is shuffled separately).
function circleSVG(w, h, opt) {
  opt = opt || {};
  if (!opt.order) return trackSVG(w, h, opt);
  var keep = S.order;
  S.order = opt.order;
  try { return trackSVG(w, h, opt); } finally { S.order = keep; }
}
function trackSVG(w, h, opt) {
  var L = trackLayout(w, h), cx = L.cx, cy = L.cy, cr0 = L.cr0, fs = L.fs;
  if (S.opts.size !== 'auto') fs = Math.min(+S.opts.size, fs * 1.3);
  var pillH = fs * 1.5, tf = fs * TF, lh = tf * 1.18;
  var lineW = Math.max(2.5, Math.min(w, h) * 0.005);

  var g = '<rect width="' + w + '" height="' + h + '" fill="#FBF6E9"/>';
  L.curves.forEach(function (pts) {
    g += '<path d="' + pathD(pts) + '" fill="none" stroke="#9FBCA9" stroke-width="' + lineW + '" stroke-linejoin="round"/>';
  });
  if (L.shp.antennae) {
    var top = L.curves[0][0], tipY = cy - L.sy * 0.96;
    [-1, 1].forEach(function (d) {
      var tx = cx + d * L.sx * 0.2;
      g += '<path d="M' + top[0] + ' ' + top[1] + ' Q' + (cx + d * L.sx * 0.04) + ' ' + tipY + ' ' + tx + ' ' + tipY + '" fill="none" stroke="#9FBCA9" stroke-width="' + lineW + '" stroke-linecap="round"/>';
      g += '<circle cx="' + tx + '" cy="' + tipY + '" r="' + lineW * 2 + '" fill="#9FBCA9"/>';
    });
  }

  if (opt.centerChar) {
    // With no support line on the tiles, the game clue still uses the definition (or pinyin).
    var ct = S.terms[opt.centerChar] || {};
    var centerText = opt.centerTarget ? (targetText(opt.centerChar) || ct.en || ct.py || opt.centerChar) : opt.centerChar;
    var centerFont = Math.max(13, Math.min(cr0 * 0.9, cr0 * 3.2 / Math.max(1, centerText.length)));
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (cr0 * 0.98) + '" fill="#35604C" stroke="#1B2A47" stroke-width="5"/>';
    g += '<text x="' + cx + '" y="' + (cy + centerFont * 0.34) + '" font-size="' + centerFont + '"' + termFontAttr(centerText) + ' fill="#F6C43C" text-anchor="middle">' + esc(centerText) + '</text>';
  } else if (opt.centerLabel != null) {
    var lab = String(opt.centerLabel);
    var labFont = Math.max(12, Math.min(cr0 * 0.8, cr0 * 1.7 / Math.max(1, emW(lab))));
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + cr0 + '" fill="' + (opt.centerFill || '#35604C') + '" stroke="#1B2A47" stroke-width="5"/>';
    g += '<text x="' + cx + '" y="' + (cy + labFont * 0.34) + '" font-size="' + labFont + '"' + termFontAttr(lab) + ' fill="#F6C43C" text-anchor="middle">' + esc(lab) + '</text>';
  } else {
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + cr0 + '" fill="#35604C" stroke="#1B2A47" stroke-width="5"/>';
    g += '<text x="' + cx + '" y="' + (cy - 2) + '" font-size="' + (cr0 * 0.38) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">TERM</text>';
    g += '<text x="' + cx + '" y="' + (cy + cr0 * 0.45) + '" font-size="' + (cr0 * 0.38) + '" font-weight="700" fill="#F2F6EF" text-anchor="middle">RACE</text>';
  }

  L.items.forEach(function (p, idx) {
    var m = L.M[p.tk], x = p.x, y = p.y, pw = m.pw * fs;
    g += '<g class="hz" data-ch="' + esc(p.tk) + '" data-i="' + idx + '">';
    g += '<rect x="' + (x - pw / 2) + '" y="' + (y - pillH / 2) + '" width="' + pw + '" height="' + pillH + '" rx="' + (pillH / 2) + '" fill="#fff" stroke="#1B2A47" stroke-width="' + Math.max(2.5, fs * 0.09) + '"/>';
    g += '<text x="' + x + '" y="' + (y + fs * 0.35) + '" font-size="' + fs + '"' + termFontAttr(p.tk) + ' fill="#1B2A47" text-anchor="middle">' + esc(p.tk) + '</text>';
    var k = m.lines.length;
    m.lines.forEach(function (line, li) {
      var ty = p.below
        ? y + pillH / 2 + tf * 0.98 + li * lh
        : y - pillH / 2 - tf * 0.3 - (k - 1 - li) * lh;
      g += '<text x="' + x + '" y="' + ty + '" font-size="' + tf + '"' + supportFontAttr() + ' font-weight="600" fill="#2F5A47" text-anchor="middle">' + esc(line) + '</text>';
    });
    g += '</g>';
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
  g += '<g transform="translate(24,116)">' + circleSVG(cW, cH).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<g transform="translate(24,800)">' + gridSVG(cW, 262, S.opts.grid, 'Grid').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
  g += '<text x="' + (W / 2) + '" y="1092" font-size="14" fill="#5A6B57" text-anchor="middle">One partner gives a clue while the other finds the term on the wheel. Mark an X on the grid each round, then switch.</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}

// Tell the teacher how big the words will be on paper; 14pt+ reads comfortably from a desk.
function updatePrintSizeHint() {
  var hint = $('#printSizeHint');
  if (!hint) return;
  var pt = printPt();
  if (!pt) { hint.textContent = ''; hint.className = 'hint'; return; }
  var warn = pt < 14;
  hint.textContent = (warn ? hint.getAttribute('data-warn') : hint.getAttribute('data-ok')).replace('{pt}', pt);
  hint.className = 'hint' + (warn ? ' warn' : '');
}
function renderPreview() {
  $('#preview').innerHTML = S.order.length ? circleSVG(900, 640) :
    '<div style="padding:50px;text-align:center;color:#9AA79E">No terms yet</div>';
  updatePrintSizeHint();
}

/* ---------- game ---------- */
var G = { target: '', score: 0, miss: 0, left: 60, timer: null, running: false };
function speak(ch, on) {
  if (!(on === undefined ? $('#optSpeak').checked : on)) return;
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

/* ---------- two-team whiteboard battle ---------- */
// One student per team at the board. The teacher (or text-to-speech) says a word;
// the first correct tap scores for that team. A wrong tap locks that side briefly.
var B = {
  target: '', resolved: true, used: {}, orders: [[], []], locked: [false, false], lockT: [0, 0],
  scores: [0, 0], round: 0, over: false, text: {}
};
function bText(key, vars) {
  var s = B.text[key] || '';
  Object.keys(vars || {}).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}
function bTeam(side) { return document.querySelector('#battle .bteam[data-side="' + side + '"]'); }
function bName(side) { return bTeam(side).querySelector('.bname').value.trim() || ('Team ' + (side ? 'B' : 'A')); }
function bColor(side) { return bTeam(side).querySelector('.bcolor').value; }
function shuffled(list) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function bShuffle() {
  var a = shuffled(S.order), b = a;
  if (!$('#bSame').checked) {
    b = shuffled(S.order);
    for (var k = 0; k < 5 && b.join('|') === a.join('|'); k++) b = shuffled(S.order);
  }
  B.orders = [a, b];
}
function bClue() {
  if (!B.target || !$('#bHint').checked) return null;
  var t = S.terms[B.target] || {};
  return targetText(B.target) || t.en || t.py || null;
}
function bRenderSide(side) {
  var stage = bTeam(side).querySelector('.bstage');
  var w = Math.max(200, stage.clientWidth), h = Math.max(200, stage.clientHeight);
  var clue = bClue();
  // With a clue on screen, tiles show the term only, so the clue can't be matched to a tile's support line.
  var keepLang = S.opts.targetLanguage;
  if ($('#bHint').checked) S.opts.targetLanguage = 'none';
  try {
    stage.innerHTML = circleSVG(w, h, {
      order: B.orders[side],
      // Short clues also sit in the centre; long ones only in the status line above.
      centerLabel: clue != null && emW(clue) <= 7 ? clue : (B.target && !B.resolved ? '?' : '★'),
      centerFill: B.resolved && B.winSide === side ? bColor(side) : '#35604C'
    });
  } finally { S.opts.targetLanguage = keepLang; }
  // Re-apply tile colours after a redraw (e.g. window resize mid-round).
  if (B.resolved && B.target && B.winSide != null) bMarkCorrect(side, B.winSide === side);
}
function bRender() { bRenderSide(0); bRenderSide(1); }
function bTile(side, ch) {
  var nodes = bTeam(side).querySelectorAll('.bstage .hz');
  for (var i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-ch') === ch) return nodes[i];
  return null;
}
function bPaint(node, fill, ink) {
  if (!node) return;
  var r = node.querySelector('rect');
  if (r) r.setAttribute('fill', fill);
  var tx = node.querySelector('text');
  if (tx && ink) tx.setAttribute('fill', ink);
}
// Winner's side: the tile fills with the team colour. Other side: the right tile gets a thick outline.
function bMarkCorrect(side, won) {
  var node = bTile(side, B.target);
  if (!node) return;
  if (won) bPaint(node, bColor(side), '#fff');
  else {
    var r = node.querySelector('rect');
    if (r) { r.setAttribute('stroke', bColor(B.winSide)); r.setAttribute('stroke-width', '7'); }
  }
}
function bStatus(html) { $('#bstatus').innerHTML = html; }
function bScoreView() {
  [0, 1].forEach(function (side) {
    bTeam(side).querySelector('.bscore').textContent = B.scores[side];
    bTeam(side).style.setProperty('--team', bColor(side));
  });
}
function bCheckWin() {
  var goal = +$('#bGoal').value;
  if (!goal) return false;
  for (var side = 0; side < 2; side++) {
    if (B.scores[side] >= goal) {
      B.over = true;
      bStatus('<span class="bwho" style="--who:' + bColor(side) + '">' + esc(bText('winner', { team: bName(side) })) + '</span>');
      $('#bNext').disabled = true;
      return true;
    }
  }
  return false;
}
function bAward(side) {
  if (B.over) return;
  B.scores[side]++;
  bScoreView();
  var hadRound = B.target && !B.resolved;
  if (hadRound) {
    B.resolved = true;
    B.winSide = side;
    bUnlock();
    bTeam(side).classList.add('won');
    bRender();
  }
  if (bCheckWin()) return;
  if (hadRound) {
    bStatus('<span class="bwho" style="--who:' + bColor(side) + '">' + esc(bText('scored', { team: bName(side) })) + '</span>' +
      '<span class="bword">' + esc(B.target) + '</span>');
  }
}
function bUnlock() {
  [0, 1].forEach(function (side) {
    clearTimeout(B.lockT[side]);
    B.locked[side] = false;
    bTeam(side).classList.remove('locked');
  });
}
function bLock(side) {
  B.locked[side] = true;
  bTeam(side).classList.add('locked');
  clearTimeout(B.lockT[side]);
  B.lockT[side] = setTimeout(function () {
    B.locked[side] = false;
    bTeam(side).classList.remove('locked');
  }, 1500);
}
function bTap(side, node) {
  if (B.over || !B.target || B.resolved || B.locked[side]) return;
  var ch = node.getAttribute('data-ch');
  if ($('#bJudge').checked) {
    // Teacher judges: just show what this student picked; the teacher presses +1.
    Array.prototype.forEach.call(bTeam(side).querySelectorAll('.bstage .hz rect'), function (r) { r.setAttribute('fill', '#fff'); });
    bPaint(node, ch === B.target ? '#DCEBD5' : '#F7C9C4');
    return;
  }
  if (ch === B.target) { bAward(side); return; }
  bPaint(node, '#F7C9C4');
  setTimeout(function () { if (!B.resolved) bPaint(node, '#fff'); }, 450);
  bLock(side);
}
function bNext() {
  if (B.over) return;
  var pool = S.order.filter(function (t) { return !B.used[t]; });
  if (!pool.length) { B.used = {}; pool = S.order.slice(); toast(bText('allUsed')); }
  if (B.target && pool.length > 1) pool = pool.filter(function (t) { return t !== B.target; });
  B.target = pool[Math.floor(Math.random() * pool.length)];
  B.used[B.target] = true;
  B.resolved = false;
  B.winSide = null;
  B.round++;
  bUnlock();
  [0, 1].forEach(function (side) { bTeam(side).classList.remove('won'); });
  if ($('#bReshuffle').checked) bShuffle();
  bRender();
  var clue = bClue();
  bStatus(clue != null ? esc(clue) : ($('#bJudge').checked ? esc(bText('judgeTip')) : esc(bText('listen'))));
  speak(B.target, $('#bSpeak').checked);
}
function bReset() {
  B.scores = [0, 0]; B.target = ''; B.resolved = true; B.winSide = null; B.used = {}; B.round = 0; B.over = false;
  $('#bNext').disabled = false;
  bUnlock();
  [0, 1].forEach(function (side) { bTeam(side).classList.remove('won'); });
  bShuffle();
  bScoreView();
  bRender();
  bStatus(esc(bText('pressNext')));
}
function openBattle() {
  if (S.order.length < 4) { toast('Add at least 4 terms'); return; }
  $('#battle').classList.add('open');
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  // Wait for layout so the stages have their real size before drawing.
  setTimeout(function () {
    bReset();
    if (S.order.length > 16) toast(bText('tooMany'));
  }, 30);
}
function closeBattle() {
  bUnlock();
  $('#battle').classList.remove('open');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
}
function initBattle() {
  var root = $('#battle');
  try { B.text = JSON.parse(root.getAttribute('data-text') || '{}'); } catch (e) { B.text = {}; }
  $('#btnBattle').addEventListener('click', openBattle);
  $('#bExit').addEventListener('click', closeBattle);
  $('#bNext').addEventListener('click', bNext);
  $('#bSay').addEventListener('click', function () { if (B.target) speak(B.target, true); });
  $('#bShuffle').addEventListener('click', function () { bShuffle(); bRender(); });
  $('#bReset').addEventListener('click', bReset);
  $('#bSwap').addEventListener('click', function () { root.querySelector('.bteams').classList.toggle('swapped'); bRender(); });
  $('#bSame').addEventListener('change', function () { bShuffle(); bRender(); });
  $('#bHint').addEventListener('change', function () {
    bRender();
    if (B.target && !B.resolved) { var c = bClue(); bStatus(esc(c != null ? c : bText('listen'))); }
  });
  $('#bGoal').addEventListener('change', function () { if (!B.over) bCheckWin(); });
  // Teacher peek: hold to see the word (for when read-aloud is off and the teacher says it).
  var peek = $('#bPeek'), peekLabel = peek.textContent;
  var showPeek = function (e) { e.preventDefault(); if (B.target) peek.textContent = B.target; };
  var hidePeek = function () { peek.textContent = peekLabel; };
  peek.addEventListener('pointerdown', showPeek);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { peek.addEventListener(ev, hidePeek); });

  [0, 1].forEach(function (side) {
    var team = bTeam(side);
    team.querySelector('.bplus').addEventListener('click', function () { bAward(side); });
    team.querySelector('.bminus').addEventListener('click', function () {
      B.scores[side] = Math.max(0, B.scores[side] - 1);
      bScoreView();
      if (B.over && !bCheckWin()) { B.over = false; $('#bNext').disabled = false; bStatus(esc(bText('pressNext'))); }
    });
    team.querySelector('.bcolor').addEventListener('input', function () { bScoreView(); if (B.resolved) bRender(); });
    // pointerdown (not click) so two students touching at once are both seen on multi-touch boards.
    team.querySelector('.bstage').addEventListener('pointerdown', function (e) {
      var node = e.target.closest && e.target.closest('.hz');
      if (!node) return;
      e.preventDefault();
      bTap(side, node);
    });
  });
  var rt = 0;
  window.addEventListener('resize', function () {
    if (!root.classList.contains('open')) return;
    clearTimeout(rt); rt = setTimeout(bRender, 150);
  });
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('open')) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'checkbox') return;
    if (e.key === 'Escape') closeBattle();
    else if (e.key === ' ') { e.preventDefault(); bNext(); }
  });
}

/* ---------- export ---------- */
// An SVG drawn as an image can't see the page's web fonts, so embed the pinyin glyphs as a data-URL font.
var PY_EMBED = { key: '', css: '' };
function bufToB64(buf) {
  var bytes = new Uint8Array(buf), s = '', i;
  for (i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function embedPinyinFont(svg) {
  if (S.opts.targetLanguage !== 'pinyin') return Promise.resolve(svg);
  var chars = {};
  S.order.forEach(function (t) { String(targetText(t)).split('').forEach(function (c) { chars[c] = 1; }); });
  var text = Object.keys(chars).sort().join('') + '…';
  var inject = function (css) { return css ? svg.replace(/(<svg[^>]*>)/, '$1<defs><style>' + css + '</style></defs>') : svg; };
  if (PY_EMBED.key === text) return Promise.resolve(inject(PY_EMBED.css));
  return fetch('https://fonts.googleapis.com/css2?family=Andika:wght@700&text=' + encodeURIComponent(text))
    .then(function (r) { return r.text(); })
    .then(function (css) {
      var m = css.match(/url\((https:[^)]+)\)/);
      if (!m) throw new Error('no font url');
      return fetch(m[1]).then(function (r) { return r.arrayBuffer(); });
    })
    .then(function (buf) {
      PY_EMBED = { key: text, css: "@font-face{font-family:'Andika';font-weight:400 700;src:url(data:font/woff2;base64," + bufToB64(buf) + ")}" };
      return inject(PY_EMBED.css);
    })
    .catch(function () { return svg; });   // offline: falls back to Century Gothic / system sans
}
function svgToJpegLocal(svg, w, h, cb) {
  if (!DE) { toast('Missing deck-export.js'); return; }
  embedPinyinFont(svg)
    .then(function (s) { return DE.svgToJpeg(s, w, h, 2); })
    .then(cb).catch(function () { toast('Export failed'); });
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
  var ready = document.fonts && document.fonts.load ? document.fonts.load('600 16px Andika') : Promise.resolve();
  ready.catch(function () {}).then(function () { setTimeout(function () { window.print(); }, 150); });
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
  $('#optShape').addEventListener('change', function () { S.opts.shape = this.value; renderPreview(); });
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

  initBattle();
  renderChips(); renderPreview(); updateTargetLanguageHint();
});
