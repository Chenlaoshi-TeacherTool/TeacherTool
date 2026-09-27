(function () {
  'use strict';

  var STORAGE_KEY = 'chenlaoshi-fake-wechat-moments-v1';
  var MAX_IMAGE_SIZE = 900;
  var JPEG_QUALITY = 0.82;

  var sampleState = {
    darkMode: false,
    profileName: 'Qu Yuan',
    avatar: '',
    cover: '',
    posts: [
      {
        id: 'sample-1',
        name: 'Qu Yuan',
        timestamp: 'Miluo River · fifth day of the fifth month',
        text: 'I wrote another poem today. My country is in danger, but my loyalty has not changed. What should a person do when no one listens?',
        images: [],
        likes: ['Student Historian', 'Li Bai', 'Du Fu'],
        comments: [
          { user: 'Student Historian', text: 'Use evidence from the poem to explain your feelings.' },
          { user: 'Li Bai', text: 'Your words will travel farther than you think.' }
        ]
      },
      {
        id: 'sample-2',
        name: 'Qu Yuan',
        timestamp: 'Before exile',
        text: 'Court meeting was difficult. I warned the king again, but other officials laughed. I need stronger evidence and a clearer argument.',
        images: [],
        likes: ['King Huai', 'Lantern Riddle Club'],
        comments: [
          { user: 'Classmate', text: 'This sounds like conflict between loyalty and power.' }
        ]
      }
    ]
  };

  var state = null;
  var pendingImages = [];
  var replaceTarget = null;
  var toastTimer = null;
  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    state = loadState();
    renderAll();
    bindEvents();
  }

  function cacheEls() {
    els.body = document.body;
    els.saveStatus = document.getElementById('saveStatus');
    els.themeToggle = document.getElementById('themeToggle');
    els.resetButton = document.getElementById('resetButton');
    els.addMomentButton = document.getElementById('addMomentButton');
    els.coverButton = document.getElementById('coverButton');
    els.coverInput = document.getElementById('coverInput');
    els.avatarButton = document.getElementById('avatarButton');
    els.avatarInitial = document.getElementById('avatarInitial');
    els.avatarInput = document.getElementById('avatarInput');
    els.profileName = document.getElementById('profileName');
    els.feed = document.getElementById('feed');
    els.modal = document.getElementById('momentModal');
    els.form = document.getElementById('momentForm');
    els.postTextInput = document.getElementById('postTextInput');
    els.postImagesInput = document.getElementById('postImagesInput');
    els.imagePreview = document.getElementById('imagePreview');
    els.timestampInput = document.getElementById('timestampInput');
    els.likesInput = document.getElementById('likesInput');
    els.commentsInput = document.getElementById('commentsInput');
    els.replaceImageInput = document.getElementById('replaceImageInput');
    els.toast = document.getElementById('toast');
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : cloneSample();
    } catch (error) {
      return cloneSample();
    }
  }

  function cloneSample() {
    return JSON.parse(JSON.stringify(sampleState));
  }

  function normalizeState(data) {
    data = data && typeof data === 'object' ? data : {};
    return {
      darkMode: Boolean(data.darkMode),
      profileName: data.profileName || sampleState.profileName,
      avatar: data.avatar || '',
      cover: data.cover || '',
      posts: Array.isArray(data.posts) ? data.posts.map(normalizePost) : cloneSample().posts
    };
  }

  function normalizePost(post) {
    post = post && typeof post === 'object' ? post : {};
    return {
      id: post.id || uid(),
      name: post.name || stateName(),
      timestamp: post.timestamp || 'Today',
      text: post.text || '',
      images: Array.isArray(post.images) ? post.images.slice(0, 9) : [],
      likes: Array.isArray(post.likes) ? post.likes.filter(Boolean) : [],
      comments: Array.isArray(post.comments) ? post.comments.map(normalizeComment).filter(Boolean) : []
    };
  }

  function normalizeComment(comment) {
    if (!comment || typeof comment !== 'object') return null;
    return {
      user: comment.user || 'Friend',
      text: comment.text || ''
    };
  }

  function uid() {
    return 'moment-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function stateName() {
    return state && state.profileName ? state.profileName : sampleState.profileName;
  }

  function renderAll() {
    renderTheme();
    renderHeader();
    renderFeed();
  }

  function renderTheme() {
    els.body.classList.toggle('dark', state.darkMode);
    els.themeToggle.textContent = state.darkMode ? 'Light mode' : 'Dark mode';
    els.themeToggle.setAttribute('aria-pressed', state.darkMode ? 'true' : 'false');
  }

  function renderHeader() {
    els.profileName.textContent = state.profileName;
    renderImageButton(els.coverButton, state.cover);
    renderImageButton(els.avatarButton, state.avatar);
    els.avatarInitial.textContent = (state.profileName || 'Q').trim().charAt(0).toUpperCase() || 'Q';
  }

  function renderImageButton(button, image) {
    button.style.backgroundImage = image ? 'url(' + image + ')' : '';
    button.classList.toggle('has-image', Boolean(image));
  }

  function renderFeed() {
    els.feed.innerHTML = '';
    if (!state.posts.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-feed';
      empty.textContent = 'No Moments yet. Add a new post to begin.';
      els.feed.appendChild(empty);
      return;
    }
    state.posts.forEach(function (post) {
      els.feed.appendChild(renderPost(post));
    });
  }

  function renderPost(post) {
    var article = document.createElement('article');
    article.className = 'moment';
    article.dataset.id = post.id;

    var avatar = document.createElement('div');
    avatar.className = 'post-avatar';
    avatar.style.backgroundImage = state.avatar ? 'url(' + state.avatar + ')' : '';
    avatar.textContent = state.avatar ? '' : (post.name || stateName()).charAt(0).toUpperCase();
    article.appendChild(avatar);

    var main = document.createElement('div');
    main.className = 'post-main';
    article.appendChild(main);

    main.appendChild(editable('div', 'username', post.name, function (value) {
      post.name = value || stateName();
      save(false);
    }));
    main.appendChild(editable('div', 'post-text', post.text, function (value) {
      post.text = value;
      save(false);
    }));

    if (post.images.length) main.appendChild(renderPhotoGrid(post));

    main.appendChild(editable('div', 'timestamp', post.timestamp, function (value) {
      post.timestamp = value || 'Today';
      save(false);
    }));
    main.appendChild(renderInteraction(post));
    return article;
  }

  function editable(tagName, className, text, onInput) {
    var node = document.createElement(tagName);
    node.className = className;
    node.contentEditable = 'true';
    node.spellcheck = true;
    node.textContent = text || '';
    node.addEventListener('input', function () {
      onInput(node.textContent.trim());
    });
    return node;
  }

  function renderPhotoGrid(post) {
    var grid = document.createElement('div');
    grid.className = 'photo-grid count-' + post.images.length;
    post.images.forEach(function (src, index) {
      var button = document.createElement('button');
      button.className = 'post-photo';
      button.type = 'button';
      button.setAttribute('aria-label', 'Replace post image ' + (index + 1));
      button.addEventListener('click', function () {
        replaceTarget = { postId: post.id, index: index };
        els.replaceImageInput.click();
      });
      var image = document.createElement('img');
      image.src = src;
      image.alt = '';
      button.appendChild(image);
      grid.appendChild(button);
    });
    return grid;
  }

  function renderInteraction(post) {
    var wrap = document.createElement('div');
    wrap.className = 'interaction';

    var likes = document.createElement('div');
    likes.className = 'likes';
    likes.textContent = post.likes.length ? '♡ ' + post.likes.join(', ') : '♡ Tap to add likes';
    likes.addEventListener('click', function () {
      var next = window.prompt('Like names, separated by commas:', post.likes.join(', '));
      if (next === null) return;
      post.likes = splitNames(next);
      save(true);
      renderFeed();
    });
    wrap.appendChild(likes);

    var comments = document.createElement('div');
    comments.className = 'comments';
    comments.title = 'Click to edit comments';
    comments.addEventListener('click', function () {
      var current = post.comments.map(function (comment) {
        return comment.user + ': ' + comment.text;
      }).join('\n');
      var next = window.prompt('Comments, one per line as Username: Comment', current);
      if (next === null) return;
      post.comments = parseComments(next);
      save(true);
      renderFeed();
    });
    if (post.comments.length) {
      post.comments.forEach(function (comment) {
        var row = document.createElement('div');
        row.className = 'comment';
        var user = document.createElement('span');
        user.className = 'comment-user';
        user.textContent = comment.user + ': ';
        row.appendChild(user);
        row.append(document.createTextNode(comment.text));
        comments.appendChild(row);
      });
    } else {
      comments.textContent = 'Tap to add comments';
    }
    wrap.appendChild(comments);
    return wrap;
  }

  function bindEvents() {
    els.themeToggle.addEventListener('click', function () {
      state.darkMode = !state.darkMode;
      renderTheme();
      save(true);
    });

    els.resetButton.addEventListener('click', function () {
      state = cloneSample();
      save(true);
      renderAll();
    });

    els.profileName.addEventListener('input', function () {
      state.profileName = els.profileName.textContent.trim() || 'Character Name';
      els.avatarInitial.textContent = (state.profileName || 'Q').trim().charAt(0).toUpperCase() || 'Q';
      save(false);
    });

    els.coverButton.addEventListener('click', function () {
      els.coverInput.click();
    });
    els.avatarButton.addEventListener('click', function () {
      els.avatarInput.click();
    });
    els.coverInput.addEventListener('change', function () {
      setUploadedImage(els.coverInput, function (dataUrl) {
        state.cover = dataUrl;
        renderHeader();
        save(true);
      });
    });
    els.avatarInput.addEventListener('change', function () {
      setUploadedImage(els.avatarInput, function (dataUrl) {
        state.avatar = dataUrl;
        renderHeader();
        renderFeed();
        save(true);
      });
    });

    els.addMomentButton.addEventListener('click', openModal);
    document.querySelectorAll('[data-close-modal]').forEach(function (node) {
      node.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !els.modal.hidden) closeModal();
    });
    els.postImagesInput.addEventListener('change', readPendingImages);
    els.form.addEventListener('submit', addMomentFromForm);
    els.replaceImageInput.addEventListener('change', replacePostImage);
  }

  function setUploadedImage(input, callback) {
    var file = input.files && input.files[0];
    if (!file) return;
    compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
      callback(dataUrl);
      input.value = '';
    });
  }

  function openModal() {
    pendingImages = [];
    els.form.reset();
    els.timestampInput.value = new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    renderPendingImages();
    els.modal.hidden = false;
    els.postTextInput.focus();
  }

  function closeModal() {
    els.modal.hidden = true;
    pendingImages = [];
    renderPendingImages();
  }

  function readPendingImages() {
    var files = Array.prototype.slice.call(els.postImagesInput.files || []).slice(0, 9);
    pendingImages = [];
    if (!files.length) {
      renderPendingImages();
      return;
    }
    var remaining = files.length;
    files.forEach(function (file) {
      compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
        if (dataUrl) pendingImages.push(dataUrl);
        remaining -= 1;
        if (!remaining) renderPendingImages();
      });
    });
  }

  function renderPendingImages() {
    els.imagePreview.innerHTML = '';
    els.imagePreview.hidden = !pendingImages.length;
    pendingImages.forEach(function (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      els.imagePreview.appendChild(img);
    });
  }

  function addMomentFromForm(event) {
    event.preventDefault();
    state.posts.unshift({
      id: uid(),
      name: stateName(),
      timestamp: els.timestampInput.value.trim() || 'Today',
      text: els.postTextInput.value.trim(),
      images: pendingImages.slice(0, 9),
      likes: splitNames(els.likesInput.value),
      comments: parseComments(els.commentsInput.value)
    });
    save(true);
    renderFeed();
    closeModal();
  }

  function replacePostImage() {
    var file = els.replaceImageInput.files && els.replaceImageInput.files[0];
    if (!file || !replaceTarget) return;
    compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
      var post = state.posts.find(function (item) { return item.id === replaceTarget.postId; });
      if (post) post.images[replaceTarget.index] = dataUrl;
      replaceTarget = null;
      els.replaceImageInput.value = '';
      save(true);
      renderFeed();
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

  function save(showToast) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveStatus.textContent = 'Saved on this device at ' + new Date().toLocaleTimeString();
      if (showToast) showToast('Saved');
    } catch (error) {
      els.saveStatus.textContent = 'Could not save. Remove a large image and try again.';
      showToast('Storage is full. Remove a large image and try again.');
    }
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
