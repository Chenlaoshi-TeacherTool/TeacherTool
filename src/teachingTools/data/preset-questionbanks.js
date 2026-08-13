'use strict';

/* Public, teacher-curated preset banks. Questions are loaded server-side only. */
var coreHighFrequency = []
  .concat(require('./questionbanks/core-high-frequency-1'))
  .concat(require('./questionbanks/core-high-frequency-2'))
  .concat(require('./questionbanks/core-high-frequency-3'))
  .concat(require('./questionbanks/core-high-frequency-4'))
  .concat(require('./questionbanks/core-high-frequency-5'));

function bank(id, name, description, theme, questions) {
  return {
    id: id,
    name: name,
    description: description,
    theme: theme,
    level: 'Mixed levels',
    curriculum: 'Chen Laoshi curated',
    questions: questions
  };
}

module.exports = [
  bank(
    'chenlaoshi-seasons-weather',
    'Seasons & Weather · 季节天气',
    'Vocabulary, pinyin, and speaking questions for weather and seasonal routines.',
    '季节天气',
    require('./questionbanks/seasons-weather')
  ),
  bank(
    'chenlaoshi-animals',
    'Animals · 动物',
    'Everyday animal vocabulary and simple descriptive questions.',
    '动物',
    require('./questionbanks/animals')
  ),
  bank(
    'chenlaoshi-numbers',
    'Numbers · 数字',
    'Number recognition, counting, and everyday number use.',
    '数字',
    require('./questionbanks/numbers')
  ),
  bank(
    'chenlaoshi-body-parts',
    'Body Parts · 身体部位',
    'Core body-part vocabulary for beginner and developing learners.',
    '身体部位',
    require('./questionbanks/body-parts')
  ),
  bank(
    'chenlaoshi-colors',
    'Colors · 颜色',
    'Color vocabulary, recognition, and classroom-ready practice.',
    '颜色',
    require('./questionbanks/colors')
  ),
  bank(
    'chenlaoshi-family',
    'Family · 家庭',
    'Family vocabulary and simple questions about relationships.',
    '家庭',
    require('./questionbanks/family')
  ),
  bank(
    'chenlaoshi-rooms',
    'Rooms · 房间',
    'Home and room vocabulary for everyday Chinese practice.',
    '房间',
    require('./questionbanks/rooms')
  ),
  bank(
    'chenlaoshi-clothing',
    'Clothing · 服装',
    'Clothing vocabulary, descriptions, and context questions.',
    '服装',
    require('./questionbanks/clothing')
  ),
  bank(
    'chenlaoshi-jobs',
    'Jobs · 职业',
    'Common jobs and role vocabulary for classroom discussion.',
    '职业',
    require('./questionbanks/jobs')
  ),
  bank(
    'chenlaoshi-countries',
    'Countries · 国家',
    'Country names, cultural contexts, and geography vocabulary.',
    '国家',
    require('./questionbanks/countries')
  ),
  bank(
    'chenlaoshi-hobbies',
    'Hobbies · 爱好',
    'Hobby vocabulary and questions that invite student responses.',
    '爱好',
    require('./questionbanks/hobbies')
  ),
  bank(
    'chenlaoshi-school',
    'School · 学校',
    'School life vocabulary and classroom routine questions.',
    '学校',
    require('./questionbanks/school')
  ),
  bank(
    'chenlaoshi-back-to-school',
    'Back to School · 开学季',
    'Start-of-year vocabulary and school-community questions.',
    '开学季',
    require('./questionbanks/back-to-school')
  ),
  bank(
    'chenlaoshi-festivals',
    'Festivals · 节日',
    'Festival vocabulary, customs, and seasonal cultural questions.',
    '节日',
    require('./questionbanks/festivals')
  ),
  bank(
    'chenlaoshi-self-introduction',
    'Self Introduction · 自我介绍',
    'Personal information and introductory speaking practice.',
    '自我介绍',
    require('./questionbanks/self-introduction')
  ),
  bank(
    'chenlaoshi-pinyin',
    'Pinyin · 拼音',
    'Pinyin recognition, pronunciation, and spelling practice.',
    '拼音',
    require('./questionbanks/pinyin')
  ),
  bank(
    'chenlaoshi-core-high-frequency',
    'Core High-Frequency Words · 核心高频词',
    'A larger mixed-level bank of high-frequency Chinese for everyday classroom use.',
    '核心高频词',
    coreHighFrequency
  )
];
