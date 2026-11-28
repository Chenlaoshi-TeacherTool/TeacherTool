/*
 * MPY — board data and rules engine (a student's buy-the-land game).
 * Shared by the projector page (window.MpyCore) and node tests.
 *
 * board.webp is a clean redraw of the student's original board (names, prices
 * in the student's money M, and the Chinese word on each square). Data comes
 * from work/mpy/mpy.py. Rules agreed with the teacher:
 *  - Every team starts with M1500. Passing or landing on Start pays M200.
 *  - A square with a Chinese word asks about that word (read it, make a
 *    sentence); other squares use the teacher's cards. Right on unowned land =
 *    the team may buy it at the printed price.
 *  - Someone else's land: pay a fifth of its price (rounded to 10). A team that
 *    cannot pay is out.
 *  - Super card and 读一读: right = M100. Own land: right = M50.
 *  - Go to Jail: to the jail corner; skip a turn or pay M50 to leave at once.
 *  - The game ends after the agreed laps (or when the teacher ends it). Teams
 *    rank by money + the price of their land.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2200, 2700],
    board: [
      [150, 2550, "start"], [414, 2550, "prop", 150, "地方"], [643, 2550, "prop", 770, "你好"], [871, 2550, "chance"],
      [1100, 2550, "chance"], [1329, 2550, "prop", 562, "请坐"], [1557, 2550, "prop", 712, "请坐"], [1786, 2550, "prop", 321, ""],
      [2050, 2550, "jail"], [2050, 2283, "prop", 216, "再见"], [2050, 2050, "prop", 810, ""], [2050, 1817, "chance"],
      [2050, 1583, "prop", 450, "你好"], [2050, 1350, "chance"], [2050, 1117, "prop", 180, "对不起"], [2050, 883, "prop", 321, "你好"],
      [2050, 650, "chance"], [2050, 417, "prop", 323, "没关系"], [2050, 150, "park"], [1800, 150, "prop", 105, "谢谢"],
      [1600, 150, "prop", 130, "再见"], [1400, 150, "prop", 321, "请坐"], [1200, 150, "prop", 156, "地方"], [1000, 150, "chance"],
      [800, 150, "prop", 321, "你好"], [600, 150, "prop", 500, "你好"], [400, 150, "prop", 905, "你好"], [150, 150, "gojail"],
      [150, 431, "prop", 180, "再见"], [150, 694, "prop", 127, "请坐"], [150, 956, "chance"], [150, 1219, "prop", 321, "再见"],
      [150, 1481, "prop", 140, "再见"], [150, 1744, "prop", 280, "地方"], [150, 2006, "prop", 321, ""], [150, 2269, "prop", 200, "没关系"]
    ],
    jail: 8,
    spots: {jail: [2050, 2575], podium: [[700, 2170], [850, 2170], [1000, 2170]], lots: [[700, 2170], [850, 2170], [1000, 2170]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, price, word]  kind: start prop chance jail park gojail
  var BOARD = DATA.board;
  var N = BOARD.length;
  var FINISH = -1;               // a loop: no finish square
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};

  var JAIL = DATA.jail;
  // Land squares in board order: the word squares. The page writes a word on each.
  var WORD_SQUARES = BOARD.map(function (s, i) { return s[2] === 'prop' ? i : -1; }).filter(function (i) { return i >= 0; });
  var DEFAULT_WORDS = WORD_SQUARES.map(function (i) { return BOARD[i][4] || ''; });
  var JAIL_FEE = 50;
  var START_MONEY = 1500;
  var SALARY = 200;
  var SPECIAL_PRIZE = 100;
  var NORMAL_PRIZE = 50;
  var PODIUM = 3;
  var JAIL_TURNS = 0;

  function clamp(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function newGame(options) {
    var opts = options || {};
    var shared = opts.shared;
    var count = clamp(opts.teams, 2, 6, 4);
    var names = opts.names || [];
    var teams = [];
    for (var i = 0; i < count; i++) {
      var fallback = shared ? (opts.zh ? shared.TEAMS[i].zh : shared.TEAMS[i].en) : 'Team ' + (i + 1);
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, money: START_MONEY,
        laps: 0, skip: false, out: false, done: false, jail: 0, place: 0 });
    }
    return { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, places: [], options: [],
      owner: BOARD.map(function () { return -1; }), laps: clamp(opts.laps, 1, 5, 2), zh: !!opts.zh,
      words: Array.isArray(opts.words) ? opts.words.filter(Boolean) : [] };
  }

  function current(state) { return state.teams[state.turn]; }

  // Rent is a fifth of the price, rounded to 10.
  function rent(i) { return Math.max(10, Math.round(BOARD[i][3] / 5 / 10) * 10); }

  function wealth(state, team) {
    var w = team.money;
    state.owner.forEach(function (o, i) { if (o === team.id) w += BOARD[i][3]; });
    return w;
  }

  function active(team) { return !team.out && !team.done; }

  // Rank everyone: by wealth, teams that went out last.
  function end(state) {
    if (state.phase === 'over') return [];
    var order = state.teams.slice().sort(function (a, b) {
      return (a.out - b.out) || (wealth(state, b) - wealth(state, a));
    });
    state.places = order.map(function (t) { return t.id; });
    order.forEach(function (t, i) { t.place = i + 1; });
    state.phase = 'over';
    return [{ type: 'over' }];
  }

  function checkOver(state, events) {
    if (state.teams.filter(active).length === 0 || state.teams.filter(function (t) { return !t.out; }).length <= 1) {
      end(state).forEach(function (e) { events.push(e); });
      return true;
    }
    return false;
  }

  function ask(state, events, kind, value) {
    state.left = 1;
    state.total = 1;
    state.qkind = kind;
    state.value = value || 0;
    state.phase = 'card';
    events.push({ type: 'card', team: current(state).id, count: 1, kind: kind, value: state.value });
  }

  function salary(state, team, events) {
    team.money += SALARY;
    team.laps += 1;
    events.push({ type: 'salary', team: team.id, money: team.money, laps: team.laps });
    if (team.laps >= state.laps) {
      team.done = true;
      events.push({ type: 'done', team: team.id });
    }
  }

  function land(state, events) {
    var team = current(state);
    var sq = BOARD[team.pos];
    var kind = sq[2];
    if (team.done) { state.phase = 'next'; return; }
    if (kind === 'prop') {
      var owner = state.owner[team.pos];
      if (owner === -1) return ask(state, events, 'buy', sq[3]);
      if (owner !== team.id) {
        var other = state.teams[owner];
        var due = rent(team.pos);
        var pay = Math.min(due, team.money);
        team.money -= due;
        other.money += pay;
        events.push({ type: 'rent', team: team.id, owner: owner, amount: due, money: team.money });
        if (team.money < 0) {
          team.out = true;
          team.money = 0;
          // a team that goes out gives its properties back to the bank
          state.owner = state.owner.map(function (o) { return o === team.id ? -1 : o; });
          events.push({ type: 'bankrupt', team: team.id });
        }
        state.phase = 'next';
        return;
      }
      return ask(state, events, 'normal', NORMAL_PRIZE);
    }
    if (kind === 'chance') return ask(state, events, 'special', SPECIAL_PRIZE);
    if (kind === 'gojail') {
      events.push({ type: 'jail', team: team.id, from: team.pos, to: JAIL });
      team.pos = JAIL;
      team.jail = 1;
      state.phase = 'next';
      return;
    }
    if (kind === 'start' || kind === 'jail' || kind === 'park') {
      state.phase = 'next';
      events.push({ type: 'blank', team: team.id });
      return;
    }
    return ask(state, events, 'normal', NORMAL_PRIZE);   // fish and anything else
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var path = [team.pos];
    var events = [];
    var pos = team.pos;
    var passed = false;
    for (var k = 0; k < n; k++) {
      pos = (pos + 1) % N;
      path.push(pos);
      if (pos === 0) passed = true;
    }
    team.pos = pos;
    events.push({ type: 'walk', team: team.id, path: path, roll: n });
    if (passed) salary(state, team, events);
    land(state, events);
    if (state.phase === 'next') checkOver(state, events);
    return events;
  }

  function judge(state, correct) {
    if (state.phase !== 'card') return [];
    var team = current(state);
    var events = [];
    if (state.qkind === 'buy') {
      if (correct && team.money >= state.value) {
        state.phase = 'fork';
        state.options = [
          { to: 1, ok: true, gate: 0, label: (state.zh ? '买下这块地 M' : 'Buy it for M') + state.value },
          { to: 0, ok: true, gate: 0, label: state.zh ? '不买' : 'Don\'t buy' }
        ];
        events.push({ type: 'offer', team: team.id, price: state.value });
        return events;
      }
      events.push(correct ? { type: 'poor', team: team.id } : { type: 'nobuy', team: team.id });
    } else if (correct) {
      team.money += state.value;
      events.push({ type: 'earn', team: team.id, amount: state.value, money: team.money });
    } else {
      events.push({ type: 'miss', team: team.id });
    }
    state.phase = 'next';
    return events;
  }

  // The buy / don't-buy choice (1 = buy).
  function choose(state, to) {
    if (state.phase !== 'fork') return [];
    var team = current(state);
    var events = [];
    if (to === 1 && team.money >= state.value) {
      team.money -= state.value;
      state.owner[team.pos] = team.id;
      events.push({ type: 'bought', team: team.id, square: team.pos, price: state.value, money: team.money });
    } else {
      events.push({ type: 'pass', team: team.id });
    }
    state.options = [];
    state.phase = 'next';
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var events = [];
    if (checkOver(state, events)) return events;
    var count = state.teams.length;
    for (var guard = 0; guard < count * 2; guard++) {
      state.turn = (state.turn + 1) % count;
      var team = current(state);
      if (!active(team)) continue;
      state.phase = team.jail ? 'jail' : 'roll';
      return events;
    }
    state.phase = 'roll';
    return events;
  }

  // In jail: sit out this turn (then free next time).
  function wait(state) {
    if (state.phase !== 'jail') return [];
    var team = current(state);
    team.jail = 0;
    state.phase = 'next';
    return [{ type: 'wait', team: team.id, left: 0 }];
  }
  function canUseRv(state) { return state.phase === 'jail' && current(state).money >= JAIL_FEE; }
  // In jail: pay M50 and play this turn.
  function useRv(state) {
    if (!canUseRv(state)) return [];
    var team = current(state);
    team.money -= JAIL_FEE;
    team.jail = 0;
    state.phase = 'roll';
    return [{ type: 'bail', team: team.id, money: team.money }];
  }

  // The card for the square the team is on: its Chinese word, if it has one.
  // The word on land square i: the teacher's words (in order, repeating) or the student's.
  function phrase(i, state) {
    var n = WORD_SQUARES.indexOf(i);
    if (n < 0) return '';
    var words = state && state.words;
    return words && words.length ? words[n % words.length] : DEFAULT_WORDS[n];
  }

  // Teacher's text → words (one per line, or split by commas).
  function parseWords(text) {
    return String(text || '').split(/[\r\n,，、;；]+/).map(function (w) {
      return w.split('|')[0].trim().slice(0, 12);
    }).filter(Boolean).slice(0, 60);
  }

  function cardFor(state, zh) {
    var word = phrase(current(state).pos, state);
    if (!word || state.qkind === 'special') return null;
    return { label: zh ? '读一读，用它说一句话' : 'Read it, then make a sentence', q: word, a: '', big: true };
  }

  var api = {
    id: 'mpy',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS,
    START_MONEY: START_MONEY, SALARY: SALARY, SPECIAL_PRIZE: SPECIAL_PRIZE, NORMAL_PRIZE: NORMAL_PRIZE, JAIL: JAIL, JAIL_FEE: JAIL_FEE,
    rent: rent, cardFor: cardFor, phrase: phrase, parseWords: parseWords, WORD_SQUARES: WORD_SQUARES, DEFAULT_WORDS: DEFAULT_WORDS,
    DIST: BOARD.map(function () { return 0; }),
    wealth: wealth, end: end,
    newGame: newGame, current: current, roll: roll, judge: judge, choose: choose, next: next,
    wait: wait, canUseRv: canUseRv, useRv: useRv,
    canBuy: function () { return false; }, buyRv: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.MpyCore = api;
})(typeof window !== 'undefined' ? window : this);
