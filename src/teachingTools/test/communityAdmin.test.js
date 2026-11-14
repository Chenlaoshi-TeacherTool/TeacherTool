'use strict';
var test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
var resources=require('../services/teacherResources'),model=require('../services/communityAdmin');
var dir,store,server,base,posts=[];
function body(extra) {return Object.assign({name:'网站测试',url:'https://example.org/',summary:'已发布介绍',category:'中文教学',disclosure:'无商业关系',relationshipType:'none',checkedAt:'2026-11-14',confirmed:'yes',action:'publish'},extra);}
function send(url,values,origin) {return fetch(base+url,{method:'POST',headers:{Origin:origin || 'https://teachers.example','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values),redirect:'manual'});}
async function rows() {return model.rows(await store.list(),posts);}
test.before(async function(){
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'community-admin-'));var file=path.join(dir,'resources.json');await fs.writeFile(file,'[]');store=resources.create({file:file});
  var app=express();app.set('views',path.join(__dirname,'../views'));app.set('view engine','ejs');app.use(express.urlencoded({extended:false}));app.use(function(req,res,next){req.adminUser={name:'Test admin'};res.locals.adminWorkspace=[];next();});
  app.use('/admin',require('../routes/adminTeacherResources').create({store:store,origin:'https://teachers.example',repository:{listAll:async function(){return posts;},get:async function(id){return posts.find(function(p){return p.id===id;});},reports:async function(){return [{reason:'测试举报'}];},setStatus:async function(id,status){var post=posts.find(function(p){return p.id===id;});if(post)post.status=status;return Boolean(post);}}}));
  server=app.listen(0,'127.0.0.1');await new Promise(function(resolve){server.once('listening',resolve);});base='http://127.0.0.1:'+server.address().port;
});
test.after(async function(){await new Promise(function(resolve){server.close(resolve);});await fs.rm(dir,{recursive:true,force:true});});
test('unified list separates live status from pending changes and filters all four kinds; editor shows both versions',async function(){
  var id=await store.save(null,body({authorName:'投稿老师'}),'owner');await store.save(id,body());await store.save(id,body({summary:'新版待审核',authorName:'投稿老师'}),'owner');
  posts.push({id:'game1234',kind:'game',title:'课堂游戏测试',description:'小组练习',authorName:'王老师',status:'live',payload:{words:['苹果']},reportCount:1});
  posts.push({id:'list1234',kind:'wordlist',title:'词汇材料测试',description:'词汇练习',authorName:'李老师',status:'live',payload:[{zh:'苹果'}],reportCount:0});
  posts.push({id:'event123',kind:'contest',title:'比赛活动测试',description:'公开比赛',authorName:'张老师',status:'pending',payload:{url:'https://example.org/'},reportCount:0});
  var row=(await rows()).find(function(row){return row.id===id;});assert.equal(row.status,'published');assert.equal(row.task,'新版本待审核');
  var html=await (await fetch(base+'/admin/community')).text();assert.ok(html.includes('新版本待审核'));assert.ok(html.includes('已发布'));assert.ok(!html.includes('name="summary"'));assert.ok(html.includes('课堂游戏测试'));
  html=await (await fetch(base+'/admin/community?kind=website&status=pending')).text();assert.ok(html.includes('网站测试'));assert.ok(!html.includes('课堂游戏测试'));
  html=await (await fetch(base+'/admin/community?status=reports')).text();assert.ok(html.includes('课堂游戏测试'));assert.ok(!html.includes('网站测试'));
  html=await (await fetch(base+'/admin/community/websites/'+id)).text();assert.ok(html.includes('已发布介绍'));assert.ok(html.includes('新版待审核'));assert.ok(html.includes('changed-field'));
  html=await (await fetch(base+'/admin/community/posts/game1234')).text();assert.ok(html.includes('测试举报'));assert.ok(html.includes('苹果'));
  var response=await fetch(base+'/admin/teacher-resources',{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/admin/community?kind=website');
});
test('batch preview performs no writes; confirmation publishes eligible entries, skips invalid rows and stale revisions',async function(){
  var id=await store.save(null,body({name:'可发布网站',action:'draft'}));
  var bad=await store.save(null,body({name:'缺少披露',authorName:'投稿老师'}),'teacher-owner');await store.save(bad,body({name:'缺少披露',action:'draft',disclosure:''}));
  var current=await rows(),goodRow=current.find(function(row){return row.id===id;}),badRow=current.find(function(row){return row.id===bad;});
  var values=new URLSearchParams({action:'publish'});values.append('selected',goodRow.key);values.append('selected',badRow.key);
  var response=await send('/admin/community/bulk/preview',values);assert.equal(response.status,200);var html=await response.text();assert.ok(html.includes('可以执行'));assert.ok(html.includes('发布前还缺'));assert.equal((await store.list()).find(function(row){return row.id===id;}).published,null);
  response=await send('/admin/community/bulk/execute',values);assert.equal(response.status,400);
  values.set('confirmed','yes');response=await send('/admin/community/bulk/execute',values);assert.equal(response.status,200);assert.ok((await store.list()).find(function(row){return row.id===id;}).published);assert.equal((await store.list()).find(function(row){return row.id===bad;}).published,null);
  response=await send('/admin/community/bulk/execute',values);html=await response.text();assert.ok(html.includes('内容已变更'));
  response=await send('/admin/community/bulk/preview',values,'https://attacker.example');assert.equal(response.status,403);
});
test('category edits preserve unapproved fields and live content; bulk hides both legacy posts and websites without deleting',async function(){
  var id=await store.save(null,body({authorName:'Teacher'}),'other-owner');await store.save(id,body());await store.save(id,body({summary:'未审核的内容',authorName:'Teacher'}),'other-owner');
  var row=(await rows()).find(function(row){return row.id===id;});
  var response=await send('/admin/community/bulk/execute',{selected:row.key,action:'category',category:'新用途分类',confirmed:'yes'});assert.equal(response.status,200);
  var item=(await store.list()).find(function(row){return row.id===id;});assert.equal(item.draft.category,'新用途分类');assert.equal(item.published.category,'新用途分类');assert.equal(item.published.summary,'已发布介绍');assert.equal(item.draft.summary,'未审核的内容');assert.equal(item.review.status,'pending');
  var current=await rows(),values=new URLSearchParams({action:'unpublish',confirmed:'yes'});values.append('selected',current.find(function(row){return row.id===id;}).key);values.append('selected',current.find(function(row){return row.id==='game1234';}).key);
  response=await send('/admin/community/bulk/execute',values);assert.equal(response.status,200);assert.equal((await store.list()).find(function(row){return row.id===id;}).published,null);assert.equal(posts.find(function(post){return post.id==='game1234';}).status,'hidden');
  assert.equal((await store.list()).find(function(row){return row.id===id;}).draft.summary,'未审核的内容');
});
test('relationship dropdown saves from the list and returns to the same filter',async function(){
  var id=await store.save(null,body({name:'关系网站',action:'draft',relationshipType:'unknown'}));
  var html=await (await fetch(base+'/admin/community?kind=website')).text();assert.ok(html.includes('form="rel-'+id+'"'));assert.ok(html.includes('action="/admin/community/websites/'+id+'/relationship"'));
  var item=(await store.list()).find(function(row){return row.id===id;});
  var response=await send('/admin/community/websites/'+id+'/relationship',{relationshipType:'affiliate',revision:String(item.revision),back:'/admin/community?kind=website'});
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/admin/community?kind=website');
  assert.equal((await store.list()).find(function(row){return row.id===id;}).draft.promotion.type,'affiliate');
  response=await send('/admin/community/websites/'+id+'/relationship',{relationshipType:'none',revision:String(item.revision),back:'https://evil.example/'});assert.equal(response.status,409);
  item=(await store.list()).find(function(row){return row.id===id;});
  response=await send('/admin/community/websites/'+id+'/relationship',{relationshipType:'none',revision:String(item.revision),back:'https://evil.example/'});assert.equal(response.headers.get('location'),'/admin/community');
  response=await send('/admin/community/websites/'+id+'/relationship',{relationshipType:'none',revision:'0'},'https://attacker.example');assert.equal(response.status,403);
});
test('pending posts can be rejected without going live; review page offers reject and permanent delete',async function(){
  posts.push({id:'pend1234',kind:'wordlist',title:'待审核词表',description:'待审核',authorName:'赵老师',status:'pending',payload:[{zh:'香蕉'}],reportCount:0});
  var html=await (await fetch(base+'/admin/community/posts/pend1234')).text();
  assert.ok(html.includes('value="publish"'));assert.ok(html.includes('检查并拒绝'));assert.ok(html.includes('action="/admin/community/pend1234/delete"'));
  var row=(await rows()).find(function(row){return row.id==='pend1234';});
  var response=await send('/admin/community/bulk/preview',{selected:row.key,action:'unpublish'});html=await response.text();assert.ok(html.includes('可以执行'));assert.equal(posts.find(function(p){return p.id==='pend1234';}).status,'pending');
  response=await send('/admin/community/bulk/execute',{selected:row.key,action:'unpublish',confirmed:'yes'});assert.equal(response.status,200);assert.equal(posts.find(function(p){return p.id==='pend1234';}).status,'hidden');
  html=await (await fetch(base+'/admin/community/posts/pend1234')).text();assert.ok(html.includes('value="publish"'));assert.ok(!html.includes('value="unpublish"'));
  html=await (await fetch(base+'/admin/community?done=delete')).text();assert.ok(html.includes('已永久删除该分享'));
});
