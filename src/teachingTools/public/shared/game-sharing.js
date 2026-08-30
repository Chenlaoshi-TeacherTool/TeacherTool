(() => {
  'use strict';

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
    return result;
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

  window.TeacherGameShare = { publish, openPublisher, copyText };
})();
