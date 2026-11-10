'use strict';

var db = require('./sqlClient');

async function load(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT content, revision FROM dbo.teacher_private_libraries WHERE owner_key = @owner; ' +
    'SELECT write_until, CASE WHEN write_until > SYSUTCDATETIME() THEN 1 ELSE 0 END AS can_write, ' +
    // Still on the free trial only until an activation code is used (a refunded code does not count).
    'CASE WHEN trial_started_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.teacher_activation_codes c WHERE c.redeemed_by = @owner AND c.revoked_at IS NULL) THEN 1 ELSE 0 END AS on_trial ' +
    'FROM dbo.teacher_library_access WHERE owner_key = @owner;'
  );
  var row = result.recordsets[0][0];
  var access = result.recordsets[1][0];
  return {
    content: row ? row.content : null,
    revision: row ? row.revision : 0,
    canWrite: Boolean(access && access.can_write),
    writeUntil: access ? access.write_until : null,
    trial: Boolean(access && access.on_trial)
  };
}

// Membership check without loading the saved library itself.
async function hasActiveAccess(owner) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT 1 AS active FROM dbo.teacher_library_access WHERE owner_key = @owner AND write_until > SYSUTCDATETIME();'
  );
  return result.recordset.length > 0;
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
    'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
    'INSERT INTO dbo.teacher_library_access (owner_key, write_until, trial_started_at) ' +
    'SELECT @owner, DATEADD(DAY, @days, SYSUTCDATETIME()), SYSUTCDATETIME() ' +
    'WHERE NOT EXISTS (SELECT 1 FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner); ' +
    "IF @@ROWCOUNT = 1 INSERT INTO dbo.membership_events (owner_key, kind, days, until_after) SELECT @owner, 'trial', @days, write_until FROM dbo.teacher_library_access WHERE owner_key = @owner; " +
    'COMMIT;'
  );
}

// Every recorded change to the end dates of these accounts, newest first (dbo.membership_events).
async function listEvents(owners) {
  if (!owners.length) return [];
  var pool = await db.getPool();
  var request = pool.request();
  var names = owners.slice(0, 50).map(function (owner, index) { request.input('o' + index, db.sql.Char(64), owner); return '@o' + index; });
  var result = await request.query(
    'SELECT TOP 500 e.owner_key, e.kind, e.days, e.until_before, e.until_after, e.actor, e.created_at, c.batch_label ' +
    'FROM dbo.membership_events e LEFT JOIN dbo.teacher_activation_codes c ON c.code_hash = e.code_hash ' +
    'WHERE e.owner_key IN (' + names.join(', ') + ') ORDER BY e.created_at DESC, e.id DESC;'
  );
  return result.recordset.map(function (row) {
    return { ownerKey: row.owner_key, kind: row.kind, days: row.days, untilBefore: row.until_before, untilAfter: row.until_after, actor: row.actor, createdAt: row.created_at, batchLabel: row.batch_label };
  });
}

// Marks the code used and extends access from whichever is later: now or the current end date.
async function redeem(owner, codeHash) {
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).input('code', db.sql.Char(64), codeHash).query(
    'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
    'DECLARE @used TABLE (days INT); ' +
    'UPDATE dbo.teacher_activation_codes WITH (UPDLOCK, HOLDLOCK) SET redeemed_by = @owner, redeemed_at = SYSUTCDATETIME() OUTPUT INSERTED.days INTO @used ' +
    'WHERE code_hash = @code AND redeemed_by IS NULL AND revoked_at IS NULL; ' +
    "IF NOT EXISTS (SELECT 1 FROM @used) BEGIN ROLLBACK; SELECT 'invalid' AS outcome; RETURN; END; " +
    'DECLARE @days INT = (SELECT TOP 1 days FROM @used); ' +
    'DECLARE @before DATETIME2 = (SELECT write_until FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner); ' +
    'IF @before IS NOT NULL ' +
    '  UPDATE dbo.teacher_library_access SET write_until = DATEADD(DAY, @days, CASE WHEN write_until > SYSUTCDATETIME() THEN write_until ELSE SYSUTCDATETIME() END) WHERE owner_key = @owner; ' +
    'ELSE INSERT INTO dbo.teacher_library_access (owner_key, write_until) VALUES (@owner, DATEADD(DAY, @days, SYSUTCDATETIME())); ' +
    "INSERT INTO dbo.membership_events (owner_key, kind, days, until_before, until_after, code_hash) SELECT @owner, 'code', @days, @before, write_until, @code FROM dbo.teacher_library_access WHERE owner_key = @owner; " +
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
    'SELECT TOP 50 batch_label, days, MIN(created_at) AS created_at, COUNT(*) AS total, COUNT(redeemed_at) AS redeemed, COUNT(revoked_at) AS revoked ' +
    'FROM dbo.teacher_activation_codes GROUP BY batch_label, days ORDER BY MIN(created_at) DESC;'
  );
  return result.recordset;
}

// Deactivates a code (refunds). An unused code can no longer be redeemed; a used
// one also takes its days back from the teacher who redeemed it.
async function revokeCode(codeHash, revokedBy) {
  var pool = await db.getPool();
  var result = await pool.request().input('code', db.sql.Char(64), codeHash).input('by', db.sql.NVarChar(200), revokedBy || null).query(
    'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
    'DECLARE @days INT, @owner CHAR(64), @revoked DATETIME2; ' +
    'SELECT @days = days, @owner = redeemed_by, @revoked = revoked_at FROM dbo.teacher_activation_codes WITH (UPDLOCK, HOLDLOCK) WHERE code_hash = @code; ' +
    "IF @days IS NULL BEGIN ROLLBACK; SELECT 'not-found' AS outcome; RETURN; END; " +
    "IF @revoked IS NOT NULL BEGIN ROLLBACK; SELECT 'already' AS outcome; RETURN; END; " +
    'UPDATE dbo.teacher_activation_codes SET revoked_at = SYSUTCDATETIME(), revoked_by = @by WHERE code_hash = @code; ' +
    'IF @owner IS NOT NULL ' +
    'BEGIN ' +
    '  DECLARE @before DATETIME2 = (SELECT write_until FROM dbo.teacher_library_access WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner); ' +
    '  UPDATE dbo.teacher_library_access SET write_until = DATEADD(DAY, -@days, write_until) WHERE owner_key = @owner; ' +
    "  INSERT INTO dbo.membership_events (owner_key, kind, days, until_before, until_after, code_hash, actor) SELECT @owner, 'refund', -@days, @before, write_until, @code, @by FROM dbo.teacher_library_access WHERE owner_key = @owner; " +
    'END; ' +
    "COMMIT; SELECT 'revoked' AS outcome, @days AS days, CASE WHEN @owner IS NULL THEN 0 ELSE 1 END AS was_used, " +
    '(SELECT write_until FROM dbo.teacher_library_access WHERE owner_key = @owner) AS write_until;'
  );
  var row = result.recordset[0];
  return row.outcome === 'revoked' ? { outcome: 'revoked', days: row.days, wasUsed: Boolean(row.was_used), writeUntil: row.write_until } : { outcome: row.outcome };
}

module.exports = { listEvents: listEvents, revokeCode: revokeCode, load: load, hasActiveAccess: hasActiveAccess, save: save, ensureTrial: ensureTrial, redeem: redeem, createCodes: createCodes, listCodeBatches: listCodeBatches };
