'use strict';

var crypto = require('crypto');
var path = require('path');
var BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;

var CONTAINER_NAME = 'wordlist-images';
var ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

var serviceClient = null;
function getContainerClient() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured.');
  }
  if (!serviceClient) {
    serviceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  }
  return serviceClient.getContainerClient(CONTAINER_NAME);
}

async function uploadImage(file) {
  var ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
    throw new Error('Unsupported image type: ' + (ext || '(none)') + '. Allowed: ' + ALLOWED_EXTENSIONS.join(', '));
  }
  var blobName = crypto.randomUUID() + ext;
  var containerClient = getContainerClient();
  var blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype }
  });
  return blockBlobClient.url;
}

module.exports = { uploadImage: uploadImage };
