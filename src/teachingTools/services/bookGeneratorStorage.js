'use strict';

var crypto = require('crypto');
var fs = require('fs/promises');
var fsSync = require('fs');
var path = require('path');
var BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;
var StorageSharedKeyCredential = require('@azure/storage-blob').StorageSharedKeyCredential;
var generateBlobSASQueryParameters = require('@azure/storage-blob').generateBlobSASQueryParameters;
var BlobSASPermissions = require('@azure/storage-blob').BlobSASPermissions;

var CONTAINER_NAME = 'book-generator';
var SAS_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
var LOCAL_ROOT = path.join(__dirname, '..', 'tmp', 'book-generator-storage');
var LOCAL_URL_PREFIX = '/book-generator-assets';

function isAzureConfigured() {
  return !!process.env.AZURE_STORAGE_CONNECTION_STRING;
}

// ===== Azure Blob Storage backend =====

var serviceClient = null;
var sharedKeyCredential = null;

function parseConnectionString(connectionString) {
  var parts = {};
  connectionString.split(';').forEach(function (segment) {
    var idx = segment.indexOf('=');
    if (idx === -1) return;
    parts[segment.slice(0, idx)] = segment.slice(idx + 1);
  });
  return parts;
}

function getContainerClient() {
  if (!serviceClient) {
    serviceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    var parsed = parseConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    if (parsed.AccountName && parsed.AccountKey) {
      sharedKeyCredential = new StorageSharedKeyCredential(parsed.AccountName, parsed.AccountKey);
    }
  }
  return serviceClient.getContainerClient(CONTAINER_NAME);
}

async function azureUploadAsset(bookId, blobName, buffer, contentType) {
  var containerClient = getContainerClient();
  var blockBlobClient = containerClient.getBlockBlobClient(bookId + '/' + blobName);
  await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
}

async function azureSaveManifest(bookId, manifest) {
  await azureUploadAsset(bookId, 'manifest.json', Buffer.from(JSON.stringify(manifest)), 'application/json');
}

async function azureGetManifest(bookId) {
  var containerClient = getContainerClient();
  var blockBlobClient = containerClient.getBlockBlobClient(bookId + '/manifest.json');
  if (!(await blockBlobClient.exists())) return null;
  var downloaded = await blockBlobClient.downloadToBuffer();
  return JSON.parse(downloaded.toString('utf8'));
}

function azureGetReadUrl(bookId, blobName) {
  var containerClient = getContainerClient();
  var blockBlobClient = containerClient.getBlockBlobClient(bookId + '/' + blobName);
  if (!sharedKeyCredential) return blockBlobClient.url;
  var expiresOn = new Date(Date.now() + SAS_EXPIRY_MS);
  var sas = generateBlobSASQueryParameters({
    containerName: CONTAINER_NAME,
    blobName: bookId + '/' + blobName,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: expiresOn
  }, sharedKeyCredential).toString();
  return blockBlobClient.url + '?' + sas;
}

async function azureDeleteBook(bookId) {
  var containerClient = getContainerClient();
  for await (var blob of containerClient.listBlobsFlat({ prefix: bookId + '/' })) {
    await containerClient.getBlockBlobClient(blob.name).deleteIfExists();
  }
}

// ===== Local disk backend (used when AZURE_STORAGE_CONNECTION_STRING is not set) =====

async function localUploadAsset(bookId, blobName, buffer, contentType) {
  var dir = path.join(LOCAL_ROOT, bookId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, blobName), buffer);
}

async function localSaveManifest(bookId, manifest) {
  await localUploadAsset(bookId, 'manifest.json', Buffer.from(JSON.stringify(manifest)), 'application/json');
}

async function localGetManifest(bookId) {
  var manifestPath = path.join(LOCAL_ROOT, bookId, 'manifest.json');
  if (!fsSync.existsSync(manifestPath)) return null;
  var raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function localGetReadUrl(bookId, blobName) {
  return LOCAL_URL_PREFIX + '/' + bookId + '/' + blobName;
}

async function localDeleteBook(bookId) {
  await fs.rm(path.join(LOCAL_ROOT, bookId), { recursive: true, force: true });
}

// ===== Public API (backend-agnostic) =====

function extensionFor(kind, originalName, mimetype) {
  var ext = path.extname(originalName || '').toLowerCase();
  if (ext) return ext;
  if (kind === 'narration' && mimetype === 'audio/webm') return '.webm';
  return '';
}

async function uploadAsset(bookId, pageId, kind, file) {
  var ext = extensionFor(kind, file.originalname, file.mimetype);
  var blobName = pageId + '-' + kind + ext;
  if (isAzureConfigured()) {
    await azureUploadAsset(bookId, blobName, file.buffer, file.mimetype);
  } else {
    await localUploadAsset(bookId, blobName, file.buffer, file.mimetype);
  }
  return blobName;
}

async function saveManifest(bookId, manifest) {
  if (isAzureConfigured()) {
    await azureSaveManifest(bookId, manifest);
  } else {
    await localSaveManifest(bookId, manifest);
  }
}

async function getManifest(bookId) {
  return isAzureConfigured() ? azureGetManifest(bookId) : localGetManifest(bookId);
}

function getReadUrl(bookId, blobName) {
  return isAzureConfigured() ? azureGetReadUrl(bookId, blobName) : localGetReadUrl(bookId, blobName);
}

async function deleteBook(bookId) {
  if (isAzureConfigured()) {
    await azureDeleteBook(bookId);
  } else {
    await localDeleteBook(bookId);
  }
}

module.exports = {
  isAzureConfigured: isAzureConfigured,
  uploadAsset: uploadAsset,
  saveManifest: saveManifest,
  getManifest: getManifest,
  getReadUrl: getReadUrl,
  deleteBook: deleteBook,
  LOCAL_ROOT: LOCAL_ROOT,
  LOCAL_URL_PREFIX: LOCAL_URL_PREFIX
};
