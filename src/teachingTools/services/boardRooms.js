'use strict';

// Online rooms for 棋盘游戏 · Board Game Maker (members host, students join by code).
//
// Rooms live in this process's memory: a deploy or restart ends them, and
// they only work while the site runs on one instance. The server owns the game:
// it rolls the die, moves pawns, asks the three-choice question and keeps the
// answer to itself, so a student device cannot cheat by reading the page.
//
// Turn order: teams take turns; inside a team its players take turns.
// Word squares → three-choice question for the active student (auto-checked).
// Task / action / card squares → the teacher marks done or not yet.

var crypto = require('crypto');
var core = require('../public/low-prep/board-games/board-games-core');

var LIMITS = { rooms: 300, roomsPerHost: 3, players: 40, name: 12, idleMs: 3 * 60 * 60 * 1000, teams: { path: 6, ladder: 6, line: 4, flight: 4 } };
var FINISH = 56; // flight: 0–50 track, 51–55 home path, 56 centre
var PICTURE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/openmoji@[\d.]+\/(color|black)\/svg\/[0-9A-F-]+\.svg$/;

function createRegistry(options) {
  options = options || {};
  var random = options.random || function (n) { return crypto.randomInt(n); };
  var now = options.now || Date.now;
  var rooms = new Map();

  function token() { return crypto.randomBytes(18).toString('base64url'); }

  function newCode() {
    for (var tries = 0; tries < 50; tries++) {
      var code = String(100000 + random(900000));
      if (!rooms.has(code)) return code;
    }
    throw httpError(503, 'Too many rooms are open. Please try again later.');
  }

  function httpError(status, message) {
    var error = new Error(message);
    error.status = status;
    return error;
  }

  function cleanName(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
  }

  // ---------- rooms ----------

  function create(input, owner) {
    sweep();
    if (rooms.size >= LIMITS.rooms) throw httpError(503, 'Too many rooms are open. Please try again later.');
    var mine = Array.from(rooms.values()).filter(function (r) { return r.owner === owner; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    while (mine.length >= LIMITS.roomsPerHost) close(mine.shift().code);
    var data = core.template(input && input.data);
    var max = LIMITS.teams[data.board];
    var names = (Array.isArray(input.teams) ? input.teams : []).map(cleanName).filter(Boolean).slice(0, max);
    if (names.length < 2) throw httpError(400, 'Choose at least 2 teams.');
    var pictures = {};
    Object.keys(input.pictures || {}).forEach(function (zh) {
      var url = String(input.pictures[zh] || '');
      if (PICTURE.test(url) && data.words.some(function (w) { return w.zh === zh; })) pictures[zh] = url;
    });
    var room = {
      code: newCode(), hostToken: token(), owner: owner || 'anonymous', createdAt: now(), touched: now(),
      data: data, layout: core.generate(data), pictures: pictures,
      opts: { back: input.back !== false, six: Boolean(input.six) },
      teams: names.map(function (name, i) { return { name: name, color: i, pos: data.board === 'flight' ? -1 : 0, prev: 0, skip: false, rounds: 0 }; }),
      players: [], status: 'lobby', turn: 0, pending: null, roll: null, message: '', winner: null, claims: {},
      version: 0, listeners: new Set()
    };
    room.last = data.board === 'flight' ? FINISH : room.layout.squares.length - 1;
    rooms.set(room.code, room);
    return room;
  }

  function get(code) {
    var room = rooms.get(String(code || ''));
    if (!room) throw httpError(404, 'This room is closed or the code is wrong.');
    return room;
  }

  function close(code) {
    var room = rooms.get(code);
    if (!room) return;
    room.status = 'closed';
    room.message = 'closed';
    broadcast(room);
    room.listeners.forEach(function (l) { try { l.end(); } catch (e) { /* gone */ } });
    rooms.delete(code);
  }

  function sweep() {
    var cutoff = now() - LIMITS.idleMs;
    Array.from(rooms.values()).forEach(function (room) { if (room.touched < cutoff) close(room.code); });
  }

  function who(room, tokenValue) {
    if (tokenValue && tokenValue === room.hostToken) return { role: 'host' };
    var player = room.players.find(function (p) { return p.token === tokenValue; });
    if (!player) throw httpError(403, 'Join the room first.');
    return { role: 'player', player: player };
  }

  function join(code, name, team) {
    var room = get(code);
    if (room.status === 'over') throw httpError(409, 'This game has finished.');
    if (room.players.length >= LIMITS.players) throw httpError(409, 'This room is full.');
    name = cleanName(name);
    if (!name) throw httpError(400, 'Type your name.');
    var t = Number(team);
    if (!(t >= 0 && t < room.teams.length)) {
      // Fewest players first.
      t = room.teams.map(function (x, i) { return i; }).sort(function (a, b) { return count(room, a) - count(room, b) || a - b; })[0];
    }
    var player = { id: token().slice(0, 10), token: token(), name: name, team: t, joinedAt: now() };
    room.players.push(player);
    room.message = 'joined';
    changed(room);
    return { room: room, player: player };
  }

  function count(room, team) { return room.players.filter(function (p) { return p.team === team; }).length; }

  // ---------- game ----------

  function activePlayer(room) {
    var team = room.teams[room.turn];
    var members = room.players.filter(function (p) { return p.team === room.turn; });
    if (!team || !members.length) return null;
    return members[team.rounds % members.length];
  }

  function say(room, key, extra) { room.message = key; room.messageData = extra || null; }

  function start(room) {
    if (room.status !== 'lobby') return;
    var used = room.teams.map(function (t, i) { return count(room, i) > 0; });
    if (used.filter(Boolean).length < 1) throw httpError(409, 'Wait for students to join.');
    // Drop teams nobody joined, and renumber players.
    var keep = [];
    room.teams.forEach(function (t, i) { if (used[i]) keep.push(i); });
    room.teams = keep.map(function (i) { return room.teams[i]; });
    room.players.forEach(function (p) { p.team = keep.indexOf(p.team); });
    room.status = 'playing';
    room.turn = 0;
    say(room, 'started');
  }

  function nextTurn(room) {
    if (room.status !== 'playing') return;
    room.teams[room.turn].rounds++;
    room.turn = (room.turn + 1) % room.teams.length;
    room.pending = null;
    var team = room.teams[room.turn];
    if (team.skip) {
      team.skip = false;
      say(room, 'skipped', { team: room.turn });
      team.rounds++;
      room.turn = (room.turn + 1) % room.teams.length;
    }
  }

  function squareOf(room, team) {
    var t = room.teams.indexOf(team);
    if (room.data.board === 'flight') {
      return team.pos >= 0 && team.pos <= 50 ? room.layout.squares[(room.layout.teams[team.color].start + team.pos) % 52] : null;
    }
    return room.layout.squares[team.pos];
  }

  function win(room, team) {
    room.status = 'over';
    room.winner = room.teams.indexOf(team);
    room.pending = null;
    say(room, 'win', { team: room.winner });
  }

  function roll(room, player) {
    if (room.status !== 'playing' || room.pending) return;
    if (room.data.board === 'line') return;
    var active = activePlayer(room);
    if (!active || active.id !== player.id) throw httpError(409, 'It is not your turn.');
    var team = room.teams[room.turn];
    var value = 1 + random(6);
    room.roll = { value: value, at: now() };
    team.prev = team.pos;
    if (room.data.board === 'flight' && team.pos < 0) {
      if (room.opts.six && value !== 6) { say(room, 'needSix'); nextTurn(room); return; }
      team.pos = 0;
      say(room, 'takeOff', { team: room.turn });
      nextTurn(room);
      return;
    }
    team.pos = Math.min(room.last, team.pos + value);
    land(room, team);
  }

  function land(room, team) {
    if (team.pos >= room.last) return win(room, team);
    var sq = squareOf(room, team);
    if (!sq || sq.kind === 'start') { say(room, 'moved'); return nextTurn(room); }
    if (sq.kind === 'special') {
      var sp = sq.special;
      say(room, 'special', { key: sp.key });
      if (sp.move) {
        team.pos = Math.max(0, Math.min(room.last, team.pos + sp.move));
        if (team.pos >= room.last) return win(room, team);
      }
      if (sp.key === 'skip') team.skip = true;
      if (sp.key === 'again') return; // same player rolls again
      return nextTurn(room);
    }
    ask(room, sq, null);
  }

  // Word squares get a three-choice question; other squares wait for the teacher.
  function ask(room, sq, claim) {
    var active = activePlayer(room);
    if (sq.kind === 'word') {
      var q = question(room, sq.word);
      room.pending = { type: 'question', square: sq.i, claim: claim, player: active && active.id, prompt: q.prompt, choices: q.choices, answer: q.answer, mode: q.mode };
    } else {
      var action = null;
      if (sq.kind === 'card') {
        var pool = actionPool(room.data);
        action = pool.length ? pool[random(pool.length)] : null;
      }
      room.pending = { type: 'judge', square: sq.i, claim: claim, player: active && active.id, action: action };
    }
    say(room, 'pending');
  }

  function actionPool(data) {
    var o = data.options;
    return core.ACTIONS.filter(function (a) { return o.actionKeys.indexOf(a.key) !== -1; })
      .concat(o.customActions.map(function (t) { return { zh: t, py: '', en: '', icon: '🌟' }; }));
  }

  function question(room, index) {
    var words = room.data.words, w = words[index], show = room.data.options.show;
    var others = words.filter(function (x, i) { return i !== index; });
    function pickFrom(field) {
      var seen = {}; seen[w[field]] = true;
      var pool = others.map(function (x) { return x[field]; }).filter(function (v) { if (!v || seen[v]) return false; seen[v] = true; return true; });
      if (!w[field] || pool.length < 2) return null;
      var wrong = [];
      while (wrong.length < 2) wrong.push(pool.splice(random(pool.length), 1)[0]);
      var choices = wrong.concat(w[field]);
      for (var i = choices.length - 1; i > 0; i--) { var j = random(i + 1); var t = choices[i]; choices[i] = choices[j]; choices[j] = t; }
      return { choices: choices, answer: choices.indexOf(w[field]) };
    }
    var q;
    if (show === 'py' && (q = pickFrom('zh'))) return { mode: 'zh', prompt: { py: w.py, zh: '' }, choices: q.choices, answer: q.answer };
    if ((q = pickFrom('en'))) return { mode: 'en', prompt: { zh: show === 'py' ? '' : w.zh, py: show === 'zh' ? '' : w.py }, choices: q.choices, answer: q.answer };
    if ((q = pickFrom('py'))) return { mode: 'py', prompt: { zh: w.zh, py: '' }, choices: q.choices, answer: q.answer };
    return { mode: 'none', prompt: { zh: w.zh, py: w.py }, choices: [], answer: -1 };
  }

  function resolve(room, correct) {
    var pending = room.pending;
    room.pending = null;
    var team = room.teams[room.turn];
    room.lastResult = { correct: correct, square: pending.square };
    if (room.data.board === 'line') {
      if (correct) {
        room.claims[pending.claim] = room.turn;
        if (lineWin(room, pending.claim)) return win(room, team);
        if (Object.keys(room.claims).length === room.layout.squares.length) { room.status = 'over'; room.winner = null; say(room, 'draw'); return; }
      }
      say(room, correct ? 'right' : 'wrong');
      return nextTurn(room);
    }
    if (!correct) {
      if (room.opts.back) team.pos = team.prev;
      say(room, 'wrong', { back: room.opts.back });
      return nextTurn(room);
    }
    say(room, 'right');
    if (room.data.board === 'ladder') {
      var link = room.layout.links.find(function (l) { return l.from === team.pos; });
      if (link) {
        team.pos = link.to;
        say(room, link.kind, {});
        if (team.pos >= room.last) return win(room, team);
      }
    }
    if (room.data.board === 'flight') {
      var sq = squareOf(room, team);
      if (sq && sq.team === team.color && sq.kind !== 'start' && team.pos <= 46) { team.pos += 4; say(room, 'jump'); }
    }
    nextTurn(room);
  }

  function lineWin(room, i) {
    var size = room.layout.size, need = room.layout.win, mine = room.claims[i];
    var r = Math.floor(i / size), c = i % size;
    return [[0, 1], [1, 0], [1, 1], [1, -1]].some(function (d) {
      var run = 1;
      [1, -1].forEach(function (s) {
        for (var k = 1; k < need; k++) {
          var rr = r + d[0] * k * s, cc = c + d[1] * k * s;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size || room.claims[rr * size + cc] !== mine) break;
          run++;
        }
      });
      return run >= need;
    });
  }

  // ---------- actions ----------

  function act(code, tokenValue, body) {
    var room = get(code);
    var me = who(room, tokenValue);
    var type = body && body.type;
    room.touched = now();
    if (me.role === 'host') {
      if (type === 'start') start(room);
      else if (type === 'judge' && room.pending) resolve(room, Boolean(body.correct));
      else if (type === 'skip' && room.status === 'playing') { room.pending = null; say(room, 'skippedByTeacher'); nextTurn(room); }
      else if (type === 'remove') {
        var gone = room.players.findIndex(function (p) { return p.id === body.player; });
        if (gone !== -1) room.players.splice(gone, 1);
      } else if (type === 'restart') {
        room.layout = core.generate(Object.assign({}, room.data, { options: Object.assign({}, room.data.options, { seed: 1 + random(1e6) }) }));
        room.teams.forEach(function (t) { t.pos = room.data.board === 'flight' ? -1 : 0; t.prev = 0; t.skip = false; t.rounds = 0; });
        room.claims = {}; room.winner = null; room.pending = null; room.turn = 0; room.status = 'playing'; say(room, 'started');
      } else if (type === 'close') { close(room.code); return null; }
      else throw httpError(400, 'Unknown action.');
    } else {
      var player = me.player;
      if (type === 'roll') roll(room, player);
      else if (type === 'answer') {
        var p = room.pending;
        if (!p || p.type !== 'question' || p.player !== player.id) throw httpError(409, 'It is not your turn.');
        var choice = Number(body.choice);
        resolve(room, p.mode === 'none' ? true : choice === p.answer);
      } else if (type === 'claim') {
        if (room.status !== 'playing' || room.data.board !== 'line' || room.pending) return room;
        var active = activePlayer(room);
        if (!active || active.id !== player.id) throw httpError(409, 'It is not your turn.');
        var i = Number(body.square);
        var sq = room.layout.squares[i];
        if (!sq || room.claims[i] != null) throw httpError(409, 'That square is taken.');
        ask(room, sq, i);
      } else throw httpError(400, 'Unknown action.');
    }
    changed(room);
    return room;
  }

  // ---------- views ----------

  function view(room, viewer) {
    var active = room.status === 'playing' ? activePlayer(room) : null;
    var pending = room.pending && {
      type: room.pending.type, square: room.pending.square, claim: room.pending.claim, player: room.pending.player,
      prompt: room.pending.prompt, choices: room.pending.choices, mode: room.pending.mode, action: room.pending.action
    };
    if (pending && viewer.role === 'host' && room.pending.type === 'question') pending.answer = room.pending.answer;
    return {
      code: room.code, version: room.version, status: room.status,
      data: room.data, seed: room.layout.data.options.seed, pictures: room.pictures,
      teams: room.teams.map(function (t) { return { name: t.name, color: t.color, pos: t.pos, skip: t.skip }; }),
      players: room.players.map(function (p) { return { id: p.id, name: p.name, team: p.team }; }),
      turn: room.turn, active: active && active.id, pending: pending, roll: room.roll, claims: room.claims,
      message: room.message, messageData: room.messageData || null, lastResult: room.lastResult || null, winner: room.winner,
      you: viewer.role === 'host' ? { role: 'host' } : { role: 'player', id: viewer.player.id, team: viewer.player.team, name: viewer.player.name }
    };
  }

  function listen(code, tokenValue, res) {
    var room = get(code);
    var me = who(room, tokenValue);
    var listener = { res: res, viewer: me, end: function () { res.end(); } };
    room.listeners.add(listener);
    send(room, listener);
    return function () { room.listeners.delete(listener); };
  }

  function send(room, listener) {
    try {
      // Players removed by the teacher stop getting updates.
      if (listener.viewer.role === 'player' && room.players.indexOf(listener.viewer.player) === -1) { listener.res.write('event: removed\ndata: {}\n\n'); listener.res.end(); room.listeners.delete(listener); return; }
      listener.res.write('data: ' + JSON.stringify(view(room, listener.viewer)) + '\n\n');
    } catch (e) { room.listeners.delete(listener); }
  }

  function broadcast(room) { room.listeners.forEach(function (l) { send(room, l); }); }

  function changed(room) { room.version++; room.touched = now(); broadcast(room); }

  return {
    create: create, join: join, act: act, listen: listen, view: view, get: get, close: close, sweep: sweep,
    size: function () { return rooms.size; }, LIMITS: LIMITS,
    _rooms: rooms
  };
}

module.exports = createRegistry();
module.exports.createRegistry = createRegistry;
