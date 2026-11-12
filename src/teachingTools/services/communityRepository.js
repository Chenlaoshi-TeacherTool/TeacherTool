'use strict';

// Storage for the teacher community (dbo.community_posts / community_reports,
// database/migrations/0009_add-community-posts.sql). Without
// SQL_CONNECTION_STRING (local development) posts live in a JSON file under
// tmp/ instead, so the pages can be tried without a database.

var fs = require('fs/promises');
var path = require('path');
var db = require('./sqlClient');

var LOCAL_FILE = process.env.COMMUNITY_LOCAL_FILE || path.join(__dirname, '..', 'tmp', 'community-posts.json');
var META_COLUMNS = "id, kind, owner_key, author_name, title, description, stages, textbook, game_type, game_version, item_count, status, report_count, use_count, created_at, CASE WHEN kind IN ('contest', 'website') THEN payload ELSE NULL END AS external_payload";

function useSql() { return Boolean(process.env.SQL_CONNECTION_STRING); }

function fromRow(row, withPayload) {
  var post = {
    id: row.id, kind: row.kind, ownerKey: row.owner_key, authorName: row.author_name, title: row.title,
    description: row.description || '', stages: String(row.stages || '').split(',').filter(Boolean), textbook: row.textbook || '',
    gameType: row.game_type || null, gameVersion: row.game_version || null, itemCount: row.item_count || 0,
    status: row.status, reportCount: row.report_count || 0, useCount: row.use_count || 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
  if (row.kind === 'contest' || row.kind === 'website') {
    var external = row.external_payload || row.payload;
    post.payload = typeof external === 'string' ? JSON.parse(external) : external;
  }
  if (withPayload) post.payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return post;
}

function toRow(post) {
  return {
    id: post.id, kind: post.kind, owner_key: post.ownerKey, author_name: post.authorName, title: post.title,
    description: post.description || null, stages: (post.stages || []).join(','), textbook: post.textbook || null,
    game_type: post.gameType || null, game_version: post.gameVersion || null, item_count: post.itemCount || 0,
    payload: JSON.stringify(post.payload), status: post.status === 'pending' ? 'pending' : 'live', report_count: 0, use_count: 0, created_at: new Date().toISOString()
  };
}

// ----- local JSON file (development only) -----
async function readLocal() {
  try { return JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8')); }
  catch (error) { return { posts: [], reports: [] }; }
}

async function writeLocal(data) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2));
}

var local = {
  create: async function (post) {
    var data = await readLocal();
    var row = toRow(post);
    data.posts.push(row);
    await writeLocal(data);
    return fromRow(row, false);
  },
  listAll: async function (status) {
    var data = await readLocal();
    return data.posts.filter(function (row) { return !status || row.status === status; })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (row) { return fromRow(row, false); });
  },
  get: async function (id) {
    var row = (await readLocal()).posts.find(function (item) { return item.id === id; });
    return row ? fromRow(row, true) : null;
  },
  update: async function (id, change) {
    var data = await readLocal();
    var row = data.posts.find(function (item) { return item.id === id; });
    if (!row) return false;
    change(row, data);
    await writeLocal(data);
    return true;
  },
  remove: async function (id, owner) {
    var data = await readLocal();
    var before = data.posts.length;
    data.posts = data.posts.filter(function (row) { return !(row.id === id && (!owner || row.owner_key === owner)); });
    if (data.posts.length === before) return false;
    data.reports = data.reports.filter(function (report) { return report.post_id !== id; });
    await writeLocal(data);
    return true;
  },
  reports: async function (id) {
    return (await readLocal()).reports.filter(function (report) { return report.post_id === id; })
      .map(function (report) { return { reason: report.reason, createdAt: report.created_at }; });
  }
};

// ----- public API -----
async function create(post) {
  if (!useSql()) return local.create(post);
  var row = toRow(post);
  var pool = await db.getPool();
  await pool.request()
    .input('id', db.sql.VarChar(16), row.id).input('kind', db.sql.VarChar(10), row.kind)
    .input('owner', db.sql.Char(64), row.owner_key).input('author', db.sql.NVarChar(40), row.author_name)
    .input('title', db.sql.NVarChar(120), row.title).input('description', db.sql.NVarChar(500), row.description)
    .input('stages', db.sql.VarChar(200), row.stages).input('textbook', db.sql.VarChar(40), row.textbook)
    .input('gameType', db.sql.VarChar(40), row.game_type).input('gameVersion', db.sql.Int, row.game_version)
    .input('status', db.sql.VarChar(10), row.status).input('count', db.sql.Int, row.item_count).input('payload', db.sql.NVarChar(db.sql.MAX), row.payload)
    .query('INSERT INTO dbo.community_posts (id, kind, owner_key, author_name, title, description, stages, textbook, game_type, game_version, item_count, payload, status) ' +
      'VALUES (@id, @kind, @owner, @author, @title, @description, @stages, @textbook, @gameType, @gameVersion, @count, @payload, @status);');
  return fromRow(row, false);
}

// Post metadata (including external link details), newest first. Null status lists all posts.
async function listAll(status) {
  if (!useSql()) return local.listAll(status);
  var pool = await db.getPool();
  var result = await pool.request().input('status', db.sql.VarChar(10), status || null).query(
    'SELECT TOP 5000 ' + META_COLUMNS + ' FROM dbo.community_posts WHERE @status IS NULL OR status = @status ORDER BY created_at DESC;'
  );
  return result.recordset.map(function (row) { return fromRow(row, false); });
}

async function get(id) {
  if (!useSql()) return local.get(id);
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.VarChar(16), id).query('SELECT ' + META_COLUMNS + ', payload FROM dbo.community_posts WHERE id = @id;');
  return result.recordset[0] ? fromRow(result.recordset[0], true) : null;
}

// Deletes a post. With owner, only that teacher's own post. Returns false when nothing was deleted.
async function remove(id, owner) {
  if (!useSql()) return local.remove(id, owner);
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.VarChar(16), id).input('owner', db.sql.Char(64), owner || null).query(
    'DELETE FROM dbo.community_posts WHERE id = @id AND (@owner IS NULL OR owner_key = @owner); ' +
    'IF @@ROWCOUNT > 0 BEGIN DELETE FROM dbo.community_reports WHERE post_id = @id; SELECT 1 AS deleted; END ELSE SELECT 0 AS deleted;'
  );
  return Boolean(result.recordset[0] && result.recordset[0].deleted);
}

async function report(id, reason) {
  reason = String(reason || '').slice(0, 300) || null;
  if (!useSql()) {
    return local.update(id, function (row, data) {
      row.report_count += 1;
      data.reports.push({ post_id: id, reason: reason, created_at: new Date().toISOString() });
    });
  }
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.VarChar(16), id).input('reason', db.sql.NVarChar(300), reason).query(
    'UPDATE dbo.community_posts SET report_count = report_count + 1 WHERE id = @id; ' +
    'IF @@ROWCOUNT > 0 BEGIN INSERT INTO dbo.community_reports (post_id, reason) VALUES (@id, @reason); SELECT 1 AS ok; END ELSE SELECT 0 AS ok;'
  );
  return Boolean(result.recordset[0] && result.recordset[0].ok);
}

async function reports(id) {
  if (!useSql()) return local.reports(id);
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.VarChar(16), id).query(
    'SELECT TOP 50 reason, created_at FROM dbo.community_reports WHERE post_id = @id ORDER BY created_at DESC;'
  );
  return result.recordset.map(function (row) { return { reason: row.reason, createdAt: row.created_at }; });
}

async function countUse(id) {
  if (!useSql()) return local.update(id, function (row) { row.use_count += 1; });
  var pool = await db.getPool();
  await pool.request().input('id', db.sql.VarChar(16), id).query("UPDATE dbo.community_posts SET use_count = use_count + 1 WHERE id = @id AND status = 'live';");
  return true;
}

// 'live' or 'hidden'. Hiding also clears the report count once an admin has looked.
async function setStatus(id, status) {
  if (!useSql()) return local.update(id, function (row) { row.status = status; row.report_count = 0; });
  var pool = await db.getPool();
  var result = await pool.request().input('id', db.sql.VarChar(16), id).input('status', db.sql.VarChar(10), status)
    .query('UPDATE dbo.community_posts SET status = @status, report_count = 0 WHERE id = @id;');
  return result.rowsAffected[0] > 0;
}

// The display name this teacher used on their latest post, or ''.
async function lastAuthorName(owner) {
  if (!useSql()) {
    var mine = (await local.listAll(null)).filter(function (post) { return post.ownerKey === owner; });
    return mine.length ? mine[0].authorName : '';
  }
  var pool = await db.getPool();
  var result = await pool.request().input('owner', db.sql.Char(64), owner).query(
    'SELECT TOP 1 author_name FROM dbo.community_posts WHERE owner_key = @owner ORDER BY created_at DESC;'
  );
  return result.recordset[0] ? result.recordset[0].author_name : '';
}

module.exports = { create: create, listAll: listAll, get: get, remove: remove, report: report, reports: reports,
  countUse: countUse, setStatus: setStatus, lastAuthorName: lastAuthorName };
