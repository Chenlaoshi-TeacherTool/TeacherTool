'use strict';

var express = require('express');

function create(options) {
  options = options || {};
  var catalog = options.catalog || require('../services/contentCatalog');
  var router = express.Router();
  router.use(require('../middleware/requireAdmin'));
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var paths = { theme: '/themes/new', series: '/textbooks/new', book: '/textbooks/:series/books/new' };
  Object.keys(paths).forEach(function (kind) {
    function render(req, res, error) {
      res.render('admin/catalog-new', { title: kind === 'theme' ? 'New theme / 新增主题' : kind === 'series' ? 'New textbook / 新增教材' : 'New book / 新增册数',
        kind: kind, parent: req.params.series || '', values: req.body || {}, error: error || '', adminUser: req.adminUser });
    }
    router.get(paths[kind], async function (req, res, next) {
      try {
        if (kind === 'book' && !(await catalog.load()).textbooks.findSeries(req.params.series)) return res.sendStatus(404);
        render(req, res);
      } catch (error) { next(error); }
    });
    router.post(paths[kind], async function (req, res, next) {
      if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).send('Save from this website. / 请从本站保存。');
      try {
        var row = await catalog.add(kind, Object.assign({}, req.body, { parent: req.params.series }));
        if (req.get('accept') === 'application/json') return res.json({ key: row.entry_key, en: row.en, zh: row.zh });
        res.redirect(303, kind === 'theme' ? '/admin/materials/new?theme=' + row.entry_key : '/admin/textbooks');
      } catch (error) {
        if (error.status === 400 || error.status === 409) {
          res.status(error.status);
          if (req.get('accept') === 'application/json') return res.json({ error: error.message });
          return render(req, res, error.message);
        }
        next(error);
      }
    });
  });
  return router;
}

module.exports = create();
module.exports.create = create;
