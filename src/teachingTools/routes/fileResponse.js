'use strict';

// Sends a stored file. Videos play in the page (`?play=1` → inline) and answer
// byte-range requests, which players (Safari/iOS especially) need to start and seek.
// `file`: { blobName, contentType, size, name }.
async function send(files, req, res, next, file) {
  var video = /^video\//.test(file.contentType || '') && Number.isInteger(file.size) && file.size > 0;
  var range = null;
  if (video) {
    var match = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
    if (match && (match[1] || match[2])) {
      var start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
      var end = match[1] && match[2] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1;
      if (start > end || start >= file.size) { res.set('Content-Range', 'bytes */' + file.size); return res.status(416).end(); }
      range = { start: start, end: end };
    }
  }
  var stream = await files.open(file.blobName, range || undefined);
  if (!stream) return next();
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(file.contentType);
  if (video && req.query.play === '1') res.set('Content-Disposition', 'inline'); else res.attachment(file.name);
  if (video) {
    res.set('Accept-Ranges', 'bytes');
    if (range) res.status(206).set('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + file.size);
    res.set('Content-Length', String(range ? range.end - range.start + 1 : file.size));
  }
  stream.on('error', next); stream.pipe(res);
}

function isVideo(file) { return /^video\//.test((file && file.contentType) || ''); }

module.exports = { send: send, isVideo: isVideo };
