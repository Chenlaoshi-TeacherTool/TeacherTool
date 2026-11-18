(() => {
  'use strict';

  // Tool integration: load this script and game-sharing.css, then bind a button
  // with a versioned getData()/restore(data) pair. Register the matching server
  // sanitizer in gameShareRegistry and the editor URL in community.GAME_TYPES.
  const api = '/api/community';
  const creations = '/teaching-tools/teacher-library/teacher-library.html#works';
  const localPrefix = 'teacher-game-template:v1:';
  const zh = document.documentElement.lang.startsWith('zh');
  const tr = (chinese, english) => zh ? chinese : english;

  function getLocal(id) {
    try {
      const item = JSON.parse(localStorage.getItem(localPrefix + id));
      if (item?.id !== id || !item.payload || typeof item.editor !== 'string') return null;
      const url = new URL(item.editor, location.origin);
      return url.origin === location.origin ? item : null;
    } catch {
      return null;
    }
  }

  function listLocal() {
    try {
      return Object.keys(localStorage).filter((key) => key.startsWith(localPrefix))
        .map((key) => getLocal(key.slice(localPrefix.length))).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function request(path, method = 'GET', data) {
    const response = await fetch(api + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Community-Request': 'yes' },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || tr('操作失败，请重试。', 'Something went wrong. Please try again.'));
    return result;
  }

  function addOptions(select, options) {
    options.forEach((item) => select.add(new Option(zh ? item.zh : item.en, item.key)));
  }

  function bind({ button, gameType, version = 1, getData, restore }) {
    const draftKey = 'teacher-template-login:' + gameType + ':' + version;
    const dialog = document.createElement('dialog');
    dialog.className = 'game-share-dialog game-template-dialog';
    dialog.setAttribute('aria-labelledby', 'game-template-title');
    dialog.innerHTML = `
      <form class="game-share-dialog-card">
        <button class="game-share-dialog-close" type="button" aria-label="${tr('关闭', 'Close')}">×</button>
        <div class="game-share-dialog-heading"><h2 id="game-template-title">${tr('保存与分享模板', 'Save & share template')}</h2></div>
        <div class="game-share-dialog-form" data-editor>
          <label>${tr('标题', 'Title')}<input name="title" maxlength="120" required></label>
          <p class="game-share-dialog-note" data-storage></p>
          <label class="game-template-choice"><input name="publish" type="checkbox">${tr('分享到教师社区', 'Share with the teacher community')}</label>
          <p class="game-share-dialog-note">${tr('勾选后，其他老师可以打开并使用这份模板。', 'Sharing lets other teachers open and reuse this template.')}</p>
          <fieldset hidden>
            <label>${tr('简介', 'Description')}<textarea name="description" maxlength="500" rows="3"></textarea></label>
            <label>${tr('学习者类型', 'Learner type')}<select name="learner"><option value="">${tr('请选择', 'Choose a learner type')}</option></select></label>
            <label>${tr('年级', 'Grade level')}<select name="grade"><option value="">${tr('请选择', 'Choose a grade level')}</option></select></label>
            <label>${tr('教材（选填）', 'Textbook (optional)')}<select name="textbook"><option value="">${tr('请选择', 'Choose a textbook')}</option></select></label>
            <label data-custom-textbook hidden>${tr('自定义教材名称', 'Custom textbook name')}<input name="customTextbook" maxlength="80"></label>
            <label>${tr('公开署名', 'Public display name')}<input name="authorName" maxlength="40"></label>
          </fieldset>
          <button class="game-share-dialog-submit" type="submit"></button>
          <a class="game-template-login" hidden>${tr('登录后继续', 'Sign in to continue')}</a>
        </div>
        <p class="game-share-dialog-error" role="alert" hidden></p>
        <div class="game-share-dialog-result" hidden>
          <p class="game-share-dialog-success" role="status"></p>
          <div class="game-share-dialog-result-actions">
            <a href="${creations}">${tr('我的作品', 'My creations')}</a>
            <a data-post>${tr('查看社区帖子', 'View community post')}</a>
            <a href="/community?mine=1" data-mine>${tr('我的分享', 'My shares')}</a>
          </div>
        </div>
      </form>`;
    document.body.append(dialog);

    const form = dialog.querySelector('form');
    const fields = form.elements;
    const close = form.querySelector('.game-share-dialog-close');
    const submit = form.querySelector('button[type="submit"]');
    const editor = form.querySelector('[data-editor]');
    const details = form.querySelector('fieldset');
    const error = form.querySelector('[role="alert"]');
    const result = form.querySelector('.game-share-dialog-result');
    const signIn = form.querySelector('.game-template-login');
    let data, saved, attemptId, attemptedTitle, ready, busy, opening, session;

    function showError(message) {
      error.textContent = message;
      error.hidden = !message;
    }

    function update() {
      const sharing = fields.publish.checked;
      details.hidden = !sharing;
      details.disabled = !sharing || busy;
      fields.publish.disabled = busy;
      fields.title.readOnly = busy || Boolean(saved);
      for (const name of ['authorName', 'description', 'learner', 'grade']) fields[name].required = sharing;
      const customBook = sharing && fields.textbook.value === 'other';
      form.querySelector('[data-custom-textbook]').hidden = !customBook;
      fields.customTextbook.disabled = !customBook;
      const needsLogin = sharing && !session?.signedIn;
      const loginUrl = session?.template?.loginUrl;
      signIn.hidden = !needsLogin || !loginUrl || !ready;
      if (loginUrl) signIn.href = loginUrl;
      submit.disabled = !ready || busy || needsLogin;
      const cloud = saved ? saved.cloud : session?.template?.canSave;
      form.querySelector('[data-storage]').textContent = cloud
        ? tr('保存到你的账号，可在其他设备打开。', 'Saved to your account and available on other devices.')
        : tr('保存在此浏览器。清除网站数据会删除本机模板。', 'Saved in this browser. Clearing site data removes local templates.');
      submit.textContent = busy ? tr('正在处理…', 'Working…') : sharing ? tr('保存并发布', 'Save & publish') : tr('保存模板', 'Save template');
      close.disabled = busy;
    }

    async function open(draft) {
      if (dialog.open) return;
      form.reset();
      fields.learner.options.length = fields.grade.options.length = fields.textbook.options.length = 1;
      editor.hidden = false;
      result.hidden = true;
      signIn.hidden = true;
      ready = false;
      busy = false;
      saved = draft?.localId ? getLocal(draft.localId) : null;
      attemptId = attemptedTitle = session = null;
      const current = opening = {};
      data = null;
      showError('');
      try {
        data = getData();
        fields.title.value = (draft?.title || data.title || '').slice(0, 120);
      } catch (failure) {
        showError(failure.message);
      }
      update();
      dialog.showModal();
      fields.title.focus();
      try {
        const account = await request('/me?tool=' + encodeURIComponent(gameType));
        if (!dialog.open || opening !== current) return;
        session = account;
        if (!session.template) throw new Error(tr('此工具尚未启用模板保存。', 'Template saving is unavailable for this tool.'));
        for (const group of ['learner', 'grade']) {
          addOptions(fields[group], session.template.stages.filter((stage) => stage.group === group));
        }
        addOptions(fields.textbook, session.template.textbooks);
        fields.authorName.value = draft?.authorName || session.displayName || '';
        if (draft) {
          fields.publish.checked = draft.publish;
          fields.description.value = draft.description || '';
          const stages = draft.stages || [draft.stage];
          for (const group of ['learner', 'grade']) {
            fields[group].value = [...fields[group].options].find((option) => stages.includes(option.value))?.value || '';
          }
          fields.customTextbook.value = draft.customTextbook || '';
          fields.textbook.value = draft.textbook || '';
        }
      } catch (failure) {
        if (dialog.open && opening === current) showError(failure.message);
      } finally {
        if (dialog.open && opening === current) {
          ready = Boolean(data);
          update();
        }
      }
    }

    function metadata() {
      return {
        title: fields.title.value.trim(),
        description: fields.description.value.trim(),
        authorName: fields.authorName.value.trim(),
        textbook: fields.textbook.value,
        customTextbook: fields.textbook.value === 'other' ? fields.customTextbook.value.trim() : '',
        stages: [fields.learner.value, fields.grade.value].filter(Boolean)
      };
    }

    signIn.addEventListener('click', (event) => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ data, ...metadata(), localId: saved?.id, publish: fields.publish.checked }));
      } catch {
        event.preventDefault();
        showError(tr('浏览器无法暂存模板，请先另开页面登录。', 'Your browser cannot keep this draft. Sign in in another tab first.'));
      }
    });
    fields.textbook.addEventListener('change', update);
    fields.publish.addEventListener('change', () => {
      showError(fields.publish.checked && !session?.signedIn && !session?.template?.loginUrl
        ? tr('当前无法登录发布。取消勾选后仍可保存到本机。', 'Sign-in is unavailable. Uncheck sharing to save in this browser.')
        : '');
      update();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!ready || busy || (fields.publish.checked && !session?.signedIn)) return;
      const post = metadata();
      const publish = fields.publish.checked;
      if (!post.title || (publish && (!post.description || !post.authorName))) {
        showError(tr('请填写所有必填项。', 'Complete all required fields.'));
        return;
      }
      busy = true;
      showError('');
      update();
      try {
        if (!saved) {
          if (attemptedTitle !== post.title) {
            attemptId = 'template-' + crypto.randomUUID();
            attemptedTitle = post.title;
          }
          if (session?.template?.canSave) {
            const cloudCopy = await request('/templates/' + attemptId, 'PUT', { gameType, version, title: post.title, data });
            saved = { id: cloudCopy.id, cloud: true };
          } else {
            const localCopy = {
              id: attemptId, gameType, version, title: post.title, payload: { ...data, title: post.title },
              editor: location.pathname, createdAt: new Date().toISOString()
            };
            try {
              localStorage.setItem(localPrefix + localCopy.id, JSON.stringify(localCopy));
            } catch {
              throw new Error(tr('无法保存到本机。请检查浏览器的存储设置或可用空间。', 'Could not save in this browser. Check its storage settings or available space.'));
            }
            saved = localCopy;
          }
        }
        const source = saved.cloud ? { activityId: saved.id } : {
          template: { id: saved.id, gameType: saved.gameType, version: saved.version, payload: saved.payload }
        };
        const published = publish ? await request('/posts', 'POST', { ...post, kind: 'game', ...source }) : null;
        const postLink = result.querySelector('[data-post]');
        postLink.hidden = !published;
        if (published) postLink.href = published.url;
        result.querySelector('[data-mine]').hidden = !published;
        result.querySelector('[role="status"]').textContent = published
          ? tr('模板已保存并发布。', 'Template saved and published.')
          : saved.cloud
            ? tr('云端模板已保存到「我的作品」。', 'Cloud template saved to My creations.')
            : tr('本机模板已保存到「我的作品」。', 'Local template saved to My creations.');
        editor.hidden = true;
        result.hidden = false;
        result.querySelector('a').focus();
      } catch (failure) {
        showError((saved ? tr('模板已保存。社区发布失败，可重试。 ', 'Template saved. Publishing failed. You can retry. ') : '') + failure.message);
      } finally {
        busy = false;
        update();
      }
    });

    button.addEventListener('click', () => open());
    let draft;
    try {
      draft = JSON.parse(sessionStorage.getItem(draftKey));
      if (draft) sessionStorage.removeItem(draftKey);
    } catch { /* Browser storage is optional until login. */ }
    const params = new URLSearchParams(location.search);
    const template = params.get('template');
    const localId = params.get('localTemplate');
    function showRestoreError(messageText) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = messageText;
      button.after(message);
    }
    if (draft?.data) {
      restore(draft.data);
      open(draft);
    } else if (localId) {
      const local = getLocal(localId);
      if (!local || local.gameType !== gameType || local.version !== version) {
        showRestoreError(tr('在此浏览器中找不到兼容的模板。', 'No compatible template was found in this browser.'));
      } else {
        restore(local.payload);
        if (params.get('share') === '1') open({ title: local.title, localId, publish: true });
      }
    } else if (template) {
      request('/templates/' + encodeURIComponent(template)).then((saved) => {
        if (saved.gameType !== gameType || saved.version !== version) throw new Error(tr('这个模板与当前工具版本不匹配。', 'This template requires a different tool version.'));
        restore({ ...saved.payload, title: saved.title || saved.payload.title });
      }).catch((failure) => showRestoreError(failure.message));
    }
  }

  window.TeacherGameTemplate = {
    bind, listLocal,
    removeLocal(id) { localStorage.removeItem(localPrefix + id); }
  };
})();
