'use strict';

var parseYouTube = require('./toolVideos').parseYouTube;

function read(value) {
  return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
}

function fromForm(body) {
  var categories = [].concat(body.finds_categories || []).filter(function (key) { return ['every-classroom', 'chinese-class'].includes(key); });
  if (!categories.length) throw new Error('Choose at least one classroom category. / 请至少选择一个分类。');
  var content = { categories: categories };
  ['en', 'zh'].forEach(function (lang) {
    var video = String(body['finds_video_' + lang] || '').trim();
    if (video && !parseYouTube(video)) throw new Error('Enter a valid YouTube link. / 请填写有效的 YouTube 链接。');
    content[lang] = {};
    ['title', 'summary', 'usage', 'general', 'chinese', 'video'].forEach(function (field) {
      content[lang][field] = String(body['finds_' + field + '_' + lang] || '').trim();
    });
  });
  return content;
}

function localized(product, lang, category) {
  var content = read(product.classroomContent);
  var text = content[lang] || {};
  var alternate = content[lang === 'zh' ? 'en' : 'zh'] || {};
  var usage = text.usage || alternate.usage || product.description || '';
  var categoryUse = text[category === 'chinese-class' ? 'chinese' : 'general'] || alternate[category === 'chinese-class' ? 'chinese' : 'general'] || '';
  var video = parseYouTube(text.video || alternate.video);
  return Object.assign({}, product, {
    title: text.title || alternate.title || product.title,
    summary: text.summary || alternate.summary || product.subtitle || product.description || '',
    usage: usage,
    categoryUse: categoryUse,
    categories: content.categories || ['every-classroom'],
    video: video
  });
}

module.exports = { read: read, fromForm: fromForm, localized: localized };
