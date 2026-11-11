'use strict';
var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs/promises');
var os = require('node:os');
var path = require('node:path');
var express = require('express');
var config = require('../config/editablePages');
var workspace = require('../config/adminWorkspace');
var siteMap = require('../config/siteMap');
var createStore = require('../services/editablePages').create;
var createRouter = require('../routes/adminPages').create;
var dir, store, server, base;
function body(title) {
  var result = { action: 'draft' };
  var values = config.defaults('home');
  config.pages.home.fields.forEach(function(field) { ['zh','en'].forEach(function(lang) { result[lang + ':' + field[0]] = values[lang][field[0]]; }); });
  result['zh:home.heroIntro'] = title;
  result['en:home.heroIntro'] = 'English introduction';
  return result;
}
function save(values, origin) {
  return fetch(base + '/admin/pages/home', { method: 'POST', headers: { Origin: origin || 'https://clsteachingtools.com', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values), redirect: 'manual' });
}
test.before(async function() {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-pages-'));
  store = createStore({ file: path.join(dir, 'pages.json') });
  var app = express();
  app.set('views', path.join(__dirname, '../views'));
  app.set('view engine', 'ejs');
  app.use(express.urlencoded({ extended: false }));
  app.use(function(req,res,next) { req.adminUser = { name: 'Test' }; Object.assign(res.locals, { adminNav: siteMap.adminNav(), adminWorkspace: workspace.groups() }); next(); });
  app.use('/admin', createRouter({ store: store }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening',resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async function() { await new Promise(function(resolve) { server.close(resolve); }); await fs.rm(dir, { recursive: true, force: true }); });
test('draft stays private, publish updates both languages, later drafts preserve published content across reload', async function() {
  assert.equal((await store.publicText('home','zh',function() { return 'default'; }))('home.heroIntro'), 'default');
  assert.equal((await save(body('第一版'))).status, 303);
  assert.equal((await store.load('home')).published, null);
  assert.equal((await store.publicText('home','zh',function() { return 'default'; }))('home.heroIntro'), 'default');
  var values = body('发布版本'); values.action = 'publish';
  assert.equal((await save(values)).status, 303);
  assert.equal((await store.publicText('home','zh',function() {}))('home.heroIntro'), '发布版本');
  assert.equal((await store.publicText('home','en',function() {}))('home.heroIntro'), 'English introduction');
  await save(body('下一版草稿'));
  var reloaded = createStore({ file: path.join(dir,'pages.json') });
  assert.equal((await reloaded.load('home')).draft.zh['home.heroIntro'], '下一版草稿');
  assert.equal((await reloaded.load('home')).published.zh['home.heroIntro'], '发布版本');
});
test('invalid input preserves entered text and previous published version; cross-origin writes are rejected', async function() {
  var response = await save(body('恶意修改'), 'https://example.org');
  assert.equal(response.status,403);
  var values = body('<script>alert(1)</script>'); values['en:home.heroTitleLine1'] = '';
  response = await save(values);
  assert.equal(response.status,400);
  var html = await response.text();
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.equal((await store.load('home')).published.zh['home.heroIntro'], '发布版本');
});
test('page editors render defaults in both languages and reject unknown page keys', async function() {
  assert.equal((await fetch(base + '/admin/pages')).status,200);
  var html = await (await fetch(base + '/admin/pages/about')).text();
  assert.ok(html.includes('English'));
  assert.ok(html.includes('保存草稿'));
  assert.ok(html.includes('发布内容'));
  assert.equal((await fetch(base + '/admin/pages/constructor')).status,404);
  assert.equal((await fetch(base + '/admin/pages/missing')).status,404);
});
test('SQL persistence parameterizes text and public pages tolerate an unapplied migration', async function() {
  var inputs = {}, query;
  var db = { sql: { VarChar: function() {}, NVarChar: function() {}, Bit: 'Bit', MAX: 'MAX' }, getPool: async function() { return { request: function() { return { input: function(name,type,value) { inputs[name]=value; return this; }, query: async function(text) { query=text; return { recordset: [] }; } }; } }; } };
  var sqlStore = createStore({ db: db });
  await sqlStore.save('home',body("quoted ' text"),true);
  assert.equal(inputs.publish,true);
  assert.equal(JSON.parse(inputs.draft).zh['home.heroIntro'], "quoted ' text");
  assert.ok(!query.includes("quoted ' text"));
  var missing = createStore({ db: { getPool: async function() { var error = new Error('Invalid object'); error.number=208; throw error; } } });
  assert.equal((await missing.publicText('home','en',function() { return 'original'; }))('home.heroIntro'),'original');
});
