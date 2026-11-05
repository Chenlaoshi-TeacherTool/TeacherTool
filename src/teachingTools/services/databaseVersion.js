'use strict';

var config = require('../config/database');

var CACHE_MS = 5 * 60 * 1000;
var cached = null;

// Compares the newest migration recorded in dbo.schema_migrations with the one
// this code needs. { state: 'ok' | 'behind' | 'unknown', required, applied }.
async function check(options) {
  options = options || {};
  var now = Date.now();
  if (!options.fresh && cached && cached.expires > now) return cached.result;
  var result = { state: 'unknown', required: config.requiredMigration, applied: null };
  try {
    var db = options.db || require('./sqlClient');
    var pool = await db.getPool();
    var rows = (await pool.request().query('SELECT MAX(id) AS applied FROM dbo.schema_migrations;')).recordset;
    result.applied = rows[0] && rows[0].applied || null;
    result.state = result.applied && result.applied >= config.requiredMigration ? 'ok' : 'behind';
  } catch (error) {
    // No table yet means 0000_schema-migrations has not run: also behind.
    if (/schema_migrations/i.test(error.message || '')) result.state = 'behind';
  }
  cached = { result: result, expires: now + CACHE_MS };
  return result;
}

// Logs a warning at start-up when the database is behind the code.
function warnIfBehind() {
  if (!process.env.SQL_CONNECTION_STRING) return;
  check({ fresh: true }).then(function (result) {
    if (result.state === 'behind') console.warn('Database is behind this code: needs migration ' + result.required + ', newest applied is ' + (result.applied || 'none') + '. See database/README.md.');
  });
}

module.exports = { check: check, warnIfBehind: warnIfBehind };
