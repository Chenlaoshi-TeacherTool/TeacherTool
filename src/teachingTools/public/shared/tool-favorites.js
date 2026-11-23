/*
 * 我的收藏 for tools: the ☆ on tool cards, saved to the signed-in teacher
 * account (/api/teacher-library/favorites). Mark a card with
 * data-fav-ref="<tool href>" and call ChenFavorites.attachStars(root).
 * A local copy of the list lets pages show stars and "My tools" at once,
 * then the account's list replaces it.
 */
(function () {
  'use strict';
  if (window.ChenFavorites) return;
  var KEY = 'cls-fav-tools-v1';
  var API = '/api/teacher-library/favorites';
  var zh = document.documentElement.lang.indexOf('zh') === 0 || /(?:^|;\s*)lang=zh(?:;|$)/.test(document.cookie);
  var L = zh ? { add: '收藏这个工具', remove: '取消收藏', signIn: '登录后可以收藏常用工具，换电脑也找得到。', saveFailed: '收藏没有保存成功，请稍后再试。', added: '已收藏，会出现在首页和「我的空间」。' }
    : { add: 'Add to my favorites', remove: 'Remove from my favorites', signIn: 'Sign in to keep your favorite tools — on any device.', saveFailed: 'Your favorite could not be saved. Please try again.', added: 'Saved. It now shows on the home page and in My Space.' };

  var state = { signedIn: null, refs: readCache() };
  var listeners = [];
  var loading = null;

  function readCache() {
    try { var saved = JSON.parse(localStorage.getItem(KEY)); return saved && Array.isArray(saved.refs) ? saved.refs : null; }
    catch (error) { return null; }
  }
  function writeCache(refs) {
    try { if (refs) localStorage.setItem(KEY, JSON.stringify({ refs: refs })); else localStorage.removeItem(KEY); } catch (error) { /* private window */ }
  }
  function emit() { listeners.forEach(function (fn) { try { fn(state.refs, state.signedIn); } catch (error) { console.error(error); } }); }

  function load() {
    if (loading) return loading;
    loading = fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (response.status === 401) { state.signedIn = false; state.refs = null; writeCache(null); return; }
      if (!response.ok) throw new Error('unavailable');
      return response.json().then(function (body) {
        if (!body.signedIn) { state.signedIn = false; state.refs = null; writeCache(null); return; }
        state.signedIn = true;
        state.refs = body.favorites.filter(function (row) { return row.kind === 'tool'; }).map(function (row) { return row.ref; });
        writeCache(state.refs);
      });
    }).catch(function () { /* keep the local copy; stars still show */ })
      .then(function () { loading = null; emit(); return { signedIn: state.signedIn, refs: state.refs }; });
    return loading;
  }

  function send(method, path, body) {
    return fetch(API + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-library-request': 'favorites' }, body: JSON.stringify(body) })
      .then(function (response) {
        if (response.status === 401) { state.signedIn = false; state.refs = null; writeCache(null); emit(); throw new Error('signed-out'); }
        if (!response.ok) throw new Error('failed');
      });
  }

  function set(ref, on) {
    var before = (state.refs || []).slice();
    var next = before.filter(function (item) { return item !== ref; });
    if (on) next.push(ref);
    state.refs = next; writeCache(next); emit();
    return send('POST', '', { kind: 'tool', ref: ref, on: on }).catch(function (error) {
      if (error.message !== 'signed-out') { state.refs = before; writeCache(before); emit(); toast(L.saveFailed); }
      throw error;
    });
  }

  function reorder(refs) {
    state.refs = refs.slice(); writeCache(state.refs); emit();
    return send('PUT', '/order', { kind: 'tool', refs: refs }).catch(function (error) { toast(L.saveFailed); load(); throw error; });
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

  function has(ref) { return Boolean(state.refs && state.refs.indexOf(ref) !== -1); }

  function paint(button) {
    var on = has(button.dataset.favButton);
    button.textContent = on ? '★' : '☆';
    button.setAttribute('aria-pressed', String(on));
    button.title = on ? L.remove : L.add;
    button.setAttribute('aria-label', button.title);
  }

  function onStar(event) {
    event.preventDefault(); event.stopPropagation();
    var button = event.currentTarget;
    var ref = button.dataset.favButton;
    function act() {
      if (state.signedIn === false) {
        toast(L.signIn);
        if (window.ChenTeacherAccount) window.ChenTeacherAccount.openLogin();
        return;
      }
      var on = !has(ref);
      set(ref, on).then(function () { if (on && (state.refs || []).length === 1) toast(L.added); }).catch(function (error) {
        if (error.message === 'signed-out') { toast(L.signIn); if (window.ChenTeacherAccount) window.ChenTeacherAccount.openLogin(); }
      });
    }
    if (state.signedIn === null) load().then(act); else act();
  }

  function attachStars(root) {
    (root || document).querySelectorAll('[data-fav-ref]').forEach(function (card) {
      if (card.querySelector(':scope > .fav-star')) return;
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'fav-star'; button.dataset.favButton = card.dataset.favRef;
      button.addEventListener('click', onStar);
      card.classList.add('has-fav-star');
      card.appendChild(button);
      paint(button);
    });
  }
  listeners.push(function () { document.querySelectorAll('.fav-star').forEach(paint); });

  if (!document.querySelector('link[href^="/shared/tool-favorites.css"]')) {
    var style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/shared/tool-favorites.css?v=1';
    document.head.appendChild(style);
  }

  window.ChenFavorites = {
    load: load, set: set, reorder: reorder, has: has, attachStars: attachStars, toast: toast,
    cached: function () { return state.refs; },
    signedIn: function () { return state.signedIn; },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
