/*
 * 简 / 繁 switch for a tool's content (worksheets, stroke data, games),
 * separate from the site's UI language. Needs /shared/zh-script.js first.
 *
 *   var script = ChenZhContent.create({
 *     mount: '#scriptSlot',          // element or selector the switch goes into
 *     label: '练习纸用字',            // optional, shown before the buttons
 *     onChange: function (s) { … }   // 's' or 't', called after the table is loaded
 *   });
 *   script.ready().then(…)           // table loaded
 *   script.value                     // 's' | 't'
 *   script.text('头发')               // content in the chosen script
 *   script.suggest(typedText)        // switch to 繁 when the teacher typed 繁 and
 *                                    // has not picked a script themselves
 *   script.region(element)           // mark a content area: lang attribute, and
 *                                    // the 繁 UI converter leaves it alone
 *   script.region(element, { convert: true })
 *                                    // …and convert all its text live, so a
 *                                    // tool needs no other change
 *
 * Starting value: ?script=t|s in the URL, then the teacher's last choice on any
 * tool (localStorage), then the site's 简/繁 setting.
 */
(function (root) {
  'use strict';

  var Zh = root.ChenZhScript;
  var STORE_KEY = 'chenZhContentScript';
  var STYLE_ID = 'zh-content-style';
  // !important: tool pages style every button (some by #id), and this switch
  // has to look the same everywhere.
  var CSS = '.zh-content-toggle{display:inline-flex;align-items:center;gap:8px;font-size:14px;flex-wrap:wrap}' +
    '.zh-content-toggle .zh-ct-buttons{display:inline-flex;border:1px solid #9fb8ad;border-radius:999px;overflow:hidden;background:#fff}' +
    '.zh-content-toggle .zh-ct-buttons button{all:unset!important;cursor:pointer!important;padding:5px 14px!important;font:inherit!important;line-height:1.4!important;color:#2f4b40!important;background:#fff!important}' +
    '.zh-content-toggle .zh-ct-buttons button+button{border-left:1px solid #9fb8ad!important}' +
    '.zh-content-toggle .zh-ct-buttons button[aria-pressed="true"]{background:#356e57!important;color:#fff!important;font-weight:600!important}' +
    '.zh-script-slot:not(:empty){margin-top:12px}' +
    '.zh-content-toggle .zh-ct-buttons button:focus-visible{outline:2px solid #e0a21b!important;outline-offset:-2px!important}';

  function cookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return match ? match[1] : '';
  }

  function siteScript() {
    return cookie('lang') === 'zh' && cookie('zhScript') === 'hant' ? 't' : 's';
  }

  function readStored() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function writeStored(value) {
    try { localStorage.setItem(STORE_KEY, value); } catch (e) { /* private window */ }
  }

  function normalize(value) {
    return value === 't' || value === 'hant' || value === 'zh-Hant' ? 't' : value === 's' || value === 'hans' ? 's' : null;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function create(options) {
    options = options || {};
    var fromUrl = normalize(new URLSearchParams(location.search).get('script'));
    var stored = normalize(readStored());
    var controller = {
      value: fromUrl || stored || siteScript(),
      chosen: Boolean(fromUrl || stored)
    };
    var regions = [];
    var buttons = {};
    var loading = null;

    controller.ready = function () {
      if (!loading) loading = Zh.load().then(function () { return controller; });
      return loading;
    };

    controller.text = function (value) {
      return Zh.hasTable() ? Zh.toScript(value, controller.value) : (value == null ? '' : String(value));
    };

    function paint() {
      Object.keys(buttons).forEach(function (key) {
        buttons[key].setAttribute('aria-pressed', String(key === controller.value));
      });
      regions.forEach(paintRegion);
    }

    function paintRegion(element) {
      element.setAttribute('data-no-convert', '');
      element.setAttribute('lang', controller.value === 't' ? 'zh-Hant' : 'zh-Hans');
      element.setAttribute('data-zh-content', controller.value);
    }

    // chosen: true when the teacher clicked; false for automatic switches.
    controller.set = function (value, chosen) {
      value = normalize(value) || 's';
      if (chosen) { controller.chosen = true; writeStored(value); }
      if (value === controller.value) return controller.ready();
      controller.value = value;
      paint();
      return controller.ready().then(function () {
        convertAll();
        if (options.onChange) options.onChange(value);
        return controller;
      });
    };

    controller.suggest = function (text) {
      if (controller.chosen || controller.value === 't' || !Zh.hasTable() || !Zh.looksTraditional(text)) return false;
      controller.value = 't';
      paint();
      convertAll();
      return true;
    };

    // region(el)                    — the tool converts its own text (controller.text)
    // region(el, { convert: true }) — this file converts every text node in el,
    //   now and whenever the tool redraws, from the text the tool wrote: switching
    //   back and forth never loses what was typed (裡 stays 裡). Inputs, textareas
    //   and contenteditable cells are left as the teacher typed them.
    controller.region = function (element, regionOptions) {
      if (typeof element === 'string') element = document.querySelector(element);
      if (!element || regions.indexOf(element) !== -1) return controller;
      regions.push(element);
      paintRegion(element);
      if (regionOptions && regionOptions.convert) watch(element);
      return controller;
    };

    var HAN = /[㐀-鿿豈-﫿]/;
    // Left as written: form fields, teacher-editable cells, and ruby pinyin (<rt>).
    var SKIP = 'textarea, script, style, input, select, rt, rp, [contenteditable]:not([contenteditable="false"])';
    // Text in these tags joins the text next to it, so 头 and 发 in separate
    // <span>s (ruby pinyin, 田字格 boxes) still convert as 頭髮, not 頭發.
    var INLINE = { SPAN: 1, RUBY: 1, RB: 1, B: 1, I: 1, EM: 1, STRONG: 1, U: 1, S: 1, SMALL: 1, SUB: 1, SUP: 1, MARK: 1, FONT: 1, A: 1, LABEL: 1, ABBR: 1, TSPAN: 1, TEXT: 1 };
    var original = new WeakMap(); // text node → the text the tool wrote
    var written = new WeakMap();  // text node → the text this file put there
    var watched = [];

    function eachText(root, fn) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (node.nodeType === 1) return node.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) fn(node);
    }

    function sourceOf(node) {
      if (!original.has(node) || node.nodeValue !== written.get(node)) original.set(node, node.nodeValue);
      return original.get(node);
    }

    function blockOf(node) {
      var element = node.parentElement;
      while (element && INLINE[element.tagName.toUpperCase()]) element = element.parentElement;
      return element;
    }

    // The whole region is converted as one string, then cut back into its text
    // nodes: conversion keeps the length, so every node gets its own slice.
    function collectRegion(element) {
      var nodes = [];
      var sources = [];
      eachText(element, function (node) { nodes.push(node); sources.push(sourceOf(node)); });
      return { nodes: nodes, sources: sources };
    }

    function writeRegion(found) {
      var parts = [];
      var lengths = [];
      var lastBlock = null;
      found.nodes.forEach(function (node, i) {
        var block = blockOf(node);
        parts.push((i && block !== lastBlock ? '\n' : '') + found.sources[i]);
        lengths.push(Array.from(found.sources[i]).length);
        lastBlock = block;
      });
      var whole = parts.join('');
      if (!HAN.test(whole)) return;
      var out = Array.from(Zh.toScript(whole, controller.value));
      var at = 0;
      lastBlock = null;
      found.nodes.forEach(function (node, i) {
        var block = blockOf(node);
        if (i && block !== lastBlock) at += 1;
        lastBlock = block;
        var next = out.slice(at, at + lengths[i]).join('');
        at += lengths[i];
        written.set(node, next);
        if (next !== node.nodeValue) node.nodeValue = next;
      });
    }

    function convertAll() {
      if (!Zh.hasTable()) return;
      var found = watched.map(collectRegion);
      // A teacher who has not picked a script and types 繁 gets 繁.
      if (!controller.chosen && controller.value === 's') {
        var text = found.map(function (f) { return f.sources.join('\n'); }).join('\n');
        if (HAN.test(text) && Zh.looksTraditional(text)) { controller.value = 't'; paint(); }
      }
      found.forEach(writeRegion);
    }

    function watch(element) {
      watched.push(element);
      controller.ready().then(function () {
        convertAll();
        new MutationObserver(function (records) {
          var changed = records.some(function (record) {
            return record.type === 'characterData' ? record.target.nodeValue !== written.get(record.target) : record.addedNodes.length > 0;
          });
          if (changed) convertAll();
        }).observe(element, { subtree: true, childList: true, characterData: true });
      }, function () { /* no table: content stays as written */ });
    }

    var mount = typeof options.mount === 'string' ? document.querySelector(options.mount) : options.mount;
    if (mount) {
      addStyle();
      var wrap = document.createElement('div');
      wrap.className = 'zh-content-toggle';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', options.label || '简体 / 繁體');
      if (options.label) {
        var label = document.createElement('span');
        label.textContent = options.label;
        wrap.appendChild(label);
      }
      var group = document.createElement('span');
      group.className = 'zh-ct-buttons';
      [['s', '简体'], ['t', '繁體']].forEach(function (pair) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = pair[1];
        button.setAttribute('data-no-convert', '');
        button.setAttribute('lang', pair[0] === 't' ? 'zh-Hant' : 'zh-Hans');
        button.addEventListener('click', function () { controller.set(pair[0], true); });
        buttons[pair[0]] = button;
        group.appendChild(button);
      });
      wrap.appendChild(group);
      mount.appendChild(wrap);
    }
    paint();
    return controller;
  }

  root.ChenZhContent = { create: create, siteScript: siteScript };
})(typeof self !== 'undefined' ? self : this);
