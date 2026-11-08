/*
 * Word list handoff  ·  wordlist-handoff.js
 *
 * Passes one vocabulary list from the Vocab Game Switcher (/teaching-tools/vocab-games)
 * to a game page, the same way the word list library hands a list to the booklet tool.
 *
 *   ChenWordlistHandoff.openGame('/teaching-tools/bingo-generator', list);
 *     -> stores the list in sessionStorage and opens the game with ?wordlist=handoff
 *   ChenWordlistHandoff.active();
 *     -> on the game page: the handed-over list, or null when the page was opened normally
 *   ChenWordlistHandoff.mountBar(list);
 *     -> shows "Using: <list> · Switch game" at the top of the game page
 *
 * Games built on ChenLibraryPicker pick the list up automatically (see library-picker.js).
 */
(function (global) {
  'use strict';

  var KEY = 'chenlaoshi-game-wordlist';
  var PARAM = 'wordlist';
  var HUB = '/teaching-tools/vocab-games';
  var MAX_ITEMS = 300;

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  }

  function normalize(list) {
    var source = list && typeof list === 'object' ? list : {};
    var seen = Object.create(null);
    var items = [];
    (Array.isArray(source.items) ? source.items : []).forEach(function (item) {
      if (!item || items.length >= MAX_ITEMS) return;
      var zh = clean(item.zh, 80);
      if (!zh || seen[zh]) return;
      seen[zh] = true;
      items.push({
        zh: zh,
        py: clean(item.py, 120),
        en: clean(item.en, 200),
        img: clean(item.img || item.emoji, 500),
        note: clean(item.note, 300)
      });
    });
    return { name: clean(source.name || source.theme, 120), items: items };
  }

  function store(list) {
    var normalized = normalize(list);
    global.sessionStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  }

  function stored() {
    try {
      var raw = global.sessionStorage.getItem(KEY);
      if (!raw) return null;
      var list = normalize(JSON.parse(raw));
      return list.items.length ? list : null;
    } catch (error) {
      return null;
    }
  }

  function requested() {
    try { return new URLSearchParams(global.location.search).get(PARAM) === 'handoff'; }
    catch (error) { return false; }
  }

  // The handed-over list, only when this page was opened from the switcher.
  function active() {
    return requested() ? stored() : null;
  }

  function withParam(href) {
    return href + (href.indexOf('?') === -1 ? '?' : '&') + PARAM + '=handoff';
  }

  // Throws when sessionStorage is unavailable, so callers can show a message.
  function openGame(href, list) {
    store(list);
    global.location.href = withParam(href);
  }

  function openHub(list) {
    openGame(HUB, list);
  }

  function isZh() {
    return /^zh/i.test(global.document.documentElement.lang || '');
  }

  function mountBar(list) {
    var doc = global.document;
    if (!list || doc.getElementById('wlHandoffBar')) return;
    if (!doc.getElementById('wlHandoffStyle')) {
      var style = doc.createElement('style');
      style.id = 'wlHandoffStyle';
      style.textContent =
        '.wl-handoff-bar{position:sticky;top:0;z-index:900;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;' +
        'padding:9px 16px;background:#20473a;color:#fff;font:600 14px/1.4 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.18)}' +
        '.wl-handoff-bar span{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}' +
        '.wl-handoff-bar b{color:#ffd978}' +
        '.wl-handoff-bar a{flex:none;padding:6px 14px;border-radius:999px;background:#ffd978;color:#20473a;text-decoration:none;font-weight:700}' +
        '.wl-handoff-bar a:hover,.wl-handoff-bar a:focus-visible{background:#fff}' +
        '@media print{.wl-handoff-bar{display:none!important}}';
      doc.head.appendChild(style);
    }
    var zh = isZh();
    var bar = doc.createElement('div');
    bar.id = 'wlHandoffBar';
    bar.className = 'wl-handoff-bar';
    var label = doc.createElement('span');
    label.appendChild(doc.createTextNode(zh ? '🎮 正在使用词表：' : '🎮 Using word list: '));
    var name = doc.createElement('b');
    name.textContent = (list.name || (zh ? '我的词表' : 'My word list')) + ' (' + list.items.length + (zh ? ' 个词)' : ' words)');
    label.appendChild(name);
    var link = doc.createElement('a');
    link.href = withParam(HUB);
    link.textContent = zh ? '↩ 换个游戏' : '↩ Switch game';
    bar.appendChild(label);
    bar.appendChild(link);
    doc.body.insertBefore(bar, doc.body.firstChild);
  }

  global.ChenWordlistHandoff = {
    HUB: HUB,
    normalize: normalize,
    store: store,
    stored: stored,
    active: active,
    openGame: openGame,
    openHub: openHub,
    mountBar: mountBar
  };
})(window);
