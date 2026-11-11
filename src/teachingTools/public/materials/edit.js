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
  function refreshSeries() {
    options($('series'), data.series.filter(function (s) { return data.catalog.some(function (l) { return l.series === s.key; }); }).map(function (s) { return { value: s.key, label: L(s.en, s.zh) }; }));
    $('noLessons').hidden = data.catalog.length > 0;
    books(); links();
  }
  $('series').addEventListener('change', books); $('book').addEventListener('change', lessons);
  $('addLesson').addEventListener('click', function () { if ($('lesson').value) selected.add(Number($('lesson').value)); links(); });
  refreshSeries();
  if ($('newTheme')) {
    $('newTheme').addEventListener('click', function () { $('themeDialog').showModal(); });
    $('cancelTheme').addEventListener('click', function () { $('themeDialog').close(); });
    $('themeForm').addEventListener('submit', async function (event) {
      event.preventDefault(); $('themeError').hidden = true; $('saveTheme').disabled = true;
      try {
        var response = await fetch(event.target.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error);
        var label = document.createElement('label');
        var checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'themes'; checkbox.value = result.key; checkbox.checked = true;
        label.append(checkbox, document.createTextNode(' ' + L(result.en, result.zh))); $('themeChoices').append(label);
        $('themeDialog').close(); event.target.reset(); checkbox.focus();
      } catch (error) { $('themeError').textContent = error.message || L('Save failed.', '保存失败。'); $('themeError').hidden = false; }
      finally { $('saveTheme').disabled = false; }
    });
    $('refreshTextbooks').addEventListener('click', async function () {
      $('refreshTextbooks').disabled = true;
      try {
        var response = await fetch('/admin/materials/catalog');
        if (!response.ok) throw new Error(L('Refresh failed.', '刷新失败。'));
        var result = await response.json(); data.series = result.series; data.catalog = result.catalog; refreshSeries();
      } catch (error) { $('materialError').textContent = error.message; $('materialError').hidden = false; }
      finally { $('refreshTextbooks').disabled = false; }
    });
  }
  if ($('productLinks')) {
    var productLinks = data.linkedProducts.slice();
    function renderProducts() {
      $('productLinks').replaceChildren();
      productLinks.forEach(function (link, index) {
        var product = data.products.find(function (p) { return p.slug === link.slug; });
        var box = document.createElement('fieldset');
        var title = document.createElement('legend'); title.textContent = product ? product.title : link.slug; box.append(title);
        ['usage', 'usageEn'].forEach(function (key) {
          var label = document.createElement('label'); label.textContent = key === 'usage' ? '配套玩法（中文）' : 'Use with this activity (English)';
          var input = document.createElement('textarea'); input.rows = 3; input.maxLength = 2000; input.value = link[key] || '';
          input.addEventListener('input', function () { link[key] = input.value; }); label.append(input); box.append(label);
        });
        [['↑', -1], ['↓', 1], [L('Remove', '移除'), 0]].forEach(function (action) {
          var button = document.createElement('button'); button.type = 'button'; button.textContent = action[0];
          button.disabled = action[1] === -1 && index === 0 || action[1] === 1 && index === productLinks.length - 1;
          button.addEventListener('click', function () {
            productLinks.splice(index, 1); if (action[1]) productLinks.splice(index + action[1], 0, link); renderProducts();
          }); box.append(button);
        });
        $('productLinks').append(box);
      });
    }
    $('addProduct').addEventListener('click', function () {
      var slug = $('productChoice').value;
      if (slug && !productLinks.some(function (p) { return p.slug === slug; })) productLinks.push({ slug: slug, usage: '', usageEn: '' });
      renderProducts();
    });
    renderProducts();
    $('materialForm').addEventListener('submit', function () { $('productsField').value = JSON.stringify(productLinks); });
  }
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
