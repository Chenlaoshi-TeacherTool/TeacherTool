'use strict';
var express = require('express');
var config = require('../config/editablePages');
function create(options) {
  options = options || {};
  var store = options.store || require('../services/editablePages');
  var router = express.Router();
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  router.get('/pages', function(req, res) { res.render('admin/pages-index', { title: '网站页面', pages: config.pages, adminUser: req.adminUser }); });
  router.get('/pages/:key', async function(req, res, next) {
    if (!Object.hasOwn(config.pages, req.params.key)) return res.sendStatus(404);
    try { res.render('admin/pages-edit', { title: config.pages[req.params.key].title, page: config.pages[req.params.key], key: req.params.key, values: (await store.load(req.params.key)).draft, notice: req.query.saved === 'published' ? '内容已发布。' : req.query.saved === 'draft' ? '草稿已保存，公开页面未更新。' : '', error: '', adminUser: req.adminUser }); }
    catch (error) { next(error); }
  });
  router.post('/pages/:key', async function(req, res, next) {
    if (!Object.hasOwn(config.pages, req.params.key)) return res.sendStatus(404);
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).send('请从本站保存。');
    var publish = req.body.action === 'publish';
    try {
      await store.save(req.params.key, req.body, publish);
      res.redirect(303, '/admin/pages/' + req.params.key + '?saved=' + (publish ? 'published' : 'draft'));
    } catch (error) {
      if (error.status !== 400) return next(error);
      var values = { zh: {}, en: {} };
      config.pages[req.params.key].fields.forEach(function(field) { ['zh', 'en'].forEach(function(lang) { values[lang][field[0]] = req.body[lang + ':' + field[0]] || ''; }); });
      res.status(400).render('admin/pages-edit', { title: config.pages[req.params.key].title, page: config.pages[req.params.key], key: req.params.key, values: values, notice: '', error: error.message, adminUser: req.adminUser });
    }
  });
  return router;
}
module.exports = create();
module.exports.create = create;
