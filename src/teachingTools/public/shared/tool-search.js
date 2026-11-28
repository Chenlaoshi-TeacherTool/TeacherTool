/*
 * Tool-card search match. The card's data-search text comes from
 * services/toolSearch.js (both languages, synonyms, 简 + 繁), so this only
 * splits the query into words and needs every word to appear.
 *
 *   ChenToolSearch.matches(card.dataset.search, input.value)
 */
(function (root) {
  'use strict';

  function terms(query) {
    return String(query || '')
      .toLowerCase()
      .replace(/[，、,;；。.!！?？“”"'()（）]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      // "cards" finds "card", "games" finds "game".
      .map(function (term) { return /^[a-z-]{4,}s$/.test(term) ? term.slice(0, -1) : term; });
  }

  function matches(searchText, query) {
    var list = terms(query);
    if (!list.length) return true;
    var text = String(searchText || '').toLowerCase();
    return list.every(function (term) { return text.indexOf(term) !== -1; });
  }

  var api = { terms: terms, matches: matches };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChenToolSearch = api;
})(typeof self !== 'undefined' ? self : this);
