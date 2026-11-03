'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var registry = require('../services/gameShareRegistry');

var adapter = registry.get('measure-words', 1);

test('measure-words adapter is registered', function () {
  assert.ok(adapter);
  assert.equal(adapter.view, 'game-share/measure-words-player');
});

test('measure-words sanitize keeps valid words and drops bad ones', function () {
  var data = adapter.sanitize({
    title: '量词',
    mws: ['张', '把', '张', 'x'],
    items: [
      { noun: '桌子', mw: '张', emoji: '', kind: 'big' },
      { noun: '椅子', mw: '把', alt: ['张'], emoji: '🪑', kind: 'nope', challenge: 1 },
      { noun: 'chair', mw: '把' },
      { noun: '书', mw: '本' }
    ],
    sentences: [{ before: '教室里有二十', answer: '张', after: '桌子。' }, { before: 'a', answer: '本', after: 'b' }],
    options: { duration: 999, rounds: 15, pinyin: false }
  });
  assert.deepEqual(data.mws, ['张', '把']);
  assert.deepEqual(data.items.map(function (it) { return it.noun; }), ['桌子', '椅子']);
  assert.equal(data.items[1].kind, 'thing');
  assert.equal(data.items[1].challenge, true);
  assert.deepEqual(data.items[1].alt, ['张']);
  assert.equal(data.sentences.length, 1);
  assert.equal(data.options.duration, 60);
  assert.equal(data.options.rounds, 15);
  assert.equal(data.options.pinyin, false);
});

test('measure-words sanitize rejects empty games', function () {
  assert.throws(function () { adapter.sanitize({ mws: ['张'], items: [] }); }, /at least 2/);
  assert.throws(function () { adapter.sanitize({ mws: ['张', '把'], items: [] }); }, /words or sentences/);
});
