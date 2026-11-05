'use strict';

// Database migrations: database/migrations/NNNN_name.sql, run in order once each.
// Every file records its own id in dbo.schema_migrations, so a file run by hand
// (Azure Portal query editor, sqlcmd) counts too.
//
//   npm run db:status   lists applied and pending migrations
//   npm run db:migrate  runs the pending ones in order
//
// Connection: DB_MIGRATION_CONNECTION_STRING, else SQL_CONNECTION_STRING, else
// add --azure-settings to read the web app's setting with the Azure CLI. The
// login needs permission to change tables, and the database firewall must
// allow this computer. Connection strings are never printed.

var fs = require('node:fs');
var path = require('node:path');
var execFileSync = require('node:child_process').execFileSync;

var DIR = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
var ID = /^(\d{4})_[a-z0-9-]+$/;

function listFiles(dir) {
  return fs.readdirSync(dir || DIR).filter(function (name) { return /\.sql$/.test(name); }).sort()
    .map(function (name) { return { id: name.slice(0, -4), file: path.join(dir || DIR, name) }; });
}

// Splits a script into batches on lines that contain only GO (sqlcmd style).
function batches(sqlText) {
  return sqlText.split(/^\s*GO\s*;?\s*$/im).map(function (part) { return part.trim(); }).filter(Boolean);
}

function connectionString() {
  if (process.argv.includes('--azure-settings')) {
    var args = ['webapp', 'config', 'appsettings', 'list', '-g', 'rg-xchen', '-n', 'chenlaoshi-teachingtools', '-o', 'json'];
    var windows = process.platform === 'win32';
    var settings;
    try {
      settings = JSON.parse(execFileSync(windows ? 'cmd.exe' : 'az', windows ? ['/d', '/s', '/c', 'az ' + args.join(' ')] : args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (error) { throw new Error('Could not read Azure app settings (is the Azure CLI signed in?).'); }
    var setting = settings.find(function (item) { return item.name === 'SQL_CONNECTION_STRING'; });
    if (setting) return setting.value;
  }
  var value = process.env.DB_MIGRATION_CONNECTION_STRING || process.env.SQL_CONNECTION_STRING;
  if (!value) throw new Error('Set DB_MIGRATION_CONNECTION_STRING (or SQL_CONNECTION_STRING), or add --azure-settings.');
  return value;
}

async function applied(pool) {
  var exists = (await pool.request().query("SELECT OBJECT_ID(N'dbo.schema_migrations', N'U') AS id;")).recordset[0].id;
  if (!exists) return new Set();
  return new Set((await pool.request().query('SELECT id FROM dbo.schema_migrations;')).recordset.map(function (row) { return row.id; }));
}

async function main() {
  var command = process.argv[2];
  if (command !== 'status' && command !== 'run') throw new Error('Usage: node scripts/db-migrations.js status|run [--azure-settings]');
  var sql = require('mssql');
  var pool = await new sql.ConnectionPool(connectionString()).connect();
  try {
    var done = await applied(pool);
    var pending = listFiles().filter(function (migration) { return !done.has(migration.id); });
    listFiles().forEach(function (migration) { console.log((done.has(migration.id) ? '  applied  ' : '  PENDING  ') + migration.id); });
    if (command === 'status') {
      console.log(pending.length ? pending.length + ' pending. Run: npm run db:migrate' : 'Database is up to date.');
      return;
    }
    for (var migration of pending) {
      console.log('Running ' + migration.id + ' ...');
      for (var batch of batches(fs.readFileSync(migration.file, 'utf8'))) await pool.request().batch(batch);
      if (!(await applied(pool)).has(migration.id)) throw new Error(migration.id + ' ran but did not record itself in dbo.schema_migrations.');
    }
    console.log(pending.length ? 'Done: ' + pending.length + ' migration(s) applied.' : 'Nothing to run.');
  } finally { await pool.close(); }
}

if (require.main === module) {
  main().catch(function (error) {
    // Driver errors can include server details but not the connection string; keep the message only.
    console.error('Migration failed: ' + (error.message || error));
    process.exitCode = 1;
  });
}

module.exports = { listFiles: listFiles, batches: batches, ID: ID, DIR: DIR };
