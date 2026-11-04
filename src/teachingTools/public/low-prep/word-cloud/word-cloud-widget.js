(function () {
  'use strict';

  var DISPLAY_MODES = [
    { id: 'zh', label: 'Original Terms' },
    { id: 'en', label: 'English Translation' },
    { id: 'py', label: 'Pinyin' }
  ];

  var COLOR_SCHEMES = {
    colorful: { label: 'Colorful', swatch: '#5271ff', colors: ['#e14b4b', '#f2994a', '#f2c94c', '#27ae60', '#2f80ed', '#9b51e0', '#eb5757', '#00b8a9', '#ff6f91', '#845ef7', '#3f66e8'] },
    mono: { label: 'Black', swatch: '#1a1a1a', colors: ['#1a1a1a'] }
  };

  var FONTS = [
    { id: 'default', label: 'Default', family: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif' },
    { id: 'hei', label: 'Heiti (Bold Sans)', family: '"SimHei", "Heiti SC", sans-serif' },
    { id: 'kai', label: 'Kaiti (Calligraphy)', family: '"KaiTi", "STKaiti", "Kaiti SC", serif' },
    { id: 'song', label: 'Songti (Serif)', family: '"SimSun", "Songti SC", serif' },
    { id: 'yuan', label: 'Yuanti (Rounded)', family: '"YouYuan", "PingFang SC", sans-serif' }
  ];

  var BACKGROUNDS = ['#ffffff', '#fdf6e3', '#fde2e4', '#e3f0ff', '#e6f6e9', '#efe6ff'];

  // Each shape draws itself into a 1x1 unit box; layout stretches it into
  // the page area. `aspect` is height/width, `center` is where the spiral
  // starts (the visual middle, which isn't the box middle for a heart).
  var SHAPES = {
    rect: { label: 'Rectangle', icon: '▭', aspect: 0, center: [0.5, 0.5], draw: function (p) { p.rect(0, 0, 1, 1); } },
    circle: { label: 'Circle', icon: '●', aspect: 1, center: [0.5, 0.5], draw: function (p) { p.ellipse(0.5, 0.5, 0.5, 0.5, 0, 0, Math.PI * 2); } },
    heart: {
      label: 'Heart', icon: '♥', aspect: 0.92, center: [0.5, 0.45],
      draw: function (p) {
        p.moveTo(0.5, 0.2);
        p.bezierCurveTo(0.42, 0.04, 0.26, 0, 0.15, 0.04);
        p.bezierCurveTo(-0.02, 0.1, -0.04, 0.36, 0.06, 0.52);
        p.bezierCurveTo(0.16, 0.7, 0.36, 0.84, 0.5, 1);
        p.bezierCurveTo(0.64, 0.84, 0.84, 0.7, 0.94, 0.52);
        p.bezierCurveTo(1.04, 0.36, 1.02, 0.1, 0.85, 0.04);
        p.bezierCurveTo(0.74, 0, 0.58, 0.04, 0.5, 0.2);
        p.closePath();
      }
    },
    cloud: {
      label: 'Cloud', icon: '☁', aspect: 0.68, center: [0.5, 0.58],
      // Overlapping puffs; all wound the same way so they fill as one shape.
      draw: function (p) {
        [[0.2, 0.66, 0.2], [0.38, 0.42, 0.26], [0.63, 0.36, 0.3], [0.83, 0.62, 0.17], [0.5, 0.74, 0.26], [0.72, 0.76, 0.22], [0.3, 0.78, 0.2]].forEach(function (c) {
          p.moveTo(c[0] + c[2], c[1]);
          p.arc(c[0], c[1], c[2], 0, Math.PI * 2);
        });
      }
    },
    star: {
      label: 'Star', icon: '★', aspect: 0.95, center: [0.5, 0.56],
      draw: function (p) {
        for (var i = 0; i < 10; i++) {
          var r = i % 2 ? 0.25 : 0.5;
          var a = -Math.PI / 2 + i * Math.PI / 5;
          var x = 0.5 + r * Math.cos(a), y = 0.53 + r * Math.sin(a) * 1.05;
          if (i) p.lineTo(x, y); else p.moveTo(x, y);
        }
        p.closePath();
      }
    }
  };

  var SOURCE_LANGUAGES = [
    { code: 'zh-CN', label: 'Chinese' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'fr', label: 'French' },
    { code: 'es', label: 'Spanish' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'ru', label: 'Russian' },
    { code: 'pt', label: 'Portuguese' }
  ];

  // A4 portrait ratio (210mm x 297mm) so the on-screen preview matches the printed page.
  var CANVAS_W = 600;
  var CANVAS_H = Math.round(CANVAS_W * (297 / 210));

  var DEFAULT_WORDS = [
    'hypothesis', 'evidence', 'variable', 'observe', 'measure', 'compare', 'pattern', 'result', 'explain', 'revise'
  ];

  var state = {
    displayModes: { zh: true, en: false, py: false },
    scheme: 'colorful',
    font: 'default',
    background: '#ffffff',
    shape: 'rect',
    sourceLang: 'en',
    mergeDuplicates: true
  };

  var els = {};
  var toastTimer = null;
  var lastPlacements = [];
  var measureCtx = document.createElement('canvas').getContext('2d');
  var pinyinCache = {};
  var translationCache = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.wordInput = document.getElementById('wordInput');
    els.wordCount = document.getElementById('wordCount');
    els.clearWords = document.getElementById('clearWords');
    els.displayModeRow = document.getElementById('displayModeRow');
    els.schemeRow = document.getElementById('schemeRow');
    els.fontSelect = document.getElementById('fontSelect');
    els.bgRow = document.getElementById('bgRow');
    els.shapeRow = document.getElementById('shapeRow');
    els.canvas = document.getElementById('cloudCanvas');
    els.printImage = document.getElementById('cloudPrintImage');
    els.paperTitle = document.getElementById('paperTitle');
    els.shuffleButton = document.getElementById('shuffleButton');
    els.printButton = document.getElementById('printButton');
    els.puzzleButton = document.getElementById('puzzleButton');
    els.readyPill = document.getElementById('readyPill');
    els.toast = document.getElementById('toast');
    els.sourceLangSelect = document.getElementById('sourceLangSelect');
    els.libraryPicker = document.getElementById('wordCloudLibraryPicker');
    els.mergeDuplicates = document.getElementById('mergeDuplicates');

    buildDisplayModeRow();
    buildSchemeRow();
    buildFontSelect();
    buildBgRow();
    buildShapeRow();
    buildSourceLangSelect();
    els.wordInput.value = DEFAULT_WORDS.join('\n');
    els.wordInput.addEventListener('input', function () {
      updateWordCount();
      scheduleRegenerate();
    });

    els.clearWords.addEventListener('click', function () {
      els.wordInput.value = '';
      updateWordCount();
      regenerate();
      els.wordInput.focus();
    });

    els.mergeDuplicates.checked = state.mergeDuplicates;
    els.mergeDuplicates.addEventListener('change', function () {
      state.mergeDuplicates = els.mergeDuplicates.checked;
      regenerate();
    });

    els.shuffleButton.addEventListener('click', regenerate);
    els.printButton.addEventListener('click', printWorksheet);
    els.puzzleButton.addEventListener('click', function () {
      try {
        var png = els.canvas.toDataURL('image/png').split(',')[1];
        sessionStorage.setItem('word-cloud-puzzle', png);
      } catch (err) {
        showToast('Could not send the word cloud to the puzzle maker.');
        return;
      }
      window.location.assign('/teaching-tools/vocab-puzzle?from=word-cloud');
    });
    initLibraryPicker();

    updateWordCount();
    regenerate();
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker || !els.libraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: els.libraryPicker,
      source: 'wordlists',
      min: 1,
      collapsible: true,
      title: 'Add words from the library',
      hint: 'Choose one or more vocabulary topics to add their terms to your word cloud.',
      importLabel: 'Add words from selected topics',
      onImport: function (lists) {
        var existing = els.wordInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        var seen = {};
        existing.forEach(function (line) { seen[line] = true; });
        var added = 0;
        lists.forEach(function (list) {
          (list.items || []).forEach(function (item) {
            var word = String(item.zh || '').trim();
            if (!word || seen[word]) return;
            seen[word] = true;
            existing.push(word);
            added += 1;
          });
        });
        els.wordInput.value = existing.join('\n');
        updateWordCount();
        regenerate();
        if (added) showToast('Added ' + added + ' word' + (added === 1 ? '' : 's') + ' from the library.');
        picker.reset();
      }
    });
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  var scheduleRegenerate = debounce(regenerateWithTranslations, 500);

  function buildDisplayModeRow() {
    els.displayModeRow.innerHTML = '';
    DISPLAY_MODES.forEach(function (mode) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scheme-btn' + (state.displayModes[mode.id] ? ' active' : '');
      btn.dataset.mode = mode.id;
      btn.textContent = mode.label;
      btn.addEventListener('click', function () {
        var willBeOn = !state.displayModes[mode.id];
        var activeCount = DISPLAY_MODES.filter(function (m) { return state.displayModes[m.id]; }).length;
        if (!willBeOn && activeCount <= 1) {
          showToast('Please keep at least one display option selected');
          return;
        }
        state.displayModes[mode.id] = willBeOn;
        btn.classList.toggle('active', willBeOn);
        if (mode.id === 'en' && willBeOn) {
          translateCurrentEntries(true).then(regenerate);
        } else {
          regenerate();
        }
      });
      els.displayModeRow.appendChild(btn);
    });
  }

  function buildSchemeRow() {
    els.schemeRow.innerHTML = '';
    Object.keys(COLOR_SCHEMES).forEach(function (key) {
      var scheme = COLOR_SCHEMES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scheme-btn' + (key === state.scheme ? ' active' : '');
      btn.dataset.scheme = key;
      btn.innerHTML = '<span class="scheme-swatch" style="background:' + scheme.swatch + '"></span><span>' + scheme.label + '</span>';
      btn.addEventListener('click', function () {
        state.scheme = key;
        Array.prototype.forEach.call(els.schemeRow.children, function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        regenerate();
      });
      els.schemeRow.appendChild(btn);
    });
  }

  function buildFontSelect() {
    els.fontSelect.innerHTML = '';
    FONTS.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.label;
      els.fontSelect.appendChild(opt);
    });
    els.fontSelect.value = state.font;
    els.fontSelect.addEventListener('change', function () {
      state.font = els.fontSelect.value;
      regenerate();
    });
  }

  function buildBgRow() {
    els.bgRow.innerHTML = '';
    BACKGROUNDS.forEach(function (color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-swatch' + (color === state.background ? ' active' : '');
      btn.style.background = color;
      btn.setAttribute('aria-label', 'Background color ' + color);
      btn.addEventListener('click', function () {
        state.background = color;
        Array.prototype.forEach.call(els.bgRow.children, function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        render(lastPlacements);
      });
      els.bgRow.appendChild(btn);
    });
  }

  function buildShapeRow() {
    els.shapeRow.innerHTML = '';
    Object.keys(SHAPES).forEach(function (key) {
      var shape = SHAPES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scheme-btn' + (key === state.shape ? ' active' : '');
      btn.innerHTML = '<span class="shape-icon" aria-hidden="true">' + shape.icon + '</span><span>' + shape.label + '</span>';
      btn.addEventListener('click', function () {
        state.shape = key;
        Array.prototype.forEach.call(els.shapeRow.children, function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        regenerate();
      });
      els.shapeRow.appendChild(btn);
    });
  }

  function buildSourceLangSelect() {
    els.sourceLangSelect.innerHTML = '';
    SOURCE_LANGUAGES.forEach(function (language) {
      var option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.label;
      els.sourceLangSelect.appendChild(option);
    });
    els.sourceLangSelect.value = state.sourceLang;
    els.sourceLangSelect.addEventListener('change', function () {
      state.sourceLang = els.sourceLangSelect.value;
      if (state.displayModes.en) translateCurrentEntries(true).then(regenerate);
    });
  }

  function translationKey(word) {
    return state.sourceLang + '|' + word;
  }

  function translateOne(word) {
    if (state.sourceLang === 'en') return Promise.resolve(word);
    var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) +
      '&langpair=' + encodeURIComponent(state.sourceLang) + '|en';
    return fetch(url)
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var translation = data && data.responseData && data.responseData.translatedText;
        if (!translation || /INVALID|MYMEMORY WARNING/i.test(translation)) return '';
        return translation;
      })
      .catch(function () { return ''; });
  }

  function translateCurrentEntries(announce) {
    var entries = parseEntries();
    var queued = {};
    var pending = entries.filter(function (entry) {
      var key = translationKey(entry.zh);
      if (queued[key] || Object.prototype.hasOwnProperty.call(translationCache, key)) return false;
      queued[key] = true;
      return true;
    });
    if (!pending.length) return Promise.resolve();

    if (announce) {
      els.readyPill.textContent = 'Translating…';
      showToast('Translating words to English…');
    }

    var succeeded = 0;
    var failed = 0;
    return pending.reduce(function (chain, entry) {
      return chain.then(function () {
        return translateOne(entry.zh).then(function (translation) {
          if (translation) {
            translationCache[translationKey(entry.zh)] = translation;
            succeeded++;
          } else {
            failed++;
          }
        });
      });
    }, Promise.resolve()).then(function () {
      if (announce && failed) {
        showToast('Translated ' + succeeded + '; ' + failed + ' could not be translated. Try again later.');
      }
    });
  }

  function regenerateWithTranslations() {
    if (state.displayModes.en) {
      translateCurrentEntries(false).then(regenerate);
    } else {
      regenerate();
    }
  }

  function getPinyin(zh) {
    if (pinyinCache[zh] !== undefined) return pinyinCache[zh];
    var py = '';
    try {
      if (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function') {
        py = window.pinyinPro.pinyin(zh) || '';
      }
    } catch (e) {
      py = '';
    }
    pinyinCache[zh] = py;
    return py;
  }

  // A word can expand into target language, English, and pinyin chips that
  // are scattered separately across the cloud, rather than being glued together.
  function expandEntries(entries) {
    var n = entries.length;
    var chips = [];
    entries.forEach(function (entry, i) {
      var rank = n <= 1 ? 0 : i / (n - 1);
      var before = chips.length;
      if (state.displayModes.zh) chips.push({ text: entry.zh, rank: rank });
      if (state.displayModes.py) {
        var py = getPinyin(entry.zh);
        if (py) chips.push({ text: py, rank: rank });
      }
      if (state.displayModes.en && entry.en) chips.push({ text: entry.en, rank: rank });
      if (chips.length === before) chips.push({ text: entry.zh, rank: rank });
    });
    return chips;
  }

  function parseEntries() {
    var seen = {};
    var entries = [];
    els.wordInput.value.split(/\r?\n/).forEach(function (word) {
      var cleanWord = word.trim();
      if (!cleanWord || (state.mergeDuplicates && seen[cleanWord])) return;
      seen[cleanWord] = true;
      entries.push({
        zh: cleanWord,
        en: translationCache[translationKey(cleanWord)] || ''
      });
    });
    return entries;
  }

  function updateWordCount() {
    var entries = parseEntries();
    els.wordCount.textContent = entries.length + ' word' + (entries.length === 1 ? '' : 's') + ' entered';
    els.wordCount.classList.toggle('warning', entries.length > 0 && entries.length < 3);
    return entries;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2600);
  }

  // ---------- Layout ----------

  function rectOverlapsAny(rect, rects, pad) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!(rect.right + pad < r.left || rect.left - pad > r.right ||
            rect.bottom + pad < r.top || rect.top - pad > r.bottom)) {
        return true;
      }
    }
    return false;
  }

  // Fits the chosen shape into the page area, keeping its proportions
  // (rectangle fills the whole area). `pad` grows it, for the drawn outline.
  function shapeBox(shape, W, H, pad) {
    var marginX = W * 0.05, marginY = H * 0.05;
    var w = W - marginX * 2, h = H - marginY * 2;
    if (shape.aspect) {
      // Let shapes stretch up to 15% taller so they use more of the page.
      h = Math.min(h, w * shape.aspect * 1.15);
      w = Math.min(w, h / shape.aspect);
    }
    var x = (W - w) / 2, y = (H - h) / 2;
    return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
  }

  function shapePath(shape, box) {
    var unit = new Path2D();
    shape.draw(unit);
    var path = new Path2D();
    path.addPath(unit, new DOMMatrix([box.w, 0, 0, box.h, box.x, box.y]));
    return path;
  }

  // A word fits when points all around its box sit inside the shape.
  function rectInShape(rect, path) {
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var fx = rect.left + (rect.right - rect.left) * i / steps;
      var fy = rect.top + (rect.bottom - rect.top) * i / steps;
      if (!measureCtx.isPointInPath(path, fx, rect.top) || !measureCtx.isPointInPath(path, fx, rect.bottom) ||
          !measureCtx.isPointInPath(path, rect.left, fy) || !measureCtx.isPointInPath(path, rect.right, fy)) {
        return false;
      }
    }
    return true;
  }

  function shapeArea(path, box) {
    var inside = 0, n = 40;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if (measureCtx.isPointInPath(path, box.x + box.w * (i + 0.5) / n, box.y + box.h * (j + 0.5) / n)) inside++;
      }
    }
    return box.w * box.h * inside / (n * n);
  }

  function measureWord(word, fontSize, fontFamily) {
    measureCtx.font = '700 ' + fontSize + 'px ' + fontFamily;
    var m = measureCtx.measureText(word);
    return {
      w: m.width + fontSize * 0.22,
      h: fontSize * 1.18
    };
  }

  function tryPlace(word, fontSize, fontFamily, path, cx, cy, maxRadius, placedRects, ignoreOverlap) {
    var size = measureWord(word, fontSize, fontFamily);
    var w = size.w, h = size.h;
    var angle = Math.random() * Math.PI * 2;
    var angleStep = 0.26;
    var radius = 0;
    var iter = 0;
    var maxIter = 2400;
    while (radius <= maxRadius && iter < maxIter) {
      var x = cx + radius * Math.cos(angle);
      var y = cy + radius * Math.sin(angle);
      var rect = { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
      if (rectInShape(rect, path) &&
          (ignoreOverlap || !rectOverlapsAny(rect, placedRects, 2))) {
        return { x: x, y: y, rect: rect };
      }
      angle += angleStep;
      radius += 0.55;
      iter++;
    }
    return null;
  }

  function layoutWordCloud(chips, fontFamily, W, H) {
    var shape = SHAPES[state.shape];
    var box = shapeBox(shape, W, H, 0);
    var path = shapePath(shape, box);
    var cx = box.x + box.w * shape.center[0], cy = box.y + box.h * shape.center[1];
    var maxRadius = Math.sqrt(box.w * box.w + box.h * box.h);
    var n = chips.length;
    var area = shapeArea(path, box);
    var density = Math.max(0.35, Math.min(1, 900 / (n + 6)));
    var maxFont = Math.max(22, Math.min(70, Math.sqrt((area * density) / (n * 3.2))));
    var minFont = Math.max(12, maxFont * 0.32);

    // Shuffle placement order so chips from the same word don't always get
    // laid down back-to-back, while font size still tracks each chip's rank.
    var order = chips.map(function (_, i) { return i; });
    for (var s = order.length - 1; s > 0; s--) {
      var j = Math.floor(Math.random() * (s + 1));
      var tmp = order[s]; order[s] = order[j]; order[j] = tmp;
    }

    var placements = [];
    var placedRects = [];
    var overflowCount = 0;

    order.forEach(function (chipIndex) {
      var chip = chips[chipIndex];
      var word = chip.text;
      var t = chip.rank;
      var baseFont = maxFont - (maxFont - minFont) * Math.pow(t, 0.85);
      var fontSize = Math.round(baseFont * (0.92 + Math.random() * 0.16));
      var placed = null;
      var attempts = 0;
      while (!placed && attempts < 6) {
        placed = tryPlace(word, fontSize, fontFamily, path, cx, cy, maxRadius, placedRects, false);
        if (!placed) {
          fontSize = Math.max(10, Math.round(fontSize * 0.84));
          attempts++;
        }
      }
      if (!placed) {
        placed = tryPlace(word, fontSize, fontFamily, path, cx, cy, maxRadius, placedRects, true);
        if (placed) overflowCount++;
      }
      if (!placed) {
        var size = measureWord(word, fontSize, fontFamily);
        placed = {
          x: cx, y: cy,
          rect: { left: cx - size.w / 2, right: cx + size.w / 2, top: cy - size.h / 2, bottom: cy + size.h / 2 }
        };
        overflowCount++;
      }
      placedRects.push(placed.rect);
      placements.push({ word: word, x: placed.x, y: placed.y, fontSize: fontSize, rank: t });
    });

    return { placements: placements, overflowCount: overflowCount };
  }

  function pickColor(scheme) {
    var colors = COLOR_SCHEMES[scheme].colors;
    var idx = Math.floor(Math.random() * colors.length);
    return colors[idx];
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render(placements) {
    var canvas = els.canvas;
    // The canvas's on-screen box size is left entirely to CSS
    // (#cloudCanvas { width:100%; height:100% } of .canvas-wrap), so it
    // always matches the current layout automatically -- on screen, on
    // resize, and when printing (the print stylesheet gives .canvas-wrap an
    // explicit A4-based mm size). Only the backing-store resolution (for
    // crispness) is set here, using a fixed DPI multiplier that has no
    // dependency on measuring layout at print time.
    var dpr = Math.max(window.devicePixelRatio || 1, 2);

    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    var shape = SHAPES[state.shape];
    var outline = shapeBox(shape, CANVAS_W, CANVAS_H, 10);
    ctx.strokeStyle = 'rgba(31, 42, 68, 0.14)';
    ctx.fillStyle = state.background;
    if (state.shape === 'rect') {
      roundRectPath(ctx, outline.x, outline.y, outline.w, outline.h, 18);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Stroke at double width, then fill over it: only the outer half of
      // the line survives, so overlapping cloud puffs show one outline.
      var path = shapePath(shape, outline);
      ctx.lineWidth = 3;
      ctx.stroke(path);
      ctx.fill(path);
    }

    if (placements && placements.length) {
      var fontFamily = fontFamilyFor(state.font);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      placements.forEach(function (p) {
        ctx.font = '700 ' + p.fontSize + 'px ' + fontFamily;
        ctx.fillStyle = p.color;
        ctx.fillText(p.word, p.x, p.y);
      });
    }

    // Browsers can omit a live canvas when generating a PDF. Keep a PNG copy
    // in sync so the print stylesheet can use a reliably printable image.
    els.printImage.src = canvas.toDataURL('image/png');
  }

  function printWorksheet() {
    render(lastPlacements);
    var printNow = function () { window.print(); };

    if (els.printImage.decode) {
      els.printImage.decode().catch(function () {}).then(printNow);
    } else {
      window.setTimeout(printNow, 80);
    }
  }

  function fontFamilyFor(fontId) {
    var f = FONTS.filter(function (x) { return x.id === fontId; })[0];
    return f ? f.family : FONTS[0].family;
  }

  function regenerate() {
    var entries = updateWordCount();
    els.puzzleButton.disabled = !entries.length;
    if (!entries.length) {
      lastPlacements = [];
      render([]);
      els.readyPill.textContent = 'Enter some words';
      return;
    }
    if (entries.length < 3) {
      showToast('At least 3 words are needed to generate a word cloud');
    }
    if (entries.length > 60) {
      showToast('Too many words — only the first 60 are used');
      entries = entries.slice(0, 60);
    }

    var fontFamily = fontFamilyFor(state.font);
    var chips = expandEntries(entries);
    var result = layoutWordCloud(chips, fontFamily, CANVAS_W, CANVAS_H);

    result.placements.forEach(function (p) {
      p.color = pickColor(state.scheme);
    });

    lastPlacements = result.placements;
    render(lastPlacements);

    if (result.overflowCount > 0) {
      els.readyPill.textContent = '✓ Generated (a bit crowded)';
      showToast('Too many words — some had to shrink or overlap; try fewer words');
    } else {
      els.readyPill.textContent = '✓ Generated';
    }
  }
})();
