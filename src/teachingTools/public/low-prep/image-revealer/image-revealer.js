(function () {
  'use strict';

  var imageInput = document.getElementById('image-input');
  var imageListEl = document.getElementById('image-list');
  var setupStatus = document.getElementById('setup-status');

  var rowsInput = document.getElementById('grid-rows');
  var colsInput = document.getElementById('grid-cols');
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll('.reveal-preset'));
  var speedInput = document.getElementById('reveal-speed');
  var speedValue = document.getElementById('speed-value');

  var stage = document.getElementById('reveal-stage');
  var progressText = document.getElementById('progress-text');

  var startButton = document.getElementById('start-button');
  var pauseButton = document.getElementById('pause-button');
  var revealAllButton = document.getElementById('reveal-all-button');
  var restartButton = document.getElementById('restart-button');
  var fullscreenButton = document.getElementById('fullscreen-button');
  var prevButton = document.getElementById('prev-button');
  var nextButton = document.getElementById('next-button');

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
    renderImageList();
    if (state.currentIndex === -1 && state.images.length) {
      goToImage(0, false);
    }
    updateSetupStatus();
  });

  function renderImageList() {
    imageListEl.innerHTML = '';
    state.images.forEach(function (img, index) {
      var li = document.createElement('li');
      li.className = 'reveal-image-list-item' + (index === state.currentIndex ? ' is-current' : '');

      var thumb = document.createElement('img');
      thumb.src = img.url;
      thumb.alt = 'Uploaded image ' + (index + 1);
      thumb.addEventListener('click', function () { goToImage(index, false); });
      li.appendChild(thumb);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'reveal-image-list-remove';
      removeBtn.setAttribute('aria-label', 'Remove this image');
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
      setupStatus.textContent = state.images.length + ' image' + (state.images.length === 1 ? '' : 's') + ' ready.';
    }
  }

  function renderStageEmpty() {
    stage.innerHTML = '<p class="reveal-stage-empty">Upload images on the left, then click Start.</p>';
    progressText.textContent = 'No image loaded yet.';
    updateControlsAvailability();
  }

  function sizeMedia(media, img) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    var isFull = document.fullscreenElement === stage || stage.classList.contains('is-pseudo-fullscreen');
    var maxWidth = stage.clientWidth || window.innerWidth;
    var maxHeight = isFull ? window.innerHeight : Math.max(320, window.innerHeight * 0.68);
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
    if (!document.fullscreenElement) stage.classList.remove('is-pseudo-fullscreen');
    resizeCurrentMedia();
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

    startButton.textContent = fullyRevealed ? '✓ Fully revealed' : '▶ Start';
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

  fullscreenButton.addEventListener('click', function () {
    var isActive = document.fullscreenElement === stage || stage.classList.contains('is-pseudo-fullscreen');
    if (isActive) {
      if (document.fullscreenElement) document.exitFullscreen();
      stage.classList.remove('is-pseudo-fullscreen');
      resizeCurrentMedia();
      return;
    }
    var fallback = function () {
      stage.classList.add('is-pseudo-fullscreen');
      resizeCurrentMedia();
    };
    if (stage.requestFullscreen) {
      try {
        var result = stage.requestFullscreen();
        if (result && result.catch) {
          result.then(resizeCurrentMedia).catch(fallback);
          return;
        }
        resizeCurrentMedia();
        return;
      } catch (err) {
        fallback();
        return;
      }
    }
    fallback();
  });

  document.addEventListener('keydown', function (event) {
    if (event.code === 'Escape' && stage.classList.contains('is-pseudo-fullscreen')) {
      stage.classList.remove('is-pseudo-fullscreen');
      resizeCurrentMedia();
    }
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
