/*
 * Spin Wheel Craft (转盘手工)
 * Two printable circles: the top one has a window cut out and the sentence pattern,
 * the bottom one is split into sections with a word (and emoji picture) in each.
 * Students pin them together and turn the bottom circle. The same wheel can also
 * be spun on the projector. Everything runs in the browser; the draft is kept in localStorage.
 *
 * Geometry: everything is drawn in SVG with 1 unit = 1 mm. Angles are measured
 * clockwise from 12 o'clock. Section i is centred at i * 360 / N degrees, so the
 * first word sits at the top, under the window, and the rest go clockwise.
 */
(function () {
  'use strict';

  var zh = /^zh/i.test(document.documentElement.lang || '');
  function L(en, cn) { return zh ? cn : en; }
  function $(id) { return document.getElementById(id); }

  var STORE_KEY = 'chen-spin-wheel-v1';
  var MIN_SECTORS = 2;
  var MAX_SECTORS = 12;
  var DEFAULT_SECTORS = 6;

  var FONT_ZH = '"KaiTi", "STKaiti", "Kaiti SC", "楷体", serif';
  var FONT_PY = '"Andika", "Century Gothic", "Segoe UI", Arial, sans-serif';
  // red, yellow, blue, green, purple (light, so the text stays easy to read)
  var COLORS = ['#ffd3d3', '#fff0b3', '#cfe5ff', '#d3f0cf', '#e4d8ff'];
  var PAPER = { a4: { w: 210, h: 297, css: 'A4' }, letter: { w: 215.9, h: 279.4, css: 'letter' } };
  var HAN = /[㐀-鿿豈-﫿]/;
  var HAN_RUN = /[㐀-鿿豈-﫿]+/g;
  var BLANK = /_{2,}|＿+/;
  // Translation languages. English comes from CC-CEDICT in the browser; the others are
  // translated on the server (Azure Translator, POST /api/translate-words) and cached here.
  var LANGS = ['en', 'th', 'vi', 'ru', 'es', 'fr'];
  var TRANSLATE_MAX_LENGTH = 40;  // the server skips longer text

  var core = window.ChenWordlist;
  var emojiCore = window.ChenEmoji;

  var sectors = DEFAULT_SECTORS;
  var sectorsTouched = false;  // once the teacher sets the count, stop following the word count
  var picOff = {};             // zh -> true when the teacher turned that word's picture off
  var items = [];
  var sentences = [];
  var prepareToken = 0;
  var inputTimer = 0;
  var trCache = {};      // lang -> { chinese text -> translation }, kept with the draft
  var trTimer = 0;
  var trFailed = {};     // lang|text -> true, so a failed text is not asked for again and again

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function num(n) { return Math.round(n * 100) / 100; }
  function rad(deg) { return deg * Math.PI / 180; }
  function pt(r, deg) { return num(r * Math.sin(rad(deg))) + ' ' + num(-r * Math.cos(rad(deg))); }
  function clampSectors(n) { return Math.max(MIN_SECTORS, Math.min(MAX_SECTORS, n)); }

  var measureCtx = document.createElement('canvas').getContext('2d');
  var measureCache = {};
  // Width of text at font size `size`, measured once at 100px and scaled.
  function textWidth(text, family, size, weight) {
    var key = (weight || 400) + '|' + family + '|' + text;
    if (!(key in measureCache)) {
      measureCtx.font = (weight || 400) + ' 100px ' + family;
      measureCache[key] = measureCtx.measureText(text).width / 100;
    }
    return measureCache[key] * size;
  }

  // ---------- settings ----------
  function radioValue(name) {
    var input = document.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : '';
  }
  function setRadio(name, value) {
    var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }
  function readSettings() {
    return {
      title: $('swTitle').value.trim(),
      emoji: $('swEmoji').checked,
      pinyin: $('swPinyin').checked,
      english: $('swEnglish').checked,
      lang: LANGS.indexOf($('swLang').value) !== -1 ? $('swLang').value : 'en',
      color: radioValue('swColor') || 'color',
      layout: radioValue('swLayout') || 'same',
      paper: PAPER[$('swPaper').value] ? $('swPaper').value : 'a4'
    };
  }

  function saveDraft() {
    try {
      var data = readSettings();
      data.sentences = $('swSentences').value;
      data.words = $('swWords').value;
      data.sectors = sectors;
      data.sectorsTouched = sectorsTouched;
      data.picOff = picOff;
      data.remove = $('swRemove').checked;
      data.trCache = trCache;
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (error) { /* private mode: the tool still works without saving */ }
  }

  function loadDraft() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (error) { data = null; }
    if (!data || typeof data !== 'object') return;
    if (typeof data.title === 'string') $('swTitle').value = data.title;
    if (typeof data.sentences === 'string') $('swSentences').value = data.sentences;
    if (typeof data.words === 'string') $('swWords').value = data.words;
    ['emoji', 'pinyin', 'english'].forEach(function (key) {
      var id = 'sw' + key.charAt(0).toUpperCase() + key.slice(1);
      if (typeof data[key] === 'boolean') $(id).checked = data[key];
    });
    if (typeof data.remove === 'boolean') $('swRemove').checked = data.remove;
    if (data.color) setRadio('swColor', data.color);
    if (data.layout) setRadio('swLayout', data.layout);
    if (data.paper && PAPER[data.paper]) $('swPaper').value = data.paper;
    if (data.lang && LANGS.indexOf(data.lang) !== -1) $('swLang').value = data.lang;
    if (data.trCache && typeof data.trCache === 'object') trCache = data.trCache;
    if (data.sectors) sectors = clampSectors(Number(data.sectors) || DEFAULT_SECTORS);
    sectorsTouched = !!data.sectorsTouched;
    if (data.picOff && typeof data.picOff === 'object') picOff = data.picOff;
  }

  // ---------- content ----------
  function parseWords() {
    var text = $('swWords').value;
    var parsed = core ? core.parseText(text) : text.split(/\r?\n/).map(function (line) {
      return { zh: line.trim(), py: '', en: '' };
    });
    var seen = Object.create(null);
    return parsed.filter(function (item) {
      if (!item || !item.zh || seen[item.zh]) return false;
      seen[item.zh] = true;
      // Pinyin the teacher typed in (猫 | māo | cat) wins over the automatic reading.
      // Decide this now, while both readings come from the same dictionary state.
      item.override = core && item.py && item.py !== core.toPinyin(item.zh) ? item.py : '';
      // Same for a meaning the teacher typed (猫 | māo | แมว): it is shown as-is in any language.
      item.manualTr = core && item.en && item.en !== core.toEnglish(item.zh) ? item.en : '';
      return true;
    });
  }

  function parseSentences() {
    return $('swSentences').value.split(/\r?\n/).map(function (line) {
      var parts = line.replace(/　/g, ' ').trim().split(/\s*[|｜]\s*/);
      return { zh: (parts[0] || '').trim(), en: (parts[1] || '').trim() };
    }).filter(function (s) { return s.zh; });
  }

  // Fill in English (needed to match a picture) and match each word to an OpenMoji picture.
  function prepare(list) {
    if (!emojiCore) return Promise.resolve(list);
    var ready = core && core.loadCedict ? core.loadCedict().catch(function () {}) : Promise.resolve();
    return ready.then(function () {
      list.forEach(function (item) {
        if (!item.en && core) item.en = core.toEnglish(item.zh) || '';
      });
      return emojiCore.matchAll(list, { translate: true });
    }).then(function () { return list; }, function () { return list; });
  }

  function hasPic(item) {
    return !!(item && item.openmoji && item.openmoji.hexcode) && !picOff[item.zh];
  }

  // ---------- translations ----------
  function cached(lang, text) {
    return (trCache[lang] && trCache[lang][text]) || '';
  }

  function wordTranslation(item, opts) {
    if (!item || !opts.english) return '';
    if (item.manualTr) return item.manualTr;
    return opts.lang === 'en' ? (item.en || '') : cached(opts.lang, item.zh);
  }

  // A sentence's text after | is used as-is; otherwise non-English languages are translated.
  function sentenceTranslation(sentence, opts) {
    if (!opts.english) return '';
    if (sentence.en) return sentence.en;
    return opts.lang === 'en' ? '' : cached(opts.lang, sentence.zh);
  }

  function setTrStatus(text, isError) {
    $('swTrStatus').textContent = text;
    $('swTrStatus').classList.toggle('sw-tr-error', !!isError);
  }

  // Ask the server for whatever the wheel shows but has no translation yet.
  function ensureTranslations() {
    clearTimeout(trTimer);
    var opts = readSettings();
    var lang = opts.lang;
    if (!opts.english || lang === 'en') { setTrStatus(''); return; }
    var need = [];
    items.slice(0, sectors).forEach(function (item) {
      if (!item.manualTr) need.push(item.zh);
    });
    sentences.forEach(function (sentence) {
      if (!sentence.en) need.push(sentence.zh);
    });
    need = need.filter(function (text, i) {
      return need.indexOf(text) === i && !cached(lang, text) && !trFailed[lang + '|' + text] &&
        Array.from(text).length <= TRANSLATE_MAX_LENGTH;
    });
    if (!need.length) { setTrStatus(''); return; }
    trTimer = setTimeout(function () {
      setTrStatus(L('Translating…', '正在翻译…'));
      fetch('/api/translate-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: need, to: [lang] })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          return data;
        });
      }).then(function (data) {
        var map = data.translations || {};
        trCache[lang] = trCache[lang] || {};
        var missing = 0;
        need.forEach(function (text) {
          var t = map[text] && map[text][lang];
          if (t) trCache[lang][text] = t;
          else { trFailed[lang + '|' + text] = true; missing += 1; }
        });
        setTrStatus(missing
          ? L(missing + ' could not be translated. Type your own after a |, for example 猫 | māo | แมว', missing + ' 个没有翻译出来，可以自己写在 | 后面，比如：猫 | māo | แมว')
          : L('Translated. Please check them.', '翻译好了，请检查一下。'));
        saveDraft();
        renderSheets();
      }).catch(function (error) {
        need.forEach(function (text) { trFailed[lang + '|' + text] = true; });
        setTrStatus(L('Translation is not available: ', '翻译服务暂时用不了：') + error.message + ' ' +
          L('You can type your own after a |.', '可以自己写在 | 后面。'), true);
      });
    }, 500);
  }

  // One entry per section; sections without a word are null.
  function wheelItems() {
    var list = [];
    for (var i = 0; i < sectors; i++) list.push(items[i] || null);
    return list;
  }

  // ---------- pinyin over each character ----------
  // Splits text into tokens: one per Chinese character (with its syllable),
  // and runs of anything else (punctuation, ____, Latin) with no pinyin.
  function rubyTokens(text, override) {
    var chars = Array.from(text);
    var hanCount = chars.filter(function (ch) { return HAN.test(ch); }).length;
    var syllables = null;
    if (override) {
      var parts = override.trim().split(/\s+/);
      if (parts.length !== hanCount) return [{ zh: text, py: override }];
      syllables = parts;
    }
    if (!syllables) {
      syllables = [];
      (text.match(HAN_RUN) || []).forEach(function (run) {
        var runChars = Array.from(run);
        var py = core ? core.toPinyin(run, { spaced: true }).split(' ') : [];
        if (py.length !== runChars.length) {
          py = runChars.map(function (ch) { return core ? core.toPinyin(ch) : ''; });
        }
        syllables = syllables.concat(py);
      });
    }
    var tokens = [];
    var other = '';
    var k = 0;
    chars.forEach(function (ch) {
      if (HAN.test(ch)) {
        if (other) { tokens.push({ zh: other, py: '' }); other = ''; }
        tokens.push({ zh: ch, py: syllables[k++] || '' });
      } else {
        other += ch;
      }
    });
    if (other) tokens.push({ zh: other, py: '' });
    return tokens;
  }

  function pySizeFor(zhSize) { return zhSize * 0.42; }

  function measureRuby(tokens, zhSize, showPy) {
    var pySize = pySizeFor(zhSize);
    var hasPy = showPy && tokens.some(function (t) { return t.py; });
    var widths = tokens.map(function (t) {
      var w = textWidth(t.zh, FONT_ZH, zhSize);
      if (hasPy && t.py) w = Math.max(w, textWidth(t.py, FONT_PY, pySize));
      return w + zhSize * 0.06;
    });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    return { w: total, h: zhSize * 1.02 + (hasPy ? pySize * 1.25 : 0), widths: widths, hasPy: hasPy };
  }

  // SVG for a pinyin-over-characters line whose top edge is at y = top, centred on x = cx.
  function rubySvg(tokens, cx, top, zhSize, showPy) {
    var m = measureRuby(tokens, zhSize, showPy);
    var pySize = pySizeFor(zhSize);
    var x = cx - m.w / 2;
    var zhY = top + (m.hasPy ? pySize * 1.25 : 0) + zhSize * 0.86;
    var out = '';
    tokens.forEach(function (t, i) {
      var mid = x + m.widths[i] / 2;
      if (m.hasPy && t.py) {
        out += '<text class="sw-t-py" x="' + num(mid) + '" y="' + num(top + pySize * 0.95) + '" font-size="' + num(pySize) + '" text-anchor="middle">' + esc(t.py) + '</text>';
      }
      out += '<text class="sw-t-zh" x="' + num(mid) + '" y="' + num(zhY) + '" font-size="' + num(zhSize) + '" text-anchor="middle">' + esc(t.zh) + '</text>';
      x += m.widths[i];
    });
    return out;
  }

  // ---------- the bottom circle (words) ----------
  function windowAngle(n) { return Math.min(360 / n - 4, 90); }

  function sectorColor(i, n, opts) {
    if (opts.color !== 'color') return '#fff';
    // With 5 colours, a count like 6 or 11 would put the same colour next to the first section.
    if (i === n - 1 && n % COLORS.length === 1) return COLORS[2];
    return COLORS[i % COLORS.length];
  }

  // Lays out one section's content (picture, word, English) in a section pointing straight up.
  // halfDeg is half of the visible window angle; content must fit inside it.
  function sectorContent(item, R, halfDeg, opts) {
    var tan = Math.tan(rad(halfDeg));
    var rOut = R * 0.94;
    var rIn = R * 0.36;
    var edge = R * 0.97;
    var tokens = rubyTokens(item.zh, item.override);
    var pic = opts.emoji && hasPic(item);
    var en = wordTranslation(item, opts);
    var last = null;
    for (var s = 1; s > 0.12; s *= 0.92) {
      var zhSize = R * 0.17 * s;
      var gap = R * 0.025 * s;
      var ruby = measureRuby(tokens, zhSize, opts.pinyin);
      var lines = [];
      if (pic) lines.push({ kind: 'pic', h: R * 0.25 * s, w: R * 0.25 * s });
      lines.push({ kind: 'word', h: ruby.h, w: ruby.w });
      if (en) {
        var enSize = Math.min(R * 0.07 * s, zhSize * 0.5);
        lines.push({ kind: 'en', h: enSize * 1.2, w: textWidth(en, FONT_PY, enSize), size: enSize, text: en });
      }
      var total = lines.reduce(function (sum, line) { return sum + line.h; }, 0) + gap * (lines.length - 1);
      var avail = rOut - rIn;
      last = { lines: lines, zhSize: zhSize, tokens: tokens, gap: gap, top: rOut };
      if (total > avail) continue;
      var d = rOut - (avail - total) * 0.35;  // a little toward the rim, where the section is wider
      last.top = d;
      var fits = true;
      lines.forEach(function (line) {
        var dTop = d;
        var dBottom = d - line.h;
        var maxW = 0.92 * Math.min(2 * dBottom * tan, 2 * Math.sqrt(Math.max(0, edge * edge - dTop * dTop)));
        if (line.w > maxW) {
          if (line.kind === 'en') { line.size *= maxW / line.w; line.w = maxW; }
          else fits = false;
        }
        line.dTop = dTop;
        d = dBottom - gap;
      });
      if (fits) return last;
    }
    // Nothing fit: use the smallest size and stack from the rim.
    var y = last.top;
    last.lines.forEach(function (line) { line.dTop = y; y -= line.h + last.gap; });
    return last;
  }

  function sectorContentSvg(item, R, halfDeg, opts) {
    if (!item) {
      // An empty section: a dashed line so students can write their own word.
      var d = R * 0.62;
      var half = Math.min(d * Math.tan(rad(halfDeg)) * 0.7, R * 0.25);
      return '<line x1="' + num(-half) + '" y1="' + num(-d) + '" x2="' + num(half) + '" y2="' + num(-d) + '" stroke="#999" stroke-width="' + num(R * 0.006) + '" stroke-dasharray="' + num(R * 0.02) + ' ' + num(R * 0.015) + '"/>';
    }
    var layout = sectorContent(item, R, halfDeg, opts);
    var out = '';
    layout.lines.forEach(function (line) {
      var top = -line.dTop;
      if (line.kind === 'pic') {
        out += '<image href="' + esc(emojiCore.svgUrl(item.openmoji.hexcode)) + '" x="' + num(-line.w / 2) + '" y="' + num(top) + '" width="' + num(line.w) + '" height="' + num(line.h) + '"/>';
      } else if (line.kind === 'word') {
        out += rubySvg(layout.tokens, 0, top, layout.zhSize, opts.pinyin);
      } else {
        out += '<text class="sw-t-en" x="0" y="' + num(top + line.size * 0.95) + '" font-size="' + num(line.size) + '" text-anchor="middle">' + esc(line.text) + '</text>';
      }
    });
    return out;
  }

  function pinMark(R) {
    return '<circle cx="0" cy="0" r="' + num(R * 0.035) + '" fill="none" stroke="#111" stroke-width="' + num(R * 0.006) + '"/>' +
      '<circle cx="0" cy="0" r="' + num(R * 0.01) + '" fill="#111"/>';
  }

  function svgOpen(R, sizeMm, label) {
    var pad = R * 0.02;
    var box = num(-R - pad) + ' ' + num(-R - pad) + ' ' + num(2 * (R + pad)) + ' ' + num(2 * (R + pad));
    var size = sizeMm ? ' width="' + num(sizeMm) + 'mm" height="' + num(sizeMm) + 'mm"' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box + '"' + size + ' role="img" aria-label="' + esc(label) + '">';
  }

  function baseSvg(R, sizeMm, list, opts, used) {
    var n = list.length;
    var half = 180 / n;
    var contentHalf = windowAngle(n) / 2 * 0.92;
    var stroke = num(R * 0.005);
    var out = svgOpen(R, sizeMm, L('Bottom circle with the words', '下面的圆：词语'));
    out += '<circle cx="0" cy="0" r="' + num(R) + '" fill="#fff"/>';
    list.forEach(function (item, i) {
      var cls = 'sw-sector' + (used && used[i] ? ' is-used' : '');
      out += '<g class="' + cls + '" transform="rotate(' + num(i * 360 / n) + ')">';
      out += '<path d="M0 0 L' + pt(R, -half) + ' A' + num(R) + ' ' + num(R) + ' 0 0 1 ' + pt(R, half) + ' Z" fill="' + sectorColor(i, n, opts) + '" stroke="#8a8a8a" stroke-width="' + stroke + '"/>';
      out += sectorContentSvg(item, R, contentHalf, opts);
      out += '</g>';
    });
    out += '<circle cx="0" cy="0" r="' + num(R) + '" fill="none" stroke="#111" stroke-width="' + num(R * 0.008) + '"/>';
    out += pinMark(R);
    return out + '</svg>';
  }

  // ---------- the top circle (window + sentence pattern) ----------
  function topLines(R, opts, s) {
    var lines = [];
    var zhSize = R * 0.14 * s;
    if (opts.title) {
      var titleSize = R * 0.1 * s;
      lines.push({ kind: 'title', h: titleSize * 1.2, w: textWidth(opts.title, FONT_ZH, titleSize, 700), size: titleSize });
    }
    sentences.forEach(function (sentence) {
      var tokens = rubyTokens(sentence.zh, '');
      var m = measureRuby(tokens, zhSize, opts.pinyin);
      lines.push({ kind: 'ruby', h: m.h, w: m.w, tokens: tokens, size: zhSize });
      var tr = sentenceTranslation(sentence, opts);
      if (tr) {
        var enSize = zhSize * 0.5;
        lines.push({ kind: 'en', h: enSize * 1.3, w: textWidth(tr, FONT_PY, enSize), size: enSize, text: tr });
      }
    });
    return lines;
  }

  function topSvg(R, sizeMm, n, opts) {
    var w = windowAngle(n);
    var hub = R * 0.3;
    var out = svgOpen(R, sizeMm, L('Top circle with the window and sentence pattern', '上面的圆：窗口和句型'));
    out += '<path d="M' + pt(R, w / 2) + ' A' + num(R) + ' ' + num(R) + ' 0 1 1 ' + pt(R, -w / 2) +
      ' L' + pt(hub, -w / 2) + ' A' + num(hub) + ' ' + num(hub) + ' 0 0 1 ' + pt(hub, w / 2) + ' Z"' +
      ' fill="' + (opts.color === 'color' ? '#fffaf0' : '#fff') + '" stroke="#111" stroke-width="' + num(R * 0.008) + '" stroke-linejoin="round"/>';

    // Text goes in the lower part, below the pin, centred.
    var start = R * 0.14;
    var limit = R * 0.93;
    var edge = R * 0.95;
    var chosen = null;
    for (var s = 1; s > 0.2; s *= 0.92) {
      var lines = topLines(R, opts, s);
      if (!lines.length) break;
      var gap = R * 0.025 * s;
      var y = start;
      var fits = true;
      lines.forEach(function (line) {
        var bottom = y + line.h;
        var maxW = 2 * Math.sqrt(Math.max(0, edge * edge - bottom * bottom)) * 0.9;
        if (bottom > limit || line.w > maxW) fits = false;
        line.y = y;
        y = bottom + gap;
      });
      chosen = lines;
      if (fits) break;
    }
    (chosen || []).forEach(function (line) {
      if (line.kind === 'title') {
        out += '<text class="sw-t-title" x="0" y="' + num(line.y + line.size * 0.95) + '" font-size="' + num(line.size) + '" text-anchor="middle">' + esc(opts.title) + '</text>';
      } else if (line.kind === 'ruby') {
        out += rubySvg(line.tokens, 0, line.y, line.size, opts.pinyin);
      } else {
        out += '<text class="sw-t-en" x="0" y="' + num(line.y + line.size * 1.0) + '" font-size="' + num(line.size) + '" text-anchor="middle">' + esc(line.text) + '</text>';
      }
    });
    out += pinMark(R);
    return out + '</svg>';
  }

  // ---------- printable sheets ----------
  function circleBlock(svg, label) {
    return '<div class="sw-circle">' + svg + '<span class="sw-circle-label">' + esc(label) + '</span></div>';
  }

  function sheetHtml(W, H, circles, opts) {
    var title = opts.title || '转盘手工';
    return '<div class="sw-sheet" style="width:' + W + 'mm;height:' + num(H - 0.6) + 'mm">' +
      '<div class="sw-sheet-head"><strong>' + esc(title) + '</strong><span>Chen Laoshi\'s Teaching Tools</span></div>' +
      '<div class="sw-sheet-body">' + circles.join('') + '</div>' +
      '<p class="sw-sheet-steps">' + esc(L(
        '① Cut out both circles along the black lines, including the window in the top circle.  ② Put the top circle on the bottom circle and push a paper fastener through both centre dots.  ③ Turn the bottom circle and say a sentence with the word in the window.',
        '① 沿黑线剪下两个圆，上面那个圆的扇形窗口也要剪掉。② 把上面的圆放在下面的圆上，用双脚钉穿过两个圆心。③ 转动下面的圆，用窗口里的词说一句话。'
      )) + '</p></div>';
  }

  function renderSheets() {
    var opts = readSettings();
    var paper = PAPER[opts.paper];
    var list = wheelItems();
    var labelTop = L('Top circle (cut out the window)', '上面的圆（剪掉窗口）');
    var labelBase = L('Bottom circle', '下面的圆');
    var html;
    if (opts.layout === 'same') {
      var W = paper.h, H = paper.w;  // landscape
      var D = Math.min((W - 30) / 2, H - 41) * 0.98;
      html = sheetHtml(W, H, [
        circleBlock(topSvg(D / 2, D, list.length, opts), labelTop),
        circleBlock(baseSvg(D / 2, D, list, opts), labelBase)
      ], opts);
    } else {
      var PW = paper.w, PH = paper.h;  // portrait
      var PD = Math.min(PW - 20, PH - 41) * 0.97;
      html = sheetHtml(PW, PH, [circleBlock(topSvg(PD / 2, PD, list.length, opts), labelTop)], opts) +
        sheetHtml(PW, PH, [circleBlock(baseSvg(PD / 2, PD, list, opts), labelBase)], opts);
    }
    $('swSheets').innerHTML = html;
    $('swPageSize').textContent = '@media print { @page { size: ' + paper.css + ' ' + (opts.layout === 'same' ? 'landscape' : 'portrait') + '; margin: 0; } }';
    fitPreview();
  }

  function fitPreview() {
    var stage = $('swStage');
    var sheets = $('swSheets');
    sheets.style.transform = 'none';
    var naturalW = sheets.offsetWidth;
    var naturalH = sheets.offsetHeight;
    var avail = stage.clientWidth - 24;
    if (!naturalW || avail <= 0) return;
    var scale = Math.min(1, avail / naturalW);
    sheets.style.transform = 'scale(' + scale + ')';
    stage.style.height = Math.ceil(naturalH * scale + 24) + 'px';
  }

  // ---------- counts and section hint ----------
  function updateCount() {
    var n = items.length;
    $('swCount').textContent = n + L(n === 1 ? ' word' : ' words', ' 个词');
    $('swSectors').textContent = String(sectors);
    $('swMinus').disabled = sectors <= MIN_SECTORS;
    $('swPlus').disabled = sectors >= MAX_SECTORS;
    var hint = $('swSectorHint');
    hint.replaceChildren();
    var text = '';
    var fitTo = 0;
    if (n > MAX_SECTORS) {
      text = L('One wheel holds up to 12 words; only the first ' + sectors + ' are used.', '一个转盘最多 12 个词，现在只用前 ' + sectors + ' 个。');
      if (sectors < MAX_SECTORS) fitTo = MAX_SECTORS;
    } else if (n > sectors) {
      text = L('Only the first ' + sectors + ' words fit.', '只放得下前 ' + sectors + ' 个词。');
      fitTo = n;
    } else if (n && n < sectors) {
      var blank = sectors - n;
      text = L(blank + (blank === 1 ? ' section is' : ' sections are') + ' blank, so students can write their own word.', '有 ' + blank + ' 格是空白的，学生可以自己写词。');
      fitTo = Math.max(MIN_SECTORS, n);
    }
    if (!text) return;
    hint.appendChild(document.createTextNode(text + ' '));
    if (fitTo && fitTo !== sectors) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sw-btn sw-btn-ghost';
      button.textContent = L('Use ' + fitTo + ' sections', '改成 ' + fitTo + ' 格');
      button.addEventListener('click', function () { setSectors(fitTo, true); });
      hint.appendChild(button);
    }
  }

  function setSectors(n, byTeacher) {
    sectors = clampSectors(n);
    if (byTeacher) sectorsTouched = true;
    updateCount();
    renderPreviewChips();
    renderSheets();
    saveDraft();
    ensureTranslations();
  }

  // ---------- picture chips + picker ----------
  var pickerItem = null;
  var pickerTimer = 0;

  function renderPreviewChips() {
    var box = $('swPreviewBox');
    var root = $('swChips');
    var shown = items.slice(0, sectors);
    if (!$('swEmoji').checked || !shown.length || !emojiCore) { box.hidden = true; pickerItem = null; $('swPicker').hidden = true; return; }
    box.hidden = false;
    root.replaceChildren();
    shown.forEach(function (item) {
      var pic = hasPic(item);
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sw-chip' + (pic ? '' : ' is-none') + (pickerItem && pickerItem.zh === item.zh ? ' is-open' : '');
      if (pic) {
        var img = document.createElement('img');
        img.src = emojiCore.svgUrl(item.openmoji.hexcode);
        img.alt = '';
        chip.appendChild(img);
        chip.title = L('Change the picture', '换一张图片');
      } else {
        var plus = document.createElement('span');
        plus.className = 'sw-chip-plus';
        plus.textContent = '＋';
        chip.appendChild(plus);
        chip.title = L('Choose a picture', '选一张图片');
      }
      var word = document.createElement('span');
      word.textContent = item.zh;
      chip.appendChild(word);
      chip.addEventListener('click', function () { openPicker(item); });
      root.appendChild(chip);
    });
    if (pickerItem && !shown.some(function (item) { return item.zh === pickerItem.zh; })) closePicker();
  }

  function renderPickerResults() {
    var root = $('swPickerResults');
    var query = $('swPickerSearch').value.trim();
    root.replaceChildren();
    if (!pickerItem || !emojiCore) return;
    emojiCore.load().then(function (index) {
      if (!pickerItem || $('swPickerSearch').value.trim() !== query) return;
      var results = query ? emojiCore.search(query, index, { limit: 48 }) : [];
      root.replaceChildren();
      if (!results.length) {
        var empty = document.createElement('p');
        empty.className = 'sw-hint';
        empty.textContent = query
          ? L('No pictures found. Try another word, in English if you can.', '没有找到图片。换一个词试试，用英文搜索更容易找到。')
          : L('Type a word to search.', '输入一个词来搜索。');
        root.appendChild(empty);
        return;
      }
      var current = hasPic(pickerItem) ? pickerItem.openmoji.hexcode : '';
      results.forEach(function (entry) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sw-pick' + (entry.hexcode === current ? ' is-current' : '');
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', entry.hexcode === current ? 'true' : 'false');
        button.title = entry.annotation || '';
        var img = document.createElement('img');
        img.src = emojiCore.svgUrl(entry.hexcode);
        img.alt = entry.annotation || '';
        img.loading = 'lazy';
        button.appendChild(img);
        button.addEventListener('click', function () { choosePicture(entry); });
        root.appendChild(button);
      });
    }, function () {
      var failed = document.createElement('p');
      failed.className = 'sw-hint';
      failed.textContent = L('The pictures could not be loaded. Check your internet connection.', '图片加载失败，请检查网络连接。');
      root.replaceChildren(failed);
    });
  }

  function openPicker(item) {
    pickerItem = item;
    $('swPickerTitle').textContent = L('Picture for ', '给这个词选图：') + item.zh;
    $('swPickerSearch').value = item.zh;
    $('swPicker').hidden = false;
    renderPreviewChips();
    renderPickerResults();
    $('swPickerSearch').focus();
    $('swPickerSearch').select();
  }

  function closePicker() {
    if (!pickerItem) return;
    pickerItem = null;
    $('swPicker').hidden = true;
    renderPreviewChips();
  }

  // The choice is remembered for this word (ChenEmoji.remember), so other tools use it too.
  function choosePicture(entry) {
    if (!pickerItem) return;
    var zhWord = pickerItem.zh;
    var item = items.filter(function (it) { return it.zh === zhWord; })[0] || pickerItem;
    item.openmoji = entry;
    delete picOff[item.zh];
    emojiCore.remember(item, entry.emoji);
    saveDraft();
    closePicker();
    renderSheets();
  }

  function removePicture() {
    if (!pickerItem) return;
    picOff[pickerItem.zh] = true;
    saveDraft();
    closePicker();
    renderSheets();
  }

  // ---------- refresh ----------
  function refreshAll() {
    items = parseWords();
    sentences = parseSentences();
    if (!sectorsTouched && items.length >= MIN_SECTORS) sectors = clampSectors(items.length);
    updateCount();
    saveDraft();
    renderSheets();
    ensureTranslations();
    var token = ++prepareToken;
    var list = items;
    prepare(list).then(function () {
      if (token !== prepareToken) return;
      renderPreviewChips();
      renderSheets();
    });
  }

  function printSheets() {
    renderSheets();
    var images = Array.prototype.slice.call($('swSheets').querySelectorAll('image'));
    // Give the emoji pictures a moment to arrive before the print dialog takes its snapshot.
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      ready.then(function () {
        return Promise.all(images.map(function (image) {
          return new Promise(function (resolve) {
            var probe = new Image();
            probe.onload = probe.onerror = resolve;
            probe.src = image.getAttribute('href');
          });
        }));
      }),
      new Promise(function (resolve) { setTimeout(resolve, 2500); })
    ]).then(function () { window.print(); });
  }

  // ---------- on-screen spin ----------
  var spin = { rotation: 0, used: {}, busy: false, list: [] };

  function spinOpts() {
    var opts = readSettings();
    opts.color = 'color';
    return opts;
  }

  function renderSpinBase() {
    $('swWheelBase').innerHTML = baseSvg(100, 0, spin.list, spinOpts(), spin.used);
  }

  function rubyHtml(text, override, showPy) {
    return rubyTokens(text, override).map(function (t) {
      if (!showPy || !t.py) return esc(t.zh);
      return '<ruby>' + esc(t.zh) + '<rt>' + esc(t.py) + '</rt></ruby>';
    }).join('');
  }

  function showIdle(message) {
    var result = $('swResult');
    result.classList.remove('is-pop');
    result.innerHTML = '<p class="sw-result-idle">' + esc(message) + '</p>';
  }

  function showResult(item) {
    var opts = readSettings();
    var html = '';
    if (opts.emoji && hasPic(item)) html += '<img src="' + esc(emojiCore.svgUrl(item.openmoji.hexcode)) + '" alt="">';
    html += '<div class="sw-result-word" lang="zh">' + rubyHtml(item.zh, item.override, opts.pinyin) + '</div>';
    var tr = wordTranslation(item, opts);
    if (tr) html += '<div class="sw-result-en">' + esc(tr) + '</div>';
    sentences.forEach(function (sentence) {
      if (!BLANK.test(sentence.zh)) return;
      var parts = sentence.zh.split(BLANK);
      var filled = esc(parts[0]) + '<mark>' + esc(item.zh) + '</mark>' + esc(parts.slice(1).join('____'));
      html += '<div class="sw-result-sentence" lang="zh">' + filled + '</div>';
    });
    var result = $('swResult');
    result.classList.remove('is-pop');
    result.innerHTML = html;
    void result.offsetWidth;  // restart the pop animation
    result.classList.add('is-pop');
  }

  function spinOnce() {
    if (spin.busy) return;
    var n = spin.list.length;
    var remove = $('swRemove').checked;
    var choices = [];
    spin.list.forEach(function (item, i) {
      if (item && !(remove && spin.used[i])) choices.push(i);
    });
    if (!choices.length) {
      showIdle(L('Every word has been picked. Click Reset to start again.', '所有的词都抽过了，点“重新开始”再玩一次。'));
      return;
    }
    var pick = choices[Math.floor(Math.random() * choices.length)];
    var sectorAngle = 360 / n;
    var jitter = (Math.random() - 0.5) * Math.min(sectorAngle, windowAngle(n)) * 0.4;
    var target = -pick * sectorAngle + jitter;
    var delta = ((target - spin.rotation) % 360 + 360) % 360;
    spin.rotation += 360 * 5 + delta;
    spin.busy = true;
    $('swGo').disabled = true;
    showIdle('🎡 …');
    var base = $('swWheelBase');
    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      base.removeEventListener('transitionend', done);
      spin.busy = false;
      $('swGo').disabled = false;
      showResult(spin.list[pick]);
      if (remove) { spin.used[pick] = true; renderSpinBase(); }
      $('swGo').focus();
    }
    base.addEventListener('transitionend', done);
    setTimeout(done, 4600);
    base.style.transform = 'rotate(' + spin.rotation + 'deg)';
  }

  function resetSpin() {
    spin.used = {};
    renderSpinBase();
    showIdle(L('Click Spin!', '点“转一转”！'));
  }

  function openSpin() {
    var list = wheelItems();
    if (!list.some(Boolean)) {
      $('swWords').focus();
      $('swCount').textContent = L('Type some words first.', '请先输入词语。');
      return;
    }
    var button = $('swSpin');
    button.disabled = true;
    prepare(items).then(function () {
      button.disabled = false;
      spin.list = wheelItems();
      spin.used = {};
      spin.busy = false;
      $('swSpinTitle').textContent = readSettings().title || '转一转';
      renderSpinBase();
      $('swWheelTop').innerHTML = topSvg(100, 0, spin.list.length, spinOpts());
      $('swWheelBase').style.transform = 'rotate(' + spin.rotation + 'deg)';
      showIdle(L('Click Spin!', '点“转一转”！'));
      $('swSpinStage').hidden = false;
      document.body.classList.add('sw-spinning-open');
      $('swGo').focus();
    });
  }

  function closeSpin() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    $('swSpinStage').hidden = true;
    document.body.classList.remove('sw-spinning-open');
    spin.busy = false;
    $('swGo').disabled = false;
    $('swSpin').focus();
  }

  // ---------- wiring ----------
  function init() {
    loadDraft();

    // Opened from the Vocab Game Switcher: use that list instead of the saved draft.
    var handoff = window.ChenWordlistHandoff;
    var handed = handoff && handoff.active();
    if (handed) {
      $('swWords').value = handed.items.map(function (item) {
        return item.py || item.en ? [item.zh, item.py, item.en].join(' | ') : item.zh;
      }).join('\n');
      sectorsTouched = false;
      handoff.mountBar(handed);
    }

    ['swWords', 'swSentences', 'swTitle'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        clearTimeout(inputTimer);
        inputTimer = setTimeout(refreshAll, 350);
      });
    });
    ['swEmoji', 'swPinyin', 'swEnglish', 'swPaper', 'swLang'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (id === 'swLang' && !$('swEnglish').checked) $('swEnglish').checked = true;
        saveDraft(); renderPreviewChips(); renderSheets(); ensureTranslations();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="swColor"], input[name="swLayout"]'), function (input) {
      input.addEventListener('change', function () { saveDraft(); renderSheets(); });
    });
    $('swMinus').addEventListener('click', function () { setSectors(sectors - 1, true); });
    $('swPlus').addEventListener('click', function () { setSectors(sectors + 1, true); });

    $('swPickerSearch').addEventListener('input', function () {
      clearTimeout(pickerTimer);
      pickerTimer = setTimeout(renderPickerResults, 250);
    });
    $('swPickerClose').addEventListener('click', closePicker);
    $('swPickerNone').addEventListener('click', removePicture);

    $('swPrint').addEventListener('click', printSheets);
    $('swSpin').addEventListener('click', openSpin);
    $('swGo').addEventListener('click', spinOnce);
    $('swReset').addEventListener('click', resetSpin);
    $('swExit').addEventListener('click', closeSpin);
    $('swRemove').addEventListener('change', saveDraft);
    $('swFullscreen').addEventListener('click', function () {
      var stage = $('swSpinStage');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
    });
    document.addEventListener('keydown', function (event) {
      if ($('swSpinStage').hidden) return;
      if (event.key === 'Escape' && !document.fullscreenElement) closeSpin();
      if (event.key === ' ' && !(event.target && /^(INPUT|BUTTON)$/.test(event.target.tagName) && event.target !== $('swGo'))) {
        event.preventDefault();
        spinOnce();
      }
    });
    window.addEventListener('resize', fitPreview);

    // Pinyin is measured with Andika; draw again once the web font has arrived.
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('400 20px "Andika"'),
        document.fonts.load('700 20px "Andika"')
      ]).then(function () { measureCache = {}; renderSheets(); }, function () {});
    }

    refreshAll();
  }

  init();
})();
