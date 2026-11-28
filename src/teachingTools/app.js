var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var compression = require('compression');
var fs = require('fs');
var i18n = require('./services/i18n');
var zhHant = require('./services/zhHant');
var siteMap = require('./config/siteMap');

var indexRouter = require('./routes/index');
var siteStructureRouter = require('./routes/siteStructure');
var apiRouter = require('./routes/api');
var adminRouter = require('./routes/admin');
var bookGeneratorRouter = require('./routes/bookGenerator');
var gameSharesRouter = require('./routes/gameShares');
var boardRoomsRouter = require('./routes/boardRooms');
var communityRouter = require('./routes/community');
var textbookCompanionRouter = require('./routes/textbookCompanion');
var materialsRouter = require('./routes/materials');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

// Azure health check: answers without touching the database, so a slow or
// paused database does not get a healthy site restarted. Registered before the
// canonical-host redirect, because Azure pings the default *.azurewebsites.net
// address and would otherwise get a 301.
app.get('/healthz', function(req, res) {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').send('ok');
});

// gzip pages, scripts and JSON. Board-room event streams send
// Cache-Control: no-transform, which compression leaves alone.
app.use(compression());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-only-cookie-secret-change-in-production'));
// One canonical host: www.<site> and the default Azure address (which Azure
// puts in WEBSITE_HOSTNAME) forward to the SITE_URL host, so teacher sign-in
// cookies, same-origin checks on saves, and search engines all see one origin.
app.use(function(req, res, next) {
  if (!process.env.SITE_URL || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
  var site = new URL(process.env.SITE_URL);
  var host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim().toLowerCase();
  var azureHost = (process.env.WEBSITE_HOSTNAME || '').toLowerCase();
  if (host === site.host || (host !== 'www.' + site.host && host !== azureHost)) return next();
  res.redirect(301, site.origin + req.originalUrl);
});

app.use(function(req, res, next) {
  var forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  var forwardedHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  var protocol = forwardedProto || req.protocol || 'https';
  res.locals.siteUrl = process.env.SITE_URL || (forwardedHost ? protocol + '://' + forwardedHost : 'https://clsteachingtools.com');
  res.locals.requestPath = req.path || '/';
  res.locals.baiduSiteVerification = process.env.BAIDU_SITE_VERIFICATION || '';
  next();
});

// Site-wide language support: read the preference cookie and expose it (plus
// a t() translation helper) to every view. The nav bar itself is injected
// client-side by public/javascripts/milk-tea-footer.js, which reads this same
// cookie to render its own language toggle and bilingual labels.
app.use(function(req, res, next) {
  var lang = i18n.normalizeLang(req.cookies && req.cookies.lang);
  res.locals.lang = lang;
  // 'hant' = show this Chinese page in 繁体 (see services/zhHant.js).
  res.locals.zhScript = lang === 'zh' ? i18n.normalizeScript(req.cookies && req.cookies.zhScript) : 'hans';
  res.locals.t = function(key) { return i18n.t(lang, key); };
  // The same key in the other language, so search can match either one.
  res.locals.tOther = function(key) { return i18n.t(lang === 'zh' ? 'en' : 'zh', key); };
  next();
});

// 中文 · 繁: convert rendered pages to 通用繁体 (services/zhHant.js).
app.use(zhHant.middleware);

// Let application routes own clean directory-style URLs instead of having
// express.static add a trailing-slash redirect before the router can respond.
app.get('/fonts/Yu_DuoYinZi_Collection.ttc', function(req, res) {
  var fontDownloadUrl = process.env.YU_DUOYINZI_FONT_URL ||
    'https://chenlaoshitteaching.blob.core.windows.net/fonts/Yu_DuoYinZi_Collection.ttc';
  res.redirect(302, fontDownloadUrl);
});

// Keep the withdrawn tool unavailable, including direct static-file links.
app.use('/teaching-tools/sunflower-spinner', function(req, res, next) {
  next(createError(410, 'Sunflower Spinner 已下架 / has been removed.'));
});

// The shared nav script gets its links from config/siteMap.js, so the menu,
// footer, sitemap, and admin dashboard all follow the same structure.
var navScript = fs.readFileSync(path.join(__dirname, 'public/javascripts/milk-tea-footer.js'), 'utf8');
// Every page loads this script, so the built copy is kept for 5 minutes (or
// until an admin changes the catalog) instead of querying the database each
// time. A failed catalog load is retried on the next request, not cached.
var contentCatalog = require('./services/contentCatalog');
var NAV_CACHE_MS = 5 * 60 * 1000;
var navCache = null;
async function buildNavScript() {
  var version = contentCatalog.version();
  if (navCache && navCache.version === version && Date.now() - navCache.at < NAV_CACHE_MS) return navCache.body;
  var catalog = await contentCatalog.load().catch(function() { return null; });
  var body = navScript.replace('/*SITE_NAV*/{ nav: [], footer: [] }', function() {
    return JSON.stringify(siteMap.clientNav(catalog && catalog.textbooks.SERIES));
  });
  if (catalog) navCache = { version: version, at: Date.now(), body: body };
  return body;
}
app.get('/javascripts/milk-tea-footer.js', async function(req, res) {
  var body = await buildNavScript();
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/javascript').send(body);
});


app.use(function(req, res, next) {
  if (/^\/(?:api|admin|book|play)(?:\/|$)/.test(req.path) || /^\/teaching-tools\/(?:my-library|my-activities|word-list-library|question-bank-library)(?:\/|$)/.test(req.path)) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.locals.noindex = true;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { redirect: false }));

app.use('/', textbookCompanionRouter);
app.use('/', materialsRouter);
app.use('/', siteStructureRouter);
app.use('/', indexRouter);
app.use('/', bookGeneratorRouter);
app.use('/', gameSharesRouter);
app.use('/', boardRoomsRouter);
app.use('/', communityRouter);
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
