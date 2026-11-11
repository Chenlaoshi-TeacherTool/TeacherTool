// /admin/materials: theme list on the left (rename, reorder), materials and multi-file upload on the right.
(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('tmData').textContent);
  var current = '';          // selected theme key; '' = all materials
  var queue = [];            // files waiting to upload: { file, title, state, message }
  var pickedLessons = new Set();
  var uploading = false;
  function $(id) { return document.getElementById(id); }
  function L(en, zh) { return data.lang === 'zh' ? zh : en; }
  function el(tag, props, children) {
    var node = Object.assign(document.createElement(tag), props || {});
    (children || []).forEach(function (child) { node.append(child); });
    return node;
  }
  function theme(key) { return data.themes.find(function (item) { return item.key === key; }); }
  function status(message, isError) { $('tmStatus').textContent = message || ''; $('tmStatus').classList.toggle('error', Boolean(isError)); }
  async function post(url, body) {
    var response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || L('Save failed.', '保存失败。'));
    return result;
  }

  // ----- Theme selection -----
  function select(key) {
    current = theme(key) ? key : '';
    var selected = theme(current);
    document.querySelectorAll('.tm-item').forEach(function (button) { button.setAttribute('aria-current', String(button.dataset.key === current)); });
    $('tmHead').hidden = !selected; $('tmAllHead').hidden = Boolean(selected);
    if (selected) {
      $('tmIcon').value = selected.icon; $('tmZh').value = selected.zh; $('tmEn').value = selected.en;
      $('tmView').href = selected.href; $('tmSaveName').disabled = true;
      var index = data.themes.indexOf(selected);
      $('tmUp').disabled = index === 0; $('tmDown').disabled = index === data.themes.length - 1;
    }
    $('tmDropText').textContent = selected
      ? L('Drop files here to add them to “' + selected.en + '”', '把文件拖到这里，上传到「' + selected.zh + '」')
      : L('Drop files here, then choose their themes', '把文件拖到这里，然后选择主题');
    $('tmSingle').href = '/admin/materials/new' + (selected ? '?theme=' + encodeURIComponent(current) : '');
    var shown = 0;
    document.querySelectorAll('#tmTable tbody tr').forEach(function (row) {
      row.hidden = Boolean(current) && !row.dataset.themes.split(' ').includes(current);
      if (!row.hidden) shown += 1;
    });
    $('tmTable').hidden = !shown; $('tmEmpty').hidden = Boolean(shown);
    if (!queue.length) themeChips();
    history.replaceState(null, '', current ? '#' + current : location.pathname);
  }
  document.querySelectorAll('.tm-item').forEach(function (button) {
    button.addEventListener('click', function () { status(''); select(button.dataset.key); });
  });

  // ----- Rename -----
  ['tmIcon', 'tmZh', 'tmEn'].forEach(function (id) { $(id).addEventListener('input', function () { $('tmSaveName').disabled = false; }); });
  $('tmHead').addEventListener('submit', async function (event) {
    event.preventDefault();
    var selected = theme(current);
    $('tmSaveName').disabled = true;
    try {
      var saved = await post('/admin/themes/' + encodeURIComponent(current) + '/edit', { zh: $('tmZh').value, en: $('tmEn').value, icon: $('tmIcon').value });
      Object.assign(selected, { zh: saved.zh, en: saved.en, icon: saved.icon || '' });
      var button = document.querySelector('#tmList .tm-item[data-key="' + current + '"]');
      button.querySelector('.tm-name').textContent = L(saved.en, saved.zh);
      button.querySelector('.tm-icon').textContent = saved.icon || '';
      select(current); themeChips();
      status(L('Name saved.', '名称已保存。'));
    } catch (error) { status(error.message, true); $('tmSaveName').disabled = false; }
  });

  // ----- Reorder (drag, or the arrow buttons) -----
  var dragged = null;
  async function saveOrder() {
    var keys = Array.from(document.querySelectorAll('#tmList li')).map(function (item) { return item.dataset.key; });
    data.themes.sort(function (a, b) { return keys.indexOf(a.key) - keys.indexOf(b.key); });
    select(current); themeChips();
    try { await post('/admin/themes/order', { keys: keys }); status(L('Order saved.', '顺序已保存。')); }
    catch (error) { status(error.message, true); }
  }
  document.querySelectorAll('#tmList li').forEach(function (item) {
    item.addEventListener('dragstart', function (event) { dragged = item; item.classList.add('tm-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.dataset.key); });
    item.addEventListener('dragend', function () { item.classList.remove('tm-dragging'); document.querySelectorAll('.tm-over').forEach(function (node) { node.classList.remove('tm-over'); }); dragged = null; });
    item.addEventListener('dragover', function (event) { if (dragged && dragged !== item) { event.preventDefault(); item.classList.add('tm-over'); } });
    item.addEventListener('dragleave', function () { item.classList.remove('tm-over'); });
    item.addEventListener('drop', function (event) {
      if (!dragged || dragged === item) return;
      event.preventDefault(); event.stopPropagation();
      var after = dragged.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING;
      item.parentNode.insertBefore(dragged, after ? item.nextSibling : item);
      saveOrder();
    });
  });
  function move(step) {
    var item = document.querySelector('#tmList li[data-key="' + current + '"]');
    var other = step < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!other) return;
    item.parentNode.insertBefore(item, step < 0 ? other : other.nextSibling);
    saveOrder();
  }
  $('tmUp').addEventListener('click', function () { move(-1); });
  $('tmDown').addEventListener('click', function () { move(1); });

  // ----- New theme -----
  $('tmNew').addEventListener('click', function () { $('tmDialog').showModal(); });
  $('tmNewCancel').addEventListener('click', function () { $('tmDialog').close(); });
  $('tmNewForm').addEventListener('submit', async function (event) {
    event.preventDefault(); $('tmNewError').hidden = true; $('tmNewSave').disabled = true;
    try {
      var saved = await post('/admin/themes/new', Object.fromEntries(new FormData(event.target)));
      location.hash = saved.key; location.reload();
    } catch (error) { $('tmNewError').textContent = error.message; $('tmNewError').hidden = false; $('tmNewSave').disabled = false; }
  });

  // ----- Upload: one material per file -----
  function themeChips() {
    var checked = new Set(Array.from(document.querySelectorAll('#tmThemeChips input:checked')).map(function (input) { return input.value; }));
    if (!queue.length) { checked = new Set(current ? [current] : []); }
    $('tmThemeChips').replaceChildren.apply($('tmThemeChips'), data.themes.map(function (item) {
      return el('label', {}, [el('input', { type: 'checkbox', value: item.key, checked: checked.has(item.key) }), (item.icon ? item.icon + ' ' : '') + L(item.en, item.zh)]);
    }));
  }
  function titleFrom(name) { return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 120) || name.slice(0, 120); }
  function renderQueue() {
    $('tmUpload').hidden = !queue.length;
    $('tmQueue').replaceChildren.apply($('tmQueue'), queue.map(function (entry, index) {
      var title = el('input', { type: 'text', value: entry.title, maxLength: 120, disabled: uploading || entry.state === 'done' });
      title.setAttribute('aria-label', L('Title for ', '标题：') + entry.file.name);
      title.addEventListener('input', function () { entry.title = title.value; });
      var remove = el('button', { type: 'button', className: 'secondary', textContent: L('Remove', '移除'), disabled: uploading || entry.state === 'done' });
      remove.addEventListener('click', function () { queue.splice(index, 1); renderQueue(); });
      var note = el('small', { className: entry.state === 'error' ? 'error' : entry.state === 'done' ? 'ok' : '' });
      note.textContent = entry.message || entry.file.name + ' · ' + (entry.file.size / 1048576).toFixed(1) + ' MB';
      return el('div', { className: 'tm-file' }, [title, note, remove]);
    }));
    $('tmStart').disabled = uploading || !queue.some(function (entry) { return entry.state !== 'done'; });
    $('tmClear').disabled = uploading;
  }
  function addFiles(list) {
    Array.from(list).forEach(function (file) {
      queue.push({ file: file, title: titleFrom(file.name), state: file.size > 30 * 1048576 ? 'error' : 'ready', message: file.size > 30 * 1048576 ? L('Larger than 30 MB.', '超过 30 MB。') : '' });
    });
    if (queue.length) status('');
    renderQueue();
  }
  $('tmFiles').addEventListener('change', function () { addFiles($('tmFiles').files); $('tmFiles').value = ''; });
  ['dragenter', 'dragover'].forEach(function (name) {
    $('tmDrop').addEventListener(name, function (event) { if (!dragged) { event.preventDefault(); $('tmDrop').classList.add('over'); } });
  });
  $('tmDrop').addEventListener('dragleave', function () { $('tmDrop').classList.remove('over'); });
  $('tmDrop').addEventListener('drop', function (event) {
    if (dragged) return;
    event.preventDefault(); $('tmDrop').classList.remove('over'); addFiles(event.dataTransfer.files);
  });
  $('tmClear').addEventListener('click', function () { queue = []; pickedLessons.clear(); $('tmFree').checked = false; renderQueue(); themeChips(); lessons(); });
  $('tmStart').addEventListener('click', async function () {
    var themes = Array.from(document.querySelectorAll('#tmThemeChips input:checked')).map(function (input) { return input.value; });
    if (!themes.length) return status(L('Choose at least one theme.', '请至少选择一个主题。'), true);
    if (queue.some(function (entry) { return entry.state !== 'done' && !entry.title.trim(); })) return status(L('Every file needs a title.', '每个文件都需要标题。'), true);
    uploading = true; status(''); renderQueue();
    var failed = 0;
    for (var entry of queue) {
      if (entry.state === 'done') continue;
      entry.state = 'busy'; entry.message = L('Uploading…', '上传中…'); renderQueue();
      try {
        var form = new FormData();
        form.append('title', entry.title.trim()); form.append('description', ''); form.append('descriptionEn', '');
        themes.forEach(function (key) { form.append('themes', key); });
        pickedLessons.forEach(function (id) { form.append('lessons', id); });
        if ($('tmFree').checked) form.append('limitedFree', 'on');
        form.append('attachments', entry.file, entry.file.name);
        var response = await fetch('/admin/materials/save', { method: 'POST', body: form });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(result.error || L('Upload failed.', '上传失败。'));
        entry.state = 'done'; entry.message = L('Uploaded', '已上传');
      } catch (error) { failed += 1; entry.state = 'error'; entry.message = error.message; }
      renderQueue();
    }
    uploading = false; renderQueue();
    if (failed) return status(L(failed + ' file(s) were not uploaded. Fix them and press Upload again; the others are saved.', '有 ' + failed + ' 个文件没有上传成功，其余已保存。修改后再点“上传”。'), true);
    location.reload();
  });

  // ----- Lesson picker: choose a textbook and book, then tick lessons -----
  function fill(select, values) {
    select.replaceChildren(); values.forEach(function (item) { select.add(new Option(item.label, item.value)); }); select.disabled = !values.length;
  }
  function lessonLabel(lesson) { return L('Lesson ' + lesson.lessonNo, '第' + lesson.lessonNo + '课') + ' · ' + lesson.title; }
  function books() {
    var series = data.series.find(function (item) { return item.key === $('tmSeries').value; });
    fill($('tmBook'), (series && series.books || []).filter(function (book) { return data.catalog.some(function (l) { return l.series === series.key && l.book === book.slug; }); })
      .map(function (book) { return { value: book.slug, label: L(book.en, book.zh) }; }));
    lessons();
  }
  function lessons() {
    var list = data.catalog.filter(function (l) { return l.series === $('tmSeries').value && l.book === $('tmBook').value; });
    $('tmLessonList').replaceChildren.apply($('tmLessonList'), list.length ? list.map(function (lesson) {
      var box = el('input', { type: 'checkbox', checked: pickedLessons.has(lesson.id) });
      box.addEventListener('change', function () { if (box.checked) pickedLessons.add(lesson.id); else pickedLessons.delete(lesson.id); picked(); });
      return el('label', {}, [box, ' ' + lessonLabel(lesson)]);
    }) : [L('No published lessons yet.', '暂无已发布的课次。')]);
    picked();
  }
  function picked() {
    $('tmPicked').replaceChildren.apply($('tmPicked'), Array.from(pickedLessons).map(function (id) {
      var lesson = data.catalog.find(function (l) { return l.id === id; });
      var series = data.series.find(function (item) { return item.key === lesson.series; });
      var book = series && (series.books || []).find(function (item) { return item.slug === lesson.book; });
      var chip = el('button', { type: 'button', textContent: (series ? L(series.en, series.zh) : lesson.series) + ' · ' + (book ? L(book.en, book.zh) : lesson.book) + ' · ' + lessonLabel(lesson) + ' ✕' });
      chip.addEventListener('click', function () { pickedLessons.delete(id); lessons(); });
      return chip;
    }));
  }
  fill($('tmSeries'), data.series.filter(function (series) { return data.catalog.some(function (l) { return l.series === series.key; }); })
    .map(function (series) { return { value: series.key, label: L(series.en, series.zh) }; }));
  $('tmSeries').addEventListener('change', books); $('tmBook').addEventListener('change', lessons);
  books();

  select(decodeURIComponent(location.hash.slice(1)));
}());
