(function () {
  'use strict';

  // Every shared game and book this browser created. The tools record them in
  // localStorage together with a delete token; the server checks that token
  // before it reports status, results, or deletes anything.
  var SHARES_KEY = 'teacher-game-shares:v1';
  var BOOKS_KEY = 'chen-laoshi-book-generator-my-books-v1';
  var t = function (value) { return window.LibraryI18n ? window.LibraryI18n.t(value) : value; };
  var chinese = Boolean(window.LibraryI18n && window.LibraryI18n.chinese);
  var TYPES = {
    'sentence-reorder': { icon: '🧩', label: 'Sentence Reorder', tool: '/teaching-tools/sentence-reorder' },
    'word-sudoku': { icon: '🔢', label: 'Word Sudoku', tool: '/low-prep/word-sudoku/word-sudoku-widget.html' },
    'measure-words': { icon: '🍎', label: 'Measure Word Challenge', tool: '/teaching-tools/measure-words' },
    book: { icon: '📖', label: 'Book', tool: '/teaching-tools/book-generator' }
  };
  var find = function (id) { return document.getElementById(id); };
  var activities = [];

  function read(key) {
    try { var value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch (error) { return []; }
  }
  function write(key, list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch (error) {} }

  function localActivities() {
    var games = read(SHARES_KEY).filter(function (item) { return item && /^[0-9a-f-]{36}$/i.test(String(item.shareId || '')) && item.deleteToken; })
      .map(function (item) { return { kind: 'game', id: item.shareId, type: TYPES[item.gameType] ? item.gameType : 'sentence-reorder', title: item.title, url: item.url, token: item.deleteToken, createdAt: item.createdAt, expiresAt: item.expiresAt }; });
    var books = read(BOOKS_KEY).filter(function (item) { return item && item.bookId && item.deleteToken; })
      .map(function (item) { return { kind: 'book', id: item.bookId, type: 'book', title: item.title, url: new URL(item.url, location.origin).href, token: item.deleteToken, createdAt: item.createdAt, expiresAt: null }; });
    return games.concat(books).sort(function (left, right) { return String(right.createdAt || '').localeCompare(String(left.createdAt || '')); });
  }

  async function post(url, body) {
    var response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!response.ok) throw new Error('status');
    return response.json();
  }

  // Asks the server which links still exist, when they expire, and how many students submitted.
  async function loadStatus(list) {
    var games = list.filter(function (item) { return item.kind === 'game'; });
    var books = list.filter(function (item) { return item.kind === 'book'; });
    var byId = Object.create(null);
    var requests = [];
    if (games.length) requests.push(post('/api/game-shares/summary', { shares: games.map(function (item) { return { shareId: item.id, deleteToken: item.token }; }) }).then(function (result) { result.shares.forEach(function (entry) { byId[entry.shareId] = entry; }); }));
    if (books.length) requests.push(post('/api/book-generator/summary', { books: books.map(function (item) { return { bookId: item.id, deleteToken: item.token }; }) }).then(function (result) { result.books.forEach(function (entry) { byId[entry.bookId] = entry; }); }));
    await Promise.all(requests);
    list.forEach(function (item) { item.status = byId[item.id] || null; });
  }

  function day(value) { return new Date(value).toLocaleDateString(chinese ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function daysLeft(value) { return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000); }
  function element(tag, text, className) { var node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
  function button(text, className) { var node = element('button', text, className); node.type = 'button'; return node; }

  async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var input = document.createElement('textarea'); input.value = text; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
  }

  function forget(item) {
    if (item.kind === 'game') write(SHARES_KEY, read(SHARES_KEY).filter(function (entry) { return entry.shareId !== item.id; }));
    else write(BOOKS_KEY, read(BOOKS_KEY).filter(function (entry) { return entry.bookId !== item.id; }));
    activities = activities.filter(function (entry) { return entry !== item; });
    render();
  }

  async function remove(item) {
    if (!window.confirm(t('Delete this activity? Students will no longer be able to open the link. This cannot be undone.'))) return;
    var url = item.kind === 'game' ? '/api/game-shares/' + encodeURIComponent(item.id) : '/api/book-generator/books/' + encodeURIComponent(item.id);
    try {
      var response = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteToken: item.token }) });
      if (!response.ok && response.status !== 404) throw new Error('delete');
      forget(item);
      find('activitiesStatus').textContent = t('Activity deleted.');
    } catch (error) { find('activitiesStatus').textContent = t('This activity could not be deleted. Please try again.'); }
  }

  function card(item) {
    var type = TYPES[item.type];
    var status = item.status;
    var gone = status && !status.exists;
    var li = element('li', '', 'activity-card' + (gone ? ' is-gone' : ''));
    li.appendChild(element('div', type.icon, 'activity-icon'));
    var body = element('div', '', 'activity-body');
    body.appendChild(element('h3', item.title || t(type.label)));
    var meta = [t(type.label)];
    if (status && status.quiz) meta.push(t('Quiz'));
    if (item.createdAt) meta.push(t('Created ') + day(item.createdAt));
    body.appendChild(element('p', meta.join(' · '), 'activity-meta'));
    var expires = status && status.expiresAt ? status.expiresAt : item.expiresAt;
    var badges = element('p', '', 'activity-badges');
    if (gone) badges.appendChild(element('span', t('Expired or deleted'), 'activity-badge is-gone'));
    else if (expires) {
      var left = daysLeft(expires);
      badges.appendChild(element('span', left <= 1 ? t('Expires within a day') : t('Expires in ') + left + t(' days'), 'activity-badge' + (left <= 7 ? ' is-soon' : '')));
    }
    if (status && status.quiz) badges.appendChild(element('span', status.submissions + t(' submitted'), 'activity-badge is-count'));
    if (badges.childNodes.length) body.appendChild(badges);
    li.appendChild(body);

    var actions = element('div', '', 'activity-actions');
    if (gone) {
      var clear = button(t('Remove from list'), 'small-button');
      clear.addEventListener('click', function () { forget(item); });
      actions.appendChild(clear);
    } else {
      var open = element('a', t('Open'), 'small-button');
      open.href = item.url; open.target = '_blank'; open.rel = 'noopener';
      var copyButton = button(t('Copy link'), 'small-button');
      copyButton.addEventListener('click', async function () {
        try { await copy(item.url); copyButton.textContent = t('Copied'); } catch (error) { copyButton.textContent = t('Copy failed'); }
        setTimeout(function () { copyButton.textContent = t('Copy link'); }, 1600);
      });
      actions.append(open, copyButton);
      if (status && status.quiz) {
        var results = element('a', t('View results'), 'small-button is-primary');
        results.href = '/teaching-tools/my-activities/quiz-results.html?id=' + encodeURIComponent(item.id);
        actions.appendChild(results);
      }
      var del = button(t('Delete'), 'small-button danger');
      del.addEventListener('click', function () { remove(item); });
      actions.appendChild(del);
    }
    li.appendChild(actions);
    return li;
  }

  function render() {
    var query = find('activitySearch').value.trim().toLowerCase();
    var type = find('activityType').value;
    var shown = activities.filter(function (item) {
      return (!type || item.type === type) && (!query || String(item.title || '').toLowerCase().indexOf(query) !== -1);
    });
    find('activityList').replaceChildren.apply(find('activityList'), shown.map(card));
    find('activitiesEmpty').hidden = activities.length > 0;
    if (activities.length && !shown.length) find('activitiesStatus').textContent = t('No activities match this search.');
  }

  async function start() {
    activities = localActivities();
    render();
    if (!activities.length) { find('activitiesStatus').textContent = ''; return; }
    try {
      await loadStatus(activities);
      find('activitiesStatus').textContent = activities.length + t(' activities shared from this browser.');
    } catch (error) {
      find('activitiesStatus').textContent = t('Link status could not be checked right now. Your list is still shown.');
    }
    render();
  }

  find('activitySearch').addEventListener('input', render);
  find('activityType').addEventListener('change', render);
  start();
})();
