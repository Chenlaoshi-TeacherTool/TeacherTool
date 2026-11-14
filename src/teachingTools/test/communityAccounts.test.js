'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var express = require('express');
var library = require('../routes/teacherLibrary');
test('account session and Community share availability and the same Azure teacher identity independently of membership',async function() {
  var names=['TEACHER_ACCOUNTS_ENABLED','WEBSITE_INSTANCE_ID','AZURE_AUTH_ENABLED','LIBRARY_CLOUD_ENABLED','TEACHER_ACCOUNT_PROVIDER'];
  var saved=names.map(function(key){return process.env[key];});
  var server;
  try {
    process.env.TEACHER_ACCOUNTS_ENABLED='true';process.env.AZURE_AUTH_ENABLED='true';process.env.WEBSITE_INSTANCE_ID='test-azure';process.env.LIBRARY_CLOUD_ENABLED='false';process.env.TEACHER_ACCOUNT_PROVIDER='teachers';
    var app=express();
    app.use('/api/teacher-library',library.create());
    app.use(require('../routes/community').create({repository:{lastAuthorName:async function(){return '';}}}));
    server=app.listen(0,'127.0.0.1');await new Promise(function(resolve){server.once('listening',resolve);});
    var base='http://127.0.0.1:'+server.address().port;
    var headers={'x-ms-client-principal-id':'teacher-123','x-ms-client-principal-idp':'teachers','x-ms-client-principal-name':'Teacher'};
    async function session(url,head) {return (await fetch(base+url,{headers:head || {}})).json();}
    var account=await session('/api/teacher-library/session',headers),community=await session('/api/community/me',headers);
    assert.equal(account.available,true);assert.equal(account.signedIn,true);assert.equal(account.canWrite,false);assert.equal(community.accountsOn,true);assert.equal(community.signedIn,true);
    community=await session('/api/community/me?back=%2Fcommunity%2Fshare');assert.equal(community.signedIn,false);assert.ok(community.loginUrl.includes('/.auth/login/teachers?post_login_redirect_uri=%2Fcommunity%2Fshare'));
    delete process.env.WEBSITE_INSTANCE_ID;
    account=await session('/api/teacher-library/session',headers);community=await session('/api/community/me',headers);
    assert.equal(account.available,false);assert.equal(community.accountsOn,false);assert.equal(community.signedIn,false);assert.equal(community.loginUrl,null);
  } finally {
    if(server) await new Promise(function(resolve){server.close(resolve);});
    names.forEach(function(key,index){if(saved[index]===undefined) delete process.env[key];else process.env[key]=saved[index];});
  }
});
