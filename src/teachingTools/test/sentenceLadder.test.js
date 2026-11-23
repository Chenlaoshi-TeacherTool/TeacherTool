'use strict';

const test = require('node:test');
const assert = require('node:assert');
const registry = require('../services/gameShareRegistry');
const community = require('../services/community');
const Core = require('../public/low-prep/sentence-ladder/ladder-core');
const Themes = require('../public/low-prep/sentence-ladder/ladder-themes');
const table = require('../public/low-prep/sentence-ladder/zh-convert.json');

const adapter = registry.get('sentence-ladder', 1);

function row(model, k) {
  return Core.rowParts(model, k).map((part) => (part.blank ? '__' : part.seg.t)).join('') + Core.rowEnding(model, k);
}

test('Sentence Ladder is a members-only link that collects work and can be saved as a template', () => {
  assert.ok(adapter && adapter.collectsWork && adapter.membersOnly);
  assert.equal(adapter.view, 'game-share/sentence-ladder-player');
  assert.ok(community.GAME_TYPES['sentence-ladder'].templateEditor);
});

test('every built-in theme is a valid ladder in both versions', () => {
  assert.equal(Themes.THEMES.length, 9);
  Themes.THEMES.forEach((theme) => {
    ['basic', 'native'].forEach((version) => {
      const model = adapter.sanitize(Themes.build(theme.id, version));
      assert.equal(model.rows.length, version === 'basic' ? 4 : 6, theme.id + ' ' + version);
      assert.ok(model.scene.items.length > 0);
      for (let k = 0; k < model.rows.length; k += 1) {
        assert.ok(Core.rowParts(model, k).some((part) => part.isNew), theme.id + ' row ' + k + ' adds something');
      }
      Core.answerSlots(model, 'basic').forEach((index) => {
        assert.ok(model.segs[index].opts.length || model.segs[index].row > 0 || version === 'native', theme.id + ' needs distractors');
      });
    });
  });
});

test('rows grow and blanks turn into text after their blank rows', () => {
  const model = Core.sanitize(Themes.build('apple', 'native'));
  assert.equal(row(model, 0), '__苹果。');
  assert.equal(row(model, 1), '桌子上放着__苹果。');
  assert.equal(row(model, 3), '桌子上放着一堆__苹果，远远看去，像一个个__。');
  assert.match(row(model, 5), /像一个个小灯笼。/);
  assert.equal(Core.rowEnding(Core.sanitize(Themes.build('kitten', 'native')), 4), '');
});

test('levels choose how many rows show and what the word box holds', () => {
  const model = Core.sanitize(Object.assign(Themes.build('apple', 'native'), { level: 'basic' }));
  assert.equal(Core.rowCount(model), 4);
  assert.equal(Core.rowCount(model, 'mid'), 5);
  assert.equal(Core.rowCount(model, 'native'), 6);
  assert.equal(Core.rowCount(Object.assign({}, model, { shown: 2 })), 2);
  const box = Core.wordBox(model, 0, 'basic');
  assert.deepEqual(box[0].words.slice().sort(), ['一只', '一堆', '一本'].sort());
  assert.deepEqual(Core.wordBox(model, 0, 'mid')[0].words, ['一堆']);
  assert.deepEqual(Core.wordBox(model, 0, 'native'), []);
  assert.deepEqual(Core.choicesFor(model.segs[1], 1), Core.choicesFor(model.segs[1], 1), 'choice order is stable');
});

test('the sanitizer keeps Chinese punctuation and drops junk', () => {
  const model = adapter.sanitize({
    topic: '苹果', rows: [{ label: '加量词' }], level: 'nope', script: 't', image: 'javascript:alert(1)',
    scene: { layout: 'pile', bg: 'mars', items: ['1F34E', '<b>'] },
    segs: [{ t: '一个，', row: 7, blank: 99, opts: ['一只', '', 'a', 'b', 'c'] }, { t: '   ' }], junk: 1
  });
  assert.equal(model.segs.length, 1);
  assert.equal(model.segs[0].t, '一个，');
  assert.equal(model.segs[0].row, 0);
  assert.equal(model.segs[0].blank, Core.ALWAYS);
  assert.equal(model.segs[0].opts.length, 3);
  assert.equal(model.level, 'native');
  assert.equal(model.script, 't');
  assert.equal(model.image, '');
  assert.deepEqual(model.scene, { layout: 'pile', bg: 'plain', items: ['1F34E'] });
  assert.equal(model.junk, undefined);
  assert.throws(() => adapter.sanitize({ rows: [{ label: '加量词' }], segs: [{ t: '苹果' }] }), { status: 400 });
  assert.throws(() => adapter.sanitize({ rows: [], segs: [] }), { status: 400 });
});

test('student work: beginner choices are checked, free writing is kept as written', () => {
  const basic = adapter.sanitize(Object.assign(Themes.build('apple', 'basic'), { level: 'basic' }));
  const slots = Core.answerSlots(basic);
  const answers = {};
  slots.forEach((index) => { answers[index] = basic.segs[index].t; });
  answers[slots[0]] = '一只';
  const work = adapter.cleanWork(basic, { answers: Object.assign({ 999: 'x' }, answers) });
  assert.equal(work.total, slots.length);
  assert.equal(work.score, slots.length - 1);
  assert.equal(work.correct[slots[0]], false);
  assert.equal(work.answers[999], undefined);
  assert.throws(() => adapter.cleanWork(basic, { answers: {} }), { status: 400 });

  const native = adapter.sanitize(Themes.build('apple', 'native'));
  const free = adapter.cleanWork(native, { answers: { 1: '一大筐' } });
  assert.equal(free.answers[1], '一大筐');
  assert.equal(free.correct, undefined);
});

test('simplified to traditional keeps length and fixes common one-to-many words', () => {
  Core.useTable(table);
  assert.equal(Core.toTraditional('我的头发和面条'), '我的頭髮和麵條');
  assert.equal(Core.toTraditional('两只喜鹊在树上，以后再说'), '兩隻喜鵲在樹上，以後再說');
  assert.equal(Core.toTraditional('里面很干净'), '裡面很乾淨');
  const sentence = Themes.THEMES.map((theme) => Themes.build(theme.id, 'native').segs.map((seg) => seg.t).join('')).join('');
  assert.equal(Array.from(Core.toTraditional(sentence)).length, Array.from(sentence).length);
  assert.equal(Core.toSimplified('蘋果書包'), '苹果书包');
});
