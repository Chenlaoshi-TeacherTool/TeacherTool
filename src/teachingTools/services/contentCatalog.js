'use strict';

var fs = require('fs/promises');
var path = require('path');
var siteMap = require('../config/siteMap');
var textbooks = require('../config/textbooks');

function fail(message, status) { var error = new Error(message); error.status = status || 400; throw error; }
function snapshot(rows) {
  var themes = siteMap.children('activities').slice();
  var series = textbooks.SERIES.map(function (item) { return Object.assign({}, item, item.books ? { books: item.books.slice() } : {}); });
  rows.forEach(function (row) {
    if (row.kind === 'theme') themes.push({ key: row.entry_key, zh: row.zh, en: row.en, href: '/theme-activities/' + row.entry_key, template: 'theme', custom: true });
    if (row.kind === 'series') series.push({ key: row.entry_key, zh: row.zh, en: row.en, books: [], membersOnly: Boolean(row.members_only) });
  });
  rows.filter(function (row) { return row.kind === 'book'; }).forEach(function (row) {
    var parent = series.find(function (item) { return item.key === row.parent_key; });
    if (parent) { if (!parent.books) parent.books = []; parent.books.push({ slug: row.entry_key, zh: row.zh, en: row.en }); }
  });
  return { themes: themes, textbooks: { SERIES: series, findSeries: function (key) { return series.find(function (item) { return item.key === key; }); }, findBook: textbooks.findBook } };
}

function create(options) {
  options = options || {};
  var db = options.db || require('./sqlClient');
  var file = options.file || process.env.CONTENT_CATALOG_LOCAL_FILE || path.join(__dirname, '../tmp/content-catalog.json');
  var pending = Promise.resolve();
  function sqlMode() { return options.db || process.env.SQL_CONNECTION_STRING; }
  async function rows() {
    if (sqlMode()) return (await (await db.getPool()).request().query('SELECT * FROM dbo.content_catalog ORDER BY created_at, kind, parent_key, entry_key;')).recordset;
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return []; }
  }
  async function load() { return snapshot(await rows()); }
  async function insert(kind, body) {
    if (!['theme', 'series', 'book'].includes(kind)) fail('Unknown catalog type. / 类型无效。');
    var key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 40) fail('Use a URL name of 1–40 lowercase letters, numbers or hyphens. / 地址请使用1至40位小写英文字母、数字或连字符。');
    if ((kind === 'series' && (key === 'files' || /^level-\d+$/.test(key))) || (kind === 'theme' && key === 'new')) fail('This URL name is reserved. / 此地址已保留。');
    ['zh', 'en'].forEach(function (field) { if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 120) fail('Enter Chinese and English names (maximum 120 characters). / 请填写中英文名称，各不超过120字。'); });
    var currentRows = await rows();
    var catalog = snapshot(currentRows);
    var parent = kind === 'book' && catalog.textbooks.findSeries(body.parent);
    if (kind === 'book' && !parent) fail('Choose an existing textbook. / 请选择已有教材。');
    var exists = kind === 'theme' ? catalog.themes.some(function (item) { return item.key === key; }) : kind === 'series' ? Boolean(catalog.textbooks.findSeries(key)) : Boolean(textbooks.findBook(parent, key));
    if (exists) fail('This URL name already exists. / 此地址已存在，请换一个。', 409);
    var row = { kind: kind, parent_key: parent ? parent.key : '', entry_key: key, zh: body.zh.trim(), en: body.en.trim(), members_only: kind === 'series' && body.membersOnly === 'on' };
    if (sqlMode()) {
      try {
        await (await db.getPool()).request().input('kind', db.sql.VarChar(10), row.kind).input('parent', db.sql.VarChar(40), row.parent_key)
          .input('key', db.sql.VarChar(40), key).input('zh', db.sql.NVarChar(120), row.zh).input('en', db.sql.NVarChar(120), row.en)
          .input('members', db.sql.Bit, row.members_only).query('INSERT INTO dbo.content_catalog (kind,parent_key,entry_key,zh,en,members_only) VALUES (@kind,@parent,@key,@zh,@en,@members);');
      } catch (error) { if (error.number === 2627 || error.number === 2601) fail('This URL name already exists. / 此地址已存在，请换一个。', 409); throw error; }
    } else {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file + '.tmp', JSON.stringify(currentRows.concat([row]), null, 2));
      await fs.rename(file + '.tmp', file);
    }
    return row;
  }
  function add(kind, body) {
    var operation = pending.then(function () { return insert(kind, body); });
    pending = operation.catch(function () {});
    return operation;
  }
  return { load: load, add: add };
}

module.exports = create();
module.exports.create = create;
