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
    'Seasons & Weather',
    'Vocabulary, pinyin, and speaking questions for weather and seasonal routines.',
    'Seasons & Weather',
    require('./questionbanks/seasons-weather')
  ),
  bank(
    'chenlaoshi-animals',
    'Animals',
    'Everyday animal vocabulary and simple descriptive questions.',
    'Animals',
    require('./questionbanks/animals')
  ),
  bank(
    'chenlaoshi-numbers',
    'Numbers',
    'Number recognition, counting, and everyday number use.',
    'Numbers',
    require('./questionbanks/numbers')
  ),
  bank(
    'chenlaoshi-body-parts',
    'Body Parts',
    'Core body-part vocabulary for beginner and developing learners.',
    'Body Parts',
    require('./questionbanks/body-parts')
  ),
  bank(
    'chenlaoshi-colors',
    'Colors',
    'Color vocabulary, recognition, and classroom-ready practice.',
    'Colors',
    require('./questionbanks/colors')
  ),
  bank(
    'chenlaoshi-family',
    'Family',
    'Family vocabulary and simple questions about relationships.',
    'Family',
    require('./questionbanks/family')
  ),
  bank(
    'chenlaoshi-rooms',
    'Rooms',
    'Home and room vocabulary for everyday Chinese practice.',
    'Rooms',
    require('./questionbanks/rooms')
  ),
  bank(
    'chenlaoshi-clothing',
    'Clothing',
    'Clothing vocabulary, descriptions, and context questions.',
    'Clothing',
    require('./questionbanks/clothing')
  ),
  bank(
    'chenlaoshi-jobs',
    'Jobs',
    'Common jobs and role vocabulary for classroom discussion.',
    'Jobs',
    require('./questionbanks/jobs')
  ),
  bank(
    'chenlaoshi-countries',
    'Countries',
    'Country names, cultural contexts, and geography vocabulary.',
    'Countries',
    require('./questionbanks/countries')
  ),
  bank(
    'chenlaoshi-hobbies',
    'Hobbies',
    'Hobby vocabulary and questions that invite student responses.',
    'Hobbies',
    require('./questionbanks/hobbies')
  ),
  bank(
    'chenlaoshi-school',
    'School',
    'School life vocabulary and classroom routine questions.',
    'School',
    require('./questionbanks/school')
  ),
  bank(
    'chenlaoshi-back-to-school',
    'Back to School',
    'Start-of-year vocabulary and school-community questions.',
    'Back to School',
    require('./questionbanks/back-to-school')
  ),
  bank(
    'chenlaoshi-festivals',
    'Festivals',
    'Festival vocabulary, customs, and seasonal cultural questions.',
    'Festivals',
    require('./questionbanks/festivals')
  ),
  bank(
    'chenlaoshi-self-introduction',
    'Self Introduction',
    'Personal information and introductory speaking practice.',
    'Self Introduction',
    require('./questionbanks/self-introduction')
  ),
  bank(
    'chenlaoshi-pinyin',
    'Pinyin',
    'Pinyin recognition, pronunciation, and spelling practice.',
    'Pinyin',
    require('./questionbanks/pinyin')
  ),
  bank(
    'chenlaoshi-core-high-frequency',
    'Core High-Frequency Words',
    'A larger mixed-level bank of high-frequency Chinese for everyday classroom use.',
    'Core High-Frequency Words',
    coreHighFrequency
  )
];
