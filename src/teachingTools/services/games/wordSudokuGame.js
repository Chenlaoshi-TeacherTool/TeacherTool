'use strict';

var TYPE = 'word-sudoku';
var VERSION = 1;

function fail(message) {
  var error = new Error(message);
  error.status = 400;
  throw error;
}

function cleanText(value, label, maxLength, required) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) fail(label + ' is required.');
  if (text.length > maxLength) fail(label + ' is too long.');
  return text;
}

function cleanBoard(value, label, allowZero) {
  if (!Array.isArray(value) || value.length !== 81) {
    fail(label + ' must contain exactly 81 cells.');
  }
  return value.map(function (cell) {
    if (!Number.isInteger(cell) || cell < (allowZero ? 0 : 1) || cell > 9) {
      fail(label + ' contains an invalid cell.');
    }
    return cell;
  });
}

function validSolution(board) {
  function complete(values) {
    return values.slice().sort().join('') === '123456789';
  }
  for (var index = 0; index < 9; index += 1) {
    var row = board.slice(index * 9, index * 9 + 9);
    var column = board.filter(function (_, cellIndex) { return cellIndex % 9 === index; });
    if (!complete(row) || !complete(column)) return false;
  }
  for (var boxRow = 0; boxRow < 3; boxRow += 1) {
    for (var boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      var box = [];
      for (var rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (var columnOffset = 0; columnOffset < 3; columnOffset += 1) {
          box.push(board[(boxRow * 3 + rowOffset) * 9 + boxColumn * 3 + columnOffset]);
        }
      }
      if (!complete(box)) return false;
    }
  }
  return true;
}

function sanitize(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('Game data is required.');
  }
  if (!Array.isArray(payload.items) || payload.items.length !== 9) {
    fail('Word Sudoku requires exactly 9 words.');
  }

  var items = payload.items.map(function (item, index) {
    if (!item || typeof item !== 'object') fail('Word ' + (index + 1) + ' is invalid.');
    return {
      word: cleanText(item.word, 'Word ' + (index + 1), 30, true),
      icon: cleanText(item.icon, 'Icon ' + (index + 1), 32, false)
    };
  });
  var uniqueWords = new Set(items.map(function (item) { return item.word.toLocaleLowerCase(); }));
  if (uniqueWords.size !== 9) fail('All 9 words must be different.');

  var solution = cleanBoard(payload.solution, 'Solution', false);
  var puzzle = cleanBoard(payload.puzzle, 'Puzzle', true);
  if (!validSolution(solution)) fail('The Sudoku solution is invalid.');
  puzzle.forEach(function (cell, index) {
    if (cell && cell !== solution[index]) fail('The puzzle does not match its solution.');
  });
  var clueCount = puzzle.filter(Boolean).length;
  if (clueCount < 17 || clueCount > 80) fail('The puzzle must contain between 17 and 80 clues.');

  var level = ['easy', 'medium', 'hard'].indexOf(payload.level) === -1 ? 'medium' : payload.level;
  var seed = Number.isInteger(payload.seed) && payload.seed >= 0 && payload.seed <= 0xffffffff
    ? payload.seed
    : 0;

  return {
    title: cleanText(payload.title, 'Game title', 120, false) || 'Word Sudoku',
    items: items,
    level: level,
    seed: seed,
    puzzle: puzzle,
    solution: solution,
    clueCount: clueCount
  };
}

module.exports = {
  type: TYPE,
  version: VERSION,
  view: 'game-share/word-sudoku-player',
  sanitize: sanitize
};
