(function () {
  'use strict';

  var DISPLAY_MODES = [
    { id: 'zh', label: 'Target Language' },
    { id: 'en', label: 'English' },
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

  // Each language is labeled in its own script (autonym), not translated,
  // so teachers can recognize their target language at a glance.
  var SOURCE_LANGUAGES = [
    { code: 'zh-CN', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'ru', label: 'Русский' },
    { code: 'pt', label: 'Português' }
  ];

  // A4 portrait ratio (210mm x 297mm) so the on-screen preview matches the printed page.
  var CANVAS_W = 600;
  var CANVAS_H = Math.round(CANVAS_W * (297 / 210));

  var DEFAULT_ROWS = [
    ['苹果', 'apple'], ['香蕉', 'banana'], ['葡萄', 'grape'], ['西瓜', 'watermelon'],
    ['草莓', 'strawberry'], ['橙子', 'orange'], ['菠萝', 'pineapple'], ['芒果', 'mango'],
    ['梨', 'pear'], ['桃子', 'peach']
  ];

  var state = {
    displayModes: { zh: true, en: false, py: false },
    scheme: 'colorful',
    font: 'default',
    background: '#ffffff',
    sourceLang: 'zh-CN'
  };

  var els = {};
  var toastTimer = null;
  var lastPlacements = [];
  var layoutMeta = { cx: CANVAS_W / 2, cy: CANVAS_H / 2, bounds: { left: 24, right: CANVAS_W - 24, top: 24, bottom: CANVAS_H - 24 } };
  var measureCtx = document.createElement('canvas').getContext('2d');
  var pinyinCache = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.wordRows = document.getElementById('wordRows');
    els.addRow = document.getElementById('addRow');
    els.wordCount = document.getElementById('wordCount');
    els.clearWords = document.getElementById('clearWords');
    els.displayModeRow = document.getElementById('displayModeRow');
    els.schemeRow = document.getElementById('schemeRow');
    els.fontSelect = document.getElementById('fontSelect');
    els.bgRow = document.getElementById('bgRow');
    els.canvas = document.getElementById('cloudCanvas');
    els.paperTitle = document.getElementById('paperTitle');
    els.shuffleButton = document.getElementById('shuffleButton');
    els.printButton = document.getElementById('printButton');
    els.readyPill = document.getElementById('readyPill');
    els.toast = document.getElementById('toast');
    els.sourceLangSelect = document.getElementById('sourceLangSelect');
    els.translateAllButton = document.getElementById('translateAllButton');
    els.clearEnglishButton = document.getElementById('clearEnglishButton');

    buildDisplayModeRow();
    buildSchemeRow();
    buildFontSelect();
    buildBgRow();
    buildSourceLangSelect();

    DEFAULT_ROWS.forEach(function (pair) { addRow(pair[0], pair[1]); });

    els.addRow.addEventListener('click', function () {
      addRow('', '');
      var inputs = els.wordRows.querySelectorAll('.zh-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    els.clearWords.addEventListener('click', function () {
      els.wordRows.innerHTML = '';
      addRow('', '');
      updateWordCount();
      regenerate();
    });

    els.translateAllButton.addEventListener('click', translateAllRows);
    els.clearEnglishButton.addEventListener('click', function () {
      var enInputs = els.wordRows.querySelectorAll('.en-input');
      enInputs.forEach(function (input) { input.value = ''; });
      regenerate();
    });

    els.shuffleButton.addEventListener('click', regenerate);
    els.printButton.addEventListener('click', function () { window.print(); });

    // No resize/print listeners needed: the canvas's box size is driven
    // entirely by CSS (#cloudCanvas is 100% of .canvas-wrap, which is sized
    // responsively on screen and to an explicit A4 mm size when printing),
    // so it always tracks the current layout automatically.

    updateWordCount();
    regenerate();
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  var scheduleRegenerate = debounce(regenerate, 500);

  function addRow(zh, en) {
    var row = document.createElement('div');
    row.className = 'word-row';

    var zhInput = document.createElement('input');
    zhInput.type = 'text';
    zhInput.className = 'zh-input';
    zhInput.placeholder = 'Source word (Chinese or any language)';
    zhInput.value = zh || '';
    zhInput.spellcheck = false;

    var enInput = document.createElement('input');
    enInput.type = 'text';
    enInput.className = 'en-input';
    enInput.placeholder = 'English (optional)';
    enInput.value = en || '';
    enInput.spellcheck = false;

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'row-remove';
    removeBtn.setAttribute('aria-label', 'Remove this word');
    removeBtn.textContent = '×';

    [zhInput, enInput].forEach(function (input) {
      input.addEventListener('input', function () {
        updateWordCount();
        scheduleRegenerate();
      });
    });

    removeBtn.addEventListener('click', function () {
      row.remove();
      updateWordCount();
      regenerate();
    });

    row.appendChild(zhInput);
    row.appendChild(enInput);
    row.appendChild(removeBtn);
    els.wordRows.appendChild(row);
  }

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
        regenerate();
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

  function buildSourceLangSelect() {
    els.sourceLangSelect.innerHTML = '';
    SOURCE_LANGUAGES.forEach(function (lang) {
      var opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label;
      els.sourceLangSelect.appendChild(opt);
    });
    els.sourceLangSelect.value = state.sourceLang;
    els.sourceLangSelect.addEventListener('change', function () {
      state.sourceLang = els.sourceLangSelect.value;
    });
  }

  // Free, no-key translation via MyMemory. Best-effort only: never blocks
  // page load, only runs when the teacher explicitly clicks "Auto-Translate".
  function translateOne(text, sourceCode) {
    var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
      '&langpair=' + encodeURIComponent(sourceCode) + '|en';
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var translated = data && data.responseData && data.responseData.translatedText;
        if (!translated || /INVALID|MYMEMORY WARNING/i.test(translated)) return null;
        return translated;
      })
      .catch(function () { return null; });
  }

  function translateAllRows() {
    var rows = Array.prototype.slice.call(els.wordRows.querySelectorAll('.word-row'));
    var pending = rows.filter(function (row) {
      return row.querySelector('.zh-input').value.trim() && !row.querySelector('.en-input').value.trim();
    });
    if (!pending.length) {
      showToast('Nothing to translate (English already filled in, or source is empty)');
      return;
    }

    els.translateAllButton.disabled = true;
    els.translateAllButton.textContent = 'Translating…';
    var sourceCode = state.sourceLang;
    var successCount = 0;
    var failCount = 0;

    function next(index) {
      if (index >= pending.length) {
        els.translateAllButton.disabled = false;
        els.translateAllButton.innerHTML = '<span aria-hidden="true">🌐</span> Auto-Translate to English';
        regenerate();
        if (failCount) {
          showToast('Translated ' + successCount + ', ' + failCount + ' failed (possibly a network issue — try again)');
        } else {
          showToast('Auto-translated ' + successCount + ' word' + (successCount === 1 ? '' : 's'));
        }
        return;
      }
      var row = pending[index];
      var zh = row.querySelector('.zh-input').value.trim();
      translateOne(zh, sourceCode).then(function (result) {
        if (result) {
          row.querySelector('.en-input').value = result;
          successCount++;
        } else {
          failCount++;
        }
        setTimeout(function () { next(index + 1); }, 200);
      });
    }
    next(0);
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

  // Each row can expand into up to 3 independent chips (Chinese / Pinyin /
  // English) that are scattered separately across the cloud, rather than
  // being glued together into one combined chunk of text.
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
    var rows = els.wordRows.querySelectorAll('.word-row');
    var seen = {};
    var entries = [];
    rows.forEach(function (row) {
      var zh = row.querySelector('.zh-input').value.trim();
      var en = row.querySelector('.en-input').value.trim();
      if (!zh || seen[zh]) return;
      seen[zh] = true;
      entries.push({ zh: zh, en: en });
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

  function rectInBounds(rect, bounds) {
    return rect.left >= bounds.left && rect.right <= bounds.right &&
      rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  }

  function measureWord(word, fontSize, fontFamily) {
    measureCtx.font = '700 ' + fontSize + 'px ' + fontFamily;
    var m = measureCtx.measureText(word);
    return {
      w: m.width + fontSize * 0.22,
      h: fontSize * 1.18
    };
  }

  function tryPlace(word, fontSize, fontFamily, bounds, cx, cy, maxRadius, placedRects, ignoreOverlap) {
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
      if (rectInBounds(rect, bounds) &&
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
    var cx = W / 2, cy = H / 2;
    var marginX = W * 0.05, marginY = H * 0.05;
    var bounds = { left: marginX, right: W - marginX, top: marginY, bottom: H - marginY };
    var maxRadius = Math.sqrt(Math.pow(W / 2 - marginX, 2) + Math.pow(H / 2 - marginY, 2));
    var n = chips.length;
    var area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
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
        placed = tryPlace(word, fontSize, fontFamily, bounds, cx, cy, maxRadius, placedRects, false);
        if (!placed) {
          fontSize = Math.max(10, Math.round(fontSize * 0.84));
          attempts++;
        }
      }
      if (!placed) {
        placed = tryPlace(word, fontSize, fontFamily, bounds, cx, cy, maxRadius, placedRects, true);
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

    return { placements: placements, cx: cx, cy: cy, bounds: bounds, overflowCount: overflowCount };
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

    var bounds = layoutMeta.bounds;
    roundRectPath(ctx, bounds.left - 10, bounds.top - 10, (bounds.right - bounds.left) + 20, (bounds.bottom - bounds.top) + 20, 18);
    ctx.fillStyle = state.background;
    ctx.fill();
    ctx.strokeStyle = 'rgba(31, 42, 68, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (!placements || !placements.length) return;

    var fontFamily = fontFamilyFor(state.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    placements.forEach(function (p) {
      ctx.font = '700 ' + p.fontSize + 'px ' + fontFamily;
      ctx.fillStyle = p.color;
      ctx.fillText(p.word, p.x, p.y);
    });
  }

  function fontFamilyFor(fontId) {
    var f = FONTS.filter(function (x) { return x.id === fontId; })[0];
    return f ? f.family : FONTS[0].family;
  }

  function regenerate() {
    var entries = updateWordCount();
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
    layoutMeta = { cx: result.cx, cy: result.cy, bounds: result.bounds };

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
