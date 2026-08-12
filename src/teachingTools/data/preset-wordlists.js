'use strict';

/*
 * Public, teacher-ready starter packs.
 * These are intentionally curated starter collections, not a complete or
 * official HSK syllabus. Larger HSK 1–6 collections can use the same schema
 * after their source and licence have been confirmed.
 */
module.exports = [
  {
    id: 'preset-hsk-1-essentials',
    name: 'HSK 1 Essentials',
    description: 'A compact, beginner-friendly starter pack for greetings, people, and classroom basics.',
    theme: 'HSK 1',
    level: 'Beginner',
    curriculum: 'HSK 1 starter',
    items: [
      { zh: '你好', py: 'nǐ hǎo', en: 'hello' },
      { zh: '谢谢', py: 'xiè xie', en: 'thank you' },
      { zh: '再见', py: 'zài jiàn', en: 'goodbye' },
      { zh: '请', py: 'qǐng', en: 'please' },
      { zh: '对不起', py: 'duì bu qǐ', en: 'sorry' },
      { zh: '老师', py: 'lǎo shī', en: 'teacher' },
      { zh: '学生', py: 'xué sheng', en: 'student' },
      { zh: '朋友', py: 'péng you', en: 'friend' },
      { zh: '人', py: 'rén', en: 'person' },
      { zh: '我', py: 'wǒ', en: 'I; me' },
      { zh: '你', py: 'nǐ', en: 'you' },
      { zh: '他', py: 'tā', en: 'he; him' },
      { zh: '她', py: 'tā', en: 'she; her' },
      { zh: '是', py: 'shì', en: 'to be' },
      { zh: '有', py: 'yǒu', en: 'to have' },
      { zh: '喜欢', py: 'xǐ huan', en: 'to like' }
    ]
  },
  {
    id: 'preset-food-and-fruit',
    name: 'Food & Fruit',
    description: 'Useful food vocabulary for cards, matching games, and speaking activities.',
    theme: 'Food',
    level: 'Novice',
    curriculum: 'Chen Laoshi curated',
    items: [
      { zh: '苹果', py: 'píng guǒ', en: 'apple' },
      { zh: '香蕉', py: 'xiāng jiāo', en: 'banana' },
      { zh: '草莓', py: 'cǎo méi', en: 'strawberry' },
      { zh: '西瓜', py: 'xī guā', en: 'watermelon' },
      { zh: '葡萄', py: 'pú tao', en: 'grapes' },
      { zh: '橘子', py: 'jú zi', en: 'orange' },
      { zh: '梨', py: 'lí', en: 'pear' },
      { zh: '桃子', py: 'táo zi', en: 'peach' },
      { zh: '米饭', py: 'mǐ fàn', en: 'rice' },
      { zh: '面条', py: 'miàn tiáo', en: 'noodles' },
      { zh: '饺子', py: 'jiǎo zi', en: 'dumplings' },
      { zh: '水', py: 'shuǐ', en: 'water' },
      { zh: '果汁', py: 'guǒ zhī', en: 'juice' },
      { zh: '茶', py: 'chá', en: 'tea' }
    ]
  },
  {
    id: 'preset-classroom-basics',
    name: 'Classroom Basics',
    description: 'High-frequency classroom objects and instructions for immediate use.',
    theme: 'School',
    level: 'Novice',
    curriculum: 'Chen Laoshi curated',
    items: [
      { zh: '书', py: 'shū', en: 'book' },
      { zh: '本子', py: 'běn zi', en: 'notebook' },
      { zh: '铅笔', py: 'qiān bǐ', en: 'pencil' },
      { zh: '橡皮', py: 'xiàng pí', en: 'eraser' },
      { zh: '尺子', py: 'chǐ zi', en: 'ruler' },
      { zh: '桌子', py: 'zhuō zi', en: 'desk' },
      { zh: '椅子', py: 'yǐ zi', en: 'chair' },
      { zh: '黑板', py: 'hēi bǎn', en: 'blackboard' },
      { zh: '请坐', py: 'qǐng zuò', en: 'please sit down' },
      { zh: '请听', py: 'qǐng tīng', en: 'please listen' },
      { zh: '请说', py: 'qǐng shuō', en: 'please speak' },
      { zh: '请看', py: 'qǐng kàn', en: 'please look' },
      { zh: '请读', py: 'qǐng dú', en: 'please read' },
      { zh: '请写', py: 'qǐng xiě', en: 'please write' }
    ]
  },
  {
    id: 'preset-weather-and-seasons',
    name: 'Weather & Seasons',
    description: 'A colorful set for seasonal warm-ups, forecasts, and speaking prompts.',
    theme: 'Weather',
    level: 'Novice',
    curriculum: 'Chen Laoshi curated',
    items: [
      { zh: '天气', py: 'tiān qì', en: 'weather' },
      { zh: '太阳', py: 'tài yáng', en: 'sun' },
      { zh: '云', py: 'yún', en: 'cloud' },
      { zh: '雨', py: 'yǔ', en: 'rain' },
      { zh: '雪', py: 'xuě', en: 'snow' },
      { zh: '风', py: 'fēng', en: 'wind' },
      { zh: '热', py: 'rè', en: 'hot' },
      { zh: '冷', py: 'lěng', en: 'cold' },
      { zh: '春天', py: 'chūn tiān', en: 'spring' },
      { zh: '夏天', py: 'xià tiān', en: 'summer' },
      { zh: '秋天', py: 'qiū tiān', en: 'autumn' },
      { zh: '冬天', py: 'dōng tiān', en: 'winter' }
    ]
  }
];
