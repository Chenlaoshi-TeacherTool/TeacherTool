// 繁体 pages: when a visitor picks 中文 · 繁 (cookie zhScript=hant), every page
// rendered with res.render() is converted to 通用繁体 before it is sent, and
// public/shared/zh-ui.js is added to convert text that scripts build later.
//
// Converted: text between tags and these attributes: title, alt, placeholder,
// aria-label, label, content. Left alone: <script>, <style>, <textarea>,
// comments, and every other attribute (value, data-*, href …), so form values,
// teacher data and links stay exactly as stored.
var Zh = require('../public/shared/zh-script');

var BLOCKS = /<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<textarea\b[\s\S]*?<\/textarea\s*>|<!--[\s\S]*?-->|<[^>]*>/gi;
var TEXT_ATTRS = /(\s(?:title|alt|placeholder|aria-label|label|content)\s*=\s*)("[^"]*"|'[^']*')/gi;
var HAN = /[㐀-鿿豈-﫿]/;
var UI_SCRIPTS = '<script src="/shared/zh-script.js?v=4" defer></script><script src="/shared/zh-ui.js?v=2" defer></script>';

function convertText(text) {
  return HAN.test(text) ? Zh.toTraditional(text) : text;
}

function convertTag(tag) {
  if (/^<html\b/i.test(tag)) tag = tag.replace(/\slang\s*=\s*("[^"]*"|'[^']*')/i, ' lang="zh-Hant"');
  if (!HAN.test(tag)) return tag;
  return tag.replace(TEXT_ATTRS, function (_, name, quoted) {
    return name + quoted.charAt(0) + convertText(quoted.slice(1, -1)) + quoted.charAt(0);
  });
}

function convertHtml(html) {
  var out = '';
  var last = 0;
  var match;
  BLOCKS.lastIndex = 0;
  while ((match = BLOCKS.exec(html))) {
    out += convertText(html.slice(last, match.index));
    var token = match[0];
    var keep = /^<(script|style|textarea)\b/i.test(token) || token.slice(0, 4) === '<!--' || token.charAt(1) === '/' || token.charAt(1) === '!';
    out += keep ? token : convertTag(token);
    last = BLOCKS.lastIndex;
  }
  out += convertText(html.slice(last));
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>(?![\s\S]*<\/body>)/i, UI_SCRIPTS + '</body>');
  return out;
}

// Wraps res.render for this request. Renders that pass their own callback
// (partials, emails) are left as they are.
// The script is read when the page renders, so a route may still set
// res.locals.zhScript (student game links follow the teacher's choice).
function middleware(req, res, next) {
  var render = res.render;
  res.render = function (view, options, callback) {
    if (typeof options === 'function') { callback = options; options = undefined; }
    if (callback || res.locals.zhScript !== 'hant') return render.call(this, view, options, callback);
    var self = this;
    return render.call(this, view, options, function (err, html) {
      if (err) return req.next(err);
      self.send(convertHtml(html));
    });
  };
  next();
}

module.exports = { convertHtml: convertHtml, middleware: middleware, UI_SCRIPTS: UI_SCRIPTS };
