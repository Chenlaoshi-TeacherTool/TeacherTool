'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var wordTranslator = require('../services/wordTranslator');

function fakeAzure(calls) {
  return async function (url, options) {
    var body = JSON.parse(options.body);
    calls.push({ url: url, headers: options.headers, body: body });
    var langs = new URL(url).searchParams.getAll('to');
    return {
      ok: true,
      json: async function () {
        return body.map(function (item) {
          return { translations: langs.map(function (to) { return { to: to, text: to + ':' + item.Text }; }) };
        });
      }
    };
  };
}

test.beforeEach(function () {
  wordTranslator.clearCache();
  process.env.AZURE_TRANSLATOR_KEY = 'test-key';
  process.env.AZURE_TRANSLATOR_REGION = 'eastus';
  delete process.env.AZURE_TRANSLATOR_ENDPOINT;
});

test('cleanRequest trims, de-duplicates and enforces limits', function () {
  var ok = wordTranslator.cleanRequest({ words: [' 爸爸 ', '爸爸', '', 5, '妈妈'], to: ['th', 'th', 'xx', 'fr'] });
  assert.deepEqual(ok, { words: ['爸爸', '妈妈'], to: ['th', 'fr'] });

  assert.ok(wordTranslator.cleanRequest({ words: [], to: ['th'] }).error);
  assert.ok(wordTranslator.cleanRequest({ words: ['爸爸'], to: [] }).error);
  assert.ok(wordTranslator.cleanRequest({ words: ['爸爸'], to: ['en'] }).error, 'English is not a server language');
  assert.ok(wordTranslator.cleanRequest({ words: ['爸爸'], to: ['th', 'vi', 'ru', 'es', 'fr'] }).error);
  var many = Array.from({ length: 61 }, function (_, i) { return '词' + i; });
  assert.ok(wordTranslator.cleanRequest({ words: many, to: ['th'] }).error);
});

test('translateWords calls Azure once per batch and maps results by word', async function () {
  var calls = [];
  var out = await wordTranslator.translateWords(['爸爸', '妈妈'], ['th', 'vi'], fakeAzure(calls));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /from=zh-Hans&to=th&to=vi$/);
  assert.equal(calls[0].headers['Ocp-Apim-Subscription-Key'], 'test-key');
  assert.equal(calls[0].headers['Ocp-Apim-Subscription-Region'], 'eastus');
  assert.deepEqual(out.translations, {
    '爸爸': { th: 'th:爸爸', vi: 'vi:爸爸' },
    '妈妈': { th: 'th:妈妈', vi: 'vi:妈妈' }
  });
});

test('translateWords serves repeats from the cache', async function () {
  var calls = [];
  await wordTranslator.translateWords(['爸爸'], ['th'], fakeAzure(calls));
  var out = await wordTranslator.translateWords(['爸爸'], ['th'], fakeAzure(calls));
  assert.equal(calls.length, 1);
  assert.equal(out.translations['爸爸'].th, 'th:爸爸');

  await wordTranslator.translateWords(['爸爸', '哥哥'], ['th'], fakeAzure(calls));
  assert.deepEqual(calls[1].body, [{ Text: '哥哥' }]);
});

test('translateWords surfaces Azure errors', async function () {
  var failing = async function () { return { ok: false, status: 401, json: async function () { return {}; } }; };
  await assert.rejects(wordTranslator.translateWords(['爸爸'], ['th'], failing), /HTTP 401/);
});

test('isConfigured follows the key setting', function () {
  assert.equal(wordTranslator.isConfigured(), true);
  delete process.env.AZURE_TRANSLATOR_KEY;
  assert.equal(wordTranslator.isConfigured(), false);
});
