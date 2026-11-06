(function () {
  'use strict';

  var post = document.getElementById('communityPost');
  if (!post) return;
  var text = window.COMMUNITY_TEXT || {};
  var id = post.dataset.id;
  var statusEl = document.getElementById('communityStatus');

  function status(message) { if (statusEl) statusEl.textContent = message; }

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'X-Community-Request': 'yes' }, options.headers || {});
    return fetch('/api/community/posts/' + encodeURIComponent(id) + path, options);
  }

  function used() { api('/used', { method: 'POST' }).catch(function () {}); }

  function words() {
    var el = document.getElementById('communityWords');
    return el ? JSON.parse(el.textContent) : [];
  }

  function asList() {
    return { name: post.dataset.title, theme: '', level: '', items: words().map(function (word) {
      return { zh: word.zh, py: word.py, en: word.en, theme: '', level: '', img: '', note: '' };
    }) };
  }

  async function copy(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
    var area = document.createElement('textarea');
    area.value = value; document.body.appendChild(area); area.select();
    var ok = document.execCommand('copy'); area.remove();
    if (!ok) throw new Error('copy');
  }

  var actions = {
    save: function () {
      try {
        window.ChenWordlist.save(asList());
        status(text.saved);
        used();
      } catch (error) { status(text.saveFailed); }
    },
    copy: async function () {
      try { await copy(document.getElementById('communityWordsText').value); status(text.copied); used(); }
      catch (error) { status(text.copyFailed); }
    },
    booklet: function () {
      try {
        sessionStorage.setItem('chenlaoshi-wordlist-booklet-draft', JSON.stringify(asList()));
        used();
        window.location.href = '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html';
      } catch (error) { status(text.failed); }
    },
    link: function () {
      var data = JSON.parse(document.getElementById('communityGame').textContent);
      window.TeacherGameShare.openPublisher({
        gameType: post.dataset.gameType, version: Number(post.dataset.gameVersion) || 1,
        title: post.dataset.title, getData: function () { return data; },
        onPublished: used
      });
    },
    report: async function () {
      var reason = window.prompt(text.reportPrompt, '');
      if (reason === null) return;
      try {
        var response = await api('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason }) });
        if (!response.ok) throw new Error('report');
        window.alert(text.reported);
      } catch (error) { window.alert(text.failed); }
    },
    delete: async function () {
      if (!window.confirm(text.deleteConfirm)) return;
      try {
        var response = await api('', { method: 'DELETE' });
        if (!response.ok) throw new Error('delete');
        window.location.href = '/community';
      } catch (error) { window.alert(text.deleteFailed); }
    }
  };

  post.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]');
    if (button && actions[button.dataset.action]) actions[button.dataset.action]();
  });
}());
