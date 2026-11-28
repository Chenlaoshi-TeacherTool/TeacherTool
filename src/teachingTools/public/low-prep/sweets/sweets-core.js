/*
 * 糖果乐园 — board data and rules engine (a student's candy board game; the
 * student's title is a trademark, so the public name is 糖果乐园).
 * Shared by the projector page (window.SweetsCore) and node tests.
 *
 * board.webp is a clean redraw of the student's snake path (five rows) with the
 * candies between squares, the slides and the moonlight paths. Data comes from
 * work/candyland/candyland.py.
 *
 * Rules (student's, with the teacher's choices):
 *  - 普通 and 抽卡: answer a card. Right = stay, wrong = back one square.
 *  - 再走一步: one more step. 再来一次: roll again.
 *  - 黑洞: back to the start of the row (see HOLE in the data).
 *  - 特别: follow the slide to the square it points to. 月: go along the
 *    moonlight path. A jump resolves once; the square reached still counts.
 *  - Play until three teams reach 完成.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2457, 1843],
    board: [
      [376, 424, "start"], [600, 432, "plain"], [816, 424, "again"], [1056, 384, "hole"], [1296, 384, "plain"],
      [1520, 384, "step"], [1744, 352, "plain"], [1968, 368, "hole"], [2192, 368, "card"], [2192, 608, "again"],
      [1952, 592, "plain"], [1728, 592, "card"], [1504, 592, "hole"], [1280, 600, "slide", 10], [1040, 608, "card"],
      [832, 616, "hole"], [624, 624, "moon", 21], [432, 624, "again"], [288, 640, "step"], [296, 888, "hole"],
      [592, 880, "slide", 21], [832, 872, "plain"], [1104, 888, "moon", 31], [1456, 808, "slide", 10], [1744, 808, "card"],
      [2064, 816, "plain"], [2256, 832, "hole"], [2240, 1040, "step"], [1984, 1040, "card"], [1776, 1048, "again"],
      [1520, 1088, "plain"], [1232, 1064, "again"], [1008, 1048, "plain"], [752, 1048, "hole"], [512, 1024, "card"],
      [288, 1024, "plain"], [296, 1264, "card"], [512, 1264, "card"], [736, 1264, "hole"], [920, 1272, "card"],
      [1104, 1280, "hole"], [1296, 1304, "again"], [1640, 1336, "slide", 30], [1864, 1344, "card"], [2096, 1440, "finish"]
    ],
    rowStart: [0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 19, 19, 19, 19, 19, 19, 19, 19, 27, 27, 27, 27, 27, 27, 27, 27, 27, 36, 36, 36, 36, 36, 36, 36, 36, 36],
    hole: 'row',
    spots: {jail: [0, 0], podium: [[304, 1544], [422, 1544], [541, 1544]], lots: [[659, 1544], [778, 1544], [896, 1544]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, target]  kind: start plain card step again hole slide moon finish
  var BOARD = DATA.board;
  var FINISH = BOARD.length - 1;
  var ROW_START = DATA.rowStart;   // for each square, the first square of its row
  var HOLE = DATA.hole;            // 'start' or 'row'
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};
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
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, jail: 0, place: 0 });
    }
    return { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, places: [] };
  }

  function current(state) { return state.teams[state.turn]; }

  function finishTeam(state, team, events) {
    state.places.push(team.id);
    team.place = state.places.length;
    events.push({ type: 'finish', team: team.id, place: team.place });
    var rest = state.teams.filter(function (t) { return !t.place; });
    if (state.places.length >= PODIUM || rest.length <= 1) {
      rest.sort(function (a, b) { return b.pos - a.pos; }).forEach(function (o) {
        state.places.push(o.id);
        o.place = state.places.length;
      });
      state.phase = 'over';
      events.push({ type: 'over' });
    } else {
      state.phase = 'next';
    }
  }

  function land(state, events, moved) {
    var team = current(state);
    if (team.pos === FINISH) return finishTeam(state, team, events);
    var sq = BOARD[team.pos];
    var kind = sq[2];
    if (!moved && (kind === 'slide' || kind === 'moon')) {
      var to = sq[3];
      events.push({ type: kind === 'moon' ? 'moon' : 'chute', team: team.id, from: team.pos, to: to });
      team.pos = to;
      return land(state, events, true);
    }
    if (!moved && kind === 'hole') {
      var back = HOLE === 'start' ? 0 : ROW_START[team.pos];
      events.push({ type: 'blackhole', team: team.id, from: team.pos, to: back });
      team.pos = back;
      state.phase = 'next';
      return;
    }
    if (!moved && kind === 'step') {
      var from = team.pos;
      team.pos = Math.min(FINISH, from + 1);
      events.push({ type: 'move', team: team.id, from: from, to: team.pos, steps: 1 });
      return land(state, events, true);
    }
    if (kind === 'again' && !moved) {
      state.phase = 'roll';
      events.push({ type: 'again', team: team.id });
      return;
    }
    if (kind === 'plain' || kind === 'card') {
      state.left = 1;
      state.total = 1;
      state.phase = 'card';
      events.push({ type: 'card', team: team.id, count: 1 });
      return;
    }
    state.phase = 'next';
    events.push({ type: 'blank', team: team.id });
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var from = team.pos;
    team.pos = Math.min(FINISH, from + n);
    var events = [{ type: 'walk', team: team.id, from: from, to: team.pos, roll: n }];
    land(state, events, false);
    return events;
  }

  function judge(state, correct) {
    if (state.phase !== 'card') return [];
    var team = current(state);
    var events = [];
    if (correct) {
      events.push({ type: 'stay', team: team.id });
    } else {
      var from = team.pos;
      team.pos = Math.max(0, from - 1);
      events.push({ type: 'back', team: team.id, from: from, to: team.pos });
    }
    state.phase = 'next';
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var count = state.teams.length;
    for (var i = 1; i <= count; i++) {
      var index = (state.turn + i) % count;
      if (!state.teams[index].place) { state.turn = index; break; }
    }
    state.phase = 'roll';
    return [];
  }

  var api = {
    id: 'sweets',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS, ROW_START: ROW_START, HOLE: HOLE,
    DIST: BOARD.map(function (_, i) { return FINISH - i; }),
    newGame: newGame, current: current, roll: roll, judge: judge, next: next,
    wait: function () { return []; }, canUseRv: function () { return false; }, useRv: function () { return []; },
    canBuy: function () { return false; }, buyRv: function () { return []; }, choose: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.SweetsCore = api;
})(typeof window !== 'undefined' ? window : this);
