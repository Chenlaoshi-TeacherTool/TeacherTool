(function () {
  'use strict';
  var root = document.getElementById('bookEditor');
  if (!root) return;
  var lessons = JSON.parse(document.getElementById('bookData').textContent);
  lessons.forEach(function (lesson) {
    lesson.savedWordCount = lesson.items.length;
    ['sentence_patterns', 'activities', 'games'].forEach(function (key) { lesson[key] = lesson[key] || ''; });
    lesson.is_published = Boolean(lesson.is_published);
    lesson.sort_order = lesson.sort_order || 0;
  });
  var fields = ['zh', 'py', 'en', 'kind'];
  var detailFields = ['sentence_patterns', 'activities', 'games', 'lesson_no', 'sort_order', 'is_published'];
  var labels = ['中文 / Chinese', '拼音 / Pinyin', '英文 / English', '类别 / Kind'];
  var selected = lessons.some(function (l) { return '#lesson-' + l.id === location.hash; }) ? Number(location.hash.slice(8)) : lessons.length ? lessons[0].id : null;
  var working = false;
  function status(text, error) { var el = document.getElementById('bookStatus'); el.textContent = text; el.dataset.error = Boolean(error); }
  function dirty(lesson) { lesson.dirty = true; clearPreview(); navigation(); }
  function button(text, action) { var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); return b; }
  function missing(lesson, field) { return lesson.items.filter(function (item) { return item.zh.trim() && !item[field].trim(); }).length; }
  function navigation() {
    var nav = document.getElementById('lessonNavigation'); nav.replaceChildren();
    function select(id) { selected = id; render(); }
    var all = button('显示全部课次', function () { select(null); }); all.setAttribute('aria-pressed', selected === null); nav.append(all);
    lessons.forEach(function (lesson) {
      var b = button('第' + (lesson.lesson_no == null ? '—' : lesson.lesson_no) + '课 · ' + lesson.title + ' · ' + lesson.items.length + '词\n缺英文 ' + missing(lesson, 'en') + ' · 缺拼音 ' + missing(lesson, 'py') + (lesson.dirty ? ' · 未保存' : ''), function () { select(lesson.id); });
      b.setAttribute('aria-pressed', selected === lesson.id); b.style.whiteSpace = 'pre-line'; nav.append(b);
    });
    root.querySelectorAll('[data-command$="-lesson"]').forEach(function (b) { b.disabled = working || selected === null; });
  }
  function row(lesson, item, tbody) {
    var tr = document.createElement('tr');
    fields.forEach(function (field, col) {
      var td = document.createElement('td'); var input = document.createElement('input'); input.type = 'text'; input.value = item[field] || ''; input.dataset.field = field;
      input.placeholder = field === 'en' ? '待补全' : labels[col]; input.maxLength = field === 'zh' ? 100 : field === 'kind' ? 20 : 200;
      input.setAttribute('aria-label', lesson.title + ' ' + labels[col]);
      input.addEventListener('input', function () { item[field] = input.value; dirty(lesson); });
      input.addEventListener('paste', function (event) {
        var text = event.clipboardData.getData('text/plain');
        if (!/[\t\r\n]/.test(text)) return;
        event.preventDefault();
        var start = lesson.items.indexOf(item);
        text.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach(function (line, offset) {
          var target = lesson.items[start + offset];
          if (!target) { target = { zh: '', py: '', en: '', kind: '' }; lesson.items.push(target); }
          line.split('\t').slice(0, 4 - col).forEach(function (value, i) { target[fields[col + i]] = value; });
        });
        dirty(lesson); render();
      });
      td.append(input); tr.append(td);
    });
    var td = document.createElement('td'); var remove = button('移除', function () { lesson.items.splice(lesson.items.indexOf(item), 1); dirty(lesson); render(); });
    remove.className = 'danger'; td.append(remove); tr.append(td); tbody.append(tr);
  }
  function render() {
    navigation(); var container = document.getElementById('bookLessons'); container.replaceChildren();
    lessons.filter(function (l) { return selected === null || l.id === selected; }).forEach(function (lesson) {
      var section = document.createElement('section'); section.className = 'book-lesson'; section.dataset.lessonId = lesson.id;
      var titleLabel = document.createElement('label'); titleLabel.textContent = '课题 / Lesson title';
      var titleInput = document.createElement('input'); titleInput.type = 'text'; titleInput.value = lesson.title; titleInput.maxLength = 200; titleInput.required = true; titleInput.dataset.lessonTitle = lesson.id;
      titleInput.addEventListener('input', function () { lesson.title = titleInput.value; dirty(lesson); });
      titleLabel.append(titleInput); section.append(titleLabel);
      [['lesson_no', '课号', 'number'], ['sort_order', '顺序', 'number'], ['sentence_patterns', '句子 / 句型（每行一句）', 'textarea'], ['activities', '活动（每行一条：名称 | 链接）', 'textarea'], ['games', '游戏（每行一条：名称 | 链接）', 'textarea'], ['is_published', '发布本课', 'checkbox']].forEach(function (field) {
        var label = document.createElement('label'); label.textContent = field[1];
        var input = document.createElement(field[2] === 'textarea' ? 'textarea' : 'input');
        if (field[2] !== 'textarea') input.type = field[2]; else { input.rows = 4; input.maxLength = 20000; }
        if (field[2] === 'checkbox') input.checked = Boolean(lesson[field[0]]); else input.value = lesson[field[0]] == null ? '' : lesson[field[0]];
        input.addEventListener('input', function () { lesson[field[0]] = field[2] === 'checkbox' ? input.checked : field[2] === 'number' ? (input.value === '' && field[0] === 'lesson_no' ? null : Number(input.value)) : input.value; dirty(lesson); });
        label.append(input); section.append(label);
      });
      var heading = document.createElement('h2'); heading.textContent = '词汇'; section.append(heading);
      var wrap = document.createElement('div'); wrap.className = 'book-table-wrap';
      var table = document.createElement('table'); var head = document.createElement('thead'); var hr = document.createElement('tr');
      labels.concat(['操作']).forEach(function (label) { var th = document.createElement('th'); th.textContent = label; hr.append(th); }); head.append(hr); table.append(head);
      var body = document.createElement('tbody'); lesson.items.forEach(function (item) { row(lesson, item, body); }); table.append(body); wrap.append(table); section.append(wrap);
      section.append(button('+ 新增词汇行', function () { lesson.items.push({ zh: '', py: '', en: '', kind: '' }); dirty(lesson); render(); }));
      var files = document.getElementById('lessonFiles-' + lesson.id); if (files) section.append(files.content.cloneNode(true));
      var removeForm = document.createElement('form'); removeForm.method = 'POST'; removeForm.action = '/admin/textbooks/lessons/' + lesson.id + '/delete';
      var removeLesson = document.createElement('button'); removeLesson.type = 'submit'; removeLesson.className = 'danger'; removeLesson.textContent = '删除本课'; removeForm.append(removeLesson); section.append(removeForm);
      container.append(section);
    });
    if (working) setBusy(true);
  }
  function setBusy(value) {
    working = value;
    root.querySelectorAll('input, button, textarea, select').forEach(function (el) { el.disabled = value; });
    // Changing the visible lesson is safe while a request is running.
    document.querySelectorAll('#lessonNavigation button').forEach(function (el) { el.disabled = false; });
    if (!value) navigation();
  }
  async function request(action, body) {
    var response = await fetch(root.dataset.base + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/vnd.cls-textbook+json' }, body: JSON.stringify(body) });
    var result;
    try { result = await response.json(); } catch (error) { throw new Error('请求失败，请检查登录状态。修改仍保留在页面中。'); }
    if (!response.ok) throw new Error(result.error || '请求失败，请重试。');
    return result;
  }
  function targets(scope) { return lessons.filter(function (l) { return scope === 'book' || l.id === selected; }); }
  async function generate(scope, field) {
    var chosen = targets(scope); var warnings = []; var filled = 0;
    for (var lesson of chosen) {
      var pending = lesson.items.filter(function (item) { return item.zh.trim() && !item[field].trim(); });
      if (!pending.length) continue;
      status('正在补全：' + lesson.title + '……');
      if (field === 'py') {
        pending.forEach(function (item) { item.py = window.pinyinPro.pinyin(item.zh); filled++; });
        dirty(lesson); continue;
      }
      var unique = Array.from(new Set(pending.map(function (item) { return item.zh.trim(); })));
      // Keep each request within the existing generation service's 60-word limit.
      for (var i = 0; i < unique.length; i += 60) {
        var result = await request('preview', { text: unique.slice(i, i + 60).join('\n') });
        if (result.warning) warnings.push(lesson.title + '：英文服务不可用或结果不完整，请重试或手动填写。');
        pending.forEach(function (item) {
          var generated = result.items.find(function (r) { return r.zh === item.zh.trim(); });
          if (!item.en.trim() && generated && generated.en) { item.en = generated.en; filled++; dirty(lesson); }
        });
        render();
      }
    }
    render();
    status('已补全 ' + filled + ' 项。请核对后保存。' + (warnings.length ? ' ' + Array.from(new Set(warnings)).join(' ') : ''), warnings.length > 0);
  }
  async function save(scope) {
    var changed = targets(scope).filter(function (l) { return l.dirty; });
    if (!changed.length) return status('没有需要保存的修改。');
    if (changed.some(function (l) { return !l.title.trim() || l.title.trim().length > 200; })) return status('课题不能为空，且不能超过200字。', true);
    if (changed.some(function (l) { return !l.items.length && l.savedWordCount > 0; }) && !window.confirm('有课次的词汇已全部移除，保存后将清空该课词汇。继续吗？')) return;
    status('正在保存……');
    var result = await request('save', { lessons: changed.map(function (l) { var payload = { id: l.id, title: l.title, revision: l.revision, items: l.items.map(function (item) {
      var clean = {}; fields.forEach(function (f) { clean[f] = item[f]; }); return clean;
    }) }; detailFields.forEach(function (f) { payload[f] = l[f]; }); return payload; }) });
    result.lessons.forEach(function (saved) { var lesson = lessons.find(function (l) { return l.id === saved.id; }); Object.assign(lesson, saved); lesson.savedWordCount = saved.items.length; lesson.dirty = false; });
    render(); status('已保存 ' + result.lessons.length + ' 课的修改。');
  }
  function exportChanges() {
    var rows = [['slug', 'zh', 'py', 'en', 'kind', 'title'].concat(detailFields)];
    lessons.forEach(function (l) {
      var metadata = [l.title].concat(detailFields.map(function (f) { return l[f]; }));
      l.items.forEach(function (item) { rows.push([l.slug].concat(fields.map(function (f) { return item[f]; }), metadata)); });
      if (!l.items.length) rows.push([l.slug, '', '', '', ''].concat(metadata));
    });
    var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (v) { var text = String(v || ''); if (/^[=+@-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); var a = document.createElement('a'); a.href = url; a.download = 'book-vocabulary-draft.csv'; a.click(); URL.revokeObjectURL(url);
    status('已导出当前课程内容 CSV，供备份；后台导入仍需使用 Excel 格式。');
  }
  var bulkKind = 'words', previewRows = null;
  function showView(view) {
    root.querySelectorAll('[data-panel]').forEach(function (panel) { panel.hidden = panel.dataset.panel !== view; });
    root.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === view); });
  }
  root.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { showView(b.dataset.view); }); });
  function clearPreview() { previewRows = null; document.getElementById('bulkResult').hidden = true; }
  function bulkFormat() {
    clearPreview();
    document.getElementById('bulkFormat').textContent = '列顺序：' + (document.getElementById('bulkScope').value === 'book' ? '课号 → ' : '') + (bulkKind === 'words' ? '中文 → 拼音（可空） → 英文（可空） → 类别（可空）。缺少拼音可在加入草稿后补全。' : '中文句子。句子沿用教材现有句型格式，每行一句。');
  }
  root.querySelectorAll('[data-bulk-kind]').forEach(function (b) { b.addEventListener('click', function () {
    bulkKind = b.dataset.bulkKind;
    root.querySelectorAll('[data-bulk-kind]').forEach(function (other) { other.setAttribute('aria-pressed', other === b); });
    bulkFormat();
  }); });
  document.getElementById('bulkScope').addEventListener('change', bulkFormat);
  document.getElementById('bulkText').addEventListener('input', clearPreview);
  document.getElementById('bulkPreview').addEventListener('click', function () {
    previewRows = window.textbookBulk.preview(document.getElementById('bulkText').value, lessons, document.getElementById('bulkScope').value, bulkKind);
    var tbody = document.getElementById('bulkRows'); tbody.replaceChildren();
    previewRows.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.lesson ? r.lesson.title : '第' + r.line + '行', r.zh, r.py, r.en, r.error || (r.duplicate ? '重复，跳过' : '新增')].forEach(function (value) { var td = document.createElement('td'); td.textContent = value; tr.append(td); });
      tbody.append(tr);
    });
    var invalid = previewRows.some(function (r) { return r.error; });
    var count = previewRows.filter(function (r) { return !r.error && !r.duplicate; }).length;
    document.getElementById('bulkSummary').textContent = '新增 ' + count + ' 条 · 重复 ' + previewRows.filter(function (r) { return r.duplicate; }).length + ' 条' + (invalid ? '。请修正错误后重新预览。' : '。已有内容保留。');
    document.getElementById('bulkApply').disabled = invalid || count === 0;
    document.getElementById('bulkResult').hidden = false;
  });
  document.getElementById('bulkApply').addEventListener('click', function () {
    if (!previewRows || previewRows.some(function (r) { return r.error; })) return;
    previewRows.filter(function (r) { return !r.duplicate; }).forEach(function (r) {
      if (bulkKind === 'words') r.lesson.items.push({ zh: r.zh, py: r.py, en: r.en, kind: r.kind });
      else r.lesson.sentence_patterns = [r.lesson.sentence_patterns || '', r.zh].filter(Boolean).join('\n');
      dirty(r.lesson);
    });
    clearPreview(); render(); status('已加入草稿，请核对并补全拼音后保存整册修改。');
  });
  root.addEventListener('submit', function (event) {
    if (working) { event.preventDefault(); return; }
    if (lessons.some(function (l) { return l.dirty; })) { event.preventDefault(); status('请先保存整册修改，再创建课程或操作附件。', true); return; }
    if (/\/delete$/.test(event.target.action) && !window.confirm('确认删除？此操作不能撤销。')) event.preventDefault();
  });
  root.addEventListener('click', async function (event) {
    var control = event.target.closest('[data-command]'); if (!control || working) return;
    var command = control.dataset.command;
    if (command === 'export') return exportChanges();
    setBusy(true);
    try {
      var parts = command.split('-');
      if (parts[0] === 'save') await save(parts[1]);
      else await generate(parts[1], parts[0] === 'english' ? 'en' : 'py');
    } catch (error) { render(); status(error.message + ' 未保存的修改仍保留。', true); }
    finally { setBusy(false); }
  });
  window.addEventListener('beforeunload', function (event) { if (working || lessons.some(function (l) { return l.dirty; })) { event.preventDefault(); event.returnValue = ''; } });
  render(); bulkFormat();
  if (location.hash === '#new-lesson') document.getElementById('new-lesson').open = true;
  status('切换区域或课程不会丢失草稿；批量输入后请统一保存。');
})();
