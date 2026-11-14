'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var fs = require('node:fs/promises');
var path = require('node:path');
var os = require('node:os');
var resources = require('../services/teacherResources');
var store, dir, server, base;
var SITE = 'https://teachers.example';
function submission(extra) { return Object.assign({ name: 'Teacher website', url: 'https://example.org/', summary: 'First submission', category: '课堂互动', disclosure: '我是作者', authorName: '张老师' },extra); }
function send(url, body, user, origin) { return fetch(base + url,{ method:'POST',headers: { Origin:origin || SITE,'Content-Type':'application/x-www-form-urlencoded','test-user':user || 'alice' },body:new URLSearchParams(body),redirect:'manual' }); }
async function row(id) { return (await store.list()).find(function(item) { return item.id === id; }); }
test.before(async function() {
  dir = await fs.mkdtemp(path.join(os.tmpdir(),'website-review-')); store = resources.create({file:path.join(dir,'resources.json')});
  var app = express(); app.set('views',path.join(__dirname,'../views')); app.set('view engine','ejs'); app.use(express.urlencoded({extended:false}));
  app.use(function(req,res,next) { res.locals.lang='zh'; res.locals.t=function(key) { return require('../services/i18n').t('zh',key); }; req.adminUser={name:'Test admin'}; res.locals.adminWorkspace=[]; next(); });
  app.use(require('../routes/community').create({ resourceStore:store,repository:{listAll:async function() { return []; }}, origin:SITE, accountsOn:function() { return true; },getUser:function(req) { return req.get('test-user') ? {id:req.get('test-user')} : null; },ownerKey:function(user) { return user.id; } }));
  app.use('/admin',function(req,res,next) { if(req.get('test-user')!=='admin') return res.sendStatus(403); next(); },require('../routes/adminTeacherResources').create({store:store,origin:SITE}));
  server=app.listen(0,'127.0.0.1'); await new Promise(function(resolve) { server.once('listening',resolve); }); base='http://127.0.0.1:'+server.address().port;
});
test.after(async function() { await new Promise(function(resolve) { server.close(resolve); }); await fs.rm(dir,{recursive:true,force:true}); });
test('teacher submits privately; admin returns with feedback; owner resubmits; approve and re-review preserve the approved version',async function() {
  var response=await send('/community/websites/submit',submission({action:'publish',confirmed:'yes',relationshipType:'none'})); assert.equal(response.status,303);
  var item=(await store.list()).find(function(item) { return item.review && item.review.ownerKey==='alice'; }); var id=item.id;
  assert.equal(item.review.status,'pending'); assert.equal(item.published,null);
  assert.ok(!(await (await fetch(base+'/community')).text()).includes('First submission'));
  response=await send('/admin/teacher-resources', {id:id,revision:item.revision,action:'return',reviewNote:'请补充收费限制。'},'admin'); assert.equal(response.status,303);
  var mine=await (await fetch(base+'/community/websites/mine',{headers:{'test-user':'alice'}})).text(); assert.ok(mine.includes('请补充收费限制。')); assert.ok(mine.includes('退回补充'));
  item=await row(id);
  response=await send('/community/websites/submit',submission({id:id,revision:item.revision,limitations:'部分收费'}));assert.equal(response.status,303);
  item=await row(id);assert.equal(item.review.status,'pending');assert.equal(item.review.note,'');
  var staleRevision=item.revision;
  response=await send('/admin/teacher-resources',Object.assign({},item.draft,{id:id,revision:item.revision,action:'publish',confirmed:'yes',relationshipType:'none',checkedAt:'2026-11-14'}),'admin'); assert.equal(response.status,303);
  item=await row(id);assert.equal(item.published.summary,'First submission');assert.equal(item.published.authorName,'张老师');
  response=await send('/community/websites/submit',submission({id:id,revision:item.revision,summary:'UNREVIEWED CHANGES',url:'https://changed.example.org/'}));assert.equal(response.status,303);
  var publicHtml=await (await fetch(base+'/community')).text(); assert.ok(publicHtml.includes('First submission'));assert.ok(!publicHtml.includes('UNREVIEWED CHANGES'));assert.ok(!publicHtml.includes('changed.example.org'));
  response=await send('/admin/teacher-resources',Object.assign({},item.draft,{id:id,revision:staleRevision,action:'publish',confirmed:'yes',relationshipType:'none',checkedAt:'2026-11-14'}),'admin');assert.equal(response.status,409);
  assert.equal((await row(id)).draft.summary,'UNREVIEWED CHANGES');
  item=await row(id);response=await send('/admin/teacher-resources',{id:id,revision:item.revision,action:'return',reviewNote:'请确认新网址。'},'admin');assert.equal(response.status,303);
  assert.equal((await row(id)).published.summary,'First submission');
  item=await row(id);response=await send('/admin/teacher-resources',{id:id,revision:item.revision,action:'unpublish'},'admin');assert.equal(response.status,303);assert.equal((await row(id)).published,null);
});
test('authentication, ownership, same-origin protection and required disclosures apply to website submissions',async function() {
  assert.equal((await fetch(base+'/community/websites/mine')).status,401);
  assert.equal((await fetch(base+'/community/websites/new')).status,401);
  var response=await fetch(base+'/community/websites/submit',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(submission())});assert.equal(response.status,401);
  response=await send('/community/websites/submit',submission(),'alice','https://attacker.example');assert.equal(response.status,403);
  response=await send('/community/websites/submit',submission({disclosure:''}));assert.equal(response.status,400);
  var item=(await store.list()).find(function(item) { return item.review && item.review.ownerKey==='alice'; });
  response=await fetch(base+'/community/websites/'+item.id+'/edit',{headers:{'test-user':'bob'}});assert.equal(response.status,404);
  response=await send('/community/websites/submit',submission({id:item.id,revision:item.revision}),'bob');assert.equal(response.status,404);
  response=await send('/admin/teacher-resources',{id:item.id,revision:item.revision,action:'publish'},'alice');assert.equal(response.status,403);
  var mine=await (await fetch(base+'/community/websites/mine',{headers:{'test-user':'bob'}})).text();assert.ok(!mine.includes(item.draft.name));
});
test('SQL concurrent-review conflicts are surfaced instead of replacing a newer revision', async function() {
  var draft = submission();
  var queryText;
  var db = { sql: { VarChar:function() {},NVarChar:function() {},MAX:'MAX',Int:'Int' },getPool:async function() { return {request:function() { return {
    input:function() { return this; },query:async function(query) {
      if (query.startsWith('SELECT')) return {recordset:[{id:'existing',draft:JSON.stringify(draft),published:null,review:JSON.stringify({ownerKey:'alice',authorName:'Teacher',status:'pending'}),revision:2}]};
      queryText=query;var error=new Error('Concurrent update');error.number=51001;throw error;
    }
  }; }}; }};
  await assert.rejects(resources.create({db:db}).save('existing',Object.assign({},draft,{action:'publish',confirmed:'yes',relationshipType:'none',checkedAt:'2026-11-14',revision:2})),function(error) { return error.status===409; });
  assert.ok(queryText.includes('revision=@revision'));
  assert.ok(queryText.includes('UPDLOCK,HOLDLOCK'));
});
