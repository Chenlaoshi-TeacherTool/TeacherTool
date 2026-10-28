(function () {
  'use strict';

  // Each theme needs plenty of distinct emoji: a 40-字 message plus decoys
  // can need 60+ symbols. Anything a theme lacks is borrowed from the others.
  var THEMES = {
    halloween: {
      label: '万圣节', en: 'Halloween', badge: '🎃', deco: ['🎃', '🦇', '👻', '🕸️'],
      icons: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀', '🍬', '🍭', '🍫', '🌕', '🔮', '🧹', '⚰️', '🦉', '🕯️', '🌙', '🍂', '🧪', '🏚️', '👽', '🤡', '🎭', '🐺', '🍎', '🧙', '🧛', '🧟', '🐈', '🪦', '🗝️', '🌑', '🍄', '🐍', '🐸', '🦂', '🥀', '⚡', '🌲', '🔦', '🐀']
    },
    christmas: {
      label: '圣诞节', en: 'Christmas', badge: '🎄', deco: ['🎄', '❄️', '🎁', '⭐'],
      icons: ['🎄', '🎅', '🤶', '⛄', '❄️', '🎁', '🔔', '🦌', '🍪', '🥛', '🧦', '🕯️', '⭐', '🌟', '🎀', '🍭', '🧣', '🧤', '🛷', '🏠', '🔥', '☕', '🎶', '🎺', '🥕', '🌲', '🍬', '🎉', '✨', '💝', '🧸', '🚂', '🍰', '🥧', '🍫', '👼', '🐧', '🌨️', '🎊', '🦉']
    },
    autumn: {
      label: '金秋', en: 'Autumn Harvest', badge: '🍁', deco: ['🍁', '🍂', '🌾', '🍎'],
      icons: ['🍂', '🍁', '🍄', '🌰', '🎃', '🍎', '🍐', '🍇', '🌽', '🥔', '🥕', '🍠', '🥧', '🦃', '🦔', '🐿️', '🦉', '🌾', '🧺', '🍯', '☕', '🧣', '🌙', '🥮', '🏮', '🐇', '🍊', '🌻', '🍵', '🥜', '🍏', '🫐', '🌧️', '🍃', '🦊', '🪵', '🎑', '🥐', '🍲', '🐻']
    },
    newyear: {
      label: '春节', en: 'Lunar New Year', badge: '🧧', deco: ['🧧', '🏮', '🧨', '🐉'],
      icons: ['🧧', '🏮', '🧨', '🎆', '🎇', '🐉', '🥟', '🍊', '🍜', '🐟', '🏯', '🎎', '🪭', '🎏', '💰', '🪙', '🌸', '🌺', '🍡', '🥮', '🍵', '🀄', '🐓', '🐂', '🐅', '🐇', '🐍', '🐎', '🐑', '🐒', '🐕', '🐖', '🐀', '🎋', '🎉', '🍑', '🧋', '🥢', '🔔', '🐲']
    },
    everyday: {
      label: '日常通用', en: 'Everyday', badge: '⭐', deco: ['⭐', '🌈', '🎈', '✏️'],
      icons: ['⭐', '❤️', '🌈', '☀️', '🌙', '☁️', '🌸', '🍀', '🍎', '🍌', '🍓', '🍉', '🍦', '🍕', '🚗', '🚀', '✈️', '🚲', '⚽', '🏀', '🎈', '🎨', '📚', '✏️', '🎵', '🐶', '🐱', '🐰', '🐼', '🐸', '🐵', '🐧', '🐢', '🦋', '🐠', '🌻', '🍩', '🧁', '🎂', '🔑']
    }
  };

  var SHAPES = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '🔺', '🔷', '🔶', '♠️', '♣️', '♥️', '♦️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];

  var PAPER = {
    a4: { w: 210, h: 297, page: 'A4 portrait' },
    letter: { w: 215.9, h: 279.4, page: 'letter portrait' }
  };

  // Puzzle cell widths (mm), largest first; the fit loop steps down until the sheet fits one page.
  var CELL_SIZES = [24, 21, 18, 16, 14.5, 13, 11.5, 10.5];

  var HAN = /\p{Script=Han}/u;
  var WORD = /[\p{L}\p{N}]/u;

  var state = {
    theme: 'halloween',
    match: 'random',
    paper: 'a4',
    seed: newSeed()
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function newSeed() { return (Math.random() * 4294967296) >>> 0; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashString(str, seed) {
    var h = 2166136261 ^ seed;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(list, seed) {
    var rand = mulberry32(seed);
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function keyOf(ch) { return HAN.test(ch) ? ch : ch.toLocaleUpperCase(); }
  function isLatinLetter(k) { return /^[A-Z]$/.test(k); }

  /**
   * Splits the message into display groups. English words stay together so a
   * word never wraps mid-way; each 汉字 is its own group; punctuation sticks to
   * the group before it and is printed as-is (it gets no emoji).
   */
  function parseMessage(text) {
    var groups = [];
    var current = null;
    var count = 0;

    Array.from(text).forEach(function (ch) {
      if (ch === '\n') {
        current = null;
        groups.push({ br: true });
      } else if (/\s/.test(ch)) {
        current = null;
      } else if (HAN.test(ch)) {
        current = null;
        groups.push({ items: [{ ch: ch, key: ch }] });
        count++;
      } else if (WORD.test(ch)) {
        if (!current) { current = { items: [] }; groups.push(current); }
        current.items.push({ ch: ch, key: keyOf(ch) });
        count++;
      } else {
        // Punctuation: attach to the previous group if there is one.
        var last = groups.length ? groups[groups.length - 1] : null;
        if (last && !last.br) last.items.push({ punct: ch });
        current = null;
      }
    });

    return { groups: groups, count: count };
  }

  function validChars(text) {
    return Array.from(text).filter(function (ch) { return WORD.test(ch); }).map(keyOf);
  }

  function buildPool(themeId) {
    var seen = Object.create(null);
    var pool = [];
    function add(e) { if (!seen[e]) { seen[e] = true; pool.push(e); } }
    THEMES[themeId].icons.forEach(add);
    Object.keys(THEMES).forEach(function (id) { if (id !== themeId) THEMES[id].icons.forEach(add); });
    SHAPES.forEach(add);
    return pool;
  }

  /** Returns the code-key entries [{key, emoji, decoy}] in display order. */
  function buildKey(parsed, decoyText, fullAlphabet) {
    var order = [];
    var seen = Object.create(null);
    function add(k, decoy) {
      if (seen[k]) return;
      seen[k] = true;
      order.push({ key: k, decoy: decoy });
    }

    parsed.groups.forEach(function (g) {
      (g.items || []).forEach(function (it) { if (it.key) add(it.key, false); });
    });
    validChars(decoyText).forEach(function (k) { add(k, true); });
    if (fullAlphabet && order.some(function (e) { return isLatinLetter(e.key); })) {
      for (var c = 65; c <= 90; c++) add(String.fromCharCode(c), true);
    }

    var latin = order.filter(function (e) { return !HAN.test(e.key); });
    var han = order.filter(function (e) { return HAN.test(e.key); });
    latin.sort(function (a, b) { return a.key.localeCompare(b.key, 'en', { numeric: true }); });
    // A stable, seed-based order: the key never lists 汉字 in message order,
    // and typing more text doesn't reshuffle the entries already there.
    han.sort(function (a, b) { return hashString(a.key, state.seed) - hashString(b.key, state.seed); });
    var display = han.concat(latin);

    var pool = buildPool(state.theme);
    if (state.match === 'ordered') {
      display.forEach(function (e, i) { e.emoji = pool[i % pool.length]; });
    } else {
      // Random: shuffle the theme's icons, then hand them out by first
      // appearance so earlier letters keep their emoji while the teacher types.
      var themeLen = THEMES[state.theme].icons.length;
      var shuffled = shuffle(pool.slice(0, themeLen), state.seed).concat(pool.slice(themeLen));
      order.forEach(function (e, i) { e.emoji = shuffled[i % shuffled.length]; });
    }
    return display;
  }

  /* ---------------- DOM rendering ---------------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function answerStyleFor(key) {
    var style = els.answerStyle.value;
    if (style !== 'auto') return style;
    return HAN.test(key) ? 'tian' : 'line';
  }

  function renderSheet(opts) {
    var theme = THEMES[state.theme];
    var paper = PAPER[state.paper];
    var sheet = el('article', 'sm-sheet sm-theme-' + state.theme + (opts.answers ? ' sm-show-answers' : ''));
    sheet.style.width = paper.w + 'mm';
    // A hair under the page height so rounding never spills onto a blank page.
    sheet.style.height = (paper.h - 0.6) + 'mm';
    sheet.style.setProperty('--sm-cell', opts.cell + 'mm');

    theme.deco.forEach(function (d, i) {
      sheet.appendChild(el('span', 'sm-deco sm-deco--' + i, d)).setAttribute('aria-hidden', 'true');
    });

    var inner = el('div', 'sm-sheet-inner');
    sheet.appendChild(inner);

    var head = el('header', 'sm-sheet-head');
    var titleWrap = el('div', 'sm-sheet-title');
    titleWrap.appendChild(el('span', 'sm-sheet-badge', theme.badge));
    var titleText = el('div');
    titleText.appendChild(el('p', 'sm-sheet-kicker', theme.label + ' · ' + theme.en + (opts.answers ? ' · 答案 ANSWER KEY' : '')));
    titleText.appendChild(el('h3', null, els.title.value.trim() || '来自老师的秘密信息'));
    titleWrap.appendChild(titleText);
    head.appendChild(titleWrap);

    var meta = el('div', 'sm-student-meta');
    [['姓名 Name', ''], ['日期 Date', 'sm-blank--date']].forEach(function (f) {
      var field = el('span', 'sm-meta-field');
      field.appendChild(el('b', null, f[0]));
      field.appendChild(el('span', 'sm-blank ' + f[1]));
      meta.appendChild(field);
    });
    head.appendChild(meta);
    inner.appendChild(head);

    inner.appendChild(el('p', 'sm-directions', '看图案，在密码对照表里找到它，把对应的字或字母写在下面。 Find each picture in the code key and write its letter or 字 below.'));

    // Code key
    var keySection = el('section', 'sm-key');
    keySection.appendChild(el('h4', 'sm-section-title', '🔑 密码对照表 · Code Key'));
    var cols = opts.key.length <= 13 ? Math.max(opts.key.length, 6) : (opts.key.length <= 26 ? 13 : 10);
    var grid = el('div', 'sm-key-grid');
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    opts.key.forEach(function (e) {
      var cell = el('div', 'sm-key-cell');
      cell.appendChild(el('span', 'sm-key-emoji', e.emoji));
      cell.appendChild(el('span', 'sm-key-char' + (HAN.test(e.key) ? ' is-han' : ''), e.key));
      grid.appendChild(cell);
    });
    keySection.appendChild(grid);
    inner.appendChild(keySection);

    // Puzzle
    var puzzle = el('section', 'sm-puzzle');
    puzzle.appendChild(el('h4', 'sm-section-title', '✉️ 秘密信息 · Secret Message'));
    var flow = el('div', 'sm-flow');
    var emojiFor = Object.create(null);
    opts.key.forEach(function (e) { emojiFor[e.key] = e.emoji; });

    if (!opts.parsed.count) {
      flow.appendChild(el('p', 'sm-placeholder', '在左边输入一句话，这里会出现图形密码。 Type a message on the left to build the puzzle.'));
    }
    opts.parsed.groups.forEach(function (g) {
      if (g.br) { flow.appendChild(el('span', 'sm-break')); return; }
      var group = el('span', 'sm-group');
      g.items.forEach(function (it) {
        if (it.punct) { group.appendChild(el('span', 'sm-punct', it.punct)); return; }
        var cell = el('span', 'sm-cell');
        cell.appendChild(el('span', 'sm-cell-emoji', emojiFor[it.key]));
        var answer = el('span', 'sm-answer sm-answer--' + answerStyleFor(it.key));
        answer.appendChild(el('span', 'sm-answer-text', HAN.test(it.ch) ? it.ch : it.key));
        cell.appendChild(answer);
        group.appendChild(cell);
      });
      flow.appendChild(group);
    });
    puzzle.appendChild(flow);
    inner.appendChild(puzzle);

    var foot = el('footer', 'sm-sheet-footer');
    foot.appendChild(el('span', null, '陈老师的教学工具箱'));
    foot.appendChild(el('span', null, 'Secret Message · 图形密码'));
    inner.appendChild(foot);

    return sheet;
  }

  function overflows(sheet) {
    var inner = sheet.querySelector('.sm-sheet-inner');
    return inner.scrollHeight > inner.clientHeight + 1;
  }

  function render() {
    var text = els.message.value;
    var limit = parseInt(els.limit.value, 10);
    var parsed = parseMessage(text);
    var over = parsed.count > limit;

    els.counter.textContent = parsed.count + '/' + limit;
    els.counter.classList.toggle('is-over', over);

    var key = buildKey(parsed, els.decoys.value, els.fullAlphabet.checked);
    // Still preview an over-long message so the teacher sees it, but block printing.
    els.status.classList.toggle('is-error', over);
    els.print.disabled = over || parsed.count === 0;
    if (over) {
      els.status.textContent = '⚠️ 字数超出上限：请删掉 ' + (parsed.count - limit) + ' 个字 / Too long — remove ' + (parsed.count - limit) + ' character(s) to fit one page.';
    } else {
      els.status.textContent = parsed.count
        ? parsed.count + ' 个字 · ' + key.length + ' 个图标 in the code key. 点击「生成 / 重新打乱」换一套图标。'
        : '输入一句话开始。Type a message to start.';
    }

    // Very short messages cap the cell size; otherwise start large and shrink until it fits.
    var start = parsed.count <= 8 ? 0 : 1;
    var sheets = [];
    var pages = [{ answers: els.showAnswers.checked }];
    if (els.printKey.checked && parsed.count) pages.push({ answers: true });

    els.sheets.innerHTML = '';
    pages.forEach(function (p) {
      var sheet;
      for (var i = start; i < CELL_SIZES.length; i++) {
        if (sheet) sheet.remove();
        sheet = renderSheet({ parsed: parsed, key: key, answers: p.answers, cell: CELL_SIZES[i] });
        els.sheets.appendChild(sheet);
        if (!overflows(sheet)) break;
      }
      sheets.push(sheet);
    });

    $('sm-page-size').textContent = '@media print { @page { size: ' + PAPER[state.paper].page + '; margin: 0; } }';
    fitPreview();
  }

  function fitPreview() {
    var first = els.sheets.firstElementChild;
    if (!first) return;
    var scale = Math.min(1, els.stage.clientWidth / first.offsetWidth);
    els.sheets.style.transform = 'scale(' + scale + ')';
    els.stage.style.height = Math.ceil(els.sheets.offsetHeight * scale) + 'px';
  }

  var renderTimer;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  }

  function setActive(group, attr, value) {
    group.querySelectorAll('[' + attr + ']').forEach(function (b) {
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('is-active', on);
      if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function buildThemePicker() {
    Object.keys(THEMES).forEach(function (id) {
      var t = THEMES[id];
      var btn = el('button', 'sm-theme-card sm-theme-' + id);
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('data-theme', id);
      btn.appendChild(el('span', 'sm-theme-icons', t.icons.slice(0, 4).join('')));
      btn.appendChild(el('span', 'sm-theme-name', t.label));
      btn.appendChild(el('span', 'sm-theme-en', t.en));
      btn.addEventListener('click', function () {
        state.theme = id;
        setActive(els.themePicker, 'data-theme', id);
        render();
      });
      els.themePicker.appendChild(btn);
    });
    setActive(els.themePicker, 'data-theme', state.theme);
  }

  function init() {
    els.message = $('sm-message');
    els.counter = $('sm-counter');
    els.limit = $('sm-limit');
    els.title = $('sm-title');
    els.themePicker = $('sm-theme-picker');
    els.answerStyle = $('sm-answer-style');
    els.fullAlphabet = $('sm-full-alphabet');
    els.decoys = $('sm-decoys');
    els.showAnswers = $('sm-show-answers');
    els.printKey = $('sm-print-key');
    els.print = $('sm-print');
    els.status = $('sm-status');
    els.stage = $('sm-stage');
    els.sheets = $('sm-sheets');

    buildThemePicker();

    [els.message, els.title, els.decoys].forEach(function (input) { input.addEventListener('input', scheduleRender); });
    [els.limit, els.answerStyle, els.fullAlphabet, els.showAnswers, els.printKey].forEach(function (input) { input.addEventListener('change', render); });

    document.querySelectorAll('[data-match]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.match = b.getAttribute('data-match');
        setActive(b.parentNode, 'data-match', state.match);
        render();
      });
    });
    document.querySelectorAll('[data-paper]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.paper = b.getAttribute('data-paper');
        setActive(b.parentNode, 'data-paper', state.paper);
        render();
      });
    });

    $('sm-generate').addEventListener('click', function () {
      state.seed = newSeed();
      render();
    });
    els.print.addEventListener('click', function () { window.print(); });

    if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(els.stage);
    else window.addEventListener('resize', fitPreview);

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
