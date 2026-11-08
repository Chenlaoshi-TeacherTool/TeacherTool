(function () {
  'use strict';
  var root = document.getElementById('bookEditor');
  if (!root) return;
  var lessons = JSON.parse(document.getElementById('bookData').textContent);
  var fields = ['zh', 'py', 'en', 'kind'];
  var labels = ['中文 / Chinese', '拼音 / Pinyin', '英文 / English', '类别 / Kind'];
  var selected = lessons.some(function (l) { return '#lesson-' + l.id === location.hash; }) ? Number(location.hash.slice(8)) : lessons[0].id;
  var working = false;
  function status(text, error) { var el = document.getElementById('bookStatus'); el.textContent = text; el.dataset.error = Boolean(error); }
  function dirty(lesson) { lesson.dirty = true; navigation(); }
  function button(text, action) { var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); return b; }
  function missing(lesson, field) { return lesson.items.filter(function (item) { return item.zh.trim() && !item[field].trim(); }).length; }
  function navigation() {
    var nav = document.getElementById('lessonNavigation'); nav.replaceChildren();
    function select(id) { selected = id; render(); }
    var all = button('显示全部课次', function () { select(null); }); all.setAttribute('aria-pressed', selected === null); nav.append(all);
    lessons.forEach(function (lesson) {
      var b = button(lesson.title + ' · ' + lesson.items.length + '条\n缺英文 ' + missing(lesson, 'en') + ' · 缺拼音 ' + missing(lesson, 'py') + (lesson.dirty ? ' · 未保存' : ''), function () { select(lesson.id); });
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
      var heading = document.createElement('h2'); heading.textContent = lesson.title; section.append(heading);
      var link = document.createElement('a'); link.href = '/admin/textbooks/lessons/' + lesson.id + '/edit'; link.textContent = '编辑课题、句型、活动与附件'; section.append(link);
      var wrap = document.createElement('div'); wrap.className = 'book-table-wrap';
      var table = document.createElement('table'); var head = document.createElement('thead'); var hr = document.createElement('tr');
      labels.concat(['操作']).forEach(function (label) { var th = document.createElement('th'); th.textContent = label; hr.append(th); }); head.append(hr); table.append(head);
      var body = document.createElement('tbody'); lesson.items.forEach(function (item) { row(lesson, item, body); }); table.append(body); wrap.append(table); section.append(wrap);
      section.append(button('+ 新增词汇行', function () { lesson.items.push({ zh: '', py: '', en: '', kind: '' }); dirty(lesson); render(); }));
      container.append(section);
    });
    if (working) setBusy(true);
  }
  function setBusy(value) {
    working = value;
    root.querySelectorAll('input, button').forEach(function (el) { el.disabled = value; });
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
    if (changed.some(function (l) { return !l.items.length; }) && !window.confirm('有课次的词汇已全部移除，保存后将清空该课词汇。继续吗？')) return;
    status('正在保存……');
    var result = await request('save', { lessons: changed.map(function (l) { return { id: l.id, revision: l.revision, items: l.items.map(function (item) {
      var clean = {}; fields.forEach(function (f) { clean[f] = item[f]; }); return clean;
    }) }; }) });
    result.lessons.forEach(function (saved) { var lesson = lessons.find(function (l) { return l.id === saved.id; }); lesson.items = saved.items; lesson.revision = saved.revision; lesson.dirty = false; });
    render(); status('已保存 ' + result.lessons.length + ' 课的修改。');
  }
  function exportChanges() {
    var rows = [['slug', 'zh', 'py', 'en', 'kind']];
    lessons.forEach(function (l) { l.items.forEach(function (item) { rows.push([l.slug].concat(fields.map(function (f) { return item[f]; }))); }); });
    var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (v) { var text = String(v || ''); if (/^[=+@-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); var a = document.createElement('a'); a.href = url; a.download = 'book-vocabulary-draft.csv'; a.click(); URL.revokeObjectURL(url);
    status('已导出当前词汇 CSV，供备份；后台导入仍需使用 Excel 格式。');
  }
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
  render(); status('可切换课次或显示全部；支持从 Excel 粘贴多行、四列词汇。');
})();
