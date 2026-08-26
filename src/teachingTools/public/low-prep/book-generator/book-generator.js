(function () {
  'use strict';

  var STORAGE_KEY = 'chen-laoshi-book-generator-v1';
  var MY_BOOKS_KEY = 'chen-laoshi-book-generator-my-books-v1';
  var I18N = window.__BOOK_GEN_I18N__ || {};
  var $ = function (selector, root) { return (root || document).querySelector(selector); };

  var draftId = null;
  var pages = [];
  var music = null; // { blobName, fileName }
  var toastTimer = null;

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function showToast(message) {
    var toast = $('#bookGenToast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2800);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) { return null; }
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        draftId: draftId,
        title: $('#bookTitle').value,
        music: music,
        pages: pages.map(function (page) {
          return {
            id: page.id,
            caption: page.caption,
            imageBlob: page.imageBlob,
            imagePreviewUrl: page.imagePreviewUrl,
            narrationBlob: page.narrationBlob,
            narrationPreviewUrl: page.narrationPreviewUrl
          };
        })
      }));
    } catch (err) { /* localStorage may be full or unavailable; drafts just won't persist */ }
  }

  function uploadAsset(pageId, kind, file) {
    var formData = new FormData();
    formData.append('draftId', draftId);
    formData.append('pageId', pageId);
    formData.append('kind', kind);
    formData.append('file', file);
    return fetch('/api/book-generator/pages/upload', { method: 'POST', body: formData })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.error || I18N.uploadError); });
        return res.json();
      });
  }

  function createPage(initial) {
    return {
      id: (initial && initial.id) || uuid(),
      caption: (initial && initial.caption) || '',
      imageBlob: (initial && initial.imageBlob) || null,
      imagePreviewUrl: (initial && initial.imagePreviewUrl) || null,
      narrationBlob: (initial && initial.narrationBlob) || null,
      narrationPreviewUrl: (initial && initial.narrationPreviewUrl) || null
    };
  }

  function renderPages() {
    var list = $('#pagesList');
    var template = $('#pageRowTemplate');
    list.innerHTML = '';
    pages.forEach(function (page, index) {
      var node = template.content.cloneNode(true);
      var row = node.querySelector('.book-gen-page-row');
      row.dataset.pageId = page.id;

      node.querySelector('.book-gen-page-number').textContent = (I18N.pageLabel || 'Page') + ' ' + (index + 1);

      var thumb = node.querySelector('.book-gen-page-thumb');
      var placeholder = node.querySelector('.book-gen-image-placeholder');
      if (page.imagePreviewUrl) {
        thumb.src = page.imagePreviewUrl;
        thumb.hidden = false;
        placeholder.hidden = true;
      }

      var captionInput = node.querySelector('.book-gen-caption-input');
      captionInput.value = page.caption;
      captionInput.addEventListener('input', function () {
        page.caption = captionInput.value;
        saveDraft();
      });

      var recordBtn = node.querySelector('[data-action="record"]');
      var narrationPreview = node.querySelector('.book-gen-narration-preview');
      var recordingIndicator = node.querySelector('.book-gen-recording-indicator');
      if (page.narrationPreviewUrl) {
        narrationPreview.src = page.narrationPreviewUrl;
        narrationPreview.hidden = false;
        recordBtn.textContent = I18N.reRecord || 'Re-record';
      }
      recordBtn.addEventListener('click', function () {
        toggleRecording(page, recordBtn, narrationPreview, recordingIndicator);
      });

      list.appendChild(node);
    });

    // Wire up per-row buttons after render (event delegation on freshly appended rows).
    Array.prototype.forEach.call(list.querySelectorAll('.book-gen-page-row'), function (rowEl) {
      var pageId = rowEl.dataset.pageId;
      var page = pages.find(function (p) { return p.id === pageId; });

      rowEl.querySelector('[data-action="move-up"]').addEventListener('click', function () { movePage(pageId, -1); });
      rowEl.querySelector('[data-action="move-down"]').addEventListener('click', function () { movePage(pageId, 1); });
      rowEl.querySelector('[data-action="remove"]').addEventListener('click', function () { removePage(pageId); });

      var dropZone = rowEl.querySelector('[data-action="choose-image"]');
      var imageInput = rowEl.querySelector('.book-gen-image-input');
      dropZone.addEventListener('click', function () { imageInput.click(); });
      imageInput.addEventListener('change', function () {
        var file = imageInput.files[0];
        if (!file) return;
        var thumb = rowEl.querySelector('.book-gen-page-thumb');
        var placeholder = rowEl.querySelector('.book-gen-image-placeholder');
        var localUrl = URL.createObjectURL(file);
        thumb.src = localUrl;
        thumb.hidden = false;
        placeholder.hidden = true;
        page.imagePreviewUrl = localUrl;
        uploadAsset(page.id, 'image', file).then(function (result) {
          page.imageBlob = result.blobName;
          saveDraft();
        }).catch(function (err) {
          showToast(err.message || I18N.uploadError);
        });
      });
    });
  }

  function movePage(pageId, delta) {
    var index = pages.findIndex(function (p) { return p.id === pageId; });
    var newIndex = index + delta;
    if (newIndex < 0 || newIndex >= pages.length) return;
    var tmp = pages[index];
    pages[index] = pages[newIndex];
    pages[newIndex] = tmp;
    saveDraft();
    renderPages();
  }

  function removePage(pageId) {
    pages = pages.filter(function (p) { return p.id !== pageId; });
    saveDraft();
    renderPages();
  }

  function addPage(initial) {
    pages.push(createPage(initial));
    saveDraft();
    renderPages();
  }

  // ===== Narration recording =====

  var activeRecorder = null;
  var activeRecordingPage = null;

  function toggleRecording(page, btn, previewEl, indicatorEl) {
    if (activeRecorder && activeRecordingPage === page) {
      activeRecorder.stop();
      return;
    }
    if (activeRecorder) return; // another page is recording

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new MediaRecorder(stream);
      activeRecorder = recorder;
      activeRecordingPage = page;
      indicatorEl.hidden = false;
      btn.textContent = I18N.stopRecording || 'Stop recording';

      recorder.addEventListener('dataavailable', function (event) {
        if (event.data.size > 0) chunks.push(event.data);
      });

      recorder.addEventListener('stop', function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        indicatorEl.hidden = true;
        btn.textContent = I18N.reRecord || 'Re-record';
        activeRecorder = null;
        activeRecordingPage = null;

        var blob = new Blob(chunks, { type: 'audio/webm' });
        var localUrl = URL.createObjectURL(blob);
        previewEl.src = localUrl;
        previewEl.hidden = false;
        page.narrationPreviewUrl = localUrl;

        var file = new File([blob], 'narration.webm', { type: 'audio/webm' });
        uploadAsset(page.id, 'narration', file).then(function (result) {
          page.narrationBlob = result.blobName;
          saveDraft();
        }).catch(function (err) {
          showToast(err.message || I18N.uploadError);
        });
      });

      recorder.start();
    }).catch(function () {
      showToast(I18N.micPermissionError || 'Could not access the microphone.');
    });
  }

  // ===== Background music =====

  function initMusic() {
    $('#chooseMusicBtn').addEventListener('click', function () { $('#musicInput').click(); });
    $('#musicInput').addEventListener('change', function () {
      var file = $('#musicInput').files[0];
      if (!file) return;
      var preview = $('#musicPreview');
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      $('#musicFileName').textContent = file.name;

      uploadAsset('shared', 'music', file).then(function (result) {
        music = { blobName: result.blobName, fileName: file.name };
        saveDraft();
      }).catch(function (err) {
        showToast(err.message || I18N.uploadError);
      });
    });
  }

  // ===== Publish =====

  function initPublish() {
    $('#generateBtn').addEventListener('click', function () {
      if (pages.length === 0) return showToast(I18N.needAtLeastOnePage);
      if (pages.length > 20) return showToast(I18N.tooManyPages);
      if (pages.some(function (p) { return !p.imageBlob; })) return showToast(I18N.needImageOnEveryPage);
      var password = $('#bookPassword').value;
      if (!password || password.length < 4) return showToast(I18N.passwordTooShort);

      var btn = $('#generateBtn');
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = I18N.generating || 'Generating...';

      fetch('/api/book-generator/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draftId,
          title: $('#bookTitle').value,
          password: password,
          musicBlob: music ? music.blobName : null,
          pages: pages.map(function (p) {
            return { id: p.id, caption: p.caption, imageBlob: p.imageBlob, narrationBlob: p.narrationBlob };
          })
        })
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Could not publish this book.');
          return body;
        });
      }).then(function (result) {
        var origin = window.location.origin;
        $('#shareLinkInput').value = origin + result.url;
        $('#sharePasswordInput').value = password;
        $('#shareResult').hidden = false;
        addMyBook({
          bookId: result.bookId,
          title: $('#bookTitle').value,
          url: result.url,
          deleteToken: result.deleteToken,
          createdAt: new Date().toISOString()
        });
      }).catch(function (err) {
        showToast(err.message);
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = originalText;
      });
    });

    $('#copyLinkBtn').addEventListener('click', function () { copyField('#shareLinkInput'); });
    $('#copyPasswordBtn').addEventListener('click', function () { copyField('#sharePasswordInput'); });
  }

  // ===== My Books (locally tracked, this browser only) =====

  function loadMyBooks() {
    try {
      var raw = localStorage.getItem(MY_BOOKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }

  function saveMyBooks(list) {
    try { localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(list)); } catch (err) { /* ignore */ }
  }

  function addMyBook(entry) {
    var list = loadMyBooks();
    list.unshift(entry);
    saveMyBooks(list);
    renderMyBooks();
  }

  function removeMyBook(bookId) {
    saveMyBooks(loadMyBooks().filter(function (b) { return b.bookId !== bookId; }));
    renderMyBooks();
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(); } catch (err) { return ''; }
  }

  function renderMyBooks() {
    var list = loadMyBooks();
    var container = $('#myBooksList');
    var emptyState = $('#myBooksEmpty');
    container.innerHTML = '';
    emptyState.hidden = list.length > 0;

    list.forEach(function (book) {
      var row = document.createElement('div');
      row.className = 'book-gen-my-book-row';

      var info = document.createElement('div');
      info.className = 'book-gen-my-book-info';
      var titleEl = document.createElement('span');
      titleEl.className = 'book-gen-my-book-title';
      titleEl.textContent = book.title || I18N.untitledBook || 'Untitled book';
      var dateEl = document.createElement('span');
      dateEl.className = 'book-gen-my-book-date';
      dateEl.textContent = (I18N.createdOn || 'Created {date}').replace('{date}', formatDate(book.createdAt));
      info.appendChild(titleEl);
      info.appendChild(dateEl);

      var actions = document.createElement('div');
      actions.className = 'book-gen-my-book-actions';

      var openLink = document.createElement('a');
      openLink.className = 'book-gen-secondary';
      openLink.href = book.url;
      openLink.target = '_blank';
      openLink.rel = 'noopener';
      openLink.textContent = I18N.openBook || 'Open';

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'book-gen-secondary book-gen-danger';
      deleteBtn.type = 'button';
      deleteBtn.textContent = I18N.deleteBook || 'Delete';
      deleteBtn.addEventListener('click', function () {
        if (!window.confirm(I18N.deleteConfirm || 'Delete this book? This cannot be undone.')) return;
        fetch('/api/book-generator/books/' + encodeURIComponent(book.bookId), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteToken: book.deleteToken })
        }).then(function (res) {
          if (!res.ok) throw new Error(I18N.deleteError || 'Could not delete this book.');
          removeMyBook(book.bookId);
          showToast(I18N.deletedToast || 'Book deleted.');
        }).catch(function (err) {
          showToast(err.message);
        });
      });

      actions.appendChild(openLink);
      actions.appendChild(deleteBtn);
      row.appendChild(info);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }

  function copyField(selector) {
    var input = $(selector);
    input.select();
    navigator.clipboard && navigator.clipboard.writeText(input.value).then(function () {
      showToast(I18N.copied || 'Copied!');
    });
  }

  function init() {
    var saved = loadDraft();
    draftId = (saved && saved.draftId) || uuid();
    music = (saved && saved.music) || null;

    if (saved && saved.music) {
      $('#musicFileName').textContent = saved.music.fileName || '';
    }
    if (saved && Array.isArray(saved.pages) && saved.pages.length) {
      saved.pages.forEach(function (p) { addPage(p); });
      if (saved.title) $('#bookTitle').value = saved.title;
    } else {
      addPage();
    }

    $('#addPageBtn').addEventListener('click', function () { addPage(); });
    initMusic();
    initPublish();
    renderMyBooks();
  }

  init();
})();
