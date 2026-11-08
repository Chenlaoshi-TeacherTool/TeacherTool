'use strict';

var express = require('express');
function create(options) {
  options = options || {};
  var editor = options.editor || require('../services/textbookBookEditor');
  var words = options.words || require('../services/textbookWords');
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var router = express.Router();
  router.use(require('../middleware/requireAdmin'));
  // An entire book can exceed the application's default JSON body limit.
  router.use(express.json({ type: 'application/vnd.cls-textbook+json', limit: '2mb' }));
  router.get('/textbooks/books/:series/:book/words', async function (req, res, next) {
    try {
      var series = req.textbooks.findSeries(req.params.series);
      if (!series) return res.sendStatus(404);
      var lessons = await editor.load(series.key, req.params.book);
      if (!lessons.length) return res.status(404).send('本册暂无课次。');
      res.set('Cache-Control', 'private, no-store');
      res.render('admin/textbooks-book-words', { title: '整册词汇编辑', series: series, bookSlug: req.params.book,
        bookName: lessons[0].book_name, lessons: lessons, adminUser: req.adminUser });
    } catch (error) { next(error); }
  });
  router.post('/textbooks/books/:series/:book/words/:action', async function (req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).json({ error: '请从本站操作。' });
    try {
      if (!req.textbooks.findSeries(req.params.series)) return res.sendStatus(404);
      if (req.params.action === 'preview') return res.json(await words.generate(req.body.text));
      if (req.params.action === 'save') return res.json(await editor.save(req.params.series, req.params.book, req.body.lessons));
      res.sendStatus(404);
    } catch (error) {
      if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ error: error.message });
      res.status(500).json({ error: '处理失败，修改仍保留在页面中，请重试。' });
    }
  });
  return router;
}
module.exports = create();
module.exports.create = create;
