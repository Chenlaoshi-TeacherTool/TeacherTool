'use strict';

var db = require('./sqlClient');

async function list(slug) {
  var pool = await db.getPool();
  var result = await pool.request().input('slug', db.sql.NVarChar, slug)
    .query('SELECT companion_files FROM dbo.recommendation_products WHERE slug = @slug');
  return result.recordset[0] ? JSON.parse(result.recordset[0].companion_files || '[]') : null;
}

async function add(slug, file) {
  var pool = await db.getPool();
  var result = await pool.request().input('slug', db.sql.NVarChar, slug).input('file', db.sql.NVarChar, JSON.stringify(file))
    .query("UPDATE dbo.recommendation_products SET companion_files = JSON_MODIFY(COALESCE(companion_files, N'[]'), 'append $', JSON_QUERY(@file)), updated_at = SYSUTCDATETIME() WHERE slug = @slug");
  return result.rowsAffected[0] > 0;
}

async function remove(slug, blobName) {
  var pool = await db.getPool();
  await pool.request().input('slug', db.sql.NVarChar, slug).input('blobName', db.sql.NVarChar, blobName)
    .query("UPDATE dbo.recommendation_products SET companion_files = (SELECT title, fileName, blobName, contentType, size FROM OPENJSON(COALESCE(companion_files, N'[]')) WITH (title nvarchar(200), fileName nvarchar(200), blobName nvarchar(100), contentType nvarchar(200), size int) WHERE blobName <> @blobName FOR JSON PATH), updated_at = SYSUTCDATETIME() WHERE slug = @slug");
}

module.exports = { list: list, add: add, remove: remove };
