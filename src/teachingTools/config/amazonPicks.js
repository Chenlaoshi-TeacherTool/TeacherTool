'use strict';

// Ranked Amazon teacher favorites shown as a chart on /classroom-finds.
// Images live in the public "classroom-finds" blob container (amazon-picks/).
var IMAGE_BASE = 'https://chenlaoshitteaching.blob.core.windows.net/classroom-finds/amazon-picks/';

module.exports = [
  { image: '01-time-timer.jpg', url: 'https://link.amazon/B05GEXD58',
    en: { title: 'Time Timer Visual Timer', blurb: 'A teacher favorite that shows students time passing at a glance.' },
    zh: { title: 'Time Timer 视觉计时器', blurb: '老师最爱，用视觉方式帮助学生理解时间流逝。' } },
  { image: '02-unifix-cubes.jpg', url: 'https://link.amazon/B0j9mIpcj',
    en: { title: 'Unifix Math Cubes (300)', blurb: 'Hands-on math manipulatives for counting, addition, subtraction, and patterns.' },
    zh: { title: 'Unifix 数学积木（300 个）', blurb: '数学操作材料，适合数数、加减法、模式训练。' } },
  { image: '03-play-doh-classpack.jpg', url: 'https://link.amazon/B0aJ5imFi',
    en: { title: 'Play-Doh Classroom Schoolpack (48 cans)', blurb: 'A must for sensory play and fine motor practice.' },
    zh: { title: 'Play-Doh 课堂大容量套装（48 罐）', blurb: '感官活动、手部精细动作训练必备。' } },
  { image: '04-magnetic-letters-numbers.jpg', url: 'https://link.amazon/B0gptmGkY',
    en: { title: 'Magnetic Letters & Numbers Set', blurb: 'For letter work, phonics practice, and early math activities.' },
    zh: { title: '磁性字母数字套装', blurb: '字母教学、拼读练习、数学基础活动。' } },
  { image: '05-lego-classic-brick-box.jpg', url: 'https://link.amazon/B0ep4AdRo',
    en: { title: 'LEGO Classic Large Creative Brick Box', blurb: 'Great for STEM challenges, creative writing prompts, and group work.' },
    zh: { title: 'LEGO 创意积木大盒', blurb: '老师用来做 STEM、创意写作、合作学习。' } },
  { image: '06-rolling-utility-cart.jpg', url: 'https://www.amazon.com/dp/B07TY1RFH5?tag=chenlaoshitea-20',
    en: { title: 'Amazon Basics 3-Tier Rolling Cart', blurb: 'A mobile classroom station for books, markers, and activity materials.' },
    zh: { title: 'Amazon Basics 三层滚动推车', blurb: '移动课堂神器，放教材、白板笔、活动材料。' } },
  { image: '07-digital-timers-4-pack.jpg', url: 'https://www.amazon.com/dp/B0B5ZJ5YNK?tag=chenlaoshitea-20',
    en: { title: 'Classroom Digital Timers (4-pack)', blurb: 'Countdowns for group work, reading time, and math practice.' },
    zh: { title: '课堂用数字计时器（4 个装）', blurb: '小组活动、阅读时间、数学练习倒计时。' } },
  { image: '08-post-it-super-sticky.jpg', url: 'https://link.amazon/B01Kr9GVU',
    en: { title: 'Post-it Super Sticky Notes', blurb: 'For classroom directions, student grouping, and reading logs.' },
    zh: { title: 'Post-it 超强便利贴', blurb: '课堂指令、学生分组、阅读记录。' } },
  { image: '09-expo-fine-tip-markers.jpg', url: 'https://link.amazon/B09FxKnf6',
    en: { title: 'EXPO Fine Tip Dry Erase Markers (36)', blurb: 'Low odor and bright colors. A teacher essential.' },
    zh: { title: 'EXPO 细头白板笔（36 支）', blurb: '低气味、颜色鲜艳，老师必备。' } },
  { image: '10-paper-mate-flair.jpg', url: 'https://link.amazon/B0btzmlP1',
    en: { title: 'Paper Mate Flair Felt Tip Pens', blurb: 'For grading, note-taking, and color-coding in class.' },
    zh: { title: 'Paper Mate Flair 彩色笔', blurb: '批改作业、做笔记、课堂标记。' } },
  { image: '11-animal-reward-stickers.jpg', url: 'https://link.amazon/B0gkAHyW2',
    en: { title: '1,440 Animal Reward Stickers', blurb: 'For reward systems, reading challenges, and classroom management.' },
    zh: { title: '1440 张动物奖励贴纸', blurb: '奖励系统、阅读挑战、课堂管理。' } }
].map(function (pick, index) {
  return {
    rank: index + 1,
    imageUrl: IMAGE_BASE + pick.image,
    productUrl: pick.url,
    en: pick.en,
    zh: pick.zh
  };
});
