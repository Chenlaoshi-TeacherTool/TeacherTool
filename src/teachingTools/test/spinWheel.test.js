'use strict';

const test = require('node:test');
const assert = require('node:assert');
const registry = require('../services/gameShareRegistry');
const community = require('../services/community');

const adapter = registry.get('spin-wheel', 1);

test('Spin Wheel Craft is registered as a template-only tool', () => {
  assert.ok(adapter && adapter.templateOnly);
  assert.ok(community.GAME_TYPES['spin-wheel'].templateEditor);
});

test('the spin wheel template keeps known settings and cleans the rest', () => {
  const data = adapter.sanitize({
    title: '水果', heading: '我喜欢吃……', mode: 'word', words: '苹果\r\n香蕉', sentences: '我喜欢吃____。',
    sectors: 40, picOff: { 香蕉: true, bad: 'yes' }, picPick: { 苹果: '1f34e', 梨: '<script>' },
    options: { write: 'trace', lang: 'xx', color: 'bw', pinyin: false, extra: 1 }, junk: 'x'
  });
  assert.equal(data.words, '苹果\n香蕉');
  assert.equal(data.sectors, 6);
  assert.deepEqual(data.picOff, { 香蕉: true });
  assert.deepEqual(data.picPick, { 苹果: '1F34E' });
  assert.equal(data.options.write, 'trace');
  assert.equal(data.options.lang, 'en');
  assert.equal(data.options.color, 'bw');
  assert.equal(data.options.pinyin, false);
  assert.equal(data.options.extra, undefined);
  assert.equal(data.junk, undefined);
});

test('an empty spin wheel cannot be saved', () => {
  assert.throws(() => adapter.sanitize({ mode: 'word', words: '  ' }), { status: 400 });
  assert.throws(() => adapter.sanitize({ mode: 'hanzi', words: '苹果', parts: '' }), { status: 400 });
  assert.equal(adapter.sanitize({ mode: 'hanzi', parts: '口 | 叶' }).mode, 'hanzi');
});
