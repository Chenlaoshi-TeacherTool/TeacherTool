(function () {
  'use strict';

  var MAX_CARDS = 30;
  var MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  var STORAGE_KEY = 'chenlaoshi-wyr-deck-v2';
  var CW = window.ChenWordlist || null;
  var CE = window.ChenEmoji || null;
  var ZH_UI = /^zh/i.test(document.documentElement.lang || '');
  var FONT = 'Arial, "Noto Sans SC", "Microsoft YaHei", sans-serif';
  var PY_FONT = 'Andika, "Century Gothic", "Segoe UI", Arial, sans-serif';
  var CJK_RE = /[㐀-鿿豈-﫿]/;
  var TOKEN_RE = /[㐀-鿿豈-﫿]|\s+|[^\s㐀-鿿豈-﫿]+/g;
  var NO_LINE_START = /^[，。？！、：；,.?!:;)\]）》」』…]/;
  var ZH_DEFAULT_TEMPLATE = '你喜欢{A}还是{B}？';
  var CREDIT = (CE && CE.CREDIT) || 'Emoji artwork by OpenMoji · CC BY-SA 4.0 · openmoji.org';
  // Words that rarely name a picture; tried last when matching a phrase word by word.
  var WEAK_WORDS = { use: 1, make: 1, do: 1, have: 1, get: 1, go: 1, be: 1, try: 1, more: 1, very: 1, your: 1, my: 1, it: 1, this: 1, that: 1, one: 1, only: 1, would: 1, rather: 1, choose: 1, explain: 1, start: 1, show: 1, answer: 1, someone: 1, something: 1 };

  // Classroom words (stemmed, as ChenEmoji.normalizeSearch returns them) → an OpenMoji annotation that pictures them.
  var CLASSROOM_PICTURES = {
    read: 'books', writ: 'writing hand', write: 'writing hand', speak: 'speaking head', say: 'speaking head', talk: 'speaking head', aloud: 'speaking head',
    listen: 'ear', draw: 'artist palette', diagram: 'bar chart', chart: 'bar chart', graph: 'bar chart', table: 'clipboard',
    partner: 'handshake', together: 'handshake', team: 'handshake', group: 'handshake', alone: 'bust in silhouette',
    example: 'light bulb', idea: 'light bulb', rule: 'straight ruler', biography: 'open book', fiction: 'open book', story: 'open book', novel: 'open book',
    history: 'classical building', historical: 'classical building', math: 'abacus', science: 'microscope', homework: 'memo', quiz: 'memo', test: 'memo',
    question: 'red question mark', computer: 'laptop', phone: 'mobile phone', video: 'movie camera', game: 'video game', music: 'musical note'
  };

  var L = ZH_UI ? {
    sample: '示例：',
    cardsReady: function (n) { return '已生成 ' + n + ' 张卡片，可以逐张修改。'; },
    needTwo: '每行需要两个选项，例如：图表 / 表格。',
    skipped: function (n) { return '有 ' + n + ' 行只有一个选项，已跳过。'; },
    overMax: '一套最多 ' + MAX_CARDS + ' 张，超出的行没有用上。',
    extra: '有的行超过两个选项，只用了前两个。',
    added: function (n) { return '已向卡组添加 ' + n + ' 张卡片。'; },
    deckFull: '一套最多 ' + MAX_CARDS + ' 张卡片。',
    blankAdded: '已添加一张新卡片。',
    cleared: '卡组已清空。',
    removed: '已删除这张卡片。',
    shuffled: '卡片顺序已打乱。',
    templateApplied: function (n) { return '全部 ' + n + ' 张卡片都改用了这个问题模板。'; },
    templateReady: '模板已设好，之后生成的卡片都会用它。',
    pairsMade: function (n, m) { return '已从 ' + m + ' 个主题配出 ' + n + ' 组二选一。'; },
    needWords: '所选主题加起来至少需要两个词。',
    zhTemplate: '选项是中文，问题已自动换成中文模板。',
    slides: function (n) { return n + ' 张幻灯片'; },
    emptyList: '生成的卡片会显示在这里。',
    emptyPreview: '先添加至少一组选项，再生成卡组。',
    restored: '已恢复你上次的卡组。',
    pick: '选图',
    loadingPic: '…',
    changePic: '换图或上传照片',
    noMatch: '没有找到匹配的图片，换个中文或英文词试试。',
    loadingEmoji: '正在加载 OpenMoji 图片…',
    emojiOffline: 'OpenMoji 图片暂时加载不了，卡片先不配图。请检查网络后刷新。',
    imageType: '请选择图片文件。',
    imageSize: '请选择小于 3 MB 的图片。',
    imageAdded: '照片已加到这张卡片上。',
    needCardsPresent: '先添加一组选项再开始展示。',
    needCardsPrint: '先添加一组选项再打印。',
    needCardsExport: '先添加一组选项再导出。',
    preparing: function (n, f) { return '正在把 ' + n + ' 张幻灯片导出为 ' + f + '…'; },
    exportReady: function (f) { return f + ' 已生成，可以保存了。'; },
    exportFailed: '导出失败，请刷新页面后再试。',
    exportMissing: '导出工具还没加载好，请刷新后再试。',
    votesCleared: '票数已清零。',
    questionLabel: function (n) { return '第 ' + n + ' 张卡片的问题'; },
    choiceLabel: function (k) { return k === 'a' ? '选项 A' : '选项 B'; },
    wordPlaceholder: '词语或短语',
    pinyin: '拼音',
    english: '英文',
    moveUp: '上移',
    moveDown: '下移',
    remove: '删除这张卡片',
    vote: function (k) { return '投给 ' + k; },
    brand: '陈老师教学工具包'
  } : {
    sample: 'Sample: ',
    cardsReady: function (n) { return n + (n === 1 ? ' card is' : ' cards are') + ' ready to edit.'; },
    needTwo: 'Each line needs two choices, such as diagram / table.',
    skipped: function (n) { return n + (n === 1 ? ' line had' : ' lines had') + ' only one choice and ' + (n === 1 ? 'was' : 'were') + ' skipped.'; },
    overMax: 'A deck holds up to ' + MAX_CARDS + ' cards, so the extra lines were left out.',
    extra: 'Some lines had more than two choices; the first two were used.',
    added: function (n) { return n + (n === 1 ? ' card was' : ' cards were') + ' added to your deck.'; },
    deckFull: 'A deck can have up to ' + MAX_CARDS + ' cards.',
    blankAdded: 'A new card was added.',
    cleared: 'Your deck is clear.',
    removed: 'Card removed.',
    shuffled: 'Your card order has been shuffled.',
    templateApplied: function (n) { return 'All ' + n + ' cards now use this question template.'; },
    templateReady: 'Your template is ready for the next cards you make.',
    pairsMade: function (n, m) { return n + ' pairs were made from ' + m + ' topic' + (m === 1 ? '' : 's') + '.'; },
    needWords: 'Choose topics with at least two words combined to make pairs.',
    zhTemplate: 'The choices are in Chinese, so the question now uses a Chinese template.',
    slides: function (n) { return n + (n === 1 ? ' slide' : ' slides'); },
    emptyList: 'Your generated cards will appear here.',
    emptyPreview: 'Add at least one pair, then generate your deck.',
    restored: 'Your last deck was restored.',
    pick: 'Pick',
    loadingPic: '…',
    changePic: 'Change picture or upload a photo',
    noMatch: 'No matching picture. Try a different Chinese or English word.',
    loadingEmoji: 'Loading OpenMoji pictures…',
    emojiOffline: 'OpenMoji pictures could not load, so cards have no pictures for now. Check your connection and refresh.',
    imageType: 'Please choose an image file.',
    imageSize: 'Please choose an image smaller than 3 MB.',
    imageAdded: 'Your photo was added to this card.',
    needCardsPresent: 'Add a pair before starting the presentation.',
    needCardsPrint: 'Add a pair before printing.',
    needCardsExport: 'Add a pair before exporting.',
    preparing: function (n, f) { return 'Preparing ' + n + ' slide' + (n === 1 ? '' : 's') + ' for ' + f + '…'; },
    exportReady: function (f) { return 'Your ' + f + ' is ready to save.'; },
    exportFailed: 'The export could not be created. Please refresh this page and try again.',
    exportMissing: 'The export helper is not available yet. Refresh and try again.',
    votesCleared: 'Votes cleared.',
    questionLabel: function (n) { return 'Question for card ' + n; },
    choiceLabel: function (k) { return k === 'a' ? 'Choice A' : 'Choice B'; },
    wordPlaceholder: 'word or short phrase',
    pinyin: 'Pinyin',
    english: 'English',
    moveUp: 'Move card earlier',
    moveDown: 'Move card later',
    remove: 'Remove card',
    vote: function (k) { return 'Vote for choice ' + k; },
    brand: 'CHEN LAOSHI’S TEACHING TOOLKIT'
  };

  var $ = function (selector) { return document.querySelector(selector); };
  var els = {
    pairs: $('#pairInput'),
    template: $('#questionTemplate'),
    templateSample: $('#templateSample'),
    status: $('#statusMessage'),
    preview: $('#slidePreview'),
    cardList: $('#cardList'),
    cardCount: $('#cardCount'),
    libraryPicker: $('#wyrLibraryPicker'),
    presentation: $('#presentation'),
    presentationSlide: $('#presentationSlide'),
    presentationCount: $('#presentationCount'),
    printArea: $('#printArea'),
    picker: $('#artPicker'),
    iconSearch: $('#iconSearch'),
    iconGrid: $('#iconGrid'),
    imageUpload: $('#imageUpload')
  };
  var state = {
    cards: [],
    selected: 0,
    presentationIndex: 0,
    picker: null,
    lastFocused: null,
    index: null,
    indexFailed: false,
    refs: []
  };
  var emojiData = Object.create(null);
  var examples = [
    'explain with a diagram / explain with a table',
    'read a biography / read historical fiction',
    'work alone / work with a partner',
    'write your answer / say your answer aloud',
    'start with an example / start with a rule'
  ];

  // ---------- small helpers ----------
  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function hasCjk(value) {
    return CJK_RE.test(String(value || ''));
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function setStatus(message, kind) {
    els.status.textContent = message;
    els.status.dataset.kind = kind || 'success';
  }

  function shuffle(items) {
    if (CW && CW.shuffle) return CW.shuffle(items);
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }

  function autoPinyin(text) {
    return hasCjk(text) && CW && CW.toPinyin ? clean(CW.toPinyin(text, { spaced: true })) : '';
  }

  function autoEnglish(text) {
    return hasCjk(text) && CW && CW.toEnglish ? clean(CW.toEnglish(text)) : '';
  }

  // ---------- data model ----------
  // side.artMode: 'auto' (OpenMoji picks), 'manual' (teacher picked an emoji or photo), 'none' (no picture)
  function createSide(text, extra) {
    extra = extra || {};
    var value = clean(text);
    var pinyin = clean(extra.pinyin);
    var english = clean(extra.english);
    return {
      text: value,
      pinyin: pinyin || autoPinyin(value),
      english: english || autoEnglish(value),
      pinyinManual: !!pinyin,
      englishManual: !!english,
      emojiHint: clean(extra.emoji),
      emoji: null,
      image: '',
      artMode: 'auto',
      matched: false
    };
  }

  function createCard(a, b) {
    return { question: '', a: a, b: b, votes: { A: 0, B: 0 } };
  }

  function splitPair(line) {
    var text = clean(line);
    var pieces;
    if (/[\/／|｜]/.test(text)) pieces = text.split(/\s*[\/／|｜]\s*/);
    else if (/\s+or\s+/i.test(text)) pieces = text.split(/\s+or\s+/i);
    else if (/还是|或者/.test(text)) pieces = text.split(/\s*(?:还是|或者)\s*/);
    else pieces = text.split(/\s*[,，、]\s*/);
    pieces = pieces.map(clean).filter(Boolean);
    if (pieces.length < 2) return null;
    return { card: createCard(createSide(pieces[0]), createSide(pieces[1])), extra: pieces.length > 2 };
  }

  function getCardsFromText(text, room) {
    var result = { cards: [], skipped: 0, extra: false, overflow: false };
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!clean(line)) return;
      var parsed = splitPair(line);
      if (!parsed) { result.skipped++; return; }
      if (result.cards.length >= room) { result.overflow = true; return; }
      result.cards.push(parsed.card);
      if (parsed.extra) result.extra = true;
    });
    return result;
  }

  // ---------- question template ----------
  function templateQuestion(a, b) {
    var question = clean(els.template.value) || 'Would you rather {A} or {B}?';
    if (question.indexOf('{A}') === -1 && question.indexOf('{B}') === -1) {
      question += hasCjk(question) ? '{A}还是{B}？' : ' {A} or {B}?';
    }
    return question.replace(/\{A\}/g, a || '＿＿').replace(/\{B\}/g, b || '＿＿');
  }

  function questionFor(card) {
    return clean(card.question) || templateQuestion(card.a.text, card.b.text);
  }

  function updateTemplateSample() {
    els.templateSample.textContent = L.sample + (hasCjk(els.template.value)
      ? templateQuestion('用图表讲解', '用表格讲解')
      : templateQuestion('explain with a diagram', 'explain with a table'));
  }

  function syncTemplateButtons() {
    document.querySelectorAll('.wyr-template').forEach(function (button) {
      button.classList.toggle('active', button.dataset.template === els.template.value);
    });
  }

  function onTemplateChanged() {
    updateTemplateSample();
    syncTemplateButtons();
    updateQuestionInputs();
    renderPreview();
    saveSoon();
  }

  function applyTemplateToAll() {
    state.cards.forEach(function (card) { card.question = ''; });
    updateQuestionInputs();
    renderPreview();
    saveSoon();
    setStatus(state.cards.length ? L.templateApplied(state.cards.length) : L.templateReady);
  }

  function isBuiltInEnglishTemplate(value) {
    if (hasCjk(value)) return false;
    var found = false;
    document.querySelectorAll('.wyr-template').forEach(function (button) { if (button.dataset.template === value) found = true; });
    return found;
  }

  // When every choice is Chinese and the teacher hasn't written their own template, ask in Chinese.
  function maybeUseChineseTemplate(cards) {
    if (!cards.length || !isBuiltInEnglishTemplate(clean(els.template.value))) return false;
    var allZh = cards.every(function (card) { return hasCjk(card.a.text) && hasCjk(card.b.text); });
    if (!allZh) return false;
    els.template.value = ZH_DEFAULT_TEMPLATE;
    updateTemplateSample();
    syncTemplateButtons();
    return true;
  }

  // ---------- text measuring and fitting ----------
  var measureCtx = document.createElement('canvas').getContext('2d');

  function textWidth(text, size, weight, family) {
    measureCtx.font = (weight || 400) + ' ' + size + 'px ' + (family || FONT);
    return measureCtx.measureText(text).width;
  }

  function wrapLines(text, size, weight, family, maxWidth) {
    var tokens = clean(text).match(TOKEN_RE) || [];
    var lines = [];
    var current = '';
    var space = false;
    tokens.forEach(function (token) {
      if (/^\s+$/.test(token)) { space = true; return; }
      var candidate = current ? current + (space ? ' ' : '') + token : token;
      if (current && !NO_LINE_START.test(token) && textWidth(candidate, size, weight, family) > maxWidth) {
        lines.push(current);
        current = token;
      } else current = candidate;
      space = false;
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function breakLongLine(line, size, o) {
    if (textWidth(line, size, o.weight, o.family) <= o.maxWidth) return [line];
    var out = [];
    var current = '';
    Array.from(line).forEach(function (ch) {
      if (current && textWidth(current + ch, size, o.weight, o.family) > o.maxWidth) { out.push(current.trim()); current = ch; }
      else current += ch;
    });
    if (current.trim()) out.push(current.trim());
    return out;
  }

  function ellipsize(line, size, o) {
    var text = line;
    while (text && textWidth(text + '…', size, o.weight, o.family) > o.maxWidth) text = text.slice(0, -1);
    return text.replace(/\s+$/, '') + '…';
  }

  // Largest font size (stepping down by 2) at which the text fits in maxLines lines of maxWidth.
  function fitText(text, o) {
    var lines;
    for (var size = o.max; size >= o.min; size -= 2) {
      lines = wrapLines(text, size, o.weight, o.family, o.maxWidth);
      var fits = lines.length <= o.maxLines && lines.every(function (line) {
        return textWidth(line, size, o.weight, o.family) <= o.maxWidth;
      });
      if (fits) return { size: size, lines: lines };
    }
    var min = o.min;
    lines = [];
    wrapLines(text, min, o.weight, o.family, o.maxWidth).forEach(function (line) {
      lines = lines.concat(breakLongLine(line, min, o));
    });
    if (lines.length > o.maxLines) {
      lines = lines.slice(0, o.maxLines);
      lines[o.maxLines - 1] = ellipsize(lines[o.maxLines - 1], min, o);
    }
    return { size: min, lines: lines };
  }

  function textLines(fit, x, top, lineHeight, attrs) {
    var baseline = top + lineHeight / 2 + fit.size * 0.36;
    return '<text x="' + x + '" y="' + baseline.toFixed(1) + '" font-size="' + fit.size + '" ' + attrs + '>' +
      fit.lines.map(function (line, n) {
        return '<tspan x="' + x + '" dy="' + (n ? lineHeight.toFixed(1) : 0) + '">' + escapeXml(line) + '</tspan>';
      }).join('') + '</text>';
  }

  // ---------- OpenMoji ----------
  function pickEntry(entry) {
    return entry ? { emoji: entry.emoji, hexcode: entry.hexcode, annotation: entry.annotation } : null;
  }

  function memoryItem(side) {
    return hasCjk(side.text) ? { zh: side.text } : { en: side.text };
  }

  function findEmoji(side) {
    var index = state.index;
    if (!CE || !index || !side.text) return null;
    var zh = hasCjk(side.text);
    var item = zh ? { zh: side.text, en: side.english, emoji: side.emojiHint } : { en: side.text, emoji: side.emojiHint };
    var hit = CE.match(item, index, { translate: true });
    if (hit) return pickEntry(hit);
    // A phrase rarely matches as a whole, so try its words: nouns usually come last.
    var source = zh ? side.english : side.text;
    var words = CE.normalizeSearch(String(source || '').split(/[;,]/)[0]).split(' ').filter(Boolean);
    var strong = words.filter(function (w) { return !WEAK_WORDS[w] && w.length > 2; }).reverse();
    for (var i = 0; i < strong.length; i++) {
      var word = strong[i];
      var mapped = CLASSROOM_PICTURES[word] && index.byAnnotation[CE.normalizeSearch(CLASSROOM_PICTURES[word])];
      if (mapped) return pickEntry(mapped);
      var wordHit = CE.match({ en: word }, index, {});
      // Only trust a single-word hit when the word is in the emoji's own name (tags give odd matches: table → ping pong).
      if (wordHit && CE.normalizeSearch(wordHit.annotation).split(' ').indexOf(word) !== -1) return pickEntry(wordHit);
    }
    return null;
  }

  function utf8ToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  // Slides use data URLs so the pictures survive the SVG → JPEG export.
  function ensureEmojiData(hexcodes) {
    if (!CE) return Promise.resolve();
    return Promise.all(hexcodes.filter(Boolean).map(function (hex) {
      if (emojiData[hex]) return emojiData[hex];
      emojiData[hex] = fetch(CE.svgUrl(hex), { mode: 'cors', credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) throw new Error('OpenMoji ' + response.status);
          return response.text();
        })
        .then(function (svg) {
          var url = 'data:image/svg+xml;base64,' + utf8ToBase64(svg);
          emojiData[hex] = url;
          return url;
        })
        .catch(function () { delete emojiData[hex]; return null; });
      return emojiData[hex];
    }));
  }

  function deckHexcodes(cards) {
    var list = [];
    (cards || state.cards).forEach(function (card) {
      ['a', 'b'].forEach(function (key) {
        var side = card[key];
        if (!side.image && side.artMode !== 'none' && side.emoji && side.emoji.hexcode) list.push(side.emoji.hexcode);
      });
    });
    return list;
  }

  function artHref(side) {
    if (side.image) return side.image;
    if (side.artMode === 'none' || !side.emoji || !side.emoji.hexcode || !CE) return '';
    var cached = emojiData[side.emoji.hexcode];
    return typeof cached === 'string' ? cached : CE.svgUrl(side.emoji.hexcode);
  }

  function matchCards(cards) {
    if (!state.index) return false;
    var changed = false;
    cards.forEach(function (card) {
      ['a', 'b'].forEach(function (key) {
        var side = card[key];
        if (side.artMode !== 'auto' || side.image || side.matched) return;
        side.emoji = findEmoji(side);
        side.matched = true;
        changed = true;
      });
    });
    if (changed) ensureEmojiData(deckHexcodes(cards));
    return changed;
  }

  function loadEmojiIndex() {
    if (!CE) { state.indexFailed = true; return Promise.resolve(null); }
    return CE.load().then(function (index) {
      state.index = index;
      state.indexFailed = false;
      if (matchCards(state.cards)) { renderCards(); renderPreview(); saveSoon(); }
      return index;
    }).catch(function () {
      state.indexFailed = true;
      setStatus(L.emojiOffline, 'warning');
      renderCards();
      return null;
    });
  }

  // ---------- slide drawing ----------
  function sunflower(cx, cy, radius) {
    var petals = '';
    for (var i = 0; i < 10; i++) {
      petals += '<ellipse cx="' + cx + '" cy="' + (cy - radius * .67) + '" rx="' + (radius * .23) + '" ry="' + (radius * .55) + '" fill="#f8c63f" transform="rotate(' + (i * 36) + ' ' + cx + ' ' + cy + ')"/>';
    }
    return '<g>' + petals + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * .38) + '" fill="#794316"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * .18) + '" fill="#f2b62b"/></g>';
  }

  var clipSeq = 0;
  function sideArt(side, cx, cy, size, accent) {
    var href = artHref(side);
    if (!href) return '';
    var half = size / 2;
    if (side.image) {
      var id = 'wyr-clip-' + (++clipSeq);
      return '<defs><clipPath id="' + id + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + half + '"/></clipPath></defs>' +
        '<image href="' + escapeXml(href) + '" x="' + (cx - half) + '" y="' + (cy - half) + '" width="' + size + '" height="' + size + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (half + 2) + '" fill="none" stroke="' + accent + '" stroke-width="6"/>';
    }
    return '<image href="' + escapeXml(href) + '" x="' + (cx - half) + '" y="' + (cy - half) + '" width="' + size + '" height="' + size + '" preserveAspectRatio="xMidYMid meet"/>';
  }

  // Shrinks the choice text (and its pinyin/English) until the whole block fits the space left in the panel.
  function layoutChoice(choice, regionHeight, withArt) {
    var showPy = choice.pinyin && choice.pinyin !== choice.text;
    var showEn = choice.english && choice.english.toLowerCase() !== choice.text.toLowerCase();
    var maxSize = withArt ? 76 : 104;
    var block;
    for (var guard = 0; guard < 30; guard++) {
      var main = fitText(choice.text, { maxWidth: 560, maxLines: withArt ? 2 : 3, max: maxSize, min: 28, weight: 800 });
      var detailSize = Math.max(20, Math.min(34, Math.round(main.size * 0.46)));
      var py = showPy ? fitText(choice.pinyin, { maxWidth: 560, maxLines: withArt ? 1 : 2, max: detailSize, min: 18, weight: 400, family: PY_FONT }) : null;
      var en = showEn ? fitText(choice.english, { maxWidth: 560, maxLines: withArt ? 1 : 2, max: detailSize, min: 16, weight: 400 }) : null;
      var mainLh = main.size * 1.14;
      var pyLh = py ? py.size * 1.3 : 0;
      var enLh = en ? en.size * 1.3 : 0;
      var height = main.lines.length * mainLh + (py ? 8 + py.lines.length * pyLh : 0) + (en ? 4 + en.lines.length * enLh : 0);
      block = { main: main, py: py, en: en, mainLh: mainLh, pyLh: pyLh, enLh: enLh, height: height };
      if (height <= regionHeight || main.size <= 28) break;
      maxSize = main.size - 4;
    }
    return block;
  }

  function choicePanel(key, choice, card, opts) {
    var x = key === 'A' ? 90 : 860;
    var y = 300;
    var w = 650;
    var h = 440;
    var cx = x + w / 2;
    var fill = key === 'A' ? '#fff3cb' : '#dff0dc';
    var accent = key === 'A' ? '#e6aa2b' : '#4b9169';
    var withArt = !!artHref(choice);
    var regionTop = withArt ? y + 226 : y + 78;
    var regionBottom = y + 392;
    var block = layoutChoice(choice, regionBottom - regionTop, withArt);
    var top = regionTop + (regionBottom - regionTop - block.height) / 2;
    var out = '';
    var wrapOpen = opts.votes
      ? '<g data-vote="' + key + '" role="button" tabindex="0" aria-label="' + escapeXml(L.vote(key)) + '" style="cursor:pointer">'
      : '<g>';
    out += wrapOpen + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="42" fill="' + fill + '" stroke="' + accent + '" stroke-width="8"/>';
    out += '<circle cx="' + (x + 62) + '" cy="' + (y + 62) + '" r="34" fill="' + accent + '"/>';
    out += '<text x="' + (x + 62) + '" y="' + (y + 74) + '" text-anchor="middle" fill="#fffdf7" font-size="32" font-weight="800" font-family=\'' + FONT + '\'>' + key + '</text>';
    if (withArt) out += sideArt(choice, cx, y + 128, 176, accent);
    if (choice.text) {
      out += textLines(block.main, cx, top, block.mainLh, 'text-anchor="middle" fill="#164c43" font-weight="800" font-family=\'' + FONT + '\'');
      top += block.main.lines.length * block.mainLh;
    }
    if (block.py) {
      top += 8;
      out += textLines(block.py, cx, top, block.pyLh, 'text-anchor="middle" fill="#416359" font-family=\'' + PY_FONT + '\'');
      top += block.py.lines.length * block.pyLh;
    }
    if (block.en) {
      top += 4;
      out += textLines(block.en, cx, top, block.enLh, 'text-anchor="middle" fill="#56736a" font-style="italic" font-family=\'' + FONT + '\'');
    }
    if (opts.votes) {
      var count = card.votes && card.votes[key] ? card.votes[key] : 0;
      out += '<g transform="translate(' + (cx - 52) + ' ' + (y + 396) + ')"><rect width="104" height="34" rx="17" fill="#fffdf7" stroke="' + accent + '" stroke-width="2"/>' +
        '<text x="52" y="24" text-anchor="middle" fill="' + accent + '" font-size="20" font-weight="800" font-family=\'' + FONT + '\'>♥ ' + count + '</text></g>';
    }
    return out + '</g>';
  }

  function cardSvg(card, index, opts) {
    opts = opts || {};
    var question = questionFor(card);
    var zhSlide = hasCjk(question + card.a.text + card.b.text);
    var q = fitText(question, { maxWidth: 1380, maxLines: 2, max: 62, min: 30, weight: 800 });
    var qLh = q.size * 1.18;
    var qTop = 205 - q.lines.length * qLh / 2;
    var usesEmoji = [card.a, card.b].some(function (side) { return !side.image && artHref(side); });
    var frame = zhSlide ? '我选＿＿＿＿，因为＿＿＿＿＿＿。' : 'I choose ______ because ______.';
    var tips = zhSlide ? '选一边 · 说理由 · 听同学说' : 'Choose a side · Give a reason · Listen to a classmate';
    return '<svg class="wyr-card-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="' + escapeXml(question) + '">' +
      '<rect width="1600" height="900" fill="#fff9e9"/><circle cx="1440" cy="102" r="240" fill="#dff0dc" opacity=".85"/><circle cx="145" cy="810" r="210" fill="#fff0bd" opacity=".74"/><rect x="0" y="0" width="1600" height="20" fill="#f8c63f"/>' +
      sunflower(84, 74, 28) +
      '<text x="128" y="83" fill="#356e57" font-size="24" font-weight="800" letter-spacing="3" font-family=\'' + FONT + '\'>' + escapeXml(L.brand) + '</text>' +
      '<text x="1510" y="83" text-anchor="end" fill="#356e57" font-size="25" font-weight="800" font-family=\'' + FONT + '\'>' + (index + 1) + ' / ' + state.cards.length + '</text>' +
      textLines(q, 800, qTop, qLh, 'text-anchor="middle" fill="#164c43" font-weight="800" font-family=\'' + FONT + '\'') +
      choicePanel('A', card.a, card, opts) + choicePanel('B', card.b, card, opts) +
      '<text x="800" y="806" text-anchor="middle" fill="#547267" font-size="28" font-family=\'' + FONT + '\'>' + escapeXml(frame) + '</text>' +
      '<text x="800" y="848" text-anchor="middle" fill="#8b5f1a" font-size="21" font-weight="700" font-family=\'' + FONT + '\'>' + escapeXml(tips) + '</text>' +
      (usesEmoji ? '<text x="1580" y="886" text-anchor="end" fill="#8a9a90" font-size="13" font-family=\'' + FONT + '\'>' + escapeXml(CREDIT) + '</text>' : '') +
      '</svg>';
  }

  function renderPreview() {
    var card = state.cards[state.selected];
    els.preview.innerHTML = card ? cardSvg(card, state.selected) : '<p class="wyr-empty">' + escapeXml(L.emptyPreview) + '</p>';
  }

  // ---------- card editor ----------
  function fillThumb(button, side) {
    button.innerHTML = '';
    var href = artHref(side);
    button.className = 'wyr-thumbnail' + (href ? ' has-art' : '');
    if (href) {
      var image = document.createElement('img');
      image.src = href;
      image.className = side.image ? 'photo' : 'emoji';
      image.alt = side.image ? '' : (side.emoji && side.emoji.annotation) || '';
      button.appendChild(image);
    } else if (side.artMode === 'auto' && !side.matched && !state.indexFailed) {
      button.textContent = L.loadingPic;
    } else button.textContent = L.pick;
  }

  function field(value, label, onInput) {
    var input = document.createElement('input');
    input.value = value || '';
    input.setAttribute('aria-label', label);
    input.addEventListener('click', function (event) { event.stopPropagation(); });
    input.addEventListener('input', onInput);
    return input;
  }

  function miniButton(text, title, action, danger) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wyr-mini-button' + (danger ? ' danger' : '');
    button.textContent = text;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', function (event) { event.stopPropagation(); action(); });
    return button;
  }

  function selectCard(index) {
    state.selected = index;
    state.refs.forEach(function (ref, n) { if (ref) ref.row.classList.toggle('active', n === index); });
    renderPreview();
  }

  function updateQuestionInputs() {
    state.refs.forEach(function (ref, n) {
      var card = state.cards[n];
      if (ref && card && !card.question && document.activeElement !== ref.question) ref.question.value = questionFor(card);
    });
  }

  var rematchTimers = {};
  function scheduleRematch(card, key, thumb) {
    var side = card[key];
    if (side.artMode !== 'auto' || side.image) return;
    side.matched = false;
    var timerKey = key + state.cards.indexOf(card);
    clearTimeout(rematchTimers[timerKey]);
    rematchTimers[timerKey] = setTimeout(function () {
      if (!state.index) return;
      side.emoji = findEmoji(side);
      side.matched = true;
      var done = function () {
        fillThumb(thumb, side);
        if (state.cards[state.selected] === card) renderPreview();
        saveSoon();
      };
      if (side.emoji) ensureEmojiData([side.emoji.hexcode]).then(done); else done();
    }, 450);
  }

  function renderCards() {
    els.cardList.innerHTML = '';
    state.refs = [];
    els.cardCount.textContent = L.slides(state.cards.length);
    if (!state.cards.length) { els.cardList.innerHTML = '<p class="wyr-empty">' + escapeXml(L.emptyList) + '</p>'; return; }
    state.cards.forEach(function (card, index) {
      var ref = { sides: {} };
      var row = document.createElement('article');
      row.className = 'wyr-card-row' + (index === state.selected ? ' active' : '');
      row.tabIndex = 0;
      ref.row = row;
      row.addEventListener('click', function (event) {
        if (event.target.closest('input, button')) return;
        selectCard(index);
      });
      row.addEventListener('focusin', function () { if (state.selected !== index) selectCard(index); });
      row.addEventListener('keydown', function (event) {
        if (event.target !== row) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCard(index); }
      });

      var questionRow = document.createElement('div');
      questionRow.className = 'wyr-question-row';
      var number = document.createElement('span');
      number.className = 'wyr-row-num';
      number.textContent = index + 1;
      var questionInput = field(questionFor(card), L.questionLabel(index + 1), function () {
        var value = clean(questionInput.value);
        card.question = value && value !== templateQuestion(card.a.text, card.b.text) ? value : '';
        if (state.selected === index) renderPreview();
        saveSoon();
      });
      questionInput.addEventListener('blur', function () { if (!card.question) questionInput.value = questionFor(card); });
      questionInput.className = 'wyr-question-input';
      ref.question = questionInput;
      questionRow.append(number, questionInput,
        miniButton('↑', L.moveUp, function () { moveCard(index, -1); }),
        miniButton('↓', L.moveDown, function () { moveCard(index, 1); }),
        miniButton('×', L.remove, function () { removeCard(index); }, true));
      row.appendChild(questionRow);

      var choices = document.createElement('div');
      choices.className = 'wyr-choice-editor';
      ['a', 'b'].forEach(function (key) {
        var side = card[key];
        var box = document.createElement('div');
        box.className = 'wyr-choice-box ' + key;
        var tag = document.createElement('span');
        tag.className = 'wyr-choice-tag';
        tag.textContent = key.toUpperCase();
        var thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.title = L.changePic;
        thumb.setAttribute('aria-label', L.changePic + ' (' + key.toUpperCase() + ')');
        fillThumb(thumb, side);
        thumb.addEventListener('click', function (event) { event.stopPropagation(); openPicker(index, key, thumb); });
        var fields = document.createElement('div');
        fields.className = 'wyr-choice-fields';
        var pinyinInput, englishInput;
        var wordInput = field(side.text, L.choiceLabel(key), function () {
          side.text = clean(wordInput.value);
          if (!side.pinyinManual) { side.pinyin = autoPinyin(side.text); pinyinInput.value = side.pinyin; }
          if (!side.englishManual) { side.english = autoEnglish(side.text); englishInput.value = side.english; }
          side.emojiHint = '';
          if (!card.question) questionInput.value = questionFor(card);
          scheduleRematch(card, key, thumb);
          if (state.selected === index) renderPreview();
          saveSoon();
        });
        wordInput.placeholder = L.wordPlaceholder;
        pinyinInput = field(side.pinyin, L.pinyin, function () {
          side.pinyin = clean(pinyinInput.value);
          side.pinyinManual = !!side.pinyin;
          if (state.selected === index) renderPreview();
          saveSoon();
        });
        // A teacher's fix is remembered for this word in every tool (blank = forget it).
        pinyinInput.addEventListener('change', function () {
          if (CW && CW.rememberPinyin && hasCjk(side.text)) CW.rememberPinyin(side.text, side.pinyin);
          if (!side.pinyin) { side.pinyin = autoPinyin(side.text); pinyinInput.value = side.pinyin; if (state.selected === index) renderPreview(); }
        });
        pinyinInput.placeholder = L.pinyin;
        pinyinInput.className = 'wyr-py-input';
        englishInput = field(side.english, L.english, function () {
          side.english = clean(englishInput.value);
          side.englishManual = !!side.english;
          if (state.selected === index) renderPreview();
          saveSoon();
        });
        englishInput.placeholder = L.english;
        fields.append(wordInput, pinyinInput, englishInput);
        box.append(tag, thumb, fields);
        choices.appendChild(box);
        ref.sides[key] = { thumb: thumb, pinyin: pinyinInput, english: englishInput };
      });
      row.appendChild(choices);
      els.cardList.appendChild(row);
      state.refs[index] = ref;
    });
  }

  // CC-CEDICT (loaded in the background) knows far more words: redo automatic pinyin, English and pictures.
  function refreshFromDictionary() {
    var pending = [];
    state.cards.forEach(function (card, index) {
      ['a', 'b'].forEach(function (key) {
        var side = card[key];
        var ref = state.refs[index] && state.refs[index].sides[key];
        if (!side.pinyinManual) { side.pinyin = autoPinyin(side.text); if (ref && document.activeElement !== ref.pinyin) ref.pinyin.value = side.pinyin; }
        if (!side.englishManual) { side.english = autoEnglish(side.text); if (ref && document.activeElement !== ref.english) ref.english.value = side.english; }
        if (side.artMode === 'auto' && !side.image && !side.emoji) { side.matched = false; pending.push({ side: side, ref: ref }); }
      });
    });
    if (state.index && pending.length) {
      matchCards(state.cards);
      pending.forEach(function (item) { if (item.ref) fillThumb(item.ref.thumb, item.side); });
    }
    renderPreview();
    saveSoon();
  }

  function refreshAll() {
    renderCards();
    renderPreview();
    saveSoon();
  }

  function deckStatus(result, verb) {
    var parts = [verb];
    if (result.skipped) parts.push(L.skipped(result.skipped));
    if (result.extra) parts.push(L.extra);
    if (result.overflow) parts.push(L.overMax);
    return parts.join(' ');
  }

  function afterNewCards(cards, message) {
    var switched = maybeUseChineseTemplate(cards);
    matchCards(cards);
    refreshAll();
    setStatus(message + (switched ? ' ' + L.zhTemplate : ''), 'success');
  }

  function replaceDeck() {
    var result = getCardsFromText(els.pairs.value, MAX_CARDS);
    if (!result.cards.length) { setStatus(L.needTwo, 'warning'); return; }
    state.cards = result.cards;
    state.selected = 0;
    state.presentationIndex = 0;
    afterNewCards(result.cards, deckStatus(result, L.cardsReady(result.cards.length)));
  }

  function appendDeck() {
    var room = MAX_CARDS - state.cards.length;
    if (room <= 0) { setStatus(L.deckFull, 'warning'); return; }
    var result = getCardsFromText(els.pairs.value, room);
    if (!result.cards.length) { setStatus(L.needTwo, 'warning'); return; }
    state.selected = state.cards.length;
    state.cards = state.cards.concat(result.cards);
    afterNewCards(result.cards, deckStatus(result, L.added(result.cards.length)));
  }

  function addBlankCard() {
    if (state.cards.length >= MAX_CARDS) { setStatus(L.deckFull, 'warning'); return; }
    var zh = hasCjk(els.template.value);
    var card = createCard(createSide(zh ? '选项一' : 'Option A'), createSide(zh ? '选项二' : 'Option B'));
    card.a.artMode = 'none';
    card.b.artMode = 'none';
    state.cards.push(card);
    state.selected = state.cards.length - 1;
    refreshAll();
    setStatus(L.blankAdded);
    var ref = state.refs[state.selected];
    if (ref) { ref.row.scrollIntoView({ block: 'nearest' }); var first = ref.row.querySelector('.wyr-choice-fields input'); if (first) first.select(); }
  }

  function clearDeck() {
    state.cards = [];
    state.selected = 0;
    state.presentationIndex = 0;
    refreshAll();
    setStatus(L.cleared);
  }

  function moveCard(index, direction) {
    var target = index + direction;
    if (target < 0 || target >= state.cards.length) return;
    var card = state.cards[index];
    state.cards[index] = state.cards[target];
    state.cards[target] = card;
    state.selected = target;
    refreshAll();
  }

  function removeCard(index) {
    state.cards.splice(index, 1);
    state.selected = Math.max(0, Math.min(state.selected, state.cards.length - 1));
    refreshAll();
    setStatus(L.removed);
  }

  function sideFromItem(item) {
    return createSide(item.zh, { pinyin: item.py || item.pinyin, english: item.en, emoji: item.img || item.emoji });
  }

  // Two topics: one word from each side. Otherwise: random pairs from all chosen words.
  function makePairsFromLists(lists) {
    var pools = lists.map(function (list) {
      return shuffle((list.items || []).filter(function (item) { return item && clean(item.zh); }));
    });
    var pairs = [];
    if (pools.length === 2 && pools[0].length && pools[1].length) {
      for (var i = 0; i < Math.min(pools[0].length, pools[1].length) && pairs.length < MAX_CARDS; i++) {
        if (clean(pools[0][i].zh) !== clean(pools[1][i].zh)) pairs.push([pools[0][i], pools[1][i]]);
      }
    } else {
      var seen = Object.create(null);
      var items = shuffle([].concat.apply([], pools)).filter(function (item) {
        var key = clean(item.zh);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      for (var j = 0; j + 1 < items.length && pairs.length < MAX_CARDS; j += 2) pairs.push([items[j], items[j + 1]]);
    }
    if (!pairs.length) { setStatus(L.needWords, 'warning'); return; }
    state.cards = pairs.map(function (pair) { return createCard(sideFromItem(pair[0]), sideFromItem(pair[1])); });
    els.pairs.value = pairs.map(function (pair) { return clean(pair[0].zh) + ' / ' + clean(pair[1].zh); }).join('\n');
    state.selected = 0;
    state.presentationIndex = 0;
    afterNewCards(state.cards, L.pairsMade(pairs.length, lists.length));
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker || !els.libraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: els.libraryPicker,
      source: 'wordlists',
      min: 1,
      title: ZH_UI ? '从词库配对' : 'Make pairs from the library',
      hint: ZH_UI
        ? '选一个或多个词汇主题。选两个主题时，每张卡片各取一个词对比；否则随机两两配对。'
        : 'Choose one or more vocabulary topics. With two topics, each card pairs one word from each; otherwise words are paired at random.',
      importLabel: ZH_UI ? '用所选主题配对' : 'Make pairs from selected topics',
      onImport: function (lists) {
        makePairsFromLists(lists);
        picker.reset();
      }
    });
  }

  // ---------- picture picker ----------
  function pickerSide() {
    if (!state.picker) return null;
    var card = state.cards[state.picker.index];
    return card ? card[state.picker.key] : null;
  }

  function searchEmoji(query) {
    if (!state.index || !CE) return [];
    var results = CE.search(query, state.index, { limit: 60 });
    if (results.length >= 6) return results;
    // Phrases: add results for each word, longest words first.
    var source = hasCjk(query) && CW && CW.toEnglish ? CW.toEnglish(query) : query;
    var words = CE.normalizeSearch(String(source || '').split(/[;,]/)[0]).split(' ').filter(function (w) { return w.length > 2; });
    words.sort(function (a, b) { return b.length - a.length; });
    var seen = Object.create(null);
    results.forEach(function (entry) { seen[entry.hexcode] = true; });
    words.forEach(function (word) {
      CE.search(word, state.index, { limit: 24 }).forEach(function (entry) {
        if (!seen[entry.hexcode] && results.length < 60) { seen[entry.hexcode] = true; results.push(entry); }
      });
    });
    return results;
  }

  function drawEmojiResults(query) {
    els.iconGrid.innerHTML = '';
    if (!state.index) {
      els.iconGrid.innerHTML = '<p class="wyr-empty">' + escapeXml(state.indexFailed ? L.emojiOffline : L.loadingEmoji) + '</p>';
      if (!state.indexFailed) loadEmojiIndex().then(function () { if (state.picker) drawEmojiResults(els.iconSearch.value); });
      return;
    }
    var side = pickerSide();
    var current = side && side.artMode !== 'none' && !side.image && side.emoji ? side.emoji.hexcode : '';
    var results = clean(query) ? searchEmoji(clean(query)) : [];
    if (!results.length) {
      els.iconGrid.innerHTML = '<p class="wyr-empty">' + escapeXml(L.noMatch) + '</p>';
      return;
    }
    results.forEach(function (entry) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'wyr-icon-choice' + (entry.hexcode === current ? ' active' : '');
      button.title = entry.annotation;
      var img = document.createElement('img');
      img.src = CE.svgUrl(entry.hexcode);
      img.alt = '';
      img.loading = 'lazy';
      img.width = 44;
      img.height = 44;
      var label = document.createElement('span');
      label.textContent = entry.annotation;
      button.append(img, label);
      button.addEventListener('click', function () { chooseEmoji(entry); });
      els.iconGrid.appendChild(button);
    });
  }

  var searchTimer = null;
  function openPicker(index, key, trigger) {
    state.picker = { index: index, key: key, trigger: trigger };
    var side = pickerSide();
    els.iconSearch.value = side ? side.text : '';
    drawEmojiResults(els.iconSearch.value);
    els.picker.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () { els.iconSearch.focus(); els.iconSearch.select(); }, 20);
  }

  function closePicker() {
    els.picker.hidden = true;
    document.body.style.overflow = '';
    var trigger = state.picker && state.picker.trigger;
    state.picker = null;
    els.imageUpload.value = '';
    if (trigger && trigger.isConnected) trigger.focus();
  }

  function finishPick(side, message) {
    var index = state.picker.index;
    var key = state.picker.key;
    closePicker();
    var ref = state.refs[index];
    if (ref && ref.sides[key]) fillThumb(ref.sides[key].thumb, side);
    if (state.selected === index) renderPreview();
    saveSoon();
    if (message) setStatus(message);
  }

  function chooseEmoji(entry) {
    var side = pickerSide();
    if (!side) return;
    side.emoji = pickEntry(entry);
    side.image = '';
    side.artMode = 'manual';
    side.matched = true;
    if (CE && side.text) CE.remember(memoryItem(side), entry.emoji);
    ensureEmojiData([entry.hexcode]).then(function () { if (state.selected >= 0) renderPreview(); });
    finishPick(side);
  }

  function chooseNoPicture() {
    var side = pickerSide();
    if (!side) return;
    side.image = '';
    side.emoji = null;
    side.artMode = 'none';
    finishPick(side);
  }

  function chooseAutoPicture() {
    var side = pickerSide();
    if (!side) return;
    side.image = '';
    side.artMode = 'auto';
    side.emojiHint = '';
    side.emoji = findEmoji(side);
    side.matched = !!state.index;
    if (side.emoji) ensureEmojiData([side.emoji.hexcode]).then(renderPreview);
    finishPick(side);
  }

  function uploadImage(file) {
    if (!file || !state.picker) return;
    if (!/^image\//.test(file.type)) { setStatus(L.imageType, 'warning'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setStatus(L.imageSize, 'warning'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var side = pickerSide();
      if (!side) return;
      side.image = reader.result;
      side.artMode = 'manual';
      finishPick(side, L.imageAdded);
    };
    reader.readAsDataURL(file);
  }

  // ---------- presenting ----------
  function vote(key) {
    var card = state.cards[state.presentationIndex];
    if (!card) return;
    card.votes = card.votes || { A: 0, B: 0 };
    card.votes[key] = (card.votes[key] || 0) + 1;
    renderPresentation();
    saveSoon();
  }

  function renderPresentation() {
    var card = state.cards[state.presentationIndex];
    if (!card) return;
    els.presentationSlide.innerHTML = cardSvg(card, state.presentationIndex, { votes: true });
    els.presentationCount.textContent = (state.presentationIndex + 1) + ' / ' + state.cards.length;
    els.presentationSlide.querySelectorAll('[data-vote]').forEach(function (element) {
      var key = element.getAttribute('data-vote');
      element.addEventListener('click', function () { vote(key); });
      element.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); vote(key); }
      });
    });
  }

  function resetVotes() {
    var card = state.cards[state.presentationIndex];
    if (!card) return;
    card.votes = { A: 0, B: 0 };
    renderPresentation();
    saveSoon();
    setStatus(L.votesCleared);
  }

  function openPresentation() {
    if (!state.cards.length) { setStatus(L.needCardsPresent, 'warning'); return; }
    state.lastFocused = document.activeElement;
    state.presentationIndex = state.selected;
    els.presentation.hidden = false;
    document.body.style.overflow = 'hidden';
    renderPresentation();
    $('#closePresentation').focus();
  }

  function closePresentation() {
    els.presentation.hidden = true;
    document.body.style.overflow = '';
    selectCard(state.presentationIndex);
    if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus();
  }

  function movePresentation(direction) {
    if (!state.cards.length) return;
    state.presentationIndex = (state.presentationIndex + direction + state.cards.length) % state.cards.length;
    renderPresentation();
  }

  // ---------- print and export ----------
  var pinyinFontCss = { key: '', css: '' };
  function bufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  // Exported images can't see page web fonts, so pinyin's Andika is embedded (only the letters used).
  function loadPinyinFont() {
    var chars = Object.create(null);
    state.cards.forEach(function (card) {
      [card.a.pinyin, card.b.pinyin].forEach(function (text) { Array.from(String(text || '')).forEach(function (c) { chars[c] = 1; }); });
    });
    var text = Object.keys(chars).sort().join('').replace(/\s/g, '');
    if (!text) return Promise.resolve('');
    text += '…';
    if (pinyinFontCss.key === text) return Promise.resolve(pinyinFontCss.css);
    return fetch('https://fonts.googleapis.com/css2?family=Andika:wght@400&text=' + encodeURIComponent(text))
      .then(function (response) { return response.text(); })
      .then(function (css) {
        var match = css.match(/url\((https:[^)]+)\)/);
        if (!match) throw new Error('no font url');
        return fetch(match[1]).then(function (response) { return response.arrayBuffer(); });
      })
      .then(function (buffer) {
        pinyinFontCss = { key: text, css: "@font-face{font-family:'Andika';font-weight:400;src:url(data:font/woff2;base64," + bufferToBase64(buffer) + ')}' };
        return pinyinFontCss.css;
      })
      .catch(function () { return ''; });
  }

  function withFont(svg, css) {
    return css ? svg.replace(/(<svg[^>]*>)/, '$1<defs><style>' + css + '</style></defs>') : svg;
  }

  function preparePrint() {
    if (!state.cards.length) { setStatus(L.needCardsPrint, 'warning'); return; }
    var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('400 20px Andika').catch(function () {}) : Promise.resolve();
    Promise.all([ensureEmojiData(deckHexcodes()), fontsReady]).then(function () {
      els.printArea.innerHTML = state.cards.map(function (card, index) {
        return '<section class="print-slide">' + cardSvg(card, index) + '</section>';
      }).join('');
      window.setTimeout(function () { window.print(); }, 150);
    });
  }

  async function exportDeck(format) {
    if (!state.cards.length) { setStatus(L.needCardsExport, 'warning'); return; }
    if (!window.DeckExport) { setStatus(L.exportMissing, 'warning'); return; }
    var label = format.toUpperCase();
    setStatus(L.preparing(state.cards.length, label));
    try {
      var loaded = await Promise.all([ensureEmojiData(deckHexcodes()), loadPinyinFont()]);
      var fontCss = loaded[1];
      var images = await Promise.all(state.cards.map(function (card, index) {
        return window.DeckExport.svgToJpeg(withFont(cardSvg(card, index), fontCss), 1600, 900, 1.25);
      }));
      if (format === 'pdf') window.DeckExport.download('would-you-rather.pdf', window.DeckExport.buildPDF(images, { pageWidth: 792, pageHeight: 445.5 }), 'application/pdf');
      else window.DeckExport.download('would-you-rather.pptx', window.DeckExport.buildPPTX(images), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      setStatus(L.exportReady(label));
    } catch (error) {
      console.error(error);
      setStatus(L.exportFailed, 'warning');
    }
  }

  // ---------- saving ----------
  var saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function save() {
    var data = { v: 2, template: els.template.value, pairs: els.pairs.value, cards: state.cards };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Photos can fill the storage quota; keep everything else.
      try {
        data.cards = state.cards.map(function (card) {
          var copy = JSON.parse(JSON.stringify(card));
          ['a', 'b'].forEach(function (key) { if (copy[key].image) { copy[key].image = ''; copy[key].artMode = 'auto'; copy[key].matched = false; } });
          return copy;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (ignored) { /* storage unavailable */ }
    }
  }

  function restore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data || data.v !== 2 || !Array.isArray(data.cards) || !data.cards.length) return false;
      state.cards = data.cards.slice(0, MAX_CARDS).map(function (card) {
        var restored = createCard(Object.assign(createSide(''), card.a), Object.assign(createSide(''), card.b));
        restored.question = clean(card.question);
        restored.votes = card.votes && typeof card.votes === 'object' ? { A: +card.votes.A || 0, B: +card.votes.B || 0 } : { A: 0, B: 0 };
        return restored;
      });
      if (typeof data.template === 'string' && data.template) els.template.value = data.template;
      if (typeof data.pairs === 'string') els.pairs.value = data.pairs;
      return true;
    } catch (error) {
      return false;
    }
  }

  function handoffActive() {
    try { return !!(window.ChenWordlistHandoff && window.ChenWordlistHandoff.active()); } catch (error) { return false; }
  }

  // ---------- events ----------
  function bindEvents() {
    $('#generateDeck').addEventListener('click', replaceDeck);
    $('#appendDeck').addEventListener('click', appendDeck);
    $('#shuffleDeck').addEventListener('click', function () {
      if (state.cards.length < 2) return;
      state.cards = shuffle(state.cards);
      state.selected = 0;
      refreshAll();
      setStatus(L.shuffled);
    });
    $('#clearDeck').addEventListener('click', clearDeck);
    $('#addBlankCard').addEventListener('click', addBlankCard);
    $('#loadExample').addEventListener('click', function () { els.pairs.value = examples.join('\n'); replaceDeck(); });
    $('#applyTemplate').addEventListener('click', applyTemplateToAll);
    $('#presentDeck').addEventListener('click', openPresentation);
    $('#closePresentation').addEventListener('click', closePresentation);
    $('#resetVotes').addEventListener('click', resetVotes);
    $('#previousSlide').addEventListener('click', function () { movePresentation(-1); });
    $('#nextSlide').addEventListener('click', function () { movePresentation(1); });
    $('#printDeck').addEventListener('click', preparePrint);
    $('#exportPdf').addEventListener('click', function () { exportDeck('pdf'); });
    $('#exportPptx').addEventListener('click', function () { exportDeck('pptx'); });
    els.template.addEventListener('input', onTemplateChanged);
    els.pairs.addEventListener('input', saveSoon);
    document.querySelectorAll('.wyr-template').forEach(function (button) {
      button.addEventListener('click', function () { els.template.value = button.dataset.template; onTemplateChanged(); });
    });
    els.iconSearch.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { drawEmojiResults(els.iconSearch.value); }, 180);
    });
    els.imageUpload.addEventListener('change', function () { uploadImage(els.imageUpload.files && els.imageUpload.files[0]); });
    $('#closePicker').addEventListener('click', closePicker);
    $('#noPicture').addEventListener('click', chooseNoPicture);
    $('#autoPicture').addEventListener('click', chooseAutoPicture);
    els.picker.addEventListener('click', function (event) { if (event.target === els.picker) closePicker(); });
    document.addEventListener('keydown', function (event) {
      if (!els.picker.hidden) { if (event.key === 'Escape') closePicker(); return; }
      if (els.presentation.hidden) return;
      if (event.key === 'Escape') closePresentation();
      else if (event.key === 'ArrowLeft') movePresentation(-1);
      else if (event.key === 'ArrowRight') movePresentation(1);
      else if (/^[aA1]$/.test(event.key)) vote('A');
      else if (/^[bB2]$/.test(event.key)) vote('B');
    });
  }

  // ---------- start ----------
  initLibraryPicker();
  bindEvents();
  if (!handoffActive() && restore()) {
    refreshAll();
    setStatus(L.restored);
  } else {
    var initial = getCardsFromText(els.pairs.value, MAX_CARDS);
    state.cards = initial.cards;
    renderCards();
    renderPreview();
    if (initial.cards.length) setStatus(L.cardsReady(initial.cards.length));
  }
  updateTemplateSample();
  syncTemplateButtons();
  loadEmojiIndex().then(function () {
    if (CW && CW.loadCedict) CW.loadCedict().then(refreshFromDictionary, function () { /* offline: built-in dictionary only */ });
  });
})();
