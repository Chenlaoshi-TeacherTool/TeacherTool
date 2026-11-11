'use strict';

var fs = require('fs/promises');
var path = require('path');
var siteMap = require('../config/siteMap');
var textbooks = require('../config/textbooks');

function fail(message, status) { var error = new Error(message); error.status = status || 400; throw error; }
// Optional emoji for a theme card. Short free text; views escape it.
function themeIcon(value) {
  var icon = typeof value === 'string' ? value.trim() : '';
  if (icon.length > 16) fail('Use one emoji for the icon (or leave it empty). / 图标请填一个表情符号，也可以留空。');
  return icon;
}
function names(body) {
  ['zh', 'en'].forEach(function (field) { if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 120) fail('Enter Chinese and English names (maximum 120 characters). / 请填写中英文名称，各不超过120字。'); });
}
function snapshot(rows) {
  // Themes: admin-created rows first, then the built-in ones from config/siteMap.js. A row with a
  // built-in theme's key renames and orders that theme; its page stays in code. Dragged order wins.
  var builtIn = siteMap.children('activities');
  var themes = [];
  rows.forEach(function (row) {
    if (row.kind === 'theme' && !builtIn.some(function (item) { return item.key === row.entry_key; })) {
      themes.push({ key: row.entry_key, zh: row.zh, en: row.en, icon: row.icon || '', href: '/theme-activities/' + row.entry_key, template: 'theme', custom: true, order: row.sort_order || 0 });
    }
  });
  builtIn.forEach(function (item) {
    var row = rows.find(function (entry) { return entry.kind === 'theme' && entry.entry_key === item.key; });
    themes.push(Object.assign({}, item, row ? { zh: row.zh, en: row.en, icon: row.icon || '', order: row.sort_order || 0 } : { icon: item.icon || '', order: 0 }));
  });
  themes = themes.map(function (theme, index) { return { theme: theme, rank: theme.order > 0 ? theme.order : 100000 + index }; })
    .sort(function (a, b) { return a.rank - b.rank; }).map(function (entry) { return entry.theme; });
  var series = textbooks.SERIES.map(function (item) { return Object.assign({}, item, item.books ? { books: item.books.slice() } : {}); });
  rows.forEach(function (row) {
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
    names(body);
    var icon = kind === 'theme' ? themeIcon(body.icon) : '';
    var currentRows = await rows();
    var catalog = snapshot(currentRows);
    var parent = kind === 'book' && catalog.textbooks.findSeries(body.parent);
    if (kind === 'book' && !parent) fail('Choose an existing textbook. / 请选择已有教材。');
    var exists = kind === 'theme' ? catalog.themes.some(function (item) { return item.key === key; }) : kind === 'series' ? Boolean(catalog.textbooks.findSeries(key)) : Boolean(textbooks.findBook(parent, key));
    if (exists) fail('This URL name already exists. / 此地址已存在，请换一个。', 409);
    var row = { kind: kind, parent_key: parent ? parent.key : '', entry_key: key, zh: body.zh.trim(), en: body.en.trim(), icon: icon, members_only: kind === 'series' && body.membersOnly === 'on' };
    if (sqlMode()) {
      try {
        await (await db.getPool()).request().input('kind', db.sql.VarChar(10), row.kind).input('parent', db.sql.VarChar(40), row.parent_key)
          .input('key', db.sql.VarChar(40), key).input('zh', db.sql.NVarChar(120), row.zh).input('en', db.sql.NVarChar(120), row.en)
          .input('members', db.sql.Bit, row.members_only).input('icon', db.sql.NVarChar(16), row.icon)
          .query('INSERT INTO dbo.content_catalog (kind,parent_key,entry_key,zh,en,members_only,icon) VALUES (@kind,@parent,@key,@zh,@en,@members,@icon);');
      } catch (error) { if (error.number === 2627 || error.number === 2601) fail('This URL name already exists. / 此地址已存在，请换一个。', 409); throw error; }
    } else {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file + '.tmp', JSON.stringify(currentRows.concat([row]), null, 2));
      await fs.rename(file + '.tmp', file);
    }
    return row;
  }
  // Writes theme rows: updates the ones already stored, inserts the rest (a built-in theme gets its
  // row the first time it is renamed or ordered).
  async function storeThemes(currentRows, changed) {
    function stored(next) { return currentRows.find(function (item) { return item.kind === 'theme' && item.entry_key === next.entry_key; }); }
    if (sqlMode()) {
      for (var next of changed) {
        await (await db.getPool()).request().input('key', db.sql.VarChar(40), next.entry_key).input('zh', db.sql.NVarChar(120), next.zh)
          .input('en', db.sql.NVarChar(120), next.en).input('icon', db.sql.NVarChar(16), next.icon || '').input('sort', db.sql.Int, next.sort_order || 0)
          .query(stored(next)
            ? "UPDATE dbo.content_catalog SET zh=@zh, en=@en, icon=@icon, sort_order=@sort WHERE kind='theme' AND entry_key=@key;"
            : "INSERT INTO dbo.content_catalog (kind,parent_key,entry_key,zh,en,members_only,icon,sort_order) VALUES ('theme','',@key,@zh,@en,0,@icon,@sort);");
      }
      return;
    }
    var kept = currentRows.filter(function (item) { return !changed.some(function (next) { return item.kind === 'theme' && item.entry_key === next.entry_key; }); });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + '.tmp', JSON.stringify(kept.concat(changed), null, 2));
    await fs.rename(file + '.tmp', file);
  }
  function themeRow(currentRows, theme) {
    var row = currentRows.find(function (item) { return item.kind === 'theme' && item.entry_key === theme.key; });
    return row ? Object.assign({}, row) : { kind: 'theme', parent_key: '', entry_key: theme.key, zh: theme.zh, en: theme.en, icon: theme.icon || '', members_only: false, sort_order: 0 };
  }
  // Renames a theme (built-in or admin-created) or changes its icon. The URL name never changes.
  async function change(key, body) {
    names(body);
    var icon = themeIcon(body.icon);
    var currentRows = await rows();
    var theme = snapshot(currentRows).themes.find(function (item) { return item.key === key; });
    if (!theme) fail('Theme not found. / 主题不存在。', 404);
    var next = Object.assign(themeRow(currentRows, theme), { zh: body.zh.trim(), en: body.en.trim(), icon: icon });
    await storeThemes(currentRows, [next]);
    return next;
  }
  // Saves the display order. `keys` must list every theme exactly once.
  async function order(keys) {
    var currentRows = await rows();
    var themes = snapshot(currentRows).themes;
    if (!Array.isArray(keys) || keys.length !== themes.length || new Set(keys).size !== keys.length ||
      keys.some(function (key) { return !themes.some(function (theme) { return theme.key === key; }); })) fail('The theme list changed. Reload and try again. / 主题列表已变化，请刷新后重试。');
    await storeThemes(currentRows, keys.map(function (key, index) {
      return Object.assign(themeRow(currentRows, themes.find(function (theme) { return theme.key === key; })), { sort_order: index + 1 });
    }));
  }
  function queue(work) {
    var operation = pending.then(work);
    pending = operation.catch(function () {});
    return operation;
  }
  function add(kind, body) { return queue(function () { return insert(kind, body); }); }
  function updateTheme(key, body) { return queue(function () { return change(key, body); }); }
  function orderThemes(keys) { return queue(function () { return order(keys); }); }
  return { load: load, add: add, updateTheme: updateTheme, orderThemes: orderThemes };
}

module.exports = create();
module.exports.create = create;
