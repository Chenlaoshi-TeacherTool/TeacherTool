var express = require('express');
var router = express.Router();
var siteContentStore = require('../services/siteContentStore');
var classroomFinds = require('../services/classroomFinds');
var findsDefaults = require('../config/classroomFindsDefaults.json');
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

router.get('/shop', function(req, res) {
  res.redirect(301, '/classroom-finds');
});

router.get('/shop/printable-packs', function(req, res) {
  var packs = { en: 'Printable packs', zh: '可打印材料包' };
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
  var state = siteContentStore.get();
  var products = state.recommendationsLoaded || (state.recommendations || []).length ? (state.recommendations || []) : findsDefaults;
  res.render('classroom-finds', { title: 'Classroom Finds', products: products, localizeFind: classroomFinds.localized });
});

router.get('/classroom-finds/:slug/files/:blobName', async function(req, res, next) {
  try {
    var product = (siteContentStore.get().recommendations || []).find(function(item) { return item.slug === req.params.slug; });
    var file = product && (product.companionFiles || []).find(function(item) { return item.blobName === req.params.blobName; });
    if (!file) return res.sendStatus(404);
    var stream = await require('../services/textbookFileStorage').open(file.blobName);
    if (!stream) return res.sendStatus(404);
    res.attachment(file.fileName || file.title).type(file.contentType);
    res.set('Cache-Control', 'no-store');
    require('stream').pipeline(stream, res, function(error) { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
});

router.get('/classroom-finds/:slug', function(req, res, next) {
  var state = siteContentStore.get();
  var products = state.recommendationsLoaded || (state.recommendations || []).length ? (state.recommendations || []) : findsDefaults;
  var product = products.find(function(item) { return item.slug === req.params.slug; });
  // Keep the existing rolling-cart fallback available when DAB content is absent.
  if (!product && (state.recommendationsLoaded || products.length || req.params.slug !== '15-drawer-rolling-cart')) return next();
  if (product && product.classroomContent) {
    var localized = classroomFinds.localized(product, req.cookies && req.cookies.lang === 'zh' ? 'zh' : 'en', 'every-classroom');
    product = Object.assign({}, localized, { description: localized.usage || localized.summary });
  }
  res.render('recommendations', {
    title: product ? product.title : text(req, '15-drawer classroom rolling cart', '15抽屉教室收纳推车'),
    products: product ? [product] : [],
    productDetail: true
  });
});

module.exports = router;
