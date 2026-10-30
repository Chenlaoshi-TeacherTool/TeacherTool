'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var library = require('../public/shared/library-v2');

test('converts vocabulary without dropping unknown fields, duplicates, or empty terms', async function () {
  var original = { id: 'wl_1', name: '科学', updated: 1700000000000, custom: 'keep', items: [
    { zh: '蒸发', py: 'zhēng fā', en: 'evaporation', img: 'https://example.com/image.png', translations: { fr: 'évaporation' } },
    { zh: '蒸发', note: 'another definition' }, { zh: '' }
  ] };
  var raw = JSON.stringify(original);
  var result = await library.preview(raw);
  var collection = result.data.collections[0];
  assert.equal(collection.items.length, 3);
  assert.equal(collection.items[0].term, '蒸发');
  assert.equal(collection.items[0].translations.fr, 'évaporation');
  assert.equal(collection.legacy.custom, 'keep');
  assert.equal(collection.createdAt, null);
  assert.equal(collection.updatedAt, new Date(original.updated).toISOString());
  assert.equal(result.data.legacyRecords[0].rawValue, raw);
  assert.equal(result.warnings.length, 1);
});

test('repeated previews have stable IDs and v2 JSON round trips without data loss', async function () {
  var raw = JSON.stringify({ name: 'List', items: [{ zh: '苹果' }] });
  var first = await library.preview(raw);
  var second = await library.preview(raw);
  assert.equal(first.data.collections[0].id, second.data.collections[0].id);
  assert.deepEqual((await library.preview(JSON.stringify(first.data))).data, first.data);
  assert.equal(first.data.legacyRecords[0].checksum.length, 64);
});

test('keeps all collections in a v1 bundle and namespaces identical original IDs', async function () {
  var result = await library.preview(JSON.stringify({ format: 'chenlaoshi-wordlist', version: 1, lists: [
    { id: 'same', items: [{ zh: '甲' }] }, { id: 'same', items: [{ zh: '乙' }] }
  ] }));
  assert.equal(result.summary.collections, 2);
  assert.notEqual(result.data.collections[0].id, result.data.collections[1].id);
});

test('keeps original letter answers, all options, duplicate IDs and missing prompts', async function () {
  var result = await library.preview(JSON.stringify({ name: '题库', questions: [
    { id: 'q1', prompt: '选水果', answer: 'B', options: ['水', '苹果', '', '', 'extra'], type: '单选题', extra: 42 },
    { id: 'q1', prompt: '', answer: 'D', options: [] }
  ] }));
  var items = result.data.collections[0].items;
  assert.equal(items[0].answer, 'B');
  assert.equal(items[0].options.length, 5);
  assert.equal(items[0].correctOptionId, items[0].options[1].id);
  assert.equal(items[0].legacy.extra, 42);
  assert.equal(items[1].correctOptionId, null);
  assert.equal(result.summary.questions, 2);
  assert.equal(result.warnings.length, 3);
  assert.deepEqual((await library.preview(JSON.stringify(result.data))).warnings, result.warnings);
});

test('preserves epoch timestamps and can re-preview a larger original record', async function () {
  var result = await library.preview(JSON.stringify({ updatedAt: 0, items: [{ zh: '词', note: '文'.repeat(40000) }] }));
  assert.equal(result.data.collections[0].updatedAt, '1970-01-01T00:00:00.000Z');
  assert.deepEqual((await library.preview(JSON.stringify(result.data))).data, result.data);
});

test('rejects malformed, unknown, future, ambiguous, oversized and deeply nested input', async function () {
  var nested = {};
  var cursor = nested;
  for (var depth = 0; depth < 22; depth += 1) cursor = cursor.child = {};
  var invalid = ['{broken', 'null', '[]', '{}', JSON.stringify({ format: 'chenlaoshi-wordlist', version: 9, lists: [] }),
    JSON.stringify({ format: 'cls-teaching-library', schemaVersion: 3 }),
    JSON.stringify({ items: [], questions: [] }), JSON.stringify({ items: [null] }), JSON.stringify(nested),
    ' '.repeat(library.maxBytes + 1), JSON.stringify({ categories: [] }), JSON.stringify({ format: 'cls-library-raw-backup', version: 1 })];
  for (var raw of invalid) await assert.rejects(library.preview(raw));
});

test('validates v2 identities, kinds, item limits, options and answer references', async function () {
  var initial = (await library.preview(JSON.stringify({ questions: [{ prompt: 'Q', answer: 'A', options: ['yes'] }] }))).data;
  var changes = [
    function (data) { data.collections[0].items[0].id = data.collections[0].id; },
    function (data) { data.collections[0].items[0].kind = 'vocabulary'; },
    function (data) { data.collections[0].items[0].prompt = {}; },
    function (data) { data.collections[0].items[0].correctOptionId = 'missing'; },
    function (data) { data.collections[0].items[0].options.push(data.collections[0].items[0].options[0]); },
    function (data) { data.activities = [{ tool: 'maze' }]; },
    function (data) { data.collections[0].items = Array(5001).fill(data.collections[0].items[0]); }
  ];
  for (var change of changes) {
    var modified = structuredClone(initial);
    change(modified);
    await assert.rejects(library.preview(JSON.stringify(modified)));
  }
});

test('does not read or write browser storage during conversion', async function () {
  var fs = require('node:fs');
  var vm = require('node:vm');
  var browser = { crypto: globalThis.crypto };
  Object.defineProperty(browser, 'localStorage', { get: function () { throw new Error('Storage was accessed'); } });
  var context = { window: browser, TextEncoder: TextEncoder };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/shared/library-v2'), 'utf8'), context);
  var result = await browser.ChenLibraryV2.preview('{"items":[]}');
  assert.equal(result.summary.collections, 1);
});
