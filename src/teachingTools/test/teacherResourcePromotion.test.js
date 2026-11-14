'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var path = require('node:path');
var os = require('node:os');
var express = require('express');
var promotion = require('../services/teacherResourcePromotion');
var resources = require('../services/teacherResources');
function paid(extra) { return Object.assign({ relationshipType:'paid',promotionStart:'2026-11-14',promotionEnd:'2026-11-15',promotionPinned:'yes',afterExpiry:'retain' },extra); }
function content(extra) { return Object.assign({ name:'Site',url:'https://example.org/',summary:'Teaching site',category:'中文',disclosure:'付费合作说明',checkedAt:'2026-11-14',confirmed:'yes',action:'publish' },extra); }
test('promotion validation requires an explicit relationship and valid ordered dates',function() {
  assert.throws(function() { promotion.clean({},true); });
  assert.throws(function() { promotion.clean({relationshipType:['paid']},true); });
  [{promotionStart:'2026-02-30'},{promotionEnd:''},{promotionStart:'2026-11-16'},{afterExpiry:'other'}].forEach(function(change) { assert.throws(function() { promotion.clean(paid(change),true); }); });
  assert.equal(promotion.clean({relationshipType:'affiliate'},true).type,'affiliate');
});
test('Los Angeles date boundaries retain paid disclosure before and after promotion, stop pinning and optionally hide',function() {
  var item={promotion:promotion.clean(paid(),true)};
  assert.equal(promotion.state(item,Date.parse('2026-11-14T07:59:59Z')).phase,'scheduled');
  assert.equal(promotion.state(item,Date.parse('2026-11-14T08:00:00Z')).pinned,true);
  assert.equal(promotion.state(item,Date.parse('2026-11-16T07:59:59Z')).phase,'active');
  var end=Date.parse('2026-11-16T08:00:00Z');
  assert.equal(promotion.state(item,end).phase,'expired');assert.equal(promotion.state(item,end).pinned,false);assert.equal(promotion.state(item,end).visible,true);
  assert.equal(promotion.badges(item,'zh',end)[0].text,'曾付费推广');
  item.promotion.afterExpiry='hide';assert.equal(promotion.state(item,end).visible,false);
  assert.equal(promotion.state({promotion:promotion.clean(paid({promotionStart:'2026-03-08',promotionEnd:'2026-03-08'}),true)},Date.parse('2026-03-09T06:59:59Z')).phase,'active');
});
test('only admin can change commercial settings; drafts and teacher revisions preserve approved promotion',async function() {
  var dir=await fs.mkdtemp(path.join(os.tmpdir(),'resource-promotion-'));
  try {
    var store=resources.create({file:path.join(dir,'resources.json')});
    var id=await store.save(null,content(Object.assign(paid(),{authorName:'Teacher'})),'owner');
    var item=(await store.list()).find(function(row) { return row.id===id; });assert.equal(item.draft.promotion.type,'unknown');
    await store.save(id,content(paid()));
    await store.save(id,content({relationshipType:'none',action:'submit',authorName:'Teacher',promotionPinned:'yes'}),'owner');
    item=(await store.list()).find(function(row) { return row.id===id; });assert.equal(item.draft.promotion.type,'paid');assert.equal(item.published.promotion.type,'paid');
    await store.save(id,content({relationshipType:'affiliate',action:'draft'}));
    item=(await store.list()).find(function(row) { return row.id===id; });assert.equal(item.draft.promotion.type,'affiliate');assert.equal(item.published.promotion.type,'paid');
    var reloaded=resources.create({file:path.join(dir,'resources.json')});assert.equal((await reloaded.list()).find(function(row) { return row.id===id; }).draft.promotion.type,'affiliate');
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('public cards and dialogs disclose paid and affiliate links, promoted sites sort first, expired hide removes both',async function() {
  var tick=Date.parse('2026-11-14T12:00:00Z');
  var rows=[
    {id:'ordinary',published:content({name:'Ordinary',promotion:{type:'none'}})},
    {id:'paid',published:content({name:'Paid site',promotion:promotion.clean(paid(),true)})},
    {id:'affiliate',published:content({name:'Affiliate',promotion:{type:'affiliate'}})},
    {id:'hide',published:content({name:'Expired hidden',promotion:promotion.clean(paid({promotionStart:'2026-11-10',promotionEnd:'2026-11-13',afterExpiry:'hide'}),true)})}
  ];
  var app=express();app.set('views',path.join(__dirname,'../views'));app.set('view engine','ejs');app.use(function(req,res,next) {res.locals.lang='zh';res.locals.t=function(key) {return key;};next();});
  app.use(require('../routes/community').create({resourceStore:{list:async function(){return rows;}},repository:{listAll:async function(){return [];}},now:function(){return tick;}}));
  var server=app.listen(0,'127.0.0.1');await new Promise(function(resolve){server.once('listening',resolve);});
  try {
    var url='http://127.0.0.1:'+server.address().port+'/community';
    var html=await (await fetch(url)).text();assert.ok(html.indexOf('<h3>Paid site')<html.indexOf('<h3>Ordinary'));assert.ok(!html.includes('Expired hidden'));
    assert.equal((html.match(/>付费推广</g)||[]).length,2);assert.equal((html.match(/>含佣金链接</g)||[]).length,2);assert.ok(html.includes('external sponsored'));
    tick=Date.parse('2026-11-16T08:00:00Z');html=await (await fetch(url)).text();assert.ok(html.indexOf('<h3>Ordinary')<html.indexOf('<h3>Paid site'));assert.equal((html.match(/>曾付费推广</g)||[]).length,2);
  } finally { await new Promise(function(resolve){server.close(resolve);}); }
});
