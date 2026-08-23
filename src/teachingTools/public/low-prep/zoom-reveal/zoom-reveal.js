(function () {
  'use strict';

  var imageInput = document.getElementById('image-input');
  var imageListEl = document.getElementById('image-list');
  var setupStatus = document.getElementById('setup-status');

  var maxZoomInput = document.getElementById('max-zoom');
  var maxZoomValue = document.getElementById('max-zoom-value');
  var durationInput = document.getElementById('zoom-duration');
  var durationValue = document.getElementById('duration-value');

  var stage = document.getElementById('reveal-stage');
  var progressText = document.getElementById('progress-text');
  var zoomSlider = document.getElementById('zoom-slider');

  var startButton = document.getElementById('start-button');
  var playButton = document.getElementById('play-button');
  var revealAllButton = document.getElementById('reveal-all-button');
  var restartButton = document.getElementById('restart-button');
  var fullscreenButton = document.getElementById('fullscreen-button');
  var prevButton = document.getElementById('prev-button');
  var nextButton = document.getElementById('next-button');

  var state = {
    images: [],       // { file, url }
    currentIndex: -1,
    naturalW: 0,
    naturalH: 0,
    frameW: 0,
    frameH: 0,
    focusX: 0.5,      // fraction of frame width
    focusY: 0.5,      // fraction of frame height
    zoom: 1,
    maxZoom: 8,
    isPlaying: false,
    rafId: null,
    playStart: 0,
    playFromZoom: 1
  };

  maxZoomInput.addEventListener('input', function () {
    maxZoomValue.textContent = parseFloat(maxZoomInput.value).toFixed(1);
    state.maxZoom = parseFloat(maxZoomInput.value);
    zoomSlider.max = state.maxZoom;
  });

  durationInput.addEventListener('input', function () {
    durationValue.textContent = durationInput.value;
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
      goToImage(0);
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
      thumb.addEventListener('click', function () { goToImage(index); });
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
      stopPlayback();
      renderStageEmpty();
    } else if (index === state.currentIndex) {
      var nextIndex = Math.min(index, state.images.length - 1);
      goToImage(nextIndex);
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
    stage.innerHTML = '<p class="reveal-stage-empty">Upload images on the left, then click Zoom In.</p>';
    progressText.textContent = 'No image loaded yet.';
    zoomSlider.disabled = true;
    updateControlsAvailability();
  }

  function frameSize() {
    var isFull = document.fullscreenElement === stage || stage.classList.contains('is-pseudo-fullscreen');
    var maxWidth = stage.clientWidth || window.innerWidth;
    var maxHeight = isFull ? window.innerHeight : Math.max(320, window.innerHeight * 0.68);
    var scale = Math.min(maxWidth / state.naturalW, maxHeight / state.naturalH);
    return {
      width: Math.round(state.naturalW * scale),
      height: Math.round(state.naturalH * scale)
    };
  }

  function currentMedia() {
    return stage.querySelector('.reveal-media');
  }

  function currentImgEl() {
    var media = currentMedia();
    return media ? media.querySelector('img') : null;
  }

  function currentMarker() {
    var media = currentMedia();
    return media ? media.querySelector('.reveal-focus-marker') : null;
  }

  function applyTransform() {
    var img = currentImgEl();
    var media = currentMedia();
    if (!img || !media) return;
    var W = state.frameW, H = state.frameH, Z = state.zoom;
    var fx = state.focusX * W;
    var fy = state.focusY * H;
    var tx = W / 2 - Z * fx;
    var ty = H / 2 - Z * fy;
    var minTx = W * (1 - Z), maxTx = 0;
    var minTy = H * (1 - Z), maxTy = 0;
    tx = Math.min(maxTx, Math.max(minTx, tx));
    ty = Math.min(maxTy, Math.max(minTy, ty));
    img.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + Z + ')';

    var marker = currentMarker();
    if (marker) {
      marker.style.left = (Z * fx + tx) + 'px';
      marker.style.top = (Z * fy + ty) + 'px';
      marker.classList.toggle('is-hidden', Z > 1.15 || state.isPlaying);
    }

    zoomSlider.value = Z;
    updateProgressText();
  }

  function resizeCurrentMedia() {
    var media = currentMedia();
    var img = currentImgEl();
    if (!media || !img || !state.naturalW) return;
    var size = frameSize();
    state.frameW = size.width;
    state.frameH = size.height;
    media.style.width = size.width + 'px';
    media.style.height = size.height + 'px';
    img.style.width = size.width + 'px';
    img.style.height = size.height + 'px';
    applyTransform();
  }

  window.addEventListener('resize', resizeCurrentMedia);
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) stage.classList.remove('is-pseudo-fullscreen');
    resizeCurrentMedia();
  });

  function pointFromEvent(event, media) {
    var rect = media.getBoundingClientRect();
    var clickX = event.clientX - rect.left;
    var clickY = event.clientY - rect.top;
    var Z = state.zoom, W = state.frameW, H = state.frameH;
    var fx = state.focusX * W;
    var fy = state.focusY * H;
    var tx = Math.min(0, Math.max(W * (1 - Z), W / 2 - Z * fx));
    var ty = Math.min(0, Math.max(H * (1 - Z), H / 2 - Z * fy));
    var baseX = (clickX - tx) / Z;
    var baseY = (clickY - ty) / Z;
    return {
      x: Math.min(1, Math.max(0, baseX / W)),
      y: Math.min(1, Math.max(0, baseY / H))
    };
  }

  function loadImage(index) {
    var entry = state.images[index];
    if (!entry) return;
    stopPlayback();

    state.currentIndex = index;
    state.focusX = 0.5;
    state.focusY = 0.5;
    state.zoom = 1;

    stage.innerHTML = '';
    var media = document.createElement('div');
    media.className = 'reveal-media';
    var img = document.createElement('img');
    img.alt = 'Picture to reveal';
    var marker = document.createElement('div');
    marker.className = 'reveal-focus-marker is-hidden';
    media.appendChild(img);
    media.appendChild(marker);
    stage.appendChild(media);

    var drag = { active: false, moved: false, lastX: 0, lastY: 0 };

    media.addEventListener('pointerdown', function (event) {
      if (state.currentIndex === -1 || state.isPlaying) return;
      drag.active = true;
      drag.moved = false;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      media.setPointerCapture(event.pointerId);
      media.classList.add('is-dragging');
    });

    media.addEventListener('pointermove', function (event) {
      if (!drag.active) return;
      var dx = event.clientX - drag.lastX;
      var dy = event.clientY - drag.lastY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      var Z = state.zoom, W = state.frameW, H = state.frameH;
      if (Z > 1.001 && W && H) {
        state.focusX = Math.min(1, Math.max(0, state.focusX - dx / (Z * W)));
        state.focusY = Math.min(1, Math.max(0, state.focusY - dy / (Z * H)));
        applyTransform();
      }
    });

    function endDrag(event) {
      if (!drag.active) return;
      drag.active = false;
      media.classList.remove('is-dragging');
      if (!drag.moved && state.currentIndex !== -1) {
        var point = pointFromEvent(event, media);
        state.focusX = point.x;
        state.focusY = point.y;
        var m = currentMarker();
        if (m) m.classList.remove('is-hidden');
        applyTransform();
      }
    }

    media.addEventListener('pointerup', endDrag);
    media.addEventListener('pointercancel', endDrag);

    img.addEventListener('load', function () {
      state.naturalW = img.naturalWidth;
      state.naturalH = img.naturalHeight;
      resizeCurrentMedia();
      var m = currentMarker();
      if (m) m.classList.remove('is-hidden');
      zoomSlider.disabled = false;
      zoomSlider.max = state.maxZoom;
      zoomSlider.value = 1;
      updateControlsAvailability();
    });
    img.src = entry.url;

    updateProgressText();
    renderImageList();
    updateControlsAvailability();
  }

  function goToImage(index) {
    if (index < 0 || index >= state.images.length) return;
    loadImage(index);
  }

  function updateProgressText() {
    var imgLabel = state.currentIndex >= 0
      ? ('Image ' + (state.currentIndex + 1) + ' of ' + state.images.length)
      : 'No image loaded yet.';
    var zoomLabel = state.currentIndex >= 0 ? ('Zoom: ' + state.zoom.toFixed(1) + '×') : '';
    progressText.textContent = zoomLabel ? (imgLabel + ' · ' + zoomLabel) : imgLabel;
  }

  function setZoom(z) {
    state.zoom = Math.min(state.maxZoom, Math.max(1, z));
    applyTransform();
    updateControlsAvailability();
  }

  zoomSlider.addEventListener('input', function () {
    stopPlayback();
    setZoom(parseFloat(zoomSlider.value));
  });

  function zoomIn() {
    if (state.currentIndex === -1) return;
    stopPlayback();
    setZoom(state.maxZoom);
  }

  function revealFull() {
    if (state.currentIndex === -1) return;
    stopPlayback();
    setZoom(1);
  }

  function restart() {
    if (state.currentIndex === -1) return;
    stopPlayback();
    setZoom(state.maxZoom);
  }

  function stopPlayback() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.isPlaying) {
      state.isPlaying = false;
      var marker = currentMarker();
      if (marker && state.zoom <= 1.15) marker.classList.remove('is-hidden');
    }
    updateControlsAvailability();
  }

  function tickPlayback(timestamp) {
    if (!state.isPlaying) return;
    var durationMs = (parseFloat(durationInput.value) || 20) * 1000;
    var elapsed = timestamp - state.playStart;
    var progress = Math.min(1, elapsed / durationMs);
    var z = state.playFromZoom - (state.playFromZoom - 1) * progress;
    setZoom(z);
    if (progress >= 1) {
      stopPlayback();
      return;
    }
    state.rafId = window.requestAnimationFrame(tickPlayback);
  }

  function togglePlay() {
    if (state.currentIndex === -1) return;
    if (state.isPlaying) {
      stopPlayback();
      return;
    }
    if (state.zoom <= 1.001) return;
    state.isPlaying = true;
    state.playFromZoom = state.zoom;
    state.playStart = null;
    updateControlsAvailability();
    state.rafId = window.requestAnimationFrame(function (ts) {
      state.playStart = ts;
      tickPlayback(ts);
    });
  }

  function updateControlsAvailability() {
    var hasImages = state.images.length > 0;
    var hasCurrent = state.currentIndex >= 0;
    var isFull = hasCurrent && state.zoom <= 1.001;

    startButton.disabled = !hasCurrent;
    playButton.disabled = !hasCurrent || isFull;
    revealAllButton.disabled = !hasCurrent || isFull;
    restartButton.disabled = !hasCurrent;
    fullscreenButton.disabled = !hasImages;
    prevButton.disabled = !hasCurrent || state.currentIndex === 0;
    nextButton.disabled = !hasCurrent || state.currentIndex >= state.images.length - 1;

    playButton.textContent = state.isPlaying ? '⏸ Pause' : '▶ Auto Zoom Out';
    startButton.textContent = (hasCurrent && state.zoom >= state.maxZoom - 0.01) ? '🔍 Zoomed In' : '🔍 Zoom In';
  }

  startButton.addEventListener('click', zoomIn);
  playButton.addEventListener('click', togglePlay);
  revealAllButton.addEventListener('click', revealFull);
  restartButton.addEventListener('click', restart);

  prevButton.addEventListener('click', function () {
    goToImage(state.currentIndex - 1);
  });
  nextButton.addEventListener('click', function () {
    goToImage(state.currentIndex + 1);
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
      togglePlay();
    } else if (event.code === 'ArrowRight') {
      if (!nextButton.disabled) nextButton.click();
    } else if (event.code === 'ArrowLeft') {
      if (!prevButton.disabled) prevButton.click();
    }
  });

  updateControlsAvailability();
})();
