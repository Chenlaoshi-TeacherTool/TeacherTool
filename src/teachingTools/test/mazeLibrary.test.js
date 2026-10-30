'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var core = require('../public/shared/library-v2');
var adapter = require('../public/low-prep/maze-generator/maze-library');

async function bank(extra) {
  return (await core.preview(JSON.stringify({ id: 'bank', name: 'Math', questions: Array.from({ length: 12 }, function (unused, index) {
    return { id: 'q' + index, prompt: 'Question ' + index, answer: 'Answer ' + index };
  }).concat(extra || []) }))).data.collections[0];
}

test('selects eight distinct complete questions and retains source references without mutation', async function () {
  var collection = await bank();
  var before = JSON.stringify(collection);
  var result = adapter.selectQuestions(collection);
  assert.equal(result.pairs.length, 8);
  assert.equal(new Set(result.pairs.map(function (pair) { return pair.answer; })).size, 8);
  result.sourceRefs.forEach(function (ref, index) {
    assert.equal(ref.collectionId, collection.id);
    assert.equal(collection.items.find(function (item) { return item.id === ref.itemId; }).prompt, result.pairs[index].question);
  });
  assert.equal(JSON.stringify(collection), before);
});

test('uses explicit correct-option references and resolves letter answers by label', async function () {
  var collection = await bank();
  collection.items = collection.items.slice(0, 8);
  collection.items.forEach(function (item, index) {
    item.answer = 'B';
    item.options = [{ id: item.id + '_yes', label: 'B', text: 'Correct ' + index }, { id: item.id + '_no', label: 'A', text: 'Wrong ' + index }];
    item.correctOptionId = index % 2 ? null : item.options[0].id;
  });
  var result = adapter.selectQuestions(collection);
  assert(result.pairs.every(function (pair) { return pair.answer.startsWith('Correct '); }));
});

test('excludes ambiguous, empty, overlong, delimiter-containing and duplicate answers without truncation', async function () {
  var collection = await bank([
    { prompt: '', answer: 'missing' }, { prompt: 'Long answer', answer: 'x'.repeat(29) },
    { prompt: 'x'.repeat(121), answer: 'long prompt' }, { prompt: 'Pipe | breaks parser', answer: 'pipe' },
    { prompt: 'Line\nbreak', answer: 'newline' }, { prompt: 'Arrow', answer: 'left=>right' },
    { prompt: 'Missing option', answer: 'D', options: ['yes'] }, { prompt: 'Duplicate answer', answer: 'Answer 0' }
  ]);
  var result = adapter.selectQuestions(collection);
  assert.equal(result.skipped, 8);
  assert(result.pairs.every(function (pair) { return pair.question.length <= 120 && pair.answer.length <= 28; }));
});

test('rejects insufficient distinct answers and non-question collections', async function () {
  var collection = await bank();
  collection.items.forEach(function (item) { item.answer = 'same'; });
  assert.throws(function () { adapter.selectQuestions(collection); }, /only 1 usable/);
  collection.items = [];
  assert.throws(function () { adapter.selectQuestions(collection); }, /only 0 usable/);
  assert.throws(function () { adapter.selectQuestions({ kind: 'vocabulary', items: [] }); }, /Choose a personal/);
});
