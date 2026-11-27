/*
 * Escape the Path — projector page. Rules live in escape-the-path-core.js;
 * this file handles the setup form, the board, tokens, dice and question cards.
 */
(function () {
  'use strict';

  var Core = window.EscapePathCore;
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
      types: types(), teams: radio('epTeams'), names: names(), jail: radio('epJail')
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
    return { left: point[0] / Core.FRAME.w * 100, top: point[1] / Core.FRAME.h * 100 };
  }

  function fitBoard() {
    var area = $('epBoardArea');
    var board = $('epBoard');
    var w = area.clientWidth - 16;
    var h = area.clientHeight - 16;
    var ratio = Core.FRAME.w / Core.FRAME.h;
    var width = Math.min(w, h * ratio);
    board.style.width = Math.max(200, width) + 'px';
  }

  function spotOf(id) {
    var s = shown[id];
    if (s.at === 'jail') return Core.SPOTS.jail;
    if (s.at === 'place') return s.n <= 3 ? Core.SPOTS.podium[s.n - 1] : Core.SPOTS.lots[Math.min(2, s.n - 4)];
    return Core.BOARD[s.i];
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
    var active = Core.current(game).id;
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
    var current = Core.current(game);
    var target = $('epTarget');
    if (game.phase !== 'over' && shown[current.id].at === 'sq') {
      var sq = Core.BOARD[shown[current.id].i];
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
  }

  // ---------- side panel ----------
  function teamLabel(team) {
    return Core.TEAMS[team.id].emoji + ' ' + team.name;
  }

  function renderSide() {
    var team = Core.current(game);
    var over = game.phase === 'over';
    $('epTurnToken').textContent = over ? '🏆' : Core.TEAMS[team.id].emoji;
    $('epTurnBox').style.setProperty('--team', over ? '#20473a' : Core.TEAMS[team.id].color);
    $('epTurnName').textContent = over ? L('Game over', '游戏结束') : team.name;

    var real = $('epRealDie').checked;
    var phase = busy ? 'busy' : game.phase;
    $('epRoll').hidden = phase !== 'roll' || real;
    $('epManual').hidden = phase !== 'roll' || !real;
    $('epDie').disabled = phase !== 'roll' || real;
    $('epChallenge').hidden = phase !== 'jail' || !Core.canChallenge(game);
    $('epChallenge').textContent = '🔓 ' + L('Try ' + game.jailQuestions + (game.jailQuestions === 1 ? ' card' : ' cards in a row'), '挑战连答 ' + game.jailQuestions + ' 题');
    $('epWait').hidden = phase !== 'jail';
    $('epNext').hidden = phase !== 'next';

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
          : (t.skip ? '⏭ ' : '') + L('Square ' + t.pos, '第 ' + t.pos + ' 格');
      li.appendChild(face);
      li.appendChild(name);
      li.appendChild(info);
      list.appendChild(li);
    });
    placeTokens();
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
          status(L(team.name + ' rolled ' + ev.roll + '.', team.name + '掷出 ' + ev.roll + ' 点。'));
          await walk(ev.team, ev.from, ev.to);
          break;
        case 'move':
          toast('👣 ' + (ev.steps > 0
            ? L('Move ahead ' + ev.steps + '!', '往前走 ' + ev.steps + ' 步！')
            : L('Move back ' + -ev.steps + '.', '往后走 ' + -ev.steps + ' 步。')), ev.steps > 0 ? 'good' : 'bad');
          await sleep(500);
          await walk(ev.team, ev.from, ev.to);
          break;
        case 'slide':
          toast('🐍 ' + L('Slide down the snake!', '从蛇身上滑下去！'), 'good');
          await sleep(500);
          await jump(ev.team, { at: 'sq', i: ev.to });
          break;
        case 'back':
          toast(L('Not quite: move back one space.', '答错了，退一格。'), 'bad');
          await walk(ev.team, ev.from, ev.to);
          status(L(team.name + ' moves back one space.', team.name + '退一格。'));
          break;
        case 'stay':
          toast('👏 ' + L('Correct! Stay here.', '答对了！留在原地。'), 'good');
          status(L('Correct! ' + team.name + ' stays.', '答对！' + team.name + '留在原地。'));
          break;
        case 'jail':
          toast('🚔 ' + L('Go to jail! Wait two turns.', '去监狱！停两轮。'), 'bad');
          await sleep(600);
          await jump(ev.team, { at: 'jail' });
          status(L(team.name + ' is in jail for two turns.', team.name + '进监狱，停两轮。'));
          break;
        case 'skip':
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
        case 'wait':
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
    if (game.phase === 'card' || game.phase === 'challenge') openCard();
    else if (game.phase === 'over') showResults();
    else focusMain();
  }

  function focusMain() {
    var order = ['epRoll', 'epChallenge', 'epNext'];
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
    var card = drawCard();
    var team = Core.current(game);
    var n = game.total - game.left + 1;
    $('epCardTeam').textContent = teamLabel(team);
    $('epCardTeam').style.setProperty('--team', Core.TEAMS[team.id].color);
    $('epCardCount').textContent = game.phase === 'challenge'
      ? L('Jail challenge ' + n + ' / ' + game.total, '出狱挑战 ' + n + ' / ' + game.total)
      : game.total > 1 ? L('Extra card ' + n + ' / ' + game.total, '加卡 ' + n + ' / ' + game.total) : L('Card', '抽卡');
    $('epCardLabel').textContent = card.label || '';
    $('epCardLabel').hidden = !card.label;
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
    play(Core.judge(game, correct));
  }

  // ---------- dice ----------
  function showFace(face) {
    var die = $('epDie');
    die.dataset.face = face;
    Array.prototype.forEach.call(die.children, function (pip, i) {
      pip.classList.toggle('on', FACES[face].indexOf(i) !== -1);
    });
  }

  async function rollDice(value) {
    if (busy || game.phase !== 'roll') return;
    busy = true;
    renderSide();
    var final = value || 1 + Math.floor(Math.random() * 6);
    if (!value && !reduceMotion) {
      $('epDie').classList.add('is-rolling');
      for (var i = 0; i < 9; i++) {
        showFace(1 + Math.floor(Math.random() * 6));
        await sleep(60 + i * 8);
      }
      $('epDie').classList.remove('is-rolling');
    }
    showFace(final);
    await sleep(250);
    play(Core.roll(game, final));
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
      name.textContent = team.name;
      li.appendChild(medal);
      li.appendChild(face);
      li.appendChild(name);
      list.appendChild(li);
    });
    $('epResults').hidden = false;
    $('epAgain').focus({ preventScroll: true });
  }

  // ---------- start / stop ----------
  function begin() {
    game = Core.newGame({ teams: settings.teams, names: settings.names, jail: settings.jail, zh: zh });
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
    else if (game.phase === 'next') play(Core.next(game));
  }

  // ---------- wiring ----------
  function init() {
    if (Core.CONNECTOR) $('epConnector').setAttribute('d', Core.CONNECTOR);
    else $('epConnector').remove();
    document.querySelector('.ep-overlay').setAttribute('viewBox', '0 0 ' + Core.FRAME.w + ' ' + Core.FRAME.h);
    $('epRulesList').innerHTML = document.querySelector('.ep-rules ol').innerHTML;
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

    if (window.ChenZhContent) {
      zhScript = window.ChenZhContent.create({ mount: '#epZhSlot', label: L('Card characters', '卡片用字') })
        .region($('epCard'), { convert: true })
        .region($('epToast'), { convert: true });
    }

    Array.prototype.forEach.call(document.querySelectorAll('input[name="epSource"]'), function (el) {
      el.addEventListener('change', function () { showSource(); saveDraft(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="epTeams"]'), function (el) {
      el.addEventListener('change', function () { renderNames(); saveDraft(); });
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
    $('epChallenge').addEventListener('click', function () { if (!busy) play(Core.challenge(game)); });
    $('epWait').addEventListener('click', function () { if (!busy) play(Core.wait(game)); });
    $('epNext').addEventListener('click', function () { if (!busy) play(Core.next(game)); });
    $('epReveal').addEventListener('click', reveal);
    $('epCorrect').addEventListener('click', function () { judge(true); });
    $('epWrong').addEventListener('click', function () { judge(false); });
    $('epAgain').addEventListener('click', begin);
    $('epCloseResults').addEventListener('click', function () { $('epResults').hidden = true; });
    $('epExit').addEventListener('click', closeStage);
    $('epRulesBtn').addEventListener('click', function () { $('epRulesDialog').showModal(); });
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
        data.title = L('Escape the Path', '闯关桌游');
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
