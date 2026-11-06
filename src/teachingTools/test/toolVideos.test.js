'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var os = require('os');
var path = require('path');
var fs = require('fs');
var ejs = require('ejs');

process.env.TOOL_VIDEOS_LOCAL_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tool-videos-')), 'videos.json');
var savedSql = process.env.SQL_CONNECTION_STRING;
delete process.env.SQL_CONNECTION_STRING;
var toolVideos = require('../services/toolVideos');
var toolCatalog = require('../services/toolCatalog');
var siteMap = require('../config/siteMap');
test.after(function () { if (savedSql !== undefined) process.env.SQL_CONNECTION_STRING = savedSql; });

test('YouTube links of every common form are recognised; anything else is not', function () {
  assert.deepEqual(toolVideos.parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'), { id: 'dQw4w9WgXcQ', vertical: false });
  assert.deepEqual(toolVideos.parseYouTube('https://youtu.be/dQw4w9WgXcQ?si=abc'), { id: 'dQw4w9WgXcQ', vertical: false });
  assert.deepEqual(toolVideos.parseYouTube('https://youtube.com/shorts/dQw4w9WgXcQ'), { id: 'dQw4w9WgXcQ', vertical: true });
  assert.deepEqual(toolVideos.parseYouTube('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), { id: 'dQw4w9WgXcQ', vertical: false });
  assert.equal(toolVideos.parseYouTube('https://vimeo.com/123'), null);
  assert.equal(toolVideos.parseYouTube('javascript:alert(1)'), null);
  assert.equal(toolVideos.parseYouTube('https://www.youtube.com/watch?v=short'), null);
});

test('tool paths ignore trailing slashes and index.html', function () {
  assert.equal(toolVideos.normalizePath('/teaching-tools/lucky-wheel/'), '/teaching-tools/lucky-wheel');
  assert.equal(toolVideos.normalizePath('/teaching-tools/missing-radicals/index.html'), '/teaching-tools/missing-radicals');
  assert.equal(toolVideos.normalizePath('https://evil.example/'), '');
});

test('the tool list follows the /teaching-tools catalog with both languages', function () {
  var tools = toolCatalog.list();
  assert.ok(tools.length >= 30);
  var wheel = tools.find(function (tool) { return tool.path === '/teaching-tools/lucky-wheel'; });
  assert.ok(wheel && /幸运转盘/.test(wheel.zh) && /Lucky Wheel/.test(wheel.en));
  assert.equal(new Set(tools.map(function (tool) { return tool.path; })).size, tools.length);
});

test('saved links reach pages, each language falling back to the other; clearing removes them', async function () {
  await toolVideos.save('/teaching-tools/lucky-wheel/', 'https://youtu.be/dQw4w9WgXcQ', '');
  await toolVideos.save('/teaching-tools/bingo-generator', 'https://youtu.be/aaaaaaaaaaa', 'https://youtube.com/shorts/bbbbbbbbbbb');
  var pages = await toolVideos.forPages();
  assert.deepEqual(pages['/teaching-tools/lucky-wheel'], { zh: { id: 'dQw4w9WgXcQ', vertical: false }, en: { id: 'dQw4w9WgXcQ', vertical: false } });
  assert.equal(pages['/teaching-tools/bingo-generator'].en.vertical, true);
  await toolVideos.save('/teaching-tools/lucky-wheel', '', '');
  assert.equal((await toolVideos.forPages())['/teaching-tools/lucky-wheel'], undefined);
});

test('the admin page lists every tool with its links', async function () {
  var tools = toolCatalog.list().map(function (tool) { return Object.assign({}, tool, { zh: '', en: '', title: tool.zh, titleEn: tool.en, zhOk: true, enOk: true }); });
  tools[0].zh = 'https://youtu.be/dQw4w9WgXcQ';
  var html = await ejs.renderFile(path.join(__dirname, '../views/admin/toolvideos.ejs'), {
    title: 'Tool Videos', tools: tools, loadError: '', saved: tools[0].path, error: '', adminUser: { name: 'Test' }, adminNav: siteMap.adminNav()
  });
  assert.ok(html.includes('1 of ' + tools.length));
  assert.ok(html.includes('value="' + tools[0].path + '"'));
  assert.ok(html.includes('Saved.'));
});
