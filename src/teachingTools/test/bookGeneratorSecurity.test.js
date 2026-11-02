'use strict';

var assert = require('node:assert/strict');
var http = require('node:http');
var path = require('node:path');
var test = require('node:test');
var express = require('express');
var cookieParser = require('cookie-parser');

var storage = require('../services/bookGeneratorStorage');
var manifests = new Map();
storage.isAzureConfigured = function () { return true; };
storage.saveManifest = async function (id, manifest) { manifests.set(id, structuredClone(manifest)); };
storage.getManifest = async function (id) { return manifests.get(id) || null; };
storage.getReadUrl = function (id, name) { return '/assets/' + id + '/' + name; };
storage.uploadAsset = async function (id, pageId, kind) { return pageId + '-' + kind + '.png'; };
storage.deleteBook = async function (id) { manifests.delete(id); };

process.env.BOOK_DRAFT_SECRET = 'book-generator-test-secret';

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser('book-generator-cookie-secret'));
app.use(function (req, res, next) {
  res.locals.lang = 'en';
  res.locals.siteUrl = 'http://localhost';
  res.locals.requestPath = req.path;
  res.locals.t = function (key) { return key; };
  next();
});
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.use(require('../routes/bookGenerator'));

var server;
var baseUrl;

test.before(async function () {
  server = http.createServer(app);
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async function () {
  if (server) {
    server.closeAllConnections();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});

async function createDraft() {
  var response = await fetch(baseUrl + '/api/book-generator/drafts', { method: 'POST' });
  assert.equal(response.status, 201);
  return response.json();
}

function bookBody(draft, title) {
  return {
    draftId: draft.draftId,
    draftToken: draft.draftToken,
    title: title || 'Class Book',
    password: 'readme',
    pages: [{ id: 'page-1', caption: 'Page one', imageBlob: 'page-1-image.png' }]
  };
}

test('requires the draft token to publish or update a book', async function () {
  var unauthorisedCreate = await fetch(baseUrl + '/api/book-generator/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftId: crypto.randomUUID(),
      password: 'readme',
      pages: [{ id: 'page-1', imageBlob: 'page-1-image.png' }]
    })
  });
  assert.equal(unauthorisedCreate.status, 403);

  var draft = await createDraft();
  var first = await fetch(baseUrl + '/api/book-generator/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookBody(draft))
  });
  assert.equal(first.status, 200);
  var published = await first.json();

  var migrated = await fetch(baseUrl + '/api/book-generator/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId: draft.draftId, deleteToken: published.deleteToken })
  });
  assert.equal(migrated.status, 201);
  assert.equal((await migrated.json()).draftToken, draft.draftToken);

  var unauthorized = bookBody({ draftId: draft.draftId }, 'Replacement');
  var overwrite = await fetch(baseUrl + '/api/book-generator/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(unauthorized)
  });
  assert.equal(overwrite.status, 403);

  var upload = new FormData();
  upload.append('draftId', draft.draftId);
  upload.append('pageId', 'page-1');
  upload.append('kind', 'image');
  upload.append('file', new Blob(['image']), 'image.png');
  assert.equal((await fetch(baseUrl + '/api/book-generator/pages/upload', { method: 'POST', body: upload })).status, 403);

  var update = await fetch(baseUrl + '/api/book-generator/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookBody(draft, 'Updated'))
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).deleteToken, published.deleteToken);
  assert.equal(manifests.get(draft.draftId).title, 'Updated');
});

test('escapes book data before embedding it in the player script', async function () {
  var draft = await createDraft();
  var marker = '</script><script>window.__bookPwned=true</script>';
  await fetch(baseUrl + '/api/book-generator/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookBody(draft, marker))
  });
  var unlock = await fetch(baseUrl + '/book/' + draft.draftId + '/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'readme' }),
    redirect: 'manual'
  });
  assert.equal(unlock.status, 302);
  var cookie = unlock.headers.get('set-cookie').split(';')[0];
  var player = await fetch(baseUrl + '/book/' + draft.draftId, { headers: { Cookie: cookie } });
  assert.equal(player.status, 200);
  var html = await player.text();
  assert.doesNotMatch(html, /<script>window\.__bookPwned/);
  assert.match(html, /\\u003c\/script>/);
});
