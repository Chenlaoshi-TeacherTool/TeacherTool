'use strict';

var express = require('express');

function create(options) {
  options = options || {};
  var words = options.words || require('../services/textbookWords');
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var router = express.Router();
  router.use(require('../middleware/requireAdmin'));
  router.post('/textbooks/lessons/:id/words/:action', async function (req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).json({ error: 'Save from this website. / 请从本站保存。' });
    if (!/^[1-9]\d{0,8}$/.test(req.params.id)) return res.sendStatus(404);
    var id = Number(req.params.id);
    var body = req.body || {};
    try {
      if (req.params.action === 'preview') {
        if (!(await words.exists(id))) return res.status(404).json({ error: 'Lesson not found. / 课次不存在。' });
        return res.json(await words.generate(body.text));
      }
      if (req.params.action === 'save') return res.json(await words.append(id, body.items));
      res.sendStatus(404);
    } catch (error) {
      if (error.status === 400 || error.status === 404) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });
  return router;
}

module.exports = create();
module.exports.create = create;
