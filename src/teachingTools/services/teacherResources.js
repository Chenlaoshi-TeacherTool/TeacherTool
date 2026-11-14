'use strict';
var fs = require('fs/promises');
var path = require('path');
var crypto = require('crypto');
var promotion = require('./teacherResourcePromotion');
var fields = { name: '网站名称', url: '公开网址', summary: '一句话简介', category: '分类', features: '用途与主要功能', audience: '适用对象与教学场景', reason: '推荐理由', limitations: '使用限制', pricing: '收费情况', disclosure: '利益关系说明', checkedAt: '最近核查日期' };
function invalid(message) { var error = new Error(message); error.status = 400; throw error; }
function clean(body) {
  var value = {};
  Object.keys(fields).forEach(function(key) {
    if (body[key] != null && typeof body[key] !== 'string') invalid('内容格式不正确。');
    value[key] = String(body[key] || '').trim();
    if (value[key].length > (key === 'summary' ? 500 : key === 'name' || key === 'category' ? 120 : 3000)) invalid(fields[key] + '过长。');
  });
  if (!value.name || !value.url) invalid('请填写网站名称和网址。');
  var url;
  try { url = new URL(value.url); } catch (error) { invalid('请填写有效的公开 HTTPS 网址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.startsWith('[')) invalid('请填写公开 HTTPS 网址，不包含登录凭据。');
  value.url = url.href;
  if (value.checkedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(value.checkedAt) || !Number.isFinite(Date.parse(value.checkedAt)) || new Date(value.checkedAt).toISOString().slice(0,10) !== value.checkedAt)) invalid('核查日期格式不正确。');
  return value;
}
// Teacher submissions need the full disclosure before going live. Websites the
// editor adds herself only need a name and URL (checked in clean).
function checkPublish(value, body, teacher) {
  if (!teacher) return;
  var missing = [['summary','一句话简介'],['category','分类'],['disclosure','利益关系说明'],['checkedAt','最近核查日期']].filter(function(item) { return !value[item[0]]; }).map(function(item) { return item[1]; });
  if (body.confirmed !== 'yes') missing.push('底部的确认勾选');
  if (missing.length) invalid('老师投稿发布前还缺：' + missing.join('、') + '。');
}
// Editor-curated websites count as "no commercial relationship" unless set otherwise.
function publishPromotion(body, teacher) {
  if (!teacher && (body.relationshipType || 'unknown') === 'unknown') body = Object.assign({}, body, { relationshipType: 'none' });
  return promotion.clean(body, true);
}
function create(options) {
  options = options || {};
  var db = options.db || require('./sqlClient');
  var file = options.file || path.join(__dirname, '../tmp/teacher-resources.json');
  var pending = Promise.resolve();
  function sqlMode() { return Boolean(options.db || process.env.SQL_CONNECTION_STRING); }
  async function list() {
    if (sqlMode()) return (await (await db.getPool()).request().query('SELECT id, draft, published, review, revision FROM dbo.teacher_resources ORDER BY id')).recordset.map(function(row) { return { id: row.id, draft: JSON.parse(row.draft), published: row.published ? JSON.parse(row.published) : null, review: row.review ? JSON.parse(row.review) : {}, revision: row.revision || 0 }; });
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return require('../data/teacher-resource-drafts.json').map(function(item) { return { id: item.id, draft: item, published: null }; }); throw error; }
  }
  function save(id, body, owner) {
    if (id && !/^[a-z0-9-]{1,40}$/.test(id)) invalid('资源编号无效。');
    var action = owner ? 'submit' : body.action;
    var value = ['unpublish','return','category','relationship'].includes(action) ? null : clean(Object.assign({},body,{ action: action }));
    if (owner && (!value.summary || !value.category || !value.disclosure || typeof body.authorName !== 'string' || !body.authorName.trim() || String(body.authorName).length > 40)) invalid('请填写简介、分类、署名与利益关系说明。');
    var note = String(body.reviewNote || '').trim();
    if (note.length > 1000 || (action === 'return' && !note)) invalid('退回补充时请填写处理意见，最多1000字。');
    id = id || crypto.randomUUID();
    var task = pending.then(async function() {
      var rows = await list();
      var row = rows.find(function(item) { return item.id === id; });
      if (!row) { if (['unpublish','return','category','relationship'].includes(action)) invalid('资源不存在。'); row = { id: id, published: null, review: {}, revision: 0 }; rows.push(row); }
      row.review = row.review || {};
      var expected = row.revision || 0;
      if (owner && row.review.ownerKey && row.review.ownerKey !== owner) { var forbidden = new Error('无法编辑其他老师的投稿。'); forbidden.status = 404; throw forbidden; }
      if (owner && !row.review.ownerKey && row.draft) { var forbidden = new Error('无法编辑此资源。'); forbidden.status = 404; throw forbidden; }
      if (body.revision != null && Number(body.revision) !== expected) { var conflict = new Error('内容已更新，请刷新页面后再检查和提交。'); conflict.status = 409; throw conflict; }
      if (action === 'category') {
        if (typeof body.category !== 'string' || !body.category.trim() || body.category.trim().length > 120) invalid('请填写120字以内的网站用途分类。');
        row.draft.category = body.category.trim();
        if (row.published) row.published.category = body.category.trim();
      }
      if (action === 'relationship') {
        var type = body.relationshipType;
        if (typeof type !== 'string' || !['none','affiliate','other','unknown'].includes(type)) invalid('请选择商业关系类型；付费推广请在编辑页设置日期。');
        row.draft.promotion = { type: type };
        if (row.published) row.published.promotion = { type: type };
      }
      if (action === 'publish') checkPublish(value, body, Boolean(row.review.ownerKey));
      if (value) value.promotion = owner ? (row.draft && row.draft.promotion || row.published && row.published.promotion || { type: 'unknown' }) : action === 'publish' ? publishPromotion(body, Boolean(row.review.ownerKey)) : promotion.clean(body, false);
      if (owner) row.review = Object.assign({}, row.review, { ownerKey: owner, authorName: body.authorName.trim(), status: 'pending', note: '', submittedAt: new Date().toISOString() });
      else if (action === 'return') { if (!row.review.ownerKey) invalid('此资源不是老师投稿。'); row.review.status = 'returned'; row.review.note = note; }
      else if (action === 'publish') { row.review.status = 'approved'; row.review.note = ''; }
      row.revision = expected + 1;
      if (value) row.draft = value;
      if (action === 'publish') row.published = Object.assign({},value,{ authorName: row.review.authorName || '', source: row.review.ownerKey ? 'teacher' : 'editor' });
      if (action === 'unpublish') { row.published = null; row.review.status = 'hidden'; }
      if (sqlMode()) {
        try {
          await (await db.getPool()).request().input('id', db.sql.VarChar(40), id).input('draft', db.sql.NVarChar(db.sql.MAX), JSON.stringify(row.draft)).input('published', db.sql.NVarChar(db.sql.MAX), row.published ? JSON.stringify(row.published) : null).input('review', db.sql.NVarChar(db.sql.MAX), JSON.stringify(row.review)).input('revision', db.sql.Int, expected)
            .query("SET XACT_ABORT ON; BEGIN TRANSACTION; IF EXISTS (SELECT 1 FROM dbo.teacher_resources WITH (UPDLOCK,HOLDLOCK) WHERE id=@id) BEGIN UPDATE dbo.teacher_resources SET draft=@draft,published=@published,review=@review,revision=revision+1 WHERE id=@id AND revision=@revision; IF @@ROWCOUNT=0 THROW 51001, 'Resource changed; refresh before saving.', 1; END ELSE INSERT INTO dbo.teacher_resources(id,draft,published,review,revision) VALUES(@id,@draft,@published,@review,1); COMMIT;");
        } catch (error) { if (error.number === 51001) { error.status = 409; error.message = '内容已更新，请刷新后重新审核。'; } throw error; }
      }
      else { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file + '.tmp', JSON.stringify(rows, null, 2)); await fs.rename(file + '.tmp', file); }
      return id;
    });
    pending = task.catch(function() {});
    return task;
  }
  return { list: list, save: save };
}
module.exports = Object.assign(create(), { create: create, clean: clean, checkPublish: checkPublish, publishPromotion: publishPromotion, fields: fields });
