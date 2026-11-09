'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var path = require('path');
var stream = require('stream');
var express = require('express');
var routes = require('../routes/textbookCompanion');

var member = false;
var signedIn = false;
var lesson = {
  id: 7, slug: 'jinan-1-01', lessonNo: 1, title: '我的家', patterns: ['这是我的……'], activities: [{ text: '家庭树', href: '' }], games: [{ text: '家人转盘', href: '/teaching-tools/lucky-wheel' }],
  words: [{ zh: '爸爸', py: 'bà ba', en: 'dad', kind: '词语' }, { zh: '妈妈', py: 'mā ma', en: 'mom', kind: '' }],
  files: [{ id: 3, title: '第一课 作业单', fileName: 'homework-1.pdf', size: 2048, blobName: 'x' }]
};
var repository = {
  countLessons: async function () { return { 'book-1': 1 }; },
  listLessons: async function (series, book) { return book === 'book-1' ? [{ id: 7, slug: lesson.slug, lessonNo: 1, title: lesson.title, wordCount: 2, fileCount: 1 }] : []; },
  getLesson: async function (series, book, slug) { return series === 'jinan' && book === 'book-1' && slug === lesson.slug ? JSON.parse(JSON.stringify(lesson)) : null; },
  getFile: async function (id) {
    return id === 3 ? { id: 3, fileName: 'homework-1.pdf', blobName: 'b.pdf', contentType: 'application/pdf', series: 'jinan', book: 'book-1', lessonSlug: lesson.slug, published: true } : null;
  }
};
var files = { open: async function () { return stream.Readable.from([Buffer.from('%PDF-test')]); } };
var origin;
var server;

test.before(async function () {
  var app = express();
  app.set('views', path.join(__dirname, '../views'));
  app.set('view engine', 'ejs');
  app.use(function (req, res, next) { res.locals.lang = req.get('test-lang') === 'zh' ? 'zh' : 'en'; res.locals.t = function (key) { return key; }; next(); });
  app.use('/', routes.create({
    repository: repository, files: files,
    limits: { canUseTextbookMaterials: async function () { return member; } },
    signedIn: function () { return signedIn; }, loginProvider: function () { return 'teachers'; }
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { server.once('listening', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { member = false; signedIn = false; });

function get(urlPath, headers) { return fetch(origin + urlPath, { headers: headers || {}, redirect: 'manual' }); }

test('everyone sees the Jinan books and the lesson list', async function () {
  var index = await (await get('/textbook-companion', { 'test-lang': 'zh' })).text();
  assert.match(index, /暨南大学《中文》/);
  assert.match(index, /即将推出/);
  var series = await (await get('/textbook-companion/jinan')).text();
  assert.match(series, /Book 1/);
  assert.match(series, /1 lessons/);
  var book = await (await get('/textbook-companion/jinan/book-1')).text();
  assert.match(book, /我的家/);
  assert.match(book, /Member materials/);
  assert.equal((await get('/textbook-companion/jinan/book-3')).status, 404);
  assert.equal((await get('/textbook-companion/level-2')).headers.get('location'), '/textbook-companion');
});

test('non-members see what a lesson contains but not the content, and cannot download', async function () {
  var html = await (await get('/textbook-companion/jinan/book-1/' + lesson.slug)).text();
  assert.match(html, /2 vocabulary words/);
  assert.match(html, /1 games/);
  assert.doesNotMatch(html, /lucky-wheel/);
  assert.match(html, /第一课 作业单/);
  assert.match(html, /\/\.auth\/login\/teachers/);
  assert.doesNotMatch(html, /bà ba/);
  assert.doesNotMatch(html, /这是我的/);
  assert.doesNotMatch(html, /\/textbook-companion\/files\/3/);
  var download = await get('/textbook-companion/files/3');
  assert.equal(download.status, 303);
  assert.match(download.headers.get('location'), /#members$/);
  signedIn = true;
  var signedInHtml = await (await get('/textbook-companion/jinan/book-1/' + lesson.slug)).text();
  assert.match(signedInHtml, /Become a member/);
});

test('members see the words, patterns and activities and can download files', async function () {
  member = true;
  var html = await (await get('/textbook-companion/jinan/book-1/' + lesson.slug)).text();
  assert.match(html, /bà ba/);
  assert.match(html, /这是我的/);
  assert.match(html, /家庭树/);
  assert.match(html, /href="\/teaching-tools\/lucky-wheel"/);
  assert.match(html, /\/textbook-companion\/files\/3/);
  assert.doesNotMatch(html, /Member materials/);
  var download = await get('/textbook-companion/files/3');
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /homework-1\.pdf/);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.equal(await download.text(), '%PDF-test');
  assert.equal((await get('/textbook-companion/files/99')).status, 404);
});

test('members watch lesson videos on the page; the video answers byte ranges and stays locked for others', async function () {
  var savedFiles = lesson.files, savedGetFile = repository.getFile, savedOpen = files.open;
  var bytes = Buffer.from('0123456789');
  lesson.files = savedFiles.concat([{ id: 4, title: '中文小故事《真心朋友》', fileName: 'story.mp4', size: 10, blobName: 'v', contentType: 'video/mp4' }]);
  repository.getFile = async function (id) {
    return id === 4 ? { id: 4, fileName: 'story.mp4', blobName: 'v.mp4', contentType: 'video/mp4', size: 10, series: 'jinan', book: 'book-1', lessonSlug: lesson.slug, published: true } : savedGetFile(id);
  };
  files.open = async function (name, range) { return stream.Readable.from([range ? bytes.subarray(range.start, range.end + 1) : bytes]); };
  try {
    assert.doesNotMatch(await (await get('/textbook-companion/jinan/book-1/' + lesson.slug)).text(), /<video/);
    assert.equal((await get('/textbook-companion/files/4')).status, 303);
    member = true;
    var html = await (await get('/textbook-companion/jinan/book-1/' + lesson.slug)).text();
    assert.match(html, /<video[^>]+src="\/textbook-companion\/files\/4\?play=1"/);
    var part = await get('/textbook-companion/files/4?play=1', { range: 'bytes=3-' });
    assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 3-9/10');
    assert.equal(part.headers.get('content-disposition'), 'inline'); assert.equal(await part.text(), '3456789');
  } finally { lesson.files = savedFiles; repository.getFile = savedGetFile; files.open = savedOpen; }
});
