/*
 * What's Missing? (什么不见了)
 * The teacher types words. The class studies the cards, the curtain drops,
 * some words are removed and the rest are shuffled, then students say what is missing.
 * Everything runs in the browser; the draft and settings are kept in localStorage.
 */
(function () {
  'use strict';

  var zh = /^zh/i.test(document.documentElement.lang || '');
  function L(en, cn) { return zh ? cn : en; }
  function $(id) { return document.getElementById(id); }

  var STORE_KEY = 'chen-whats-missing-v1';
  var MIN_WORDS = 4;
  var MAX_WORDS = 24;
  var CURTAIN_SWAP_MS = 600;   // the board changes once the curtain is fully down
  var CURTAIN_LIFT_MS = 2400;

  var core = window.ChenWordlist;
  var emojiCore = window.ChenEmoji;

  var picOff = {};      // zh -> true when the teacher turned that word's picture off
  var items = [];       // parsed words, in the order typed
  var game = null;      // { settings, order, shown, missing, used, round, phase }
  var timers = [];
  var previewTimer = 0;
  var prepareToken = 0;

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
      mode: radioValue('wmMode') || 'zh',
      emoji: $('wmEmoji').checked,
      missing: radioValue('wmMissing') || '1',
      repeat: $('wmRepeat').checked,
      time: Number($('wmTime').value) || 0
    };
  }

  function saveDraft() {
    try {
      var data = readSettings();
      data.text = $('wmWords').value;
      data.picOff = picOff;
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (error) { /* private mode: the game still works without saving */ }
  }

  function loadDraft() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (error) { data = null; }
    if (!data || typeof data !== 'object') return;
    if (typeof data.text === 'string') $('wmWords').value = data.text;
    if (data.mode) setRadio('wmMode', data.mode);
    if (data.missing) setRadio('wmMissing', data.missing);
    if (typeof data.emoji === 'boolean') $('wmEmoji').checked = data.emoji;
    if (typeof data.repeat === 'boolean') $('wmRepeat').checked = data.repeat;
    if (data.time != null) $('wmTime').value = String(data.time);
    if (data.picOff && typeof data.picOff === 'object') picOff = data.picOff;
  }

  // ---------- words ----------
  function parseWords() {
    var parsed = core ? core.parseText($('wmWords').value) : $('wmWords').value.split(/\r?\n/).map(function (line) {
      return { zh: line.trim(), py: '', en: '' };
    });
    var seen = Object.create(null);
    return parsed.filter(function (item) {
      if (!item || !item.zh || seen[item.zh]) return false;
      seen[item.zh] = true;
      return true;
    });
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
    return !!(item.openmoji && item.openmoji.hexcode) && !picOff[item.zh];
  }

  function updateCount() {
    var n = items.length;
    var text = n + L(n === 1 ? ' word' : ' words', ' 个词');
    if (n > 0 && n < MIN_WORDS) text += L(' · add at least ' + MIN_WORDS, ' · 至少需要 ' + MIN_WORDS + ' 个');
    if (n > MAX_WORDS) text += L(' · only the first ' + MAX_WORDS + ' are used', ' · 只会使用前 ' + MAX_WORDS + ' 个');
    $('wmCount').textContent = text;
  }

  function renderPreview() {
    var box = $('wmPreviewBox');
    var root = $('wmPreview');
    if (!$('wmEmoji').checked || !items.length) { box.hidden = true; pickerItem = null; $('wmPicker').hidden = true; return; }
    box.hidden = false;
    root.replaceChildren();
    items.slice(0, MAX_WORDS).forEach(function (item) {
      var shown = hasPic(item);
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wm-chip' + (shown ? '' : ' is-none') + (pickerItem && pickerItem.zh === item.zh ? ' is-open' : '');
      if (shown) {
        var img = document.createElement('img');
        img.src = emojiCore.svgUrl(item.openmoji.hexcode);
        img.alt = '';
        chip.appendChild(img);
        chip.title = L('Change the picture', '换一张图片');
      } else {
        var plus = document.createElement('span');
        plus.className = 'wm-chip-plus';
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
    if (pickerItem && !items.some(function (item) { return item.zh === pickerItem.zh; })) closePicker();
  }

  // ---------- picture picker ----------
  var pickerItem = null;
  var pickerTimer = 0;

  function renderPickerResults() {
    var root = $('wmPickerResults');
    var query = $('wmPickerSearch').value.trim();
    root.replaceChildren();
    if (!pickerItem || !emojiCore) return;
    emojiCore.load().then(function (index) {
      if (!pickerItem || $('wmPickerSearch').value.trim() !== query) return;
      var results = query ? emojiCore.search(query, index, { limit: 48 }) : [];
      root.replaceChildren();
      if (!results.length) {
        var empty = document.createElement('p');
        empty.className = 'wm-hint';
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
        button.className = 'wm-pick' + (entry.hexcode === current ? ' is-current' : '');
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
      failed.className = 'wm-hint';
      failed.textContent = L('The pictures could not be loaded. Check your internet connection.', '图片加载失败，请检查网络连接。');
      root.replaceChildren(failed);
    });
  }

  function openPicker(item) {
    pickerItem = item;
    $('wmPickerTitle').textContent = L('Picture for ', '给这个词选图：') + item.zh;
    $('wmPickerSearch').value = item.zh;
    $('wmPicker').hidden = false;
    renderPreview();
    renderPickerResults();
    $('wmPickerSearch').focus();
    $('wmPickerSearch').select();
  }

  function closePicker() {
    if (!pickerItem) return;
    pickerItem = null;
    $('wmPicker').hidden = true;
    renderPreview();
  }

  // The choice is remembered for this word (ChenEmoji.remember), so other tools use it too.
  function choosePicture(entry) {
    if (!pickerItem) return;
    // The word list is parsed again on every edit, so find the live item for this word.
    var zhWord = pickerItem.zh;
    var item = items.filter(function (it) { return it.zh === zhWord; })[0] || pickerItem;
    item.openmoji = entry;
    delete picOff[item.zh];
    emojiCore.remember(item, entry.emoji);
    saveDraft();
    closePicker();
  }

  function removePicture() {
    if (!pickerItem) return;
    picOff[pickerItem.zh] = true;
    saveDraft();
    closePicker();
  }

  function refreshWords() {
    items = parseWords();
    updateCount();
    $('wmError').textContent = '';
    saveDraft();
    if (!$('wmEmoji').checked) { renderPreview(); return; }
    var token = ++prepareToken;
    var list = items;
    prepare(list).then(function () {
      if (token === prepareToken) renderPreview();
    });
  }

  // ---------- game helpers ----------
  function shuffled(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  // Shuffle so the cards really change places (a shuffle can land on the same order by chance).
  function reshuffled(list) {
    if (list.length < 2) return list.slice();
    for (var attempt = 0; attempt < 8; attempt++) {
      var next = shuffled(list);
      var moved = next.filter(function (item, i) { return item !== list[i]; }).length;
      if (moved >= Math.ceil(list.length / 2)) return next;
    }
    return list.slice(1).concat(list[0]);
  }

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function pool() {
    if (game.settings.repeat) return game.order.slice();
    return game.order.filter(function (item) { return !game.used[item.zh]; });
  }

  // ---------- board ----------
  // How wide the main line of text is, in "em", so one font size fits every card.
  function textUnits(list, mode) {
    var units = 2;
    list.forEach(function (item) {
      var zhLen = Array.from(item.zh).length;
      var pyLen = (item.py || '').length * 0.56;
      var u = mode === 'zh' ? zhLen : mode === 'py' ? (pyLen || zhLen) : Math.max(zhLen, pyLen * 0.5);
      if (u > units) units = u;
    });
    return units;
  }

  // Pick the column count that gives the largest cards for this screen shape.
  function layoutBoard() {
    if (!game) return;
    var board = $('wmBoard');
    var n = game.order.length;
    var w = board.clientWidth, h = board.clientHeight;
    if (!w || !h) return;
    var best = 1, bestSize = 0;
    for (var cols = 1; cols <= n; cols++) {
      var rows = Math.ceil(n / cols);
      var size = Math.min(w / cols, (h / rows) * 1.35);
      if (size > bestSize) { bestSize = size; best = cols; }
    }
    board.style.setProperty('--wm-cols', best);
    board.style.setProperty('--wm-rows', Math.ceil(n / best));
  }

  function cardEl(item, highlight) {
    var s = game.settings;
    var card = document.createElement('div');
    var pic = s.emoji && hasPic(item);
    card.className = 'wm-card' + (pic ? ' has-pic' : '') + (highlight ? ' is-found' : '');
    if (pic) {
      var img = document.createElement('img');
      img.className = 'wm-card-pic';
      img.src = emojiCore.svgUrl(item.openmoji.hexcode);
      img.alt = '';
      card.appendChild(img);
    }
    var text = document.createElement('div');
    text.className = 'wm-card-text';
    var py = item.py || (core ? core.toPinyin(item.zh) : '');
    if (s.mode === 'both' && py) {
      var top = document.createElement('span');
      top.className = 'wm-py wm-py-small';
      top.textContent = py;
      text.appendChild(top);
    }
    var main = document.createElement('span');
    if (s.mode === 'py' && py) { main.className = 'wm-py'; main.textContent = py; }
    else { main.className = 'wm-zh'; main.lang = 'zh'; main.textContent = item.zh; }
    text.appendChild(main);
    card.appendChild(text);
    return card;
  }

  function renderBoard(list, highlighted) {
    var board = $('wmBoard');
    board.className = 'wm-board wm-mode-' + game.settings.mode;
    board.style.setProperty('--wm-units', textUnits(game.order, game.settings.mode).toFixed(2));
    board.replaceChildren();
    list.forEach(function (item) {
      board.appendChild(cardEl(item, highlighted && highlighted.indexOf(item) !== -1));
    });
    layoutBoard();
  }

  function setHeadline(main, sub) {
    $('wmHeadline').textContent = main;
    $('wmSubline').textContent = sub || '';
  }

  function setNext(label, disabled) {
    var button = $('wmNext');
    button.textContent = label;
    button.disabled = !!disabled;
    if (!disabled) button.focus();
  }

  function renderRound() {
    var text = L('Round ' + game.round, '第 ' + game.round + ' 轮');
    if (!game.settings.repeat) {
      var left = pool().length;
      text += L(' · ' + left + ' left', ' · 还剩 ' + left + ' 个词');
    }
    $('wmRound').textContent = text;
  }

  // ---------- phases ----------
  function startMemorize() {
    clearTimers();
    if (!pool().length) { finish(); return; }
    game.round += 1;
    game.phase = 'memorize';
    game.missing = [];
    renderBoard(game.order);
    renderRound();
    setNext(L('🙈 Close your eyes', '🙈 闭上眼睛'));
    var seconds = game.settings.time;
    if (!seconds) { setHeadline('记住这些词！', zh ? '' : 'Remember these words!'); return; }
    (function tick() {
      setHeadline('记住这些词！', L(seconds + ' s', seconds + ' 秒'));
      if (seconds <= 0) { hideWords(); return; }
      seconds -= 1;
      later(tick, 1000);
    })();
  }

  function hideWords() {
    clearTimers();
    game.phase = 'hidden';
    var available = pool();
    var wanted = game.settings.missing === 'random' ? 1 + Math.floor(Math.random() * 3) : Number(game.settings.missing);
    // Always leave at least two cards on the board.
    var count = Math.max(1, Math.min(wanted, available.length, game.order.length - 2));
    game.missing = shuffled(available).slice(0, count);
    game.missing.forEach(function (item) { game.used[item.zh] = true; });
    game.shown = reshuffled(game.order.filter(function (item) { return game.missing.indexOf(item) === -1; }));

    setNext(L('Shuffling…', '正在打乱…'), true);
    $('wmCurtain').classList.add('is-down');
    later(function () {
      renderBoard(game.shown);
      setHeadline('什么不见了？', zh ? '' : 'What\'s missing?');
    }, CURTAIN_SWAP_MS);
    later(function () {
      $('wmCurtain').classList.remove('is-down');
      game.phase = 'guess';
      var n = game.missing.length;
      setHeadline('什么不见了？', L(n === 1 ? '1 word is missing' : n + ' words are missing', n + ' 个词不见了'));
      setNext(L('👀 Show the answer', '👀 揭晓答案'));
    }, CURTAIN_LIFT_MS);
  }

  function reveal() {
    game.phase = 'reveal';
    game.order = game.shown.concat(game.missing);
    renderBoard(game.order, game.missing);
    setHeadline('不见的是：' + game.missing.map(function (item) { return item.zh; }).join('、'),
      game.missing.map(function (item) { return item.py; }).filter(Boolean).join(' · '));
    renderRound();
    setNext(pool().length ? L('Next round →', '下一轮 →') : L('Finish', '结束'));
  }

  function finish() {
    game.phase = 'done';
    renderBoard(game.order);
    setHeadline('🎉 所有词都消失过了！', zh ? '' : 'Every word has disappeared once!');
    $('wmRound').textContent = L(game.round + ' rounds played', '共玩了 ' + game.round + ' 轮');
    setNext(L('Play again', '再玩一次'));
  }

  function next() {
    if (!game) return;
    if (game.phase === 'memorize') hideWords();
    else if (game.phase === 'guess') reveal();
    else if (game.phase === 'reveal') startMemorize();
    else if (game.phase === 'done') { game.used = {}; game.round = 0; game.order = shuffled(game.order); startMemorize(); }
  }

  function openStage(list, settings) {
    game = { settings: settings, order: shuffled(list), shown: [], missing: [], used: {}, round: 0, phase: '' };
    $('wmCurtain').classList.remove('is-down');
    $('wmStage').hidden = false;
    document.body.classList.add('wm-playing');
    startMemorize();
  }

  function closeStage() {
    clearTimers();
    game = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    $('wmStage').hidden = true;
    document.body.classList.remove('wm-playing');
    $('wmStart').focus();
  }

  function start() {
    clearTimeout(previewTimer);
    items = parseWords();
    updateCount();
    var settings = readSettings();
    saveDraft();
    if (items.length < MIN_WORDS) {
      $('wmError').textContent = L('Type at least ' + MIN_WORDS + ' different words first.', '请先输入至少 ' + MIN_WORDS + ' 个不同的词。');
      $('wmWords').focus();
      return;
    }
    $('wmError').textContent = '';
    var list = items.slice(0, MAX_WORDS);
    if (!settings.emoji) { openStage(list, settings); return; }
    var button = $('wmStart');
    button.disabled = true;
    prepareToken += 1;
    prepare(list).then(function () {
      button.disabled = false;
      renderPreview();
      openStage(list, settings);
    });
  }

  // ---------- wiring ----------
  function init() {
    loadDraft();

    // Opened from the Vocab Game Switcher: use that list instead of the saved draft.
    var handoff = window.ChenWordlistHandoff;
    var handed = handoff && handoff.active();
    if (handed) {
      $('wmWords').value = handed.items.map(function (item) {
        return item.py || item.en ? [item.zh, item.py, item.en].join(' | ') : item.zh;
      }).join('\n');
      handoff.mountBar(handed);
    }

    $('wmWords').addEventListener('input', function () {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(refreshWords, 400);
    });
    ['wmEmoji', 'wmRepeat', 'wmTime'].forEach(function (id) {
      $(id).addEventListener('change', id === 'wmEmoji' ? refreshWords : saveDraft);
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="wmMode"], input[name="wmMissing"]'), function (input) {
      input.addEventListener('change', saveDraft);
    });

    $('wmPickerSearch').addEventListener('input', function () {
      clearTimeout(pickerTimer);
      pickerTimer = setTimeout(renderPickerResults, 250);
    });
    $('wmPickerClose').addEventListener('click', closePicker);
    $('wmPickerNone').addEventListener('click', removePicture);
    $('wmStart').addEventListener('click', start);
    $('wmNext').addEventListener('click', next);
    $('wmExit').addEventListener('click', closeStage);
    $('wmFullscreen').addEventListener('click', function () {
      var stage = $('wmStage');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
    });
    document.addEventListener('keydown', function (event) {
      if (game && event.key === 'Escape' && !document.fullscreenElement) closeStage();
    });
    window.addEventListener('resize', layoutBoard);

    refreshWords();
  }

  init();
})();
