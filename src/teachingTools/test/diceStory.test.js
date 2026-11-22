'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/dice-story/dice-story-core');
const registry = require('../services/gameShareRegistry');
const community = require('../services/community');

test('every built-in Dice Story template passes the account sanitizer', () => {
  core.PRESETS.forEach((preset) => {
    const data = core.template(preset.data);
    assert.equal(data.layout, preset.layout);
    data.cells.forEach((row) => assert.equal(row.length, core.FACES));
  });
});

test('empty templates are rejected and uploaded pictures stay out of the account copy', () => {
  assert.throws(() => core.template({}), { status: 400 });
  assert.throws(() => core.template(core.blankData('story')), { status: 400 });
  const data = core.template({ layout: 'table', categories: ['动物'], cells: [['猫']], pics: { 猫: 'upload', 狗: '1f415', 鱼: '<b>' } });
  assert.deepEqual(data.pics, { 狗: '1F415' });
});

test('normalize clamps layout limits and cleans text', () => {
  const many = Array.from({ length: 12 }, (_, i) => 'c' + i);
  assert.equal(core.normalize({ layout: 'story', categories: many }).categories.length, core.MAX_CATEGORIES.story);
  assert.equal(core.normalize({ layout: 'table', categories: many }).categories.length, core.MAX_CATEGORIES.table);
  const data = core.normalize({ prompt: 'a\nb\nc\nd', title: 'x'.repeat(200), options: { picMode: 'bogus', orient: 'portrait' } });
  assert.equal(data.prompt.split('\n').length, 3);
  assert.equal(data.title.length, core.LIMITS.title);
  assert.equal(data.options.picMode, 'both');
  assert.equal(data.options.orient, 'portrait');
  assert.deepEqual(core.splitCell('长大|zhǎng dà'), { text: '长大', py: 'zhǎng dà' });
});

test('Dice Story is registered as a template-only tool', () => {
  const adapter = registry.get('dice-story', 1);
  assert.ok(adapter && adapter.templateOnly);
  assert.ok(community.GAME_TYPES['dice-story'].templateEditor);
});
