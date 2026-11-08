'use strict';

// /textbook-companion: the textbook list, and for series with books in
// config/textbooks.js (Jinan “中文”) a page per series, book and lesson.
// Everyone sees which lessons and files exist; for `membersOnly` series only
// members (services/membershipLimits.js) see the words, patterns, activities
// and can download files.

var express = require('express');
var textbooks = require('../config/textbooks');

// Textbooks still in preparation, shown greyed out with "coming soon".
var COMING_SOON = [
  { en: 'PEP Chinese (人教版部编教材)', zh: '人教版部编教材', descEn: 'Companion materials for the PEP (部编版) Chinese textbooks.', descZh: '人教版部编语文教材的配套材料。' },
  { en: 'HSK Standard Course', zh: 'HSK 教材', descEn: 'Vocabulary and practice organized by HSK level.', descZh: '按 HSK 等级整理的词汇和练习。' },
  { en: 'Chinese Made Easy', zh: 'Chinese Made Easy《轻松学汉语》', descEn: 'Companion materials for the Chinese Made Easy series.', descZh: 'Chinese Made Easy 系列的配套材料。' }
];

function create(options) {
  options = options || {};
  var repository = options.repository || require('../services/textbookRepository');
  var files = options.files || require('../services/textbookFileStorage');
  var materials = options.materials || require('../services/materialRepository');
  var limits = options.limits || require('../services/membershipLimits');
  var signedIn = options.signedIn || function (req) {
    if (process.env.TEACHER_ACCOUNTS_ENABLED !== 'true') return false;
    return Boolean(require('./teacherLibrary').trustedUser(req));
  };
  var loginProvider = options.loginProvider || function () { return require('./teacherLibrary').accountProvider(); };
  var router = express.Router();
  var contentCatalog = options.contentCatalog || require('../services/contentCatalog');
  router.use('/textbook-companion', async function (req, res, next) {
    try { req.textbooks = (await contentCatalog.load()).textbooks; next(); } catch (error) { next(error); }
  });

  function zh(res) { return res.locals.lang === 'zh'; }
  function pick(res, en, zhText) { return zh(res) ? zhText : en; }
  function name(res, item) { return zh(res) ? item.zh : item.en; }

  function seriesWithBooks(req, key) {
    var series = req.textbooks.findSeries(key);
    return series && series.books ? series : null;
  }

  async function canOpen(req, series) {
    if (!series.membersOnly) return true;
    try { return await limits.canUseTextbookMaterials(req); } catch (error) { return false; }
  }

  function access(req, unlocked) {
    var loginUrl = null;
    try { loginUrl = '/.auth/login/' + loginProvider() + '?post_login_redirect_uri=' + encodeURIComponent(req.originalUrl); } catch (error) { loginUrl = null; }
    return { unlocked: unlocked, signedIn: signedIn(req), loginUrl: loginUrl };
  }

  router.get('/textbook-companion', async function (req, res) {
    var available = req.textbooks.SERIES.filter(function (series) { return series.books; }).map(function (series) {
      return { heading: name(res, series), href: '/textbook-companion/' + series.key, membersOnly: Boolean(series.membersOnly),
        description: pick(res, series.books.map(function (book) { return book.en; }).join(' · ') + ' — vocabulary, patterns, activities and printable files for every lesson.',
          series.books.map(function (book) { return book.zh; }).join('、') + '：每一课的生词、句型、活动和可打印材料。') };
    });
    res.render('textbook-companion/index', {
      title: pick(res, 'Textbook Companion', '教材配套'),
      available: available,
      comingSoon: COMING_SOON.map(function (book) { return { heading: name(res, book), description: pick(res, book.descEn, book.descZh) }; })
    });
  });

  // The old placeholder level pages had no content; send old links to the list.
  router.get('/textbook-companion/:series', async function (req, res, next) {
    if (/^level-\d+$/.test(req.params.series)) return res.redirect(301, '/textbook-companion');
    var series = seriesWithBooks(req, req.params.series);
    if (!series) return next();
    var counts = {};
    try { counts = await repository.countLessons(series.key); } catch (error) { console.error('textbook count error:', error.message); }
    res.render('textbook-companion/series', {
      title: name(res, series), series: series, seriesName: name(res, series),
      books: series.books.map(function (book) {
        return { name: name(res, book), href: '/textbook-companion/' + series.key + '/' + book.slug, lessons: counts[book.slug] || 0 };
      })
    });
  });

  router.get('/textbook-companion/:series/:book', async function (req, res, next) {
    var series = seriesWithBooks(req, req.params.series);
    var book = textbooks.findBook(series, req.params.book);
    if (!book) return next();
    var lessons = [];
    var unavailable = false;
    try { lessons = await repository.listLessons(series.key, book.slug); }
    catch (error) { console.error('textbook lessons error:', error.message); unavailable = true; }
    res.render('textbook-companion/book', {
      title: name(res, series) + ' ' + name(res, book), series: series, seriesName: name(res, series), bookName: name(res, book),
      base: '/textbook-companion/' + series.key + '/' + book.slug, lessons: lessons, unavailable: unavailable,
      access: access(req, await canOpen(req, series))
    });
  });

  router.get('/textbook-companion/:series/:book/:lesson', async function (req, res, next) {
    var series = seriesWithBooks(req, req.params.series);
    var book = textbooks.findBook(series, req.params.book);
    if (!book || !/^[A-Za-z0-9_-]{1,100}$/.test(req.params.lesson)) return next();
    try {
      var lesson = await repository.getLesson(series.key, book.slug, req.params.lesson);
      if (!lesson) return next();
      var unlocked = await canOpen(req, series);
      if (!unlocked) {
        // Locked: keep what exists (counts and file titles), not the content itself.
        lesson = { title: lesson.title, lessonNo: lesson.lessonNo, wordCount: lesson.words.length, patternCount: lesson.patterns.length,
          activityCount: lesson.activities.length, gameCount: (lesson.games || []).length, files: lesson.files.map(function (file) { return { title: file.title, fileName: file.fileName }; }) };
      }
      res.set('Cache-Control', 'private, no-store');
      res.render('textbook-companion/lesson', {
        title: lesson.title + ' · ' + name(res, series) + ' ' + name(res, book), seriesName: name(res, series), bookName: name(res, book),
        seriesHref: '/textbook-companion/' + series.key, bookHref: '/textbook-companion/' + series.key + '/' + book.slug,
        lesson: lesson, access: access(req, unlocked),
        relatedMaterials: await materials.list({ lesson: { series: series.key, book: book.slug, slug: req.params.lesson } })
      });
    } catch (error) { next(error); }
  });

  router.get('/textbook-companion/files/:id', async function (req, res, next) {
    if (!/^\d{1,9}$/.test(req.params.id)) return next();
    try {
      var file = await repository.getFile(Number(req.params.id));
      var series = file && file.published ? seriesWithBooks(req, file.series) : null;
      if (!series) return next();
      var lessonPage = '/textbook-companion/' + series.key + '/' + file.book + '/' + file.lessonSlug;
      if (!(await canOpen(req, series))) return res.redirect(303, lessonPage + '#members');
      var stream = await files.open(file.blobName);
      if (!stream) return next();
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type(file.contentType);
      res.attachment(file.fileName);
      stream.on('error', next);
      stream.pipe(res);
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = create();
module.exports.create = create;
module.exports.COMING_SOON = COMING_SOON;
