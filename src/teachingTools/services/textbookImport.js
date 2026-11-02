'use strict';

/*
 * Excel round trip for /admin/textbooks.
 *
 * A workbook has two sheets:
 *   课程 (lessons): slug, series, book_slug, book_name, sort_order, lesson_no,
 *                   title, sentence_patterns, activities
 *   生词 (words):   slug, zh, py, en, kind
 * Chinese headers (课题, 句型, 活动建议, 册, 排序, 课号) and the column names of
 * the original review workbook (word_list_slug, note) are accepted too.
 *
 * Importing upserts lessons by slug. Every lesson that has rows in the 生词
 * sheet gets its words replaced by those rows; lessons without word rows keep
 * the words they have. Nothing is written if any row has an error.
 */

var textbooks = require('../config/textbooks');

var LESSON_COLUMNS = {
  slug: ['slug', 'word_list_slug', 'lesson_slug'],
  series: ['series'],
  book_slug: ['book_slug'],
  book_name: ['book_name', '册'],
  sort_order: ['sort_order', '排序'],
  lesson_no: ['lesson_no', '课号'],
  title: ['title', '课题'],
  sentence_patterns: ['sentence_patterns', '句型'],
  activities: ['activities', '活动建议']
};

var ITEM_COLUMNS = {
  slug: ['slug', 'lesson_slug'],
  zh: ['zh'],
  py: ['py'],
  en: ['en'],
  kind: ['kind', 'note']
};

function cellText(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  return String(cell.text != null ? cell.text : cell.value).trim();
}

function headerIndex(worksheet) {
  var index = {};
  worksheet.getRow(1).eachCell({ includeEmpty: false }, function (cell, col) {
    var key = cellText(cell).toLowerCase();
    if (key && !index[key]) index[key] = col;
  });
  return index;
}

function readSheet(worksheet, columns) {
  var index = headerIndex(worksheet);
  var colFor = {};
  Object.keys(columns).forEach(function (field) {
    var name = columns[field].find(function (alias) { return index[alias.toLowerCase()]; });
    if (name) colFor[field] = index[name.toLowerCase()];
  });
  var rows = [];
  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    if (rowNumber === 1) return;
    var record = { rowNumber: rowNumber };
    Object.keys(columns).forEach(function (field) {
      record[field] = colFor[field] ? cellText(row.getCell(colFor[field])) : '';
    });
    if (Object.keys(columns).some(function (field) { return record[field]; })) rows.push(record);
  });
  return { rows: rows, columns: colFor };
}

function findSheet(workbook, name, requiredHeader) {
  var byName = workbook.worksheets.find(function (sheet) { return sheet.name === name; });
  if (byName) return byName;
  return workbook.worksheets.find(function (sheet) { return headerIndex(sheet)[requiredHeader]; });
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).join('\n');
}

function toInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  var number = Number(value);
  return Number.isInteger(number) ? number : NaN;
}

// Reads a workbook into { lessons, itemsBySlug, errors }. existingSlugs lets
// the 生词 sheet refer to lessons that are already in the database.
function readWorkbook(workbook, existingSlugs) {
  var errors = [];
  var lessons = [];
  var itemsBySlug = {};
  var lessonSheet = findSheet(workbook, '课程', 'series');
  var itemSheet = findSheet(workbook, '生词', 'zh');
  if (!lessonSheet && !itemSheet) {
    return { lessons: lessons, itemsBySlug: itemsBySlug, errors: ['No 课程 or 生词 sheet found.'] };
  }

  var seen = {};
  if (lessonSheet) {
    readSheet(lessonSheet, LESSON_COLUMNS).rows.forEach(function (row) {
      var where = lessonSheet.name + ' row ' + row.rowNumber + ': ';
      var lesson = {
        slug: row.slug,
        series: row.series,
        book_slug: row.book_slug,
        book_name: row.book_name,
        sort_order: toInt(row.sort_order),
        lesson_no: toInt(row.lesson_no),
        title: row.title,
        sentence_patterns: lines(row.sentence_patterns),
        activities: lines(row.activities)
      };
      if (!lesson.slug) return errors.push(where + 'slug is empty.');
      if (seen[lesson.slug]) return errors.push(where + 'slug ' + lesson.slug + ' appears twice.');
      if (!textbooks.findSeries(lesson.series)) return errors.push(where + 'unknown series "' + lesson.series + '".');
      if (!lesson.book_slug || !lesson.book_name) return errors.push(where + 'book_slug and book name are required.');
      if (!lesson.title) return errors.push(where + 'title is empty.');
      if (Number.isNaN(lesson.sort_order) || Number.isNaN(lesson.lesson_no)) return errors.push(where + 'sort_order and lesson_no must be whole numbers.');
      if (lesson.sort_order === null) lesson.sort_order = 0;
      seen[lesson.slug] = true;
      lessons.push(lesson);
    });
  }

  if (itemSheet) {
    readSheet(itemSheet, ITEM_COLUMNS).rows.forEach(function (row) {
      var where = itemSheet.name + ' row ' + row.rowNumber + ': ';
      if (!row.slug) return errors.push(where + 'slug is empty.');
      if (!seen[row.slug] && !(existingSlugs && existingSlugs[row.slug])) return errors.push(where + 'no lesson with slug ' + row.slug + '.');
      if (!row.zh) return errors.push(where + 'zh is empty.');
      if (!row.py) return errors.push(where + 'py is empty for ' + row.zh + '.');
      if (row.zh.length > 100 || row.py.length > 200 || row.en.length > 200) return errors.push(where + 'a value is too long.');
      var list = itemsBySlug[row.slug] = itemsBySlug[row.slug] || [];
      if (list.some(function (item) { return item.zh === row.zh; })) return;
      list.push({ zh: row.zh, py: row.py, en: row.en, kind: row.kind || null });
    });
  }

  return { lessons: lessons, itemsBySlug: itemsBySlug, errors: errors };
}

async function existingLessonIds(pool) {
  var result = await pool.request().query('SELECT id, slug FROM textbook_lessons');
  var ids = {};
  result.recordset.forEach(function (row) { ids[row.slug] = row.id; });
  return ids;
}

// Writes a parsed workbook in one transaction and returns counts.
async function applyImport(pool, sql, parsed) {
  var ids = await existingLessonIds(pool);
  var counts = { lessonsCreated: 0, lessonsUpdated: 0, lessonsWithWords: 0, words: 0 };
  var transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (var lesson of parsed.lessons) {
      var request = new sql.Request(transaction)
        .input('slug', sql.NVarChar, lesson.slug)
        .input('series', sql.NVarChar, lesson.series)
        .input('bookSlug', sql.NVarChar, lesson.book_slug)
        .input('bookName', sql.NVarChar, lesson.book_name)
        .input('sortOrder', sql.Int, lesson.sort_order)
        .input('lessonNo', sql.Int, lesson.lesson_no)
        .input('title', sql.NVarChar, lesson.title)
        .input('patterns', sql.NVarChar, lesson.sentence_patterns || null)
        .input('activities', sql.NVarChar, lesson.activities || null);
      if (ids[lesson.slug]) {
        await request.input('id', sql.Int, ids[lesson.slug]).query(
          'UPDATE textbook_lessons SET series=@series, book_slug=@bookSlug, book_name=@bookName, sort_order=@sortOrder, lesson_no=@lessonNo, ' +
          'title=@title, sentence_patterns=@patterns, activities=@activities, updated_at=SYSUTCDATETIME() WHERE id=@id');
        counts.lessonsUpdated++;
      } else {
        var created = await request.query(
          'INSERT INTO textbook_lessons (slug, series, book_slug, book_name, sort_order, lesson_no, title, sentence_patterns, activities) ' +
          'OUTPUT INSERTED.id VALUES (@slug, @series, @bookSlug, @bookName, @sortOrder, @lessonNo, @title, @patterns, @activities)');
        ids[lesson.slug] = created.recordset[0].id;
        counts.lessonsCreated++;
      }
    }

    var slugs = Object.keys(parsed.itemsBySlug);
    if (slugs.length) {
      var table = new sql.Table('textbook_lesson_items');
      table.columns.add('lesson_id', sql.Int, { nullable: false });
      table.columns.add('zh', sql.NVarChar(100), { nullable: false });
      table.columns.add('py', sql.NVarChar(200), { nullable: false });
      table.columns.add('en', sql.NVarChar(200), { nullable: false });
      table.columns.add('kind', sql.NVarChar(20), { nullable: true });
      table.columns.add('sort_order', sql.Int, { nullable: false });
      for (var slug of slugs) {
        await new sql.Request(transaction).input('id', sql.Int, ids[slug])
          .query('DELETE FROM textbook_lesson_items WHERE lesson_id = @id');
        parsed.itemsBySlug[slug].forEach(function (item, index) {
          table.rows.add(ids[slug], item.zh, item.py, item.en || '', item.kind, index);
        });
        counts.lessonsWithWords++;
        counts.words += parsed.itemsBySlug[slug].length;
      }
      await new sql.Request(transaction).bulk(table);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  return counts;
}

// Builds a workbook in the import format from database rows.
function buildWorkbook(ExcelJS, lessons, items) {
  var workbook = new ExcelJS.Workbook();
  var lessonSheet = workbook.addWorksheet('课程');
  lessonSheet.columns = [
    { header: 'slug', key: 'slug', width: 18 },
    { header: 'series', key: 'series', width: 10 },
    { header: 'book_slug', key: 'book_slug', width: 10 },
    { header: 'book_name', key: 'book_name', width: 14 },
    { header: 'sort_order', key: 'sort_order', width: 10 },
    { header: 'lesson_no', key: 'lesson_no', width: 10 },
    { header: 'title', key: 'title', width: 30 },
    { header: 'sentence_patterns', key: 'sentence_patterns', width: 50 },
    { header: 'activities', key: 'activities', width: 60 }
  ];
  lessons.forEach(function (lesson) { lessonSheet.addRow(lesson); });
  var slugById = {};
  lessons.forEach(function (lesson) { slugById[lesson.id] = lesson.slug; });
  var itemSheet = workbook.addWorksheet('生词');
  itemSheet.columns = [
    { header: 'slug', key: 'slug', width: 18 },
    { header: 'zh', key: 'zh', width: 14 },
    { header: 'py', key: 'py', width: 22 },
    { header: 'en', key: 'en', width: 44 },
    { header: 'kind', key: 'kind', width: 8 }
  ];
  items.forEach(function (item) {
    if (slugById[item.lesson_id]) itemSheet.addRow({ slug: slugById[item.lesson_id], zh: item.zh, py: item.py, en: item.en, kind: item.kind || '' });
  });
  [lessonSheet, itemSheet].forEach(function (sheet) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  });
  return workbook;
}

module.exports = {
  readWorkbook: readWorkbook,
  applyImport: applyImport,
  buildWorkbook: buildWorkbook,
  existingLessonIds: existingLessonIds
};
