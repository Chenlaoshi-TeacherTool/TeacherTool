/*!
 * Emoji 匹配核心模块  emoji-core.js
 * 陈老师教学工具  ·  Chen Laoshi Teaching Tools
 *
 * 这个文件做一件事：把一个词（中文 / 英文）匹配到一个免费商用的 OpenMoji 表情。
 *   · 数据来自 OpenMoji（CC BY-SA 4.0，可免费商用）：https://openmoji.org
 *   · openmoji.json 由 CDN 提供，带一年 immutable 缓存，浏览器只下载一次
 *   · 索引在内存里缓存（load 只真正拉取一次），不占用 localStorage
 *
 * OpenMoji 的标注（annotation / tags）是英文的，所以匹配走的是英文。
 * 如果只有中文、没有英文，可传 { translate: true }，本模块会用
 * window.ChenWordlist.toEnglish 先把中文兜底翻成英文再匹配。
 *
 * 其他页面只要加一行：<script src="/shared/emoji-core.js"><\/script>
 * 就能用 window.ChenEmoji 里的所有方法。放在 wordlist-core.js 之后即可。
 *
 * 用法：
 *   const stats = await ChenEmoji.matchAll(items, { translate: true });
 *   // 每个 item 会被写入 item.openmoji = { emoji, hexcode, annotation } | null
 *   img.src = ChenEmoji.svgUrl(item.openmoji.hexcode);
 *
 * item 形状：{ zh?: string, en?: string, emoji?: string }
 *   · emoji 有值时视为「手动指定」，直接采用（并尝试补全 hexcode）
 *   · 否则用 en（或 translate 后的中文英译）去匹配 OpenMoji
 */
(function (global) {
  'use strict';

  // ---------- 常量 ----------
  var OPENMOJI_VERSION = '17.0.0';
  var OPENMOJI_BASE = 'https://cdn.jsdelivr.net/npm/openmoji@' + OPENMOJI_VERSION;
  var OPENMOJI_DATA_URL = OPENMOJI_BASE + '/data/openmoji.json';
  var OPENMOJI_SVG_BASE = OPENMOJI_BASE + '/color/svg/';
  var OPENMOJI_PNG_BASE = OPENMOJI_BASE + '/color/72x72/';
  var OPENMOJI_CREDIT = 'Emoji artwork by OpenMoji · CC BY-SA 4.0 · openmoji.org';

  // 命中所需的最低分（低于此值视为没匹配上）
  var MATCH_THRESHOLD = 500;

  var indexPromise = null;
  var pngCache = Object.create(null);

  // ---------- 文本归一化 ----------
  function normalizeEmoji(value) {
    return String(value || '').replace(/️/g, '').trim();
  }

  function emojiToHex(value) {
    var emoji = String(value || '').trim();
    if (!emoji) return '';
    var hex = Array.from(emoji).map(function (character) {
      return character.codePointAt(0).toString(16).padStart(4, '0').toUpperCase();
    }).join('-');
    return hex.length === 10 ? hex.replace('-FE0F', '') : hex;
  }

  function stemWord(word) {
    if (word.length > 5 && /ing$/.test(word)) {
      var stem = word.slice(0, -3);
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) stem = stem.slice(0, -1);
      return stem;
    }
    if (word.length > 4 && /ied$/.test(word)) return word.slice(0, -3) + 'y';
    if (word.length > 4 && /ed$/.test(word)) return word.slice(0, -2);
    if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3) + 'y';
    if (word.length > 3 && /s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
    return word;
  }

  function normalizeSearch(value) {
    var stopWords = { a: 1, an: 1, the: 1, to: 1, of: 1, with: 1, and: 1, or: 1, for: 1, in: 1, on: 1 };
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[_-]/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter(function (word) { return word && !stopWords[word]; })
      .map(stemWord)
      .join(' ');
  }

  // ---------- 建索引 ----------
  function buildIndex(rows) {
    var entries = [];
    var byEmoji = Object.create(null);
    var byAnnotation = Object.create(null);

    rows.forEach(function (row, order) {
      if (!row || !row.emoji || !row.hexcode || row.skintone || /^extras-/i.test(row.group || '') || /^E[0-9A-F]/i.test(row.hexcode)) return;
      var annotation = normalizeSearch(row.annotation);
      var tags = String((row.tags || '') + ',' + (row.openmoji_tags || ''))
        .split(',')
        .map(normalizeSearch)
        .filter(Boolean);
      var entry = {
        emoji: row.emoji,
        hexcode: row.hexcode.toUpperCase(),
        annotation: row.annotation || 'emoji',
        normalizedAnnotation: annotation,
        annotationWords: annotation.split(' ').filter(Boolean),
        tags: tags,
        tagWords: normalizeSearch(tags.join(' ')).split(' ').filter(Boolean),
        group: row.group || '',
        order: order,
      };
      entries.push(entry);
      byEmoji[normalizeEmoji(row.emoji)] = entry;
      if (annotation && !byAnnotation[annotation]) byAnnotation[annotation] = entry;
    });

    return { entries: entries, byEmoji: byEmoji, byAnnotation: byAnnotation };
  }

  function load() {
    if (!indexPromise) {
      indexPromise = fetch(OPENMOJI_DATA_URL, { mode: 'cors', credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) throw new Error('OpenMoji metadata returned ' + response.status);
          return response.json();
        })
        .then(buildIndex)
        .catch(function (error) {
          indexPromise = null;
          throw error;
        });
    }
    return indexPromise;
  }

  // ---------- 打分与匹配 ----------
  function queryVariants(value) {
    var raw = String(value || '').trim();
    if (!raw) return [];
    var variants = [raw].concat(raw.split(/[\/,;]+/));
    var seen = Object.create(null);
    return variants.map(normalizeSearch).filter(function (query) {
      if (!query || seen[query]) return false;
      seen[query] = true;
      return true;
    });
  }

  function entryScore(entry, query) {
    var queryWords = query.split(' ').filter(Boolean);
    if (!queryWords.length) return 0;
    if (entry.normalizedAnnotation === query) return 1200;

    var annotationContainsAll = queryWords.every(function (word) {
      return entry.annotationWords.indexOf(word) >= 0;
    });
    var colorWords = { black: 1, blue: 1, brown: 1, green: 1, grey: 1, orange: 1, purple: 1, red: 1, white: 1, yellow: 1 };
    var colorQualifiedLabel = queryWords.length === 1
      && entry.annotationWords[entry.annotationWords.length - 1] === queryWords[0]
      && entry.annotationWords.slice(0, -1).length > 0
      && entry.annotationWords.slice(0, -1).every(function (word) { return colorWords[word]; });
    if (colorQualifiedLabel) return 1000 - Math.min(120, entry.annotationWords.length * 4);
    if (entry.tags.indexOf(query) >= 0) return 900 - Math.min(100, entry.annotationWords.length * 3);
    if (annotationContainsAll) return 760 - Math.min(120, entry.annotationWords.length * 4);

    var tagsContainAll = queryWords.every(function (word) {
      return entry.tagWords.indexOf(word) >= 0;
    });
    if (tagsContainAll) return 560 - Math.min(100, entry.annotationWords.length * 2);
    return 0;
  }

  // ---------- 搜索（给搜索框用，返回多个排序结果） ----------
  // 比 entryScore 更宽松：支持前缀 / 子串，方便边打字边搜。
  function searchScore(entry, query) {
    if (entry.normalizedAnnotation === query) return 1000;
    if (entry.annotationWords.indexOf(query) >= 0) return 850;
    var annStarts = entry.annotationWords.some(function (w) { return w.indexOf(query) === 0; });
    if (annStarts) return 700;
    if (entry.normalizedAnnotation.indexOf(query) >= 0) return 560;
    if (entry.tags.indexOf(query) >= 0) return 480;
    var tagStarts = entry.tagWords.some(function (w) { return w.indexOf(query) === 0; });
    if (tagStarts) return 360;
    if (entry.tagWords.indexOf(query) >= 0) return 300;
    return 0;
  }

  /**
   * 搜索 emoji，返回按相关度排序的数组（每项是索引里的 entry）。
   * 中文查询会自动经 window.ChenWordlist.toEnglish 翻成英文再搜。
   * @param {string} query
   * @param {object} index  load() 的返回值
   * @param {{limit?:number}} [opts]
   * @returns {Array}
   */
  function search(query, index, opts) {
    opts = opts || {};
    var limit = opts.limit || 80;
    var raw = String(query || '').trim();
    if (!raw || !index) return [];

    // 组装查询词：中文先翻成英文；同时保留原文归一化结果。
    var queries = [];
    if (/[一-鿿]/.test(raw)) {
      var CW = global.ChenWordlist;
      if (CW && typeof CW.toEnglish === 'function') {
        var en = normalizeSearch(CW.toEnglish(raw));
        if (en) queries.push(en);
      }
    }
    var normRaw = normalizeSearch(raw);
    if (normRaw && queries.indexOf(normRaw) < 0) queries.push(normRaw);
    if (!queries.length) return [];

    var scored = [];
    for (var i = 0; i < index.entries.length; i++) {
      var entry = index.entries[i];
      var best = 0;
      for (var q = 0; q < queries.length; q++) {
        var s = searchScore(entry, queries[q]);
        if (s > best) best = s;
      }
      if (best > 0) scored.push({ entry: entry, score: best });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.order - b.entry.order;
    });
    return scored.slice(0, limit).map(function (x) { return x.entry; });
  }

  // 把中文兜底翻成英文（需要 window.ChenWordlist，且 opts.translate 为真）
  function englishFor(item, opts) {
    if (item.en) return item.en;
    if (opts && opts.translate && item.zh) {
      var CW = global.ChenWordlist;
      if (CW && typeof CW.toEnglish === 'function') {
        var en = CW.toEnglish(item.zh);
        if (en) return en;
      }
    }
    return item.en || item.zh;
  }

  /**
   * 匹配单个词。
   * @param {{zh?:string, en?:string, emoji?:string}} item
   * @param {object} index  load() 的返回值
   * @param {{translate?:boolean}} [opts]
   * @returns {{emoji:string, hexcode:string, annotation:string} | null}
   */
  function match(item, index, opts) {
    item = item || {};
    var override = String(item.emoji || '').trim();
    if (override) {
      var exact = index.byEmoji[normalizeEmoji(override)];
      return exact || {
        emoji: override,
        hexcode: emojiToHex(override),
        annotation: item.en || item.zh || 'emoji',
      };
    }

    var queries = queryVariants(englishFor(item, opts));
    var best = null;
    var bestScore = 0;
    for (var q = 0; q < queries.length; q++) {
      var exactAnnotation = index.byAnnotation[queries[q]];
      if (exactAnnotation) return exactAnnotation;
      for (var i = 0; i < index.entries.length; i++) {
        var score = entryScore(index.entries[i], queries[q]);
        if (score > bestScore || (score === bestScore && best && index.entries[i].order < best.order)) {
          best = index.entries[i];
          bestScore = score;
        }
      }
    }
    return bestScore >= MATCH_THRESHOLD ? best : null;
  }

  /**
   * 批量匹配。会把结果写回每个 item.openmoji，并返回统计。
   * @param {Array} items
   * @param {{translate?:boolean}} [opts]
   * @returns {Promise<{matched:number, unmatched:number, index:object}>}
   */
  function matchAll(items, opts) {
    return load().then(function (index) {
      var matched = 0;
      (items || []).forEach(function (item) {
        item.openmoji = match(item, index, opts);
        if (item.openmoji && item.openmoji.hexcode) matched += 1;
      });
      return { matched: matched, unmatched: (items || []).length - matched, index: index };
    });
  }

  // ---------- 图片 URL / 下载 ----------
  function svgUrl(hexcode) {
    return OPENMOJI_SVG_BASE + encodeURIComponent(hexcode) + '.svg';
  }

  function pngUrl(hexcode) {
    return OPENMOJI_PNG_BASE + encodeURIComponent(hexcode) + '.png';
  }

  // 下载 PNG 字节（供 Word / 图片导出用），带内存缓存。失败返回 null。
  function fetchPng(hexcode) {
    if (!hexcode) return Promise.resolve(null);
    if (!pngCache[hexcode]) {
      pngCache[hexcode] = fetch(pngUrl(hexcode), { mode: 'cors', credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) throw new Error('OpenMoji image returned ' + response.status);
          return response.arrayBuffer();
        })
        .then(function (buffer) { return new Uint8Array(buffer); })
        .catch(function () { return null; });
    }
    return pngCache[hexcode];
  }

  // ---------- 导出 ----------
  global.ChenEmoji = {
    version: '1.0',
    OPENMOJI_VERSION: OPENMOJI_VERSION,
    CREDIT: OPENMOJI_CREDIT,
    BASE_URL: OPENMOJI_BASE,
    DATA_URL: OPENMOJI_DATA_URL,
    load: load,
    match: match,
    matchAll: matchAll,
    search: search,
    svgUrl: svgUrl,
    pngUrl: pngUrl,
    fetchPng: fetchPng,
    // 低层工具，供复用 / 测试
    normalizeSearch: normalizeSearch,
    emojiToHex: emojiToHex,
    buildIndex: buildIndex,
  };
})(typeof window !== 'undefined' ? window : this);
