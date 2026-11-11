'use strict';

var siteMap = require('./siteMap');
var labels = {
  materials: ['活动材料', '上传、编辑材料，关联主题与课本课文'],
  textbooks: ['课本管理', '按教材、册数和课文管理词汇与课堂内容'],
  wordlists: ['词汇表', '管理公共词汇表、拼音、英文与图片'],
  questionbanks: ['题库', '管理题目与题库，支持 Excel 导入'],
  articles: ['教学文章', '新建与编辑文章，保留原有文章地址'],
  toolguides: ['工具指南', '编辑各个教学工具的使用说明'],
  toolvideos: ['工具视频', '管理工具的中英文教学视频链接'],
  recommendations: ['教室好物', '管理推荐产品、链接和配套下载'],
  community: ['社区管理', '查看举报，隐藏、恢复或删除分享'],
  memberships: ['会员管理', '管理激活码，查询教师会员记录'],
  pages: ['网站页面', '编辑首页介绍和关于与联系的中英文内容']
};
var definitions = [
  ['resources', '教学资源', ['materials', 'textbooks', 'wordlists', 'questionbanks']],
  ['content', '教学与工具内容', ['articles', 'toolguides', 'toolvideos']],
  ['website', '网站内容', ['pages', 'recommendations']],
  ['accounts', '账户与社区', ['memberships', 'community']]
];
function editor(key) {
  return Object.assign({ key: key }, siteMap.ADMIN_EDITORS[key], { label: labels[key][0], description: labels[key][1] });
}
function groups() {
  return definitions.map(function(group) { return { key: group[0], label: group[1], editors: group[2].map(editor) }; });
}
module.exports = { groups: groups, editor: editor };
