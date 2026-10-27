'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var vm = require('node:vm');
function harness(fetchImpl) {
  var source = fs.readFileSync(require.resolve('../public/low-prep/tarsia-puzzle/tarsia-puzzle.js'), 'utf8');
  source = source.replace('  initialize();', `
    markDirty = function () {};
    renderPairEditor = function () {};
    saveDraft = function () {};
    globalThis.subject = { state: state, elements: elements, fill: fillTranslatedPairs };
  `);
  var context = { fetch: fetchImpl };
  vm.runInNewContext(source, context);
  var subject = context.subject;
  subject.elements.translationStatus = { dataset: { loading: 'loading', failed: 'failed', ready: 'ready' } };
  subject.elements.vocabularyInput = { value: '苹果' };
  return subject;
}
test('fills all five languages and keeps manual edits while translation is pending', async function () {
  for (var lang of ['th', 'vi', 'es', 'fr', 'ru']) {
    var resolve;
    var subject = harness(function (url, options) {
      assert.equal(url, '/api/translate-words');
      assert.deepEqual(JSON.parse(options.body), { words: ['苹果'], to: [lang] });
      return new Promise(function (done) { resolve = done; });
    });
    subject.state.sideTypes = ['chinese', lang];
    subject.state.pairs = [{ a: '苹果', b: '' }];
    var pending = subject.fill([{ source: '苹果' }]);
    resolve({ ok: true, json: async function () { return { translations: { 苹果: { [lang]: 'translated' } } }; } });
    await pending;
    assert.equal(subject.state.pairs[0].b, 'translated');
    pending = subject.fill([{ source: '苹果' }]);
    subject.state.pairs[0].b = 'manual';
    resolve({ ok: true, json: async function () { return { translations: { 苹果: { [lang]: 'replacement' } } }; } });
    await pending;
    assert.equal(subject.state.pairs[0].b, 'manual');
  }
});
test('ignores old responses after input changes and reports translation failure', async function () {
  var resolve;
  var subject = harness(function () { return new Promise(function (done) { resolve = done; }); });
  subject.state.sideTypes = ['th', 'vi'];
  subject.state.pairs = [{ a: '', b: '' }];
  var pending = subject.fill([{ source: '苹果' }]);
  subject.elements.vocabularyInput.value = '香蕉';
  resolve({ ok: true, json: async function () { return { translations: { 苹果: { th: 'old', vi: 'old' } } }; } });
  await pending;
  assert.equal(subject.state.pairs[0].a, '');
  pending = subject.fill([{ source: '香蕉' }]);
  resolve({ ok: false });
  await pending;
  assert.equal(subject.elements.translationStatus.textContent, 'failed');
  assert.equal(subject.state.pairs[0].b, '');
});
