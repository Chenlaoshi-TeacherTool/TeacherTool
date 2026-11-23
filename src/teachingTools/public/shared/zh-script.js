/*
 * 简 ⇄ 繁 conversion shared by the whole site (browser + server).
 *
 * Browser: <script src="/shared/zh-script.js"></script>, then
 *   ChenZhScript.load().then(function () { ChenZhScript.toTraditional('头发'); });
 * Node:    require('./public/shared/zh-script') — the table loads on first use.
 *
 * The table (zh-script-data.json) is built from OpenCC by scripts/build-zh-script.js.
 * Target is 通用繁体 (為、眾、床、裏、着). Conversion never changes the length:
 * one character in, one character out, so pinyin worked out on the simplified
 * text still lines up with the traditional characters.
 *
 * Rules for callers:
 *   - Work out pinyin, English and emoji on the simplified text, then convert
 *     the characters for display.
 *   - Text a teacher types in traditional goes through toSimplified() before
 *     any lookup.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    api._nodeLoad = function () { return require('./zh-script-data.json'); };
    module.exports = api;
  } else {
    root.ChenZhScript = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATA_URL = '/shared/zh-script-data.json?v=1';
  var api = {};
  var s2t = null;
  var t2s = null;
  var loading = null;

  function parseChars(packed) {
    var map = Object.create(null);
    var list = Array.from(packed || '');
    for (var i = 0; i + 1 < list.length; i += 2) map[list[i]] = list[i + 1];
    return map;
  }

  // phrases: "简繁 简繁 …" — each entry is the source followed by a target of the same length.
  function parsePhrases(packed) {
    var map = Object.create(null);
    var longest = Object.create(null); // first character → longest phrase starting with it
    (packed || '').split(' ').forEach(function (entry) {
      var list = Array.from(entry);
      var half = list.length / 2;
      if (half < 2 || half !== Math.floor(half)) return;
      var key = list.slice(0, half).join('');
      map[key] = list.slice(half);
      if (!longest[list[0]] || longest[list[0]] < half) longest[list[0]] = half;
    });
    return { map: map, longest: longest };
  }

  function makeTable(chars, phrases) {
    return { chars: parseChars(chars), phrases: parsePhrases(phrases) };
  }

  function useTable(data) {
    if (!data || typeof data.s2tChars !== 'string') throw new Error('Not a zh-script table');
    s2t = makeTable(data.s2tChars, data.s2tPhrases);
    t2s = makeTable(data.t2sChars, data.t2sPhrases);
  }

  function ensure() {
    if (s2t) return true;
    if (api._nodeLoad) { useTable(api._nodeLoad()); return true; }
    return false;
  }

  function hasTable() { return Boolean(s2t); }

  // Browser: fetch the table once. Resolves at once if it is already there.
  function load(url) {
    if (ensure()) return Promise.resolve(api);
    if (!loading) {
      loading = fetch(url || DATA_URL)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) { useTable(data); return api; })
        .catch(function (error) { loading = null; throw error; });
    }
    return loading;
  }

  // Longest phrase first (as OpenCC does), otherwise character by character.
  function run(table, value) {
    var source = value == null ? '' : String(value);
    if (!source || !table) return source;
    var list = Array.from(source);
    var out = new Array(list.length);
    var phrases = table.phrases;
    for (var i = 0; i < list.length;) {
      var max = phrases.longest[list[i]];
      var matched = 0;
      if (max) {
        for (var len = Math.min(max, list.length - i); len >= 2; len -= 1) {
          var hit = phrases.map[list.slice(i, i + len).join('')];
          if (hit) {
            for (var k = 0; k < len; k += 1) out[i + k] = hit[k];
            matched = len;
            break;
          }
        }
      }
      if (matched) { i += matched; continue; }
      out[i] = table.chars[list[i]] || list[i];
      i += 1;
    }
    return out.join('');
  }

  function toTraditional(value) { ensure(); return run(s2t, value); }
  function toSimplified(value) { ensure(); return run(t2s, value); }

  // script: 't' / 'hant' / 'zh-Hant' → traditional; anything else leaves the text as it is.
  function convert(value, script) {
    return isTraditional(script) ? toTraditional(value) : (value == null ? '' : String(value));
  }

  function isTraditional(script) {
    return script === 't' || script === 'hant' || script === 'zh-Hant';
  }

  api.DATA_URL = DATA_URL;
  api.useTable = useTable;
  api.hasTable = hasTable;
  api.load = load;
  api.toTraditional = toTraditional;
  api.toSimplified = toSimplified;
  api.convert = convert;
  api.isTraditional = isTraditional;
  return api;
});
