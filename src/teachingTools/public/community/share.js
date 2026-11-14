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

  function updateKind() {
    var kind = $('shareKind').value;
    if (kind === 'website') { window.location.href = '/community/websites/new'; return; }
    var external = kind === 'contest' || kind === 'website' || kind === 'grant';
    $('shareWords').hidden = kind !== 'wordlist';
    $('shareGame').hidden = kind !== 'game' || !gameId;
    $('shareGameHelp').hidden = kind !== 'game' || Boolean(gameId);
    $('shareExternal').hidden = !external;
    $('shareContestFields').hidden = kind !== 'contest';
    $('shareGrantFields').hidden = kind !== 'grant';
    $('shareSubmit').textContent = external ? text.submitReview : text.publish;
  }

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
    body.kind = $('shareKind').value;
    if (body.kind === 'contest' || body.kind === 'website' || body.kind === 'grant') {
      body.url = $('shareUrl').value.trim();
      if (body.kind === 'grant') {
        body.funder = $('shareFunder').value.trim();
        body.amount = $('shareAmount').value.trim();
        body.eligibility = $('shareEligibility').value.trim();
        body.deadline = $('shareGrantDeadline').value;
      } else {
        body.audience = $('shareAudience').value.trim();
        body.deadline = $('shareDeadline').value;
      }
      try {
        var url = new URL(body.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch (error) { return showError(text.needUrl); }
    } else if (body.kind === 'game') {
      if (!gameId) return showError(text.chooseGame);
      body.activityId = gameId;
    }
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
      try { if (body.kind === 'wordlist') sessionStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
      window.location.href = result.url;
    } catch (error) {
      showError(error.message || text.failed);
      button.disabled = false;
      updateKind();
    }
  }

  async function init() {
    var me = null;
    try {
      var response = await fetch('/api/community/me?back=' + encodeURIComponent(window.location.pathname + window.location.search));
      me = await response.json();
    } catch (error) { me = null; }
    $('shareLoading').hidden = true;
    if (!me) { showError(text.failed); return; }
    if (!me.accountsOn) { $('shareClosed').hidden = false; return; }
    if (!me.signedIn) {
      $('shareSignInLink').href = me.loginUrl;
      $('shareSignIn').hidden = false;
      return;
    }
    $('shareForm').hidden = false;
    if (me.displayName) $('shareAuthor').value = me.displayName;
    if (gameId) {
      $('shareKind').value = 'game';
      $('shareWords').hidden = true;
      $('shareGame').hidden = false;
      $('shareGameName').textContent = params.get('title') || '';
      $('shareTitleInput').value = params.get('title') || '';
    } else {
      fillFromDraft();
      $('shareWordsText').addEventListener('input', updateCount);
      updateCount();
    }
    if (!gameId && ['contest', 'website', 'grant'].includes(params.get('kind'))) $('shareKind').value = params.get('kind');
    $('shareKind').addEventListener('change', updateKind);
    updateKind();
    $('shareForm').addEventListener('submit', submit);
  }

  init();
}());
