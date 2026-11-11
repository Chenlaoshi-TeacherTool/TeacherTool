const test = require('node:test');
const assert = require('node:assert/strict');
const presentation = require('../services/materialPresentation');

test('download buttons use format defaults and localized custom text', function () {
  assert.deepEqual(presentation.download({ name: 'long-original-name.docx' }, 'zh'), { title: 'Word', note: '可以编辑' });
  assert.deepEqual(presentation.download({ name: 'a.pdf', label: '任务卡', labelEn: 'Task cards', note: '打印后剪开', noteEn: 'Print and cut' }, 'en'), { title: 'Task cards', note: 'Print and cut' });
});
