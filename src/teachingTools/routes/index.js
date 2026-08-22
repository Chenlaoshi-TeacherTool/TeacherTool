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

router.get('/feedback', function(req, res, next) {
  res.render('feedback', { title: 'Share Feedback' });
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

router.get('/teaching-tools/class-pet-points', function(req, res, next) {
  res.render('teaching-tools/class-pet-points', { title: 'Class Pet Points' });
});

router.get('/teaching-tools/word-sudoku', function(req, res) {
  res.redirect(302, '/low-prep/word-sudoku/word-sudoku-widget.html');
});

[
  ['sunflower-spinner', 'Teaching Tools', '/teaching-tools'],
  ['word-list-library', 'Teaching Tools', '/teaching-tools'],
  ['question-bank-library', 'Teaching Tools', '/teaching-tools'],
  ['vocabulary-booklet', 'Teaching Tools', '/teaching-tools'],
  ['word-cloud', 'Teaching Tools', '/teaching-tools']
].forEach(function(config) {
  var slug = config[0];
  router.get('/teaching-tools/' + slug, function(req, res, next) {
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

// Low-prep activities now live within Teaching Tools.
router.get('/teaching-tools/independent-reading', function(req, res, next) {
  res.render('low-prep-activities/independent-reading', { title: 'Independent Reading Builder', toolGuide: toolGuides['independent-reading'] });
});

router.get('/teaching-tools/tear-paper-bingo', function(req, res, next) {
  res.render('low-prep-activities/tear-paper-bingo', { title: 'Tear-Paper Bingo', toolGuide: toolGuides['tear-paper-bingo'] });
});

router.get('/teaching-tools/would-you-rather', function(req, res, next) {
  res.render('low-prep-activities/would-you-rather', { title: 'Would You Rather Generator', toolGuide: toolGuides['would-you-rather'] });
});

router.get('/teaching-tools/jeopardy', function(req, res, next) {
  res.render('low-prep-activities/jeopardy', { title: 'Jeopardy Review Game', toolGuide: toolGuides.jeopardy });
});

router.get('/teaching-tools/character-race', function(req, res, next) {
  res.render('low-prep-activities/character-race', { title: 'Character Race', toolGuide: toolGuides['character-race'] });
});

router.get('/teaching-tools/maze-generator', function(req, res, next) {
  res.render('low-prep-activities/maze-generator', { title: 'Maze Generator', toolGuide: toolGuides['maze-generator'] });
});

router.get('/teaching-tools/tarsia-puzzle', function(req, res, next) {
  res.render('low-prep-activities/tarsia-puzzle', { title: 'Tarsia Puzzle Generator', toolGuide: toolGuides['tarsia-puzzle'] });
});

router.get('/low-prep-activities', function(req, res) {
  res.redirect(301, '/teaching-tools#low-prep-activities');
});

[
  'word-sudoku', 'word-cloud', 'independent-reading', 'tear-paper-bingo',
  'would-you-rather', 'jeopardy', 'character-race', 'maze-generator', 'tarsia-puzzle'
].forEach(function(slug) {
  router.get('/low-prep-activities/' + slug, function(req, res) {
    res.redirect(301, '/teaching-tools/' + slug);
  });
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
    '/', '/teaching-tools', '/theme-activities', '/theme-activities/weather', '/theme-activities/weather/songs',
    '/classroom-shop',
    '/resources', '/recommendations', '/about', '/contact', '/feedback', '/privacy',
    '/teaching-tools/qr-code-generator', '/teaching-tools/random-group-generator', '/teaching-tools/class-pet-points',
    '/teaching-tools/sunflower-spinner', '/teaching-tools/word-list-library',
    '/teaching-tools/question-bank-library', '/teaching-tools/vocabulary-booklet',
    '/low-prep/word-sudoku/word-sudoku-widget.html', '/teaching-tools/word-cloud',
    '/teaching-tools/independent-reading', '/teaching-tools/tear-paper-bingo',
    '/teaching-tools/would-you-rather', '/teaching-tools/jeopardy',
    '/teaching-tools/character-race', '/teaching-tools/maze-generator', '/teaching-tools/tarsia-puzzle'
  ].concat(articles.map(function(article) { return '/resources/' + article.slug; }));
  var urls = paths.map(function(path) {
    return '  <url><loc>' + baseUrl + path + '</loc></url>';
  }).join('\n');
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>');
});

module.exports = router;
