/*
 * 出门条 · Exit Tickets
 * A word list becomes a page of cut-apart strips. Each version (A/B/C) is one
 * fixed set of questions; strips alternate versions so neighbours differ.
 *
 * Question types (cycled, one word each, no word twice in a version):
 *   write     see pinyin (+ English), write the characters in 田字格 boxes
 *   meaning   see the word, circle its English meaning (3 choices)
 *   pickzh    see the English, circle the characters (3 choices)
 *   sentence  make a sentence with the word
 * plus the teacher's own questions and optional reflection lines.
 */
(function () {
  'use strict';

  var ZH = window.ET_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };
  var PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };
  var LAYOUT = { 4: [2, 2], 6: [2, 3], 8: [2, 4] };
  var VERSION_NAMES = ['A', 'B', 'C'];

  var state = { seed: Math.floor(Math.random() * 1e6) + 1, words: [] };

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

  function checked(id) {
    return Array.prototype.filter.call($(id).querySelectorAll('input'), function (b) { return b.checked; }).map(function (b) { return b.value; });
  }

  function parseWords() {
    var core = window.ChenWordlist;
    var list = core ? core.parseText($('etWords').value) : [];
    var seen = {};
    return list.filter(function (w) { if (!w.zh || seen[w.zh]) return false; seen[w.zh] = true; return true; }).slice(0, 80);
  }

  // ---------- questions ----------

  // Two other words' values for a three-choice question, or null when there are too few.
  function distractors(words, word, field, rand) {
    var seen = {}; seen[word[field]] = true;
    var pool = shuffle(words.filter(function (w) {
      if (w === word || !w[field] || seen[w[field]]) return false;
      seen[w[field]] = true;
      return true;
    }), rand);
    return pool.length >= 2 ? pool.slice(0, 2) : null;
  }

  function makeQuestion(type, word, words, rand) {
    if (type === 'write') return { type: type, word: word, answer: word.zh };
    if (type === 'sentence') return { type: type, word: word, answer: null };
    var field = type === 'meaning' ? 'en' : 'zh';
    if (!word.en) return null; // both choice types show or ask the English meaning
    var others = distractors(words, word, field, rand);
    if (!others) return null;
    var options = shuffle([word].concat(others), rand);
    return { type: type, word: word, options: options, answer: options.indexOf(word), field: field };
  }

  // Versions use different words where the list allows it.
  function buildVersions(words, count, per, types, rand) {
    var order = shuffle(words, rand);
    var at = 0;
    var versions = [];
    for (var v = 0; v < count; v++) {
      var qs = [];
      var used = {};
      var t = Math.floor(rand() * types.length);
      for (var tries = 0; qs.length < per && tries < per * 6; tries++) {
        var type = types[t % types.length];
        var word = order[at % order.length];
        at++;
        if (used[word.zh] && Object.keys(used).length < words.length) continue;
        var q = makeQuestion(type, word, words, rand);
        if (!q) { t++; continue; }
        used[word.zh] = true;
        qs.push(q);
        t++;
      }
      versions.push(qs);
    }
    return versions;
  }

  // ---------- drawing ----------

  function grid(n) {
    var cells = '';
    for (var i = 0; i < n; i++) cells += '<span class="et-tzg"></span>';
    return '<span class="et-tzgs">' + cells + '</span>';
  }

  function questionHtml(q, i, opts) {
    var num = '<b class="et-num">' + (i + 1) + '.</b>';
    var w = q.word;
    if (q.type === 'write') {
      return '<li class="et-q et-q-write">' + num + '<span class="et-prompt">' + T('Write the characters:', '写汉字：') + ' <span class="et-py">' + esc(w.py) + '</span>' +
        (w.en ? ' <small>(' + esc(w.en) + ')</small>' : '') + '</span>' + grid(Array.from(w.zh).length) + '</li>';
    }
    if (q.type === 'sentence') {
      return '<li class="et-q et-q-line">' + num + '<span class="et-prompt">' + T('Make a sentence with', '用') + ' <span class="et-zh">「' + esc(w.zh) + '」</span>' + T('', '写一句话：') + '</span><span class="et-line"></span></li>';
    }
    if (q.type === 'own') {
      return '<li class="et-q et-q-line">' + num + '<span class="et-prompt">' + esc(q.text) + '</span><span class="et-line"></span></li>';
    }
    var prompt = q.type === 'meaning'
      ? T('What does', '') + ' <span class="et-zh">' + esc(w.zh) + '</span>' + (opts.pinyin ? ' <span class="et-py">' + esc(w.py) + '</span>' : '') + T(' mean?', ' 是什么意思？')
      : '<span class="et-en">“' + esc(w.en) + '”</span> ' + T('in Chinese:', '是哪个词？');
    var choices = q.options.map(function (o) {
      var label = q.type === 'meaning' ? esc(o.en) : '<span class="et-zh">' + esc(o.zh) + '</span>' + (opts.pinyin ? ' <span class="et-py">' + esc(o.py) + '</span>' : '');
      return '<span class="et-choice"><i></i>' + label + '</span>';
    }).join('');
    return '<li class="et-q et-q-choice">' + num + '<span class="et-prompt">' + prompt + '</span><span class="et-choices">' + choices + '</span></li>';
  }

  function reflectionHtml(kinds) {
    var out = '';
    if (kinds.indexOf('faces') !== -1) {
      out += '<div class="et-reflect et-faces"><span>' + T("Today's words:", '今天的词：') + '</span>' +
        '<span><i></i>😀 ' + T('I know them', '都会了') + '</span><span><i></i>😐 ' + T('Some', '会一些') + '</span><span><i></i>😟 ' + T('Not yet', '还不会') + '</span></div>';
    }
    if (kinds.indexOf('learned') !== -1) out += '<div class="et-reflect"><span>' + T('Today I learned:', '今天我学会了：') + '</span><span class="et-line"></span></div>';
    if (kinds.indexOf('question') !== -1) out += '<div class="et-reflect"><span>' + T('I still want to ask:', '我还想问：') + '</span><span class="et-line"></span></div>';
    return out;
  }

  function strip(version, vIndex, versionsCount, own, reflect, opts) {
    var title = $('etTitle').value.trim();
    var all = version.concat(own.map(function (text) { return { type: 'own', text: text }; }));
    return '<div class="et-strip">' +
      '<div class="et-strip-head"><span class="et-brand">🎟️ ' + T('Exit ticket', '出门条') + (title ? ' · ' + esc(title) : '') + '</span>' +
      '<span class="et-name">' + T('Name', '姓名') + ' <span class="et-blank"></span></span>' +
      (versionsCount > 1 ? '<span class="et-ver">' + VERSION_NAMES[vIndex] + '</span>' : '') + '</div>' +
      '<ol class="et-qs">' + all.map(function (q, i) { return questionHtml(q, i, opts); }).join('') + '</ol>' +
      reflectionHtml(reflect) + '</div>';
  }

  function sheet(inner, cls) {
    var size = PAPER[$('etPaper').value];
    return '<div class="et-sheet ' + (cls || '') + '" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm">' +
      '<div class="et-sheet-inner">' + inner + '<div class="et-sheet-foot"><span>CLS Teaching Tools</span><span>clsteachingtools.com</span></div></div></div>';
  }

  function answerSheet(versions, own) {
    return sheet('<h2 class="et-key-title">' + T('Answer key', '答案') + ' · ' + T('Exit tickets', '出门条') + ($('etTitle').value.trim() ? ' · ' + esc($('etTitle').value.trim()) : '') + '</h2>' +
      '<div class="et-key">' + versions.map(function (qs, v) {
        return '<section><h3>' + (versions.length > 1 ? T('Version ', '版本 ') + VERSION_NAMES[v] : T('Answers', '答案')) + '</h3><ol>' +
          qs.map(function (q) {
            var w = q.word;
            if (q.type === 'write') return '<li><span class="et-zh">' + esc(w.zh) + '</span> <span class="et-py">' + esc(w.py) + '</span></li>';
            if (q.type === 'sentence') return '<li>' + T('Open answer, using ', '开放题，用到') + '<span class="et-zh">「' + esc(w.zh) + '」</span></li>';
            return '<li>' + (q.type === 'meaning' ? esc(w.en) : '<span class="et-zh">' + esc(w.zh) + '</span> <span class="et-py">' + esc(w.py) + '</span>') + '</li>';
          }).join('') + own.map(function () { return '<li>' + T('Open answer', '开放题') + '</li>'; }).join('') + '</ol></section>';
      }).join('') + '</div>', 'et-key-sheet');
  }

  // ---------- render ----------

  function render() {
    state.words = parseWords();
    $('etCount').textContent = T(state.words.length + ' words', '共 ' + state.words.length + ' 个词');
    var types = checked('etTypes');
    var own = $('etOwn').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4);
    var box = $('etSheets');
    if (!state.words.length && !own.length) { box.innerHTML = '<p class="et-empty">' + T('Type a few words first.', '先输入几个词。') + '</p>'; return; }
    if (!types.length && !own.length) { box.innerHTML = '<p class="et-empty">' + T('Choose at least one question type.', '至少选一种题型。') + '</p>'; return; }
    var per = Number($('etPer').value), count = Number($('etVersions').value);
    var rand = rng(state.seed);
    var versions = state.words.length && types.length ? buildVersions(state.words, count, per, types, rand) : Array.from({ length: count }, function () { return []; });
    var reflect = checked('etReflect');
    var opts = { pinyin: $('etPinyin').checked };
    var strips = Number($('etStrips').value), layout = LAYOUT[strips];
    var pages = Number($('etPages').value);
    var html = '';
    for (var p = 0; p < pages; p++) {
      var cells = '';
      for (var i = 0; i < strips; i++) {
        // Alternate versions along each row and down each column.
        var row = Math.floor(i / layout[0]), col = i % layout[0];
        var v = (row + col) % count;
        cells += strip(versions[v], v, count, own, reflect, opts);
      }
      html += sheet('<div class="et-strips" style="grid-template-columns:repeat(' + layout[0] + ',1fr);grid-template-rows:repeat(' + layout[1] + ',1fr)">' + cells + '</div>', 'per-' + strips);
    }
    if ($('etKey').checked && state.words.length && types.length) html += answerSheet(versions, own);
    box.innerHTML = html;
    fit();
    var shortEn = types.some(function (t) { return t === 'meaning' || t === 'pickzh'; }) && state.words.filter(function (w) { return w.en; }).length < 3;
    var notes = [];
    if (shortEn) notes.push(T('Choice questions need at least 3 words with English meanings; they were skipped.', '选择题需要至少 3 个有英文的词，这次没出选择题。'));
    if (fit.tooFull) notes.push(T('Too much on each strip: the bottom is cut off. Use fewer strips per page, fewer questions, or fewer reflection lines.', '每张纸条内容太多，下面被截掉了：请减少每页张数、题目或反思题。'));
    $('etStatus').textContent = notes.join(' ');
  }

  // Shrink the text until every strip fits in its box.
  function fit() {
    var tooFull = false;
    Array.prototype.forEach.call($('etSheets').querySelectorAll('.et-sheet:not(.et-key-sheet)'), function (page) {
      var size = page.classList.contains('per-4') ? 14 : page.classList.contains('per-8') ? 10 : 11.5;
      var strips = page.querySelectorAll('.et-strip');
      var over = function () { return Array.prototype.some.call(strips, function (s) { return s.scrollHeight > s.clientHeight + 1; }); };
      page.style.setProperty('--fs', size + 'pt');
      for (var g = 0; g < 14 && over() && size > 7; g++) { size -= 0.5; page.style.setProperty('--fs', size + 'pt'); }
      if (over()) tooFull = true;
    });
    var stage = $('etStage'), sheets = $('etSheets');
    sheets.style.zoom = 1;
    sheets.classList.toggle('is-too-full', tooFull);
    fit.tooFull = tooFull;
    var first = sheets.querySelector('.et-sheet');
    if (first) sheets.style.zoom = Math.min(1, (stage.clientWidth - 24) / first.offsetWidth);
  }

  // ---------- events ----------

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 250); }
  ['etWords', 'etTitle', 'etOwn'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['etPer', 'etVersions', 'etStrips', 'etPages', 'etPinyin', 'etKey'].forEach(function (id) { $(id).addEventListener('change', render); });
  $('etTypes').addEventListener('change', render);
  $('etReflect').addEventListener('change', render);
  $('etPaper').addEventListener('change', function () { $('etPageSize').textContent = '@page { size: ' + $('etPaper').value + '; margin: 0; }'; render(); });
  $('etShuffle').addEventListener('click', function () { state.seed = Math.floor(Math.random() * 1e6) + 1; render(); });
  $('etPrint').addEventListener('click', function () { if ($('etSheets').querySelector('.et-sheet')) window.print(); });
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(fit, 150); });

  var handoff = window.ChenWordlistHandoff;
  var handed = handoff && handoff.active();
  if (handed) {
    $('etWords').value = handed.items.map(function (item) { return [item.zh, item.py, item.en].filter(Boolean).join(' | '); }).join('\n');
    if (handed.name && ['我的词表', 'My word list'].indexOf(handed.name) === -1) $('etTitle').value = handed.name;
    handoff.mountBar(handed);
  }
  render();
  // Fuller English meanings for the choice questions once the dictionary loads.
  if (window.ChenWordlist && window.ChenWordlist.loadCedict) window.ChenWordlist.loadCedict().then(render, function () {});
})();
