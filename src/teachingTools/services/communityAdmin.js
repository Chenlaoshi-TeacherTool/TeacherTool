'use strict';
var crypto = require('crypto');
var resources = require('./teacherResources');
var promotion = require('./teacherResourcePromotion');
var kinds = { game: '课堂游戏', wordlist: '词汇与材料', website: '教学网站', contest: '比赛与活动' };
function differences(row) {
  if(!row.published) return [];
  var result=Object.keys(resources.fields).filter(function(key){return (row.draft[key] || '') !== (row.published[key] || '');}).map(function(key){return {label:resources.fields[key],published:row.published[key] || '—',draft:row.draft[key] || '—'};});
  function business(item) {
    var promo=item.promotion || {};
    return [promotion.TYPES[promo.type || 'unknown'],promo.type==='paid' ? [promo.start,promo.end,promo.pinned ? '推广期间优先展示' : '普通排序',promo.afterExpiry==='hide' ? '到期停止展示' : '到期保留收录'].join(' · ') : ''].filter(Boolean).join(' · ');
  }
  if(business(row.draft)!==business(row.published)) result.push({label:'商业合作与推广',published:business(row.published),draft:business(row.draft)});
  return result;
}
function form(row) {
  var promo = row.draft.promotion || {};
  return Object.assign({},row.draft,{ id:row.id,revision:row.revision || 0,relationshipType:promo.type || 'unknown',promotionStart:promo.start || '',promotionEnd:promo.end || '',promotionPinned:promo.pinned ? 'yes' : '',afterExpiry:promo.afterExpiry || 'retain' });
}
function rows(websites, posts) {
  return websites.map(function(row) {
    var review = row.review || {}, live = Boolean(row.published && promotion.state(row.published).visible);
    var different = differences(row).length>0;
    return { key:'website:'+row.id+':'+(row.revision || 0), id:row.id, type:'website', kind:'website', name:row.draft.name, summary:row.draft.summary, category:row.draft.category, author:review.authorName || '陈老师整理', status:live ? 'published' : review.status === 'hidden' ? 'hidden' : row.published ? 'expired' : 'unpublished', pending:review.status === 'pending', task:review.status === 'pending' ? (row.published ? '新版本待审核' : '首次投稿待审核') : review.status === 'returned' ? '已退回补充' : different ? '有未发布草稿' : '', reports:0, relationship:promotion.TYPES[(row.published || row.draft).promotion && (row.published || row.draft).promotion.type || 'unknown'], href:'/admin/community/websites/'+row.id, raw:row };
  }).concat(posts.map(function(post) {
    var version = crypto.createHash('sha256').update(JSON.stringify([post.title,post.description,post.status,post.payload,post.reportCount])).digest('hex').slice(0,16);
    return { key:'post:'+post.id+':'+version,id:post.id,type:'post',kind:post.kind,name:post.title,summary:post.description,category:kinds[post.kind],author:post.authorName,status:post.status === 'live' ? 'published' : post.status === 'hidden' ? 'hidden' : 'unpublished',pending:post.status === 'pending',task:post.status === 'pending' ? '待审核' : '',reports:post.reportCount || 0,relationship:post.kind === 'website' ? '旧投稿 · 待核实' : '—',href:'/admin/community/posts/'+post.id,raw:post };
  }));
}
function check(row, action, category) {
  if (!row) return '内容已变更或不存在，请刷新列表重新选择。';
  try {
    if (action === 'publish') {
      if (row.status === 'published' && !row.task) return '已发布，无待发布内容。';
      if (row.type === 'website') { var body = Object.assign(form(row.raw),{action:'publish',confirmed:'yes'}); resources.clean(body); promotion.clean(body,true); }
    } else if (action === 'unpublish') {
      // Pending submissions can be rejected (kept hidden) before they ever go live.
      if (!row.raw.published && row.status !== 'published' && !row.pending) return '没有公开版本可下架。';
    } else if (action === 'category') {
      if (row.type !== 'website') return '用途分类只适用于新的网站推荐，不改变内容类型。';
      if (typeof category !== 'string' || !category.trim() || category.trim().length > 120) return '请填写120字以内的网站用途分类。';
    } else return '操作无效。';
  } catch (error) { return error.message; }
  return '';
}
module.exports = { kinds:kinds,rows:rows,form:form,check:check,differences:differences };
