(function () {
  'use strict';
  var zh = window.LibraryI18n.chinese;
  function text(en, cn) { return zh ? cn : en; }
  document.querySelectorAll('[data-en]').forEach(function (node) { node.textContent = node.getAttribute(zh ? 'data-zh' : 'data-en'); });
  document.title = text('My Space', '我的空间') + ' · Chen Laoshi';
  function navigate() {
    var section = location.hash.slice(1) || 'overview';
    if (!document.querySelector('[data-panel="' + CSS.escape(section) + '"]')) section = 'overview';
    document.querySelectorAll('[data-panel]').forEach(function (panel) { panel.hidden = panel.dataset.panel !== section; });
    document.querySelectorAll('[data-section]').forEach(function (link) {
      if (link.dataset.section === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', navigate);
  navigate();
  function renderMaterials() {
    var root = document.getElementById('legacyMaterials');
    root.replaceChildren();
    try {
      var entries = window.ChenWordlist.listAll().map(function (item) { return { name: item.name, count: item.count, vocabulary: true }; })
        .concat(window.ChenQuestionBank.listAll().map(function (item) { return { name: item.name, count: item.questionCount, vocabulary: false }; }));
      if (!entries.length) { root.textContent = text('No vocabulary lists or question banks on this device yet. Create one to get started.', '此设备还没有词汇表或题库。新建一份，开始准备课堂吧。'); return; }
      entries.forEach(function (entry) {
        var row = document.createElement('div'); row.className = 'material-row';
        var info = document.createElement('div');
        var name = document.createElement('strong'); name.textContent = entry.name;
        var meta = document.createElement('small'); meta.textContent = (entry.vocabulary ? text('Vocabulary list', '词汇表') : text('Question bank', '题库')) + ' · ' + entry.count + text(' items · This device', ' 项 · 此设备');
        info.append(name, meta);
        var open = document.createElement('a'); open.textContent = text('Manage lists →', '管理列表 →');
        open.href = entry.vocabulary ? '/teaching-tools/word-list-library/word-list-library.html' : '/teaching-tools/question-bank-library/question-bank-library.html';
        row.append(info, open); root.append(row);
      });
    } catch (error) { root.textContent = text('Materials could not be read. Your existing data has been kept.', '无法读取材料，原有数据已保留。'); }
  }
  renderMaterials();
  window.addEventListener('focus', renderMaterials);
  window.addEventListener('storage', renderMaterials);
  var account = document.getElementById('spaceAccount');
  account.textContent = text('Checking sign-in status…', '正在检查登录状态……');
  fetch('/api/teacher-library/session', { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error();
    return response.json();
  }).then(function (session) {
    account.textContent = session.signedIn ? text('Signed in as ', '当前账号：') + session.user.name : text('Sign in using the account button above to access your account. Materials saved on this device are still available.', '请通过顶部账号按钮登录。此设备保存的材料仍然可以使用。');
  }).catch(function () { account.textContent = text('Sign-in status is temporarily unavailable. Please try again later.', '暂时无法读取登录状态，请稍后重试。'); });
})();
