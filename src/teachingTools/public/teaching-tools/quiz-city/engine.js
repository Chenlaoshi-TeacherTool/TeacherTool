(function(root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuizCity = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  var types = ['start', 'building', 'bonus', 'building', 'chance', 'building', 'challenge', 'building', 'penalty', 'building', 'chance', 'building', 'bonus', 'building', 'challenge', 'building', 'penalty', 'building', 'chance', 'building', 'bonus', 'building', 'challenge', 'building'];
  var names = ['Launch Plaza', 'Story Studio', 'Bright Bonus', 'Word Workshop', 'Chance', 'Music Hall', 'Challenge', 'Science Lab', 'City Repairs', 'Art Loft', 'Chance', 'Reading Room', 'Bright Bonus', 'Idea Garden', 'Challenge', 'Number Tower', 'City Repairs', 'Discovery Dome', 'Chance', 'Language House', 'Bright Bonus', 'Maker Space', 'Challenge', 'Knowledge Hall'];
  var namesZh = ['启航广场', '故事工坊', '惊喜奖励', '词语工厂', '机会', '音乐厅', '挑战', '科学实验室', '城市维修', '艺术阁', '机会', '阅读书屋', '惊喜奖励', '创意花园', '挑战', '数字塔', '城市维修', '探索馆', '机会', '语言小屋', '惊喜奖励', '创客空间', '挑战', '知识大厅'];
  var tiles = types.map(function(type, index) { return { type: type, name: names[index], zh: namesZh[index], price: 60 + (index % 4) * 20, fee: 15 + (index % 4) * 5 }; });
  function parse(text) {
    var invalid = [];
    var questions = [];
    String(text).split(/\r?\n/).forEach(function(line, index) {
      if (!line.trim()) return;
      var parts = line.split('|').map(function(part) { return part.trim(); });
      if (parts.length < 2 || !parts[0] || !parts[1] || parts.length > 3) { invalid.push(index + 1); return; }
      var options = parts[2] ? parts[2].split(';').map(function(option) { return option.trim(); }).filter(Boolean) : [];
      if (options.length && (options.length < 2 || options.length > 6 || !options.includes(parts[1]))) { invalid.push(index + 1); return; }
      questions.push({ prompt: parts[0], answer: parts[1], options: options });
    });
    return { questions: questions, invalid: invalid };
  }
  function create(names, minutes, questions) {
    if (names.length < 2 || names.length > 4 || ![10, 15, 20, 30].includes(minutes) || !questions.length) throw new Error('Invalid setup');
    return { version: 1, teams: names.map(function(name) { return { name: name.trim().slice(0, 30), coins: 200, position: 0, dice: 1 }; }), owners: Array(24).fill(null), questions: questions, cursor: 0, active: 0, round: 1, phase: 'ready', remaining: minutes * 60, paused: false, closing: false, dice: 1, steps: 0, event: null, challenge: false, log: [] };
  }
  function credit(team, amount) { team.coins = Math.max(0, team.coins + amount); }
  function roll(state, value) {
    if (state.phase !== 'ready' || state.paused || !Number.isInteger(value) || value < 1 || value > 6) return false;
    state.dice = value; state.teams[state.active].dice = value; state.steps = value; state.phase = 'rolling'; return true;
  }
  function step(state) {
    if (state.paused) return;
    if (state.phase === 'rolling') { state.phase = 'moving'; return; }
    if (state.phase !== 'moving') return;
    var team = state.teams[state.active];
    team.position = (team.position + 1) % 24;
    state.steps--;
    if (!state.steps) state.phase = 'question';
  }
  function question(state) { return state.questions[state.cursor % state.questions.length]; }
  function judge(state, correct, chance) {
    if (state.phase !== 'question' || state.paused) return;
    var team = state.teams[state.active];
    credit(team, correct ? (state.challenge ? 30 : 20) : 0);
    state.cursor++;
    if (state.challenge) { state.challenge = false; state.event = { kind: 'challenge-result', amount: correct ? 30 : 0 }; state.phase = 'event'; return; }
    var tile = tiles[team.position];
    state.phase = 'event';
    if (tile.type === 'building') {
      var owner = state.owners[team.position];
      if (owner === null) state.event = { kind: 'buy', amount: tile.price };
      else if (owner === state.active) state.event = { kind: 'own', amount: 0 };
      else {
        var paid = Math.min(team.coins, tile.fee);
        credit(team, -paid); credit(state.teams[owner], paid);
        state.event = { kind: 'fee', amount: paid, owner: owner };
      }
    } else if (tile.type === 'challenge') {
      state.challenge = true; state.phase = 'question'; state.event = null;
    } else {
      var amount = tile.type === 'penalty' ? -25 : tile.type === 'chance' ? (chance < 0.5 ? -15 : 35) : tile.type === 'bonus' ? 30 : 20;
      var before = team.coins;
      credit(team, amount);
      state.event = { kind: tile.type, amount: team.coins - before };
    }
  }
  function buy(state) {
    var team = state.teams[state.active];
    if (state.paused || state.phase !== 'event' || !state.event || state.event.kind !== 'buy' || team.coins < state.event.amount || state.owners[team.position] !== null) return false;
    credit(team, -state.event.amount); state.owners[team.position] = state.active; state.event.kind = 'purchased'; return true;
  }
  function next(state) {
    if (state.paused || state.phase !== 'event') return;
    state.log.unshift({ team: state.teams[state.active].name, tile: state.teams[state.active].position, coins: state.teams[state.active].coins });
    state.log = state.log.slice(0, 6);
    if (state.active === state.teams.length - 1 && state.closing) { state.phase = 'finished'; return; }
    state.active = (state.active + 1) % state.teams.length;
    if (state.active === 0) state.round++;
    state.phase = 'ready'; state.event = null;
  }
  function tick(state, seconds) {
    if (state.paused || state.phase === 'finished') return;
    state.remaining = Math.max(0, state.remaining - seconds);
    if (!state.remaining) state.closing = true;
  }
  function ranking(state) {
    var rows = state.teams.map(function(team, index) {
      var buildings = tiles.reduce(function(total, tile, tileIndex) { return total + (state.owners[tileIndex] === index ? tile.price : 0); }, 0);
      return { index: index, name: team.name, coins: team.coins, buildings: buildings, total: team.coins + buildings };
    }).sort(function(first, second) { return second.total - first.total; });
    rows.forEach(function(row, index) { row.rank = index && row.total === rows[index - 1].total ? rows[index - 1].rank : index + 1; });
    return rows;
  }
  function restore(raw) {
    try {
      var state = JSON.parse(raw);
      if (!state || state.version !== 1 || !Array.isArray(state.teams) || state.teams.length < 2 || state.teams.length > 4) return null;
      if (!state.teams.every(function(team) { return typeof team.name === 'string' && team.name.length <= 30 && Number.isSafeInteger(team.coins) && team.coins >= 0 && Number.isInteger(team.position) && team.position >= 0 && team.position < 24; })) return null;
      if (!Array.isArray(state.owners) || state.owners.length !== 24 || !state.owners.every(function(owner, index) { return owner === null || (tiles[index].type === 'building' && Number.isInteger(owner) && owner >= 0 && owner < state.teams.length); })) return null;
      if (!Array.isArray(state.questions) || !state.questions.length || !state.questions.every(function(item) { return typeof item.prompt === 'string' && item.prompt && typeof item.answer === 'string' && item.answer && Array.isArray(item.options) && item.options.every(function(option) { return typeof option === 'string'; }); })) return null;
      if (!['ready', 'rolling', 'moving', 'question', 'event', 'finished'].includes(state.phase) || !Number.isInteger(state.active) || state.active < 0 || state.active >= state.teams.length || !Number.isInteger(state.cursor) || state.cursor < 0 || !Number.isInteger(state.round) || state.round < 1 || !Number.isFinite(state.remaining) || state.remaining < 0 || state.remaining > 1800 || !Number.isInteger(state.dice) || state.dice < 1 || state.dice > 6 || !Number.isInteger(state.steps) || state.steps < 0 || state.steps > 6 || typeof state.closing !== 'boolean' || typeof state.challenge !== 'boolean' || !Array.isArray(state.log)) return null;
      if (['rolling', 'moving'].includes(state.phase) && !state.steps) return null;
      if (state.phase === 'event' && (!state.event || !['buy', 'own', 'fee', 'purchased', 'start', 'bonus', 'penalty', 'chance', 'challenge-result'].includes(state.event.kind) || !Number.isFinite(state.event.amount))) return null;
      if (state.event && state.event.kind === 'fee' && (!Number.isInteger(state.event.owner) || !state.teams[state.event.owner])) return null;
      if (state.event && state.event.kind === 'buy' && (tiles[state.teams[state.active].position].type !== 'building' || state.event.amount !== tiles[state.teams[state.active].position].price)) return null;
      if (!state.log.every(function(entry) { return entry && typeof entry.team === 'string' && Number.isInteger(entry.tile) && entry.tile >= 0 && entry.tile < 24 && Number.isSafeInteger(entry.coins) && entry.coins >= 0; })) return null;
      state.paused = state.phase !== 'finished';
      return state;
    } catch (error) { return null; }
  }
  return { tiles: tiles, parse: parse, create: create, roll: roll, step: step, question: question, judge: judge, buy: buy, next: next, tick: tick, ranking: ranking, restore: restore };
});
