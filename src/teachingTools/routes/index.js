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
