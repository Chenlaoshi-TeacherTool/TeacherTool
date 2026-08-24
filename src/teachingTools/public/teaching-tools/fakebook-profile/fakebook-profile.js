(function () {
  'use strict';

  var LIBRARY_KEY = 'chenlaoshi-fakebook-profiles-v1';
  var MAX_COVER_DIMENSION = 1000;
  var MAX_AVATAR_DIMENSION = 320;
  var MAX_FRIEND_DIMENSION = 260;
  var MAX_POST_IMAGE_DIMENSION = 900;
  var JPEG_QUALITY = 0.82;

  var library = { activeId: null, order: [], profiles: {} };
  var pendingPostImage = null;

  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    loadLibrary();
    if (!library.order.length) {
      var id = createProfile('My Character');
      library.activeId = id;
    }
    if (!library.activeId || !library.profiles[library.activeId]) {
      library.activeId = library.order[0];
    }
    renderSwitcher();
    renderActiveProfile();
    bindEvents();
  }

  function cacheEls() {
    els.profileSwitcher = document.getElementById('profileSwitcher');
    els.newProfileButton = document.getElementById('newProfileButton');
    els.duplicateProfileButton = document.getElementById('duplicateProfileButton');
    els.deleteProfileButton = document.getElementById('deleteProfileButton');
    els.saveStatus = document.getElementById('saveStatus');
    els.exportButton = document.getElementById('exportButton');
    els.importButton = document.getElementById('importButton');
    els.importFile = document.getElementById('importFile');
    els.printButton = document.getElementById('printButton');

    els.coverPhoto = document.getElementById('coverPhoto');
    els.coverHint = document.getElementById('coverHint');
    els.coverEditButton = document.getElementById('coverEditButton');
    els.avatarPhoto = document.getElementById('avatarPhoto');
    els.characterName = document.getElementById('characterName');

    els.introList = document.getElementById('introList');
    els.addIntroLineButton = document.getElementById('addIntroLineButton');

    els.friendsTitle = document.getElementById('friendsTitle');
    els.friendsGrid = document.getElementById('friendsGrid');
    els.addFriendButton = document.getElementById('addFriendButton');

    els.postAuthor = document.getElementById('postAuthor');
    els.postDate = document.getElementById('postDate');
    els.postText = document.getElementById('postText');
    els.postImageButton = document.getElementById('postImageButton');
    els.postImageInput = document.getElementById('postImageInput');
    els.postImagePreviewWrap = document.getElementById('postImagePreviewWrap');
    els.postImagePreview = document.getElementById('postImagePreview');
    els.postImageRemoveButton = document.getElementById('postImageRemoveButton');
    els.postSubmitButton = document.getElementById('postSubmitButton');
    els.postsList = document.getElementById('postsList');

    els.toast = document.getElementById('toast');
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Native window.confirm() is silently blocked in some embedded/preview browsers
  // (it auto-resolves to false with no dialog shown), which makes delete buttons look
  // broken. Use a tap-to-arm, tap-again-to-confirm pattern instead — no native dialog.
  function armThenConfirm(button, originalLabel, confirmLabel, onConfirm) {
    var armed = false;
    var revertTimer = null;
    button.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (!armed) {
        armed = true;
        button.classList.add('confirm-armed');
        button.textContent = confirmLabel;
        revertTimer = window.setTimeout(function () {
          armed = false;
          button.classList.remove('confirm-armed');
          button.textContent = originalLabel;
        }, 3000);
        return;
      }
      window.clearTimeout(revertTimer);
      onConfirm();
    });
  }

  function blankProfile(name) {
    return {
      id: uid('profile'),
      name: name || '',
      cover: '',
      avatar: '',
      intro: ['Born: click here to add!', 'Family: click here to add!'],
      friendsTitle: 'Friends',
      friends: [
        { id: uid('friend'), name: '', avatar: '' },
        { id: uid('friend'), name: '', avatar: '' },
        { id: uid('friend'), name: '', avatar: '' }
      ],
      posts: []
    };
  }

  function createProfile(name) {
    var profile = blankProfile(name);
    library.profiles[profile.id] = profile;
    library.order.push(profile.id);
    return profile.id;
  }

  function activeProfile() {
    return library.profiles[library.activeId];
  }

  function loadLibrary() {
    try {
      var raw = window.localStorage.getItem(LIBRARY_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && parsed.order) {
          library = parsed;
        }
      }
    } catch (e) {
      library = { activeId: null, order: [], profiles: {} };
    }
  }

  function persist(showToast) {
    try {
      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
      setSaveStatus('Saved on this device · ' + new Date().toLocaleTimeString());
      if (showToast) showToastMsg('Saved!');
    } catch (e) {
      setSaveStatus('Could not save — storage may be full');
      showToastMsg('Could not save. Try removing a large photo, then try again.');
    }
  }

  function setSaveStatus(text) {
    if (els.saveStatus) els.saveStatus.textContent = text;
  }

  var toastTimer = null;
  function showToastMsg(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('visible');
    }, 2200);
  }

  function renderSwitcher() {
    els.profileSwitcher.innerHTML = '';
    library.order.forEach(function (id) {
      var profile = library.profiles[id];
      if (!profile) return;
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = profile.name || 'Untitled character';
      els.profileSwitcher.appendChild(opt);
    });
    els.profileSwitcher.value = library.activeId;
  }

  function renderActiveProfile() {
    var profile = activeProfile();
    if (!profile) return;

    els.characterName.value = profile.name || '';

    if (profile.cover) {
      els.coverPhoto.style.backgroundImage = 'url(' + profile.cover + ')';
      els.coverPhoto.classList.add('has-image');
    } else {
      els.coverPhoto.style.backgroundImage = '';
      els.coverPhoto.classList.remove('has-image');
    }

    if (profile.avatar) {
      els.avatarPhoto.style.backgroundImage = 'url(' + profile.avatar + ')';
      els.avatarPhoto.classList.add('has-image');
    } else {
      els.avatarPhoto.style.backgroundImage = '';
      els.avatarPhoto.classList.remove('has-image');
    }

    els.friendsTitle.value = profile.friendsTitle || 'Friends';

    renderIntro(profile);
    renderFriends(profile);
    renderPosts(profile);
    resetComposer();
  }

  function renderIntro(profile) {
    els.introList.innerHTML = '';
    profile.intro.forEach(function (line, index) {
      var li = document.createElement('li');
      var input = document.createElement('input');
      input.className = 'fb-intro-line';
      input.value = line;
      input.setAttribute('aria-label', 'Intro line ' + (index + 1));
      input.addEventListener('input', function () {
        profile.intro[index] = input.value;
        persist(false);
      });
      var removeBtn = document.createElement('button');
      removeBtn.className = 'fb-remove-line';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove this line');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () {
        profile.intro.splice(index, 1);
        persist(false);
        renderIntro(profile);
      });
      li.appendChild(input);
      li.appendChild(removeBtn);
      els.introList.appendChild(li);
    });
  }

  function renderFriends(profile) {
    els.friendsGrid.innerHTML = '';
    profile.friends.forEach(function (friend, index) {
      var card = document.createElement('div');
      card.className = 'fb-friend-card';

      var removeBtn = document.createElement('button');
      removeBtn.className = 'fb-friend-remove';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove this friend');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () {
        profile.friends.splice(index, 1);
        persist(false);
        renderFriends(profile);
      });

      var avatar = document.createElement('div');
      avatar.className = 'fb-friend-avatar';
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');
      avatar.setAttribute('aria-label', 'Click to add a photo for this friend');
      if (friend.avatar) {
        avatar.style.backgroundImage = 'url(' + friend.avatar + ')';
        avatar.classList.add('has-image');
      } else {
        avatar.textContent = '🙂';
      }
      var pickFriendPhoto = function () {
        pickImage(function (dataUrl) {
          friend.avatar = dataUrl;
          persist(false);
          renderFriends(profile);
        }, MAX_FRIEND_DIMENSION);
      };
      avatar.addEventListener('click', pickFriendPhoto);
      avatar.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); pickFriendPhoto(); }
      });

      var nameInput = document.createElement('input');
      nameInput.className = 'fb-friend-name';
      nameInput.placeholder = 'type here';
      nameInput.value = friend.name || '';
      nameInput.addEventListener('input', function () {
        friend.name = nameInput.value;
        persist(false);
      });

      card.appendChild(removeBtn);
      card.appendChild(avatar);
      card.appendChild(nameInput);
      els.friendsGrid.appendChild(card);
    });
  }

  function initials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
  }

  function renderPosts(profile) {
    els.postsList.innerHTML = '';
    if (!profile.posts.length) {
      var empty = document.createElement('div');
      empty.className = 'fb-empty-posts';
      empty.textContent = 'No posts yet. Write your first post above!';
      els.postsList.appendChild(empty);
      return;
    }
    profile.posts.slice().reverse().forEach(function (post) {
      els.postsList.appendChild(renderPost(profile, post));
    });
  }

  function renderPost(profile, post) {
    var card = document.createElement('article');
    card.className = 'fb-post';

    var header = document.createElement('div');
    header.className = 'fb-post-header';

    var avatar = document.createElement('div');
    avatar.className = 'fb-post-avatar';
    if (post.image === undefined) { /* noop */ }
    var usePhoto = post.author && profile.name && post.author.trim().toLowerCase() === profile.name.trim().toLowerCase() && profile.avatar;
    if (usePhoto) {
      avatar.style.backgroundImage = 'url(' + profile.avatar + ')';
    } else {
      avatar.textContent = initials(post.author);
    }

    var meta = document.createElement('div');
    meta.className = 'fb-post-meta';
    var authorEl = document.createElement('strong');
    authorEl.textContent = post.author || 'Author';
    var dateEl = document.createElement('span');
    dateEl.textContent = post.date || '';
    meta.appendChild(authorEl);
    meta.appendChild(dateEl);

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'fb-post-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'Delete this post');
    deleteBtn.textContent = '🗑';
    deleteBtn.title = 'Delete this post';
    armThenConfirm(deleteBtn, '🗑', 'Sure?', function () {
      profile.posts = profile.posts.filter(function (p) { return p.id !== post.id; });
      persist(true);
      renderPosts(profile);
    });

    header.appendChild(avatar);
    header.appendChild(meta);
    header.appendChild(deleteBtn);
    card.appendChild(header);

    if (post.text) {
      var text = document.createElement('p');
      text.className = 'fb-post-text';
      text.textContent = post.text;
      card.appendChild(text);
    }

    if (post.image) {
      var img = document.createElement('img');
      img.className = 'fb-post-image';
      img.src = post.image;
      img.alt = 'Post image';
      card.appendChild(img);
    }

    var replies = document.createElement('div');
    replies.className = 'fb-replies';
    (post.replies || []).forEach(function (reply) {
      replies.appendChild(renderReply(profile, post, reply));
    });
    card.appendChild(replies);

    var replyForm = document.createElement('div');
    replyForm.className = 'fb-reply-form';
    var replyName = document.createElement('input');
    replyName.className = 'fb-reply-name';
    replyName.placeholder = 'Reply as…';
    var friendNames = (profile.friends || [])
      .map(function (f) { return (f.name || '').trim(); })
      .filter(function (n) { return n; });
    if (friendNames.length) {
      var datalistId = 'friendNames-' + post.id;
      var datalist = document.createElement('datalist');
      datalist.id = datalistId;
      friendNames.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n;
        datalist.appendChild(opt);
      });
      replyForm.appendChild(datalist);
      replyName.setAttribute('list', datalistId);
    }
    var replyText = document.createElement('input');
    replyText.className = 'fb-reply-text';
    replyText.placeholder = 'Write a reply…';
    var replyButton = document.createElement('button');
    replyButton.type = 'button';
    replyButton.textContent = 'Reply';
    var submitReply = function () {
      var name = replyName.value.trim();
      var textVal = replyText.value.trim();
      if (!name || !textVal) {
        showToastMsg('Add a name and a reply first.');
        return;
      }
      post.replies = post.replies || [];
      post.replies.push({ id: uid('reply'), author: name, text: textVal });
      persist(true);
      renderPosts(profile);
    };
    replyButton.addEventListener('click', submitReply);
    replyText.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') { evt.preventDefault(); submitReply(); }
    });
    replyForm.appendChild(replyName);
    replyForm.appendChild(replyText);
    replyForm.appendChild(replyButton);
    card.appendChild(replyForm);

    return card;
  }

  function renderReply(profile, post, reply) {
    var row = document.createElement('div');
    row.className = 'fb-reply';
    var avatar = document.createElement('div');
    avatar.className = 'fb-reply-avatar';
    avatar.textContent = initials(reply.author);
    var bubble = document.createElement('div');
    bubble.className = 'fb-reply-bubble';
    var strong = document.createElement('strong');
    strong.textContent = reply.author;
    var span = document.createElement('span');
    span.textContent = reply.text;
    var del = document.createElement('button');
    del.className = 'fb-reply-delete';
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete reply');
    del.textContent = '×';
    del.addEventListener('click', function () {
      post.replies = post.replies.filter(function (r) { return r.id !== reply.id; });
      persist(true);
      renderPosts(profile);
    });
    bubble.appendChild(strong);
    bubble.appendChild(span);
    bubble.appendChild(del);
    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function resetComposer() {
    els.postAuthor.value = '';
    els.postDate.value = '';
    els.postText.value = '';
    clearPendingPostImage();
  }

  function clearPendingPostImage() {
    pendingPostImage = null;
    els.postImagePreviewWrap.hidden = true;
    els.postImagePreview.src = '';
    els.postImageInput.value = '';
  }

  function pickImage(callback, maxDimension) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    var cleanup = function () {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      cleanup();
      if (!file) return;
      compressImage(file, maxDimension, function (dataUrl) {
        if (dataUrl) callback(dataUrl);
        else showToastMsg('Could not read that image.');
      });
    });
    input.addEventListener('cancel', cleanup);
    document.body.appendChild(input);
    input.click();
    window.setTimeout(cleanup, 60000);
  }

  function compressImage(file, maxDimension, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        } catch (e) {
          dataUrl = null;
        }
        callback(dataUrl);
      };
      img.onerror = function () { callback(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { callback(null); };
    reader.readAsDataURL(file);
  }

  function bindEvents() {
    els.profileSwitcher.addEventListener('change', function () {
      library.activeId = els.profileSwitcher.value;
      persist(false);
      renderActiveProfile();
    });

    els.newProfileButton.addEventListener('click', function () {
      var id = createProfile('New Character');
      library.activeId = id;
      persist(true);
      renderSwitcher();
      renderActiveProfile();
      els.characterName.focus();
    });

    els.duplicateProfileButton.addEventListener('click', function () {
      var profile = activeProfile();
      if (!profile) return;
      var copy = JSON.parse(JSON.stringify(profile));
      copy.id = uid('profile');
      copy.name = (profile.name || 'Untitled') + ' (copy)';
      library.profiles[copy.id] = copy;
      var index = library.order.indexOf(profile.id);
      library.order.splice(index + 1, 0, copy.id);
      library.activeId = copy.id;
      persist(true);
      renderSwitcher();
      renderActiveProfile();
    });

    armThenConfirm(els.deleteProfileButton, 'Delete', 'Click again to confirm', function () {
      if (library.order.length <= 1) {
        showToastMsg('You need at least one saved character.');
        return;
      }
      var profile = activeProfile();
      if (!profile) return;
      var index = library.order.indexOf(profile.id);
      library.order.splice(index, 1);
      delete library.profiles[profile.id];
      library.activeId = library.order[Math.max(0, index - 1)];
      persist(true);
      renderSwitcher();
      renderActiveProfile();
    });

    els.characterName.addEventListener('input', function () {
      var profile = activeProfile();
      profile.name = els.characterName.value;
      persist(false);
      renderSwitcherOptionLabel(profile);
    });

    els.coverPhoto.addEventListener('click', triggerCoverPick);
    els.coverEditButton.addEventListener('click', function (evt) {
      evt.stopPropagation();
      triggerCoverPick();
    });
    els.coverPhoto.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); triggerCoverPick(); }
    });
    function triggerCoverPick() {
      pickImage(function (dataUrl) {
        var profile = activeProfile();
        profile.cover = dataUrl;
        persist(true);
        renderActiveProfile();
      }, MAX_COVER_DIMENSION);
    }

    els.avatarPhoto.addEventListener('click', triggerAvatarPick);
    els.avatarPhoto.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); triggerAvatarPick(); }
    });
    function triggerAvatarPick() {
      pickImage(function (dataUrl) {
        var profile = activeProfile();
        profile.avatar = dataUrl;
        persist(true);
        renderActiveProfile();
      }, MAX_AVATAR_DIMENSION);
    }

    els.addIntroLineButton.addEventListener('click', function () {
      var profile = activeProfile();
      profile.intro.push('');
      persist(false);
      renderIntro(profile);
      var lines = els.introList.querySelectorAll('.fb-intro-line');
      if (lines.length) lines[lines.length - 1].focus();
    });

    els.friendsTitle.addEventListener('input', function () {
      var profile = activeProfile();
      profile.friendsTitle = els.friendsTitle.value;
      persist(false);
    });

    els.addFriendButton.addEventListener('click', function () {
      var profile = activeProfile();
      profile.friends.push({ id: uid('friend'), name: '', avatar: '' });
      persist(false);
      renderFriends(profile);
    });

    els.postImageButton.addEventListener('click', function () {
      els.postImageInput.click();
    });
    els.postImageInput.addEventListener('change', function () {
      var file = els.postImageInput.files && els.postImageInput.files[0];
      if (!file) return;
      compressImage(file, MAX_POST_IMAGE_DIMENSION, function (dataUrl) {
        if (!dataUrl) {
          showToastMsg('Could not read that image.');
          return;
        }
        pendingPostImage = dataUrl;
        els.postImagePreview.src = dataUrl;
        els.postImagePreviewWrap.hidden = false;
      });
    });
    els.postImageRemoveButton.addEventListener('click', clearPendingPostImage);

    els.postSubmitButton.addEventListener('click', function () {
      var profile = activeProfile();
      var author = els.postAuthor.value.trim() || profile.name || 'Author';
      var date = els.postDate.value.trim() || 'earlier today';
      var text = els.postText.value.trim();
      if (!text && !pendingPostImage) {
        showToastMsg('Write something or add a photo first.');
        return;
      }
      profile.posts.push({
        id: uid('post'),
        author: author,
        date: date,
        text: text,
        image: pendingPostImage || '',
        replies: []
      });
      persist(true);
      resetComposer();
      renderPosts(profile);
    });

    els.exportButton.addEventListener('click', function () {
      var profile = activeProfile();
      var blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var safeName = (profile.name || 'fakebook-character').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'fakebook-character';
      a.download = safeName + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    els.importButton.addEventListener('click', function () {
      els.importFile.click();
    });
    els.importFile.addEventListener('change', function () {
      var file = els.importFile.files && els.importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          if (!parsed || typeof parsed !== 'object') throw new Error('bad file');
          var profile = blankProfile(parsed.name || 'Imported character');
          profile.cover = parsed.cover || '';
          profile.avatar = parsed.avatar || '';
          profile.intro = Array.isArray(parsed.intro) ? parsed.intro : profile.intro;
          profile.friendsTitle = parsed.friendsTitle || 'Friends';
          profile.friends = Array.isArray(parsed.friends) && parsed.friends.length ? parsed.friends.map(function (f) {
            return { id: uid('friend'), name: f.name || '', avatar: f.avatar || '' };
          }) : profile.friends;
          profile.posts = Array.isArray(parsed.posts) ? parsed.posts.map(function (p) {
            return {
              id: uid('post'),
              author: p.author || '',
              date: p.date || '',
              text: p.text || '',
              image: p.image || '',
              replies: Array.isArray(p.replies) ? p.replies.map(function (r) {
                return { id: uid('reply'), author: r.author || '', text: r.text || '' };
              }) : []
            };
          }) : [];
          library.profiles[profile.id] = profile;
          library.order.push(profile.id);
          library.activeId = profile.id;
          persist(true);
          renderSwitcher();
          renderActiveProfile();
          showToastMsg('Imported "' + profile.name + '"');
        } catch (e) {
          showToastMsg('That file could not be imported.');
        }
        els.importFile.value = '';
      };
      reader.readAsText(file);
    });

    els.printButton.addEventListener('click', function () {
      window.print();
    });
  }

  function renderSwitcherOptionLabel(profile) {
    var options = els.profileSwitcher.querySelectorAll('option');
    options.forEach(function (opt) {
      if (opt.value === profile.id) opt.textContent = profile.name || 'Untitled character';
    });
  }
})();
