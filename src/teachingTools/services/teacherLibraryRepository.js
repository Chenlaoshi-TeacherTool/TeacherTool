'use strict';

var db = require('./sqlClient');

async function load(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT content, revision FROM dbo.teacher_private_libraries WHERE owner_key = @owner; ' +
    'SELECT write_until, trial_started_at, CASE WHEN write_until > SYSUTCDATETIME() THEN 1 ELSE 0 END AS can_write FROM dbo.teacher_library_access WHERE owner_key = @owner;'
  );
  var row = result.recordsets[0][0];
  var access = result.recordsets[1][0];
  return {
    content: row ? row.content : null,
    revision: row ? row.revision : 0,
    canWrite: Boolean(access && access.can_write),
    writeUntil: access ? access.write_until : null,
    trial: Boolean(access && access.trial_started_at)
  };
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

// Gives a brand-new account its trial once; accounts that already have an access row are left alone.
async function ensureTrial(owner, days) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner).input('days', db.sql.Int, days).query(
    'SET NOCOUNT ON; INSERT INTO dbo.teacher_library_access (owner_key, write_until, trial_started_at) ' +
    'SELECT @owner, DATEADD(DAY, @days, SYSUTCDATETIME()), SYSUTCDATETIME() ' +
    'WHERE NOT EXISTS (SELECT 1 FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner);'
  );
}

// Marks the code used and extends access from whichever is later: now or the current end date.
async function redeem(owner, codeHash) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).input('code', db.sql.Char(64), codeHash).query(
    'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
    'DECLARE @used TABLE (days INT); ' +
    'UPDATE dbo.teacher_activation_codes WITH (UPDLOCK, HOLDLOCK) SET redeemed_by = @owner, redeemed_at = SYSUTCDATETIME() OUTPUT INSERTED.days INTO @used ' +
    'WHERE code_hash = @code AND redeemed_by IS NULL; ' +
    "IF NOT EXISTS (SELECT 1 FROM @used) BEGIN ROLLBACK; SELECT 'invalid' AS outcome; RETURN; END; " +
    'DECLARE @days INT = (SELECT TOP 1 days FROM @used); ' +
    'IF EXISTS (SELECT 1 FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner) ' +
    '  UPDATE dbo.teacher_library_access SET write_until = DATEADD(DAY, @days, CASE WHEN write_until > SYSUTCDATETIME() THEN write_until ELSE SYSUTCDATETIME() END) WHERE owner_key = @owner; ' +
    'ELSE INSERT INTO dbo.teacher_library_access (owner_key, write_until) VALUES (@owner, DATEADD(DAY, @days, SYSUTCDATETIME())); ' +
    "COMMIT; SELECT 'redeemed' AS outcome, @days AS days, write_until FROM dbo.teacher_library_access WHERE owner_key = @owner;"
  );
  var row = result.recordset[0];
  return row.outcome === 'redeemed' ? { outcome: 'redeemed', days: row.days, writeUntil: row.write_until } : { outcome: 'invalid' };
}

async function createCodes(codes, createdBy) {
  var pool = await db.getPool();
  var transaction = new db.sql.Transaction(pool);
  await transaction.begin();
  try {
    for (var i = 0; i < codes.length; i += 1) {
      await new db.sql.Request(transaction).input('code', db.sql.Char(64), codes[i].hash).input('days', db.sql.Int, codes[i].days)
        .input('label', db.sql.NVarChar(100), codes[i].label || null).input('by', db.sql.NVarChar(200), createdBy || null)
        .query('INSERT INTO dbo.teacher_activation_codes (code_hash, days, batch_label, created_by) VALUES (@code, @days, @label, @by);');
    }
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
}

async function listCodeBatches() {
  var pool = await db.getPool();
  var result = await pool.request().query(
    'SELECT TOP 50 batch_label, days, MIN(created_at) AS created_at, COUNT(*) AS total, COUNT(redeemed_at) AS redeemed ' +
    'FROM dbo.teacher_activation_codes GROUP BY batch_label, days ORDER BY MIN(created_at) DESC;'
  );
  return result.recordset;
}

module.exports = { load: load, save: save, ensureTrial: ensureTrial, redeem: redeem, createCodes: createCodes, listCodeBatches: listCodeBatches };
