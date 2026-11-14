'use strict';
document.querySelectorAll('[data-resource-open]').forEach(function(button) {
  button.addEventListener('click', function() { document.getElementById(button.dataset.resourceOpen).showModal(); });
});
document.querySelectorAll('.resource-dialog').forEach(function(dialog) {
  dialog.addEventListener('click', function(event) {
    if (event.target !== dialog) return;
    var rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
