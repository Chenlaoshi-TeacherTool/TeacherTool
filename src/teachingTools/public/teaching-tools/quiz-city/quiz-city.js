(function() {
  'use strict';
  var engine = window.QuizCity;
  var colors = ['#ed9979', '#75bcb0', '#a79bd6', '#e6c45e'];
  var storageKey = 'cls-quiz-city-match-v1';
  var bankKey = 'cls-quiz-city-bank-v1';
  var state = null;
  var zh = document.documentElement.lang === 'zh';
  var sound = false;
  var motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var audio = null;
  var reveal = false;
  var selected = -1;
  var lastTime = Date.now();
  var lastAnimation = 0;
  var resultShown = false;
  var lastSave = 0;
  var sample = 'What is 6 × 7? | 42 | 36; 42; 48\n说出三种水果。 | 例如：苹果、香蕉、橙子\nWhich planet do we live on? | Earth | Mars; Earth; Venus\n用“因为……所以……”说一句话。 | 合理的因果句即可\nHow many sides does a hexagon have? | 6 | 5; 6; 8\n把“你好”翻译成英文。 | Hello\nName a way to help our planet. | e.g. Recycle, save water, plant trees\n“明天”的前一天是什么？ | 今天';
  function byId(id) { return document.getElementById(id); }
  function text(en, cn) { return zh ? cn : en; }
  function node(tag, content, className) { var element = document.createElement(tag); if (content !== undefined) element.textContent = content; if (className) element.className = className; return element; }
  function read(key) { try { return localStorage.getItem(key); } catch (error) { warnStorage(); return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); return true; } catch (error) { warnStorage(); return false; } }
  function warnStorage() { byId('storage-warning').hidden = false; byId('storage-warning').textContent = text('Browser storage is unavailable or full. Keep this tab open; this match may not be recoverable.', '浏览器存储不可用或已满。请保持此页开启，对局可能无法恢复。'); }
  function save() { if (state) write(storageKey, JSON.stringify(state)); }
  function beep(success) {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(function() {});
      var oscillator = audio.createOscillator();
      var gain = audio.createGain();
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.frequency.setValueAtTime(success ? 660 : 220, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(success ? 880 : 170, audio.currentTime + .12);
      gain.gain.setValueAtTime(.065, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .2);
      oscillator.start(); oscillator.stop(audio.currentTime + .21);
    } catch (error) { sound = false; }
  }
  function avatar(index) {
    return '<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M17 37Q12 8 30 22Q40 12 50 22Q68 8 63 37" fill="#fff8dc"/><rect x="15" y="27" width="50" height="41" rx="21" fill="#fff8dc"/><path d="M22 39q18-17 36 0" fill="none" stroke="' + colors[index] + '" stroke-width="8"/><circle cx="30" cy="44" r="3" fill="#30565e"/><circle cx="50" cy="44" r="3" fill="#30565e"/><path d="M34 54q6 7 12 0" fill="none" stroke="#30565e" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="51" r="4" fill="#f4b8a1"/><circle cx="58" cy="51" r="4" fill="#f4b8a1"/><path d="m32 23 8-12 8 12" fill="' + colors[index] + '"/></svg>';
  }
  function icon(type) {
    var shapes = { building: '<path d="M7 29V13L20 5l13 8v16Z" fill="currentColor"/><path d="M17 29V20h6v9M12 14h4m8 0h4" stroke="#fff8de" stroke-width="3"/>', chance: '<path d="M14 11q0-8 9-7t4 13l-6 5v4" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="21" cy="33" r="3" fill="currentColor"/>', challenge: '<path d="m20 3 5 10 11 2-8 8 2 12-10-6-10 6 2-12-8-8 11-2Z" fill="currentColor"/>', bonus: '<path d="M7 16h26v19H7Zm-3-7h32v9H4Z" fill="currentColor"/><path d="M20 9v26m0-26C6 8 11-4 20 9c9-13 14-1 0 0" fill="none" stroke="#fff8de" stroke-width="3"/>', penalty: '<path d="m10 4 9 9 9-2 5 7-9 3-1 9-7 5 1-15L7 11Z" fill="currentColor"/>', start: '<path d="M18 35V6m0 1 17 5-17 7" stroke="currentColor" stroke-width="4" fill="currentColor"/>' };
    return '<svg viewBox="0 0 40 40" aria-hidden="true">' + shapes[type] + '</svg>';
  }
  function placement(index) {
    if (index < 8) return [index + 1, 1];
    if (index < 12) return [8, index - 6];
    if (index < 20) return [20 - index, 6];
    return [1, 25 - index];
  }
  function renderBoard() {
    var board = byId('board');
    board.querySelectorAll('.tile').forEach(function(tile) { tile.remove(); });
    engine.tiles.forEach(function(tile, index) {
      var cell = node('div', undefined, 'tile ' + tile.type);
      var place = placement(index);
      cell.style.gridColumn = place[0]; cell.style.gridRow = place[1]; cell.dataset.index = index;
      var owner = state ? state.owners[index] : null;
      if (owner !== null) { cell.classList.add('owned'); cell.style.setProperty('--owner', colors[owner]); }
      cell.append(node('span', index + 1, 'tile-number'));
      var artwork = node('span', undefined, 'tile-icon'); artwork.innerHTML = icon(tile.type); cell.append(artwork);
      cell.append(node('span', zh ? tile.zh : tile.name, 'tile-name'));
      cell.append(node('span', tile.type === 'building' ? (owner === null ? text('Buy ', '购 ') + tile.price : text('Fee ', '费 ') + tile.fee) : text({ start: '+20', chance: '+35 / −15', challenge: '+30', bonus: '+30', penalty: '−25' }[tile.type], { start: '+20', chance: '+35 / −15', challenge: '+30', bonus: '+30', penalty: '−25' }[tile.type]), 'tile-price'));
      var tokens = node('span', undefined, 'tokens');
      if (state) state.teams.forEach(function(team, teamIndex) { if (team.position === index) { var token = node('span', teamIndex + 1, 'token'); token.style.setProperty('--team', colors[teamIndex]); token.title = team.name; tokens.append(token); } });
      cell.append(tokens); cell.title = (index + 1) + '. ' + (zh ? tile.zh : tile.name) + (owner !== null ? ' · ' + state.teams[owner].name : '');
      board.append(cell);
    });
  }
  function renderTeams() {
    byId('teams-left').replaceChildren(); byId('teams-right').replaceChildren();
    var teams = state ? state.teams : [1, 2, 3, 4].map(function(number) { return { name: text('Team ', '队伍 ') + number, coins: 200 }; });
    teams.forEach(function(team, index) {
      var active = state && state.active === index && state.phase !== 'finished';
      var card = node('section', undefined, 'team-card' + (active ? ' active' : ''));
      card.style.setProperty('--team', colors[index]);
      card.append(node('div', active ? text('YOUR TURN', '当前回合') : text('TEAM ', '队伍 ') + (index + 1), 'turn-tag'));
      var portrait = node('div', undefined, 'avatar'); portrait.innerHTML = avatar(index); card.append(portrait);
      card.append(node('h3', team.name)); var coins = node('div', undefined, 'coins'); coins.append(node('span', 'Q', 'coin'), node('span', team.coins)); card.append(coins);
      var die = node('span', ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][(team.dice || 1) - 1], 'team-die'); die.setAttribute('aria-label', text('Last dice: ', '上次骰子：') + (team.dice || 1)); card.append(die);
      var buildings = state ? state.owners.filter(function(owner) { return owner === index; }).length : 0;
      card.append(node('small', buildings + text(' buildings · Assets ', ' 栋建筑 · 资产 ') + (state ? engine.ranking(state).find(function(row) { return row.index === index; }).total : 200)));
      byId(index < Math.ceil(teams.length / 2) ? 'teams-left' : 'teams-right').append(card);
    });
  }
  function button(label, handler, className, disabled) { var element = node('button', label, className); element.type = 'button'; element.disabled = Boolean(disabled); element.addEventListener('click', handler); return element; }
  function hideTurn() { if (byId('turn-dialog').open) byId('turn-dialog').close(); }
  function renderCard() {
    if (!state || state.paused || !['question', 'event'].includes(state.phase) || byId('setup-dialog').open) { hideTurn(); return; }
    var dialog = byId('turn-dialog');
    var team = state.teams[state.active];
    byId('card-team').textContent = team.name;
    byId('card-content').replaceChildren(); byId('card-actions').replaceChildren();
    if (state.phase === 'question') {
      var question = engine.question(state);
      byId('card-eyebrow').textContent = state.challenge ? text('BONUS CHALLENGE · +30', '加码挑战 · +30') : text('CLASSROOM QUESTION · +20', '课堂问答 · +20');
      byId('turn-title').textContent = question.prompt;
      if (question.options.length) {
        var options = node('div', undefined, 'options');
        question.options.forEach(function(option, index) { var optionButton = button(String.fromCharCode(65 + index) + '. ' + option, function() { selected = index; renderCard(); }); optionButton.setAttribute('aria-pressed', selected === index); options.append(optionButton); });
        byId('card-content').append(options);
      }
      var answer = node('p', text('Answer: ', '参考答案：') + question.answer, 'answer'); answer.hidden = !reveal;
      byId('card-content').append(answer);
      byId('card-actions').append(button(reveal ? text('Hide answer', '隐藏答案') : text('Reveal answer', '显示答案'), function() { reveal = !reveal; renderCard(); }), button(text('Correct +', '答对 +') + (state.challenge ? '30' : '20'), function() { judge(true); }, 'correct'), button(text('Incorrect', '答错'), function() { judge(false); }, 'incorrect'));
    } else {
      var tile = engine.tiles[team.position];
      var event = state.event;
      byId('card-eyebrow').textContent = text('CITY EVENT', '城市事件');
      byId('turn-title').textContent = zh ? tile.zh : tile.name;
      var descriptions = {
        buy: text('Make it yours for ', '购买这栋建筑需 ') + tile.price + text(' coins. Visitors pay ', ' 金币。其他队伍到访支付 ') + tile.fee + text(' coins. Purchase value counts toward your final assets.', ' 金币。购买价计入最终总资产。'),
        own: text('Welcome back to your building!', '欢迎回到自己的建筑！'), purchased: text('A new building for your team!', '你的队伍拥有了新建筑！'),
        fee: text('Visit fee paid to ', '参观费支付给 ') + (event.owner !== undefined ? state.teams[event.owner].name : '') + ': ' + event.amount,
        start: text('Welcome to Launch Plaza! +20 coins.', '欢迎来到启航广场！+20 金币。'),
        bonus: text('Your ideas light up the city! +30 coins.', '好创意点亮城市！+30 金币。'),
        penalty: text('Help repair the city. Coins: ', '帮助修缮城市，金币变化：') + event.amount,
        chance: text('A surprise city adventure! Coins: ', '城市奇遇！金币变化：') + (event.amount > 0 ? '+' : '') + event.amount,
        'challenge-result': text('Challenge reward: +', '挑战奖励：+') + event.amount
      };
      byId('card-content').append(node('p', descriptions[event.kind], 'answer'));
      if (event.kind === 'buy') byId('card-actions').append(button(team.coins < tile.price ? text('Not enough coins', '金币不足') : text('Buy building', '购买建筑'), function() { engine.buy(state); beep(true); update(); }, 'primary', team.coins < tile.price));
      byId('card-actions').append(button(text('Next team →', '下一队 →'), function() { engine.next(state); reveal = false; selected = -1; update(); }, 'primary'));
    }
    if (!dialog.open) dialog.showModal();
  }
  function judge(correct) { engine.judge(state, correct, Math.random()); reveal = false; selected = -1; beep(correct); update(); }
  function results() {
    byId('rankings').replaceChildren();
    engine.ranking(state).forEach(function(row) {
      var item = node('div', undefined, 'rank-row'); var name = node('div', row.name);
      name.append(node('small', text('Coins ', '金币 ') + row.coins + text(' + Buildings ', ' + 建筑 ') + row.buildings));
      item.append(node('strong', row.rank), name, node('strong', row.total)); byId('rankings').append(item);
    });
    if (!resultShown) { byId('result-dialog').showModal(); resultShown = true; }
  }
  function timerView() {
    var seconds = state ? Math.ceil(state.remaining) : 900;
    byId('clock').textContent = Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
  }
  function render() {
    document.documentElement.lang = zh ? 'zh' : 'en'; document.body.classList.toggle('no-motion', !motion);
    document.querySelectorAll('[data-en]').forEach(function(element) { element.textContent = element.dataset[zh ? 'zh' : 'en']; });
    byId('sound').textContent = sound ? text('Sound on', '音效开') : text('Sound off', '音效关'); byId('sound').setAttribute('aria-pressed', sound);
    byId('motion').textContent = motion ? text('Animation on', '动画开') : text('Animation off', '动画关'); byId('motion').setAttribute('aria-pressed', motion);
    renderBoard(); renderTeams(); timerView();
    var playing = state && state.phase !== 'finished';
    byId('show-results').hidden = !state || state.phase !== 'finished';
    byId('pause').disabled = !playing; byId('finish').disabled = !playing || state.closing || state.paused;
    byId('pause').textContent = state && state.paused ? text('Resume', '继续') : text('Pause', '暂停');
    byId('roll').disabled = !playing || state.paused || state.phase !== 'ready' || byId('setup-dialog').open;
    byId('dice').textContent = state ? state.dice : 1; byId('dice').classList.toggle('rolling', Boolean(state && !state.paused && state.phase === 'rolling'));
    byId('round').textContent = text('ROUND ', '第 ') + (state ? state.round : 1) + (zh ? ' 轮' : '');
    byId('turn-label').textContent = state ? state.teams[state.active].name + (state.closing ? text(' · Final round', ' · 最后一轮') : '') : text('Welcome, city builders!', '欢迎，知识城市建造者！');
    byId('status').textContent = !state ? text('Set up your teams. The city is waiting!', '设置队伍，知识城市等你探索！') : state.phase === 'finished' ? text('Lesson complete! Compare your total assets.', '对局完成！来看看总资产排名。') : state.paused ? text('Paused. Resume when the class is ready.', '已暂停，准备好后点击继续。') : state.phase === 'ready' ? state.teams[state.active].name + text(', roll to explore!', '，掷骰子出发！') : ['rolling', 'moving'].includes(state.phase) ? text('Here comes your next stop…', '正在前往下一站……') : text('Answer the question, then discover your city event.', '先答题，再揭晓城市事件。');
    byId('history').replaceChildren();
    if (state) state.log.forEach(function(entry) { var tile = engine.tiles[entry.tile]; if (tile) byId('history').append(node('li', entry.team + ' · ' + (zh ? tile.zh : tile.name) + ' · ' + entry.coins)); });
    renderCard(); if (state && state.phase === 'finished') results();
  }
  function update() { save(); render(); }
  function names() {
    var old = Array.from(byId('team-names').querySelectorAll('input')).map(function(input) { return input.value; });
    byId('team-names').replaceChildren();
    for (var index = 0; index < Number(byId('team-count').value); index++) {
      var label = node('label', String(index + 1)); var input = node('input'); input.required = true; input.maxLength = 30; input.value = old[index] || text('Team ', '队伍 ') + (index + 1); input.setAttribute('aria-label', text('Team name ', '队名 ') + (index + 1)); label.append(input); byId('team-names').append(label);
    }
  }
  function openSetup() {
    if (state && state.phase !== 'finished') state.paused = true;
    hideTurn(); byId('setup-error').textContent = ''; byId('setup-dialog').showModal(); update();
  }
  function parsed() {
    var parsedBank = engine.parse(byId('questions').value);
    if (!parsedBank.questions.length || parsedBank.invalid.length) { byId('setup-error').textContent = parsedBank.invalid.length ? text('Check format on lines: ', '请检查以下行的格式：') + parsedBank.invalid.join(', ') : text('Add at least one question and answer.', '请至少输入一道题和答案。'); return null; }
    return parsedBank.questions;
  }
  byId('setup-form').addEventListener('submit', function(event) {
    event.preventDefault(); var questions = parsed(); if (!questions) return;
    var teamNames = Array.from(byId('team-names').querySelectorAll('input')).map(function(input) { return input.value.trim(); });
    if (teamNames.some(function(name) { return !name; }) || new Set(teamNames).size !== teamNames.length) { byId('setup-error').textContent = text('Give every team a different name.', '请为每队填写不同的队名。'); return; }
    write(bankKey, byId('questions').value); state = engine.create(teamNames, Number(byId('duration').value), questions); lastTime = Date.now(); resultShown = false; reveal = false; selected = -1; byId('setup-dialog').close(); update();
  });
  byId('save-bank').addEventListener('click', function() {
    var questions = parsed(); if (!questions) return;
    if (!write(bankKey, byId('questions').value)) { byId('setup-error').textContent = text('Storage unavailable. Bank was not saved.', '存储不可用，题库未保存。'); return; }
    if (state && state.phase === 'ready') { state.questions = questions; state.cursor = 0; save(); }
    byId('setup-error').textContent = questions.length + text(' questions saved.', ' 道题已保存。') + (state && state.phase !== 'ready' ? text(' Applies to the next new game; finish this turn to change the current bank.', ' 将用于新对局；如需替换当前题库，请先完成本回合。') : '');
  });
  byId('team-count').addEventListener('change', names);
  byId('setup-open').addEventListener('click', openSetup);
  byId('setup-close').addEventListener('click', function() { byId('setup-dialog').close(); render(); });
  byId('setup-dialog').addEventListener('cancel', function() { setTimeout(render, 0); });
  byId('roll').addEventListener('click', function() { if (engine.roll(state, Math.floor(Math.random() * 6) + 1)) { lastAnimation = Date.now(); beep(true); update(); } });
  byId('pause').addEventListener('click', function() { state.paused = !state.paused; lastTime = Date.now(); lastAnimation = Date.now(); update(); });
  byId('finish').addEventListener('click', function() { state.closing = true; update(); });
  byId('turn-dialog').addEventListener('cancel', function(event) { event.preventDefault(); state.paused = true; update(); });
  byId('card-pause').addEventListener('click', function() { state.paused = true; update(); });
  byId('show-results').addEventListener('click', function() { resultShown = false; results(); });
  byId('language').addEventListener('click', function() { zh = !zh; render(); });
  byId('sound').addEventListener('click', function() { sound = !sound; beep(true); render(); });
  byId('motion').addEventListener('click', function() { motion = !motion; render(); });
  byId('fullscreen').addEventListener('click', function() { var request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); if (request) request.catch(function() {}); });
  byId('result-close').addEventListener('click', function() { byId('result-dialog').close(); });
  byId('result-new').addEventListener('click', function() { byId('result-dialog').close(); openSetup(); });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function() { if (document.hidden && state && state.phase !== 'finished') { engine.tick(state, Math.max(0, (Date.now() - lastTime) / 1000)); state.paused = true; update(); } lastTime = Date.now(); });
  setInterval(function() {
    var now = Date.now(); var delta = Math.max(0, (now - lastTime) / 1000); lastTime = now;
    if (!state || state.phase === 'finished' || state.paused) return;
    var closing = state.closing; engine.tick(state, delta); timerView();
    if (['rolling', 'moving'].includes(state.phase) && now - lastAnimation >= (motion ? (state.phase === 'rolling' ? 650 : 230) : 30)) { engine.step(state); lastAnimation = now; update(); }
    else { if (now - lastSave >= 1000) { save(); lastSave = now; } if (state.closing !== closing) render(); }
  }, 100);
  byId('questions').value = read(bankKey) || sample;
  state = engine.restore(read(storageKey));
  names(); render(); if (!state) openSetup();
})();
