'use strict';
var fs = require('fs/promises');
var path = require('path');
var config = require('../config/editablePages');
function create(options) {
  options = options || {};
  var db = options.db || require('./sqlClient');
  var file = options.file || path.join(__dirname, '../tmp/site-pages.json');
  var pending = Promise.resolve();
  function sqlMode() { return options.db || process.env.SQL_CONNECTION_STRING; }
  async function rows() {
    if (sqlMode()) return (await (await db.getPool()).request().query('SELECT page_key, draft, published FROM dbo.site_pages')).recordset;
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async function load(key) {
    var row = (await rows()).find(function(item) { return item.page_key === key; });
    return { draft: row ? JSON.parse(row.draft) : config.defaults(key), published: row && row.published ? JSON.parse(row.published) : null };
  }
  function validate(key, body) {
    if (!Object.hasOwn(config.pages, key)) throw new Error('Unknown page');
    var values = { zh: {}, en: {} };
    config.pages[key].fields.forEach(function(field) {
      ['zh', 'en'].forEach(function(lang) {
        var value = body[lang + ':' + field[0]];
        if (typeof value !== 'string' || !value.trim() || value.length > 4000) {
          var error = new Error('请填写所有中英文内容，每项不超过4000字。'); error.status = 400; throw error;
        }
        values[lang][field[0]] = value.trim();
      });
    });
    return values;
  }
  function save(key, body, publish) {
    var values = validate(key, body);
    var task = pending.then(async function() {
      var draft = JSON.stringify(values);
      if (sqlMode()) {
        await (await db.getPool()).request().input('key', db.sql.VarChar(20), key)
          .input('draft', db.sql.NVarChar(db.sql.MAX), draft).input('publish', db.sql.Bit, publish)
          .query('SET XACT_ABORT ON; BEGIN TRANSACTION; IF EXISTS (SELECT 1 FROM dbo.site_pages WITH (UPDLOCK, HOLDLOCK) WHERE page_key=@key) UPDATE dbo.site_pages SET draft=@draft, published=CASE WHEN @publish=1 THEN @draft ELSE published END WHERE page_key=@key; ELSE INSERT INTO dbo.site_pages (page_key,draft,published) VALUES (@key,@draft,CASE WHEN @publish=1 THEN @draft ELSE NULL END); COMMIT;');
      } else {
        var current = await rows();
        var row = current.find(function(item) { return item.page_key === key; });
        if (!row) { row = { page_key: key, published: null }; current.push(row); }
        row.draft = draft;
        if (publish) row.published = draft;
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file + '.tmp', JSON.stringify(current));
        await fs.rename(file + '.tmp', file);
      }
    });
    pending = task.catch(function() {});
    return task;
  }
  async function publicText(key, lang, fallback) {
    var page;
    try { page = await load(key); }
    catch (error) {
      // Public pages retain their built-in copy until the migration is installed.
      if (error.number === 208) return fallback;
      throw error;
    }
    return function(field) { return page.published && page.published[lang] && page.published[lang][field] || fallback(field); };
  }
  return { load: load, save: save, publicText: publicText };
}
module.exports = Object.assign(create(), { create: create });
