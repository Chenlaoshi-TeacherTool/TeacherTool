(() => {
  'use strict';

  const STORAGE_KEY = 'teacher-game-shares:v1';

  function normalizeStoredShare(item) {
    if (!item || !/^[0-9a-f-]{36}$/i.test(String(item.shareId || '')) || !item.deleteToken) return null;
    try {
      const url = new URL(item.url, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== '/play/' + item.shareId) return null;
      return {
        shareId: String(item.shareId),
        gameType: String(item.gameType || ''),
        version: Number(item.version || 1),
        title: String(item.title || 'Shared Classroom Game').slice(0, 120),
        url: url.href,
        deleteToken: String(item.deleteToken),
        createdAt: item.createdAt || null,
        expiresAt: item.expiresAt || null
      };
    } catch (_error) {
      return null;
    }
  }

  function listShares() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .map(normalizeStoredShare)
        .filter(Boolean)
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    } catch (_error) {
      return [];
    }
  }

  function saveShares(shares) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shares.slice(0, 100)));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function rememberShare(published, options) {
    const record = {
      shareId: published.shareId,
      gameType: options.gameType,
      version: options.version || 1,
      title: options.title || 'Shared Classroom Game',
      url: published.absoluteUrl,
      deleteToken: published.deleteToken,
      createdAt: new Date().toISOString(),
      expiresAt: published.expiresAt || null
    };
    const shares = listShares().filter((item) => item.shareId !== record.shareId);
    shares.unshift(record);
    saveShares(shares);
    return record;
  }

  function forgetShare(shareId) {
    saveShares(listShares().filter((item) => item.shareId !== shareId));
  }

  async function publish(options) {
    const response = await fetch('/api/game-shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: options.gameType,
        version: options.version || 1,
        title: options.title,
        password: options.password,
        data: options.data
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not create the game link.');
    result.absoluteUrl = new URL(result.url, window.location.origin).href;
    rememberShare(result, options);
    return result;
  }

  async function deleteShare(record) {
    const response = await fetch('/api/game-shares/' + encodeURIComponent(record.shareId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteToken: record.deleteToken })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) {
      throw new Error(result.error || 'Could not delete this game link.');
    }
    forgetShare(record.shareId);
    return { ok: true, alreadyGone: response.status === 404 };
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  function createDialog() {
    let dialog = document.getElementById('gameShareDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'gameShareDialog';
    dialog.className = 'game-share-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="game-share-dialog-card">
        <button class="game-share-dialog-close" value="cancel" aria-label="Close share dialog">×</button>
        <div class="game-share-dialog-heading">
          <span aria-hidden="true">🔗</span>
          <div><p>Online student game</p><h2>Create a share link</h2></div>
        </div>
        <div class="game-share-dialog-form" data-share-form>
          <label>Game title<input name="shareTitle" maxlength="120" required></label>
          <label>Password<input name="sharePassword" type="password" minlength="4" maxlength="64" autocomplete="new-password" required></label>
          <p class="game-share-dialog-note">Students open the link and enter this password. The link expires after 90 days.</p>
          <p class="game-share-dialog-error" data-share-error role="alert" hidden></p>
          <button class="game-share-dialog-submit" type="button" data-share-submit>Create link</button>
        </div>
        <div class="game-share-dialog-result" data-share-result hidden>
          <p class="game-share-dialog-success">✓ Student link created</p>
          <label>Share link<input name="shareUrl" readonly></label>
          <label>Student password<input name="sharePasswordResult" readonly></label>
          <div class="game-share-dialog-result-actions">
            <button type="button" data-copy-link>Copy link + password</button>
            <a data-open-link target="_blank" rel="noopener">Open student view</a>
          </div>
          <p>Send students both the link and the password you chose.</p>
        </div>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  function createManagerDialog() {
    let dialog = document.getElementById('gameShareManagerDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'gameShareManagerDialog';
    dialog.className = 'game-share-dialog game-share-manager-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="game-share-dialog-card">
        <button class="game-share-dialog-close" value="cancel" aria-label="Close link manager">×</button>
        <div class="game-share-dialog-heading">
          <span aria-hidden="true">🗂️</span>
          <div><p>Saved in this browser</p><h2>My student links</h2></div>
        </div>
        <p class="game-share-manager-note">Only links created in this browser after this feature was added appear here. Passwords are not saved.</p>
        <p class="game-share-dialog-error" data-manager-error role="alert" hidden></p>
        <div class="game-share-manager-list" data-manager-list></div>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function makeManagerItem(record, render, options, errorElement) {
    const article = document.createElement('article');
    article.className = 'game-share-manager-item';

    const heading = document.createElement('div');
    heading.className = 'game-share-manager-item-heading';
    const title = document.createElement('h3');
    title.textContent = record.title || 'Shared Classroom Game';
    const status = document.createElement('span');
    const expired = record.expiresAt && new Date(record.expiresAt).getTime() < Date.now();
    status.className = expired ? 'is-expired' : '';
    status.textContent = expired ? 'Expired' : 'Active';
    heading.append(title, status);

    const url = document.createElement('p');
    url.className = 'game-share-manager-url';
    url.textContent = record.url;

    const meta = document.createElement('p');
    meta.className = 'game-share-manager-meta';
    meta.textContent = `Created ${formatDate(record.createdAt)} · Expires ${formatDate(record.expiresAt)}`;

    const actions = document.createElement('div');
    actions.className = 'game-share-manager-actions';
    const openLink = document.createElement('a');
    openLink.href = record.url;
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    openLink.textContent = 'Open';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = 'Copy link';
    copyButton.addEventListener('click', async () => {
      await copyText(record.url);
      copyButton.textContent = 'Copied!';
    });
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'is-delete';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Delete “${record.title || 'this game'}”? Students will no longer be able to use its link.`)) return;
      deleteButton.disabled = true;
      deleteButton.textContent = 'Deleting…';
      errorElement.hidden = true;
      try {
        await deleteShare(record);
        render();
        if (typeof options.onChanged === 'function') options.onChanged(listShares());
      } catch (deleteError) {
        errorElement.textContent = deleteError.message;
        errorElement.hidden = false;
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete';
      }
    });
    actions.append(openLink, copyButton, deleteButton);
    article.append(heading, url, meta, actions);
    return article;
  }

  function openManager(options = {}) {
    const dialog = createManagerDialog();
    const list = dialog.querySelector('[data-manager-list]');
    const error = dialog.querySelector('[data-manager-error]');
    error.hidden = true;

    function render() {
      const shares = listShares();
      list.replaceChildren();
      if (!shares.length) {
        const empty = document.createElement('div');
        empty.className = 'game-share-manager-empty';
        empty.innerHTML = '<span aria-hidden="true">🔗</span><h3>No saved links yet</h3><p>Create a student link and it will appear here.</p>';
        list.append(empty);
        return;
      }
      shares.forEach((record) => list.append(makeManagerItem(record, render, options, error)));
    }

    render();
    dialog.showModal();
  }

  function openPublisher(options) {
    const dialog = createDialog();
    const form = dialog.querySelector('[data-share-form]');
    const resultPanel = dialog.querySelector('[data-share-result]');
    const error = dialog.querySelector('[data-share-error]');
    const submit = dialog.querySelector('[data-share-submit]');
    const titleInput = dialog.querySelector('[name="shareTitle"]');
    const passwordInput = dialog.querySelector('[name="sharePassword"]');
    const urlInput = dialog.querySelector('[name="shareUrl"]');
    const passwordResultInput = dialog.querySelector('[name="sharePasswordResult"]');

    form.hidden = false;
    resultPanel.hidden = true;
    error.hidden = true;
    error.textContent = '';
    submit.disabled = false;
    submit.textContent = 'Create link';
    titleInput.value = typeof options.title === 'function' ? options.title() : (options.title || 'Shared Classroom Game');
    passwordInput.value = '';

    submit.onclick = async () => {
      if (!titleInput.reportValidity() || !passwordInput.reportValidity()) return;
      submit.disabled = true;
      submit.textContent = 'Creating…';
      error.hidden = true;
      try {
        const published = await publish({
          gameType: options.gameType,
          version: options.version || 1,
          title: titleInput.value,
          password: passwordInput.value,
          data: options.getData()
        });
        urlInput.value = published.absoluteUrl;
        passwordResultInput.value = passwordInput.value;
        dialog.querySelector('[data-open-link]').href = published.absoluteUrl;
        dialog.querySelector('[data-copy-link]').onclick = async (event) => {
          await copyText(`Game link: ${published.absoluteUrl}\nPassword: ${passwordInput.value}`);
          event.currentTarget.textContent = 'Copied!';
        };
        form.hidden = true;
        resultPanel.hidden = false;
        if (typeof options.onPublished === 'function') options.onPublished(published);
      } catch (publishError) {
        error.textContent = publishError.message;
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Create link';
      }
    };

    dialog.showModal();
    titleInput.focus();
    titleInput.select();
  }

  window.TeacherGameShare = { publish, deleteShare, listShares, openPublisher, openManager, copyText };
})();
