/*
 * Mochi Salamander Escape — board data and rules engine (fourth student game).
 * Shared by the projector page (window.MochiCore) and node tests.
 *
 * The board is a network: 16 squares with coloured borders joined by the
 * student's coloured paths. board.webp is the student's sheet cleaned up, with
 * tidy squares drawn on top. Data comes from work/mochi/mochi.py.
 *
 * Rules (student's, adapted with the teacher's OK):
 *  - The die is the colour card: 1 yellow, 2 red, 3 blue, 4 green, 5 alarm,
 *    6 step to any neighbouring square. A colour card sends the team to the
 *    nearest square of that colour (the team chooses when two are as near).
 *  - Plain squares: answer a card. Right stays; wrong goes back.
 *  - 问题 L1: right = one extra step (team chooses). L2: right = a shield.
 *    L3: right = an action card. 抽动作卡: take an action card. 走一步: step on.
 *  - Alarm: answer the alarm question. Right = rescue a mochi salamander (a
 *    point for ties). Wrong = back one square, unless a shield blocks it.
 *  - Action cards work from the next round, and only after a right answer:
 *    again (move twice), shield, swap with the leading team, push the leading
 *    team back one square.
 *  - Play until three teams reach 结束 出口.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2400, 1900],
    board: [
      [234, 360, "start", ""], [209, 669, "plain", "red"], [760, 617, "plain", "yellow"], [1172, 526, "action", "blue"],
      [1948, 529, "plain", "yellow"], [2064, 999, "q2", "red"], [1373, 886, "step", "green"], [1494, 1165, "plain", "blue"],
      [1962, 1311, "plain", "yellow"], [1526, 1418, "plain", "green"], [2190, 1630, "finish", ""], [949, 1605, "q1", "blue"],
      [949, 1228, "plain", "yellow"], [585, 1002, "q3", "blue"], [190, 1196, "plain", "green"], [238, 1492, "plain", "red"]
    ],
    adj: [[1, 2, 3], [0, 2, 13, 14], [0, 1, 3, 6, 13], [0, 2, 4, 6], [3, 5, 6], [4, 6, 7, 8], [2, 3, 4, 5, 7, 12, 13], [5, 6, 8, 9, 12], [5, 7, 9, 10], [7, 8, 10, 11, 12], [8, 9, 11], [9, 10, 12, 15], [6, 7, 9, 11, 13, 14, 15], [1, 2, 6, 12, 14], [1, 12, 13, 15], [11, 12, 14]],
    start: 0,
    finish: 10,
    spots: {jail: [0, 0], podium: [[1560, 1800], [1690, 1800], [1820, 1800]], lots: [[1560, 1800], [1690, 1800], [1820, 1800]]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, colour]  kind: start plain action step q1 q2 q3 finish
  var BOARD = DATA.board;
  var ADJ = DATA.adj;
  var FINISH = DATA.finish;
  var SPOTS = DATA.spots;
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};

  var PODIUM = 3;
  var JAIL_TURNS = 0;
  var FACES = [null, 'yellow', 'red', 'blue', 'green', 'alarm', 'step'];
  var ACTIONS = ['again', 'shield', 'swap', 'push'];
  var COLOUR_ZH = { yellow: '黄色', red: '红色', blue: '蓝色', green: '绿色' };

  function clamp(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  // Breadth-first distances from square `from` to every square.
  function distances(from) {
    var dist = BOARD.map(function () { return Infinity; });
    dist[from] = 0;
    var queue = [from];
    while (queue.length) {
      var a = queue.shift();
      ADJ[a].forEach(function (b) {
        if (dist[b] === Infinity) { dist[b] = dist[a] + 1; queue.push(b); }
      });
    }
    return dist;
  }
  var DIST = distances(FINISH);   // steps to the exit, for ranking and labels

  // A shortest path from a to b (list of squares, a first).
  function pathTo(a, b) {
    var d = distances(b);
    var path = [a];
    var pos = a;
    while (pos !== b) {
      pos = ADJ[pos].reduce(function (best, n) { return d[n] < d[best] ? n : best; }, ADJ[pos][0]);
      path.push(pos);
    }
    return path;
  }

  // Squares of `colour` nearest to `from` (not the square itself).
  function nearest(from, colour) {
    var d = distances(from);
    var best = Infinity;
    var out = [];
    BOARD.forEach(function (s, i) {
      if (i === from || s[3] !== colour) return;
      if (d[i] < best) { best = d[i]; out = [i]; } else if (d[i] === best) out.push(i);
    });
    return out;
  }

  function label(i, zh) {
    var s = BOARD[i];
    var name = { start: zh ? '开始' : 'Start', finish: zh ? '出口' : 'Exit', action: zh ? '抽动作卡' : 'Action card',
      step: zh ? '走一步' : 'Step', q1: '问题 L1', q2: '问题 L2', q3: '问题 L3' }[s[2]];
    var dot = { yellow: '🟡', red: '🔴', blue: '🔵', green: '🟢' }[s[3]] || '⬜';
    return dot + ' ' + (name || (zh ? COLOUR_ZH[s[3]] + '格' : s[3] + ' square')) + (zh ? '（离出口 ' + DIST[i] + ' 步）' : ' (' + DIST[i] + ' to exit)');
  }

  function newGame(options) {
    var opts = options || {};
    var shared = opts.shared;
    var count = clamp(opts.teams, 2, 6, 4);
    var names = opts.names || [];
    var teams = [];
    for (var i = 0; i < count; i++) {
      var fallback = shared ? (opts.zh ? shared.TEAMS[i].zh : shared.TEAMS[i].en) : 'Team ' + (i + 1);
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: DATA.start, prev: DATA.start,
        jail: 0, place: 0, shield: 0, rescued: 0, actions: [], again: false });
    }
    var state = { teams: teams, turn: 0, round: 1, phase: 'roll', left: 0, total: 0, value: 0, places: [], options: [], mode: '', zh: !!opts.zh };
    return state;
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
      rest.sort(function (a, b) { return (DIST[a.pos] - DIST[b.pos]) || (b.rescued - a.rescued); }).forEach(function (other) {
        state.places.push(other.id);
        other.place = state.places.length;
      });
      state.phase = 'over';
      events.push({ type: 'over' });
    } else {
      state.phase = 'next';
    }
  }

  function offer(state, events, mode, squares) {
    state.phase = 'fork';
    state.mode = mode;
    state.options = squares.map(function (to) { return { to: to, ok: true, gate: 0, label: label(to, state.zh) }; });
    events.push({ type: 'fork', team: current(state).id, mode: mode, options: state.options, steps: 0 });
  }

  function moveTo(state, to, events) {
    var team = current(state);
    var path = pathTo(team.pos, to);
    team.pos = to;
    events.push({ type: 'walk', team: team.id, path: path });
  }

  function gain(state, team, events) {
    var card = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    team.actions.push({ card: card, round: state.round });
    events.push({ type: 'gain', team: team.id, card: card });
  }

  function land(state, events) {
    var team = current(state);
    var kind = BOARD[team.pos][2];
    if (team.pos === FINISH) return finishTeam(state, team, events);
    if (kind === 'step') {
      events.push({ type: 'stepon', team: team.id });
      return offer(state, events, 'step', ADJ[team.pos]);
    }
    if (kind === 'action') {
      gain(state, team, events);
      state.phase = 'next';
      return;
    }
    if (kind === 'plain' || kind === 'q1' || kind === 'q2' || kind === 'q3') {
      state.left = 1;
      state.total = 1;
      state.qkind = kind;
      state.phase = 'card';
      events.push({ type: 'card', team: team.id, count: 1, level: kind });
      return;
    }
    state.phase = 'next';
    events.push({ type: 'blank', team: team.id });
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var card = FACES[n];
    team.prev = team.pos;
    var events = [{ type: 'colour', team: team.id, roll: n, card: card }];
    if (card === 'alarm') {
      state.left = 1;
      state.total = 1;
      state.phase = 'alarm';
      events.push({ type: 'card', team: team.id, count: 1, alarm: true });
    } else if (card === 'step') {
      offer(state, events, 'step', ADJ[team.pos]);
    } else {
      var targets = nearest(team.pos, card);
      if (targets.length > 1) offer(state, events, 'colour', targets);
      else { moveTo(state, targets[0], events); land(state, events); }
    }
    return events;
  }

  // At a choice: go to square `to`.
  function choose(state, to) {
    if (state.phase !== 'fork') return [];
    if (!state.options.some(function (o) { return o.to === to; })) return [];
    var mode = state.mode;
    var events = [{ type: 'chose', team: current(state).id, to: to }];
    state.options = [];
    state.mode = '';
    moveTo(state, to, events);
    if (mode === 'extra') {
      // the L1 bonus step: only the exit counts, no new card
      var team = current(state);
      if (team.pos === FINISH) finishTeam(state, team, events);
      else state.phase = 'next';
    } else {
      land(state, events);
    }
    return events;
  }

  function backOne(state, team, events) {
    var from = team.pos;
    var to = ADJ[from].reduce(function (best, n) { return DIST[n] > DIST[best] ? n : best; }, ADJ[from][0]);
    team.pos = to;
    events.push({ type: 'back', team: team.id, from: from, to: to, path: [from, to] });
  }

  function leader(state, except) {
    var others = state.teams.filter(function (t) { return t !== except && !t.place; });
    if (!others.length) return null;
    return others.reduce(function (a, b) { return DIST[b.pos] < DIST[a.pos] ? b : a; });
  }

  function apply(state, team, card, events) {
    events.push({ type: 'action', team: team.id, card: card });
    if (card === 'again') {
      team.again = true;
    } else if (card === 'shield') {
      team.shield += 1;
    } else if (card === 'swap') {
      var lead = leader(state, team);
      if (lead && DIST[lead.pos] < DIST[team.pos]) {
        var p = lead.pos;
        lead.pos = team.pos;
        team.pos = p;
        events.push({ type: 'swap', team: team.id, other: lead.id, to: team.pos, otherTo: lead.pos });
      } else {
        events.push({ type: 'nothing', team: team.id });
      }
    } else if (card === 'push') {
      var first = leader(state, team);
      if (first && first.pos !== DATA.start) {
        var save = state.turn;
        backOne(state, first, events);
        state.turn = save;
      } else {
        events.push({ type: 'nothing', team: team.id });
      }
    }
  }

  function judge(state, correct) {
    var team = current(state);
    var events = [];
    if (state.phase === 'card') {
      var kind = state.qkind;
      if (!correct) {
        var from = team.pos;
        team.pos = team.prev;
        events.push({ type: 'back', team: team.id, from: from, to: team.pos, path: pathTo(from, team.pos) });
        state.phase = 'next';
      } else if (kind === 'q1') {
        events.push({ type: 'bonus', team: team.id });
        offer(state, events, 'extra', ADJ[team.pos]);
      } else if (kind === 'q2') {
        team.shield += 1;
        events.push({ type: 'gotshield', team: team.id, shield: team.shield });
        state.phase = 'next';
      } else if (kind === 'q3') {
        gain(state, team, events);
        state.phase = 'next';
      } else {
        events.push({ type: 'stay', team: team.id });
        state.phase = 'next';
      }
    } else if (state.phase === 'alarm') {
      if (correct) {
        team.rescued += 1;
        events.push({ type: 'rescue', team: team.id, rescued: team.rescued });
      } else if (team.shield > 0) {
        team.shield -= 1;
        events.push({ type: 'shield', team: team.id, left: team.shield });
      } else if (team.pos !== DATA.start) {
        backOne(state, team, events);
      } else {
        events.push({ type: 'nothing', team: team.id });
      }
      state.phase = 'next';
    } else if (state.phase === 'buy') {
      var held = team.actions.splice(state.using, 1)[0];
      if (correct) apply(state, team, held.card, events);
      else { team.actions.splice(state.using, 0, held); events.push({ type: 'nobuy', team: team.id }); }
      state.phase = 'roll';
    }
    return events;
  }

  // An action card can be used from the round after it was won, before rolling.
  function usable(state) {
    var team = current(state);
    for (var i = 0; i < team.actions.length; i++) if (team.actions[i].round < state.round) return i;
    return -1;
  }
  function canBuy(state) { return state.phase === 'roll' && usable(state) >= 0; }
  function buyRv(state) {
    if (!canBuy(state)) return [];
    state.using = usable(state);
    state.left = 1;
    state.total = 1;
    state.phase = 'buy';
    return [{ type: 'buy', team: current(state).id, card: current(state).actions[state.using].card }];
  }
  function nextAction(state) {
    var i = usable(state);
    return i < 0 ? '' : current(state).actions[i].card;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var team = current(state);
    if (team.again && !team.place) {
      team.again = false;
      state.phase = 'roll';
      return [{ type: 'again', team: team.id }];
    }
    var count = state.teams.length;
    var from = state.turn;
    for (var i = 1; i <= count; i++) {
      var index = (from + i) % count;
      if (!state.teams[index].place) {
        if (index <= from) state.round += 1;
        state.turn = index;
        break;
      }
    }
    state.phase = 'roll';
    return [];
  }

  var api = {
    id: 'mochi',
    FRAME: FRAME, BOARD: BOARD, ADJ: ADJ, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, DIST: DIST, FACES: FACES, ACTIONS: ACTIONS, PODIUM: PODIUM, JAIL_TURNS: JAIL_TURNS,
    nearest: nearest, pathTo: pathTo, label: label, nextAction: nextAction,
    newGame: newGame, current: current, roll: roll, choose: choose, judge: judge, next: next,
    canBuy: canBuy, buyRv: buyRv,
    wait: function () { return []; }, canUseRv: function () { return false; }, useRv: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.MochiCore = api;
})(typeof window !== 'undefined' ? window : this);
