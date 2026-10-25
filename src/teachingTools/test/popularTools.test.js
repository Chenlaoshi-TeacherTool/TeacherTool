'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var tools = require('../services/popularTools');
var i18n = require('../services/i18n');
var DAY = 86400000;

test('canonical, legacy and widget URLs map to the same tool without counting assets or foreign hosts', function() {
  var canonical = tools.toolForUrl('https://clsteachingtools.com/teaching-tools/word-cloud?lang=zh');
  assert.equal(tools.toolForUrl('https://chenlaoshi-teachingtools.azurewebsites.net/low-prep/word-cloud/word-cloud-widget.html').href, canonical.href);
  assert.equal(tools.toolForUrl('https://www.clsteachingtools.com/low-prep-activities/word-cloud/').href, canonical.href);
  ['https://evil.example/teaching-tools/word-cloud', 'https://clsteachingtools.com/admin', 'https://clsteachingtools.com/teaching-tools', 'https://clsteachingtools.com/teaching-tools/word-cloud/script.js', 'https://clsteachingtools.com/teaching-tools/sunflower-spinner'].forEach(function(url) { assert.equal(tools.toolForUrl(url), null); });
});

test('only Traffic sessions are accumulated and malformed/truncated exports fail', function() {
  var url = 'https://clsteachingtools.com/teaching-tools/jeopardy';
  var counts = tools.countsFromResponse([
    { metricName: 'DeadClickCount', information: [{ Url: url, totalSessionCount: 999 }] },
    { metricName: 'Traffic', information: [{ Url: url, totalSessionCount: 4 }, { Url: url + '?lang=zh', totalSessionCount: '3' }, { Url: url, totalSessionCount: -1 }] }
  ]);
  assert.equal(counts['/teaching-tools/jeopardy'], 7);
  assert.throws(function() { tools.countsFromResponse([]); });
  assert.throws(function() { tools.countsFromResponse([{ metricName: 'Traffic', information: new Array(1000).fill({}) }]); });
});

test('ranking excludes old samples, breaks ties consistently and fills eight cards', function() {
  var now = Date.now();
  var cards = tools.rank([
    { start: new Date(now - 2 * DAY).toISOString(), end: new Date(now - DAY).toISOString(), counts: { '/teaching-tools/jeopardy': 12, '/teaching-tools/team-race': 20 } },
    { start: new Date(now - 31 * DAY).toISOString(), end: new Date(now - 30 * DAY).toISOString(), counts: { '/teaching-tools/qr-code-generator': 500 } }
  ], now);
  assert.equal(cards[0].href, '/teaching-tools/team-race');
  assert.equal(cards[1].href, '/teaching-tools/jeopardy');
  assert.equal(cards.length, 8);
  assert.equal(new Set(cards.map(function(tool) { return tool.href; })).size, 8);
});

test('every eligible tool has translated titles/descriptions in both languages', function() {
  tools.catalog.forEach(function(tool) {
    ['en', 'zh'].forEach(function(lang) {
      [tool.titleKey, tool.descKey].forEach(function(key) { assert.notEqual(i18n.t(lang, key), key); });
    });
  });
});

test('collection persists once, skips overlapping retries and releases its lease on API failure', async function(t) {
  var state = { history: [] };
  var releases = 0;
  var requests = 0;
  var writes = 0;
  var fail = false;
  var blob = {
    uploadData: async function(buffer, options) {
      if (options.conditions.ifNoneMatch) throw Object.assign(new Error('exists'), { statusCode: 412 });
      assert.equal(options.conditions.leaseId, 'test-lease');
      state = JSON.parse(buffer.toString());
      writes++;
    },
    downloadToBuffer: async function() { return Buffer.from(JSON.stringify(state)); },
    getBlobLeaseClient: function() {
      return { leaseId: 'test-lease', acquireLease: async function() {}, releaseLease: async function() { releases++; } };
    }
  };
  t.mock.method(require('@azure/storage-blob').BlobServiceClient, 'fromConnectionString', function() {
    return { getContainerClient: function() { return { createIfNotExists: async function() {}, getBlockBlobClient: function() { return blob; } }; } };
  });
  t.mock.method(global, 'fetch', async function() {
    requests++;
    if (fail) return { ok: false, status: 429 };
    return { ok: true, json: async function() { return [{ metricName: 'Traffic', information: [{ Url: 'https://clsteachingtools.com/teaching-tools/jeopardy', totalSessionCount: 10 }] }]; } };
  });
  var previousToken = process.env.CLARITY_API_TOKEN;
  var previousStorage = process.env.AZURE_STORAGE_CONNECTION_STRING;
  process.env.CLARITY_API_TOKEN = 'test-only';
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-only';
  try {
    assert.equal((await tools.collect()).samples, 1);
    assert.ok((await tools.collect()).skipped);
    assert.equal(requests, 1);
    assert.equal(writes, 1);
    state.history[0].start = new Date(Date.now() - 3 * DAY).toISOString();
    state.history[0].end = new Date(Date.now() - 2 * DAY).toISOString();
    fail = true;
    await assert.rejects(tools.collect(), /HTTP 429/);
    assert.equal(writes, 1);
    assert.equal(state.history.length, 1);
    assert.equal(releases, 3);
  } finally {
    if (previousToken === undefined) delete process.env.CLARITY_API_TOKEN;
    else process.env.CLARITY_API_TOKEN = previousToken;
    if (previousStorage === undefined) delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    else process.env.AZURE_STORAGE_CONNECTION_STRING = previousStorage;
  }
});
