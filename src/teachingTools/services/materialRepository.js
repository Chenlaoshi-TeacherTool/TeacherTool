'use strict';

var fs = require('fs/promises');
var path = require('path');
var db = require('./sqlClient');
var seed = require('../config/materialSeed');
var localFile = process.env.MATERIALS_LOCAL_FILE || path.join(__dirname, '../tmp/activity-materials.json');

function conflict() { var error = new Error('Material changed. Reload before saving. / 材料已更新，请刷新后再保存。'); error.status = 409; throw error; }
function invalidLesson() { var error = new Error('Choose an available lesson. / 请选择有效课次。'); error.status = 400; throw error; }
async function localData() {
  try { return JSON.parse(await fs.readFile(localFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return [JSON.parse(JSON.stringify(seed))]; }
}
function material(row) {
  return { id: row.id, ownerKey: row.owner_key, theme: row.theme, themes: JSON.parse(row.themes), title: row.title, description: row.description,
    titleEn: row.title_en || '', descriptionEn: row.description_en, limitedFree: Boolean(row.limited_free), preview: row.preview,
    products: JSON.parse(row.products || '[]'), files: JSON.parse(row.files), revision: row.revision };
}
async function catalog() {
  if (!process.env.SQL_CONNECTION_STRING) return [Object.assign({}, seed.lessons[0])];
  var pool = await db.getPool();
  return (await pool.request().query('SELECT id, series, book_slug AS book, slug, lesson_no AS lessonNo, title FROM dbo.textbook_lessons WHERE is_published = 1 ORDER BY series, book_slug, sort_order, id;')).recordset;
}
async function list(filter) {
  filter = filter || {};
  var items;
  if (!process.env.SQL_CONNECTION_STRING) items = await localData();
  else {
    var pool = await db.getPool();
    var rows = (await pool.request().query('SELECT * FROM dbo.activity_materials ORDER BY updated_at DESC;')).recordset;
    var links = (await pool.request().query('SELECT a.material_id, l.id, l.series, l.book_slug AS book, l.slug, l.lesson_no AS lessonNo, l.title FROM dbo.activity_material_lessons a JOIN dbo.textbook_lessons l ON l.id = a.lesson_id WHERE l.is_published = 1;')).recordset;
    items = rows.map(function (row) { return Object.assign(material(row), { lessons: links.filter(function (link) { return link.material_id === row.id; }) }); });
  }
  return items.map(function (item) { return Object.assign({}, item, { themes: item.themes || [item.theme] }); }).filter(function (item) {
    return (!filter.theme || item.themes.includes(filter.theme)) && (!filter.lesson || item.lessons.some(function (lesson) {
      return lesson.series === filter.lesson.series && lesson.book === filter.lesson.book && lesson.slug === filter.lesson.slug;
    }));
  });
}
async function get(id) { return (await list()).find(function (item) { return item.id === id; }) || null; }

// Metadata, attachments and links change together; revision prevents lost concurrent edits.
async function save(item, lessonIds, revision) {
  item = Object.assign({}, item, { themes: item.themes || [item.theme] });
  item.theme = item.themes[0];
  if (!process.env.SQL_CONNECTION_STRING) {
    var data = await localData();
    var old = data.find(function (entry) { return entry.id === item.id; });
    if ((old ? old.revision : 0) !== revision) conflict();
    var lessons = (await catalog()).filter(function (lesson) { return lessonIds.includes(lesson.id); });
    if (lessons.length !== lessonIds.length) invalidLesson();
    item = Object.assign({}, item, { lessons: lessons, revision: revision + 1 });
    data = data.filter(function (entry) { return entry.id !== item.id; }).concat([item]);
    await fs.mkdir(path.dirname(localFile), { recursive: true });
    await fs.writeFile(localFile, JSON.stringify(data, null, 2));
    return item;
  }
  var pool = await db.getPool();
  var tx = new db.sql.Transaction(pool);
  await tx.begin();
  try {
    var current = await new db.sql.Request(tx).input('id', db.sql.VarChar(64), item.id)
      .query('SELECT revision FROM dbo.activity_materials WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;');
    if ((current.recordset.length ? current.recordset[0].revision : 0) !== revision) conflict();
    var request = new db.sql.Request(tx).input('id', db.sql.VarChar(64), item.id)
      .input('owner', db.sql.Char(64), item.ownerKey).input('theme', db.sql.VarChar(40), item.theme)
      .input('themes', db.sql.NVarChar(db.sql.MAX), JSON.stringify(item.themes))
      .input('title', db.sql.NVarChar(120), item.title).input('titleEn', db.sql.NVarChar(120), item.titleEn || '').input('description', db.sql.NVarChar(2000), item.description)
      .input('en', db.sql.NVarChar(2000), item.descriptionEn).input('free', db.sql.Bit, item.limitedFree)
      .input('products', db.sql.NVarChar(db.sql.MAX), JSON.stringify(item.products || []))
      .input('preview', db.sql.NVarChar(500), item.preview).input('files', db.sql.NVarChar(db.sql.MAX), JSON.stringify(item.files));
    await request.query(current.recordset.length
      ? 'UPDATE dbo.activity_materials SET theme=@theme, themes=@themes, title=@title, title_en=@titleEn, description=@description, description_en=@en, limited_free=@free, products=@products, preview=@preview, files=@files, revision=revision+1, updated_at=SYSUTCDATETIME() WHERE id=@id;'
      : 'INSERT INTO dbo.activity_materials (id, owner_key, theme, themes, title, title_en, description, description_en, limited_free, products, preview, files) VALUES (@id,@owner,@theme,@themes,@title,@titleEn,@description,@en,@free,@products,@preview,@files);');
    await new db.sql.Request(tx).input('id', db.sql.VarChar(64), item.id).query('DELETE FROM dbo.activity_material_lessons WHERE material_id=@id;');
    for (var lessonId of lessonIds) {
      var linked = await new db.sql.Request(tx).input('id', db.sql.VarChar(64), item.id).input('lesson', db.sql.Int, lessonId)
        .query('INSERT INTO dbo.activity_material_lessons (material_id,lesson_id) SELECT @id,id FROM dbo.textbook_lessons WHERE id=@lesson AND is_published=1;');
      if (linked.rowsAffected[0] !== 1) invalidLesson();
    }
    await tx.commit();
    return Object.assign({}, item, { revision: revision + 1 });
  } catch (error) { await tx.rollback(); throw error; }
}
module.exports = { list: list, get: get, save: save, catalog: catalog };
