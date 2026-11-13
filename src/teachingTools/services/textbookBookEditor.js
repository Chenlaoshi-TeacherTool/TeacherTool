'use strict';

var crypto = require('crypto');
var fields = { zh: 100, py: 200, en: 200, kind: 20 };
var detailFields = ['sentence_patterns', 'activities', 'games', 'lesson_no', 'sort_order', 'is_published'];
function details(lesson) {
  return detailFields.map(function (key) { return lesson && lesson[key] != null ? lesson[key] : null; });
}
function fail(status, message) { var error = new Error(message); error.status = status; throw error; }
function revision(items, title, lesson) {
  return crypto.createHash('sha256').update(JSON.stringify([title, details(lesson), items.map(function (item) {
    return [item.id, item.zh, item.py, item.en || '', item.kind || '', item.sort_order];
  })])).digest('hex');
}
function validate(lessons) {
  if (!Array.isArray(lessons) || !lessons.length || lessons.length > 200) fail(400, '请选择要保存的课次。');
  var seen = new Set();
  return lessons.map(function (lesson) {
    if (!lesson || !Number.isInteger(lesson.id) || seen.has(lesson.id) || typeof lesson.revision !== 'string' || !Array.isArray(lesson.items) || lesson.items.length > 500) fail(400, '课次或词汇格式不正确。');
    seen.add(lesson.id);
    if (typeof lesson.title !== 'string' || !lesson.title.trim() || lesson.title.trim().length > 200) fail(400, '课题不能为空，且不能超过200字。');
    var words = new Set();
    var items = lesson.items.map(function (item) {
      var clean = {};
      Object.keys(fields).forEach(function (key) {
        var value = item && item[key];
        if (value == null && (key === 'en' || key === 'kind')) value = '';
        if (typeof value !== 'string' || value.trim().length > fields[key] || ((key === 'zh' || key === 'py') && !value.trim())) fail(400, '请检查中文、拼音及各栏字数；中文和拼音必填。');
        clean[key] = value.trim();
      });
      if (words.has(clean.zh)) fail(400, '同一课不能有重复词语：' + clean.zh);
      words.add(clean.zh); return clean;
    });
    var clean = { id: lesson.id, title: lesson.title.trim(), revision: lesson.revision, items: items };
    detailFields.forEach(function (key) {
      if (lesson[key] === undefined) return;
      var value = lesson[key];
      if (key === 'is_published') {
        if (typeof value !== 'boolean') fail(400, '发布状态格式不正确。');
      } else if (key === 'lesson_no' || key === 'sort_order') {
        if (!(key === 'lesson_no' && value === null) && (!Number.isInteger(value) || Math.abs(value) > 2147483647)) fail(400, '课号和顺序必须为整数。');
      } else {
        if (typeof value !== 'string' || value.length > 20000) fail(400, '句子、活动或游戏内容过长。');
        value = value.trim();
      }
      clean[key] = value;
    });
    return clean;
  }).sort(function (a, b) { return a.id - b.id; });
}

function create(options) {
  options = options || {};
  var db = options.db || require('./sqlClient');
  async function load(series, book) {
    var pool = await db.getPool();
    var lessons = (await pool.request().input('series', db.sql.NVarChar, series).input('book', db.sql.NVarChar, book)
      .query('SELECT id, slug, book_name, lesson_no, sort_order, title, sentence_patterns, activities, games, is_published FROM textbook_lessons WHERE series=@series AND book_slug=@book ORDER BY sort_order, id')).recordset;
    var items = (await pool.request().input('series', db.sql.NVarChar, series).input('book', db.sql.NVarChar, book)
      .query('SELECT i.* FROM textbook_lesson_items i JOIN textbook_lessons l ON l.id=i.lesson_id WHERE l.series=@series AND l.book_slug=@book ORDER BY i.sort_order, i.id')).recordset;
    return lessons.map(function (lesson) {
      lesson.items = items.filter(function (item) { return item.lesson_id === lesson.id; });
      lesson.revision = revision(lesson.items, lesson.title, lesson); return lesson;
    });
  }
  async function save(series, book, lessons) {
    lessons = validate(lessons);
    var tx = new db.sql.Transaction(await db.getPool());
    await tx.begin();
    try {
      // Lock and check every selected lesson before changing any vocabulary.
      for (var lesson of lessons) {
        var found = await new db.sql.Request(tx).input('id', db.sql.Int, lesson.id).input('series', db.sql.NVarChar, series).input('book', db.sql.NVarChar, book)
          .query('SELECT * FROM textbook_lessons WITH (UPDLOCK, HOLDLOCK) WHERE id=@id AND series=@series AND book_slug=@book');
        if (!found.recordset.length) fail(404, '课次不存在或不属于本册。');
        var current = (await new db.sql.Request(tx).input('id', db.sql.Int, lesson.id)
          .query('SELECT * FROM textbook_lesson_items WITH (UPDLOCK, HOLDLOCK) WHERE lesson_id=@id ORDER BY sort_order, id')).recordset;
        if (revision(current, found.recordset[0].title, found.recordset[0]) !== lesson.revision) fail(409, '课程内容已在其他窗口修改。当前修改仍保留，请先导出修改，再刷新核对。');
        detailFields.forEach(function (key) { if (lesson[key] === undefined) lesson[key] = found.recordset[0][key] == null ? null : found.recordset[0][key]; });
      }
      for (var entry of lessons) {
        var update = new db.sql.Request(tx).input('id', db.sql.Int, entry.id).input('title', db.sql.NVarChar(200), entry.title);
        detailFields.forEach(function (key) { update.input(key, key === 'is_published' ? db.sql.Bit : key === 'lesson_no' || key === 'sort_order' ? db.sql.Int : db.sql.NVarChar(db.sql.MAX), entry[key]); });
        await update.query('UPDATE textbook_lessons SET title=@title, sentence_patterns=@sentence_patterns, activities=@activities, games=@games, lesson_no=@lesson_no, sort_order=@sort_order, is_published=@is_published, updated_at=SYSUTCDATETIME() WHERE id=@id');
        await new db.sql.Request(tx).input('id', db.sql.Int, entry.id).query('DELETE FROM textbook_lesson_items WHERE lesson_id=@id');
        if (!entry.items.length) continue;
        var table = new db.sql.Table('textbook_lesson_items');
        table.columns.add('lesson_id', db.sql.Int, { nullable: false });
        Object.keys(fields).forEach(function (key) { table.columns.add(key, db.sql.NVarChar(fields[key]), { nullable: key === 'kind' }); });
        table.columns.add('sort_order', db.sql.Int, { nullable: false });
        entry.items.forEach(function (item, i) { table.rows.add(entry.id, item.zh, item.py, item.en, item.kind || null, i); });
        await new db.sql.Request(tx).bulk(table);
      }
      var saved = [];
      for (var changed of lessons) {
        var rows = (await new db.sql.Request(tx).input('id', db.sql.Int, changed.id).query('SELECT * FROM textbook_lesson_items WHERE lesson_id=@id ORDER BY sort_order, id')).recordset;
        saved.push(Object.assign({}, changed, { revision: revision(rows, changed.title, changed), items: rows }));
      }
      await tx.commit(); return { lessons: saved };
    } catch (error) { await tx.rollback(); throw error; }
  }
  return { load: load, save: save };
}
module.exports = create();
module.exports.create = create;
module.exports.revision = revision;
module.exports.validate = validate;
