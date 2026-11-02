'use strict';

var db = require('./sqlClient');

async function load(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT content, revision FROM dbo.teacher_private_libraries WHERE owner_key = @owner; ' +
    'SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.teacher_library_access WHERE owner_key = @owner AND write_until > SYSUTCDATETIME()) THEN 1 ELSE 0 END AS can_write;'
  );
  var row = result.recordsets[0][0];
  return { content: row ? row.content : null, revision: row ? row.revision : 0, canWrite: Boolean(result.recordsets[1][0].can_write) };
}

async function save(owner, revision, content) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner)
    .input('revision', db.sql.Int, revision).input('content', db.sql.NVarChar(db.sql.MAX), content).query(
      'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
      'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner AND write_until > SYSUTCDATETIME()) ' +
      "BEGIN ROLLBACK; SELECT 'forbidden' AS outcome; RETURN; END; " +
      'DECLARE @actual INT; SELECT @actual = revision FROM dbo.teacher_private_libraries WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner; ' +
      'IF ISNULL(@actual, 0) <> @revision ' +
      "BEGIN ROLLBACK; SELECT 'conflict' AS outcome; RETURN; END; " +
      'IF @actual IS NULL INSERT INTO dbo.teacher_private_libraries(owner_key, content, revision) VALUES (@owner, @content, 1); ' +
      'ELSE UPDATE dbo.teacher_private_libraries SET content = @content, revision = revision + 1, updated_at = SYSUTCDATETIME() WHERE owner_key = @owner; ' +
      "COMMIT; SELECT 'saved' AS outcome, @revision + 1 AS revision;"
    );
  return result.recordset[0];
}

module.exports = { load: load, save: save };
