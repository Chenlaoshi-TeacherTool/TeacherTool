/*
 * 汉字大富翁 — board data and rules engine (the student's "Monopoly" game).
 * Shared by the projector page (window.MoneyCore) and node tests.
 *
 * board.webp is a clean redraw of the student's board: one loop of squares.
 * Data comes from work/monopoly/money.py. Public name 汉字大富翁 (the student's
 * title is a trademark).
 *
 * Rules (student's, adapted with the teacher's OK):
 *  - Every team starts with $1000. Passing or landing on 起点 pays $200.
 *  - An unowned property: answer a card; if right, the team may buy it at its
 *    price ($100 / $150 / $200 by side).
 *  - Someone else's property: pay the owner $100. A team that cannot pay is out.
 *  - ? squares: a special card; right = $100. Own property, blank and fish
 *    squares: a normal card; right = $50. Wrong answers cost nothing.
 *  - Banana peel and jail: skip the next turn. Airplane: fly to 起点 (+$200).
 *  - The game ends after the agreed laps (or when the teacher ends it). Teams
 *    rank by money + the price of their properties.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2400, 1800],
    board: [
      [149, 1657, "start"], [385, 1634, "prop", 100], [576, 1634, "prop", 100], [750, 1634, "prop", 100], [932, 1634, "chance"],
      [1127, 1634, "prop", 100], [1309, 1634, "prop", 100], [1479, 1634, "banana"], [1653, 1634, "prop", 100], [1840, 1634, "prop", 100],
      [2035, 1634, "banana"], [2250, 1634, "corner"], [2250, 1394, "prop", 150], [2250, 1193, "prop", 150], [2250, 1028, "prop", 150],
      [2250, 854, "prop", 150], [2250, 680, "prop", 150], [2250, 501, "prop", 150], [2188, 224, "plane"], [1948, 168, "chance"],
      [1807, 168, "prop", 200], [1653, 168, "banana"], [1504, 168, "prop", 200], [1355, 168, "prop", 200], [1206, 168, "prop", 200],
      [1044, 168, "prop", 200], [887, 168, "banana"], [721, 168, "chance"], [547, 168, "prop", 200], [369, 168, "prop", 200],
      [153, 177, "jail"], [145, 365, "prop", 150], [145, 518, "prop", 150], [145, 680, "prop", 150], [145, 849, "chance"],
      [145, 1011, "prop", 150], [145, 1156, "prop", 150], [145, 1301, "banana"], [145, 1467, "fish"]
    ],
    spots: {jail: [152, 176], podium: [[1492, 1351], [1674, 1351], [1856, 1351]], lots: [[1492, 1351], [1674, 1351], [1856, 1351]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, price]  kind: start prop chance banana jail plane fish corner
  var BOARD = DATA.board;
  var N = BOARD.length;
  var FINISH = -1;               // a loop: no finish square
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};

  var START_MONEY = 1000;
  var SALARY = 200;
  var RENT = 100;
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
      owner: BOARD.map(function () { return -1; }), laps: clamp(opts.laps, 1, 5, 2), zh: !!opts.zh };
  }

  function current(state) { return state.teams[state.turn]; }

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
        var pay = Math.min(RENT, team.money);
        team.money -= RENT;
        other.money += pay;
        events.push({ type: 'rent', team: team.id, owner: owner, amount: RENT, money: team.money });
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
    if (kind === 'banana' || kind === 'jail') {
      team.skip = true;
      events.push({ type: 'skip', team: team.id, why: kind });
      state.phase = 'next';
      return;
    }
    if (kind === 'plane') {
      events.push({ type: 'plane', team: team.id, from: team.pos, to: 0 });
      team.pos = 0;
      salary(state, team, events);
      state.phase = 'next';
      return;
    }
    if (kind === 'start' || kind === 'corner') {
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
          { to: 1, ok: true, gate: 0, label: (state.zh ? '买下这块地 $' : 'Buy it for $') + state.value },
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
      if (team.skip) {
        team.skip = false;
        events.push({ type: 'skipped', team: team.id });
        continue;
      }
      state.phase = 'roll';
      return events;
    }
    state.phase = 'roll';
    return events;
  }

  var api = {
    id: 'money',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS,
    START_MONEY: START_MONEY, SALARY: SALARY, RENT: RENT, SPECIAL_PRIZE: SPECIAL_PRIZE, NORMAL_PRIZE: NORMAL_PRIZE,
    DIST: BOARD.map(function () { return 0; }),
    wealth: wealth, end: end,
    newGame: newGame, current: current, roll: roll, judge: judge, choose: choose, next: next,
    wait: function () { return []; }, canUseRv: function () { return false; }, useRv: function () { return []; },
    canBuy: function () { return false; }, buyRv: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.MoneyCore = api;
})(typeof window !== 'undefined' ? window : this);
