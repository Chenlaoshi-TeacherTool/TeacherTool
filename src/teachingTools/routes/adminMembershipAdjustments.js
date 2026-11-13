'use strict';
var express = require('express');
function create(options) {
  options = options || {};
  var store = options.store || require('../services/membershipAdjustments');
  var router = express.Router();
  function render(req,res,teacher,error,values) {
    res.render('admin/membership-adjust', { title:'调整会员', adminUser:req.adminUser, teacher:teacher, error:error || '', values:values || { action:'extend', days:'30', reason:'', date:'' }, saved: req.query.saved === '1' });
  }
  router.get('/memberships/:owner/adjust', async function(req,res,next) {
    res.set('Cache-Control','private, no-store');
    try { var teacher = await store.get(req.params.owner); if(!teacher) return res.sendStatus(404); render(req,res,teacher); }
    catch(error) { next(error); }
  });
  router.post('/memberships/:owner/adjust', async function(req,res,next) {
    res.set('Cache-Control','private, no-store');
    var origin = options.origin || process.env.SITE_URL || 'https://clsteachingtools.com';
    if (req.get('origin') !== new URL(origin).origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).send('请从本站管理页面保存。');
    try {
      var result = await store.adjust(req.params.owner,req.body,req.adminUser.name);
      if(result.outcome === 'missing') return res.sendStatus(404);
      if(result.outcome === 'conflict') {
        res.status(409);
        return render(req,res,await store.get(req.params.owner),'该老师的会员期限已改变，请核对最新期限后重新确认。',req.body);
      }
      res.redirect(303,'/admin/memberships/' + req.params.owner + '/adjust?saved=1');
    } catch(error) {
      if(error.status === 400) {
        var teacher = await store.get(req.params.owner);
        if(!teacher) return res.sendStatus(404);
        res.status(400); return render(req,res,teacher,error.message,req.body);
      }
      next(error);
    }
  });
  return router;
}
module.exports = create(); module.exports.create = create;
