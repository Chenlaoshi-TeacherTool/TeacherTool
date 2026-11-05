'use strict';

var fs = require('fs/promises');
var fsSync = require('fs');
var path = require('path');
var BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;

var CONTAINER_NAME = 'game-shares';
var LOCAL_ROOT = process.env.GAME_SHARE_LOCAL_ROOT || path.join(__dirname, '..', 'tmp', 'game-share-storage');

var serviceClient = null;

function isAzureConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);
}

function validShareId(shareId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(shareId || ''));
}

function assertShareId(shareId) {
  if (!validShareId(shareId)) throw new Error('Invalid game share id.');
}

function getContainerClient() {
  if (!serviceClient) {
    serviceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  }
  return serviceClient.getContainerClient(CONTAINER_NAME);
}

async function azureSaveManifest(shareId, manifest) {
  var container = getContainerClient();
  await container.createIfNotExists();
  var blob = container.getBlockBlobClient(shareId + '/manifest.json');
  await blob.uploadData(Buffer.from(JSON.stringify(manifest)), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
  });
}

async function azureGetManifest(shareId) {
  var blob = getContainerClient().getBlockBlobClient(shareId + '/manifest.json');
  if (!(await blob.exists())) return null;
  var downloaded = await blob.downloadToBuffer();
  return JSON.parse(downloaded.toString('utf8'));
}

async function azureDeleteShare(shareId) {
  var container = getContainerClient();
  for await (var blob of container.listBlobsFlat({ prefix: shareId + '/' })) {
    await container.getBlockBlobClient(blob.name).deleteIfExists();
  }
}

function localManifestPath(shareId) {
  assertShareId(shareId);
  return path.join(LOCAL_ROOT, shareId, 'manifest.json');
}

async function localSaveManifest(shareId, manifest) {
  var manifestPath = localManifestPath(shareId);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
}

async function localGetManifest(shareId) {
  var manifestPath = localManifestPath(shareId);
  if (!fsSync.existsSync(manifestPath)) return null;
  return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
}

async function localDeleteShare(shareId) {
  assertShareId(shareId);
  await fs.rm(path.join(LOCAL_ROOT, shareId), { recursive: true, force: true });
}

async function saveManifest(shareId, manifest) {
  assertShareId(shareId);
  return isAzureConfigured()
    ? azureSaveManifest(shareId, manifest)
    : localSaveManifest(shareId, manifest);
}

async function getManifest(shareId) {
  assertShareId(shareId);
  return isAzureConfigured()
    ? azureGetManifest(shareId)
    : localGetManifest(shareId);
}

async function deleteShare(shareId) {
  assertShareId(shareId);
  return isAzureConfigured()
    ? azureDeleteShare(shareId)
    : localDeleteShare(shareId);
}

function submissionKey(shareId, studentName) {
  assertShareId(shareId);
  var normalized = studentName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return shareId + '/submissions/' + require('crypto').createHash('sha256').update(normalized).digest('hex') + '.json';
}

async function getSubmission(shareId, studentName) {
  var key = submissionKey(shareId, studentName);
  if (isAzureConfigured()) {
    var blob = getContainerClient().getBlockBlobClient(key);
    if (!(await blob.exists())) return null;
    return JSON.parse((await blob.downloadToBuffer()).toString('utf8'));
  }
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_ROOT, key), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveSubmission(shareId, studentName, submission) {
  var key = submissionKey(shareId, studentName);
  if (isAzureConfigured()) {
    try {
      await getContainerClient().getBlockBlobClient(key).uploadData(Buffer.from(JSON.stringify(submission)), {
        conditions: { ifNoneMatch: '*' },
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
      });
      return true;
    } catch (error) {
      if (error.statusCode === 409 || error.statusCode === 412) return false;
      throw error;
    }
  }
  var destination = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  var temporary = destination + '.' + require('crypto').randomUUID() + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(submission), 'utf8');
  try {
    await fs.link(temporary, destination);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    await fs.unlink(temporary);
  }
}

// All submissions for one quiz, newest first; capped so one link can't load unbounded data.
async function listSubmissions(shareId, limit) {
  assertShareId(shareId);
  var max = limit || 300;
  var prefix = shareId + '/submissions/';
  var bodies = [];
  if (isAzureConfigured()) {
    var container = getContainerClient();
    for await (var blob of container.listBlobsFlat({ prefix: prefix })) {
      if (!/\.json$/.test(blob.name)) continue;
      if (bodies.length >= max) break;
      bodies.push((await container.getBlockBlobClient(blob.name).downloadToBuffer()).toString('utf8'));
    }
  } else {
    var names;
    try { names = await fs.readdir(path.join(LOCAL_ROOT, prefix)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    for (var name of names.filter(function (file) { return /\.json$/.test(file); }).slice(0, max)) {
      bodies.push(await fs.readFile(path.join(LOCAL_ROOT, prefix, name), 'utf8'));
    }
  }
  return bodies.map(function (body) { return JSON.parse(body); })
    .sort(function (left, right) { return String(right.submittedAt || '').localeCompare(String(left.submittedAt || '')); });
}

// Every share folder, for the expired-link cleanup.
async function listShares() {
  var folders = require('./shareFolders');
  return isAzureConfigured() ? folders.fromContainer(getContainerClient()) : folders.fromDirectory(LOCAL_ROOT);
}

module.exports = {
  isAzureConfigured: isAzureConfigured,
  listShares: listShares,
  validShareId: validShareId,
  saveManifest: saveManifest,
  getManifest: getManifest,
  deleteShare: deleteShare,
  getSubmission: getSubmission,
  saveSubmission: saveSubmission,
  listSubmissions: listSubmissions,
  LOCAL_ROOT: LOCAL_ROOT
};
