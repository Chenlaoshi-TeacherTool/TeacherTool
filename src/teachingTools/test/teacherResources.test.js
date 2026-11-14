'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var os = require('node:os');
var path = require('node:path');
var express = require('express');
var resources = require('../services/teacherResources');
test('drafts, publishing and withdrawal survive reload; invalid publishing cannot replace public content', async function() {
  var dir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-resources-'));
  try {
    var file = path.join(dir, 'resources.json'), store = resources.create({ file: file });
    assert.equal((await store.list()).length, 5);
    assert.ok((await store.list()).every(function(row) { return row.published === null; }));
    var body = { name: '<script>site</script>', url: 'https://example.org/', summary: 'Original', category: '教学', disclosure: '无商业关系', checkedAt: '2026-11-14', confirmed: 'yes', relationshipType: 'none', action: 'publish' };
    var id = await store.save(null, body);
    await store.save(id, Object.assign({}, body, { summary: 'Draft', action: 'draft' }));
    var row = (await resources.create({ file: file }).list()).find(function(row) { return row.id === id; });
    assert.equal(row.published.summary, 'Original'); assert.equal(row.draft.summary, 'Draft');
    // Editor-curated sites publish with just a name and URL; unset relationship counts as none.
    var quick = await store.save(null, { name: 'Quick site', url: 'https://quick.example.org/', action: 'publish' });
    var quickRow = (await store.list()).find(function(row) { return row.id === quick; });
    assert.equal(quickRow.published.name, 'Quick site'); assert.equal(quickRow.published.promotion.type, 'none');
    await store.save(quick, { action: 'relationship', relationshipType: 'affiliate', revision: quickRow.revision });
    quickRow = (await store.list()).find(function(row) { return row.id === quick; });
    assert.equal(quickRow.published.promotion.type, 'affiliate'); assert.equal(quickRow.draft.promotion.type, 'affiliate');
    await assert.rejects(store.save(quick, { action: 'relationship', relationshipType: 'paid', revision: quickRow.revision }), /付费推广/);
    // Teacher submissions still need the full disclosure, and the message names what is missing.
    var teacherId = await store.save(null, Object.assign({}, body, { authorName: 'T' }), 'teacher-owner');
    await assert.rejects(store.save(teacherId, Object.assign({}, body, { disclosure: '', confirmed: '' })), /利益关系说明、底部的确认勾选/);
    await store.save(id, { action: 'unpublish' });
    row = (await store.list()).find(function(row) { return row.id === id; });
    assert.equal(row.published, null); assert.equal(row.draft.summary, 'Draft');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('URLs, dates and required publication fields are validated', function() {
  ['javascript:alert(1)', 'http://example.org', 'https://user:secret@example.org', 'https://127.0.0.1/', 'https://[::1]/'].forEach(function(url) { assert.throws(function() { resources.clean({ name: 'Test', url: url }); }); });
  assert.throws(function() { resources.clean({ name: 'Test', url: 'https://example.org', checkedAt: '2026-02-30' }); });
});
test('SQL saves use bound parameters and preserve a published version when saving a draft', async function() {
  var inputs, statement;
  var published = { name: 'Live', url: 'https://example.org/' };
  var db = { sql: { VarChar: function() {}, NVarChar: function() {}, MAX: 'MAX' }, getPool: async function() { return { request: function() {
    var bound = {};
    return { input: function(key,type,value) { bound[key] = value; return this; }, query: async function(query) {
      if (query.startsWith('SELECT')) return { recordset: [{ id: 'existing', draft: JSON.stringify(published), published: JSON.stringify(published) }] };
      inputs = bound; statement = query; return { recordset: [] };
    } };
  } }; } };
  await resources.create({ db: db }).save('existing', { name: "Teacher's draft", url: 'https://example.org/', action: 'draft' });
  assert.equal(JSON.parse(inputs.draft).name, "Teacher's draft");
  assert.equal(JSON.parse(inputs.published).name, 'Live');
  assert.ok(!statement.includes("Teacher's draft"));
});
test('admin rejects cross-origin writes and preserves escaped input on validation failure; public view exposes only published resources', async function() {
  var dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resource-routes-'));
  var store = resources.create({ file: path.join(dir, 'resources.json') });
  var app = express(); app.set('views', path.join(__dirname, '../views')); app.set('view engine', 'ejs'); app.use(express.urlencoded({ extended: false }));
  app.use(function(req,res,next) { res.locals.lang = 'zh'; res.locals.t = function(key) { return key; }; req.adminUser = { name: 'Test' }; Object.assign(res.locals, { adminNav: [], adminWorkspace: [], adminPath: '/admin/teacher-resources' }); next(); });
  app.use('/admin', require('../routes/adminTeacherResources').create({ store: store }));
  app.use(require('../routes/community').create({ resourceStore: store, repository: { listAll: async function() { return []; } } }));
  var server = app.listen(0, '127.0.0.1'); await new Promise(function(resolve) { server.once('listening', resolve); });
  var base = 'http://127.0.0.1:' + server.address().port;
  try {
    var values = { action: 'publish', name: '<script>alert(1)</script>', url: 'https://example.org', summary: 'Published summary', category: '教学', disclosure: '无商业关系', checkedAt: '2026-11-14', confirmed: 'yes', relationshipType: 'none' };
    var response = await fetch(base + '/admin/teacher-resources', { method: 'POST', headers: { Origin: 'https://elsewhere.org', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) }); assert.equal(response.status,403);
    response = await fetch(base + '/admin/teacher-resources'); assert.equal(response.status,200); assert.ok((await response.text()).includes('QuizPebble'));
    var html = await (await fetch(base + '/community')).text(); assert.ok(!html.includes('QuizPebble'));
    await store.save(null, values);
    html = await (await fetch(base + '/community')).text(); assert.ok(html.includes('Published summary')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('rel="noopener noreferrer external"'));
    response = await fetch(base + '/admin/teacher-resources', { method: 'POST', headers: { Origin: 'https://clsteachingtools.com', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.assign({},values,{ url: 'http://not-https.example' })) }); assert.equal(response.status,400); assert.ok((await response.text()).includes('&lt;script&gt;'));
  } finally { await new Promise(function(resolve) { server.close(resolve); }); await fs.rm(dir, { recursive: true, force: true }); }
});
