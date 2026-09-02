(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FlashCardCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var CARD_COUNT = 8;

  function clean(value) {
    return String(value == null ? '' : value).replace(/\u3000/g, ' ').trim();
  }

  function stripListMarker(value) {
    return clean(value).replace(/^(?:[-*•]\s*|\d{1,3}[.)、]\s*)/, '').trim();
  }

  function looksLikePinyin(value) {
    return /^[A-Za-zÜüVvāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜńňǹḿ\s'-]+$/.test(clean(value));
  }

  function splitPlainLine(line) {
    var parts = line.split(/\s*[、,，;；]\s*/).map(clean).filter(Boolean);
    return parts.length > 1 ? parts : [line];
  }

  function parseOne(value, pinyinFn, englishFn) {
    var line = stripListMarker(value);
    if (!line) return null;

    var pieces = line.split(/\s*(?:\||｜|\t)\s*/).map(clean);
    var zh = pieces[0] || '';
    var py = pieces[1] || '';
    var en = pieces[2] || '';

    if (pieces.length === 1) {
      var spaced = line.match(/^(.+?[\u3400-\u9fff])\s+([A-Za-zÜüVvāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜńňǹḿ][A-Za-zÜüVvāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜńňǹḿ\s'-]*)$/);
      if (spaced && looksLikePinyin(spaced[2])) {
        zh = clean(spaced[1]);
        py = clean(spaced[2]);
      }
    }

    if (!zh) return null;
    if (!py && typeof pinyinFn === 'function') py = clean(pinyinFn(zh));
    if (!en && typeof englishFn === 'function') en = clean(englishFn(zh));
    return { zh: zh, py: py, en: en };
  }

  function parseEntries(text, pinyinFn, englishFn) {
    var items = [];
    var seen = Object.create(null);
    String(text || '').split(/\r?\n/).forEach(function (rawLine) {
      var line = stripListMarker(rawLine);
      if (!line) return;

      var candidates = /(?:\||｜|\t)/.test(line) ? [line] : splitPlainLine(line);
      candidates.forEach(function (candidate) {
        var item = parseOne(candidate, pinyinFn, englishFn);
        if (!item || seen[item.zh]) return;
        seen[item.zh] = true;
        items.push(item);
      });
    });
    return items;
  }

  function makeSlots(entries) {
    var slots = new Array(CARD_COUNT).fill(null);
    (entries || []).slice(0, CARD_COUNT).forEach(function (item, index) {
      slots[index] = item;
    });
    return slots;
  }

  // A long-edge duplex flip swaps the left and right physical positions.
  // Mirroring each row keeps every pinyin back behind its matching front.
  function mirrorBackSlots(entriesOrSlots) {
    var source = entriesOrSlots && entriesOrSlots.length === CARD_COUNT
      ? entriesOrSlots.slice()
      : makeSlots(entriesOrSlots || []);
    var mirrored = new Array(CARD_COUNT).fill(null);
    for (var row = 0; row < 4; row++) {
      mirrored[row * 2] = source[row * 2 + 1];
      mirrored[row * 2 + 1] = source[row * 2];
    }
    return mirrored;
  }

  function paginate(entries) {
    var pages = [];
    for (var index = 0; index < (entries || []).length; index += CARD_COUNT) {
      pages.push(entries.slice(index, index + CARD_COUNT));
    }
    return pages;
  }

  return {
    CARD_COUNT: CARD_COUNT,
    parseEntries: parseEntries,
    makeSlots: makeSlots,
    mirrorBackSlots: mirrorBackSlots,
    paginate: paginate
  };
});
