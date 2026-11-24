/*
 * 部件卡片 · Component Cards
 *
 * Component data: data/components.json.gz, built from makemeahanzi by
 * scripts/build-data.js. "好": ["女子", "000111"] = parts, then the part of
 * each stroke. Stroke outlines come from hanzi-writer-data (same CDN as the
 * stroke-order and Missing Parts tools).
 *
 * Three outputs share one renderer:
 *   color    colour cards (print, or one at a time on the projector)
 *   coloring outline characters + colour legend for students, optional answer page
 *   puzzle   each component printed alone, at the same scale as a gluing board
 */
(function () {
  'use strict';

  var ZH = window.CC_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };

  var DATA_URL = '/low-prep/component-cards/data/components.json.gz';
  var STROKES_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
  var MAX_CHARS = 24;
  var STORE_KEY = 'cc-splits-v1';
  var COLORS = [
    { hex: '#e03131', zh: '红', en: 'red' },
    { hex: '#1c7ed6', zh: '蓝', en: 'blue' },
    { hex: '#2f9e44', zh: '绿', en: 'green' },
    { hex: '#f08c00', zh: '橙', en: 'orange' },
    { hex: '#9c36b5', zh: '紫', en: 'purple' },
    { hex: '#0c8599', zh: '青', en: 'teal' }
  ];
  var PER = { color: [1, 2, 4, 6], coloring: [2, 4, 6], puzzle: [1, 2, 3, 4], family: [1], tracing: [3, 4, 5, 6, 8] };
  var PER_DEFAULT = { color: 4, coloring: 4, puzzle: 2, family: 1, tracing: 4 };
  var ORDER_URL = '/low-prep/component-cards/data/common-order.txt';
  var HIGHLIGHT = '#1c7ed6';
  // A component typed in its full form also finds its side form (水 → 氵).
  var VARIANTS = { '水': '氵', '手': '扌', '人': '亻', '心': '忄', '言': '讠', '金': '钅', '食': '饣', '糸': '纟', '犬': '犭', '刀': '刂', '衣': '衤', '示': '礻', '竹': '⺮', '艸': '艹', '草': '艹', '肉': '⺼', '月': '⺼', '辵': '辶', '火': '灬', '玉': '王', '阜': '阝', '邑': '阝', '网': '罒', '爪': '爫', '老': '耂' };
  var PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };

  var state = { mode: 'color', chars: [], selected: null, per: {}, show: 0, famPicks: {} };
  var dataPromise = null;
  var strokeCache = {};
  var bboxCache = {};
  var overrides = readOverrides();

  // ---------- data ----------

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL).then(function (res) {
        if (!res.ok) throw new Error('data ' + res.status);
        if (typeof DecompressionStream === 'undefined' || !res.body) throw new Error('no DecompressionStream');
        return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
      }).then(JSON.parse);
    }
    return dataPromise;
  }

  function loadStrokes(ch) {
    if (!strokeCache[ch]) {
      strokeCache[ch] = fetch(STROKES_URL + encodeURIComponent(ch) + '.json')
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (json) { return json && json.strokes ? json.strokes : null; })
        .catch(function () { return null; });
    }
    return strokeCache[ch];
  }

  function readOverrides() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveOverrides() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(overrides)); } catch (e) { /* private mode */ }
  }

  // The split for one character: { labels: [...], parts: [part per stroke] }.
  function baseSplit(ch, entry, count) {
    if (!entry || !entry[0]) return { labels: [ch], parts: fill(count, 0) };
    var labels = Array.from(entry[0]);
    var raw = entry[1].split('');
    var parts = [];
    var last = null;
    raw.forEach(function (p) { parts.push(p === 'x' ? last : (last = Number(p))); });
    var firstKnown = parts.find(function (p) { return p != null; });
    parts = parts.map(function (p) { return p == null ? (firstKnown || 0) : p; });
    while (parts.length < count) parts.push(parts[parts.length - 1] || 0);
    return tidy({ labels: labels, parts: parts.slice(0, count) });
  }

  // Drop unused parts and number the rest in stroke order.
  function tidy(split) {
    var order = [];
    split.parts.forEach(function (p) { if (order.indexOf(p) === -1) order.push(p); });
    return {
      labels: order.map(function (p) { return split.labels[p] || '？'; }),
      parts: split.parts.map(function (p) { return order.indexOf(p); })
    };
  }

  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  function splitOf(item) {
    var o = overrides[item.ch];
    if (o && o.parts && o.parts.length === item.strokes.length) return o;
    return item.base;
  }

  // ---------- geometry ----------

  var measureSvg = null;
  function strokeBoxes(item) {
    if (bboxCache[item.ch]) return bboxCache[item.ch];
    if (!measureSvg) {
      measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      measureSvg.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:1024px;height:1024px;visibility:hidden');
      document.body.appendChild(measureSvg);
    }
    measureSvg.innerHTML = item.strokes.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
    var boxes = Array.prototype.map.call(measureSvg.querySelectorAll('path'), function (path) {
      var b = path.getBBox();
      return { x0: b.x, x1: b.x + b.width, y0: 900 - (b.y + b.height), y1: 900 - b.y };
    });
    bboxCache[item.ch] = boxes;
    return boxes;
  }

  function partBox(item, split, part) {
    var box = null;
    strokeBoxes(item).forEach(function (b, i) {
      if (split.parts[i] !== part) return;
      box = box ? { x0: Math.min(box.x0, b.x0), x1: Math.max(box.x1, b.x1), y0: Math.min(box.y0, b.y0), y1: Math.max(box.y1, b.y1) } : Object.assign({}, b);
    });
    return box || { x0: 0, x1: 1024, y0: 0, y1: 1024 };
  }

  // ---------- drawing ----------

  var FLIP = 'translate(0,900) scale(1,-1)';
  var GRID = '<g class="cc-grid"><rect x="4" y="4" width="1016" height="1016"/><line x1="512" y1="0" x2="512" y2="1024"/><line x1="0" y1="512" x2="1024" y2="512"/></g>';

  function color(part) { return COLORS[part % COLORS.length].hex; }

  // style: color | outline | solid | faint
  function glyph(item, split, opts) {
    opts = opts || {};
    var style = opts.style || 'color';
    var view = opts.viewBox || '0 0 1024 1024';
    var body = '';
    var keep = function (i) { return opts.only == null || split.parts[i] === opts.only; };
    if (style === 'outline') {
      var paths = item.strokes.filter(function (d, i) { return keep(i); }).map(function (d) { return '<path d="' + d + '"/>'; }).join('');
      body = '<g transform="' + FLIP + '"><g class="cc-ol-edge">' + paths + '</g><g class="cc-ol-fill">' + paths + '</g></g>';
    } else if (opts.groups) {
      split.labels.forEach(function (label, part) {
        var c = partBox(item, split, part);
        var dx = Math.round(((c.x0 + c.x1) / 2 - 512) * 0.45);
        var dy = Math.round(((c.y0 + c.y1) / 2 - 512) * 0.45);
        body += '<g class="cc-part" style="--dx:' + dx + 'px;--dy:' + dy + 'px"><g transform="' + FLIP + '">' +
          item.strokes.map(function (d, i) { return split.parts[i] === part ? '<path fill="' + color(part) + '" d="' + d + '"/>' : ''; }).join('') + '</g></g>';
      });
    } else {
      body = '<g transform="' + FLIP + '">' + item.strokes.map(function (d, i) {
        if (!keep(i)) return '';
        if (style === 'trace') {
          var part = split.parts[i];
          if (opts.done && opts.done.indexOf(part) !== -1) return '<path fill="' + color(part) + '" d="' + d + '"/>';
          if (opts.trace && opts.trace.indexOf(part) === -1) return '';
          return '<path fill="' + color(part) + '" fill-opacity=".26" d="' + d + '"/>';
        }
        var fillColor = style === 'solid' ? '#1f2d27' : style === 'faint' ? '#e3e7e5' : style === 'highlight' ? (split.parts[i] === opts.hl ? HIGHLIGHT : '#1f2d27') : color(split.parts[i]);
        return '<path data-i="' + i + '" fill="' + fillColor + '" d="' + d + '"/>';
      }).join('') + '</g>';
    }
    return '<svg class="cc-glyph" viewBox="' + view + '" aria-hidden="true">' + (opts.grid ? GRID : '') + body + '</svg>';
  }

  // One component's name: its character, or a small drawing when it has none.
  function partName(item, split, part, colored) {
    var label = split.labels[part];
    var style = colored ? ' style="color:' + color(part) + '"' : '';
    if (label && label !== '？') return '<span class="cc-part-name"' + style + '>' + esc(label) + '</span>';
    var b = partBox(item, split, part);
    var pad = 40;
    var view = (b.x0 - pad) + ' ' + (b.y0 - pad) + ' ' + (b.x1 - b.x0 + pad * 2) + ' ' + (b.y1 - b.y0 + pad * 2);
    return '<span class="cc-part-shape">' + glyph(item, split, { only: part, viewBox: view, style: colored ? 'color' : 'solid' }) + '</span>';
  }

  function formula(item, split, colored) {
    if (split.labels.length < 2) return '<span class="cc-formula cc-single">' + T('Single-component character', '独体字') + '</span>';
    return '<span class="cc-formula">' + split.labels.map(function (l, p) { return partName(item, split, p, colored); }).join('<i>+</i>') + '</span>';
  }

  function pinyin(item) {
    if (!$('ccPinyin').checked) return '';
    return '<span class="cc-py">' + esc(item.py) + '</span>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- sheets ----------

  function sheet(inner, extraClass) {
    var size = PAPER[$('ccPaper').value];
    var title = $('ccTitle').value.trim();
    return '<div class="cc-sheet ' + (extraClass || '') + '" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm">' +
      '<div class="cc-sheet-inner">' +
      '<div class="cc-sheet-head"><span class="cc-sheet-title">' + esc(title) + '</span>' +
      (extraClass === 'is-student' ? '<span class="cc-name">' + T('Name', '姓名') + ' ________________</span>' : '') + '</div>' +
      inner +
      '<div class="cc-sheet-foot"><span>CLS Teaching Tools</span><span>clsteachingtools.com</span></div>' +
      '</div></div>';
  }

  function chunks(list, n) {
    var out = [];
    for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  }

  function colorSheets(items, per) {
    return chunks(items, per).map(function (group) {
      return sheet('<div class="cc-cards per-' + per + '">' + group.map(function (item) {
        var split = splitOf(item);
        return '<div class="cc-card">' + glyph(item, split, { grid: true }) +
          '<div class="cc-card-text">' + formula(item, split, true) + pinyin(item) + '</div></div>';
      }).join('') + '</div>');
    }).join('');
  }

  function legend(item, split) {
    return '<ul class="cc-legend">' + split.labels.map(function (l, p) {
      var c = COLORS[p % COLORS.length];
      return '<li><span class="cc-swatch" style="background:' + c.hex + '"></span>' + partName(item, split, p, false) +
        '<span class="cc-arrow">→</span><b style="color:' + c.hex + '">' + (ZH ? c.zh + '色' : c.en) + '</b></li>';
    }).join('') + '</ul>';
  }

  function coloringSheets(items, per) {
    var pages = chunks(items, per);
    var make = function (answer) {
      return pages.map(function (group) {
        var head = answer
          ? '<p class="cc-instruct cc-answer">' + T('Answer key', '答案') + '</p>'
          : '<p class="cc-instruct">' + T('Colour each component in the colour shown below the character.', '按照字下面的图例，给每个部件涂上颜色。') + '</p>';
        return sheet(head + '<div class="cc-cards per-' + per + '">' + group.map(function (item) {
          var split = splitOf(item);
          return '<div class="cc-card">' + glyph(item, split, { grid: true, style: answer ? 'color' : 'outline' }) +
            '<div class="cc-card-text">' + pinyin(item) + legend(item, split) + '</div></div>';
        }).join('') + '</div>', answer ? '' : 'is-student');
      }).join('');
    };
    return make(false) + ($('ccKey').checked ? make(true) : '');
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // Board squares and pieces share one scale (side mm per 1024 units) so pieces fit.
  function puzzleSheet(group, side, pieceOrder) {
    var colored = $('ccPieceColor').checked;
    var boards = group.map(function (item) {
      var split = splitOf(item);
      var hint = $('ccHint').checked ? glyph(item, split, { grid: true, style: 'faint' }) : glyph({ strokes: [] }, split, { grid: true });
      return '<div class="cc-board"><div class="cc-board-box" style="width:' + side + 'mm;height:' + side + 'mm">' + hint + '</div>' +
        '<div class="cc-board-text">' + pinyin(item) + '<span class="cc-count">' + T(split.labels.length + ' pieces', split.labels.length + ' 块') + '</span></div></div>';
    }).join('');
    var pieces = pieceOrder.map(function (piece) {
      var item = piece.item, split = splitOf(item);
      var b = partBox(item, split, piece.part);
      var pad = 36;
      var w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
      var view = (b.x0 - pad) + ' ' + (b.y0 - pad) + ' ' + w + ' ' + h;
      return '<div class="cc-piece" style="width:' + (w * side / 1024).toFixed(1) + 'mm;height:' + (h * side / 1024).toFixed(1) + 'mm">' +
        glyph(item, split, { only: piece.part, viewBox: view, style: colored ? 'color' : 'solid' }) + '</div>';
    }).join('');
    return sheet('<p class="cc-instruct">' + T('Cut out the pieces at the bottom and glue them into the squares to rebuild each character.', '把下面的部件剪下来，贴进上面的格子里，拼回原来的字。') + '</p>' +
      '<div class="cc-boards">' + boards + '</div>' +
      '<p class="cc-cut-label">✂️ ' + T('Cut along the dashed lines', '沿虚线剪下') + '</p>' +
      '<div class="cc-pieces">' + pieces + '</div>', 'is-student cc-puzzle');
  }

  function puzzleSheets(items, per) {
    var start = { 1: 120, 2: 80, 3: 62, 4: 62 }[per];
    return chunks(items, per).map(function (group) {
      var order = [];
      group.forEach(function (item) { splitOf(item).labels.forEach(function (l, part) { order.push({ item: item, part: part }); }); });
      return { group: group, order: shuffle(order), side: start };
    });
  }

  // ---------- component tracing ----------
  //
  // One block per character:
  //   row 1  colour model | build-up: trace part 1, then part 1 done + trace part 2 … | whole character to trace | empty
  //   row 2  (optional) whole character to trace ×2, then empty boxes to write alone

  function tracingBlock(item, side, perRow, rows) {
    var split = splitOf(item);
    var all = split.labels.map(function (l, p) { return p; });
    var box = function (inner, cls) {
      return '<div class="cc-tr-box' + (cls ? ' ' + cls : '') + '" style="width:' + side + 'mm;height:' + side + 'mm">' + inner + '</div>';
    };
    var empty = function () { return box(glyph({ strokes: [] }, split, { grid: true })); };
    var whole = function () { return box(glyph(item, split, { grid: true, style: 'trace', trace: all })); };

    var first = [box(glyph(item, split, { grid: true }), 'is-model')];
    if (split.labels.length > 1) {
      all.forEach(function (p) {
        first.push(box(glyph(item, split, { grid: true, style: 'trace', done: all.slice(0, p), trace: [p] })));
      });
    }
    var room = perRow - first.length;
    var wholeCount = rows === 1 ? Math.min(2, Math.max(1, room - 2)) : room;
    for (var i = 0; i < wholeCount && first.length < perRow; i++) first.push(whole());
    while (first.length < perRow) first.push(empty());

    var html = '<div class="cc-tr-row">' + first.join('') + '</div>';
    if (rows === 2) {
      var second = [whole(), whole()];
      while (second.length < perRow) second.push(empty());
      html += '<div class="cc-tr-row">' + second.join('') + '</div>';
    }
    var label = '<div class="cc-tr-label">' + ($('ccPinyin').checked ? '<span class="cc-py">' + esc(item.py) + '</span>' : '') +
      formula(item, split, true) + '</div>';
    return '<div class="cc-tr-block" style="--g:' + (side * 1.5) + 'mm">' + label + html + '</div>';
  }

  function tracingSheet(group, side) {
    var size = PAPER[$('ccPaper').value];
    var width = size[0] - 26;
    var gap = 1.2;
    var perRow = Math.max(5, Math.floor((width + gap) / (side + gap)));
    var rows = Number($('ccRows').value);
    return sheet('<p class="cc-instruct">' + T('Trace one component at a time in its colour, then trace the whole character, then write it on your own.', '先按颜色一个部件一个部件地描，再描整个字，最后自己写。') + '</p>' +
      '<div class="cc-tr">' + group.map(function (item) { return tracingBlock(item, side, perRow, rows); }).join('') + '</div>', 'is-student');
  }

  // ---------- component family ----------

  var orderPromise = null;
  function loadOrder() {
    if (!orderPromise) {
      orderPromise = fetch(ORDER_URL).then(function (res) { return res.ok ? res.text() : ''; }).catch(function () { return ''; }).then(function (text) {
        var rank = {};
        Array.from(text.trim()).forEach(function (ch, i) { rank[ch] = i; });
        return rank;
      });
    }
    return orderPromise;
  }

  function variantsOf(comp) {
    var list = [comp];
    if (VARIANTS[comp]) list.push(VARIANTS[comp]);
    if (comp === '⺼') list.push('月');
    return list;
  }

  // Characters whose top-level parts include the component, easiest first.
  function familyOf(comp, data, rank) {
    var forms = variantsOf(comp);
    var found = [];
    Object.keys(data).forEach(function (ch) {
      var labels = data[ch][0];
      if (!labels || ch === comp) return;
      if (forms.some(function (f) { return labels.indexOf(f) !== -1; })) found.push(ch);
    });
    return found.sort(function (a, b) {
      var ra = rank[a] == null ? 1e6 + a.codePointAt(0) : rank[a];
      var rb = rank[b] == null ? 1e6 + b.codePointAt(0) : rank[b];
      return ra - rb;
    });
  }

  // The part of this character that is the component (-1 when none).
  function familyPart(split, forms) {
    for (var p = 0; p < split.labels.length; p++) if (forms.indexOf(split.labels[p]) !== -1) return p;
    return -1;
  }

  // Which of n branches are left empty, spread around the circle.
  function blankSlots(n, blanks) {
    var slots = {};
    for (var k = 0; k < blanks; k++) slots[Math.floor((k + 0.5) * n / blanks)] = true;
    return slots;
  }

  // A square view around the strokes, so side forms like 氵 sit in the middle of the circle.
  function centeredView(item) {
    var b = strokeBoxes(item).reduce(function (acc, s) {
      return { x0: Math.min(acc.x0, s.x0), x1: Math.max(acc.x1, s.x1), y0: Math.min(acc.y0, s.y0), y1: Math.max(acc.y1, s.y1) };
    }, { x0: 1024, x1: 0, y0: 1024, y1: 0 });
    var side = Math.max(b.x1 - b.x0, b.y1 - b.y0, 420) + 120;
    var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    return (mx - side / 2) + ' ' + (my - side / 2) + ' ' + side + ' ' + side;
  }

  var famView = null;
  var famToken = 0;
  function renderFamily() {
    var token = ++famToken;
    var comp = Array.from($('ccFamComp').value.trim())[0] || '';
    var count = Number($('ccFamCount').value);
    var box = $('ccSheets');
    if (!comp) {
      famView = null;
      $('ccFamPick').innerHTML = '';
      box.innerHTML = '<p class="cc-empty">' + T('Type a component in the middle box, like 氵 or 木.', '在“中间的部件”里输入一个部件，比如 氵 或 木。') + '</p>';
      return;
    }
    $('ccStatus').textContent = T('Loading…', '正在加载…');
    Promise.all([loadData(), loadOrder()]).then(function (res) {
      if (token !== famToken) return null;
      var data = res[0], rank = res[1];
      var family = familyOf(comp, data, rank);
      var typed = parseChars($('ccChars').value).filter(function (ch) { return family.indexOf(ch) !== -1; });
      var suggestions = typed.concat(family.filter(function (ch) { return typed.indexOf(ch) === -1; })).slice(0, 36);
      var key = comp + '|' + count;
      var picked = (state.famPicks[key] || suggestions.slice(0, count)).filter(function (ch) { return suggestions.indexOf(ch) !== -1; }).slice(0, count);
      famView = { key: key, count: count, picked: picked };
      $('ccFamPick').innerHTML = suggestions.map(function (ch) {
        return '<button type="button" class="cc-chip' + (picked.indexOf(ch) !== -1 ? ' is-active' : '') + '" data-ch="' + esc(ch) + '"><b>' + esc(ch) + '</b></button>';
      }).join('');
      if (!picked.length) {
        box.innerHTML = '<p class="cc-empty">' + T('No characters found with this component. Try its other form, like 氵 for 水.', '没有找到含这个部件的字。可以换个写法试试，比如“水”在字的左边写作“氵”。') + '</p>';
        $('ccStatus').textContent = '';
        return null;
      }
      var center = variantsOf(comp).filter(function (f) {
        return picked.some(function (ch) { return data[ch][0].indexOf(f) !== -1; });
      })[0] || comp;
      return Promise.all([loadStrokes(center)].concat(picked.map(loadStrokes))).then(function (strokes) {
        if (token !== famToken) return;
        var items = picked.map(function (ch, i) {
          var list = strokes[i + 1];
          return list ? { ch: ch, strokes: list, base: baseSplit(ch, data[ch], list.length), py: pinyinOf(ch) } : null;
        }).filter(Boolean);
        var blankValue = $('ccFamBlank').value;
        var blanks = blankValue === 'all' ? items.length : Math.min(Number(blankValue), items.length);
        var forms = variantsOf(comp).concat(center);
        var centerItem = strokes[0] ? { ch: center, strokes: strokes[0] } : null;
        var html = familySheet(center, centerItem, items, forms, blankSlots(items.length, blanks), blanks > 0, false);
        if (blanks && $('ccKey').checked) html += familySheet(center, centerItem, items, forms, {}, false, true);
        box.innerHTML = html;
        fitPreview();
        $('ccStatus').textContent = '';
      });
    }).catch(function (error) {
      $('ccStatus').textContent = T('Could not load the character data. Check the internet connection and reload.', '汉字数据没有加载成功，请检查网络后刷新页面。');
      console.error(error);
    });
  }

  function familySheet(center, centerItem, items, forms, blank, student, answer) {
    var size = PAPER[$('ccPaper').value];
    var w = size[0] - 26;                    // inner width (mm)
    var h = size[1] - 24 - 30;               // map height: page minus padding, head, foot and instruction
    var cx = w / 2, cy = h / 2;
    var node = Math.min(40, w / 4.6);        // side of each 田字格
    var rx = cx - node * 0.62, ry = Math.min(cy - node * 0.75, rx * 1.35);
    var hub = 58;
    var lines = '', nodes = '';
    items.forEach(function (item, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / items.length;
      var x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      lines += '<line x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      var split = splitOf(item);
      var empty = blank[i];
      var drawn = empty ? glyph({ strokes: [] }, split, { grid: true }) : glyph(item, split, { grid: true, style: 'highlight', hl: familyPart(split, forms) });
      var py = $('ccPinyin').checked ? '<span class="cc-py">' + (empty ? '&nbsp;' : esc(item.py)) + '</span>' : '';
      nodes += '<div class="cc-fam-node' + (empty ? ' is-blank' : '') + '" style="left:' + (x - node / 2).toFixed(1) + 'mm;top:' + (y - node / 2).toFixed(1) + 'mm;width:' + node.toFixed(1) + 'mm">' +
        '<div class="cc-fam-box" style="height:' + node.toFixed(1) + 'mm">' + drawn + '</div>' + py + '</div>';
    });
    var hubGlyph = centerItem
      ? glyph(centerItem, { labels: [center], parts: centerItem.strokes.map(function () { return 0; }) }, { style: 'highlight', hl: 0, viewBox: centeredView(centerItem) })
      : '<span class="cc-fam-text">' + esc(center) + '</span>';
    var caption = $('ccFamCaption').value.trim();
    var hubHtml = '<div class="cc-fam-hub" style="left:' + (cx - hub / 2).toFixed(1) + 'mm;top:' + (cy - hub / 2).toFixed(1) + 'mm;width:' + hub + 'mm;height:' + hub + 'mm">' +
      '<div class="cc-fam-hub-glyph">' + hubGlyph + '</div>' + (caption ? '<span class="cc-fam-caption">' + esc(caption) + '</span>' : '') + '</div>';
    var head = answer
      ? '<p class="cc-instruct cc-answer">' + T('Answer key', '答案') + '</p>'
      : '<p class="cc-instruct">' + (student
        ? T('Write characters that have「' + center + '」in the empty boxes.', '在空格里写出带「' + center + '」的字。')
        : T('All of these characters have「' + center + '」.', '这些字都有「' + center + '」。')) + '</p>';
    return sheet(head + '<div class="cc-fam" style="height:' + h + 'mm">' +
      '<svg class="cc-fam-lines" viewBox="0 0 ' + w + ' ' + h + '" style="width:' + w + 'mm;height:' + h + 'mm">' + lines + '</svg>' +
      nodes + hubHtml + '</div>', student ? 'is-student' : '');
  }

  // ---------- render ----------

  var renderToken = 0;
  function render() {
    var token = ++renderToken;
    var chars = parseChars($('ccChars').value);
    if (!chars.length) {
      state.chars = [];
      paintChips();
      if (state.mode === 'family') { renderFamily(); return; }
      $('ccSheets').innerHTML = '<p class="cc-empty">' + T('Type a few characters to start.', '输入几个汉字就能开始。') + '</p>';
      return;
    }
    $('ccStatus').textContent = T('Loading strokes…', '正在加载笔画…');
    Promise.all([loadData()].concat(chars.map(loadStrokes))).then(function (results) {
      if (token !== renderToken) return;
      var data = results[0];
      state.chars = chars.map(function (ch, i) {
        var strokes = results[i + 1];
        if (!strokes) return { ch: ch, missing: true };
        return { ch: ch, strokes: strokes, base: baseSplit(ch, data[ch], strokes.length), py: pinyinOf(ch) };
      });
      paintChips();
      paintSheets();
      if (state.selected) paintEditor();
    }).catch(function (error) {
      $('ccStatus').textContent = T('Could not load the character data. Check the internet connection and reload.', '汉字数据没有加载成功，请检查网络后刷新页面。');
      console.error(error);
    });
  }

  function usable() { return state.chars.filter(function (c) { return !c.missing; }); }

  function paintSheets() {
    if (state.mode === 'family') { renderFamily(); return; }
    var items = usable();
    var per = Number($('ccPer').value);
    var box = $('ccSheets');
    if (!items.length) { box.innerHTML = '<p class="cc-empty">' + T('None of these characters has stroke data yet.', '这些字暂时没有笔画数据。') + '</p>'; return; }
    box.innerHTML = '';
    if (state.mode === 'color') box.innerHTML = colorSheets(items, per);
    else if (state.mode === 'coloring') box.innerHTML = coloringSheets(items, per);
    else if (state.mode === 'tracing') {
      // Shrink the boxes until each sheet fits on one page.
      chunks(items, per).forEach(function (group) {
        var holder = document.createElement('div');
        var side = 21;
        holder.innerHTML = tracingSheet(group, side);
        box.appendChild(holder.firstChild);
        var page = box.lastChild;
        for (var guard = 0; guard < 12 && overflows(page) && side > 12; guard++) {
          side -= 1;
          holder.innerHTML = tracingSheet(group, side);
          box.replaceChild(holder.firstChild, page);
          page = box.lastChild;
        }
      });
    }
    else {
      // A single-component character would be one piece: nothing to rebuild.
      items = items.filter(function (item) { return splitOf(item).labels.length > 1; });
      if (!items.length) { box.innerHTML = '<p class="cc-empty">' + T('These characters do not split into components. Click a character on the left and click its strokes to split it.', '这些都是独体字，没有部件可以拼。可以点左边的字，再点笔画，自己拆开。') + '</p>'; return; }
      var plans = puzzleSheets(items, per);
      box.innerHTML = plans.map(function (p) { return puzzleSheet(p.group, p.side, p.order); }).join('');
      // Shrink the scale until each sheet fits on one page.
      plans.forEach(function (plan, i) {
        var page = box.children[i];
        for (var guard = 0; guard < 16 && overflows(page) && plan.side > 30; guard++) {
          plan.side -= 6;
          var fresh = document.createElement('div');
          fresh.innerHTML = puzzleSheet(plan.group, plan.side, plan.order);
          box.replaceChild(fresh.firstChild, page);
          page = box.children[i];
        }
      });
    }
    fitPreview();
    var missing = state.chars.filter(function (c) { return c.missing; }).length;
    var single = state.mode === 'puzzle' ? usable().length - items.length : 0;
    var notes = [];
    if (missing) notes.push(T(missing + ' character(s) skipped: no stroke data.', '有 ' + missing + ' 个字没有笔画数据，已跳过。'));
    if (single) notes.push(T(single + ' single-component character(s) left out of the puzzle.', '有 ' + single + ' 个独体字不放进拼图。'));
    $('ccStatus').textContent = notes.join(' ');
  }

  function overflows(page) {
    var inner = page.querySelector('.cc-sheet-inner');
    return inner.scrollHeight > inner.clientHeight + 1;
  }

  function fitPreview() {
    var stage = $('ccStage'), sheets = $('ccSheets');
    sheets.style.zoom = 1;
    var first = sheets.querySelector('.cc-sheet');
    if (!first) return;
    var z = Math.min(1, (stage.clientWidth - 24) / first.offsetWidth);
    sheets.style.zoom = z;
  }

  function parseChars(text) {
    var seen = {};
    var out = [];
    (text.match(/\p{Script=Han}/gu) || []).forEach(function (ch) {
      if (!seen[ch] && out.length < MAX_CHARS) { seen[ch] = true; out.push(ch); }
    });
    return out;
  }

  function pinyinOf(ch) {
    try { return window.ChenWordlist ? window.ChenWordlist.toPinyin(ch) : ''; } catch (e) { return ''; }
  }

  function paintChips() {
    $('ccChips').innerHTML = state.chars.map(function (item) {
      var note, cls = '';
      if (item.missing) { note = T('no data', '无数据'); cls = 'is-missing'; }
      else {
        var n = splitOf(item).labels.length;
        note = n < 2 ? T('1 part', '独体字') : T(n + ' parts', n + ' 个部件');
        if (overrides[item.ch]) note += ' ✎';
      }
      return '<button type="button" class="cc-chip ' + cls + (state.selected === item.ch ? ' is-active' : '') + '" data-ch="' + esc(item.ch) + '"' + (item.missing ? ' disabled' : '') + '>' +
        '<b>' + esc(item.ch) + '</b><small>' + note + '</small></button>';
    }).join('');
  }

  // ---------- split editor ----------

  function paintEditor() {
    var item = usable().find(function (c) { return c.ch === state.selected; });
    $('ccEditor').hidden = !item;
    if (!item) return;
    var split = splitOf(item);
    $('ccEditorChar').innerHTML = glyph(item, split, { grid: true });
    $('ccEditorParts').innerHTML = split.labels.map(function (label, p) {
      return '<label class="cc-part-row"><span class="cc-swatch" style="background:' + color(p) + '"></span>' +
        '<input type="text" maxlength="2" data-part="' + p + '" value="' + esc(label === '？' ? '' : label) + '" placeholder="？" aria-label="' + T('Component ' + (p + 1), '部件 ' + (p + 1)) + '"></label>';
    }).join('');
  }

  function editSplit(item, change) {
    var split = splitOf(item);
    var next = { labels: split.labels.slice(), parts: split.parts.slice() };
    change(next);
    overrides[item.ch] = tidy(next);
    saveOverrides();
    paintChips();
    paintEditor();
    paintSheets();
  }

  $('ccEditorChar').addEventListener('click', function (event) {
    var path = event.target.closest('path[data-i]');
    var item = usable().find(function (c) { return c.ch === state.selected; });
    if (!path || !item) return;
    var i = Number(path.dataset.i);
    editSplit(item, function (next) {
      var count = next.labels.length;
      var p = (next.parts[i] + 1) % (count + 1);
      if (p === count) next.labels.push('？');
      next.parts[i] = p;
    });
  });

  $('ccEditorParts').addEventListener('change', function (event) {
    var input = event.target.closest('input[data-part]');
    var item = usable().find(function (c) { return c.ch === state.selected; });
    if (!input || !item) return;
    editSplit(item, function (next) { next.labels[Number(input.dataset.part)] = input.value.trim() || '？'; });
  });

  $('ccEditorReset').addEventListener('click', function () {
    delete overrides[state.selected];
    saveOverrides();
    paintChips();
    paintEditor();
    paintSheets();
  });

  $('ccChips').addEventListener('click', function (event) {
    var chip = event.target.closest('.cc-chip');
    if (!chip) return;
    state.selected = state.selected === chip.dataset.ch ? null : chip.dataset.ch;
    paintChips();
    paintEditor();
  });

  // ---------- projector ----------

  function paintShow() {
    var items = usable();
    if (!items.length) return;
    state.show = (state.show + items.length) % items.length;
    var item = items[state.show];
    var split = splitOf(item);
    $('ccShowCard').classList.remove('is-split');
    $('ccShowSplit').textContent = T('Split apart', '拆开');
    $('ccShowCard').innerHTML = glyph(item, split, { grid: true, groups: true }) +
      '<div class="cc-show-text">' + formula(item, split, true) + '<span class="cc-py">' + esc(item.py) + '</span></div>';
    $('ccShowCount').textContent = (state.show + 1) + ' / ' + items.length;
  }

  function openShow() {
    if (!usable().length) return;
    state.show = 0;
    $('ccShowBox').hidden = false;
    paintShow();
    if ($('ccShowBox').requestFullscreen) $('ccShowBox').requestFullscreen().catch(function () {});
  }

  function closeShow() {
    $('ccShowBox').hidden = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  $('ccShow').addEventListener('click', openShow);
  $('ccShowClose').addEventListener('click', closeShow);
  $('ccShowPrev').addEventListener('click', function () { state.show--; paintShow(); });
  $('ccShowNext').addEventListener('click', function () { state.show++; paintShow(); });
  function toggleSplit() {
    var split = $('ccShowCard').classList.toggle('is-split');
    $('ccShowSplit').textContent = split ? T('Put together', '合上') : T('Split apart', '拆开');
  }
  $('ccShowSplit').addEventListener('click', toggleSplit);
  document.addEventListener('keydown', function (event) {
    if ($('ccShowBox').hidden) return;
    if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); state.show++; paintShow(); }
    else if (event.key === 'ArrowLeft') { state.show--; paintShow(); }
    else if (event.key === 'Enter') toggleSplit();
    else if (event.key === 'Escape') closeShow();
  });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && !$('ccShowBox').hidden) $('ccShowBox').hidden = true;
  });

  // ---------- controls ----------

  function setMode(mode) {
    if (!PER[mode]) mode = 'color';
    state.mode = mode;
    document.querySelectorAll('.cc-modes [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === mode)); });
    document.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.dataset.for.split(' ').indexOf(mode) === -1; });
    $('ccShow').hidden = mode !== 'color';
    $('ccPer').closest('div').hidden = mode === 'family';
    var per = state.per[mode] || PER_DEFAULT[mode];
    $('ccPer').innerHTML = PER[mode].map(function (n) { return '<option value="' + n + '"' + (n === per ? ' selected' : '') + '>' + n + '</option>'; }).join('');
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  document.querySelector('.cc-modes').addEventListener('click', function (event) {
    var button = event.target.closest('[data-mode]');
    if (!button) return;
    setMode(button.dataset.mode);
    if (state.chars.length || state.mode === 'family') paintSheets();
  });

  $('ccPer').addEventListener('change', function () { state.per[state.mode] = Number($('ccPer').value); paintSheets(); });
  $('ccPaper').addEventListener('change', function () {
    $('cc-page-size').textContent = '@page { size: ' + $('ccPaper').value + '; margin: 0; }';
    paintSheets();
  });
  ['ccPinyin', 'ccKey', 'ccHint', 'ccPieceColor', 'ccFamCount', 'ccFamBlank', 'ccRows'].forEach(function (id) { $(id).addEventListener('change', paintSheets); });
  $('ccFamCaption').addEventListener('input', paintSheets);
  var famTyping = null;
  $('ccFamComp').addEventListener('input', function () { clearTimeout(famTyping); famTyping = setTimeout(paintSheets, 350); });
  $('ccFamPick').addEventListener('click', function (event) {
    var chip = event.target.closest('.cc-chip');
    if (!chip || !famView) return;
    var picked = famView.picked.slice();
    var at = picked.indexOf(chip.dataset.ch);
    if (at !== -1) picked.splice(at, 1);
    else if (picked.length >= famView.count) {
      $('ccStatus').textContent = T('Already ' + famView.count + ' characters: remove one first, or show more characters around it.', '已经选了 ' + famView.count + ' 个字，先拿掉一个，或者把“周围几个字”调多一点。');
      return;
    } else picked.push(chip.dataset.ch);
    state.famPicks[famView.key] = picked;
    paintSheets();
  });
  $('ccTitle').addEventListener('input', paintSheets);
  var typing = null;
  $('ccChars').addEventListener('input', function () { clearTimeout(typing); typing = setTimeout(render, 350); });
  $('ccPrint').addEventListener('click', function () { if (usable().length) window.print(); });
  window.addEventListener('resize', fitPreview);

  // ---------- start ----------

  var handoff = window.ChenWordlistHandoff;
  var handed = handoff && handoff.active();
  if (handed) {
    $('ccChars').value = handed.items.map(function (item) { return item.zh; }).join(' ');
    handoff.mountBar(handed);
  }
  setMode(new URLSearchParams(window.location.search).get('mode') || 'color');
  render();
})();
