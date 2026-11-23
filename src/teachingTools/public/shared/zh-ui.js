/*
 * 中文 · 繁: converts the text that page scripts build after load.
 * The server converts the page itself and adds this file (services/zhHant.js);
 * it needs /shared/zh-script.js (ChenZhScript) loaded first.
 *
 * Converted: text nodes, and the title / alt / placeholder / aria-label
 * attributes, plus the label of <input type=button|submit|reset>.
 * Left alone, with everything inside them:
 *   - <script>, <style>, <textarea>, <input> values, contenteditable areas
 *   - anything inside [data-no-convert] — use it for a tool's own content
 *     when the tool has its own 简/繁 choice, or when code reads the text back
 * Code that needs the original text should keep it in a data attribute, not
 * read textContent.
 */
(function () {
  'use strict';

  var Zh = window.ChenZhScript;
  var lang = (document.cookie.match(/(?:^|; )lang=([^;]+)/) || [])[1];
  var script = (document.cookie.match(/(?:^|; )zhScript=([^;]+)/) || [])[1];
  // The server marks pages it sent in 繁 with <html lang="zh-Hant"> (also when a
  // student game link follows the teacher's choice rather than the cookies).
  var serverHant = document.documentElement.getAttribute('lang') === 'zh-Hant';
  if (!Zh || !(serverHant || (lang === 'zh' && script === 'hant'))) return;

  var HAN = /[㐀-鿿豈-﫿]/;
  var ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var SKIP_SELECTOR = '[data-no-convert], [contenteditable]:not([contenteditable="false"])';

  function skipped(element) {
    if (!element || element.nodeType !== 1) return false;
    if (SKIP_TAGS[element.tagName]) return true;
    return Boolean(element.closest && element.closest(SKIP_SELECTOR + ', textarea, script, style'));
  }

  function convertString(value) {
    return value && HAN.test(value) ? Zh.toTraditional(value) : value;
  }

  function convertText(node) {
    var value = node.nodeValue;
    if (!value || !HAN.test(value) || skipped(node.parentElement)) return;
    var next = Zh.toTraditional(value);
    if (next !== value) node.nodeValue = next;
  }

  function convertAttributes(element) {
    if (skipped(element)) return;
    ATTRS.forEach(function (name) {
      var value = element.getAttribute(name);
      var next = convertString(value);
      if (next !== value) element.setAttribute(name, next);
    });
    if (element.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(element.type)) {
      var next = convertString(element.value);
      if (next !== element.value) element.value = next;
    }
  }

  function convertTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { convertText(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    convertAttributes(root);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.nodeType === 1 && (SKIP_TAGS[node.tagName] || (node.matches && node.matches(SKIP_SELECTOR)))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) convertText(node);
      else convertAttributes(node);
    }
  }

  function start() {
    document.documentElement.setAttribute('lang', 'zh-Hant');
    document.title = convertString(document.title);
    convertTree(document.body);
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'characterData') convertText(record.target);
        else if (record.type === 'attributes') convertAttributes(record.target);
        else Array.prototype.forEach.call(record.addedNodes, convertTree);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    var titleEl = document.querySelector('title');
    if (titleEl) new MutationObserver(function () {
      var next = convertString(document.title);
      if (next !== document.title) document.title = next;
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  window.ChenZhUI = { active: true, convertTree: convertTree };
  Zh.load().then(start, function () { /* table failed to load: the page stays as the server sent it */ });
})();
