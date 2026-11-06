'use strict';

var assert = require('node:assert/strict');
var path = require('node:path');
var test = require('node:test');
var ejs = require('ejs');
var ExcelJS = require('exceljs');
var textbookImport = require('../services/textbookImport');
var siteMap = require('../config/siteMap');
var textbooks = require('../config/textbooks');

function workbookWith(lessonRows, itemRows) {
  var workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('说明').addRow(['notes only']);
  var lessons = workbook.addWorksheet('课程');
  lessons.addRow(['series', '教材', 'book_slug', '册', 'sort_order', '课号', '课题', '句型', '活动建议', 'word_list_slug']);
  lessonRows.forEach(function (row) { lessons.addRow(row); });
  var items = workbook.addWorksheet('生词');
  items.addRow(['slug', 'name', 'zh', 'py', 'en', 'note', '核对']);
  itemRows.forEach(function (row) { items.addRow(row); });
  return workbook;
}

var LESSON = ['bubian', '人教部编版', '1a', '一年级上册', 1, 1, '第1课《天地人》', '“我是……”\n笔画：横、竖', '字卡抢读\n笔画书空接龙', 'bubian-1a-01'];

test('reads the review workbook layout, including Chinese headers and the note column', function () {
  var parsed = textbookImport.readWorkbook(workbookWith([LESSON], [
    ['bubian-1a-01', 'x', '天', 'tiān', 'sky', '识字', ''],
    ['bubian-1a-01', 'x', '地', 'dì', '', '识字', '无英文'],
    ['bubian-1a-01', 'x', '天', 'tiān', 'duplicate', '识字', '']
  ]), {});
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.lessons.length, 1);
  assert.deepEqual(parsed.lessons[0], {
    slug: 'bubian-1a-01', series: 'bubian', book_slug: '1a', book_name: '一年级上册', sort_order: 1, lesson_no: 1,
    title: '第1课《天地人》', sentence_patterns: '“我是……”\n笔画：横、竖', activities: '字卡抢读\n笔画书空接龙'
  });
  assert.deepEqual(parsed.itemsBySlug['bubian-1a-01'], [
    { zh: '天', py: 'tiān', en: 'sky', kind: '识字' },
    { zh: '地', py: 'dì', en: '', kind: '识字' }
  ]);
});

test('reports every bad row and keeps nothing to write', function () {
  var parsed = textbookImport.readWorkbook(workbookWith([
    LESSON,
    ['meihua', '', '10', '第十册', 1, '', '第1课', '', '', 'meihua-10-01'],
    ['bubian', '', '1a', '一年级上册', 'two', '', '第2课', '', '', 'bubian-1a-02']
  ], [
    ['bubian-1a-01', '', '人', '', 'person', '', ''],
    ['nope-01', '', '我', 'wǒ', 'I', '', '']
  ]), {});
  assert.equal(parsed.errors.length, 4);
  assert.match(parsed.errors[0], /unknown series "meihua"/);
  assert.match(parsed.errors[1], /whole numbers/);
  assert.match(parsed.errors[2], /py is empty for 人/);
  assert.match(parsed.errors[3], /no lesson with slug nope-01/);
});

test('word rows may point at lessons already in the database', function () {
  var parsed = textbookImport.readWorkbook(workbookWith([], [['bubian-2a-05', '', '我', 'wǒ', 'I', '', '']]), { 'bubian-2a-05': 7 });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.itemsBySlug['bubian-2a-05'].length, 1);
});

test('an export can be imported again unchanged', function () {
  var lessons = [{ id: 3, slug: 'nihao-1-01', series: 'nihao', book_slug: 'book-1', book_name: '第一册', sort_order: 1, lesson_no: 1, title: '第1课《你叫什么名字》', sentence_patterns: '你叫什么名字？', activities: '名字游戏' }];
  var items = [{ lesson_id: 3, zh: '你好', py: 'nǐ hǎo', en: 'hello', kind: '词语' }];
  var parsed = textbookImport.readWorkbook(textbookImport.buildWorkbook(ExcelJS, lessons, items), {});
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.lessons[0].title, '第1课《你叫什么名字》');
  assert.deepEqual(parsed.itemsBySlug['nihao-1-01'], [{ zh: '你好', py: 'nǐ hǎo', en: 'hello', kind: '词语' }]);
});

function fakeSql(log, existing) {
  function Request() { this.inputs = {}; }
  Request.prototype.input = function (name, type, value) { this.inputs[name] = value; return this; };
  Request.prototype.query = async function (text) {
    log.push({ text: text, inputs: this.inputs });
    if (/^SELECT id, slug/.test(text)) return { recordset: existing };
    if (/^INSERT INTO textbook_lessons/.test(text)) return { recordset: [{ id: 100 + log.length }] };
    return { recordset: [] };
  };
  Request.prototype.bulk = async function (table) { log.push({ bulk: table.rows.slice() }); };
  function Transaction() {}
  Transaction.prototype.begin = async function () { log.push('begin'); };
  Transaction.prototype.commit = async function () { log.push('commit'); };
  Transaction.prototype.rollback = async function () { log.push('rollback'); };
  function Table() { var rows = []; rows.add = function () { rows.push(Array.from(arguments)); }; this.rows = rows; this.columns = { add: function () {} }; }
  var type = function () { return 'type'; };
  return {
    pool: { request: function () { return new Request(); } },
    sql: { Request: Request, Transaction: Transaction, Table: Table, Int: 'Int', NVarChar: type }
  };
}

test('import upserts lessons and replaces words in one transaction', async function () {
  var log = [];
  var fake = fakeSql(log, [{ id: 7, slug: 'bubian-1a-01' }]);
  var parsed = textbookImport.readWorkbook(workbookWith(
    [LESSON, ['bubian', '', '1a', '一年级上册', 2, 2, '第2课《金木水火土》', '', '', 'bubian-1a-02']],
    [['bubian-1a-01', '', '天', 'tiān', 'sky', '识字', ''], ['bubian-1a-02', '', '金', 'jīn', 'gold', '识字', '']]
  ), {});
  var counts = await textbookImport.applyImport(fake.pool, fake.sql, parsed);
  assert.deepEqual(counts, { lessonsCreated: 1, lessonsUpdated: 1, lessonsWithWords: 2, words: 2 });
  assert.equal(log[1], 'begin');
  assert.equal(log[log.length - 1], 'commit');
  assert.match(log[2].text, /^UPDATE textbook_lessons/);
  assert.equal(log[2].inputs.id, 7);
  assert.match(log[3].text, /^INSERT INTO textbook_lessons/);
  var deletes = log.filter(function (entry) { return entry.text && /^DELETE FROM textbook_lesson_items/.test(entry.text); });
  assert.deepEqual(deletes.map(function (entry) { return entry.inputs.id; }), [7, 104]);
  var bulk = log.find(function (entry) { return entry.bulk; }).bulk;
  assert.deepEqual(bulk, [[7, '天', 'tiān', 'sky', '识字', 0], [104, '金', 'jīn', 'gold', '识字', 0]]);
});

test('admin textbook pages render', async function () {
  var common = { adminUser: { name: 'Test' }, adminNav: siteMap.adminNav() };
  var bookPath = function (series, book) { return '/admin/textbooks/books/' + series + '/' + book; };
  var views = path.join(__dirname, '../views/admin');
  var index = await ejs.renderFile(path.join(views, 'textbooks-index.ejs'), Object.assign({
    title: 'Textbooks', bookPath: bookPath,
    groups: textbooks.SERIES.map(function (series, i) {
      return { series: series, books: i ? [] : [{ series: 'bubian', book_slug: '1a', book_name: '一年级上册', lesson_count: 28, word_count: 300 }] };
    })
  }, common));
  assert.ok(index.includes('href="/admin/textbooks/books/bubian/1a"'));
  assert.ok(index.includes('你好华语'));
  var lesson = { id: 5, slug: 'bubian-1a-01', series: 'bubian', book_slug: '1a', book_name: '一年级上册', sort_order: 1, lesson_no: null, title: '第1课《天地人》', sentence_patterns: '“我是……”', activities: '', is_published: true };
  var edit = await ejs.renderFile(path.join(views, 'textbooks-lesson-edit.ejs'), Object.assign({
    title: 'Edit', seriesList: textbooks.SERIES, lesson: lesson, defaults: lesson, bookPath: bookPath,
    items: [{ id: 1, zh: '天', py: 'tiān', en: 'sky', kind: '识字' }],
    files: [{ id: 9, title: '第1课 作业单', fileName: 'hw.pdf', size: 4096 }], fileError: ''
  }, common));
  assert.ok(edit.includes('action="/admin/textbooks/lessons/5/items/1"'));
  assert.ok(edit.includes('action="/admin/textbooks/lessons/5/files/9/delete"'));
  assert.ok(edit.includes('enctype="multipart/form-data"'));
  var created = await ejs.renderFile(path.join(views, 'textbooks-lesson-edit.ejs'), Object.assign({
    title: 'New', seriesList: textbooks.SERIES, lesson: null, items: [], bookPath: bookPath,
    defaults: { series: 'nihao', book_slug: 'book-2', book_name: '第二册' }
  }, common));
  assert.ok(created.includes('action="/admin/textbooks/lessons/new"'));
  var importPage = await ejs.renderFile(path.join(views, 'textbooks-import.ejs'), Object.assign({ title: 'Import', result: { errors: ['课程 row 2: slug is empty.'] } }, common));
  assert.ok(importPage.includes('Nothing was imported'));
});
