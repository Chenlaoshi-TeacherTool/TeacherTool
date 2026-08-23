'use strict';

/*
 * Holds the in-memory toolGuides/articles used by routes/index.js. Loaded
 * from DAB at startup, and re-loaded on demand after an admin edit so the
 * public site reflects changes without a restart.
 */

var dabSiteContent = require('./dabSiteContentClient');

var state = { toolGuides: {}, articles: [] };

async function refresh() {
  state = await dabSiteContent.loadAll();
  return state;
}

function get() {
  return state;
}

module.exports = { get: get, refresh: refresh };
