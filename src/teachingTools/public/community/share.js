(function () {
  'use strict';

  // Share page: /community/share for a word list (pasted here, or handed over
  // from the word list library through sessionStorage), or
  // /community/share?game=<activity id>&title=... from My activities.
  var DRAFT_KEY = 'chenlaoshi-community-draft';
  var text = window.COMMUNITY_TEXT || {};
  var params = new URLSearchParams(window.location.search);
  var gameId = params.get('game');
  function $(id) { return document.getElementById(id); }

  function parsedWords() {
    var items = window.ChenWordlist.parseText($('shareWordsText').value, { spaced: true });
    return window.ChenWordlist.dedupe(items).map(function (item) { return { zh: item.zh, py: item.py, en: item.en }; });
  }

  function updateCount() {
    var count = parsedWords().length;
    $('shareWordCount').textContent = count ? count + ' ' + text.words + (count > text.maxWords ? ' · ' + text.tooMany : '') : '';
  }

  function fillFromDraft() {
    try {
      var draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (!draft || !Array.isArray(draft.items)) return;
      $('shareWordsText').value = draft.items.map(function (item) {
        return [item.zh, item.py, item.en].filter(function (part, index) { return part || index === 0; }).join(' | ');
      }).join('\n');
      if (draft.name) $('shareTitleInput').value = draft.name;
    } catch (error) { /* no draft */ }
  }

  function showError(message) {
    $('shareError').textContent = message;
    $('shareError').hidden = !message;
  }

  async function submit(event) {
    event.preventDefault();
    showError('');
    var body = {
      title: $('shareTitleInput').value.trim(),
      description: $('shareDescription').value.trim(),
      authorName: $('shareAuthor').value.trim(),
      textbook: $('shareTextbook').value,
      stages: Array.prototype.map.call(document.querySelectorAll('input[name="stages"]:checked'), function (box) { return box.value; })
    };
    if (gameId) { body.kind = 'game'; body.activityId = gameId; }
    else {
      body.kind = 'wordlist';
      body.words = parsedWords();
      if (!body.words.length) return showError(text.noWords);
      if (body.words.length > text.maxWords) return showError(text.tooMany);
    }
    if (!body.title) return showError(text.needTitle);
    if (!body.authorName) return showError(text.needAuthor);

    var button = $('shareSubmit');
    button.disabled = true;
    button.textContent = text.publishing;
    try {
      var response = await fetch('/api/community/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Community-Request': 'yes' }, body: JSON.stringify(body)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || text.failed);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
      window.location.href = result.url;
    } catch (error) {
      showError(error.message || text.failed);
      button.disabled = false;
      button.textContent = text.publish;
    }
  }

  async function init() {
    var me = null;
    try {
      var response = await fetch('/api/community/me?back=' + encodeURIComponent(window.location.pathname + window.location.search));
      me = await response.json();
    } catch (error) { me = null; }
    $('shareLoading').hidden = true;
    if (!me || !me.accountsOn) { $('shareClosed').hidden = false; return; }
    if (!me.signedIn) {
      $('shareSignInLink').href = me.loginUrl;
      $('shareSignIn').hidden = false;
      return;
    }
    $('shareForm').hidden = false;
    if (me.displayName) $('shareAuthor').value = me.displayName;
    if (gameId) {
      $('shareWords').hidden = true;
      $('shareGame').hidden = false;
      $('shareGameName').textContent = params.get('title') || '';
      $('shareTitleInput').value = params.get('title') || '';
    } else {
      fillFromDraft();
      $('shareWordsText').addEventListener('input', updateCount);
      updateCount();
    }
    $('shareForm').addEventListener('submit', submit);
  }

  init();
}());
