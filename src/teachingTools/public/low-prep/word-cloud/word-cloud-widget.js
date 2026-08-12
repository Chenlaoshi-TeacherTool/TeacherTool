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

  // Labels use each language's own name so teachers can identify it quickly.
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

  var DEFAULT_WORDS = [
    '苹果', '香蕉', '葡萄', '西瓜', '草莓', '橙子', '菠萝', '芒果', '梨', '桃子'
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
    els.canvas = document.getElementById('cloudCanvas');
    els.printImage = document.getElementById('cloudPrintImage');
    els.paperTitle = document.getElementById('paperTitle');
    els.shuffleButton = document.getElementById('shuffleButton');
    els.printButton = document.getElementById('printButton');
    els.readyPill = document.getElementById('readyPill');
    els.toast = document.getElementById('toast');
    els.sourceLangSelect = document.getElementById('sourceLangSelect');

    buildDisplayModeRow();
    buildSchemeRow();
    buildFontSelect();
    buildBgRow();
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

    els.shuffleButton.addEventListener('click', regenerate);
    els.printButton.addEventListener('click', printWorksheet);

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
    var pending = entries.filter(function (entry) {
      return !Object.prototype.hasOwnProperty.call(translationCache, translationKey(entry.zh));
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
      if (!cleanWord || seen[cleanWord]) return;
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
