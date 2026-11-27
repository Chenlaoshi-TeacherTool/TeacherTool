/*
 * Escape the Path — board data, rules engine and template sanitizer.
 * Shared by the projector page (window.EscapePathCore) and the server
 * (services/games/escapePathGame.js) through module.exports.
 *
 * The board is a student's hand-drawn picture (board.webp). Square centres are
 * in a 1956 × 2374 frame (twice the photo's pixels) laid over that picture.
 */
(function (global) {
  'use strict';

  var FRAME = { w: 1956, h: 2374 };

  // [x, y, kind, value]  kind: start card extra jail skip again move slide finish (blank when omitted)
  // move: value = steps (negative = back). slide: value = square at the snake's
  // other end. extra: value = how many cards. Path: 开始 (top right) down the
  // right column, then up, down, up and down again, and up the left column to 结束.
  var BOARD = [
    [1760, 180, 'start'], [1766, 270, 'card'], [1776, 360, 'card'], [1774, 450], [1770, 540, 'jail'],
    [1774, 634, 'move', -3], [1776, 724], [1780, 796, 'card'], [1784, 870], [1800, 934, 'card'],
    [1804, 1030, 'card'], [1804, 1114, 'card'], [1804, 1210, 'card'], [1804, 1306], [1804, 1386],
    [1800, 1470, 'card'], [1700, 1470, 'card'], [1634, 1480], [1630, 1380], [1610, 1290, 'again'],
    [1600, 1190], [1590, 1090, 'card'], [1590, 980, 'card'], [1570, 870], [1570, 730, 'move', 2],
    [1564, 640, 'slide', 35], [1560, 540], [1550, 450, 'move', 3], [1530, 360], [1500, 270, 'card'],
    [1380, 280, 'move', -1], [1290, 320], [1310, 410, 'card'], [1330, 500, 'card'], [1340, 590],
    [1360, 690, 'card'], [1370, 800], [1390, 914, 'move', 5], [1394, 994], [1400, 1064, 'card'],
    [1394, 1124, 'card'], [1390, 1200], [1390, 1304, 'card'], [1400, 1404, 'jail'], [1386, 1530],
    [1400, 1640, 'card'], [1404, 1736], [1400, 1820], [1400, 1910, 'slide', 61], [1404, 2000, 'card'],
    [1404, 2070], [1400, 2140], [1410, 2220], [1444, 2290, 'move', 3], [1320, 2300],
    [1216, 2314, 'card'], [1150, 2324], [1140, 2250], [1136, 2166, 'card'], [1120, 2104],
    [1106, 2044], [1090, 1976], [1070, 1900, 'card'], [1050, 1830, 'card'], [1030, 1764, 'card'],
    [1010, 1696], [1004, 1624], [998, 1564, 'card'], [984, 1494], [956, 1410, 'card'],
    [946, 1330, 'move', 8], [924, 1244], [910, 1166, 'card'], [904, 1090, 'jail'], [890, 1000, 'card'],
    [874, 880, 'card'], [860, 760], [850, 650, 'move', -13], [830, 560], [820, 460, 'card'],
    [804, 326, 'card'], [670, 336], [554, 350, 'card'], [572, 464, 'move', 9], [620, 614],
    [646, 810, 'card'], [660, 960, 'card'], [660, 1130, 'slide', 100], [666, 1250, 'card'], [666, 1350],
    [660, 1480, 'card'], [660, 1590], [660, 1700, 'jail'], [544, 1690, 'card'], [410, 1680, 'card'],
    [296, 1660], [300, 1550, 'move', 3], [300, 1440, 'card'], [300, 1340], [304, 1240, 'card'],
    [310, 1130], [314, 1020, 'card'], [314, 910, 'card'], [314, 794, 'card'], [320, 690, 'card'],
    [324, 570, 'card'], [336, 450, 'extra', 4], [334, 350, 'jail'], [314, 140, 'finish']
  ];
  var FINISH = BOARD.length - 1;

  var SPOTS = {
    jail: [230, 2090],
    deck: [1780, 1990],
    podium: [[430, 84], [434, 164], [434, 236]],
    lots: [[170, 90], [170, 180], [170, 270]]
  };

  // The original drawing's path is continuous, so no connector arrow.
  var CONNECTOR = '';

  var TEAMS = [
    { emoji: '🐼', color: '#2f3a45', zh: '熊猫队', en: 'Pandas' },
    { emoji: '🐯', color: '#d9661f', zh: '老虎队', en: 'Tigers' },
    { emoji: '🐰', color: '#c2417a', zh: '兔子队', en: 'Rabbits' },
    { emoji: '🐸', color: '#2f8a3e', zh: '青蛙队', en: 'Frogs' },
    { emoji: '🐵', color: '#8a5a2b', zh: '猴子队', en: 'Monkeys' },
    { emoji: '🐧', color: '#2d62b5', zh: '企鹅队', en: 'Penguins' }
  ];
  var MIN_TEAMS = 2;
  var MAX_TEAMS = TEAMS.length;
  var JAIL_TURNS = 2;
  var PODIUM = 3;
  var CARD_TYPES = ['read', 'meaning', 'say', 'sentence'];
  var LIMITS = { title: 120, name: 16, text: 20000, lines: 300, line: 300 };

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
  }

  function clamp(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  // ---------- cards ----------

  // "题目 | 答案" per line → [{ q, a }]
  function parseCards(text) {
    return String(text || '').split(/\r?\n/).slice(0, LIMITS.lines).map(function (line) {
      var bar = line.search(/[|｜]/);
      var q = clean(bar < 0 ? line : line.slice(0, bar), LIMITS.line);
      var a = bar < 0 ? '' : clean(line.slice(bar + 1).replace(/^[|｜]/, ''), LIMITS.line);
      return { label: '', q: q, a: a };
    }).filter(function (card) { return card.q; });
  }

  // Word items ({ zh, py, en }) × chosen question types → cards.
  function wordCards(items, types, zh) {
    var L = function (en, cn) { return zh ? cn : en; };
    var cards = [];
    (items || []).forEach(function (item) {
      var w = clean(item.zh, 40);
      if (!w) return;
      var py = clean(item.py, 80);
      var en = clean(item.en, 120);
      (types || []).forEach(function (type) {
        if (type === 'read') cards.push({ label: L('Read it aloud', '读一读'), q: w, a: py, big: true });
        else if (type === 'meaning' && en) cards.push({ label: L('What does it mean?', '是什么意思？'), q: w, a: en, big: true });
        else if (type === 'say' && en) cards.push({ label: L('Say it in Chinese', '用中文怎么说？'), q: en, a: py ? w + '  ' + py : w });
        else if (type === 'sentence') cards.push({ label: L('Make a sentence', '用这个词说一句话'), q: w, a: '', big: true });
      });
    });
    return cards;
  }

  // ---------- template (teacher's saved setup) ----------

  function normalize(input) {
    var data = input && typeof input === 'object' ? input : {};
    var types = Array.isArray(data.types) ? data.types.filter(function (t, i, all) {
      return CARD_TYPES.indexOf(t) !== -1 && all.indexOf(t) === i;
    }) : [];
    var teams = clamp(data.teams, MIN_TEAMS, MAX_TEAMS, 4);
    var names = (Array.isArray(data.names) ? data.names : []).slice(0, MAX_TEAMS).map(function (name) { return clean(name, LIMITS.name); });
    return {
      title: clean(data.title, LIMITS.title),
      source: data.source === 'words' ? 'words' : 'own',
      cards: clean(data.cards, LIMITS.text),
      words: clean(data.words, LIMITS.text),
      types: types.length ? types : ['read', 'meaning'],
      teams: teams,
      names: names,
      jail: clamp(data.jail, 1, 5, 5)
    };
  }

  // Server-side check for account templates: rejects empty or oversized input.
  function template(input) {
    function fail(message) {
      var error = new Error(message);
      error.status = 400;
      throw error;
    }
    if (!input || typeof input !== 'object') fail('This Escape the Path setup is empty.');
    var data = normalize(input);
    var filled = data.source === 'words' ? /\S/.test(data.words) : parseCards(data.cards).length > 0;
    if (!filled) fail('Add at least one question card before saving.');
    return data;
  }

  // ---------- rules engine ----------
  // State is plain data so the page can redraw from it. Every action returns a
  // list of events the page animates in order.

  function newGame(options) {
    var opts = options || {};
    var count = clamp(opts.teams, MIN_TEAMS, MAX_TEAMS, 4);
    var names = opts.names || [];
    var teams = [];
    for (var i = 0; i < count; i++) {
      teams.push({ id: i, name: clean(names[i], LIMITS.name) || (opts.zh ? TEAMS[i].zh : TEAMS[i].en), pos: 0, jail: 0, jailFrom: -1, skip: false, place: 0 });
    }
    var state = { teams: teams, turn: 0, phase: 'roll', left: 0, total: 0, places: [], jailQuestions: clamp(opts.jail, 1, 5, 5) };
    beginTurn(state, []);
    return state;
  }

  function current(state) { return state.teams[state.turn]; }

  function beginTurn(state, events) {
    var team = current(state);
    if (team.jail) {
      state.phase = 'jail';
    } else if (team.skip) {
      team.skip = false;
      state.phase = 'next';
      events.push({ type: 'skipped', team: team.id });
    } else {
      state.phase = 'roll';
    }
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
      // Whoever is left is ranked by how far along the path they got.
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

  function ask(state, count, kind) {
    state.left = count;
    state.total = count;
    state.phase = kind;
  }

  // Resolve the square a team stands on. A move or slide resolves once; its
  // destination can still be a card, jail, skip, roll-again or the finish.
  function land(state, events, moved) {
    var team = current(state);
    var square = BOARD[team.pos];
    var kind = square[2];
    if (!moved && (kind === 'move' || kind === 'slide')) {
      var to = kind === 'move' ? Math.max(0, Math.min(FINISH, team.pos + square[3])) : square[3];
      events.push({ type: kind, team: team.id, from: team.pos, to: to, steps: square[3] });
      team.pos = to;
      return land(state, events, true);
    }
    if (team.pos === FINISH) return finishTeam(state, team, events);
    if (kind === 'jail') {
      team.jail = JAIL_TURNS;
      team.jailFrom = team.pos;
      state.phase = 'next';
      events.push({ type: 'jail', team: team.id });
    } else if (kind === 'skip') {
      team.skip = true;
      state.phase = 'next';
      events.push({ type: 'skip', team: team.id });
    } else if (kind === 'again') {
      state.phase = 'roll';
      events.push({ type: 'again', team: team.id });
    } else if (kind === 'card' || kind === 'extra') {
      ask(state, kind === 'extra' ? (square[3] || 2) : 1, 'card');
      events.push({ type: 'card', team: team.id, count: state.left });
    } else {
      state.phase = 'next';
      events.push({ type: 'blank', team: team.id });
    }
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

  function release(state, events) {
    var team = current(state);
    team.jail = 0;
    team.pos = Math.min(FINISH, team.jailFrom + 1);
    team.jailFrom = -1;
    events.push({ type: 'released', team: team.id, to: team.pos });
    if (team.pos === FINISH) finishTeam(state, team, events);
    else state.phase = 'next';
  }

  function serve(state, events) {
    var team = current(state);
    team.jail -= 1;
    if (team.jail <= 0) release(state, events);
    else {
      state.phase = 'next';
      events.push({ type: 'wait', team: team.id, left: team.jail });
    }
  }

  // In jail: sit out this turn.
  function wait(state) {
    if (state.phase !== 'jail') return [];
    var events = [];
    serve(state, events);
    return events;
  }

  // Rule 5: answering your way out is not allowed when the square after the
  // jail square is 结束 ("unless if you take a step forward you win").
  function canChallenge(state) {
    var team = current(state);
    return state.phase === 'jail' && team.jailFrom + 1 < FINISH;
  }

  // In jail: try to answer jailQuestions cards in a row.
  function challenge(state) {
    if (!canChallenge(state)) return [];
    ask(state, state.jailQuestions, 'challenge');
    return [{ type: 'challenge', team: current(state).id, count: state.left }];
  }

  function judge(state, correct) {
    var team = current(state);
    var events = [];
    if (state.phase === 'card') {
      if (!correct) {
        var from = team.pos;
        team.pos = Math.max(0, team.pos - 1);
        state.phase = 'next';
        events.push({ type: 'back', team: team.id, from: from, to: team.pos });
      } else if (--state.left > 0) {
        events.push({ type: 'card', team: team.id, count: state.left });
      } else {
        state.phase = 'next';
        events.push({ type: 'stay', team: team.id });
      }
    } else if (state.phase === 'challenge') {
      if (!correct) {
        events.push({ type: 'failed', team: team.id });
        serve(state, events);
      } else if (--state.left > 0) {
        events.push({ type: 'challenge', team: team.id, count: state.left });
      } else {
        release(state, events);
      }
    }
    return events;
  }

  function next(state) {
    if (state.phase !== 'next') return [];
    var events = [];
    var count = state.teams.length;
    for (var i = 1; i <= count; i++) {
      var index = (state.turn + i) % count;
      if (!state.teams[index].place) {
        state.turn = index;
        break;
      }
    }
    return beginTurn(state, events);
  }

  var api = {
    FRAME: FRAME, BOARD: BOARD, FINISH: FINISH, SPOTS: SPOTS, CONNECTOR: CONNECTOR, TEAMS: TEAMS,
    MIN_TEAMS: MIN_TEAMS, MAX_TEAMS: MAX_TEAMS, JAIL_TURNS: JAIL_TURNS, PODIUM: PODIUM, CARD_TYPES: CARD_TYPES, LIMITS: LIMITS,
    parseCards: parseCards, wordCards: wordCards, normalize: normalize, template: template,
    newGame: newGame, current: current, roll: roll, wait: wait, challenge: challenge, canChallenge: canChallenge, judge: judge, next: next
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.EscapePathCore = api;
})(typeof window !== 'undefined' ? window : this);
