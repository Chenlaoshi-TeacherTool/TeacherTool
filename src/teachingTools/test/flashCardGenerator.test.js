'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var core = require('../public/low-prep/flash-card-generator/flash-card-core');

test('parses Chinese terms, common separators, manual pinyin, and removes duplicates', function () {
  var entries = core.parseEntries([
    '1. 苹果',
    '香蕉、草莓，西瓜',
    '银行 | yín háng',
    '苹果'
  ].join('\n'), function (word) { return 'auto-' + word; }, function (word) { return 'english-' + word; });

  assert.deepEqual(entries, [
    { zh: '苹果', py: 'auto-苹果', en: 'english-苹果' },
    { zh: '香蕉', py: 'auto-香蕉', en: 'english-香蕉' },
    { zh: '草莓', py: 'auto-草莓', en: 'english-草莓' },
    { zh: '西瓜', py: 'auto-西瓜', en: 'english-西瓜' },
    { zh: '银行', py: 'yín háng', en: 'english-银行' }
  ]);
});

test('preserves manually supplied pinyin and English', function () {
  var entries = core.parseEntries('苹果 | píng guǒ | apple', function () { return 'auto'; }, function () { return 'automatic English'; });
  assert.deepEqual(entries, [{ zh: '苹果', py: 'píng guǒ', en: 'apple' }]);
});

test('mirrors every two-card row for long-edge duplex printing', function () {
  var entries = Array.from({ length: 8 }, function (_, index) { return { zh: String(index + 1) }; });
  assert.deepEqual(core.mirrorBackSlots(entries).map(function (item) { return item.zh; }), [
    '2', '1', '4', '3', '6', '5', '8', '7'
  ]);
});

test('preserves empty physical slots on the mirrored final sheet', function () {
  var slots = core.mirrorBackSlots([{ zh: 'only card' }]);
  assert.equal(slots[0], null);
  assert.equal(slots[1].zh, 'only card');
  assert.equal(slots.length, 8);
});

test('paginates vocabulary into groups of eight', function () {
  var entries = Array.from({ length: 17 }, function (_, index) { return { zh: String(index) }; });
  assert.deepEqual(core.paginate(entries).map(function (page) { return page.length; }), [8, 8, 1]);
});

test('scales Chinese text by character count and wraps long sentences', function () {
  var single = core.layoutChinese('山');
  var word = core.layoutChinese('苹果');
  var phrase = core.layoutChinese('我们一起认真学习中文');
  var sentence = core.layoutChinese('今天下午我们一起去图书馆看书然后回家吃饭');

  assert.equal(single.size, 96);
  assert.ok(single.size > word.size);
  assert.equal(word.lines.length, 1);
  assert.equal(phrase.lines.length, 2);
  assert.equal(phrase.lines.join(''), '我们一起认真学习中文');
  assert.equal(sentence.lines.length, 3);
  assert.equal(sentence.lines.join(''), '今天下午我们一起去图书馆看书然后回家吃饭');
});

test('limits very long Chinese text to four lines with an ellipsis', function () {
  var layout = core.layoutChinese('学'.repeat(60));
  assert.equal(layout.lines.length, 4);
  assert.equal(layout.lines.join('').length, 48);
  assert.ok(layout.lines[3].endsWith('…'));
  assert.equal(layout.truncated, true);
});
