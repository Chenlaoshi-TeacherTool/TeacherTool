/*
 * 棋盘游戏 · Board Game Maker — projector play (one screen, teams take turns).
 * Uses the same board as the printout (window.BoardGamesRender from board-games.js)
 * and adds teams, an on-screen die, moving pawns and a pop-up for each square.
 *
 *   path / ladder  roll, move, read the square; teacher marks ✔ or ✖ (✖ can send the pawn back)
 *   flight         one pawn per team: leave the base, a lap of the track, the home path, the centre
 *   line           no die: the team picks a square; ✔ claims it; N in a row wins
 */
(function () {
  'use strict';

  var core = window.BoardGamesCore;
  var R = window.BoardGamesRender;
  var ZH = window.BG_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  var TEAMS = core.TEAMS.concat([
    { key: 'purple', zh: '紫', en: 'Purple', color: '#9c5bd6', soft: '#eadcf7', shape: '◆' },
    { key: 'orange', zh: '橙', en: 'Orange', color: '#f08c00', soft: '#ffe3bf', shape: '♥' }
  ]);
  var MAX_TEAMS = { path: 6, ladder: 6, line: 4, flight: 4 };
  var FINISH = 56; // flight: 0–50 track, 51–55 home path, 56 centre

  var g = null; // the running game

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- setup ----------

  function open() {
    var layout = R.current();
    if (!layout) { alert(T('Type at least 4 words first.', '请先输入至少 4 个词。')); return; }
    var board = layout.data.board;
    var max = MAX_TEAMS[board];
    var count = Math.min(max, board === 'line' ? 2 : 4);
    var box = $('bgPlay');
    box.hidden = false;
    box.innerHTML =
      '<div class="pl-setup"><button type="button" class="pl-close" data-close aria-label="' + T('Close', '关闭') + '">✕</button>' +
      '<h2>📽️ ' + T('Play together', '投影一起玩') + ' · ' + esc(R.boardName(board).zh) + '</h2>' +
      '<p>' + T('How many teams?', '分几队？') + '</p><div class="pl-count">' +
      Array.from({ length: max - 1 }, function (x, i) { var n = i + 2; return '<button type="button" data-count="' + n + '"' + (n === count ? ' aria-pressed="true"' : '') + '>' + n + '</button>'; }).join('') +
      '</div><div class="pl-names"></div>' +
      (board === 'line' ? '' : '<label class="pl-opt"><input type="checkbox" id="plBack" checked> ' + T('Wrong answer: go back to where you were', '答错了退回原来的位置') + '</label>') +
      (board === 'flight' ? '<label class="pl-opt"><input type="checkbox" id="plSix"> ' + T('Roll a 6 to leave the base', '掷到 6 才能起飞') + '</label>' : '') +
      '<button type="button" class="pl-start" data-start>' + T('Start', '开始') + ' ▶</button></div>';
    var names = function (n) {
      box.querySelector('.pl-names').innerHTML = TEAMS.slice(0, n).map(function (t, i) {
        return '<label style="--team:' + t.color + '"><span>' + t.shape + '</span><input type="text" maxlength="12" value="' + esc(ZH ? t.zh + '队' : t.en) + '" data-name="' + i + '"></label>';
      }).join('');
    };
    names(count);
    box.onclick = function (e) {
      var c = e.target.closest('[data-count]');
      if (c) {
        count = Number(c.dataset.count);
        box.querySelectorAll('[data-count]').forEach(function (b) { b.removeAttribute('aria-pressed'); });
        c.setAttribute('aria-pressed', 'true');
        names(count);
      }
      if (e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-start]')) {
        var teamNames = Array.prototype.map.call(box.querySelectorAll('[data-name]'), function (i) { return i.value.trim() || i.defaultValue; });
        start(layout, teamNames, { back: $('plBack') ? $('plBack').checked : false, six: $('plSix') ? $('plSix').checked : false });
      }
    };
    if (box.requestFullscreen) box.requestFullscreen().catch(function () {});
  }

  function close() {
    g = null;
    $('bgPlay').hidden = true;
    $('bgPlay').innerHTML = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  // ---------- game screen ----------

  function start(layout, names, opts) {
    var board = layout.data.board;
    var W = board === 'path' ? 271 : 184, H = board === 'path' ? 165 : 184;
    var geom = {};
    var svgText = R.draw(layout, W, H, geom);
    g = {
      layout: layout, board: board, geom: geom, opts: opts, turn: 0, busy: false, winner: null, claims: {},
      last: board === 'flight' ? FINISH : layout.squares.length - 1,
      teams: names.map(function (name, i) { return { name: name, t: TEAMS[i], pos: board === 'flight' ? -1 : 0, skip: false }; }),
      actions: R.actionPool(layout.data)
    };
    var box = $('bgPlay');
    box.onclick = onClick;
    box.innerHTML =
      '<div class="pl-game">' +
      '<div class="pl-board">' + svgText + '</div>' +
      '<aside class="pl-side">' +
      '<button type="button" class="pl-close" data-close aria-label="' + T('Close', '关闭') + '">✕</button>' +
      '<h2>' + esc(layout.data.title || R.boardName(board).zh) + '</h2>' +
      '<ol class="pl-teams"></ol>' +
      (board === 'line'
        ? '<p class="pl-hint">' + T('Pick a square on the board.', '在棋盘上点一个格子。') + '</p>'
        : '<div class="pl-die" aria-live="polite">🎲</div><button type="button" class="pl-roll" data-roll>' + T('Roll', '掷骰子') + '</button>') +
      '<p class="pl-msg" aria-live="polite"></p>' +
      '<button type="button" class="pl-small" data-pass>' + T('Next team ⏭', '下一队 ⏭') + '</button>' +
      '</aside>' +
      '<div class="pl-pop" hidden></div></div>';
    var svg = box.querySelector('.pl-board svg');
    svg.removeAttribute('style');
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'pl-layer');
    svg.appendChild(layer);
    if (board === 'line') {
      layout.squares.forEach(function (sq) {
        var r = geom[sq.i];
        var hit = document.createElementNS(NS, 'rect');
        hit.setAttribute('x', r.x); hit.setAttribute('y', r.y); hit.setAttribute('width', r.w); hit.setAttribute('height', r.h);
        hit.setAttribute('class', 'pl-hit'); hit.dataset.sq = sq.i;
        layer.appendChild(hit);
      });
    } else {
      g.teams.forEach(function (team, i) {
        var p = document.createElementNS(NS, 'g');
        p.setAttribute('class', 'pl-pawn');
        var size = Math.min(geom[0].w, geom[0].h) * (board === 'flight' ? 0.34 : 0.17);
        p.innerHTML = '<circle r="' + size + '" fill="' + team.t.color + '" stroke="#fff" stroke-width="' + (size * 0.18) + '"/>' +
          '<text text-anchor="middle" dominant-baseline="central" font-size="' + size * 1.1 + '" fill="#fff">' + team.t.shape + '</text>';
        team.el = p;
        layer.appendChild(p);
      });
      placeAll(true);
    }
    paintSide();
  }

  // Centre of where a team's pawn stands, spread out when several share a square.
  function spot(team, index) {
    var geom = g.geom, r;
    if (g.board === 'flight') {
      var p = team.pos, t = index;
      if (p < 0) r = geom['base' + t];
      else if (p <= 50) r = geom[(g.layout.teams[t].start + p) % 52];
      else if (p < FINISH) r = geom['home' + t + '_' + (p - 51)];
      else r = geom.centre;
    } else r = geom[team.pos];
    var here = g.teams.filter(function (o) { return o.pos === team.pos && (g.board !== 'flight' || spotKey(o) === spotKey(team)); });
    var k = here.indexOf(team), n = here.length;
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (n > 1) {
      var a = (k / n) * Math.PI * 2 - Math.PI / 2, d = Math.min(r.w, r.h) * 0.24;
      cx += Math.cos(a) * d; cy += Math.sin(a) * d;
    }
    return { x: cx, y: cy };
  }
  function spotKey(team) {
    var i = g.teams.indexOf(team), p = team.pos;
    if (p < 0) return 'base' + i;
    if (p <= 50) return 't' + ((g.layout.teams[i].start + p) % 52);
    return p < FINISH ? 'home' + i + '_' + p : 'centre';
  }

  function placeAll(instant) {
    g.teams.forEach(function (team, i) {
      var s = spot(team, i);
      team.el.style.transition = instant || reduced ? 'none' : '';
      team.el.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px)';
    });
  }

  function paintSide() {
    var box = $('bgPlay');
    box.querySelector('.pl-teams').innerHTML = g.teams.map(function (team, i) {
      var where = g.board === 'line'
        ? Object.keys(g.claims).filter(function (k) { return g.claims[k] === i; }).length + T(' squares', ' 格')
        : g.board === 'flight' ? (team.pos < 0 ? T('in base', '在基地') : team.pos >= FINISH ? '🏁' : (team.pos + 1) + ' / ' + (FINISH + 1))
          : (team.pos + 1) + ' / ' + (g.last + 1);
      return '<li class="' + (i === g.turn && !g.winner ? 'is-turn' : '') + '" style="--team:' + team.t.color + '"><span class="pl-chip">' + team.t.shape + '</span><b>' + esc(team.name) + '</b><small>' + where + (team.skip ? ' ⏸️' : '') + '</small></li>';
    }).join('');
  }

  function say(msg) { var m = $('bgPlay').querySelector('.pl-msg'); if (m) m.textContent = msg || ''; }

  function nextTurn() {
    if (g.winner) return;
    g.turn = (g.turn + 1) % g.teams.length;
    paintSide();
    var team = g.teams[g.turn];
    say(T(team.name + ': your turn', '轮到' + team.name));
  }

  // ---------- dice and moving ----------

  async function roll() {
    if (!g || g.busy || g.winner || g.board === 'line') return;
    var team = g.teams[g.turn];
    if (team.skip) {
      team.skip = false;
      say(T(team.name + ' misses this turn ⏸️', team.name + ' 这一轮停一次 ⏸️'));
      nextTurn();
      return;
    }
    g.busy = true;
    var die = $('bgPlay').querySelector('.pl-die');
    var value = 1 + Math.floor(Math.random() * 6);
    die.textContent = '🎲';
    await bigRoll(value, team);
    die.textContent = DICE[value - 1];
    team.prev = team.pos;
    if (g.board === 'flight' && team.pos < 0) {
      if (g.opts.six && value !== 6) { say(T('Need a 6 to take off.', '要掷到 6 才能起飞。')); g.busy = false; nextTurn(); return; }
      team.pos = 0; placeAll(); say(T(team.name + ' takes off! ✈', team.name + ' 起飞了！✈')); await wait(500);
      g.busy = false; nextTurn(); return;
    }
    await walk(team, Math.min(g.last, team.pos + value));
    await land(team);
  }

  // Die face as SVG pips, so it looks the same on every projector (the ⚀–⚅ glyphs vary by font).
  var PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]] };
  function faceSvg(v) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + PIPS[v].map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + (v === 1 ? '#e8594a' : '#1f2b26') + '"/>';
    }).join('') + '</svg>';
  }

  // Big die that drops into the middle of the screen, tumbles, lands on the value, then gets out of the way.
  async function bigRoll(value, team) {
    var game = $('bgPlay').querySelector('.pl-game');
    var stage = document.createElement('div');
    stage.className = 'pl-rollstage';
    stage.innerHTML = '<div class="pl-bigdie" style="--team:' + team.t.color + '">' + faceSvg(value) + '</div>' +
      '<p class="pl-rollnum">' + esc(team.name) + ' · ' + T('rolled ', '掷到 ') + '<b>' + value + '</b></p>';
    game.appendChild(stage);
    var big = stage.querySelector('.pl-bigdie'), num = stage.querySelector('.pl-rollnum');
    var animate = !reduced && big.animate;
    if (animate) {
      stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'forwards' });
      var spin = setInterval(function () { big.innerHTML = faceSvg(1 + Math.floor(Math.random() * 6)); }, 85);
      big.animate([
        { transform: 'translateY(-70vh) rotate(-260deg) scale(.55)' },
        { transform: 'translateY(0) rotate(-25deg) scale(1)', offset: .55 },
        { transform: 'translateY(-9vh) rotate(10deg) scale(1)', offset: .72 },
        { transform: 'translateY(0) rotate(0) scale(1.08, .92)', offset: .88 },
        { transform: 'translateY(0) rotate(0) scale(1)' }
      ], { duration: 950, easing: 'cubic-bezier(.3,.7,.4,1)' });
      await wait(620);
      clearInterval(spin);
      big.innerHTML = faceSvg(value);
      await wait(330); // timers, not .finished: a background tab can stall animation promises and freeze the game
      num.classList.add('is-in');
      big.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
      await wait(900);
      stage.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      await wait(220);
    } else {
      num.classList.add('is-in');
      await wait(900);
    }
    stage.remove();
  }

  async function walk(team, target) {
    var step = target > team.pos ? 1 : -1;
    while (team.pos !== target) { team.pos += step; placeAll(); await wait(reduced ? 0 : 230); }
    paintSide();
  }

  function squareOf(team) {
    var i = g.teams.indexOf(team);
    if (g.board === 'flight') return team.pos >= 0 && team.pos <= 50 ? g.layout.squares[(g.layout.teams[i].start + team.pos) % 52] : null;
    return g.layout.squares[team.pos];
  }

  async function land(team) {
    if (team.pos >= g.last) { win(team); return; }
    var sq = squareOf(team);
    if (!sq || sq.kind === 'start') { g.busy = false; nextTurn(); return; }
    if (sq.kind === 'special') {
      var sp = sq.special;
      await popup(specialHtml(sp), [{ label: 'OK', value: 'ok', main: true }]);
      if (sp.move) { await walk(team, Math.max(0, Math.min(g.last, team.pos + sp.move))); if (team.pos >= g.last) { win(team); return; } }
      if (sp.key === 'skip') team.skip = true;
      g.busy = false;
      if (sp.key === 'again') { say(T(team.name + ': roll again!', team.name + ' 再掷一次！')); paintSide(); return; }
      nextTurn();
      return;
    }
    var ok = await ask(sq);
    if (!ok && g.opts.back) { say(T('Back to where you were.', '退回原来的位置。')); await walk(team, team.prev); }
    if (ok) await bonus(team, sq);
    g.busy = false;
    nextTurn();
  }

  // Ladders, slides and same-colour jumps after a correct answer.
  async function bonus(team, sq) {
    if (g.board === 'ladder') {
      var link = g.layout.links.find(function (l) { return l.from === team.pos; });
      if (link) {
        say(link.kind === 'ladder' ? T('Up the ladder! 🪜', '爬梯子！🪜') : T('Down the slide! 🛝', '滑下去！🛝'));
        team.pos = link.to; placeAll(); paintSide(); await wait(700);
        if (team.pos >= g.last) win(team);
      }
    }
    if (g.board === 'flight' && sq.team === g.teams.indexOf(team) && team.pos <= 46) {
      say(T('Your colour! Jump 4 squares ✈', '同色格！再跳 4 格 ✈'));
      await wait(400);
      team.pos += 4; placeAll(); paintSide(); await wait(500);
    }
  }

  function win(team) {
    g.winner = team;
    g.busy = false;
    paintSide();
    popup('<div class="pl-win" style="--team:' + team.t.color + '">🏆<b>' + esc(team.name) + '</b><span>' + T('wins!', '赢了！') + '</span></div>',
      [{ label: T('Play again', '再玩一次'), value: 'again', main: true }, { label: T('Close', '关闭'), value: 'close' }]).then(function (v) {
      if (v === 'again') { var names = g.teams.map(function (t) { return t.name; }); start(g.layout, names, g.opts); }
      else close();
    });
  }

  // ---------- line board ----------

  async function claim(i) {
    if (!g || g.busy || g.winner || g.claims[i] != null) return;
    g.busy = true;
    var ok = await ask(g.layout.squares[i]);
    if (ok) {
      g.claims[i] = g.turn;
      var r = g.geom[i], team = g.teams[g.turn];
      var mark = document.createElementNS(NS, 'g');
      mark.setAttribute('class', 'pl-claim');
      mark.innerHTML = '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="2" fill="' + team.t.color + '" opacity="0.45"/>' +
        '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2) + '" text-anchor="middle" dominant-baseline="central" font-size="' + r.h * 0.6 + '" fill="' + team.t.color + '" opacity="0.9">' + team.t.shape + '</text>';
      $('bgPlay').querySelector('.pl-layer').insertBefore(mark, $('bgPlay').querySelector('.pl-hit'));
      if (lineWin(i)) { win(team); return; }
      if (Object.keys(g.claims).length === g.layout.squares.length) { say(T('Board full: a draw!', '格子都占满了：平局！')); g.busy = false; return; }
    }
    g.busy = false;
    nextTurn();
  }

  function lineWin(i) {
    var size = g.layout.size, need = g.layout.win, who = g.claims[i];
    var r = Math.floor(i / size), c = i % size;
    return [[0, 1], [1, 0], [1, 1], [1, -1]].some(function (d) {
      var run = 1;
      [1, -1].forEach(function (s) {
        for (var k = 1; k < need; k++) {
          var rr = r + d[0] * k * s, cc = c + d[1] * k * s;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size || g.claims[rr * size + cc] !== who) break;
          run++;
        }
      });
      return run >= need;
    });
  }

  // ---------- pop-ups ----------

  var popResolve = null;
  function popup(html, buttons) {
    var pop = $('bgPlay').querySelector('.pl-pop');
    pop.innerHTML = '<div class="pl-card">' + html + '<div class="pl-buttons">' + buttons.map(function (b) {
      return '<button type="button" data-answer="' + b.value + '" class="' + (b.main ? 'is-main' : '') + (b.cls ? ' ' + b.cls : '') + '">' + b.label + '</button>';
    }).join('') + '</div></div>';
    pop.hidden = false;
    return new Promise(function (resolve) { popResolve = resolve; });
  }
  function answer(value) {
    var pop = $('bgPlay').querySelector('.pl-pop');
    if (!pop || pop.hidden || !popResolve) return;
    if (value === 'flip') { flipCard(); return; }
    pop.hidden = true;
    var r = popResolve; popResolve = null; r(value);
  }

  var JUDGE = [
    { label: '✔ ' + T('Done!', '做到了！'), value: 'yes', main: true, cls: 'is-yes' },
    { label: '✖ ' + T('Not yet', '没做到'), value: 'no', cls: 'is-no' }
  ];

  function ask(sq) {
    var html;
    var data = g.layout.data;
    if (sq.kind === 'action') html = actionHtml(sq.action);
    else if (sq.kind === 'card') {
      return popup('<div class="pl-cardback">⭐<b>' + T('Draw an action card', '抽一张动作卡') + '</b></div>',
        [{ label: T('Flip the card', '翻开卡片') + ' 🔄', value: 'flip', main: true }]).then(function (v) { return v === 'yes'; });
    } else {
      var w = data.words[sq.word] || { zh: '?' };
      var pic = data.options.pictures ? R.picture(w.zh) : null;
      html = '<div class="pl-word">' + (pic ? '<img src="' + esc(pic) + '" alt="">' : '') + '<b>' + esc(w.zh) + '</b>' +
        (w.py ? '<span class="pl-py">' + esc(w.py) + '</span>' : '') + (w.en ? '<small>' + esc(w.en) + '</small>' : '') + '</div>' +
        (sq.kind === 'task' ? '<p class="pl-task">' + sq.task.icon + ' ' + esc(sq.task.zh) + (sq.task.py ? '<small>' + esc(sq.task.py) + '</small>' : '') + (!ZH && sq.task.en ? '<small>' + esc(sq.task.en) + '</small>' : '') + '</p>' : '');
    }
    return popup(html, JUDGE).then(function (v) { return v === 'yes'; });
  }

  function flipCard() {
    var a = g.actions[Math.floor(Math.random() * g.actions.length)];
    var pop = $('bgPlay').querySelector('.pl-pop');
    pop.querySelector('.pl-card').innerHTML = (a ? actionHtml(a) : '<p>' + T('No action cards chosen.', '没有选动作卡。') + '</p>') +
      '<div class="pl-buttons">' + JUDGE.map(function (b) { return '<button type="button" data-answer="' + b.value + '" class="' + (b.main ? 'is-main ' : '') + b.cls + '">' + b.label + '</button>'; }).join('') + '</div>';
  }

  function actionHtml(a) {
    return '<div class="pl-action"><span class="pl-icon">' + a.icon + '</span><b>' + esc(a.zh) + '</b>' +
      (a.py ? '<span class="pl-py">' + esc(a.py) + '</span>' : '') + (a.en ? '<small>' + esc(a.en) + '</small>' : '') + '</div>';
  }

  function specialHtml(sp) {
    return '<div class="pl-action"><span class="pl-icon">' + sp.icon + '</span><b>' + esc(sp.zh) + '</b><span class="pl-py">' + esc(sp.py) + '</span><small>' + esc(sp.en) + '</small></div>';
  }

  // ---------- input ----------

  function onClick(e) {
    if (e.target.closest('[data-close]')) { close(); return; }
    var a = e.target.closest('[data-answer]');
    if (a) { answer(a.dataset.answer); return; }
    if (e.target.closest('[data-roll]')) { roll(); return; }
    if (e.target.closest('[data-pass]')) { if (g && !g.busy) nextTurn(); return; }
    var hit = e.target.closest('.pl-hit');
    if (hit) claim(Number(hit.dataset.sq));
  }

  document.addEventListener('keydown', function (e) {
    if (!g || $('bgPlay').hidden) return;
    var pop = $('bgPlay').querySelector('.pl-pop');
    var popOpen = pop && !pop.hidden;
    if (e.key === 'Escape') { if (!document.fullscreenElement) close(); return; }
    if (popOpen) {
      var buttons = pop.querySelectorAll('[data-answer]');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buttons[0] && answer(buttons[0].dataset.answer); }
      else if ((e.key === 'Backspace' || e.key.toLowerCase() === 'x') && pop.querySelector('[data-answer=no]')) { e.preventDefault(); answer('no'); }
    } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); roll(); }
  });

  $('bgPlayBtn').addEventListener('click', open);
})();
