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

  // Background music plays continuously once it can start—independent of
  // page turns and of pausing the narration. Browsers block audible
  // autoplay before any user interaction, so try immediately and again on
  // the first interaction with the page.
  function tryStartMusic() {
    if (musicAudio.src && musicAudio.paused) musicAudio.play().catch(function () {});
  }
  tryStartMusic();
  document.addEventListener('pointerdown', tryStartMusic, { once: true });
  document.addEventListener('keydown', tryStartMusic, { once: true });

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
    tryStartMusic();
    if (isPlaying) {
      if (narrationAudio.src) narrationAudio.play().catch(function () {});
    } else {
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

  // ===== Fullscreen =====

  var playerWrap = $('#playerWrap');
  var fullscreenBtn = $('#fullscreenBtn');

  if (fullscreenBtn && playerWrap.requestFullscreen) {
    fullscreenBtn.addEventListener('click', function () {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerWrap.requestFullscreen().catch(function () {});
      }
    });
    document.addEventListener('fullscreenchange', function () {
      var isFullscreen = document.fullscreenElement === playerWrap;
      fullscreenBtn.textContent = isFullscreen ? (I18N.exitFullscreen || 'Exit fullscreen') : (I18N.fullscreen || 'Fullscreen');
    });
  } else if (fullscreenBtn) {
    fullscreenBtn.hidden = true;
  }

  renderPage(false);
})();
