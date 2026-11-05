'use strict';

var fs = require('fs/promises');
var path = require('path');

// Lists the top-level folders (one per shared game or book) in a blob container
// or local storage root: { id, hasManifest, lastModified } with the newest file time.

function remember(folders, id, isManifest, modified) {
  var folder = folders.get(id) || { id: id, hasManifest: false, lastModified: new Date(0) };
  if (isManifest) folder.hasManifest = true;
  if (modified && modified > folder.lastModified) folder.lastModified = modified;
  folders.set(id, folder);
}

async function fromContainer(container) {
  var folders = new Map();
  for await (var blob of container.listBlobsFlat()) {
    var slash = blob.name.indexOf('/');
    if (slash <= 0) continue;
    remember(folders, blob.name.slice(0, slash), blob.name.slice(slash + 1) === 'manifest.json', blob.properties && blob.properties.lastModified);
  }
  return Array.from(folders.values());
}

async function fromDirectory(root) {
  var entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  var folders = new Map();
  async function walk(id, dir, top) {
    for (var entry of await fs.readdir(dir, { withFileTypes: true })) {
      var full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(id, full, false);
      else remember(folders, id, top && entry.name === 'manifest.json', (await fs.stat(full)).mtime);
    }
  }
  for (var entry of entries) {
    if (!entry.isDirectory()) continue;
    remember(folders, entry.name, false, null);
    await walk(entry.name, path.join(root, entry.name), true);
  }
  return Array.from(folders.values());
}

module.exports = { fromContainer: fromContainer, fromDirectory: fromDirectory };
