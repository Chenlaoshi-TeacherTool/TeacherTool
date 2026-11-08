'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var os = require('node:os');
var path = require('node:path');
var express = require('express');
var ExcelJS = require('exceljs');
var temp, catalog, server, base;
var admin = { 'x-ms-client-principal-id': 'catalog-admin', 'x-ms-client-principal-idp': 'aad' };
var lessons = [], savedMaterial;

test.before(async function () {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-catalog-'));
  process.env.CONTENT_CATALOG_LOCAL_FILE = path.join(temp, 'catalog.json');
  process.env.AZURE_AUTH_ENABLED = 'true'; process.env.ADMIN_USER_IDS = 'catalog-admin';
  catalog = require('../services/contentCatalog');
  var app = express(); app.set('views', path.join(__dirname, '../views')); app.set('view engine', 'ejs');
  app.use(express.json()); app.use(express.urlencoded({ extended: false }));
  app.use(function (req, res, next) { res.locals.lang = req.get('test-lang') || 'zh'; req.cookies = { lang: res.locals.lang }; res.locals.siteUrl = 'https://teachers.example'; res.locals.adminNav = []; res.locals.t = function (key) { return key; }; next(); });
  var materials = { catalog: async function () { return lessons; }, get: async function () { return savedMaterial || null; },
    list: async function (filter) { return savedMaterial && (!filter || !filter.theme || savedMaterial.themes.includes(filter.theme)) ? [savedMaterial] : []; },
    save: async function (item, ids) { savedMaterial = Object.assign({}, item, { lessons: lessons.filter(function (lesson) { return ids.includes(lesson.id); }), revision: 1 }); return savedMaterial; } };
  app.use('/admin', require('../middleware/requireAdmin'), require('../routes/contentCatalog').create({ catalog: catalog, origin: 'https://teachers.example' }),
    require('../routes/materials').create({ adminMode: true, repository: materials, origin: 'https://teachers.example', files: {
      MAX_BYTES: 1000, check: require('../services/textbookFileStorage').check,
      save: async function () { return { blobName: 'test.pdf', size: 9, contentType: 'application/pdf' }; }, remove: async function () {}
    } }));
  require('../services/sqlClient').getPool = async function () { return { request: function () {
    var values = {};
    return { input: function (key, type, value) { values[key] = value; return this; }, query: async function (sql) {
      if (/INSERT INTO textbook_lessons/.test(sql)) {
        lessons.push({ id: 42, series: values.series, book: values.bookSlug, book_slug: values.bookSlug, slug: values.slug, lessonNo: values.lessonNo, title: values.title });
        return { recordset: [{ id: 42 }] };
      }
      if (/SELECT \* FROM textbook_lessons WHERE id/.test(sql)) return { recordset: lessons.map(function (lesson) { return Object.assign({ is_published: true, book_name: '第一册', lesson_no: 1 }, lesson); }) };
      if (/schema_migrations/.test(sql)) return { recordset: [{ applied: '0014_add-content-catalog' }] };
      return { recordset: [] };
    } };
  } }; };
  app.use('/admin', require('../routes/admin'));
  app.use(require('../routes/materials').create({ repository: materials }));
  app.use(require('../routes/textbookCompanion').create({ materials: materials, signedIn: function () { return false; }, repository: {
    countLessons: async function () { return { 'book-1': lessons.length }; }, listLessons: async function () { return lessons; },
    getLesson: async function () { return Object.assign({}, lessons[0], { words: [], patterns: [], activities: [], games: [], files: [] }); }
  } }));
  app.use(require('../routes/siteStructure')); app.use(require('../routes/index'));
  app.use(function (error, req, res, next) { res.status(error.status || 500).send(error.message); });
  server = app.listen(0, '127.0.0.1'); await new Promise(function (resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async function () { await new Promise(function (resolve) { server.close(resolve); }); await fs.rm(temp, { recursive: true, force: true }); });
function add(url, body, headers) { return fetch(base + '/admin' + url, { method: 'POST', redirect: 'manual', headers: Object.assign({ origin: 'https://teachers.example', 'Content-Type': 'application/json', Accept: 'application/json' }, admin, headers), body: JSON.stringify(body) }); }

test('only admins can add entries, and cross-origin writes are rejected', async function () {
  assert.equal((await fetch(base + '/admin/themes/new', { redirect: 'manual' })).status, 302);
  assert.equal((await add('/themes/new', { key: 'denied', zh: '拒绝', en: 'Denied' }, { 'x-ms-client-principal-idp': 'teachers' })).status, 403);
  assert.equal((await add('/themes/new', { key: 'denied', zh: '拒绝', en: 'Denied' }, { origin: 'https://other.example' })).status, 403);
  assert.equal((await add('/themes/new', { key: 'denied', zh: '拒绝', en: 'Denied' }, { origin: '' })).status, 403);
});

test('new themes persist across repository instances and appear in both languages, editor and sitemap', async function () {
  var response = await add('/themes/new', { key: 'spring-test', zh: '春天测试', en: 'Spring test' });
  assert.equal(response.status, 200); assert.equal((await response.json()).key, 'spring-test');
  var reloaded = await catalog.create({ file: process.env.CONTENT_CATALOG_LOCAL_FILE }).load();
  assert.ok(reloaded.themes.some(function (theme) { return theme.key === 'spring-test'; }));
  for (var lang of ['zh', 'en']) {
    var html = await (await fetch(base + '/theme-activities/spring-test', { headers: { 'test-lang': lang } })).text();
    assert.match(html, lang === 'zh' ? /春天测试/ : /Spring test/);
  }
  assert.match(await (await fetch(base + '/theme-activities')).text(), /href="\/theme-activities\/spring-test"/);
  var editor = await (await fetch(base + '/admin/materials/new?theme=spring-test', { headers: admin })).text();
  assert.match(editor, /value="spring-test" checked/); assert.match(editor, /id="themeDialog"/);
  assert.match(await (await fetch(base + '/sitemap.xml')).text(), /\/theme-activities\/spring-test/);
});

test('invalid, duplicate and reserved URLs never replace existing entries', async function () {
  for (var key of ['../escape', 'Bad Name', 'x'.repeat(41)]) assert.equal((await add('/themes/new', { key: key, zh: '测试', en: 'Test' })).status, 400);
  assert.equal((await add('/themes/new', { key: 'spring-test', zh: '覆盖', en: 'Overwrite' })).status, 409);
  assert.equal((await add('/themes/new', { key: 'weather', zh: '覆盖', en: 'Overwrite' })).status, 409);
  assert.equal((await add('/textbooks/new', { key: 'files', zh: '保留', en: 'Reserved' })).status, 400);
  assert.equal((await add('/themes/new', { key: 'blank', zh: '', en: 'Blank' })).status, 400);
  var results = await Promise.all([1, 2].map(function () { return add('/themes/new', { key: 'simultaneous', zh: '同时', en: 'Concurrent' }); }));
  assert.deepEqual(results.map(function (r) { return r.status; }).sort(), [200, 409]);
});

test('new textbooks and books reach public pages, Excel import and material lesson selectors', async function () {
  assert.equal((await add('/textbooks/new', { key: 'test-course', zh: '测试教材', en: 'Test course' })).status, 200);
  assert.equal((await add('/textbooks/test-course/books/new', { key: 'book-1', zh: '第一册', en: 'Book 1' })).status, 200);
  assert.equal((await add('/textbooks/test-course/books/new', { key: 'book-1', zh: '重复', en: 'Duplicate' })).status, 409);
  assert.equal((await add('/textbooks/missing/books/new', { key: 'book-1', zh: '第一册', en: 'Book 1' })).status, 400);
  assert.match(await (await fetch(base + '/textbook-companion')).text(), /\/textbook-companion\/test-course/);
  assert.match(await (await fetch(base + '/textbook-companion/test-course')).text(), /第一册/);
  assert.equal((await fetch(base + '/textbook-companion/test-course/book-1')).status, 200);
  var workbook = new ExcelJS.Workbook(); var sheet = workbook.addWorksheet('课程');
  sheet.addRow(['slug', 'series', 'book_slug', 'book_name', 'title']); sheet.addRow(['test-01', 'test-course', 'book-1', '第一册', '第一课']);
  var parsed = require('../services/textbookImport').readWorkbook(workbook, {}, (await catalog.load()).textbooks);
  assert.deepEqual(parsed.errors, []);
  var adminList = await (await fetch(base + '/admin/textbooks', { headers: admin })).text();
  assert.match(adminList, /测试教材/); assert.match(adminList, /\/admin\/textbooks\/books\/test-course\/book-1/);
  var newLesson = await (await fetch(base + '/admin/textbooks/lessons/new?series=test-course&book=book-1&book_name=' + encodeURIComponent('第一册'), { headers: admin })).text();
  assert.match(newLesson, /value="test-course" selected/);
  var created = await add('/textbooks/lessons/new', { series: 'test-course', book_slug: 'book-1', book_name: '第一册', slug: 'test-01', lesson_no: 1, title: '第一课', is_published: 'on' });
  assert.equal(created.status, 302); assert.match(created.headers.get('location'), /lessons\/42\/edit/);
  var selectors = await (await fetch(base + '/admin/materials/catalog', { headers: admin })).json();
  assert.ok(selectors.series.some(function (series) { return series.key === 'test-course' && series.books.length === 1; }));
  assert.equal(selectors.catalog[0].id, 42);
  var data = new FormData(); data.append('title', '跨主题教材材料'); data.append('themes', 'spring-test'); data.append('lessons', '42');
  data.append('attachments', new Blob(['%PDF test'], { type: 'application/pdf' }), 'test.pdf');
  var saved = await fetch(base + '/admin/materials/save', { method: 'POST', headers: Object.assign({ origin: 'https://teachers.example' }, admin), body: data });
  assert.equal(saved.status, 200);
  assert.equal(savedMaterial.lessons[0].series, 'test-course');
  var theme = await (await fetch(base + '/theme-activities/spring-test')).text(); assert.match(theme, /跨主题教材材料/);
  var lesson = await (await fetch(base + '/textbook-companion/test-course/book-1/test-01')).text(); assert.match(lesson, /跨主题教材材料/);
  var detail = await (await fetch(base + '/materials/' + savedMaterial.id)).text(); assert.match(detail, /测试教材/);
});

test('SQL catalog writes use parameters, reload saved entries and translate duplicate key errors', async function () {
  var rows = [], rejectDuplicate = false;
  var db = { sql: require('../services/sqlClient').sql, getPool: async function () { return { request: function () {
    var params = {};
    return { input: function (key, type, value) { params[key] = value; return this; }, query: async function (query) {
      if (/^SELECT/.test(query)) return { recordset: rows };
      assert.ok(!query.includes('SQL theme')); assert.equal(params.zh, 'SQL 主题');
      if (rejectDuplicate) { var error = new Error('duplicate'); error.number = 2627; throw error; }
      rows.push({ kind: params.kind, parent_key: params.parent, entry_key: params.key, zh: params.zh, en: params.en, members_only: params.members });
      return { recordset: [] };
    } };
  } }; } };
  var sqlCatalog = catalog.create({ db: db });
  await sqlCatalog.add('theme', { key: 'sql-theme', zh: 'SQL 主题', en: 'SQL theme' });
  assert.ok((await catalog.create({ db: db }).load()).themes.some(function (theme) { return theme.key === 'sql-theme'; }));
  rejectDuplicate = true;
  await assert.rejects(sqlCatalog.add('theme', { key: 'concurrent-key', zh: 'SQL 主题', en: 'SQL theme' }), { status: 409 });
});
