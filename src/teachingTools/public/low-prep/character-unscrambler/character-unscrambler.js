(function () {
  'use strict';

  // Character Unscrambler: typed characters/words are drawn as large as they
  // fit, cropped tight to their strokes and cut into a square-ish grid, so every
  // cell holds part of a character. Students cut the scrambled cells apart,
  // rebuild the character(s) and practise writing them underneath.

  // ---- Constants -------------------------------------------------------------

  // Output sheets: portrait A4 at 200 dpi.
  var PAGE_W = 1654;
  var PAGE_H = 2339;
  var MARGIN = 80;
  var HEADER_H = 150;

  var CJK = /[㐀-鿿豈-﫿]/;
  var FONTS = {
    kai: "'KaiTi', 'STKaiti', 'Kaiti SC', 'BiauKai', 'Noto Serif SC', serif",
    sans: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', sans-serif"
  };
  var LATIN = "'Nunito', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  var COLORS = { red: '#e0201b', orange: '#bf7f35', black: '#1c1c1c', green: '#194f45', blue: '#1f4fa8' };
  var BACKGROUNDS = {
    white: null,
    pink: ['#fbe4ef', '#f3d4ea', '#fdf0f5'],
    green: ['#e3f1dc', '#d5ead9', '#f0f7ea'],
    blue: ['#dfeaf8', '#d6e0f5', '#eef4fb'],
    yellow: ['#fdf1c9', '#fbe7b5', '#fff8e3']
  };
  var GUIDE = '#c9c9c9';

  // ---- State -----------------------------------------------------------------

  var level = 3;
  var seed = newSeed();
  var output = [];   // [{ canvas, label, file, dataUrl }]
  var bgImage = null;
  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    [
      'words', 'unit', 'per', 'font', 'color', 'background', 'bg-upload', 'bg-file', 'bg-fade', 'bg-status',
      'guides', 'title', 'levels',
      'out-sheet', 'out-board', 'out-answer', 'practice', 'dashed',
      'generate', 'page-count', 'reshuffle', 'png', 'pdf', 'print', 'status', 'empty', 'pages', 'print-area'
    ].forEach(function (id) {
      el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = document.getElementById('cu-' + id);
    });

    el.levels.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        level = parseInt(btn.dataset.n, 10);
        el.levels.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
      });
    });

    el.generate.addEventListener('click', function () { generate(); });
    el.reshuffle.addEventListener('click', function () { seed = newSeed(); generate(); });
    el.png.addEventListener('click', downloadPngs);
    el.pdf.addEventListener('click', downloadPdf);
    el.print.addEventListener('click', printPages);

    el.background.addEventListener('change', function () {
      el.bgUpload.hidden = el.background.value !== 'upload';
    });
    el.bgFile.addEventListener('change', function () {
      var file = el.bgFile.files[0];
      if (file) loadBackground(file);
    });
  }

  // The uploaded picture, kept as an <img> until the page is reloaded.
  function loadBackground(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      bgImage = img;
      el.bgStatus.textContent = '“' + file.name + '” ready · 图片已载入。';
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      bgImage = null;
      el.bgStatus.textContent = 'This picture could not be read — try a PNG or JPG · 无法读取，请换 PNG 或 JPG。';
    };
    img.src = url;
  }

  // ---- Input -----------------------------------------------------------------------

  // Words are split on new lines, commas, 、 and spaces; in "character" mode
  // every Chinese character becomes its own item.
  function parseItems(text, unit) {
    var words = text.split(/[\s,，、;；。.!！?？]+/).map(function (s) {
      return Array.from(s).filter(function (ch) { return CJK.test(ch); }).join('');
    }).filter(Boolean);
    if (unit !== 'char') return words;
    var chars = [];
    words.forEach(function (w) { Array.from(w).forEach(function (ch) { chars.push(ch); }); });
    return chars;
  }

  function chunk(items, size) {
    var out = [];
    for (var i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  function readOptions() {
    return {
      unit: el.unit.value,
      per: parseInt(el.per.value, 10) || 1,
      font: FONTS[el.font.value] || FONTS.kai,
      color: COLORS[el.color.value] || COLORS.red,
      background: el.background.value === 'upload'
        ? (bgImage ? { image: bgImage, fade: parseFloat(el.bgFade.value) } : null)
        : BACKGROUNDS[el.background.value] || null,
      needsPicture: el.background.value === 'upload' && !bgImage,
      guides: el.guides.checked,
      title: el.title.value.trim(),
      sheet: el.outSheet.checked,
      board: el.outBoard.checked,
      answer: el.outAnswer.checked,
      practice: el.practice.checked,
      dashed: el.dashed.checked
    };
  }

  // ---- Generation -------------------------------------------------------------------

  function generate() {
    var opts = readOptions();
    var items = parseItems(el.words.value, opts.unit);
    if (!items.length) {
      el.status.textContent = 'Type at least one Chinese character first · 请先输入汉字。';
      return;
    }
    if (opts.needsPicture) {
      el.status.textContent = 'Choose a background picture first, or pick another background · 请先选择背景图片。';
      return;
    }
    if (!opts.sheet && !opts.board && !opts.answer) {
      el.status.textContent = 'Tick at least one page type to print · 请至少勾选一种打印页面。';
      return;
    }
    el.generate.disabled = true;
    el.status.textContent = 'Cutting your puzzles… · 正在生成';

    var fontsReady = document.fonts && document.fonts.load
      ? document.fonts.load('700 100px ' + opts.font, items.join('')).catch(function () {})
      : Promise.resolve();
    fontsReady.then(function () {
      var rng = mulberry32(seed);
      var groups = chunk(items, opts.per);
      output = [];
      groups.forEach(function (group, i) {
        var p = makePuzzle(group, opts, rng);
        var base = 'puzzle-' + (i + 1);
        var name = group.join(' ');
        if (opts.sheet) output.push({ canvas: drawSheet(p, 'sheet', opts), label: name + ' · 练习纸 Worksheet', file: base + '-worksheet.png' });
        if (opts.board) output.push({ canvas: drawSheet(p, 'board', opts), label: name + ' · 拼贴底板 Board', file: base + '-board.png' });
        if (opts.answer) output.push({ canvas: drawSheet(p, 'answer', opts), label: name + ' · 答案 Answer key', file: base + '-answer.png' });
      });
      renderPreview();
      el.status.textContent = 'Made ' + groups.length + (groups.length === 1 ? ' puzzle' : ' puzzles') + ' · ' +
        output.length + ' pages. Print on A4 at 100% (actual size).';
    }).catch(function (err) {
      el.status.textContent = err && err.message ? err.message : String(err);
    }).then(function () {
      el.generate.disabled = false;
    });
  }

  // Lay the group's items out in rows, render them big, crop to the ink and
  // cut into a grid. Every row arrangement (long words may wrap), a few word
  // spacings and a slightly finer grid are tried: layouts with no blank cell
  // win, then the ones printing largest on the worksheet, then the ones whose
  // emptiest cell holds the most ink.
  function makePuzzle(group, opts, rng) {
    var area = puzzleArea(opts);
    var best = null;
    arrangements(group).forEach(function (layout) {
      [0.04, 0.16, 0.3].forEach(function (gap) {
        var art = renderArt(layout.rows, gap, opts, 240);
        var aspect = art.width / art.height;
        var w = Math.min(area.w, area.h * aspect);
        var fill = (w * w / aspect) / (area.w * area.h);
        var base = gridFor(aspect, layout.rows.length);
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (more) {
          var grid = { rows: base.rows + more[0], cols: base.cols + more[1] };
          var finer = more[0] + more[1];
          var ink = cellInk(art, grid);
          // An empty square rules a layout out; a faint one (under 4% strokes,
          // easy to mistake for blank once printed) only costs a little.
          var total = fill + 0.3 * ink.min - ink.empty - 0.12 * ink.faint -
            (layout.wrapped ? 0.1 : 0) - finer * 0.04;
          if (!best || total > best.total) best = { total: total, rows: layout.rows, gap: gap, grid: grid };
        });
      });
    });

    var art = renderArt(best.rows, best.gap, opts, 1000);
    var grid = best.grid;
    var chars = [];
    group.forEach(function (w) {
      Array.from(w).forEach(function (ch) { if (chars.indexOf(ch) === -1) chars.push(ch); });
    });

    // Cells in reading order, then a scrambled order that is never the solution.
    var cells = [];
    for (var r = 0; r < grid.rows; r++) {
      for (var c = 0; c < grid.cols; c++) cells.push({ r: r, c: c, letter: letterFor(r * grid.cols + c) });
    }
    var order = cells.slice();
    shuffle(order, rng);
    if (order.length > 1 && order.every(function (cell, i) { return cell === cells[i]; })) order.push(order.shift());
    // Letters follow the scrambled order so they give nothing away.
    order.forEach(function (cell, i) { cell.letter = letterFor(i); });

    return { art: art, rows: grid.rows, cols: grid.cols, cells: cells, order: order, chars: chars, group: group };
  }

  // Ways to stack the group into rows: whole items 1, 2, 3 rows (balanced),
  // and, so a long word like 花草树木 isn't one thin strip, the characters
  // themselves split evenly over 2–4 rows (words may then wrap).
  function arrangements(group) {
    var out = [];
    for (var n = 1; n <= Math.min(group.length, 3); n++) {
      var rows = [];
      var start = 0;
      for (var i = 0; i < n; i++) {
        var take = Math.ceil((group.length - start) / (n - i));
        rows.push(group.slice(start, start + take));
        start += take;
      }
      out.push({ rows: rows, wrapped: false });
    }
    var total = group.reduce(function (sum, w) { return sum + Array.from(w).length; }, 0);
    for (var m = 2; m <= Math.min(total, 4); m++) {
      var per = Math.ceil(total / m);
      var wrapped = false;
      var lines = [[]];
      var used = 0;
      group.forEach(function (word) {
        var chars = Array.from(word);
        var piece = '';
        chars.forEach(function (ch) {
          if (used === per) {
            if (piece) { lines[lines.length - 1].push(piece); wrapped = true; }
            lines.push([]);
            piece = '';
            used = 0;
          }
          piece += ch;
          used++;
        });
        if (piece) lines[lines.length - 1].push(piece);
      });
      lines = lines.filter(function (l) { return l.length; });
      if (lines.length > 1) out.push({ rows: lines, wrapped: wrapped });
    }
    return out;
  }

  // Grid for a picture of the given aspect: the level sets the cuts along the
  // shorter side; the longer side gets as many as keep cells roughly square.
  function gridFor(aspect, textRows) {
    var rows, cols;
    if (aspect >= 1) {
      rows = Math.max(level, textRows + 1);
      cols = Math.max(level, Math.round(rows * aspect));
    } else {
      cols = level;
      rows = Math.max(level, Math.round(cols / aspect));
    }
    return { rows: Math.min(rows, 10), cols: Math.min(cols, 10) };
  }

  // Draw the rows of items with characters `size` px tall, then crop to the ink.
  // Background and guides are drawn after cropping so they fill the puzzle.
  function renderArt(rows, gap, opts, size) {
    var charGap = size * 0.04;
    var wordGap = size * gap + size * 0.12;
    var rowGap = size * 0.1;
    var rowWidths = rows.map(function (row) {
      var w = 0;
      row.forEach(function (word, i) { w += Array.from(word).length * size + (Array.from(word).length - 1) * charGap + (i ? wordGap : 0); });
      return w;
    });
    var W = Math.ceil(Math.max.apply(null, rowWidths) + size * 0.4);
    var H = Math.ceil(rows.length * size + (rows.length - 1) * rowGap + size * 0.4);
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + size + 'px ' + opts.font;
    ctx.fillStyle = '#000';
    var boxes = [];
    rows.forEach(function (row, ri) {
      var x = (W - rowWidths[ri]) / 2;
      var y = size * 0.2 + ri * (size + rowGap);
      row.forEach(function (word, i) {
        if (i) x += wordGap;
        Array.from(word).forEach(function (ch, k) {
          if (k) x += charGap;
          ctx.fillText(ch, x + size / 2, y + size / 2);
          boxes.push({ x: x, y: y, s: size });
          x += size;
        });
      });
    });

    var ink = inkBox(ctx, W, H);
    var pad = size * 0.015;
    var cx = Math.max(0, Math.floor(ink.x0 - pad));
    var cy = Math.max(0, Math.floor(ink.y0 - pad));
    var cw = Math.min(W, Math.ceil(ink.x1 + pad)) - cx;
    var ch = Math.min(H, Math.ceil(ink.y1 + pad)) - cy;

    var out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    var octx = out.getContext('2d', { willReadFrequently: true });
    paintBackground(octx, out.width, out.height, opts.background);
    if (opts.guides) {
      octx.save();
      octx.translate(-cx, -cy);
      boxes.forEach(function (b) { drawGuides(octx, b.x, b.y, b.s); });
      octx.restore();
    }
    octx.save();
    octx.globalCompositeOperation = 'source-over';
    // Recolour the black strokes and lay them on top.
    var tinted = document.createElement('canvas');
    tinted.width = W;
    tinted.height = H;
    var tctx = tinted.getContext('2d');
    tctx.drawImage(canvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = opts.color;
    tctx.fillRect(0, 0, W, H);
    octx.drawImage(tinted, -cx, -cy);
    octx.restore();

    out.ink = { canvas: canvas, x: cx, y: cy };
    return out;
  }

  function inkBox(ctx, W, H) {
    var data = ctx.getImageData(0, 0, W, H).data;
    var x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 60) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x0 > x1 ? { x0: 0, y0: 0, x1: W, y1: H } : { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 };
  }

  // Stroke coverage per cell (0–1): the emptiest cell's share, and how many
  // cells are empty (under 1.5%) or faint (under 4%).
  function cellInk(art, grid) {
    var src = art.ink.canvas;
    var data = src.getContext('2d').getImageData(art.ink.x, art.ink.y, art.width, art.height).data;
    var counts = new Array(grid.rows * grid.cols).fill(0);
    var cw = art.width / grid.cols;
    var ch = art.height / grid.rows;
    for (var y = 0; y < art.height; y += 2) {
      var r = Math.min(grid.rows - 1, Math.floor(y / ch));
      for (var x = 0; x < art.width; x += 2) {
        if (data[(y * art.width + x) * 4 + 3] > 60) counts[r * grid.cols + Math.min(grid.cols - 1, Math.floor(x / cw))]++;
      }
    }
    var cellArea = (cw / 2) * (ch / 2);
    var shares = counts.map(function (n) { return n / cellArea; });
    return {
      min: Math.min.apply(null, shares),
      empty: shares.filter(function (s) { return s < 0.015; }).length,
      faint: shares.filter(function (s) { return s >= 0.015 && s < 0.04; }).length
    };
  }

  // `bg` is null (white), a list of wash colours, or { image, fade }.
  function paintBackground(ctx, w, h, bg) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (!bg) return;
    if (bg.image) {
      // Cover the puzzle (crop, don't stretch), then fade toward white.
      var img = bg.image;
      var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      var dw = img.naturalWidth * s;
      var dh = img.naturalHeight * s;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(255,255,255,' + bg.fade + ')';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    var colors = bg;
    // Soft blobs of colour, like a faded watercolour wash.
    var blobs = [[0.15, 0.2, 0.55], [0.85, 0.3, 0.5], [0.4, 0.85, 0.6], [0.95, 0.95, 0.45], [0.55, 0.45, 0.4]];
    var m = Math.max(w, h);
    blobs.forEach(function (b, i) {
      var g = ctx.createRadialGradient(b[0] * w, b[1] * h, 0, b[0] * w, b[1] * h, b[2] * m);
      g.addColorStop(0, colors[i % colors.length]);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 田字格 guides behind one character: a box with dashed centre lines.
  function drawGuides(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = GUIDE;
    ctx.lineWidth = Math.max(2, s * 0.006);
    ctx.strokeRect(x, y, s, s);
    ctx.setLineDash([s * 0.03, s * 0.03]);
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s);
    ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Drawing the sheets --------------------------------------------------------------

  // Where the puzzle goes on a sheet: as large as fits, leaving room below
  // for the writing practice on the worksheet.
  function puzzleBox(p, kind, opts) {
    var area = puzzleArea(opts, kind);
    var aspect = p.art.width / p.art.height;
    var w = Math.min(area.w, area.h * aspect);
    return { x: (PAGE_W - w) / 2, y: MARGIN + HEADER_H, w: w, h: w / aspect };
  }

  function puzzleArea(opts, kind) {
    var usableH = PAGE_H - MARGIN * 2 - HEADER_H;
    var practice = (kind || 'sheet') === 'sheet' && opts.practice;
    return { w: PAGE_W - MARGIN * 2, h: practice ? usableH * 0.6 : usableH };
  }

  function drawSheet(p, kind, opts) {
    var canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    drawHeader(ctx, p, kind, opts);

    // Board and answer key use the worksheet's cell size so pieces fit them.
    var box = puzzleBox(p, opts.sheet ? 'sheet' : kind, opts);
    var cw = box.w / p.cols;
    var ch = box.h / p.rows;

    if (kind === 'sheet') {
      p.order.forEach(function (cell, i) {
        var r = Math.floor(i / p.cols);
        var c = i % p.cols;
        var sx = cell.c * p.art.width / p.cols;
        var sy = cell.r * p.art.height / p.rows;
        ctx.drawImage(p.art, sx, sy, p.art.width / p.cols, p.art.height / p.rows, box.x + c * cw, box.y + r * ch, cw, ch);
        drawLetter(ctx, cell.letter, box.x + c * cw, box.y + r * ch, cw, ch);
      });
    } else if (kind === 'answer') {
      ctx.drawImage(p.art, box.x, box.y, box.w, box.h);
      p.cells.forEach(function (cell) { drawLetter(ctx, cell.letter, box.x + cell.c * cw, box.y + cell.r * ch, cw, ch); });
    }

    drawGridLines(ctx, box, p.rows, p.cols, kind === 'sheet' && opts.dashed, kind === 'board' ? '#9ca3af' : '#555');

    if (kind === 'sheet' && opts.practice) {
      var top = box.y + box.h + 60;
      drawPractice(ctx, p.chars, opts, MARGIN, top, PAGE_W - MARGIN * 2, PAGE_H - MARGIN - top);
    }
    return canvas;
  }

  function drawHeader(ctx, p, kind, opts) {
    var title = opts.title || '汉字拼图 · Character Unscrambler';
    var sub = {
      sheet: '剪下方格，拼出汉字' + (opts.practice ? '，再写一写' : '') + ' · Cut out the squares, rebuild the character' + (opts.practice ? ', then practise writing it.' : '.'),
      board: '把剪下的方格贴在对应的位置 · Glue each square in the right place.',
      answer: '答案：字母表示练习纸上的方格 · Answer key: letters match the squares on the worksheet.'
    }[kind];
    var nameW = 560;
    fitText(ctx, title, MARGIN, MARGIN + 52, PAGE_W - MARGIN * 2 - nameW, 56, '800', LATIN + ', ' + FONTS.sans, '#194f45');
    fitText(ctx, sub, MARGIN, MARGIN + 104, PAGE_W - MARGIN * 2, 28, '500', LATIN + ', ' + FONTS.sans, '#5d7168');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#193d38';
    ctx.font = '700 30px ' + LATIN + ', ' + FONTS.sans;
    ctx.fillText(kind === 'answer' ? 'Teacher copy · 教师用' : '姓名 Name: _______________', PAGE_W - MARGIN, MARGIN + 52);
    ctx.textAlign = 'left';
  }

  function drawGridLines(ctx, box, rows, cols, dashed, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (dashed) ctx.setLineDash([18, 12]);
    ctx.beginPath();
    for (var r = 0; r <= rows; r++) {
      ctx.moveTo(box.x, box.y + r * box.h / rows);
      ctx.lineTo(box.x + box.w, box.y + r * box.h / rows);
    }
    for (var c = 0; c <= cols; c++) {
      ctx.moveTo(box.x + c * box.w / cols, box.y);
      ctx.lineTo(box.x + c * box.w / cols, box.y + box.h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Small letter tag in a cell's corner, on a white chip so it reads on colour.
  function drawLetter(ctx, letter, x, y, w, h) {
    var s = Math.max(22, Math.min(40, Math.min(w, h) * 0.16));
    ctx.save();
    ctx.font = '800 ' + s + 'px ' + LATIN;
    var tw = ctx.measureText(letter).width;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(x + 6, y + 6, tw + s * 0.5, s * 1.2);
    ctx.fillStyle = '#555';
    ctx.textBaseline = 'top';
    ctx.fillText(letter, x + 6 + s * 0.25, y + 6 + s * 0.12);
    ctx.restore();
  }

  // Rows per character: a grey model to trace, then empty 田字格 boxes.
  // Rows pack two or three characters side by side when there are many, and
  // each character gets up to three rows when there is room to fill.
  function drawPractice(ctx, chars, opts, x, y, w, h) {
    var gap = 16;
    var perRow = 1;
    var boxSize = 0;
    var lines = 1;
    for (perRow = 1; perRow <= 3; perRow++) {
      lines = Math.ceil(chars.length / perRow);
      boxSize = Math.min(180, (h - (lines - 1) * gap) / lines);
      if (boxSize >= 120 || perRow === 3) break;
    }
    var repeat = Math.max(1, Math.min(3, Math.floor((h + gap) / ((boxSize + gap) * lines))));
    var segW = (w - (perRow - 1) * gap * 2) / perRow;
    var count = Math.max(2, Math.floor(segW / boxSize));
    var s = segW / count;
    boxSize = Math.min(boxSize, s);
    var rowsOf = [];
    chars.forEach(function (ch, i) {
      for (var k = 0; k < repeat; k++) rowsOf.push({ ch: ch, col: i % perRow, line: Math.floor(i / perRow) * repeat + k });
    });
    rowsOf.forEach(function (row) {
      var ch = row.ch;
      var sx = x + row.col * (segW + gap * 2);
      var sy = y + row.line * (boxSize + gap);
      for (var k = 0; k < count; k++) {
        var bx = sx + k * s + (s - boxSize) / 2;
        drawGuides(ctx, bx, sy, boxSize);
        ctx.save();
        ctx.strokeStyle = '#8a8a8a';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, sy, boxSize, boxSize);
        ctx.restore();
        if (k === 0) {
          ctx.save();
          ctx.fillStyle = '#b8b8b8';
          ctx.font = '400 ' + boxSize * 0.82 + 'px ' + opts.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, bx + boxSize / 2, sy + boxSize / 2 + boxSize * 0.03);
          ctx.restore();
        }
      }
    });
  }

  function fitText(ctx, text, x, y, maxWidth, size, weight, family, color) {
    var px = size;
    ctx.font = weight + ' ' + px + 'px ' + family;
    while (px > 14 && ctx.measureText(text).width > maxWidth) {
      px -= 2;
      ctx.font = weight + ' ' + px + 'px ' + family;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // A, B, … Z, then AA, AB, …
  function letterFor(i) {
    var s = '';
    i += 1;
    while (i > 0) {
      var m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  // ---- Preview + export -------------------------------------------------------------

  function renderPreview() {
    el.pages.innerHTML = '';
    output.forEach(function (page) {
      var fig = document.createElement('figure');
      fig.className = 'cu-page-card';
      var img = document.createElement('img');
      page.dataUrl = page.canvas.toDataURL('image/png');
      img.src = page.dataUrl;
      img.alt = page.label;
      var cap = document.createElement('figcaption');
      var label = document.createElement('span');
      label.textContent = page.label;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cu-btn cu-btn-outline';
      btn.textContent = '⬇️ PNG';
      btn.addEventListener('click', function () { savePng(page); });
      cap.appendChild(label);
      cap.appendChild(btn);
      fig.appendChild(img);
      fig.appendChild(cap);
      el.pages.appendChild(fig);
    });
    el.empty.hidden = output.length > 0;
    el.pageCount.textContent = output.length;
    [el.reshuffle, el.png, el.pdf, el.print].forEach(function (b) { b.disabled = !output.length; });
  }

  function savePng(page) {
    page.canvas.toBlob(function (blob) { triggerDownload(blob, fileBase() + '-' + page.file); }, 'image/png');
  }

  function downloadPngs() {
    output.forEach(function (page, i) {
      setTimeout(function () { savePng(page); }, i * 350);
    });
  }

  function downloadPdf() {
    el.pdf.disabled = true;
    el.status.textContent = 'Building PDF… · 正在生成 PDF';
    Promise.all(output.map(function (page) {
      return new Promise(function (resolve) {
        page.canvas.toBlob(function (blob) { resolve(blob.arrayBuffer()); }, 'image/jpeg', 0.92);
      }).then(function (buf) {
        return { jpeg: new Uint8Array(buf), w: page.canvas.width, h: page.canvas.height };
      });
    })).then(function (images) {
      triggerDownload(buildPdf(images), fileBase() + '.pdf');
      el.status.textContent = 'PDF downloaded · 已下载 (' + output.length + ' A4 pages). Print at 100% / actual size.';
    }).catch(function (err) {
      el.status.textContent = 'Could not build the PDF: ' + err.message;
    }).then(function () {
      el.pdf.disabled = false;
    });
  }

  // Minimal PDF 1.4 writer: one full-page JPEG per A4 page (same as PDF Puzzle Maker).
  function buildPdf(images) {
    var enc = new TextEncoder();
    var chunks = [];
    var offset = 0;
    var offsets = [];
    function push(part) {
      var bytes = typeof part === 'string' ? enc.encode(part) : part;
      chunks.push(bytes);
      offset += bytes.length;
    }
    function obj(id, parts) {
      offsets[id] = offset;
      push(id + ' 0 obj\n');
      parts.forEach(push);
      push('\nendobj\n');
    }

    var total = 2 + images.length * 3;
    push('%PDF-1.4\n%âãÏÓ\n');
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, ['<< /Type /Pages /Kids [' + images.map(function (_, i) { return (3 + i * 3) + ' 0 R'; }).join(' ') + '] /Count ' + images.length + ' >>']);
    images.forEach(function (img, i) {
      var PW = 595.28;
      var PH = 841.89;
      var pageId = 3 + i * 3;
      var contentId = pageId + 1;
      var imageId = pageId + 2;
      var content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
      obj(pageId, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>']);
      obj(contentId, ['<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream']);
      obj(imageId, [
        '<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.jpeg.length + ' >>\nstream\n',
        img.jpeg,
        '\nendstream'
      ]);
    });

    var xrefAt = offset;
    var xref = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var id = 1; id <= total; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    push(xref);
    push('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function printPages() {
    if (el.printArea.parentNode !== document.body) document.body.appendChild(el.printArea);
    el.printArea.innerHTML = '';
    var loads = output.map(function (page) {
      var img = document.createElement('img');
      img.alt = page.label;
      el.printArea.appendChild(img);
      return new Promise(function (resolve) {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = page.dataUrl || page.canvas.toDataURL('image/png');
      });
    });
    Promise.all(loads).then(function () { window.print(); });
  }

  function fileBase() {
    var t = el.title.value.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
    return t ? 'character-unscrambler-' + t : 'character-unscrambler';
  }

  function triggerDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // ---- Helpers ------------------------------------------------------------------------

  function newSeed() {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
})();
