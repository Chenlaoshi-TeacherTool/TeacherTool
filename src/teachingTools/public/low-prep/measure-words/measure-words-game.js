/*!
 * 量词大挑战 · 游戏引擎
 * 三种模式：catch（抓量词，限时）、fill（填句子）、battle（全班对战，拔河）。
 * 老师页和学生分享页都用 MWGame.mount(container, config, hooks) 挂载。
 *
 * config = {
 *   mws: ['张', ...],                       // 参与的量词（决定按钮）
 *   items: [{ noun, emoji, mw, alt, kind, challenge }],
 *   sentences: [{ before, answer, after }], // 老师自己的句子（可选）
 *   options: { pinyin, challenge, duration, rounds, battleTarget, battleType, randomNumbers, speak }
 * }
 */
(function (global) {
  'use strict';

  var D = global.MWData;
  var NUMERAL_TAIL = /[零一二两三四五六七八九十百]+$/;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rand(list.length)]; }
  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function pinyin(text) {
    var pp = global.pinyinPro;
    if (!text || !pp || typeof pp.pinyin !== 'function') return '';
    try { return pp.pinyin(text, { toneType: 'symbol' }).replace(/\s*[。！？，、；：.!?,]/g, ''); } catch (_e) { return ''; }
  }

  // ---------- 量词元信息：已知量词用固定颜色和规律，自定义量词轮流拿颜色 ----------
  var extraMeta = {};
  function metaFor(mw) {
    for (var i = 0; i < D.MEASURE_WORDS.length; i++) {
      if (D.MEASURE_WORDS[i].mw === mw) return D.MEASURE_WORDS[i];
    }
    if (!extraMeta[mw]) {
      var count = Object.keys(extraMeta).length;
      extraMeta[mw] = { mw: mw, py: pinyin(mw), color: D.EXTRA_COLORS[count % D.EXTRA_COLORS.length], rule: '', ruleEn: '' };
    }
    return extraMeta[mw];
  }

  function orderOf(mw) {
    for (var i = 0; i < D.MEASURE_WORDS.length; i++) if (D.MEASURE_WORDS[i].mw === mw) return i;
    return 100 + Object.keys(extraMeta).indexOf(mw);
  }

  // ---------- 朗读：浏览器自带中文语音 ----------
  var zhVoice = null;
  function findVoice() {
    if (!global.speechSynthesis) return;
    var voices = global.speechSynthesis.getVoices();
    zhVoice = voices.filter(function (v) { return /^zh(-|_)?(CN|Hans)?/i.test(v.lang); })[0] || null;
  }
  if (global.speechSynthesis) {
    findVoice();
    if ('onvoiceschanged' in global.speechSynthesis) global.speechSynthesis.addEventListener('voiceschanged', findVoice);
  }
  function speak(text) {
    if (!global.speechSynthesis || !text) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (zhVoice) u.voice = zhVoice;
    u.rate = 0.85;
    global.speechSynthesis.cancel();
    global.speechSynthesis.speak(u);
  }

  // ---------- 出题 ----------
  function randomCount(max) {
    // 偏向 2–20，偶尔出现「一」
    var n = Math.random() < 0.12 ? 1 : 2 + rand(Math.max(1, max - 1));
    return D.toChineseNumber(Math.min(n, 99));
  }

  function nounQuestion(item) {
    return {
      type: 'noun', item: item, answer: item.mw, alts: item.alt || [],
      before: '一', after: item.noun, challenge: !!item.challenge,
      speakText: '一' + item.mw + item.noun
    };
  }

  function sentenceFromItem(item) {
    var group = D.TEMPLATES[item.kind] || D.TEMPLATES.thing;
    var templates = group.list.filter(function (t) { return t.indexOf(item.noun) === -1; });
    var template = pick(templates.length ? templates : group.list);
    var parts = template.replace('{noun}', item.noun).replace('{n}', randomCount(group.max)).split('（　）');
    return {
      type: 'sentence', item: item, answer: item.mw, alts: item.alt || [],
      before: parts[0], after: parts[1], challenge: !!item.challenge,
      speakText: parts[0] + item.mw + parts[1]
    };
  }

  function sentenceFromCustom(sentence, randomNumbers) {
    var before = sentence.before;
    if (randomNumbers && NUMERAL_TAIL.test(before)) before = before.replace(NUMERAL_TAIL, randomCount(20));
    return {
      type: 'sentence', item: null, answer: sentence.answer, alts: [],
      before: before, after: sentence.after, challenge: false,
      speakText: before + sentence.answer + sentence.after
    };
  }

  function mount(container, config, hooks) {
    hooks = hooks || {};
    var opts = Object.assign({
      pinyin: true, challenge: false, duration: 60, rounds: 10,
      battleTarget: 4, battleType: 'mix', randomNumbers: true, speak: true
    }, config.options || {});
    var mws = (config.mws || []).slice();
    var items = (config.items || []).filter(function (it) { return mws.indexOf(it.mw) !== -1; });
    var sentences = config.sentences || [];

    var state = null;
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() {
      timers.forEach(clearTimeout); timers = [];
      if (state && state.tick) clearInterval(state.tick);
    }

    var stage = document.createElement('div');
    stage.className = 'mw-stage' + (opts.pinyin ? '' : ' mw-no-pinyin');
    container.innerHTML = '';
    container.appendChild(stage);

    // 题库太小 → 出题会一直重复；这里只在完全没词时报错。
    function pool() {
      var core = items.filter(function (it) { return !it.challenge; });
      var challenge = items.filter(function (it) { return it.challenge; });
      if (!opts.challenge || !challenge.length) return core.length ? core : challenge;
      // 打开挑战词：约三分之一的题是挑战词
      return Math.random() < 0.35 || !core.length ? challenge : core;
    }

    function nextItem() {
      var list = pool();
      var item = pick(list);
      if (list.length > 1 && state.last && item === state.last) item = pick(list);
      state.last = item;
      return item;
    }

    function makeQuestion(kind) {
      if (kind === 'noun') return nounQuestion(nextItem());
      if (sentences.length && (!items.length || kind === 'custom' || Math.random() < 0.75)) {
        var s = pick(sentences);
        if (sentences.length > 1 && s === state.lastSentence) s = pick(sentences);
        state.lastSentence = s;
        return sentenceFromCustom(s, opts.randomNumbers);
      }
      return sentenceFromItem(nextItem());
    }

    // 按钮：量词不多时全部显示（位置和颜色固定，方便记忆）；多了就取答案 + 4 个干扰项。
    function choicesFor(q) {
      var all = mws.slice();
      if (all.indexOf(q.answer) === -1) all.push(q.answer);
      var list = all;
      if (all.length > 6) {
        var distractors = shuffle(all.filter(function (m) { return m !== q.answer && q.alts.indexOf(m) === -1; })).slice(0, 4);
        list = [q.answer].concat(distractors);
      }
      return list.sort(function (a, b) { return orderOf(a) - orderOf(b); });
    }

    function mwButton(mw, extraClass) {
      var m = metaFor(mw);
      return '<button type="button" class="mw-choice ' + (extraClass || '') + '" data-mw="' + esc(mw) + '" style="--mw-color:' + m.color + '">' +
        '<span class="mw-choice-char">' + esc(mw) + '</span><span class="mw-py">' + esc(m.py) + '</span></button>';
    }

    function chip(mw) {
      var m = metaFor(mw);
      return '<span class="mw-chip" style="--mw-color:' + m.color + '">' + esc(mw) + '</span>';
    }

    function blankHtml(q, filled) {
      if (!filled) return '<span class="mw-blank">（　）</span>';
      return '<span class="mw-blank mw-filled" style="--mw-color:' + metaFor(filled).color + '">' + esc(filled) + '</span>';
    }

    function questionHtml(q, filled) {
      var badge = q.challenge ? '<span class="mw-badge">⭐ 挑战词 Challenge</span>' : '';
      if (q.type === 'noun') {
        var icon = q.item.emoji ? '<div class="mw-emoji" aria-hidden="true">' + esc(q.item.emoji) + '</div>' : '';
        return badge + icon +
          '<div class="mw-noun-line"><span class="mw-num">一</span>' + blankHtml(q, filled) + '<span class="mw-noun">' + esc(q.item.noun) + '</span></div>' +
          '<div class="mw-py mw-noun-py">yī ___ ' + esc(pinyin(q.item.noun)) + '</div>';
      }
      var icon2 = q.item && q.item.emoji ? '<div class="mw-emoji mw-emoji-small" aria-hidden="true">' + esc(q.item.emoji) + '</div>' : '';
      return badge + icon2 +
        '<div class="mw-sentence">' + esc(q.before) + blankHtml(q, filled) + esc(q.after) + '</div>' +
        '<div class="mw-py mw-sentence-py">' + esc(pinyin(q.before)) + ' ___ ' + esc(pinyin(q.after)) + '</div>';
    }

    function hintHtml(q, picked) {
      var m = metaFor(q.answer);
      var html = '<div class="mw-hint" style="--mw-color:' + m.color + '">';
      html += '<strong>' + esc(q.answer) + '</strong>';
      if (m.rule) html += ' → ' + esc(m.rule) + ' <small>(' + esc(m.ruleEn) + ')</small>';
      if (picked && picked !== q.answer) {
        var pm = metaFor(picked);
        if (pm.rule) html += '<div class="mw-hint-wrong">' + esc(picked) + ' → ' + esc(pm.rule) + '</div>';
      }
      return html + '</div>';
    }

    function toolbar(title, extra) {
      return '<div class="mw-bar">' +
        '<button type="button" class="mw-tool" data-act="exit">← 返回 Back</button>' +
        '<div class="mw-bar-title">' + title + '</div>' +
        '<div class="mw-bar-tools">' + (extra || '') +
        '<button type="button" class="mw-tool" data-act="pinyin" aria-pressed="' + opts.pinyin + '">拼音 Pinyin</button>' +
        '<button type="button" class="mw-tool" data-act="fullscreen">⛶ 全屏</button>' +
        '</div></div>';
    }

    // ---------- 统计 ----------
    function newStats() { return { answered: 0, correct: 0, byMw: {}, confusions: {}, missed: [] }; }
    function record(q, picked) {
      var s = state.stats;
      var ok = picked === q.answer || q.alts.indexOf(picked) !== -1;
      s.answered++;
      var row = s.byMw[q.answer] || (s.byMw[q.answer] = { seen: 0, correct: 0 });
      row.seen++;
      if (ok) { s.correct++; row.correct++; }
      else {
        var key = q.answer + '→' + picked;
        s.confusions[key] = (s.confusions[key] || 0) + 1;
        var label = q.type === 'noun' ? '一' + q.answer + q.item.noun : q.before + q.answer + q.after;
        if (s.missed.indexOf(label) === -1) s.missed.push(label);
      }
      return ok;
    }

    // ---------- 抓量词 Catch It ----------
    function startCatch() {
      state = { mode: 'catch', stats: newStats(), score: 0, streak: 0, best: 0, timeLeft: opts.duration, locked: false };
      stage.innerHTML = toolbar('🎯 抓量词 Catch It') +
        '<div class="mw-hud"><div class="mw-hud-item">⏱ <strong data-el="time">' + opts.duration + '</strong>s</div>' +
        '<div class="mw-hud-item">分数 Score <strong data-el="score">0</strong></div>' +
        '<div class="mw-hud-item mw-combo" data-el="combo"></div></div>' +
        '<div class="mw-timebar"><span data-el="timebar"></span></div>' +
        '<div class="mw-card" data-el="card"></div>' +
        '<div class="mw-feedback" data-el="feedback" aria-live="polite"></div>' +
        '<div class="mw-choices" data-el="choices"></div>';
      state.tick = setInterval(function () {
        state.timeLeft--;
        el('time').textContent = Math.max(0, state.timeLeft);
        el('timebar').style.width = (Math.max(0, state.timeLeft) / opts.duration * 100) + '%';
        if (state.timeLeft <= 0) finish();
      }, 1000);
      el('timebar').style.width = '100%';
      askCatch();
    }

    function askCatch() {
      state.q = makeQuestion('noun');
      state.locked = false;
      el('card').innerHTML = questionHtml(state.q);
      el('feedback').innerHTML = '';
      el('choices').innerHTML = choicesFor(state.q).map(function (m) { return mwButton(m); }).join('');
    }

    function answerCatch(picked, button) {
      if (state.locked) return;
      state.locked = true;
      var q = state.q;
      var ok = record(q, picked);
      el('card').innerHTML = questionHtml(q, q.answer);
      markChoices(q, picked);
      if (ok) {
        state.streak++;
        state.best = Math.max(state.best, state.streak);
        var mult = state.streak >= 6 ? 3 : state.streak >= 3 ? 2 : 1;
        state.score += 10 * mult;
        el('score').textContent = state.score;
        el('combo').innerHTML = mult > 1 ? '🔥 Combo ×' + mult : '';
        el('feedback').innerHTML = '<div class="mw-good">✓ ' + esc(q.speakText) + (mult > 1 ? ' <span>+' + 10 * mult + '</span>' : '') + '</div>';
        if (opts.speak) speak(q.speakText);
        later(askCatch, 650);
      } else {
        state.streak = 0;
        el('combo').innerHTML = '';
        el('feedback').innerHTML = hintHtml(q, picked);
        if (opts.speak) speak(q.speakText);
        later(askCatch, 1900);
      }
      if (button) button.blur();
    }

    function markChoices(q, picked) {
      stage.querySelectorAll('.mw-choice').forEach(function (b) {
        var m = b.getAttribute('data-mw');
        b.disabled = true;
        if (m === q.answer) b.classList.add('is-correct');
        else if (m === picked) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
    }

    // ---------- 填句子 Fill the Sentence ----------
    function startFill() {
      state = { mode: 'fill', stats: newStats(), index: 0, locked: false };
      stage.innerHTML = toolbar('✏️ 填句子 Fill the Sentence', '<button type="button" class="mw-tool" data-act="say">🔊 朗读</button>') +
        '<div class="mw-hud"><div class="mw-hud-item">第 <strong data-el="index">1</strong> / ' + opts.rounds + ' 题</div>' +
        '<div class="mw-hud-item">答对 Correct <strong data-el="score">0</strong></div></div>' +
        '<div class="mw-timebar mw-progress"><span data-el="timebar"></span></div>' +
        '<div class="mw-card mw-card-sentence" data-el="card"></div>' +
        '<div class="mw-feedback" data-el="feedback" aria-live="polite"></div>' +
        '<div class="mw-choices" data-el="choices"></div>' +
        '<div class="mw-next-row"><button type="button" class="mw-next" data-act="next" hidden>下一题 Next →</button></div>';
      askFill();
    }

    function askFill() {
      if (state.index >= opts.rounds) return finish();
      state.q = makeQuestion('sentence');
      state.locked = false;
      el('index').textContent = state.index + 1;
      el('timebar').style.width = (state.index / opts.rounds * 100) + '%';
      el('card').innerHTML = questionHtml(state.q);
      el('feedback').innerHTML = '';
      el('choices').innerHTML = choicesFor(state.q).map(function (m) { return mwButton(m); }).join('');
      stage.querySelector('[data-act="next"]').hidden = true;
    }

    function answerFill(picked) {
      if (state.locked) return;
      state.locked = true;
      var q = state.q;
      var ok = record(q, picked);
      state.index++;
      el('score').textContent = state.stats.correct;
      el('timebar').style.width = (state.index / opts.rounds * 100) + '%';
      el('card').innerHTML = questionHtml(q, q.answer);
      markChoices(q, picked);
      if (opts.speak) speak(q.speakText);
      if (ok) {
        el('feedback').innerHTML = '<div class="mw-good">✓ 对了！Correct!</div>';
        later(askFill, 1500);
      } else {
        el('feedback').innerHTML = hintHtml(q, picked);
        var next = stage.querySelector('[data-act="next"]');
        next.hidden = false;
        next.focus();
      }
    }

    // ---------- 全班对战 Team Battle ----------
    function startBattle() {
      state = { mode: 'battle', stats: newStats(), red: 0, blue: 0, pos: 0, revealed: false, over: false };
      stage.innerHTML = toolbar('⚔️ 全班对战 Team Battle', '<button type="button" class="mw-tool" data-act="say">🔊 朗读</button>') +
        '<div class="mw-tug">' +
        '<div class="mw-team mw-red"><span>🔴 红队 Red</span><strong data-el="red">0</strong></div>' +
        '<div class="mw-rope-wrap"><div class="mw-rope-track">' +
        '<span class="mw-goal mw-goal-red"></span><span class="mw-goal mw-goal-blue"></span><span class="mw-center"></span>' +
        '<div class="mw-rope" data-el="rope"><span class="mw-flag">🚩</span></div></div>' +
        '<div class="mw-tug-note">先把旗子拉过线的队赢 · First to pull the flag ' + opts.battleTarget + ' steps wins</div></div>' +
        '<div class="mw-team mw-blue"><span>🔵 蓝队 Blue</span><strong data-el="blue">0</strong></div>' +
        '</div>' +
        '<div class="mw-card mw-card-sentence" data-el="card"></div>' +
        '<div class="mw-feedback" data-el="feedback" aria-live="polite"></div>' +
        '<div class="mw-legend" data-el="legend"></div>' +
        '<div class="mw-judge">' +
        '<button type="button" class="mw-judge-btn mw-judge-red" data-act="red">🔴 红队答对</button>' +
        '<button type="button" class="mw-judge-btn mw-judge-reveal" data-act="reveal">👀 看答案</button>' +
        '<button type="button" class="mw-judge-btn mw-judge-skip" data-act="skip">⏭ 跳过</button>' +
        '<button type="button" class="mw-judge-btn mw-judge-blue" data-act="blue">🔵 蓝队答对</button>' +
        '</div>' +
        '<div class="mw-next-row"><button type="button" class="mw-tool" data-act="endBattle">🏁 结束比赛 End game</button></div>';
      askBattle();
    }

    function askBattle() {
      var kind = opts.battleType === 'mix' ? (Math.random() < 0.5 ? 'noun' : 'sentence') : opts.battleType;
      if (kind === 'noun' && !items.length) kind = 'sentence';
      state.q = makeQuestion(kind);
      state.revealed = false;
      state.busy = false;
      el('card').innerHTML = questionHtml(state.q);
      el('feedback').innerHTML = '';
      el('legend').innerHTML = choicesFor(state.q).map(function (m) {
        var meta = metaFor(m);
        return '<span class="mw-legend-item" style="--mw-color:' + meta.color + '"><b>' + esc(m) + '</b><span class="mw-py">' + esc(meta.py) + '</span></span>';
      }).join('');
    }

    function revealBattle() {
      if (state.revealed) return;
      state.revealed = true;
      el('card').innerHTML = questionHtml(state.q, state.q.answer);
      el('feedback').innerHTML = hintHtml(state.q);
      el('legend').querySelectorAll('.mw-legend-item').forEach(function (node) {
        node.classList.toggle('is-answer', node.querySelector('b').textContent === state.q.answer);
      });
      if (opts.speak) speak(state.q.speakText);
    }

    function award(team) {
      if (state.over || state.busy) return;
      state.busy = true;
      if (team) {
        state[team]++;
        state.pos += team === 'red' ? -1 : 1;
        el(team).textContent = state[team];
        var rope = el('rope');
        rope.style.setProperty('--pos', state.pos / opts.battleTarget);
        rope.classList.remove('is-pulling-red', 'is-pulling-blue');
        void rope.offsetWidth;
        rope.classList.add(team === 'red' ? 'is-pulling-red' : 'is-pulling-blue');
      }
      revealBattle();
      if (Math.abs(state.pos) >= opts.battleTarget) {
        state.over = true;
        later(finish, 1600);
        return;
      }
      later(askBattle, team ? 1700 : 900);
    }

    // ---------- 结束画面 ----------
    function finish() {
      clearTimers();
      var s = state.stats;
      var accuracy = s.answered ? Math.round(s.correct / s.answered * 100) : 0;
      var head;
      if (state.mode === 'battle') {
        var winner = state.red === state.blue ? '平局！Tie!' : state.red > state.blue ? '🔴 红队赢了！Red wins!' : '🔵 蓝队赢了！Blue wins!';
        head = '<div class="mw-result-big">' + winner + '</div><div class="mw-result-sub">红队 ' + state.red + ' : ' + state.blue + ' 蓝队</div>';
      } else if (state.mode === 'catch') {
        head = '<div class="mw-result-big">' + state.score + ' 分</div><div class="mw-result-sub">答对 ' + s.correct + ' / ' + s.answered + ' · 正确率 ' + accuracy + '% · 最长连对 ' + state.best + '</div>';
      } else {
        head = '<div class="mw-result-big">' + s.correct + ' / ' + s.answered + '</div><div class="mw-result-sub">正确率 Accuracy ' + accuracy + '%</div>';
      }

      var confusions = Object.keys(s.confusions).map(function (k) { return { key: k, n: s.confusions[k] }; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
      var confusionHtml = confusions.length
        ? confusions.map(function (c) {
          var parts = c.key.split('→');
          return '<li>该用 ' + chip(parts[0]) + ' 却选了 ' + chip(parts[1]) + ' <b>×' + c.n + '</b></li>';
        }).join('')
        : '<li class="mw-empty">没有错！No mix-ups 🎉</li>';

      var rows = Object.keys(s.byMw).sort(function (a, b) { return orderOf(a) - orderOf(b); }).map(function (mw) {
        var r = s.byMw[mw];
        var pct = Math.round(r.correct / r.seen * 100);
        return '<div class="mw-bar-row">' + chip(mw) + '<div class="mw-bar-track"><span style="width:' + pct + '%;--mw-color:' + metaFor(mw).color + '"></span></div><b>' + r.correct + '/' + r.seen + '</b></div>';
      }).join('');

      var missed = s.missed.slice(0, 12).map(function (t) {
        return '<button type="button" class="mw-missed" data-say="' + esc(t) + '">🔊 ' + esc(t) + '</button>';
      }).join('');

      var showStats = state.mode !== 'battle' || s.answered > 0;
      stage.innerHTML = toolbar('🏆 结果 Results') +
        '<div class="mw-results">' + head +
        (showStats && s.answered ? '<div class="mw-result-grid">' +
          '<section><h3>最容易错的量词 · Most mixed up</h3><ul class="mw-confusions">' + confusionHtml + '</ul></section>' +
          '<section><h3>每个量词 · By measure word</h3>' + rows + '</section></div>' : '') +
        (missed ? '<section class="mw-missed-wrap"><h3>再读一遍 · Review these</h3>' + missed + '</section>' : '') +
        '<div class="mw-result-actions">' +
        '<button type="button" class="mw-next" data-act="again">🔁 再玩一次 Play again</button>' +
        '<button type="button" class="mw-tool" data-act="exit">换模式 Change mode</button></div></div>';
      var finished = { mode: state.mode, score: state.score || 0 };
      state.mode = 'done:' + state.mode;
      if (typeof hooks.onFinish === 'function') hooks.onFinish(s, finished);
    }

    function el(name) { return stage.querySelector('[data-el="' + name + '"]'); }

    // ---------- 事件 ----------
    stage.addEventListener('click', function (event) {
      var choice = event.target.closest('.mw-choice');
      if (choice && state) {
        var picked = choice.getAttribute('data-mw');
        if (state.mode === 'catch') answerCatch(picked, choice);
        else if (state.mode === 'fill') answerFill(picked);
        return;
      }
      var say = event.target.closest('[data-say]');
      if (say) { speak(say.getAttribute('data-say')); return; }
      var act = event.target.closest('[data-act]');
      if (!act) return;
      switch (act.getAttribute('data-act')) {
        case 'exit': destroy(); if (hooks.onExit) hooks.onExit(); break;
        case 'pinyin':
          opts.pinyin = !opts.pinyin;
          stage.classList.toggle('mw-no-pinyin', !opts.pinyin);
          act.setAttribute('aria-pressed', String(opts.pinyin));
          if (hooks.onOption) hooks.onOption('pinyin', opts.pinyin);
          break;
        case 'fullscreen':
          if (document.fullscreenElement) document.exitFullscreen();
          else if (container.requestFullscreen) container.requestFullscreen().catch(function () {});
          break;
        // 还没作答时只读空格两边，不把答案读出来
        case 'say': if (state && state.q) speak(state.revealed || state.locked ? state.q.speakText : state.q.before + '，' + state.q.after); break;
        case 'next': askFill(); break;
        case 'red': award('red'); break;
        case 'blue': award('blue'); break;
        case 'skip': award(null); break;
        case 'reveal': revealBattle(); break;
        case 'endBattle': state.over = true; finish(); break;
        case 'again': start(state.mode.replace('done:', '')); break;
      }
    });

    // 键盘：数字键 1–9 选量词（自己练习时更快）
    function onKey(event) {
      if (!state || (state.mode !== 'catch' && state.mode !== 'fill')) return;
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      var n = parseInt(event.key, 10);
      if (!n) return;
      var buttons = stage.querySelectorAll('.mw-choice');
      if (buttons[n - 1] && !buttons[n - 1].disabled) buttons[n - 1].click();
    }
    document.addEventListener('keydown', onKey);

    function start(mode) {
      clearTimers();
      if (mode === 'catch') startCatch();
      else if (mode === 'fill') startFill();
      else startBattle();
    }

    function destroy() {
      clearTimers();
      document.removeEventListener('keydown', onKey);
      if (global.speechSynthesis) global.speechSynthesis.cancel();
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    }

    return { start: start, destroy: destroy };
  }

  // 解析老师自己的句子：「教室里有二十（张）桌子。」→ { before, answer, after }
  function parseSentences(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var m = line.trim().match(/^(.*?)[（(]\s*([㐀-鿿]{1,2})\s*[）)](.*)$/);
      if (!m) return null;
      return { before: m[1].trim(), answer: m[2], after: m[3].trim() };
    }).filter(Boolean);
  }

  // 解析老师自己的词：一行一个「名词 量词 [emoji]」，量词可写 把/张 表示两个都对。
  function parseWords(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var parts = line.trim().split(/[\s,，、]+/).filter(Boolean);
      if (parts.length < 2) return null;
      var noun = parts[0];
      var mwParts = parts[1].split(/[\/／|]/).filter(Boolean);
      if (!/^[㐀-鿿]{1,8}$/.test(noun) || !mwParts.length || mwParts.some(function (m) { return !/^[㐀-鿿]{1,2}$/.test(m); })) return null;
      var item = { noun: noun, mw: mwParts[0], kind: guessKind(mwParts[0]), emoji: parts[2] || '', custom: true };
      if (mwParts.length > 1) item.alt = mwParts.slice(1);
      return item;
    }).filter(Boolean);
  }

  function guessKind(mw) {
    return { '门': 'course', '只': 'animal', '头': 'animal', '位': 'person', '台': 'big', '辆': 'big', '座': 'nature', '棵': 'nature', '件': 'clothes', '双': 'clothes', '杯': 'food', '块': 'food' }[mw] || 'thing';
  }

  global.MWGame = { mount: mount, metaFor: metaFor, parseSentences: parseSentences, parseWords: parseWords, speak: speak, pinyin: pinyin };
})(window);
