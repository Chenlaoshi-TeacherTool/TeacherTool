'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var game = require('../public/low-prep/witchs-poison/witchs-poison');

test('ignores empty lines and rotates cards through the groups', function () {
  assert.deepEqual(game.parseCards(' 苹果 \r\n\r\n香蕉\n  我喜欢中文。  '), [
    '苹果',
    '香蕉',
    '我喜欢中文。'
  ]);
  assert.deepEqual([0, 1, 2, 3].map(function (index) {
    return game.getTurn(index, 3).groupNumber;
  }), [1, 2, 3, 1]);
});

test('sizes short words and long sentences for the card grid', function () {
  assert.equal(game.getTextClass('风'), 'is-single');
  assert.equal(game.getTextClass('苹果'), '');
  assert.equal(game.getTextClass('我喜欢在学校和朋友一起学习中文。'), 'is-long');
});

test('requires enough cards for each group to place poison', function () {
  assert.equal(game.canPlacePoisons(10, 5, 2), true);
  assert.equal(game.canPlacePoisons(9, 5, 2), false);
});

test('saves named card sets in browser storage', function () {
  var values = {};
  var storage = {
    getItem: function (key) { return values[key] || null; },
    setItem: function (key, value) { values[key] = value; }
  };

  assert.equal(game.saveCardSet(storage, '', '苹果'), null);
  assert.equal(game.saveCardSet(storage, 'Unit 1', '   '), null);
  assert.deepEqual(game.saveCardSet(storage, 'Unit 1', '苹果\n香蕉'), {
    name: 'Unit 1',
    text: '苹果\n香蕉'
  });
  game.saveCardSet(storage, 'Unit 1', '山\n水');
  assert.deepEqual(game.getSavedCardSets(storage), [{ name: 'Unit 1', text: '山\n水' }]);
});
