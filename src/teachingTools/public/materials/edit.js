(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('materialData').textContent);
  var selected = new Set(data.selected);
  function $(id) { return document.getElementById(id); }
  function L(en, zh) { return data.lang === 'zh' ? zh : en; }
  function series(key) { return data.series.find(function (item) { return item.key === key; }); }
  function book(key, slug) { var s = series(key); return s && (s.books || []).find(function (b) { return b.slug === slug; }); }
  function options(select, values) {
    select.replaceChildren();
    values.forEach(function (item) { select.add(new Option(item.label, item.value)); });
    select.disabled = !values.length;
  }
  function books() {
    var s = series($('series').value);
    options($('book'), (s && s.books || []).filter(function (b) { return data.catalog.some(function (l) { return l.series === s.key && l.book === b.slug; }); }).map(function (b) { return { value: b.slug, label: L(b.en, b.zh) }; }));
    lessons();
  }
  function lessons() {
    options($('lesson'), data.catalog.filter(function (l) { return l.series === $('series').value && l.book === $('book').value; }).map(function (l) { return { value: l.id, label: L('Lesson ' + l.lessonNo, '第' + l.lessonNo + '课') + ' · ' + l.title }; }));
    $('addLesson').disabled = $('lesson').disabled;
  }
  function links() {
    $('lessonLinks').replaceChildren();
    selected.forEach(function (id) {
      var l = data.catalog.find(function (lesson) { return lesson.id === id; });
      if (!l) return;
      var s = series(l.series), b = book(l.series, l.book);
      var li = document.createElement('li');
      var input = document.createElement('input'); input.type = 'hidden'; input.name = 'lessons'; input.value = id;
      li.textContent = (s ? L(s.en, s.zh) : l.series) + ' · ' + (b ? L(b.en, b.zh) : l.book) + ' · ' + l.title + ' ';
      var remove = document.createElement('button'); remove.type = 'button'; remove.textContent = L('Remove', '移除');
      remove.addEventListener('click', function () { selected.delete(id); links(); });
      li.append(input, remove); $('lessonLinks').append(li);
    });
  }
  options($('series'), data.series.filter(function (s) { return data.catalog.some(function (l) { return l.series === s.key; }); }).map(function (s) { return { value: s.key, label: L(s.en, s.zh) }; }));
  $('noLessons').hidden = data.catalog.length > 0;
  $('series').addEventListener('change', books); $('book').addEventListener('change', lessons);
  $('addLesson').addEventListener('click', function () { if ($('lesson').value) selected.add(Number($('lesson').value)); links(); });
  books(); links();
  $('materialForm').addEventListener('submit', async function (event) {
    event.preventDefault(); $('materialError').hidden = true; $('saveMaterial').disabled = true;
    try {
      if (!event.target.querySelector('input[name="themes"]:checked')) throw new Error(L('Choose at least one theme.', '请至少选择一个主题。'));
      var response = await fetch(event.target.action, { method: 'POST', body: new FormData(event.target) });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.href = result.url;
    } catch (error) {
      $('materialError').textContent = error.message || L('Save failed. Please try again.', '保存失败，请重试。');
      $('materialError').hidden = false; $('saveMaterial').disabled = false;
    }
  });
}());
