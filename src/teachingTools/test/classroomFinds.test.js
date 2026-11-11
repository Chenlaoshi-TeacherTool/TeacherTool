'use strict';
var assert = require('node:assert/strict');
var test = require('node:test');
var finds = require('../services/classroomFinds');
var defaults = require('../config/classroomFindsDefaults.json');

test('bilingual form saves categories and valid YouTube links; invalid input is rejected', function () {
  var content = finds.fromForm({ finds_categories: ['every-classroom', 'chinese-class'], finds_title_zh: '小白板', finds_usage_zh: '第一步\n\n第二步', finds_video_zh: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.deepEqual(content.categories, ['every-classroom', 'chinese-class']);
  assert.equal(content.zh.usage, '第一步\n\n第二步');
  assert.throws(function () { finds.fromForm({ finds_categories: 'every-classroom', finds_video_en: 'https://evil.example/video' }); }, /YouTube/);
  assert.throws(function () { finds.fromForm({}); }, /category/);
  var localized = finds.localized({ title: 'old', classroomContent: content }, 'en', 'chinese-class');
  assert.equal(localized.title, '小白板');
  assert.equal(localized.video.id, 'dQw4w9WgXcQ');
});

test('defaults include the cart and eight bilingual editable products', function () {
  assert.equal(defaults.length, 9);
  assert.equal(new Set(defaults.map(function (p) { return p.slug; })).size, 9);
  defaults.forEach(function (product) {
    ['en', 'zh'].forEach(function (lang) {
      var item = finds.localized(product, lang, 'every-classroom');
      assert.ok(item.title && item.summary && item.usage);
    });
  });
});

// Exercise the real admin routes and SQL parameters without production credentials.
require.cache[require.resolve('../middleware/requireAdmin')] = { exports: function (req, res, next) { req.adminUser = { name: 'Test admin' }; next(); } };
var db = require('../services/sqlClient');
var store = require('../services/siteContentStore');
var fs = require('node:fs');
var path = require('node:path');
var uploadRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'finds-files-'));
process.env.TEXTBOOK_FILES_LOCAL_ROOT = uploadRoot;
var attachments = {};
var failAttachmentWrites = false;
var products = [];
var saved = {};
var refreshes = 0;
db.getPool = async function () {
  return { request: function () {
    var values = {};
    return { input: function (name, type, value) { values[name] = value; return this; }, query: async function (query) {
      if (query.startsWith('SELECT companion_files')) return { recordset: saved.slug === values.slug ? [{ companion_files: JSON.stringify(attachments[values.slug] || []) }] : [] };
      if (query.includes('JSON_MODIFY')) {
        if (failAttachmentWrites) throw new Error('Simulated attachment save failure');
        (attachments[values.slug] || (attachments[values.slug] = [])).push(JSON.parse(values.file));
        return { rowsAffected: [1] };
      }
      if (query.includes('OPENJSON')) { attachments[values.slug] = (attachments[values.slug] || []).filter(function(file) { return file.blobName !== values.blobName; }); return { rowsAffected: [1] }; }
      if (query.includes('MAX(id)')) return { recordset: [{ applied: '0018_add-classroom-finds-content' }] };
      if (query.includes('INSERT INTO recommendation_products') || query.includes('UPDATE recommendation_products')) { saved = values; return { recordset: [] }; }
      if (query.includes('DELETE FROM recommendation_products')) { saved.deleted = values.slug; return { recordset: [] }; }
      return { recordset: saved.slug ? [{ slug: saved.slug, title: saved.title, reasons: '[]', classroom_content: saved.classroomContent, companion_files: JSON.stringify(attachments[saved.slug] || []) }] : [] };
    } };
  } };
};
store.refresh = async function () { refreshes++; products.forEach(function(product) { if (attachments[product.slug]) product.companionFiles = attachments[product.slug]; }); };
store.get = function () { return { articles: [], toolGuides: {}, recommendations: products, recommendationsLoaded: true }; };
var app = require('../app');
var server;
var base;
test.before(async function () { server = app.listen(0, '127.0.0.1'); await new Promise(function(resolve) { server.once('listening', resolve); }); base = 'http://127.0.0.1:' + server.address().port; });
test.after(function () { server.close(); fs.rmSync(uploadRoot, { recursive: true, force: true }); });

test('admin creates, reopens, updates, and deletes bilingual usage and video data', async function () {
  var fields = { slug: 'test-find', title: 'Fallback', finds_categories: 'chinese-class', finds_title_en: 'Test find', finds_title_zh: '测试好物', finds_usage_zh: '说明第一段\n\n说明第二段', finds_video_zh: 'https://youtu.be/dQw4w9WgXcQ', is_published: 'on' };
  var response = await fetch(base + '/admin/recommendations/new', { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(JSON.parse(saved.classroomContent).zh.usage, fields.finds_usage_zh);
  var html = await (await fetch(base + '/admin/recommendations/test-find/edit')).text();
  assert.ok(html.includes('说明第一段') && html.includes('https://youtu.be/dQw4w9WgXcQ'));
  fields.finds_usage_zh = '更新后的使用方法';
  fields.finds_video_zh = '';
  fields.is_published = '';
  response = await fetch(base + '/admin/recommendations/test-find', { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(JSON.parse(saved.classroomContent).zh.video, '');
  assert.equal(JSON.parse(saved.classroomContent).zh.usage, '更新后的使用方法');
  assert.equal(saved.isPublished, false);
  var beforeInvalid = refreshes;
  fields.finds_video_zh = 'https://bad.example/video';
  assert.equal((await fetch(base + '/admin/recommendations/test-find', { method: 'POST', body: new URLSearchParams(fields) })).status, 400);
  assert.equal(refreshes, beforeInvalid);
  await fetch(base + '/admin/recommendations/test-find/delete', { method: 'POST', redirect: 'manual' });
  assert.equal(saved.deleted, 'test-find');
});

test('published products use small cards and escaped dialogs; an empty published catalog stays empty', async function () {
  products = [{ slug: 'sample', title: 'Sample', productUrl: 'https://amazon.com/example', classroomContent: { categories: ['chinese-class'], zh: { title: '示例', usage: '<script>alert(1)</script>', video: 'https://youtube.com/shorts/dQw4w9WgXcQ' } } }];
  var html = await (await fetch(base + '/classroom-finds', { headers: { Cookie: 'lang=zh' } })).text();
  assert.ok(html.includes('data-finds-open="finds-dialog-chinese-class-0"'));
  assert.ok(!html.includes('data-finds-open="finds-dialog-every-classroom-0"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('data-video-src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
  assert.ok(!html.includes('recommendation-product'));
  products = [];
  html = await (await fetch(base + '/classroom-finds')).text();
  assert.ok(!html.includes('data-finds-open='));
  assert.equal((await fetch(base + '/classroom-finds/15-drawer-rolling-cart')).status, 404);
});

test('DAB round-trips bilingual content and distinguishes empty data from a failed catalog load', async function () {
  var originalFetch = global.fetch;
  try {
    global.fetch = async function (url) {
      return { ok: true, json: async function () { return { value: String(url).includes('recommendationproducts') ? [{ slug: 'round-trip', title: 'Fallback', classroom_content: JSON.stringify(defaults[1].classroomContent), companion_files: JSON.stringify([{ title: 'Labels', blobName: 'test.pdf' }]) }] : [] }; } };
    };
    var client = require('../services/dabSiteContentClient');
    var state = await client.loadAll();
    assert.equal(state.recommendationsLoaded, true);
    assert.equal(state.recommendations[0].companionFiles[0].title, 'Labels');
    assert.equal(finds.localized(state.recommendations[0], 'zh', 'chinese-class').title, defaults[1].classroomContent.zh.title);
    global.fetch = async function () { return { ok: true, json: async function () { return { value: [] }; } }; };
    state = await client.loadAll();
    assert.equal(state.recommendationsLoaded, true);
    assert.deepEqual(state.recommendations, []);
  } finally { global.fetch = originalFetch; }
});


test('admin uploads companion labels; published dialogs and details download them; removal revokes the link', async function () {
  saved = { slug: 'upload-test', title: 'Cart' };
  products = [{ slug: 'upload-test', title: 'Cart' }];
  var bytes = '%PDF-1.4\nCart drawer labels\n%%EOF';
  function form(name) {
    var body = new FormData();
    body.set('title', '推车配套标签');
    body.set('file', new Blob([bytes], { type: 'application/pdf' }), name || '推车标签.pdf');
    return body;
  }
  var response = await fetch(base + '/admin/recommendations/upload-test/files', { method: 'POST', body: form(), redirect: 'manual' });
  assert.equal(response.status, 303);
  var file = attachments['upload-test'][0];
  assert.equal(file.fileName, '推车标签.pdf');
  var url = '/classroom-finds/upload-test/files/' + file.blobName;
  for (var route of ['/classroom-finds', '/classroom-finds/upload-test', '/admin/recommendations/upload-test/edit']) {
    var html = await (await fetch(base + route)).text();
    assert.ok(html.includes('推车配套标签'), route);
  }
  response = await fetch(base + url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.ok(response.headers.get('content-disposition').includes('attachment'));
  assert.equal(await response.text(), bytes);
  var fields = { title: 'Cart renamed', finds_categories: 'every-classroom', finds_title_zh: '推车' };
  await fetch(base + '/admin/recommendations/upload-test', { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  assert.equal(attachments['upload-test'].length, 1, 'editing product text preserves attachments');
  assert.equal((await fetch(base + '/classroom-finds/other/files/' + file.blobName)).status, 404);
  var published = products;
  products = [];
  assert.equal((await fetch(base + url)).status, 404, 'unpublished products cannot download');
  products = published;
  response = await fetch(base + '/admin/recommendations/upload-test/files', { method: 'POST', body: form('bad.exe'), redirect: 'manual' });
  assert.equal(response.status, 400);
  assert.equal(attachments['upload-test'].length, 1);
  var beforeFailure = fs.readdirSync(uploadRoot).length;
  failAttachmentWrites = true;
  response = await fetch(base + '/admin/recommendations/upload-test/files', { method: 'POST', body: form(), redirect: 'manual' });
  failAttachmentWrites = false;
  assert.equal(response.status, 500);
  assert.equal(fs.readdirSync(uploadRoot).length, beforeFailure, 'failed metadata saves clean up new blobs');
  await fetch(base + '/admin/recommendations/upload-test/files/' + file.blobName + '/delete', { method: 'POST', redirect: 'manual' });
  assert.equal(attachments['upload-test'].length, 0);
  assert.equal((await fetch(base + url)).status, 404);
});
