(function () {
  'use strict';
  const chinese = document.documentElement.lang.startsWith('zh');
  const input = document.getElementById('questions');
  const status = document.getElementById('status');
  const question = document.getElementById('current-question');
  const number = document.getElementById('question-number');
  const winner = document.getElementById('winner');
  const restart = document.getElementById('restart');
  const teams = ['top', 'bottom'];
  let questions = [];
  let questionIndex = 0;
  let scores = { top: 0, bottom: 0 };
  let playing = false;

  function showQuestion() {
    question.textContent = questions[questionIndex % questions.length];
    number.textContent = chinese ? '第 ' + (questionIndex % questions.length + 1) + ' 题 · 共 ' + questions.length + ' 题' : 'Question ' + (questionIndex % questions.length + 1) + ' of ' + questions.length;
  }

  function reset() {
    scores = { top: 0, bottom: 0 };
    questionIndex = 0;
    playing = true;
    winner.hidden = true;
    winner.textContent = '';
    teams.forEach(function (team) {
      const runner = document.getElementById(team + '-runner');
      runner.classList.remove('moving');
      runner.style.left = '0%';
      document.getElementById(team + '-score').textContent = '0 / 10';
      document.getElementById(team + '-progress').value = 0;
      document.getElementById(team + '-correct').disabled = false;
    });
    restart.disabled = false;
    status.textContent = chinese ? '比赛开始！答对一题前进一格，先到第 10 格获胜。' : 'Race on! Each correct answer moves one step. First to ten wins.';
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
  });

  restart.addEventListener('click', reset);

  teams.forEach(function (team) {
    const button = document.getElementById(team + '-correct');
    const runner = document.getElementById(team + '-runner');
    runner.addEventListener('animationend', function () { runner.classList.remove('moving'); });
    button.addEventListener('click', function () {
      if (!playing) return;
      scores[team] += 1;
      runner.style.left = (scores[team] * 10) + '%';
      runner.classList.add('moving');
      document.getElementById(team + '-score').textContent = scores[team] + ' / 10';
      document.getElementById(team + '-progress').value = scores[team];
      if (scores[team] === 10) {
        playing = false;
        winner.textContent = chinese ? '🏆 ' + (team === 'top' ? '上队 · 兔子队' : '下队 · 小鸡队') + '获胜！' : '🏆 ' + (team === 'top' ? 'Top · Team Rabbit' : 'Bottom · Team Chick') + ' wins!';
        const gift = document.createElement('img');
        gift.src = '/teaching-tools/team-race/assets/gift.png';
        gift.alt = '';
        winner.prepend(gift);
        winner.hidden = false;
        status.textContent = chinese ? '比赛结束，点击“重新开始”再来一局。' : 'Race finished. Press Restart for another round.';
        teams.forEach(function (name) { document.getElementById(name + '-correct').disabled = true; });
        return;
      }
      questionIndex += 1;
      showQuestion();
    });
  });
}());
