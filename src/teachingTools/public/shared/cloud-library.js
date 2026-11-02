(function () {
  'use strict';

  // Account cloud section for My materials. Renders into <section id="cloudLibrary">
  // on both library tabs; browser saving keeps working when signed out.
  var root = document.getElementById('cloudLibrary');
  if (!root) return;
  var t = function (value) { return window.LibraryI18n ? window.LibraryI18n.t(value) : value; };
  var base = '/api/teacher-library';
  var cloud = null;
  var plan = null;
  var local;
  var busy = false;
  var epoch = 0;
  var accountId = null;
  try { local = window.ChenLibraryStore.create(localStorage, navigator.locks); } catch (error) {}

  function element(tag, value, className) { var node = document.createElement(tag); if (value) node.textContent = value; if (className) node.className = className; return node; }
  function button(label, id, primary) { var node = element('button', t(label), 'btn ' + (primary ? 'btn-primary' : 'btn-secondary')); node.type = 'button'; node.id = id; node.disabled = true; return node; }

  var title = element('h2', t('Your teacher account'));
  title.id = 'cloudLibraryTitle';
  var status = element('p', t('Checking sign-in status…'), 'cloud-library-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  var actions = element('div', '', 'cloud-library-actions');
  var workspace = element('div', '', 'cloud-library-workspace'); workspace.hidden = true;
  var reload = button('Reload cloud library', 'cloudReload'); reload.disabled = false;
  var download = button('Download cloud backup', 'cloudDownload');
  var collections = element('div', '', 'cloud-library-collections');
  var upload = button('Preview browser materials to save to the cloud', 'cloudPreviewUpload');
  var restore = button('Preview cloud materials to add to this browser', 'cloudPreviewRestore');
  var exchange = element('p', '', 'cloud-library-exchange'); exchange.setAttribute('role', 'status'); exchange.setAttribute('aria-live', 'polite');
  var confirmLabel = element('label', '', 'cloud-library-confirm'); confirmLabel.hidden = true;
  var confirmBox = document.createElement('input'); confirmBox.type = 'checkbox';
  var confirmText = element('span');
  confirmLabel.append(confirmBox, ' ', confirmText);
  var apply = button('Confirm', 'cloudApply', true);
  var planLine = element('p', '', 'cloud-library-plan');
  var redeemForm = element('form', '', 'cloud-library-redeem');
  var codeInput = document.createElement('input'); codeInput.id = 'cloudActivationCode'; codeInput.autocomplete = 'off'; codeInput.maxLength = 30; codeInput.placeholder = 'CLS-XXXX-XXXX-XXXX'; codeInput.required = true;
  var codeLabel = element('label', t('Have an activation code?')); codeLabel.htmlFor = codeInput.id;
  var redeemButton = button('Activate', 'cloudRedeem', true); redeemButton.type = 'submit'; redeemButton.disabled = false;
  var redeemStatus = element('p', '', 'cloud-library-exchange'); redeemStatus.setAttribute('role', 'status'); redeemStatus.setAttribute('aria-live', 'polite');
  var redeemRow = element('div', '', 'cloud-library-actions'); redeemRow.append(codeInput, redeemButton);
  redeemForm.append(codeLabel, redeemRow, redeemStatus);
  var tools = element('div', '', 'cloud-library-actions'); tools.append(reload, download);
  var swap = element('div', '', 'cloud-library-actions'); swap.append(upload, restore);
  workspace.append(planLine, redeemForm, tools, collections, element('p', t('Nothing uploads or replaces your materials automatically. Preview first, then confirm. On a shared computer, browser materials may not belong to this account.'), 'cloud-library-note'), swap, exchange, confirmLabel, apply);
  var heading = element('div'); heading.append(element('p', t('Cloud sync'), 'eyebrow'), title, status);
  root.replaceChildren(heading, actions, workspace);
  // Stays hidden until the server confirms teacher accounts are open.
  root.hidden = true;

  function here(url, param) {
    var target = new URL(url, location.origin);
    target.searchParams.set(param, location.pathname + location.search);
    return target.pathname + target.search;
  }
  function reset() { plan = null; confirmBox.checked = false; confirmLabel.hidden = true; apply.hidden = true; apply.disabled = true; }
  async function request(url, options) {
    var response = await fetch(base + url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options));
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request did not finish. Reload the cloud library.');
    return data;
  }
  var stop = window.LibraryI18n && window.LibraryI18n.chinese ? '。' : '.';
  function day(value) { return new Date(value).toLocaleDateString(window.LibraryI18n && window.LibraryI18n.chinese ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function describePlan(membership) {
    if (!membership || !membership.writeUntil) return t('Cloud saving is not active on this account. Enter an activation code to turn it on.');
    if (!membership.canWrite) return t('Cloud saving ended on ') + day(membership.writeUntil) + t('. Your materials can still be viewed and exported. Enter an activation code to continue saving.');
    return (membership.trial ? t('Free trial: cloud saving until ') : t('Member: cloud saving until ')) + day(membership.writeUntil) + stop;
  }
  function count(data) { return data.collections.reduce(function (total, collection) { return total + collection.items.length; }, 0); }
  function summary(data) { return data.collections.length + t(' collections, ') + count(data) + t(' items'); }

  async function refresh() {
    var selected = ++epoch;
    reset();
    cloud = null;
    accountId = null;
    workspace.hidden = true;
    collections.replaceChildren();
    actions.replaceChildren();
    [upload, restore, download].forEach(function (node) { node.disabled = true; });
    try {
      var session = await request('/session');
      if (selected !== epoch) return;
      root.hidden = !session.available;
      if (!session.available) return;
      if (!session.signedIn) {
        status.textContent = t('Sign in to keep your materials in the cloud and use them on any device. Without signing in, materials stay in this browser.');
        if (session.login.length && session.login[0].url.indexOf('/.auth/login/') === 0) {
          var login = element('a', t('Log in / Sign up'), 'btn btn-primary');
          login.href = here(session.login[0].url, 'post_login_redirect_uri');
          actions.appendChild(login);
        }
        return;
      }
      accountId = session.accountId;
      status.textContent = t('Signed in as ') + session.user.name + stop;
      if (session.cloudAvailable === false) { status.textContent += ' ' + t('Cloud saving is not open yet; materials stay in this browser.'); return; }
      var loaded = await request('/mine');
      if (selected !== epoch) return;
      if (loaded.accountId !== accountId) throw new Error(t('The signed-in account changed. Reload the cloud library.'));
      cloud = loaded;
      workspace.hidden = false;
      status.textContent += ' ' + (cloud.library ? t('Cloud library: ') + summary(cloud.library) + stop : t('Your cloud library is empty.'));
      planLine.textContent = describePlan(cloud.membership);
      planLine.classList.toggle('is-expired', !cloud.canWrite);
      if (cloud.library) cloud.library.collections.forEach(function (collection) {
        var details = document.createElement('details');
        details.appendChild(element('summary', collection.name + ' · ' + collection.items.length));
        var list = document.createElement('ul');
        collection.items.forEach(function (item) { list.appendChild(element('li', item.kind === 'question' ? item.prompt + ' — ' + item.answer : item.term + ' — ' + item.definition)); });
        details.appendChild(list);
        collections.appendChild(details);
      });
      upload.disabled = !cloud.canWrite || !local;
      restore.disabled = !cloud.library || !local;
      download.disabled = !cloud.library;
    } catch (error) { if (selected === epoch) status.textContent = t(error.message); }
  }

  async function prepare(direction) {
    reset();
    var selected = ++epoch;
    try {
      if (!cloud || !local) return;
      if (direction === 'upload') {
        var loaded = await local.load();
        if (selected !== epoch) return;
        if (!loaded.data.collections.length) throw new Error(t('This browser has no saved materials yet. Save a vocabulary list or question bank first.'));
        plan = { direction: direction, data: loaded.data, raw: loaded.raw, revision: cloud.revision, accountId: accountId };
        exchange.textContent = t('To upload: ') + summary(loaded.data) + t('. Current cloud library: ') + (cloud.library ? summary(cloud.library) : t('empty')) + stop;
        confirmText.textContent = t('Replace this account’s cloud copy with these browser materials. Download a cloud backup first if it already has materials.');
      } else {
        var prepared = await local.prepare(cloud.library);
        if (selected !== epoch) return;
        var outcomes = { new: t('new'), duplicate: t('duplicate, skipped'), conflict: t('conflict, both kept') };
        plan = { direction: direction, localPlan: prepared, accountId: accountId };
        exchange.textContent = prepared.entries.map(function (entry) { return entry.name + ': ' + outcomes[entry.status]; }).join('; ');
        confirmText.textContent = t('Add the cloud materials to this browser. Duplicates are skipped and conflicts keep both; nothing in this browser is replaced.');
      }
      confirmLabel.hidden = false;
      apply.hidden = false;
    } catch (error) { exchange.textContent = t(error.message); }
  }

  redeemForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !accountId) return;
    busy = true;
    redeemButton.disabled = true;
    redeemStatus.textContent = '';
    try {
      var result = await request('/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Library-Request': 'redeem' }, body: JSON.stringify({ code: codeInput.value }) });
      codeInput.value = '';
      busy = false;
      await refresh();
      redeemStatus.textContent = t('Activated: ') + result.days + t(' days added. Cloud saving until ') + day(result.writeUntil) + stop;
    } catch (error) { redeemStatus.textContent = t(error.message); }
    finally { busy = false; redeemButton.disabled = false; }
  });
  upload.addEventListener('click', function () { prepare('upload'); });
  restore.addEventListener('click', function () { prepare('restore'); });
  confirmBox.addEventListener('change', function () { apply.disabled = !plan || !confirmBox.checked || busy; });
  reload.addEventListener('click', refresh);
  download.addEventListener('click', function () {
    if (!cloud || !cloud.library) return;
    var url = URL.createObjectURL(new Blob([JSON.stringify(cloud.library, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = 'my-materials-cloud-backup.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  });
  apply.addEventListener('click', async function () {
    if (!plan || busy || !confirmBox.checked) return;
    var pending = plan;
    busy = true;
    apply.disabled = true;
    try {
      var session = await request('/session');
      if (!session.signedIn || session.accountId !== pending.accountId || plan !== pending) throw new Error(t('The signed-in account or preview changed. Reload the cloud library.'));
      if (pending.direction === 'upload') {
        if ((await local.load()).raw !== pending.raw) throw new Error(t('Browser materials changed. Preview again before saving.'));
        if (plan !== pending) throw new Error(t('The signed-in account or preview changed. Reload the cloud library.'));
        await request('/mine', { method: 'PUT', headers: { 'Content-Type': 'application/vnd.cls-library+json', 'X-Library-Request': 'save', 'X-Library-Account': pending.accountId, 'If-Match': '"' + pending.revision + '"' }, body: JSON.stringify(pending.data) });
        exchange.textContent = t('Saved to the cloud.');
      } else {
        await local.save(pending.localPlan, true);
        exchange.textContent = t('Cloud materials were added to this browser. Reload the page to see them in your library.');
      }
      var done = exchange.textContent;
      await refresh();
      exchange.textContent = done;
    } catch (error) { reset(); exchange.textContent = t(error.message); }
    finally { busy = false; }
  });
  window.addEventListener('focus', function () { if (!busy && !plan) refresh(); });
  refresh();
})();
