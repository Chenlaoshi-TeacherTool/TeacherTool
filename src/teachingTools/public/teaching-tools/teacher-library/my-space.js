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

// ===== 我的收藏: favorite tools and themes, saved to the teacher account =====
(function () {
  'use strict';
  var zh = window.LibraryI18n.chinese;
  function text(en, cn) { return zh ? cn : en; }
  var favorites = window.ChenFavorites;
  if (!favorites || !document.getElementById('favList')) return;
  var cards = null;
  var lists = favorites.cached('tool') ? { tool: favorites.cached('tool'), theme: favorites.cached('theme') } : null;
  var sections = {
    tool: { list: document.getElementById('favList'), status: document.getElementById('favStatus'),
      count: function (n) { return text(n + ' favorite tools. The first ones show on the home page.', '共 ' + n + ' 个收藏，排在前面的会显示在首页。'); },
      empty: function () { return text('No favorite tools yet. Open the tool directory and tap ☆ on the tools you use most.', '还没有收藏工具。打开工具目录，在常用工具上点 ☆。'); } },
    theme: { list: document.getElementById('favThemesList'), status: document.getElementById('favThemesStatus'),
      count: function (n) { return text(n + ' favorite themes.', '共 ' + n + ' 个收藏主题。'); },
      empty: function () { return text('No favorite themes yet. Tap ☆ on a theme in Theme Activities.', '还没有收藏主题。在「主题活动」里点主题卡片上的 ☆。'); } }
  };

  function el(tag, className, content) { var node = document.createElement(tag); if (className) node.className = className; if (content) node.textContent = content; return node; }
  function button(label, title, onClick) { var node = el('button', 'fav-action', label); node.type = 'button'; node.title = title; node.setAttribute('aria-label', title); node.addEventListener('click', onClick); return node; }

  function move(kind, index, step) {
    var next = lists[kind].slice();
    var item = next.splice(index, 1)[0];
    next.splice(index + step, 0, item);
    favorites.reorder(next, kind).catch(function () {});
    render();
    var row = sections[kind].list.children[index + step];
    var again = row && row.querySelector(step < 0 ? '[data-move="up"]' : '[data-move="down"]');
    if (again && !again.disabled) again.focus(); else if (row) row.querySelector('a').focus();
  }

  function renderKind(kind) {
    var section = sections[kind];
    section.list.replaceChildren();
    if (favorites.signedIn() === false) {
      section.status.textContent = kind === 'tool' ? text('Sign in with the account button above to keep favorite tools and themes on every device.', '请先通过顶部账号按钮登录，收藏的工具和主题在每台设备上都能找到。') : '';
      return;
    }
    if (!cards || !lists) { section.status.textContent = text('Loading your favorites…', '正在读取收藏……'); return; }
    var shown = (lists[kind] || []).filter(function (ref) { return cards[kind][ref]; });
    section.status.textContent = shown.length ? section.count(shown.length) : section.empty();
    shown.forEach(function (ref, index) {
      var card = cards[kind][ref];
      var row = el('li', 'fav-row');
      var icon = el('span', 'fav-icon', card.icon || (kind === 'theme' ? '🗂️' : '✨')); icon.setAttribute('aria-hidden', 'true');
      var info = el('div', 'fav-info');
      var link = el('a', '', card.title); link.href = card.href;
      info.appendChild(link);
      if (card.desc) info.appendChild(el('small', '', card.desc));
      var actions = el('div', 'fav-actions');
      var up = button('↑', text('Move up', '上移'), function () { move(kind, index, -1); }); up.dataset.move = 'up'; up.disabled = index === 0;
      var down = button('↓', text('Move down', '下移'), function () { move(kind, index, 1); }); down.dataset.move = 'down'; down.disabled = index === shown.length - 1;
      var remove = button('★', text('Remove from favorites', '取消收藏'), function () { favorites.set(ref, false, kind).catch(function () {}); });
      remove.classList.add('fav-remove');
      actions.append(up, down, remove);
      row.append(icon, info, actions);
      section.list.appendChild(row);
    });
  }
  function render() { renderKind('tool'); renderKind('theme'); }

  favorites.onChange(function (tools, signedIn, all) {
    lists = all ? { tool: all.tool.slice(), theme: all.theme.slice() } : (signedIn ? { tool: [], theme: [] } : null);
    render();
  });
  render();
  fetch('/api/tool-cards', { credentials: 'same-origin' }).then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
    .then(function (body) {
      cards = { tool: {}, theme: {} };
      body.cards.forEach(function (card) { cards.tool[card.href] = card; });
      (body.themes || []).forEach(function (theme) { cards.theme[theme.key] = theme; });
      render();
    })
    .catch(function () { sections.tool.status.textContent = text('Your favorites could not be loaded right now.', '暂时无法读取收藏，请稍后再试。'); });
  favorites.load();
})();
