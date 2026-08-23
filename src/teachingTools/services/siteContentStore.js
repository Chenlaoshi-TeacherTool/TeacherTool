'use strict';

/*
 * Holds the in-memory toolGuides/articles used by routes/index.js. Loaded
 * once at startup from DAB (or the bundled data/site-content.js module if
 * DAB_BASE_URL isn't set), and re-loaded on demand after an admin edit so
 * the public site reflects changes without a restart.
 */

var siteContent = require('../data/site-content');
var dabSiteContent = require('./dabSiteContentClient');

var state = { toolGuides: siteContent.toolGuides, articles: siteContent.articles };

async function refresh() {
  if (!process.env.DAB_BASE_URL) return state;
  state = await dabSiteContent.loadAll();
  return state;
}

function get() {
  return state;
}

module.exports = { get: get, refresh: refresh };
