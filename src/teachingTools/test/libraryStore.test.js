'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var core = require('../public/shared/library-v2');
var storeModule = require('../public/shared/library-store');

function harness() {
  var values = new Map([['clwl:index', '["old"]'], ['chenlaoshi-questionbanks-v1', '[{"id":"old"}]']]);
  var writes = [];
  var storage = { getItem: function (key) { return values.has(key) ? values.get(key) : null; }, setItem: function (key, value) { writes.push(key); values.set(key, value); } };
  var chain = Promise.resolve();
  var locks = { request: function (name, action) { var result = chain.then(action); chain = result.catch(function () {}); return result; } };
  return { values: values, writes: writes, storage: storage, locks: locks, store: storeModule.create(storage, locks) };
}

async function vocabulary(name, legacyId, term) {
  return (await core.preview(JSON.stringify({ name: name, id: legacyId, items: [{ zh: term || '苹果', en: 'apple' }] }))).data;
}

test('prepares without writing, saves atomically, reloads and exports a valid library', async function () {
  var state = harness();
  var input = await vocabulary('Fruit', 'wl1');
  var plan = await state.store.prepare(input);
  assert.deepEqual(plan.entries, [{ name: 'Fruit', status: 'new' }]);
  assert.equal(state.writes.length, 0);
  await state.store.save(plan, false);
  assert.deepEqual(state.writes, [storeModule.key]);
  var restored = await storeModule.create(state.storage, state.locks).load();
  assert.deepEqual((await core.preview(JSON.stringify(restored.data))).data, restored.data);
  assert.equal(restored.data.collections[0].items[0].term, '苹果');
  assert.equal(state.values.get('clwl:index'), '["old"]');
  assert.equal(state.values.get('chenlaoshi-questionbanks-v1'), '[{"id":"old"}]');
});

test('skips repeated imports and reimported full backups without writing or duplicating', async function () {
  var state = harness();
  var input = await vocabulary('Fruit', 'wl1');
  await state.store.save(await state.store.prepare(input), false);
  var raw = state.values.get(storeModule.key);
  var plan = await state.store.prepare(input);
  assert.equal(plan.entries[0].status, 'duplicate');
  await state.store.save(plan, false);
  await state.store.save(await state.store.prepare((await state.store.load()).data), false);
  assert.equal(state.values.get(storeModule.key), raw);
  assert.equal(state.writes.length, 1);
});

test('requires keep-both confirmation for changed original IDs and retains both contents', async function () {
  var state = harness();
  await state.store.save(await state.store.prepare(await vocabulary('Fruit', 'wl1')), false);
  var plan = await state.store.prepare(await vocabulary('Fruit revised', 'wl1', '香蕉'));
  assert.equal(plan.entries[0].status, 'conflict');
  var before = state.values.get(storeModule.key);
  await assert.rejects(state.store.save(plan, false), /Keep both/);
  assert.equal(state.values.get(storeModule.key), before);
  await state.store.save(plan, true);
  assert.equal((await state.store.load()).data.collections.length, 2);
});

test('remaps colliding IDs and option answer references and skips their repeated imports', async function () {
  var state = harness();
  var input = (await core.preview('{"name":"Questions","questions":[{"prompt":"Q","answer":"B","options":["no","yes"]}]}')).data;
  await state.store.save(await state.store.prepare(input), false);
  var changed = structuredClone(input);
  changed.collections[0].items[0].prompt = 'Updated question';
  var plan = await state.store.prepare(changed);
  await state.store.save(plan, true);
  var collections = (await state.store.load()).data.collections;
  assert.equal(collections.length, 2);
  assert.notEqual(collections[0].id, collections[1].id);
  assert.equal(collections[1].items[0].correctOptionId, collections[1].items[0].options[1].id);
  assert.equal((await state.store.prepare(changed)).entries[0].status, 'duplicate');
});

test('rejects stale plans and concurrent saves without losing another tab’s data', async function () {
  var state = harness();
  var first = await state.store.prepare(await vocabulary('First', 'one'));
  var second = await state.store.prepare(await vocabulary('Second', 'two'));
  var results = await Promise.allSettled([state.store.save(first, false), state.store.save(second, false)]);
  assert.equal(results.filter(function (result) { return result.status === 'fulfilled'; }).length, 1);
  assert.match(results.find(function (result) { return result.status === 'rejected'; }).reason.message, /changed in another tab/);
  var refreshed = await state.store.prepare(second.incoming);
  await state.store.save(refreshed, false);
  assert.equal((await state.store.load()).data.collections.length, 2);
});

test('quota failures, corrupt storage and unavailable locks preserve existing bytes', async function () {
  var state = harness();
  await state.store.save(await state.store.prepare(await vocabulary('First', 'one')), false);
  var before = state.values.get(storeModule.key);
  var next = await state.store.prepare(await vocabulary('Second', 'two'));
  state.storage.setItem = function () { throw new Error('QuotaExceededError'); };
  await assert.rejects(state.store.save(next, false), /Existing data has been kept/);
  assert.equal(state.values.get(storeModule.key), before);
  await assert.rejects(storeModule.create(state.storage).save(next, false), /Safe browser saving/);
  state.values.set(storeModule.key, '{broken');
  await assert.rejects(state.store.load(), /original data has been kept/);
  await assert.rejects(state.store.prepare(next.incoming), /could not be read/);
  assert.equal(state.values.get(storeModule.key), '{broken');
});

test('keeps vocabulary and question banks together without modifying input or unknown fields', async function () {
  var state = harness();
  var input = await vocabulary('Fruit', 'wl1');
  input.custom = { future: true };
  var before = JSON.stringify(input);
  await state.store.save(await state.store.prepare(input), false);
  var questions = (await core.preview('{"questions":[{"prompt":"Q","answer":"A"}]}')).data;
  await state.store.save(await state.store.prepare(questions), false);
  var saved = (await state.store.load()).data;
  assert.equal(saved.collections.length, 2);
  assert.equal(JSON.stringify(input), before);
  assert(saved.legacyRecords.some(function (record) { return record.sourceKey === 'import-metadata' && record.rawValue.includes('future'); }));
});

test('rejects a merged library over its collection limit before writing', async function () {
  var state = harness();
  var input = (await core.preview(JSON.stringify({ format: 'chenlaoshi-wordlist', version: 1, lists: Array.from({ length: 100 }, function (unused, index) { return { id: 'list_' + index, name: 'List ' + index, items: [] }; }) }))).data;
  await state.store.save(await state.store.prepare(input), false);
  var before = state.values.get(storeModule.key);
  await assert.rejects(state.store.prepare(await vocabulary('Extra', 'extra')), /collections/);
  assert.equal(state.values.get(storeModule.key), before);
  assert.equal(state.writes.length, 1);
});

test('unavailable storage and unsupported saved formats are not treated as an empty library', async function () {
  var unavailable = storeModule.create({ getItem: function () { throw new Error('SecurityError'); } });
  await assert.rejects(unavailable.load(), /unavailable/);
  var state = harness();
  state.values.set(storeModule.key, '{"items":[]}');
  await assert.rejects(state.store.load(), /format is not supported/);
  assert.equal(state.values.get(storeModule.key), '{"items":[]}');
  assert.equal(state.writes.length, 0);
});

test('restores a complete backup with same-name collections into an empty library without false conflicts', async function () {
  var state = harness();
  var input = await vocabulary('Fruit', 'one', '苹果');
  var other = await vocabulary('Fruit', 'two', '香蕉');
  input.collections.push(other.collections[0]);
  var plan = await state.store.prepare(input);
  assert.deepEqual(plan.entries.map(function (entry) { return entry.status; }), ['new', 'new']);
  await state.store.save(plan, false);
  assert.equal((await state.store.load()).data.collections.length, 2);
});
