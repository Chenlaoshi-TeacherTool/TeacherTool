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
