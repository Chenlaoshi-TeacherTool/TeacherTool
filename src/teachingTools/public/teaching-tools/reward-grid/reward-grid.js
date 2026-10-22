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

// A single localStorage record holds settings, image data URLs, and class progress.
const STORAGE_KEY = 'teacher-tool-reward-grid-v1';
const $ = (id) => document.getElementById(id);
const newCell = () => ({ question: '', type: 'points', reward: '10', revealed: false });
let state = { rows: 3, cols: 4, cells: Array.from({ length: 12 }, newCell), mode: 'setup' };
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
    state = stored;
  }
} catch { message(t("无法读取上次的数据，已打开新的设置。", "Could not load your previous data. A new setup has been opened."), true); }

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
      cell.reward = cell.type === 'points' ? '10' : cell.type === 'emoji' ? '🎁' : '';
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
  $('progress').textContent = opened === state.cells.length ? t("全部揭晓！本轮挑战完成 🎉", "All rewards revealed! Round complete 🎉") : t(`已揭晓 ${opened} / ${state.cells.length} · 看题选格，点击揭晓奖励`, `Revealed ${opened} / ${state.cells.length} · Choose a question and click to reveal its reward`);
  state.cells.forEach((cell, index) => {
    const tile = document.createElement('button');
    tile.className = `tile${cell.revealed ? ' revealed' : ''}`;
    tile.disabled = cell.revealed;
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
showMode();
