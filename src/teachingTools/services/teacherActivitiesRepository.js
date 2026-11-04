'use strict';

var db = require('./sqlClient');

// One row per shared game or book a teacher account owns (dbo.teacher_activities).

async function list(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT TOP 300 kind, item_id, game_type, title, created_at FROM dbo.teacher_activities WHERE owner_key = @owner ORDER BY created_at DESC;'
  );
  return result.recordset.map(function (row) {
    return { kind: row.kind, id: row.item_id, gameType: row.game_type, title: row.title, createdAt: row.created_at };
  });
}

async function add(owner, item) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(10), item.kind)
    .input('id', db.sql.VarChar(64), item.id).input('type', db.sql.VarChar(40), item.gameType || null)
    .input('title', db.sql.NVarChar(200), String(item.title || '').slice(0, 200) || null)
    .input('created', db.sql.DateTime2, item.createdAt ? new Date(item.createdAt) : new Date())
    .query(
      'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_activities WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner AND kind = @kind AND item_id = @id) ' +
      'INSERT INTO dbo.teacher_activities (owner_key, kind, item_id, game_type, title, created_at) VALUES (@owner, @kind, @id, @type, @title, @created);'
    );
}

async function remove(owner, kind, id) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(10), kind).input('id', db.sql.VarChar(64), id)
    .query('DELETE FROM dbo.teacher_activities WHERE owner_key = @owner AND kind = @kind AND item_id = @id;');
}

// Used when the shared item itself is deleted, whoever deleted it.
async function removeItem(kind, id) {
  var pool = await db.getPool();
  await pool.request().input('kind', db.sql.VarChar(10), kind).input('id', db.sql.VarChar(64), id)
    .query('DELETE FROM dbo.teacher_activities WHERE kind = @kind AND item_id = @id;');
}

module.exports = { list: list, add: add, remove: remove, removeItem: removeItem };
