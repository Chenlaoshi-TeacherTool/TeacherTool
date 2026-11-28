/*
 * 空白漫画模板 · Blank Comic Template Maker
 *
 * One `state` object drives everything. render() turns it into a single
 * A4 SVG (viewBox in millimetres) that is both the on-screen preview and the
 * printed page; editing aids (selection, panel numbers, binding zone) sit in
 * <g class="bc-ui"> layers that print CSS hides.
 *
 * Layouts are fixed, not random. Each is a list of rows: a row lies between
 * two horizontal lines (given as [y at left, y at right], so they can slant)
 * and is cut into panels by vertical lines (given as [x at top, x at bottom]).
 * Coordinates are 0–1 over the comic area; panels come out in reading order.
 *
 * Bubbles live inside each panel's "safe rectangle" — the largest upright
 * rectangle inside the (possibly slanted) panel, minus padding — and two
 * bubbles always get separate halves of it, so they never cross a border or
 * each other.
 */
(function () {
  'use strict';

  var ZH = window.BC_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };

  var PAGE_W = 210, PAGE_H = 297;
  var MARGIN = 12;          // safe print margin on every side (mm)
  var BINDING = 20;         // total left margin with the binding edge on (mm)
  var GAP = 4;              // space between panels (mm)
  var PAD = 3;              // bubble clearance from a panel border (mm)
  var PANEL_STROKE = 0.8, BUBBLE_STROKE = 0.5;

  // ---------- layouts ----------

  function flat(y) { return [y, y]; }
  function straight(x) { return [x, x]; }

  var LAYOUTS = {
    3: {
      grid: { lines: [flat(0), flat(1 / 3), flat(2 / 3), flat(1)], cuts: [[], [], []] },
      mixed: { lines: [flat(0), flat(0.5), flat(1)], cuts: [[], [straight(0.5)]] },
      slant: { lines: [flat(0), [0.42, 0.34], flat(1)], cuts: [[], [[0.57, 0.45]]] }
    },
    4: {
      grid: { lines: [flat(0), flat(0.5), flat(1)], cuts: [[straight(0.5)], [straight(0.5)]] },
      mixed: { lines: [flat(0), flat(0.3), flat(0.66), flat(1)], cuts: [[], [straight(0.5)], []] },
      slant: { lines: [flat(0), [0.52, 0.46], flat(1)], cuts: [[[0.57, 0.5]], [[0.46, 0.54]]] }
    },
    6: {
      grid: { lines: [flat(0), flat(1 / 3), flat(2 / 3), flat(1)], cuts: [[straight(0.5)], [straight(0.5)], [straight(0.5)]] },
      mixed: { lines: [flat(0), flat(0.35), flat(0.65), flat(1)], cuts: [[straight(0.58)], [], [straight(1 / 3), straight(2 / 3)]] },
      slant: { lines: [flat(0), [0.35, 0.31], [0.65, 0.7], flat(1)], cuts: [[[0.58, 0.52]], [[0.45, 0.55]], [[0.57, 0.47]]] }
    }
  };

  function lineY(line, x) { return line[0] + (line[1] - line[0]) * x; }

  // Unit-space quads [TL, TR, BR, BL] in reading order.
  function unitPanels(count, arrange) {
    var spec = LAYOUTS[count][arrange];
    var out = [];
    spec.cuts.forEach(function (cuts, r) {
      var top = spec.lines[r], bottom = spec.lines[r + 1];
      var xs = [[0, 0]].concat(cuts, [[1, 1]]);
      for (var i = 0; i < xs.length - 1; i++) {
        var a = xs[i], b = xs[i + 1];
        out.push([
          [a[0], lineY(top, a[0])], [b[0], lineY(top, b[0])],
          [b[1], lineY(bottom, b[1])], [a[1], lineY(bottom, a[1])]
        ]);
      }
    });
    return out;
  }

  // Move every edge of a convex polygon inwards by d.
  function inset(poly, d) {
    var n = poly.length;
    var cx = 0, cy = 0;
    poly.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
    var lines = poly.map(function (p, i) {
      var q = poly[(i + 1) % n];
      var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      var nx = -dy / len, ny = dx / len;
      if ((cx - p[0]) * nx + (cy - p[1]) * ny < 0) { nx = -nx; ny = -ny; }
      return { p: [p[0] + nx * d, p[1] + ny * d], d: [dx, dy] };
    });
    return lines.map(function (l, i) {
      var k = lines[(i + n - 1) % n];
      var det = k.d[0] * l.d[1] - k.d[1] * l.d[0];
      var t = ((l.p[0] - k.p[0]) * l.d[1] - (l.p[1] - k.p[1]) * l.d[0]) / det;
      return [k.p[0] + k.d[0] * t, k.p[1] + k.d[1] * t];
    });
  }

  // Largest upright rectangle guaranteed inside quad [TL, TR, BR, BL].
  function safeRect(q, pad) {
    var left = Math.max(q[0][0], q[3][0]) + pad, right = Math.min(q[1][0], q[2][0]) - pad;
    var top = Math.max(q[0][1], q[1][1]) + pad, bottom = Math.min(q[2][1], q[3][1]) - pad;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  // ---------- page geometry ----------

  function margins(s) {
    return { top: MARGIN, right: MARGIN, bottom: MARGIN, left: s.binding ? BINDING : MARGIN };
  }

  function headerHeight(s) { return (s.showTitle || s.showName || s.showDate) ? 15 : 0; }

  function pagePanels(s) {
    var m = margins(s);
    var x0 = m.left, y0 = m.top + headerHeight(s);
    var w = PAGE_W - m.left - m.right, h = PAGE_H - m.bottom - y0;
    return unitPanels(s.count, s.arrange).map(function (quad) {
      var mm = quad.map(function (p) { return [x0 + p[0] * w, y0 + p[1] * h]; });
      return inset(mm, GAP / 2);
    });
  }

  // ---------- bubbles ----------

  var SIZE = {
    s: { w: 0.4, h: 0.26 },
    m: { w: 0.52, h: 0.34 },
    l: { w: 0.64, h: 0.42 }
  };
  var ASPECT = 0.62;        // bubble height / width when room allows
  var CAPTION_ASPECT = 0.3;
  var MIN_W = 24;           // narrowest bubble worth writing in (mm), when the panel allows

  function fitBox(style, maxW, maxH) {
    var aspect = style === 'caption' ? CAPTION_ASPECT : ASPECT;
    var w = maxW, h = Math.min(w * aspect, maxH);
    if (style === 'caption') h = Math.min(Math.max(h, 7), maxH); // room for a line of writing
    if (h < w * aspect) w = Math.min(w, h / aspect * 1.45); // wide but not a sausage
    return { w: w, h: h };
  }

  // Bounding boxes (tail included) for a panel's bubbles, with which way each tail points.
  function bubbleBoxes(cell, r) {
    if (cell.style === 'none' || r.w <= 0 || r.h <= 0) return [];
    var f = SIZE[cell.size] || SIZE.m;
    var boxes = [];
    function at(size, horiz, vert, dy) {
      var x = horiz === 'left' ? r.x : r.x + r.w - size.w;
      var y = vert === 'top' ? r.y + (dy || 0) : r.y + r.h - size.h - (dy || 0);
      boxes.push({ x: x, y: y, w: size.w, h: size.h, side: horiz, tail: vert === 'top' ? 'down' : 'up' });
    }
    if (cell.num !== 2) {
      var one = fitBox(cell.style, Math.max(r.w * f.w, Math.min(MIN_W, r.w * 0.7)), r.h * f.h);
      var p = cell.pos1 || 'tl';
      at(one, p[1] === 'l' ? 'left' : 'right', p[0] === 't' ? 'top' : 'bottom');
      return boxes;
    }
    if (cell.pos2 === 'diag') {
      var half = (r.h - GAP) / 2;
      var d = fitBox(cell.style, Math.max(r.w * Math.min(f.w * 0.9, 0.62), Math.min(MIN_W, r.w * 0.7)), Math.min(r.h * f.h * 0.8, half));
      at(d, 'left', 'top');
      at(d, 'right', 'bottom');
      return boxes;
    }
    var vert = cell.pos2 === 'bottom' ? 'bottom' : 'top';
    var pairW = (r.w - GAP) / 2;
    var pair = fitBox(cell.style, Math.min(Math.max(r.w * f.w * 0.78, MIN_W), pairW), r.h * f.h);
    var stagger = Math.min(pair.h * 0.3, Math.max(0, r.h * (f.h + 0.08) - pair.h));
    at(pair, 'left', vert, 0);
    at(pair, 'right', vert, stagger);
    return boxes;
  }

  function n(v) { return Math.round(v * 100) / 100; }
  function pts(list) { return list.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' '); }

  var INK = 'fill="#fff" stroke="#111" stroke-linejoin="round"';

  // A speech tail: drawn outlined, then the body, then the tail again without
  // a stroke so the body outline opens where the tail joins it.
  function withTail(body, tail, sw) {
    return '<polygon points="' + pts(tail) + '" ' + INK + ' stroke-width="' + sw + '"/>' + body +
      '<polygon points="' + pts(tail) + '" fill="#fff" stroke="none"/>';
  }

  function drawBubble(style, b, sw) {
    sw = sw || BUBBLE_STROKE;
    var s = b.side === 'left' ? 1 : -1;          // tail leans toward the panel's middle
    var down = b.tail !== 'up';
    if (style === 'caption') {
      return '<rect x="' + n(b.x) + '" y="' + n(b.y) + '" width="' + n(b.w) + '" height="' + n(b.h) + '" ' + INK + ' stroke-width="' + sw + '"/>';
    }
    if (style === 'burst') {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2, spikes = 13, list = [];
      var jag = [1, 0.9, 0.97, 0.86, 1, 0.93, 0.88];
      for (var i = 0; i < spikes * 2; i++) {
        var a = -Math.PI / 2 + i * Math.PI / spikes;
        var k = i % 2 === 0 ? jag[(i / 2) % jag.length] : 0.68 + 0.05 * ((i * 7) % 3) / 2;
        list.push([cx + Math.cos(a) * b.w / 2 * k, cy + Math.sin(a) * b.h / 2 * k]);
      }
      return '<polygon points="' + pts(list) + '" ' + INK + ' stroke-width="' + sw + '"/>';
    }
    var bodyH = b.h * (style === 'thought' ? 0.72 : 0.78);
    var by = down ? b.y : b.y + b.h - bodyH;
    var bx = b.x, bw = b.w;
    var mx = bx + bw / 2, my = by + bodyH / 2;
    var tipX = mx + s * bw * 0.28, tipY = down ? b.y + b.h : b.y;
    var v = down ? 1 : -1;

    if (style === 'thought') {
      var rx = bw / 2 * 0.86, ry = bodyH / 2 * 0.8;
      var count = Math.max(8, Math.min(16, Math.round(Math.PI * (rx + ry) / 7)));
      var ring = [];
      for (var j = 0; j < count; j++) {
        var t = j / count * Math.PI * 2;
        ring.push([mx + Math.cos(t) * rx, my + Math.sin(t) * ry]);
      }
      var d = 'M' + n(ring[0][0]) + ',' + n(ring[0][1]);
      ring.forEach(function (p, idx) {
        var q = ring[(idx + 1) % count];
        var r = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.62;
        d += ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(q[0]) + ',' + n(q[1]);
      });
      var out = '<path d="' + d + 'Z" ' + INK + ' stroke-width="' + sw + '"/>';
      var gap = b.h - bodyH;
      var startY = down ? by + bodyH : by;
      var base = Math.min(gap * 0.28, bw * 0.045);
      [0.3, 0.62, 0.9].forEach(function (f, idx) {
        var rr = base * (1 - idx * 0.28);
        var x = mx + s * bw * 0.28 * (0.45 + f * 0.55);
        var y = startY + v * (gap * f - rr * (idx === 2 ? 1 : 0.4));
        out += '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(rr) + '" ' + INK + ' stroke-width="' + sw + '"/>';
      });
      return out;
    }

    var baseY, body;
    if (style === 'rounded') {
      var rad = Math.min(bodyH * 0.3, 5);
      body = '<rect x="' + n(bx) + '" y="' + n(by) + '" width="' + n(bw) + '" height="' + n(bodyH) + '" rx="' + n(rad) + '" ' + INK + ' stroke-width="' + sw + '"/>';
      baseY = down ? by + bodyH - 1.5 : by + 1.5;
    } else {
      body = '<ellipse cx="' + n(mx) + '" cy="' + n(my) + '" rx="' + n(bw / 2) + '" ry="' + n(bodyH / 2) + '" ' + INK + ' stroke-width="' + sw + '"/>';
      baseY = my + v * bodyH / 2 * 0.6;
    }
    var x1 = mx + s * bw * 0.02, x2 = mx + s * bw * 0.15;
    return withTail(body, [[x1, baseY], [x2, baseY], [tipX, tipY]], sw);
  }

  // ---------- header ----------

  function textWidth(str, size) {
    var w = 0;
    for (var i = 0; i < str.length; i++) w += /[⺀-￿]/.test(str[i]) ? size : size * 0.56;
    return w;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function drawHeader(s) {
    if (!headerHeight(s)) return '';
    var m = margins(s);
    var left = m.left + GAP / 2, right = PAGE_W - m.right - GAP / 2;
    var base = m.top + 8.5, fs = 4.2;
    var font = 'font-family="\'Segoe UI\', \'Helvetica Neue\', Arial, \'Microsoft YaHei\', \'PingFang SC\', sans-serif"';
    var out = '<g class="bc-head" ' + font + ' fill="#111">';
    var line = function (x1, x2) { return '<line x1="' + n(x1) + '" y1="' + n(base + 1.2) + '" x2="' + n(x2) + '" y2="' + n(base + 1.2) + '" stroke="#111" stroke-width="0.3"/>'; };
    var label = function (x, txt, anchor) { return '<text x="' + n(x) + '" y="' + n(base) + '" font-size="' + fs + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(txt) + '</text>'; };
    var edge = right;
    var fields = [];
    if (s.showDate) fields.push({ txt: T('Date:', '日期：'), len: 26 });
    if (s.showName) fields.push({ txt: T('Name:', '姓名：'), len: 36 });
    fields.forEach(function (f) {
      out += line(edge - f.len, edge);
      out += label(edge - f.len - 1, f.txt, 'end');
      edge -= f.len + 1 + textWidth(f.txt, fs) + 6;
    });
    if (s.showTitle) {
      var title = (s.titleText || '').trim();
      var avail = edge - left;
      if (title) {
        var tfs = 6;
        var est = textWidth(title, tfs);
        out += '<text x="' + n(left) + '" y="' + n(base + 0.6) + '" font-size="' + tfs + '" font-weight="700"' +
          (est > avail ? ' textLength="' + n(avail) + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(title) + '</text>';
      } else {
        var lab = T('Title:', '标题：');
        out += label(left, lab);
        out += line(left + textWidth(lab, fs) + 1, Math.min(edge, left + 110));
      }
    }
    return out + '</g>';
  }

  // ---------- render ----------

  var state;

  function blankCell() { return { style: 'none', num: 1, size: 'm', pos1: 'tl', pos2: 'top' }; }

  function defaults() {
    var cells = [
      { style: 'ellipse', num: 1, size: 'm', pos1: 'tl', pos2: 'top' },
      { style: 'ellipse', num: 2, size: 'm', pos1: 'tl', pos2: 'top' },
      blankCell(),
      { style: 'thought', num: 1, size: 'm', pos1: 'tr', pos2: 'top' },
      { style: 'burst', num: 1, size: 'm', pos1: 'tl', pos2: 'top' },
      blankCell()
    ];
    return { count: 6, arrange: 'grid', showTitle: true, titleText: '', showName: true, showDate: true, binding: false, cells: cells, selected: 0 };
  }

  function cellFor(i) {
    while (state.cells.length <= i) state.cells.push(blankCell());
    return state.cells[i];
  }

  function buildSvg(s, opts) {
    opts = opts || {};
    var panels = pagePanels(s);
    var body = '';
    var ui = '';
    panels.forEach(function (quad, i) {
      body += '<polygon points="' + pts(quad) + '" fill="#fff" stroke="#111" stroke-width="' + PANEL_STROKE + '" stroke-linejoin="miter"/>';
      var cell = s.cells[i] || blankCell();
      var rect = safeRect(quad, PAD + PANEL_STROKE / 2);
      bubbleBoxes(cell, rect).forEach(function (b) { body += '<g class="bc-bubble" data-panel="' + i + '">' + drawBubble(cell.style, b) + '</g>'; });
    });
    if (opts.ui) {
      if (s.binding) {
        var m = margins(s);
        ui += '<g class="bc-ui bc-binding" pointer-events="none">' +
          '<rect x="0" y="0" width="' + m.left + '" height="' + PAGE_H + '" fill="url(#bcHatch)"/>' +
          '<line x1="' + m.left + '" y1="0" x2="' + m.left + '" y2="' + PAGE_H + '" stroke="#bf7f35" stroke-width="0.35" stroke-dasharray="2 1.5"/>' +
          '<text x="' + n(m.left / 2) + '" y="' + n(PAGE_H / 2) + '" font-size="4" fill="#9a6a2a" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ' + n(m.left / 2) + ' ' + n(PAGE_H / 2) + ')">' + T('Binding area · not printed', '装订区 · 不打印') + '</text></g>';
      }
      ui += '<g class="bc-ui bc-hits">';
      panels.forEach(function (quad, i) {
        var on = i === s.selected;
        ui += '<polygon class="bc-hit' + (on ? ' is-on' : '') + '" data-index="' + i + '" points="' + pts(quad) + '" tabindex="0" role="button" aria-pressed="' + on + '" aria-label="' + esc(T('Panel ' + (i + 1), '第 ' + (i + 1) + ' 格')) + '"/>';
        if (on) {
          var tr = quad[1];
          var tag = T('Panel ' + (i + 1), '第 ' + (i + 1) + ' 格');
          var tw = textWidth(tag, 3.4) + 4;
          ui += '<g pointer-events="none"><rect x="' + n(tr[0] - tw - 1.5) + '" y="' + n(tr[1] + 1.5) + '" width="' + n(tw) + '" height="6" rx="1.5" fill="#e3efe4" stroke="#2f7d4a" stroke-width="0.3"/>' +
            '<text x="' + n(tr[0] - tw / 2 - 1.5) + '" y="' + n(tr[1] + 5.7) + '" font-size="3.4" font-weight="700" fill="#1f5e37" text-anchor="middle">' + esc(tag) + '</text></g>';
        }
      });
      ui += '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" class="bc-svg" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" role="img" aria-label="' + esc(T('Comic template preview', '漫画模板预览')) + '">' +
      '<defs><pattern id="bcHatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#fbf3e4"/><line x1="0" y1="0" x2="0" y2="3" stroke="#ecd7b4" stroke-width="0.8"/></pattern></defs>' +
      '<rect class="bc-paper" x="0" y="0" width="' + PAGE_W + '" height="' + PAGE_H + '" fill="#fff"/>' +
      drawHeader(s) + body + ui + '</svg>';
  }

  // ---------- controls ----------

  function setSeg(field, value) {
    document.querySelectorAll('[data-field="' + field + '"] button').forEach(function (b) {
      var on = b.dataset.value === String(value);
      b.classList.toggle('is-on', on);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', on);
    });
  }

  function drawThumbs() {
    document.querySelectorAll('[data-thumb]').forEach(function (el) {
      var quads = unitPanels(state.count, el.dataset.thumb).map(function (q) {
        return inset(q.map(function (p) { return [2 + p[0] * 36, 2 + p[1] * 46]; }), 1.2);
      });
      el.innerHTML = '<svg viewBox="0 0 40 50" aria-hidden="true">' + quads.map(function (q) {
        return '<polygon points="' + pts(q) + '" fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>';
      }).join('') + '</svg>';
    });
  }

  function drawIcons() {
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      var style = el.dataset.icon;
      var svg = style === 'none' ? '' : drawBubble(style, style === 'caption' ? { x: 6, y: 9, w: 36, h: 10, side: 'left', tail: 'down' } : { x: 6, y: 2, w: 36, h: 24, side: 'left', tail: 'down' }, 1.2);
      el.innerHTML = '<svg viewBox="0 0 48 28" aria-hidden="true">' + svg + '</svg>';
    });
  }

  function syncControls() {
    setSeg('count', state.count);
    setSeg('arrange', state.arrange);
    $('bcShowTitle').checked = state.showTitle;
    $('bcTitleText').value = state.titleText;
    $('bcTitleText').disabled = !state.showTitle;
    $('bcShowName').checked = state.showName;
    $('bcShowDate').checked = state.showDate;
    $('bcBinding').checked = state.binding;
    var cell = cellFor(state.selected);
    $('bcCellTitle').textContent = T('Panel ' + (state.selected + 1) + ' settings', '第 ' + (state.selected + 1) + ' 格设置');
    setSeg('style', cell.style);
    setSeg('num', cell.num);
    setSeg('size', cell.size);
    setSeg('pos1', cell.pos1);
    setSeg('pos2', cell.pos2);
    var blank = cell.style === 'none';
    $('bcBubbleOptions').hidden = blank;
    document.querySelector('[data-field="pos1"]').hidden = cell.num === 2;
    document.querySelector('[data-field="pos2"]').hidden = cell.num !== 2;
    drawThumbs();
  }

  function render() {
    if (state.selected >= state.count) state.selected = state.count - 1;
    $('bcSheet').innerHTML = buildSvg(state, { ui: true });
    syncControls();
  }

  function status(msg) {
    $('bcStatus').textContent = msg;
    clearTimeout(status.t);
    status.t = setTimeout(function () { $('bcStatus').textContent = ''; }, 2500);
  }

  function onSeg(field, value) {
    if (field === 'count') {
      state.count = Number(value);
      // keep settings for panels that still exist; new panels start blank
      state.cells = state.cells.slice(0, state.count);
      while (state.cells.length < state.count) state.cells.push(blankCell());
    } else if (field === 'arrange') {
      state.arrange = value;
    } else {
      var cell = cellFor(state.selected);
      cell[field] = field === 'num' ? Number(value) : value;
    }
    render();
  }

  function selectPanel(i) {
    state.selected = i;
    render();
    var hit = document.querySelector('.bc-hit[data-index="' + i + '"]');
    if (hit && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('bc-hit')) hit.focus();
  }

  function init() {
    state = defaults();
    document.querySelectorAll('[data-field]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-value]');
        if (btn) onSeg(group.dataset.field, btn.dataset.value);
      });
    });
    $('bcSheet').addEventListener('click', function (e) {
      var hit = e.target.closest('.bc-hit');
      if (hit) selectPanel(Number(hit.dataset.index));
    });
    $('bcSheet').addEventListener('keydown', function (e) {
      var hit = e.target.closest && e.target.closest('.bc-hit');
      if (hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectPanel(Number(hit.dataset.index)); }
    });
    $('bcShowTitle').addEventListener('change', function () { state.showTitle = this.checked; render(); });
    $('bcTitleText').addEventListener('input', function () { state.titleText = this.value; render(); });
    $('bcShowName').addEventListener('change', function () { state.showName = this.checked; render(); });
    $('bcShowDate').addEventListener('change', function () { state.showDate = this.checked; render(); });
    $('bcBinding').addEventListener('change', function () { state.binding = this.checked; render(); });
    $('bcApplyAll').addEventListener('click', function () {
      var src = cellFor(state.selected);
      for (var i = 0; i < state.count; i++) {
        state.cells[i] = { style: src.style, num: src.num, size: src.size, pos1: src.pos1, pos2: src.pos2 };
      }
      render();
      status(T('Copied to all ' + state.count + ' panels.', '已应用到全部 ' + state.count + ' 格。'));
    });
    $('bcReset').addEventListener('click', function () {
      state = defaults();
      render();
      status(T('Back to the default template.', '已恢复默认模板。'));
    });
    $('bcPrint').addEventListener('click', function () { window.print(); });
    drawIcons();
    render();
  }

  // Exposed for checks and future tools (e.g. a print pack adapter).
  window.ChenBlankComic = {
    state: function () { return state; },
    layouts: LAYOUTS,
    pagePanels: pagePanels,
    safeRect: safeRect,
    bubbleBoxes: bubbleBoxes,
    buildSvg: buildSvg,
    render: render,
    constants: { PAGE_W: PAGE_W, PAGE_H: PAGE_H, MARGIN: MARGIN, BINDING: BINDING, PAD: PAD, PANEL_STROKE: PANEL_STROKE }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
