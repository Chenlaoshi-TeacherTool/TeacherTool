'use strict';

// /healthz, gzip, and the cached nav script (see app.js).
var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
store.get = function() { return { articles: [], toolGuides: {}, recommendations: [] }; };
var contentCatalog = require('../services/contentCatalog');
var loads = 0;
var realLoad = contentCatalog.load;
contentCatalog.load = function() { loads++; return realLoad.apply(this, arguments); };
var app = require('../app');
var server;
var base;

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() { server.close(); });

test('/healthz answers ok on the default Azure address without a redirect', async function() {
  var previousSite = process.env.SITE_URL;
  var previousAzure = process.env.WEBSITE_HOSTNAME;
  process.env.SITE_URL = 'https://clsteachingtools.com';
  process.env.WEBSITE_HOSTNAME = 'chenlaoshi-teachingtools.azurewebsites.net';
  try {
    var response = await fetch(base + '/healthz', { redirect: 'manual', headers: { 'x-forwarded-host': 'chenlaoshi-teachingtools.azurewebsites.net' } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'ok');
  } finally {
    if (previousSite === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = previousSite;
    if (previousAzure === undefined) delete process.env.WEBSITE_HOSTNAME; else process.env.WEBSITE_HOSTNAME = previousAzure;
  }
});

test('pages are gzipped when the browser accepts it', async function() {
  var response = await fetch(base + '/teaching-tools', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
});

test('the nav script is built once and cached by the browser for 5 minutes', async function() {
  var before = loads;
  var first = await fetch(base + '/javascripts/milk-tea-footer.js');
  var second = await fetch(base + '/javascripts/milk-tea-footer.js');
  assert.equal(first.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(await first.text(), await second.text());
  assert.ok(loads - before <= 1, 'catalog loaded ' + (loads - before) + ' times for two requests');
});
