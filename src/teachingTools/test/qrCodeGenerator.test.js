const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const path = require('node:path');

test('QR worksheet generation lets qrcodejs size long links automatically', () => {
  const template = readFileSync(
    path.join(__dirname, '..', 'views', 'teaching-tools', 'qr-code-generator.ejs'),
    'utf8'
  );

  assert.match(template, /typeNumber:\s*0/);
  assert.match(template, /correctLevel:\s*QRCode\.CorrectLevel\.M/);
});
