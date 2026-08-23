'use strict';

var express = require('express');
var multer = require('multer');
var ExcelJS = require('exceljs');
var router = express.Router();
var requireAdmin = require('../middleware/requireAdmin');
var sqlClient = require('../services/sqlClient');
var siteContentStore = require('../services/siteContentStore');
var blobStorage = require('../services/blobStorage');
var sql = sqlClient.sql;

var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAdmin);

router.get('/', function (req, res) {
  res.render('admin/dashboard', { title: 'Admin', adminUser: req.adminUser });
});

router.get('/wordlists', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query(
      'SELECT wl.id, wl.slug, wl.name, wl.theme, wl.level, wl.curriculum, COUNT(wli.id) AS item_count ' +
      'FROM word_lists wl LEFT JOIN word_list_items wli ON wli.list_id = wl.id ' +
      'WHERE wl.owner_user_id IS NULL GROUP BY wl.id, wl.slug, wl.name, wl.theme, wl.level, wl.curriculum ORDER BY wl.name'
    );
    res.render('admin/wordlists-index', { title: 'Word Lists', lists: result.recordset, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/wordlists/new', function (req, res) {
  res.render('admin/wordlists-edit', { title: 'New Word List', list: null, items: [], adminUser: req.adminUser });
});

router.post('/wordlists/new', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request()
      .input('slug', sql.NVarChar, req.body.slug)
      .input('name', sql.NVarChar, req.body.name)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('theme', sql.NVarChar, req.body.theme || null)
      .input('level', sql.NVarChar, req.body.level || null)
      .input('curriculum', sql.NVarChar, req.body.curriculum || null)
      .query('INSERT INTO word_lists (slug, name, description, theme, level, curriculum) OUTPUT INSERTED.id VALUES (@slug, @name, @description, @theme, @level, @curriculum)');
    res.redirect('/admin/wordlists/' + result.recordset[0].id + '/edit');
  } catch (err) { next(err); }
});

router.get('/wordlists/:id/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var listResult = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM word_lists WHERE id = @id');
    var list = listResult.recordset[0];
    if (!list) return res.status(404).send('Word list not found.');
    var itemsResult = await pool.request().input('listId', sql.Int, req.params.id)
      .query('SELECT * FROM word_list_items WHERE list_id = @listId ORDER BY sort_order, id');
    res.render('admin/wordlists-edit', { title: 'Edit ' + list.name, list: list, items: itemsResult.recordset, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/wordlists/:id', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('slug', sql.NVarChar, req.body.slug)
      .input('name', sql.NVarChar, req.body.name)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('theme', sql.NVarChar, req.body.theme || null)
      .input('level', sql.NVarChar, req.body.level || null)
      .input('curriculum', sql.NVarChar, req.body.curriculum || null)
      .query('UPDATE word_lists SET slug=@slug, name=@name, description=@description, theme=@theme, level=@level, curriculum=@curriculum, updated_at=SYSUTCDATETIME() WHERE id=@id');
    res.redirect('/admin/wordlists/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM word_lists WHERE id = @id');
    res.redirect('/admin/wordlists');
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/items', upload.single('image'), async function (req, res, next) {
  try {
    var imgUrl = req.file ? await blobStorage.uploadImage(req.file) : null;
    var pool = await sqlClient.getPool();
    var maxResult = await pool.request().input('listId', sql.Int, req.params.id)
      .query('SELECT ISNULL(MAX(sort_order), -1) + 1 AS nextOrder FROM word_list_items WHERE list_id = @listId');
    await pool.request()
      .input('listId', sql.Int, req.params.id)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en)
      .input('note', sql.NVarChar, req.body.note || null)
      .input('imgUrl', sql.NVarChar, imgUrl)
      .input('sortOrder', sql.Int, maxResult.recordset[0].nextOrder)
      .query('INSERT INTO word_list_items (list_id, zh, py, en, img_blob_url, note, sort_order) VALUES (@listId, @zh, @py, @en, @imgUrl, @note, @sortOrder)');
    res.redirect('/admin/wordlists/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/items/:itemId', upload.single('image'), async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var request = pool.request()
      .input('itemId', sql.Int, req.params.itemId)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en)
      .input('note', sql.NVarChar, req.body.note || null);
    var setClauses = 'zh=@zh, py=@py, en=@en, note=@note';
    if (req.file) {
      var imgUrl = await blobStorage.uploadImage(req.file);
      request.input('imgUrl', sql.NVarChar, imgUrl);
      setClauses += ', img_blob_url=@imgUrl';
    } else if (req.body.remove_image) {
      setClauses += ', img_blob_url=NULL';
    }
    await request.query('UPDATE word_list_items SET ' + setClauses + ' WHERE id = @itemId');
    res.redirect('/admin/wordlists/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/items/:itemId/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('itemId', sql.Int, req.params.itemId).query('DELETE FROM word_list_items WHERE id = @itemId');
    res.redirect('/admin/wordlists/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

async function getListOr404(pool, id, res) {
  var result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM word_lists WHERE id = @id');
  var list = result.recordset[0];
  if (!list) { res.status(404).send('Word list not found.'); return null; }
  return list;
}

var WORDLIST_IMPORT_COLUMNS = ['zh', 'py', 'en', 'note'];

function readWordListImportRows(worksheet) {
  var columnIndex = {};
  worksheet.getRow(1).eachCell({ includeEmpty: false }, function (cell, colNumber) {
    var key = String(cell.value || '').trim().toLowerCase();
    if (key) columnIndex[key] = colNumber;
  });
  var rows = [];
  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    if (rowNumber === 1) return;
    var record = {};
    WORDLIST_IMPORT_COLUMNS.forEach(function (col) {
      var idx = columnIndex[col];
      var cellValue = idx ? row.getCell(idx).value : null;
      record[col] = cellValue === null || cellValue === undefined ? '' : String(cellValue).trim();
    });
    if (record.zh) rows.push(record);
  });
  return rows;
}

router.get('/wordlists/:id/export', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var list = await getListOr404(pool, req.params.id, res);
    if (!list) return;
    var itemsResult = await pool.request().input('listId', sql.Int, req.params.id)
      .query('SELECT * FROM word_list_items WHERE list_id = @listId ORDER BY sort_order, id');

    var workbook = new ExcelJS.Workbook();
    var worksheet = workbook.addWorksheet('Terms');
    worksheet.columns = [
      { header: 'zh', key: 'zh', width: 16 },
      { header: 'py', key: 'py', width: 20 },
      { header: 'en', key: 'en', width: 24 },
      { header: 'note', key: 'note', width: 30 }
    ];
    itemsResult.recordset.forEach(function (item) {
      worksheet.addRow({ zh: item.zh, py: item.py, en: item.en, note: item.note || '' });
    });

    var fileName = (list.slug || 'word-list') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

router.get('/wordlists/:id/import', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var list = await getListOr404(pool, req.params.id, res);
    if (!list) return;
    res.render('admin/wordlists-import', { title: 'Import into ' + list.name, list: list, result: null, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/import', upload.single('file'), async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var list = await getListOr404(pool, req.params.id, res);
    if (!list) return;

    if (!req.file) {
      return res.render('admin/wordlists-import', {
        title: 'Import into ' + list.name, list: list, adminUser: req.adminUser,
        result: { error: 'No file was uploaded.' }
      });
    }

    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    var worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('The uploaded file has no worksheets.');
    var rows = readWordListImportRows(worksheet);

    var existingResult = await pool.request().input('listId', sql.Int, req.params.id)
      .query('SELECT id, zh, sort_order FROM word_list_items WHERE list_id = @listId');
    var existingByZh = {};
    existingResult.recordset.forEach(function (item) { existingByZh[item.zh] = item; });
    var maxSortOrder = existingResult.recordset.reduce(function (max, item) { return Math.max(max, item.sort_order); }, -1);

    var created = 0, updated = 0, skipped = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.py || !row.en) { skipped++; continue; }
      var existing = existingByZh[row.zh];
      if (existing) {
        await pool.request()
          .input('itemId', sql.Int, existing.id)
          .input('py', sql.NVarChar, row.py)
          .input('en', sql.NVarChar, row.en)
          .input('note', sql.NVarChar, row.note || null)
          .query('UPDATE word_list_items SET py=@py, en=@en, note=@note WHERE id=@itemId');
        updated++;
      } else {
        maxSortOrder++;
        await pool.request()
          .input('listId', sql.Int, req.params.id)
          .input('zh', sql.NVarChar, row.zh)
          .input('py', sql.NVarChar, row.py)
          .input('en', sql.NVarChar, row.en)
          .input('note', sql.NVarChar, row.note || null)
          .input('sortOrder', sql.Int, maxSortOrder)
          .query('INSERT INTO word_list_items (list_id, zh, py, en, note, sort_order) VALUES (@listId, @zh, @py, @en, @note, @sortOrder)');
        created++;
      }
    }

    res.render('admin/wordlists-import', {
      title: 'Import into ' + list.name, list: list, adminUser: req.adminUser,
      result: { created: created, updated: updated, skipped: skipped, total: rows.length }
    });
  } catch (err) { next(err); }
});

function parseCsv(text) {
  if (!text) return [];
  return text.split(',').map(function (part) { return part.trim(); }).filter(Boolean);
}

async function getLookup(pool, table) {
  var result = await pool.request().query('SELECT code, label_en FROM ' + table + ' ORDER BY code');
  return result.recordset;
}

router.get('/questionbanks', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query(
      'SELECT qb.id, qb.slug, qb.name, qb.theme, qb.level, COUNT(q.id) AS question_count ' +
      'FROM question_banks qb LEFT JOIN questions q ON q.bank_id = qb.id ' +
      'GROUP BY qb.id, qb.slug, qb.name, qb.theme, qb.level ORDER BY qb.name'
    );
    res.render('admin/questionbanks-index', { title: 'Question Banks', banks: result.recordset, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/questionbanks/new', function (req, res) {
  res.render('admin/questionbanks-edit', { title: 'New Question Bank', bank: null, questions: [], levels: [], types: [], adminUser: req.adminUser });
});

router.post('/questionbanks/new', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request()
      .input('slug', sql.NVarChar, req.body.slug)
      .input('name', sql.NVarChar, req.body.name)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('theme', sql.NVarChar, req.body.theme || null)
      .input('level', sql.NVarChar, req.body.level || null)
      .input('curriculum', sql.NVarChar, req.body.curriculum || null)
      .query('INSERT INTO question_banks (slug, name, description, theme, level, curriculum) OUTPUT INSERTED.id VALUES (@slug, @name, @description, @theme, @level, @curriculum)');
    res.redirect('/admin/questionbanks/' + result.recordset[0].id + '/edit');
  } catch (err) { next(err); }
});

router.get('/questionbanks/:id/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var bankResult = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM question_banks WHERE id = @id');
    var bank = bankResult.recordset[0];
    if (!bank) return res.status(404).send('Question bank not found.');
    var questionsResult = await pool.request().input('bankId', sql.Int, req.params.id)
      .query('SELECT * FROM questions WHERE bank_id = @bankId ORDER BY sort_order, id');
    var questions = questionsResult.recordset.map(function (q) {
      return Object.assign({}, q, {
        optionsText: JSON.parse(q.options || '[]').join(', '),
        tagsText: JSON.parse(q.tags || '[]').join(', ')
      });
    });
    var levels = await getLookup(pool, 'level_lookup');
    var types = await getLookup(pool, 'type_lookup');
    res.render('admin/questionbanks-edit', { title: 'Edit ' + bank.name, bank: bank, questions: questions, levels: levels, types: types, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('slug', sql.NVarChar, req.body.slug)
      .input('name', sql.NVarChar, req.body.name)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('theme', sql.NVarChar, req.body.theme || null)
      .input('level', sql.NVarChar, req.body.level || null)
      .input('curriculum', sql.NVarChar, req.body.curriculum || null)
      .query('UPDATE question_banks SET slug=@slug, name=@name, description=@description, theme=@theme, level=@level, curriculum=@curriculum, updated_at=SYSUTCDATETIME() WHERE id=@id');
    res.redirect('/admin/questionbanks/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var tx = pool.transaction();
    await tx.begin();
    await tx.request().input('bankId', sql.Int, req.params.id).query('DELETE FROM questions WHERE bank_id = @bankId');
    await tx.request().input('id', sql.Int, req.params.id).query('DELETE FROM question_banks WHERE id = @id');
    await tx.commit();
    res.redirect('/admin/questionbanks');
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id/questions', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var maxResult = await pool.request().input('bankId', sql.Int, req.params.id)
      .query('SELECT ISNULL(MAX(sort_order), -1) + 1 AS nextOrder FROM questions WHERE bank_id = @bankId');
    await pool.request()
      .input('bankId', sql.Int, req.params.id)
      .input('externalId', sql.NVarChar, req.body.external_id)
      .input('themeZh', sql.NVarChar, req.body.theme_zh || null)
      .input('levelCode', sql.NVarChar, req.body.level_code || null)
      .input('typeCode', sql.NVarChar, req.body.type_code || null)
      .input('prompt', sql.NVarChar, req.body.prompt)
      .input('answer', sql.NVarChar, req.body.answer)
      .input('note', sql.NVarChar, req.body.note || '')
      .input('options', sql.NVarChar, JSON.stringify(parseCsv(req.body.options)))
      .input('tags', sql.NVarChar, JSON.stringify(parseCsv(req.body.tags)))
      .input('sortOrder', sql.Int, maxResult.recordset[0].nextOrder)
      .query(
        'INSERT INTO questions (bank_id, external_id, theme_zh, level_code, type_code, prompt, answer, note, options, tags, sort_order) ' +
        'VALUES (@bankId, @externalId, @themeZh, @levelCode, @typeCode, @prompt, @answer, @note, @options, @tags, @sortOrder)'
      );
    res.redirect('/admin/questionbanks/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id/questions/:qId', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('qId', sql.Int, req.params.qId)
      .input('externalId', sql.NVarChar, req.body.external_id)
      .input('themeZh', sql.NVarChar, req.body.theme_zh || null)
      .input('levelCode', sql.NVarChar, req.body.level_code || null)
      .input('typeCode', sql.NVarChar, req.body.type_code || null)
      .input('prompt', sql.NVarChar, req.body.prompt)
      .input('answer', sql.NVarChar, req.body.answer)
      .input('note', sql.NVarChar, req.body.note || '')
      .input('options', sql.NVarChar, JSON.stringify(parseCsv(req.body.options)))
      .input('tags', sql.NVarChar, JSON.stringify(parseCsv(req.body.tags)))
      .query(
        'UPDATE questions SET external_id=@externalId, theme_zh=@themeZh, level_code=@levelCode, type_code=@typeCode, ' +
        'prompt=@prompt, answer=@answer, note=@note, options=@options, tags=@tags WHERE id = @qId'
      );
    res.redirect('/admin/questionbanks/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id/questions/:qId/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('qId', sql.Int, req.params.qId).query('DELETE FROM questions WHERE id = @qId');
    res.redirect('/admin/questionbanks/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

var IMPORT_COLUMNS = ['id', 'theme', 'level', 'prompt', 'answer', 'tags', 'type', 'options', 'note'];

function readImportRows(worksheet) {
  var columnIndex = {};
  worksheet.getRow(1).eachCell({ includeEmpty: false }, function (cell, colNumber) {
    var key = String(cell.value || '').trim().toLowerCase();
    if (key) columnIndex[key] = colNumber;
  });
  var rows = [];
  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    if (rowNumber === 1) return;
    var record = {};
    IMPORT_COLUMNS.forEach(function (col) {
      var idx = columnIndex[col];
      var cellValue = idx ? row.getCell(idx).value : null;
      record[col] = cellValue === null || cellValue === undefined ? '' : String(cellValue).trim();
    });
    if (record.id) rows.push(record);
  });
  return rows;
}

async function getBankOr404(pool, id, res) {
  var result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM question_banks WHERE id = @id');
  var bank = result.recordset[0];
  if (!bank) { res.status(404).send('Question bank not found.'); return null; }
  return bank;
}

router.get('/questionbanks/:id/import', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var bank = await getBankOr404(pool, req.params.id, res);
    if (!bank) return;
    res.render('admin/questionbanks-import', { title: 'Import into ' + bank.name, bank: bank, result: null, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/questionbanks/:id/import', upload.single('file'), async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var bank = await getBankOr404(pool, req.params.id, res);
    if (!bank) return;

    if (!req.file) {
      return res.render('admin/questionbanks-import', {
        title: 'Import into ' + bank.name, bank: bank, adminUser: req.adminUser,
        result: { error: 'No file was uploaded.' }
      });
    }

    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    var worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('The uploaded file has no worksheets.');
    var rows = readImportRows(worksheet);

    var existingResult = await pool.request().input('bankId', sql.Int, req.params.id)
      .query('SELECT id, external_id, sort_order FROM questions WHERE bank_id = @bankId');
    var existingByExternalId = {};
    existingResult.recordset.forEach(function (q) { existingByExternalId[q.external_id] = q; });
    var maxSortOrder = existingResult.recordset.reduce(function (max, q) { return Math.max(max, q.sort_order); }, -1);

    var created = 0, updated = 0, skipped = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.prompt || !row.answer) { skipped++; continue; }
      var options = JSON.stringify(parseCsv(row.options));
      var tags = JSON.stringify(parseCsv(row.tags));
      var existing = existingByExternalId[row.id];
      if (existing) {
        await pool.request()
          .input('qId', sql.Int, existing.id)
          .input('themeZh', sql.NVarChar, row.theme || null)
          .input('levelCode', sql.NVarChar, row.level || null)
          .input('typeCode', sql.NVarChar, row.type || null)
          .input('prompt', sql.NVarChar, row.prompt)
          .input('answer', sql.NVarChar, row.answer)
          .input('note', sql.NVarChar, row.note || '')
          .input('options', sql.NVarChar, options)
          .input('tags', sql.NVarChar, tags)
          .query('UPDATE questions SET theme_zh=@themeZh, level_code=@levelCode, type_code=@typeCode, prompt=@prompt, answer=@answer, note=@note, options=@options, tags=@tags WHERE id=@qId');
        updated++;
      } else {
        maxSortOrder++;
        await pool.request()
          .input('bankId', sql.Int, req.params.id)
          .input('externalId', sql.NVarChar, row.id)
          .input('themeZh', sql.NVarChar, row.theme || null)
          .input('levelCode', sql.NVarChar, row.level || null)
          .input('typeCode', sql.NVarChar, row.type || null)
          .input('prompt', sql.NVarChar, row.prompt)
          .input('answer', sql.NVarChar, row.answer)
          .input('note', sql.NVarChar, row.note || '')
          .input('options', sql.NVarChar, options)
          .input('tags', sql.NVarChar, tags)
          .input('sortOrder', sql.Int, maxSortOrder)
          .query('INSERT INTO questions (bank_id, external_id, theme_zh, level_code, type_code, prompt, answer, note, options, tags, sort_order) VALUES (@bankId, @externalId, @themeZh, @levelCode, @typeCode, @prompt, @answer, @note, @options, @tags, @sortOrder)');
        created++;
      }
    }

    res.render('admin/questionbanks-import', {
      title: 'Import into ' + bank.name, bank: bank, adminUser: req.adminUser,
      result: { created: created, updated: updated, skipped: skipped, total: rows.length }
    });
  } catch (err) { next(err); }
});

function parseLines(text) {
  if (!text) return [];
  return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

// ===== Tool Guides =====

router.get('/toolguides', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query('SELECT slug, title, eyebrow, app_url FROM tool_guides ORDER BY title');
    res.render('admin/toolguides-index', { title: 'Tool Guides', guides: result.recordset, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/toolguides/new', function (req, res) {
  res.render('admin/toolguides-edit', { title: 'New Tool Guide', guide: null, adminUser: req.adminUser });
});

router.post('/toolguides/new', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.body.slug)
      .input('title', sql.NVarChar, req.body.title)
      .input('eyebrow', sql.NVarChar, req.body.eyebrow || null)
      .input('grades', sql.NVarChar, req.body.grades || null)
      .input('duration', sql.NVarChar, req.body.duration || null)
      .input('summary', sql.NVarChar, req.body.summary || null)
      .input('whatItIs', sql.NVarChar, req.body.what_it_is || null)
      .input('exampleTitle', sql.NVarChar, req.body.example_title || null)
      .input('example', sql.NVarChar, req.body.example || null)
      .input('appUrl', sql.NVarChar, req.body.app_url || null)
      .input('steps', sql.NVarChar, JSON.stringify(parseLines(req.body.steps)))
      .input('tips', sql.NVarChar, JSON.stringify(parseLines(req.body.tips)))
      .query(
        'INSERT INTO tool_guides (slug, title, eyebrow, grades, duration, summary, what_it_is, example_title, example, app_url, steps, tips) ' +
        'VALUES (@slug, @title, @eyebrow, @grades, @duration, @summary, @whatItIs, @exampleTitle, @example, @appUrl, @steps, @tips)'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/toolguides/' + encodeURIComponent(req.body.slug) + '/edit');
  } catch (err) { next(err); }
});

router.get('/toolguides/:slug/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().input('slug', sql.NVarChar, req.params.slug).query('SELECT * FROM tool_guides WHERE slug = @slug');
    var guide = result.recordset[0];
    if (!guide) return res.status(404).send('Tool guide not found.');
    guide.stepsText = JSON.parse(guide.steps || '[]').join('\n');
    guide.tipsText = JSON.parse(guide.tips || '[]').join('\n');
    res.render('admin/toolguides-edit', { title: 'Edit ' + guide.title, guide: guide, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/toolguides/:slug', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .input('title', sql.NVarChar, req.body.title)
      .input('eyebrow', sql.NVarChar, req.body.eyebrow || null)
      .input('grades', sql.NVarChar, req.body.grades || null)
      .input('duration', sql.NVarChar, req.body.duration || null)
      .input('summary', sql.NVarChar, req.body.summary || null)
      .input('whatItIs', sql.NVarChar, req.body.what_it_is || null)
      .input('exampleTitle', sql.NVarChar, req.body.example_title || null)
      .input('example', sql.NVarChar, req.body.example || null)
      .input('appUrl', sql.NVarChar, req.body.app_url || null)
      .input('steps', sql.NVarChar, JSON.stringify(parseLines(req.body.steps)))
      .input('tips', sql.NVarChar, JSON.stringify(parseLines(req.body.tips)))
      .query(
        'UPDATE tool_guides SET title=@title, eyebrow=@eyebrow, grades=@grades, duration=@duration, summary=@summary, ' +
        'what_it_is=@whatItIs, example_title=@exampleTitle, example=@example, app_url=@appUrl, steps=@steps, tips=@tips WHERE slug=@slug'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/toolguides/' + encodeURIComponent(req.params.slug) + '/edit');
  } catch (err) { next(err); }
});

router.post('/toolguides/:slug/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('slug', sql.NVarChar, req.params.slug).query('DELETE FROM tool_guides WHERE slug = @slug');
    await siteContentStore.refresh();
    res.redirect('/admin/toolguides');
  } catch (err) { next(err); }
});

// ===== Articles =====

router.get('/articles', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query('SELECT slug, title, category FROM articles ORDER BY title');
    res.render('admin/articles-index', { title: 'Articles', articles: result.recordset, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/articles/new', function (req, res) {
  res.render('admin/articles-edit', { title: 'New Article', article: null, isNew: true, error: null, adminUser: req.adminUser });
});

router.post('/articles/new', async function (req, res, next) {
  try {
    var sections;
    try {
      sections = JSON.parse(req.body.sections || '[]');
    } catch (parseErr) {
      return res.render('admin/articles-edit', {
        title: 'New Article', adminUser: req.adminUser, isNew: true, error: 'Sections is not valid JSON: ' + parseErr.message,
        article: Object.assign({}, req.body, { introText: req.body.intro, sectionsText: req.body.sections })
      });
    }
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.body.slug)
      .input('category', sql.NVarChar, req.body.category)
      .input('title', sql.NVarChar, req.body.title)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('readTime', sql.NVarChar, req.body.read_time || null)
      .input('intro', sql.NVarChar, JSON.stringify(parseLines(req.body.intro)))
      .input('sections', sql.NVarChar, JSON.stringify(sections))
      .input('relatedToolLabel', sql.NVarChar, req.body.related_tool_label || null)
      .input('relatedToolHref', sql.NVarChar, req.body.related_tool_href || null)
      .query(
        'INSERT INTO articles (slug, category, title, description, read_time, intro, sections, related_tool_label, related_tool_href) ' +
        'VALUES (@slug, @category, @title, @description, @readTime, @intro, @sections, @relatedToolLabel, @relatedToolHref)'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/articles/' + encodeURIComponent(req.body.slug) + '/edit');
  } catch (err) { next(err); }
});

router.get('/articles/:slug/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().input('slug', sql.NVarChar, req.params.slug).query('SELECT * FROM articles WHERE slug = @slug');
    var article = result.recordset[0];
    if (!article) return res.status(404).send('Article not found.');
    article.introText = JSON.parse(article.intro || '[]').join('\n');
    article.sectionsText = JSON.stringify(JSON.parse(article.sections || '[]'), null, 2);
    res.render('admin/articles-edit', { title: 'Edit ' + article.title, article: article, isNew: false, error: null, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/articles/:slug', async function (req, res, next) {
  try {
    var sections;
    try {
      sections = JSON.parse(req.body.sections || '[]');
    } catch (parseErr) {
      return res.render('admin/articles-edit', {
        title: 'Edit ' + req.body.title, adminUser: req.adminUser, isNew: false, error: 'Sections is not valid JSON: ' + parseErr.message,
        article: Object.assign({}, req.body, { slug: req.params.slug, introText: req.body.intro, sectionsText: req.body.sections })
      });
    }
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .input('category', sql.NVarChar, req.body.category)
      .input('title', sql.NVarChar, req.body.title)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('readTime', sql.NVarChar, req.body.read_time || null)
      .input('intro', sql.NVarChar, JSON.stringify(parseLines(req.body.intro)))
      .input('sections', sql.NVarChar, JSON.stringify(sections))
      .input('relatedToolLabel', sql.NVarChar, req.body.related_tool_label || null)
      .input('relatedToolHref', sql.NVarChar, req.body.related_tool_href || null)
      .query(
        'UPDATE articles SET category=@category, title=@title, description=@description, read_time=@readTime, ' +
        'intro=@intro, sections=@sections, related_tool_label=@relatedToolLabel, related_tool_href=@relatedToolHref WHERE slug=@slug'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/articles/' + encodeURIComponent(req.params.slug) + '/edit');
  } catch (err) { next(err); }
});

router.post('/articles/:slug/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('slug', sql.NVarChar, req.params.slug).query('DELETE FROM articles WHERE slug = @slug');
    await siteContentStore.refresh();
    res.redirect('/admin/articles');
  } catch (err) { next(err); }
});

module.exports = router;
