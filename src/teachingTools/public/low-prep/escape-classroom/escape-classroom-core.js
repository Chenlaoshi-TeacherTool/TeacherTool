/*
 * Escape the Classroom — board data and rules engine (third student game).
 * Shared by the projector page (window.EscapeClassroomCore) and node tests.
 *
 * board.webp is a clean redraw of the student's classroom: desks where the
 * student drew them, visited in a snake order, with aisle stepping stones in
 * between. Data comes from work/escape-classroom/classroom.py.
 *
 * Rules (student's, adapted for the whole class with the teacher's OK):
 *  - Roll the dice: 1–2 = half a table (1 square), 3–4 = one table (2),
 *    5–6 = one and a half tables (3).
 *  - Landing on a desk: answer a card (the desk's phrase, or the teacher's card).
 *    Right: flip a special card. Wrong: move back half a table.
 *  - Special cards: 盾牌 shield (blocks the teacher once), 子弹 bullet (go one and
 *    a half tables), Dang it (prison for two turns), Yay (get out of prison; keep it).
 *  - The teacher chases: after each round she walks 2 squares toward the leading
 *    team. A team on an aisle square with the teacher is caught: prison for two
 *    turns. Desks are safe.
 *  - Out through the door on the other side. Play until three teams are out.
 */
(function (global) {
  'use strict';

  var DATA = {
    frame: [2190, 3080],
    board: [
      [464, 680, "start"], [502, 850, "aisle"], [540, 1020, "desk"], [545, 1200, "aisle"], [550, 1380, "desk", "再见"],
      [563, 1568, "aisle"], [576, 1756, "desk", "你好"], [588, 1923, "aisle"], [600, 2090, "desk", "谢谢"], [692, 2115, "aisle"],
      [784, 2140, "desk", "对不起"], [772, 2008, "aisle"], [760, 1876, "desk", "谢谢你"], [765, 1730, "aisle"], [770, 1584, "desk", "没关系"],
      [755, 1380, "aisle"], [740, 1176, "desk", "心里"], [740, 1000, "aisle"], [740, 824, "desk"], [830, 907, "aisle"],
      [920, 990, "desk", "不对"], [930, 1197, "aisle"], [940, 1404, "desk", "再见"], [940, 1584, "aisle"], [940, 1764, "desk", "对不起"],
      [945, 1947, "aisle"], [950, 2130, "desk", "没关系"], [1035, 2095, "aisle"], [1120, 2060, "desk", "孩子"], [1120, 1896, "aisle"],
      [1120, 1732, "desk", "谢谢"], [1120, 1508, "aisle"], [1120, 1284, "desk", "对了"], [1110, 1102, "aisle"], [1100, 920, "desk", "不好"],
      [1210, 920, "aisle"], [1320, 920, "desk"], [1335, 1088, "aisle"], [1350, 1256, "desk"], [1345, 1480, "aisle"],
      [1340, 1704, "desk"], [1340, 1882, "aisle"], [1340, 2060, "desk"], [1540, 2150, "aisle"], [1700, 2160, "finish"]
    ],
    teacher: 37,
    desks: [[152, 260], [152, 260], [152, 260], [152, 240], [132, 200], [148, 236], [148, 256], [148, 260], [144, 272], [152, 296], [152, 276], [148, 256], [124, 236], [152, 276], [152, 256], [152, 256], [152, 256], [152, 256], [152, 256], [140, 224], [140, 280]],
    spots: {jail: [600, 3002], podium: [[1340, 2990], [1470, 2990], [1600, 2990]], lots: [[1730, 2990], [1860, 2990], [1990, 2990]], teacherHome: [1550, 984]}
  };
  var FRAME = { w: DATA.frame[0], h: DATA.frame[1] };
  // [x, y, kind, phrase]  kind: start desk aisle finish
  var BOARD = DATA.board;
  var FINISH = BOARD.length - 1;
  var SPOTS = DATA.spots;
  var TEACHER_START = DATA.teacher;
  // [w, h] of each desk in play order (the page writes the desk words on them)
  var DESKS = DATA.desks;
  // Square index of each desk, in play order.
  var DESK_SQUARES = BOARD.map(function (s, i) { return s[2] === 'desk' ? i : -1; }).filter(function (i) { return i >= 0; });
  // The student's own desk words ('' where the writing could not be read).
  var DEFAULT_WORDS = DESK_SQUARES.map(function (i) { return BOARD[i][3] || ''; });
  var LINKS = [];
  var MARKS = [];
  var CONNECTOR = '';
  var NEXT = {};
  var GATE = {};

  var JAIL_TURNS = 2;
  var PODIUM = 3;
  var TEACHER_STEP = 2;
  // How many of each special card in the pile.
  var SPECIALS = { shield: 3, bullet: 3, dang: 2, yay: 2 };
  var STEPS = [0, 1, 1, 2, 2, 3, 3];   // die face → squares (half tables)

  // Situation questions for the desk phrases ({w} = the phrase).
  var SITUATIONS = {
    '你好': ['早上见到老师，你说什么？', '见到新同学，你先说什么？'],
    '谢谢': ['同学借给你一支笔，你说什么？', '妈妈给你做了早饭，你说什么？'],
    '谢谢你': ['朋友帮你捡起书，你对他说什么？', '老师帮了你，你说什么？'],
    '对不起': ['你撞到了同学，你说什么？', '你上课迟到了，你对老师说什么？'],
    '没关系': ['同学说"对不起"，你回答什么？', '朋友不小心踩了你的脚，跟你道歉，你说什么？'],
    '再见': ['放学了，你跟老师说什么？', '朋友要回家了，你说什么？'],
    '不对': ['同学说 1 + 1 = 3，你说什么？', '用"不对"说一句话。'],
    '不好': ['朋友问你"今天天气好吗？"下雨了，你说什么？', '用"不好"说一句话。'],
    '对了': ['你答对了题，老师说什么？', '用"对了"说一句话。'],
    '心里': ['用"心里"说一句话。'],
    '孩子': ['用"孩子"说一句话。']
  };

  function clamp(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function kind(i) { return BOARD[i][2]; }
  // The word on the desk at square i: the teacher's words if the game has them, else the student's.
  function phrase(i, state) {
    var n = DESK_SQUARES.indexOf(i);
    if (n < 0) return '';
    var words = state && state.words;
    return words && words.length ? words[n % words.length] : DEFAULT_WORDS[n];
  }

  // Teacher's text → desk words (one per line, or split by spaces/commas).
  function parseWords(text) {
    return String(text || '').split(/[\r\n,，、;；]+|\s{2,}/).map(function (w) {
      return w.split('|')[0].trim().slice(0, 12);
    }).filter(Boolean).slice(0, 60);
  }
  function safe(i) { return kind(i) !== 'aisle'; }

  // A card for a desk word: a situation question for the polite phrases,
  // otherwise "read it and make a sentence". null if the desk has no word.
  function situation(word, zh) {
    if (!word) return null;
    var list = SITUATIONS[word];
    if (!list) return { label: zh ? '桌子上的词：' + word : 'Desk word: ' + word, q: word, a: '', big: true,
      hint: zh ? '读一读，再用它说一句话。' : 'Read it, then make a sentence with it.' };
    var q = list[Math.floor(Math.random() * list.length)];
    return { label: zh ? '桌子上的话：' + word : 'Desk phrase: ' + word, q: q, a: q.indexOf('说一句话') === -1 ? word : '', big: false };
  }

  function newGame(options) {
    var opts = options || {};
    var shared = opts.shared;
    var count = clamp(opts.teams, 2, 6, 4);
    var names = opts.names || [];
    var teams = [];
    for (var i = 0; i < count; i++) {
      var fallback = shared ? (opts.zh ? shared.TEAMS[i].zh : shared.TEAMS[i].en) : 'Team ' + (i + 1);
      teams.push({ id: i, name: String(names[i] || '').trim().slice(0, 16) || fallback, pos: 0, prev: 0, jail: 0, jailFrom: -1, place: 0, shield: 0, yay: 0 });
    }
    var words = Array.isArray(opts.words) ? opts.words.filter(Boolean) : [];
    var state = { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, value: 0, places: [], teacher: TEACHER_START, special: null, pile: [], words: words };
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
      rest.sort(function (a, b) { return b.pos - a.pos; }).forEach(function (other) {
        state.places.push(other.id);
        other.place = state.places.length;
      });
      state.phase = 'over';
      events.push({ type: 'over' });
    } else {
      state.phase = 'next';
    }
  }

  function sendToJail(state, team, events, why) {
    team.jail = JAIL_TURNS;
    team.jailFrom = team.pos;
    events.push({ type: 'jail', team: team.id, why: why });
  }

  // The teacher catches a team standing with her on an aisle square.
  function caught(state, team, events) {
    if (team.place || team.jail || team.pos !== state.teacher || safe(team.pos)) return false;
    if (team.shield > 0) {
      team.shield -= 1;
      events.push({ type: 'shield', team: team.id, left: team.shield });
      return false;
    }
    events.push({ type: 'caught', team: team.id });
    sendToJail(state, team, events, 'teacher');
    return true;
  }

  function stepPath(from, n) {
    var path = [from];
    var pos = from;
    for (var k = 0; k < Math.abs(n); k++) {
      pos = Math.max(0, Math.min(FINISH, pos + (n > 0 ? 1 : -1)));
      path.push(pos);
    }
    return path;
  }

  // After the team's move: finish, caught, desk card, or nothing.
  function land(state, events) {
    var team = current(state);
    if (team.pos === FINISH) return finishTeam(state, team, events);
    if (caught(state, team, events)) { state.phase = 'next'; return; }
    if (kind(team.pos) === 'desk') {
      state.left = 1;
      state.total = 1;
      state.phase = 'card';
      events.push({ type: 'card', team: team.id, count: 1, phrase: phrase(team.pos, state) });
    } else {
      state.phase = 'next';
      events.push({ type: 'blank', team: team.id });
    }
  }

  function roll(state, value) {
    if (state.phase !== 'roll') return [];
    var team = current(state);
    var n = clamp(value, 1, 6, 1);
    var path = stepPath(team.pos, STEPS[n]);
    team.prev = team.pos;
    team.pos = path[path.length - 1];
    var events = [{ type: 'walk', team: team.id, path: path, roll: n, steps: STEPS[n] }];
    land(state, events);
    return events;
  }

  function drawSpecial(state) {
    if (!state.pile.length) {
      Object.keys(SPECIALS).forEach(function (k) { for (var i = 0; i < SPECIALS[k]; i++) state.pile.push(k); });
      for (var i = state.pile.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = state.pile[i]; state.pile[i] = state.pile[j]; state.pile[j] = t;
      }
    }
    return state.pile.pop();
  }

  // `special` lets tests choose the special card.
  function judge(state, correct, special) {
    if (state.phase !== 'card') return [];
    var team = current(state);
    var events = [];
    if (!correct) {
      var back = stepPath(team.pos, -1);
      team.pos = back[back.length - 1];
      events.push({ type: 'back', team: team.id, from: back[0], to: team.pos, path: back });
      state.phase = 'next';
      caught(state, team, events);
      return events;
    }
    var card = special || drawSpecial(state);
    events.push({ type: 'special', team: team.id, card: card });
    state.phase = 'next';
    if (card === 'shield') {
      team.shield += 1;
    } else if (card === 'yay') {
      team.yay += 1;
    } else if (card === 'dang') {
      sendToJail(state, team, events, 'dang');
    } else if (card === 'bullet') {
      var path = stepPath(team.pos, 3);
      team.pos = path[path.length - 1];
      events.push({ type: 'walk', team: team.id, path: path, bullet: true });
      if (team.pos === FINISH) finishTeam(state, team, events);
      else caught(state, team, events);
    }
    return events;
  }

  function release(state, team, events) {
    team.jail = 0;
    // back to the desk where it was, or the desk just before the aisle it was caught in
    team.pos = safe(team.jailFrom) ? team.jailFrom : Math.max(0, team.jailFrom - 1);
    team.jailFrom = -1;
    events.push({ type: 'released', team: team.id, to: team.pos });
  }

  function canUseRv(state) {
    return state.phase === 'jail' && current(state).yay > 0;
  }

  // In prison: play a Yay card to get out and take this turn.
  function useRv(state) {
    if (!canUseRv(state)) return [];
    var team = current(state);
    team.yay -= 1;
    var events = [{ type: 'yay', team: team.id, left: team.yay }];
    release(state, team, events);
    state.phase = 'roll';
    return events;
  }

  function wait(state) {
    if (state.phase !== 'jail') return [];
    var team = current(state);
    var events = [];
    team.jail -= 1;
    if (team.jail <= 0) release(state, team, events);
    else events.push({ type: 'wait', team: team.id, left: team.jail });
    state.phase = 'next';
    return events;
  }

  // The teacher walks toward the team furthest along (not in prison, not out).
  function teacherMove(state, events) {
    var free = state.teams.filter(function (t) { return !t.place && !t.jail; });
    if (!free.length) return;
    var leader = free.reduce(function (a, b) { return b.pos > a.pos ? b : a; });
    var diff = leader.pos - state.teacher;
    if (!diff) { free.forEach(function (t) { caught(state, t, events); }); return; }
    var n = Math.max(-TEACHER_STEP, Math.min(TEACHER_STEP, diff));
    var path = stepPath(state.teacher, n);
    state.teacher = path[path.length - 1];
    events.push({ type: 'teacher', path: path });
    free.forEach(function (t) { caught(state, t, events); });
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var events = [];
    var count = state.teams.length;
    var from = state.turn;
    for (var i = 1; i <= count; i++) {
      var index = (from + i) % count;
      if (!state.teams[index].place) {
        // a full round has passed: the teacher moves
        if (index <= from) teacherMove(state, events);
        state.turn = index;
        break;
      }
    }
    return beginTurn(state, events);
  }

  var api = {
    id: 'escape-classroom',
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, LINKS: LINKS, MARKS: MARKS, CONNECTOR: CONNECTOR,
    NEXT: NEXT, GATE: GATE, DIST: BOARD.map(function (_, i) { return FINISH - i; }),
    JAIL_TURNS: JAIL_TURNS, PODIUM: PODIUM, STEPS: STEPS, SPECIALS: SPECIALS, TEACHER_STEP: TEACHER_STEP,
    DESKS: DESKS, DESK_SQUARES: DESK_SQUARES, DEFAULT_WORDS: DEFAULT_WORDS,
    kind: kind, phrase: phrase, parseWords: parseWords, safe: safe, situation: situation,
    newGame: newGame, current: current, roll: roll, judge: judge, next: next, wait: wait,
    canUseRv: canUseRv, useRv: useRv, canBuy: function () { return false; }, buyRv: function () { return []; },
    canChallenge: function () { return false; }, challenge: function () { return []; },
    choose: function () { return []; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.EscapeClassroomCore = api;
})(typeof window !== 'undefined' ? window : this);
