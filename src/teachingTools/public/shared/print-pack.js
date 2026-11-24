/*
 * Print pack · 打印包 — shared helper.
 *
 * In a tool page:
 *   ChenPrintPack.provide({
 *     css: ['/low-prep/exit-ticket/'],          // stylesheets whose rules the pages need
 *     prepare: function (opts) { ... },          // apply { paper: 'A4'|'Letter', pinyin: bool }
 *     pages: function () { return [...] }        // print pages as HTML strings (may return a Promise)
 *   });
 *   ChenPrintPack.remember('exit-ticket', ['etPer', 'etVersions', ...]);  // keep settings between visits
 *
 * On the print pack page:
 *   ChenPrintPack.collect('/teaching-tools/exit-ticket', { paper: 'A4', pinyin: true })
 *     -> Promise<{ pages: [html], css: 'text' }>
 * The tool is opened in a hidden same-origin frame with ?wordlist=handoff&printpack=1,
 * so it gets the same word list through sessionStorage.
 */
(function (global) {
  'use strict';

  var provider = null;
  var waiting = [];

  function provide(spec) {
    provider = spec;
    waiting.splice(0).forEach(function (fn) { fn(spec); });
  }

  function whenProvided() {
    return provider ? Promise.resolve(provider) : new Promise(function (resolve) { waiting.push(resolve); });
  }

  // Wait until `selector` has at least one match and the page has stopped changing.
  function settled(root, selector, quietMs, maxMs) {
    quietMs = quietMs || 700;
    maxMs = maxMs || 15000;
    return new Promise(function (resolve) {
      var start = Date.now(), last = Date.now();
      var observer = new MutationObserver(function () { last = Date.now(); });
      observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
      (function check() {
        var now = Date.now();
        if ((root.querySelector(selector) && now - last >= quietMs) || now - start > maxMs) {
          observer.disconnect();
          resolve();
        } else setTimeout(check, 150);
      }());
    });
  }

  // Remember a tool's settings (values of the given control ids) in this browser.
  function remember(tool, ids) {
    var key = 'print-pack-settings:' + tool;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { saved = {}; }
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id in saved) {
        if (el.type === 'checkbox') el.checked = Boolean(saved[id]);
        else if (Array.prototype.some.call(el.options || [{ value: saved[id] }], function (o) { return o.value === String(saved[id]); })) el.value = saved[id];
      }
      el.addEventListener('change', function () {
        saved[id] = el.type === 'checkbox' ? el.checked : el.value;
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) { /* private mode */ }
      });
    });
  }

  // Set a control and let the tool react as if the teacher had changed it.
  function setControl(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') { if (el.checked === Boolean(value)) return; el.checked = Boolean(value); }
    else {
      var match = Array.prototype.filter.call(el.options || [], function (o) { return o.value.toLowerCase() === String(value).toLowerCase(); })[0];
      if (!match || el.value === match.value) return;
      el.value = match.value;
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function inPack() {
    try { return new URLSearchParams(global.location.search).get('printpack') === '1'; } catch (e) { return false; }
  }

  // ---------- pack page side ----------

  // CSS text of the frame's stylesheets that match, without print-only rules and @page.
  function cssFrom(doc, patterns) {
    var out = [];
    Array.prototype.forEach.call(doc.styleSheets, function (sheet) {
      var href = sheet.href || '';
      if (!patterns.some(function (p) { return href.indexOf(p) !== -1; })) return;
      var rules;
      try { rules = sheet.cssRules; } catch (e) { return; }
      Array.prototype.forEach.call(rules, function (rule) {
        if (rule.type === 4 && /print/.test(rule.media.mediaText) && !/screen/.test(rule.media.mediaText)) return; // @media print
        if (rule.type === 6) return; // @page
        out.push(rule.cssText);
      });
    });
    return out.join('\n');
  }

  function collect(href, opts, onStep) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1400px;height:1200px;border:0;visibility:hidden';
      var url = href + (href.indexOf('?') === -1 ? '?' : '&') + 'wordlist=handoff&printpack=1';
      var done = false;
      var timer = setTimeout(function () { finish(new Error('timeout')); }, 45000);
      function finish(error, result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        frame.remove();
        if (error) reject(error); else resolve(result);
      }
      frame.onload = function () {
        var win = frame.contentWindow;
        var pack = win.ChenPrintPack;
        if (!pack) return finish(new Error('This tool cannot join a print pack yet.'));
        if (onStep) onStep('loaded');
        pack.whenProvided().then(function (spec) {
          return Promise.resolve(spec.prepare ? spec.prepare(opts || {}) : null).then(function () { return spec.pages(); }).then(function (pages) {
            finish(null, { pages: pages || [], css: cssFrom(frame.contentDocument, spec.css || []) });
          });
        }).catch(function (error) { finish(error); });
      };
      frame.src = url;
      document.body.appendChild(frame);
    });
  }

  global.ChenPrintPack = {
    provide: provide, whenProvided: whenProvided, settled: settled, remember: remember,
    setControl: setControl, inPack: inPack, collect: collect
  };
})(window);
