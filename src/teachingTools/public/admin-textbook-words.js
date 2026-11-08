(function () {
  'use strict';
  var root = document.getElementById('lessonWordInput');
  if (!root) return;
  var base = '/admin/textbooks/lessons/' + root.dataset.lessonId;
  function $(id) { return document.getElementById(id); }
  function message(id, text) { $(id).textContent = text; $(id).hidden = !text; }
  function busy(value) { $('generateWords').disabled = value; $('saveGeneratedWords').disabled = value || !$('wordPreviewRows').children.length; }
  async function request(action, body) {
    var response = await fetch(base + '/words/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var result;
    try { result = await response.json(); } catch (error) { throw new Error('请求失败，请检查登录状态后重试。 / Request failed. Check your sign-in and try again.'); }
    if (!response.ok) throw new Error(result.error || '保存失败，请重试。 / Save failed. Please try again.');
    return result;
  }
  function row(item) {
    var element = document.createElement('div'); element.className = 'lesson-word-row';
    [{ key: 'zh', label: '中文 / Chinese', max: 100 }, { key: 'py', label: '拼音 / Pinyin', max: 200 },
      { key: 'en', label: '英文 / English', max: 200 }, { key: 'kind', label: '分类 / Kind', max: 20 }].forEach(function (field) {
      var label = document.createElement('label'); label.textContent = field.label;
      var input = document.createElement('input'); input.type = 'text'; input.name = field.key; input.value = item[field.key] || ''; input.maxLength = field.max;
      input.required = field.key === 'zh' || field.key === 'py';
      label.append(input); element.append(label);
    });
    var remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除 / Remove';
    remove.addEventListener('click', function () { element.remove(); busy(false); }); element.append(remove);
    $('wordPreviewRows').append(element);
  }
  $('generateWordsForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    if ($('wordPreviewRows').children.length && !window.confirm('重新生成会替换尚未保存的预览修改，继续吗？ / Replace the unsaved preview?')) return;
    busy(true); message('wordGenerationError', ''); message('wordGenerationStatus', '正在生成拼音和英文…… / Generating…');
    try {
      var result = await request('preview', { text: $('chineseWords').value });
      $('wordPreviewRows').replaceChildren(); result.items.forEach(row); $('wordPreviewForm').hidden = false;
      message('wordGenerationStatus', result.warning || '已生成，请核对后点击“确认添加到本课”。 / Ready for review. Confirm to add to this lesson.');
    } catch (error) { message('wordGenerationStatus', ''); message('wordGenerationError', error.message); }
    finally { busy(false); }
  });
  $('wordPreviewForm').addEventListener('submit', async function (event) {
    event.preventDefault(); busy(true); message('wordGenerationError', '');
    var items = Array.from($('wordPreviewRows').children).map(function (element) {
      var item = {}; element.querySelectorAll('input').forEach(function (input) { item[input.name] = input.value; }); return item;
    });
    try {
      var result = await request('save', { items: items });
      window.location.href = base + '/edit?wordsAdded=' + result.added + '&wordsSkipped=' + result.skipped + '#words';
    } catch (error) { message('wordGenerationError', error.message); busy(false); }
  });
}());
