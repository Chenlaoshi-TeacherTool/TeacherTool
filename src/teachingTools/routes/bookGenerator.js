'use strict';

var crypto = require('crypto');
var express = require('express');
var multer = require('multer');
var bcrypt = require('bcryptjs');
var router = express.Router();
var bookStorage = require('../services/bookGeneratorStorage');
var siteContentStore = require('../services/siteContentStore');

var MAX_PAGES = 20;
var SIZE_LIMITS = {
  image: 5 * 1024 * 1024,
  narration: 10 * 1024 * 1024,
  music: 15 * 1024 * 1024
};
var BOOK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
var AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(SIZE_LIMITS.image, SIZE_LIMITS.narration, SIZE_LIMITS.music) }
});

function isExpired(manifest) {
  return !manifest.expiresAt || new Date(manifest.expiresAt).getTime() < Date.now();
}

function authCookieName(bookId) {
  return 'book_auth_' + bookId;
}

// ===== Editor page =====

router.get('/teaching-tools/book-generator', function (req, res) {
  res.render('low-prep-activities/book-generator', {
    title: 'Book Generator',
    toolGuide: siteContentStore.get().toolGuides['book-generator'] || null
  });
});

// ===== Draft asset upload =====

router.post('/api/book-generator/pages/upload', upload.single('file'), async function (req, res) {
  try {
    var draftId = req.body.draftId;
    var pageId = req.body.pageId;
    var kind = req.body.kind;
    if (!draftId || !/^[a-zA-Z0-9-]+$/.test(draftId)) {
      return res.status(400).json({ error: 'Invalid draftId.' });
    }
    if (!pageId || !/^[a-zA-Z0-9-]+$/.test(pageId)) {
      return res.status(400).json({ error: 'Invalid pageId.' });
    }
    if (['image', 'narration', 'music'].indexOf(kind) === -1) {
      return res.status(400).json({ error: 'Invalid kind.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (req.file.size > SIZE_LIMITS[kind]) {
      return res.status(400).json({ error: 'File too large for ' + kind + ' (max ' + Math.round(SIZE_LIMITS[kind] / (1024 * 1024)) + 'MB).' });
    }

    var blobName = await bookStorage.uploadAsset(draftId, pageId, kind, req.file);
    res.json({ blobName: blobName, previewUrl: bookStorage.getReadUrl(draftId, blobName) });
  } catch (err) {
    console.error('book-generator upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// ===== Publish (finalize a book and generate the share link) =====

router.post('/api/book-generator/publish', async function (req, res) {
  try {
    var body = req.body || {};
    var draftId = body.draftId;
    var password = body.password;
    var pages = Array.isArray(body.pages) ? body.pages : [];

    if (!draftId || !/^[a-zA-Z0-9-]+$/.test(draftId)) {
      return res.status(400).json({ error: 'Invalid draftId.' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
    if (pages.length === 0) {
      return res.status(400).json({ error: 'Add at least one page.' });
    }
    if (pages.length > MAX_PAGES) {
      return res.status(400).json({ error: 'A book can have at most ' + MAX_PAGES + ' pages.' });
    }
    for (var i = 0; i < pages.length; i++) {
      if (!pages[i].imageBlob) {
        return res.status(400).json({ error: 'Page ' + (i + 1) + ' is missing an image.' });
      }
    }

    var passwordHash = await bcrypt.hash(String(password), 10);
    var deleteToken = crypto.randomUUID();
    var now = new Date();
    var manifest = {
      bookId: draftId,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
      passwordHash: passwordHash,
      deleteToken: deleteToken,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + BOOK_TTL_MS).toISOString(),
      pages: pages.map(function (page) {
        return {
          id: page.id,
          caption: typeof page.caption === 'string' ? page.caption.slice(0, 2000) : '',
          imageBlob: page.imageBlob,
          narrationBlob: page.narrationBlob || null
        };
      }),
      musicBlob: body.musicBlob || null
    };

    await bookStorage.saveManifest(draftId, manifest);
    res.json({ bookId: draftId, url: '/book/' + draftId, deleteToken: deleteToken });
  } catch (err) {
    console.error('book-generator publish error:', err);
    res.status(500).json({ error: 'Could not publish this book.' });
  }
});

// ===== Delete a book (requires the delete token issued at publish time) =====

router.delete('/api/book-generator/books/:id', async function (req, res) {
  try {
    var bookId = req.params.id;
    var manifest = await bookStorage.getManifest(bookId);
    if (!manifest) return res.status(404).json({ error: 'Book not found.' });

    var deleteToken = req.body && req.body.deleteToken;
    if (!deleteToken || deleteToken !== manifest.deleteToken) {
      return res.status(403).json({ error: 'Not authorized to delete this book.' });
    }

    await bookStorage.deleteBook(bookId);
    res.json({ ok: true });
  } catch (err) {
    console.error('book-generator delete error:', err);
    res.status(500).json({ error: 'Could not delete this book.' });
  }
});

// ===== Share link: password gate + player =====

router.get('/book/:id', async function (req, res, next) {
  try {
    var bookId = req.params.id;
    var manifest = await bookStorage.getManifest(bookId);
    if (!manifest) return next();

    if (isExpired(manifest)) {
      await bookStorage.deleteBook(bookId);
      return res.status(410).render('book-generator/expired', { title: 'Book Expired' });
    }

    var authorized = req.signedCookies && req.signedCookies[authCookieName(bookId)] === '1';
    if (!authorized) {
      return res.render('book-generator/password-gate', { title: manifest.title || 'Enter Password', bookId: bookId, error: null });
    }

    var pages = manifest.pages.map(function (page) {
      return {
        id: page.id,
        caption: page.caption,
        imageUrl: bookStorage.getReadUrl(bookId, page.imageBlob),
        narrationUrl: page.narrationBlob ? bookStorage.getReadUrl(bookId, page.narrationBlob) : null
      };
    });
    var musicUrl = manifest.musicBlob ? bookStorage.getReadUrl(bookId, manifest.musicBlob) : null;

    res.render('book-generator/player', {
      title: manifest.title || 'Book',
      bookData: { title: manifest.title, pages: pages, musicUrl: musicUrl }
    });
  } catch (err) { next(err); }
});

router.post('/book/:id/unlock', async function (req, res, next) {
  try {
    var bookId = req.params.id;
    var manifest = await bookStorage.getManifest(bookId);
    if (!manifest) return next();

    if (isExpired(manifest)) {
      await bookStorage.deleteBook(bookId);
      return res.status(410).render('book-generator/expired', { title: 'Book Expired' });
    }

    var password = req.body && req.body.password;
    var matches = password && (await bcrypt.compare(String(password), manifest.passwordHash));
    if (!matches) {
      return res.status(401).render('book-generator/password-gate', {
        title: manifest.title || 'Enter Password',
        bookId: bookId,
        error: 'Incorrect password. Please try again.'
      });
    }

    res.cookie(authCookieName(bookId), '1', {
      signed: true,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      httpOnly: true,
      sameSite: 'Lax'
    });
    res.redirect('/book/' + bookId);
  } catch (err) { next(err); }
});

// ===== Local-dev asset serving (only reachable when Azure Blob Storage isn't configured) =====

if (!bookStorage.isAzureConfigured()) {
  router.use(bookStorage.LOCAL_URL_PREFIX, express.static(bookStorage.LOCAL_ROOT));
}

module.exports = router;
