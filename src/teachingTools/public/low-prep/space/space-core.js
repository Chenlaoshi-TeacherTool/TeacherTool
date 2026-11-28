/*
 * 太大一 (space theme) — board data and rules engine (fifth student game).
 * Shared by the projector page (window.SpaceCore) and node tests.
 *
 * board.webp is a clean redraw of the student's square loop with a diagonal.
 * Route: start at the bottom-left corner, once round the loop clockwise, then
 * up the diagonal to 结果. Data comes from work/space/space.py.
 *
 * Rules (student's, adapted with the teacher's OK):
 *  - Roll and move. Colour squares: green and yellow move forward 3; red,
 *    orange and teal move back 3; the purple black hole moves back 6; the
 *    cobweb ("you died") sends you back to the start. Printed "move back N"
 *    squares do what they say. A move resolves once; the square you reach counts.
 *  - 拿卡片: answer a card. Right = grow one step: 🌙 moon → 🪐 dwarf planet →
 *    🌍 planet → ⭐ star. Wrong = back one square.
 *  - Rolling past 结果 lands on "you died": back to the start of the diagonal.
 *  - Win: reach 结果 holding a star. Without one you stay on 结果 and answer a
 *    card each turn until you form it. Three places end the game.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2256, 2640],
    board: [
      [370, 2381, "start"], [250, 2237, "blank"], [240, 2100, "back", 2], [230, 1987, "blank"], [250, 1795, "web"],
      [250, 1670, "back", 3], [250, 1560, "back", 3], [250, 1430, "card"], [250, 1310, "hole", 6], [259, 1190, "back", 3],
      [259, 1080, "back", 3], [254, 984, "blank"], [254, 888, "fwd", 3], [254, 792, "blank"], [278, 691, "blank"],
      [422, 701, "card"], [552, 696, "back", 3], [658, 701, "blank"], [773, 701, "fwd", 3], [893, 701, "fwd", 3],
      [1003, 706, "blank"], [1123, 710, "back", 3], [1229, 720, "blank"], [1334, 725, "card"], [1430, 730, "blank"],
      [1531, 734, "back", 1], [1675, 749, "fwd", 3], [1829, 845, "back", 3], [1867, 960, "blank"], [1906, 1080, "back", 3],
      [1915, 1243, "card"], [1920, 1392, "card"], [1925, 1502, "blank"], [1934, 1622, "fwd", 3], [1939, 1766, "fwd", 3],
      [1944, 1896, "blank"], [1958, 2006, "blank"], [1968, 2117, "card"], [1963, 2237, "blank"], [1848, 2333, "blank"],
      [1723, 2352, "card"], [1603, 2362, "blank"], [1517, 2366, "back", 4], [1397, 2371, "card"], [1243, 2371, "hole", 6],
      [1063, 2371, "card"], [898, 2371, "fwd", 3], [763, 2371, "card"], [636, 2376, "back", 2], [521, 2381, "back", 2],
      [427, 2261, "card"], [569, 2155, "card"], [677, 2026, "card"], [797, 1920, "card"], [922, 1800, "card"],
      [1032, 1680, "back", 1], [1169, 1510, "finish"]
    ],
    diag: 50,
    spots: {jail: [0, 0], podium: [[1272, 2544], [1440, 2544], [1608, 2544]], lots: [[1272, 2544], [1440, 2544], [1608, 2544]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, value]  kind: start blank card fwd back hole web finish
  var BOARD = DATA.board;
  var FINISH = BOARD.length - 1;
  var DIAG = DATA.diag;            // first square of the diagonal
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};
  var STAR = 4;                    // levels: 0 none, 1 moon, 2 dwarf planet, 3 planet, 4 star
  var LEVELS = [
    { emoji: '', zh: '', en: '' },
    { emoji: '🌙', zh: '月亮', en: 'Moon' },
    { emoji: '🪐', zh: '矮行星', en: 'Dwarf planet' },
    { emoji: '🌍', zh: '行星', en: 'Planet' },
    { emoji: '⭐', zh: '恒星', en: 'Star' }
  ];
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
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, level: 0, jail: 0, place: 0 });
    }
    return { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, places: [] };
  }

  function current(state) { return state.teams[state.turn]; }

  function unfinished(state) {
    return state.teams.filter(function (team) { return !team.place; });
  }

  function finishTeam(state, team, events) {
    state.places.push(team.id);
    team.place = state.places.length;
    events.push({ type: 'finish', team: team.id, place: team.place });
    var rest = unfinished(state);
    if (state.places.length >= PODIUM || rest.length <= 1) {
      rest.sort(function (a, b) { return (b.pos - a.pos) || (b.level - a.level); }).forEach(function (other) {
        state.places.push(other.id);
        other.place = state.places.length;
      });
      state.phase = 'over';
      events.push({ type: 'over' });
    } else {
      state.phase = 'next';
    }
  }

  function ask(state, events, quest) {
    state.left = 1;
    state.total = 1;
    state.quest = !!quest;
    state.phase = 'card';
    events.push({ type: quest ? 'quest' : 'card', team: current(state).id, count: 1, level: current(state).level });
  }

  // Resolve the square the team stands on. A move resolves once.
  function land(state, events, moved) {
    var team = current(state);
    var sq = BOARD[team.pos];
    var kind = sq[2];
    if (team.pos === FINISH) {
      if (team.level >= STAR) return finishTeam(state, team, events);
      return ask(state, events, true);
    }
    if (!moved && (kind === 'fwd' || kind === 'back' || kind === 'hole')) {
      var steps = kind === 'fwd' ? sq[3] : -sq[3];
      var to = Math.max(0, Math.min(FINISH, team.pos + steps));
      events.push({ type: kind === 'hole' ? 'hole' : 'move', team: team.id, from: team.pos, to: to, steps: steps });
      team.pos = to;
      return land(state, events, true);
    }
    if (!moved && kind === 'web') {
      events.push({ type: 'web', team: team.id, from: team.pos, to: 0 });
      team.pos = 0;
      state.phase = 'next';
      return;
    }
    if (kind === 'card') return ask(state, events, false);
    state.phase = 'next';
    events.push({ type: 'blank', team: team.id });
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var from = team.pos;
    var events = [];
    if (from + n > FINISH) {
      // past 结果 onto "you died": back to the start of the diagonal
      events.push({ type: 'walk', team: team.id, from: from, to: FINISH, roll: n });
      events.push({ type: 'overshoot', team: team.id, from: FINISH, to: DIAG });
      team.pos = DIAG;
      land(state, events, true);
      return events;
    }
    team.pos = from + n;
    events.push({ type: 'walk', team: team.id, from: from, to: team.pos, roll: n });
    land(state, events, false);
    return events;
  }

  function judge(state, correct) {
    if (state.phase !== 'card') return [];
    var team = current(state);
    var events = [];
    if (correct) {
      if (team.level < STAR) team.level += 1;
      events.push({ type: 'level', team: team.id, level: team.level });
      if (team.pos === FINISH && team.level >= STAR) finishTeam(state, team, events);
      else state.phase = 'next';
    } else if (team.pos === FINISH) {
      events.push({ type: 'waitstar', team: team.id });
      state.phase = 'next';
    } else {
      var from = team.pos;
      team.pos = Math.max(0, from - 1);
      events.push({ type: 'back', team: team.id, from: from, to: team.pos });
      state.phase = 'next';
    }
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var count = state.teams.length;
    for (var i = 1; i <= count; i++) {
      var index = (state.turn + i) % count;
      if (!state.teams[index].place) { state.turn = index; break; }
    }
    var events = [];
    var team = current(state);
    // a team waiting on 结果 answers a card instead of rolling
    if (team.pos === FINISH) ask(state, events, true);
    else state.phase = 'roll';
    return events;
  }

  var api = {
    id: 'space',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, DIAG: DIAG, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, STAR: STAR, LEVELS: LEVELS, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS,
    DIST: BOARD.map(function (_, i) { return FINISH - i; }),
    newGame: newGame, current: current, roll: roll, judge: judge, next: next,
    wait: function () { return []; }, canUseRv: function () { return false; }, useRv: function () { return []; },
    canBuy: function () { return false; }, buyRv: function () { return []; }, choose: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.SpaceCore = api;
})(typeof window !== 'undefined' ? window : this);
