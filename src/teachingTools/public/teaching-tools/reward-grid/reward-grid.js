// Match the shared navigation language cookie; teacher-entered content is never translated.
const language = /(?:^|; )lang=zh(?:;|$)/.test(document.cookie) ? 'zh' : 'en';
const t = (zh, en) => language === 'zh' ? zh : en;
document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
document.title = `${t('课堂抽奖格子', 'Classroom Reward Grid')} · Teacher Toolkit`;
if (language === 'en') {
  document.querySelectorAll('[data-en]').forEach(element => { element.textContent = element.dataset.en; });
  document.querySelectorAll('[data-en-placeholder]').forEach(element => { element.placeholder = element.dataset.enPlaceholder; });
  document.querySelectorAll('[data-en-aria-label]').forEach(element => { element.setAttribute('aria-label', element.dataset.enAriaLabel); });
}

// Holiday themes: colors become CSS variables; pool feeds the emoji picker, random rewards and reveal shower.
// `date(year)` returns that year's holiday (month is 1-based) so the picker can suggest the coming one.
const lunarDate = (table) => (year) => table[year] && [year, ...table[year]];
const THEMES = {
  classic: {
    icon: '🎁', name: ['经典', 'Classic'], title: ['课堂抽奖格子', 'Classroom Reward Grid'], board: ['今天的幸运格', "Today's reward grid"],
    done: ['全部揭晓！本轮挑战完成 🎉', 'All rewards revealed! Round complete 🎉'], marks: [],
    pool: ['🎁', '⭐', '🌟', '🏆', '🎉', '🍬', '🍭', '🎈', '🥇', '💎', '👍', '🌈'],
    colors: { tile: '#245c4c', tileBorder: '#3c7662', tileShadow: '#173e34', tileInk: '#ffffff', revealed: '#fff4d4', revealedInk: '#614b22', revealedBorder: '#ebd390', accent: '#205848', page: '#fff9e9' },
  },
  halloween: {
    icon: '🎃', name: ['万圣节', 'Halloween'], title: ['万圣节惊喜墙', 'Halloween Surprise Grid'], board: ['万圣节幸运格', 'Halloween reward grid'],
    done: ['不给糖就捣蛋！全部揭晓 🎃', 'Trick or treat! All rewards revealed 🎃'], marks: ['🎃', '👻', '🦇', '🕸️'],
    pool: ['🎃', '👻', '🦇', '🕸️', '🍬', '🍭', '🧙', '🕷️', '🌙', '🍫', '🍪', '🌕'],
    colors: { tile: '#3d2a5c', tileBorder: '#5a3f85', tileShadow: '#22163a', tileInk: '#ffffff', revealed: '#fff1df', revealedInk: '#7a3b0d', revealedBorder: '#f2b469', accent: '#c95a17', page: '#fbf4ec' },
    date: (y) => [y, 10, 31],
  },
  thanksgiving: {
    icon: '🦃', name: ['感恩节', 'Thanksgiving'], title: ['感恩节惊喜墙', 'Thanksgiving Surprise Grid'], board: ['感恩节幸运格', 'Thanksgiving reward grid'],
    done: ['谢谢大家！全部揭晓 🦃', 'Thank you, everyone! All rewards revealed 🦃'], marks: ['🦃', '🍂', '🌽', '🥧'],
    pool: ['🦃', '🥧', '🌽', '🍂', '🍁', '🥔', '🍎', '🍠', '🥖', '🧡', '🙏', '🌾'],
    colors: { tile: '#8a4a1f', tileBorder: '#a8622f', tileShadow: '#5a2e10', tileInk: '#ffffff', revealed: '#fdf0d8', revealedInk: '#6b3b14', revealedBorder: '#e6b877', accent: '#a84d18', page: '#fbf5ea' },
    date: (y) => [y, 11, 22 + (11 - new Date(y, 10, 1).getDay()) % 7], // fourth Thursday of November
  },
  christmas: {
    icon: '🎄', name: ['圣诞节', 'Christmas'], title: ['圣诞节惊喜墙', 'Christmas Surprise Grid'], board: ['圣诞幸运格', 'Christmas reward grid'],
    done: ['圣诞快乐！全部揭晓 🎄', 'Merry Christmas! All rewards revealed 🎄'], marks: ['🎄', '⛄', '🔔', '❄️'],
    pool: ['🎄', '🎅', '⛄', '🎁', '🔔', '🦌', '🍪', '🧦', '⭐', '❄️', '🍬', '🕯️'],
    colors: { tile: '#1f5c3a', tileBorder: '#2f7a4e', tileShadow: '#123a24', tileInk: '#ffffff', revealed: '#fff4f0', revealedInk: '#a3201f', revealedBorder: '#f0b9b0', accent: '#b3261e', page: '#f7f8f2' },
    date: (y) => [y, 12, 25],
  },
  'lunar-new-year': {
    icon: '🧧', name: ['春节', 'Lunar New Year'], title: ['春节惊喜墙', 'Lunar New Year Surprise Grid'], board: ['新年幸运格', 'New Year reward grid'],
    done: ['新年快乐！全部揭晓 🧧', 'Happy New Year! All rewards revealed 🧧'], marks: ['🧧', '🏮', '🧨', '🍊'],
    pool: ['🧧', '🏮', '🧨', '🍊', '🥟', '🐉', '💰', '🎆', '🎊', '🍡', '🐲', '🀄'],
    colors: { tile: '#b8231f', tileBorder: '#d13a2f', tileShadow: '#7a1411', tileInk: '#ffe7a6', revealed: '#fff6dc', revealedInk: '#9a1b16', revealedBorder: '#efc760', accent: '#b8231f', page: '#fff8ec' },
    date: lunarDate({ 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11] }),
  },
  valentine: {
    icon: '💝', name: ['情人节', "Valentine's Day"], title: ['情人节惊喜墙', "Valentine's Surprise Grid"], board: ['爱心幸运格', "Valentine's reward grid"],
    done: ['满满的爱！全部揭晓 💝', 'So much love! All rewards revealed 💝'], marks: ['💝', '💖', '💌', '🌹'],
    pool: ['💝', '💖', '💌', '🌹', '🍫', '🧸', '💕', '🎀', '🍬', '💐', '😍', '💗'],
    colors: { tile: '#c2335a', tileBorder: '#d9547a', tileShadow: '#861f3c', tileInk: '#ffffff', revealed: '#fff0f3', revealedInk: '#9c2348', revealedBorder: '#f5b5c6', accent: '#b52a51', page: '#fff6f8' },
    date: (y) => [y, 2, 14],
  },
  'dragon-boat': {
    icon: '🐉', name: ['端午节', 'Dragon Boat Festival'], title: ['端午节惊喜墙', 'Dragon Boat Surprise Grid'], board: ['端午幸运格', 'Dragon Boat reward grid'],
    done: ['划呀划！全部揭晓 🛶', 'Row, row! All rewards revealed 🛶'], marks: ['🐉', '🛶', '🌿', '🎏'],
    pool: ['🐉', '🛶', '🍙', '🌿', '🥢', '🎏', '🥇', '🌊', '🍃', '🎐', '🍵', '🏆'],
    colors: { tile: '#1e6b5c', tileBorder: '#2d8a77', tileShadow: '#134238', tileInk: '#ffffff', revealed: '#f2f9ea', revealedInk: '#2f5d1f', revealedBorder: '#b9d79b', accent: '#1e6b5c', page: '#f4f8f0' },
    date: lunarDate({ 2026: [6, 19], 2027: [6, 9], 2028: [5, 28], 2029: [6, 16], 2030: [6, 5], 2031: [6, 24], 2032: [6, 12] }),
  },
  'mid-autumn': {
    icon: '🥮', name: ['中秋节', 'Mid-Autumn Festival'], title: ['中秋节惊喜墙', 'Mid-Autumn Surprise Grid'], board: ['中秋幸运格', 'Mid-Autumn reward grid'],
    done: ['花好月圆！全部揭晓 🥮', 'Full moon, full marks! All rewards revealed 🥮'], marks: ['🥮', '🌕', '🐇', '🏮'],
    pool: ['🥮', '🌕', '🐇', '🏮', '🍵', '🌙', '✨', '🍐', '🍇', '🎑', '⭐', '🍊'],
    colors: { tile: '#23315e', tileBorder: '#374a85', tileShadow: '#141d3d', tileInk: '#fbe7a8', revealed: '#fff7dd', revealedInk: '#6a4d10', revealedBorder: '#ecd185', accent: '#2f3f78', page: '#f7f5ee' },
    date: lunarDate({ 2026: [9, 25], 2027: [9, 15], 2028: [10, 3], 2029: [9, 22], 2030: [9, 12], 2031: [10, 1], 2032: [9, 19] }),
  },
};
const COLOR_VARS = { tile: '--rg-tile', tileBorder: '--rg-tile-border', tileShadow: '--rg-tile-shadow', tileInk: '--rg-tile-ink', revealed: '--rg-revealed', revealedInk: '--rg-revealed-ink', revealedBorder: '--rg-revealed-border', accent: '--rg-accent', page: '--rg-page' };
const themeText = (pair) => t(pair[0], pair[1]);

// The holiday from the next 30 days (or the last 2) that is closest, or null.
function seasonalTheme(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let best = null;
  Object.entries(THEMES).forEach(([id, theme]) => {
    if (!theme.date) return;
    [start.getFullYear(), start.getFullYear() + 1].forEach(year => {
      const date = theme.date(year);
      if (!date) return;
      const days = Math.round((new Date(date[0], date[1] - 1, date[2]) - start) / 86400000);
      if (days >= -2 && days <= 30 && (!best || days < best.days)) best = { id, days };
    });
  });
  return best && best.id;
}

// A single localStorage record holds settings, image data URLs, and class progress.
const STORAGE_KEY = 'teacher-tool-reward-grid-v1';
const $ = (id) => document.getElementById(id);
const newCell = () => ({ question: '', type: 'points', reward: '10', revealed: false });
let state = { rows: 3, cols: 4, cells: Array.from({ length: 12 }, newCell), mode: 'setup', theme: 'classic', shower: true };
const currentTheme = () => THEMES[state.theme] || THEMES.classic;
let pendingImages = 0;

function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    message(t("已保存在此浏览器", "Saved in this browser"));
    return true;
  } catch {
    message(t("本地保存失败，可能空间不足或浏览器禁止存储。请减少图片；当前内容尚未保存，请勿关闭页面。", "Could not save locally. Storage may be full or blocked. Use fewer images. Your latest changes are not saved; keep this page open."), true);
    return false;
  }
}
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (stored) {
    if (!Number.isInteger(stored.rows) || stored.rows < 1 || stored.rows > 8 ||
        !Number.isInteger(stored.cols) || stored.cols < 1 || stored.cols > 8 ||
        !Array.isArray(stored.cells) || stored.cells.length !== stored.rows * stored.cols ||
        !stored.cells.every(c => c && typeof c.question === 'string' && typeof c.reward === 'string' &&
          ['points', 'emoji', 'image'].includes(c.type) && typeof c.revealed === 'boolean')) throw new Error('Invalid data');
    // Saves from before themes existed have no theme or shower setting.
    if (!Object.hasOwn(THEMES, stored.theme)) stored.theme = 'classic';
    if (typeof stored.shower !== 'boolean') stored.shower = true;
    state = stored;
  }
} catch { message(t("无法读取上次的数据，已打开新的设置。", "Could not load your previous data. A new setup has been opened."), true); }
// A shared link such as ?theme=lunar-new-year opens straight into that holiday.
const linkedTheme = new URLSearchParams(location.search).get('theme');
if (linkedTheme && Object.hasOwn(THEMES, linkedTheme) && linkedTheme !== state.theme) {
  remapEmoji(linkedTheme);
  state.theme = linkedTheme;
}
// Drop the parameter so a reload keeps whatever theme the teacher picks next.
if (linkedTheme !== null) history.replaceState(null, '', location.pathname + location.hash);

// Emoji rewards taken from the current theme move to the matching spot in the new one (🎃 → 🦃).
function remapEmoji(newId) {
  const oldPool = currentTheme().pool, newPool = THEMES[newId].pool;
  state.cells.forEach(cell => {
    const at = cell.type === 'emoji' ? oldPool.indexOf(cell.reward) : -1;
    if (at !== -1) cell.reward = newPool[at % newPool.length];
  });
}

function applyTheme() {
  const theme = currentTheme();
  Object.entries(COLOR_VARS).forEach(([key, cssVar]) => document.documentElement.style.setProperty(cssVar, theme.colors[key]));
  document.documentElement.dataset.rewardTheme = state.theme;
  $('theme-icon').textContent = theme.icon;
  $('tool-title').textContent = themeText(theme.title);
  $('board-title').textContent = themeText(theme.board);
  document.title = `${themeText(theme.title)} · Teacher Toolkit`;
  $('shower').checked = state.shower;
}

function renderThemePicker() {
  const suggested = seasonalTheme();
  $('theme-options').replaceChildren();
  Object.entries(THEMES).forEach(([id, theme]) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'theme-option';
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(id === state.theme));
    option.tabIndex = id === state.theme ? 0 : -1;
    const icon = document.createElement('span');
    icon.className = 'theme-option-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = theme.icon;
    const name = document.createElement('span');
    name.textContent = themeText(theme.name);
    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = `linear-gradient(90deg, ${theme.colors.tile} 50%, ${theme.colors.revealed} 50%)`;
    option.append(icon, name, swatch);
    if (id === suggested && id !== state.theme) {
      const tag = document.createElement('span');
      tag.className = 'theme-tag';
      tag.textContent = t('应季', 'In season');
      option.append(tag);
    }
    option.onclick = () => chooseTheme(id);
    option.onkeydown = (event) => {
      const ids = Object.keys(THEMES);
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      chooseTheme(ids[(ids.indexOf(id) + step + ids.length) % ids.length]);
      $('theme-options').querySelector('[aria-checked="true"]').focus();
    };
    $('theme-options').append(option);
  });
}

function chooseTheme(id) {
  if (id === state.theme) return;
  remapEmoji(id);
  state.theme = id;
  applyTheme();
  renderThemePicker();
  renderEditors();
  save();
}

// Falling theme emoji inside the reward card; off when the teacher unticks it or the device asks for less motion.
function showerEmoji() {
  if (!state.shower || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dialog = $('reward-dialog');
  dialog.querySelector('.emoji-shower')?.remove();
  const layer = document.createElement('div');
  layer.className = 'emoji-shower';
  layer.setAttribute('aria-hidden', 'true');
  const pool = currentTheme().pool;
  for (let i = 0; i < 22; i++) {
    const drop = document.createElement('span');
    drop.textContent = pool[Math.floor(Math.random() * pool.length)];
    drop.style.left = `${Math.random() * 94}%`;
    drop.style.fontSize = `${22 + Math.random() * 22}px`;
    drop.style.setProperty('--delay', `${(Math.random() * 0.9).toFixed(2)}s`);
    drop.style.setProperty('--duration', `${(1.8 + Math.random() * 1.2).toFixed(2)}s`);
    drop.style.setProperty('--spin', `${Math.round(Math.random() * 360 - 180)}deg`);
    layer.append(drop);
  }
  dialog.append(layer);
  setTimeout(() => layer.remove(), 3400);
}

function renderEditors() {
  $('bulk-questions').value = state.bulkQuestions || '';
  $('rows').value = state.rows;
  $('cols').value = state.cols;
  $('editors').replaceChildren();
  state.cells.forEach((cell, index) => {
    const card = document.createElement('article');
    card.className = 'editor';
    // Only fixed markup is used here. Teacher content is assigned through DOM properties.
    card.innerHTML = `<h3>${t(`格子 ${index + 1}`, `Tile ${index + 1}`)}</h3><label>${t("题目", "Question")}<textarea maxlength="2000" placeholder="${t("输入学生需要回答的问题", "Enter a question for students")}"></textarea></label><label>${t("奖励类型", "Reward type")}<select><option value="points">${t("分数", "Points")}</option><option value="emoji">${t("Emoji 礼物", "Emoji gift")}</option><option value="image">${t("上传图片", "Upload image")}</option></select></label><div class="reward-field"></div>`;
    const question = card.querySelector('textarea');
    question.value = cell.question;
    question.oninput = () => { cell.question = question.value; save(); };
    const type = card.querySelector('select');
    type.value = cell.type;
    type.onchange = () => {
      cell.type = type.value;
      cell.reward = cell.type === 'points' ? '10' : cell.type === 'emoji' ? currentTheme().pool[0] : '';
      renderRewardField(card, cell);
      save();
    };
    renderRewardField(card, cell);
    $('editors').append(card);
  });
}

function renderRewardField(card, cell) {
  const field = card.querySelector('.reward-field');
  field.replaceChildren();
  const label = document.createElement('label');
  label.textContent = cell.type === 'points' ? t("奖励分数（可为负数或 0）", "Reward points (negative numbers and zero allowed)") : cell.type === 'emoji' ? t("Emoji（例如 ⭐、🎁）", "Emoji (for example ⭐ or 🎁)") : t("奖励图片（仅本地保存）", "Reward image (saved locally only)");
  const input = document.createElement('input');
  input.className = 'reward-input';
  input.type = cell.type === 'image' ? 'file' : cell.type === 'points' ? 'number' : 'text';
  label.append(input);
  field.append(label);
  if (cell.type === 'image') {
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        message(t("请选择不超过 10 MB 的 PNG、JPEG、WebP 或 GIF 图片。", "Choose a PNG, JPEG, WebP, or GIF image no larger than 10 MB."), true);
        return;
      }
      pendingImages++;
      input.disabled = true;
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        // Ignore an upload if its cell was removed or its reward type changed meanwhile.
        if (state.cells.includes(cell) && cell.type === 'image') {
          cell.reward = canvas.toDataURL('image/webp', 0.8);
          renderRewardField(card, cell);
          save();
        }
      } catch { message(t("无法读取这张图片，请换一张重试。", "Could not read this image. Please try another."), true); }
      finally { pendingImages--; input.disabled = false; }
    };
    if (cell.reward.startsWith('data:image/')) {
      const preview = document.createElement('img');
      preview.src = cell.reward;
      preview.alt = t("已保存的奖励图片", "Saved reward image");
      preview.className = 'image-preview';
      field.append(preview);
    }
  } else {
    input.value = cell.reward;
    if (cell.type === 'points') input.step = 'any';
    else input.maxLength = 40;
    input.oninput = () => { cell.reward = input.value; save(); };
    if (cell.type === 'emoji') {
      // One-click choices from the current theme; typing any other emoji still works.
      const chips = document.createElement('div');
      chips.className = 'emoji-chips';
      chips.setAttribute('aria-label', t('主题 Emoji', 'Theme emoji'));
      currentTheme().pool.forEach(emoji => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'emoji-chip';
        chip.textContent = emoji;
        chip.setAttribute('aria-pressed', String(cell.reward === emoji));
        chip.onclick = () => {
          cell.reward = input.value = emoji;
          chips.querySelectorAll('.emoji-chip').forEach(other => other.setAttribute('aria-pressed', String(other === chip)));
          save();
        };
        chips.append(chip);
      });
      input.addEventListener('input', () => chips.querySelectorAll('.emoji-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.textContent === input.value))));
      field.append(chips);
    }
  }
}

function createReward(cell, index) {
  const reward = document.createElement(cell.type === 'image' ? 'img' : 'span');
  reward.className = 'reward-value';
  if (cell.type === 'image') {
    reward.src = cell.reward;
    reward.alt = t(`格子 ${index + 1} 的奖励图片`, `Reward image for tile ${index + 1}`);
  } else {
    reward.textContent = cell.type === 'points' ? t(`${cell.reward} 分`, `${cell.reward} points`) : cell.reward;
  }
  return reward;
}

function renderBoard() {
  $('board').style.setProperty('--cols', state.cols);
  $('board').replaceChildren();
  const opened = state.cells.filter(cell => cell.revealed).length;
  $('progress').textContent = opened === state.cells.length ? themeText(currentTheme().done) : t(`已揭晓 ${opened} / ${state.cells.length} · 看题选格，点击揭晓奖励`, `Revealed ${opened} / ${state.cells.length} · Choose a question and click to reveal its reward`);
  state.cells.forEach((cell, index) => {
    const tile = document.createElement('button');
    tile.className = `tile${cell.revealed ? ' revealed' : ''}`;
    tile.disabled = cell.revealed;
    const marks = currentTheme().marks;
    if (marks.length) tile.dataset.mark = marks[index % marks.length];
    const number = document.createElement('small');
    number.textContent = t(`格子 ${index + 1}`, `Tile ${index + 1}`);
    const question = document.createElement('span');
    question.className = 'tile-question';
    question.textContent = cell.question;
    tile.append(number, question);
    if (cell.revealed) {
      tile.append(createReward(cell, index));
      const caption = document.createElement('small');
      caption.textContent = t(`格子 ${index + 1} · 已揭晓`, `Tile ${index + 1} · Revealed`);
      tile.append(caption);
    } else {
      tile.onclick = () => {
        cell.revealed = true;
        save();
        renderBoard();
        $('reward-number').textContent = t(`格子 ${index + 1}`, `Tile ${index + 1}`);
        $('reward-question').textContent = cell.question;
        $('reward-content').replaceChildren(createReward(cell, index));
        $('reward-dialog').showModal();
        showerEmoji();
      };
    }
    $('board').append(tile);
  });
}
function showMode() {
  const playing = state.mode === 'classroom';
  $('setup').hidden = playing;
  $('classroom').hidden = !playing;
  if (playing) renderBoard();
  else renderEditors();
}
$('shower').onchange = () => { state.shower = $('shower').checked; save(); };
$('random-emoji').onclick = () => {
  const targets = state.cells.filter(cell => cell.type !== 'image');
  if (!targets.length) { message(t("所有格子都是图片奖励，没有可替换的格子。", "Every tile has an image reward, so there is nothing to replace."), true); return; }
  if (!confirm(t("把所有分数和 Emoji 奖励换成随机的主题 Emoji？图片奖励不会改变。", "Replace every points and emoji reward with a random theme emoji? Image rewards stay as they are."))) return;
  // Deal from a shuffled bag so emoji repeat as little as possible.
  let bag = [];
  targets.forEach(cell => {
    if (!bag.length) bag = currentTheme().pool.slice().sort(() => Math.random() - 0.5);
    cell.type = 'emoji';
    cell.reward = bag.pop();
  });
  renderEditors();
  if (save()) message(t(`已为 ${targets.length} 个格子换上主题 Emoji 奖励。`, `Gave ${targets.length} tiles a theme emoji reward.`));
};
$('bulk-questions').oninput = () => {
  state.bulkQuestions = $('bulk-questions').value;
  save();
};
$('generate-questions').onclick = () => {
  const questions = $('bulk-questions').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!questions.length) { message(t("请先输入题目，每行一道。", "Enter your questions first, one per line."), true); return; }
  if (questions.length > state.cells.length) {
    message(t(`共有 ${questions.length} 道题，当前只有 ${state.cells.length} 个格子。请先增加行数或列数，再生成。`, `You have ${questions.length} questions but only ${state.cells.length} tiles. Add rows or columns before generating.`), true);
    return;
  }
  if (questions.some(question => question.length > 2000)) {
    message(t("每道题最多 2000 字，请缩短过长的题目后再生成。", "Each question can contain up to 2,000 characters. Shorten longer questions before generating."), true); return;
  }
  if (state.cells.some(cell => cell.question.trim() || cell.revealed) &&
      !confirm(t("生成会替换所有格子的题目、清空多余格子的题目，并重置翻开进度。各格奖励会保留。继续吗？", "Generating replaces all tile questions, clears questions in unused tiles, and resets reveal progress. Reward settings are kept. Continue?"))) return;
  state.cells.forEach((cell, index) => {
    cell.question = questions[index] || '';
    cell.revealed = false;
  });
  renderEditors();
  if (save()) message(t(`已生成 ${questions.length} 道题，可在下方各格继续修改。`, `Generated ${questions.length} questions. You can edit each tile below.`));
};
$('resize').onclick = () => {
  const rows = Number($('rows').value), cols = Number($('cols').value);
  if (![rows, cols].every(n => Number.isInteger(n) && n >= 1 && n <= 8)) {
    message(t("行数和列数请输入 1–8 之间的整数。", "Enter whole numbers from 1 to 8 for rows and columns."), true); return;
  }
  const count = rows * cols;
  if (count < state.cells.length && !confirm(t("缩小网格将删除末尾格子的题目、奖励及进度。继续吗？", "Shrinking the grid deletes questions, rewards, and progress from the last tiles. Continue?"))) return;
  state.cells = Array.from({ length: count }, (_, i) => state.cells[i] || newCell());
  state.rows = rows; state.cols = cols;
  renderEditors(); save();
};
$('start').onclick = () => {
  if (pendingImages) { message(t("图片正在处理，请稍候再进入课堂。", "Images are still processing. Please wait before starting."), true); return; }
  const invalid = state.cells.findIndex(c => !c.question.trim() || !c.reward.trim() ||
    (c.type === 'points' && !Number.isFinite(Number(c.reward))) ||
    (c.type === 'image' && !c.reward.startsWith('data:image/')));
  if (invalid !== -1) {
    message(t(`请先填写格子 ${invalid + 1} 的题目和有效奖励。`, `Add a question and valid reward to tile ${invalid + 1} first.`), true);
    $('editors').children[invalid].scrollIntoView({ block: 'center' }); return;
  }
  state.mode = 'classroom'; save(); showMode(); window.scrollTo(0, 0);
};
$('edit').onclick = () => { state.mode = 'setup'; save(); showMode(); };
$('reset').onclick = () => {
  if (!confirm(t("重新隐藏所有奖励？题目和奖励设置会保留。", "Hide all rewards again? Your questions and reward settings will be kept."))) return;
  state.cells.forEach(cell => { cell.revealed = false; });
  save(); renderBoard();
};
$('close-reward').onclick = () => $('reward-dialog').close();
$('reward-dialog').addEventListener('close', () => {
  const next = $('board').querySelector('button:not(:disabled)');
  if (next) next.focus();
});
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { message(t("浏览器未允许全屏，请使用浏览器的全屏功能。", "Full screen was not allowed. Please use your browser’s full-screen option."), true); }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? t("退出全屏", "Exit full screen") : t("全屏投影", "Full screen");
});
applyTheme();
renderThemePicker();
showMode();
