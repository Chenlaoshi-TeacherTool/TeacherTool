/*!
 * 量词大挑战 · 内置数据
 * 量词元信息（拼音、固定颜色、规律提示）+ 内置题库 + 句子模板。
 * 老师页和学生分享页共用这一份。
 */
(function (global) {
  'use strict';

  // 每个量词固定一个颜色：按钮、提示、结束画面都用同一个颜色帮助记忆。
  // rule / ruleEn 是答错时显示的「规律提示」。
  var MEASURE_WORDS = [
    { mw: '张', py: 'zhāng', color: '#2f7fd8', rule: '平平的、有一个面的东西', ruleEn: 'flat things with a surface' },
    { mw: '把', py: 'bǎ', color: '#ef8a17', rule: '有把手、可以用手抓的东西', ruleEn: 'things with a handle you grab' },
    { mw: '台', py: 'tái', color: '#8a4fd1', rule: '机器、电器', ruleEn: 'machines and appliances' },
    { mw: '本', py: 'běn', color: '#2f9e5b', rule: '一页一页装订起来的东西', ruleEn: 'bound pages: books, notebooks' },
    { mw: '门', py: 'mén', color: '#d64545', rule: '课程、学科', ruleEn: 'school subjects and courses' },
    { mw: '个', py: 'gè', color: '#3a8f9a', rule: '最常用的量词：人和很多东西', ruleEn: 'the general one: people and many things' },
    { mw: '只', py: 'zhī', color: '#d6528f', rule: '大多数动物；成对东西中的一个', ruleEn: 'most animals; one of a pair' },
    { mw: '条', py: 'tiáo', color: '#a8730c', rule: '长长的、细细的东西', ruleEn: 'long, thin things' },
    { mw: '件', py: 'jiàn', color: '#5a6fd6', rule: '上衣、事情', ruleEn: 'tops, matters' },
    { mw: '辆', py: 'liàng', color: '#4b6a7d', rule: '有轮子的车', ruleEn: 'vehicles with wheels' },
    { mw: '双', py: 'shuāng', color: '#c0587a', rule: '一对一对的东西', ruleEn: 'pairs' },
    { mw: '支', py: 'zhī', color: '#6b8e23', rule: '细长、硬的东西，比如笔', ruleEn: 'stick-like things, e.g. pens' },
    { mw: '杯', py: 'bēi', color: '#c06a2b', rule: '用杯子装的东西', ruleEn: 'a cup of …' },
    { mw: '块', py: 'kuài', color: '#7d6b56', rule: '一小块一小块的东西', ruleEn: 'chunks and pieces' },
    { mw: '位', py: 'wèi', color: '#2a8a74', rule: '有礼貌地说人', ruleEn: 'people (polite)' },
    { mw: '头', py: 'tóu', color: '#8b5a3c', rule: '大的动物', ruleEn: 'large animals' },
    { mw: '棵', py: 'kē', color: '#3f8f3f', rule: '树、草这样的植物', ruleEn: 'trees and plants' },
    { mw: '朵', py: 'duǒ', color: '#d2477f', rule: '花、云', ruleEn: 'flowers, clouds' },
    { mw: '座', py: 'zuò', color: '#6a5acd', rule: '大大的、不能动的东西：山、楼、桥', ruleEn: 'big fixed things: mountains, buildings' },
    { mw: '家', py: 'jiā', color: '#b5484a', rule: '商店、公司、饭馆', ruleEn: 'shops, companies, restaurants' }
  ];

  // 没有规律信息的自定义量词，从这里轮流拿颜色。
  var EXTRA_COLORS = ['#1f8fbf', '#c2410c', '#7c3aed', '#15803d', '#be123c', '#0e7490', '#a16207', '#4d7c0f'];

  // kind 决定填句子时用哪类句子模板。challenge: true = 挑战词（没学过但规律相同）。
  // alt = 也可以接受的量词（例如「一张椅子」也常说），不会被当成干扰项。
  var BANK = [
    // 张
    { noun: '纸', emoji: '📄', mw: '张', kind: 'thing' },
    { noun: '桌子', emoji: '', mw: '张', kind: 'big' },
    { noun: '照片', emoji: '🖼️', mw: '张', kind: 'thing' },
    { noun: '票', emoji: '🎫', mw: '张', kind: 'thing' },
    { noun: '地图', emoji: '🗺️', mw: '张', kind: 'thing' },
    { noun: '卡片', emoji: '💳', mw: '张', kind: 'thing' },
    { noun: '床', emoji: '🛏️', mw: '张', kind: 'big', challenge: true },
    { noun: '光盘', emoji: '💿', mw: '张', kind: 'thing', challenge: true },
    { noun: '脸', emoji: '🙂', mw: '张', kind: 'body', challenge: true },
    // 把
    { noun: '椅子', emoji: '🪑', mw: '把', alt: ['张'], kind: 'big' },
    { noun: '剪刀', emoji: '✂️', mw: '把', kind: 'thing' },
    { noun: '尺子', emoji: '📏', mw: '把', kind: 'thing' },
    { noun: '钥匙', emoji: '🔑', mw: '把', kind: 'thing' },
    { noun: '刀', emoji: '🔪', mw: '把', kind: 'thing' },
    { noun: '伞', emoji: '☂️', mw: '把', kind: 'thing', challenge: true },
    { noun: '牙刷', emoji: '🪥', mw: '把', kind: 'thing', challenge: true },
    { noun: '吉他', emoji: '🎸', mw: '把', kind: 'thing', challenge: true },
    { noun: '梳子', emoji: '🪮', mw: '把', kind: 'thing', challenge: true },
    // 台
    { noun: '电脑', emoji: '💻', mw: '台', kind: 'big' },
    { noun: '电视', emoji: '📺', mw: '台', kind: 'big' },
    { noun: '打印机', emoji: '🖨️', mw: '台', kind: 'big' },
    { noun: '冰箱', emoji: '🧊', mw: '台', kind: 'big', challenge: true },
    { noun: '相机', emoji: '📷', mw: '台', kind: 'thing', challenge: true },
    { noun: '收音机', emoji: '📻', mw: '台', kind: 'big', challenge: true },
    { noun: '洗衣机', emoji: '🫧', mw: '台', kind: 'big', challenge: true },
    // 本
    { noun: '书', emoji: '📕', mw: '本', kind: 'thing' },
    { noun: '本子', emoji: '📓', mw: '本', kind: 'thing' },
    { noun: '词典', emoji: '📘', mw: '本', kind: 'thing' },
    { noun: '课本', emoji: '📗', mw: '本', kind: 'thing' },
    { noun: '杂志', emoji: '📙', mw: '本', kind: 'thing', challenge: true },
    { noun: '日记', emoji: '📔', mw: '本', kind: 'thing', challenge: true },
    { noun: '漫画书', emoji: '📚', mw: '本', kind: 'thing', challenge: true },
    { noun: '护照', emoji: '🛂', mw: '本', kind: 'thing', challenge: true },
    // 门
    { noun: '中文课', emoji: '🀄', mw: '门', kind: 'course' },
    { noun: '数学课', emoji: '➗', mw: '门', kind: 'course' },
    { noun: '科学课', emoji: '🔬', mw: '门', kind: 'course' },
    { noun: '英文课', emoji: '🔤', mw: '门', kind: 'course' },
    { noun: '历史课', emoji: '🏛️', mw: '门', kind: 'course', challenge: true },
    { noun: '美术课', emoji: '🎨', mw: '门', kind: 'course', challenge: true },
    { noun: '音乐课', emoji: '🎵', mw: '门', kind: 'course', challenge: true },
    { noun: '外语', emoji: '🌐', mw: '门', kind: 'course', challenge: true },
    // 个
    { noun: '人', emoji: '🧑', mw: '个', kind: 'person' },
    { noun: '学生', emoji: '🧑‍🎓', mw: '个', kind: 'person' },
    { noun: '朋友', emoji: '🧑‍🤝‍🧑', mw: '个', kind: 'person' },
    { noun: '苹果', emoji: '🍎', mw: '个', kind: 'food' },
    { noun: '书包', emoji: '🎒', mw: '个', kind: 'thing' },
    { noun: '汉堡', emoji: '🍔', mw: '个', kind: 'food', challenge: true },
    { noun: '鸡蛋', emoji: '🥚', mw: '个', kind: 'food', challenge: true },
    { noun: '西瓜', emoji: '🍉', mw: '个', kind: 'food', challenge: true },
    // 只
    { noun: '猫', emoji: '🐱', mw: '只', kind: 'animal' },
    { noun: '鸟', emoji: '🐦', mw: '只', kind: 'animal' },
    { noun: '兔子', emoji: '🐰', mw: '只', kind: 'animal' },
    { noun: '熊猫', emoji: '🐼', mw: '只', kind: 'animal' },
    { noun: '鸡', emoji: '🐔', mw: '只', kind: 'animal', challenge: true },
    { noun: '老虎', emoji: '🐯', mw: '只', kind: 'animal', challenge: true },
    { noun: '袜子', emoji: '🧦', mw: '只', kind: 'clothes', challenge: true },
    { noun: '耳朵', emoji: '👂', mw: '只', kind: 'body', challenge: true },
    // 条
    { noun: '鱼', emoji: '🐟', mw: '条', kind: 'animal' },
    { noun: '裤子', emoji: '👖', mw: '条', kind: 'clothes' },
    { noun: '裙子', emoji: '👗', mw: '条', kind: 'clothes' },
    { noun: '河', emoji: '🏞️', mw: '条', kind: 'nature' },
    { noun: '蛇', emoji: '🐍', mw: '条', kind: 'animal', challenge: true },
    { noun: '路', emoji: '🛣️', mw: '条', kind: 'nature', challenge: true },
    { noun: '领带', emoji: '👔', mw: '条', kind: 'clothes', challenge: true },
    { noun: '围巾', emoji: '🧣', mw: '条', kind: 'clothes', challenge: true }
  ];

  // 填句子模板：{n} = 随机数字，（　）= 空格，{noun} = 名词。max = 这类句子里数字的上限。
  var TEMPLATES = {
    thing: { max: 20, list: ['我有{n}（　）{noun}。', '桌子上有{n}（　）{noun}。', '他买了{n}（　）{noun}。', '书包里有{n}（　）{noun}。', '老师给了我{n}（　）{noun}。'] },
    big: { max: 30, list: ['教室里有{n}（　）{noun}。', '我家有{n}（　）{noun}。', '商店里有{n}（　）{noun}。', '图书馆里有{n}（　）{noun}。'] },
    course: { max: 8, list: ['这个学期我上{n}（　）{noun}。', '我们学校有{n}（　）{noun}。', '哥哥今年学{n}（　）{noun}。'] },
    person: { max: 30, list: ['教室里有{n}（　）{noun}。', '我认识{n}（　）{noun}。', '公园里有{n}（　）{noun}。'] },
    animal: { max: 20, list: ['动物园里有{n}（　）{noun}。', '我家有{n}（　）{noun}。', '我看见了{n}（　）{noun}。'] },
    food: { max: 12, list: ['我吃了{n}（　）{noun}。', '桌子上有{n}（　）{noun}。', '妈妈买了{n}（　）{noun}。'] },
    clothes: { max: 10, list: ['我有{n}（　）{noun}。', '她买了{n}（　）{noun}。', '衣柜里有{n}（　）{noun}。'] },
    nature: { max: 10, list: ['这里有{n}（　）{noun}。', '这个城市有{n}（　）{noun}。'] },
    body: { max: 2, list: ['我有{n}（　）{noun}。', '他画了{n}（　）{noun}。'] }
  };

  var DIGITS = '零一二三四五六七八九';

  // 1–99 的中文数字；单独的 2 说「两」（两张桌子），十几不说「一十」。
  function toChineseNumber(n) {
    if (n === 2) return '两';
    if (n < 10) return DIGITS[n];
    var tens = Math.floor(n / 10);
    var ones = n % 10;
    return (tens === 1 ? '' : DIGITS[tens]) + '十' + (ones ? DIGITS[ones] : '');
  }

  global.MWData = {
    MEASURE_WORDS: MEASURE_WORDS,
    EXTRA_COLORS: EXTRA_COLORS,
    BANK: BANK,
    TEMPLATES: TEMPLATES,
    DEFAULT_MWS: ['张', '把', '台', '本', '门'],
    toChineseNumber: toChineseNumber
  };
})(window);
