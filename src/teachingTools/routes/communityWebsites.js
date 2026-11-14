'use strict';
var express = require('express');
var resources = require('../services/teacherResources');
function create(options) {
  var store = options.store;
  var router = express.Router();
  function access(req,res) {
    var owner = options.owner(req);
    if (owner) return owner;
    res.status(401).render('community/websites', { title: '网站投稿', rows: [], item: null, error: '', signedIn: false, loginUrl: options.loginUrl(req.originalUrl) });
    return null;
  }
  async function owned(id, owner) {
    return (await store.list()).find(function(row) { return row.id === id && row.review && row.review.ownerKey === owner; });
  }
  router.get('/community/websites/mine', async function(req,res,next) {
    var owner = access(req,res); if (!owner) return;
    try { res.set('Cache-Control','private, no-store'); res.render('community/websites', { title: '我的网站投稿', rows: (await store.list()).filter(function(row) { return row.review && row.review.ownerKey === owner; }), item: null, signedIn: true, loginUrl: null, error: '' }); } catch (error) { next(error); }
  });
  router.get('/community/websites/new', function(req,res) {
    if (!access(req,res)) return;
    res.set('Cache-Control','private, no-store');
    res.render('community/website-edit', { title: '提交教学网站', item: {}, values: {}, fields: resources.fields, error: '' });
  });
  router.get('/community/websites/:id/edit', async function(req,res,next) {
    var owner = access(req,res); if (!owner) return;
    try {
      var item = await owned(req.params.id, owner); if (!item) return res.sendStatus(404);
      res.set('Cache-Control','private, no-store');
      res.render('community/website-edit', { title: '修改网站投稿', item: item, values: Object.assign({},item.draft,{ authorName: item.review.authorName, revision: item.revision || 0 }), fields: resources.fields, error: '' });
    } catch (error) { next(error); }
  });
  router.post('/community/websites/submit', express.urlencoded({ extended: false, limit: '40kb' }), async function(req,res,next) {
    if (req.get('origin') !== options.origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).send('请从本站提交。');
    var owner = access(req,res); if (!owner) return;
    var item = {};
    try {
      if (req.body.id) {
        item = await owned(req.body.id, owner); if (!item) return res.sendStatus(404);
        if (!/^\d+$/.test(String(req.body.revision || ''))) return res.status(400).send('请刷新页面后再提交。');
      }
      if (!options.allow(owner)) return res.status(429).send('今天提交次数较多，请明天再试。');
      await store.save(req.body.id || null, req.body, owner);
      res.redirect(303, '/community/websites/mine');
    } catch (error) {
      if (error.status === 409) return res.status(409).send('内容已更新，请重新打开“我的网站投稿”检查后再提交。');
      if (error.status !== 400) return next(error);
      res.status(400).render('community/website-edit', { title: '提交教学网站', item: item, values: req.body, fields: resources.fields, error: error.message });
    }
  });
  return router;
}
module.exports = { create: create };
