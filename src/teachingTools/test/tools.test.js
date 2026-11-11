'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
var tools = require('../config/tools');
var translations = require('../locales/translations');
var slugForPath = require('../services/popularTools').slugForPath;

function translated(lang, key) {
  return key.split('.').reduce(function(node, part) { return node && node[part]; }, translations[lang]) !== undefined;
}

test('every catalog entry is complete and translated in both languages', function() {
  tools.TOOLS.forEach(function(tool) {
    var name = tool.href || tool.titleKey;
    assert.ok(tools.SECTIONS.indexOf(tool.section) !== -1, name + ' section');
    assert.equal(tool.section === 'coming-soon', Boolean(tool.comingSoon), name + ' coming-soon section');
    tool.uses.forEach(function(use) { assert.ok(['print', 'project', 'independent', 'manage'].indexOf(use) !== -1, name + ' use ' + use); });
    assert.equal(Boolean(tool.href), !tool.comingSoon, name + ' needs a page or comingSoon');
    var keys = [tool.titleKey, tool.scopeKey, tool.descKey].concat(tool.href ? [tool.actionKey] : []);
    keys.forEach(function(key) {
      ['en', 'zh'].forEach(function(lang) { assert.ok(key && translated(lang, key), name + ' ' + lang + ' ' + key); });
    });
  });
  tools.sections().forEach(function(section) {
    assert.ok(section.tools.length > 0, section.key + ' is empty');
    ['en', 'zh'].forEach(function(lang) {
      ['heading', 'desc'].forEach(function(part) { assert.ok(translated(lang, 'teachingToolsIndex.groups.' + section.key + '.' + part), section.key + ' ' + lang + ' ' + part); });
    });
  });
  var hrefs = tools.LIVE.map(function(tool) { return tool.href; });
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test('every /teaching-tools/<slug> page is in the catalog or deliberately unlisted', function() {
  var listed = tools.LIVE.map(function(tool) { return slugForPath(tool.href); });
  var routed = [require('../routes/index'), require('../routes/bookGenerator')].reduce(function(all, router) {
    return all.concat(router.stack.filter(function(layer) { return layer.route && typeof layer.route.path === 'string'; }).map(function(layer) { return layer.route.path; }));
  }, []).map(function(path) { return (/^\/teaching-tools\/([^/:]+)$/.exec(path) || [])[1]; }).filter(Boolean);

  assert.ok(routed.length >= 30);
  routed.forEach(function(slug) {
    assert.ok(listed.indexOf(slug) !== -1 || tools.UNLISTED[slug], slug + ' has a page but no entry in config/tools.js');
  });
  Object.keys(tools.UNLISTED).forEach(function(slug) {
    assert.ok(routed.indexOf(slug) !== -1, slug + ' is unlisted but has no page');
    assert.ok(listed.indexOf(slug) === -1, slug + ' is both listed and unlisted');
  });
});
