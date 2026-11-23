'use strict';

var tools = require('../config/tools');
var i18n = require('./i18n');
var previews = require('../config/toolPreviews.json');

// Small card data for every live tool, in one language. The home page and
// My Space build the "My favorite tools" cards from it in the browser.
function cards(lang) {
  return tools.LIVE.map(function (tool) {
    return {
      href: tool.href,
      icon: tool.icon || '',
      title: i18n.t(lang, tool.titleKey),
      desc: i18n.t(lang, tool.descKey),
      preview: previews[tool.href] || null
    };
  });
}

// Safe to put inside <script type="application/json"> (no "</script>" or "<!--").
function json(lang) {
  return JSON.stringify(cards(lang)).replace(/</g, '\\u003c');
}

module.exports = { cards: cards, json: json };
