(function () {
  'use strict';
  const chinese = document.documentElement.lang.startsWith('zh');
  const input = document.getElementById('questions');
  const status = document.getElementById('status');
  const question = document.getElementById('current-question');
  const number = document.getElementById('question-number');
  const winner = document.getElementById('winner');
  const restart = document.getElementById('restart');
  const stage = document.getElementById('game-stage');
  const fullscreen = document.getElementById('fullscreen');
  const edit = document.getElementById('edit-questions');
  const prev = document.getElementById('prev-question');
  const skip = document.getElementById('skip-question');
  const nodes = document.getElementById('race-nodes');
  const teams = ['top', 'bottom'];
  const STEPS = 10;
  const VIEW = { width: 1600, height: 900 };
  // Point 0 is the start pad; points 1-10 are spaced evenly along each SVG path.
  const points = {};
  let questions = [];
  let questionIndex = 0;
  let scores = { top: 0, bottom: 0 };
  let playing = false;

  teams.forEach(function (team) {
    const path = document.getElementById(team + '-path');
    const length = path.getTotalLength();
    points[team] = [];
    for (let step = 0; step <= STEPS; step++) {
      const point = path.getPointAtLength(length * step / STEPS);
      points[team].push({ x: point.x / VIEW.width * 100, y: point.y / VIEW.height * 100 });
      if (step === STEPS) continue; // the last step lands beside the finish pad
      const node = document.createElement('span');
      node.className = team + (step === 0 ? ' start' : '');
      node.dataset.step = step;
      node.textContent = step === 0 ? nodes.dataset.startLabel : step;
      node.style.left = points[team][step].x + '%';
      node.style.top = points[team][step].y + '%';
      nodes.appendChild(node);
    }
  });

  function teamName(team) {
    return document.querySelector('.team.' + team).dataset.name;
  }

  function placeRunner(team) {
    const runner = document.getElementById(team + '-runner');
    const point = points[team][scores[team]];
    runner.style.left = point.x + '%';
    runner.style.top = point.y + '%';
    runner.setAttribute('aria-label', teamName(team) + (chinese ? '：第 ' + scores[team] + ' 格' : ': step ' + scores[team]));
    nodes.querySelectorAll('.' + team).forEach(function (node) {
      const step = Number(node.dataset.step);
      node.classList.toggle('done', step > 0 && step <= scores[team]);
    });
    document.getElementById(team + '-score').innerHTML = scores[team] + '<small> / ' + STEPS + '</small>';
  }

  teams.forEach(placeRunner);

  // Step the font down until the question fits its card; the smallest size scrolls.
  function fitQuestion() {
    question.classList.remove('long', 'longer');
    if (question.scrollHeight > question.clientHeight + 2) question.classList.add('long');
    if (question.scrollHeight > question.clientHeight + 2) question.classList.replace('long', 'longer');
  }
  window.addEventListener('resize', fitQuestion);

  function showQuestion() {
    const current = questionIndex % questions.length;
    question.textContent = questions[current];
    fitQuestion();
    number.textContent = chinese ? '第 ' + (current + 1) + ' 题 · 共 ' + questions.length + ' 题' : 'Question ' + (current + 1) + ' of ' + questions.length;
  }

  function reset() {
    scores = { top: 0, bottom: 0 };
    questionIndex = 0;
    playing = true;
    winner.hidden = true;
    winner.textContent = '';
    teams.forEach(function (team) {
      document.getElementById(team + '-runner').classList.remove('moving');
      placeRunner(team);
      document.getElementById(team + '-correct').disabled = false;
    });
    restart.disabled = false;
    prev.disabled = false;
    skip.disabled = false;
    status.textContent = chinese ? '比赛开始！答对一题前进一格，先到第 10 格获胜。' : 'Race on! Each correct answer moves one step. First to ten wins.';
    showQuestion();
  }

  function award(team) {
    if (!playing) return;
    const runner = document.getElementById(team + '-runner');
    scores[team] += 1;
    placeRunner(team);
    runner.classList.remove('moving');
    void runner.offsetWidth; // restart the hop when the same team scores twice quickly
    runner.classList.add('moving');
    if (scores[team] === STEPS) {
      playing = false;
      teams.forEach(function (name) { document.getElementById(name + '-correct').disabled = true; });
      prev.disabled = true;
      skip.disabled = true;
      status.textContent = chinese ? '比赛结束，点击“重新开始”再来一局。' : 'Race finished. Press Restart for another round.';
      setTimeout(function () {
        const card = document.createElement('p');
        const gift = document.createElement('img');
        gift.src = '/teaching-tools/team-race/assets/gift.png';
        gift.alt = '';
        card.append(gift, '🏆 ' + teamName(team) + (chinese ? '获胜！' : ' wins!'));
        winner.replaceChildren(card);
        winner.hidden = false;
      }, 650);
      return;
    }
    questionIndex += 1;
    showQuestion();
  }

  document.getElementById('start').addEventListener('click', function () {
    const entries = input.value.split(/\r?\n/).map(function (entry) { return entry.trim(); }).filter(Boolean);
    if (!entries.length) {
      status.textContent = chinese ? '请至少输入一道题目。' : 'Please enter at least one question.';
      input.focus();
      return;
    }
    questions = entries;
    reset();
    document.body.classList.add('race-playing');
    document.querySelector('.game-toolbar').hidden = false;
    edit.focus();
  });

  restart.addEventListener('click', reset);
  document.getElementById('game-restart').addEventListener('click', reset);
  winner.addEventListener('click', function () { winner.hidden = true; });
  skip.addEventListener('click', function () { questionIndex += 1; showQuestion(); });
  prev.addEventListener('click', function () { questionIndex = (questionIndex - 1 + questions.length) % questions.length; showQuestion(); });
  fullscreen.addEventListener('click', async function () {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.requestFullscreen) await stage.requestFullscreen();
      else fullscreen.textContent = chinese ? '已进入铺满窗口模式' : 'Window-filling mode active';
    } catch (error) {
      fullscreen.textContent = chinese ? '已进入铺满窗口模式' : 'Window-filling mode active';
    }
  });
  document.addEventListener('fullscreenchange', function () {
    const active = document.fullscreenElement === stage;
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.textContent = chinese ? (active ? '退出全屏' : '全屏投影') : (active ? 'Exit full screen' : 'Full screen');
  });
  edit.addEventListener('click', async function () {
    if (document.fullscreenElement) await document.exitFullscreen();
    document.body.classList.remove('race-playing');
    document.querySelector('.game-toolbar').hidden = true;
    input.focus();
  });
  // Arrow keys let the teacher award points from a presenter remote or keyboard.
  document.addEventListener('keydown', function (event) {
    if (!document.body.classList.contains('race-playing') || event.target === input || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowUp') { event.preventDefault(); award('top'); }
    if (event.key === 'ArrowDown') { event.preventDefault(); award('bottom'); }
  });

  teams.forEach(function (team) {
    const runner = document.getElementById(team + '-runner');
    runner.addEventListener('animationend', function () { runner.classList.remove('moving'); });
    document.getElementById(team + '-correct').addEventListener('click', function () { award(team); });
  });
}());
