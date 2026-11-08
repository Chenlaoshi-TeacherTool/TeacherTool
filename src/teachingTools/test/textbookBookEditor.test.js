'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var service = require('../services/textbookBookEditor');
var sql = require('../services/sqlClient').sql;
var stored, failLesson, commits, rollbacks;
var lessonRows = [{ id: 1, series: 'jinan', book_slug: 'book-2', book_name: '第二册', slug: 'jinan-2-01', title: '第1课' }, { id: 2, series: 'jinan', book_slug: 'book-2', book_name: '第二册', slug: 'jinan-2-02', title: '第2课' }];
function Transaction() {}
Transaction.prototype.begin = async function () { this.items = structuredClone(stored); this.lessons = structuredClone(lessonRows); };
Transaction.prototype.commit = async function () { stored = this.items; lessonRows = this.lessons; commits++; };
Transaction.prototype.rollback = async function () { rollbacks++; };
function Request(tx) { this.tx = tx; this.values = {}; }
Request.prototype.input = function (name, type, value) { this.values[name] = value; return this; };
Request.prototype.query = async function (query) {
  var rows = this.tx ? this.tx.items : stored; var v = this.values;
  var lessons = this.tx ? this.tx.lessons : lessonRows;
  if (query.startsWith('UPDATE textbook_lessons')) { lessons.find(function (l) { return l.id === v.id; }).title = v.title; return {}; }
  if (query.startsWith('DELETE')) { this.tx.items = rows.filter(function (r) { return r.lesson_id !== v.id; }); return {}; }
  if (query.includes('FROM textbook_lessons')) return { recordset: lessons.filter(function (l) { return (!v.id || l.id === v.id) && l.series === v.series && l.book_slug === v.book; }).map(function (l) { return Object.assign({}, l); }) };
  return { recordset: rows.filter(function (r) { return v.id ? r.lesson_id === v.id : lessonRows.some(function (l) { return l.id === r.lesson_id && l.series === v.series && l.book_slug === v.book; }); }).sort(function (a, b) { return a.sort_order - b.sort_order || a.id - b.id; }) };
};
Request.prototype.bulk = async function (table) {
  if (table.rows[0][0] === failLesson) throw new Error('bulk failed');
  table.rows.forEach(function (r, i) { this.tx.items.push({ id: 100 + this.tx.items.length, lesson_id: r[0], zh: r[1], py: r[2], en: r[3], kind: r[4], sort_order: r[5] }); }, this);
};
var db = { sql: Object.assign({}, sql, { Transaction: Transaction, Request: Request }), getPool: async function () { return { request: function () { return new Request(); } }; } };
var editor = service.create({ db: db });
test.beforeEach(function () {
  lessonRows.forEach(function (l) { l.title = '第' + l.id + '课'; });
  stored = [{ id: 11, lesson_id: 1, zh: '在', py: 'zài', en: '', kind: '识字', sort_order: 0 }, { id: 12, lesson_id: 2, zh: '桌', py: 'zhuō', en: 'desk', kind: '识字', sort_order: 0 }];
  commits = 0; rollbacks = 0; failLesson = 0;
});
function payload(lessons) { return lessons.map(function (l) { return { id: l.id, title: l.title, revision: l.revision, items: l.items.map(function (i) { return { zh: i.zh, py: i.py, en: i.en, kind: i.kind }; }) }; }); }

test('loads book lessons with ordered vocabulary and saves only selected lessons', async function () {
  var lessons = await editor.load('jinan', 'book-2'); assert.equal(lessons.length, 2);
  var input = payload([lessons[0]]); input[0].items[0].en = 'at';
  var untouched = structuredClone(stored[1]);
  var result = await editor.save('jinan', 'book-2', input);
  assert.equal(result.lessons[0].items[0].en, 'at'); assert.notEqual(result.lessons[0].revision, lessons[0].revision);
  assert.deepEqual(stored.find(function (r) { return r.lesson_id === 2; }), untouched); assert.equal(commits, 1);
  input = payload(result.lessons); input[0].items[0].en = 'in'; await editor.save('jinan', 'book-2', input);
  assert.equal(stored.find(function (r) { return r.lesson_id === 1; }).en, 'in');
});
test('all-book write failure rolls back every changed lesson', async function () {
  var input = payload(await editor.load('jinan', 'book-2')); var original = structuredClone(stored);
  input[0].items[0].en = 'at'; failLesson = 2;
  input[0].title = '不应保存的标题';
  await assert.rejects(editor.save('jinan', 'book-2', input), /bulk failed/);
  assert.deepEqual(stored, original); assert.equal(commits, 0); assert.equal(rollbacks, 1);
  assert.equal(lessonRows[0].title, '第1课');
});
test('saves titles with words, permits title-only edits on empty lessons, and detects concurrent renames', async function () {
  var input = payload(await editor.load('jinan', 'book-2'));
  input[0].title = '  我的学校  '; input[0].items[0].en = 'at'; input[1].title = '教室'; input[1].items = [];
  var result = await editor.save('jinan', 'book-2', input);
  assert.deepEqual(result.lessons.map(function (l) { return l.title; }), ['我的学校', '教室']);
  var loaded = await editor.load('jinan', 'book-2');
  assert.equal(loaded[0].title, '我的学校'); assert.equal(loaded[0].items[0].en, 'at'); assert.equal(loaded[1].items.length, 0);
  input = payload(loaded); lessonRows[1].title = '另一个窗口的课题';
  await assert.rejects(editor.save('jinan', 'book-2', input), { status: 409 });
  assert.equal(lessonRows[1].title, '另一个窗口的课题');
});
test('rejects blank, non-text and oversized titles before writing', async function () {
  for (var title of ['', '   ', null, 3, '课'.repeat(201)]) {
    var input = payload(await editor.load('jinan', 'book-2')); input[0].title = title;
    await assert.rejects(editor.save('jinan', 'book-2', input), { status: 400 });
  }
  assert.equal(commits, 0); assert.equal(rollbacks, 0);
});
test('stale revisions, new concurrent words, and cross-book IDs cannot overwrite data', async function () {
  var input = payload(await editor.load('jinan', 'book-2'));
  stored[1].en = 'a desk'; var original = structuredClone(stored);
  await assert.rejects(editor.save('jinan', 'book-2', input), { status: 409 }); assert.deepEqual(stored, original);
  await assert.rejects(editor.save('jinan', 'book-1', input), { status: 404 }); assert.deepEqual(stored, original);
  input = payload(await editor.load('jinan', 'book-2'));
  stored.push({ id: 13, lesson_id: 1, zh: '写', py: 'xiě', en: '', kind: '', sort_order: 1 });
  await assert.rejects(editor.save('jinan', 'book-2', input), { status: 409 }); assert.equal(commits, 0);
});
test('validates the whole payload before writing and permits intentional removal of all words', async function () {
  var input = payload(await editor.load('jinan', 'book-2'));
  input[1].items[0].py = '';
  await assert.rejects(editor.save('jinan', 'book-2', input), { status: 400 }); assert.equal(rollbacks, 0);
  input = payload(await editor.load('jinan', 'book-2')); input[0].items.push(input[0].items[0]);
  assert.throws(function () { service.validate(input); }, { status: 400 });
  input = payload(await editor.load('jinan', 'book-2')); input[0].items = [];
  await editor.save('jinan', 'book-2', input); assert.equal(stored.length, 1);
});

var server, base, previews = 0;
var admin = { 'x-ms-client-principal-id': 'book-admin', 'x-ms-client-principal-idp': 'aad' };
test.before(async function () {
  process.env.AZURE_AUTH_ENABLED = 'true'; process.env.ADMIN_USER_IDS = 'book-admin';
  var app = express(); app.use(express.json());
  app.use(function (req, res, next) { req.textbooks = require('../config/textbooks'); next(); });
  app.use('/admin', require('../routes/textbookBookEditor').create({ editor: editor, origin: 'https://teachers.example', words: { generate: async function () { previews++; return { items: [], warning: '' }; } } }));
  server = app.listen(0, '127.0.0.1'); await new Promise(function (resolve) { server.once('listening', resolve); }); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
function post(action, body, headers) { return fetch(base + '/admin/textbooks/books/jinan/book-2/words/' + action, { method: 'POST', redirect: 'manual', headers: Object.assign({ 'Content-Type': 'application/json', origin: 'https://teachers.example' }, admin, headers), body: JSON.stringify(body) }); }
test('generation and saving require administrator identity and same-origin requests', async function () {
  for (var action of ['save', 'preview']) {
    for (var pair of [[{ 'x-ms-client-principal-id': '' }, 302], [{ 'x-ms-client-principal-idp': 'teachers' }, 403], [{ origin: 'https://other.example' }, 403], [{ origin: '' }, 403]]) {
      assert.equal((await post(action, {}, pair[0])).status, pair[1]);
    }
  }
  assert.equal(previews, 0); assert.equal(commits, 0);
  assert.equal((await post('preview', { text: '汉语' })).status, 200); assert.equal(previews, 1);
});
test('route returns validation and conflict errors without saving', async function () {
  assert.equal((await post('save', { lessons: [] })).status, 400);
  var input = payload(await editor.load('jinan', 'book-2')); stored[0].py = 'changed';
  assert.equal((await post('save', { lessons: input })).status, 409); assert.equal(commits, 0);
});
test('whole-book JSON over 100 KB is parsed on the authenticated book route', async function () {
  var input = payload(await editor.load('jinan', 'book-2'));
  input[0].items = Array.from({ length: 500 }, function (_, i) { return { zh: '词语' + i, py: 'cí yǔ', en: 'e'.repeat(200), kind: '词语' }; });
  var body = { lessons: input }; assert.ok(Buffer.byteLength(JSON.stringify(body)) > 100 * 1024);
  var response = await post('save', body, { 'Content-Type': 'application/vnd.cls-textbook+json' });
  assert.equal(response.status, 200); assert.equal(stored.length, 501); assert.equal(commits, 1);
});
