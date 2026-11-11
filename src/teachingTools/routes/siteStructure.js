var express = require('express');
var router = express.Router();
var siteContentStore = require('../services/siteContentStore');
var amazonPicks = require('../config/amazonPicks');
var siteMap = require('../config/siteMap');

function text(req, en, zh) {
  return req.cookies && req.cookies.lang === 'zh' ? zh : en;
}

function renderPage(req, res, page) {
  res.render('site-structure/page', { title: page.heading, page: page });
}

function section(key) {
  return siteMap.findSection(key);
}

function parentLink(req, key) {
  var parent = section(key);
  return { href: parent.href, label: text(req, parent.en, parent.zh) };
}

// A theme's name: the one saved at /admin/materials, else the built-in name.
function themeTitle(req, key) {
  var theme = ((req.contentCatalog && req.contentCatalog.themes) || siteMap.children('activities')).find(function (item) { return item.key === key; });
  return text(req, theme.en, theme.zh);
}

function child(sectionKey, key) {
  return siteMap.children(sectionKey).find(function(item) { return item.key === key; });
}

router.get('/theme-activities/self-introduction', function(req, res) {
  res.render('theme-activities/self-introduction', {
    title: themeTitle(req, 'self-introduction'),
    parent: parentLink(req, 'activities')
  });
});

router.get('/theme-activities/five-elements', function(req, res) {
  res.render('theme-activities/five-elements', {
    title: themeTitle(req, 'five-elements'),
    parent: parentLink(req, 'activities')
  });
});

router.get('/theme-activities/:theme', function(req, res, next) {
  var theme = ((req.contentCatalog && req.contentCatalog.themes) || siteMap.children('activities')).find(function (item) { return item.key === req.params.theme; });
  if (!theme || theme.template !== 'theme') return next();
  var heading = text(req, theme.en, theme.zh);
  renderPage(req, res, {
    heading: heading,
    intro: text(req, 'Chinese language activities organized around ' + theme.en + '.', '围绕“' + theme.zh + '”整理中文课堂活动。'),
    parent: parentLink(req, 'activities'),
    cards: theme.custom ? [] : [
      { heading: text(req, 'Vocabulary', '词汇'), description: text(req, 'Theme vocabulary has not been added yet.', '此主题的词汇尚未添加。') },
      { heading: text(req, 'Games', '游戏'), description: text(req, 'Use your own theme words with the existing classroom games.', '把自己的主题词汇用于现有课堂游戏。'), href: theme.key === 'halloween' ? '/teaching-tools/witchs-poison' : '/teaching-tools/bingo-generator', label: text(req, 'Open game', '打开游戏') },
      theme.key === 'halloween'
        ? { heading: text(req, 'Printables', '可打印材料'), description: text(req, 'Make your own Halloween Secret Message worksheet with your class words.', '用自己班的词语制作万圣节图形密码练习纸。'), href: '/teaching-tools/secret-message', label: text(req, 'Open the Secret Message generator', '前往图形密码生成器') }
        : { heading: text(req, 'Printables', '可打印材料'), description: text(req, 'Theme packs have not been added yet. Create a worksheet with your own words.', '主题材料包尚未添加，可用自己的词汇制作练习单。'), href: '/teaching-tools/worksheet-generator', label: text(req, 'Create a worksheet', '制作练习单') }
    ]
  });
});

// Halloween printables are activity materials now, listed on the theme page itself.
router.get('/theme-activities/halloween/printables', function(req, res) {
  res.redirect(301, '/theme-activities/halloween');
});

var shopCardCopy = {
  'printable-packs': { en: ['Browse printable teaching packs.', 'Browse printables'], zh: ['浏览可打印的教学材料包。', '查看材料包'] },
  'physical-products': { en: ['Hands-on materials for your classroom, sold in Chen Laoshi’s eBay store.', 'Visit the eBay store'], zh: ['适合课堂动手活动的教具，在陈老师的 eBay 店铺出售。', '前往 eBay 店铺'] }
};

router.get('/shop', function(req, res) {
  var shop = section('shop');
  renderPage(req, res, {
    heading: text(req, shop.en, shop.zh),
    intro: text(req, 'Explore Chen Laoshi’s printable packs and physical classroom products.', '浏览陈老师的可打印材料包与实体教具。'),
    cards: shop.children.map(function(item) {
      var copy = shopCardCopy[item.key] || { en: ['', 'Open'], zh: ['', '打开'] };
      return { heading: text(req, item.en, item.zh), description: text(req, copy.en[0], copy.zh[0]), href: item.redirect || item.href, label: text(req, copy.en[1], copy.zh[1]) };
    })
  });
});

router.get('/shop/printable-packs', function(req, res) {
  var packs = child('shop', 'printable-packs');
  renderPage(req, res, {
    heading: text(req, packs.en, packs.zh),
    intro: text(req, 'No printable packs are listed for sale yet.', '暂未上架可打印材料包。'),
    parent: parentLink(req, 'shop'),
    cards: []
  });
});

// Physical products are sold on eBay; 302 so the destination can change later.
router.get('/shop/physical-products', function(req, res) {
  res.redirect(302, child('shop', 'physical-products').redirect);
});

router.get('/classroom-finds', function(req, res) {
  res.render('recommendations', { title: 'Classroom Finds', products: siteContentStore.get().recommendations || [], amazonPicks: amazonPicks });
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
