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

test('counts poison and antidote cards when checking capacity', function () {
  // 4 groups, 1 poison + 1 antidote each = 8 cards needed.
  assert.equal(game.canPlaceCards(8, 4, 1, 1), true);
  assert.equal(game.canPlaceCards(7, 4, 1, 1), false);
  // Antidotes off falls back to poison-only capacity.
  assert.equal(game.canPlaceCards(4, 4, 1, 0), true);
});

test('builds a fresh group roster', function () {
  assert.deepEqual(game.makeGroups(2), [
    { poisoned: false, antidotes: 0 },
    { poisoned: false, antidotes: 0 }
  ]);
});

test('counts un-poisoned groups and pending recoveries', function () {
  var groups = [
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 0 },
    { poisoned: true, antidotes: 1 }
  ];
  assert.equal(game.getAliveCount(groups), 1);
  assert.equal(game.canStillRecover(groups), true);
});

test('ends when only one group survives, unless an antidote can still save someone', function () {
  var total = 12;
  // Two groups alive -> keep playing.
  assert.equal(game.isGameOver([
    { poisoned: false, antidotes: 0 },
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 0 }
  ], 5, total), false);
  // One group alive, nobody can recover -> game over.
  assert.equal(game.isGameOver([
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 0 },
    { poisoned: true, antidotes: 0 }
  ], 5, total), true);
  // One group alive, but a poisoned team still holds an antidote -> wait.
  assert.equal(game.isGameOver([
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 1 },
    { poisoned: true, antidotes: 0 }
  ], 5, total), false);
  // All cards flipped always ends the game.
  assert.equal(game.isGameOver([
    { poisoned: false, antidotes: 0 },
    { poisoned: false, antidotes: 0 }
  ], total, total), true);
});

test('skips poisoned groups when choosing the next turn', function () {
  var groups = [
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 0 },
    { poisoned: false, antidotes: 0 }
  ];
  assert.equal(game.nextActiveGroup(1, groups), 3);
  assert.equal(game.nextActiveGroup(3, groups), 1);
  // Everyone else poisoned -> stay put.
  assert.equal(game.nextActiveGroup(1, [
    { poisoned: false, antidotes: 0 },
    { poisoned: true, antidotes: 0 }
  ]), 1);
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
