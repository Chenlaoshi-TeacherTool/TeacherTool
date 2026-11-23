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
  // How characters are printed: as text, as empty 田字格 to write in, or grey in 田字格 to trace.
  var WRITE_STYLES = ['zh', 'grid', 'trace'];
  var SMALL_BOX_MM = 9;  // smaller writing boxes are hard for children to write in
  var TRANSLATE_MAX_LENGTH = 40;  // the server skips longer text

  // Character wheel: where the changing radical sits, as an angle (clockwise from 12 o'clock).
  // The window is cut there, and section 0 of the bottom circle starts there.
  var SIDE_ANGLE = { top: 0, right: 90, bottom: 180, left: 270 };
  var SIDE_KEY = { left: 'l', right: 'r', top: 't', bottom: 'b' };
  // Full forms a teacher may type for a radical, tried when the typed form finds no character.
  var PART_ALIASES = {
    '水': '氵', '金': '钅', '人': '亻', '手': '扌', '心': '忄', '言': '讠', '糸': '纟', '絲': '纟',
    '食': '饣', '示': '礻', '衣': '衤', '犬': '犭', '草': '艹', '艸': '艹', '刀': '刂', '足': '⻊',
    '玉': '王', '竹': '⺮', '肉': '月', '邑': '阝', '阜': '阝', '火': '灬'
  };
  var COMPOSE_URL = '/low-prep/spin-wheel/data/compose.json.gz';

  var core = window.ChenWordlist;
  var emojiCore = window.ChenEmoji;

  var sectors = DEFAULT_SECTORS;
  var sectorsTouched = false;  // once the teacher sets the count, stop following the word count
  var picOff = {};             // zh -> true when the teacher turned that word's picture off
  var picPick = {};            // zh -> OpenMoji hexcode the teacher chose, kept with saved templates
  var minBoxMm = Infinity;     // smallest writing box on the printed sheets, for the "too small" hint
  var items = [];
  var sentences = [];
  var prepareToken = 0;
  var inputTimer = 0;
  var trCache = {};      // lang -> { chinese text -> translation }, kept with the draft
  var trTimer = 0;
  var trFailed = {};     // lang|text -> true, so a failed text is not asked for again and again
  var compose = null;    // "<side><part><fixed>" -> [characters], built from Make Me a Hanzi
  var composePromise = null;

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
      mode: radioValue('swMode') === 'hanzi' ? 'hanzi' : 'word',
      fixed: $('swFixed').value.trim(),
      side: SIDE_ANGLE.hasOwnProperty(radioValue('swSide')) ? radioValue('swSide') : 'left',
      title: $('swTitle').value.trim(),
      emoji: $('swEmoji').checked,
      pinyin: $('swPinyin').checked,
      english: $('swEnglish').checked,
      lang: LANGS.indexOf($('swLang').value) !== -1 ? $('swLang').value : 'en',
      color: radioValue('swColor') || 'color',
      layout: radioValue('swLayout') || 'same',
      paper: PAPER[$('swPaper').value] ? $('swPaper').value : 'a4',
      write: WRITE_STYLES.indexOf(radioValue('swWrite')) !== -1 ? radioValue('swWrite') : 'zh'
    };
  }

  function saveDraft() {
    try {
      var data = readSettings();
      data.sentences = $('swSentences').value;
      data.words = $('swWords').value;
      data.parts = $('swParts').value;
      data.sectors = sectors;
      data.sectorsTouched = sectorsTouched;
      data.picOff = picOff;
      data.picPick = picPick;
      data.remove = $('swRemove').checked;
      data.trCache = trCache;
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (error) { /* private mode: the tool still works without saving */ }
  }

  function loadDraft() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (error) { data = null; }
    if (!data || typeof data !== 'object') return;
    applyData(data);
    if (typeof data.title === 'string') $('swTitle').value = data.title;
    if (typeof data.remove === 'boolean') $('swRemove').checked = data.remove;
    if (data.trCache && typeof data.trCache === 'object') trCache = data.trCache;
  }

  // What a saved template holds (see services/games/spinWheelGame.js). `title` is the
  // template's name in the teacher's library; the wheel's own title is `heading`.
  function templateData() {
    var s = readSettings();
    return {
      title: s.title || (s.mode === 'hanzi' ? L('Character wheel', '汉字转盘') : L('Spin wheel', '转盘手工')),
      heading: s.title, mode: s.mode, fixed: s.fixed, side: s.side,
      sentences: $('swSentences').value, words: $('swWords').value, parts: $('swParts').value,
      sectors: sectors, sectorsTouched: sectorsTouched, picOff: picOff, picPick: picPick,
      options: { emoji: s.emoji, pinyin: s.pinyin, english: s.english, lang: s.lang, color: s.color, layout: s.layout, paper: s.paper, write: s.write }
    };
  }

  // Puts a draft (flat settings) or a template (settings under `options`) into the form.
  function applyData(data) {
    var o = data.options && typeof data.options === 'object' ? data.options : data;
    if (typeof data.heading === 'string') $('swTitle').value = data.heading;
    if (typeof data.sentences === 'string') $('swSentences').value = data.sentences;
    if (typeof data.words === 'string') $('swWords').value = data.words;
    if (typeof data.parts === 'string') $('swParts').value = data.parts;
    if (typeof data.fixed === 'string') $('swFixed').value = data.fixed;
    if (data.side) setRadio('swSide', data.side);
    if (data.mode) setRadio('swMode', data.mode);
    ['emoji', 'pinyin', 'english'].forEach(function (key) {
      var id = 'sw' + key.charAt(0).toUpperCase() + key.slice(1);
      if (typeof o[key] === 'boolean') $(id).checked = o[key];
    });
    if (o.color) setRadio('swColor', o.color);
    if (o.layout) setRadio('swLayout', o.layout);
    if (o.write && WRITE_STYLES.indexOf(o.write) !== -1) setRadio('swWrite', o.write);
    if (o.paper && PAPER[o.paper]) $('swPaper').value = o.paper;
    if (o.lang && LANGS.indexOf(o.lang) !== -1) $('swLang').value = o.lang;
    if (data.sectors) sectors = clampSectors(Number(data.sectors) || DEFAULT_SECTORS);
    sectorsTouched = !!data.sectorsTouched;
    picOff = data.picOff && typeof data.picOff === 'object' ? data.picOff : {};
    picPick = data.picPick && typeof data.picPick === 'object' ? data.picPick : {};
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

  // ---------- character wheel rows ----------
  function loadCompose() {
    if (composePromise) return composePromise;
    composePromise = fetch(COMPOSE_URL).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof DecompressionStream === 'undefined' || !res.body) return res.text();
      return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
    }).then(function (text) {
      compose = JSON.parse(text);
      return compose;
    }).catch(function () {
      compose = {};  // the teacher can still type each character
      return compose;
    });
    return composePromise;
  }

  // The character made by putting the part on one side of the fixed part, e.g. 钅 left of 十 -> 针.
  function composeChar(part, fixed, side) {
    if (!compose || !part || !fixed) return null;
    var key = SIDE_KEY[side];
    var hit = compose[key + part + fixed];
    if (hit) return { ch: hit[0], part: part };
    var alias = PART_ALIASES[part];
    hit = alias && compose[key + alias + fixed];
    return hit ? { ch: hit[0], part: alias } : null;
  }

  // One row per line: radical | character | word | translation. Character and word are optional.
  function parseRows() {
    var opts = readSettings();
    var seen = Object.create(null);
    var rows = [];
    $('swParts').value.split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/\u3000/g, ' ').trim();
      if (!line) return;
      var groups = /[|｜]/.test(line) ? [line.split(/\s*[|｜]\s*/)]
        : /[、，,；;]/.test(line) ? line.split(/\s*[、，,；;]\s*/).map(function (p) { return [p]; })
        : [line.split(/\s+/)];
      groups.forEach(function (parts) {
        var part = (parts[0] || '').trim();
        if (!part || seen[part]) return;
        seen[part] = true;
        var ch = (parts[1] || '').trim();
        var word = (parts[2] || '').trim();
        var tr = parts.slice(3).join(' ').trim();
        if (!ch) {
          var hit = composeChar(part, opts.fixed, opts.side);
          if (hit) { ch = hit.ch; part = hit.part; }
        }
        var zhText = word || ch;
        rows.push({
          part: part, ch: ch, word: word, zh: zhText, py: '', override: '',
          en: tr || (zhText && core ? core.toEnglish(zhText) : ''), manualTr: tr
        });
      });
    });
    return rows;
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
    var full = list;
    list = list.filter(function (item) { return item && item.zh; });
    var ready = core && core.loadCedict ? core.loadCedict().catch(function () {}) : Promise.resolve();
    return ready.then(function () {
      list.forEach(function (item) {
        if (!item.en && core) item.en = core.toEnglish(item.zh) || '';
      });
      return emojiCore.matchAll(list, { translate: true });
    }).then(applyPicks, applyPicks).then(function () { return full; });

    // Pictures chosen by hand (also from a saved template opened on another computer) win.
    function applyPicks() {
      list.forEach(function (item) {
        var hex = picPick[item.zh];
        if (hex && !(item.openmoji && item.openmoji.hexcode === hex)) item.openmoji = { hexcode: hex };
      });
    }
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
      if (item.zh && !item.manualTr) need.push(item.zh);
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

  // Tokens marked `box` are drawn as a 田字格 instead of the character when `write` is
  // 'grid' (empty, students write it) or 'trace' (the character in light grey to trace).
  function boxSizeFor(zhSize) { return zhSize * 1.12; }
  function boxed(t, write) { return t.box && (write === 'grid' || write === 'trace'); }

  function measureRuby(tokens, zhSize, showPy, write) {
    var pySize = pySizeFor(zhSize);
    var box = boxSizeFor(zhSize);
    var hasPy = showPy && tokens.some(function (t) { return t.py; });
    var hasBox = tokens.some(function (t) { return boxed(t, write); });
    var widths = tokens.map(function (t) {
      var w = boxed(t, write) ? box : textWidth(t.zh, FONT_ZH, zhSize);
      if (hasPy && t.py) w = Math.max(w, textWidth(t.py, FONT_PY, pySize));
      return w + zhSize * 0.06;
    });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var zhH = hasBox ? box : zhSize * 1.02;
    return { w: total, h: zhH + (hasPy ? pySize * 1.25 : 0), zhH: zhH, widths: widths, hasPy: hasPy, hasBox: hasBox };
  }

  function writeBoxSvg(t, mid, top, zhSize, write) {
    var box = boxSizeFor(zhSize);
    var x = mid - box / 2;
    var cy = top + box / 2;
    var dash = ' stroke-dasharray="' + num(box * 0.06) + ' ' + num(box * 0.045) + '"';
    var thin = ' stroke="#9a9a9a" stroke-width="' + num(box * 0.014) + '"' + dash;
    minBoxMm = Math.min(minBoxMm, box);
    var out = '<rect class="sw-box" x="' + num(x) + '" y="' + num(top) + '" width="' + num(box) + '" height="' + num(box) + '" fill="#fff" stroke="#3d3d3d" stroke-width="' + num(box * 0.028) + '"/>' +
      '<line x1="' + num(x) + '" y1="' + num(cy) + '" x2="' + num(x + box) + '" y2="' + num(cy) + '"' + thin + '/>' +
      '<line x1="' + num(mid) + '" y1="' + num(top) + '" x2="' + num(mid) + '" y2="' + num(top + box) + '"' + thin + '/>';
    if (write === 'trace') {
      out += '<text class="sw-t-trace" x="' + num(mid) + '" y="' + num(cy) + '" font-size="' + num(zhSize * 0.98) + '" text-anchor="middle" dominant-baseline="central">' + esc(t.zh) + '</text>';
    }
    return out;
  }

  // SVG for a pinyin-over-characters line whose top edge is at y = top, centred on x = cx.
  function rubySvg(tokens, cx, top, zhSize, showPy, write) {
    var m = measureRuby(tokens, zhSize, showPy, write);
    var pySize = pySizeFor(zhSize);
    var x = cx - m.w / 2;
    var zhTop = top + (m.hasPy ? pySize * 1.25 : 0);
    var zhY = zhTop + (m.zhH - zhSize * 1.02) / 2 + zhSize * 0.86;
    var out = '';
    tokens.forEach(function (t, i) {
      var mid = x + m.widths[i] / 2;
      if (m.hasPy && t.py) {
        out += '<text class="sw-t-py" x="' + num(mid) + '" y="' + num(top + pySize * 0.95) + '" font-size="' + num(pySize) + '" text-anchor="middle">' + esc(t.py) + '</text>';
      }
      if (boxed(t, write)) out += writeBoxSvg(t, mid, zhTop, zhSize, write);
      else out += '<text class="sw-t-zh" x="' + num(mid) + '" y="' + num(zhY) + '" font-size="' + num(zhSize) + '" text-anchor="middle">' + esc(t.zh) + '</text>';
      x += m.widths[i];
    });
    return out;
  }

  // Marks every Chinese character, or only `ch`, to be written in a 田字格.
  function markBoxes(tokens, ch) {
    tokens.forEach(function (t) { if (HAN.test(t.zh) && (!ch || t.zh === ch)) t.box = true; });
    return tokens;
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
    var tokens = markBoxes(rubyTokens(item.zh, item.override));
    var pic = opts.emoji && hasPic(item);
    var en = wordTranslation(item, opts);
    var last = null;
    for (var s = 1; s > 0.12; s *= 0.92) {
      var zhSize = R * 0.17 * s;
      var gap = R * 0.025 * s;
      var ruby = measureRuby(tokens, zhSize, opts.pinyin, opts.write);
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
        out += rubySvg(layout.tokens, 0, top, layout.zhSize, opts.pinyin, opts.write);
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

  function wordBaseSvg(R, sizeMm, list, opts, used) {
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

  function wordTopSvg(R, sizeMm, n, opts) {
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

  // ---------- the character wheel ----------
  // Sizes shared by both circles so the radical in the window and the fixed part line up.
  function hanziGeom(R, n) {
    var half = windowAngle(n) / 2 * 0.9;
    var hub = R * 0.5;
    var inner = hub + R * 0.02;
    var F = Math.min(R * 0.4, (R * 0.95 - inner) * 0.98, 2 * inner * Math.tan(rad(half)) * 0.95);
    return { hub: hub, F: F, rc: inner + F / 2 };
  }

  // Ink edges of a glyph drawn centred (text-anchor middle, central baseline), as fractions of
  // the font size from its centre. Radicals like 氵 or 艹 only fill part of their square.
  var inkCache = {};
  function ink(text) {
    if (!inkCache[text]) {
      measureCtx.font = '400 100px ' + FONT_ZH;
      measureCtx.textAlign = 'center';
      measureCtx.textBaseline = 'middle';
      var m = measureCtx.measureText(text);
      var ok = m.actualBoundingBoxRight != null;
      inkCache[text] = ok
        ? { left: m.actualBoundingBoxLeft / 100, right: m.actualBoundingBoxRight / 100, up: m.actualBoundingBoxAscent / 100, down: m.actualBoundingBoxDescent / 100 }
        : { left: 0.5, right: 0.5, up: 0.5, down: 0.5 };
      measureCtx.textAlign = 'start';
      measureCtx.textBaseline = 'alphabetic';
    }
    return inkCache[text];
  }

  // How far a glyph can move in one direction before its ink would leave its square.
  // `toward` is the side of the upright glyph that should come closer: left/right/up/down.
  function inkRoom(text, toward, size) {
    var extent = Math.min(0.5, ink(text)[toward]);
    return Math.max(0, Math.min(0.3, 0.5 - extent - 0.04)) * size;
  }

  var TOWARD_CENTRE = { left: 'right', right: 'left', top: 'down', bottom: 'up' };
  var TOWARD_WINDOW = { left: 'left', right: 'right', top: 'up', bottom: 'down' };

  function glyph(text, x, y, size, rotate, cls) {
    var t = rotate ? ' transform="rotate(' + num(rotate) + ' ' + num(x) + ' ' + num(y) + ')"' : '';
    return '<text class="' + cls + '" x="' + num(x) + '" y="' + num(y) + '" font-size="' + num(size) + '" text-anchor="middle" dominant-baseline="central"' + t + '>' + esc(text) + '</text>';
  }

  function hanziBaseSvg(R, sizeMm, list, opts, used) {
    var n = list.length;
    var half = 180 / n;
    var phi = SIDE_ANGLE[opts.side];
    var g = hanziGeom(R, n);
    var stroke = num(R * 0.005);
    var out = svgOpen(R, sizeMm, L('Bottom circle with the radicals', '下面的圆：偏旁'));
    out += '<circle cx="0" cy="0" r="' + num(R) + '" fill="#fff"/>';
    list.forEach(function (row, i) {
      var cls = 'sw-sector' + (used && used[i] ? ' is-used' : '');
      out += '<g class="' + cls + '" transform="rotate(' + num(i * 360 / n + phi) + ')">';
      out += '<path d="M0 0 L' + pt(R, -half) + ' A' + num(R) + ' ' + num(R) + ' 0 0 1 ' + pt(R, half) + ' Z" fill="' + sectorColor(i, n, opts) + '" stroke="#8a8a8a" stroke-width="' + stroke + '"/>';
      if (row) {
        // Counter-rotate so the radical stands upright when this section is in the window.
        // Its ink is pulled in toward the centre, so it meets the fixed part across the window edge.
        var r = g.rc - inkRoom(row.part, TOWARD_CENTRE[opts.side], g.F);
        out += glyph(row.part, 0, -r, g.F, -phi, 'sw-t-part');
      } else {
        var box = g.F * 0.8;
        out += '<rect x="' + num(-box / 2) + '" y="' + num(-g.rc - box / 2) + '" width="' + num(box) + '" height="' + num(box) + '" fill="none" stroke="#999" stroke-width="' + stroke + '" stroke-dasharray="' + num(R * 0.02) + ' ' + num(R * 0.015) + '"/>';
      }
      out += '</g>';
    });
    out += '<circle cx="0" cy="0" r="' + num(R) + '" fill="none" stroke="#111" stroke-width="' + num(R * 0.008) + '"/>';
    out += pinMark(R);
    return out + '</svg>';
  }

  // The 字—组词 list on the top circle, for the size step s.
  function tableLines(R, opts, rows, s) {
    var lines = [];
    var zhSize = R * 0.1 * s;
    var gap = zhSize * 0.25;
    if (opts.title) {
      var titleSize = R * 0.085 * s;
      lines.push({ kind: 'title', h: titleSize * 1.25, w: textWidth(opts.title, FONT_ZH, titleSize, 700), size: titleSize });
    }
    rows.forEach(function (row) {
      if (!row) return;
      var text = row.ch ? row.ch + (row.word ? ' — ' + row.word : '') : row.part + ' — ？';
      // In 田字格 mode the character is written by the student, also where it appears in the word.
      var tokens = rubyTokens(text, '');
      if (row.ch) markBoxes(tokens, row.ch);
      var m = measureRuby(tokens, zhSize, opts.pinyin, opts.write);
      var pic = opts.emoji && row.zh && hasPic(row);
      var picSize = zhSize * 1.15;
      lines.push({
        kind: 'row', tokens: tokens, size: zhSize, rubyW: m.w, rubyH: m.h, pic: pic ? row : null, picSize: picSize, gap: gap,
        w: m.w + (pic ? gap + picSize : 0), h: Math.max(m.h, pic ? picSize : 0)
      });
      var tr = wordTranslation(row, opts);
      if (tr) {
        var enSize = zhSize * 0.48;
        lines.push({ kind: 'en', h: enSize * 1.3, w: textWidth(tr, FONT_PY, enSize), size: enSize, text: tr });
      }
    });
    return lines;
  }

  function hanziTopSvg(R, sizeMm, list, opts) {
    var n = list.length;
    var w = windowAngle(n);
    var phi = SIDE_ANGLE[opts.side];
    var g = hanziGeom(R, n);
    var hub = g.hub;
    var out = svgOpen(R, sizeMm, L('Top circle with the window and the fixed part', '上面的圆：窗口和固定部件'));
    out += '<path transform="rotate(' + phi + ')" d="M' + pt(R, w / 2) + ' A' + num(R) + ' ' + num(R) + ' 0 1 1 ' + pt(R, -w / 2) +
      ' L' + pt(hub, -w / 2) + ' A' + num(hub) + ' ' + num(hub) + ' 0 0 1 ' + pt(hub, w / 2) + ' Z"' +
      ' fill="' + (opts.color === 'color' ? '#fffaf0' : '#fff') + '" stroke="#111" stroke-width="' + num(R * 0.008) + '" stroke-linejoin="round"/>';

    // The fixed part sits right next to the window, so it reads as one character with the radical.
    if (opts.fixed) {
      var dc = hub - R * 0.02 - g.F / 2 + inkRoom(opts.fixed, TOWARD_WINDOW[opts.side], g.F);
      out += glyph(opts.fixed, dc * Math.sin(rad(phi)), -dc * Math.cos(rad(phi)), g.F, 0, 'sw-t-part');
    }

    // The list goes on the half of the circle away from the window.
    var vertical = opts.side === 'left' || opts.side === 'right';
    var edge = R * 0.95;
    var inset = R * 0.1;
    var placed = null;
    for (var s = 1; s > 0.2; s *= 0.92) {
      var lines = tableLines(R, opts, list, s);
      if (!lines.length) break;
      var lineGap = R * 0.018 * s;
      var H = lines.reduce(function (sum, line) { return sum + line.h; }, 0) + lineGap * (lines.length - 1);
      var maxW = Math.max.apply(null, lines.map(function (line) { return line.w; }));
      var top, left, fits;
      if (vertical) {
        top = -H / 2;
        var far = Math.max(Math.abs(top), Math.abs(top + H));
        var avail = Math.sqrt(Math.max(0, edge * edge - far * far)) - inset;
        fits = far < edge * 0.9 && maxW <= avail * 0.95;
        var start = inset + Math.max(0, avail - maxW) / 2;
        left = opts.side === 'left' ? start : -start - maxW;
      } else {
        top = opts.side === 'top' ? inset : -inset - H;
        var farY = opts.side === 'top' ? top + H : -top;
        var chord = 2 * Math.sqrt(Math.max(0, edge * edge - farY * farY));
        fits = farY < R * 0.93 && maxW <= chord * 0.92;
        left = -maxW / 2;
      }
      var y = top;
      lines.forEach(function (line) { line.y = y; y += line.h + lineGap; });
      placed = { lines: lines, left: left, maxW: maxW };
      if (fits) break;
    }
    (placed ? placed.lines : []).forEach(function (line) {
      if (line.kind === 'title') {
        out += '<text class="sw-t-title" x="' + num(placed.left + placed.maxW / 2) + '" y="' + num(line.y + line.size * 0.95) + '" font-size="' + num(line.size) + '" text-anchor="middle">' + esc(opts.title) + '</text>';
      } else if (line.kind === 'row') {
        out += rubySvg(line.tokens, placed.left + line.rubyW / 2, line.y + (line.h - line.rubyH) / 2, line.size, opts.pinyin, opts.write);
        if (line.pic) {
          out += '<image href="' + esc(emojiCore.svgUrl(line.pic.openmoji.hexcode)) + '" x="' + num(placed.left + line.rubyW + line.gap) + '" y="' + num(line.y + (line.h - line.picSize) / 2) + '" width="' + num(line.picSize) + '" height="' + num(line.picSize) + '"/>';
        }
      } else {
        out += '<text class="sw-t-en" x="' + num(placed.left) + '" y="' + num(line.y + line.size) + '" font-size="' + num(line.size) + '">' + esc(line.text) + '</text>';
      }
    });
    out += pinMark(R);
    return out + '</svg>';
  }

  function baseSvg(R, sizeMm, list, opts, used) {
    return opts.mode === 'hanzi' ? hanziBaseSvg(R, sizeMm, list, opts, used) : wordBaseSvg(R, sizeMm, list, opts, used);
  }

  function topSvg(R, sizeMm, list, opts) {
    return opts.mode === 'hanzi' ? hanziTopSvg(R, sizeMm, list, opts) : wordTopSvg(R, sizeMm, list.length, opts);
  }

  // ---------- printable sheets ----------
  function circleBlock(svg, label) {
    return '<div class="sw-circle">' + svg + '<span class="sw-circle-label">' + esc(label) + '</span></div>';
  }

  function sheetHtml(W, H, circles, opts) {
    var title = opts.title || (opts.mode === 'hanzi' ? '汉字转盘' : '转盘手工');
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
    minBoxMm = Infinity;
    var paper = PAPER[opts.paper];
    var list = wheelItems();
    var labelTop = L('Top circle (cut out the window)', '上面的圆（剪掉窗口）');
    var labelBase = L('Bottom circle', '下面的圆');
    var html;
    if (opts.layout === 'same') {
      var W = paper.h, H = paper.w;  // landscape
      var D = Math.min((W - 30) / 2, H - 41) * 0.98;
      html = sheetHtml(W, H, [
        circleBlock(topSvg(D / 2, D, list, opts), labelTop),
        circleBlock(baseSvg(D / 2, D, list, opts), labelBase)
      ], opts);
    } else {
      var PW = paper.w, PH = paper.h;  // portrait
      var PD = Math.min(PW - 20, PH - 41) * 0.97;
      html = sheetHtml(PW, PH, [circleBlock(topSvg(PD / 2, PD, list, opts), labelTop)], opts) +
        sheetHtml(PW, PH, [circleBlock(baseSvg(PD / 2, PD, list, opts), labelBase)], opts);
    }
    $('swSheets').innerHTML = html;
    $('swPageSize').textContent = '@media print { @page { size: ' + paper.css + ' ' + (opts.layout === 'same' ? 'landscape' : 'portrait') + '; margin: 0; } }';
    updateWriteHint(opts);
    fitPreview();
  }

  function updateWriteHint(opts) {
    var text = '';
    if (opts.write !== 'zh') {
      if (minBoxMm < SMALL_BOX_MM) {
        text = L('The writing boxes are small (' + Math.round(minBoxMm) + ' mm). Use fewer sections, shorter words, or print each circle on its own page.',
          '格子比较小（约 ' + Math.round(minBoxMm) + ' 毫米），不太好写。可以减少格数、用短一点的词，或者选“每个圆单独一页”。');
      } else if (opts.mode === 'word' && opts.write === 'grid' && !opts.pinyin && !opts.emoji && !opts.english) {
        text = L('With pinyin, pictures and translation all off, students will not know what to write.',
          '拼音、图片和翻译都关掉了，学生会不知道要写什么字。');
      }
    }
    $('swWriteHint').textContent = text;
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
    if (readSettings().mode === 'hanzi') {
      var unknown = items.filter(function (row) { return !row.ch; }).length;
      var count = n + L(n === 1 ? ' radical' : ' radicals', ' 个偏旁');
      if (unknown) count += L(' · ' + unknown + ' could not be put together; type the character after a |', ' · ' + unknown + ' 个拼不出字，请在 | 后面自己写');
      $('swCount').textContent = count;
    } else {
      $('swCount').textContent = n + L(n === 1 ? ' word' : ' words', ' 个词');
    }
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
    picPick[item.zh] = entry.hexcode;
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
  function showModeInputs() {
    var hanzi = readSettings().mode === 'hanzi';
    $('swWordInputs').hidden = hanzi;
    $('swHanziInputs').hidden = !hanzi;
  }

  function refreshAll() {
    var hanzi = readSettings().mode === 'hanzi';
    if (hanzi && !compose) loadCompose().then(refreshAll);
    items = hanzi ? parseRows() : parseWords();
    sentences = hanzi ? [] : parseSentences();
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
    opts.write = 'zh';  // the projector shows the characters; boxes are for paper
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
    if (opts.mode === 'hanzi') {
      html += '<div class="sw-result-parts" lang="zh">' + esc(item.part) + ' + ' + esc(opts.fixed || '？') + ' =</div>';
      html += '<div class="sw-result-char" lang="zh">' + (item.ch ? rubyHtml(item.ch, '', opts.pinyin) : '？') + '</div>';
      if (opts.emoji && item.zh && hasPic(item)) html += '<img src="' + esc(emojiCore.svgUrl(item.openmoji.hexcode)) + '" alt="">';
      if (item.word) html += '<div class="sw-result-sentence" lang="zh">' + rubyHtml(item.word, '', opts.pinyin) + '</div>';
      var trH = wordTranslation(item, opts);
      if (trH) html += '<div class="sw-result-en">' + esc(trH) + '</div>';
      popResult(html);
      return;
    }
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
    popResult(html);
  }

  function popResult(html) {
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
    // A little off-centre looks natural, but never so much that the next section shows in the window.
    var jitter = (Math.random() - 0.5) * Math.min(4, (sectorAngle - windowAngle(n)) + 2);
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
      $('swCount').textContent = readSettings().mode === 'hanzi' ? L('Type some radicals first.', '请先输入偏旁。') : L('Type some words first.', '请先输入词语。');
      return;
    }
    var button = $('swSpin');
    button.disabled = true;
    prepare(items).then(function () {
      button.disabled = false;
      spin.list = wheelItems();
      spin.used = {};
      spin.busy = false;
      $('swSpinTitle').textContent = readSettings().title || (readSettings().mode === 'hanzi' ? '汉字转盘' : '转一转');
      renderSpinBase();
      $('swWheelTop').innerHTML = topSvg(100, 0, spin.list, spinOpts());
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
    var params = new URLSearchParams(location.search);
    if (params.get('mode') === 'hanzi' || params.get('mode') === 'word') setRadio('swMode', params.get('mode'));
    if (handed) {
      setRadio('swMode', 'word');
      $('swWords').value = handed.items.map(function (item) {
        return item.py || item.en ? [item.zh, item.py, item.en].join(' | ') : item.zh;
      }).join('\n');
      sectorsTouched = false;
      handoff.mountBar(handed);
    }

    ['swWords', 'swSentences', 'swTitle', 'swParts', 'swFixed'].forEach(function (id) {
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
    Array.prototype.forEach.call(document.querySelectorAll('input[name="swColor"], input[name="swLayout"], input[name="swWrite"]'), function (input) {
      input.addEventListener('change', function () { saveDraft(); renderSheets(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="swMode"], input[name="swSide"]'), function (input) {
      input.addEventListener('change', function () {
        if (input.name === 'swMode') {
          showModeInputs();
          try {
            var url = new URL(location.href);
            url.searchParams.set('mode', input.value);
            history.replaceState(null, '', url);
          } catch (error) { /* the address just keeps its old mode */ }
        }
        refreshAll();
      });
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

    showModeInputs();
    refreshAll();
    bindTemplate();
  }

  // ---------- template saving (members: account, others: this browser) ----------
  function bindTemplate() {
    if (!window.TeacherGameTemplate) return;
    $('swSaveTemplate').disabled = false;
    window.TeacherGameTemplate.bind({
      button: $('swSaveTemplate'),
      gameType: 'spin-wheel',
      version: 1,
      getData: function () {
        var data = templateData();
        if (!(data.mode === 'hanzi' ? data.parts : data.words).trim()) {
          throw new Error(data.mode === 'hanzi' ? L('Type some radicals before saving.', '请先输入偏旁再保存。') : L('Type some words before saving.', '请先输入词语再保存。'));
        }
        return data;
      },
      restore: function (data) {
        if (!data || typeof data !== 'object') return;
        applyData(data);
        showModeInputs();
        try {
          var url = new URL(location.href);
          url.searchParams.set('mode', readSettings().mode);
          history.replaceState(null, '', url);
        } catch (error) { /* the address just keeps its old mode */ }
        refreshAll();
      }
    });
  }

  init();
})();
