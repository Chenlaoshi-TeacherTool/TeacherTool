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

function child(sectionKey, key) {
  return siteMap.children(sectionKey).find(function(item) { return item.key === key; });
}

router.get('/theme-activities/self-introduction', function(req, res) {
  res.render('theme-activities/self-introduction', {
    title: text(req, 'Self-introduction', '个人介绍'),
    parent: parentLink(req, 'activities'),
    printables: [{
      title: 'Who Am I? 我是谁？阅读卡片',
      en: 'Read six personal introductions and match each one to a character letter. Practice names, ages, birthdays, hobbies, possessions, and places of residence.',
      zh: '阅读 6 段人物介绍，将每段与对应的人物字母配对。练习姓名、年龄、生日、爱好、物品和居住地等表达。',
      pages: 2,
      limitedFree: true,
      pdf: '/printables/self-introduction/who-am-i-reading-cards.pdf',
      docx: '/printables/self-introduction/who-am-i-reading-cards.docx'
    }, {
      title: 'Guess Who? 猜人游戏卡片',
      en: 'Ask and answer questions in Chinese to guess your partner’s character.',
      zh: '用中文提问和回答，猜出同伴选的是哪个人物。',
      pages: 4,
      limitedFree: true,
      pdf: '/printables/self-introduction/guess-who-game-cards.pdf',
      pptx: '/printables/self-introduction/guess-who-game-cards.pptx'
    }]
  });
});

router.get('/theme-activities/five-elements', function(req, res) {
  res.render('theme-activities/five-elements', {
    title: text(req, 'Five Elements', '五行'),
    parent: parentLink(req, 'activities'),
    pdf: PRINTABLES_BASE + 'five-elements/planet-treasure-hunt-pencil-a4.pdf',
    docx: PRINTABLES_BASE + 'five-elements/planet-treasure-hunt-pencil-a4.docx'
  });
});

router.get('/theme-activities/:theme', function(req, res, next) {
  var theme = child('activities', req.params.theme);
  if (!theme || theme.template !== 'theme') return next();
  var heading = text(req, theme.en, theme.zh);
  renderPage(req, res, {
    heading: heading,
    intro: text(req, 'Chinese language activities organized around ' + theme.en + '.', '围绕“' + theme.zh + '”整理中文课堂活动。'),
    parent: parentLink(req, 'activities'),
    cards: [
      { heading: text(req, 'Vocabulary', '词汇'), description: text(req, 'Theme vocabulary has not been added yet.', '此主题的词汇尚未添加。') },
      { heading: text(req, 'Games', '游戏'), description: text(req, 'Use your own theme words with the existing classroom games.', '把自己的主题词汇用于现有课堂游戏。'), href: theme.key === 'halloween' ? '/teaching-tools/witchs-poison' : '/teaching-tools/bingo-generator', label: text(req, 'Open game', '打开游戏') },
      theme.key === 'halloween'
        ? { heading: text(req, 'Printables', '可打印材料'), description: text(req, 'Ready-to-print Halloween worksheets in PDF and Word.', '可直接打印的万圣节练习单，提供 PDF 和 Word 版。'), href: '/theme-activities/halloween/printables', label: text(req, 'Browse printables', '查看材料') }
        : { heading: text(req, 'Printables', '可打印材料'), description: text(req, 'Theme packs have not been added yet. Create a worksheet with your own words.', '主题材料包尚未添加，可用自己的词汇制作练习单。'), href: '/teaching-tools/worksheet-generator', label: text(req, 'Create a worksheet', '制作练习单') }
    ]
  });
});

// Files live in the public "printables" blob container.
var PRINTABLES_BASE = 'https://chenlaoshitteaching.blob.core.windows.net/printables/';
var halloweenPrintables = [
  {
    title: '万圣节图形密码 · Secret Message',
    en: 'Decode Halloween pictures to reveal a secret message from your teacher. Includes a worksheet and answer key.',
    zh: '对照图形密码表，写出汉字，解开老师的万圣节秘密信息。含练习纸和答案页。',
    pages: 2,
    pdf: '/printables/halloween/halloween-secret-message.pdf',
    createHref: '/teaching-tools/secret-message'
  },
  {
    title: '万圣节方位词_Gallery_Walk',
    en: 'Read each position-word sentence, find the matching picture around the room, and write its letter. Includes 10 picture cards and an answer key.',
    zh: '读方位词句子，在教室里找到对应的图片并写下字母。含 10 张图片卡和答案。',
    pages: 12,
    limitedFree: true,
    pdf: PRINTABLES_BASE + 'halloween/halloween-position-words-gallery-walk.pdf',
    docx: PRINTABLES_BASE + 'halloween/halloween-position-words-gallery-walk.docx'
  }
];

router.get('/theme-activities/halloween/printables', function(req, res) {
  var halloween = child('activities', 'halloween');
  res.render('theme-activities/halloween/printables', {
    title: text(req, 'Halloween printables', '万圣节可打印材料'),
    parent: { href: halloween.href, label: text(req, halloween.en, halloween.zh) },
    printables: halloweenPrintables
  });
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
