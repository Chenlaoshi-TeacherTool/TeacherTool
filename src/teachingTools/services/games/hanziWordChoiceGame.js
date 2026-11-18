'use strict';

const hanzi = /^\p{Script=Han}$/u;
const blank = /\[\s*\]|□/gu;

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function sanitize(data) {
  if (!Array.isArray(data?.questions) || data.questions.length < 1 || data.questions.length > 50) {
    fail('请提供 1–50 道形近字选词题。');
  }
  return {
    mode: data.mode === 'assessment' ? 'assessment' : 'practice',
    questions: data.questions.map(question => {
      const { word, position, alternatives, hint = '' } = question || {};
      const letters = typeof word === 'string' ? [...word] : [];
      if (letters.length < 1 || letters.length > 30 || !letters.every(char => hanzi.test(char)) ||
          !Number.isInteger(position) || position < 0 || position >= letters.length ||
          !Array.isArray(alternatives) || alternatives.length < 1 || alternatives.length > 3 ||
          new Set(alternatives).size !== alternatives.length ||
          !alternatives.every(char => typeof char === 'string' && hanzi.test(char) && char !== letters[position])) {
        fail('题目需要一个有效的挖空位置和 1–3 个不同的干扰字。');
      }
      if (typeof hint !== 'string' || hint.length > 200 || (hint && hint.split(blank).length !== 2)) {
        fail('提示句最多 200 字，并且需要正好一个 [ ]。');
      }
      return { word, position, alternatives, hint };
    })
  };
}

function answer(question) {
  return [...question.word][question.position];
}

function studentData(data) {
  if (data.mode !== 'assessment') return data;
  return {
    mode: data.mode,
    questions: data.questions.map(question => ({
      prompt: question.hint || [...question.word].map((char, i) => i === question.position ? '[ ]' : char).join(''),
      options: [answer(question), ...question.alternatives].sort()
    }))
  };
}

function grade(data, answers) {
  if (!Array.isArray(answers) || answers.length !== data.questions.length || answers.some((entry, i) =>
    !Array.isArray(entry) || entry.length !== 1 ||
    ![answer(data.questions[i]), ...data.questions[i].alternatives].includes(entry[0])
  )) fail('请完成每一题后再交卷。');
  return answers.map(([char], i) => char === answer(data.questions[i]));
}

module.exports = {
  type: 'hanzi-word-choice',
  version: 1,
  view: 'hanzi-word-choice',
  sanitize,
  studentData,
  grade,
  answerKey: data => data.questions.map(question => [answer(question)])
};
