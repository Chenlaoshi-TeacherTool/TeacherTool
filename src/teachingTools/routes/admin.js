'use strict';

var express = require('express');
var multer = require('multer');
var ExcelJS = require('exceljs');
var router = express.Router();
var requireAdmin = require('../middleware/requireAdmin');
var sqlClient = require('../services/sqlClient');
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

router.post('/wordlists/:id/items', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var maxResult = await pool.request().input('listId', sql.Int, req.params.id)
      .query('SELECT ISNULL(MAX(sort_order), -1) + 1 AS nextOrder FROM word_list_items WHERE list_id = @listId');
    await pool.request()
      .input('listId', sql.Int, req.params.id)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en)
      .input('note', sql.NVarChar, req.body.note || null)
      .input('sortOrder', sql.Int, maxResult.recordset[0].nextOrder)
      .query('INSERT INTO word_list_items (list_id, zh, py, en, note, sort_order) VALUES (@listId, @zh, @py, @en, @note, @sortOrder)');
    res.redirect('/admin/wordlists/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/wordlists/:id/items/:itemId', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('itemId', sql.Int, req.params.itemId)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en)
      .input('note', sql.NVarChar, req.body.note || null)
      .query('UPDATE word_list_items SET zh=@zh, py=@py, en=@en, note=@note WHERE id = @itemId');
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

module.exports = router;
