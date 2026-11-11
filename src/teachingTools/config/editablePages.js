'use strict';
var i18n = require('../services/i18n');
var pages = {
  home: { title: '首页内容', href: '/', fields: [
    ['home.heroTitleLine1', '首页标题第一行'], ['home.heroTitleLine2', '首页标题第二行'],
    ['home.heroTitleTagline', '标题副标题'], ['home.heroIntro', '首页介绍'],
    ['home.pathsHeading', '教学入口标题'], ['home.pathsIntro', '教学入口介绍'],
    ['home.findsHeading', '教室好物标题'], ['home.findsIntro', '教室好物介绍'],
    ['home.feedbackHeading', '反馈区标题'], ['home.feedbackIntro', '反馈区介绍']
  ] },
  about: { title: '关于与联系', href: '/about', fields: [
    ['about.title', '页面标题'], ['about.intro', '简介'],
    ['about.whoTitle', '个人介绍标题'], ['about.whoP1', '个人介绍第一段'], ['about.whoP2', '个人介绍第二段'],
    ['about.whyTitle', '网站介绍标题'], ['about.whyP1', '网站介绍第一段'], ['about.whyP2', '网站介绍第二段'],
    ['about.principlesTitle', '教学理念标题'], ['about.principle1', '教学理念一'], ['about.principle2', '教学理念二'],
    ['about.principle3', '教学理念三'], ['about.principle4', '教学理念四'], ['about.principle5', '教学理念五'],
    ['about.noteTitle', '补充说明标题'], ['about.noteP1', '补充说明'],
    ['contact.title', '联系区标题'], ['contact.intro', '联系区介绍'], ['contact.emailHelp', '邮件说明']
  ] }
};
function defaults(key) {
  var values = { zh: {}, en: {} };
  pages[key].fields.forEach(function(field) { ['zh', 'en'].forEach(function(lang) { values[lang][field[0]] = i18n.t(lang, field[0]); }); });
  return values;
}
module.exports = { pages: pages, defaults: defaults };
