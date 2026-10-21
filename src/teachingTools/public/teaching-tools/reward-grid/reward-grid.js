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
    message('已保存在此浏览器');
    return true;
  } catch {
    message('本地保存失败，可能空间不足或浏览器禁止存储。请减少图片；当前内容尚未保存，请勿关闭页面。', true);
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
} catch { message('无法读取上次的数据，已打开新的设置。', true); }

function renderEditors() {
  $('bulk-questions').value = state.bulkQuestions || '';
  $('rows').value = state.rows;
  $('cols').value = state.cols;
  $('editors').replaceChildren();
  state.cells.forEach((cell, index) => {
    const card = document.createElement('article');
    card.className = 'editor';
    // Only fixed markup is used here. Teacher content is assigned through DOM properties.
    card.innerHTML = `<h3>格子 ${index + 1}</h3><label>题目<textarea maxlength="2000" placeholder="输入学生需要回答的问题"></textarea></label><label>奖励类型<select><option value="points">分数</option><option value="emoji">Emoji 礼物</option><option value="image">上传图片</option></select></label><div class="reward-field"></div>`;
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
  label.textContent = cell.type === 'points' ? '奖励分数（可为负数或 0）' : cell.type === 'emoji' ? 'Emoji（例如 ⭐、🎁）' : '奖励图片（仅本地保存）';
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
        message('请选择不超过 10 MB 的 PNG、JPEG、WebP 或 GIF 图片。', true);
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
      } catch { message('无法读取这张图片，请换一张重试。', true); }
      finally { pendingImages--; input.disabled = false; }
    };
    if (cell.reward.startsWith('data:image/')) {
      const preview = document.createElement('img');
      preview.src = cell.reward;
      preview.alt = '已保存的奖励图片';
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
    reward.alt = `格子 ${index + 1} 的奖励图片`;
  } else {
    reward.textContent = cell.type === 'points' ? `${cell.reward} 分` : cell.reward;
  }
  return reward;
}

function renderBoard() {
  $('board').style.setProperty('--cols', state.cols);
  $('board').replaceChildren();
  const opened = state.cells.filter(cell => cell.revealed).length;
  $('progress').textContent = opened === state.cells.length ? '全部揭晓！本轮挑战完成 🎉' : `已揭晓 ${opened} / ${state.cells.length} · 看题选格，点击揭晓奖励`;
  state.cells.forEach((cell, index) => {
    const tile = document.createElement('button');
    tile.className = `tile${cell.revealed ? ' revealed' : ''}`;
    tile.disabled = cell.revealed;
    const number = document.createElement('small');
    number.textContent = `格子 ${index + 1}`;
    const question = document.createElement('span');
    question.className = 'tile-question';
    question.textContent = cell.question;
    tile.append(number, question);
    if (cell.revealed) {
      tile.append(createReward(cell, index));
      const caption = document.createElement('small');
      caption.textContent = `格子 ${index + 1} · 已揭晓`;
      tile.append(caption);
    } else {
      tile.onclick = () => {
        cell.revealed = true;
        save();
        renderBoard();
        $('reward-number').textContent = `格子 ${index + 1}`;
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
  if (!questions.length) { message('请先输入题目，每行一道。', true); return; }
  if (questions.length > state.cells.length) {
    message(`共有 ${questions.length} 道题，当前只有 ${state.cells.length} 个格子。请先增加行数或列数，再生成。`, true);
    return;
  }
  if (questions.some(question => question.length > 2000)) {
    message('每道题最多 2000 字，请缩短过长的题目后再生成。', true); return;
  }
  if (state.cells.some(cell => cell.question.trim() || cell.revealed) &&
      !confirm('生成会替换所有格子的题目、清空多余格子的题目，并重置翻开进度。各格奖励会保留。继续吗？')) return;
  state.cells.forEach((cell, index) => {
    cell.question = questions[index] || '';
    cell.revealed = false;
  });
  renderEditors();
  if (save()) message(`已生成 ${questions.length} 道题，可在下方各格继续修改。`);
};
$('resize').onclick = () => {
  const rows = Number($('rows').value), cols = Number($('cols').value);
  if (![rows, cols].every(n => Number.isInteger(n) && n >= 1 && n <= 8)) {
    message('行数和列数请输入 1–8 之间的整数。', true); return;
  }
  const count = rows * cols;
  if (count < state.cells.length && !confirm('缩小网格将删除末尾格子的题目、奖励及进度。继续吗？')) return;
  state.cells = Array.from({ length: count }, (_, i) => state.cells[i] || newCell());
  state.rows = rows; state.cols = cols;
  renderEditors(); save();
};
$('start').onclick = () => {
  if (pendingImages) { message('图片正在处理，请稍候再进入课堂。', true); return; }
  const invalid = state.cells.findIndex(c => !c.question.trim() || !c.reward.trim() ||
    (c.type === 'points' && !Number.isFinite(Number(c.reward))) ||
    (c.type === 'image' && !c.reward.startsWith('data:image/')));
  if (invalid !== -1) {
    message(`请先填写格子 ${invalid + 1} 的题目和有效奖励。`, true);
    $('editors').children[invalid].scrollIntoView({ block: 'center' }); return;
  }
  state.mode = 'classroom'; save(); showMode(); window.scrollTo(0, 0);
};
$('edit').onclick = () => { state.mode = 'setup'; save(); showMode(); };
$('reset').onclick = () => {
  if (!confirm('重新隐藏所有奖励？题目和奖励设置会保留。')) return;
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
  } catch { message('浏览器未允许全屏，请使用浏览器的全屏功能。', true); }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏投影';
});
showMode();
