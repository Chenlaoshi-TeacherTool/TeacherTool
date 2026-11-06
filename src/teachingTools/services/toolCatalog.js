'use strict';

// Every tool card on /teaching-tools (views/teaching-tools/index.ejs), read
// from the template so the admin Tool Videos list follows the catalog: a new
// card there shows up in /admin/toolvideos without other changes.

var fs = require('fs');
var path = require('path');
var i18n = require('./i18n');
var toolVideos = require('./toolVideos');

var TEMPLATE = path.join(__dirname, '..', 'views', 'teaching-tools', 'index.ejs');

function resolve(text, lang) {
  return text
    .replace(/<%=\s*t\(\s*'([^']+)'\s*\)\s*%>/g, function (match, key) { return i18n.t(lang, key); })
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

// [{ path, href, zh, en }] in catalog order, one entry per tool page.
function list() {
  var source = fs.readFileSync(TEMPLATE, 'utf8');
  var tools = [];
  var seen = {};
  source.split(/class="tool-card/).slice(1).forEach(function (block) {
    var title = /<h3>([\s\S]*?)<\/h3>/.exec(block);
    var link = /<a href="(\/[^"#?]+)"/.exec(block);
    if (!title || !link) return;
    var key = toolVideos.normalizePath(link[1]);
    if (!key || seen[key]) return;
    seen[key] = true;
    tools.push({ path: key, href: link[1], zh: resolve(title[1], 'zh'), en: resolve(title[1], 'en') });
  });
  return tools;
}

module.exports = { list: list };
