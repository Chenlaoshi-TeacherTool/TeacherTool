'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');
var cleanup = require('../services/expiredShareCleanup');
var shareFolders = require('../services/shareFolders');

var NOW = Date.parse('2026-11-05T12:00:00Z');
var DAY = 24 * 60 * 60 * 1000;

function fakeStore(kind, folders, manifests) {
  var removed = [];
  return {
    removed: removed,
    kind: kind,
    list: async function () { return folders; },
    getManifest: async function (id) { return manifests[id] || null; },
    remove: async function (id) { removed.push(id); },
    validId: function (id) { return /^[a-z0-9-]+$/.test(id); }
  };
}

test('removes expired shares and stale drafts, keeps live ones, and forgets owned activities', async function () {
  var forgotten = [];
  var games = fakeStore('game', [
    { id: 'live', hasManifest: true, lastModified: new Date(NOW - 100 * DAY) },
    { id: 'expired-owned', hasManifest: true, lastModified: new Date(NOW - 100 * DAY) },
    { id: 'expired-anon', hasManifest: true, lastModified: new Date(NOW - 100 * DAY) },
    { id: '../bad', hasManifest: true, lastModified: new Date(0) }
  ], {
    live: { expiresAt: new Date(NOW + DAY).toISOString(), ownerKey: 'a' },
    'expired-owned': { expiresAt: new Date(NOW - DAY).toISOString(), ownerKey: 'a' },
    'expired-anon': { expiresAt: new Date(NOW - DAY).toISOString() }
  });
  var books = fakeStore('book', [
    { id: 'fresh-draft', hasManifest: false, lastModified: new Date(NOW - 2 * DAY) },
    { id: 'old-draft', hasManifest: false, lastModified: new Date(NOW - 31 * DAY) },
    { id: 'expired-book', hasManifest: true, lastModified: new Date(NOW - 10 * DAY) }
  ], {
    'expired-book': { expiresAt: new Date(NOW - DAY).toISOString(), ownerKey: 'b' }
  });

  var summary = await cleanup.run({
    now: NOW,
    kinds: [games, books],
    activities: { forget: async function (kind, id) { forgotten.push(kind + ':' + id); } }
  });

  assert.deepEqual(games.removed, ['expired-owned', 'expired-anon']);
  assert.deepEqual(books.removed, ['old-draft', 'expired-book']);
  assert.deepEqual(forgotten, ['game:expired-owned', 'book:expired-book']);
  assert.deepEqual(summary, { deleted: 3, drafts: 1, kept: 2, failed: 0 });
});

test('one failing item does not stop the rest', async function () {
  var games = fakeStore('game', [
    { id: 'broken', hasManifest: true, lastModified: new Date(0) },
    { id: 'expired', hasManifest: true, lastModified: new Date(0) }
  ], { expired: { expiresAt: new Date(NOW - DAY).toISOString() } });
  games.getManifest = async function (id) {
    if (id === 'broken') throw new Error('storage hiccup');
    return { expiresAt: new Date(NOW - DAY).toISOString() };
  };
  var originalError = console.error;
  console.error = function () {};
  try {
    var summary = await cleanup.run({ now: NOW, kinds: [games], activities: { forget: async function () {} } });
    assert.deepEqual(games.removed, ['expired']);
    assert.equal(summary.failed, 1);
  } finally { console.error = originalError; }
});

test('local folder listing reports manifests and the newest file time, including nested submissions', async function () {
  var root = await fs.mkdtemp(path.join(os.tmpdir(), 'share-folders-'));
  try {
    await fs.mkdir(path.join(root, 'with-manifest', 'submissions'), { recursive: true });
    await fs.writeFile(path.join(root, 'with-manifest', 'manifest.json'), '{}');
    await fs.writeFile(path.join(root, 'with-manifest', 'submissions', 'x.json'), '{}');
    await fs.mkdir(path.join(root, 'draft'));
    await fs.writeFile(path.join(root, 'draft', 'p1-image.png'), 'x');
    await fs.writeFile(path.join(root, 'draft', 'manifest.json.tmp'), 'x');
    var old = new Date(NOW - 40 * DAY);
    await fs.utimes(path.join(root, 'draft', 'p1-image.png'), old, old);
    await fs.utimes(path.join(root, 'draft', 'manifest.json.tmp'), old, old);

    var folders = await shareFolders.fromDirectory(root);
    var byId = Object.fromEntries(folders.map(function (folder) { return [folder.id, folder]; }));
    assert.equal(byId['with-manifest'].hasManifest, true);
    assert.equal(byId.draft.hasManifest, false);
    assert.equal(byId.draft.lastModified.getTime(), old.getTime());
    assert.deepEqual(await shareFolders.fromDirectory(path.join(root, 'missing')), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('Azure listing groups blobs by their top folder', async function () {
  var container = {
    listBlobsFlat: async function* () {
      yield { name: 'a/manifest.json', properties: { lastModified: new Date(1000) } };
      yield { name: 'a/submissions/x.json', properties: { lastModified: new Date(5000) } };
      yield { name: 'b/p1-image.png', properties: { lastModified: new Date(2000) } };
      yield { name: 'loose.txt', properties: { lastModified: new Date(3000) } };
    }
  };
  var folders = await shareFolders.fromContainer(container);
  assert.deepEqual(folders.map(function (folder) { return [folder.id, folder.hasManifest, folder.lastModified.getTime()]; }),
    [['a', true, 5000], ['b', false, 2000]]);
});
