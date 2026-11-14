(function() {
  'use strict';
  var form=document.getElementById('sharing-bulk-form');
  if(!form) return;
  var all=document.getElementById('sharing-select-all'), boxes=Array.from(form.querySelectorAll('[name="selected"]'));
  function update() {
    var count=boxes.filter(function(box) {return box.checked;}).length;
    document.getElementById('sharing-selection-count').textContent='已选 '+count+' 项';
    all.checked=boxes.length>0 && count===boxes.length;all.indeterminate=count>0 && count<boxes.length;
  }
  all.addEventListener('change',function() {boxes.forEach(function(box) {box.checked=all.checked;});update();});
  boxes.forEach(function(box) {box.addEventListener('change',update);});
  form.addEventListener('submit',function(event) {if(!boxes.some(function(box) {return box.checked;})) {event.preventDefault();document.getElementById('sharing-selection-count').textContent='请先选择内容';}});
}());
