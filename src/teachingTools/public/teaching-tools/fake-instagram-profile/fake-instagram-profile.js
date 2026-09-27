(function () {
  'use strict';

  // All profile data stays in this browser under one versioned key.
  var STORAGE_KEY = 'chenlaoshi-fake-instagram-profile-v1';

  // Images are compressed before localStorage save so classroom photos do not exceed browser quota quickly.
  var MAX_IMAGE_SIZE = 900;
  var JPEG_QUALITY = 0.82;

  // This sample makes the tool useful immediately when a teacher opens it on a projector.
  var sampleProfile = {
    username: 'ancient_rome_reporter',
    displayName: 'Ancient Rome Reporter',
    bio: 'Posting from the Forum.\nEvidence, daily life, and empire updates.\nClass period: 3',
    followers: '418',
    following: '36',
    avatar: '',
    highlights: ['Unit', 'Quotes', 'Evidence'],
    posts: [
      {
        id: 'post-sample-1',
        image: '',
        caption: 'Today I visited the Forum. I noticed speeches, markets, and people sharing news. One question: who had power here, and who did not?',
        date: 'Unit 4, Day 2',
        likes: '128'
      },
      {
        id: 'post-sample-2',
        image: '',
        caption: 'Claim: roads helped Rome control a large empire. Evidence: soldiers, traders, and messages could move faster across long distances.',
        date: 'Source notes',
        likes: '203'
      }
    ]
  };

  var state = null;
  var pendingImage = '';
  var lastFocusBeforeModal = null;
  var toastTimer = null;
  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  // Find all DOM nodes once, load saved work, render the page, then attach events.
  function init() {
    cacheEls();
    state = loadProfile();
    renderProfile();
    renderPosts();
    bindEvents();
  }

  // Keep DOM lookups in one place so event code stays readable.
  function cacheEls() {
    els.saveStatus = document.getElementById('saveStatus');
    els.resetButton = document.getElementById('resetButton');
    els.printButton = document.getElementById('printButton');
    els.avatarButton = document.getElementById('avatarButton');
    els.avatarInitial = document.getElementById('avatarInitial');
    els.avatarInput = document.getElementById('avatarInput');
    els.usernameInput = document.getElementById('usernameInput');
    els.displayNameInput = document.getElementById('displayNameInput');
    els.bioInput = document.getElementById('bioInput');
    els.postCount = document.getElementById('postCount');
    els.followerCount = document.getElementById('followerCount');
    els.followingCount = document.getElementById('followingCount');
    els.highlightInputs = Array.prototype.slice.call(document.querySelectorAll('.ig-highlight input'));
    els.addPostButton = document.getElementById('addPostButton');
    els.postsGrid = document.getElementById('postsGrid');
    els.postModal = document.getElementById('postModal');
    els.modalTitle = document.getElementById('modalTitle');
    els.postForm = document.getElementById('postForm');
    els.editingPostId = document.getElementById('editingPostId');
    els.postImageInput = document.getElementById('postImageInput');
    els.imagePreviewWrap = document.getElementById('imagePreviewWrap');
    els.imagePreview = document.getElementById('imagePreview');
    els.removeImageButton = document.getElementById('removeImageButton');
    els.captionInput = document.getElementById('captionInput');
    els.dateInput = document.getElementById('dateInput');
    els.likesInput = document.getElementById('likesInput');
    els.deletePostButton = document.getElementById('deletePostButton');
    els.toast = document.getElementById('toast');
  }

  // Load saved JSON; if anything is corrupt, fall back to a fresh sample.
  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeProfile(JSON.parse(raw)) : cloneSample();
    } catch (error) {
      return cloneSample();
    }
  }

  // Copying the sample prevents accidental mutation of the constant object.
  function cloneSample() {
    return JSON.parse(JSON.stringify(sampleProfile));
  }

  // Make imported or older saved data safe enough for the current renderer.
  function normalizeProfile(profile) {
    profile = profile && typeof profile === 'object' ? profile : {};
    return {
      username: profile.username || sampleProfile.username,
      displayName: profile.displayName || sampleProfile.displayName,
      bio: profile.bio || sampleProfile.bio,
      followers: profile.followers || sampleProfile.followers,
      following: profile.following || sampleProfile.following,
      avatar: profile.avatar || '',
      highlights: Array.isArray(profile.highlights) ? profile.highlights.slice(0, 3) : cloneSample().highlights,
      posts: Array.isArray(profile.posts) ? profile.posts.map(normalizePost) : cloneSample().posts
    };
  }

  // Each post needs an id so clicking a tile can reopen the correct post.
  function normalizePost(post) {
    post = post && typeof post === 'object' ? post : {};
    return {
      id: post.id || uid(),
      image: post.image || '',
      caption: post.caption || '',
      date: post.date || '',
      likes: post.likes || ''
    };
  }

  // Small unique id helper; no dependency needed for classroom local data.
  function uid() {
    return 'post-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Persist after every edit so closing the tab does not lose student work.
  function save(showToast) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveStatus.textContent = 'Saved on this device at ' + new Date().toLocaleTimeString();
      if (showToast) showToastMsg('Saved');
    } catch (error) {
      els.saveStatus.textContent = 'Could not save. Try removing a large image.';
      showToastMsg('Storage is full. Remove a large image and try again.');
    }
  }

  // Fill the editable profile header from state.
  function renderProfile() {
    els.usernameInput.value = state.username;
    els.displayNameInput.value = state.displayName;
    els.bioInput.value = state.bio;
    els.followerCount.textContent = state.followers;
    els.followingCount.textContent = state.following;
    els.postCount.textContent = String(state.posts.length);
    els.highlightInputs.forEach(function (input, index) {
      input.value = state.highlights[index] || '';
    });
    renderAvatar();
  }

  // Use the uploaded avatar when present; otherwise show the first letter of the display name.
  function renderAvatar() {
    if (state.avatar) {
      els.avatarButton.style.backgroundImage = 'url(' + state.avatar + ')';
      els.avatarButton.classList.add('has-image');
    } else {
      els.avatarButton.style.backgroundImage = '';
      els.avatarButton.classList.remove('has-image');
      els.avatarInitial.textContent = (state.displayName || state.username || 'C').trim().charAt(0).toUpperCase() || 'C';
    }
  }

  // Rebuild the post grid whenever posts are added, edited, or deleted.
  function renderPosts() {
    els.postsGrid.innerHTML = '';
    els.postCount.textContent = String(state.posts.length);
    if (!state.posts.length) {
      var empty = document.createElement('div');
      empty.className = 'ig-empty-state';
      empty.textContent = 'No posts yet. Add a post to begin the classroom profile.';
      els.postsGrid.appendChild(empty);
      return;
    }
    state.posts.forEach(function (post) {
      els.postsGrid.appendChild(renderPostTile(post));
    });
  }

  // Create one clickable post tile with a lightweight hover summary.
  function renderPostTile(post) {
    var tile = document.createElement('button');
    tile.className = 'ig-post-tile';
    tile.type = 'button';
    tile.setAttribute('aria-label', 'Edit post: ' + (post.caption || 'Untitled post'));
    tile.addEventListener('click', function () {
      openPostModal(post);
    });

    if (post.image) {
      var img = document.createElement('img');
      img.src = post.image;
      img.alt = '';
      tile.appendChild(img);
    } else {
      var fallback = document.createElement('div');
      fallback.className = 'ig-post-fallback';
      fallback.textContent = shortText(post.caption || 'Classroom post', 72);
      tile.appendChild(fallback);
    }

    var overlay = document.createElement('div');
    overlay.className = 'ig-post-overlay';
    overlay.textContent = (post.likes || '0') + ' likes - ' + shortText(post.caption, 70);
    tile.appendChild(overlay);
    return tile;
  }

  // Trim long captions in compact spaces without changing the saved text.
  function shortText(text, maxLength) {
    text = (text || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
  }

  // Wire all user actions after the first render.
  function bindEvents() {
    bindProfileEdits();
    bindModalEvents();

    els.avatarButton.addEventListener('click', function () {
      els.avatarInput.click();
    });

    els.avatarInput.addEventListener('change', function () {
      var file = els.avatarInput.files && els.avatarInput.files[0];
      if (!file) return;
      compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
        state.avatar = dataUrl || '';
        renderAvatar();
        save(true);
        els.avatarInput.value = '';
      });
    });

    els.addPostButton.addEventListener('click', function () {
      openPostModal(null);
    });

    els.resetButton.addEventListener('click', function () {
      state = cloneSample();
      save(true);
      renderProfile();
      renderPosts();
    });

    els.printButton.addEventListener('click', function () {
      window.print();
    });
  }

  // Editable header fields all save immediately as the user types.
  function bindProfileEdits() {
    els.usernameInput.addEventListener('input', function () {
      state.username = cleanUsername(els.usernameInput.value);
      els.usernameInput.value = state.username;
      save(false);
    });

    els.displayNameInput.addEventListener('input', function () {
      state.displayName = els.displayNameInput.value;
      renderAvatar();
      save(false);
    });

    els.bioInput.addEventListener('input', function () {
      state.bio = els.bioInput.value;
      save(false);
    });

    els.followerCount.addEventListener('input', function () {
      state.followers = els.followerCount.textContent.trim();
      save(false);
    });

    els.followingCount.addEventListener('input', function () {
      state.following = els.followingCount.textContent.trim();
      save(false);
    });

    els.highlightInputs.forEach(function (input, index) {
      input.addEventListener('input', function () {
        state.highlights[index] = input.value;
        save(false);
      });
    });
  }

  // Keep usernames close to what students expect from social-style handles.
  function cleanUsername(value) {
    return value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 32);
  }

  // Modal controls share close behavior, escape key support, and form submit handling.
  function bindModalEvents() {
    document.querySelectorAll('[data-close-modal]').forEach(function (button) {
      button.addEventListener('click', closePostModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !els.postModal.hidden) closePostModal();
    });

    els.postImageInput.addEventListener('change', function () {
      var file = els.postImageInput.files && els.postImageInput.files[0];
      if (!file) return;
      compressImage(file, MAX_IMAGE_SIZE, function (dataUrl) {
        pendingImage = dataUrl || '';
        renderPendingImage();
      });
    });

    els.removeImageButton.addEventListener('click', function () {
      pendingImage = '';
      renderPendingImage();
    });

    els.postForm.addEventListener('submit', function (event) {
      event.preventDefault();
      savePostFromForm();
    });

    els.deletePostButton.addEventListener('click', deleteEditingPost);
  }

  // Open the modal for either a new post or the post passed in for editing.
  function openPostModal(post) {
    lastFocusBeforeModal = document.activeElement;
    els.modalTitle.textContent = post ? 'Edit post' : 'Add post';
    els.editingPostId.value = post ? post.id : '';
    els.captionInput.value = post ? post.caption : '';
    els.dateInput.value = post ? post.date : '';
    els.likesInput.value = post ? post.likes : '';
    pendingImage = post ? post.image : '';
    els.deletePostButton.hidden = !post;
    els.postImageInput.value = '';
    renderPendingImage();
    els.postModal.hidden = false;
    els.captionInput.focus();
  }

  // Hide the modal and return focus to the control that opened it.
  function closePostModal() {
    els.postModal.hidden = true;
    els.postForm.reset();
    pendingImage = '';
    renderPendingImage();
    if (lastFocusBeforeModal && lastFocusBeforeModal.focus) lastFocusBeforeModal.focus();
  }

  // Show or hide the selected image preview in the modal.
  function renderPendingImage() {
    els.imagePreviewWrap.hidden = !pendingImage;
    els.imagePreview.src = pendingImage || '';
  }

  // Create or update the matching post from the modal fields.
  function savePostFromForm() {
    var id = els.editingPostId.value;
    var post = id ? state.posts.find(function (item) { return item.id === id; }) : null;
    if (!post) {
      post = { id: uid(), image: '', caption: '', date: '', likes: '' };
      state.posts.unshift(post);
    }
    post.image = pendingImage;
    post.caption = els.captionInput.value.trim();
    post.date = els.dateInput.value.trim() || 'Today';
    post.likes = els.likesInput.value.trim() || '0';
    save(true);
    renderPosts();
    closePostModal();
  }

  // Remove the currently edited post.
  function deleteEditingPost() {
    var id = els.editingPostId.value;
    state.posts = state.posts.filter(function (post) {
      return post.id !== id;
    });
    save(true);
    renderPosts();
    closePostModal();
  }

  // Compress an uploaded image into a JPEG data URL before saving it in localStorage.
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
          showToastMsg('Could not read that image.');
        }
      };
      image.onerror = function () {
        callback('');
        showToastMsg('Could not read that image.');
      };
      image.src = reader.result;
    };
    reader.onerror = function () {
      callback('');
      showToastMsg('Could not read that image.');
    };
    reader.readAsDataURL(file);
  }

  // Toasts give quick feedback without blocking embedded browsers.
  function showToastMsg(message) {
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('visible');
    }, 2200);
  }
})();
