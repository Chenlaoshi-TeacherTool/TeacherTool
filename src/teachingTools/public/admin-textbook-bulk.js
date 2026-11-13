(function (root) {
  'use strict';
  function preview(text, lessons, scope, kind) {
    var rows = [], seen = new Set();
    text.replace(/\r/g, '').split('\n').forEach(function (line, index) {
      if (!line.trim()) return;
      var cells = line.split('\t').map(function (s) { return s.trim(); });
      var matches = scope === 'book' ? lessons.filter(function (l) { return l.lesson_no != null && String(l.lesson_no) === cells[0]; }) : lessons.filter(function (l) { return String(l.id) === scope; });
      if (scope === 'book') cells.shift();
      var row = { line: index + 1, lesson: matches.length === 1 ? matches[0] : null, zh: cells[0] || '', py: cells[1] || '', en: cells[2] || '', kind: cells[3] || '', error: '', duplicate: false };
      if (!row.lesson) row.error = matches.length > 1 ? '课号重复，请选择指定课程' : '找不到课号，请先添加课程';
      else if (!row.zh) row.error = '中文不能为空';
      else if (cells.length > (kind === 'words' ? 4 : 1)) row.error = '列数不正确';
      else if (kind === 'words' && (row.zh.length > 100 || row.py.length > 200 || row.en.length > 200 || row.kind.length > 20)) row.error = '内容超过字段长度限制';
      if (row.lesson && !row.error) {
        var key = row.lesson.id + ':' + row.zh;
        var existing = kind === 'words' ? row.lesson.items.map(function (i) { return i.zh.trim(); }) : (row.lesson.sentence_patterns || '').split(/\r?\n/).map(function (s) { return s.trim(); });
        row.duplicate = seen.has(key) || existing.includes(row.zh);
        seen.add(key);
      }
      rows.push(row);
    });
    lessons.forEach(function (lesson) {
      var added = rows.filter(function (r) { return r.lesson === lesson && !r.error && !r.duplicate; });
      if (kind === 'words' && lesson.items.length + added.length > 500) added.forEach(function (r) { r.error = '本课词汇不能超过500条'; });
      if (kind === 'sentences' && [lesson.sentence_patterns || ''].concat(added.map(function (r) { return r.zh; })).join('\n').length > 20000) added.forEach(function (r) { r.error = '本课句子总长度超过限制'; });
    });
    return rows;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { preview: preview };
  else root.textbookBulk = { preview: preview };
})(typeof window === 'undefined' ? globalThis : window);
