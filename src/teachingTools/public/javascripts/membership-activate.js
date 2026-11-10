(function () {
  'use strict';

  // Activation code box on /membership: shows the teacher's membership status
  // and turns a code into membership days.
  var root = document.getElementById('activate');
  if (!root) return;
  var text = JSON.parse(root.dataset.text);
  var status = document.getElementById('activateStatus');
  var login = document.getElementById('activateLogin');
  var form = document.getElementById('activateForm');
  var input = document.getElementById('activationCode');
  var button = document.getElementById('activateButton');
  var result = document.getElementById('activateResult');
  var base = '/api/teacher-library';
  var busy = false;
  var epoch = 0;

  function day(value) {
    return new Date(value).toLocaleDateString(root.dataset.lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function describe(membership) {
    if (!membership || !membership.writeUntil) return text.activateNone;
    if (!membership.canWrite) return text.activateEndedBefore + day(membership.writeUntil) + text.activateEndedAfter;
    if (membership.trial) return text.activateTrialBefore + day(membership.writeUntil) + text.activateTrialAfter;
    return text.activateMember + day(membership.writeUntil) + text.activateStop;
  }

  async function refresh() {
    var selected = ++epoch;
    try {
      var response = await fetch(base + '/session', { credentials: 'same-origin', cache: 'no-store' });
      var session = await response.json();
      if (selected !== epoch) return;
      // Stays hidden until teacher accounts and memberships are open.
      root.hidden = !(response.ok && session.available && session.cloudAvailable);
      if (root.hidden) return;
      form.hidden = !session.signedIn;
      login.hidden = true;
      if (!session.signedIn) {
        status.textContent = text.activateSignedOut;
        status.classList.remove('is-member');
        var entry = session.login.length ? session.login[0].url : '';
        if (entry.indexOf('/.auth/login/') === 0) {
          var target = new URL(entry, location.origin);
          target.searchParams.set('post_login_redirect_uri', '/membership');
          login.href = target.pathname + target.search;
          login.hidden = false;
        }
        return;
      }
      var membership = session.membership;
      status.textContent = describe(membership);
      status.classList.toggle('is-member', Boolean(membership && membership.canWrite && !membership.trial));
    } catch (error) { if (selected === epoch) root.hidden = true; }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    button.disabled = true;
    result.textContent = '';
    try {
      var response = await fetch(base + '/redeem', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Library-Request': 'redeem' }, body: JSON.stringify({ code: input.value }) });
      if (!response.ok) { result.textContent = response.status === 400 ? text.activateInvalid : response.status === 429 ? text.activateTooMany : text.activateTryLater; return; }
      var added = await response.json();
      input.value = '';
      await refresh();
      result.textContent = text.activateDoneBefore + added.days + text.activateDoneMiddle + day(added.writeUntil) + text.activateStop;
    } catch (error) { result.textContent = text.activateTryLater; }
    finally { busy = false; button.disabled = false; }
  });
  window.addEventListener('focus', function () { if (!busy) refresh(); });
  refresh();
})();
