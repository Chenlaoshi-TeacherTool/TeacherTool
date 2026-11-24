/*
 * 棋盘游戏 · Board Game Maker — online room screens (teacher and student).
 * The server (routes/boardRooms.js) owns the game; this file only shows the
 * live state it streams and sends taps (roll, answer, claim, judge…).
 *
 *   Teacher page: the 🌐 button opens a room from the current board.
 *   Student page (/board/:code): join with a name and a team.
 */
(function () {
  'use strict';

  var core = window.BoardGamesCore;
  var D = window.BoardGamesDraw;
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };
  var esc = D.esc;
  var NS = 'http://www.w3.org/2000/svg';
  var DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  var TEAMS = core.TEAMS.concat([
    { key: 'purple', zh: '紫', en: 'Purple', color: '#9c5bd6', soft: '#eadcf7', shape: '◆' },
    { key: 'orange', zh: '橙', en: 'Orange', color: '#f08c00', soft: '#ffe3bf', shape: '♥' }
  ]);
  var MAX_TEAMS = { path: 6, ladder: 6, line: 4, flight: 4 };
  var FINISH = 56;
  var QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  function api(path, body) {
    return fetch('/api/board-rooms' + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'X-Board-Request': 'yes' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) { var e = new Error(json.error || T('Something went wrong.', '出错了，请再试一次。')); e.status = res.status; e.membersOnly = json.membersOnly; throw e; }
        return json;
      });
    });
  }

  function message(s) {
    var d = s.messageData || {};
    var team = d.team != null && s.teams[d.team] ? s.teams[d.team].name : '';
    var map = {
      joined: T('A student joined.', '有同学加入了。'),
      started: T('The game has started!', '游戏开始！'),
      pending: '',
      moved: '',
      right: T('✔ Correct!', '✔ 答对了！'),
      wrong: d.back ? T('✖ Not quite: back to where you were.', '✖ 没答对，退回原来的位置。') : T('✖ Not quite.', '✖ 没答对。'),
      ladder: T('Up the ladder! 🪜', '爬梯子！🪜'),
      slide: T('Down the slide! 🛝', '滑下去！🛝'),
      jump: T('Your colour! Jump 4 squares ✈', '同色格！再跳 4 格 ✈'),
      takeOff: T(team + ' takes off! ✈', team + ' 起飞了！✈'),
      needSix: T('Need a 6 to take off.', '要掷到 6 才能起飞。'),
      skipped: T(team + ' misses this turn ⏸️', team + ' 这一轮停一次 ⏸️'),
      skippedByTeacher: T('The teacher skipped this turn.', '老师跳过了这一轮。'),
      special: ({ forward: T('Go forward 2 ⏩', '前进两格 ⏩'), back: T('Go back 1 ⏪', '后退一格 ⏪'), again: T('Roll again 🎲', '再掷一次 🎲'), skip: T('Miss a turn next time ⏸️', '下一轮停一次 ⏸️') })[d.key] || '',
      win: T(team + ' wins! 🏆', team + ' 赢了！🏆'),
      draw: T('Board full: a draw!', '格子都占满了：平局！')
    };
    return map[s.message] || '';
  }

  // ---------- board drawing (shared) ----------

  function Board(el) {
    this.el = el;
    this.key = null;
  }
  Board.prototype.update = function (s, onSquare) {
    var data = core.normalize(Object.assign({}, s.data, { options: Object.assign({}, s.data.options, { seed: s.seed }) }));
    var key = data.board + '|' + s.seed;
    if (key !== this.key) {
      this.key = key;
      this.layout = core.generate(data);
      this.geom = {};
      var W = data.board === 'path' ? 271 : 184, H = data.board === 'path' ? 165 : 184;
      this.el.innerHTML = D.draw(this.layout, W, H, this.geom, s.pictures || {});
      var svg = this.el.querySelector('svg');
      svg.removeAttribute('style');
      this.layer = document.createElementNS(NS, 'g');
      svg.appendChild(this.layer);
      this.pawns = [];
      var self = this;
      if (data.board === 'line') {
        this.layout.squares.forEach(function (sq) {
          var r = self.geom[sq.i];
          var hit = document.createElementNS(NS, 'rect');
          ['x', 'y'].forEach(function (k) { hit.setAttribute(k, r[k]); });
          hit.setAttribute('width', r.w); hit.setAttribute('height', r.h);
          hit.setAttribute('class', 'pl-hit'); hit.dataset.sq = sq.i;
          hit.addEventListener('click', function () { if (self.onSquare) self.onSquare(sq.i); });
          self.layer.appendChild(hit);
        });
      }
    }
    this.onSquare = onSquare;
    this.draw(s);
  };
  Board.prototype.draw = function (s) {
    var self = this, layout = this.layout, geom = this.geom;
    if (layout.data.board === 'line') {
      Array.prototype.forEach.call(this.layer.querySelectorAll('.pl-claim'), function (m) { m.remove(); });
      Object.keys(s.claims || {}).forEach(function (i) {
        var r = geom[i], team = TEAMS[s.teams[s.claims[i]].color];
        var mark = document.createElementNS(NS, 'g');
        mark.setAttribute('class', 'pl-claim');
        mark.innerHTML = '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="2" fill="' + team.color + '" opacity="0.45"/>' +
          '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2) + '" text-anchor="middle" dominant-baseline="central" font-size="' + r.h * 0.6 + '" fill="' + team.color + '">' + team.shape + '</text>';
        self.layer.insertBefore(mark, self.layer.firstChild);
      });
      return;
    }
    while (this.pawns.length < s.teams.length) {
      var p = document.createElementNS(NS, 'g');
      p.setAttribute('class', 'pl-pawn');
      this.layer.appendChild(p);
      this.pawns.push(p);
    }
    var size = Math.min(geom[0].w, geom[0].h) * (layout.data.board === 'flight' ? 0.34 : 0.17);
    var spots = {};
    s.teams.forEach(function (team) {
      var k = spotKey(layout, team);
      spots[k] = (spots[k] || []).concat(team);
    });
    s.teams.forEach(function (team, i) {
      var t = TEAMS[team.color];
      var el = self.pawns[i];
      el.innerHTML = '<circle r="' + size + '" fill="' + t.color + '" stroke="#fff" stroke-width="' + size * 0.18 + '"/><text text-anchor="middle" dominant-baseline="central" font-size="' + size * 1.1 + '" fill="#fff">' + t.shape + '</text>';
      var r = rectOf(layout, geom, team);
      var here = spots[spotKey(layout, team)], k = here.indexOf(team), n = here.length;
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (n > 1) { var a = k / n * Math.PI * 2 - Math.PI / 2, d = Math.min(r.w, r.h) * 0.24; cx += Math.cos(a) * d; cy += Math.sin(a) * d; }
      el.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    });
  };
  function rectOf(layout, geom, team) {
    if (layout.data.board !== 'flight') return geom[team.pos];
    var p = team.pos, c = team.color;
    if (p < 0) return geom['base' + c];
    if (p <= 50) return geom[(layout.teams[c].start + p) % 52];
    return p < FINISH ? geom['home' + c + '_' + (p - 51)] : geom.centre;
  }
  function spotKey(layout, team) {
    if (layout.data.board !== 'flight') return 'p' + team.pos;
    var p = team.pos, c = team.color;
    if (p < 0) return 'base' + c;
    if (p <= 50) return 't' + (layout.teams[c].start + p) % 52;
    return p < FINISH ? 'home' + c + '_' + p : 'centre';
  }

  function teamList(s, mine) {
    return '<ol class="pl-teams">' + s.teams.map(function (team, i) {
      var t = TEAMS[team.color];
      var members = s.players.filter(function (p) { return p.team === i; });
      var where = s.data.board === 'line'
        ? Object.keys(s.claims || {}).filter(function (k) { return s.claims[k] === i; }).length + T(' squares', ' 格')
        : s.data.board === 'flight' ? (team.pos < 0 ? T('in base', '在基地') : team.pos >= FINISH ? '🏁' : (team.pos + 1) + ' / ' + (FINISH + 1))
          : (team.pos + 1) + ' / ' + (s.data.board === 'ladder' ? s.data.options.size * s.data.options.size : s.data.options.size);
      return '<li class="' + (s.status === 'playing' && i === s.turn ? 'is-turn' : '') + (mine === i ? ' is-mine' : '') + '" style="--team:' + t.color + '"><span class="pl-chip">' + t.shape + '</span><b>' + esc(team.name) + '</b>' +
        '<small>' + (s.status === 'lobby' ? members.length + T(' joined', ' 人') : where) + (team.skip ? ' ⏸️' : '') + '</small>' +
        '<span class="rm-members">' + members.map(function (p) { return '<i' + (p.id === s.active ? ' class="is-active"' : '') + '>' + esc(p.name) + '</i>'; }).join('') + '</span></li>';
    }).join('') + '</ol>';
  }

  function wordCard(s, opts) {
    var p = s.pending;
    var pic = null;
    if (p.prompt) {
      var w = s.data.words.find(function (x) { return x.zh === p.prompt.zh || (p.prompt.py && x.py === p.prompt.py); });
      if (w && s.data.options.pictures) pic = (s.pictures || {})[w.zh];
    }
    var ask = { en: T('What does it mean?', '它是什么意思？'), py: T('Which pinyin?', '拼音是哪个？'), zh: T('Which word?', '是哪个词？'), none: T('Read it out loud.', '大声读出来。') }[p.mode];
    return '<div class="pl-word">' + (pic ? '<img src="' + esc(pic) + '" alt="">' : '') +
      (p.prompt.zh ? '<b>' + esc(p.prompt.zh) + '</b>' : '') + (p.prompt.py ? '<span class="pl-py">' + esc(p.prompt.py) + '</span>' : '') +
      '<p class="rm-ask">' + ask + '</p></div>' +
      (p.choices && p.choices.length ? '<div class="rm-choices">' + p.choices.map(function (c, i) {
        return '<button type="button" data-choice="' + i + '"' + (opts.canAnswer ? '' : ' disabled') + (opts.answer === i ? ' class="is-answer"' : '') + (p.mode === 'zh' ? ' style="font-family:KaiTi,STKaiti,serif"' : p.mode === 'py' ? ' style="font-family:Andika,sans-serif"' : '') + '>' + esc(c) + '</button>';
      }).join('') + '</div>' : (opts.canAnswer ? '<div class="rm-choices"><button type="button" data-choice="0">' + T('Done', '读完了') + '</button></div>' : ''));
  }

  function judgeCard(s, sq) {
    var p = s.pending, html = '';
    if (p.action) html = actionHtml(p.action);
    else if (sq && sq.kind === 'action') html = actionHtml(sq.action);
    else if (sq && sq.kind === 'task') {
      var w = s.data.words[sq.word] || {};
      html = '<div class="pl-word"><b>' + esc(w.zh) + '</b>' + (w.py ? '<span class="pl-py">' + esc(w.py) + '</span>' : '') + '</div><p class="pl-task">' + sq.task.icon + ' ' + esc(sq.task.zh) + (sq.task.py ? '<small>' + esc(sq.task.py) + '</small>' : '') + '</p>';
    }
    return html;
  }

  function actionHtml(a) {
    return '<div class="pl-action"><span class="pl-icon">' + a.icon + '</span><b>' + esc(a.zh) + '</b>' + (a.py ? '<span class="pl-py">' + esc(a.py) + '</span>' : '') + (a.en ? '<small>' + esc(a.en) + '</small>' : '') + '</div>';
  }

  function listen(code, token, onState, onGone) {
    var source = new EventSource('/api/board-rooms/' + code + '/events?token=' + encodeURIComponent(token));
    source.onmessage = function (e) {
      var state;
      try { state = JSON.parse(e.data); } catch (err) { return; }
      if (state.status === 'closed') { source.close(); onGone({}); return; }
      onState(state);
    };
    source.addEventListener('gone', function (e) { source.close(); onGone(JSON.parse(e.data || '{}')); });
    source.addEventListener('removed', function () { source.close(); onGone({ removed: true }); });
    return source;
  }

  function loadQr() {
    if (window.QRCode) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = QR_URL; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------- teacher ----------

  function hostSetup() {
    var R = window.BoardGamesRender;
    var layout = R && R.current();
    if (!layout) { alert(T('Type at least 4 words first.', '请先输入至少 4 个词。')); return; }
    var board = layout.data.board, max = MAX_TEAMS[board], count = Math.min(max, board === 'line' ? 2 : 4);
    var box = $('bgPlay');
    box.hidden = false;
    box.innerHTML = '<div class="pl-setup"><button type="button" class="pl-close" data-close aria-label="' + T('Close', '关闭') + '">✕</button>' +
      '<h2>🌐 ' + T('Online room', '开房间在线玩') + ' · ' + esc(R.boardName(board).zh) + '</h2>' +
      '<p class="rm-note">' + T('Students join on their own phone, tablet or computer with a room code. Word squares ask them a three-choice question; you mark task and action squares as done.', '学生用自己的手机、平板或电脑输入房间号加入。停在词语格会出三选一题自动判断；任务格和动作格由你按“完成”。') + '</p>' +
      '<p>' + T('How many teams?', '分几队？') + '</p><div class="pl-count">' +
      Array.from({ length: max - 1 }, function (x, i) { var n = i + 2; return '<button type="button" data-count="' + n + '"' + (n === count ? ' aria-pressed="true"' : '') + '>' + n + '</button>'; }).join('') +
      '</div><div class="pl-names"></div>' +
      (board === 'line' ? '' : '<label class="pl-opt"><input type="checkbox" id="rmBack" checked> ' + T('Wrong answer: go back to where you were', '答错了退回原来的位置') + '</label>') +
      (board === 'flight' ? '<label class="pl-opt"><input type="checkbox" id="rmSix"> ' + T('Roll a 6 to leave the base', '掷到 6 才能起飞') + '</label>' : '') +
      '<p class="rm-error" role="alert" hidden></p>' +
      '<button type="button" class="pl-start" data-open>' + T('Open the room', '开房间') + ' ▶</button></div>';
    var names = function (n) {
      box.querySelector('.pl-names').innerHTML = TEAMS.slice(0, n).map(function (t, i) {
        return '<label style="--team:' + t.color + '"><span>' + t.shape + '</span><input type="text" maxlength="12" value="' + esc(ZH ? t.zh + '队' : t.en) + '" data-name="' + i + '"></label>';
      }).join('');
    };
    names(count);
    box.onclick = function (e) {
      var c = e.target.closest('[data-count]');
      if (c) { count = Number(c.dataset.count); box.querySelectorAll('[data-count]').forEach(function (b) { b.removeAttribute('aria-pressed'); }); c.setAttribute('aria-pressed', 'true'); names(count); }
      if (e.target.closest('[data-close]')) hostClose();
      var go = e.target.closest('[data-open]');
      if (go) {
        go.disabled = true;
        var teamNames = Array.prototype.map.call(box.querySelectorAll('[data-name]'), function (i) { return i.value.trim() || i.defaultValue; });
        var pics = {};
        layout.data.words.forEach(function (w) { var u = R.picture(w.zh); if (u) pics[w.zh] = u; });
        api('', { data: layout.data, teams: teamNames, pictures: pics, back: $('rmBack') ? $('rmBack').checked : true, six: $('rmSix') ? $('rmSix').checked : false })
          .then(function (room) { hostRoom(room.code, room.hostToken); })
          .catch(function (error) {
            go.disabled = false;
            var err = box.querySelector('.rm-error');
            err.hidden = false;
            err.innerHTML = error.membersOnly
              ? T('Online rooms are part of the teacher membership. ', '开房间在线玩是会员功能。') + '<a href="/membership">' + T('See membership', '了解会员') + '</a>'
              : esc(error.message);
          });
      }
    };
  }

  var host = null;
  function hostRoom(code, token) {
    var box = $('bgPlay');
    var url = location.origin + '/board/' + code;
    box.innerHTML = '<div class="pl-game rm-host">' +
      '<div class="pl-board"></div>' +
      '<aside class="pl-side">' +
      '<button type="button" class="pl-close" data-close aria-label="' + T('Close', '关闭') + '">✕</button>' +
      '<div class="rm-code"><span>' + T('Room code', '房间号') + '</span><b>' + code + '</b><small>' + esc(url.replace(/^https?:\/\//, '')) + '</small><div class="rm-qr"></div></div>' +
      '<div class="rm-state"></div>' +
      '<div class="rm-host-actions"></div>' +
      '</aside><div class="pl-pop" hidden></div></div>';
    loadQr().then(function () { new window.QRCode(box.querySelector('.rm-qr'), { text: url, width: 132, height: 132 }); }).catch(function () {});
    var board = new Board(box.querySelector('.pl-board'));
    host = { code: code, token: token, board: board };
    host.source = listen(code, token, function (s) { host.s = s; hostPaint(s); }, function () { hostClose(true); });
    box.onclick = function (e) {
      if (e.target.closest('[data-close]')) { if (confirm(T('Close the room? Students will be disconnected.', '关闭房间？学生会断开连接。'))) { send('close'); hostClose(); } return; }
      var a = e.target.closest('[data-host]');
      if (a) send(a.dataset.host, a.dataset.correct != null ? { correct: a.dataset.correct === '1' } : a.dataset.player ? { player: a.dataset.player } : {});
    };
    if (box.requestFullscreen) box.requestFullscreen().catch(function () {});
  }

  function send(type, extra) {
    return api('/' + host.code + '/action', Object.assign({ token: host.token, type: type }, extra || {})).catch(function (e) { alert(e.message); });
  }

  function hostPaint(s) {
    var box = $('bgPlay');
    host.board.update(s);
    var msg = message(s);
    var actions = '';
    if (s.status === 'lobby') {
      actions = '<p class="rm-note">' + T('Students go to the address above or scan the QR code, type the room code and their name.', '学生打开上面的网址或扫二维码，输入房间号和名字就能加入。') + '</p>' +
        '<button type="button" class="pl-roll" data-host="start"' + (s.players.length ? '' : ' disabled') + '>' + T('Start the game', '开始游戏') + ' ▶</button>';
    } else if (s.status === 'playing') {
      var who = s.players.find(function (p) { return p.id === s.active; });
      actions = '<p class="pl-msg">' + esc(msg || (who ? T(who.name + '’s turn', '轮到 ' + who.name) : '')) + '</p>' +
        (s.roll ? '<div class="pl-die">' + DICE[s.roll.value - 1] + '</div>' : '') +
        '<button type="button" class="pl-small" data-host="skip">' + T('Skip this turn ⏭', '跳过这一轮 ⏭') + '</button>';
    } else if (s.status === 'over') {
      actions = '<p class="pl-msg">' + esc(msg) + '</p><button type="button" class="pl-roll" data-host="restart">' + T('Play again', '再玩一次') + '</button>';
    }
    box.querySelector('.rm-state').innerHTML = teamList(s, null);
    box.querySelector('.rm-host-actions').innerHTML = actions;
    // Pop-up: show what the active student sees; judge buttons for task / action squares.
    var pop = box.querySelector('.pl-pop');
    if (s.pending && s.status === 'playing') {
      var who2 = s.players.find(function (p) { return p.id === s.pending.player; });
      var sq = host.board.layout.squares[s.pending.square];
      var body = s.pending.type === 'question' ? wordCard(s, { canAnswer: false, answer: s.pending.answer }) : judgeCard(s, sq);
      pop.hidden = false;
      pop.innerHTML = '<div class="pl-card"><p class="rm-who">' + esc(who2 ? who2.name : '') + '</p>' + body +
        (s.pending.type === 'judge'
          ? '<div class="pl-buttons"><button type="button" class="is-main is-yes" data-host="judge" data-correct="1">✔ ' + T('Done!', '做到了！') + '</button><button type="button" class="is-no" data-host="judge" data-correct="0">✖ ' + T('Not yet', '没做到') + '</button></div>'
          : '<p class="rm-note">' + T('Waiting for the student to answer… (the right answer is highlighted for you)', '等学生作答……（绿色是正确答案，只有你看得到）') + '</p>') + '</div>';
    } else if (s.status === 'over') {
      var winner = s.winner != null ? s.teams[s.winner] : null;
      pop.hidden = false;
      pop.innerHTML = '<div class="pl-card">' + (winner ? '<div class="pl-win" style="--team:' + TEAMS[winner.color].color + '">🏆<b>' + esc(winner.name) + '</b><span>' + T('wins!', '赢了！') + '</span></div>' : '<p>' + esc(msg) + '</p>') +
        '<div class="pl-buttons"><button type="button" class="is-main" data-host="restart">' + T('Play again', '再玩一次') + '</button></div></div>';
    } else pop.hidden = true;
  }

  function hostClose(remote) {
    if (host && host.source) host.source.close();
    host = null;
    var box = $('bgPlay');
    box.hidden = true;
    box.innerHTML = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    if (remote) alert(T('The room has closed.', '房间已经关闭。'));
  }

  // ---------- student ----------

  function studentPage() {
    var root = $('rmRoot');
    var code = root.dataset.code || '';
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('board-room:' + code) || 'null'); } catch (e) { /* private mode */ }
    if (code && saved && saved.token) return studentPlay(code, saved);
    joinForm(code);
  }

  function joinForm(code, error) {
    var root = $('rmRoot');
    root.innerHTML = '<form class="rm-join"><h1>♟️ ' + T('Join a board game', '加入棋盘游戏') + '</h1>' +
      '<label>' + T('Room code', '房间号') + '<input name="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" required value="' + esc(code) + '" autocomplete="off"></label>' +
      '<label>' + T('Your name', '你的名字') + '<input name="name" maxlength="12" required autocomplete="off"></label>' +
      '<div class="rm-teams"></div>' +
      '<p class="rm-error" role="alert"' + (error ? '' : ' hidden') + '>' + esc(error || '') + '</p>' +
      '<button type="submit" class="pl-start">' + T('Join', '加入') + ' ▶</button></form>';
    var form = root.querySelector('form');
    var team = null;
    function peek() {
      var c = form.code.value.trim();
      if (!/^\d{6}$/.test(c)) { form.querySelector('.rm-teams').innerHTML = ''; return; }
      api('/' + c).then(function (info) {
        form.querySelector('.rm-teams').innerHTML = '<p>' + T('Pick your team', '选你的队') + '</p>' + info.teams.map(function (t, i) {
          var c2 = TEAMS[t.color];
          return '<button type="button" data-team="' + i + '" style="--team:' + c2.color + '"' + (team === i ? ' aria-pressed="true"' : '') + '><span>' + c2.shape + '</span>' + esc(t.name) + '<small>' + t.players + '</small></button>';
        }).join('');
      }).catch(function (e) { form.querySelector('.rm-teams').innerHTML = '<p class="rm-error">' + esc(e.message) + '</p>'; });
    }
    form.code.addEventListener('input', peek);
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-team]');
      if (!b) return;
      team = Number(b.dataset.team);
      form.querySelectorAll('[data-team]').forEach(function (x) { x.removeAttribute('aria-pressed'); });
      b.setAttribute('aria-pressed', 'true');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = form.code.value.trim();
      api('/' + c + '/join', { name: form.name.value, team: team }).then(function (me) {
        var saved = { token: me.token, id: me.id };
        try { sessionStorage.setItem('board-room:' + c, JSON.stringify(saved)); } catch (err) { /* private mode */ }
        if (history.replaceState) history.replaceState(null, '', '/board/' + c);
        studentPlay(c, saved);
      }).catch(function (err) { joinForm(c, err.message); });
    });
    peek();
  }

  function studentPlay(code, me) {
    var root = $('rmRoot');
    root.innerHTML = '<div class="rm-student"><div class="rm-top"></div><div class="pl-board rm-board"></div><div class="rm-panel"></div></div><div class="pl-pop" hidden></div>';
    var board = new Board(root.querySelector('.rm-board'));
    var state = null;
    function act(type, extra) {
      return api('/' + code + '/action', Object.assign({ token: me.token, type: type }, extra || {})).catch(function (e) { root.querySelector('.rm-panel').insertAdjacentHTML('afterbegin', '<p class="rm-error">' + esc(e.message) + '</p>'); });
    }
    listen(code, me.token, function (s) {
      state = s;
      board.update(s, function (i) { if (s.status === 'playing' && s.active === me.id && !s.pending) act('claim', { square: i }); });
      var mine = s.you.team, team = s.teams[mine], t = TEAMS[team.color];
      var myTurn = s.status === 'playing' && s.active === me.id && !s.pending;
      root.querySelector('.rm-top').innerHTML = '<span class="pl-chip" style="--team:' + t.color + '">' + t.shape + '</span><b>' + esc(s.you.name) + '</b><span>' + esc(team.name) + '</span>';
      var panel = '';
      var msg = message(s);
      if (s.status === 'lobby') panel = '<p class="rm-big">⏳ ' + T('Waiting for the teacher to start…', '等老师开始游戏……') + '</p>';
      else if (s.status === 'over') {
        var w = s.winner != null ? s.teams[s.winner] : null;
        panel = '<p class="rm-big">' + (w ? '🏆 ' + esc(w.name) + T(' wins!', ' 赢了！') : esc(msg)) + '</p>';
      } else if (myTurn) {
        panel = s.data.board === 'line'
          ? '<p class="rm-big rm-you">👉 ' + T('Your turn! Tap a square on the board.', '轮到你了！点棋盘上的一个格子。') + '</p>'
          : '<p class="rm-big rm-you">👉 ' + T('Your turn!', '轮到你了！') + '</p><button type="button" class="pl-roll rm-roll" data-roll>🎲 ' + T('Roll', '掷骰子') + '</button>';
      } else {
        var who = s.players.find(function (p) { return p.id === s.active; });
        panel = '<p class="rm-big">' + (who ? T(who.name + '’s turn', '轮到 ' + who.name) : '') + '</p>';
      }
      if (msg && s.status === 'playing') panel = '<p class="pl-msg">' + esc(msg) + '</p>' + panel;
      if (s.roll && s.status === 'playing') panel += '<div class="pl-die rm-die">' + DICE[s.roll.value - 1] + '</div>';
      root.querySelector('.rm-panel').innerHTML = panel + teamList(s, mine);
      var pop = root.querySelector('.pl-pop');
      if (s.pending && s.status === 'playing' && s.pending.player === me.id) {
        var sq = board.layout.squares[s.pending.square];
        pop.hidden = false;
        pop.innerHTML = '<div class="pl-card">' + (s.pending.type === 'question'
          ? wordCard(s, { canAnswer: true })
          : judgeCard(s, sq) + '<p class="rm-note">' + T('Do it! Your teacher will mark it.', '做一做！老师会帮你确认。') + '</p>') + '</div>';
      } else pop.hidden = true;
    }, function (info) {
      try { sessionStorage.removeItem('board-room:' + code); } catch (e) { /* ignore */ }
      root.innerHTML = '<div class="rm-join"><p class="rm-big">' + (info.removed ? T('The teacher removed you from the room.', '老师把你移出了房间。') : T('The room has closed.', '房间已经关闭。')) + '</p><a class="pl-start" href="/board">' + T('Join another room', '加入别的房间') + '</a></div>';
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-roll]')) { e.target.closest('[data-roll]').disabled = true; act('roll'); }
      var c = e.target.closest('[data-choice]');
      if (c && !c.disabled) { root.querySelectorAll('[data-choice]').forEach(function (b) { b.disabled = true; }); act('answer', { choice: Number(c.dataset.choice) }); }
    });
  }

  // ---------- start ----------

  if ($('rmRoot')) studentPage();
  if ($('bgRoomBtn')) $('bgRoomBtn').addEventListener('click', hostSetup);
})();
