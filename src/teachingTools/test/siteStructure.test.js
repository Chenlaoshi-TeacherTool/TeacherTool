'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
var products = [];
var articles = [];
store.refresh = async function() {};
store.get = function() { return { articles: articles, toolGuides: {}, recommendations: products }; };
var app = require('../app');
var server;
var base;

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() { server.close(); });

test('new section pages render in both languages with the required categories', async function() {
  var pages = {
    '/shop': ['Printable packs', 'Physical products'],
    '/shop/printable-packs': ['No printable packs are listed for sale yet.'],
    '/textbook-companion': ['Level 1', 'Level 2', 'Level 3'],
    '/textbook-companion/level-1': ['Homework packets', 'Projects', 'Vocabulary cards', 'Lesson agendas'],
    '/textbook-companion/level-2': ['Level 2'],
    '/textbook-companion/level-3': ['Level 3'],
    '/theme-activities/halloween': ['Vocabulary', 'Games', 'Printables'],
    '/theme-activities/chinese-new-year': ['Vocabulary', 'Games', 'Printables'],
    '/theme-activities/animals': ['Vocabulary', 'Games', 'Printables'],
    '/theme-activities/weather': ['Printables', '/theme-activities/weather/songs'],
    '/theme-activities/weather/songs': ['<html lang="en">'],
    '/theme-activities': ['/theme-activities/halloween', '/theme-activities/chinese-new-year', '/theme-activities/animals'],
    '/teaching-tools': ['/teaching-tools/random-group-generator']
  };
  for (var path of Object.keys(pages)) {
    var response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    var html = await response.text();
    for (var expected of pages[path]) assert.ok(html.includes(expected), path + ': ' + expected);
    var zh = await fetch(base + path, { headers: { Cookie: 'lang=zh' } });
    assert.equal(zh.status, 200, path + ' zh');
    assert.ok((await zh.text()).includes('<html lang="zh">'), path + ' language');
  }
});

test('legacy URLs redirect to the reorganized content', async function() {
  var response = await fetch(base + '/recommendations', { redirect: 'manual' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), '/classroom-finds');
});

test('physical products go to the eBay store', async function() {
  var ebay = 'https://www.ebay.com/usr/clsteachingtools';
  for (var path of ['/shop/physical-products', '/classroom-shop']) {
    var response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 302, path);
    assert.equal(response.headers.get('location'), ebay, path);
  }
  var shop = await (await fetch(base + '/shop')).text();
  assert.ok(shop.includes('href="' + ebay + '"'));
  var sitemap = await (await fetch(base + '/sitemap.xml')).text();
  assert.ok(!sitemap.includes('/shop/physical-products'));
});

test('product detail pages preserve published content and fallback; unknown pages return 404', async function() {
  var fallback = await fetch(base + '/classroom-finds/15-drawer-rolling-cart');
  assert.equal(fallback.status, 200);
  assert.ok((await fallback.text()).includes('https://amzn.to/4qpPByl'));
  products = [{ slug: 'test-cart', title: 'Test cart', imageUrl: '/images/15-drawer-rolling-cart.png', description: 'Published description', productUrl: 'https://amzn.to/example', reasons: [{ title: 'Storage', text: 'Published reason' }], printableLabelUrl: '/labels.pdf' }];
  try {
    var listing = await (await fetch(base + '/classroom-finds')).text();
    assert.ok(listing.includes('/classroom-finds/test-cart'));
    var detail = await (await fetch(base + '/classroom-finds/test-cart')).text();
    for (var expected of ['Published description', 'Published reason', '/labels.pdf', 'https://amzn.to/example', 'sponsored nofollow']) assert.ok(detail.includes(expected));
    for (var path of ['/classroom-finds/missing', '/classroom-finds/15-drawer-rolling-cart', '/textbook-companion/level-4', '/theme-activities/missing', '/shop/missing']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    var sitemap = await (await fetch(base + '/sitemap.xml')).text();
    for (var path of ['/shop', '/textbook-companion/level-3', '/theme-activities/animals', '/classroom-finds/test-cart']) assert.ok(sitemap.includes(base + path));
  } finally { products = []; }
});


test('retired resources listing returns 410 and is excluded from sitemap and navigation', async function() {
  for (var path of ['/resources', '/resources/', '/resources?category=games']) {
    assert.equal((await fetch(base + path)).status, 410, path);
  }
  var sitemap = await (await fetch(base + '/sitemap.xml')).text();
  assert.ok(!sitemap.includes('<loc>' + base + '/resources</loc>'));
  var nav = await (await fetch(base + '/javascripts/milk-tea-footer.js')).text();
  assert.ok(!nav.includes('href="/resources"'));
});


test('existing article pages remain available after retiring the list', async function() {
  articles = [{ slug: 'retained-article', title: 'Retained article', category: 'Classroom', intro: ['Existing content'], sections: [], relatedTool: { href: '/teaching-tools', label: 'Teaching Tools' } }];
  try {
    var response = await fetch(base + '/resources/retained-article');
    assert.equal(response.status, 200);
    var html = await response.text();
    assert.ok(html.includes('Existing content'));
    assert.ok(!html.includes('href="/resources"'));
  } finally { articles = []; }
});
