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
  } else if (!root.ChenZhScript) {
    // Loaded twice on one page (tool + 繁 UI): keep the first copy and its table.
    root.ChenZhScript = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATA_URL = '/shared/zh-script-data.json?v=2';
  var GZIP_URL = '/shared/zh-script-data.json.gz?v=2';
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
      loading = fetchTable(url)
        .then(function (data) { useTable(data); return api; })
        .catch(function (error) { loading = null; throw error; });
    }
    return loading;
  }

  // The site has no gzip middleware, so the table is also stored as .json.gz
  // (about half the size) and unpacked here; plain JSON if that is not possible.
  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function fetchTable(url) {
    if (url || typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return fetchJson(url || DATA_URL);
    return fetch(GZIP_URL)
      .then(function (response) {
        if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
        return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      })
      .catch(function () { return fetchJson(DATA_URL); });
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

  // OpenCC only knows 一只 / 两只 …; "24 只" or "3只猫" is the measure word too,
  // unless 只 starts 只有 / 只是 / 只要 ….
  var DIGIT_ZHI = /([0-9０-９]\s?)只(?![有是要好能会可])/g;

  function toTraditional(value) {
    ensure();
    var out = run(s2t, value);
    return out.indexOf('只') === -1 ? out : out.replace(DIGIT_ZHI, '$1隻');
  }
  function toSimplified(value) { ensure(); return run(t2s, value); }

  // script: 't' / 'hant' / 'zh-Hant' → traditional; anything else leaves the text as it is.
  function convert(value, script) {
    return isTraditional(script) ? toTraditional(value) : (value == null ? '' : String(value));
  }

  function isTraditional(script) {
    return script === 't' || script === 'hant' || script === 'zh-Hant';
  }

  // Content in the chosen script, whichever script it was typed in.
  // 's' → toSimplified. 't' → toTraditional, but characters the teacher already
  // typed in traditional stay as typed (裡 stays 裡, not 裏).
  function toScript(value, script) {
    var simplified = toSimplified(value);
    if (!isTraditional(script)) return simplified;
    var source = Array.from(value == null ? '' : String(value));
    var simp = Array.from(simplified);
    var trad = Array.from(toTraditional(simplified));
    for (var i = 0; i < source.length; i += 1) if (simp[i] !== source[i]) trad[i] = source[i];
    return trad.join('');
  }

  // True when more characters change going to 简 than going to 繁, i.e. the
  // text was most likely typed in traditional characters.
  function looksTraditional(value) {
    var source = Array.from(value == null ? '' : String(value));
    if (!source.length) return false;
    var simp = Array.from(toSimplified(source.join('')));
    var trad = Array.from(toTraditional(source.join('')));
    var toS = 0;
    var toT = 0;
    for (var i = 0; i < source.length; i += 1) {
      if (simp[i] !== source[i]) toS += 1;
      if (trad[i] !== source[i]) toT += 1;
    }
    return toS > toT;
  }

  api.DATA_URL = DATA_URL;
  api.useTable = useTable;
  api.hasTable = hasTable;
  api.load = load;
  api.toTraditional = toTraditional;
  api.toSimplified = toSimplified;
  api.convert = convert;
  api.isTraditional = isTraditional;
  api.toScript = toScript;
  api.looksTraditional = looksTraditional;
  return api;
});
