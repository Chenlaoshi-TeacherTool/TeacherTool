/*
 * 学生设计桌游 — projector page for the student-designed board games.
 * Shared card/team/setup code lives in escape-the-path-core.js (Core); each
 * game's board and rules live in its own core (G): EscapePathCore, CandyRaceCore.
 * This file handles the setup form, the board, tokens, dice and question cards.
 */
(function () {
  'use strict';

  var Core = window.EscapePathCore;
  var GAMES = { 'escape-the-path': window.EscapePathCore, 'candy-race': window.CandyRaceCore, 'escape-classroom': window.EscapeClassroomCore, 'mochi': window.MochiCore, 'space': window.SpaceCore, 'money': window.MoneyCore, 'mpy': window.MpyCore, 'maze': window.MazeCore, 'sweets': window.SweetsCore };
  var IMAGES = { 'escape-the-path': '/low-prep/escape-the-path/board.webp?v=3', 'candy-race': '/low-prep/candy-race/board.webp?v=6', 'escape-classroom': '/low-prep/escape-classroom/board.webp?v=3', 'mochi': '/low-prep/mochi/board.webp?v=2', 'space': '/low-prep/space/board.webp?v=1', 'money': '/low-prep/money/board.webp?v=2', 'mpy': '/low-prep/mpy/board.webp?v=1', 'maze': '/low-prep/maze/board.webp?v=1', 'sweets': '/low-prep/sweets/board.webp?v=1' };
  var NAMES = { 'escape-the-path': 'Escape the Path', 'candy-race': 'Candy Race', 'escape-classroom': 'Escape the Classroom', 'mochi': 'Mochi Salamander Escape', 'space': '太大一', 'money': '汉字大富翁', 'mpy': 'MPY', 'maze': 'Maze 迷宫', 'sweets': '糖果乐园' };
  var G = Core;          // the game being played
  var isCandy = false;
  var isClass = false;
  var isMochi = false;
  var isSpace = false;
  var isMoney = false;   // 汉字大富翁 and MPY (buy-the-land games)
  var isMpy = false;
  var isMaze = false;
  var CUR = '$';
  function levelText(n) { var l = G.LEVELS[n]; return l && l.emoji ? l.emoji + ' ' + L(l.en, l.zh) : ''; }
  function actionName(card) { return zh ? { again: '再走一次', shield: '盾牌', swap: '和最前面的队换位置', push: '让最前面的队退一格' }[card] : { again: 'Move twice', shield: 'Shield', swap: 'Swap with the leading team', push: 'Push the leading team back' }[card]; }
  var teacherEl = null;
  var shownTeacher = -1;
  var Words = window.ChenWordlist;
  var zh = document.documentElement.lang.indexOf('zh') === 0;
  function L(en, cn) { return zh ? cn : en; }
  function $(id) { return document.getElementById(id); }

  var DRAFT_KEY = 'escape-the-path:draft:v1';
  var STEP_MS = 260;
  var SAMPLE = [
    '请读出「客厅」。| kè tīng',
    '「书架」是什么意思？| bookshelf',
    '请用「旁边」说一句话。| 桌子旁边有一把椅子。',
    '说一说，你的房间里有什么？',
    '一（把／张）椅子？| 一把椅子',
    '请用「左边」问一个问题。| 门的左边有什么？',
    '「窗户」怎么读？| chuāng hu',
    '用中文怎么说：sofa？| 沙发 shā fā'
  ].join('\n');
  var FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  var deck = [];
  var pile = [];
  var game = null;
  var settings = null;
  var shown = {};      // team id → { at: 'sq', i } | { at: 'jail' } | { at: 'place', n }
  var busy = false;
  var cedictReady = false;
  var zhScript = null;
  var tokenEls = [];

  // ---------- setup form ----------
  function radio(name) {
    var input = document.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : '';
  }
  function setRadio(name, value) {
    var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }
  function types() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="epType"]:checked')).map(function (el) { return el.value; });
  }
  function names() {
    return Array.prototype.slice.call(document.querySelectorAll('#epNames input')).map(function (el) { return el.value.trim(); });
  }

  var typedNames = [];
  function renderNames() {
    var count = Number(radio('epTeams')) || 4;
    var current = names();
    current.forEach(function (name, i) { typedNames[i] = name; });
    var box = $('epNames');
    box.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var team = Core.TEAMS[i];
      var label = document.createElement('label');
      label.className = 'ep-name';
      label.style.setProperty('--team', team.color);
      var face = document.createElement('span');
      face.className = 'ep-token-face';
      face.textContent = team.emoji;
      var input = document.createElement('input');
      input.className = 'ep-input';
      input.maxLength = Core.LIMITS.name;
      input.placeholder = zh ? team.zh : team.en;
      input.value = typedNames[i] || '';
      input.setAttribute('aria-label', L('Team ' + (i + 1) + ' name', '第 ' + (i + 1) + ' 队队名'));
      input.addEventListener('input', saveDraft);
      label.appendChild(face);
      label.appendChild(input);
      box.appendChild(label);
    }
  }

  function showSource() {
    var words = radio('epSource') === 'words';
    $('epOwnBox').hidden = words;
    $('epWordsBox').hidden = !words;
    if (words && !cedictReady && Words && Words.loadCedict) {
      Words.loadCedict().catch(function () {}).then(function () { cedictReady = true; countCards(); });
    }
    countCards();
  }

  // Only Escape the Path has the answer-your-way-out-of-jail option; each game has its own rules list.
  function showGame() {
    var id = radio('epGame') || 'escape-the-path';
    $('epJailField').hidden = id !== 'escape-the-path';
    $('epDeskField').hidden = id !== 'escape-classroom';
    $('epLapsField').hidden = id !== 'money' && id !== 'mpy';
    Array.prototype.forEach.call(document.querySelectorAll('.ep-rules ol[data-game]'), function (ol) {
      ol.hidden = ol.dataset.game !== id;
    });
  }

  function buildDeck() {
    if (radio('epSource') === 'words') {
      var items = Words ? Words.parseText($('epWords').value) : [];
      return Core.wordCards(items, types(), zh);
    }
    return Core.parseCards($('epCards').value || SAMPLE);
  }

  function countCards() {
    var n = buildDeck().length;
    var sample = radio('epSource') === 'own' && !$('epCards').value.trim();
    $('epCount').textContent = sample
      ? L('Using ' + n + ' sample cards.', '将使用 ' + n + ' 张示例题卡。')
      : L(n + (n === 1 ? ' card' : ' cards') + ' ready.', '共 ' + n + ' 张题卡。');
  }

  function readSetup() {
    return Core.normalize({
      source: radio('epSource'), cards: $('epCards').value, words: $('epWords').value,
      types: types(), teams: radio('epTeams'), names: names(), jail: radio('epJail'), game: radio('epGame'), desk: radio('epDesk'), deskWords: $('epDeskWords').value, laps: radio('epLaps')
    });
  }

  function writeSetup(data) {
    var d = Core.normalize(data);
    setRadio('epSource', d.source);
    $('epCards').value = d.cards;
    $('epWords').value = d.words;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epType"]'), function (el) {
      el.checked = d.types.indexOf(el.value) !== -1;
    });
    setRadio('epTeams', d.teams);
    setRadio('epJail', d.jail);
    setRadio('epGame', d.game);
    setRadio('epDesk', d.desk);
    $('epDeskWords').value = d.deskWords;
    setRadio('epLaps', d.laps);
    showGame();
    typedNames = d.names.slice();
    var inputs = document.querySelectorAll('#epNames input');
    Array.prototype.forEach.call(inputs, function (el) { el.value = ''; });
    renderNames();
    showSource();
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readSetup())); } catch (e) { /* private mode */ }
    countCards();
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (raw) writeSetup(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  // ---------- board geometry ----------
  function pct(point) {
    return { left: point[0] / G.FRAME.w * 100, top: point[1] / G.FRAME.h * 100 };
  }

  // CSS sizes the board to its area (container query units); this only sets the shape.
  function fitBoard() {
    $('epBoard').style.setProperty('--ratio', G.FRAME.w / G.FRAME.h);
  }

  function spotOf(id) {
    var s = shown[id];
    if (s.at === 'jail') return G.SPOTS.jail;
    if (s.at === 'place') return s.n <= 3 ? G.SPOTS.podium[s.n - 1] : G.SPOTS.lots[Math.min(2, s.n - 4)];
    return G.BOARD[s.i];
  }
  function keyOf(id) {
    var s = shown[id];
    return s.at === 'sq' ? 'sq' + s.i : s.at === 'jail' ? 'jail' : 'place' + s.n;
  }

  function placeTokens() {
    if (!game) return;
    var groups = {};
    game.teams.forEach(function (team) {
      var key = keyOf(team.id);
      (groups[key] = groups[key] || []).push(team.id);
    });
    var active = G.current(game).id;
    game.teams.forEach(function (team) {
      var key = keyOf(team.id);
      var group = groups[key];
      var k = group.indexOf(team.id);
      var n = group.length;
      var base = spotOf(team.id);
      var spread = key === 'jail' ? 62 : 36;
      var cols = key === 'jail' ? 3 : Math.min(n, 3);
      var row = Math.floor(k / cols);
      var col = k % cols;
      var inRow = Math.min(cols, n - row * cols);
      var x = base[0] + (col - (inRow - 1) / 2) * spread;
      var y = base[1] + (n > cols ? (row - (Math.ceil(n / cols) - 1) / 2) * spread : (n > 1 && key !== 'jail' ? (k % 2 ? 12 : -12) : 0));
      var p = pct([x, y]);
      var el = tokenEls[team.id];
      el.style.left = p.left + '%';
      el.style.top = p.top + '%';
      el.classList.toggle('is-active', team.id === active && game.phase !== 'over');
    });
    if (teacherEl) {
      var tp = pct(G.BOARD[shownTeacher]);
      teacherEl.style.left = tp.left + '%';
      teacherEl.style.top = tp.top + '%';
    }
    var current = G.current(game);
    var target = $('epTarget');
    if (game.phase !== 'over' && shown[current.id].at === 'sq') {
      var sq = G.BOARD[shown[current.id].i];
      target.setAttribute('cx', sq[0]);
      target.setAttribute('cy', sq[1]);
      target.style.stroke = Core.TEAMS[current.id].color;
    } else {
      target.setAttribute('cx', -100);
    }
  }

  function syncShown() {
    game.teams.forEach(function (team) {
      shown[team.id] = team.place ? { at: 'place', n: team.place } : team.jail ? { at: 'jail' } : { at: 'sq', i: team.pos };
    });
  }

  function makeTokens() {
    var box = $('epTokens');
    box.innerHTML = '';
    tokenEls = game.teams.map(function (team) {
      var el = document.createElement('span');
      el.className = 'ep-token';
      el.style.setProperty('--team', Core.TEAMS[team.id].color);
      el.textContent = Core.TEAMS[team.id].emoji;
      el.title = team.name;
      box.appendChild(el);
      return el;
    });
    teacherEl = null;
    if (game.teacher != null) {
      teacherEl = document.createElement('span');
      teacherEl.className = 'ep-token ep-teacher';
      teacherEl.textContent = '👩‍🏫';
      teacherEl.title = L('Teacher', '老师');
      box.appendChild(teacherEl);
      shownTeacher = game.teacher;
    }
  }

  // ---------- side panel ----------
  function teamLabel(team) {
    return Core.TEAMS[team.id].emoji + ' ' + team.name;
  }

  function renderSide() {
    var team = G.current(game);
    var over = game.phase === 'over';
    $('epTurnToken').textContent = over ? '🏆' : Core.TEAMS[team.id].emoji;
    $('epTurnBox').style.setProperty('--team', over ? '#20473a' : Core.TEAMS[team.id].color);
    $('epTurnName').textContent = over ? L('Game over', '游戏结束') : team.name;

    var real = $('epRealDie').checked;
    var phase = busy ? 'busy' : game.phase;
    $('epRoll').hidden = phase !== 'roll' || real;
    $('epManual').hidden = phase !== 'roll' || !real;
    $('epDie').disabled = phase !== 'roll' || real;
    $('epChallenge').hidden = phase !== 'jail' || !G.canChallenge(game);
    $('epChallenge').textContent = '🔓 ' + L('Try ' + game.jailQuestions + (game.jailQuestions === 1 ? ' card' : ' cards in a row'), '挑战连答 ' + game.jailQuestions + ' 题');
    $('epWait').hidden = phase !== 'jail';
    $('epBuy').hidden = !((isCandy || isMochi) && phase === 'roll' && G.canBuy(game));
    if (isMochi && !$('epBuy').hidden) $('epBuy').textContent = '🃏 ' + L('Use action card: ', '用动作卡：') + actionName(G.nextAction(game));
    if (isMochi) $('epRoll').textContent = '🎴 ' + L('Flip a colour card', '翻颜色卡');
    $('epUseRv').hidden = !((isCandy || isClass || isMpy) && phase === 'jail' && G.canUseRv(game));
    if (isMpy) $('epUseRv').textContent = '💵 ' + L('Pay M50 to get out', '付 M50 马上出狱');
    if (isClass) $('epUseRv').textContent = '🎉 ' + L('Play a Yay card (' + team.yay + ' left)', '用 Yay 卡出狱（还剩 ' + team.yay + ' 张）');
    if (isCandy) $('epUseRv').textContent = '🚐 ' + L('Drive out in the RV (' + team.rv + ' left)', '开房车出狱（还剩 ' + team.rv + ' 次）');
    renderFork(phase);
    $('epNext').hidden = phase !== 'next';
    $('epEndGame').hidden = !isMoney || game.phase === 'over';
    if (isMoney) drawMarks();

    var list = $('epTeamList');
    list.innerHTML = '';
    game.teams.forEach(function (t) {
      var li = document.createElement('li');
      li.style.setProperty('--team', Core.TEAMS[t.id].color);
      if (t.id === team.id && !over) li.className = 'is-current';
      var face = document.createElement('span');
      face.className = 'ep-token-face';
      face.textContent = Core.TEAMS[t.id].emoji;
      var name = document.createElement('span');
      name.className = 'ep-team-name';
      name.textContent = t.name;
      var info = document.createElement('span');
      info.className = 'ep-team-info';
      info.textContent = t.place ? (['🥇', '🥈', '🥉'][t.place - 1] || '#' + t.place)
        : t.jail ? '🔒 ' + L(t.jail + ' left', '还剩 ' + t.jail + ' 轮')
          : isCandy ? '💰 $' + t.money + (t.rv ? ' · 🚐' + t.rv : '')
            : isMaze ? '💰 $' + t.money + ' · ' + L('square ' + t.pos, '第 ' + t.pos + ' 格') + (t.skip ? ' ⏭' : '')
            : isMoney ? (t.out ? '💥 ' + L('Out', '破产') : '💰 ' + CUR + t.money + ' · ' + L('lap ', '第 ') + Math.min(game.laps, t.laps + 1) + L('/' + game.laps, '/' + game.laps + ' 圈') + (t.done ? ' ✔' : '') + (t.skip ? ' ⏭' : ''))
            : isSpace ? (G.LEVELS[t.level].emoji ? G.LEVELS[t.level].emoji + ' ' : '') + L('Square ' + t.pos, '第 ' + t.pos + ' 格')
            : isMochi ? (t.rescued ? '🦎' + t.rescued + ' ' : '') + (t.shield ? '🛡️' + t.shield + ' ' : '') + (t.actions.length ? '🃏' + t.actions.length + ' ' : '') + L(G.DIST[t.pos] + ' to exit', '离出口 ' + G.DIST[t.pos] + ' 步')
            : isClass ? (t.shield ? '🛡️' + t.shield + ' ' : '') + (t.yay ? '🎉' + t.yay + ' ' : '') + L('Square ' + t.pos, '第 ' + t.pos + ' 格')
            : (t.skip ? '⏭ ' : '') + L('Square ' + t.pos, '第 ' + t.pos + ' 格');
      li.appendChild(face);
      li.appendChild(name);
      li.appendChild(info);
      list.appendChild(li);
    });
    placeTokens();
  }

  // Candy Race: at a fork the team picks a way. The bridge needs enough money.
  function renderFork(phase) {
    var box = $('epFork');
    box.innerHTML = '';
    box.hidden = phase !== 'fork';
    if (box.hidden) return;
    var team = G.current(game);
    var p = document.createElement('p');
    p.className = 'ep-fork-q';
    p.textContent = isMoney ? L(team.name + ', buy this land?', team.name + '，要买下这块地吗？') : L('Which way, ' + team.name + '?', team.name + '想往哪走？');
    box.appendChild(p);
    var shortest = Math.min.apply(null, game.options.map(function (o) { return G.DIST[o.to]; }));
    game.options.forEach(function (o) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ep-btn ep-btn-big';
      var name = o.label ? o.label : o.gate ? '🌉 ' + L('Bridge', '走桥') : G.DIST[o.to] === shortest ? '↘ ' + L('Short way', '近路') : '↗ ' + L('Long way', '远路');
      btn.textContent = o.gate && !o.ok ? name + L(' (needs $' + o.gate + ')', '（要 $' + o.gate + '）') : name;
      btn.disabled = !o.ok;
      btn.addEventListener('click', function () { if (!busy) play(G.choose(game, o.to)); });
      btn.addEventListener('mouseenter', function () { pointAt(o.to); });
      btn.addEventListener('focus', function () { pointAt(o.to); });
      box.appendChild(btn);
    });
  }

  // Move the dashed target ring to a square (previews a fork choice).
  function pointAt(i) {
    var sq = G.BOARD[i];
    $('epTarget').setAttribute('cx', sq[0]);
    $('epTarget').setAttribute('cy', sq[1]);
  }

  function status(text) { $('epStatus').textContent = text; }

  var toastTimer = 0;
  function toast(text, tone) {
    var el = $('epToast');
    el.textContent = text;
    el.className = 'ep-toast is-on' + (tone ? ' is-' + tone : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'ep-toast'; }, 2200);
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function walk(id, from, to) {
    var dir = to > from ? 1 : -1;
    for (var i = from; i !== to; i += dir) {
      shown[id] = { at: 'sq', i: i + dir };
      placeTokens();
      await sleep(reduceMotion ? 40 : STEP_MS);
    }
  }

  async function walkPath(id, path) {
    for (var i = 1; i < path.length; i++) {
      shown[id] = { at: 'sq', i: path[i] };
      placeTokens();
      await sleep(reduceMotion ? 40 : STEP_MS);
    }
  }

  async function jump(id, spot) {
    tokenEls[id].classList.add('is-long');
    shown[id] = spot;
    placeTokens();
    await sleep(reduceMotion ? 100 : 850);
    tokenEls[id].classList.remove('is-long');
  }

  // ---------- events ----------
  async function play(events) {
    busy = true;
    renderSide();
    for (var e = 0; e < events.length; e++) {
      var ev = events[e];
      var team = game.teams[ev.team];
      switch (ev.type) {
        case 'walk':
          status(isMaze && ev.steps ? L(team.name + ' rolled ' + ev.roll + ': ' + ev.steps + ' steps.', team.name + '掷出 ' + ev.roll + ' 点，走 ' + ev.steps + ' 格。')
            : L(team.name + ' rolled ' + ev.roll + '.', team.name + '掷出 ' + ev.roll + ' 点。'));
          if (ev.path) await walkPath(ev.team, ev.path);
          else await walk(ev.team, ev.from, ev.to);
          break;
        case 'fork':
          if (isMochi) {
            status(ev.mode === 'colour' ? L('Two squares are just as near. Choose one!', '两个格子一样近，选一个！')
              : ev.mode === 'extra' ? L('Bonus: take one more step.', '奖励：再走一格，选一个方向。') : L('Step to a neighbouring square.', '走到旁边的一个格子。'));
            break;
          }
          toast('🔀 ' + L('A fork! Which way?', '岔路！往哪走？'));
          status(L(team.name + ' reached a fork. ' + ev.steps + ' step' + (ev.steps === 1 ? '' : 's') + ' to go.', team.name + '走到岔路，还要走 ' + ev.steps + ' 步。'));
          break;
        case 'chose':
          break;
        case 'teacher':
          toast('👩‍🏫 ' + L('The teacher is coming!', '老师来了！'), 'bad');
          for (var tp2 = 1; tp2 < ev.path.length; tp2++) { shownTeacher = ev.path[tp2]; placeTokens(); await sleep(reduceMotion ? 60 : 380); }
          break;
        case 'caught':
          toast('😱 ' + L('Caught by the teacher!', '被老师抓到了！'), 'bad');
          await sleep(500);
          break;
        case 'shield':
          if (isMochi) { toast('🛡️ ' + L('The shield blocks the alarm!', '盾牌挡住了警报！'), 'good'); await sleep(500); break; }
          toast('🛡️ ' + L('The shield blocks the teacher!', '盾牌挡住了老师！'), 'good');
          status(L(team.name + ' is safe.', team.name + '安全了。'));
          await sleep(500);
          break;
        case 'special':
          toast({ shield: '🛡️ ' + L('Shield card! It blocks the teacher once.', '盾牌卡！能挡老师一次。'),
            bullet: '🚀 ' + L('Bullet card! Go one and a half tables.', '子弹卡！再走一张半桌子。'),
            dang: '💥 ' + L('Dang it! Off to prison.', 'Dang it！去监狱。'),
            yay: '🎉 ' + L('Yay card! Keep it to get out of prison.', 'Yay 卡！留着，进监狱时可以马上出来。') }[ev.card], ev.card === 'dang' ? 'bad' : 'good');
          await sleep(900);
          break;
        case 'yay':
          toast('🎉 ' + L('Yay! You got freed!', 'Yay！你自由了！'), 'good');
          break;
        case 'salary':
          toast('💵 ' + L('Passed the start: +' + CUR + '200', '经过起点：+' + CUR + '200'), 'good');
          await sleep(500);
          break;
        case 'done':
          status(L(team.name + ' finished all laps!', team.name + '走完所有圈数了！'));
          break;
        case 'offer':
          status(L('Correct! Buy this property for ' + CUR + ev.price + '?', '答对了！要花 ' + CUR + ev.price + ' 买下这块地吗？'));
          break;
        case 'bought':
          toast('🏠 ' + L(team.name + ' bought it!', team.name + '买下了这块地！'), 'good');
          drawMarks();
          break;
        case 'pass':
          status(L('Not buying this time.', '这次不买。'));
          break;
        case 'poor':
          toast(L('Correct, but not enough money to buy.', '答对了，可是钱不够买。'), 'bad');
          break;
        case 'lose':
          toast('💸 ' + L('-$' + ev.amount, '-$' + ev.amount), 'bad');
          status(L(team.name + ' now has $' + ev.money + '.', team.name + '现在有 $' + ev.money + '。'));
          break;
        case 'miss':
          if (isMaze) { toast(L('Not quite. Stay here.', '答错了，留在原地。'), 'bad'); break; }
          toast(L('Not quite. No money this time.', '答错了，这次没有钱。'), 'bad');
          break;
        case 'rent':
          toast('💸 ' + L(team.name + ' pays ' + CUR + ev.amount + ' rent to ' + game.teams[ev.owner].name, team.name + '付给' + game.teams[ev.owner].name + ' ' + CUR + ev.amount + ' 租金'), 'bad');
          await sleep(700);
          break;
        case 'bankrupt':
          toast('💥 ' + L(team.name + ' is out of money!', team.name + '破产了！'), 'bad');
          drawMarks();
          await sleep(700);
          break;
        case 'plane':
          toast('✈️ ' + L('Fly back to 起点!', '飞回起点！'), 'good');
          await sleep(500);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'earn':
          toast('💰 ' + L('Correct! +' + CUR + ev.amount, '答对了！+' + CUR + ev.amount), 'good');
          status(L(team.name + ' now has ' + CUR + ev.money + '.', team.name + '现在有 ' + CUR + ev.money + '。'));
          break;
        case 'hole':
          toast('🕳️ ' + L('Back ' + Math.abs(ev.steps || 6) + '!', '后退 ' + Math.abs(ev.steps || 6) + ' 格！'), 'bad');
          await sleep(500);
          await walk(ev.team, ev.from, ev.to);
          break;
        case 'web':
          toast('🕸️ ' + L('You died! Back to the start.', 'You died！回到起点。'), 'bad');
          await sleep(600);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'overshoot':
          toast('💥 ' + L('Too far! Back to the start of the diagonal.', '走过头了！回到对角线的起点。'), 'bad');
          await sleep(600);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'level':
          toast(levelText(ev.level) + (ev.level >= G.STAR ? L(' You formed a star!', ' 恒星形成了！') : ''), 'good');
          status(L(team.name + ' grows to ', team.name + '升级为') + levelText(ev.level));
          await sleep(500);
          break;
        case 'quest':
          status(L(team.name + ' is on 结果 but needs a star. Answer a card!', team.name + '到了「结果」，还没有恒星。回答一张卡！'));
          break;
        case 'waitstar':
          toast(L('Not yet. Try again next turn.', '还没形成恒星，下一轮再试。'), 'bad');
          break;
        case 'colour':
          toast({ yellow: '🟡 ' + L('Yellow!', '黄色！'), red: '🔴 ' + L('Red!', '红色！'), blue: '🔵 ' + L('Blue!', '蓝色！'), green: '🟢 ' + L('Green!', '绿色！'),
            alarm: '🚨 ' + L('Alarm!', '警报！'), step: '👣 ' + L('One step!', '走一步！') }[ev.card], ev.card === 'alarm' ? 'bad' : 'good');
          await sleep(700);
          break;
        case 'stepon':
          toast('👣 ' + L('Step on!', '走一步！'), 'good');
          break;
        case 'bonus':
          toast('⭐ ' + L('L1 correct: one more step!', 'L1 答对：多走一格！'), 'good');
          break;
        case 'gotshield':
          toast('🛡️ ' + L('L2 correct: a shield!', 'L2 答对：得到盾牌！'), 'good');
          break;
        case 'gain':
          toast('🃏 ' + L('Action card: ', '动作卡：') + actionName(ev.card), 'good');
          status(L('Use it from next round, after a right answer.', '下一轮起可以用，答对一题才能用。'));
          break;
        case 'rescue':
          toast('🦎 ' + L('You rescued a mochi salamander!', '救出一只麻糬小火蜥！'), 'good');
          break;
        case 'action':
          toast('🃏 ' + actionName(ev.card) + '！', 'good');
          await sleep(500);
          break;
        case 'swap':
          await jump(ev.team, { at: 'sq', i: ev.to });
          await jump(ev.other, { at: 'sq', i: ev.otherTo });
          break;
        case 'nothing':
          status(L('Nothing happens.', '没有效果。'));
          break;
        case 'again':
          toast('🔁 ' + L(team.name + ' goes again!', team.name + '再走一次！'), 'good');
          break;
        case 'buy':
          if (isMochi) { status(L('Answer a card to use the action card.', '答对这张卡才能用动作卡。')); break; }
          status(L('Answer a card to buy the RV.', '答对这张卡就能买房车。'));
          break;
        case 'rv':
          toast('🚐 ' + L(team.name + ' bought the RV!', team.name + '买到房车了！'), 'good');
          status(L('The RV can get you out of jail 3 times. Now roll!', '房车能帮你出狱 3 次。现在掷骰子吧！'));
          break;
        case 'nobuy':
          if (isMochi) { toast(L('Not this time. Keep the card.', '这次不能用，卡留着。'), 'bad'); break; }
          toast(L('Not this time. Keep the money.', '这次没买成，钱还在。'), 'bad');
          status(L('Now roll the dice.', '现在掷骰子。'));
          break;
        case 'rvout':
          toast('🚐 ' + L('The RV drives ' + team.name + ' out of jail!', '房车开出监狱！'), 'good');
          break;
        case 'move':
          toast('👣 ' + (ev.steps > 0
            ? L('Move ahead ' + ev.steps + '!', '往前走 ' + ev.steps + ' 步！')
            : L('Move back ' + -ev.steps + '.', '往后走 ' + -ev.steps + ' 步。')), ev.steps > 0 ? 'good' : 'bad');
          await sleep(500);
          await walk(ev.team, ev.from, ev.to);
          break;
        case 'chute':
          toast('🍭 ' + (ev.to > ev.from ? L('Special! Slide forward.', '特别！往前滑。') : L('Special! Slide back.', '特别！往回滑。')), ev.to > ev.from ? 'good' : 'bad');
          await sleep(500);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'moon':
          toast('🌙 ' + L('The moonlight path!', '走月光小路！'), 'good');
          await sleep(500);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'blackhole':
          toast('🕳️ ' + L('Black hole! Back to the start of the row.', '黑洞！回到这一排的开头。'), 'bad');
          await sleep(600);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'slide':
          toast('🐍 ' + L('Slide down the snake!', '从蛇身上滑下去！'), 'good');
          await sleep(500);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'back':
          if (isMochi) {
            toast(L('Back you go.', '退回去。'), 'bad');
            await walkPath(ev.team, ev.path);
            break;
          }
          if (isClass) {
            toast(L('Not quite: back half a table.', '答错了，退半张桌子。'), 'bad');
            await walkPath(ev.team, ev.path);
            break;
          }
          if (isCandy) {
            toast(L('Not quite: no money, back to where you were.', '答错了，不给钱，回到原来的位置。'), 'bad');
            await jump(ev.team, { at: 'sq', i: ev.to });
            status(L(team.name + ' goes back.', team.name + '回到上一次的位置。'));
            break;
          }
          toast(L('Not quite: move back one space.', '答错了，退一格。'), 'bad');
          await walk(ev.team, ev.from, ev.to);
          status(L(team.name + ' moves back one space.', team.name + '退一格。'));
          break;
        case 'stay':
          toast('👏 ' + L('Correct! Stay here.', '答对了！留在原地。'), 'good');
          status(L('Correct! ' + team.name + ' stays.', '答对！' + team.name + '留在原地。'));
          break;
        case 'jail':
          if (isMpy) {
            toast('🚔 ' + L('Go to jail!', '去监狱！'), 'bad');
            await sleep(600);
            await jump(ev.team, { at: 'jail' });
            status(L('Next turn: wait, or pay M50 to get out.', '下一轮：等一轮，或付 M50 马上出狱。'));
            break;
          }
          if (!isClass || ev.why !== 'teacher') toast('🚔 ' + L('Go to jail! Wait two turns.', '去监狱！停两轮。'), 'bad');
          await sleep(600);
          await jump(ev.team, { at: 'jail' });
          status(L(team.name + ' is in jail for two turns.', team.name + '进监狱，停两轮。'));
          break;
        case 'skip':
          if (isMoney && ev.why === 'banana') { toast('🍌 ' + L('Banana peel! Skip a turn.', '踩到香蕉皮！停一轮。'), 'bad'); break; }
          if ((isMoney || isMaze) && ev.why === 'jail') { toast('🔒 ' + L('Jail! Skip a turn.', '进监狱！停一轮。'), 'bad'); break; }
          toast('⏭ ' + L('Skip your next turn.', '跳过：下一轮停一次。'), 'bad');
          status(L(team.name + ' will skip the next turn.', team.name + '下一轮停一次。'));
          break;
        case 'skipped':
          toast('⏭ ' + L(team.name + ' skips this turn.', team.name + '这轮跳过。'));
          status(L(team.name + ' skips this turn.', team.name + '这轮跳过。'));
          break;
        case 'again':
          toast('🎲 ' + L('Roll again!', '再来一次！'), 'good');
          status(L(team.name + ' rolls again.', team.name + '再掷一次。'));
          break;
        case 'blank':
          status(L('A free square. Next team!', '空白格，安全！'));
          break;
        case 'card':
          if (isMochi) { status(ev.alarm ? L('Alarm! Answer the alarm question.', '警报！回答警报题。') : L('Draw a card!', '抽卡！')); break; }
          if (isClass) { status(ev.phrase ? L('Desk: ' + ev.phrase + '. Answer the card!', '桌子：' + ev.phrase + '。回答卡片！') : L('A desk! Draw a card.', '到桌子了，抽卡！')); break; }
          if (ev.value) { status(L('Draw a card! Worth $' + ev.value + '.', '抽卡！答对得 $' + ev.value + '。')); break; }
          status(ev.count > 1
            ? L('Draw a card! ' + ev.count + ' cards to go.', '抽卡！还要答 ' + ev.count + ' 张。')
            : L('Draw a card!', '抽卡！'));
          break;
        case 'challenge':
          status(L('Jail challenge!', '出狱挑战！'));
          break;
        case 'failed':
          toast(L('Challenge failed.', '挑战失败。'), 'bad');
          break;
        case 'bail':
          toast('💵 ' + L(team.name + ' paid M50 and is out!', team.name + '付了 M50，出狱了！'), 'good');
          status(L('Now roll the dice.', '现在掷骰子。'));
          break;
        case 'wait':
          if (isMpy) { status(L(team.name + ' waits in jail this turn.', team.name + '这轮在监狱里等待。')); break; }
          status(L(team.name + ' waits. ' + ev.left + ' more turn' + (ev.left === 1 ? '' : 's') + ' in jail.', team.name + '继续等待，还剩 ' + ev.left + ' 轮。'));
          break;
        case 'released':
          toast('🔓 ' + L(team.name + ' is out of jail!', team.name + '出狱了！'), 'good');
          await jump(ev.team, { at: 'sq', i: ev.to });
          status(L(team.name + ' is back on the path.', team.name + '回到路上。'));
          break;
        case 'finish':
          toast('🏆 ' + L(team.name + ' finishes ' + ['first', 'second', 'third'][ev.place - 1] + '!', team.name + '获得第' + '一二三'.charAt(ev.place - 1) + '名！'), 'good');
          await jump(ev.team, { at: 'place', n: ev.place });
          status(L(team.name + ' reached the finish!', team.name + '到达终点！'));
          await sleep(600);
          break;
        case 'over':
          break;
      }
    }
    syncShown();
    busy = false;
    renderSide();
    if (game.phase === 'card' || game.phase === 'challenge' || game.phase === 'buy' || game.phase === 'alarm') openCard();
    else if (game.phase === 'over') showResults();
    else focusMain();
  }

  function focusMain() {
    var fork = $('epFork').querySelector('button:not([disabled])');
    if (!$('epFork').hidden && fork) { fork.focus({ preventScroll: true }); return; }
    var order = ['epRoll', 'epUseRv', 'epChallenge', 'epNext'];
    for (var i = 0; i < order.length; i++) {
      if (!$(order[i]).hidden) { $(order[i]).focus({ preventScroll: true }); return; }
    }
  }

  // ---------- cards ----------
  function drawCard() {
    if (!pile.length) {
      pile = deck.slice();
      for (var i = pile.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pile[i]; pile[i] = pile[j]; pile[j] = tmp;
      }
    }
    return pile.pop();
  }

  function openCard() {
    var card = null;
    if (isClass && settings.desk === 'phrase') card = G.situation(G.phrase(G.current(game).pos, game), zh);
    if (!card && G.cardFor) card = G.cardFor(game, zh);   // MPY: the word written on the square
    card = card || drawCard();
    var team = G.current(game);
    var n = game.total - game.left + 1;
    $('epCardTeam').textContent = teamLabel(team);
    $('epCardTeam').style.setProperty('--team', Core.TEAMS[team.id].color);
    $('epCardCount').textContent = isMaze ? ({ word: L('Right = +$' + game.value + ', wrong = -$5', '答对 +$' + game.value + '，答错 -$5'),
        super: '⭐ ' + L('Super: right = +$' + game.value, 'Super：答对 +$' + game.value),
        slide: '🛝 ' + L('Slide: right = forward 5', 'Slide：答对往前滑 5 格') }[game.qkind] || '')
      : isMoney ? ({ buy: L('Right = you may buy it (' + CUR + game.value + ')', '答对可以买这块地（' + CUR + game.value + '）'),
        special: '❓ ' + L('Special card: right = ' + CUR + game.value, '特别卡：答对得 ' + CUR + game.value),
        normal: L('Right = ' + CUR + game.value, '答对得 ' + CUR + game.value) }[game.qkind] || '')
      : isSpace ? (game.quest ? L('Form a star to finish', '形成恒星才能到终点')
        : L('Right = grow one step', '答对升一级') + (G.current(game).level ? ' · ' + levelText(G.current(game).level) : ''))
      : isMochi ? (game.phase === 'alarm' ? '🚨 ' + L('Alarm question', '警报题')
        : game.phase === 'buy' ? '🃏 ' + actionName(G.current(game).actions[game.using].card)
        : { q1: '问题 L1', q2: '问题 L2', q3: '问题 L3' }[game.qkind] || L('Card', '抽卡'))
      : isClass ? L('Right = flip a special card', '答对翻一张特别卡')
      : game.phase === 'buy' ? L('Buy the RV', '买房车')
      : isCandy ? L('Worth $' + game.value, '答对得 $' + game.value)
      : game.phase === 'challenge'
      ? L('Jail challenge ' + n + ' / ' + game.total, '出狱挑战 ' + n + ' / ' + game.total)
      : game.total > 1 ? L('Extra card ' + n + ' / ' + game.total, '加卡 ' + n + ' / ' + game.total) : L('Card', '抽卡');
    $('epCardLabel').textContent = (card.label || '') + (card.hint ? (card.label ? ' · ' : '') + card.hint : '');
    $('epCardLabel').hidden = !card.label && !card.hint;
    $('epCardQ').textContent = card.q;
    $('epCardQ').classList.toggle('is-big', !!card.big || card.q.length <= 6);
    $('epCardA').textContent = card.a;
    $('epCardA').hidden = true;
    $('epReveal').hidden = !card.a;
    var layer = $('epCard');
    layer.hidden = false;
    layer.classList.remove('is-in');
    void layer.offsetWidth;
    layer.classList.add('is-in');
    $('epCardQ').focus({ preventScroll: true });
  }

  function reveal() {
    $('epCardA').hidden = false;
    $('epReveal').hidden = true;
  }

  function judge(correct) {
    if (busy || $('epCard').hidden) return;
    $('epCard').hidden = true;
    play(G.judge(game, correct));
  }

  // ---------- dice ----------
  function showFace(face) {
    var die = $('epDie');
    die.dataset.face = face;
    Array.prototype.forEach.call(die.children, function (pip, i) {
      pip.classList.toggle('on', FACES[face].indexOf(i) !== -1);
    });
  }

  // Die face as SVG pips (the ⚀–⚅ glyphs look different on every screen).
  var PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]] };
  function faceSvg(v) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + PIPS[v].map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + (v === 1 ? '#e8594a' : '#1f2b26') + '"/>';
    }).join('') + '</svg>';
  }

  // Big die drops onto the middle of the board, tumbles and lands on `value`
  // (same feel as the 棋盘游戏 tool). Timers, not animation promises: a
  // background tab can stall those.
  async function bigRoll(value, team) {
    var stage = document.createElement('div');
    stage.className = 'ep-rollstage';
    stage.innerHTML = '<div class="ep-bigdie" style="--team:' + Core.TEAMS[team.id].color + '">' + faceSvg(value) + '</div>' +
      '<p class="ep-rollnum"></p>';
    stage.querySelector('.ep-rollnum').textContent = L(team.name + ' rolled ', team.name + '掷出 ');
    var b = document.createElement('b');
    b.textContent = value;
    stage.querySelector('.ep-rollnum').appendChild(b);
    $('epBoardArea').appendChild(stage);
    var big = stage.querySelector('.ep-bigdie');
    var num = stage.querySelector('.ep-rollnum');
    if (reduceMotion || !big.animate) {
      num.classList.add('is-in');
      await sleep(900);
      stage.remove();
      return;
    }
    stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'forwards' });
    var spin = setInterval(function () { big.innerHTML = faceSvg(1 + Math.floor(Math.random() * 6)); }, 85);
    big.animate([
      { transform: 'translateY(-60vh) rotate(-260deg) scale(.55)' },
      { transform: 'translateY(0) rotate(-25deg) scale(1)', offset: 0.55 },
      { transform: 'translateY(-8vh) rotate(10deg) scale(1)', offset: 0.72 },
      { transform: 'translateY(0) rotate(0) scale(1.08, .92)', offset: 0.88 },
      { transform: 'translateY(0) rotate(0) scale(1)' }
    ], { duration: 950, easing: 'cubic-bezier(.3,.7,.4,1)' });
    await sleep(620);
    clearInterval(spin);
    big.innerHTML = faceSvg(value);
    await sleep(330);
    num.classList.add('is-in');
    big.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    await sleep(900);
    stage.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    await sleep(220);
    stage.remove();
  }

  async function rollDice(value) {
    if (busy || game.phase !== 'roll') return;
    busy = true;
    renderSide();
    var final = value || 1 + Math.floor(Math.random() * 6);
    // A real die was rolled in the room: just show the number. Otherwise roll the big die.
    if (!value) await bigRoll(final, G.current(game));
    showFace(final);
    await sleep(value ? 250 : 80);
    play(G.roll(game, final));
  }

  // ---------- results ----------
  function showResults() {
    var list = $('epRanking');
    list.innerHTML = '';
    game.places.forEach(function (id, i) {
      var team = game.teams[id];
      var li = document.createElement('li');
      li.style.setProperty('--team', Core.TEAMS[id].color);
      var medal = document.createElement('span');
      medal.className = 'ep-medal';
      medal.textContent = ['🥇', '🥈', '🥉'][i] || String(i + 1);
      var face = document.createElement('span');
      face.className = 'ep-token-face';
      face.textContent = Core.TEAMS[id].emoji;
      var name = document.createElement('span');
      name.textContent = team.name + (isCandy ? '  💰 $' + team.money : isMoney ? (team.out ? '  💥' : '  💰 ' + CUR + G.wealth(game, team)) : isMaze ? '  💰 $' + team.money : '');
      li.appendChild(medal);
      li.appendChild(face);
      li.appendChild(name);
      list.appendChild(li);
    });
    $('epResults').hidden = false;
    $('epAgain').focus({ preventScroll: true });
  }

  // ---------- start / stop ----------
  // Point the stage at the chosen game's board.
  function setupBoard() {
    G = GAMES[settings.game] || Core;
    isCandy = settings.game === 'candy-race';
    isClass = settings.game === 'escape-classroom';
    isMochi = settings.game === 'mochi';
    isSpace = settings.game === 'space';
    isMpy = settings.game === 'mpy';
    isMaze = settings.game === 'maze';
    isMoney = settings.game === 'money' || isMpy;
    CUR = isMpy ? 'M' : '$';
    $('epRoll').textContent = '🎲 ' + L('Roll', '掷骰子');
    $('epBoardImg').src = IMAGES[settings.game];
    $('epBoard').style.aspectRatio = G.FRAME.w + ' / ' + G.FRAME.h;
    document.querySelector('.ep-overlay').setAttribute('viewBox', '0 0 ' + G.FRAME.w + ' ' + G.FRAME.h);
    $('epConnector').setAttribute('d', G.CONNECTOR || '');
    $('epConnector').style.display = G.CONNECTOR ? '' : 'none';
    $('epRulesList').innerHTML = document.querySelector('.ep-rules ol[data-game="' + settings.game + '"]').innerHTML;
    if (isCandy) $('epBuy').textContent = '🚐 ' + L('Buy the RV ($' + G.RV_PRICE + ')', '买房车（$' + G.RV_PRICE + '）');
    drawMarks();
  }

  // Arrows for side paths that jump back to the main path, plus labels and fork rings over the photo.
  function drawMarks() {
    var NS = 'http://www.w3.org/2000/svg';
    var g = $('epMarks');
    g.innerHTML = '';
    function el(tag, attrs, text) {
      var node = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
      if (text) node.textContent = text;
      g.appendChild(node);
      return node;
    }
    (G.LINKS || []).forEach(function (link) {
      var a = G.BOARD[link[0]], b = G.BOARD[link[1]];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      var bend = Math.min(160, len * 0.25);
      var cx = mx - dy / len * bend, cy = my + dx / len * bend;
      // stop short of both squares so the arrow does not cover them
      var sx = a[0] + (cx - a[0]) * 0.12, sy = a[1] + (cy - a[1]) * 0.12;
      var ex = b[0] + (cx - b[0]) * 0.12, ey = b[1] + (cy - b[1]) * 0.12;
      el('path', { d: 'M' + sx + ' ' + sy + ' Q' + cx + ' ' + cy + ' ' + ex + ' ' + ey, class: 'ep-link', 'marker-end': 'url(#epArrow)' });
    });
    if (isClass && game) {
      G.DESK_SQUARES.forEach(function (sq, n) {
        var word = G.phrase(sq, game) || '?';
        var chars = Array.from(word).slice(0, 6);
        var w = G.DESKS[n][0], h = G.DESKS[n][1];
        var size = Math.min(w * 0.5, h * 0.82 / chars.length);
        var x = G.BOARD[sq][0], y = G.BOARD[sq][1];
        chars.forEach(function (ch, k) {
          el('text', { x: x, y: y + (k - (chars.length - 1) / 2) * size * 1.08 + size * 0.36, class: 'ep-desk-text' + (word === '?' ? ' is-blank' : ''), 'font-size': size }, ch);
        });
      });
    }
    if (isMoney && game) {
      game.owner.forEach(function (o, i) {
        if (o < 0) return;
        var sq = G.BOARD[i];
        // a small flag in the square's corner so it never hides the tokens
        el('circle', { cx: sq[0] + 52, cy: sq[1] - 62, r: 27, class: 'ep-owner', style: 'stroke:' + Core.TEAMS[o].color });
        el('text', { x: sq[0] + 52, y: sq[1] - 52, class: 'ep-owner-face', 'font-size': 30 }, Core.TEAMS[o].emoji);
      });
    }
    (G.MARKS || []).forEach(function (m) {
      if (m.t === 'ring') {
        var sq = G.BOARD[m.i];
        el('circle', { cx: sq[0], cy: sq[1], r: 58, class: 'ep-fork-ring' });
      } else if (m.t === 'box') {
        el('rect', { x: m.x - 60, y: m.y - 60, width: 120, height: 120, rx: 18, class: 'ep-podium-box ep-podium-' + m.s });
        el('text', { x: m.x, y: m.y + 22, class: 'ep-mark-text', 'font-size': 64 }, m.s);
      } else {
        el('text', { x: m.x, y: m.y, class: 'ep-mark-text', 'font-size': m.size || 36 }, m.s);
      }
    });
  }

  function begin() {
    var deskWords = isClass && G.parseWords ? G.parseWords(settings.deskWords) : [];
    game = G.newGame({ teams: settings.teams, names: settings.names, jail: settings.jail, zh: zh, shared: Core, words: deskWords, laps: settings.laps });
    drawMarks();
    pile = [];
    shown = {};
    syncShown();
    makeTokens();
    showFace(1);
    $('epCard').hidden = true;
    $('epResults').hidden = true;
    status(L('Roll the dice to begin!', '掷骰子开始吧！'));
    renderSide();
    focusMain();
  }

  async function start() {
    $('epError').textContent = '';
    if (radio('epSource') === 'words') {
      if (!types().length) {
        $('epError').textContent = L('Choose at least one card type.', '请至少选一种题型。');
        return;
      }
      if (Words && Words.loadCedict && !cedictReady) {
        $('epStart').disabled = true;
        await Words.loadCedict().catch(function () {});
        cedictReady = true;
        $('epStart').disabled = false;
      }
    }
    deck = buildDeck();
    if (!deck.length) {
      $('epError').textContent = radio('epSource') === 'words'
        ? L('Type at least one word.', '请至少输入一个词。')
        : L('Write at least one question.', '请至少写一道题。');
      return;
    }
    settings = readSetup();
    saveDraft();
    setupBoard();
    $('epStage').hidden = false;
    document.body.classList.add('ep-playing');
    fitBoard();
    begin();
  }

  function closeStage() {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    $('epStage').hidden = true;
    document.body.classList.remove('ep-playing');
    game = null;
    $('epStart').focus();
  }

  function mainAction() {
    if (!game || busy) return;
    if (!$('epResults').hidden) return;
    if (!$('epCard').hidden) { if (!$('epReveal').hidden) reveal(); return; }
    if (game.phase === 'roll' && !$('epRealDie').checked) rollDice();
    else if (game.phase === 'next') play(G.next(game));
  }

  // ---------- wiring ----------
  function init() {
    renderNames();
    loadDraft();

    var handoff = window.ChenWordlistHandoff;
    var handed = handoff && handoff.active();
    if (handed) {
      setRadio('epSource', 'words');
      $('epWords').value = handed.items.map(function (item) {
        return item.py || item.en ? [item.zh, item.py, item.en].join(' | ') : item.zh;
      }).join('\n');
      handoff.mountBar(handed);
    }
    showSource();
    showGame();

    if (window.ChenZhContent) {
      zhScript = window.ChenZhContent.create({ mount: '#epZhSlot', label: L('Card characters', '卡片用字') })
        .region($('epCard'), { convert: true })
        .region($('epToast'), { convert: true })
        .region($('epMarks'), { convert: true });   // desk words on the board
    }

    Array.prototype.forEach.call(document.querySelectorAll('input[name="epSource"]'), function (el) {
      el.addEventListener('change', function () { showSource(); saveDraft(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epTeams"]'), function (el) {
      el.addEventListener('change', function () { renderNames(); saveDraft(); });
    });
    $('epDeskFromWords').addEventListener('click', function () {
      var items = Words ? Words.parseText($('epWords').value) : [];
      if (!items.length) { $('epDeskWordsHint').textContent = L('Type some words in step 1 first.', '请先在第一步输入词表。'); return; }
      $('epDeskWords').value = items.map(function (item) { return item.zh; }).join('\n');
      $('epDeskWordsHint').textContent = '';
      saveDraft();
    });
    $('epDeskWords').addEventListener('input', function () { clearTimeout(typing); typing = setTimeout(saveDraft, 300); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epDesk"]'), function (el) {
      el.addEventListener('change', saveDraft);
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epGame"]'), function (el) {
      el.addEventListener('change', function () { showGame(); saveDraft(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epJail"], input[name="epType"]'), function (el) {
      el.addEventListener('change', saveDraft);
    });
    var typing = 0;
    ['epCards', 'epWords'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        clearTimeout(typing);
        typing = setTimeout(saveDraft, 300);
      });
    });

    $('epStart').addEventListener('click', start);
    $('epRoll').addEventListener('click', function () { rollDice(); });
    $('epDie').addEventListener('click', function () { rollDice(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-roll]'), function (btn) {
      btn.addEventListener('click', function () { rollDice(Number(btn.dataset.roll)); });
    });
    $('epRealDie').addEventListener('change', function () { if (game) renderSide(); });
    $('epChallenge').addEventListener('click', function () { if (!busy) play(G.challenge(game)); });
    $('epWait').addEventListener('click', function () { if (!busy) play(G.wait(game)); });
    $('epBuy').addEventListener('click', function () { if (!busy) play(G.buyRv(game)); });
    $('epUseRv').addEventListener('click', function () { if (!busy) play(G.useRv(game)); });
    $('epNext').addEventListener('click', function () { if (!busy) play(G.next(game)); });
    $('epReveal').addEventListener('click', reveal);
    $('epCorrect').addEventListener('click', function () { judge(true); });
    $('epWrong').addEventListener('click', function () { judge(false); });
    $('epAgain').addEventListener('click', begin);
    $('epCloseResults').addEventListener('click', function () { $('epResults').hidden = true; });
    $('epExit').addEventListener('click', closeStage);
    $('epRulesBtn').addEventListener('click', function () { $('epRulesDialog').showModal(); });
    $('epEndGame').addEventListener('click', function () {
      if (busy || !game || !window.confirm(L('End the game and count the money now?', '现在结束游戏、结算钱数吗？'))) return;
      $('epCard').hidden = true;
      play(G.end(game));
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epLaps"]'), function (el) {
      el.addEventListener('change', saveDraft);
    });
    $('epFullscreen').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else if ($('epStage').requestFullscreen) $('epStage').requestFullscreen().catch(function () {});
    });
    document.addEventListener('fullscreenchange', function () { setTimeout(fitBoard, 50); });
    window.addEventListener('resize', fitBoard);
    document.addEventListener('keydown', function (event) {
      if (!game || $('epStage').hidden || $('epRulesDialog').open) return;
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (event.key === ' ') {
        // Space on a focused button presses that button; anywhere else it is the main action.
        if (tag === 'button') return;
        event.preventDefault();
        mainAction();
      } else if (!$('epCard').hidden && (event.key === 'ArrowRight' || event.key === 'y')) {
        judge(true);
      } else if (!$('epCard').hidden && (event.key === 'ArrowLeft' || event.key === 'n')) {
        judge(false);
      } else if (event.key === 'Escape' && !document.fullscreenElement && $('epCard').hidden) {
        closeStage();
      }
    });

    if (window.TeacherGameTemplate) bindTemplate();
    else window.addEventListener('load', bindTemplate);
  }

  var templateBound = false;
  function bindTemplate() {
    if (templateBound || !window.TeacherGameTemplate) return;
    templateBound = true;
    $('epSaveTemplate').disabled = false;
    window.TeacherGameTemplate.bind({
      button: $('epSaveTemplate'),
      gameType: 'escape-the-path',
      version: 1,
      getData: function () {
        var data = readSetup();
        if (data.source === 'own' && !Core.parseCards(data.cards).length) {
          throw new Error(L('Write at least one question card before saving.', '请先写至少一道题再保存。'));
        }
        if (data.source === 'words' && !/\S/.test(data.words)) {
          throw new Error(L('Type at least one word before saving.', '请先输入至少一个词再保存。'));
        }
        data.title = NAMES[data.game] || 'Escape the Path';
        return data;
      },
      restore: function (data) {
        writeSetup(data);
        saveDraft();
      }
    });
  }

  init();
})();
