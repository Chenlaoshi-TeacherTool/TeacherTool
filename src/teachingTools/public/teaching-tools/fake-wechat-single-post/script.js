(function () {
  'use strict';

  var STORAGE_KEY = 'chenlaoshi-fake-wechat-single-post-v1';
  var MAX_IMAGE_SIZE = 900;
  var JPEG_QUALITY = 0.82;

  var samplePost = {
    profileName: 'Mulan',
    avatar: '',
    text: 'Today I made a difficult choice for my family. What would courage look like if no one knew the whole story?',
    photos: [''],
    timestamp: 'Today 08:30',
    location: 'Northern Wei camp',
    likes: ['Father', 'Little Brother', 'Class Historian'],
    comments: [
      { user: 'Class Historian', text: 'Use one quote or detail from the story as evidence.' },
      { user: 'Friend', text: 'This shows loyalty and bravery.' }
    ]
  };

  var state = null;
  var photoTargetIndex = 0;
  var toastTimer = null;
  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    state = loadSaved() || cloneSample();
    render();
    bindEvents();
  }

  function cacheEls() {
    els.saveStatus = document.getElementById('saveStatus');
    els.addPhotoButton = document.getElementById('addPhotoButton');
    els.addCommentButton = document.getElementById('addCommentButton');
    els.saveButton = document.getElementById('saveButton');
    els.loadButton = document.getElementById('loadButton');
    els.avatarButton = document.getElementById('avatarButton');
    els.avatarInitial = document.getElementById('avatarInitial');
    els.avatarInput = document.getElementById('avatarInput');
    els.profileName = document.getElementById('profileName');
    els.postText = document.getElementById('postText');
    els.photoGrid = document.getElementById('photoGrid');
    els.photoInput = document.getElementById('photoInput');
    els.timestamp = document.getElementById('timestamp');
    els.location = document.getElementById('location');
    els.likesButton = document.getElementById('likesButton');
    els.commentsList = document.getElementById('commentsList');
    els.toast = document.getElementById('toast');
  }

  function cloneSample() {
    return JSON.parse(JSON.stringify(samplePost));
  }

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function normalize(data) {
    data = data && typeof data === 'object' ? data : {};
    return {
      profileName: data.profileName || samplePost.profileName,
      avatar: data.avatar || '',
      text: data.text || '',
      photos: Array.isArray(data.photos) ? data.photos.slice(0, 9) : [''],
      timestamp: data.timestamp || 'Today',
      location: data.location || '',
      likes: Array.isArray(data.likes) ? data.likes.filter(Boolean) : [],
      comments: Array.isArray(data.comments) ? data.comments.map(normalizeComment).filter(Boolean) : []
    };
  }

  function normalizeComment(comment) {
    if (!comment || typeof comment !== 'object') return null;
    return {
      user: comment.user || 'Friend',
      text: comment.text || ''
    };
  }

  function render() {
    els.profileName.textContent = state.profileName;
    els.postText.textContent = state.text;
    els.timestamp.textContent = state.timestamp;
    els.location.textContent = state.location;
    renderAvatar();
    renderPhotos();
    renderLikes();
    renderComments();
  }

  function renderAvatar() {
    els.avatarButton.style.backgroundImage = state.avatar ? 'url(' + state.avatar + ')' : '';
    els.avatarButton.classList.toggle('has-image', Boolean(state.avatar));
    els.avatarInitial.textContent = (state.profileName || 'M').trim().charAt(0).toUpperCase() || 'M';
  }

  function renderPhotos() {
    els.photoGrid.innerHTML = '';
    els.photoGrid.className = 'photo-grid count-' + state.photos.length;
    state.photos.forEach(function (src, index) {
      var button = document.createElement('button');
      button.className = 'photo-slot' + (src ? '' : ' empty');
      button.type = 'button';
      button.setAttribute('aria-label', src ? 'Replace photo ' + (index + 1) : 'Upload photo ' + (index + 1));
      button.addEventListener('click', function () {
        photoTargetIndex = index;
        els.photoInput.click();
      });
      if (src) {
        var image = document.createElement('img');
        image.src = src;
        image.alt = '';
        button.appendChild(image);
      } else {
        button.textContent = '+';
      }
      els.photoGrid.appendChild(button);
    });
  }

  function renderLikes() {
    els.likesButton.textContent = state.likes.length ? '♡ ' + state.likes.join(', ') : '♡ Tap to add likes';
  }

  function renderComments() {
    els.commentsList.innerHTML = '';
    if (!state.comments.length) {
      var empty = document.createElement('div');
      empty.className = 'comment-empty';
      empty.textContent = 'No comments yet. Click Add Comment.';
      els.commentsList.appendChild(empty);
      return;
    }
    state.comments.forEach(function (comment, index) {
      var row = document.createElement('div');
      row.className = 'comment';
      row.dataset.index = String(index);
      var user = editable('span', 'comment-user', comment.user, function (value) {
        comment.user = value || 'Friend';
      });
      var text = editable('span', 'comment-text', comment.text, function (value) {
        comment.text = value;
      });
      row.appendChild(user);
      row.appendChild(text);
      els.commentsList.appendChild(row);
    });
  }

  function editable(tag, className, text, onInput) {
    var node = document.createElement(tag);
    node.className = className;
    node.contentEditable = 'true';
    node.spellcheck = true;
    node.textContent = text || '';
    node.addEventListener('input', function () {
      onInput(node.textContent.trim());
      markUnsaved();
    });
    return node;
  }

  function bindEvents() {
    bindText(els.profileName, function (value) {
      state.profileName = value || 'Character Name';
      renderAvatar();
    });
    bindText(els.postText, function (value) { state.text = value; });
    bindText(els.timestamp, function (value) { state.timestamp = value || 'Today'; });
    bindText(els.location, function (value) { state.location = value; });

    els.avatarButton.addEventListener('click', function () {
      els.avatarInput.click();
    });
    els.avatarInput.addEventListener('change', function () {
      setUploadedImage(els.avatarInput, function (dataUrl) {
        state.avatar = dataUrl;
        renderAvatar();
        markUnsaved();
      });
    });

    els.photoInput.addEventListener('change', function () {
      setUploadedImage(els.photoInput, function (dataUrl) {
        state.photos[photoTargetIndex] = dataUrl;
        renderPhotos();
        markUnsaved();
      });
    });

    els.addPhotoButton.addEventListener('click', function () {
      if (state.photos.length >= 9) {
        showToast('Maximum 9 photos');
        return;
      }
      state.photos.push('');
      renderPhotos();
      markUnsaved();
    });

    els.likesButton.addEventListener('click', function () {
      var next = window.prompt('Like names, separated by commas:', state.likes.join(', '));
      if (next === null) return;
      state.likes = splitNames(next);
      renderLikes();
      markUnsaved();
    });

    els.addCommentButton.addEventListener('click', function () {
      state.comments.push({ user: 'Friend', text: 'New comment' });
      renderComments();
      markUnsaved();
    });

    els.commentsList.addEventListener('dblclick', function () {
      var current = state.comments.map(function (comment) {
        return comment.user + ': ' + comment.text;
      }).join('\n');
      var next = window.prompt('Edit all comments, one per line as Username: Comment', current);
      if (next === null) return;
      state.comments = parseComments(next);
      renderComments();
      markUnsaved();
    });

    els.saveButton.addEventListener('click', save);
    els.loadButton.addEventListener('click', function () {
      var saved = loadSaved();
      if (!saved) {
        showToast('No saved post found');
        return;
      }
      state = saved;
      render();
      showToast('Loaded saved post');
      els.saveStatus.textContent = 'Loaded from this device';
    });
  }

  function bindText(node, update) {
    node.addEventListener('input', function () {
      update(node.textContent.trim());
      markUnsaved();
    });
  }

  function splitNames(value) {
    return (value || '').split(',').map(function (name) {
      return name.trim();
    }).filter(Boolean);
  }

  function parseComments(value) {
    return (value || '').split(/\r?\n/).map(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return null;
      var colon = trimmed.indexOf(':');
      if (colon === -1) return { user: 'Friend', text: trimmed };
      return {
        user: trimmed.slice(0, colon).trim() || 'Friend',
        text: trimmed.slice(colon + 1).trim()
      };
    }).filter(Boolean);
  }

  function markUnsaved() {
    els.saveStatus.textContent = 'Unsaved changes';
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveStatus.textContent = 'Saved on this device at ' + new Date().toLocaleTimeString();
      showToast('Saved');
    } catch (error) {
      els.saveStatus.textContent = 'Could not save. Remove a large image and try again.';
      showToast('Storage is full. Remove a large image and try again.');
    }
  }

  function setUploadedImage(input, callback) {
    var file = input.files && input.files[0];
    if (!file) return;
    compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
      if (dataUrl) callback(dataUrl);
      input.value = '';
    });
  }

  function compressImage(file, maxSize, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        var scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        var width = Math.max(1, Math.round(image.width * scale));
        var height = Math.max(1, Math.round(image.height * scale));
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        try {
          callback(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (error) {
          callback('');
          showToast('Could not read that image.');
        }
      };
      image.onerror = function () {
        callback('');
        showToast('Could not read that image.');
      };
      image.src = reader.result;
    };
    reader.onerror = function () {
      callback('');
      showToast('Could not read that image.');
    };
    reader.readAsDataURL(file);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('visible');
    }, 2200);
  }
})();
