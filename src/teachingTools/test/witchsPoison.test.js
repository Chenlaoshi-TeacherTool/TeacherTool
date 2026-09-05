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

test('sizes cards by text length across tiers', function () {
  assert.equal(game.getTextClass('风'), 'is-xshort');                 // 1 char
  assert.equal(game.getTextClass('苹果'), 'is-short');                // 2–4 chars
  assert.equal(game.getTextClass('我喜欢中文'), '');                  // 5–8 chars (base)
  assert.equal(game.getTextClass('我今天很开心去上学'), 'is-long');   // 9–14 chars
  assert.equal(game.getTextClass('我喜欢在学校和朋友一起学习中文。'), 'is-xlong'); // 15+ chars
  assert.equal(game.getTextClass('  水  '), 'is-xshort');            // trims whitespace
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

test('keeps only the last poison/antidote setting for a card', function () {
  var poison = new Set();
  var antidote = new Set();
  // Group 1 poisons card 1.
  game.applyCardSetting(poison, antidote, 1, 'poison');
  assert.equal(poison.has(1), true);
  // Group 2 puts an antidote on the same card -> no longer poison.
  game.applyCardSetting(poison, antidote, 1, 'antidote');
  assert.equal(poison.has(1), false);
  assert.equal(antidote.has(1), true);
  // Group 3 poisons it again -> poison wins, antidote cleared.
  game.applyCardSetting(poison, antidote, 1, 'poison');
  assert.equal(poison.has(1), true);
  assert.equal(antidote.has(1), false);
});

test('builds a fresh group roster with an antidote and poison tally', function () {
  assert.deepEqual(game.makeGroups(2), [
    { antidotes: 0, poisonCount: 0 },
    { antidotes: 0, poisonCount: 0 }
  ]);
});

test('the game only ends once every card is flipped', function () {
  var groups = game.makeGroups(3);
  groups[0].poisonCount = 1;
  assert.equal(game.isGameOver(groups, 5, 12), false); // poisoned groups keep playing
  assert.equal(game.isGameOver(groups, 12, 12), true);
});

test('a cured group (no active poison) counts as a winner', function () {
  // Group 1 was poisoned twice but cleared both; Group 2 still has one ☠️.
  var result = game.getWinners([
    { poisonCount: 0 }, { poisonCount: 1 }, { poisonCount: 0 }
  ]);
  assert.deepEqual(result.winners, [1, 3]);
  assert.equal(result.minCount, 0);
});

test('turns rotate through every group, poisoned or not', function () {
  assert.equal(game.nextGroup(1, 3), 2);
  assert.equal(game.nextGroup(3, 3), 1); // wraps around
  assert.equal(game.nextGroup(1, 1), 1);
});

test('winners are the groups poisoned the fewest times', function () {
  var fewest = game.getWinners([
    { poisonCount: 2 }, { poisonCount: 0 }, { poisonCount: 3 }
  ]);
  assert.deepEqual(fewest.winners, [2]);
  assert.equal(fewest.minCount, 0);

  var tie = game.getWinners([
    { poisonCount: 1 }, { poisonCount: 1 }, { poisonCount: 4 }
  ]);
  assert.deepEqual(tie.winners, [1, 2]);
  assert.equal(tie.minCount, 1);
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
