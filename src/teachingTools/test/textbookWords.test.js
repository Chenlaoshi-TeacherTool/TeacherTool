'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var vocabulary = require('../services/textbookWords');
var calls, stored, commits, rollbacks, failBulk;
var sql = require('../services/sqlClient').sql;
function Transaction() { this.rows = []; }
Transaction.prototype.begin = async function () {};
Transaction.prototype.commit = async function () { commits++; stored.push.apply(stored, this.rows); };
Transaction.prototype.rollback = async function () { rollbacks++; };
function Request(tx) { this.tx = tx; this.values = {}; }
Request.prototype.input = function (key, type, value) { this.values[key] = value; return this; };
Request.prototype.query = async function (query) {
  if (query.includes('textbook_lessons')) return { recordset: this.values.id === 1 ? [{ id: 1 }] : [] };
  return { recordset: stored.map(function (row) { return { zh: row[1], sort_order: row[5] }; }) };
};
Request.prototype.bulk = async function (table) { if (failBulk) throw new Error('write failed'); this.tx.rows = table.rows.slice(); };
var db = { sql: Object.assign({}, sql, { Transaction: Transaction, Request: Request }), getPool: async function () { return { request: function () { return new Request(); } }; } };
var translator = { isConfigured: function () { return true; }, translateWords: async function (words, languages) {
  calls.push({ words: words, languages: languages }); var translations = {};
  words.forEach(function (word) { translations[word] = { en: word === '银行' ? 'bank' : 'teacher' }; }); return { translations: translations };
} };
var words = vocabulary.create({ db: db, translator: translator });
var server, base;
var admin = { 'x-ms-client-principal-id': 'word-admin', 'x-ms-client-principal-idp': 'aad' };
test.before(async function () {
  process.env.AZURE_AUTH_ENABLED = 'true'; process.env.ADMIN_USER_IDS = 'word-admin';
  var app = express(); app.use(express.json());
  app.use('/admin', require('../routes/textbookWords').create({ words: words, origin: 'https://teachers.example' }));
  app.use(function (error, req, res, next) { res.status(error.status || 500).json({ error: error.message }); });
  server = app.listen(0, '127.0.0.1'); await new Promise(function (resolve) { server.once('listening', resolve); }); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { calls = []; stored = [[1, '老师', 'lǎo shī', 'teacher', null, 3]]; commits = 0; rollbacks = 0; failBulk = false; });
function post(action, body, headers, id) {
  return fetch(base + '/admin/textbooks/lessons/' + (id || 1) + '/words/' + action, { method: 'POST', redirect: 'manual', headers: Object.assign({ 'Content-Type': 'application/json', origin: 'https://teachers.example' }, admin, headers), body: JSON.stringify(body) });
}

test('parses lines and Chinese separators, removes duplicates, and rejects invalid or oversized inputs', function () {
  assert.deepEqual(vocabulary.parse(' 银行\n老师，银行、学生;你好；中文 '), ['银行', '老师', '学生', '你好', '中文']);
  for (var input of ['', 'English only', '中'.repeat(41), Array.from({ length: 61 }, function (_, i) { return '词' + i; }).join('\n')]) assert.throws(function () { vocabulary.parse(input); }, { status: 400 });
});

test('preview generates contextual pinyin and English once per batch without writing', async function () {
  var response = await post('preview', { text: '银行\n老师\n银行' }); assert.equal(response.status, 200);
  var result = await response.json();
  assert.deepEqual(result.items.map(function (item) { return [item.zh, item.py, item.en]; }), [['银行', 'yín háng', 'bank'], ['老师', 'lǎo shī', 'teacher']]);
  assert.equal(result.warning, ''); assert.deepEqual(calls, [{ words: ['银行', '老师'], languages: ['en'] }]);
  assert.equal(stored.length, 1); assert.equal(commits, 0);
});

test('translation outages keep pinyin and clearly report missing English for manual editing', async function () {
  for (var unavailable of [{ isConfigured: function () { return false; } }, { isConfigured: function () { return true; }, translateWords: async function () { throw new Error('unavailable'); } }]) {
    var result = await vocabulary.create({ translator: unavailable }).generate('银行');
    assert.equal(result.items[0].py, 'yín háng'); assert.equal(result.items[0].en, ''); assert.match(result.warning, /手动补充/);
  }
});

test('confirmed edited words append in order, skip existing and repeated words, and retain the original rows', async function () {
  var response = await post('save', { items: [{ zh: '老师', py: 'lǎo shī', en: 'changed' }, { zh: '银行', py: 'yín háng', en: 'a bank', kind: '词语' }, { zh: '银行', py: 'yín háng', en: 'repeat' }] });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { added: 1, skipped: 2 });
  assert.deepEqual(stored, [[1, '老师', 'lǎo shī', 'teacher', null, 3], [1, '银行', 'yín háng', 'a bank', '词语', 4]]);
  assert.equal(commits, 1);
});

test('bad review fields, missing lessons, and failed writes never partially save', async function () {
  for (var items of [[], [{ zh: '银行', py: '' }], [{ zh: '银行', py: 'p', en: 'x'.repeat(201) }], [null]]) assert.equal((await post('save', { items: items })).status, 400);
  assert.equal((await post('preview', { text: '银行' }, {}, 2)).status, 404); assert.equal(calls.length, 0);
  assert.equal((await post('save', { items: [{ zh: '银行', py: 'yín háng' }] }, {}, 2)).status, 404);
  failBulk = true;
  assert.equal((await post('save', { items: [{ zh: '银行', py: 'yín háng' }] })).status, 500);
  assert.equal(stored.length, 1); assert.equal(commits, 0); assert.equal(rollbacks, 2);
});

test('admin authentication and same-origin checks protect generation and saving', async function () {
  for (var action of ['preview', 'save']) {
    assert.equal((await post(action, {}, { 'x-ms-client-principal-id': '' })).status, 302);
    assert.equal((await post(action, {}, { 'x-ms-client-principal-idp': 'teachers' })).status, 403);
    assert.equal((await post(action, {}, { origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await post(action, {}, { origin: '' })).status, 403);
  }
  assert.equal(calls.length, 0); assert.equal(commits, 0);
});
