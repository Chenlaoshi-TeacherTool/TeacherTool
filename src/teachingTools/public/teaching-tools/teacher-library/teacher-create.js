(function () {
  'use strict';
  var form = document.getElementById('materialCreateForm');
  if (!form) return;
  var find = function (id) { return document.getElementById(id); };
  var state = null;
  var plan = null;
  var busy = false;
  var sequence = 0;
  function reset() { sequence += 1; plan = null; find('createConfirmLabel').hidden = true; find('createConfirm').checked = false; find('createSave').disabled = true; }
  function fingerprint() { return JSON.stringify([find('materialName').value, find('materialKind').value, find('materialText').value]); }
  async function request(url, options) {
    var response = await fetch('/api/teacher-library' + url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options));
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || '保存未完成。');
    return result;
  }
  window.addEventListener('teacher-session', function (event) {
    reset();
    state = event.detail;
    find('createWorkspace').hidden = !state.session.signedIn;
    if (state.session.signedIn) find('createMode').textContent = state.cloud && state.cloud.canWrite ? '当前账号已开通云端保存，新资料将保存到你的账号。' : '可以先创建本地草稿。云端保存需开通权限，本地草稿不会自动上传。';
  });
  form.addEventListener('input', function () { if (plan) { reset(); find('createStatus').textContent = '内容已变化，请重新预览。'; } });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy) return;
    reset();
    var selected = sequence;
    try {
      if (!state || !state.session.signedIn) throw new Error('请先登录老师账号。');
      var name = find('materialName').value.trim();
      if (!name) throw new Error('请填写资料名称。');
      var lines = find('materialText').value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
      if (!lines.length) throw new Error('请填写至少一条材料。');
      var questions = find('materialKind').value === 'question-bank';
      var items = lines.map(function (line, index) {
        var pieces = line.split('|').map(function (piece) { return piece.trim(); });
        if (pieces.length < 2 || pieces.length > (questions ? 2 : 3) || !pieces[0] || !pieces[pieces.length - 1]) throw new Error('第 ' + (index + 1) + ' 行格式不完整，请使用竖线分隔内容。');
        return questions ? { id: 'question-' + index, prompt: pieces[0], answer: pieces[1] } : { zh: pieces[0], py: pieces.length === 3 ? pieces[1] : '', en: pieces[pieces.length - 1] };
      });
      var source = { id: 'created_' + crypto.randomUUID(), name: name };
      source[questions ? 'questions' : 'items'] = items;
      var converted = await window.ChenLibraryV2.preview(JSON.stringify(source));
      if (selected !== sequence) return;
      var inCloud = Boolean(state.cloud && state.cloud.canWrite);
      var storage = inCloud ? { getItem: function () { return state.cloud.library ? JSON.stringify(state.cloud.library) : null; } } : localStorage;
      var store = window.ChenLibraryStore.create(storage, navigator.locks);
      var prepared = await store.prepare(converted.data);
      if (selected !== sequence) return;
      plan = { store: store, prepared: prepared, cloud: inCloud, accountId: state.session.accountId, revision: state.cloud ? state.cloud.revision : 0, input: fingerprint() };
      find('createStatus').textContent = name + '：' + items.length + ' 条。' + (inCloud ? '准备保存到当前账号。' : '准备保存为本地草稿。') + (prepared.entries.some(function (entry) { return entry.status === 'conflict'; }) ? '发现同名或编号冲突，保存时保留双方。' : '');
      find('createConfirmText').textContent = inCloud ? '确认将新资料加入当前账号，保留云端已有资料。' : '确认保存为此浏览器的本地草稿，不作为云端保存。';
      find('createConfirmLabel').hidden = false;
    } catch (error) { find('createStatus').textContent = error.message; }
  });
  find('createConfirm').addEventListener('change', function () { find('createSave').disabled = busy || !plan || !find('createConfirm').checked; });
  find('createSave').addEventListener('click', async function () {
    if (!plan || busy || !find('createConfirm').checked) return;
    var pending = plan;
    busy = true;
    find('createSave').disabled = true;
    try {
      var session = await request('/session');
      if (!session.signedIn || session.accountId !== pending.accountId || plan !== pending || fingerprint() !== pending.input) throw new Error('账号或内容已变化，请重新预览。');
      if (pending.cloud) {
        await request('/mine', { method: 'PUT', headers: { 'Content-Type': 'application/vnd.cls-library+json', 'X-Library-Request': 'save', 'X-Library-Account': pending.accountId, 'If-Match': '"' + pending.revision + '"' }, body: JSON.stringify(pending.prepared.data) });
        find('createStatus').textContent = '已保存到我的资料（云端）。';
        find('reloadCloud').click();
      } else {
        await pending.store.save(pending.prepared, true);
        find('createStatus').textContent = '已保存本地草稿，可到浏览器材料库继续使用。';
      }
      reset();
    } catch (error) { reset(); find('createStatus').textContent = error.message; }
    finally { busy = false; }
  });
})();
