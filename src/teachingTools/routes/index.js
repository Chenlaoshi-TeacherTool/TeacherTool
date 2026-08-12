var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Home' });
});

// Teaching Tools Routes
router.get('/teaching-tools', function(req, res, next) {
  res.render('teaching-tools/index', { title: 'Teaching Tools' });
});

router.get('/teaching-tools/qr-code-generator', function(req, res, next) {
  res.render('teaching-tools/qr-code-generator', { title: 'QR Code Generator' });
});

router.get('/teaching-tools/random-group-generator', function(req, res, next) {
  res.render('teaching-tools/random-group-generator', { title: 'Random Group Generator' });
});

router.get('/classroom-shop', function(req, res, next) {
  res.render('classroom-shop', { title: 'Classroom Shop' });
});

// Low-Prep Activities Routes
router.get('/low-prep-activities', function(req, res, next) {
  res.render('low-prep-activities/index', { title: 'Low-Prep Activities' });
});

router.get('/low-prep-activities/independent-reading', function(req, res, next) {
  res.render('low-prep-activities/independent-reading', { title: 'Independent Reading Builder' });
});

router.get('/low-prep-activities/tear-paper-bingo', function(req, res, next) {
  res.render('low-prep-activities/tear-paper-bingo', { title: 'Tear-Paper Bingo' });
});

// Theme Activities Routes
router.get('/theme-activities', function(req, res, next) {
  res.render('theme-activities/index', { title: 'Theme Activities' });
});

router.get('/theme-activities/weather', function(req, res, next) {
  res.render('theme-activities/weather/index', { title: 'Theme Activities' });
});

router.get('/theme-activities/weather/songs', function(req, res, next) {
  res.render('theme-activities/weather/songs', { title: 'Theme Activities' });
});

module.exports = router;
