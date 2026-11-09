'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var path = require('path');
var stream = require('stream');
var routes = require('../routes/materials');
var textbookRoutes = require('../routes/textbookCompanion');
var seed = require('../config/materialSeed');
var items, uploaded, removed, server, base;
var catalog = [
  { id: 1, series: 'jinan', book: 'book-1', slug: 'jinan-1-04', lessonNo: 4, title: '金木水火土' },
  { id: 2, series: 'jinan', book: 'book-2', slug: 'jinan-2-01', lessonNo: 1, title: '第二册第一课' },
  { id: 3, series: 'other', book: 'book-1', slug: 'other-1-01', lessonNo: 1, title: '其他教材课次' }
];
var repository = {
  catalog: async function () { return catalog; },
  list: async function (filter) {
    filter = filter || {};
    return Array.from(items.values()).filter(function (item) {
      return (!filter.theme || (item.themes || [item.theme]).includes(filter.theme)) && (!filter.lesson || item.lessons.some(function (lesson) {
        return lesson.series === filter.lesson.series && lesson.book === filter.lesson.book && lesson.slug === filter.lesson.slug;
      }));
    });
  },
  get: async function (id) { return items.get(id) || null; },
  save: async function (item, ids, revision) {
    if (item.title === 'database failure') throw new Error('database down');
    var saved = Object.assign({}, item, { revision: revision + 1, lessons: catalog.filter(function (lesson) { return ids.includes(lesson.id); }) });
    items.set(item.id, saved); return saved;
  }
};
var files = {
  MAX_BYTES: 30 * 1024 * 1024,
  check: require('../services/textbookFileStorage').check,
  save: async function (file) {
    var info = files.check(file); var name = '00000000-0000-0000-0000-00000000000' + uploaded.length + info.ext;
    uploaded.push(name); return { blobName: name, size: file.buffer.length, contentType: info.contentType };
  },
  open: async function () { return stream.Readable.from(['%PDF sample']); },
  remove: async function (name) { removed.push(name); }
};
test.before(async function () {
  var app = express(); app.set('views', path.join(__dirname, '../views')); app.set('view engine', 'ejs');
  app.use(function (req, res, next) { res.locals.lang = req.get('test-lang') || 'zh'; res.locals.t = function (key) { return key; }; next(); });
  app.use(routes.create({ repository: repository, files: files, origin: 'https://teachers.example', getUser: function (req) {
    var key = req.get('test-user'); return key ? { key: key, admin: key === 'admin' } : null;
  } }));
  app.use('/admin', function (req, res, next) { req.adminUser = { id: 'admin', provider: 'aad', name: 'Admin' }; res.locals.adminNav = []; next(); }, routes.create({
    adminMode: true, repository: repository, files: files, origin: 'https://teachers.example',
    getUser: function (req) { var key = req.get('test-user'); return key ? { key: key, admin: key === 'admin' } : null; }
  }));
  app.get('/theme-activities/five-elements', function (req, res) { res.render('theme-activities/five-elements', { title: '五行', parent: { href: '/theme-activities', label: '主题活动' } }); });
  app.use(textbookRoutes.create({ materials: repository, repository: {
    getLesson: async function (series, book, slug) {
      var lesson = catalog.find(function (l) { return l.series === series && l.book === book && l.slug === slug; });
      return lesson ? Object.assign({}, lesson, { words: [], patterns: [], activities: [], games: [], files: [] }) : null;
    }
  }, limits: { canUseTextbookMaterials: async function () { return false; } }, signedIn: function () { return false; }, loginProvider: function () { return 'teachers'; } }));
  server = app.listen(0, '127.0.0.1'); await new Promise(function (resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { items = new Map([[seed.id, JSON.parse(JSON.stringify(seed))]]); uploaded = []; removed = []; });
function form(change) {
  var data = new FormData();
  var values = Object.assign({ id: seed.id, revision: '1', theme: 'five-elements', title: '五行星球活动', description: '更新后的简介', descriptionEn: 'Updated introduction', limitedFree: 'on' }, change);
  Object.keys(values).forEach(function (key) { if (values[key] != null) data.append(key, values[key]); });
  return data;
}
function save(data, user, origin) {
  return fetch(base + '/materials/save', { method: 'POST', headers: Object.assign({ origin: origin || 'https://teachers.example' }, user ? { 'test-user': user } : {}), body: data });
}
test('theme and lesson point to one detail; edits update both and preserve existing attachments', async function () {
  var url = '/materials/' + seed.id;
  for (var entry of ['/theme-activities/five-elements', '/textbook-companion/jinan/book-1/jinan-1-04']) {
    var html = await (await fetch(base + entry)).text(); assert.ok(html.includes('href="' + url + '"')); assert.ok(html.includes('限时免费'));
  }
  var before = await (await fetch(base + url)).text(); assert.match(before, /暨南大学《中文》/); assert.match(before, /jinan-1-04/);
  var data = form(); data.append('lessons', '1'); data.append('lessons', '2');
  assert.equal((await save(data, 'admin')).status, 200);
  for (var entry of ['/theme-activities/five-elements', '/textbook-companion/jinan/book-1/jinan-1-04', '/textbook-companion/jinan/book-2/jinan-2-01']) {
    var html = await (await fetch(base + entry)).text(); assert.match(html, /更新后的简介/); assert.ok(html.includes('href="' + url + '"'));
  }
  assert.equal(items.size, 1); assert.equal(uploaded.length, 0); assert.deepEqual(items.get(seed.id).files, seed.files);
  var download = await fetch(base + url + '/files/0', { redirect: 'manual' }); assert.equal(download.headers.get('location'), seed.files[0].url);
});
test('anonymous visitors and other teachers cannot modify existing material; origin is enforced', async function () {
  assert.equal((await save(form())).status, 401);
  assert.equal((await save(form(), 'other')).status, 403);
  assert.equal((await save(form(), 'admin', 'https://elsewhere.example')).status, 403);
  items.get(seed.id).ownerKey = 'teacher';
  assert.equal((await save(form(), 'other')).status, 403);
  var data = form(); data.append('lessons', '1');
  assert.equal((await save(data, 'teacher')).status, 200);
  assert.equal(items.get(seed.id).limitedFree, true);
  assert.equal(uploaded.length, 0);
});
test('invalid lessons and stale revisions are rejected without changing attachments or metadata', async function () {
  var bad = form(); bad.append('lessons', '999');
  assert.equal((await save(bad, 'admin')).status, 400);
  assert.equal((await save(form({ revision: '0' }), 'admin')).status, 409);
  assert.equal(items.get(seed.id).revision, 1); assert.equal(items.get(seed.id).description, seed.description);
});
test('upload once, attach to multiple lessons including another series; no lessons is allowed', async function () {
  var data = form({ id: '', revision: '0', title: '新材料' });
  data.append('attachments', new Blob(['%PDF test']), 'worksheet.pdf');
  data.append('lessons', '1'); data.append('lessons', '3'); data.append('lessons', '1');
  var response = await save(data, 'teacher'); assert.equal(response.status, 200);
  var result = await response.json(); var item = items.get(result.url.split('/').pop());
  assert.equal(item.ownerKey, 'teacher'); assert.equal(item.lessons.length, 2); assert.equal(uploaded.length, 1); assert.equal(item.limitedFree, false);
  var edit = form({ id: item.id, revision: '1' });
  assert.equal((await save(edit, 'teacher')).status, 200); assert.equal(items.get(item.id).lessons.length, 0);
  assert.equal(uploaded.length, 1);
  assert.equal((await fetch(base + result.url + '/files/0')).status, 200);
});
test('attachment replacement and failed saves keep existing data and clean only new uploads', async function () {
  var data = form({ title: 'database failure' }); data.append('attachments', new Blob(['%PDF']), 'replacement.pdf');
  assert.equal((await save(data, 'admin')).status, 503); assert.deepEqual(removed, uploaded); assert.deepEqual(items.get(seed.id).files, seed.files);
  var replace = form(); replace.append('removeFiles', '0'); replace.append('attachments', new Blob(['%PDF new']), 'new.pdf');
  assert.equal((await save(replace, 'admin')).status, 200);
  assert.equal(items.get(seed.id).files.length, 2); assert.equal(items.get(seed.id).files[0].url, seed.files[1].url);
});
test('edit page has cascading selectors, existing links and attachments; strangers cannot edit', async function () {
  var response = await fetch(base + '/materials/' + seed.id + '/edit', { headers: { 'test-user': 'admin' } });
  assert.equal(response.status, 200); var html = await response.text();
  for (var content of ['materialData', 'id="series"', 'id="book"', 'id="lesson"', 'jinan-1-04', seed.files[0].name]) assert.ok(html.includes(content));
  assert.equal((await fetch(base + '/materials/' + seed.id + '/edit', { headers: { 'test-user': 'other' } })).status, 403);
});

test('preview images are served and Chinese upload names survive; unsupported files are rejected', async function () {
  var bad = form(); bad.append('attachments', new Blob(['test']), 'unsafe.exe');
  assert.equal((await save(bad, 'admin')).status, 400); assert.equal(uploaded.length, 0);
  var data = form(); data.append('preview', new Blob(['image']), 'preview.png');
  data.append('attachments', new Blob(['%PDF']), '五行学习单.pdf');
  assert.equal((await save(data, 'admin')).status, 200);
  assert.equal(items.get(seed.id).files[2].name, '五行学习单.pdf');
  var preview = await fetch(base + '/materials/' + seed.id + '/preview');
  assert.equal(preview.status, 200); assert.match(preview.headers.get('content-type'), /image\/png/);
});

test('admin manages uploads directly and links one material to multiple themes and lessons', async function () {
  var headers = { 'test-user': 'admin' };
  var manager = await fetch(base + '/admin/materials', { headers: headers });
  assert.equal(manager.status, 200); var html = await manager.text();
  assert.match(html, /href="\/admin\/materials\/new"/); assert.match(html, /\/admin\/materials\/five-elements-planets\/edit/);
  var editor = await (await fetch(base + '/admin/materials/' + seed.id + '/edit', { headers: headers })).text();
  assert.match(editor, /action="\/admin\/materials\/save"/); assert.match(editor, /name="themes" value="five-elements" checked/);
  assert.match(editor, /name="themes" value="weather"/);
  var data = form({ theme: null }); data.append('themes', 'five-elements'); data.append('themes', 'weather'); data.append('themes', 'weather');
  data.append('lessons', '1'); data.append('lessons', '2');
  var result = await fetch(base + '/admin/materials/save', { method: 'POST', headers: { origin: 'https://teachers.example', 'test-user': 'admin' }, body: data });
  assert.equal(result.status, 200); assert.equal((await result.json()).url, '/admin/materials');
  assert.deepEqual(items.get(seed.id).themes, ['five-elements', 'weather']);
  assert.equal((await repository.list({ theme: 'weather' }))[0].id, seed.id);
  assert.equal((await repository.list({ theme: 'five-elements' }))[0].id, seed.id);
  assert.equal(items.get(seed.id).lessons.length, 2); assert.equal(items.size, 1); assert.equal(uploaded.length, 0);
  var remove = form({ theme: null, revision: '2' }); remove.append('themes', 'weather');
  assert.equal((await save(remove, 'admin')).status, 200);
  assert.equal((await repository.list({ theme: 'five-elements' })).length, 0);
  assert.deepEqual(items.get(seed.id).files, seed.files);
});

test('admin material pages require admin access and invalid or empty themes cannot save', async function () {
  for (var url of ['/admin/materials', '/admin/materials/new', '/admin/materials/' + seed.id + '/edit']) {
    assert.equal((await fetch(base + url)).status, 403);
    assert.equal((await fetch(base + url, { headers: { 'test-user': 'teacher' } })).status, 403);
  }
  assert.equal((await save(form({ theme: null }), 'admin')).status, 400);
  var bad = form({ theme: null }); bad.append('themes', 'unknown-theme');
  assert.equal((await save(bad, 'admin')).status, 400);
  assert.equal(items.get(seed.id).revision, 1);
});

test('video attachments play inline on the detail page and answer byte-range requests', async function () {
  var bytes = Buffer.from('0123456789');
  var originalOpen = files.open; var asked = [];
  files.open = async function (name, range) { asked.push(range || null); return stream.Readable.from([range ? bytes.subarray(range.start, range.end + 1) : bytes]); };
  try {
    var item = items.get(seed.id);
    item.files = [{ name: '故事.mp4', blobName: '00000000-0000-0000-0000-000000000009.mp4', contentType: 'video/mp4', size: 10 }].concat(item.files);
    var html = await (await fetch(base + '/materials/' + seed.id)).text();
    assert.match(html, /<video[^>]+src="\/materials\/[^"]+\/files\/0\?play=1"/);
    var part = await fetch(base + '/materials/' + seed.id + '/files/0?play=1', { headers: { range: 'bytes=2-5' } });
    assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(part.headers.get('content-disposition'), 'inline'); assert.equal(await part.text(), '2345');
    var whole = await fetch(base + '/materials/' + seed.id + '/files/0');
    assert.equal(whole.status, 200); assert.equal(whole.headers.get('accept-ranges'), 'bytes'); assert.match(whole.headers.get('content-disposition'), /attachment/);
    assert.equal((await fetch(base + '/materials/' + seed.id + '/files/0', { headers: { range: 'bytes=20-' } })).status, 416);
    assert.deepEqual(asked, [{ start: 2, end: 5 }, null]);
  } finally { files.open = originalOpen; }
});
