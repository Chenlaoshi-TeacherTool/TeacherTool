(function () {
  'use strict';

  function addAccountPlaceholder() {
    if (document.getElementById('accountComingSoon')) return;

    var host = document.querySelector('.hero-inner, .header, .home-hero');
    if (!host) return;

    host.classList.add('account-header-host');
    var button = document.createElement('button');
    button.id = 'accountComingSoon';
    button.className = 'account-coming-soon';
    button.type = 'button';
    button.disabled = true;
    button.title = 'Account saving and sign-in are coming soon.';
    button.setAttribute('aria-label', 'Account features coming soon');

    var icon = document.createElement('span');
    icon.className = 'account-coming-soon-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '◉';
    var label = document.createElement('span');
    label.textContent = 'Account';
    var status = document.createElement('span');
    status.className = 'account-coming-soon-status';
    status.textContent = 'Coming soon';

    button.append(icon, label, status);
    host.append(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAccountPlaceholder);
  } else {
    addAccountPlaceholder();
  }
})();
