(function () {
  'use strict';

  var imageInput = document.getElementById('image-input');
  var pdfInput = document.getElementById('pdf-input');
  var textInput = document.getElementById('text-input');
  var textAddButton = document.getElementById('text-add-button');
  var sourceStatus = document.getElementById('source-status');
  var sourceTabs = Array.prototype.slice.call(document.querySelectorAll('[data-source-tab]'));
  var sourcePanes = Array.prototype.slice.call(document.querySelectorAll('[data-source-pane]'));
  var i18n = JSON.parse(document.getElementById('reveal-i18n').textContent);
  var imageListEl = document.getElementById('image-list');
  var setupStatus = document.getElementById('setup-status');

  var rowsInput = document.getElementById('grid-rows');
  var colsInput = document.getElementById('grid-cols');
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll('.reveal-preset'));
  var speedInput = document.getElementById('reveal-speed');
  var speedValue = document.getElementById('speed-value');

  var stage = document.getElementById('reveal-stage');
  var stageWrap = document.getElementById('reveal-stage-wrap');
  var fsBar = stageWrap.querySelector('.reveal-fs-bar');
  var fsToggleButton = document.getElementById('fs-toggle-button');
  var FS_BAR_RESERVED = 84;
  var IDLE_HIDE_MS = 3000;
  var idleTimer = null;
  var progressText = document.getElementById('progress-text');

  var startButton = document.getElementById('start-button');
  var pauseButton = document.getElementById('pause-button');
  var revealAllButton = document.getElementById('reveal-all-button');
  var restartButton = document.getElementById('restart-button');
  var fullscreenButton = document.getElementById('fullscreen-button');
  var prevButton = document.getElementById('prev-button');
  var nextButton = document.getElementById('next-button');
  var startLabel = startButton.textContent;
  var pauseLabel = pauseButton.textContent;

  var state = {
    images: [],       // { file, url }
    currentIndex: -1,
    tileTotal: 0,
    revealQueue: [],
    revealedCount: 0,
    timer: null,
    isRunning: false
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function getRevealOrder() {
    var checked = document.querySelector('input[name="revealOrder"]:checked');
    return checked ? checked.value : 'random';
  }

  function clampGridInputs() {
    var rows = Math.min(14, Math.max(1, parseInt(rowsInput.value, 10) || 1));
    var cols = Math.min(14, Math.max(1, parseInt(colsInput.value, 10) || 1));
    rowsInput.value = rows;
    colsInput.value = cols;
    return { rows: rows, cols: cols };
  }

  function updatePresetHighlight() {
    var rows = parseInt(rowsInput.value, 10);
    var cols = parseInt(colsInput.value, 10);
    presetButtons.forEach(function (btn) {
      var match = parseInt(btn.dataset.rows, 10) === rows && parseInt(btn.dataset.cols, 10) === cols;
      btn.classList.toggle('is-active', match);
    });
  }

  presetButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      rowsInput.value = btn.dataset.rows;
      colsInput.value = btn.dataset.cols;
      updatePresetHighlight();
      if (state.currentIndex >= 0) loadImage(state.currentIndex, false);
    });
  });
  [rowsInput, colsInput].forEach(function (el) {
    el.addEventListener('change', function () {
      clampGridInputs();
      updatePresetHighlight();
      if (state.currentIndex >= 0) loadImage(state.currentIndex, false);
    });
  });

  speedInput.addEventListener('input', function () {
    speedValue.textContent = parseFloat(speedInput.value).toFixed(1);
    if (state.isRunning) restartTimer();
  });

  imageInput.addEventListener('change', function (event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    if (!files.length) return;
    files.forEach(function (file) {
      if (file.type.indexOf('image/') !== 0) return;
      state.images.push({ file: file, url: URL.createObjectURL(file) });
    });
    imageInput.value = '';
    finishAddingSlides();
  });

  function finishAddingSlides() {
    renderImageList();
    if (state.currentIndex === -1 && state.images.length) {
      goToImage(0, false);
    }
    updateSetupStatus();
  }

  function fmt(template, n) {
    return String(template).replace('{n}', n);
  }

  function setSourceStatus(message, kind) {
    sourceStatus.textContent = message || '';
    sourceStatus.dataset.state = kind || '';
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('Could not encode image'));
      }, 'image/png');
    });
  }

  function addSlideFromCanvas(canvas) {
    return canvasToBlob(canvas).then(function (blob) {
      state.images.push({ file: null, url: URL.createObjectURL(blob) });
    });
  }

  sourceTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      sourceTabs.forEach(function (other) {
        var active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      sourcePanes.forEach(function (pane) {
        pane.hidden = pane.dataset.sourcePane !== tab.dataset.sourceTab;
      });
      setSourceStatus('');
    });
  });

  // ---- PDF: every page becomes one picture (pdf.js is shared with Vocab Puzzle)
  var PDFJS_BASE = '/low-prep/vocab-puzzle/pdfjs/';
  var PDF_PAGE_LONG_SIDE = 1600;
  var PDF_MAX_PAGES = 60;

  pdfInput.addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    pdfInput.value = '';
    if (!file) return;
    if (!window.pdfjsLib) { setSourceStatus(i18n.pdfNoReader, 'error'); return; }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
    setSourceStatus(i18n.pdfReading);
    file.arrayBuffer().then(function (buf) {
      return window.pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        cMapUrl: PDFJS_BASE + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: PDFJS_BASE + 'standard_fonts/'
      }).promise;
    }).then(function (pdf) {
      var total = Math.min(pdf.numPages, PDF_MAX_PAGES);
      var added = 0;
      var chain = Promise.resolve();
      for (var num = 1; num <= total; num++) {
        (function (pageNum) {
          chain = chain.then(function () {
            return renderPdfPage(pdf, pageNum).then(addSlideFromCanvas).then(function () {
              added++;
              setSourceStatus(i18n.pdfReading + ' ' + added + '/' + total);
            });
          });
        })(num);
      }
      return chain.then(function () { return added; });
    }).then(function (added) {
      finishAddingSlides();
      setSourceStatus(fmt(i18n.pdfDone, added), 'success');
    }).catch(function () {
      finishAddingSlides();
      setSourceStatus(i18n.pdfError, 'error');
    });
  });

  function renderPdfPage(pdf, pageNum) {
    return pdf.getPage(pageNum).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = PDF_PAGE_LONG_SIDE / Math.max(base.width, base.height);
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () { return canvas; });
    });
  }

  // ---- Text: every non-empty line becomes one picture
  var CARD_W = 1600;
  var CARD_H = 1000;
  var CARD_PAD = 110;
  var CARD_FONT = '"Noto Sans SC", "Nunito", "Microsoft YaHei", "PingFang SC", sans-serif';
  var TOKEN_RE = /[　-鿿＀-￯]|[^\s　-鿿＀-￯]+|\s+/g;

  function wrapText(ctx, text, maxWidth) {
    var tokens = text.match(TOKEN_RE) || [];
    var lines = [];
    var line = '';
    tokens.forEach(function (token) {
      var candidate = line + token;
      if (line && ctx.measureText(candidate.trim()).width > maxWidth) {
        lines.push(line.trim());
        line = /^\s+$/.test(token) ? '' : token;
      } else {
        line = candidate;
      }
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function renderTextCard(text) {
    var canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.strokeStyle = '#e5ddc9';
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, CARD_W - 48, CARD_H - 48);

    var maxWidth = CARD_W - CARD_PAD * 2;
    var maxHeight = CARD_H - CARD_PAD * 2;
    var size = 340;
    var lines;
    for (; size >= 40; size -= 8) {
      ctx.font = '800 ' + size + 'px ' + CARD_FONT;
      lines = wrapText(ctx, text, maxWidth);
      if (lines.length * size * 1.3 <= maxHeight) break;
    }
    ctx.fillStyle = '#103e37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var lineHeight = size * 1.3;
    var top = CARD_H / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
    lines.forEach(function (line, i) { ctx.fillText(line, CARD_W / 2, top + i * lineHeight); });
    return canvas;
  }

  textAddButton.addEventListener('click', function () {
    var lines = textInput.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) { setSourceStatus(i18n.textEmpty, 'error'); return; }
    var fontsReady = document.fonts && document.fonts.load
      ? document.fonts.load('800 80px "Noto Sans SC"', lines.join('')).catch(function () {})
      : Promise.resolve();
    fontsReady.then(function () {
      var chain = Promise.resolve();
      lines.forEach(function (line) {
        chain = chain.then(function () { return addSlideFromCanvas(renderTextCard(line)); });
      });
      return chain;
    }).then(function () {
      textInput.value = '';
      finishAddingSlides();
      setSourceStatus(fmt(i18n.textAdded, lines.length), 'success');
    });
  });

  function renderImageList() {
    imageListEl.innerHTML = '';
    state.images.forEach(function (img, index) {
      var li = document.createElement('li');
      li.className = 'reveal-image-list-item' + (index === state.currentIndex ? ' is-current' : '');

      var thumb = document.createElement('img');
      thumb.src = img.url;
      thumb.alt = fmt(i18n.slideAlt, index + 1);
      thumb.addEventListener('click', function () { goToImage(index, false); });
      li.appendChild(thumb);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'reveal-image-list-remove';
      removeBtn.setAttribute('aria-label', i18n.removeAlt);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        removeImage(index);
      });
      li.appendChild(removeBtn);

      imageListEl.appendChild(li);
    });
  }

  function removeImage(index) {
    var removed = state.images.splice(index, 1)[0];
    if (removed) URL.revokeObjectURL(removed.url);

    if (!state.images.length) {
      state.currentIndex = -1;
      stopTimer();
      renderStageEmpty();
    } else if (index === state.currentIndex) {
      var nextIndex = Math.min(index, state.images.length - 1);
      goToImage(nextIndex, false);
    } else if (index < state.currentIndex) {
      state.currentIndex -= 1;
    }
    renderImageList();
    updateSetupStatus();
    updateControlsAvailability();
  }

  function updateSetupStatus() {
    if (!state.images.length) {
      setupStatus.textContent = 'Upload at least one image to begin.';
    } else {
      setupStatus.textContent = fmt(i18n.imagesReady, state.images.length);
    }
  }

  function renderStageEmpty() {
    stage.innerHTML = '<p class="reveal-stage-empty">Upload images on the left, then click Start.</p>';
    progressText.textContent = 'No image loaded yet.';
    updateControlsAvailability();
  }

  function isFullscreenActive() {
    return document.fullscreenElement === stageWrap || stageWrap.classList.contains('is-pseudo-fullscreen');
  }

  function sizeMedia(media, img) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    var maxWidth = stage.clientWidth || window.innerWidth;
    var maxHeight = isFullscreenActive()
      ? Math.max(200, stage.clientHeight - FS_BAR_RESERVED)
      : Math.max(320, window.innerHeight * 0.68);
    var scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    media.style.width = Math.round(img.naturalWidth * scale) + 'px';
    media.style.height = Math.round(img.naturalHeight * scale) + 'px';
  }

  function resizeCurrentMedia() {
    var media = stage.querySelector('.reveal-media');
    var img = media ? media.querySelector('img') : null;
    if (media && img) sizeMedia(media, img);
  }

  window.addEventListener('resize', resizeCurrentMedia);
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) stageWrap.classList.remove('is-pseudo-fullscreen');
    onFullscreenToggled();
  });

  function onFullscreenToggled() {
    document.body.classList.toggle('reveal-pseudo-fs', stageWrap.classList.contains('is-pseudo-fullscreen'));
    stageWrap.classList.remove('is-idle');
    window.clearTimeout(idleTimer);
    if (isFullscreenActive()) wakeFullscreenBar();
    resizeCurrentMedia();
  }

  function wakeFullscreenBar() {
    stageWrap.classList.remove('is-idle');
    window.clearTimeout(idleTimer);
    if (!isFullscreenActive()) return;
    idleTimer = window.setTimeout(function () { stageWrap.classList.add('is-idle'); }, IDLE_HIDE_MS);
  }

  ['mousemove', 'mousedown', 'touchstart'].forEach(function (name) {
    stageWrap.addEventListener(name, wakeFullscreenBar);
  });

  function buildOverlay(rows, cols) {
    var overlay = document.createElement('div');
    overlay.className = 'reveal-overlay';
    overlay.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    overlay.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
    for (var i = 0; i < rows * cols; i++) {
      var tile = document.createElement('div');
      tile.className = 'reveal-tile';
      tile.dataset.index = i;
      overlay.appendChild(tile);
    }
    return overlay;
  }

  function loadImage(index, autoStart) {
    var entry = state.images[index];
    if (!entry) return;
    stopTimer();

    var grid = clampGridInputs();
    state.currentIndex = index;
    state.tileTotal = grid.rows * grid.cols;
    state.revealedCount = 0;

    var order = [];
    for (var i = 0; i < state.tileTotal; i++) order.push(i);
    if (getRevealOrder() === 'random') shuffle(order);
    state.revealQueue = order;

    stage.innerHTML = '';
    var media = document.createElement('div');
    media.className = 'reveal-media';
    var img = document.createElement('img');
    img.alt = 'Picture to reveal';
    media.appendChild(img);
    media.appendChild(buildOverlay(grid.rows, grid.cols));
    stage.appendChild(media);
    img.addEventListener('load', function () { sizeMedia(media, img); });
    img.src = entry.url;

    updateProgressText();
    renderImageList();
    updateControlsAvailability();

    if (autoStart) startReveal();
  }

  function goToImage(index, autoStart) {
    if (index < 0 || index >= state.images.length) return;
    loadImage(index, autoStart);
  }

  function updateProgressText() {
    var imgLabel = state.currentIndex >= 0
      ? ('Image ' + (state.currentIndex + 1) + ' of ' + state.images.length)
      : 'No image loaded yet.';
    var tileLabel = state.tileTotal
      ? (state.revealedCount + ' / ' + state.tileTotal + ' tiles revealed')
      : '';
    progressText.textContent = tileLabel ? (imgLabel + ' · ' + tileLabel) : imgLabel;
  }

  function revealNextTile() {
    if (!state.revealQueue.length) {
      stopTimer();
      updateControlsAvailability();
      return;
    }
    var index = state.revealQueue.shift();
    var tile = stage.querySelector('.reveal-tile[data-index="' + index + '"]');
    if (tile) tile.classList.add('is-revealed');
    state.revealedCount++;
    updateProgressText();
    if (!state.revealQueue.length) {
      stopTimer();
      updateControlsAvailability();
    }
  }

  function startTimer() {
    var seconds = parseFloat(speedInput.value) || 1;
    state.timer = window.setInterval(revealNextTile, seconds * 1000);
  }

  function restartTimer() {
    if (state.timer) { window.clearInterval(state.timer); state.timer = null; }
    if (state.isRunning) startTimer();
  }

  function stopTimer() {
    if (state.timer) { window.clearInterval(state.timer); state.timer = null; }
    state.isRunning = false;
    updateControlsAvailability();
  }

  function startReveal() {
    if (state.currentIndex === -1 || !state.revealQueue.length) return;
    state.isRunning = true;
    revealNextTile();
    if (state.revealQueue.length) startTimer();
    updateControlsAvailability();
  }

  function pauseReveal() {
    stopTimer();
  }

  function revealAll() {
    if (state.currentIndex === -1) return;
    stopTimer();
    while (state.revealQueue.length) revealNextTile();
  }

  function restartCurrentImage() {
    if (state.currentIndex === -1) return;
    loadImage(state.currentIndex, false);
  }

  function updateControlsAvailability() {
    var hasImages = state.images.length > 0;
    var hasCurrent = state.currentIndex >= 0;
    var fullyRevealed = hasCurrent && state.revealQueue.length === 0;

    startButton.disabled = !hasCurrent || state.isRunning || fullyRevealed;
    pauseButton.disabled = !state.isRunning;
    revealAllButton.disabled = !hasCurrent || fullyRevealed;
    restartButton.disabled = !hasCurrent;
    fullscreenButton.disabled = !hasImages;
    prevButton.disabled = !hasCurrent || state.currentIndex === 0;
    nextButton.disabled = !hasCurrent || state.currentIndex >= state.images.length - 1;

    startButton.textContent = fullyRevealed ? '✓' : startLabel;

    fsToggleButton.textContent = state.isRunning ? pauseLabel : startLabel;
    fsToggleButton.disabled = !hasCurrent || (fullyRevealed && !state.isRunning);
    fsBar.querySelector('[data-fs-action="prev"]').disabled = prevButton.disabled;
    fsBar.querySelector('[data-fs-action="next"]').disabled = nextButton.disabled;
    fsBar.querySelector('[data-fs-action="reveal-all"]').disabled = revealAllButton.disabled;
    fsBar.querySelector('[data-fs-action="restart"]').disabled = restartButton.disabled;
  }

  startButton.addEventListener('click', startReveal);
  pauseButton.addEventListener('click', pauseReveal);
  revealAllButton.addEventListener('click', revealAll);
  restartButton.addEventListener('click', restartCurrentImage);

  prevButton.addEventListener('click', function () {
    goToImage(state.currentIndex - 1, false);
  });
  nextButton.addEventListener('click', function () {
    goToImage(state.currentIndex + 1, true);
  });

  function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    stageWrap.classList.remove('is-pseudo-fullscreen');
    onFullscreenToggled();
  }

  function enterFullscreen() {
    var fallback = function () {
      stageWrap.classList.add('is-pseudo-fullscreen');
      onFullscreenToggled();
    };
    if (!stageWrap.requestFullscreen) { fallback(); return; }
    try {
      var result = stageWrap.requestFullscreen();
      if (result && result.catch) result.then(onFullscreenToggled).catch(fallback);
      else onFullscreenToggled();
    } catch (err) {
      fallback();
    }
  }

  fullscreenButton.addEventListener('click', function () {
    if (isFullscreenActive()) exitFullscreen(); else enterFullscreen();
  });

  var fsActions = {
    prev: function () { prevButton.click(); },
    toggle: function () { if (state.isRunning) pauseReveal(); else startReveal(); },
    'reveal-all': revealAll,
    restart: restartCurrentImage,
    next: function () { nextButton.click(); },
    exit: exitFullscreen
  };
  fsBar.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-fs-action]');
    if (!btn || btn.disabled) return;
    fsActions[btn.dataset.fsAction]();
    wakeFullscreenBar();
  });

  document.addEventListener('keydown', function (event) {
    if (isFullscreenActive()) wakeFullscreenBar();
    if (event.code === 'Escape' && stageWrap.classList.contains('is-pseudo-fullscreen')) exitFullscreen();
  });

  document.addEventListener('keydown', function (event) {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (state.isRunning) pauseReveal(); else startReveal();
    } else if (event.code === 'ArrowRight') {
      if (!nextButton.disabled) nextButton.click();
    } else if (event.code === 'ArrowLeft') {
      if (!prevButton.disabled) prevButton.click();
    }
  });

  updatePresetHighlight();
  updateControlsAvailability();
})();
