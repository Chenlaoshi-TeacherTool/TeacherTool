'use strict';
var assert = require('node:assert/strict');
var test = require('node:test');
var model = require('../public/teaching-tools/quiz-city/print-model');
function questions(count) { return Array.from({ length: count }, function(unused, index) { return { prompt: 'Question ' + (index + 1), answer: 'Answer ' + (index + 1), options: [] }; }); }
test('print boards repeat short banks without changing original questions', function() {
  var source = questions(3); var original = JSON.stringify(source); var boards = model.boards(source);
  assert.equal(boards.length, 1); assert.equal(boards[0].length, 24);
  assert.equal(boards[0][23].questionNumber, 3); assert.equal(JSON.stringify(source), original);
  assert.deepEqual(model.boards([]), []);
});
test('banks over 24 preserve every question across extra boards and wrap the remainder explicitly', function() {
  [24, 25, 48, 49].forEach(function(count) {
    var boards = model.boards(questions(count)); assert.equal(boards.length, Math.ceil(count / 24));
    var numbers = boards.flat().map(function(item) { return item.questionNumber; });
    assert.equal(new Set(numbers).size, count); assert.ok(numbers.every(function(number) { return number >= 1 && number <= count; }));
  });
  assert.equal(model.boards(questions(25))[1][0].questionNumber, 25);
  assert.equal(model.boards(questions(25))[1][1].questionNumber, 1);
});
test('paper dimensions use a 10mm margin and ring covers 24 unique perimeter positions', function() {
  assert.deepEqual(model.paper('a4'), { width: 277, height: 190, name: 'A4' });
  assert.deepEqual(model.paper('letter'), { width: 259.4, height: 195.9, name: 'Letter' });
  var positions = Array.from({ length: 24 }, function(unused, index) { return model.position(index); });
  assert.equal(new Set(positions.map(String)).size, 24);
  assert.ok(positions.every(function(place) { return place[0] === 1 || place[0] === 8 || place[1] === 1 || place[1] === 6; }));
});
