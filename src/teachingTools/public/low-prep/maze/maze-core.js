/*
 * Maze — board data and rules engine (a student's spiral board game).
 * Shared by the projector page (window.MazeCore) and node tests.
 *
 * board.webp is a clean spiral in the student's layout: from 开始 at the top
 * right, ring by ring inward to 终点. Data comes from work/maze/maze.py.
 *
 * Rules (student's, adapted with the teacher's OK):
 *  - Every team starts with $0. Move twice the number rolled (the board is long).
 *  - 词语: answer a card. Right = the money on the square, wrong = -$5.
 *  - ★ +$200 (or $100), -10: lose $10, Sad: lose $300 (never below $0).
 *  - Super: a harder card; right = the money on the square.
 *  - Slide: answer a card; right = slide forward 5.
 *  - Skip (N): jump forward N. Skip: skip the next turn. 监狱: skip the next turn.
 *  - 黑洞 and 回到 Start: back 20 squares.
 *  - 终点 pays $1000 / $500 / $300 for first, second and third. After three
 *    teams are in, everyone ranks by money.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2630, 2030],
    board: [
      [2515, 115, "start"], [2515, 265, "star", 200], [2515, 415, "skipn", 3], [2515, 565, "word", 5], [2515, 715, "word", 5], [2515, 865, "word", 5],
      [2515, 1015, "skip"], [2515, 1165, "word", 5], [2515, 1315, "blank"], [2515, 1465, "slide"], [2515, 1615, "blank"], [2515, 1765, "word", 5],
      [2515, 1915, "blank"], [2365, 1915, "jail"], [2215, 1915, "blank"], [2065, 1915, "blank"], [1915, 1915, "minus"], [1765, 1915, "star", 200],
      [1615, 1915, "word", 5], [1465, 1915, "blank"], [1315, 1915, "blank"], [1165, 1915, "skipn", 2], [1015, 1915, "blank"], [865, 1915, "minus"],
      [715, 1915, "super", 900], [565, 1915, "slide"], [415, 1915, "blank"], [265, 1915, "blank"], [115, 1915, "word", 5], [115, 1765, "blank"],
      [115, 1615, "blank"], [115, 1465, "minus"], [115, 1315, "word", 5], [115, 1165, "word", 5], [115, 1015, "minus"], [115, 865, "word", 5],
      [115, 715, "word", 5], [115, 565, "blank"], [115, 415, "sad", 300], [115, 265, "blank"], [115, 115, "word", 5], [265, 115, "blank"],
      [415, 115, "minus"], [565, 115, "minus"], [715, 115, "word", 5], [865, 115, "blank"], [1015, 115, "word", 5], [1165, 115, "word", 5],
      [1315, 115, "minus"], [1465, 115, "minus"], [1615, 115, "blank"], [1765, 115, "skipn", 3], [1915, 115, "star", 200], [2065, 115, "word", 5],
      [2215, 115, "blank"], [2365, 115, "blank"], [2365, 265, "blank"], [2365, 415, "minus"], [2365, 565, "word", 5], [2365, 715, "jail"],
      [2365, 865, "word", 5], [2365, 1015, "blank"], [2365, 1165, "super", 300], [2365, 1315, "skip"], [2365, 1465, "slide"], [2365, 1615, "word", 5],
      [2365, 1765, "word", 5], [2215, 1765, "word", 5], [2065, 1765, "word", 5], [1915, 1765, "star", 200], [1765, 1765, "star", 200], [1615, 1765, "back"],
      [1465, 1765, "word", 5], [1315, 1765, "slide"], [1165, 1765, "blank"], [1015, 1765, "minus"], [865, 1765, "slide"], [715, 1765, "word", 5],
      [565, 1765, "blank"], [415, 1765, "word", 5], [265, 1765, "star", 200], [265, 1615, "blank"], [265, 1465, "word", 5], [265, 1315, "slide"],
      [265, 1165, "word", 5], [265, 1015, "word", 5], [265, 865, "word", 5], [265, 715, "blank"], [265, 565, "minus"], [265, 415, "blank"],
      [265, 265, "word", 5], [415, 265, "word", 5], [565, 265, "blank"], [715, 265, "minus"], [865, 265, "minus"], [1015, 265, "jail"],
      [1165, 265, "word", 5], [1315, 265, "blank"], [1465, 265, "word", 5], [1615, 265, "blank"], [1765, 265, "blank"], [1915, 265, "blank"],
      [2065, 265, "word", 5], [2215, 265, "blank"], [2215, 415, "minus"], [2215, 565, "word", 5], [2215, 715, "sad", 300], [2215, 865, "word", 5],
      [2215, 1015, "blank"], [2215, 1165, "minus"], [2215, 1315, "blank"], [2215, 1465, "word", 5], [2215, 1615, "skip"], [2065, 1615, "blank"],
      [1915, 1615, "blank"], [1765, 1615, "word", 5], [1615, 1615, "blank"], [1465, 1615, "star", 100], [1315, 1615, "skipn", 5], [1165, 1615, "word", 5],
      [1015, 1615, "skip"], [865, 1615, "super", 200], [715, 1615, "word", 5], [565, 1615, "super", 900], [415, 1615, "blank"], [415, 1465, "minus"],
      [415, 1315, "hole"], [415, 1165, "word", 5], [415, 1015, "slide"], [415, 865, "blank"], [415, 715, "star", 200], [415, 565, "word", 5],
      [415, 415, "star", 100], [565, 415, "skipn", 5], [715, 415, "blank"], [865, 415, "super", 300], [1015, 415, "blank"], [1165, 415, "word", 5],
      [1315, 415, "jail"], [1465, 415, "blank"], [1615, 415, "word", 5], [1765, 415, "skipn", 3], [1915, 415, "word", 5], [2065, 415, "blank"],
      [2065, 565, "skipn", 3], [2065, 715, "blank"], [2065, 865, "skip"], [2065, 1015, "blank"], [2065, 1165, "skipn", 3], [2065, 1315, "blank"],
      [2065, 1465, "word", 5], [1915, 1465, "word", 5], [1765, 1465, "blank"], [1615, 1465, "minus"], [1465, 1465, "word", 5], [1315, 1465, "jail"],
      [1165, 1465, "blank"], [1015, 1465, "word", 5], [865, 1465, "blank"], [715, 1465, "word", 5], [565, 1465, "minus"], [565, 1315, "star", 200],
      [565, 1165, "word", 5], [565, 1015, "word", 5], [565, 865, "blank"], [565, 715, "slide"], [565, 565, "word", 5], [715, 565, "minus"],
      [865, 565, "word", 5], [1015, 565, "jail"], [1165, 565, "word", 5], [1315, 565, "word", 5], [1465, 565, "word", 5], [1615, 565, "word", 5],
      [1765, 565, "blank"], [1915, 565, "finish"]
    ],
    spots: {jail: [0, 0], podium: [[1165, 1165], [1315, 1165], [1465, 1165]], lots: [[1165, 1230], [1315, 1230], [1465, 1230]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, value]  kind: start word blank minus star skipn skip slide jail super sad hole back finish
  var BOARD = DATA.board;
  var FINISH = BOARD.length - 1;
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};

  var STEP_FACTOR = 2;
  var BACK = 20;
  var SLIDE = 5;
  var WRONG = 5;
  var MINUS = 10;
  var PRIZES = [1000, 500, 300];
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
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, money: 0, skip: false, jail: 0, place: 0 });
    }
    return { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, places: [], qkind: '' };
  }

  function current(state) { return state.teams[state.turn]; }

  function pay(team, amount) { team.money = Math.max(0, team.money + amount); }

  function rankAll(state, events) {
    var finished = state.places.slice();
    var rest = state.teams.filter(function (t) { return !t.place; });
    rest.forEach(function (t) { finished.push(t.id); });
    // everyone ranks by money; finishing order breaks ties
    var order = finished.slice().sort(function (a, b) {
      return (state.teams[b].money - state.teams[a].money) || (finished.indexOf(a) - finished.indexOf(b));
    });
    state.places = order;
    order.forEach(function (id, i) { state.teams[id].place = i + 1; });
    state.phase = 'over';
    events.push({ type: 'over' });
  }

  function finishTeam(state, team, events) {
    var n = state.places.length;
    var prize = PRIZES[n] || 0;
    state.places.push(team.id);
    team.place = n + 1;
    pay(team, prize);
    events.push({ type: 'finish', team: team.id, place: team.place, prize: prize, money: team.money });
    var left = state.teams.filter(function (t) { return !t.place; });
    if (state.places.length >= PODIUM || left.length <= 1) rankAll(state, events);
    else state.phase = 'next';
  }

  function ask(state, events, kind, value) {
    state.left = 1;
    state.total = 1;
    state.qkind = kind;
    state.value = value;
    state.phase = 'card';
    events.push({ type: 'card', team: current(state).id, count: 1, kind: kind, value: value });
  }

  function move(state, events, steps, type) {
    var team = current(state);
    var from = team.pos;
    team.pos = Math.max(0, Math.min(FINISH, from + steps));
    events.push({ type: type || 'move', team: team.id, from: from, to: team.pos, steps: steps });
  }

  // Resolve the square. Moves resolve once; the square reached only finishes or asks nothing more.
  function land(state, events, moved) {
    var team = current(state);
    if (team.pos === FINISH) return finishTeam(state, team, events);
    var sq = BOARD[team.pos];
    var kind = sq[2];
    var v = sq[3] || 0;
    if (moved) { state.phase = 'next'; events.push({ type: 'blank', team: team.id }); return; }
    if (kind === 'word') return ask(state, events, 'word', v);
    if (kind === 'super') return ask(state, events, 'super', v);
    if (kind === 'slide') return ask(state, events, 'slide', SLIDE);
    if (kind === 'star') { pay(team, v); events.push({ type: 'earn', team: team.id, amount: v, money: team.money }); }
    else if (kind === 'minus') { pay(team, -MINUS); events.push({ type: 'lose', team: team.id, amount: MINUS, money: team.money }); }
    else if (kind === 'sad') { pay(team, -v); events.push({ type: 'lose', team: team.id, amount: v, money: team.money }); }
    else if (kind === 'skipn') { move(state, events, v); return land(state, events, true); }
    else if (kind === 'skip' || kind === 'jail') { team.skip = true; events.push({ type: 'skip', team: team.id, why: kind }); }
    else if (kind === 'hole' || kind === 'back') { move(state, events, -BACK, 'hole'); return land(state, events, true); }
    else events.push({ type: 'blank', team: team.id });
    state.phase = 'next';
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var steps = n * STEP_FACTOR;
    var path = [team.pos];
    for (var k = 0; k < steps && path[path.length - 1] < FINISH; k++) path.push(path[path.length - 1] + 1);
    team.pos = path[path.length - 1];
    var events = [{ type: 'walk', team: team.id, path: path, roll: n, steps: steps }];
    land(state, events, false);
    return events;
  }

  function judge(state, correct) {
    if (state.phase !== 'card') return [];
    var team = current(state);
    var events = [];
    if (state.qkind === 'slide') {
      if (correct) { move(state, events, SLIDE, 'move'); land(state, events, true); return events; }
      events.push({ type: 'miss', team: team.id });
    } else if (correct) {
      pay(team, state.value);
      events.push({ type: 'earn', team: team.id, amount: state.value, money: team.money });
    } else if (state.qkind === 'word') {
      pay(team, -WRONG);
      events.push({ type: 'lose', team: team.id, amount: WRONG, money: team.money });
    } else {
      events.push({ type: 'miss', team: team.id });
    }
    state.phase = 'next';
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var events = [];
    var count = state.teams.length;
    for (var guard = 0; guard < count * 2; guard++) {
      state.turn = (state.turn + 1) % count;
      var team = current(state);
      if (team.place) continue;
      if (team.skip) { team.skip = false; events.push({ type: 'skipped', team: team.id }); continue; }
      break;
    }
    state.phase = 'roll';
    return events;
  }

  var api = {
    id: 'maze',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS, STEP_FACTOR: STEP_FACTOR, BACK: BACK, SLIDE: SLIDE,
    WRONG: WRONG, MINUS: MINUS, PRIZES: PRIZES,
    DIST: BOARD.map(function (_, i) { return FINISH - i; }),
    newGame: newGame, current: current, roll: roll, judge: judge, next: next,
    wait: function () { return []; }, canUseRv: function () { return false; }, useRv: function () { return []; },
    canBuy: function () { return false; }, buyRv: function () { return []; }, choose: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.MazeCore = api;
})(typeof window !== 'undefined' ? window : this);
