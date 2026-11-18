(function (root) {
  'use strict';
  function parse(text) {
    var seen = new Set();
    return text.split(/\r?\n/).map(function (line) {
      var cells = line.split(/\t|\|/).map(function (s) { return s.trim(); });
      return { term: cells[0], py: cells[1] || '', en: cells.slice(2).join(' | ') };
    }).filter(function (word) {
      if (!word.term || seen.has(word.term)) return false;
      seen.add(word.term); return true;
    });
  }
  function template(data) {
    function fail(message) {
      var error = new Error(message);
      error.status = 400;
      throw error;
    }
    function clean(value, limit, separators) {
      if (typeof value !== 'string' || value.length > limit || separators.test(value)) fail('A template field is too long or contains an unsupported separator.');
      return value.trim();
    }
    function number(value, max, message) {
      if (!Number.isInteger(value) || value < 1 || value > max) fail(message);
      return value;
    }
    if (!Array.isArray(data?.words) || !data.words.length || data.words.length > 300) fail('A vocabulary template needs 1–300 words.');
    if (!['class', 'teams'].includes(data.mode) || !['cards', 'manual', 'timer'].includes(data.ending)) fail('Choose a valid game mode and ending.');
    var words = data.words.map(function (word) {
      var term = clean(word?.term, 120, /[\t\r\n|]/);
      if (!term) fail('Every vocabulary card needs a word.');
      return { term: term, py: clean(word.py, 120, /[\t\r\n|]/), en: clean(word.en, 240, /[\t\r\n]/) };
    });
    if (new Set(words.map(function (word) { return word.term; })).size !== words.length) fail('Vocabulary cards must have different words.');
    var result = {
      words: words,
      mode: data.mode,
      nameA: clean(data.nameA, 30, /[\r\n]/),
      nameB: clean(data.nameB, 30, /[\r\n]/),
      random: data.random === true,
      fixed: number(data.fixed, 100, 'Enter fixed points from 1 to 100.'),
      ending: data.ending,
      duration: number(data.duration, 60, 'Enter a duration from 1 to 60 minutes.'),
      showPy: data.showPy === true,
      showEn: data.showEn === true
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024) fail('This vocabulary template is too large.');
    return result;
  }
  function create(words, teams, fixed, random, rng, ending) {
    rng = rng || Math.random;
    ending = ending || 'cards';
    var pool = words.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var temp = pool[i]; pool[i] = pool[j]; pool[j] = temp;
    }
    var game = { pool: pool, scores: [0, 0], turn: 0, current: null, history: [], phase: 'ready' };
    game.draw = function () {
      if (game.phase !== 'ready' || !pool.length) return false;
      game.current = { word: pool.pop(), points: random ? [5,10,15,20][Math.floor(rng() * 4)] : fixed };
      game.phase = 'closed'; return true;
    };
    game.open = function () { if (game.phase === 'closed') game.phase = 'answer'; };
    game.answer = function (correct, recipient) {
      if (game.phase !== 'answer') return false;
      recipient = recipient === undefined ? game.turn : recipient;
      if (correct && (!Number.isInteger(recipient) || recipient < 0 || recipient > (teams ? 1 : 0))) return false;
      game.history.push({ current: game.current, turn: game.turn, scores: game.scores.slice(), pool: pool.slice() });
      if (correct) game.scores[recipient] += game.current.points;
      game.turn = teams ? 1 - game.turn : 0; game.current = null;
      if (!pool.length && ending !== 'cards') {
        pool.push.apply(pool, words);
        for (var k = pool.length - 1; k > 0; k--) {
          var index = Math.floor(rng() * (k + 1));
          var word = pool[k]; pool[k] = pool[index]; pool[index] = word;
        }
      }
      game.phase = pool.length ? 'ready' : 'done'; return true;
    };
    game.end = function () {
      if (game.phase === 'done') return false;
      game.current = null; game.phase = 'done'; game.history.length = 0; return true;
    };
    game.undo = function () {
      if (!['ready','done'].includes(game.phase) || !game.history.length) return false;
      var last = game.history.pop(); game.current = last.current; game.turn = last.turn;
      game.scores = last.scores; pool.splice(0, pool.length); pool.push.apply(pool, last.pool); game.phase = 'answer'; return true;
    };
    return game;
  }
  var api = { parse: parse, create: create, template: template };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GachaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
