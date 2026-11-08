'use strict';

var pinyin = require('../public/vendor/pinyin-pro').pinyin;
var LENGTHS = { zh: 100, py: 200, en: 200, kind: 20 };

function invalid(message) { var error = new Error(message); error.status = 400; throw error; }
function parse(text) {
  if (typeof text !== 'string' || text.length > 5000) invalid('Enter up to 60 Chinese words. / 请填写最多60个中文词语。');
  var words = Array.from(new Set(text.split(/[\r\n,，、;；]+/).map(function (word) { return word.trim(); }).filter(Boolean)));
  if (!words.length || words.length > 60 || words.some(function (word) { return word.length > 40 || !/[\u3400-\u9fff\uf900-\ufaff]/.test(word); })) invalid('Use one Chinese word per line (up to 60 words, 40 characters each). / 每行一个中文词语，最多60个，每个不超过40字。');
  return words;
}
function validate(items) {
  if (!Array.isArray(items) || !items.length || items.length > 60) invalid('Review 1–60 words before saving. / 请确认1至60个词语后再保存。');
  return items.map(function (item) {
    var clean = {};
    Object.keys(LENGTHS).forEach(function (key) {
      var max = LENGTHS[key];
      var value = item && item[key];
      if (value == null && (key === 'en' || key === 'kind')) value = '';
      if (typeof value !== 'string' || value.trim().length > max || ((key === 'zh' || key === 'py') && !value.trim())) invalid('Check Chinese, pinyin and field lengths. / 请检查中文、拼音和各栏字数。');
      clean[key] = value.trim();
    });
    return clean;
  });
}

function create(options) {
  options = options || {};
  var db = options.db || require('./sqlClient');
  var translator = options.translator || require('./wordTranslator');
  async function exists(id) {
    return Boolean((await (await db.getPool()).request().input('id', db.sql.Int, id).query('SELECT id FROM dbo.textbook_lessons WHERE id=@id;')).recordset.length);
  }
  async function generate(text) {
    var words = parse(text);
    var items = words.map(function (word) { return { zh: word, py: pinyin(word), en: '', kind: '' }; });
    var warning = '';
    try {
      if (!translator.isConfigured()) throw new Error('unconfigured');
      var result = await translator.translateWords(words, ['en']);
      items.forEach(function (item) { item.en = result.translations[item.zh] && result.translations[item.zh].en || ''; });
      if (items.some(function (item) { return !item.en; })) throw new Error('incomplete');
    } catch (error) { warning = 'English translation is unavailable or incomplete. Pinyin is ready; fill in missing English or try again. / 英文翻译暂不可用或不完整。拼音已生成，可手动补充英文，或重新生成。'; }
    return { items: items, warning: warning };
  }
  async function append(id, items) {
    items = validate(items);
    var tx = new db.sql.Transaction(await db.getPool());
    await tx.begin();
    try {
      var lesson = await new db.sql.Request(tx).input('id', db.sql.Int, id)
        .query('SELECT id FROM dbo.textbook_lessons WITH (UPDLOCK, HOLDLOCK) WHERE id=@id;');
      if (!lesson.recordset.length) { var missing = new Error('Lesson not found. / 课次不存在。'); missing.status = 404; throw missing; }
      var existing = (await new db.sql.Request(tx).input('id', db.sql.Int, id).query('SELECT zh, sort_order FROM dbo.textbook_lesson_items WHERE lesson_id=@id;')).recordset;
      var seen = new Set(existing.map(function (item) { return item.zh.trim(); }));
      var order = existing.reduce(function (max, item) { return Math.max(max, item.sort_order); }, -1) + 1;
      var table = new db.sql.Table('textbook_lesson_items');
      table.columns.add('lesson_id', db.sql.Int, { nullable: false });
      table.columns.add('zh', db.sql.NVarChar(100), { nullable: false });
      table.columns.add('py', db.sql.NVarChar(200), { nullable: false });
      table.columns.add('en', db.sql.NVarChar(200), { nullable: false });
      table.columns.add('kind', db.sql.NVarChar(20), { nullable: true });
      table.columns.add('sort_order', db.sql.Int, { nullable: false });
      var added = 0;
      items.forEach(function (item) {
        if (seen.has(item.zh)) return;
        seen.add(item.zh); table.rows.add(id, item.zh, item.py, item.en, item.kind || null, order++); added++;
      });
      if (added) await new db.sql.Request(tx).bulk(table);
      await tx.commit();
      return { added: added, skipped: items.length - added };
    } catch (error) { await tx.rollback(); throw error; }
  }
  return { exists: exists, generate: generate, append: append };
}

module.exports = create();
module.exports.create = create;
module.exports.parse = parse;
