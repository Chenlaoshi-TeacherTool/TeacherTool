'use strict';

// Keeps the public site, navigation, sitemap, and admin in step with
// config/siteMap.js. If one of these fails after a structure change, update
// config/siteMap.js (or the page/route it names) so they match again.

var assert = require('node:assert/strict');
var path = require('node:path');
var test = require('node:test');
var ejs = require('ejs');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
store.get = function() { return { articles: [], toolGuides: {}, recommendations: [] }; };
var app = require('../app');
var adminRouter = require('../routes/admin');
var siteMap = require('../config/siteMap');
var server;
var base;

function flatten(items) {
  return items.reduce(function(all, item) { return all.concat([item], flatten(item.children || [])); }, []);
}

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() { server.close(); });

test('every page in the site map renders in English and Chinese', async function() {
  for (var item of flatten(siteMap.SECTIONS)) {
    assert.equal((await fetch(base + item.href)).status, 200, item.href);
    assert.equal((await fetch(base + item.href, { headers: { Cookie: 'lang=zh' } })).status, 200, item.href + ' zh');
  }
});

test('each section page links to all of its sub-pages', async function() {
  for (var item of flatten(siteMap.SECTIONS).filter(function(entry) { return entry.children; })) {
    var html = await (await fetch(base + item.href)).text();
    for (var sub of item.children) assert.ok(html.includes('href="' + sub.href + '"'), item.href + ' should link to ' + sub.href);
  }
});

test('navigation and footer links come from the site map', async function() {
  var script = await (await fetch(base + '/javascripts/milk-tea-footer.js')).text();
  assert.ok(!script.includes('/*SITE_NAV*/'), 'nav data was not injected');
  var injected = JSON.stringify(siteMap.clientNav());
  assert.ok(script.includes(injected));
  var nav = siteMap.clientNav();
  assert.deepEqual(nav.nav.map(function(item) { return item.href; }), siteMap.SECTIONS.filter(function(s) { return s.nav; }).map(function(s) { return s.href; }));
  for (var item of nav.nav.concat(nav.footer)) assert.ok(item.en && item.zh, item.href + ' needs en and zh labels');
});

test('sitemap.xml lists every page in the site map', async function() {
  var sitemap = await (await fetch(base + '/sitemap.xml')).text();
  for (var href of siteMap.allPaths()) assert.ok(sitemap.includes('<loc>' + base + href + '</loc>'), href);
});

test('admin editors and admin routes match one-to-one', function() {
  var adminGets = adminRouter.stack
    .filter(function(layer) { return layer.route && layer.route.methods.get; })
    .map(function(layer) { return layer.route.path; });
  var listRoutes = adminGets.filter(function(route) { return /^\/[a-z-]+$/.test(route); });
  var editorHrefs = Object.keys(siteMap.ADMIN_EDITORS).map(function(key) { return siteMap.ADMIN_EDITORS[key].href; });
  for (var href of editorHrefs) assert.ok(adminGets.includes(href.replace(/^\/admin/, '')), href + ' has no route in routes/admin.js');
  for (var route of listRoutes) assert.ok(editorHrefs.includes('/admin' + route), '/admin' + route + ' is missing from ADMIN_EDITORS in config/siteMap.js');
});

test('every admin editor is attached to a site section, and every reference is valid', function() {
  var used = [];
  for (var group of siteMap.SECTIONS.concat(siteMap.UNLISTED)) {
    for (var key of group.admin || []) {
      assert.ok(siteMap.ADMIN_EDITORS[key], group.key + ' refers to unknown editor ' + key);
      used.push(key);
    }
  }
  for (var editor of Object.keys(siteMap.ADMIN_EDITORS)) assert.ok(used.includes(editor), editor + ' is not attached to any section');
});

test('admin dashboard and nav show every section and editor', async function() {
  var html = await ejs.renderFile(path.join(__dirname, '../views/admin/dashboard.ejs'), {
    title: 'Admin', adminUser: { name: 'Test' }, adminNav: siteMap.adminNav(), groups: siteMap.adminGroups()
  });
  for (var group of siteMap.SECTIONS.concat(siteMap.UNLISTED)) assert.ok(html.includes(group.en), group.key);
  for (var editor of siteMap.adminNav()) assert.ok(html.includes('href="' + editor.href + '"'), editor.href);
});
