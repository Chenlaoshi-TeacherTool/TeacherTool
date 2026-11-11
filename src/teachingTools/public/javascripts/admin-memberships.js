(function () {
  'use strict';
  document.querySelectorAll('[data-copy-email]').forEach(function(button) {
    button.addEventListener('click', async function() {
      var status = document.getElementById('email-copy-status');
      try { await navigator.clipboard.writeText(button.dataset.copyEmail); status.textContent = '邮箱已复制。'; }
      catch (error) { status.textContent = '复制失败，请选中邮箱文字手动复制。'; }
    });
  });
})();
