'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');
var ejs = require('ejs');
var migrations = require('../scripts/db-migrations');
var config = require('../config/database');
var databaseVersion = require('../services/databaseVersion');

var files = migrations.listFiles();

test('migrations are numbered 0000, 0001, ... with no gaps or duplicates', function () {
  assert.ok(files.length > 1);
  files.forEach(function (migration, index) {
    var match = migrations.ID.exec(migration.id);
    assert.ok(match, migration.id + ' must look like NNNN_lower-case-name');
    assert.equal(Number(match[1]), index, migration.id + ' is out of sequence');
  });
});

test('every migration records its own id, so running it by hand counts', function () {
  files.forEach(function (migration) {
    var text = fs.readFileSync(migration.file, 'utf8');
    assert.match(text, new RegExp("INSERT INTO dbo\\.schema_migrations \\(id\\) VALUES \\(N'" + migration.id + "'\\)"), migration.id + ' is missing its record line');
  });
});

test('the app requires the newest migration (update config/database.js when adding one)', function () {
  assert.equal(config.requiredMigration, files[files.length - 1].id);
});

test('scripts split into batches on GO lines only', function () {
  assert.deepEqual(migrations.batches('SELECT 1;\nGO\nSELECT 2; -- GOOD\n  go  \n\nSELECT 3;'), ['SELECT 1;', 'SELECT 2; -- GOOD', 'SELECT 3;']);
  assert.deepEqual(migrations.batches('SELECT 1;'), ['SELECT 1;']);
});

function fakeDb(applied, error) {
  return { getPool: async function () { return { request: function () { return { query: async function () { if (error) throw new Error(error); return { recordset: [{ applied: applied }] }; } }; } }; } };
}

test('the database version check reports ok, behind, or unknown', async function () {
  assert.equal((await databaseVersion.check({ fresh: true, db: fakeDb(config.requiredMigration) })).state, 'ok');
  assert.equal((await databaseVersion.check({ fresh: true, db: fakeDb('0001_add-textbook-lessons') })).state, 'behind');
  assert.equal((await databaseVersion.check({ fresh: true, db: fakeDb(null) })).state, 'behind');
  assert.equal((await databaseVersion.check({ fresh: true, db: fakeDb(null, "Invalid object name 'dbo.schema_migrations'.") })).state, 'behind');
  assert.equal((await databaseVersion.check({ fresh: true, db: fakeDb(null, 'Login failed') })).state, 'unknown');
});

test('admin pages warn when the database is behind', async function () {
  var view = path.join(__dirname, '../views/admin/layout-head.ejs');
  var base = { title: 'Admin', adminUser: { name: 'Admin' }, adminNav: [] };
  var behind = await ejs.renderFile(view, Object.assign({ dbStatus: { state: 'behind', required: '0009_x', applied: '0008_y' } }, base));
  assert.match(behind, /database is behind[\s\S]*0009_x[\s\S]*0008_y/);
  assert.doesNotMatch(await ejs.renderFile(view, Object.assign({ dbStatus: { state: 'ok' } }, base)), /database is behind/);
  assert.doesNotMatch(await ejs.renderFile(view, base), /database is behind/);
});
