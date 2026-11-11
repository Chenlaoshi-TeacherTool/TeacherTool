'use strict';
var store = require('./siteContentStore');
var finds = require('./classroomFinds');
function products(lang) {
  var state = store.get();
  var items = state.recommendationsLoaded || (state.recommendations || []).length ? state.recommendations : require('../config/classroomFindsDefaults.json');
  return (items || []).filter(function (p) { return /^https?:\/\//.test(p.productUrl || ''); }).map(function (p) { return finds.localized(p, lang || 'zh'); });
}
function download(file, lang) {
  var zh = lang === 'zh', ext = (file.name || '').split('.').pop().toLowerCase();
  var format = { pdf: 'PDF', doc: 'Word', docx: 'Word', ppt: 'PowerPoint', pptx: 'PowerPoint', xls: 'Excel', xlsx: 'Excel' }[ext] || ext.toUpperCase();
  return { title: (zh ? file.label : file.labelEn) || file.label || file.labelEn || format,
    note: (zh ? file.note : file.noteEn) || file.note || file.noteEn || (ext === 'pdf' ? (zh ? '直接打印' : 'Ready to print') : /^(docx?|pptx?|xlsx?)$/.test(ext) ? (zh ? '可以编辑' : 'Editable') : (zh ? '下载文件' : 'Download file')) };
}
module.exports = { products: products, download: download };
