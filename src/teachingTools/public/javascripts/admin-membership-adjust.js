(function() {
  'use strict';
  var form = document.getElementById('membership-adjust');
  if(!form) return;
  var action = form.elements.action;
  var days = form.elements.days;
  var date = form.elements.date;
  var preview = document.getElementById('adjust-preview');
  var before = form.dataset.until;
  function update() {
    document.getElementById('adjust-days').hidden = action.value !== 'extend';
    document.getElementById('adjust-date').hidden = action.value !== 'set';
    days.disabled = action.value !== 'extend'; days.required = !days.disabled;
    date.disabled = action.value !== 'set'; date.required = !date.disabled;
    var until;
    if(action.value === 'stop') until = new Date();
    else if(action.value === 'set') until = new Date(date.value + 'T23:59:59.999Z');
    else if(days.validity.valid && Number(days.value) >= 1) until = new Date(Math.max(Date.now(),before ? Date.parse(before) : 0) + Number(days.value)*86400000);
    preview.textContent = '原到期时间：' + (before || '无') + ' → ' + (until && Number.isFinite(until.getTime()) ? (action.value === 'stop' ? '立即结束权限' : '预计新到期时间：' + until.toISOString() + '（UTC）') : '请填写有效天数或日期');
    document.getElementById('adjust-confirm').textContent = { extend:'确认激活 / 延长', set:'确认修改日期', stop:'确认停用' }[action.value];
  }
  document.getElementById('preset-days').addEventListener('change',function() { if(this.value) days.value=this.value; update(); });
  days.addEventListener('input',function() { document.getElementById('preset-days').value=''; });
  form.addEventListener('input',update); form.addEventListener('change',update);
  form.addEventListener('submit',function(event) { update(); if(!window.confirm(preview.textContent + '\n确认保存这次会员调整？')) event.preventDefault(); });
  update();
})();
