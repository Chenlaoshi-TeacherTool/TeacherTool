/*
 * Home page: signed-in teachers with favorites see "My favorite tools" in
 * place of the popular tools. Fewer than 4 favorites are topped up with
 * popular tools (marked "Popular"). Uses the local copy first so the swap
 * happens before the account answers.
 */
(function () {
  'use strict';
  var grid = document.getElementById('tools');
  var header = document.getElementById('homeToolsHeader');
  var dataNode = document.getElementById('homeToolCards');
  if (!grid || !header || !dataNode || !window.ChenFavorites) return;
  var favorites = window.ChenFavorites;
  var cards = {};
  try { JSON.parse(dataNode.textContent).forEach(function (card) { cards[card.href] = card; }); } catch (error) { return; }
  var MIN = 4;
  var MAX = 8;
  var popular = Array.prototype.slice.call(grid.querySelectorAll('[data-popular]'));
  var eyebrow = document.getElementById('homeToolsEyebrow');
  var heading = document.getElementById('home-paths-heading');
  var intro = document.getElementById('homeToolsIntro');
  var hint = document.getElementById('homeFavHint');
  var manage = document.getElementById('homeManageFavorites');
  var original = { eyebrow: eyebrow.textContent, heading: heading.textContent, intro: intro.textContent };

  function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }

  function favoriteCard(card) {
    var box = el('div', 'home-tool-card snapshot-card'); box.dataset.favRef = card.href;
    var link = el('a', 'home-tool-card__link'); link.href = card.href;
    if (card.preview) {
      var figure = el('figure', 'tool-snapshot'); figure.setAttribute('aria-hidden', 'true');
      var img = el('img'); img.src = card.preview; img.alt = ''; img.width = 960; img.height = 540; img.loading = 'lazy'; img.decoding = 'async';
      figure.appendChild(img); link.appendChild(figure);
    }
    link.append(el('h3', '', card.title), el('p', '', card.desc));
    var open = el('span', 'btn', grid.dataset.openLabel + ' →'); open.setAttribute('aria-hidden', 'true');
    link.appendChild(open); box.appendChild(link);
    return box;
  }

  function popularCard(node) {
    var copy = node.cloneNode(true);
    copy.querySelectorAll('.fav-star').forEach(function (star) { star.remove(); });
    var title = copy.querySelector('h3');
    if (title) title.before(el('span', 'fresh-badge', grid.dataset.popularBadge));
    return copy;
  }

  function render(refs, signedIn) {
    var mine = (refs || []).filter(function (ref) { return cards[ref]; });
    hint.hidden = !(signedIn === true && !mine.length);
    manage.hidden = !mine.length;
    if (!mine.length) {
      eyebrow.textContent = original.eyebrow; heading.textContent = original.heading; intro.textContent = original.intro;
      grid.replaceChildren.apply(grid, popular);
    } else {
      eyebrow.textContent = header.dataset.favEyebrow; heading.textContent = header.dataset.favHeading; intro.textContent = header.dataset.favIntro;
      var shown = mine.slice(0, MAX).map(function (ref) { return favoriteCard(cards[ref]); });
      popular.forEach(function (node) {
        if (shown.length < MIN && mine.indexOf(node.dataset.favRef) === -1) shown.push(popularCard(node));
      });
      grid.replaceChildren.apply(grid, shown);
    }
    favorites.attachStars(document);
  }

  render(favorites.cached(), favorites.signedIn());
  var last = JSON.stringify(favorites.cached());
  favorites.onChange(function (refs, signedIn) {
    // Starring on this page updates the stars only; the grid changes on the next visit
    // so cards do not jump away under the pointer. Account answers re-render.
    var now = JSON.stringify(refs);
    if (now !== last && !document.activeElement.classList.contains('fav-star')) render(refs, signedIn);
    else { hint.hidden = !(signedIn === true && !(refs || []).length); }
    last = now;
  });
  favorites.load();
})();
