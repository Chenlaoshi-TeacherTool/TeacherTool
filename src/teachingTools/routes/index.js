var express = require('express');
var router = express.Router();
var siteContentStore = require('../services/siteContentStore');

siteContentStore.refresh().catch(function (err) {
  console.error('Could not load site content from DAB at startup:', err.message);
});

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
  var articles = siteContentStore.get().articles;
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
  var articles = siteContentStore.get().articles;
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
  res.render('teaching-tools/qr-code-generator', { title: 'QR Code Generator', toolGuide: siteContentStore.get().toolGuides['qr-code-generator'] });
});

router.get('/teaching-tools/random-group-generator', function(req, res, next) {
  res.render('teaching-tools/random-group-generator', { title: 'Random Group Generator', toolGuide: siteContentStore.get().toolGuides['random-group-generator'] });
});

router.get('/teaching-tools/class-pet-points', function(req, res, next) {
  res.render('teaching-tools/class-pet-points', { title: 'Class Pet Points' });
});

router.get('/teaching-tools/yu-duoyinzi-font', function(req, res, next) {
  res.render('teaching-tools/yu-duoyinzi-font', { title: '陈老师多音字拼音文楷合集' });
});

router.get('/teaching-tools/word-sudoku', function(req, res) {
  res.redirect(302, '/low-prep/word-sudoku/word-sudoku-widget.html');
});

router.get('/teaching-tools/word-cloud', function(req, res) {
  res.redirect(302, '/low-prep/word-cloud/word-cloud-widget.html');
});

router.get('/teaching-tools/vocabulary-booklet', function(req, res) {
  res.redirect(302, '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html');
});

router.get('/teaching-tools/sunflower-spinner', function(req, res) {
  res.redirect(302, '/teaching-tools/sunflower-spinner/sunflower-spinner.html');
});

router.get('/teaching-tools/word-list-library', function(req, res) {
  res.redirect(302, '/teaching-tools/word-list-library/word-list-library.html');
});

router.get('/teaching-tools/question-bank-library', function(req, res) {
  res.redirect(302, '/teaching-tools/question-bank-library/question-bank-library.html');
});

router.get('/teaching-tools/fakebook-profile', function(req, res) {
  res.redirect(302, '/teaching-tools/fakebook-profile/fakebook-profile.html');
});

router.get('/classroom-shop', function(req, res, next) {
  res.render('classroom-shop', { title: 'Classroom Shop' });
});

// Low-prep activities now live within Teaching Tools.
router.get('/teaching-tools/independent-reading', function(req, res, next) {
  res.render('low-prep-activities/independent-reading', { title: 'Independent Reading Builder', toolGuide: siteContentStore.get().toolGuides['independent-reading'] });
});

router.get('/teaching-tools/tear-paper-bingo', function(req, res, next) {
  res.render('low-prep-activities/tear-paper-bingo', { title: 'Tear-Paper Bingo', toolGuide: siteContentStore.get().toolGuides['tear-paper-bingo'] });
});

router.get('/teaching-tools/would-you-rather', function(req, res, next) {
  res.render('low-prep-activities/would-you-rather', { title: 'Would You Rather Generator', toolGuide: siteContentStore.get().toolGuides['would-you-rather'] });
});

router.get('/teaching-tools/jeopardy', function(req, res, next) {
  res.render('low-prep-activities/jeopardy', { title: 'Jeopardy Review Game', toolGuide: siteContentStore.get().toolGuides.jeopardy });
});

router.get('/teaching-tools/character-race', function(req, res, next) {
  res.render('low-prep-activities/character-race', { title: 'Character Race', toolGuide: siteContentStore.get().toolGuides['character-race'] });
});

router.get('/teaching-tools/maze-generator', function(req, res, next) {
  res.render('low-prep-activities/maze-generator', { title: 'Maze Generator', toolGuide: siteContentStore.get().toolGuides['maze-generator'] });
});

router.get('/teaching-tools/tarsia-puzzle', function(req, res, next) {
  res.render('low-prep-activities/tarsia-puzzle', { title: 'Tarsia Puzzle Generator', toolGuide: siteContentStore.get().toolGuides['tarsia-puzzle'] });
});

router.get('/teaching-tools/bingo-generator', function(req, res, next) {
  res.render('low-prep-activities/bingo-generator', { title: 'Bingo Generator', toolGuide: siteContentStore.get().toolGuides['bingo-generator'] });
});

router.get('/teaching-tools/image-revealer', function(req, res, next) {
  res.render('low-prep-activities/image-revealer', { title: 'Image Revealer', toolGuide: siteContentStore.get().toolGuides['image-revealer'] });
});

router.get('/low-prep-activities', function(req, res) {
  res.redirect(301, '/teaching-tools#low-prep-activities');
});

[
  'word-sudoku', 'word-cloud', 'independent-reading', 'tear-paper-bingo',
  'would-you-rather', 'jeopardy', 'character-race', 'maze-generator', 'tarsia-puzzle',
  'image-revealer'
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
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: ' + baseUrl + '/sitemap.xml\n');
});

router.get('/sitemap.xml', function(req, res) {
  var baseUrl = res.locals.siteUrl.replace(/\/$/, '');
  var paths = [
    '/', '/teaching-tools', '/theme-activities', '/theme-activities/weather', '/theme-activities/weather/songs',
    '/classroom-shop',
    '/resources', '/recommendations', '/about', '/contact', '/feedback', '/privacy',
    '/teaching-tools/qr-code-generator', '/teaching-tools/random-group-generator', '/teaching-tools/class-pet-points', '/teaching-tools/yu-duoyinzi-font',
    '/teaching-tools/sunflower-spinner/sunflower-spinner.html', '/teaching-tools/word-list-library/word-list-library.html',
    '/teaching-tools/question-bank-library/question-bank-library.html', '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html',
    '/teaching-tools/fakebook-profile/fakebook-profile.html',
    '/low-prep/word-sudoku/word-sudoku-widget.html', '/low-prep/word-cloud/word-cloud-widget.html',
    '/teaching-tools/independent-reading', '/teaching-tools/tear-paper-bingo',
    '/teaching-tools/would-you-rather', '/teaching-tools/jeopardy',
    '/teaching-tools/character-race', '/teaching-tools/maze-generator', '/teaching-tools/tarsia-puzzle',
    '/teaching-tools/bingo-generator', '/teaching-tools/image-revealer'
  ].concat(siteContentStore.get().articles.map(function(article) { return '/resources/' + article.slug; }));
  var urls = paths.map(function(path) {
    return '  <url><loc>' + baseUrl + path + '</loc></url>';
  }).join('\n');
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>');
});

module.exports = router;
