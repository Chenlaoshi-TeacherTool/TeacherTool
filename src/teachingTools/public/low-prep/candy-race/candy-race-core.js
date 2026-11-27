/*
 * Candy Race — board data and rules engine (second student game).
 * Shared by the projector page (window.CandyRaceCore) and node tests.
 *
 * board.webp is the student's own drawing (cleaned-up photo). Its candy paths
 * do not say how they connect, so the teacher let us set the route: squares sit
 * on the squares the student drew, and the candy dead ends are side paths whose
 * last square links back to the main path (drawn as arrows). Square centres are
 * in a FRAME.w × FRAME.h frame (photo pixels × 2). Board data comes from
 * work/candy-race/photo_route.py.
 *
 * Rules (student's, with the teacher's choices):
 *  - Roll the dice. At a fork (岔路) the team chooses where to go.
 *  - Coloured and $ squares: answer a card. Right: earn the money (the $ shown,
 *    or the card value on coloured squares). Wrong: no money, go back to where
 *    the team was before this roll.
 *  - The bridge (桥) can only be taken with enough money (GATE).
 *  - With RV_PRICE a team may buy an RV by answering a card. The RV gets the
 *    team out of jail, up to 3 times. (The student wrote $2000 / $3500; the
 *    board's own amounts are 10× smaller, so the prices are scaled to match.)
 *  - 去监狱: wait two turns, then come out on the square after it.
 *  - Play until three teams reach 终点.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2578, 3072],
    board: [
      [2510, 2980, "start"], [2390, 2870, "money", 20], [2270, 2770], [2184, 2580], [2200, 2500, "money", 50], [2190, 2420, "card", 40],
      [2180, 2340, "card", 40], [2170, 2276], [2090, 2250, "card", 40], [2004, 2216, "card", 40], [1956, 2144, "card", 40], [1900, 2124, "money", 12],
      [1864, 2070, "card", 40], [1888, 2020, "money", 15], [1916, 1976, "card", 40], [1850, 1950, "money", 20], [1776, 1980, "money", 100], [1704, 2016, "card", 40],
      [1624, 2024, "card", 40], [1530, 2024, "card", 40], [1444, 2000], [1400, 2070], [1404, 2136], [1436, 2196],
      [1470, 2256], [1460, 2320], [1424, 2376], [1376, 2424], [1380, 2480, "card", 40], [1420, 2524, "card", 40],
      [1424, 2570, "card", 40], [1344, 2600, "card", 40], [1280, 2612, "card", 40], [1212, 2612, "jail"], [1120, 2596, "card", 40], [1030, 2544, "card", 40],
      [930, 2456], [840, 2420], [756, 2396], [686, 2356], [650, 2290], [656, 2216],
      [716, 2170], [796, 2136], [880, 2092, "card", 40], [968, 2080, "jail"], [940, 1984], [840, 1980, "card", 40],
      [744, 1972], [656, 1964], [570, 1956], [500, 1950], [410, 2000], [384, 2080],
      [364, 2160], [364, 2240], [380, 2320], [444, 2410], [524, 2510], [670, 2550],
      [744, 2670], [704, 2816], [564, 2900], [400, 2904], [280, 2810], [236, 2704],
      [2130, 2670, "money", 50], [2000, 2650, "money", 70], [1850, 2660, "money", 100], [1724, 2724, "money", 20], [1676, 2824], [1724, 2910, "money", 10],
      [1820, 2944], [1956, 2920, "money", 100], [2064, 2836, "card", 40], [1970, 2800, "card", 40], [2230, 2204, "card", 40], [2256, 2120],
      [2316, 2044], [2376, 1956], [2392, 1860], [2320, 1800], [2240, 1830], [2190, 1910],
      [2164, 1990], [2120, 2044, "card", 40], [1410, 1900, "money", 17], [1444, 1810, "money", 100], [1470, 1716, "card", 40], [1400, 1644, "card", 40],
      [1304, 1580, "card", 40], [1280, 1444, "card", 40], [1336, 1304, "card", 40], [1424, 1250, "card", 40], [1504, 1224, "card", 40], [1610, 1204, "card", 40],
      [1710, 1208, "card", 40], [1810, 1232, "card", 40], [1924, 1304, "money", 12], [380, 1860], [340, 1760], [330, 1660],
      [380, 1580], [460, 1530, "card", 40], [530, 1430], [600, 1300, "money", 10], [660, 1190, "card", 40], [660, 1070, "card", 40],
      [600, 960], [510, 870], [410, 800, "money", 75], [290, 744], [200, 680, "money", 100], [200, 604, "money", 10000],
      [130, 1120], [80, 1210], [60, 1310], [60, 1420], [68, 1530], [84, 1640],
      [120, 1750], [190, 1850], [260, 1950], [300, 2060], [320, 2180], [230, 2610, "finish"]
    ],
    next: {2: [3, 66], 75: [3], 7: [8, 76], 85: [9], 20: [21, 86], 98: [21], 51: [52, 99], 65: [125], 124: [56]},
    gate: {52: 200},
    rv: 350,
    links: [[75, 3], [85, 9], [98, 21], [113, 114]],
    spots: {jail: [1120, 2220], podium: [[950, 2860], [1080, 2860], [1210, 2860]], lots: [[950, 2990], [1080, 2990], [1210, 2990]]},
    marks: []
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, value]  kind: start card money jail finish (blank when omitted).
  // card/money value = what a right answer earns.
  var BOARD = DATA.board;
  var FINISH = BOARD.length - 1;
  // Squares whose next square is not i + 1 (forks list every way out).
  var NEXT = DATA.next;
  // Squares a team may only enter with at least this much money (the bridge).
  var GATE = DATA.gate;
  var SPOTS = DATA.spots;
  // Side paths that end in a dead end jump back to the main path: [from, to] pairs drawn as arrows.
  var LINKS = DATA.links || [];
  // Labels and rings drawn over the student's photo.
  var MARKS = DATA.marks || [];
  var CONNECTOR = '';

  var JAIL_TURNS = 2;
  var PODIUM = 3;
  var RV_PRICE = DATA.rv || 3500;
  var RV_USES = 3;

  function nextOf(i) {
    if (NEXT[i]) return NEXT[i].slice();
    return i < FINISH ? [i + 1] : [];
  }

  // Shortest number of steps from every square to 终点, for ranking.
  var DIST = (function () {
    var dist = BOARD.map(function () { return Infinity; });
    dist[FINISH] = 0;
    for (var changed = true; changed;) {
      changed = false;
      for (var i = 0; i < BOARD.length; i++) {
        nextOf(i).forEach(function (n) {
          if (dist[n] + 1 < dist[i]) { dist[i] = dist[n] + 1; changed = true; }
        });
      }
    }
    return dist;
  })();

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
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, prev: 0, money: 0, rv: 0, jail: 0, jailFrom: -1, place: 0 });
    }
    var state = { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, steps: 0, options: [], places: [] };
    beginTurn(state, []);
    return state;
  }

  function current(state) { return state.teams[state.turn]; }

  function beginTurn(state, events) {
    state.phase = current(state).jail ? 'jail' : 'roll';
    return events;
  }

  function unfinished(state) {
    return state.teams.filter(function (team) { return !team.place; });
  }

  function finishTeam(state, team, events) {
    state.places.push(team.id);
    team.place = state.places.length;
    events.push({ type: 'finish', team: team.id, place: team.place });
    var rest = unfinished(state);
    if (state.places.length >= PODIUM || rest.length <= 1) {
      // The rest are ranked by how close they are to 终点, then by money.
      rest.sort(function (a, b) { return (DIST[a.pos] - DIST[b.pos]) || (b.money - a.money); }).forEach(function (other) {
        state.places.push(other.id);
        other.place = state.places.length;
      });
      state.phase = 'over';
      events.push({ type: 'over' });
    } else {
      state.phase = 'next';
    }
  }

  function canEnter(team, square) {
    return !GATE[square] || team.money >= GATE[square];
  }

  // Walk the remaining steps. Stops at a fork to let the team choose.
  function advance(state, events, path) {
    var team = current(state);
    while (state.steps > 0 && team.pos !== FINISH) {
      var ways = nextOf(team.pos);
      if (ways.length > 1) {
        if (path.length > 1) events.push({ type: 'walk', team: team.id, path: path, roll: state.roll });
        state.phase = 'fork';
        state.options = ways.map(function (to) { return { to: to, ok: canEnter(team, to), gate: GATE[to] || 0 }; });
        events.push({ type: 'fork', team: team.id, at: team.pos, options: state.options, steps: state.steps });
        return events;
      }
      team.pos = ways[0];
      path.push(team.pos);
      state.steps--;
    }
    state.steps = 0;
    if (path.length > 1) events.push({ type: 'walk', team: team.id, path: path, roll: state.roll });
    land(state, events);
    return events;
  }

  function ask(state, value, kind) {
    state.left = 1;
    state.total = 1;
    state.value = value;
    state.phase = kind;
  }

  function land(state, events) {
    var team = current(state);
    var square = BOARD[team.pos];
    var kind = square[2];
    if (team.pos === FINISH) return finishTeam(state, team, events);
    if (kind === 'jail') {
      team.jail = JAIL_TURNS;
      team.jailFrom = team.pos;
      state.phase = 'next';
      events.push({ type: 'jail', team: team.id });
    } else if (kind === 'card' || kind === 'money') {
      ask(state, square[3] || 100, 'card');
      events.push({ type: 'card', team: team.id, count: 1, value: state.value });
    } else {
      state.phase = 'next';
      events.push({ type: 'blank', team: team.id });
    }
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    team.prev = team.pos;
    state.roll = n;
    state.steps = n;
    return advance(state, [], [team.pos]);
  }

  // At a fork: go to square `to` (must be one of the offered ways).
  function choose(state, to) {
    if (state.phase !== 'fork') return [];
    var option = state.options.filter(function (o) { return o.to === to; })[0];
    if (!option || !option.ok) return [];
    var team = current(state);
    var from = team.pos;
    team.pos = to;
    state.steps--;
    state.options = [];
    state.phase = 'roll-on';
    return advance(state, [{ type: 'chose', team: team.id, to: to }], [from, to]);
  }

  function canBuy(state) {
    var team = current(state);
    return state.phase === 'roll' && !team.rv && team.money >= RV_PRICE;
  }

  // Before rolling: answer a card to buy the RV.
  function buyRv(state) {
    if (!canBuy(state)) return [];
    ask(state, 0, 'buy');
    return [{ type: 'buy', team: current(state).id }];
  }

  function canUseRv(state) {
    return state.phase === 'jail' && current(state).rv > 0;
  }

  function release(state, events) {
    var team = current(state);
    team.jail = 0;
    team.pos = nextOf(team.jailFrom)[0];
    team.jailFrom = -1;
    events.push({ type: 'released', team: team.id, to: team.pos });
  }

  // In jail: the RV drives the team out, and it plays this turn.
  function useRv(state) {
    if (!canUseRv(state)) return [];
    var team = current(state);
    team.rv -= 1;
    var events = [{ type: 'rvout', team: team.id, left: team.rv }];
    release(state, events);
    state.phase = 'roll';
    return events;
  }

  // In jail: sit out this turn.
  function wait(state) {
    if (state.phase !== 'jail') return [];
    var team = current(state);
    var events = [];
    team.jail -= 1;
    if (team.jail <= 0) release(state, events);
    else events.push({ type: 'wait', team: team.id, left: team.jail });
    state.phase = 'next';
    return events;
  }

  function judge(state, correct) {
    var team = current(state);
    var events = [];
    if (state.phase === 'card') {
      if (correct) {
        team.money += state.value;
        events.push({ type: 'earn', team: team.id, amount: state.value, money: team.money });
      } else {
        var from = team.pos;
        team.pos = team.prev;
        events.push({ type: 'back', team: team.id, from: from, to: team.pos });
      }
      state.phase = 'next';
    } else if (state.phase === 'buy') {
      if (correct) {
        team.money -= RV_PRICE;
        team.rv = RV_USES;
        events.push({ type: 'rv', team: team.id, money: team.money });
      } else {
        events.push({ type: 'nobuy', team: team.id });
      }
      state.phase = 'roll';
    }
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var count = state.teams.length;
    for (var i = 1; i <= count; i++) {
      var index = (state.turn + i) % count;
      if (!state.teams[index].place) {
        state.turn = index;
        break;
      }
    }
    return beginTurn(state, []);
  }

  var api = {
    id: 'candy-race',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, NEXT: NEXT, GATE: GATE, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR, DIST: DIST,
    JAIL_TURNS: JAIL_TURNS, PODIUM: PODIUM, RV_PRICE: RV_PRICE, RV_USES: RV_USES,
    nextOf: nextOf, newGame: newGame, current: current, roll: roll, choose: choose, judge: judge, next: next,
    wait: wait, canBuy: canBuy, buyRv: buyRv, canUseRv: canUseRv, useRv: useRv,
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.CandyRaceCore = api;
})(typeof window !== 'undefined' ? window : this);
