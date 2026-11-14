'use strict';
var express = require('express');
var model = require('../services/communityAdmin');
var resourceService = require('../services/teacherResources');
var promotion = require('../services/teacherResourcePromotion');
var statusLabels = { published:'已发布',unpublished:'未发布',hidden:'已下架',expired:'推广到期 · 停止展示' };
function create(options) {
  options = options || {};
  var store = options.store || resourceService;
  var repository = options.repository || require('../services/communityRepository');
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var router = express.Router();
  router.use(function(req,res,next) { res.set('Cache-Control','private, no-store'); next(); });
  function guard(req,res) {
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) { res.status(403).send('请从本站保存。'); return false; }
    return true;
  }
  async function all() { var data = await Promise.all([store.list(),repository.listAll(null)]); return model.rows(data[0],data[1]); }
  async function editor(req,res,next,values,error) {
    try {
      var id = values && values.id || req.params.id;
      var item = id ? (await store.list()).find(function(row) { return row.id === id; }) : {id:'',draft:{},published:null};
      if (!item) return res.sendStatus(404);
      res.render('admin/teacher-resources', { title:item.id ? '编辑 / 审核教学网站' : '新增教学网站',adminUser:req.adminUser,rows:[item],rowInfo:model.rows([item],[])[0],changes:model.differences(item),statusLabels:statusLabels,fields:resourceService.fields,promotionTypes:promotion.TYPES,promotionState:promotion.state,values:values || {},error:error || '',saved:req.query.saved === 'yes' });
    } catch (err) { next(err); }
  }
  router.get('/teacher-resources',function(req,res) { res.redirect(302,'/admin/community?kind=website'); });
  router.get('/community',async function(req,res,next) {
    try {
      var rows = await all(), q = String(req.query.q || '').trim().slice(0,120), kind = Object.hasOwn(model.kinds,req.query.kind) ? req.query.kind : '', status = ['pending','published','unpublished','reports','hidden','returned'].includes(req.query.status) ? req.query.status : '', relation = ['none','paid','affiliate','other','unknown'].includes(req.query.relation) ? req.query.relation : '';
      var counts = {pending:0,published:0,unpublished:0,reports:0};
      var scoped = rows.filter(function(row) { return !kind || row.kind === kind; });
      scoped.forEach(function(row) { if(row.pending) counts.pending++; if(row.status==='published') counts.published++; else counts.unpublished++; if(row.reports) counts.reports++; });
      rows = scoped.filter(function(row) {
        return (!q || (row.name+' '+row.summary+' '+row.author).toLowerCase().includes(q.toLowerCase())) && (!relation || row.type==='website' && ((row.raw.published || row.raw.draft).promotion || {type:'unknown'}).type===relation) && (!status || status==='pending' && row.pending || status==='published' && row.status==='published' || status==='unpublished' && row.status!=='published' || status==='reports' && row.reports>0 || status==='hidden' && row.status==='hidden' || status==='returned' && row.raw.review && row.raw.review.status==='returned');
      });
      var total=rows.length,page=Math.max(1,Math.min(Math.ceil(total/30)||1,parseInt(req.query.page,10)||1));
      res.render('admin/community-manage',{title:'分享区管理',adminUser:req.adminUser,rows:rows.slice((page-1)*30,page*30),counts:counts,kinds:model.kinds,statusLabels:statusLabels,q:q,kind:kind,status:status,relation:relation,page:page,pages:Math.ceil(total/30)||1,total:total,done:req.query.done==='delete' ? '已永久删除该分享。' : ''});
    } catch(error) { next(error); }
  });
  router.get('/community/websites/new',function(req,res,next) { editor(req,res,next); });
  router.get('/community/websites/:id',function(req,res,next) { editor(req,res,next); });
  router.post('/teacher-resources',async function(req,res,next) {
    if(!guard(req,res)) return;
    if(!['draft','publish','unpublish','return'].includes(req.body.action)) return res.status(400).send('操作无效。');
    try {
      if(req.body.id && !/^\d+$/.test(String(req.body.revision || ''))) return res.status(400).send('请刷新页面后再保存。');
      var id = await store.save(req.body.id || null,req.body);
      res.redirect(303,'/admin/community/websites/'+id+'?saved=yes');
    } catch(error) {
      if(error.status===409) return res.status(409).send('内容已更新，请刷新后重新审核。');
      if(error.status!==400) return next(error);
      res.status(400); editor(req,res,next,req.body,error.message);
    }
  });
  router.get('/community/posts/:id',async function(req,res,next) {
    try {
      var post=await repository.get(req.params.id);if(!post) return res.sendStatus(404);
      res.render('admin/community-post-review',{title:'审核分享内容',adminUser:req.adminUser,post:post,rowInfo:model.rows([],[post])[0],statusLabels:statusLabels,kinds:model.kinds,reports:await repository.reports(post.id)});
    } catch(error) {next(error);}
  });
  async function batch(req,res,next,execute) {
    if(!guard(req,res)) return;
    var selected=[].concat(req.body.selected || []),action=req.body.action,category=req.body.category || '';
    if(!selected.length || selected.length>100 || !['publish','unpublish','category'].includes(action)) return res.status(400).send('请选择1至100项及有效操作。');
    if(execute && req.body.confirmed!=='yes') return res.status(400).send('请先确认批量操作。');
    try {
      var current=await all(),results=[];
      for(var key of Array.from(new Set(selected))) {
        var row=current.find(function(item) {return item.key===key;}),error=model.check(row,action,category);
        var result={key:key,name:row ? row.name : '已变更内容',error:error,done:false};
        if(execute && !error) {
          try {
            if(row.type==='website') await store.save(row.id,action==='publish' ? Object.assign(model.form(row.raw),{action:'publish',confirmed:'yes'}) : {action:action,category:category,revision:row.raw.revision || 0});
            else await repository.setStatus(row.id,action==='publish' ? 'live' : 'hidden');
            result.done=true;
          } catch(err) {result.error=err.status===409 ? '内容已更新，请重新选择。' : err.message;}
        }
        results.push(result);
      }
      if(execute) require('./community').invalidate();
      res.render('admin/community-bulk',{title:execute ? '批量处理结果' : '批量操作检查',adminUser:req.adminUser,results:results,action:action,category:category,execute:execute});
    } catch(error) {next(error);}
  }
  router.post('/community/bulk/preview',function(req,res,next) {batch(req,res,next,false);});
  router.post('/community/bulk/execute',function(req,res,next) {batch(req,res,next,true);});
  return router;
}
module.exports=create();
module.exports.create=create;
