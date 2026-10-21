(function () {
  'use strict';

  // Whole-page jigsaw: an A4 page (from a PDF, an image, or typed words) is cut
  // into N pieces, so characters end up split across pieces and students rebuild
  // the words while putting the page back together.

  // ---- Constants -------------------------------------------------------------

  // Output sheets: A4 at 200 dpi.
  var A4_SHORT = 1654;
  var A4_LONG = 2339;
  var MARGIN = 80;
  var HEADER_H = 130;
  var SLOT_GAP = 28;

  // rows × cols for a portrait page; swapped for landscape pages.
  var GRIDS = {
    2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2],
    12: [4, 3], 16: [4, 4], 20: [5, 4], 24: [6, 4]
  };

  // Knob size relative to the smaller side of a cell, and how far a knob sticks out.
  var KNOB = 0.8;
  var KNOB_REACH = 0.3 * KNOB;

  var PDFJS_BASE = '/low-prep/vocab-puzzle/pdfjs/';
  // Shared with the Article Vocabulary Builder: { word: [ { py, d: [defs] } ] }.
  var CEDICT_URL = '/low-prep/vocab-glossary/cedict.json.gz';

  var CJK = /[㐀-鿿豈-﫿]/;
  var FONTS = {
    kai: "'KaiTi', 'STKaiti', 'Kaiti SC', 'BiauKai', 'Noto Serif SC', serif",
    sans: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', sans-serif"
  };
  var LATIN = "'Nunito', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  // ---- State -----------------------------------------------------------------

  var pieceCount = 12;
  var seed = newSeed();
  var source = null;   // { kind: 'pdf' | 'image', name, pdf?, image?, pages: [{ num, on, full? }] }
  var output = [];     // [{ canvas, label, file, dataUrl }]
  var dict = null;
  var dictPromise = null;
  var activeTab = 'pdf';
  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    [
      'file-input', 'drop', 'file-status', 'thumbs-wrap', 'thumbs', 'thumb-selected', 'thumb-all', 'thumb-none',
      'words', 'font', 'text-style', 'show-pinyin', 'title', 'pieces',
      'out-scrambled', 'out-board', 'out-cut', 'dashed', 'straight', 'size',
      'generate', 'page-count', 'reshape', 'png', 'pdf', 'print', 'status', 'empty', 'pages', 'print-area'
    ].forEach(function (id) {
      el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = document.getElementById('vp-' + id);
    });

    document.querySelectorAll('.vp-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { selectTab(tab.dataset.tab); });
    });

    el.fileInput.addEventListener('change', function () {
      if (el.fileInput.files[0]) handleFile(el.fileInput.files[0]);
      el.fileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      el.drop.addEventListener(type, function (e) { e.preventDefault(); el.drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      el.drop.addEventListener(type, function (e) { e.preventDefault(); el.drop.classList.remove('is-over'); });
    });
    el.drop.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    el.thumbAll.addEventListener('click', function () { setAllPages(true); });
    el.thumbNone.addEventListener('click', function () { setAllPages(false); });

    el.pieces.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pieceCount = parseInt(btn.dataset.n, 10);
        el.pieces.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
      });
    });

    el.generate.addEventListener('click', function () { generate(); });
    el.reshape.addEventListener('click', function () { seed = newSeed(); generate(); });
    el.png.addEventListener('click', downloadPngs);
    el.pdf.addEventListener('click', downloadPdf);
    el.print.addEventListener('click', printPages);
  }

  function selectTab(name) {
    activeTab = name;
    document.querySelectorAll('.vp-tab').forEach(function (tab) {
      var on = tab.dataset.tab === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.vp-tab-panel').forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
    });
    if (name === 'type') el.words.focus();
  }

  // ---- Loading a PDF or image --------------------------------------------------

  function handleFile(file) {
    var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    var isImage = /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
    if (!isPdf && !isImage) {
      setNote(el.fileStatus, 'Please choose a PDF, PNG or JPG file · 请选择 PDF 或图片。', 'error');
      return;
    }
    el.thumbsWrap.hidden = true;
    setNote(el.fileStatus, 'Opening “' + file.name + '”… · 正在读取');
    (isPdf ? loadPdf(file) : loadImage(file)).then(function (src) {
      source = src;
      renderThumbs();
      var n = src.pages.length;
      setNote(el.fileStatus, '“' + file.name + '” — ' + n + (n === 1 ? ' page' : ' pages') +
        '. Each selected page becomes one puzzle · 每个选中的页面生成一个拼图。', 'ok');
    }).catch(function (err) {
      setNote(el.fileStatus, 'Could not open this file: ' + (err && err.message ? err.message : err), 'error');
    });
  }

  function loadPdf(file) {
    if (!window.pdfjsLib) return Promise.reject(new Error('the PDF reader did not load — refresh the page'));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
    return file.arrayBuffer().then(function (buf) {
      return window.pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        cMapUrl: PDFJS_BASE + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: PDFJS_BASE + 'standard_fonts/'
      }).promise;
    }).then(function (pdf) {
      var pages = [];
      for (var i = 1; i <= pdf.numPages; i++) pages.push({ num: i, on: i === 1 || pdf.numPages <= 4 });
      var thumbs = pages.map(function (p) {
        return renderPdfPage(pdf, p.num, 180).then(function (canvas) { p.thumb = canvas.toDataURL('image/png'); });
      });
      return Promise.all(thumbs).then(function () {
        return { kind: 'pdf', name: file.name, pdf: pdf, pages: pages };
      });
    });
  }

  // Render a PDF page so its long side is `longSide` pixels, on white.
  function renderPdfPage(pdf, num, longSide) {
    return pdf.getPage(num).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = longSide / Math.max(base.width, base.height);
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () { return canvas; });
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        var thumb = document.createElement('canvas');
        var s = 180 / Math.max(canvas.width, canvas.height);
        thumb.width = Math.round(canvas.width * s);
        thumb.height = Math.round(canvas.height * s);
        thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
        resolve({ kind: 'image', name: file.name, pages: [{ num: 1, on: true, full: canvas, thumb: thumb.toDataURL('image/png') }] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('the image could not be read')); };
      img.src = url;
    });
  }

  function renderThumbs() {
    el.thumbs.innerHTML = '';
    source.pages.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vp-thumb' + (p.on ? ' is-on' : '');
      btn.setAttribute('aria-pressed', p.on ? 'true' : 'false');
      var img = document.createElement('img');
      img.src = p.thumb;
      img.alt = 'Page ' + p.num;
      btn.appendChild(img);
      btn.appendChild(document.createTextNode(source.pages.length > 1 ? 'Page ' + p.num : source.name));
      btn.addEventListener('click', function () {
        p.on = !p.on;
        btn.classList.toggle('is-on', p.on);
        btn.setAttribute('aria-pressed', p.on ? 'true' : 'false');
        updateThumbCount();
      });
      el.thumbs.appendChild(btn);
    });
    el.thumbsWrap.hidden = false;
    updateThumbCount();
  }

  function setAllPages(on) {
    if (!source) return;
    source.pages.forEach(function (p) { p.on = on; });
    renderThumbs();
  }

  function updateThumbCount() {
    el.thumbSelected.textContent = source ? source.pages.filter(function (p) { return p.on; }).length : 0;
  }

  // ---- Typed words → an A4 page ----------------------------------------------------

  function parseItems(text) {
    return text.split(/[\r\n,，、;；\t]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function loadDictionary() {
    if (dict) return Promise.resolve(dict);
    if (dictPromise) return dictPromise;
    dictPromise = fetch(CEDICT_URL).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof DecompressionStream === 'undefined' || !res.body) throw new Error('this browser cannot decompress the dictionary');
      return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
    }).then(function (text) {
      dict = JSON.parse(text);
      return dict;
    }).catch(function (err) {
      dictPromise = null;
      throw err;
    });
    return dictPromise;
  }

  // Pinyin for a word or sentence: longest dictionary match, left to right.
  function pinyinFor(text) {
    if (!dict) return '';
    var chars = Array.from(text);
    var out = [];
    var i = 0;
    while (i < chars.length) {
      if (!CJK.test(chars[i])) { i++; continue; }
      var hit = null;
      for (var len = Math.min(8, chars.length - i); len >= 1; len--) {
        var entry = dict[chars.slice(i, i + len).join('')];
        if (entry) {
          var best = entry.filter(function (e) { return e.py && e.py.charAt(0) === e.py.charAt(0).toLowerCase(); })[0] || entry[0];
          hit = { len: len, py: (best.py || '').replace(/\s+/g, '') };
          break;
        }
      }
      if (hit) { out.push(hit.py); i += hit.len; } else { i++; }
    }
    return out.join(' ');
  }

  // Lay the words out centred on the page, with rows placed symmetrically
  // around the middle on a half-band lattice: a row on a horizontal cut gets
  // every word sliced top/bottom, and the centre of the page always sits on a
  // cut line (horizontal if the row count is even, vertical if columns are even).
  // Characters grow as large as the row count and word lengths allow.
  function makeTextPage(items, opts) {
    var W = A4_SHORT;
    var H = A4_LONG;
    var grid = GRIDS[pieceCount];
    var R = grid[0];
    var C = grid[1];
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    var withPinyin = opts.showPinyin && !!dict;
    var boxed = opts.textStyle === 'grid';
    var half = H / R / 2;           // lattice step: half a band
    var GAP = 0.7;                  // space between words, in character widths
    var lens = items.map(function (w) { return Array.from(w).length; });

    function dealRows(t) {
      var rows = [];
      var start = 0;
      for (var i = 0; i < t; i++) {
        var take = Math.ceil((items.length - start) / (t - i));
        rows.push({ start: start, end: start + take });
        start += take;
      }
      return rows;
    }

    var best = null;
    for (var t = 1; t <= Math.min(items.length, 2 * R - 1); t++) {
      for (var step = 2 * R; step >= 1; step--) {
        if (t % 2 === 0 && step % 2 === 1) continue; // keep rows on the lattice
        var first = R - (t - 1) * step / 2;
        if (first < 1 || first + (t - 1) * step > 2 * R - 1) continue;
        var rows = dealRows(t);
        var units = Math.max.apply(null, rows.map(function (r) {
          var n = 0;
          for (var i = r.start; i < r.end; i++) n += lens[i];
          return n + (r.end - r.start - 1) * GAP;
        }));
        var room = t === 1 ? H : step * half;
        room = Math.min(room, 2 * first * half);
        var size = Math.min(
          (W * 0.86) / (units * (boxed ? 1.12 : 1)),
          room * (withPinyin ? 0.46 : 0.6) / (boxed ? 1.12 : 1),
          560
        );
        // Share of words a cut actually passes through: every word on a
        // horizontal cut, otherwise only words that straddle a vertical cut.
        var cutWords = 0;
        for (var r = 0; r < t; r++) {
          var row = rows[r];
          if ((first + r * step) % 2 === 0) { cutWords += row.end - row.start; continue; }
          var unit = size * (boxed ? 1.12 : 1);
          var rowW = 0;
          for (var q = row.start; q < row.end; q++) rowW += lens[q] * unit;
          rowW += (row.end - row.start - 1) * GAP * unit;
          var x0 = (W - rowW) / 2;
          for (var q2 = row.start; q2 < row.end; q2++) {
            var x1 = x0 + lens[q2] * unit;
            for (var line = 1; line < C; line++) {
              var lx = line * W / C;
              if (lx > x0 + unit * 0.2 && lx < x1 - unit * 0.2) { cutWords++; break; }
            }
            x0 = x1 + GAP * unit;
          }
        }
        var score = size * (0.65 + 0.35 * cutWords / items.length);
        if (!best || score > best.score) {
          best = { score: score, size: size, rows: rows, ys: rows.map(function (_, i) { return (first + i * step) * half; }) };
        }
        break; // the widest step that fits is best for this t
      }
    }

    var size = best.size;
    var gap = size * GAP * (boxed ? 1.12 : 1);
    best.rows.forEach(function (row, ri) {
      var words = items.slice(row.start, row.end);
      ctx.font = '700 ' + size + 'px ' + opts.font;
      var widths = words.map(function (w) {
        var tw = ctx.measureText(w).width;
        return boxed ? Math.max(tw + size * 0.2, Array.from(w).length * size * 1.12) : tw;
      });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (words.length - 1);
      var x = (W - total) / 2;
      words.forEach(function (word, i) {
        drawWord(ctx, word, x + widths[i] / 2, best.ys[ri], size, W, opts, withPinyin);
        x += widths[i] + gap;
      });
    });
    return canvas;
  }

  function drawWord(ctx, item, cx, cy, size, maxW, opts, withPinyin) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + size + 'px ' + opts.font;
    var tw = ctx.measureText(item).width;
    if (tw > maxW * 0.92) { size *= maxW * 0.92 / tw; ctx.font = '700 ' + size + 'px ' + opts.font; tw = ctx.measureText(item).width; }

    if (opts.textStyle === 'grid') {
      // A box per word, with 田字格-style guides behind each character.
      var n = Array.from(item).length;
      var cell = size * 1.12;
      var bw = Math.max(tw + size * 0.2, n * cell);
      var bh = cell;
      ctx.save();
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#bfdbfe';
      var startX = cx - (n * cell) / 2;
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var gx = startX + k * cell;
        if (k > 0) { ctx.moveTo(gx, cy - bh / 2); ctx.lineTo(gx, cy + bh / 2); }
        ctx.moveTo(gx + cell / 2, cy - bh / 2); ctx.lineTo(gx + cell / 2, cy + bh / 2);
      }
      ctx.moveTo(cx - bw / 2, cy); ctx.lineTo(cx + bw / 2, cy);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#111827';
    ctx.font = '700 ' + size + 'px ' + opts.font;
    ctx.fillText(item, cx, cy + size * 0.04);

    if (withPinyin) {
      var py = pinyinFor(item);
      if (py) {
        var ps = size * 0.3;
        ctx.font = '600 ' + ps + 'px ' + LATIN;
        var pw = ctx.measureText(py).width;
        if (pw > maxW * 0.92) { ps *= maxW * 0.92 / pw; ctx.font = '600 ' + ps + 'px ' + LATIN; }
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText(py, cx, cy - size * 0.62 - ps * 0.55);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ---- Generation -------------------------------------------------------------------

  function readOptions() {
    return {
      title: el.title.value.trim(),
      font: FONTS[el.font.value] || FONTS.kai,
      textStyle: el.textStyle.value,
      showPinyin: el.showPinyin.checked,
      scrambled: el.outScrambled.checked,
      board: el.outBoard.checked,
      cut: el.outCut.checked,
      dashed: el.dashed.checked,
      size: parseFloat(el.size.value) || 1,
      straight: el.straight.checked
    };
  }

  function collectSources(opts) {
    if (activeTab === 'type') {
      var items = parseItems(el.words.value);
      if (!items.length) return Promise.reject(new Error('Type at least one word first · 请先输入词汇。'));
      var ready = opts.showPinyin
        ? loadDictionary().catch(function () { opts.showPinyin = false; })
        : Promise.resolve();
      return ready.then(function () {
        return document.fonts && document.fonts.ready;
      }).then(function () {
        return [makeTextPage(items, opts)];
      });
    }
    if (!source) return Promise.reject(new Error('Upload a PDF first — or switch to “Type words” · 请先上传 PDF。'));
    var chosen = source.pages.filter(function (p) { return p.on; });
    if (!chosen.length) return Promise.reject(new Error('Select at least one page · 请至少选择一页。'));
    return Promise.all(chosen.map(function (p) {
      if (p.full) return p.full;
      return renderPdfPage(source.pdf, p.num, A4_LONG).then(function (canvas) { p.full = canvas; return canvas; });
    }));
  }

  function generate() {
    var opts = readOptions();
    if (!opts.scrambled && !opts.board && !opts.cut) {
      el.status.textContent = 'Tick at least one page type to print · 请至少勾选一种打印页面。';
      return;
    }
    el.generate.disabled = true;
    el.status.textContent = 'Cutting your puzzle… · 正在生成';

    collectSources(opts).then(function (canvases) {
      var rng = mulberry32(seed);
      output = [];
      canvases.forEach(function (src, index) {
        var p = makePuzzle(src, index, canvases.length, opts, rng);
        var tag = canvases.length > 1 ? ' ' + (index + 1) : '';
        var base = 'puzzle-' + (index + 1);
        if (opts.scrambled) {
          drawScrambledPages(p, opts, rng).forEach(function (canvas, i, all) {
            output.push({ canvas: canvas, label: 'Puzzle' + tag + ' · 拼图块 Pieces' + (all.length > 1 ? ' ' + (i + 1) + '/' + all.length : ''), file: base + '-pieces' + (all.length > 1 ? '-' + (i + 1) : '') + '.png' });
          });
        }
        if (opts.board) output.push({ canvas: drawSheet(p, 'board', opts), label: 'Puzzle' + tag + ' · 拼图底板 Board', file: base + '-board.png' });
        if (opts.cut) output.push({ canvas: drawSheet(p, 'cut', opts), label: 'Puzzle' + tag + ' · ' + (opts.scrambled ? '答案 Answer key' : '剪裁页 Cut sheet'), file: base + (opts.scrambled ? '-answer' : '-cut') + '.png' });
      });
      renderPreview();
      el.status.textContent = 'Made ' + canvases.length + (canvases.length === 1 ? ' puzzle' : ' puzzles') + ' of ' + pieceCount +
        ' pieces · ' + output.length + ' pages. Print on A4 at 100% (actual size) so pieces match the board.';
    }).catch(function (err) {
      el.status.textContent = err && err.message ? err.message : String(err);
    }).then(function () {
      el.generate.disabled = false;
    });
  }

  // Fit the source page on an A4 sheet and cut it into a rows × cols jigsaw.
  function makePuzzle(src, index, total, opts, rng) {
    var landscape = src.width > src.height;
    var pageW = landscape ? A4_LONG : A4_SHORT;
    var pageH = landscape ? A4_SHORT : A4_LONG;
    var grid = GRIDS[pieceCount];
    var rows = landscape ? grid[1] : grid[0];
    var cols = landscape ? grid[0] : grid[1];

    var usable = { x: MARGIN, y: MARGIN + HEADER_H, w: pageW - MARGIN * 2, h: pageH - MARGIN * 2 - HEADER_H };
    var aspect = src.width / src.height;
    var bw = Math.min(usable.w, usable.h * aspect) * opts.size;
    var bh = bw / aspect;

    // Shrink if a single piece (with its knobs) would not fit on a pieces sheet
    // (only matters when that sheet is printed).
    var reach = opts.straight ? 0 : KNOB_REACH;
    var m = Math.min(bw / cols, bh / rows);
    var fit = !opts.scrambled ? 1 : Math.min(1, usable.w / (bw / cols + 2 * reach * m + 4), usable.h / (bh / rows + 2 * reach * m + 4));
    bw *= fit;
    bh *= fit;

    var cw = bw / cols;
    var ch = bh / rows;
    m = Math.min(cw, ch);

    function edgeGrid() {
      var out = [];
      for (var r = 0; r <= rows; r++) {
        var row = [];
        for (var c = 0; c <= cols; c++) {
          row.push({ sign: rng() < 0.5 ? -1 : 1, shift: (rng() - 0.5) * 0.12, skew: (rng() - 0.5) * 0.06, flat: opts.straight });
        }
        out.push(row);
      }
      return out;
    }

    return {
      src: src, index: index, total: total, landscape: landscape,
      pageW: pageW, pageH: pageH, usable: usable,
      box: { x: usable.x + (usable.w - bw) / 2, y: usable.y, w: bw, h: bh },
      rows: rows, cols: cols, cw: cw, ch: ch, m: m, reach: reach * m,
      hEdges: edgeGrid(), // hEdges[r][c]: top edge of row r
      vEdges: edgeGrid()  // vEdges[r][c]: left edge of column c
    };
  }

  // ---- Drawing ------------------------------------------------------------------------

  function newSheet(p, kind, opts, extra) {
    var canvas = document.createElement('canvas');
    canvas.width = p.pageW;
    canvas.height = p.pageH;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, p.pageW, p.pageH);

    var title = opts.title || '拼图 · Puzzle';
    if (p.total > 1) title += '  (' + (p.index + 1) + '/' + p.total + ')';
    if (extra) title += '  ' + extra;
    var sub = {
      pieces: '剪下拼图块，把被切开的字拼回来 · Cut out the pieces and rebuild the page.',
      board: '拼图底板：把拼图块放在对应的位置 · Put each piece on its outline.',
      cut: opts.scrambled ? '答案 · Answer key' : '沿线剪开，打乱后再拼起来 · Cut along the lines, mix, then rebuild.'
    }[kind];
    var nameW = 560;
    fitText(ctx, title, MARGIN, MARGIN + 48, p.pageW - MARGIN * 2 - nameW, 54, '800', LATIN + ', ' + FONTS.sans, '#1e3a8a');
    fitText(ctx, sub, MARGIN, MARGIN + 96, p.pageW - MARGIN * 2 - nameW, 28, '500', LATIN + ', ' + FONTS.sans, '#4b5563');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#374151';
    ctx.font = '700 30px ' + LATIN + ', ' + FONTS.sans;
    ctx.fillText(kind === 'cut' && opts.scrambled ? 'Teacher copy · 教师用' : '姓名 Name: _______________', p.pageW - MARGIN, MARGIN + 48);
    ctx.textAlign = 'left';
    return { canvas: canvas, ctx: ctx };
  }

  // Whole page: the picture with cut lines (cut / answer), or outlines only (board).
  function drawSheet(p, kind, opts) {
    var sheet = newSheet(p, kind, opts);
    var ctx = sheet.ctx;
    var b = p.box;
    if (kind === 'cut') ctx.drawImage(p.src, b.x, b.y, b.w, b.h);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = kind === 'board' ? '#9ca3af' : '#1e3a8a';
    ctx.lineWidth = kind === 'board' ? 4 : 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (opts.dashed && kind === 'cut') ctx.setLineDash([22, 14]);
    ctx.beginPath();
    var r, c;
    for (r = 1; r < p.rows; r++) {
      for (c = 0; c < p.cols; c++) {
        ctx.moveTo(c * p.cw, r * p.ch);
        tabEdge(ctx, c * p.cw, r * p.ch, (c + 1) * p.cw, r * p.ch, p.hEdges[r][c], p.m);
      }
    }
    for (c = 1; c < p.cols; c++) {
      for (r = 0; r < p.rows; r++) {
        ctx.moveTo(c * p.cw, r * p.ch);
        tabEdge(ctx, c * p.cw, r * p.ch, c * p.cw, (r + 1) * p.ch, p.vEdges[r][c], p.m);
      }
    }
    ctx.rect(0, 0, p.box.w, p.box.h);
    ctx.stroke();
    ctx.restore();
    return sheet.canvas;
  }

  // Every piece cut out and laid out in random order, spread over as many sheets as needed.
  // Pieces are shelf-packed by their real outline: a side only needs room for a
  // knob when that knob points outward.
  function drawScrambledPages(p, opts, rng) {
    var u = p.usable;
    var line = 6;
    var pieces = [];
    for (var r = 0; r < p.rows; r++) {
      for (var c = 0; c < p.cols; c++) {
        var top = r > 0 && p.hEdges[r][c].sign === -1 && !opts.straight ? p.reach : 0;
        var bottom = r < p.rows - 1 && p.hEdges[r + 1][c].sign === 1 && !opts.straight ? p.reach : 0;
        var left = c > 0 && p.vEdges[r][c].sign === 1 && !opts.straight ? p.reach : 0;
        var right = c < p.cols - 1 && p.vEdges[r][c + 1].sign === -1 && !opts.straight ? p.reach : 0;
        pieces.push({
          r: r, c: c, padL: left + line, padT: top + line,
          w: p.cw + left + right + line * 2, h: p.ch + top + bottom + line * 2
        });
      }
    }
    shuffle(pieces, rng);
    // Never leave the pieces in their solved order.
    if (pieces.length > 1 && pieces.every(function (pc, i) { return pc.r * p.cols + pc.c === i; })) pieces.push(pieces.shift());

    // Shelf packing into sheets.
    var sheetsLayout = [];
    var current = null;
    var x = 0, y = 0, shelfH = 0;
    pieces.forEach(function (pc) {
      if (!current) { current = { rows: [[]] }; sheetsLayout.push(current); x = 0; y = 0; shelfH = 0; }
      if (x > 0 && x + pc.w > u.w) { x = 0; y += shelfH + SLOT_GAP; shelfH = 0; current.rows.push([]); }
      if (y > 0 && y + pc.h > u.h) {
        if (!current.rows[current.rows.length - 1].length) current.rows.pop();
        current = { rows: [[]] }; sheetsLayout.push(current); x = 0; y = 0; shelfH = 0;
      }
      pc.x = x; pc.y = y;
      current.rows[current.rows.length - 1].push(pc);
      x += pc.w + SLOT_GAP;
      shelfH = Math.max(shelfH, pc.h);
      current.height = y + shelfH;
    });

    return sheetsLayout.map(function (layout, s) {
      var sheet = newSheet(p, 'pieces', opts, sheetsLayout.length > 1 ? '[' + (s + 1) + '/' + sheetsLayout.length + ']' : '');
      // Spread shelves evenly down the sheet and centre each shelf.
      var spare = Math.max(0, u.h - layout.height);
      var extraGap = layout.rows.length > 1 ? Math.min(spare / (layout.rows.length - 1), 120) : 0;
      layout.rows.forEach(function (row, ri) {
        if (!row.length) return;
        var rowW = row[row.length - 1].x + row[row.length - 1].w;
        var offsetX = u.x + (u.w - rowW) / 2;
        row.forEach(function (pc) {
          drawPiece(sheet.ctx, p, pc.r, pc.c, offsetX + pc.x + pc.padL, u.y + pc.y + ri * extraGap + pc.padT, opts);
        });
      });
      return sheet.canvas;
    });
  }

  // Draw piece (r, c) so its cell's top-left corner sits at (x, y).
  function drawPiece(ctx, p, r, c, x, y, opts) {
    ctx.save();
    ctx.translate(x - c * p.cw, y - r * p.ch);
    ctx.beginPath();
    piecePath(ctx, p, r, c);
    ctx.save();
    ctx.clip();
    ctx.drawImage(p.src, 0, 0, p.box.w, p.box.h);
    ctx.restore();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    if (opts.dashed) ctx.setLineDash([22, 14]);
    ctx.stroke();
    ctx.restore();
  }

  // Closed outline of one piece, clockwise, in puzzle coordinates.
  function piecePath(ctx, p, r, c) {
    var x0 = c * p.cw, x1 = (c + 1) * p.cw;
    var y0 = r * p.ch, y1 = (r + 1) * p.ch;
    ctx.moveTo(x0, y0);
    if (r === 0) ctx.lineTo(x1, y0); else tabEdge(ctx, x0, y0, x1, y0, p.hEdges[r][c], p.m);
    if (c === p.cols - 1) ctx.lineTo(x1, y1); else tabEdge(ctx, x1, y0, x1, y1, p.vEdges[r][c + 1], p.m);
    if (r === p.rows - 1) ctx.lineTo(x0, y1); else tabEdge(ctx, x1, y1, x0, y1, reverse(p.hEdges[r + 1][c]), p.m);
    if (c === 0) ctx.lineTo(x0, y0); else tabEdge(ctx, x0, y1, x0, y0, reverse(p.vEdges[r][c]), p.m);
    ctx.closePath();
  }

  // The same physical edge traced from the other end.
  function reverse(edge) {
    return { sign: -edge.sign, shift: -edge.shift, skew: -edge.skew, flat: edge.flat };
  }

  // One jigsaw edge from (x0,y0) to (x1,y1), continuing the current path.
  // Classic bezier knob (after Draradech's jigsaw generator), sized to m.
  function tabEdge(ctx, x0, y0, x1, y1, edge, m) {
    if (edge.flat) { ctx.lineTo(x1, y1); return; }
    var len = Math.hypot(x1 - x0, y1 - y0);
    var ux = (x1 - x0) / len;
    var uy = (y1 - y0) / len;
    var nx = -uy * edge.sign;
    var ny = ux * edge.sign;
    var k = m * KNOB;
    var center = len / 2 + edge.shift * k;
    var d = edge.skew;
    function pt(X, Y) {
      var a = center + X * k;
      return [x0 + ux * a + nx * Y * k, y0 + uy * a + ny * Y * k];
    }
    var p1 = pt(-0.3, 0), p2 = pt(d, -0.1), p3 = pt(-0.1, 0.1);
    var p4 = pt(-0.2 - d, 0.3), p5 = pt(0.2 - d, 0.3), p6 = pt(0.1, 0.1);
    var p7 = pt(d, -0.1), p8 = pt(0.3, 0);
    ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    ctx.bezierCurveTo(p4[0], p4[1], p5[0], p5[1], p6[0], p6[1]);
    ctx.bezierCurveTo(p7[0], p7[1], p8[0], p8[1], x1, y1);
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

  // ---- Preview + export -------------------------------------------------------------

  function renderPreview() {
    el.pages.innerHTML = '';
    output.forEach(function (page) {
      var fig = document.createElement('figure');
      fig.className = 'vp-page-card';
      var img = document.createElement('img');
      page.dataUrl = page.canvas.toDataURL('image/png');
      img.src = page.dataUrl;
      img.alt = page.label;
      var cap = document.createElement('figcaption');
      var label = document.createElement('span');
      label.textContent = page.label;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vp-btn vp-btn-outline';
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
    [el.reshape, el.png, el.pdf, el.print].forEach(function (b) { b.disabled = !output.length; });
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

  // Minimal PDF 1.4 writer: one full-page JPEG per A4 page (portrait or landscape).
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
      var landscape = img.w > img.h;
      var PW = landscape ? 841.89 : 595.28;
      var PH = landscape ? 595.28 : 841.89;
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
    // One @page size for the job: landscape only if the first sheet is landscape.
    var landscape = output[0] && output[0].canvas.width > output[0].canvas.height;
    var style = document.createElement('style');
    style.textContent = '@media print { @page { size: A4 ' + (landscape ? 'landscape' : 'portrait') + '; margin: 0; } }';
    el.printArea.appendChild(style);
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
    return t ? 'vocab-puzzle-' + t : 'vocab-puzzle';
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

  function setNote(node, text, kind) {
    node.textContent = text;
    node.classList.toggle('is-error', kind === 'error');
    node.classList.toggle('is-ok', kind === 'ok');
  }

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
