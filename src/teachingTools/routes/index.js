var express = require('express');
var router = express.Router();
var siteContent = require('../data/site-content');
var toolGuides = siteContent.toolGuides;
var articles = siteContent.articles;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Home' });
});

router.get('/privacy', function(req, res, next) {
  res.render('privacy', { title: 'Privacy Policy' });
});

router.get('/about', function(req, res, next) {
  res.render('about', { title: 'About Chen Laoshi' });
});

router.get('/contact', function(req, res, next) {
  res.render('contact', { title: 'Contact Chen Laoshi' });
});

router.get('/recommendations', function(req, res, next) {
  res.render('recommendations', { title: 'Classroom Recommendations' });
});

router.get('/resources', function(req, res, next) {
  var categories = Array.from(new Set(articles.map(function(article) { return article.category; })));
  var activeCategory = typeof req.query.category === 'string' ? req.query.category : '';
  var visibleArticles = activeCategory
    ? articles.filter(function(article) { return article.category === activeCategory; })
    : articles;

  res.render('resources/index', {
    title: 'Teaching Resources',
    articles: visibleArticles,
    categories: categories,
    activeCategory: activeCategory
  });
});

router.get('/resources/:slug', function(req, res, next) {
  var article = articles.find(function(item) { return item.slug === req.params.slug; });
  if (!article) return next();

  res.render('resources/article', {
    title: article.title,
    article: article,
    relatedArticles: articles.filter(function(item) { return item.slug !== article.slug; }).slice(0, 3)
  });
});

// Teaching Tools Routes
router.get('/teaching-tools', function(req, res, next) {
  res.render('teaching-tools/index', { title: 'Teaching Tools' });
});

router.get('/teaching-tools/qr-code-generator', function(req, res, next) {
  res.render('teaching-tools/qr-code-generator', { title: 'QR Code Generator', toolGuide: toolGuides['qr-code-generator'] });
});

router.get('/teaching-tools/random-group-generator', function(req, res, next) {
  res.render('teaching-tools/random-group-generator', { title: 'Random Group Generator', toolGuide: toolGuides['random-group-generator'] });
});

[
  ['sunflower-spinner', 'Teaching Tools', '/teaching-tools'],
  ['word-list-library', 'Teaching Tools', '/teaching-tools'],
  ['question-bank-library', 'Teaching Tools', '/teaching-tools'],
  ['vocabulary-booklet', 'Teaching Tools', '/teaching-tools'],
  ['word-sudoku', 'Low-Prep Activities', '/low-prep-activities'],
  ['word-cloud', 'Low-Prep Activities', '/low-prep-activities']
].forEach(function(config) {
  var slug = config[0];
  var basePath = config[2] === '/teaching-tools' ? '/teaching-tools/' : '/low-prep-activities/';
  router.get(basePath + slug, function(req, res, next) {
    res.render('tool-landing', {
      title: toolGuides[slug].title,
      toolGuide: toolGuides[slug],
      sectionLabel: config[1],
      sectionPath: config[2]
    });
  });
});

router.get('/classroom-shop', function(req, res, next) {
  res.render('classroom-shop', { title: 'Classroom Shop' });
});

// Low-Prep Activities Routes
router.get('/low-prep-activities', function(req, res, next) {
  res.render('low-prep-activities/index', { title: 'Low-Prep Activities' });
});

router.get('/low-prep-activities/independent-reading', function(req, res, next) {
  res.render('low-prep-activities/independent-reading', { title: 'Independent Reading Builder', toolGuide: toolGuides['independent-reading'] });
});

router.get('/low-prep-activities/tear-paper-bingo', function(req, res, next) {
  res.render('low-prep-activities/tear-paper-bingo', { title: 'Tear-Paper Bingo', toolGuide: toolGuides['tear-paper-bingo'] });
});

router.get('/low-prep-activities/would-you-rather', function(req, res, next) {
  res.render('low-prep-activities/would-you-rather', { title: 'Would You Rather Generator', toolGuide: toolGuides['would-you-rather'] });
});

router.get('/low-prep-activities/jeopardy', function(req, res, next) {
  res.render('low-prep-activities/jeopardy', { title: 'Jeopardy Review Game', toolGuide: toolGuides.jeopardy });
});

router.get('/low-prep-activities/character-race', function(req, res, next) {
  res.render('low-prep-activities/character-race', { title: 'Character Race', toolGuide: toolGuides['character-race'] });
});

router.get('/low-prep-activities/maze-generator', function(req, res, next) {
  res.render('low-prep-activities/maze-generator', { title: 'Maze Generator', toolGuide: toolGuides['maze-generator'] });
});

// Theme Activities Routes
router.get('/theme-activities', function(req, res, next) {
  res.render('theme-activities/index', { title: 'Theme Activities' });
});

router.get('/theme-activities/weather', function(req, res, next) {
  res.render('theme-activities/weather/index', { title: 'Theme Activities' });
});

router.get('/theme-activities/weather/songs', function(req, res, next) {
  res.render('theme-activities/weather/songs', { title: 'Theme Activities' });
});

router.get('/robots.txt', function(req, res) {
  var baseUrl = res.locals.siteUrl.replace(/\/$/, '');
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ' + baseUrl + '/sitemap.xml\n');
});

router.get('/sitemap.xml', function(req, res) {
  var baseUrl = res.locals.siteUrl.replace(/\/$/, '');
  var paths = [
    '/', '/teaching-tools', '/low-prep-activities', '/theme-activities', '/theme-activities/weather', '/theme-activities/weather/songs',
    '/classroom-shop',
    '/resources', '/recommendations', '/about', '/contact', '/privacy',
    '/teaching-tools/qr-code-generator', '/teaching-tools/random-group-generator',
    '/teaching-tools/sunflower-spinner', '/teaching-tools/word-list-library',
    '/teaching-tools/question-bank-library', '/teaching-tools/vocabulary-booklet',
    '/low-prep-activities/word-sudoku', '/low-prep-activities/word-cloud',
    '/low-prep-activities/independent-reading', '/low-prep-activities/tear-paper-bingo',
    '/low-prep-activities/would-you-rather', '/low-prep-activities/jeopardy',
    '/low-prep-activities/character-race', '/low-prep-activities/maze-generator'
  ].concat(articles.map(function(article) { return '/resources/' + article.slug; }));
  var urls = paths.map(function(path) {
    return '  <url><loc>' + baseUrl + path + '</loc></url>';
  }).join('\n');
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>');
});

module.exports = router;
