(function () {
  'use strict';

  var bookData = window.__BOOK_DATA__ || { pages: [], musicUrl: null };
  var I18N = window.__BOOK_PLAYER_I18N__ || {};
  var $ = function (selector) { return document.querySelector(selector); };

  var pages = bookData.pages || [];
  var currentIndex = 0;
  var isPlaying = false;

  var imageEl = $('#playerImage');
  var captionEl = $('#playerCaption');
  var playPauseBtn = $('#playPauseBtn');
  var prevBtn = $('#prevPageBtn');
  var nextBtn = $('#nextPageBtn');
  var indicatorEl = $('#pageIndicator');
  var narrationAudio = $('#narrationAudio');
  var musicAudio = $('#musicAudio');

  if (bookData.musicUrl) {
    musicAudio.src = bookData.musicUrl;
    musicAudio.volume = 0.35;
  }

  function renderPage(withTurnAnimation) {
    var page = pages[currentIndex];
    if (!page) return;

    if (withTurnAnimation) {
      imageEl.classList.add('is-turning');
      setTimeout(function () {
        imageEl.src = page.imageUrl;
        captionEl.textContent = page.caption || '';
        imageEl.classList.remove('is-turning');
      }, 180);
    } else {
      imageEl.src = page.imageUrl;
      captionEl.textContent = page.caption || '';
    }

    indicatorEl.textContent = (I18N.pageOf || 'Page {current} of {total}')
      .replace('{current}', currentIndex + 1)
      .replace('{total}', pages.length);

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === pages.length - 1;

    narrationAudio.pause();
    if (page.narrationUrl) {
      narrationAudio.src = page.narrationUrl;
      if (isPlaying) narrationAudio.play();
    } else {
      narrationAudio.removeAttribute('src');
    }
  }

  function goToPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentIndex = index;
    renderPage(true);
  }

  function setPlaying(next) {
    isPlaying = next;
    playPauseBtn.textContent = isPlaying ? (I18N.pause || 'Pause') : (I18N.startReading || 'Start reading');
    if (isPlaying) {
      if (musicAudio.src) musicAudio.play().catch(function () {});
      if (narrationAudio.src) narrationAudio.play().catch(function () {});
    } else {
      musicAudio.pause();
      narrationAudio.pause();
    }
  }

  narrationAudio.addEventListener('ended', function () {
    if (!isPlaying) return;
    if (currentIndex < pages.length - 1) {
      goToPage(currentIndex + 1);
    } else {
      setPlaying(false);
    }
  });

  playPauseBtn.addEventListener('click', function () { setPlaying(!isPlaying); });
  prevBtn.addEventListener('click', function () { goToPage(currentIndex - 1); });
  nextBtn.addEventListener('click', function () { goToPage(currentIndex + 1); });

  renderPage(false);
})();
