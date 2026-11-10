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
  function create(words, teams, fixed, random, rng) {
    rng = rng || Math.random;
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
    game.answer = function (correct) {
      if (game.phase !== 'answer') return false;
      game.history.push({ current: game.current, turn: game.turn, scores: game.scores.slice() });
      if (correct) game.scores[game.turn] += game.current.points;
      game.turn = teams ? 1 - game.turn : 0; game.current = null;
      game.phase = pool.length ? 'ready' : 'done'; return true;
    };
    game.undo = function () {
      if (!['ready','done'].includes(game.phase) || !game.history.length) return false;
      var last = game.history.pop(); game.current = last.current; game.turn = last.turn;
      game.scores = last.scores; game.phase = 'answer'; return true;
    };
    return game;
  }
  var api = { parse: parse, create: create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GachaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
