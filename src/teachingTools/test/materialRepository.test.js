'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var os = require('node:os');
var path = require('node:path');
var repository, directory;
test.before(async function () {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'activity-materials-test-'));
  process.env.MATERIALS_LOCAL_FILE = path.join(directory, 'materials.json');
  delete process.env.SQL_CONNECTION_STRING;
  repository = require('../services/materialRepository');
});
test.after(async function () { await fs.rm(directory, { recursive: true, force: true }); });
test('seed reuses the original blobs, edits persist once, and removing a link removes it from the lesson', async function () {
  var item = await repository.get('five-elements-planets');
  assert.equal(item.lessons[0].slug, 'jinan-1-04');
  assert.ok(item.files.every(function (file) { return file.url.startsWith('https://chenlaoshitteaching.blob.core.windows.net/printables/'); }));
  var oldFiles = JSON.stringify(item.files);
  var saved = await repository.save(Object.assign({}, item, { description: '持久化修改', themes: ['five-elements', 'weather'] }), [1], 1);
  assert.equal(saved.revision, 2);
  assert.equal((await repository.list({ theme: 'five-elements' }))[0].description, '持久化修改');
  assert.equal((await repository.list({ theme: 'weather' }))[0].id, item.id);
  assert.equal((await repository.list({ lesson: { series: 'jinan', book: 'book-1', slug: 'jinan-1-04' } }))[0].description, '持久化修改');
  await assert.rejects(repository.save(item, [1], 1), { status: 409 });
  await assert.rejects(repository.save(saved, [999], 2), { status: 400 });
  assert.equal(JSON.stringify((await repository.get(item.id)).files), oldFiles);
  await repository.save(saved, [], 2);
  assert.equal((await repository.list({ lesson: { series: 'jinan', book: 'book-1', slug: 'jinan-1-04' } })).length, 0);
  assert.equal((await repository.list()).length, 1);
  var onDisk = JSON.parse(await fs.readFile(process.env.MATERIALS_LOCAL_FILE, 'utf8'));
  assert.deepEqual(onDisk[0].themes, ['five-elements', 'weather']);
  assert.equal(onDisk.length, 1); assert.equal(onDisk[0].revision, 3); assert.deepEqual(onDisk[0].lessons, []);
});
