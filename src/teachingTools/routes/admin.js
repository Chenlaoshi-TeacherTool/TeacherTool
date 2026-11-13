'use strict';

var express = require('express');
var multer = require('multer');
var ExcelJS = require('exceljs');
var router = express.Router();
var requireAdmin = require('../middleware/requireAdmin');
var sqlClient = require('../services/sqlClient');
var siteContentStore = require('../services/siteContentStore');
var blobStorage = require('../services/blobStorage');
var siteMap = require('../config/siteMap');
var textbookImport = require('../services/textbookImport');
var teacherLibraryRepository = require('../services/teacherLibraryRepository');
var teacherAccountsRepository = require('../services/teacherAccountsRepository');
var databaseVersion = require('../services/databaseVersion');
var activationCodes = require('../services/activationCodes');
var communityRepository = require('../services/communityRepository');
var textbookRepository = require('../services/textbookRepository');
var textbookFileStorage = require('../services/textbookFileStorage');
var toolVideos = require('../services/toolVideos');
var classroomFinds = require('../services/classroomFinds');
var recommendationFiles = require('../services/recommendationFiles');
var toolCatalog = require('../services/toolCatalog');
var communityService = require('../services/community');
var sql = sqlClient.sql;

var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
var uploadMaterial = multer({ storage: multer.memoryStorage(), limits: { fileSize: textbookFileStorage.MAX_BYTES } });
var materialAdminRouter = require('./materials').create({ adminMode: true });

router.use(requireAdmin);
router.use('/textbooks', async function (req, res, next) {
  try { req.textbooks = (await require('../services/contentCatalog').load()).textbooks; next(); }
  catch (error) { next(error); }
});

// Admin nav and dashboard follow the public site structure in config/siteMap.js.
router.use(function (req, res, next) {
  res.locals.adminNav = siteMap.adminNav();
  res.locals.adminWorkspace = require('../config/adminWorkspace').groups();
  res.locals.adminPath = req.originalUrl.split('?')[0];
  next();
});

// Warns on every admin page when the database is missing a migration this code needs.
router.use(async function (req, res, next) {
  if (req.method !== 'GET') return next();
  try { res.locals.dbStatus = await databaseVersion.check(); } catch (error) { res.locals.dbStatus = null; }
  next();
});

router.use(require('./contentCatalog'));
router.use(require('./adminPages'));
router.use(require('./adminMembershipAdjustments'));

router.get('/', function (req, res) {
  res.render('admin/dashboard', { title: 'Admin', adminUser: req.adminUser, groups: siteMap.adminGroups(), requireWorkspace: require('../config/adminWorkspace').groups() });
});

router.get('/materials', function (req, res, next) {
  materialAdminRouter(req, res, next);
});
router.use(materialAdminRouter);
router.use(require('./textbookWords'));
router.use(require('./textbookBookEditor'));

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

var BULK_IMPORT_COLUMNS = ['slug', 'name', 'theme', 'level', 'curriculum', 'zh', 'py', 'en', 'note'];

function readBulkImportRows(worksheet) {
  var columnIndex = {};
  worksheet.getRow(1).eachCell({ includeEmpty: false }, function (cell, colNumber) {
    var key = String(cell.value || '').trim().toLowerCase();
    if (key) columnIndex[key] = colNumber;
  });
  var rows = [];
  worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
    if (rowNumber === 1) return;
    var record = {};
    BULK_IMPORT_COLUMNS.forEach(function (col) {
      var idx = columnIndex[col];
      var cellValue = idx ? row.getCell(idx).value : null;
      record[col] = cellValue === null || cellValue === undefined ? '' : String(cellValue).trim();
    });
    if (record.slug && record.zh) rows.push(record);
  });
  return rows;
}

router.get('/wordlists/import', function (req, res) {
  res.render('admin/wordlists-bulk-import', { title: 'Bulk import word lists', result: null, adminUser: req.adminUser });
});

router.post('/wordlists/import', upload.array('files', 30), async function (req, res, next) {
  try {
    if (!req.files || !req.files.length) {
      return res.render('admin/wordlists-bulk-import', {
        title: 'Bulk import word lists', adminUser: req.adminUser,
        result: { error: 'No files were uploaded.' }
      });
    }

    var allRows = [];
    for (var f = 0; f < req.files.length; f++) {
      var workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.files[f].buffer);
      var worksheet = workbook.worksheets[0];
      if (!worksheet) continue;
      allRows = allRows.concat(readBulkImportRows(worksheet));
    }

    var bySlug = {};
    var slugOrder = [];
    allRows.forEach(function (row) {
      if (!bySlug[row.slug]) { bySlug[row.slug] = []; slugOrder.push(row.slug); }
      bySlug[row.slug].push(row);
    });

    var pool = await sqlClient.getPool();
    var listsCreated = 0, listsUpdated = 0, itemsCreated = 0, itemsUpdated = 0, itemsSkipped = 0;

    for (var s = 0; s < slugOrder.length; s++) {
      var slug = slugOrder[s];
      var rows = bySlug[slug];
      var listId;

      var existingListResult = await pool.request().input('slug', sql.NVarChar, slug).query('SELECT id FROM word_lists WHERE slug = @slug');
      if (existingListResult.recordset[0]) {
        listId = existingListResult.recordset[0].id;
        listsUpdated++;
      } else {
        var first = rows[0];
        var created = await pool.request()
          .input('slug', sql.NVarChar, slug)
          .input('name', sql.NVarChar, first.name || slug)
          .input('theme', sql.NVarChar, first.theme || null)
          .input('level', sql.NVarChar, first.level || null)
          .input('curriculum', sql.NVarChar, first.curriculum || null)
          .query('INSERT INTO word_lists (slug, name, theme, level, curriculum) OUTPUT INSERTED.id VALUES (@slug, @name, @theme, @level, @curriculum)');
        listId = created.recordset[0].id;
        listsCreated++;
      }

      var existingItemsResult = await pool.request().input('listId', sql.Int, listId)
        .query('SELECT id, zh, sort_order FROM word_list_items WHERE list_id = @listId');
      var existingByZh = {};
      existingItemsResult.recordset.forEach(function (item) { existingByZh[item.zh] = item; });
      var maxSortOrder = existingItemsResult.recordset.reduce(function (max, item) { return Math.max(max, item.sort_order); }, -1);

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (!row.py || !row.en) { itemsSkipped++; continue; }
        var existingItem = existingByZh[row.zh];
        if (existingItem) {
          await pool.request()
            .input('itemId', sql.Int, existingItem.id)
            .input('py', sql.NVarChar, row.py)
            .input('en', sql.NVarChar, row.en)
            .input('note', sql.NVarChar, row.note || null)
            .query('UPDATE word_list_items SET py=@py, en=@en, note=@note WHERE id=@itemId');
          itemsUpdated++;
        } else {
          maxSortOrder++;
          await pool.request()
            .input('listId', sql.Int, listId)
            .input('zh', sql.NVarChar, row.zh)
            .input('py', sql.NVarChar, row.py)
            .input('en', sql.NVarChar, row.en)
            .input('note', sql.NVarChar, row.note || null)
            .input('sortOrder', sql.Int, maxSortOrder)
            .query('INSERT INTO word_list_items (list_id, zh, py, en, note, sort_order) VALUES (@listId, @zh, @py, @en, @note, @sortOrder)');
          itemsCreated++;
        }
      }
    }

    res.render('admin/wordlists-bulk-import', {
      title: 'Bulk import word lists', adminUser: req.adminUser,
      result: {
        listsCreated: listsCreated, listsUpdated: listsUpdated,
        itemsCreated: itemsCreated, itemsUpdated: itemsUpdated, itemsSkipped: itemsSkipped,
        listCount: slugOrder.length
      }
    });
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
      { header: 'slug', key: 'slug', width: 20 },
      { header: 'name', key: 'name', width: 20 },
      { header: 'theme', key: 'theme', width: 16 },
      { header: 'level', key: 'level', width: 12 },
      { header: 'curriculum', key: 'curriculum', width: 16 },
      { header: 'zh', key: 'zh', width: 16 },
      { header: 'py', key: 'py', width: 20 },
      { header: 'en', key: 'en', width: 24 },
      { header: 'note', key: 'note', width: 30 }
    ];
    itemsResult.recordset.forEach(function (item) {
      worksheet.addRow({
        slug: list.slug, name: list.name, theme: list.theme || '', level: list.level || '', curriculum: list.curriculum || '',
        zh: item.zh, py: item.py, en: item.en, note: item.note || ''
      });
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
  var prefill = {
    slug: typeof req.query.slug === 'string' ? req.query.slug : '',
    title: typeof req.query.title === 'string' ? req.query.title : '',
    appUrl: typeof req.query.appUrl === 'string' ? req.query.appUrl : ''
  };
  res.render('admin/toolguides-edit', { title: 'New Tool Guide', guide: null, prefill: prefill, adminUser: req.adminUser });
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

// ===== Recommendations =====

function parseReasons(body) {
  var reasons = [];
  [1, 2, 3].forEach(function (index) {
    var title = (body['reason' + index + '_title'] || '').trim();
    var text = (body['reason' + index + '_text'] || '').trim();
    if (title || text) reasons.push({ title: title, text: text });
  });
  return reasons;
}

function attachReasonFields(product) {
  product.classroomContent = classroomFinds.read(product.classroom_content);
  var reasons = JSON.parse(product.reasons || '[]');
  [0, 1, 2].forEach(function (index) {
    var reason = reasons[index] || {};
    product['reason' + (index + 1) + '_title'] = reason.title || '';
    product['reason' + (index + 1) + '_text'] = reason.text || '';
  });
  return product;
}

router.get('/recommendations', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query('SELECT slug, title, category, classroom_content, sort_order, is_published FROM recommendation_products ORDER BY sort_order, title');
    res.render('admin/recommendations-index', { title: 'Recommendations', products: result.recordset.map(function (product) { product.classroomContent = classroomFinds.read(product.classroom_content); return product; }), adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/recommendations/new', function (req, res) {
  res.render('admin/recommendations-edit', { title: 'New Recommendation', product: null, isNew: true, adminUser: req.adminUser });
});

router.post('/recommendations/new', async function (req, res, next) {
  try {
    var classroomContent;
    try { classroomContent = classroomFinds.fromForm(req.body); }
    catch (error) { return res.status(400).send(error.message); }
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.body.slug)
      .input('title', sql.NVarChar, req.body.finds_title_zh || req.body.finds_title_en || req.body.title)
      .input('classroomContent', sql.NVarChar, JSON.stringify(classroomContent))
      .input('subtitle', sql.NVarChar, req.body.subtitle || null)
      .input('category', sql.NVarChar, req.body.category || null)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('imageUrl', sql.NVarChar, req.body.image_url || null)
      .input('imageAlt', sql.NVarChar, req.body.image_alt || null)
      .input('productUrl', sql.NVarChar, req.body.product_url || null)
      .input('linkText', sql.NVarChar, req.body.link_text || null)
      .input('linkNote', sql.NVarChar, req.body.link_note || null)
      .input('reasons', sql.NVarChar, JSON.stringify(parseReasons(req.body)))
      .input('teacherTipTitle', sql.NVarChar, req.body.teacher_tip_title || null)
      .input('teacherTip', sql.NVarChar, req.body.teacher_tip || null)
      .input('printableLabelUrl', sql.NVarChar, req.body.printable_label_url || null)
      .input('printableLabelText', sql.NVarChar, req.body.printable_label_text || null)
      .input('printableLabelNote', sql.NVarChar, req.body.printable_label_note || null)
      .input('sortOrder', sql.Int, Number(req.body.sort_order) || 0)
      .input('isPublished', sql.Bit, req.body.is_published === 'on')
      .query(
        'INSERT INTO recommendation_products (slug, title, subtitle, category, description, image_url, image_alt, product_url, link_text, link_note, reasons, teacher_tip_title, teacher_tip, printable_label_url, printable_label_text, printable_label_note, sort_order, is_published, classroom_content) ' +
        'VALUES (@slug, @title, @subtitle, @category, @description, @imageUrl, @imageAlt, @productUrl, @linkText, @linkNote, @reasons, @teacherTipTitle, @teacherTip, @printableLabelUrl, @printableLabelText, @printableLabelNote, @sortOrder, @isPublished, @classroomContent)'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/recommendations/' + encodeURIComponent(req.body.slug) + '/edit');
  } catch (err) { next(err); }
});

router.get('/recommendations/:slug/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().input('slug', sql.NVarChar, req.params.slug).query('SELECT * FROM recommendation_products WHERE slug = @slug');
    var product = result.recordset[0];
    if (!product) return res.status(404).send('Recommendation not found.');
    product.companionFiles = JSON.parse(product.companion_files || '[]');
    res.render('admin/recommendations-edit', { title: 'Edit ' + product.title, product: attachReasonFields(product), isNew: false, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/recommendations/:slug', async function (req, res, next) {
  try {
    var classroomContent;
    try { classroomContent = classroomFinds.fromForm(req.body); }
    catch (error) { return res.status(400).send(error.message); }
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .input('title', sql.NVarChar, req.body.finds_title_zh || req.body.finds_title_en || req.body.title)
      .input('classroomContent', sql.NVarChar, JSON.stringify(classroomContent))
      .input('subtitle', sql.NVarChar, req.body.subtitle || null)
      .input('category', sql.NVarChar, req.body.category || null)
      .input('description', sql.NVarChar, req.body.description || null)
      .input('imageUrl', sql.NVarChar, req.body.image_url || null)
      .input('imageAlt', sql.NVarChar, req.body.image_alt || null)
      .input('productUrl', sql.NVarChar, req.body.product_url || null)
      .input('linkText', sql.NVarChar, req.body.link_text || null)
      .input('linkNote', sql.NVarChar, req.body.link_note || null)
      .input('reasons', sql.NVarChar, JSON.stringify(parseReasons(req.body)))
      .input('teacherTipTitle', sql.NVarChar, req.body.teacher_tip_title || null)
      .input('teacherTip', sql.NVarChar, req.body.teacher_tip || null)
      .input('printableLabelUrl', sql.NVarChar, req.body.printable_label_url || null)
      .input('printableLabelText', sql.NVarChar, req.body.printable_label_text || null)
      .input('printableLabelNote', sql.NVarChar, req.body.printable_label_note || null)
      .input('sortOrder', sql.Int, Number(req.body.sort_order) || 0)
      .input('isPublished', sql.Bit, req.body.is_published === 'on')
      .query(
        'UPDATE recommendation_products SET classroom_content=@classroomContent, title=@title, subtitle=@subtitle, category=@category, description=@description, image_url=@imageUrl, image_alt=@imageAlt, product_url=@productUrl, link_text=@linkText, link_note=@linkNote, reasons=@reasons, teacher_tip_title=@teacherTipTitle, teacher_tip=@teacherTip, printable_label_url=@printableLabelUrl, printable_label_text=@printableLabelText, printable_label_note=@printableLabelNote, sort_order=@sortOrder, is_published=@isPublished, updated_at=SYSUTCDATETIME() WHERE slug=@slug'
      );
    await siteContentStore.refresh();
    res.redirect('/admin/recommendations/' + encodeURIComponent(req.params.slug) + '/edit');
  } catch (err) { next(err); }
});

// Companion materials use the same private blob storage as activity materials.
router.post('/recommendations/:slug/files', function (req, res, next) {
  uploadMaterial.single('file')(req, res, function (error) {
    if (error) return res.status(400).send(error.code === 'LIMIT_FILE_SIZE' ? 'Files can be at most 30 MB. / 单个文件不能超过 30 MB。' : error.message);
    next();
  });
}, async function (req, res, next) {
  var stored;
  var attached = false;
  try {
    if (await recommendationFiles.list(req.params.slug) === null) return res.status(404).send('Recommendation not found.');
    try { textbookFileStorage.check(req.file); }
    catch (error) { return res.status(400).send(error.message); }
    var fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);
    var title = String(req.body.title || '').trim().slice(0, 200) || fileName;
    stored = await textbookFileStorage.save(req.file);
    attached = await recommendationFiles.add(req.params.slug, Object.assign({ title: title, fileName: fileName }, stored));
    if (!attached) { await textbookFileStorage.remove(stored.blobName); return res.status(404).send('Recommendation not found.'); }
    await siteContentStore.refresh();
    res.redirect(303, '/admin/recommendations/' + encodeURIComponent(req.params.slug) + '/edit#companion-files');
  } catch (error) {
    if (stored && !attached) await textbookFileStorage.remove(stored.blobName);
    next(error);
  }
});

router.post('/recommendations/:slug/files/:blobName/delete', async function (req, res, next) {
  try {
    await recommendationFiles.remove(req.params.slug, req.params.blobName);
    // Retain the blob, as activity materials do, so in-flight downloads can finish.
    await siteContentStore.refresh();
    res.redirect(303, '/admin/recommendations/' + encodeURIComponent(req.params.slug) + '/edit#companion-files');
  } catch (error) { next(error); }
});

router.post('/recommendations/:slug/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('slug', sql.NVarChar, req.params.slug).query('DELETE FROM recommendation_products WHERE slug = @slug');
    await siteContentStore.refresh();
    res.redirect('/admin/recommendations');
  } catch (err) { next(err); }
});

// ===== Textbook companion lessons (see config/textbooks.js, services/textbookImport.js) =====

function bookPath(series, bookSlug) {
  return '/admin/textbooks/books/' + encodeURIComponent(series) + '/' + encodeURIComponent(bookSlug);
}

function lessonInputs(request, body) {
  var lessonNo = body.lesson_no === '' || body.lesson_no === undefined ? null : Number(body.lesson_no);
  return request
    .input('slug', sql.NVarChar, String(body.slug || '').trim())
    .input('series', sql.NVarChar, body.series)
    .input('bookSlug', sql.NVarChar, String(body.book_slug || '').trim())
    .input('bookName', sql.NVarChar, String(body.book_name || '').trim())
    .input('sortOrder', sql.Int, Number(body.sort_order) || 0)
    .input('lessonNo', sql.Int, Number.isInteger(lessonNo) ? lessonNo : null)
    .input('title', sql.NVarChar, String(body.title || '').trim())
    .input('patterns', sql.NVarChar, String(body.sentence_patterns || '').trim() || null)
    .input('activities', sql.NVarChar, String(body.activities || '').trim() || null)
    .input('games', sql.NVarChar, String(body.games || '').trim() || null)
    .input('isPublished', sql.Bit, body.is_published === 'on');
}

router.get('/textbooks', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var result = await pool.request().query(
      'SELECT tl.series, tl.book_slug, MIN(tl.book_name) AS book_name, COUNT(DISTINCT tl.id) AS lesson_count, COUNT(tli.id) AS word_count ' +
      'FROM textbook_lessons tl LEFT JOIN textbook_lesson_items tli ON tli.lesson_id = tl.id ' +
      'GROUP BY tl.series, tl.book_slug ORDER BY tl.series, tl.book_slug'
    );
    var groups = req.textbooks.SERIES.map(function (series) {
      return { series: series, books: result.recordset.filter(function (book) { return book.series === series.key; }) };
    });
    res.render('admin/textbooks-index', { title: 'Textbooks', groups: groups, bookPath: bookPath, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.get('/textbooks/import', function (req, res) {
  res.render('admin/textbooks-import', { title: 'Import textbook lessons', result: null, adminUser: req.adminUser });
});

router.post('/textbooks/import', upload.single('file'), async function (req, res, next) {
  function render(result) {
    res.render('admin/textbooks-import', { title: 'Import textbook lessons', result: result, adminUser: req.adminUser });
  }
  try {
    if (!req.file) return render({ errors: ['No file was uploaded.'] });
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    var pool = await sqlClient.getPool();
    var parsed = textbookImport.readWorkbook(workbook, await textbookImport.existingLessonIds(pool), req.textbooks);
    if (parsed.errors.length) return render({ errors: parsed.errors });
    var books = [];
    parsed.lessons.forEach(function (lesson) {
      if (!books.some(function (book) { return book.series === lesson.series && book.slug === lesson.book_slug; })) books.push({ series: lesson.series, slug: lesson.book_slug, name: lesson.book_name });
    });
    render({ counts: await textbookImport.applyImport(pool, sql, parsed), books: books });
  } catch (err) { next(err); }
});

router.get('/textbooks/export', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var lessons = await pool.request().query('SELECT * FROM textbook_lessons ORDER BY series, book_slug, sort_order, id');
    var items = await pool.request().query('SELECT * FROM textbook_lesson_items ORDER BY lesson_id, sort_order, id');
    var workbook = textbookImport.buildWorkbook(ExcelJS, lessons.recordset, items.recordset);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="textbook-lessons.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

router.get('/textbooks/lessons/new', function (req, res) {
  var series = req.textbooks.findSeries(req.query.series) || req.textbooks.SERIES[0];
  res.redirect(req.query.book ? bookPath(series.key, String(req.query.book)) + '#new-lesson' : '/admin/textbooks');
});

router.post('/textbooks/lessons/new', async function (req, res, next) {
  try {
    if (!req.textbooks.findSeries(req.body.series)) return res.status(400).send('Unknown textbook series.');
    var pool = await sqlClient.getPool();
    var result = await lessonInputs(pool.request(), req.body).query(
      'INSERT INTO textbook_lessons (slug, series, book_slug, book_name, sort_order, lesson_no, title, sentence_patterns, activities, games, is_published) ' +
      'OUTPUT INSERTED.id VALUES (@slug, @series, @bookSlug, @bookName, @sortOrder, @lessonNo, @title, @patterns, @activities, @games, @isPublished)'
    );
    res.redirect('/admin/textbooks/lessons/' + result.recordset[0].id + '/edit');
  } catch (err) { next(err); }
});

router.get('/textbooks/lessons/:id/edit', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var lessonResult = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM textbook_lessons WHERE id = @id');
    var lesson = lessonResult.recordset[0];
    if (!lesson) return res.status(404).send('Lesson not found.');
    res.redirect(bookPath(lesson.series, lesson.book_slug) + (req.query.fileError ? '?fileError=' + encodeURIComponent(req.query.fileError) : '') + '#lesson-' + lesson.id);
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id', async function (req, res, next) {
  try {
    if (!req.textbooks.findSeries(req.body.series)) return res.status(400).send('Unknown textbook series.');
    var pool = await sqlClient.getPool();
    await lessonInputs(pool.request(), req.body).input('id', sql.Int, req.params.id).query(
      'UPDATE textbook_lessons SET slug=@slug, series=@series, book_slug=@bookSlug, book_name=@bookName, sort_order=@sortOrder, lesson_no=@lessonNo, ' +
      'title=@title, sentence_patterns=@patterns, activities=@activities, games=@games, is_published=@isPublished, updated_at=SYSUTCDATETIME() WHERE id=@id'
    );
    res.redirect('/admin/textbooks/lessons/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var lessonFiles = [];
    try { lessonFiles = await textbookRepository.listFiles(Number(req.params.id)); } catch (error) { lessonFiles = []; }
    var result = await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM textbook_lessons OUTPUT DELETED.series, DELETED.book_slug WHERE id = @id');
    var deleted = result.recordset[0];
    if (deleted) for (var file of lessonFiles) { try { await textbookFileStorage.remove(file.blobName); } catch (error) { console.error('textbook file remove error:', error.message); } }
    res.redirect(deleted ? bookPath(deleted.series, deleted.book_slug) : '/admin/textbooks');
  } catch (err) { next(err); }
});

// Lesson files (PDF, Word, PowerPoint...). Members download them from the lesson page.
router.post('/textbooks/lessons/:id/files', function (req, res, next) {
  uploadMaterial.single('file')(req, res, function (error) {
    if (error) return res.redirect(303, '/admin/textbooks/lessons/' + encodeURIComponent(req.params.id) + '/edit?fileError=' + encodeURIComponent(error.code === 'LIMIT_FILE_SIZE' ? 'Files can be at most 30 MB.' : error.message) + '#files');
    next();
  });
}, async function (req, res, next) {
  var back = '/admin/textbooks/lessons/' + encodeURIComponent(req.params.id) + '/edit';
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Lesson not found.');
    try { textbookFileStorage.check(req.file); }
    catch (error) { return res.redirect(303, back + '?fileError=' + encodeURIComponent(error.message) + '#files'); }
    var fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    var title = String(req.body.title || '').trim().slice(0, 200) || fileName.replace(/\.[^.]+$/, '');
    var stored = await textbookFileStorage.save(req.file);
    try {
      await textbookRepository.addFile(Number(req.params.id), { title: title, fileName: fileName.slice(0, 200), blobName: stored.blobName, contentType: stored.contentType, size: stored.size });
    } catch (error) { await textbookFileStorage.remove(stored.blobName); throw error; }
    res.redirect(303, back + '#files');
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id/files/:fileId/delete', async function (req, res, next) {
  try {
    var blobName = await textbookRepository.deleteFile(Number(req.params.id), Number(req.params.fileId));
    if (blobName) await textbookFileStorage.remove(blobName);
    res.redirect(303, '/admin/textbooks/lessons/' + encodeURIComponent(req.params.id) + '/edit#files');
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id/items', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    var maxResult = await pool.request().input('lessonId', sql.Int, req.params.id)
      .query('SELECT ISNULL(MAX(sort_order), -1) + 1 AS nextOrder FROM textbook_lesson_items WHERE lesson_id = @lessonId');
    await pool.request()
      .input('lessonId', sql.Int, req.params.id)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en || '')
      .input('kind', sql.NVarChar, req.body.kind || null)
      .input('sortOrder', sql.Int, maxResult.recordset[0].nextOrder)
      .query('INSERT INTO textbook_lesson_items (lesson_id, zh, py, en, kind, sort_order) VALUES (@lessonId, @zh, @py, @en, @kind, @sortOrder)');
    res.redirect('/admin/textbooks/lessons/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id/items/:itemId', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request()
      .input('lessonId', sql.Int, req.params.id)
      .input('itemId', sql.Int, req.params.itemId)
      .input('zh', sql.NVarChar, req.body.zh)
      .input('py', sql.NVarChar, req.body.py)
      .input('en', sql.NVarChar, req.body.en || '')
      .input('kind', sql.NVarChar, req.body.kind || null)
      .query('UPDATE textbook_lesson_items SET zh=@zh, py=@py, en=@en, kind=@kind WHERE id=@itemId AND lesson_id=@lessonId');
    res.redirect('/admin/textbooks/lessons/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

router.post('/textbooks/lessons/:id/items/:itemId/delete', async function (req, res, next) {
  try {
    var pool = await sqlClient.getPool();
    await pool.request().input('lessonId', sql.Int, req.params.id).input('itemId', sql.Int, req.params.itemId)
      .query('DELETE FROM textbook_lesson_items WHERE id = @itemId AND lesson_id = @lessonId');
    res.redirect('/admin/textbooks/lessons/' + req.params.id + '/edit');
  } catch (err) { next(err); }
});

// Activation codes: shown once at creation, only their hashes are stored.
router.get('/memberships', async function (req, res, next) {
  try {
    var directory = await teacherAccountsRepository.list(req.query);
    var selected = directory.teachers.find(function(teacher) { return teacher.ownerKey === req.query.teacher; });
    if (selected) selected.events = await teacherLibraryRepository.listEvents([selected.ownerKey]);
    res.set('Cache-Control', 'private, no-store');
    res.render('admin/memberships', { title: 'Memberships', batches: await teacherLibraryRepository.listCodeBatches(), created: null, planDays: activationCodes.PLAN_DAYS, adminUser: req.adminUser,
      directory: directory, selectedTeacher: selected ? selected.ownerKey : '', membershipTab: ['codes', 'batches'].includes(req.query.tab) ? req.query.tab : 'teachers' });
  } catch (err) { next(err); }
});

// Deactivate one code, e.g. after a refund. The admin enters the code itself.
router.post('/memberships/revoke', async function (req, res, next) {
  try {
    if (req.get('origin') && new URL(req.get('origin')).host !== req.get('host')) return res.status(403).send('Deactivate codes from the admin page.');
    var hash = activationCodes.hash(req.body.code);
    var result = hash ? await teacherLibraryRepository.revokeCode(hash, req.adminUser.name) : { outcome: 'not-found' };
    res.set('Cache-Control', 'private, no-store');
    res.render('admin/memberships', { title: 'Memberships', batches: await teacherLibraryRepository.listCodeBatches(), created: null, revoked: result, membershipTab: 'codes', planDays: activationCodes.PLAN_DAYS, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/memberships/codes', async function (req, res, next) {
  try {
    if (req.get('origin') && new URL(req.get('origin')).host !== req.get('host')) return res.status(403).send('Create codes from the admin page.');
    var days = Number(req.body.days);
    var count = Number(req.body.count);
    var label = String(req.body.label || '').trim().slice(0, 100);
    if (activationCodes.PLAN_DAYS.indexOf(days) === -1 || !Number.isInteger(count) || count < 1 || count > 100) return res.status(400).send('Choose a plan and 1–100 codes.');
    var codes = [];
    for (var i = 0; i < count; i += 1) codes.push(activationCodes.generate());
    await teacherLibraryRepository.createCodes(codes.map(function (code) { return { hash: activationCodes.hash(code), days: days, label: label }; }), req.adminUser.name);
    res.set('Cache-Control', 'private, no-store');
    res.render('admin/memberships', { title: 'Memberships', batches: await teacherLibraryRepository.listCodeBatches(), created: { codes: codes, days: days, label: label }, membershipTab: 'codes', planDays: activationCodes.PLAN_DAYS, adminUser: req.adminUser });
  } catch (err) { next(err); }
});

// Teacher community posts: reported posts first. Hide keeps the post for its
// author; delete removes it for good.
router.get('/community', async function (req, res, next) {
  try {
    var posts = await communityRepository.listAll(null);
    posts.sort(function (a, b) { return (b.reportCount - a.reportCount) || String(b.createdAt).localeCompare(String(a.createdAt)); });
    var reported = posts.filter(function (post) { return post.reportCount > 0; });
    for (var post of reported.slice(0, 30)) post.reports = await communityRepository.reports(post.id);
    res.set('Cache-Control', 'private, no-store');
    res.render('admin/community', { title: 'Community', posts: posts, community: communityService, adminUser: req.adminUser, done: req.query.done || '' });
  } catch (err) { next(err); }
});

router.post('/community/:id/:action', async function (req, res, next) {
  try {
    if (req.get('origin') && new URL(req.get('origin')).host !== req.get('host')) return res.status(403).send('Change posts from the admin page.');
    if (!communityService.validId(req.params.id)) return res.status(404).send('Unknown post.');
    var action = req.params.action;
    if (action === 'hide' || action === 'show') await communityRepository.setStatus(req.params.id, action === 'hide' ? 'hidden' : 'live');
    else if (action === 'delete') await communityRepository.remove(req.params.id, null);
    else return res.status(404).send('Unknown action.');
    require('./community').invalidate();
    res.redirect(303, '/admin/community?done=' + action);
  } catch (err) { next(err); }
});

// Tutorial videos: one Chinese and one English YouTube link per tool. Tools come
// from the /teaching-tools catalog; a saved link shows a "Watch how" button on that tool.
router.get('/toolvideos', async function (req, res, next) {
  try {
    var saved = {};
    var loadError = '';
    try { saved = await toolVideos.listAll(); } catch (error) { loadError = error.message; }
    var tools = toolCatalog.list().map(function (tool) {
      var row = saved[tool.path] || { zh: '', en: '' };
      return Object.assign({}, tool, { zh: row.zh, en: row.en, title: tool.zh, titleEn: tool.en,
        zhOk: !row.zh || Boolean(toolVideos.parseYouTube(row.zh)), enOk: !row.en || Boolean(toolVideos.parseYouTube(row.en)) });
    });
    res.set('Cache-Control', 'private, no-store');
    res.render('admin/toolvideos', { title: 'Tool Videos', tools: tools, loadError: loadError, saved: req.query.saved || '', error: req.query.error || '', adminUser: req.adminUser });
  } catch (err) { next(err); }
});

router.post('/toolvideos', async function (req, res, next) {
  try {
    if (req.get('origin') && new URL(req.get('origin')).host !== req.get('host')) return res.status(403).send('Save videos from the admin page.');
    var key = toolVideos.normalizePath(req.body.path);
    if (!toolCatalog.list().some(function (tool) { return tool.path === key; })) return res.status(400).send('Unknown tool.');
    var zh = String(req.body.zh || '').trim();
    var en = String(req.body.en || '').trim();
    if ((zh && !toolVideos.parseYouTube(zh)) || (en && !toolVideos.parseYouTube(en))) {
      return res.redirect(303, '/admin/toolvideos?error=' + encodeURIComponent(key) + '#' + encodeURIComponent(key));
    }
    await toolVideos.save(key, zh, en);
    res.redirect(303, '/admin/toolvideos?saved=' + encodeURIComponent(key) + '#' + encodeURIComponent(key));
  } catch (err) { next(err); }
});

module.exports = router;
