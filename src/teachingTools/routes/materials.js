'use strict';

var express = require('express');
var crypto = require('crypto');
var multer = require('multer');
var textbooks = require('../config/textbooks');
var siteMap = require('../config/siteMap');

function create(options) {
  options = options || {};
  var repository = options.repository || require('../services/materialRepository');
  var files = options.files || require('../services/textbookFileStorage');
  var adminMode = Boolean(options.adminMode);
  var basePath = adminMode ? '/admin/materials' : '/materials';
  var getUser = options.getUser || function (req) {
    if (adminMode && req.adminUser) return { key: require('./teacherLibrary').ownerKey(req.adminUser), admin: true };
    var user = require('./teacherLibrary').trustedUser(req);
    if (!user) return null;
    var admin = user.provider === 'aad' && (process.env.ADMIN_USER_IDS || '').split(',').map(function (id) { return id.trim(); }).includes(user.id);
    if (!admin && process.env.TEACHER_ACCOUNTS_ENABLED !== 'true') return null;
    return { key: require('./teacherLibrary').ownerKey(user), admin: admin };
  };
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var router = express.Router();
  var themes = siteMap.children('activities');
  var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: files.MAX_BYTES, files: 7, fields: 40, fieldSize: 10000 } })
    .fields([{ name: 'attachments', maxCount: 6 }, { name: 'preview', maxCount: 1 }]);
  var validId = function (id) { return /^[a-zA-Z0-9_-]{1,64}$/.test(id); };
  function canEdit(user, item) { return Boolean(user && (user.admin || (item.ownerKey && item.ownerKey === user.key))); }
  function fail(message) { var error = new Error(message); error.status = 400; throw error; }
  function array(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
  function text(value, max, required) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('Please check the material details. / 请检查材料信息。');
    return value.trim();
  }
  function login(req, res) {
    var provider = require('./teacherLibrary').accountProvider();
    return res.redirect('/.auth/login/' + provider + '?post_login_redirect_uri=' + encodeURIComponent(req.originalUrl));
  }
  if (adminMode) router.use(function (req, res, next) {
    var user = getUser(req);
    if (!user || !user.admin) return res.status(403).send('Administrator access required. / 仅管理员可访问。');
    next();
  });
  router.get('/theme-activities/:theme', async function (req, res, next) {
    try { res.locals.activityMaterials = await repository.list({ theme: req.params.theme }); next(); }
    catch (error) { next(error); }
  });
  router.use('/materials', function (req, res, next) { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/materials', async function (req, res, next) {
    try { res.render(adminMode ? 'admin/materials' : 'materials/index', { title: 'Activity materials', items: await repository.list(), themes: themes, textbooks: textbooks, user: getUser(req), adminUser: req.adminUser }); }
    catch (error) { next(error); }
  });
  async function editor(req, res, next) {
    try {
      var user = getUser(req);
      if (!user) return login(req, res);
      var item = req.params.id ? await repository.get(req.params.id) : null;
      if (req.params.id && !item) return next();
      if (item && !canEdit(user, item)) return res.status(403).send('Only the uploader or an administrator can edit this material. / 仅上传者或管理员可编辑。');
      res.render('materials/edit', { title: item ? item.title : 'Upload material', item: item, themes: themes,
        catalog: await repository.catalog(), textbooks: textbooks, admin: user.admin,
        adminMode: adminMode, basePath: basePath, adminUser: req.adminUser });
    } catch (error) { next(error); }
  }
  router.get('/materials/new', editor);
  router.get('/materials/:id/edit', editor);
  router.get('/materials/:id', async function (req, res, next) {
    if (!validId(req.params.id)) return next();
    try {
      var item = await repository.get(req.params.id);
      if (!item) return next();
      res.render('materials/detail', { title: item.title, item: item, textbooks: textbooks, canEdit: canEdit(getUser(req), item) });
    } catch (error) { next(error); }
  });
  router.get('/materials/:id/files/:index', async function (req, res, next) {
    if (!validId(req.params.id) || !/^\d$/.test(req.params.index)) return next();
    try {
      var item = await repository.get(req.params.id);
      var file = item && item.files[Number(req.params.index)];
      if (!file) return next();
      if (file.url) return res.redirect(file.url);
      var stream = await files.open(file.blobName);
      if (!stream) return next();
      res.set('X-Content-Type-Options', 'nosniff');
      res.type(file.contentType).attachment(file.name);
      stream.on('error', next); stream.pipe(res);
    } catch (error) { next(error); }
  });
  router.get('/materials/:id/preview', async function (req, res, next) {
    try {
      var item = validId(req.params.id) && await repository.get(req.params.id);
      if (!item || !item.preview) return next();
      var stream = await files.open(item.preview);
      if (!stream) return next();
      res.set('X-Content-Type-Options', 'nosniff');
      res.type(/\.png$/.test(item.preview) ? 'image/png' : 'image/jpeg');
      stream.on('error', next); stream.pipe(res);
    } catch (error) { next(error); }
  });
  router.post('/materials/save', async function (req, res, next) {
    // Authenticate and check origin before accepting multipart data.
    if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return res.status(403).json({ error: 'Please save from this website. / 请从本站保存。' });
    var user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in first. / 请先登录。' });
    upload(req, res, function (error) {
      if (error) return res.status(400).json({ error: 'Upload failed: maximum 6 attachments, one preview, 30 MB per file. / 最多6个附件和1张预览图，每个文件不超过30 MB。' });
      save(req, res, user);
    });
  });
  async function save(req, res, user) {
    var uploaded = [];
    try {
      var body = req.body;
      var id = body.id || crypto.randomUUID();
      if (!validId(id)) fail('Invalid material. / 材料编号无效。');
      var old = body.id ? await repository.get(id) : null;
      if (body.id && !old) return res.status(404).json({ error: 'Material not found. / 材料不存在。' });
      if (old && !canEdit(user, old)) return res.status(403).json({ error: 'Only the uploader or an administrator can edit. / 仅上传者或管理员可编辑。' });
      var revision = Number(body.revision || 0);
      if (!Number.isInteger(revision) || revision !== (old ? old.revision : 0)) { var stale = new Error('Material changed. Reload before saving. / 材料已更新，请刷新后再保存。'); stale.status = 409; throw stale; }
      var selectedThemes = Array.from(new Set(array(body.themes == null ? body.theme : body.themes)));
      if (!selectedThemes.length || selectedThemes.some(function (key) { return !themes.some(function (theme) { return theme.key === key; }); })) fail('Choose at least one valid theme. / 请至少选择一个有效主题。');
      var ids = Array.from(new Set(array(body.lessons).map(Number)));
      var catalog = await repository.catalog();
      if (ids.length > 100 || ids.some(function (id) { return !Number.isInteger(id) || !catalog.some(function (lesson) { return lesson.id === id; }); })) fail('Choose an available lesson. / 请选择有效课次。');
      var item = { id: id, ownerKey: old ? old.ownerKey : user.key, theme: selectedThemes[0], themes: selectedThemes,
        title: text(body.title, 120, true), description: text(body.description || '', 2000, false),
        descriptionEn: text(body.descriptionEn || '', 2000, false), limitedFree: old ? old.limitedFree : false,
        preview: old ? old.preview : '', files: old ? old.files.slice() : [] };
      if (user.admin) item.limitedFree = body.limitedFree === 'on';
      var remove = array(body.removeFiles).map(Number);
      if (remove.some(function (index) { return !Number.isInteger(index) || !item.files[index]; })) fail('Invalid attachment. / 附件无效。');
      item.files = item.files.filter(function (file, index) { return !remove.includes(index); });
      var attachments = (req.files && req.files.attachments) || [];
      var preview = req.files && req.files.preview && req.files.preview[0];
      if (item.files.length + attachments.length > 6 || !item.files.length && !attachments.length) fail('Keep between 1 and 6 attachments. / 请保留1至6个附件。');
      try {
        attachments.forEach(function (file) { files.check(file); });
        if (preview) {
          var info = files.check(preview);
          if (!['.png', '.jpg', '.jpeg'].includes(info.ext)) fail('Preview must be PNG or JPEG. / 预览图请选择PNG或JPEG。');
        }
      } catch (error) { error.status = 400; throw error; }
      for (var file of attachments) {
        var stored = await files.save(file); uploaded.push(stored.blobName);
        item.files.push({ name: Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200), blobName: stored.blobName, contentType: stored.contentType, size: stored.size });
      }
      if (body.removePreview === 'on') item.preview = '';
      if (preview) { var image = await files.save(preview); uploaded.push(image.blobName); item.preview = image.blobName; }
      await repository.save(item, ids, revision);
      // Unlinked blobs are retained: in-flight downloads and failed cleanups cannot break a saved record.
      res.json({ url: adminMode ? basePath : '/materials/' + id });
    } catch (error) {
      for (var name of uploaded) { try { await files.remove(name); } catch (cleanupError) { console.error('material upload cleanup:', cleanupError.message); } }
      res.status(error.status || 503).json({ error: error.status ? error.message : 'Material could not be saved. / 材料暂时无法保存。' });
    }
  }
  return router;
}
module.exports = create();
module.exports.create = create;
