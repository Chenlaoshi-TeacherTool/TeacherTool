/*
 * 我的收藏: the ☆ on tool and theme cards, saved to the signed-in teacher
 * account (/api/teacher-library/favorites). Mark a card with
 * data-fav-ref="<tool href or theme key>" (and data-fav-kind="theme" for
 * themes; tools are the default), then call ChenFavorites.attachStars(root).
 * data-fav-style="button" puts a labelled button inside the element instead
 * of a corner star (theme page headings).
 * A local copy of the lists lets pages show stars at once; the account's
 * lists then replace it.
 */
(function () {
  'use strict';
  if (window.ChenFavorites) return;
  var KEY = 'cls-favorites-v2';
  var API = '/api/teacher-library/favorites';
  var KINDS = ['tool', 'theme'];
  var zh = document.documentElement.lang.indexOf('zh') === 0 || /(?:^|;\s*)lang=zh(?:;|$)/.test(document.cookie);
  var L = zh ? {
    tool: { add: '收藏这个工具', remove: '取消收藏', added: '已收藏，会出现在首页和「我的空间」。' },
    theme: { add: '收藏这个主题', remove: '取消收藏', added: '已收藏，可以在「我的空间 → 我的收藏」找到。', button: '收藏主题', buttonOn: '已收藏' },
    signIn: '登录后可以收藏常用工具和主题，换电脑也找得到。', saveFailed: '收藏没有保存成功，请稍后再试。'
  } : {
    tool: { add: 'Add to my favorites', remove: 'Remove from my favorites', added: 'Saved. It now shows on the home page and in My Space.' },
    theme: { add: 'Add this theme to my favorites', remove: 'Remove from my favorites', added: 'Saved. Find it in My Space → My favorites.', button: 'Save theme', buttonOn: 'Saved' },
    signIn: 'Sign in to keep your favorite tools and themes — on any device.', saveFailed: 'Your favorite could not be saved. Please try again.'
  };

  try { localStorage.removeItem('cls-fav-tools-v1'); } catch (error) { /* older copy */ }
  var state = { signedIn: null, lists: readCache() };
  var listeners = [];
  var loading = null;

  function emptyLists() { var lists = {}; KINDS.forEach(function (kind) { lists[kind] = []; }); return lists; }
  function readCache() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || typeof saved.lists !== 'object') return null;
      var lists = emptyLists();
      KINDS.forEach(function (kind) { if (Array.isArray(saved.lists[kind])) lists[kind] = saved.lists[kind]; });
      return lists;
    } catch (error) { return null; }
  }
  function writeCache() {
    try { if (state.lists) localStorage.setItem(KEY, JSON.stringify({ lists: state.lists })); else localStorage.removeItem(KEY); } catch (error) { /* private window */ }
  }
  function signedOut() { state.signedIn = false; state.lists = null; writeCache(); }
  function cached(kind) { return state.lists ? state.lists[kind || 'tool'] : null; }
  // Listeners get (tool refs, signed in, all lists).
  function emit() { listeners.forEach(function (fn) { try { fn(cached('tool'), state.signedIn, state.lists); } catch (error) { console.error(error); } }); }

  function load() {
    if (loading) return loading;
    loading = fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (response.status === 401) { signedOut(); return; }
      if (!response.ok) throw new Error('unavailable');
      return response.json().then(function (body) {
        if (!body.signedIn) { signedOut(); return; }
        state.signedIn = true;
        var lists = emptyLists();
        body.favorites.forEach(function (row) { if (lists[row.kind]) lists[row.kind].push(row.ref); });
        state.lists = lists; writeCache();
      });
    }).catch(function () { /* keep the local copy; stars still show */ })
      .then(function () { loading = null; emit(); return { signedIn: state.signedIn, refs: cached('tool'), lists: state.lists }; });
    return loading;
  }

  function send(method, path, body) {
    return fetch(API + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-library-request': 'favorites' }, body: JSON.stringify(body) })
      .then(function (response) {
        if (response.status === 401) { signedOut(); emit(); throw new Error('signed-out'); }
        if (!response.ok) throw new Error('failed');
      });
  }

  function set(ref, on, kind) {
    kind = kind || 'tool';
    if (!state.lists) state.lists = emptyLists();
    var before = state.lists[kind].slice();
    var next = before.filter(function (item) { return item !== ref; });
    if (on) next.push(ref);
    state.lists[kind] = next; writeCache(); emit();
    return send('POST', '', { kind: kind, ref: ref, on: on }).catch(function (error) {
      if (error.message !== 'signed-out') { state.lists[kind] = before; writeCache(); emit(); toast(L.saveFailed); }
      throw error;
    });
  }

  function reorder(refs, kind) {
    kind = kind || 'tool';
    if (!state.lists) state.lists = emptyLists();
    state.lists[kind] = refs.slice(); writeCache(); emit();
    return send('PUT', '/order', { kind: kind, refs: refs }).catch(function (error) { toast(L.saveFailed); load(); throw error; });
  }

  var toastNode;
  var toastTimer;
  function toast(message) {
    if (!toastNode) {
      toastNode = document.createElement('div'); toastNode.className = 'fav-toast'; toastNode.setAttribute('role', 'status');
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = message; toastNode.classList.add('is-shown');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastNode.classList.remove('is-shown'); }, 3200);
  }

  function has(ref, kind) { var list = cached(kind); return Boolean(list && list.indexOf(ref) !== -1); }

  function paint(button) {
    var kind = button.dataset.favKind;
    var on = has(button.dataset.favButton, kind);
    var words = L[kind];
    if (button.classList.contains('fav-button')) button.textContent = (on ? '★ ' : '☆ ') + (on ? words.buttonOn : words.button);
    else button.textContent = on ? '★' : '☆';
    button.setAttribute('aria-pressed', String(on));
    button.title = on ? words.remove : words.add;
    if (!button.classList.contains('fav-button')) button.setAttribute('aria-label', button.title);
  }

  function onStar(event) {
    event.preventDefault(); event.stopPropagation();
    var button = event.currentTarget;
    var ref = button.dataset.favButton;
    var kind = button.dataset.favKind;
    function askToSignIn() { toast(L.signIn); if (window.ChenTeacherAccount) window.ChenTeacherAccount.openLogin(); }
    function act() {
      if (state.signedIn === false) { askToSignIn(); return; }
      var on = !has(ref, kind);
      set(ref, on, kind).then(function () { if (on && cached(kind).length === 1) toast(L[kind].added); }).catch(function (error) {
        if (error.message === 'signed-out') askToSignIn();
      });
    }
    if (state.signedIn === null) load().then(act); else act();
  }

  function attachStars(root) {
    (root || document).querySelectorAll('[data-fav-ref]').forEach(function (card) {
      if (card.querySelector(':scope > .fav-star, :scope > .fav-button')) return;
      var kind = KINDS.indexOf(card.dataset.favKind) !== -1 ? card.dataset.favKind : 'tool';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = card.dataset.favStyle === 'button' ? 'fav-button' : 'fav-star';
      button.dataset.favButton = card.dataset.favRef;
      button.dataset.favKind = kind;
      button.addEventListener('click', onStar);
      if (button.className === 'fav-star') card.classList.add('has-fav-star');
      card.appendChild(button);
      paint(button);
    });
  }
  listeners.push(function () { document.querySelectorAll('.fav-star, .fav-button').forEach(paint); });

  if (!document.querySelector('link[href^="/shared/tool-favorites.css"]')) {
    var style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/shared/tool-favorites.css?v=2';
    document.head.appendChild(style);
  }

  window.ChenFavorites = {
    load: load, set: set, reorder: reorder, has: has, attachStars: attachStars, toast: toast, cached: cached,
    signedIn: function () { return state.signedIn; },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
