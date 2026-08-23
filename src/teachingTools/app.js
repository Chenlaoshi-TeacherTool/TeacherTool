var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var apiRouter = require('./routes/api');
var adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(function(req, res, next) {
  var forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  var forwardedHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  var protocol = forwardedProto || req.protocol || 'https';
  res.locals.siteUrl = process.env.SITE_URL || (forwardedHost ? protocol + '://' + forwardedHost : 'https://clsteachingtools.com');
  res.locals.requestPath = req.path || '/';
  next();
});
// Let application routes own clean directory-style URLs instead of having
// express.static add a trailing-slash redirect before the router can respond.
app.use(express.static(path.join(__dirname, 'public'), { redirect: false }));

app.use('/', indexRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.locals.status = err.status || 500;
  res.locals.noindex = true;

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
