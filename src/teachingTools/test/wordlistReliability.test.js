'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var vm = require('node:vm');

test('rolls back a word list when its index cannot be saved', function () {
  var values = new Map();
  var context = {
    localStorage: {
      getItem: function (key) { return values.has(key) ? values.get(key) : null; },
      setItem: function (key, value) {
        if (key === 'clwl:index') throw new Error('QuotaExceededError');
        values.set(key, value);
      },
      removeItem: function (key) { values.delete(key); }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/shared/wordlist-core.js'), 'utf8'), context);
  assert.throws(function () {
    context.ChenWordlist.save({ id: 'test-list', name: 'Test', items: [{ zh: '苹果' }] });
  }, /storage is full/i);
  assert.equal(values.has('clwl:test-list'), false);
});

test('requests the configured maximum page size from DAB', async function () {
  var originalFetch = global.fetch;
  var requests = [];
  global.fetch = async function (url) {
    requests.push(url);
    return { ok: true, json: async function () { return { value: [] }; } };
  };
  try {
    var client = require('../services/dabWordListsClient');
    await client.getAllPublicLists();
    assert.deepEqual(requests, [
      'http://localhost:5000/api/wordlists?$first=-1',
      'http://localhost:5000/api/wordlistitems?$first=-1'
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
