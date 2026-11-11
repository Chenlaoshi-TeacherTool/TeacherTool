(function () {
  var links = document.querySelectorAll('[data-finds-category]');
  var panels = document.querySelectorAll('[data-finds-panel]');
  function selectCategory() {
    var category = location.hash === '#chinese-class' ? 'chinese-class' : 'every-classroom';
    panels.forEach(function (panel) { panel.hidden = panel.id !== category; });
    links.forEach(function (link) {
      if (link.dataset.findsCategory === category) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', selectCategory);
  selectCategory();
}());

(function () {
  document.querySelectorAll('[data-finds-open]').forEach(function (button) {
    button.addEventListener('click', function () {
      var dialog = document.getElementById(button.dataset.findsOpen);
      dialog.showModal();
      var video = dialog.querySelector('[data-video-src]');
      if (video) video.src = video.dataset.videoSrc;
    });
  });
  document.querySelectorAll('.finds-dialog').forEach(function (dialog) {
    dialog.querySelector('[data-finds-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      var bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
    dialog.addEventListener('close', function () {
      var video = dialog.querySelector('[data-video-src]');
      if (video) video.removeAttribute('src');
    });
  });
}());
