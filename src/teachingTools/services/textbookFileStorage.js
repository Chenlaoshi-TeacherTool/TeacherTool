'use strict';

// Lesson files for the textbook companion (PDF, Word, PowerPoint, ...). They
// live in the private "textbook-materials" blob container, so the only way to
// get one is through the site's member-checked download route. Without
// AZURE_STORAGE_CONNECTION_STRING (local development) they go to tmp/ instead.

var crypto = require('crypto');
var fs = require('fs/promises');
var path = require('path');
var BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;

var CONTAINER_NAME = 'textbook-materials';
var LOCAL_ROOT = process.env.TEXTBOOK_FILES_LOCAL_ROOT || path.join(__dirname, '..', 'tmp', 'textbook-materials');
var MAX_BYTES = 30 * 1024 * 1024;
var TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.zip': 'application/zip'
};

var containerPromise = null;
function container() {
  if (!containerPromise) {
    var client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(CONTAINER_NAME);
    // No `access` option: the container stays private.
    containerPromise = client.createIfNotExists().then(function () { return client; });
    containerPromise.catch(function () { containerPromise = null; });
  }
  return containerPromise;
}

function useAzure() { return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING); }

function validBlobName(name) { return /^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(String(name || '')); }

// Checks an uploaded file (multer memory storage). Returns { ext, contentType } or throws with a message for the admin.
function check(file) {
  if (!file || !file.buffer || !file.buffer.length) throw new Error('Choose a file to upload.');
  var ext = path.extname(file.originalname || '').toLowerCase();
  if (!TYPES[ext]) throw new Error('This file type is not allowed: ' + (ext || '(none)') + '. Allowed: ' + Object.keys(TYPES).join(', '));
  if (file.buffer.length > MAX_BYTES) throw new Error('Files can be at most 30 MB.');
  return { ext: ext, contentType: TYPES[ext] };
}

async function save(file) {
  var info = check(file);
  var blobName = crypto.randomUUID() + info.ext;
  if (useAzure()) {
    var client = (await container()).getBlockBlobClient(blobName);
    await client.uploadData(file.buffer, { blobHTTPHeaders: { blobContentType: info.contentType } });
  } else {
    await fs.mkdir(LOCAL_ROOT, { recursive: true });
    await fs.writeFile(path.join(LOCAL_ROOT, blobName), file.buffer);
  }
  return { blobName: blobName, contentType: info.contentType, size: file.buffer.length };
}

// A readable stream of the file, or null when it is missing.
async function open(blobName) {
  if (!validBlobName(blobName)) return null;
  if (useAzure()) {
    try { return (await (await container()).getBlockBlobClient(blobName).download()).readableStreamBody; }
    catch (error) { if (error.statusCode === 404) return null; throw error; }
  }
  try {
    var full = path.join(LOCAL_ROOT, blobName);
    await fs.access(full);
    return require('fs').createReadStream(full);
  } catch (error) { return null; }
}

async function remove(blobName) {
  if (!validBlobName(blobName)) return;
  if (useAzure()) await (await container()).getBlockBlobClient(blobName).deleteIfExists();
  else await fs.rm(path.join(LOCAL_ROOT, blobName), { force: true });
}

module.exports = { save: save, open: open, remove: remove, check: check, MAX_BYTES: MAX_BYTES, TYPES: TYPES };
