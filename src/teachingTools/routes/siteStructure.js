var express = require('express');
var router = express.Router();
var siteContentStore = require('../services/siteContentStore');

function text(req, en, zh) {
  return req.cookies && req.cookies.lang === 'zh' ? zh : en;
}

function renderPage(req, res, page) {
  res.render('site-structure/page', { title: page.heading, page: page });
}

var themes = [
  { slug: 'halloween', en: 'Halloween', zh: '万圣节' },
  { slug: 'chinese-new-year', en: 'Chinese New Year', zh: '春节' },
  { slug: 'animals', en: 'Animals', zh: '动物' }
];

router.get('/theme-activities/:theme', function(req, res, next) {
  var theme = themes.find(function(item) { return item.slug === req.params.theme; });
  if (!theme) return next();
  var heading = text(req, theme.en, theme.zh);
  renderPage(req, res, {
    heading: heading,
    intro: text(req, 'Chinese language activities organized around ' + theme.en + '.', '围绕“' + theme.zh + '”整理中文课堂活动。'),
    parent: { href: '/theme-activities', label: text(req, 'Theme Activities', '主题活动') },
    cards: [
      { heading: text(req, 'Vocabulary', '词汇'), description: text(req, 'Theme vocabulary has not been added yet.', '此主题的词汇尚未添加。') },
      { heading: text(req, 'Games', '游戏'), description: text(req, 'Use your own theme words with the existing classroom games.', '把自己的主题词汇用于现有课堂游戏。'), href: theme.slug === 'halloween' ? '/teaching-tools/witchs-poison' : '/teaching-tools/bingo-generator', label: text(req, 'Open game', '打开游戏') },
      { heading: text(req, 'Printables', '可打印材料'), description: text(req, 'Theme packs have not been added yet. Create a worksheet with your own words.', '主题材料包尚未添加，可用自己的词汇制作练习单。'), href: '/teaching-tools/worksheet-generator', label: text(req, 'Create a worksheet', '制作练习单') }
    ]
  });
});

router.get('/textbook-companion', function(req, res) {
  renderPage(req, res, {
    heading: text(req, 'Textbook Companion', '教材配套'),
    intro: text(req, 'Resources for the Jinan University “中文” textbook, organized by level.', '暨南大学《中文》教材配套资源，按级别整理。'),
    cards: [1, 2, 3].map(function(level) {
      return { heading: text(req, 'Level ' + level, '第' + level + '册'), description: text(req, 'Homework packets, projects, vocabulary cards, and lesson agendas.', '作业包、项目活动、词汇卡和课程安排。'), href: '/textbook-companion/level-' + level, label: text(req, 'Browse level', '查看资源') };
    })
  });
});

router.get('/textbook-companion/:level', function(req, res, next) {
  var match = /^level-([123])$/.exec(req.params.level);
  if (!match) return next();
  renderPage(req, res, {
    heading: text(req, 'Jinan University “中文” · Level ' + match[1], '暨南大学《中文》第' + match[1] + '册'),
    intro: text(req, 'Level-specific materials have not been added yet.', '此级别的配套材料尚未添加。'),
    parent: { href: '/textbook-companion', label: text(req, 'Textbook Companion', '教材配套') },
    cards: [
      { heading: text(req, 'Homework packets', '作业包'), description: text(req, 'No homework packets added yet.', '尚未添加作业包。') },
      { heading: text(req, 'Projects', '项目活动'), description: text(req, 'No projects added yet.', '尚未添加项目活动。') },
      { heading: text(req, 'Vocabulary cards', '词汇卡'), description: text(req, 'No level-specific vocabulary cards added yet.', '尚未添加此级别的词汇卡。') },
      { heading: text(req, 'Lesson agendas', '课程安排'), description: text(req, 'No lesson agendas added yet.', '尚未添加课程安排。') }
    ]
  });
});

router.get('/shop', function(req, res) {
  renderPage(req, res, {
    heading: text(req, 'Chen Laoshi’s Shop', '陈老师的商店'),
    intro: text(req, 'Explore Chen Laoshi’s printable packs and physical classroom products.', '浏览陈老师的可打印材料包与实体教具。'),
    cards: [
      { heading: text(req, 'Printable packs', '可打印材料包'), description: text(req, 'Browse printable teaching packs.', '浏览可打印的教学材料包。'), href: '/shop/printable-packs', label: text(req, 'Browse printables', '查看材料包') },
      { heading: text(req, 'Physical products', '实体产品'), description: text(req, 'Hands-on materials for your classroom.', '适合课堂动手活动的教具。'), href: '/shop/physical-products', label: text(req, 'Browse products', '查看产品') }
    ]
  });
});

router.get('/shop/printable-packs', function(req, res) {
  renderPage(req, res, {
    heading: text(req, 'Printable packs', '可打印材料包'),
    intro: text(req, 'No printable packs are listed for sale yet.', '暂未上架可打印材料包。'),
    parent: { href: '/shop', label: text(req, 'Chen Laoshi’s Shop', '陈老师的商店') },
    cards: []
  });
});

router.get('/shop/physical-products', function(req, res) {
  res.render('classroom-shop', { title: 'Physical Products · Chen Laoshi’s Shop' });
});

router.get('/classroom-finds', function(req, res) {
  res.render('recommendations', { title: 'Classroom Finds', products: siteContentStore.get().recommendations || [] });
});

router.get('/classroom-finds/:slug', function(req, res, next) {
  var products = siteContentStore.get().recommendations || [];
  var product = products.find(function(item) { return item.slug === req.params.slug; });
  // Keep the existing rolling-cart fallback available when DAB content is absent.
  if (!product && (products.length || req.params.slug !== '15-drawer-rolling-cart')) return next();
  res.render('recommendations', {
    title: product ? product.title : text(req, '15-drawer classroom rolling cart', '15抽屉教室收纳推车'),
    products: product ? [product] : [],
    productDetail: true
  });
});

module.exports = router;
