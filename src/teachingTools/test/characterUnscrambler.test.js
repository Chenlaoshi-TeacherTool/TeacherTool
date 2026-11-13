'use strict';
var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var source = fs.readFileSync(path.join(__dirname, '../public/low-prep/character-unscrambler/character-unscrambler.js'), 'utf8');
var context = { document: { addEventListener: function () {} } };
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.tool = { hasPractice, puzzleBox, drawPractice }; })();'), context);
var tool = context.tool;

test('practice belongs to the board when selected, otherwise the worksheet, never the answer', function () {
  [false, true].forEach(function (board) {
    var opts = { practice: true, board: board, sheet: true };
    assert.equal(tool.hasPractice('board', opts), board);
    assert.equal(tool.hasPractice('sheet', opts), !board);
    assert.equal(tool.hasPractice('answer', opts), false);
    opts.practice = false;
    assert.equal(tool.hasPractice('board', opts), false);
    assert.equal(tool.hasPractice('sheet', opts), false);
  });
});

test('worksheet and board keep matching puzzle dimensions with practice', function () {
  var opts = { practice: true, board: true, sheet: true };
  var puzzle = { art: { width: 100, height: 200 } };
  assert.deepEqual(tool.puzzleBox(puzzle, 'sheet', opts), tool.puzzleBox(puzzle, 'board', opts));
});

test('practice draws exactly the selected rows for each character within the available height', function () {
  [1, 2, 3].forEach(function (rows) {
    ['爸', '爸爸妈妈中文学校'].forEach(function (text) {
      var models = [];
      var ctx = new Proxy({}, { get: function (_, key) {
        if (key === 'fillText') return function (ch) { models.push(ch); };
        if (key === 'strokeRect') return function (x, y, w, h) { assert.ok(y >= 0 && y + h <= 750.001); };
        return function () {};
      } });
      tool.drawPractice(ctx, Array.from(text), { practiceRows: rows, font: 'serif' }, 0, 0, 1494, 750);
      assert.equal(models.length, text.length * rows);
      Array.from(new Set(text)).forEach(function (ch) {
        assert.equal(models.filter(function (model) { return model === ch; }).length, Array.from(text).filter(function (c) { return c === ch; }).length * rows);
      });
    });
  });
});
