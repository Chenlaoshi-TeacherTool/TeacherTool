'use strict';

// Tutorial videos per tool (dbo.tool_videos, migration 0011). Edited at
// /admin/toolvideos; every page's milk-tea-footer.js asks /api/tool-videos and
// shows a "Watch how" button when the current page has a video.
// Without SQL_CONNECTION_STRING (local development) a JSON file under tmp/ is used.

var fs = require('fs/promises');
var path = require('path');
var db = require('./sqlClient');

var LOCAL_FILE = process.env.TOOL_VIDEOS_LOCAL_FILE || path.join(__dirname, '..', 'tmp', 'tool-videos.json');
var cache = { at: 0, videos: null };

function useSql() { return Boolean(process.env.SQL_CONNECTION_STRING); }

// "/teaching-tools/lucky-wheel/", ".../index.html" and "/teaching-tools/lucky-wheel" are one page.
function normalizePath(value) {
  var clean = String(value || '').split(/[?#]/)[0].replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  return /^\/[A-Za-z0-9/_.-]{1,290}$/.test(clean) ? clean : '';
}

// A YouTube link → { id, vertical } (Shorts are vertical), or null.
function parseYouTube(value) {
  var url;
  try { url = new URL(String(value || '').trim()); } catch (error) { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  var host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  var id = null;
  var vertical = false;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    var parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].indexOf(parts[0]) !== -1) { id = parts[1]; vertical = parts[0] === 'shorts'; }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? { id: id, vertical: vertical } : null;
}

async function readLocal() {
  try { return JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8')); } catch (error) { return {}; }
}

// Every saved row: { '/teaching-tools/x': { zh: 'https://…', en: 'https://…' } }.
async function listAll() {
  if (!useSql()) return readLocal();
  var pool = await db.getPool();
  var result = await pool.request().query('SELECT tool_path, video_zh, video_en FROM dbo.tool_videos;');
  var all = {};
  result.recordset.forEach(function (row) { all[row.tool_path] = { zh: row.video_zh || '', en: row.video_en || '' }; });
  return all;
}

// Saves one tool's links; empty links remove the row.
async function save(toolPath, zh, en) {
  var key = normalizePath(toolPath);
  if (!key) throw new Error('Unknown tool page.');
  zh = String(zh || '').trim().slice(0, 300);
  en = String(en || '').trim().slice(0, 300);
  if (!useSql()) {
    var all = await readLocal();
    if (zh || en) all[key] = { zh: zh, en: en }; else delete all[key];
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(all, null, 2));
  } else {
    var pool = await db.getPool();
    await pool.request().input('path', db.sql.NVarChar(300), key).input('zh', db.sql.NVarChar(300), zh || null).input('en', db.sql.NVarChar(300), en || null).query(
      'IF @zh IS NULL AND @en IS NULL DELETE FROM dbo.tool_videos WHERE tool_path = @path; ' +
      'ELSE IF EXISTS (SELECT 1 FROM dbo.tool_videos WITH (UPDLOCK, HOLDLOCK) WHERE tool_path = @path) ' +
      '  UPDATE dbo.tool_videos SET video_zh = @zh, video_en = @en, updated_at = SYSUTCDATETIME() WHERE tool_path = @path; ' +
      'ELSE INSERT INTO dbo.tool_videos (tool_path, video_zh, video_en) VALUES (@path, @zh, @en);'
    );
  }
  cache = { at: 0, videos: null };
}

// What pages need: { path: { zh: {id, vertical}, en: {id, vertical} } }, each language
// falling back to the other. Cached for a minute; saving clears it.
async function forPages() {
  if (cache.videos && Date.now() - cache.at < 60000) return cache.videos;
  var all = await listAll();
  var videos = {};
  Object.keys(all).forEach(function (key) {
    var zh = parseYouTube(all[key].zh);
    var en = parseYouTube(all[key].en);
    if (zh || en) videos[key] = { zh: zh || en, en: en || zh };
  });
  cache = { at: Date.now(), videos: videos };
  return videos;
}

module.exports = { normalizePath: normalizePath, parseYouTube: parseYouTube, listAll: listAll, save: save, forPages: forPages };
