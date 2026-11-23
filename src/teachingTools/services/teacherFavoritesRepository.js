'use strict';

var db = require('./sqlClient');

// What each teacher account starred (dbo.teacher_favorites, migration 0027),
// in the teacher's own order. kind + ref is generic: 'tool' + tool href today.

var MAX_PER_KIND = 500;

async function list(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT TOP 2000 kind, ref FROM dbo.teacher_favorites WHERE owner_key = @owner ORDER BY kind, sort_order, created_at;'
  );
  return result.recordset.map(function (row) { return { kind: row.kind, ref: row.ref }; });
}

// Adds at the end of the list. Already starred = no change.
async function add(owner, kind, ref) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(20), kind).input('ref', db.sql.NVarChar(300), ref)
    .input('max', db.sql.Int, MAX_PER_KIND).query(
      'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_favorites WHERE owner_key = @owner AND kind = @kind AND ref = @ref) ' +
      'AND (SELECT COUNT(*) FROM dbo.teacher_favorites WHERE owner_key = @owner AND kind = @kind) < @max ' +
      'INSERT INTO dbo.teacher_favorites (owner_key, kind, ref, sort_order) ' +
      'SELECT @owner, @kind, @ref, ISNULL(MAX(sort_order), 0) + 1 FROM dbo.teacher_favorites WHERE owner_key = @owner AND kind = @kind;'
    );
}

async function remove(owner, kind, ref) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(20), kind).input('ref', db.sql.NVarChar(300), ref)
    .query('DELETE FROM dbo.teacher_favorites WHERE owner_key = @owner AND kind = @kind AND ref = @ref;');
}

// refs = the teacher's new order. Starred items missing from refs keep their place after them.
async function reorder(owner, kind, refs) {
  var pool = await db.getPool();
  var transaction = new db.sql.Transaction(pool);
  await transaction.begin();
  try {
    for (var index = 0; index < refs.length; index += 1) {
      await new db.sql.Request(transaction).input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(20), kind)
        .input('ref', db.sql.NVarChar(300), refs[index]).input('order', db.sql.Int, index + 1)
        .query('UPDATE dbo.teacher_favorites SET sort_order = @order WHERE owner_key = @owner AND kind = @kind AND ref = @ref;');
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = { list: list, add: add, remove: remove, reorder: reorder, MAX_PER_KIND: MAX_PER_KIND };
