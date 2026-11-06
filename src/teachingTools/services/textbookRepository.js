'use strict';

// Reads published textbook lessons for the public /textbook-companion pages,
// and the lesson files table (dbo.textbook_lesson_files, migration 0010).
// Lessons themselves are edited in routes/admin.js.

var db = require('./sqlClient');

function splitLines(value) {
  return String(value || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
}

// "text | link" lines (activities, games). Only site paths and https links become links.
function linkLines(value) {
  return splitLines(value).map(function (line) {
    var parts = line.split(/\s*[|｜]\s*/);
    var href = parts.length > 1 ? parts[parts.length - 1] : '';
    var safe = /^\/(?!\/)/.test(href) || /^https:\/\//i.test(href);
    return { text: safe ? parts.slice(0, -1).join(' | ') : line, href: safe ? href : '' };
  });
}

function fileRow(row) {
  return { id: row.id, lessonId: row.lesson_id, title: row.title, fileName: row.file_name, blobName: row.blob_name,
    contentType: row.content_type, size: row.size_bytes, sortOrder: row.sort_order };
}

// Published lessons of one book with their word and file counts, in book order.
async function listLessons(series, book) {
  var pool = await db.getPool();
  var result = await pool.request().input('series', db.sql.NVarChar(40), series).input('book', db.sql.NVarChar(40), book).query(
    'SELECT tl.id, tl.slug, tl.lesson_no, tl.title, ' +
    '(SELECT COUNT(*) FROM textbook_lesson_items i WHERE i.lesson_id = tl.id) AS word_count, ' +
    '(SELECT COUNT(*) FROM dbo.textbook_lesson_files f WHERE f.lesson_id = tl.id) AS file_count ' +
    'FROM textbook_lessons tl WHERE tl.series = @series AND tl.book_slug = @book AND tl.is_published = 1 ORDER BY tl.sort_order, tl.id;'
  );
  return result.recordset.map(function (row) {
    return { id: row.id, slug: row.slug, lessonNo: row.lesson_no, title: row.title, wordCount: row.word_count, fileCount: row.file_count };
  });
}

// Lesson counts per book of a series: { 'book-1': 12, ... }.
async function countLessons(series) {
  var pool = await db.getPool();
  var result = await pool.request().input('series', db.sql.NVarChar(40), series).query(
    'SELECT book_slug, COUNT(*) AS lessons FROM textbook_lessons WHERE series = @series AND is_published = 1 GROUP BY book_slug;'
  );
  var counts = {};
  result.recordset.forEach(function (row) { counts[row.book_slug] = row.lessons; });
  return counts;
}

// One published lesson with its words and files, or null.
async function getLesson(series, book, slug) {
  var pool = await db.getPool();
  var lessonResult = await pool.request().input('series', db.sql.NVarChar(40), series).input('book', db.sql.NVarChar(40), book)
    .input('slug', db.sql.NVarChar(100), slug).query(
      'SELECT id, slug, lesson_no, title, sentence_patterns, activities, games FROM textbook_lessons ' +
      'WHERE series = @series AND book_slug = @book AND slug = @slug AND is_published = 1;'
    );
  var row = lessonResult.recordset[0];
  if (!row) return null;
  var items = await pool.request().input('id', db.sql.Int, row.id).query(
    'SELECT zh, py, en, kind FROM textbook_lesson_items WHERE lesson_id = @id ORDER BY sort_order, id;'
  );
  return {
    id: row.id, slug: row.slug, lessonNo: row.lesson_no, title: row.title,
    patterns: splitLines(row.sentence_patterns), activities: linkLines(row.activities), games: linkLines(row.games),
    words: items.recordset.map(function (item) { return { zh: item.zh, py: item.py, en: item.en || '', kind: item.kind || '' }; }),
    files: await listFiles(row.id)
  };
}

async function listFiles(lessonId) {
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.Int, lessonId).query(
    'SELECT * FROM dbo.textbook_lesson_files WHERE lesson_id = @id ORDER BY sort_order, id;'
  );
  return result.recordset.map(fileRow);
}

// A file with the lesson it belongs to (series, book, slug, published), or null.
async function getFile(id) {
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.Int, id).query(
    'SELECT f.*, tl.series, tl.book_slug, tl.slug AS lesson_slug, tl.is_published FROM dbo.textbook_lesson_files f ' +
    'JOIN textbook_lessons tl ON tl.id = f.lesson_id WHERE f.id = @id;'
  );
  var row = result.recordset[0];
  if (!row) return null;
  return Object.assign(fileRow(row), { series: row.series, book: row.book_slug, lessonSlug: row.lesson_slug, published: Boolean(row.is_published) });
}

async function addFile(lessonId, file) {
  var pool = await db.getPool();
  await pool.request().input('lesson', db.sql.Int, lessonId).input('title', db.sql.NVarChar(200), file.title)
    .input('fileName', db.sql.NVarChar(200), file.fileName).input('blob', db.sql.VarChar(200), file.blobName)
    .input('type', db.sql.VarChar(120), file.contentType).input('size', db.sql.Int, file.size).query(
      'INSERT INTO dbo.textbook_lesson_files (lesson_id, title, file_name, blob_name, content_type, size_bytes, sort_order) ' +
      'VALUES (@lesson, @title, @fileName, @blob, @type, @size, (SELECT ISNULL(MAX(sort_order), -1) + 1 FROM dbo.textbook_lesson_files WHERE lesson_id = @lesson));'
    );
}

// Deletes the row and returns its blob name (so the file can be removed too), or null.
async function deleteFile(lessonId, fileId) {
  var pool = await db.getPool();
  var result = await pool.request().input('lesson', db.sql.Int, lessonId).input('id', db.sql.Int, fileId).query(
    'DELETE FROM dbo.textbook_lesson_files OUTPUT DELETED.blob_name WHERE id = @id AND lesson_id = @lesson;'
  );
  return result.recordset[0] ? result.recordset[0].blob_name : null;
}

module.exports = { linkLines: linkLines, listLessons: listLessons, countLessons: countLessons, getLesson: getLesson, listFiles: listFiles,
  getFile: getFile, addFile: addFile, deleteFile: deleteFile };
