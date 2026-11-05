'use strict';

var db = require('./sqlClient');

// dbo.teacher_accounts: who each owner_key is (email, name), for admin lookups.

// Adds the account on first sign-in; afterwards refreshes email/name when they
// change and last_seen_at at most once an hour, so page loads rarely write.
async function touch(owner, account) {
  var pool = await db.getPool();
  await pool.request().input('owner', db.sql.Char(64), owner)
    .input('provider', db.sql.VarChar(40), String(account.provider || '').slice(0, 40))
    .input('email', db.sql.NVarChar(320), account.email ? String(account.email).slice(0, 320) : null)
    .input('name', db.sql.NVarChar(200), account.name ? String(account.name).slice(0, 200) : null)
    .query(
      'SET NOCOUNT ON; ' +
      'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_accounts WITH (UPDLOCK, HOLDLOCK) WHERE owner_key = @owner) ' +
      '  INSERT INTO dbo.teacher_accounts (owner_key, provider, email, display_name) VALUES (@owner, @provider, @email, @name); ' +
      'ELSE UPDATE dbo.teacher_accounts SET email = COALESCE(@email, email), display_name = COALESCE(@name, display_name), last_seen_at = SYSUTCDATETIME() ' +
      'WHERE owner_key = @owner AND (last_seen_at < DATEADD(HOUR, -1, SYSUTCDATETIME()) ' +
      "  OR (@email IS NOT NULL AND ISNULL(email, N'') <> @email) OR (@name IS NOT NULL AND ISNULL(display_name, N'') <> @name));"
    );
}

// Accounts whose email contains the search text, with their membership and usage.
async function search(text) {
  var pool = await db.getPool();
  var query = String(text || '').trim().toLowerCase().slice(0, 320);
  if (!query) return [];
  var result = await pool.request().input('query', db.sql.NVarChar(330), '%' + query.replace(/[\\%_[]/g, '\\$&') + '%').query(
    'SELECT TOP 20 a.owner_key, a.provider, a.email, a.display_name, a.created_at, a.last_seen_at, ' +
    '  l.write_until, l.trial_started_at, ' +
    '  (SELECT COUNT(*) FROM dbo.teacher_activities t WHERE t.owner_key = a.owner_key) AS activities, ' +
    '  (SELECT COUNT(*) FROM dbo.teacher_activation_codes c WHERE c.redeemed_by = a.owner_key) AS codes_used ' +
    "FROM dbo.teacher_accounts a LEFT JOIN dbo.teacher_library_access l ON l.owner_key = a.owner_key WHERE a.email LIKE @query ESCAPE '\\' " +
    'ORDER BY a.last_seen_at DESC;'
  );
  return result.recordset.map(function (row) {
    return {
      ownerKey: row.owner_key, provider: row.provider, email: row.email, name: row.display_name, createdAt: row.created_at, lastSeenAt: row.last_seen_at,
      writeUntil: row.write_until, trialStartedAt: row.trial_started_at, activities: row.activities, codesUsed: row.codes_used
    };
  });
}

module.exports = { touch: touch, search: search };
