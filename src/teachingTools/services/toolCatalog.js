'use strict';

// The tools in config/tools.js as the admin Tool Videos list needs them: a new
// catalog entry shows up in /admin/toolvideos without other changes.

var i18n = require('./i18n');
var toolVideos = require('./toolVideos');
var tools = require('../config/tools');

// [{ path, href, zh, en }] in catalog order, one entry per tool page.
function list() {
  var seen = {};
  return tools.LIVE.reduce(function (all, tool) {
    var key = toolVideos.normalizePath(tool.href);
    if (!key || seen[key]) return all;
    seen[key] = true;
    function title(lang) { return (tool.icon ? tool.icon + ' ' : '') + i18n.t(lang, tool.titleKey); }
    return all.concat({ path: key, href: tool.href, zh: title('zh'), en: title('en') });
  }, []);
}

module.exports = { list: list };
