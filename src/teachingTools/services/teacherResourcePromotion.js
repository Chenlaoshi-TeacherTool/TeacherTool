'use strict';
var TYPES = { unknown: '待核实', none: '无商业合作', paid: '付费推广', affiliate: '含佣金链接', other: '其他商业合作' };
function fail(message) { var error = new Error(message); error.status = 400; throw error; }
function date(value) {
  value = value || '';
  if (typeof value !== 'string' || (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value))) fail('推广日期格式不正确。');
  return value;
}
function clean(body, publish) {
  var type = body.relationshipType || 'unknown';
  if (typeof type !== 'string' || !Object.hasOwn(TYPES,type) || (publish && type === 'unknown')) fail('发布前请选择已核实的商业关系类型。');
  var result = { type: type };
  if (type === 'paid') {
    result.start = date(body.promotionStart);
    result.end = date(body.promotionEnd);
    if (!result.start || !result.end || result.start > result.end) fail('付费推广需要有效的开始、结束日期，结束日期不能早于开始日期。');
    result.pinned = body.promotionPinned === 'yes';
    result.afterExpiry = body.afterExpiry || 'retain';
    if (!['retain','hide'].includes(result.afterExpiry)) fail('请选择到期后保留收录或停止展示。');
  }
  return result;
}
function state(item, now) {
  var promotion = item.promotion || { type: 'unknown' };
  var today = new Date(now == null ? Date.now() : now).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
  var phase = promotion.type === 'paid' ? (today < promotion.start ? 'scheduled' : today > promotion.end ? 'expired' : 'active') : '';
  return { type: promotion.type, phase: phase, visible: !(phase === 'expired' && promotion.afterExpiry === 'hide'), pinned: phase === 'active' && promotion.pinned === true };
}
function badges(item, lang, now) {
  var current = state(item,now), zh = lang === 'zh';
  var labels = {
    unknown: ['商业关系待核实','Commercial relationship unverified'],
    none: ['无商业合作','No commercial relationship'],
    affiliate: ['含佣金链接','Affiliate link'],
    other: ['商业合作','Commercial partnership']
  };
  if (current.type === 'paid') {
    var paid = { scheduled: ['付费合作 · 推广未开始','Paid partnership · scheduled'], active: ['付费推广','Paid promotion'], expired: ['曾付费推广','Previously paid promotion'] };
    return [{ text: paid[current.phase][zh ? 0 : 1], commercial: true }];
  }
  return [{ text: (labels[current.type] || labels.unknown)[zh ? 0 : 1], commercial: current.type !== 'none' }];
}
module.exports = { TYPES: TYPES, clean: clean, state: state, badges: badges };
