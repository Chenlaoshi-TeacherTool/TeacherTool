var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Home' });
});

router.get('/privacy', function(req, res, next) {
  res.render('privacy', { title: 'Privacy Policy' });
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

router.get('/low-prep-activities/would-you-rather', function(req, res, next) {
  res.render('low-prep-activities/would-you-rather', { title: 'Would You Rather Generator' });
});

router.get('/low-prep-activities/jeopardy', function(req, res, next) {
  res.render('low-prep-activities/jeopardy', { title: 'Jeopardy 抢答赛' });
});

router.get('/low-prep-activities/character-race', function(req, res, next) {
  res.render('low-prep-activities/character-race', { title: 'Character Race' });
});

router.get('/low-prep-activities/maze-generator', function(req, res, next) {
  res.render('low-prep-activities/maze-generator', { title: 'Maze Generator' });
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
