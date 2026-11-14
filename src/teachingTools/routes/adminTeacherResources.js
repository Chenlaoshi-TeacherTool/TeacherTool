'use strict';
var express = require('express');
function create(options) {
  options = options || {};
  var store = options.store || require('../services/teacherResources');
  var fields = require('../services/teacherResources').fields;
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var router = express.Router();
  async function render(req, res, next, values, error) {
    try { res.set('Cache-Control','private, no-store'); res.render('admin/teacher-resources', { title: '教师资源分享', adminUser: req.adminUser, rows: await store.list(), fields: fields, promotionTypes: require('../services/teacherResourcePromotion').TYPES, promotionState: function(item) { return require('../services/teacherResourcePromotion').state(item); }, values: values || {}, error: error || '', saved: req.query.saved === 'yes' }); } catch (err) { next(err); }
  }
  router.get('/teacher-resources', function(req,res,next) { render(req,res,next); });
  router.post('/teacher-resources', async function(req,res,next) {
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).send('请从本站保存。');
    if (!['draft','publish','unpublish','return'].includes(req.body.action)) return res.status(400).send('操作无效。');
    try { if (req.body.id && !/^\d+$/.test(String(req.body.revision || ''))) return res.status(400).send('请刷新页面后再保存。'); await store.save(req.body.id || null, req.body); res.redirect(303, '/admin/teacher-resources?saved=yes'); }
    catch (error) { if (error.status === 409) return res.status(409).send('内容已更新，请刷新后重新审核。'); if (error.status !== 400) return next(error); res.status(400); render(req,res,next,req.body,error.message); }
  });
  return router;
}
module.exports = create();
module.exports.create = create;
