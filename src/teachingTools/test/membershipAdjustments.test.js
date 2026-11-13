'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var path = require('node:path');
var service = require('../services/membershipAdjustments');
var owner = 'a'.repeat(64);
var valid = { action:'extend', days:'30', expected:'none', reason:'School payment' };
test('validates each operation, dates, reason and stale-state token', function() {
  assert.equal(service.validate(valid).days,30);
  assert.equal(service.validate(Object.assign({},valid,{action:'set',date:'2028-02-29'})).until.toISOString(),'2028-02-29T23:59:59.999Z');
  assert.equal(service.validate(Object.assign({},valid,{action:'stop'})).until,null);
  for(var fields of [{days:0},{days:1.5},{days:3661},{reason:''},{reason:'x'.repeat(501)},{expected:'bad'},{action:'bad'},{action:'set',date:'2027-02-29'},{action:'set',date:'2026-04-31'}]) {
    assert.throws(function() { service.validate(Object.assign({},valid,fields)); },function(error) { return error.status === 400; });
  }
});
test('SQL atomically locks access, checks expected state, verifies account and records actor and reason',async function() {
  var inputs={},sqlText='';
  var db={sql:{Char:function(){},VarChar:function(){},NVarChar:function(){},Int:'Int',DateTime2:'DateTime2'},getPool:async function(){return {request:function(){return {input:function(k,t,v){inputs[k]=v;return this;},query:async function(sql){sqlText=sql;return {recordset:[{outcome:'saved'}]};}};}};}};
  await service.create(db).adjust(owner,valid,'Admin');
  assert.equal(inputs.actor,'Admin'); assert.equal(inputs.reason,'School payment');
  assert.match(sqlText,/UPDLOCK,HOLDLOCK/);
  assert.match(sqlText,/BEGIN TRANSACTION/);
  assert.match(sqlText,/ROLLBACK; SELECT 'conflict'/);
  assert.match(sqlText,/teacher_accounts WHERE owner_key=@owner/);
  assert.match(sqlText,/INSERT INTO dbo.membership_events/);
  assert.match(sqlText,/COMMIT/);
  assert.ok(!sqlText.includes('School payment'));
});
test('admin route rejects foreign origins, preserves rejected input, reports conflicts and redirects after success',async function(t) {
  var calls=0,outcome='saved';
  var teacher={owner:owner,email:'teacher@example.org',name:'Teacher',until:null,expected:'none'};
  var store={get:async function(key){return key===owner ? teacher : null;},adjust:async function(key,body,actor){ calls++; service.validate(body); assert.equal(actor,'Admin'); return {outcome:outcome}; }};
  var app=express();app.set('views',path.join(__dirname,'../views'));app.set('view engine','ejs');app.use(express.urlencoded({extended:false}));
  app.use(function(req,res,next){req.adminUser={name:'Admin'};res.locals.adminNav=[];next();});
  app.use('/admin',require('../routes/adminMembershipAdjustments').create({store:store,origin:'http://localhost'}));
  var server=app.listen(0,'127.0.0.1');await new Promise(function(resolve){server.once('listening',resolve);});
  t.after(function(){server.close();});
  var base='http://127.0.0.1:'+server.address().port+'/admin/memberships/'+owner+'/adjust';
  assert.equal((await fetch(base)).status,200);
  assert.equal((await fetch(base.replace(owner,'bad'))).status,404);
  async function post(body,origin){return fetch(base,{method:'POST',headers:{Origin:origin||'http://localhost','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});}
  assert.equal((await post(valid,'https://evil.example')).status,403);assert.equal(calls,0);
  var response=await post(Object.assign({},valid,{days:'0',reason:'<script>bad</script>'}));assert.equal(response.status,400);assert.match(await response.text(),/&lt;script&gt;bad/);
  outcome='conflict';response=await post(valid);assert.equal(response.status,409);assert.match(await response.text(),/期限已改变/);
  outcome='saved';response=await post(valid);assert.equal(response.status,303);assert.match(response.headers.get('location'),/saved=1$/);
});
