(function () {
  'use strict';
  if (window.materialDialogReady || !window.HTMLDialogElement) return;
  window.materialDialogReady = true;
  var dialog = document.createElement('dialog');
  dialog.className = 'material-dialog'; dialog.setAttribute('aria-labelledby', 'materialDialogTitle');
  var close = document.createElement('button'); close.type = 'button'; close.className = 'material-close';
  close.textContent = '×'; close.setAttribute('aria-label', document.documentElement.lang === 'zh' ? '关闭' : 'Close');
  var content = document.createElement('div'); dialog.append(close, content); document.body.append(dialog);
  var trigger;
  close.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) {
    var rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', function () { document.documentElement.classList.remove('material-modal-open'); content.querySelectorAll('video').forEach(function (video) { video.pause(); }); content.replaceChildren(); if (trigger) trigger.focus(); });
  document.addEventListener('click', async function (event) {
    var link = event.target.closest('[data-material-open]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); trigger = link;
    try {
      var response = await fetch(link.href + '?dialog=1');
      if (!response.ok) throw new Error('Load failed');
      content.innerHTML = await response.text(); dialog.showModal(); dialog.scrollTop = 0; document.documentElement.classList.add('material-modal-open');
    } catch (error) { window.location.href = link.href; }
  });
}());
