'use strict';

var db = require('./sqlClient');

// One row per shared game or book a teacher account owns (dbo.teacher_activities).
// Games also keep their content (payload) so a new link can be made after the
// old one expires; see database/migrations/0006_add-teacher-activity-payload.sql.

async function list(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT TOP 300 kind, item_id, game_type, title, created_at, expires_at, CASE WHEN payload IS NULL THEN 0 ELSE 1 END AS can_relink ' +
    'FROM dbo.teacher_activities WHERE owner_key = @owner ORDER BY created_at DESC;'
  );
  return result.recordset.map(function (row) {
    return { kind: row.kind, id: row.item_id, gameType: row.game_type, title: row.title, createdAt: row.created_at, expiresAt: row.expires_at, canRelink: Boolean(row.can_relink) };
  });
}

// Adds the row, or fills in content/expiry an older row is missing.
async function add(owner, item) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('kind', db.sql.VarChar(10), item.kind)
    .input('id', db.sql.VarChar(64), item.id).input('type', db.sql.VarChar(40), item.gameType || null)
    .input('title', db.sql.NVarChar(200), String(item.title || '').slice(0, 200) || null)
    .input('created', db.sql.DateTime2, item.createdAt ? new Date(item.createdAt) : new Date())
    .input('payload', db.sql.NVarChar(db.sql.MAX), item.payload ? JSON.stringify(item.payload) : null)
    .input('version', db.sql.Int, item.version || null)
    .input('expires', db.sql.DateTime2, item.expiresAt ? new Date(item.expiresAt) : null)
    .query(
      'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_activities WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner AND kind = @kind AND item_id = @id) ' +
      'INSERT INTO dbo.teacher_activities (owner_key, kind, item_id, game_type, title, created_at, payload, game_version, expires_at) VALUES (@owner, @kind, @id, @type, @title, @created, @payload, @version, @expires); ' +
      'ELSE UPDATE dbo.teacher_activities SET payload = COALESCE(payload, @payload), game_version = COALESCE(game_version, @version), expires_at = COALESCE(expires_at, @expires) ' +
      'WHERE owner_key = @owner AND kind = @kind AND item_id = @id;'
    );
}

// The saved game content of one of this owner's activities, or null.
async function getGame(owner, id) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).input('id', db.sql.VarChar(64), id).query(
    "SELECT game_type, game_version, title, payload FROM dbo.teacher_activities WHERE owner_key = @owner AND kind = 'game' AND item_id = @id AND payload IS NOT NULL;"
  );
  var row = result.recordset[0];
  return row ? { gameType: row.game_type, version: row.game_version || 1, title: row.title, payload: JSON.parse(row.payload) } : null;
}

// Points the activity at its new link. Returns false when the row is gone.
async function relink(owner, oldId, newId, expiresAt) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).input('old', db.sql.VarChar(64), oldId)
    .input('new', db.sql.VarChar(64), newId).input('expires', db.sql.DateTime2, new Date(expiresAt)).query(
      "UPDATE dbo.teacher_activities SET item_id = @new, expires_at = @expires, created_at = SYSUTCDATETIME() WHERE owner_key = @owner AND kind = 'game' AND item_id = @old;"
    );
  return result.rowsAffected[0] > 0;
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

// Used when a link expires: rows with saved content stay so a new link can be made.
async function linkExpired(kind, id) {
  var pool = await db.getPool();
  await pool.request().input('kind', db.sql.VarChar(10), kind).input('id', db.sql.VarChar(64), id)
    .query('DELETE FROM dbo.teacher_activities WHERE kind = @kind AND item_id = @id AND payload IS NULL;');
}

module.exports = { list: list, add: add, getGame: getGame, relink: relink, remove: remove, removeItem: removeItem, linkExpired: linkExpired };
