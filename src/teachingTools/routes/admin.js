'use strict';

var express = require('express');
var router = express.Router();
var requireAdmin = require('../middleware/requireAdmin');
var sqlClient = require('../services/sqlClient');
var sql = sqlClient.sql;

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

module.exports = router;
