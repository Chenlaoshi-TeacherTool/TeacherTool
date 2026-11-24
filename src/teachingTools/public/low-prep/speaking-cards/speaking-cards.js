/*
 * 口语任务卡 · Speaking Task Cards
 *   roles      role-play cards: each situation prints as a pair, card A | card B,
 *              each card with a role, a task, sentence patterns and words to use
 *   interview  "find someone who…" sheet: a grid of questions from the word list
 * Situations and frames live in speaking-scenarios.js.
 */
(function () {
  'use strict';

  var ZH = window.SC_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };
  var SCENES = window.SpeakingScenarios, FRAMES = window.SpeakingFrames;
  var PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };
  var DEFAULT_SCENES = ['restaurant', 'shop', 'directions', 'plans'];
  var state = { mode: 'roles', seed: Math.floor(Math.random() * 1e6) + 1, words: [] };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pinyin(text) {
    try { return window.ChenWordlist ? window.ChenWordlist.toPinyin(text, { spaced: true }) : ''; } catch (e) { return ''; }
  }

  function parseWords() {
    var core = window.ChenWordlist;
    var list = core ? core.parseText($('scWords').value) : [];
    var seen = {};
    return list.filter(function (w) { if (!w.zh || seen[w.zh]) return false; seen[w.zh] = true; return true; }).slice(0, 80);
  }

  // Deals words out in a shuffled cycle so every word gets used before any repeats.
  function dealer(words, rand) {
    var deck = [];
    return function () {
      if (!words.length) return null;
      if (!deck.length) deck = shuffle(words, rand);
      return deck.pop();
    };
  }

  // ---------- role-play cards ----------

  function chosenScenes() {
    var keys = Array.prototype.filter.call($('scScenarios').querySelectorAll('input'), function (b) { return b.checked; }).map(function (b) { return b.value; });
    var list = SCENES.filter(function (s) { return keys.indexOf(s.key) !== -1; });
    var own = ownScene();
    if (own) list.push(own);
    return list;
  }

  function ownScene() {
    var title = $('scOwnTitle').value.trim();
    if (!title) return null;
    return {
      key: 'own', icon: '⭐', zh: title, en: '',
      a: { role: $('scOwnARole').value.trim() || 'A', roleEn: '', task: $('scOwnATask').value.trim(), taskEn: '' },
      b: { role: $('scOwnBRole').value.trim() || 'B', roleEn: '', task: $('scOwnBTask').value.trim(), taskEn: '' },
      patterns: $('scOwnPatterns').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4)
        .map(function (p) { return { zh: p, py: '', en: '', auto: true }; }) // pinyin is made when drawn
    };
  }

  function wordChips(words, opts) {
    if (!words.length) return '';
    return '<div class="sc-words"><span class="sc-label">' + T('Use these words', '一定要用到') + '</span>' + words.map(function (w) {
      return '<span class="sc-word"><b>' + esc(w.zh) + '</b>' + (opts.pinyin && w.py ? '<i>' + esc(w.py) + '</i>' : '') + (opts.english && w.en ? '<small>' + esc(w.en) + '</small>' : '') + '</span>';
    }).join('') + '<span class="sc-tick">' + T('Tick each word when you use it', '用到一个就打个勾') + ' ☐</span></div>';
  }

  function card(scene, side, words, opts) {
    var r = scene[side];
    var letter = side === 'a' ? 'A' : 'B';
    var patterns = scene.patterns.map(function (p) {
      var py = p.auto ? (opts.pinyin ? pinyin(p.zh) : '') : (opts.pinyin ? p.py : '');
      return '<li><span class="sc-zh">' + esc(p.zh) + '</span>' + (py ? '<span class="sc-py">' + esc(py) + '</span>' : '') + (opts.english && p.en ? '<small>' + esc(p.en) + '</small>' : '') + '</li>';
    }).join('');
    return '<div class="sc-card sc-card-' + side + '">' +
      '<div class="sc-card-head"><span class="sc-icon">' + scene.icon + '</span><span><b>' + esc(scene.zh) + '</b>' + (opts.english && scene.en ? '<small>' + esc(scene.en) + '</small>' : '') + '</span><span class="sc-letter">' + letter + '</span></div>' +
      '<p class="sc-role">' + T('You are', '你是') + ' <b>' + esc(r.role) + '</b>' + (opts.english && r.roleEn ? ' <small>(' + esc(r.roleEn) + ')</small>' : '') + '</p>' +
      (r.task ? '<p class="sc-task">' + esc(r.task) + (opts.pinyin ? '<span class="sc-py">' + esc(r.taskPy || pinyin(r.task)) + '</span>' : '') + (opts.english && r.taskEn ? '<small>' + esc(r.taskEn) + '</small>' : '') + '</p>' : '') +
      (patterns ? '<div class="sc-patterns"><span class="sc-label">' + T('You can say', '可以这样说') + '</span><ul>' + patterns + '</ul></div>' : '') +
      wordChips(words, opts) +
      '</div>';
  }

  function rolePages(opts) {
    var scenes = chosenScenes();
    if (!scenes.length) return '<p class="sc-empty">' + T('Choose at least one situation.', '至少选一个情景。') + '</p>';
    var per = Number($('scPerRole').value), sets = Number($('scSets').value);
    var deal = dealer(state.words, rng(state.seed));
    var pairs = [];
    for (var s = 0; s < sets; s++) {
      scenes.forEach(function (scene) {
        var take = function () { var out = []; for (var i = 0; i < per; i++) { var w = deal(); if (w && out.indexOf(w) === -1) out.push(w); } return out; };
        pairs.push(card(scene, 'a', take(), opts) + card(scene, 'b', take(), opts));
      });
    }
    var html = '';
    for (var i = 0; i < pairs.length; i += 2) {
      html += sheet('<div class="sc-pairs">' + pairs.slice(i, i + 2).map(function (p) { return '<div class="sc-pair">' + p + '</div>'; }).join('') + '</div>');
    }
    return html;
  }

  // ---------- interview sheet ----------

  function frame() {
    var own = $('scOwnFrame').value.trim();
    if (own && /_+/.test(own)) {
      var core = own.replace(/[？?]\s*$/, '').replace(/^你/, '').replace(/吗$/, '');
      return { ask: own, askPy: '', find: core + '的同学', en: '', own: true };
    }
    return FRAMES.filter(function (f) { return f.key === $('scFrame').value; })[0] || FRAMES[0];
  }

  function fill(text, w) { return esc(text).replace(/_+/, '<b>' + esc(w.zh) + '</b>'); }

  function interviewPages(opts) {
    var words = state.words;
    if (!words.length) return '<p class="sc-empty">' + T('Type a few words first.', '先输入几个词。') + '</p>';
    var f = frame(), n = Number($('scGrid').value), copies = Number($('scCopies').value);
    var rand = rng(state.seed);
    var html = '';
    for (var c = 0; c < copies; c++) {
      var deal = dealer(words, rand), cells = '';
      for (var i = 0; i < n * n; i++) {
        var w = deal();
        var askPy = opts.pinyin ? (f.askPy ? f.askPy.replace('____', w.py || '') : pinyin(f.ask.replace(/_+/, w.zh))) : '';
        cells += '<div class="sc-cell"><p class="sc-find">' + fill(f.find, w) + '</p>' +
          '<p class="sc-ask">' + T('Ask: ', '问：') + fill(f.ask, w) + (askPy ? '<span class="sc-py">' + esc(askPy) + '</span>' : '') + '</p>' +
          (opts.english && w.en && f.en ? '<p class="sc-en">' + T('Someone who ', 'Someone who ') + esc(f.en.replace('____', w.en)) + '</p>' : '') +
          '<p class="sc-sign">' + T('Name', '名字') + '<span></span></p></div>';
      }
      html += sheet('<div class="sc-int-head"><h2>🔍 ' + T('Find someone who…', '找一个……的同学') + '</h2><span>' + T('My name', '我的名字') + ' <span class="sc-blank"></span></span></div>' +
        '<p class="sc-int-rule">' + T('Walk around and ask the question in each box. If a classmate says yes, write their name. Each name only once! Get a whole row to shout “宾果！”', '在教室里走一走，用格子里的问题问同学。同学说“是”，就请他写上名字。一个人只能写一次！连成一行就大声说“宾果！”') + '</p>' +
        '<div class="sc-grid" style="grid-template-columns:repeat(' + n + ',1fr);grid-template-rows:repeat(' + n + ',1fr)">' + cells + '</div>', 'sc-int-sheet grid-' + n);
    }
    return html;
  }

  // ---------- sheets ----------

  function sheet(inner, cls) {
    var size = PAPER[$('scPaper').value];
    return '<div class="sc-sheet ' + (cls || '') + '" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm"><div class="sc-sheet-inner">' + inner +
      '<div class="sc-sheet-foot"><span>CLS Teaching Tools</span><span>clsteachingtools.com</span></div></div></div>';
  }

  function render() {
    state.words = parseWords();
    $('scCount').textContent = T(state.words.length + ' words', '共 ' + state.words.length + ' 个词');
    var opts = { pinyin: $('scPinyin').checked, english: $('scEnglish').checked };
    $('scSheets').innerHTML = state.mode === 'roles' ? rolePages(opts) : interviewPages(opts);
    fit();
    var n = Number($('scGrid').value);
    $('scStatus').textContent = state.mode === 'interview' && state.words.length && state.words.length < n * n
      ? T('Only ' + state.words.length + ' words for ' + n * n + ' boxes: some words appear twice.', '只有 ' + state.words.length + ' 个词、' + n * n + ' 个格子，有的词会出现两次。')
      : '';
  }

  // Shrink text on any card or cell that overflows.
  function fit() {
    Array.prototype.forEach.call($('scSheets').querySelectorAll('.sc-card, .sc-cell'), function (box) {
      var size = 100;
      box.style.fontSize = '';
      while (box.scrollHeight > box.clientHeight + 1 && size > 60) { size -= 5; box.style.fontSize = size + '%'; }
    });
    var stage = $('scStage'), sheets = $('scSheets');
    sheets.style.zoom = 1;
    var first = sheets.querySelector('.sc-sheet');
    if (first) sheets.style.zoom = Math.min(1, (stage.clientWidth - 24) / first.offsetWidth);
  }

  // ---------- projector ----------

  function showCard() {
    var scenes = chosenScenes();
    if (!scenes.length) return;
    var rand = Math.random;
    var scene = scenes[Math.floor(rand() * scenes.length)];
    var per = Math.max(1, Number($('scPerRole').value));
    var words = shuffle(state.words, rand);
    var opts = { pinyin: $('scPinyin').checked, english: $('scEnglish').checked };
    var box = $('scShowBox');
    box.hidden = false;
    box.innerHTML = '<div class="sc-show-cards">' + card(scene, 'a', words.slice(0, per), opts) + card(scene, 'b', words.slice(per, per * 2), opts) + '</div>' +
      '<div class="sc-show-bar"><button type="button" class="sc-btn" data-again>🔀 ' + T('Another card', '换一张') + '</button><button type="button" class="sc-btn sc-btn-ghost" data-close>✕ ' + T('Close', '关闭') + '</button></div>';
    if (!document.fullscreenElement && box.requestFullscreen) box.requestFullscreen().catch(function () {});
  }

  $('scShowBox').addEventListener('click', function (e) {
    if (e.target.closest('[data-again]')) showCard();
    if (e.target.closest('[data-close]')) { $('scShowBox').hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); }
  });
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement) $('scShowBox').hidden = true; });

  // ---------- controls ----------

  $('scScenarios').innerHTML = SCENES.map(function (s) {
    return '<label><input type="checkbox" value="' + s.key + '"' + (DEFAULT_SCENES.indexOf(s.key) !== -1 ? ' checked' : '') + '> ' + s.icon + ' ' + s.zh + (ZH ? '' : ' <small>' + esc(s.en) + '</small>') + '</label>';
  }).join('');
  $('scFrame').innerHTML = FRAMES.map(function (f) { return '<option value="' + f.key + '">' + esc(f.ask) + (ZH ? '' : ' · Someone who ' + esc(f.en)) + '</option>'; }).join('');

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mode === mode)); });
    document.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.dataset.for !== mode; });
    render();
  }
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 250); }
  ['scWords', 'scOwnTitle', 'scOwnARole', 'scOwnBRole', 'scOwnATask', 'scOwnBTask', 'scOwnPatterns', 'scOwnFrame'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['scPerRole', 'scSets', 'scFrame', 'scGrid', 'scCopies', 'scPinyin', 'scEnglish'].forEach(function (id) { $(id).addEventListener('change', render); });
  $('scScenarios').addEventListener('change', render);
  $('scPaper').addEventListener('change', function () { $('scPageSize').textContent = '@page { size: ' + $('scPaper').value + '; margin: 0; }'; render(); });
  $('scShuffle').addEventListener('click', function () { state.seed = Math.floor(Math.random() * 1e6) + 1; render(); });
  $('scPrint').addEventListener('click', function () { if ($('scSheets').querySelector('.sc-sheet')) window.print(); });
  $('scShow').addEventListener('click', showCard);
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(fit, 150); });

  var handoff = window.ChenWordlistHandoff;
  var handed = handoff && handoff.active();
  if (handed) {
    $('scWords').value = handed.items.map(function (item) { return [item.zh, item.py, item.en].filter(Boolean).join(' | '); }).join('\n');
    handoff.mountBar(handed);
  }
  setMode(new URLSearchParams(location.search).get('mode') === 'interview' ? 'interview' : 'roles');
  if (window.ChenWordlist && window.ChenWordlist.loadCedict) window.ChenWordlist.loadCedict().then(render, function () {});
})();
